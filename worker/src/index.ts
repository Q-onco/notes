interface Env {
  GROQ_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

const GROQ_API = 'https://api.groq.com/openai/v1';
const NCBI = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const BIORXIV = 'https://api.biorxiv.org/details';

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) }
  });
}

function err(msg: string, status = 500, origin = '*') {
  return json({ error: msg }, status, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '*';
    const allowed = env.ALLOWED_ORIGIN || '*';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(allowed) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── POST /llm ──────────────────────────────────────────────────
    if (path === '/llm' && request.method === 'POST') {
      if (!env.GROQ_API_KEY) return err('GROQ_API_KEY not configured', 500, allowed);
      try {
        const body = await request.json();
        const res = await fetch(`${GROQ_API}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.GROQ_API_KEY}`
          },
          body: JSON.stringify(body)
        });
        return new Response(res.body, {
          status: res.status,
          headers: {
            'Content-Type': res.headers.get('Content-Type') ?? 'text/event-stream',
            ...cors(allowed)
          }
        });
      } catch (e) {
        return err((e as Error).message, 500, allowed);
      }
    }

    // ── POST /whisper ───────────────────────────────────────────────
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
          body: fd
        });

        if (!res.ok) return err(`Whisper error: ${res.status}`, res.status, allowed);
        const data = await res.json() as { text: string };
        return json({ text: data.text }, 200, allowed);
      } catch (e) {
        return err((e as Error).message, 500, allowed);
      }
    }

    // ── GET /pubmed ─────────────────────────────────────────────────
    if (path === '/pubmed' && request.method === 'GET') {
      try {
        const q = url.searchParams.get('q') ?? 'ovarian cancer tumor microenvironment';
        const max = Math.min(parseInt(url.searchParams.get('max') ?? '12'), 25);

        const searchRes = await fetch(
          `${NCBI}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmax=${max}&retmode=json&sort=pub_date`
        );
        const searchData = await searchRes.json() as { esearchresult: { idlist: string[] } };
        const ids = searchData.esearchresult?.idlist ?? [];
        if (ids.length === 0) return json([], 200, allowed);

        const summaryRes = await fetch(
          `${NCBI}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
        );
        const summaryData = await summaryRes.json() as { result: Record<string, unknown> };
        const result = summaryData.result;

        const papers = ids.map((id: string) => {
          const item = result[id] as Record<string, unknown> | undefined;
          if (!item) return null;
          const doi = (item.elocationid as string)?.replace('doi: ', '') ?? '';
          return {
            id,
            title: item.title,
            authors: ((item.authors as { name: string }[]) ?? []).map((a) => a.name).slice(0, 5),
            abstract: '',
            journal: item.fulljournalname,
            year: parseInt(((item.pubdate as string) ?? '').slice(0, 4)),
            doi,
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            source: 'pubmed'
          };
        }).filter(Boolean);

        return json(papers, 200, allowed);
      } catch (e) {
        return err((e as Error).message, 500, allowed);
      }
    }

    // ── GET /biorxiv ────────────────────────────────────────────────
    if (path === '/biorxiv' && request.method === 'GET') {
      try {
        const server = url.searchParams.get('server') === 'medrxiv' ? 'medrxiv' : 'biorxiv';
        const days = Math.min(parseInt(url.searchParams.get('days') ?? '7'), 30);

        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);

        const res = await fetch(`${BIORXIV}/${server}/${fmt(start)}/${fmt(end)}/0/json`);
        if (!res.ok) return json([], 200, allowed);

        const data = await res.json() as { collection: Record<string, unknown>[] };
        const oncologyRe = /ovarian|cancer|oncol|tumor|carcinoma|biomarker|RNA.seq|transcriptomic|PARP|checkpoint|immune/i;

        const filtered = (data.collection ?? [])
          .filter((p: Record<string, unknown>) =>
            oncologyRe.test(String(p.title) + ' ' + String(p.abstract))
          )
          .slice(0, 10)
          .map((p: Record<string, unknown>) => ({
            id: p.doi,
            title: p.title,
            authors: String(p.authors ?? '').split('; ').slice(0, 4),
            abstract: p.abstract,
            journal: server === 'biorxiv' ? 'bioRxiv' : 'medRxiv',
            year: parseInt(String(p.date ?? '').slice(0, 4)),
            doi: p.doi,
            url: `https://doi.org/${p.doi}`,
            source: server
          }));

        return json(filtered, 200, allowed);
      } catch (e) {
        return err((e as Error).message, 500, allowed);
      }
    }

    // ── GET /news ───────────────────────────────────────────────────
    if (path === '/news' && request.method === 'GET') {
      try {
        const sources = (url.searchParams.get('sources') ?? 'nature,cell').split(',');
        const RSS_FEEDS: Record<string, string> = {
          nature: 'https://www.nature.com/subjects/cancer.rss',
          cell:   'https://www.cell.com/cell/rss'
        };

        const results: unknown[] = [];
        for (const src of sources) {
          const feedUrl = RSS_FEEDS[src.trim()];
          if (!feedUrl) continue;
          try {
            const res = await fetch(feedUrl, {
              headers: { Accept: 'application/rss+xml, application/xml, text/xml' }
            });
            if (!res.ok) continue;
            const xml = await res.text();
            const items = parseRSSItems(xml, src.trim());
            results.push(...items);
          } catch {
            // skip failed feed
          }
        }
        return json(results, 200, allowed);
      } catch (e) {
        return err((e as Error).message, 500, allowed);
      }
    }

    return new Response('Not found', { status: 404 });
  }
};

function parseRSSItems(xml: string, source: string): unknown[] {
  const items: unknown[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 8) {
    const item = m[1];
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`);
      return (item.match(r)?.[1] ?? '').trim();
    };
    const title = get('title');
    const link = get('link');
    const desc = get('description');
    const doi = link.includes('doi.org') ? link.split('doi.org/')[1] : '';
    if (!title) continue;
    items.push({
      id: link || title,
      title,
      authors: [],
      abstract: desc.replace(/<[^>]+>/g, '').slice(0, 300),
      journal: source === 'nature' ? 'Nature' : 'Cell',
      year: new Date().getFullYear(),
      doi,
      url: link,
      source
    });
  }
  return items;
}
