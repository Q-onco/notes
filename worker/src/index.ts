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

    // ── GET /jobs-rss ──────────────────────────────────────────────────
    if (path === '/jobs-rss' && request.method === 'GET') {
      try {
        const rawQ = (url.searchParams.get('q') || 'oncology').trim().slice(0, 100);
        const NC = 'https://www.nature.com/naturecareers/jobsrss/';
        const JV = 'https://www.jobvector.de/suche/rss/';
        const ER = 'https://euraxess.ec.europa.eu/jobs/rss';
        const enc = encodeURIComponent;
        const FEEDS: { url: string; source: string; region: string }[] = [
          // Nature Careers — multi-country
          { url: `${NC}?keywords=${enc('postdoc ' + rawQ)}`,                  source: 'Nature Careers', region: '' },
          { url: `${NC}?keywords=${enc(rawQ + ' researcher')}`,               source: 'Nature Careers', region: '' },
          { url: `${NC}?keywords=${enc(rawQ)}&countrycode=DE`,                source: 'Nature Careers', region: 'eu' },
          { url: `${NC}?keywords=${enc(rawQ)}&countrycode=GB`,                source: 'Nature Careers', region: 'uk' },
          { url: `${NC}?keywords=${enc(rawQ)}&countrycode=CH`,                source: 'Nature Careers', region: 'eu' },
          { url: `${NC}?keywords=${enc(rawQ)}&countrycode=NL`,                source: 'Nature Careers', region: 'eu' },
          { url: `${NC}?keywords=${enc(rawQ)}&countrycode=IN`,                source: 'Nature Careers', region: 'india' },
          // JobVector.de — German science & research jobs portal
          { url: `${JV}?q=${enc(rawQ)}&lang=en`,                             source: 'JobVector', region: 'eu' },
          { url: `${JV}?q=${enc(rawQ + ' postdoc')}&lang=en`,                source: 'JobVector', region: 'eu' },
          { url: `${JV}?q=${enc(rawQ + ' Heidelberg')}&lang=en`,             source: 'JobVector', region: 'eu' },
          // Euraxess — EU academic & research mobility portal
          { url: `${ER}?keywords=${enc(rawQ)}&country=DE`,                   source: 'Euraxess', region: 'eu' },
          { url: `${ER}?keywords=${enc(rawQ + ' postdoc')}`,                 source: 'Euraxess', region: 'eu' },
          { url: `${ER}?keywords=${enc(rawQ)}&country=CH`,                   source: 'Euraxess', region: 'eu' },
        ];

        const batches = await Promise.all(
          FEEDS.map(async ({ url: feedUrl, source, region }) => {
            try {
              const res = await fetch(feedUrl, {
                headers: {
                  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                  'User-Agent': 'Mozilla/5.0 (compatible; Q-onco/1.0)'
                },
                signal: AbortSignal.timeout(8000),
              });
              if (!res.ok) return [] as JobResult[];
              const xml = await res.text();
              return parseJobItems(xml, source, region);
            } catch {
              return [] as JobResult[];
            }
          })
        );

        // Deduplicate by URL, sort newest-first, cap at 40
        const seen = new Set<string>();
        const jobs: JobResult[] = [];
        for (const batch of batches) {
          for (const job of batch) {
            if (!seen.has(job.url)) {
              seen.add(job.url);
              jobs.push(job);
            }
          }
        }
        jobs.sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0));

        return json(jobs.slice(0, 60), 200, allowed);
      } catch (e) {
        return err((e as Error).message, 500, allowed);
      }
    }

    if (path === '/reagents' && request.method === 'GET') {
      const q = url.searchParams.get('q')?.trim();
      if (!q) return json({ compounds: [] }, 200, allowed);
      try {
        const cidRes = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/cids/JSON`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (!cidRes.ok) return json({ compounds: [] }, 200, allowed);
        const cidData = await cidRes.json() as { IdentifierList?: { CID?: number[] } };
        const cids = (cidData.IdentifierList?.CID ?? []).slice(0, 4);
        if (!cids.length) return json({ compounds: [] }, 200, allowed);

        const compounds = await Promise.all(cids.map(async (cid: number) => {
          const [propRes, synRes] = await Promise.allSettled([
            fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`),
            fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`),
          ]);
          const props = propRes.status === 'fulfilled' && propRes.value.ok
            ? ((await propRes.value.json()) as any).PropertyTable?.Properties?.[0] ?? {}
            : {};
          const syns: string[] = synRes.status === 'fulfilled' && synRes.value.ok
            ? (((await synRes.value.json()) as any).InformationList?.Information?.[0]?.Synonym ?? [])
            : [];
          const cas = syns.find((s: string) => /^\d{2,7}-\d{2}-\d$/.test(s)) ?? '';
          const name = syns[0] || props.IUPACName || String(cid);
          return { cid, name, iupacName: props.IUPACName || '', formula: props.MolecularFormula || '', mw: Number(props.MolecularWeight) || 0, cas, synonyms: syns.slice(0, 12) };
        }));

        return json({ compounds }, 200, allowed);
      } catch {
        return json({ compounds: [] }, 200, allowed);
      }
    }

    return new Response('Not found', { status: 404 });
  }
};

interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  region: string;
  type: string;
  description: string;
  url: string;
  source: string;
  postedAt: number | null;
  deadline: null;
  tags: string[];
}

function parseJobItems(xml: string, source: string, regionHint = ''): JobResult[] {
  const items: JobResult[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 20) {
    const block = m[1];
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
      return (block.match(r)?.[1] ?? '').trim();
    };

    const rawTitle = get('title');
    const link = (get('link') || get('guid')).replace(/\s/g, '');
    const rawDesc = get('description').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const pubDate = get('pubDate');

    if (!rawTitle || !link) continue;

    // Nature Careers format: "Organisation: Job Title"
    // Split only on first colon to avoid breaking titles that contain colons
    let title: string;
    let company: string;
    const colonIdx = rawTitle.indexOf(':');
    if (colonIdx > 0 && colonIdx < rawTitle.length - 1) {
      company = rawTitle.slice(0, colonIdx).trim();
      title = rawTitle.slice(colonIdx + 1).trim();
    } else {
      // Fallback: pipe/dash separator format
      const parts = rawTitle.split(/\s*[|–—]\s*/);
      title = parts[0].trim();
      company = parts.length > 1 ? parts[1].trim() : source;
    }

    // Nature Careers description ends with "City, Country" on the last line
    const descLines = rawDesc.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const lastLine = descLines[descLines.length - 1] ?? '';
    const locationHint = lastLine.length < 80 ? lastLine : '';
    const desc = descLines.slice(0, -1).join(' ').slice(0, 400) || rawDesc.slice(0, 400);

    const corpus = (rawTitle + ' ' + desc + ' ' + locationHint).toLowerCase();

    // Region: prefer the countrycode hint from the feed config
    let region = regionHint || 'other';
    if (!regionHint) {
      if (/\b(uk|united kingdom|england|scotland|wales|london|cambridge|oxford|manchester|edinburgh|bristol|birmingham)\b/.test(corpus)) {
        region = 'uk';
      } else if (/\b(germany|france|switzerland|netherlands|belgium|denmark|sweden|norway|austria|spain|italy|ireland|finland|heidelberg|berlin|munich|hamburg|frankfurt|paris|zurich|geneva|amsterdam|brussels|copenhagen|stockholm|oslo|vienna|barcelona|madrid)\b/.test(corpus)) {
        region = 'eu';
      } else if (/\b(india|bengaluru|bangalore|mumbai|hyderabad|delhi|chennai|pune)\b/.test(corpus)) {
        region = 'india';
      } else if (/\bremote\b/.test(corpus)) {
        region = 'remote';
      } else if (/\b(usa|united states|boston|new york|san francisco|seattle|houston|chicago)\b/.test(corpus)) {
        region = 'us';
      }
    }

    // Infer job type
    let type = 'academic';
    if (/\bfellowship\b/.test(corpus)) {
      type = 'fellowship';
    } else if (/\bcontract\b/.test(corpus) && !/\b(postdoc|research\s+associate|phd)\b/.test(corpus)) {
      type = 'contract';
    } else if (
      /\b(scientist|engineer|manager|director|analyst|consultant|medical\s+affairs)\b/.test(corpus) &&
      !/\b(university|universit[aä]t|institute|hospital|centre|center|college|embl|dkfz|cnrs|inserm)\b/.test(corpus)
    ) {
      type = 'industry';
    }

    // Extract oncology-relevant tags
    const TAG_MAP: [RegExp, string][] = [
      [/\bscRNA[- ]?seq\b/i, 'scRNA-seq'],
      [/\bspatial\b/i, 'spatial'],
      [/\bPARP\b/i, 'PARP'],
      [/\bovarian\b/i, 'ovarian'],
      [/\bimmuno[- ]?oncology\b/i, 'immuno-oncology'],
      [/\bbioinformatics\b/i, 'bioinformatics'],
      [/\bgenomics\b/i, 'genomics'],
      [/\btranscriptomics\b/i, 'transcriptomics'],
      [/\bcomputational\b/i, 'computational'],
      [/\bpostdoc\b/i, 'postdoc'],
      [/\bclinical\b/i, 'clinical'],
      [/\btumou?r\b/i, 'tumour'],
      [/\bmicroenvironment\b/i, 'TME'],
      [/\bcheckpoint\b/i, 'checkpoint'],
    ];
    const tags = TAG_MAP
      .filter(([re]) => re.test(corpus))
      .map(([, t]) => t)
      .slice(0, 5);

    // Try to extract a city for display
    const CITIES = ['Heidelberg', 'London', 'Cambridge', 'Berlin', 'Paris', 'Basel', 'Zurich',
      'Amsterdam', 'Copenhagen', 'Munich', 'Oxford', 'Edinburgh', 'Manchester',
      'Frankfurt', 'Hamburg', 'Brussels', 'Vienna', 'Stockholm', 'Lausanne'];
    const inferredCity = locationHint || (CITIES.find(c => corpus.includes(c.toLowerCase())) ?? '');

    items.push({
      id: link,
      title,
      company,
      location: inferredCity,
      region,
      type,
      description: desc,
      url: link,
      source,
      postedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      deadline: null,
      tags,
    });
  }
  return items;
}

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
