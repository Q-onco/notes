import type { PaperResult } from './types';
import { store } from './store.svelte';
import { WORKER_URL } from './groq';

const NCBI = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const BIORXIV = 'https://api.biorxiv.org/details';

const DEFAULT_QUERY =
  'ovarian cancer tumor microenvironment OR scRNA-seq OR spatial transcriptomics OR PARP inhibitor OR immune checkpoint OR biomarker';

export async function searchPubMed(query: string, max = 10): Promise<PaperResult[]> {
  const workerUrl = store.settings.workerUrl || WORKER_URL;
  if (workerUrl) {
    const res = await fetch(`${workerUrl}/pubmed?q=${encodeURIComponent(query)}&max=${max}`);
    if (!res.ok) throw new Error('PubMed search failed');
    return res.json() as Promise<PaperResult[]>;
  }
  return searchPubMedDirect(query, max);
}

async function searchPubMedDirect(query: string, max: number): Promise<PaperResult[]> {
  const searchRes = await fetch(
    `${NCBI}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${max}&retmode=json&sort=pub_date`
  );
  if (!searchRes.ok) throw new Error('PubMed search failed');
  const searchData = await searchRes.json();
  const ids: string[] = searchData.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const summaryRes = await fetch(
    `${NCBI}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
  );
  if (!summaryRes.ok) throw new Error('PubMed fetch failed');
  const summaryData = await summaryRes.json();
  const result = summaryData.result;

  return ids.map(id => {
    const item = result[id];
    if (!item) return null;
    const doi = (item.elocationid as string)?.replace('doi: ', '') ?? '';
    return {
      id,
      title: item.title as string,
      authors: ((item.authors as { name: string }[]) ?? []).map(a => a.name).slice(0, 5),
      abstract: '',
      journal: item.fulljournalname as string,
      year: parseInt((item.pubdate as string)?.slice(0, 4) ?? '0'),
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      source: 'pubmed' as const
    };
  }).filter(Boolean) as PaperResult[];
}

export async function fetchBioRxiv(days = 7): Promise<PaperResult[]> {
  const workerUrl = store.settings.workerUrl || WORKER_URL;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const servers = ['biorxiv', 'medrxiv'];
  const all: PaperResult[] = [];

  for (const server of servers) {
    try {
      let items: Record<string, unknown>[];
      if (workerUrl) {
        const res = await fetch(`${workerUrl}/biorxiv?server=${server}&days=${days}`);
        if (!res.ok) continue;
        items = await res.json() as Record<string, unknown>[];
      } else {
        const res = await fetch(
          `${BIORXIV}/${server}/${fmt(start)}/${fmt(end)}/0/json`
        );
        if (!res.ok) continue;
        const data = await res.json();
        items = (data.collection ?? []) as Record<string, unknown>[];
      }

      const oncologyTerms = /ovarian|cancer|oncol|tumor|carcinoma|biomarker|RNA.seq|transcriptomic|PARP|checkpoint|immune/i;
      const filtered = items
        .filter(p => oncologyTerms.test((p.title as string) + ' ' + (p.abstract as string)))
        .slice(0, 8);

      for (const p of filtered) {
        const doi = p.doi as string;
        const serverHost = server === 'biorxiv' ? 'www.biorxiv.org' : 'www.medrxiv.org';
        all.push({
          id: doi,
          title: p.title as string,
          authors: ((p.authors as string) ?? '').split('; ').slice(0, 4),
          abstract: (p.abstract as string) ?? '',
          journal: server === 'biorxiv' ? 'bioRxiv' : 'medRxiv',
          year: parseInt((p.date as string)?.slice(0, 4) ?? '0'),
          doi,
          url: `https://doi.org/${doi}`,
          source: server as 'biorxiv' | 'medrxiv',
          pdfUrl: `https://${serverHost}/content/${doi}.full.pdf`
        });
      }
    } catch {
      // Skip failed server gracefully
    }
  }

  return all;
}

export async function fetchNatureCell(): Promise<PaperResult[]> {
  const workerUrl = store.settings.workerUrl || WORKER_URL;

  try {
    const res = await fetch(`${workerUrl}/news?sources=nature,cell`);
    if (!res.ok) return [];
    return res.json() as Promise<PaperResult[]>;
  } catch {
    return [];
  }
}

export async function fetchPubMedAbstract(pmid: string): Promise<string> {
  const res = await fetch(
    `${NCBI}/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`
  );
  if (!res.ok) return '';
  return res.text();
}

export async function searchOpenAlex(query: string, max = 10): Promise<PaperResult[]> {
  const workerUrl = store.settings.workerUrl || WORKER_URL;
  const res = await fetch(`${workerUrl}/openalex?q=${encodeURIComponent(query)}&max=${max}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || 'OpenAlex search failed');
  }
  return res.json() as Promise<PaperResult[]>;
}

export async function searchEuropePMC(query: string, max = 10): Promise<PaperResult[]> {
  const res = await fetch(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&resultType=core&format=json&pageSize=${max}&sort=P_PDATE_D%20desc`
  );
  if (!res.ok) throw new Error('Europe PMC search failed');
  const data = await res.json() as { resultList?: { result?: Record<string, unknown>[] } };
  return (data.resultList?.result ?? []).map(p => {
    const doi = (p.doi as string) ?? '';
    return {
      id: (p.id as string) ?? (p.pmid as string) ?? doi,
      title: (p.title as string) ?? '',
      authors: (p.authorString as string) ? (p.authorString as string).split(', ').slice(0, 5) : [],
      abstract: (p.abstractText as string) ?? '',
      journal: (p.journalTitle as string) || (p.source as string) || 'Europe PMC',
      year: parseInt((p.pubYear as string) ?? '0') || 0,
      doi,
      url: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/${p.source as string}/${p.id as string}`,
      source: 'europepmc' as const,
    };
  }).filter(p => p.title);
}


export async function fetchAllFeeds(): Promise<PaperResult[]> {
  const [pubmed, preprints, journals] = await Promise.allSettled([
    searchPubMed(DEFAULT_QUERY, 12),
    fetchBioRxiv(7),
    fetchNatureCell()
  ]);

  const results: PaperResult[] = [];
  if (pubmed.status === 'fulfilled') results.push(...pubmed.value);
  if (preprints.status === 'fulfilled') results.push(...preprints.value);
  if (journals.status === 'fulfilled') results.push(...journals.value);

  // Deduplicate by DOI
  const seen = new Set<string>();
  return results.filter(p => {
    if (!p.doi || seen.has(p.doi)) return !p.doi;
    seen.add(p.doi);
    return true;
  });
}
