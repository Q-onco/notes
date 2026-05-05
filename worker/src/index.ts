interface Env {
  GROQ_API_KEY: string;
  ALLOWED_ORIGIN: string;
  BREVO_API_KEY?: string;
  QONCO_FILES?: R2Bucket;
  QONCO_MAIL?: D1Database;
}

async function initShares(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS file_shares (
    token TEXT PRIMARY KEY,
    r2_key TEXT NOT NULL,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
}

const GROQ_API = 'https://api.groq.com/openai/v1';
const NCBI     = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const BIORXIV  = 'https://api.biorxiv.org/details';
const BREVO_API = 'https://api.brevo.com/v3/smtp/email';
const FROM_EMAIL = 'quant.onco@gmail.com';
const FROM_NAME  = 'Q·onco Research';

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}

function err(msg: string, status = 500, origin = '*') {
  return json({ error: msg }, status, origin);
}

// ── D1 schema init ─────────────────────────────────────────────────────────────
async function initMail(db: D1Database) {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin  = request.headers.get('Origin') ?? '*';
    const allowed = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(allowed) });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // ── POST /llm ────────────────────────────────────────────────────────────
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
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── POST /whisper ────────────────────────────────────────────────────────
    if (path === '/whisper' && request.method === 'POST') {
      if (!env.GROQ_API_KEY) return err('GROQ_API_KEY not configured', 500, allowed);
      try {
        const formData = await request.formData();
        const audio = formData.get('audio') as File | null;
        if (!audio) return err('No audio file', 400, allowed);
        const fd = new FormData();
        fd.append('file', audio, audio.name || 'recording.webm');
        fd.append('model', 'whisper-large-v3');
        fd.append('response_format', 'json');
        fd.append('language', 'en');
        const res = await fetch(`${GROQ_API}/audio/transcriptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
          body: fd,
        });
        if (!res.ok) return err(`Whisper error: ${res.status}`, res.status, allowed);
        const data = await res.json() as { text: string };
        return json({ text: data.text }, 200, allowed);
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── POST /upload  (R2 file / audio storage) ──────────────────────────────
    if (path === '/upload' && request.method === 'POST') {
      if (!env.QONCO_FILES) return err('R2 not configured', 503, allowed);
      try {
        const ct = request.headers.get('Content-Type') ?? '';
        let key: string;
        let blob: Blob;
        let mime: string;

        if (ct.includes('multipart/form-data')) {
          const fd = await request.formData();
          const file = fd.get('file') as File | null;
          if (!file) return err('No file field', 400, allowed);
          const prefix = (fd.get('prefix') as string | null) ?? 'files';
          const ext = file.name.split('.').pop() ?? 'bin';
          key  = `${prefix}/${crypto.randomUUID()}.${ext}`;
          blob = file;
          mime = file.type || 'application/octet-stream';
        } else {
          // raw binary body (used for audio blobs)
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
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── GET /file/* (R2 download) ────────────────────────────────────────────
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
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── DELETE /file/* (R2 delete) ───────────────────────────────────────────
    if (path.startsWith('/file/') && request.method === 'DELETE') {
      if (!env.QONCO_FILES) return err('R2 not configured', 503, allowed);
      const key = decodeURIComponent(path.slice('/file/'.length));
      try {
        await env.QONCO_FILES.delete(key);
        return new Response(null, { status: 204, headers: cors(allowed) });
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── POST /send-email (Brevo) ─────────────────────────────────────────────
    if (path === '/send-email' && request.method === 'POST') {
      if (!env.BREVO_API_KEY) return err('BREVO_API_KEY not configured', 503, allowed);
      try {
        const { to, toName, subject, html, text } = await request.json() as Record<string, string>;
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
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── Mail routes (D1) ─────────────────────────────────────────────────────
    if (path.startsWith('/mail/')) {
      if (!env.QONCO_MAIL) return err('D1 not configured', 503, allowed);
      await initMail(env.QONCO_MAIL);

      // GET /mail/contacts
      if (path === '/mail/contacts' && request.method === 'GET') {
        const { results } = await env.QONCO_MAIL.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
        return json(results.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at })), 200, allowed);
      }

      // POST /mail/contact (upsert)
      if (path === '/mail/contact' && request.method === 'POST') {
        const c = await request.json() as Record<string, unknown>;
        await env.QONCO_MAIL.prepare(
          'INSERT OR REPLACE INTO contacts (id,name,email,role,created_at) VALUES (?,?,?,?,?)'
        ).bind(c.id, c.name, c.email, c.role ?? 'collaborator', c.createdAt ?? Date.now()).run();
        return json({ ok: true }, 200, allowed);
      }

      // DELETE /mail/contact/:id
      const contactDel = path.match(/^\/mail\/contact\/(.+)$/);
      if (contactDel && request.method === 'DELETE') {
        await env.QONCO_MAIL.prepare('DELETE FROM contacts WHERE id=?').bind(contactDel[1]).run();
        return new Response(null, { status: 204, headers: cors(allowed) });
      }

      // GET /mail/sent
      if (path === '/mail/sent' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') ?? '100');
        const { results } = await env.QONCO_MAIL.prepare('SELECT * FROM sent ORDER BY sent_at DESC LIMIT ?').bind(limit).all();
        return json(results.map(r => ({ id: r.id, toEmail: r.to_email, toName: r.to_name, subject: r.subject, body: r.body, sentAt: r.sent_at })), 200, allowed);
      }

      // POST /mail/sent (log)
      if (path === '/mail/sent' && request.method === 'POST') {
        const s = await request.json() as Record<string, unknown>;
        await env.QONCO_MAIL.prepare(
          'INSERT OR REPLACE INTO sent (id,to_email,to_name,subject,body,sent_at) VALUES (?,?,?,?,?,?)'
        ).bind(s.id, s.toEmail, s.toName ?? '', s.subject, s.body, s.sentAt ?? Date.now()).run();
        return json({ ok: true }, 200, allowed);
      }

      // GET /mail/drafts
      if (path === '/mail/drafts' && request.method === 'GET') {
        const { results } = await env.QONCO_MAIL.prepare('SELECT * FROM drafts ORDER BY updated_at DESC').all();
        return json(results.map(r => ({ id: r.id, toEmail: r.to_email ?? '', toName: r.to_name ?? '', subject: r.subject ?? '', body: r.body ?? '', updatedAt: r.updated_at })), 200, allowed);
      }

      // POST /mail/draft (upsert)
      if (path === '/mail/draft' && request.method === 'POST') {
        const d = await request.json() as Record<string, unknown>;
        await env.QONCO_MAIL.prepare(
          'INSERT OR REPLACE INTO drafts (id,to_email,to_name,subject,body,updated_at) VALUES (?,?,?,?,?,?)'
        ).bind(d.id, d.toEmail ?? '', d.toName ?? '', d.subject ?? '', d.body ?? '', Date.now()).run();
        return json({ ok: true }, 200, allowed);
      }

      // DELETE /mail/draft/:id
      const draftDel = path.match(/^\/mail\/draft\/(.+)$/);
      if (draftDel && request.method === 'DELETE') {
        await env.QONCO_MAIL.prepare('DELETE FROM drafts WHERE id=?').bind(draftDel[1]).run();
        return new Response(null, { status: 204, headers: cors(allowed) });
      }
    }

    // ── GET /pubmed ──────────────────────────────────────────────────────────
    if (path === '/pubmed' && request.method === 'GET') {
      try {
        const q   = url.searchParams.get('q') ?? 'ovarian cancer tumor microenvironment';
        const max = Math.min(parseInt(url.searchParams.get('max') ?? '12'), 25);
        const searchRes = await fetch(`${NCBI}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmax=${max}&retmode=json&sort=pub_date`);
        const searchData = await searchRes.json() as { esearchresult: { idlist: string[] } };
        const ids = searchData.esearchresult?.idlist ?? [];
        if (ids.length === 0) return json([], 200, allowed);
        const summaryRes = await fetch(`${NCBI}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
        const summaryData = await summaryRes.json() as { result: Record<string, unknown> };
        const result = summaryData.result;
        const papers = ids.map((id: string) => {
          const item = result[id] as Record<string, unknown> | undefined;
          if (!item) return null;
          const doi = (item.elocationid as string)?.replace('doi: ', '') ?? '';
          return { id, title: item.title, authors: ((item.authors as { name: string }[]) ?? []).map(a => a.name).slice(0, 5), abstract: '', journal: item.fulljournalname, year: parseInt(((item.pubdate as string) ?? '').slice(0, 4)), doi, url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, source: 'pubmed' };
        }).filter(Boolean);
        return json(papers, 200, allowed);
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── GET /biorxiv ─────────────────────────────────────────────────────────
    if (path === '/biorxiv' && request.method === 'GET') {
      try {
        const server = url.searchParams.get('server') === 'medrxiv' ? 'medrxiv' : 'biorxiv';
        const days   = Math.min(parseInt(url.searchParams.get('days') ?? '7'), 30);
        const end    = new Date(); const start = new Date(); start.setDate(start.getDate() - days);
        const fmt    = (d: Date) => d.toISOString().slice(0, 10);
        const res    = await fetch(`${BIORXIV}/${server}/${fmt(start)}/${fmt(end)}/0/json`);
        if (!res.ok) return json([], 200, allowed);
        const data = await res.json() as { collection: Record<string, unknown>[] };
        const oncologyRe = /ovarian|cancer|oncol|tumor|carcinoma|biomarker|RNA.seq|transcriptomic|PARP|checkpoint|immune/i;
        const filtered = (data.collection ?? [])
          .filter(p => oncologyRe.test(String(p.title) + ' ' + String(p.abstract)))
          .slice(0, 10)
          .map(p => ({ id: p.doi, title: p.title, authors: String(p.authors ?? '').split('; ').slice(0, 4), abstract: p.abstract, journal: server === 'biorxiv' ? 'bioRxiv' : 'medRxiv', year: parseInt(String(p.date ?? '').slice(0, 4)), doi: p.doi, url: `https://doi.org/${p.doi}`, source: server }));
        return json(filtered, 200, allowed);
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── GET /news ────────────────────────────────────────────────────────────
    if (path === '/news' && request.method === 'GET') {
      try {
        const sources = (url.searchParams.get('sources') ?? 'nature,cell').split(',');
        const RSS_FEEDS: Record<string, string> = { nature: 'https://www.nature.com/subjects/cancer.rss', cell: 'https://www.cell.com/cell/rss' };
        const results: unknown[] = [];
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
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── GET /jobs-rss ────────────────────────────────────────────────────────
    if (path === '/jobs-rss' && request.method === 'GET') {
      try {
        const JOB_FEEDS: Record<string, { url: string; label: string; region: string }> = {
          'nature-careers': { url: 'https://www.nature.com/naturecareers.rss', label: 'Nature Careers', region: 'eu' },
          'embl':           { url: 'https://www.embl.org/careers/rss/', label: 'EMBL', region: 'eu' },
          'euraxess':       { url: 'https://euraxess.ec.europa.eu/jobs/rss', label: 'EurAxess', region: 'eu' },
          'indeed-de':      { url: 'https://rss.indeed.com/rss?q=oncology+bioinformatics+scientist&l=Germany&sort=date', label: 'Indeed Germany', region: 'eu' },
          'indeed-in':      { url: 'https://rss.indeed.com/rss?q=cancer+research+scientist&l=India&sort=date', label: 'Indeed India', region: 'india' },
          'jobs-ac':        { url: 'https://www.jobs.ac.uk/search/?keywords=cancer+bioinformatics&format=rss', label: 'jobs.ac.uk', region: 'uk' },
        };
        const requested = (url.searchParams.get('sources') ?? 'nature-careers,embl,euraxess,indeed-de,indeed-in,jobs-ac').split(',');
        const results: unknown[] = [];
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
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── POST /share (create shareable read-only link for an R2 file) ────────
    if (path === '/share' && request.method === 'POST') {
      if (!env.QONCO_FILES) return err('R2 not configured', 503, allowed);
      if (!env.QONCO_MAIL)  return err('D1 not configured', 503, allowed);
      await initShares(env.QONCO_MAIL);
      try {
        const body = await request.json() as { r2Key: string; name: string; mime: string; expiresIn: '1h' | '24h' | '7d' | '30d' };
        const { r2Key, name, mime, expiresIn } = body;
        if (!r2Key || !name) return err('Missing r2Key or name', 400, allowed);
        const durations: Record<string, number> = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
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
      } catch (e) { return err((e as Error).message, 500, allowed); }
    }

    // ── GET /s/:token (serve shared file, public — no CORS restriction) ─────
    if (path.startsWith('/s/') && request.method === 'GET') {
      if (!env.QONCO_FILES || !env.QONCO_MAIL) return new Response('Not configured', { status: 503 });
      await initShares(env.QONCO_MAIL);
      const token = path.slice('/s/'.length);
      if (!token) return new Response('Missing token', { status: 400 });
      try {
        const row = await env.QONCO_MAIL.prepare('SELECT * FROM file_shares WHERE token=?').bind(token).first() as Record<string, unknown> | null;
        if (!row) return new Response('Link not found', { status: 404 });
        if ((row.expires_at as number) < Date.now()) return new Response('Link expired', { status: 410 });
        const obj = await env.QONCO_FILES.get(row.r2_key as string);
        if (!obj) return new Response('File not found', { status: 404 });
        const headers = new Headers({
          'Content-Type': (row.mime as string) || obj.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${encodeURIComponent(row.name as string)}"`,
          'Cache-Control': 'private, max-age=60',
          'Access-Control-Allow-Origin': '*',
        });
        return new Response(obj.body, { headers });
      } catch (e) { return new Response((e as Error).message, { status: 500 }); }
    }

    return new Response('Not found', { status: 404 });
  },
};

function parseJobItems(xml: string, source: string, region: string): unknown[] {
  const items: unknown[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 12) {
    const item = m[1];
    const get = (tag: string) => { const r = new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`); return (item.match(r)?.[1] ?? '').trim(); };
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
    const tags: string[] = [];
    const tagMap: Record<string, RegExp> = { 'scRNA-seq': /scrna.seq|single.cell rna/i, 'spatial': /spatial transcriptom|visium|xenium|merfish/i, 'bioinformatics': /bioinformatics|computational biology/i, 'PARP inhibitors': /parp inhibitor|olaparib|niraparib|rucaparib/i, 'immuno-oncology': /immuno.oncology|checkpoint|immunotherapy/i, 'ovarian cancer': /ovarian cancer|hgsoc|gynaecolog/i, 'genomics': /genomics|next.generation sequencing|ngs/i, 'proteomics': /proteomics|mass spectrometry/i };
    for (const [tag, re] of Object.entries(tagMap)) { if (re.test(combined)) tags.push(tag); }
    items.push({ id: link, title, company, location: location || (region === 'eu' ? 'Europe' : region === 'india' ? 'India' : 'UK'), region, type, description: desc.slice(0, 400), url: link, source, postedAt: get('pubDate') ? new Date(get('pubDate')).getTime() : null, deadline: null, tags });
  }
  return items;
}

function parseRSSItems(xml: string, source: string): unknown[] {
  const items: unknown[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 8) {
    const item = m[1];
    const get = (tag: string) => { const r = new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`); return (item.match(r)?.[1] ?? '').trim(); };
    const title = get('title'); const link = get('link');
    if (!title) continue;
    items.push({ id: link || title, title, authors: [], abstract: get('description').replace(/<[^>]+>/g, '').slice(0, 300), journal: source === 'nature' ? 'Nature' : 'Cell', year: new Date().getFullYear(), doi: link.includes('doi.org') ? link.split('doi.org/')[1] : '', url: link, source });
  }
  return items;
}
