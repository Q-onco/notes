/**
 * Q·onco Cloudflare Worker  —  enzo.quant-onco.workers.dev
 *
 * Routes:
 *   POST /llm              — Groq chat completions (streaming + non-streaming)
 *   POST /whisper          — Groq Whisper (verbose_json + word timestamps) + CF AI fallback
 *   POST /upload           — Store file in R2 (multipart or raw body)
 *   GET  /file/:key        — Serve file from R2
 *   DELETE /file/:key      — Delete file from R2
 *   GET  /storage/stats    — R2 usage: total count/bytes, breakdown by type
 *   POST /send-email       — Send via Brevo SMTP
 *   GET  /mail/contacts    — D1 contacts list
 *   POST /mail/contact     — Upsert contact
 *   DELETE /mail/contact/:id
 *   GET  /mail/sent        — Sent emails
 *   POST /mail/sent        — Log sent email
 *   GET  /mail/drafts      — Draft emails
 *   POST /mail/draft       — Upsert draft
 *   DELETE /mail/draft/:id
 *   POST /share            — Create expiring read-only share link
 *   GET  /s/:token         — Serve shared file (public)
 *   GET  /pubmed           — PubMed search proxy
 *   GET  /biorxiv          — bioRxiv/medRxiv feed
 *   GET  /news             — Nature/Cell RSS
 *   GET  /jobs-rss         — Academic/industry job feeds
 *   POST /audio/session    — Create D1 recording session, returns { sessionId }
 *   POST /audio/chunk      — Save transcript chunk + word timings to D1
 *   POST /audio/finalize   — Attach R2 key + generate BGE embedding
 *   GET  /audio/session/:id — Return recording + all segments
 *   POST /audio/search     — Semantic search via BGE cosine similarity
 */

const GROQ_API   = 'https://api.groq.com/openai/v1';
const NCBI       = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const BIORXIV    = 'https://api.biorxiv.org/details';
const BREVO_API  = 'https://api.brevo.com/v3/smtp/email';
const FROM_EMAIL = 'quant.onco@gmail.com';
const FROM_NAME  = 'Q·onco Research';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}

function err(msg, status = 500, origin = '*') {
  return json({ error: msg }, status, origin);
}

function typeFromKey(key) {
  const ext = (key.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png','jpg','jpeg','gif','svg','webp'].includes(ext)) return 'image';
  if (['webm','mp3','wav','ogg','m4a'].includes(ext)) return 'audio';
  if (['csv','tsv'].includes(ext)) return 'data';
  if (['r','py','js','ts','json','html','xml','md','txt','sh'].includes(ext)) return 'code';
  return 'other';
}

async function initMail(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
    role TEXT DEFAULT 'collaborator', created_at INTEGER NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS sent (
    id TEXT PRIMARY KEY, to_email TEXT NOT NULL, to_name TEXT,
    subject TEXT NOT NULL, body TEXT NOT NULL, sent_at INTEGER NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY, to_email TEXT, to_name TEXT,
    subject TEXT, body TEXT, updated_at INTEGER NOT NULL)`).run();
}

async function initShares(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS file_shares (
    token TEXT PRIMARY KEY,
    r2_key TEXT NOT NULL,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
}

async function initAudio(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY, r2_key TEXT, title TEXT, note_id TEXT,
      duration_sec INTEGER, mime_type TEXT, embedding TEXT,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS transcript_segments (
      id TEXT PRIMARY KEY, recording_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL, offset_sec REAL NOT NULL,
      text TEXT NOT NULL, words TEXT, created_at INTEGER NOT NULL,
      FOREIGN KEY (recording_id) REFERENCES recordings(id)
    )`),
  ]);
}

export default {
  async fetch(request, env) {
    const origin  = request.headers.get('Origin') ?? '*';
    const allowed = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(allowed) });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // ── POST /llm ─────────────────────────────────────────────────────────────
    if (path === '/llm' && request.method === 'POST') {
      if (!env.GROQ_API_KEY) return err('GROQ_API_KEY not configured', 500, allowed);
      try {
        const body = await request.json();
        const res = await fetch(`${GROQ_API}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
          body: JSON.stringify(body),
        });
        return new Response(res.body, {
          status: res.status,
          headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'text/event-stream', ...cors(allowed) },
        });
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── POST /whisper ──────────────────────────────────────────────────────────
    if (path === '/whisper' && request.method === 'POST') {
      if (!env.GROQ_API_KEY && !env.AI) return err('No transcription service configured', 500, allowed);
      try {
        const formData = await request.formData();
        const audio = formData.get('audio');
        if (!audio) return err('No audio file', 400, allowed);

        let text = '', words = [];

        // Primary: Groq Whisper with verbose_json + word timestamps
        if (env.GROQ_API_KEY) {
          try {
            const fd = new FormData();
            fd.append('file', audio, audio.name || 'recording.webm');
            fd.append('model', 'whisper-large-v3');
            fd.append('response_format', 'verbose_json');
            fd.append('timestamp_granularities[]', 'word');
            fd.append('language', 'en');
            const gr = await fetch(`${GROQ_API}/audio/transcriptions`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
              body: fd,
            });
            if (gr.ok) {
              const d = await gr.json();
              text = d.text || '';
              words = d.words ?? [];
            }
          } catch { /* fall to CF AI */ }
        }

        // Fallback: CF Workers AI Whisper
        if (!text && env.AI) {
          try {
            const ab = await audio.arrayBuffer();
            const cf = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
              audio: [...new Uint8Array(ab)],
            });
            text = cf.text || '';
            words = cf.words ?? [];
          } catch { /* silent */ }
        }

        return json({ text, words }, 200, allowed);
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── POST /upload  (R2 file storage) ───────────────────────────────────────
    if (path === '/upload' && request.method === 'POST') {
      if (!env.QONCO_FILES) return err('R2 not configured', 503, allowed);
      try {
        const ct = request.headers.get('Content-Type') ?? '';
        let key, blob, mime;

        if (ct.includes('multipart/form-data')) {
          const fd = await request.formData();
          const file = fd.get('file');
          if (!file) return err('No file field', 400, allowed);
          const prefix = fd.get('prefix') ?? 'files';
          const ext = file.name.split('.').pop() ?? 'bin';
          key  = `${prefix}/${crypto.randomUUID()}.${ext}`;
          blob = file;
          mime = file.type || 'application/octet-stream';
        } else {
          const body = await request.arrayBuffer();
          if (body.byteLength === 0) return err('Empty body', 400, allowed);
          if (body.byteLength > 200 * 1024 * 1024) return err('File too large (max 200 MB)', 413, allowed);
          const prefix = url.searchParams.get('prefix') ?? 'files';
          const ext    = url.searchParams.get('ext') ?? 'bin';
          mime = url.searchParams.get('mime') ?? (ct || 'application/octet-stream');
          key  = `${prefix}/${crypto.randomUUID()}.${ext}`;
          blob = new Blob([body], { type: mime });
        }

        await env.QONCO_FILES.put(key, blob, { httpMetadata: { contentType: mime } });
        return json({ key }, 200, allowed);
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── GET /file/:key ────────────────────────────────────────────────────────
    if (path.startsWith('/file/') && request.method === 'GET') {
      if (!env.QONCO_FILES) return err('R2 not configured', 503, allowed);
      const key = decodeURIComponent(path.slice('/file/'.length));
      if (!key) return err('Missing key', 400, allowed);
      try {
        const obj = await env.QONCO_FILES.get(key);
        if (!obj) return new Response('Not found', { status: 404, headers: cors(allowed) });
        const headers = new Headers(cors(allowed));
        headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'application/octet-stream');
        headers.set('Cache-Control', 'private, max-age=3600');
        return new Response(obj.body, { headers });
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── DELETE /file/:key ─────────────────────────────────────────────────────
    if (path.startsWith('/file/') && request.method === 'DELETE') {
      if (!env.QONCO_FILES) return err('R2 not configured', 503, allowed);
      const key = decodeURIComponent(path.slice('/file/'.length));
      try {
        await env.QONCO_FILES.delete(key);
        return new Response(null, { status: 204, headers: cors(allowed) });
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── GET /storage/stats ────────────────────────────────────────────────────
    if (path === '/storage/stats' && request.method === 'GET') {
      if (!env.QONCO_FILES) return err('R2 not configured', 503, allowed);
      try {
        let totalCount = 0;
        let totalBytes = 0;
        const byType = {};

        let cursor;
        do {
          const listed = await env.QONCO_FILES.list({ cursor, limit: 1000 });
          for (const obj of listed.objects) {
            totalCount++;
            totalBytes += obj.size;
            const t = typeFromKey(obj.key);
            if (!byType[t]) byType[t] = { count: 0, bytes: 0 };
            byType[t].count++;
            byType[t].bytes += obj.size;
          }
          cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);

        return json({ totalCount, totalBytes, byType, fetchedAt: Date.now() }, 200, allowed);
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── POST /send-email (Brevo) ──────────────────────────────────────────────
    if (path === '/send-email' && request.method === 'POST') {
      if (!env.BREVO_API_KEY) return err('BREVO_API_KEY not configured', 503, allowed);
      try {
        const { to, toName, subject, html, text } = await request.json();
        if (!to || !subject || (!html && !text)) return err('Missing to/subject/body', 400, allowed);
        const payload = {
          sender: { name: FROM_NAME, email: FROM_EMAIL },
          to: [{ email: to, name: toName || to }],
          subject,
          htmlContent: html || `<pre style="font-family:sans-serif">${text}</pre>`,
          textContent: text || html,
        };
        const res = await fetch(BREVO_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const detail = await res.text();
          return err(`Brevo error ${res.status}: ${detail}`, res.status, allowed);
        }
        return json({ ok: true }, 200, allowed);
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── Mail routes (D1) ──────────────────────────────────────────────────────
    if (path.startsWith('/mail/')) {
      if (!env.QONCO_MAIL) return err('D1 not configured', 503, allowed);
      await initMail(env.QONCO_MAIL);

      if (path === '/mail/contacts' && request.method === 'GET') {
        const { results } = await env.QONCO_MAIL.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
        return json(results.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at })), 200, allowed);
      }

      if (path === '/mail/contact' && request.method === 'POST') {
        const c = await request.json();
        await env.QONCO_MAIL.prepare(
          'INSERT OR REPLACE INTO contacts (id,name,email,role,created_at) VALUES (?,?,?,?,?)'
        ).bind(c.id, c.name, c.email, c.role ?? 'collaborator', c.createdAt ?? Date.now()).run();
        return json({ ok: true }, 200, allowed);
      }

      const contactDel = path.match(/^\/mail\/contact\/(.+)$/);
      if (contactDel && request.method === 'DELETE') {
        await env.QONCO_MAIL.prepare('DELETE FROM contacts WHERE id=?').bind(contactDel[1]).run();
        return new Response(null, { status: 204, headers: cors(allowed) });
      }

      if (path === '/mail/sent' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') ?? '100');
        const { results } = await env.QONCO_MAIL.prepare('SELECT * FROM sent ORDER BY sent_at DESC LIMIT ?').bind(limit).all();
        return json(results.map(r => ({ id: r.id, toEmail: r.to_email, toName: r.to_name, subject: r.subject, body: r.body, sentAt: r.sent_at })), 200, allowed);
      }

      if (path === '/mail/sent' && request.method === 'POST') {
        const s = await request.json();
        await env.QONCO_MAIL.prepare(
          'INSERT OR REPLACE INTO sent (id,to_email,to_name,subject,body,sent_at) VALUES (?,?,?,?,?,?)'
        ).bind(s.id, s.toEmail, s.toName ?? '', s.subject, s.body, s.sentAt ?? Date.now()).run();
        return json({ ok: true }, 200, allowed);
      }

      if (path === '/mail/drafts' && request.method === 'GET') {
        const { results } = await env.QONCO_MAIL.prepare('SELECT * FROM drafts ORDER BY updated_at DESC').all();
        return json(results.map(r => ({ id: r.id, toEmail: r.to_email ?? '', toName: r.to_name ?? '', subject: r.subject ?? '', body: r.body ?? '', updatedAt: r.updated_at })), 200, allowed);
      }

      if (path === '/mail/draft' && request.method === 'POST') {
        const d = await request.json();
        await env.QONCO_MAIL.prepare(
          'INSERT OR REPLACE INTO drafts (id,to_email,to_name,subject,body,updated_at) VALUES (?,?,?,?,?,?)'
        ).bind(d.id, d.toEmail ?? '', d.toName ?? '', d.subject ?? '', d.body ?? '', Date.now()).run();
        return json({ ok: true }, 200, allowed);
      }

      const draftDel = path.match(/^\/mail\/draft\/(.+)$/);
      if (draftDel && request.method === 'DELETE') {
        await env.QONCO_MAIL.prepare('DELETE FROM drafts WHERE id=?').bind(draftDel[1]).run();
        return new Response(null, { status: 204, headers: cors(allowed) });
      }
    }

    // ── POST /share ───────────────────────────────────────────────────────────
    if (path === '/share' && request.method === 'POST') {
      if (!env.QONCO_FILES) return err('R2 not configured', 503, allowed);
      if (!env.QONCO_MAIL)  return err('D1 not configured', 503, allowed);
      await initShares(env.QONCO_MAIL);
      try {
        const { r2Key, name, mime, expiresIn } = await request.json();
        if (!r2Key || !name) return err('Missing r2Key or name', 400, allowed);
        const durations = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
        const ms = durations[expiresIn] ?? 86400000;
        const expiresAt = Date.now() + ms;
        const tokenBytes = new Uint8Array(18);
        crypto.getRandomValues(tokenBytes);
        const token = [...tokenBytes].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
        await env.QONCO_MAIL.prepare(
          'INSERT INTO file_shares (token, r2_key, name, mime, expires_at, created_at) VALUES (?,?,?,?,?,?)'
        ).bind(token, r2Key, name, mime || 'application/octet-stream', expiresAt, Date.now()).run();
        const shareUrl = `${new URL(request.url).origin}/s/${token}`;
        return json({ token, url: shareUrl, expiresAt }, 200, allowed);
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── GET /s/:token (public share) ──────────────────────────────────────────
    if (path.startsWith('/s/') && request.method === 'GET') {
      if (!env.QONCO_FILES || !env.QONCO_MAIL) return new Response('Not configured', { status: 503 });
      await initShares(env.QONCO_MAIL);
      const token = path.slice('/s/'.length);
      if (!token) return new Response('Missing token', { status: 400 });
      try {
        const row = await env.QONCO_MAIL.prepare('SELECT * FROM file_shares WHERE token=?').bind(token).first();
        if (!row) return new Response('Link not found', { status: 404 });
        if (row.expires_at < Date.now()) return new Response('Link expired', { status: 410 });
        const obj = await env.QONCO_FILES.get(row.r2_key);
        if (!obj) return new Response('File not found', { status: 404 });
        const headers = new Headers({
          'Content-Type': row.mime || obj.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${encodeURIComponent(row.name)}"`,
          'Cache-Control': 'private, max-age=60',
          'Access-Control-Allow-Origin': '*',
        });
        return new Response(obj.body, { headers });
      } catch (e) { return new Response(e.message, { status: 500 }); }
    }

    // ── GET /pubmed ───────────────────────────────────────────────────────────
    if (path === '/pubmed' && request.method === 'GET') {
      try {
        const q   = url.searchParams.get('q') ?? 'ovarian cancer tumor microenvironment';
        const max = Math.min(parseInt(url.searchParams.get('max') ?? '12'), 25);
        const searchRes = await fetch(`${NCBI}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmax=${max}&retmode=json&sort=pub_date`);
        const searchData = await searchRes.json();
        const ids = searchData.esearchresult?.idlist ?? [];
        if (ids.length === 0) return json([], 200, allowed);
        const summaryRes = await fetch(`${NCBI}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
        const summaryData = await summaryRes.json();
        const result = summaryData.result;
        const papers = ids.map(id => {
          const item = result[id];
          if (!item) return null;
          const doi = (item.elocationid ?? '').replace('doi: ', '');
          return { id, title: item.title, authors: (item.authors ?? []).map(a => a.name).slice(0, 5), abstract: '', journal: item.fulljournalname, year: parseInt((item.pubdate ?? '').slice(0, 4)), doi, url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, source: 'pubmed' };
        }).filter(Boolean);
        return json(papers, 200, allowed);
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── GET /biorxiv ──────────────────────────────────────────────────────────
    if (path === '/biorxiv' && request.method === 'GET') {
      try {
        const server = url.searchParams.get('server') === 'medrxiv' ? 'medrxiv' : 'biorxiv';
        const days   = Math.min(parseInt(url.searchParams.get('days') ?? '7'), 30);
        const end    = new Date(); const start = new Date(); start.setDate(start.getDate() - days);
        const fmt    = d => d.toISOString().slice(0, 10);
        const res    = await fetch(`${BIORXIV}/${server}/${fmt(start)}/${fmt(end)}/0/json`);
        if (!res.ok) return json([], 200, allowed);
        const data = await res.json();
        const oncologyRe = /ovarian|cancer|oncol|tumor|carcinoma|biomarker|RNA.seq|transcriptomic|PARP|checkpoint|immune/i;
        const filtered = (data.collection ?? [])
          .filter(p => oncologyRe.test(String(p.title) + ' ' + String(p.abstract)))
          .slice(0, 10)
          .map(p => ({ id: p.doi, title: p.title, authors: String(p.authors ?? '').split('; ').slice(0, 4), abstract: p.abstract, journal: server === 'biorxiv' ? 'bioRxiv' : 'medRxiv', year: parseInt(String(p.date ?? '').slice(0, 4)), doi: p.doi, url: `https://doi.org/${p.doi}`, source: server }));
        return json(filtered, 200, allowed);
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── GET /news ─────────────────────────────────────────────────────────────
    if (path === '/news' && request.method === 'GET') {
      try {
        const sources = (url.searchParams.get('sources') ?? 'nature,cell').split(',');
        const RSS_FEEDS = { nature: 'https://www.nature.com/subjects/cancer.rss', cell: 'https://www.cell.com/cell/rss' };
        const results = [];
        for (const src of sources) {
          const feedUrl = RSS_FEEDS[src.trim()];
          if (!feedUrl) continue;
          try {
            const res = await fetch(feedUrl, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
            if (!res.ok) continue;
            results.push(...parseRSSItems(await res.text(), src.trim()));
          } catch { /* skip */ }
        }
        return json(results, 200, allowed);
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── GET /jobs-rss ─────────────────────────────────────────────────────────
    if (path === '/jobs-rss' && request.method === 'GET') {
      try {
        const JOB_FEEDS = {
          'nature-careers': { url: 'https://www.nature.com/naturecareers.rss', label: 'Nature Careers', region: 'eu' },
          'embl':           { url: 'https://www.embl.org/careers/rss/', label: 'EMBL', region: 'eu' },
          'euraxess':       { url: 'https://euraxess.ec.europa.eu/jobs/rss', label: 'EurAxess', region: 'eu' },
          'indeed-de':      { url: 'https://rss.indeed.com/rss?q=oncology+bioinformatics+scientist&l=Germany&sort=date', label: 'Indeed Germany', region: 'eu' },
          'indeed-in':      { url: 'https://rss.indeed.com/rss?q=cancer+research+scientist&l=India&sort=date', label: 'Indeed India', region: 'india' },
          'jobs-ac':        { url: 'https://www.jobs.ac.uk/search/?keywords=cancer+bioinformatics&format=rss', label: 'jobs.ac.uk', region: 'uk' },
        };
        const requested = (url.searchParams.get('sources') ?? 'nature-careers,embl,euraxess,indeed-de,indeed-in,jobs-ac').split(',');
        const results = [];
        await Promise.all(requested.map(async src => {
          const feed = JOB_FEEDS[src.trim()];
          if (!feed) return;
          try {
            const res = await fetch(feed.url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' } });
            if (!res.ok) return;
            results.push(...parseJobItems(await res.text(), feed.label, feed.region));
          } catch { /* skip */ }
        }));
        return json(results, 200, allowed);
      } catch (e) { return err(e.message, 500, allowed); }
    }

    // ── Audio session routes (QONCO_AUDIO D1) ─────────────────────────────────
    if (path.startsWith('/audio/')) {
      if (!env.QONCO_AUDIO) return err('QONCO_AUDIO not configured', 503, allowed);
      await initAudio(env.QONCO_AUDIO);

      // POST /audio/session — create recording row
      if (path === '/audio/session' && request.method === 'POST') {
        try {
          const sessionId = crypto.randomUUID();
          await env.QONCO_AUDIO.prepare(
            'INSERT INTO recordings (id, created_at) VALUES (?, ?)'
          ).bind(sessionId, Date.now()).run();
          return json({ sessionId }, 201, allowed);
        } catch (e) { return err(e.message, 500, allowed); }
      }

      // POST /audio/chunk — save transcript segment + word timings
      if (path === '/audio/chunk' && request.method === 'POST') {
        try {
          const { sessionId, chunkIndex, offsetSec, text, words } = await request.json();
          if (!sessionId || chunkIndex === undefined || offsetSec === undefined || !text)
            return err('Missing required fields', 400, allowed);
          await env.QONCO_AUDIO.prepare(
            'INSERT OR REPLACE INTO transcript_segments (id, recording_id, chunk_index, offset_sec, text, words, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            `${sessionId}-${chunkIndex}`, sessionId, chunkIndex, offsetSec,
            text, words ? JSON.stringify(words) : null, Date.now()
          ).run();
          return json({ ok: true }, 200, allowed);
        } catch (e) { return err(e.message, 500, allowed); }
      }

      // POST /audio/finalize — attach R2 key + generate BGE embedding
      if (path === '/audio/finalize' && request.method === 'POST') {
        try {
          const { sessionId, r2Key, durationSec: dur } = await request.json();
          if (!sessionId) return err('Missing sessionId', 400, allowed);
          const { results: segs } = await env.QONCO_AUDIO.prepare(
            'SELECT text FROM transcript_segments WHERE recording_id=? ORDER BY chunk_index ASC'
          ).bind(sessionId).all();
          const fullText = segs.map(s => s.text).join(' ').trim();
          let embedding = null;
          if (env.AI && fullText) {
            try {
              const emb = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [fullText] });
              embedding = JSON.stringify(emb.data[0]);
            } catch { /* non-fatal */ }
          }
          const title = fullText ? fullText.slice(0, 80) + (fullText.length > 80 ? '…' : '') : null;
          await env.QONCO_AUDIO.prepare(
            'UPDATE recordings SET r2_key=?, duration_sec=?, embedding=?, title=? WHERE id=?'
          ).bind(r2Key ?? null, dur ?? null, embedding, title, sessionId).run();
          return json({ ok: true }, 200, allowed);
        } catch (e) { return err(e.message, 500, allowed); }
      }

      // GET /audio/session/:id — return recording + all segments
      const sessionIdMatch = path.match(/^\/audio\/session\/(.+)$/);
      if (sessionIdMatch && request.method === 'GET') {
        try {
          const id = sessionIdMatch[1];
          const recording = await env.QONCO_AUDIO.prepare(
            'SELECT * FROM recordings WHERE id=?'
          ).bind(id).first();
          if (!recording) return err('Not found', 404, allowed);
          const { results: segments } = await env.QONCO_AUDIO.prepare(
            'SELECT chunk_index, offset_sec, text, words FROM transcript_segments WHERE recording_id=? ORDER BY chunk_index ASC'
          ).bind(id).all();
          return json({ recording, segments }, 200, allowed);
        } catch (e) { return err(e.message, 500, allowed); }
      }

      // POST /audio/search — BGE semantic similarity search
      if (path === '/audio/search' && request.method === 'POST') {
        if (!env.AI) return err('Workers AI not configured', 503, allowed);
        try {
          const { query } = await request.json();
          if (!query) return err('Missing query', 400, allowed);
          const qEmb = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] });
          const qVec = qEmb.data[0];
          const { results } = await env.QONCO_AUDIO.prepare(
            'SELECT id, title, embedding FROM recordings WHERE embedding IS NOT NULL'
          ).all();
          const scored = [];
          for (const row of results) {
            try {
              const emb = JSON.parse(row.embedding);
              let dot = 0, normA = 0, normB = 0;
              for (let i = 0; i < qVec.length; i++) {
                dot += qVec[i] * emb[i];
                normA += qVec[i] * qVec[i];
                normB += emb[i] * emb[i];
              }
              const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));
              scored.push({ sessionId: row.id, title: row.title, score: Math.round(score * 1000) / 1000 });
            } catch { /* skip malformed row */ }
          }
          scored.sort((a, b) => b.score - a.score);
          return json(scored.slice(0, 5), 200, allowed);
        } catch (e) { return err(e.message, 500, allowed); }
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

function parseJobItems(xml, source, region) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 12) {
    const item = m[1];
    const get = tag => { const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`); return (item.match(r)?.[1] ?? '').trim(); };
    const rawTitle = get('title'); const link = get('link') || get('guid');
    const desc = get('description').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
    if (!rawTitle || !link) continue;
    let title = rawTitle, company = source, location = get('location') || '';
    const dashParts = rawTitle.split(' - ');
    if (source.startsWith('Indeed') && dashParts.length >= 2) { title = dashParts[0].trim(); company = dashParts[1]?.trim() ?? source; if (dashParts.length >= 3) location = dashParts.slice(2).join(' - ').trim(); }
    const combined = (title + ' ' + desc).toLowerCase();
    let type = 'industry';
    if (/postdoc|post-doc|fellowship|phd student|graduate|group leader|professor|faculty|lecturer/i.test(combined)) type = 'academic';
    else if (/contract|freelance|consultant/i.test(combined)) type = 'contract';
    else if (/startup|early.stage|series [ab]/i.test(combined)) type = 'startup';
    const tags = [];
    const tagMap = { 'scRNA-seq': /scrna.seq|single.cell rna/i, 'spatial': /spatial transcriptom|visium|xenium|merfish/i, 'bioinformatics': /bioinformatics|computational biology/i, 'PARP inhibitors': /parp inhibitor|olaparib|niraparib|rucaparib/i, 'immuno-oncology': /immuno.oncology|checkpoint|immunotherapy/i, 'ovarian cancer': /ovarian cancer|hgsoc|gynaecolog/i, 'genomics': /genomics|next.generation sequencing|ngs/i, 'proteomics': /proteomics|mass spectrometry/i };
    for (const [tag, re] of Object.entries(tagMap)) { if (re.test(combined)) tags.push(tag); }
    items.push({ id: link, title, company, location: location || (region === 'eu' ? 'Europe' : region === 'india' ? 'India' : 'UK'), region, type, description: desc.slice(0, 400), url: link, source, postedAt: get('pubDate') ? new Date(get('pubDate')).getTime() : null, deadline: null, tags });
  }
  return items;
}

function parseRSSItems(xml, source) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 8) {
    const item = m[1];
    const get = tag => { const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`); return (item.match(r)?.[1] ?? '').trim(); };
    const title = get('title'); const link = get('link');
    if (!title) continue;
    items.push({ id: link || title, title, authors: [], abstract: get('description').replace(/<[^>]+>/g, '').slice(0, 300), journal: source === 'nature' ? 'Nature' : 'Cell', year: new Date().getFullYear(), doi: link.includes('doi.org') ? link.split('doi.org/')[1] : '', url: link, source });
  }
  return items;
}
