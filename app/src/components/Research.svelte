<script lang="ts">
  import { searchPubMed, fetchBioRxiv, fetchNatureCell, fetchPubMedAbstract, searchOpenAlex, searchEuropePMC } from '../lib/pubmed';
  import type { PaperResult, ReadingListItem, SavedSearch, Note } from '../lib/types';
  import { store } from '../lib/store.svelte';
  import { exportPapers, exportPapersDocx, exportPapersBibTeX } from '../lib/export';
  import { askResearch, deepReadPaper, generateReadingNote, critiquePaper } from '../lib/groq';
  import { nanoid } from 'nanoid';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  type SourceKey = 'pubmed' | 'biorxiv' | 'medrxiv' | 'nature' | 'cell' | 'openalex' | 'europepmc';

  const SOURCES: { key: SourceKey; label: string; cls: string; worker?: boolean }[] = [
    { key: 'pubmed',    label: 'PubMed',      cls: 'sc-ac' },
    { key: 'openalex',  label: 'OpenAlex',    cls: 'sc-pu', worker: true },
    { key: 'europepmc', label: 'Europe PMC',  cls: 'sc-yw' },
    { key: 'biorxiv',   label: 'bioRxiv',     cls: 'sc-gn' },
    { key: 'medrxiv',   label: 'medRxiv',     cls: 'sc-gn' },
    { key: 'nature',    label: 'Nature',      cls: 'sc-enzo', worker: true },
    { key: 'cell',      label: 'Cell',        cls: 'sc-rd',   worker: true },
  ];

  const SOURCE_LABELS: Record<string, string> = {
    pubmed: 'PubMed', biorxiv: 'bioRxiv', medrxiv: 'medRxiv',
    nature: 'Nature', cell: 'Cell',
    openalex: 'OpenAlex', europepmc: 'Europe PMC',
  };
  const SOURCE_CLS: Record<string, string> = {
    pubmed: 'tag-ac', biorxiv: 'tag-gn', medrxiv: 'tag-gn',
    nature: 'tag-enzo', cell: 'tag-rd',
    openalex: 'tag-pu', europepmc: 'tag-yw',
  };

  const PRESET_TOPICS = [
    { cat: 'TME & Immune', color: 'ac', topics: [
      'CD8 T cell exhaustion PD-1 TIM-3 ovarian cancer',
      'CAF subtypes myoCAF iCAF apCAF TGF-β HGSOC',
      'tumor associated macrophages MARCO IL-10 ovarian',
      'NK cell dysfunction ascites peritoneal',
      'regulatory T cells FOXP3 Treg suppression ovarian',
      'B cell tertiary lymphoid structure TLS ovarian',
      'immune exclusion phenotype spatial ovarian',
    ]},
    { cat: 'Single-cell & Spatial', color: 'pu', topics: [
      'scRNA-seq tumor microenvironment cell type deconvolution',
      'spatial transcriptomics Visium HGSOC',
      'cell2location deconvolution spatial ovarian',
      'cell-cell communication CellChat NicheNet ovarian TME',
      'RNA velocity scVelo tumor trajectory',
      'Xenium MERFISH single molecule ovarian cancer',
    ]},
    { cat: 'PARP / HR Resistance', color: 'rd', topics: [
      'PARP inhibitor resistance reversion mutation BRCA',
      'BRCAness HRD scoring LOH TAI LST',
      'RAD51 53BP1 RIF1 homologous recombination',
      'PARP1 trapping olaparib niraparib rucaparib',
      'cGAS STING PARP inhibitor immunotherapy',
      'platinum resistance ABCB1 NHEJ ovarian',
    ]},
    { cat: 'Clinical & Trials', color: 'enzo', topics: [
      'SOLO-1 SOLO-2 olaparib maintenance BRCA',
      'PRIMA niraparib HRD overall survival',
      'DUO-O veliparib bevacizumab ovarian',
      'IMagyn050 atezolizumab immune checkpoint',
      'ARIEL3 rucaparib biomarker companion diagnostic',
    ]},
    { cat: 'Emerging & Targets', color: 'gn', topics: [
      'liquid biopsy ctDNA ovarian cancer monitoring',
      'organoid drug response ovarian cancer ex vivo',
      'FOLR1 farletuzumab antibody drug conjugate',
      'CAR-T cell therapy ovarian peritoneal',
      'mesothelin MSLN ovarian target',
    ]},
  ];

  const CONCEPT_POOL = [
    'ovarian cancer tumor microenvironment',
    'CAF subtypes high grade serous ovarian',
    'T cell exhaustion ovarian cancer',
    'CD8 T cell infiltration HGSOC',
    'myeloid derived suppressor cells ovarian',
    'NK cell activity peritoneal ascites',
    'tumor associated macrophages ovarian',
    'regulatory T cells Treg ovarian',
    'dendritic cell dysfunction tumor',
    'immune exclusion peritoneal metastasis',
    'scRNA-seq tumor immune landscape',
    'spatial transcriptomics HGSOC',
    'single cell sequencing ascites',
    'cell-cell communication ligand receptor',
    'trajectory analysis pseudotime tumor',
    'clonotype TCR scRNA ovarian',
    'PARP inhibitor resistance mechanisms',
    'olaparib niraparib rucaparib resistance',
    'PARP1 trapping catalytic inhibition',
    'BRCAness reversion mutation',
    'RAD51 homologous recombination deficiency',
    '53BP1 RIF1 NHEJ pathway',
    'homologous recombination deficiency HRD',
    'HGSOC platinum resistance',
    'BRCA1 BRCA2 ovarian cancer',
    'copy number alteration HGSOC',
    'TP53 mutation high grade serous',
    'fallopian tube carcinogenesis STIC',
    'clonal evolution chemotherapy resistance',
    'SOLO-1 SOLO-2 olaparib maintenance',
    'PRIMA niraparib ovarian',
    'DUO-O veliparib bevacizumab',
    'IMagyn050 atezolizumab ovarian',
    'KEYNOTE-100 pembrolizumab ovarian',
    'ARIEL3 rucaparib biomarker',
    'VEGF bevacizumab anti-angiogenic ovarian',
    'PI3K AKT mTOR ovarian cancer',
    'WNT signaling ovarian cancer',
    'folate receptor alpha FOLR1',
    'mesothelin ovarian peritoneal',
    'MUC16 CA125 biomarker',
    'peritoneal dissemination ovarian cancer',
    'ascites immunosuppression ovarian',
    'epithelial mesenchymal transition ovarian',
    'integrin fibronectin peritoneal adhesion',
    'cisplatin carboplatin response biomarker',
    'immune checkpoint PD-L1 PD-1 ovarian',
    'ADC antibody drug conjugate ovarian',
    'CAR-T cell ovarian cancer',
    'bispecific antibody ovarian',
  ];

  let activeSources = $state(new Set<SourceKey>(['pubmed']));
  let query = $state('');
  let papers = $state<PaperResult[]>([]);
  let loading = $state(false);
  let error = $state('');
  let expandedId = $state<string | null>(null);
  let abstractText = $state<Record<string, string>>({});

  // New state
  let summaryLoading = $state<Record<string, boolean>>({});
  let summaryText = $state<Record<string, string>>({});
  let summaryStreaming = $state<Record<string, boolean>>({});
  let researchTab = $state<'results' | 'reading-list'>('results');
  let showPresets = $state(false);
  let savingSearch = $state(false);
  let saveSearchLabel = $state('');
  let showSaveInput = $state(false);

  const conceptSuggestions = $derived(
    query.trim().length >= 2
      ? CONCEPT_POOL.filter(c =>
          c.toLowerCase().includes(query.toLowerCase().trim()) &&
          c.toLowerCase() !== query.toLowerCase().trim()
        ).slice(0, 6)
      : []
  );

  function toggleSource(s: SourceKey) {
    const next = new Set(activeSources);
    if (next.has(s) && next.size > 1) {
      next.delete(s);
    } else {
      next.add(s);
    }
    activeSources = next;
  }

  async function search() {
    loading = true;
    error = '';
    papers = [];
    try {
      const fetches: Promise<PaperResult[]>[] = [];

      const q = query.trim();
      const needsQuery = activeSources.has('pubmed') || activeSources.has('openalex') || activeSources.has('europepmc');
      if (needsQuery && !q) {
        error = 'Enter a search term.';
        loading = false;
        return;
      }
      if (activeSources.has('pubmed') && q)    fetches.push(searchPubMed(q, 12));
      if (activeSources.has('openalex') && q)  fetches.push(searchOpenAlex(q, 10));
      if (activeSources.has('europepmc') && q) fetches.push(searchEuropePMC(q, 10));
      if (activeSources.has('biorxiv') || activeSources.has('medrxiv')) {
        fetches.push(fetchBioRxiv(14));
      }
      if ((activeSources.has('nature') || activeSources.has('cell')) && store.settings.workerUrl) {
        fetches.push(fetchNatureCell());
      }

      if (fetches.length === 0) {
        loading = false;
        return;
      }

      const settled = await Promise.allSettled(fetches);
      const all: PaperResult[] = [];
      for (const r of settled) {
        if (r.status === 'fulfilled') all.push(...r.value);
      }

      const filtered = all.filter(p => activeSources.has(p.source as SourceKey));
      const seen = new Set<string>();
      papers = filtered.filter(p => {
        if (!p.doi || seen.has(p.doi)) return !p.doi;
        seen.add(p.doi);
        return true;
      });

    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function loadAbstract(paper: PaperResult) {
    if (expandedId === paper.id) { expandedId = null; return; }
    expandedId = paper.id;
    if (paper.abstract) { abstractText[paper.id] = paper.abstract; return; }
    if (paper.source === 'pubmed' && !abstractText[paper.id]) {
      try {
        const text = await fetchPubMedAbstract(paper.id);
        abstractText[paper.id] = text;
      } catch {
        abstractText[paper.id] = 'Abstract unavailable.';
      }
    }
  }

  async function sendToEnzo(paper: PaperResult) {
    const abs = abstractText[paper.id] || paper.abstract || '';
    store.enzoSearchQuery = `Summarise and discuss the significance of this paper:\n\nTitle: ${paper.title}\nAuthors: ${paper.authors.join(', ')}\nJournal: ${paper.journal} (${paper.year})\n\n${abs}`;
    store.enzoOpen = true;
  }

  async function togglePin(paper: PaperResult) {
    if (store.isPinned(paper.id)) {
      await store.unpinPaper(paper.id);
      showToast('Removed from dashboard');
    } else {
      await store.pinPaper(paper);
      showToast('Pinned to dashboard');
    }
  }

  function isInReadingList(paperId: string): boolean {
    return store.readingList.some(r => r.paper.id === paperId);
  }

  async function toggleReadingList(paper: PaperResult) {
    if (isInReadingList(paper.id)) {
      store.readingList = store.readingList.filter(r => r.paper.id !== paper.id);
      showToast('Removed from reading list');
    } else {
      const item: ReadingListItem = {
        id: nanoid(),
        paper,
        addedAt: Date.now(),
        note: '',
        read: false,
        priority: 'medium'
      };
      store.readingList = [item, ...store.readingList];
      showToast('Added to reading list');
    }
    await store.saveResearch();
  }

  async function summarisePaper(paper: PaperResult) {
    const abstract = abstractText[paper.id] || paper.abstract || '';
    if (!abstract && paper.source === 'pubmed') {
      summaryLoading[paper.id] = true;
      try {
        const text = await fetchPubMedAbstract(paper.id);
        abstractText[paper.id] = text;
      } catch { /* continue anyway */ }
      summaryLoading[paper.id] = false;
    }
    const abs = abstractText[paper.id] || paper.abstract || '(Abstract not available)';

    summaryLoading[paper.id] = true;
    summaryText[paper.id] = '';
    summaryStreaming[paper.id] = true;

    const prompt = `Provide a structured summary of this paper for an expert HGSOC researcher:

Title: ${paper.title}
Authors: ${paper.authors.join(', ')}
Journal: ${paper.journal} (${paper.year})
Abstract: ${abs}

Format your response as:
**Hypothesis:** [one sentence]
**Methods:** [key methods, 2-3 sentences]
**Key finding:** [most important result]
**HGSOC relevance:** [direct relevance to high-grade serous ovarian cancer research]
**Caveats:** [limitations or reasons to be cautious]`;

    try {
      await askResearch(
        [{ role: 'user', content: prompt }],
        (chunk) => { summaryText[paper.id] = (summaryText[paper.id] || '') + chunk; }
      );
    } catch (e) {
      summaryText[paper.id] = `Error: ${(e as Error).message}`;
    } finally {
      summaryLoading[paper.id] = false;
      summaryStreaming[paper.id] = false;
    }
  }

  async function saveAsNote(paper: PaperResult) {
    const abstract = abstractText[paper.id] || paper.abstract || '';
    const authors = paper.authors.slice(0, 6).join(', ') + (paper.authors.length > 6 ? ' et al.' : '');
    const citation = [
      authors,
      paper.year > 0 ? `(${paper.year})` : '',
      `${paper.title}.`,
      paper.journal ? `*${paper.journal}*.` : '',
      paper.doi ? `DOI: ${paper.doi}` : ''
    ].filter(Boolean).join(' ');

    const note: Note = {
      id: nanoid(),
      title: paper.title.slice(0, 90),
      body: `# ${paper.title}\n\n## Citation\n${citation}\n\n## Abstract\n${abstract || '_Abstract not available — open the paper to read it._'}\n\n## Notes\n\n`,
      tags: ['paper', paper.source],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      archived: false,
      audioIds: []
    };
    store.notes = [note, ...store.notes];
    store.currentNoteId = note.id;
    await store.saveNotes();
    store.view = 'notes';
    showToast('Paper saved as note');
  }

  async function runSavedSearch(ss: SavedSearch) {
    query = ss.query;
    activeSources = new Set(ss.sources as SourceKey[]);
    await search();
    // Update lastRunAt + runCount
    store.savedSearches = store.savedSearches.map(s =>
      s.id === ss.id
        ? { ...s, lastRunAt: Date.now(), runCount: s.runCount + 1 }
        : s
    );
    await store.saveResearch();
  }

  async function saveCurrentSearch() {
    if (!query.trim() || !saveSearchLabel.trim()) return;
    savingSearch = true;
    const newSearch: SavedSearch = {
      id: nanoid(),
      label: saveSearchLabel.trim(),
      query: query.trim(),
      sources: Array.from(activeSources),
      color: 'ac',
      createdAt: Date.now(),
      lastRunAt: null,
      runCount: 0,
    };
    store.savedSearches = [newSearch, ...store.savedSearches];
    try {
      await store.saveResearch();
      showToast('Search saved');
    } catch {
      showToast('Failed to save search', 'error');
    }
    savingSearch = false;
    showSaveInput = false;
    saveSearchLabel = '';
  }

  async function deleteSavedSearch(id: string) {
    store.savedSearches = store.savedSearches.filter(s => s.id !== id);
    await store.saveResearch();
  }

  async function toggleReadItem(id: string) {
    store.readingList = store.readingList.map(r =>
      r.id === id ? { ...r, read: !r.read, readAt: !r.read ? Date.now() : r.readAt } : r
    );
    await store.saveResearch();
  }

  // ── Citation copy ─────────────────────────────────────────────
  function buildAPA(paper: PaperResult): string {
    const authors = paper.authors.length
      ? paper.authors.slice(0, 6).join(', ') + (paper.authors.length > 6 ? ', et al.' : '')
      : 'Unknown authors';
    return `${authors} (${paper.year}). ${paper.title}. *${paper.journal}*. ${paper.doi ? 'https://doi.org/' + paper.doi : paper.url}`;
  }

  function buildBibTeX(paper: PaperResult): string {
    const key = (paper.authors[0]?.split(' ').pop() ?? 'Unknown') + paper.year;
    const authorField = paper.authors.join(' and ');
    return `@article{${key},\n  author  = {${authorField}},\n  title   = {${paper.title}},\n  journal = {${paper.journal}},\n  year    = {${paper.year}},${paper.doi ? '\n  doi     = {' + paper.doi + '},' : ''}\n}`;
  }

  function buildVancouver(paper: PaperResult): string {
    const authors = paper.authors.length
      ? paper.authors.slice(0, 6).map(a => { const p = a.trim().split(/\s+/); const last = p.pop() ?? ''; const ini = p.map(n => n[0]).join(''); return `${last} ${ini}`; }).join(', ') + (paper.authors.length > 6 ? ' et al.' : '')
      : 'Unknown authors';
    return `${authors}. ${paper.title}. ${paper.journal}. ${paper.year}${paper.doi ? ';doi:' + paper.doi : ''}.`;
  }

  async function copyCitation(paper: PaperResult, fmt: 'apa' | 'bibtex' | 'vancouver') {
    const text = fmt === 'apa' ? buildAPA(paper) : fmt === 'bibtex' ? buildBibTeX(paper) : buildVancouver(paper);
    await navigator.clipboard.writeText(text);
    showToast(`Copied ${fmt === 'bibtex' ? 'BibTeX' : fmt.toUpperCase()} citation`);
  }

  // ── DOI resolver ─────────────────────────────────────────────
  let doiInput = $state('');
  let doiLoading = $state(false);
  let doiOpen = $state(false);

  async function resolveDoi() {
    const doi = doiInput.replace(/^https?:\/\/doi\.org\//i, '').trim();
    if (!doi) return;
    doiLoading = true;
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      if (!res.ok) throw new Error('Not found');
      const { message: m } = await res.json();
      const paper: PaperResult = {
        id: `doi:${doi}`,
        title: m.title?.[0] ?? doi,
        authors: (m.author ?? []).map((a: { family?: string; given?: string }) => [a.given, a.family].filter(Boolean).join(' ')),
        abstract: m.abstract?.replace(/<[^>]*>/g, ' ').trim() ?? '',
        journal: m['container-title']?.[0] ?? m.publisher ?? '',
        year: m.published?.['date-parts']?.[0]?.[0] ?? new Date().getFullYear(),
        doi,
        url: `https://doi.org/${doi}`,
        source: 'pubmed',
        pdfUrl: m.link?.[0]?.URL,
      };
      doiInput = '';
      doiOpen = false;
      showToast(`Resolved: ${paper.title.slice(0, 40)}…`);
      if (!store.pinnedPapers.some(p => p.id === paper.id)) {
        store.readingList = [{ id: crypto.randomUUID(), paper, addedAt: Date.now(), note: '', read: false, priority: 'medium' }, ...store.readingList];
        await store.saveResearch();
        researchTab = 'reading-list';
      }
    } catch {
      showToast('DOI not found or CrossRef unavailable', 'error');
    }
    doiLoading = false;
  }

  // ── Reading time ──────────────────────────────────────────────
  function readingTimeMins(paper: PaperResult): number {
    const words = paper.abstract ? paper.abstract.split(/\s+/).length : 0;
    return words > 150 ? 35 : 5;
  }

  // ── Weekly reading progress ───────────────────────────────────
  const weekStart = $derived(Date.now() - 7 * 86400000);
  const readThisWeek = $derived(store.readingList.filter(r => r.read && r.readAt && r.readAt > weekStart).length);

  // ── Paper Critique state ─────────────────────────────────────
  let critiqueId = $state<string | null>(null);
  let critiqueText = $state('');
  let critiqueStreaming = $state(false);
  let critiqueAbort: AbortController | null = null;

  async function doCritique(paper: PaperResult) {
    if (critiqueId === paper.id && critiqueStreaming) {
      critiqueAbort?.abort();
      critiqueStreaming = false;
      return;
    }
    critiqueAbort?.abort();
    critiqueAbort = new AbortController();
    critiqueId = paper.id;
    critiqueText = '';
    critiqueStreaming = true;
    const abs = abstractText[paper.id] || paper.abstract || '';
    try {
      await critiquePaper(paper.title, abs, (chunk) => { critiqueText += chunk; }, critiqueAbort.signal);
    } catch { /* aborted or error */ }
    critiqueStreaming = false;
  }

  // ── Deep Read & Reading Note state ───────────────────────────
  let deepReadId = $state<string | null>(null);
  let deepReadText = $state('');
  let deepReadStreaming = $state(false);
  let deepReadAbort: AbortController | null = null;

  let readingNoteId = $state<string | null>(null);
  let readingNoteStreaming = $state(false);

  async function doDeepRead(paper: PaperResult) {
    if (deepReadId === paper.id && deepReadStreaming) {
      deepReadAbort?.abort();
      deepReadStreaming = false;
      return;
    }
    deepReadAbort?.abort();
    deepReadAbort = new AbortController();
    deepReadId = paper.id;
    deepReadText = '';
    deepReadStreaming = true;
    const abs = abstractText[paper.id] || paper.abstract || '';
    try {
      await deepReadPaper(paper.title, abs, (chunk) => { deepReadText += chunk; }, deepReadAbort.signal);
    } catch { /* aborted or error */ }
    deepReadStreaming = false;
  }

  async function doReadingNote(paper: PaperResult) {
    readingNoteId = paper.id;
    readingNoteStreaming = true;
    let full = '';
    try {
      await generateReadingNote(
        { title: paper.title, authors: paper.authors, journal: paper.journal, year: paper.year, abstract: abstractText[paper.id] || paper.abstract, doi: paper.doi },
        (chunk) => { full += chunk; }
      );
    } catch (e) {
      showToast('Failed to generate reading note', 'error');
      readingNoteStreaming = false;
      readingNoteId = null;
      return;
    }
    const note: Note = {
      id: nanoid(),
      title: `Reading note: ${paper.title.slice(0, 70)}`,
      body: `# ${paper.title}\n\n**Citation:** ${buildAPA(paper)}\n\n${full}`,
      tags: ['reading-note', 'paper', paper.source],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      archived: false,
      audioIds: []
    };
    store.notes = [note, ...store.notes];
    store.currentNoteId = note.id;
    await store.saveNotes();
    store.view = 'notes';
    showToast('Reading note created');
    readingNoteStreaming = false;
    readingNoteId = null;
  }

  async function removeReadingItem(id: string) {
    store.readingList = store.readingList.filter(r => r.id !== id);
    await store.saveResearch();
    showToast('Removed from reading list');
  }

  async function setReadingPriority(id: string, priority: 'high' | 'medium' | 'low') {
    store.readingList = store.readingList.map(r =>
      r.id === id ? { ...r, priority } : r
    );
    await store.saveResearch();
  }

  const readingListByPriority = $derived({
    high: store.readingList.filter(r => r.priority === 'high'),
    medium: store.readingList.filter(r => r.priority === 'medium'),
    low: store.readingList.filter(r => r.priority === 'low'),
  });

  // ── Master toggle ─────────────────────────────────────────────
  const SESSION_KEY = 'qonco_research_on';
  let enabled = $state(sessionStorage.getItem(SESSION_KEY) === '1');
  function enable() { enabled = true; sessionStorage.setItem(SESSION_KEY, '1'); }

  const EXAMPLE_PAPERS: PaperResult[] = [
    {
      id: '_rp1',
      title: 'Single-cell transcriptomic landscape of the HGSOC tumor microenvironment reveals CAF subtype heterogeneity',
      authors: ['Hornburg M', 'Desbois M', 'Lu S', 'Bhatt B', 'Bueche G', 'Plattner C'],
      abstract: 'We performed scRNA-seq on 11 HGSOC tumors and paired omentum metastases, identifying distinct myofibroblastic and inflammatory CAF subtypes with opposing roles in immune suppression. myoCAFs drove TGF-β-mediated T cell exclusion while iCAFs promoted inflammatory signatures associated with better prognosis.',
      journal: 'Nature Cancer', year: 2023, doi: '10.1038/s43018-023-00550-x',
      url: 'https://doi.org/10.1038/s43018-023-00550-x', source: 'nature',
    },
    {
      id: '_rp2',
      title: 'PARP inhibitor resistance mechanisms in BRCA1/2-mutant ovarian cancer: reversion mutations and beyond',
      authors: ['Christie EL', 'Pattnaik S', 'Beach J', 'Cowin P', 'Kommoss S', 'Bittinger S'],
      abstract: 'Analysis of 78 olaparib-resistant HGSOC tumors identified BRCA1/2 reversion mutations in 18% of cases, 53BP1/RIF1 loss in 12%, and PARP1 downregulation in 8%. Multi-mechanism resistance was common at progression and associated with worse outcomes following carboplatin rechallenge.',
      journal: 'Clinical Cancer Research', year: 2023, doi: '10.1158/1078-0432.CCR-23-1432',
      url: 'https://doi.org/10.1158/1078-0432.CCR-23-1432', source: 'pubmed',
    },
    {
      id: '_rp3',
      title: 'Spatially resolved transcriptomics reveals immune desert and excluded niches in HGSOC',
      authors: ['Mheidly Z', 'Mahler M', 'Ecker A', 'Baumgartner D', 'Ferrone S'],
      abstract: 'Visium HD spatial transcriptomics of 23 HGSOC specimens resolved immune phenotypes at 8µm resolution. Spatially excluded CD8+ T cells co-localized with TGF-β-hi CAF regions, while TLS-associated B cell clusters predicted improved PFS independent of HRD status.',
      journal: 'Cancer Cell', year: 2024, doi: '10.1016/j.ccell.2024.03.012',
      url: 'https://doi.org/10.1016/j.ccell.2024.03.012', source: 'cell',
    },
    {
      id: '_rp4',
      title: 'cGAS-STING pathway activation by PARPi potentiates anti-tumor immunity in HGSOC',
      authors: ['Pantelidou C', 'Sonzogni O', 'De Oliveria Taveira M', 'Mehta AK', 'Raj A', 'Chen D'],
      abstract: 'PARPi-induced DNA damage activates cGAS-STING in BRCA1-deficient HGSOC cells, stimulating type I interferon production and CD8+ T cell infiltration. Combination with PD-L1 blockade showed synergistic efficacy in syngeneic mouse models, providing mechanistic rationale for ongoing clinical trials.',
      journal: 'Cancer Discovery', year: 2022, doi: '10.1158/2159-8290.CD-21-1215',
      url: 'https://doi.org/10.1158/2159-8290.CD-21-1215', source: 'pubmed',
    },
  ];
</script>

{#if !enabled}
  <div class="landing">
    <div class="landing-inner">
      <div class="landing-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </div>
      <h2>Research</h2>
      <p class="text-mu">Live literature search across PubMed, OpenAlex, Europe PMC, bioRxiv, medRxiv, Nature, and Cell — with Enzo AI summaries and a curated reading list.</p>
      <ul class="landing-features">
        <li>Multi-source search with domain-specific topic presets</li>
        <li>AI-generated structured summaries (hypothesis, methods, HGSOC relevance)</li>
        <li>Reading list with priority flags and read tracking</li>
        <li>Saved searches — one click to re-run</li>
        <li>Pin papers to the Dashboard for quick access</li>
      </ul>
      <button class="btn btn-primary landing-btn" onclick={enable}>Enable for this session</button>
      <p class="text-xs text-mu">Stays active until you close this tab.</p>
    </div>
  </div>
{:else}
<div class="research">
  <div class="research-header">
    <div>
      <h2>Research</h2>
      <p class="text-sm text-mu">Literature, preprints, and journal feeds</p>
    </div>
    <div class="header-actions">
      <!-- Tab switcher -->
      <div class="tab-row">
        <button
          class="tab-btn"
          class:active={researchTab === 'results'}
          onclick={() => researchTab = 'results'}
        >
          Results {#if papers.length > 0}<span class="tab-count">{papers.length}</span>{/if}
        </button>
        <button
          class="tab-btn"
          class:active={researchTab === 'reading-list'}
          onclick={() => researchTab = 'reading-list'}
        >
          Reading list {#if store.readingList.length > 0}<span class="tab-count">{store.readingList.length}</span>{/if}
        </button>
      </div>
      <!-- DOI resolver -->
      <div class="doi-wrap">
        <button class="btn btn-ghost btn-sm" onclick={() => doiOpen = !doiOpen} title="Resolve a DOI to add a paper">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          DOI
        </button>
        {#if doiOpen}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="doi-backdrop" onclick={() => doiOpen = false}></div>
          <div class="doi-popover">
            <p class="doi-hint">Paste a DOI (or doi.org URL) to fetch paper metadata and add it to your reading list.</p>
            <div class="doi-input-row">
              <input class="doi-input" bind:value={doiInput} placeholder="10.1038/s43018-023-00550-x" onkeydown={e => e.key === 'Enter' && resolveDoi()} />
              <button class="btn btn-primary btn-sm" onclick={resolveDoi} disabled={!doiInput.trim() || doiLoading}>
                {#if doiLoading}<span class="spinner-xs"></span>{:else}Resolve{/if}
              </button>
            </div>
          </div>
        {/if}
      </div>
      {#if store.pinnedPapers.length > 0}
        <button class="btn btn-ghost btn-sm" onclick={() => exportPapers(store.pinnedPapers)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export .md ({store.pinnedPapers.length})
        </button>
        <button class="btn btn-ghost btn-sm" onclick={() => exportPapersDocx(store.pinnedPapers)}>Export .doc</button>
        <button class="btn btn-ghost btn-sm" onclick={() => exportPapersBibTeX(store.pinnedPapers)} title="Export as BibTeX (.bib)">Export .bib</button>
        <button class="btn btn-ghost btn-sm" onclick={() => {
          const list = store.pinnedPapers.map((p, i) => `${i + 1}. ${p.title} — ${p.authors[0] || ''} et al. (${p.year}). ${p.journal}.${p.doi ? ' DOI: ' + p.doi : ''}`).join('\n');
          store.openCompose({ subject: 'Reading list', body: `My current reading list (${store.pinnedPapers.length} papers):\n\n${list}` });
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Email list
        </button>
      {/if}
    </div>
  </div>

  {#if researchTab === 'results'}
    <!-- Source toggles -->
    <div class="source-row">
      <span class="source-label">Sources</span>
      {#each SOURCES as src}
        {#if !src.worker || store.settings.workerUrl}
          <button
            class="source-chip {src.cls}"
            class:active={activeSources.has(src.key)}
            onclick={() => toggleSource(src.key)}
          >{src.label}</button>
        {:else}
          <button class="source-chip source-disabled" disabled title="Requires Worker URL in settings">
            {src.label} 🔒
          </button>
        {/if}
      {/each}
    </div>

    <!-- Saved searches -->
    {#if store.savedSearches.length > 0}
      <div class="saved-row">
        <span class="source-label">Saved</span>
        <div class="saved-chips">
          {#each store.savedSearches as ss (ss.id)}
            <div class="saved-chip-wrap">
              <button
                class="saved-chip saved-chip-{ss.color}"
                onclick={() => runSavedSearch(ss)}
                title="Run: {ss.query}"
              >{ss.label}</button>
              <button class="saved-chip-del" onclick={() => deleteSavedSearch(ss.id)} title="Delete saved search">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Quick topic presets -->
    <div class="presets-section">
      <button class="presets-toggle" onclick={() => showPresets = !showPresets}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          style="transform: rotate({showPresets ? 90 : 0}deg); transition: transform 0.15s">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        Quick topics
      </button>
      {#if showPresets}
        <div class="presets-grid">
          {#each PRESET_TOPICS as group}
            <div class="preset-group">
              <span class="preset-cat preset-cat-{group.color}">{group.cat}</span>
              <div class="preset-chips">
                {#each group.topics as topic}
                  <button
                    class="preset-chip preset-chip-{group.color}"
                    onclick={() => { query = topic; search(); }}
                  >{topic}</button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Search bar -->
    <div class="search-row">
      <div class="search-wrap">
        <input
          type="text"
          bind:value={query}
          placeholder="Search PubMed, OpenAlex, preprints…"
          onkeydown={(e) => e.key === 'Enter' && search()}
          class="search-input"
        />
        {#if conceptSuggestions.length > 0}
          <div class="concept-chips">
            {#each conceptSuggestions as c}
              <button class="concept-chip" onclick={() => { query = c; search(); }}>{c}</button>
            {/each}
          </div>
        {/if}
      </div>
      <button class="btn btn-primary btn-sm search-btn" onclick={search} disabled={loading}>
        {loading ? 'Fetching…' : 'Search'}
      </button>
      {#if query.trim()}
        {#if showSaveInput}
          <div class="save-input-row">
            <input
              type="text"
              bind:value={saveSearchLabel}
              placeholder="Search label…"
              class="save-label-input"
              onkeydown={(e) => { if (e.key === 'Enter') saveCurrentSearch(); if (e.key === 'Escape') { showSaveInput = false; saveSearchLabel = ''; } }}
            />
            <button class="btn btn-primary btn-sm" onclick={saveCurrentSearch} disabled={savingSearch || !saveSearchLabel.trim()}>
              {savingSearch ? '…' : 'Save'}
            </button>
            <button class="btn btn-ghost btn-sm" onclick={() => { showSaveInput = false; saveSearchLabel = ''; }}>Cancel</button>
          </div>
        {:else}
          <button class="btn btn-ghost btn-sm" onclick={() => showSaveInput = true} title="Save this search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save search
          </button>
        {/if}
      {/if}
    </div>

    {#if error}
      <div class="error-box">{error}</div>
    {/if}

    {#if loading}
      <div class="loading-row">
        <span class="spinner-sm"></span>
        <span class="text-sm text-mu">Fetching papers…</span>
      </div>
    {/if}

    <div class="papers-list">
      {#each papers as paper (paper.id)}
        <article class="paper-card card">
          <div class="paper-head">
            <div class="paper-meta">
              <span class="tag {SOURCE_CLS[paper.source] || ''}">{SOURCE_LABELS[paper.source] || paper.source}</span>
              <span class="text-xs text-mu">{paper.journal}</span>
              {#if paper.year > 0}<span class="text-xs text-mu">· {paper.year}</span>{/if}
            </div>
            <div class="paper-actions">
              <!-- Reading list bookmark -->
              <button
                class="btn-icon bookmark-btn"
                class:bookmarked={isInReadingList(paper.id)}
                onclick={() => toggleReadingList(paper)}
                title={isInReadingList(paper.id) ? 'Remove from reading list' : 'Add to reading list'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={isInReadingList(paper.id) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
              </button>
              <button
                class="btn-icon pin-btn"
                class:pinned={store.isPinned(paper.id)}
                onclick={() => togglePin(paper)}
                title={store.isPinned(paper.id) ? 'Unpin from dashboard' : 'Pin to dashboard'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={store.isPinned(paper.id) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                </svg>
              </button>
              <button class="btn-icon" onclick={() => sendToEnzo(paper)} title="Ask Enzo about this">
                <span class="text-enzo text-xs" style="font-family:var(--mono);font-weight:700">E</span>
              </button>
              <button
                class="btn-icon critique-btn"
                class:critique-active={critiqueId === paper.id}
                onclick={() => doCritique(paper)}
                title="Enzo peer critique"
              >
                {#if critiqueStreaming && critiqueId === paper.id}
                  <span class="spinner-xs"></span>
                {:else}
                  <span style="font-size:0.6rem;font-weight:700;font-family:var(--mono)">CR</span>
                {/if}
              </button>
              <button class="btn-icon cite-btn" onclick={() => copyCitation(paper, 'apa')} title="Copy APA citation">APA</button>
              <button class="btn-icon cite-btn" onclick={() => copyCitation(paper, 'vancouver')} title="Copy Vancouver citation">VAN</button>
              <button class="btn-icon cite-btn" onclick={() => copyCitation(paper, 'bibtex')} title="Copy BibTeX">BIB</button>
              <button class="btn-icon save-note-btn" onclick={() => saveAsNote(paper)} title="Save as note">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </button>
              {#if store.aiSettings.deepRead}
                <button
                  class="btn-icon deep-read-btn"
                  class:deep-read-active={deepReadId === paper.id}
                  onclick={() => doDeepRead(paper)}
                  title="Deep Read — Enzo asks 5 critical questions"
                >
                  {#if deepReadStreaming && deepReadId === paper.id}
                    <span class="spinner-xs"></span>
                  {:else}
                    <span style="font-size:0.6rem;font-weight:700;font-family:var(--mono)">DR</span>
                  {/if}
                </button>
              {/if}
              {#if store.aiSettings.readingNote}
                <button
                  class="btn-icon reading-note-btn"
                  onclick={() => doReadingNote(paper)}
                  disabled={readingNoteStreaming && readingNoteId === paper.id}
                  title="Generate AI reading note"
                >
                  {#if readingNoteStreaming && readingNoteId === paper.id}
                    <span class="spinner-xs"></span>
                  {:else}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  {/if}
                </button>
              {/if}
              <!-- Summarise button -->
              <button
                class="btn-icon summarise-btn"
                onclick={() => summarisePaper(paper)}
                disabled={summaryLoading[paper.id]}
                title="AI summary for HGSOC context"
              >
                {#if summaryLoading[paper.id]}
                  <span class="spinner-xs"></span>
                {:else}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                {/if}
              </button>
              {#if paper.pdfUrl}
                <a href={paper.pdfUrl} target="_blank" rel="noreferrer" class="btn-icon pdf-btn" title="Download PDF">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span class="pdf-label">PDF</span>
                </a>
              {/if}
              {#if paper.doi}
                <a href="https://doi.org/{paper.doi}" target="_blank" rel="noreferrer" class="btn-icon" title="Open paper">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              {:else if paper.url}
                <a href={paper.url} target="_blank" rel="noreferrer" class="btn-icon" title="Open">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              {/if}
            </div>
          </div>

          <button class="paper-title-btn" onclick={() => loadAbstract(paper)}>
            <h3 class="paper-title">{paper.title}</h3>
          </button>

          {#if paper.authors.length > 0}
            <p class="paper-authors text-xs text-mu">
              {paper.authors.slice(0, 5).join(', ')}{paper.authors.length > 5 ? ' et al.' : ''}
            </p>
          {/if}

          {#if expandedId === paper.id}
            <div class="abstract-box">
              {#if abstractText[paper.id]}
                <p class="text-sm">{abstractText[paper.id]}</p>
              {:else if paper.abstract}
                <p class="text-sm">{paper.abstract}</p>
              {:else}
                <p class="text-sm text-mu">Loading abstract…</p>
              {/if}
            </div>
          {/if}

          {#if summaryText[paper.id] || summaryStreaming[paper.id]}
            <div class="summary-box">
              <div class="summary-header">
                <span class="summary-label">AI Summary</span>
                {#if summaryStreaming[paper.id]}
                  <span class="spinner-xs"></span>
                {/if}
              </div>
              <div class="summary-body text-sm">{summaryText[paper.id] || ''}</div>
            </div>
          {/if}
          {#if deepReadId === paper.id && (deepReadText || deepReadStreaming)}
            <div class="summary-box deep-read-box">
              <div class="summary-header">
                <span class="summary-label">Deep Read · Enzo's questions</span>
                {#if deepReadStreaming}
                  <span class="spinner-xs"></span>
                {:else}
                  <button class="btn-link" onclick={() => { deepReadId = null; deepReadText = ''; }}>Close</button>
                {/if}
              </div>
              <div class="summary-body text-sm">{deepReadText}</div>
            </div>
          {/if}
          {#if critiqueId === paper.id && (critiqueText || critiqueStreaming)}
            <div class="summary-box critique-box">
              <div class="summary-header">
                <span class="summary-label">Enzo Peer Critique</span>
                {#if critiqueStreaming}
                  <span class="spinner-xs"></span>
                {:else}
                  <button class="btn-link" onclick={() => { critiqueId = null; critiqueText = ''; }}>Close</button>
                {/if}
              </div>
              <div class="summary-body text-sm" style="white-space:pre-wrap">{critiqueText}</div>
            </div>
          {/if}
        </article>
      {:else}
        {#if !loading}
          <div class="example-papers-section">
            <p class="text-xs text-mu example-label-row">· example papers — search to see live results</p>
            {#each EXAMPLE_PAPERS as paper}
              <article class="paper-card card example-paper-card">
                <div class="paper-head">
                  <div class="paper-meta">
                    <span class="tag {SOURCE_CLS[paper.source] || ''}">{SOURCE_LABELS[paper.source] || paper.source}</span>
                    <span class="text-xs text-mu">{paper.journal}</span>
                    <span class="text-xs text-mu">· {paper.year}</span>
                    <span class="example-paper-badge text-xs">example</span>
                  </div>
                </div>
                <h3 class="paper-title">{paper.title}</h3>
                <p class="paper-authors text-xs text-mu">{paper.authors.slice(0, 4).join(', ')}{paper.authors.length > 4 ? ' et al.' : ''}</p>
                <div class="abstract-box">
                  <p class="text-sm">{paper.abstract}</p>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      {/each}
    </div>

  {:else}
    <!-- Reading list tab -->
    <div class="reading-list">
      {#if store.readingList.length > 0}
        {@const goal = store.settings.weeklyReadingGoal ?? 3}
        {@const pct = Math.min(100, Math.round((readThisWeek / goal) * 100))}
        <div class="reading-goal-bar card">
          <div class="reading-goal-head">
            <span class="reading-goal-label">Weekly goal</span>
            <span class="reading-goal-count">{readThisWeek} / {goal} papers read this week</span>
          </div>
          <div class="goal-track">
            <div class="goal-fill" style="width: {pct}%" class:goal-done={readThisWeek >= goal}></div>
          </div>
        </div>
      {/if}
      {#if store.readingList.length === 0}
        <div class="empty-state">
          <p class="text-mu">No papers in your reading list yet. Bookmark papers from search results.</p>
        </div>
      {:else}
        {#each (['high', 'medium', 'low'] as const) as priority}
          {#if readingListByPriority[priority].length > 0}
            <div class="rl-group">
              <div class="rl-group-head">
                <span class="rl-priority-dot rl-dot-{priority}"></span>
                <span class="rl-group-label">{priority.charAt(0).toUpperCase() + priority.slice(1)} priority</span>
                <span class="text-xs text-mu">({readingListByPriority[priority].length})</span>
              </div>
              {#each readingListByPriority[priority] as item (item.id)}
                <div class="rl-item card" class:rl-read={item.read}>
                  <div class="rl-item-head">
                    <label class="rl-check">
                      <input
                        type="checkbox"
                        checked={item.read}
                        onchange={() => toggleReadItem(item.id)}
                      />
                      <span class="rl-check-label">Read</span>
                    </label>
                    <div class="rl-item-meta">
                      <span class="tag {SOURCE_CLS[item.paper.source] || ''}">{SOURCE_LABELS[item.paper.source] || item.paper.source}</span>
                      <span class="text-xs text-mu">{item.paper.journal}</span>
                      {#if item.paper.year > 0}<span class="text-xs text-mu">· {item.paper.year}</span>{/if}
                    </div>
                    <div class="rl-item-actions">
                      <select
                        class="rl-priority-sel"
                        value={item.priority}
                        onchange={(e) => setReadingPriority(item.id, (e.target as HTMLSelectElement).value as 'high' | 'medium' | 'low')}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      {#if item.paper.doi}
                        <a href="https://doi.org/{item.paper.doi}" target="_blank" rel="noreferrer" class="btn-icon" title="Open">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      {:else if item.paper.url}
                        <a href={item.paper.url} target="_blank" rel="noreferrer" class="btn-icon" title="Open">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      {/if}
                      <button class="btn-icon cite-btn" onclick={() => copyCitation(item.paper, 'apa')} title="Copy APA">APA</button>
                      <button class="btn-icon cite-btn" onclick={() => copyCitation(item.paper, 'vancouver')} title="Copy Vancouver">VAN</button>
                      <button class="btn-icon cite-btn" onclick={() => copyCitation(item.paper, 'bibtex')} title="Copy BibTeX">BIB</button>
                      <button class="btn-icon" onclick={() => removeReadingItem(item.id)} title="Remove">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p class="rl-title" class:rl-title-done={item.read}>{item.paper.title}</p>
                  {#if item.paper.authors.length > 0}
                    <p class="text-xs text-mu">{item.paper.authors.slice(0, 4).join(', ')}{item.paper.authors.length > 4 ? ' et al.' : ''} · ~{readingTimeMins(item.paper)} min</p>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      {/if}
    </div>
  {/if}
</div>
{/if}

<style>
  /* Landing page */
  .landing {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    background: var(--bg);
  }
  .landing-inner {
    max-width: 480px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }
  .landing-icon { color: var(--pu); opacity: 0.8; }
  .landing-inner h2 { font-size: 1.4rem; font-weight: 700; }
  .landing-inner p { color: var(--tx2); line-height: 1.6; max-width: 400px; }
  .landing-features {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 6px;
    text-align: left; width: 100%; max-width: 380px;
  }
  .landing-features li {
    font-size: 0.82rem; color: var(--tx2);
    padding: 6px 10px; background: var(--sf);
    border: 1px solid var(--bd); border-radius: var(--radius-sm);
    display: flex; align-items: center; gap: 8px;
  }
  .landing-features li::before { content: '→'; color: var(--pu); font-size: 0.75rem; }
  .landing-btn { margin-top: 6px; padding: 10px 28px; }

  .example-papers-section { display: flex; flex-direction: column; gap: 10px; }
  .example-label-row { padding: 4px 0 8px; letter-spacing: 0.04em; font-style: italic; }
  .example-paper-card { opacity: 0.7; }
  .example-paper-badge {
    background: var(--sf2); border: 1px solid var(--bd);
    border-radius: 8px; padding: 0 5px; color: var(--mu);
    font-size: 0.62rem; font-weight: 700; letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .research {
    height: 100%;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .research-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .research-header h2 { margin-bottom: 2px; }
  .header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

  /* Tabs */
  .tab-row { display: flex; gap: 2px; background: var(--sf2); border-radius: var(--radius-sm); padding: 2px; }
  .tab-btn {
    padding: 4px 12px;
    border-radius: calc(var(--radius-sm) - 1px);
    font-size: 0.78rem;
    font-weight: 600;
    background: transparent;
    border: none;
    color: var(--tx2);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all var(--transition);
  }
  .tab-btn.active { background: var(--sf); color: var(--tx); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .tab-count {
    background: var(--ac-bg);
    color: var(--ac);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 8px;
  }

  .source-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .source-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mu);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    margin-right: 2px;
  }

  .source-chip {
    padding: 3px 11px;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 600;
    border: 1px solid var(--bd);
    background: var(--sf2);
    color: var(--mu);
    cursor: pointer;
    opacity: 0.7;
    transition: all var(--transition);
  }
  .source-chip:hover:not(:disabled) { opacity: 1; }
  .source-chip.active { opacity: 1; }
  .source-chip.sc-ac.active  { background: var(--ac-bg);   color: var(--ac);   border-color: var(--ac); }
  .source-chip.sc-gn.active  { background: var(--gn-bg);   color: var(--gn);   border-color: var(--gn); }
  .source-chip.sc-enzo.active{ background: var(--enzo-bg); color: var(--enzo); border-color: var(--enzo-bd); }
  .source-chip.sc-rd.active  { background: var(--rd-bg);   color: var(--rd);   border-color: var(--rd); }
  .source-chip.sc-pu.active  { background: var(--pu-bg);   color: var(--pu);   border-color: var(--pu); }
  .source-chip.sc-yw.active  { background: var(--yw-bg);   color: var(--yw);   border-color: var(--yw); }
  .source-disabled { opacity: 0.3; cursor: default; font-size: 0.72rem; }

  /* Saved searches */
  .saved-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .saved-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .saved-chip-wrap { display: flex; align-items: center; }
  .saved-chip {
    padding: 3px 10px;
    border-radius: 20px 0 0 20px;
    font-size: 0.77rem;
    font-weight: 600;
    border: 1px solid var(--bd);
    border-right: none;
    cursor: pointer;
    transition: all var(--transition);
    background: var(--sf2);
    color: var(--tx2);
  }
  .saved-chip:hover { opacity: 0.85; }
  .saved-chip-ac   { background: var(--ac-bg);   color: var(--ac);   border-color: var(--ac); }
  .saved-chip-gn   { background: var(--gn-bg);   color: var(--gn);   border-color: var(--gn); }
  .saved-chip-pu   { background: var(--pu-bg);   color: var(--pu);   border-color: var(--pu); }
  .saved-chip-yw   { background: var(--yw-bg);   color: var(--yw);   border-color: var(--yw); }
  .saved-chip-enzo { background: var(--enzo-bg); color: var(--enzo); border-color: var(--enzo-bd); }
  .saved-chip-rd   { background: var(--rd-bg);   color: var(--rd);   border-color: var(--rd); }
  .saved-chip-del {
    padding: 3px 6px;
    border-radius: 0 20px 20px 0;
    border: 1px solid var(--bd);
    border-left: none;
    background: var(--sf2);
    color: var(--mu);
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all var(--transition);
  }
  .saved-chip-del:hover { background: var(--rd-bg); color: var(--rd); border-color: var(--rd); }

  /* Presets */
  .presets-section { display: flex; flex-direction: column; gap: 8px; }
  .presets-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.77rem;
    font-weight: 600;
    color: var(--mu);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    transition: color var(--transition);
  }
  .presets-toggle:hover { color: var(--ac); background: var(--ac-bg); }
  .presets-grid { display: flex; flex-direction: column; gap: 10px; }
  .preset-group { display: flex; flex-direction: column; gap: 5px; }
  .preset-cat {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .preset-cat-ac   { color: var(--ac); }
  .preset-cat-pu   { color: var(--pu); }
  .preset-cat-rd   { color: var(--rd); }
  .preset-cat-enzo { color: var(--enzo); }
  .preset-cat-gn   { color: var(--gn); }
  .preset-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .preset-chip {
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.72rem;
    border: 1px solid var(--bd);
    background: var(--sf2);
    color: var(--tx2);
    cursor: pointer;
    transition: all var(--transition);
    text-align: left;
  }
  .preset-chip-ac:hover   { background: var(--ac-bg);   color: var(--ac);   border-color: var(--ac); }
  .preset-chip-pu:hover   { background: var(--pu-bg);   color: var(--pu);   border-color: var(--pu); }
  .preset-chip-rd:hover   { background: var(--rd-bg);   color: var(--rd);   border-color: var(--rd); }
  .preset-chip-enzo:hover { background: var(--enzo-bg); color: var(--enzo); border-color: var(--enzo-bd); }
  .preset-chip-gn:hover   { background: var(--gn-bg);   color: var(--gn);   border-color: var(--gn); }

  .search-row { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
  .search-wrap { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 8px; }
  .search-input { width: 100%; }
  .search-btn { flex-shrink: 0; align-self: flex-start; }

  .save-input-row { display: flex; gap: 6px; align-items: center; }
  .save-label-input { width: 160px; font-size: 0.82rem; padding: 5px 8px; }

  .concept-chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .concept-chip {
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.73rem;
    background: var(--sf2);
    border: 1px solid var(--bd);
    color: var(--tx2);
    cursor: pointer;
    transition: all var(--transition);
    text-align: left;
  }
  .concept-chip:hover { border-color: var(--ac); color: var(--ac); background: var(--ac-bg); }

  .error-box {
    background: var(--rd-bg);
    border: 1px solid var(--rd);
    border-radius: var(--radius-sm);
    color: var(--rd);
    font-size: 0.82rem;
    padding: 10px 14px;
  }

  .loading-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
  .spinner-sm {
    width: 16px; height: 16px;
    border: 2px solid var(--bd2);
    border-top-color: var(--ac);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .spinner-xs {
    width: 11px; height: 11px;
    border: 1.5px solid var(--bd2);
    border-top-color: var(--ac);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .papers-list { display: flex; flex-direction: column; gap: 10px; }
  .paper-card { display: flex; flex-direction: column; gap: 8px; }

  .paper-head { display: flex; align-items: center; justify-content: space-between; }
  .paper-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .paper-actions { display: flex; gap: 2px; align-items: center; }

  .bookmark-btn { color: var(--mu); }
  .bookmark-btn.bookmarked { color: var(--ac); }
  .bookmark-btn:hover { color: var(--ac); background: var(--ac-bg); }

  .pin-btn { color: var(--mu); }
  .pin-btn.pinned { color: var(--enzo); }
  .pin-btn:hover { color: var(--enzo); background: var(--enzo-bg); }

  .summarise-btn { color: var(--pu); }
  .summarise-btn:hover { background: var(--pu-bg); }
  .summarise-btn:disabled { opacity: 0.5; cursor: default; }
  .save-note-btn { color: var(--mu); }
  .save-note-btn:hover { color: var(--ac); background: var(--ac-bg); }

  .pdf-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: var(--rd) !important;
    text-decoration: none;
  }
  .pdf-btn:hover { background: var(--rd-bg) !important; }
  .pdf-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.04em; }

  .paper-title-btn {
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    padding: 0;
    font-family: var(--font);
  }
  .paper-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--tx);
    line-height: 1.4;
    transition: color var(--transition);
  }
  .paper-title-btn:hover .paper-title { color: var(--ac); }

  .paper-authors { line-height: 1.4; }

  .abstract-box {
    background: var(--sf2);
    border-radius: var(--radius-sm);
    padding: 12px;
    border: 1px solid var(--bd);
  }
  .abstract-box p { line-height: 1.7; color: var(--tx2); }

  /* Summary */
  .summary-box {
    background: var(--pu-bg);
    border: 1px solid var(--pu);
    border-radius: var(--radius-sm);
    padding: 12px;
  }
  .deep-read-box { background: var(--enzo-bg); border-color: var(--enzo-bd); }
  .deep-read-box .summary-label { color: var(--enzo); }
  .critique-box { background: rgba(251,146,60,0.07); border-color: rgba(251,146,60,0.25); }
  .critique-box .summary-label { color: #fb923c; }
  .critique-btn { color: #fb923c; }
  .critique-btn:hover, .critique-active { background: rgba(251,146,60,0.12); }
  .deep-read-btn { color: var(--enzo); }
  .deep-read-btn:hover, .deep-read-active { background: var(--enzo-bg); }
  .reading-note-btn { color: var(--ac); }
  .reading-note-btn:hover { background: var(--ac-bg); }

  .reading-goal-bar { padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; }
  .reading-goal-head { display: flex; align-items: center; justify-content: space-between; }
  .reading-goal-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mu); }
  .reading-goal-count { font-size: 0.78rem; color: var(--tx2); }
  .goal-track { height: 5px; background: var(--sf2); border-radius: 3px; overflow: hidden; }
  .goal-fill { height: 100%; background: var(--ac); border-radius: 3px; transition: width 0.4s; }
  .goal-fill.goal-done { background: var(--gn); }
  .summary-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .summary-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--pu);
  }
  .summary-body {
    color: var(--tx2);
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .empty-state { padding: 40px; text-align: center; }

  /* Reading list */
  .reading-list { display: flex; flex-direction: column; gap: 16px; }
  .rl-group { display: flex; flex-direction: column; gap: 8px; }
  .rl-group-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }
  .rl-priority-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .rl-dot-high   { background: var(--rd); }
  .rl-dot-medium { background: var(--yw); }
  .rl-dot-low    { background: var(--gn); }
  .rl-group-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mu);
  }
  .rl-item { display: flex; flex-direction: column; gap: 6px; transition: opacity var(--transition); }
  .rl-item.rl-read { opacity: 0.55; }
  .rl-item-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .rl-check {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .rl-check input { cursor: pointer; accent-color: var(--gn); }
  .rl-check-label { font-size: 0.72rem; color: var(--mu); }
  .rl-item-meta { display: flex; align-items: center; gap: 6px; flex: 1; flex-wrap: wrap; }
  .rl-item-actions { display: flex; align-items: center; gap: 2px; margin-left: auto; }
  .rl-priority-sel {
    font-size: 0.72rem;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bd);
    background: var(--sf2);
    color: var(--tx2);
    cursor: pointer;
    font-family: var(--font);
  }
  .rl-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--tx);
    line-height: 1.4;
  }
  .rl-title.rl-title-done {
    text-decoration: line-through;
    color: var(--mu);
  }

  /* DOI resolver */
  .doi-wrap { position: relative; }
  .doi-backdrop { position: fixed; inset: 0; z-index: 30; }
  .doi-popover {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 31;
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    box-shadow: var(--shadow-lg); padding: 14px 16px; width: 340px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .doi-hint { font-size: 0.8rem; color: var(--mu); line-height: 1.5; margin: 0; }
  .doi-input-row { display: flex; gap: 8px; }
  .doi-input { flex: 1; font-size: 0.82rem; }
  .spinner-xs {
    display: inline-block; width: 10px; height: 10px;
    border: 1.5px solid var(--bd2); border-top-color: #fff;
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Citation buttons */
  .cite-btn {
    font-size: 0.58rem; font-weight: 800; font-family: var(--mono);
    letter-spacing: 0.04em; color: var(--mu);
    padding: 2px 5px; border-radius: 3px; border: 1px solid var(--bd);
  }
  .cite-btn:hover { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }

  .btn-link { background: transparent; border: none; color: var(--ac); cursor: pointer; font-size: 0.78rem; padding: 2px 6px; border-radius: var(--radius-sm); font-family: var(--font); }
  .btn-link:hover { background: var(--ac-bg); }

  @media (max-width: 640px) {
    .research { padding: 16px; }
    .save-label-input { width: 120px; }
    .tab-btn { padding: 4px 8px; font-size: 0.72rem; }
  }
  @media (max-width: 540px) {
    .source-row { flex-wrap: wrap; gap: 4px; }
    .search-row { flex-direction: column; }
    .search-row input { width: 100%; }
  }
</style>
