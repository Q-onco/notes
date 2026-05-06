/**
 * Q·onco — Cloudflare Worker
 *
 * HOW TO DEPLOY (no CLI needed):
 *   1. Go to dash.cloudflare.com → Workers & Pages → Create → Create Worker
 *   2. Give it a name (e.g. "qonco-worker"), click Deploy
 *   3. Click "Edit Code", paste this entire file, click Deploy
 *   4. Go to Settings → Variables → add these secrets:
 *        GROQ_API_KEY  — from console.groq.com/keys
 *   5. Copy the worker URL (e.g. https://qonco-worker.yourname.workers.dev)
 *      and paste it into Q·onco Settings → Worker URL
 *
 * Routes:
 *   POST /llm      — Groq chat completions (streaming)
 *   POST /whisper  — Groq Whisper transcription
 *   GET  /pubmed   — PubMed search proxy (?q=...&max=15)
 *   GET  /biorxiv  — bioRxiv/medRxiv feed (?server=biorxiv&days=14)
 *   GET  /news     — Nature/Cell RSS (?sources=nature,cell)
 *   GET  /openalex — OpenAlex academic search (?q=...&max=10)
 *   GET  /health   — health check
 */

const ALLOWED_ORIGIN = 'https://q-onco.github.io';
const GROQ_API = 'https://api.groq.com/openai/v1';
const NCBI = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const BIORXIV_API = 'https://api.biorxiv.org/details';

const RSS_FEEDS = {
  nature: 'https://www.nature.com/subjects/cancer.rss',
  cell:   'https://www.cell.com/cell/rss',
};

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(' ');
}

// ── CORS ──────────────────────────────────────────────────────────────────────

function cors(origin) {
  const ok = origin === ALLOWED_ORIGIN || (origin || '').includes('localhost');
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...cors(origin || '') },
  });
}

function err(msg, status, origin) {
  return json({ error: msg }, status || 500, origin);
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // ── GET /health ───────────────────────────────────────────────
    if (path === '/health') {
      return json({ ok: true, groq: !!env.GROQ_API_KEY, ts: new Date().toISOString() }, 200, origin);
    }

    // ── POST /llm  (Groq chat, streaming) ────────────────────────
    if (path === '/llm' && request.method === 'POST') {
      if (!env.GROQ_API_KEY) return err('GROQ_API_KEY not set', 500, origin);
      try {
        const body = await request.json();
        const res = await fetch(`${GROQ_API}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify(body),
        });
        return new Response(res.body, {
          status: res.status,
          headers: {
            'Content-Type': res.headers.get('Content-Type') || 'text/event-stream',
            ...cors(origin),
          },
        });
      } catch (e) {
        return err(e.message, 500, origin);
      }
    }

    // ── POST /whisper  (Groq Whisper transcription) ───────────────
    if (path === '/whisper' && request.method === 'POST') {
      if (!env.GROQ_API_KEY) return err('GROQ_API_KEY not set', 500, origin);
      try {
        const formData = await request.formData();
        const audio = formData.get('audio');
        if (!audio) return err('No audio file', 400, origin);

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
        if (!res.ok) return err(`Whisper error ${res.status}`, res.status, origin);
        const data = await res.json();
        return json({ text: data.text }, 200, origin);
      } catch (e) {
        return err(e.message, 500, origin);
      }
    }

    // ── GET /pubmed  (?q=...&max=15) ─────────────────────────────
    if (path === '/pubmed' && request.method === 'GET') {
      try {
        const q = url.searchParams.get('q') || 'ovarian cancer tumor microenvironment';
        const max = Math.min(parseInt(url.searchParams.get('max') || '12'), 25);

        const searchRes = await fetch(
          `${NCBI}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmax=${max}&retmode=json&sort=pub_date`
        );
        const searchData = await searchRes.json();
        const ids = searchData.esearchresult?.idlist || [];
        if (!ids.length) return json([], 200, origin);

        const summaryRes = await fetch(
          `${NCBI}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
        );
        const summaryData = await summaryRes.json();
        const result = summaryData.result || {};

        const papers = ids.map(id => {
          const item = result[id];
          if (!item) return null;
          const doi = (item.elocationid || '').replace('doi: ', '');
          return {
            id,
            title: item.title,
            authors: (item.authors || []).map(a => a.name).slice(0, 5),
            abstract: '',
            journal: item.fulljournalname,
            year: parseInt((item.pubdate || '').slice(0, 4)) || 0,
            doi,
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            source: 'pubmed',
          };
        }).filter(Boolean);

        return json(papers, 200, origin);
      } catch (e) {
        return err(e.message, 500, origin);
      }
    }

    // ── GET /biorxiv  (?server=biorxiv|medrxiv&days=14) ──────────
    if (path === '/biorxiv' && request.method === 'GET') {
      try {
        const server = url.searchParams.get('server') === 'medrxiv' ? 'medrxiv' : 'biorxiv';
        const days = Math.min(parseInt(url.searchParams.get('days') || '7'), 30);

        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        const fmt = d => d.toISOString().slice(0, 10);

        const res = await fetch(`${BIORXIV_API}/${server}/${fmt(start)}/${fmt(end)}/0/json`);
        if (!res.ok) return json([], 200, origin);

        const data = await res.json();
        const oncologyRe = /ovarian|cancer|oncol|tumor|carcinoma|biomarker|RNA.seq|transcriptomic|PARP|checkpoint|immune/i;
        const serverHost = server === 'biorxiv' ? 'www.biorxiv.org' : 'www.medrxiv.org';

        const filtered = (data.collection || [])
          .filter(p => oncologyRe.test((p.title || '') + ' ' + (p.abstract || '')))
          .slice(0, 10)
          .map(p => ({
            id: p.doi,
            title: p.title,
            authors: (p.authors || '').split('; ').slice(0, 4),
            abstract: p.abstract,
            journal: server === 'biorxiv' ? 'bioRxiv' : 'medRxiv',
            year: parseInt((p.date || '').slice(0, 4)) || 0,
            doi: p.doi,
            url: `https://doi.org/${p.doi}`,
            source: server,
            pdfUrl: `https://${serverHost}/content/${p.doi}.full.pdf`,
          }));

        return json(filtered, 200, origin);
      } catch (e) {
        return err(e.message, 500, origin);
      }
    }

    // ── GET /news  (?sources=nature,cell) ────────────────────────
    if (path === '/news' && request.method === 'GET') {
      try {
        const sources = (url.searchParams.get('sources') || 'nature,cell').split(',');
        const results = [];

        for (const src of sources) {
          const feedUrl = RSS_FEEDS[src.trim()];
          if (!feedUrl) continue;
          try {
            const res = await fetch(feedUrl, {
              headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
            });
            if (!res.ok) continue;
            const xml = await res.text();
            results.push(...parseRSS(xml, src.trim()));
          } catch {
            // skip failed feed silently
          }
        }

        return json(results, 200, origin);
      } catch (e) {
        return err(e.message, 500, origin);
      }
    }

    // GET /openalex?q=...&max=10
    if (path === '/openalex' && request.method === 'GET') {
      try {
        const q = url.searchParams.get('q') || '';
        const max = Math.min(parseInt(url.searchParams.get('max') || '10'), 25);
        const res = await fetch(
          `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${max}&sort=relevance_score:desc&mailto=quant.onco@gmail.com`,
          { headers: { 'User-Agent': 'QOncoResearch/1.0' } }
        );
        if (!res.ok) return err(`OpenAlex ${res.status}`, res.status, origin);
        const data = await res.json();
        const papers = (data.results || []).map(w => {
          const doi = w.doi ? w.doi.replace('https://doi.org/', '') : '';
          const abstract = w.abstract_inverted_index
            ? reconstructAbstract(w.abstract_inverted_index)
            : '';
          const location = w.primary_location?.source;
          return {
            id: w.id || doi || w.title,
            title: w.title || '',
            authors: (w.authorships || []).slice(0, 5).map(a => a.author?.display_name || ''),
            abstract,
            journal: location?.display_name || 'OpenAlex',
            year: w.publication_year || 0,
            doi,
            url: doi ? `https://doi.org/${doi}` : (w.id || ''),
            source: 'openalex',
            pdfUrl: w.open_access?.oa_url || undefined,
          };
        });
        return json(papers, 200, origin);
      } catch (e) {
        return err(e.message, 500, origin);
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

// ── RSS parser ────────────────────────────────────────────────────────────────

function parseRSS(xml, source) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 8) {
    const chunk = m[1];
    const get = tag => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
      return (chunk.match(r)?.[1] || '').trim();
    };
    const title = get('title');
    const link  = get('link');
    const desc  = get('description');
    if (!title) continue;
    const doi = link.includes('doi.org') ? link.split('doi.org/')[1] : '';
    items.push({
      id: link || title,
      title,
      authors: [],
      abstract: desc.replace(/<[^>]+>/g, '').slice(0, 300),
      journal: source === 'nature' ? 'Nature' : 'Cell',
      year: new Date().getFullYear(),
      doi,
      url: link,
      source,
    });
  }
  return items;
}
