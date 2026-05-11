<script lang="ts">
  import { searchPubMed, fetchBioRxiv, fetchNatureCell, fetchPubMedAbstract, searchOpenAlex, searchEuropePMC } from '../lib/pubmed';
  import type { PaperResult, ReadingListItem, SavedSearch, Note, PaperCollection } from '../lib/types';
  import { store } from '../lib/store.svelte';
  import { exportPapers, exportPapersDocx, exportPapersBibTeX } from '../lib/export';
  import { askResearch, deepReadPaper, generateReadingNote, critiquePaper, streamRadarSummary, streamMarkerLookup, comparePapers } from '../lib/groq';
  import { nanoid } from 'nanoid';
  import { marked } from 'marked';

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
  let researchTab = $state<'results' | 'reading-list' | 'radar' | 'markers' | 'network'>('results');

  // ── Radar tab state ────────────────────────────────────────────
  type RadarCard = { pmid: string; title: string; authors: string; journal: string; year: number; abstract: string; doi: string; added: boolean };

  const RADAR_DEFAULTS = ['HGSOC', 'high-grade serous ovarian cancer', 'PARPi resistance', 'tumour microenvironment ovarian', 'scRNA-seq ovarian cancer'];
  let radarTerms = $state<string[]>([...RADAR_DEFAULTS]);
  let radarNewTerm = $state('');
  let radarLoading = $state(false);
  let radarResults = $state<RadarCard[]>([]);
  let radarDigest = $state('');
  let radarDigestStreaming = $state(false);
  let radarDigestAbort: AbortController | null = null;
  let radarScanned = $state(false);

  const RADAR_EXAMPLES: RadarCard[] = [
    { pmid: '_r1', title: 'Spatial mapping of CD8+ T cell exclusion zones in HGSOC identifies TGF-β-driven CAF barrier', authors: 'Weber K et al.', journal: 'Nature Cancer', year: 2024, abstract: 'High-resolution Visium HD profiling of 28 HGSOC tumors reveals spatially discrete immune-excluded niches co-localised with myoCAF-enriched stroma. TGF-β pathway inhibition in patient-derived organoids partially restored CD8 infiltration.', doi: '', added: false },
    { pmid: '_r2', title: 'Single-cell atlas of PARPi-resistant HGSOC identifies emergent immune-evasive tumour clone', authors: 'Patel S et al.', journal: 'Cancer Discovery', year: 2024, abstract: 'scRNA-seq of 19 olaparib-resistant HGSOC cases identifies a novel tumour subpopulation with downregulated MHC-I and upregulated TIGIT ligands, correlating with reduced CD8 infiltration and worse post-progression outcomes.', doi: '', added: false },
    { pmid: '_r3', title: 'FOLR1-targeting antibody-drug conjugate mirvetuximab achieves durable responses in platinum-resistant HGSOC', authors: 'Moore KN et al.', journal: 'New England Journal of Medicine', year: 2023, abstract: 'Phase III MIRASOL trial demonstrates that mirvetuximab soravtansine significantly improves progression-free and overall survival versus chemotherapy in FOLR1-high platinum-resistant ovarian cancer, establishing a new standard of care.', doi: '', added: false },
  ];

  async function radarScan() {
    radarLoading = true;
    radarScanned = false;
    const seen = new Set<string>();
    const all: RadarCard[] = [];

    for (const term of radarTerms) {
      try {
        const results = await searchPubMed(term, 8);
        for (const p of results) {
          const key = p.id || p.doi || p.title;
          if (seen.has(key)) continue;
          // skip if already in corpus (compare by title similarity)
          const inCorpus = store.pinnedPapers.some(pp =>
            pp.title.toLowerCase().slice(0, 40) === p.title.toLowerCase().slice(0, 40)
          );
          if (inCorpus) continue;
          seen.add(key);
          all.push({
            pmid: p.id,
            title: p.title,
            authors: p.authors.slice(0, 3).join(', ') + (p.authors.length > 3 ? ' et al.' : ''),
            journal: p.journal,
            year: p.year,
            abstract: p.abstract || '',
            doi: p.doi || '',
            added: false,
          });
        }
      } catch { /* continue */ }
    }

    radarResults = all;
    radarScanned = true;
    radarLoading = false;
  }

  function radarAddToCorpus(card: RadarCard) {
    const paper: PaperResult = {
      id: card.pmid,
      title: card.title,
      authors: card.authors.split(', '),
      abstract: card.abstract,
      journal: card.journal,
      year: card.year,
      doi: card.doi,
      url: card.doi ? `https://doi.org/${card.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${card.pmid}/`,
      source: 'pubmed',
    };
    store.pinPaper(paper);
    radarResults = radarResults.map(r => r.pmid === card.pmid ? { ...r, added: true } : r);
    showToast('Added to research corpus');
  }

  async function radarSummarise() {
    const papersToSummarise = radarResults.slice(0, 10);
    if (papersToSummarise.length === 0) return;
    radarDigestAbort?.abort();
    radarDigestAbort = new AbortController();
    radarDigest = '';
    radarDigestStreaming = true;
    const existingTopics = store.pinnedPapers.slice(0, 5).map(p => p.title).join('; ') || 'HGSOC, PARPi resistance, tumour microenvironment';
    try {
      await streamRadarSummary(papersToSummarise, existingTopics, chunk => { radarDigest += chunk; }, radarDigestAbort.signal);
    } catch { /* aborted */ }
    radarDigestStreaming = false;
  }

  // ── Markers tab state ──────────────────────────────────────────
  const MARKER_DB = [
    { gene: 'TP53', cellTypes: ['tumour cells'], role: 'tumour suppressor', hgsocRelevance: 'mutated in >96% HGSOC' },
    { gene: 'BRCA1', cellTypes: ['tumour cells'], role: 'DNA repair', hgsocRelevance: 'germline/somatic mutation, PARPi sensitivity' },
    { gene: 'BRCA2', cellTypes: ['tumour cells'], role: 'DNA repair', hgsocRelevance: 'germline/somatic mutation, PARPi sensitivity' },
    { gene: 'FOXM1', cellTypes: ['tumour cells'], role: 'mitotic progression', hgsocRelevance: 'amplified in HGSOC, poor prognosis' },
    { gene: 'CD8A', cellTypes: ['cytotoxic T cells'], role: 'co-receptor, cytotoxicity', hgsocRelevance: 'CD8+ TIL correlates with improved survival' },
    { gene: 'PDCD1', cellTypes: ['exhausted T cells'], role: 'checkpoint receptor (PD-1)', hgsocRelevance: 'checkpoint inhibitor target' },
    { gene: 'CD274', cellTypes: ['tumour cells', 'macrophages'], role: 'PD-L1 immune evasion', hgsocRelevance: 'biomarker for checkpoint therapy' },
    { gene: 'EPCAM', cellTypes: ['tumour cells'], role: 'cell adhesion', hgsocRelevance: 'tumour cell marker, CTC detection' },
    { gene: 'MKI67', cellTypes: ['proliferating cells'], role: 'proliferation marker', hgsocRelevance: 'tumour proliferation index' },
    { gene: 'CXCL12', cellTypes: ['CAFs', 'endothelial'], role: 'chemokine', hgsocRelevance: 'TME remodelling, immune exclusion' },
    { gene: 'CD68', cellTypes: ['macrophages'], role: 'macrophage marker', hgsocRelevance: 'TAM quantification' },
    { gene: 'MRC1', cellTypes: ['M2 macrophages'], role: 'mannose receptor (CD206)', hgsocRelevance: 'immunosuppressive TAM phenotype' },
    { gene: 'ACTA2', cellTypes: ['CAFs', 'smooth muscle'], role: 'alpha-SMA, contractile CAF', hgsocRelevance: 'stromal activation marker' },
    { gene: 'VEGFA', cellTypes: ['tumour cells', 'macrophages'], role: 'angiogenesis', hgsocRelevance: 'bevacizumab target' },
    { gene: 'IL6', cellTypes: ['CAFs', 'macrophages'], role: 'pro-tumour cytokine', hgsocRelevance: 'ascites driver, JAK/STAT signalling' },
    { gene: 'FOLR1', cellTypes: ['tumour cells'], role: 'folate receptor alpha', hgsocRelevance: 'overexpressed ~90% HGSOC, mirvetuximab target' },
    { gene: 'CA9', cellTypes: ['hypoxic tumour cells'], role: 'carbonic anhydrase IX', hgsocRelevance: 'hypoxia marker' },
    { gene: 'NCAM1', cellTypes: ['NK cells'], role: 'CD56, NK cell marker', hgsocRelevance: 'NK cell dysfunction in ascites' },
    { gene: 'FOXP3', cellTypes: ['regulatory T cells'], role: 'Treg master TF', hgsocRelevance: 'immunosuppression, poor prognosis' },
    { gene: 'HLA-A', cellTypes: ['tumour cells', 'APCs'], role: 'MHC-I antigen presentation', hgsocRelevance: 'immune evasion by downregulation' },
  ];

  let markerQuery = $state('');
  let markerEnzoText = $state('');
  let markerEnzoStreaming = $state(false);
  let markerEnzoAbort: AbortController | null = null;

  const markerMatches = $derived(
    markerQuery.trim().length >= 1
      ? MARKER_DB.filter(m => m.gene.toLowerCase().startsWith(markerQuery.toLowerCase().trim()))
      : []
  );

  async function askMarkerEnzo(gene: string) {
    markerEnzoAbort?.abort();
    markerEnzoAbort = new AbortController();
    markerEnzoText = '';
    markerEnzoStreaming = true;
    const matched = MARKER_DB.find(m => m.gene.toLowerCase() === gene.toLowerCase());
    const context = matched
      ? `Cell types: ${matched.cellTypes.join(', ')}. Role: ${matched.role}. HGSOC relevance: ${matched.hgsocRelevance}.`
      : 'No local database entry — provide general HGSOC TME context.';
    try {
      await streamMarkerLookup(gene || markerQuery.trim(), context, chunk => { markerEnzoText += chunk; }, markerEnzoAbort.signal);
    } catch { /* aborted */ }
    markerEnzoStreaming = false;
  }

  // ── Network tab state ──────────────────────────────────────────
  type NetNode = { id: string; title: string; authors: string; doi: string; x: number; y: number; connections: number };
  type NetEdge = { source: string; target: string };

  let networkNodes = $state<NetNode[]>([]);
  let networkEdges = $state<NetEdge[]>([]);
  let networkLoading = $state(false);
  let networkSelectedId = $state<string | null>(null);
  let networkBuilt = $state(false);

  const networkSelectedNode = $derived(networkNodes.find(n => n.id === networkSelectedId) ?? null);

  async function buildNetwork() {
    const corpusPapers = store.pinnedPapers.filter(p => p.doi);
    if (corpusPapers.length < 3) return;

    networkLoading = true;
    networkBuilt = false;
    networkNodes = [];
    networkEdges = [];

    // Build a map of doi → paper
    const doiMap = new Map<string, PaperResult>();
    for (const p of corpusPapers) {
      if (p.doi) doiMap.set(p.doi.toLowerCase(), p);
    }

    const connectionCount = new Map<string, number>();
    const edges: NetEdge[] = [];

    // Fetch references for each paper
    for (const paper of corpusPapers) {
      if (!paper.doi) continue;
      try {
        const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(paper.doi)}`);
        if (!res.ok) continue;
        const data = await res.json();
        const refs: { DOI?: string }[] = data?.message?.reference ?? [];
        for (const ref of refs) {
          if (!ref.DOI) continue;
          const refDoi = ref.DOI.toLowerCase();
          if (doiMap.has(refDoi) && refDoi !== paper.doi.toLowerCase()) {
            const targetPaper = doiMap.get(refDoi)!;
            edges.push({ source: paper.id, target: targetPaper.id });
            connectionCount.set(paper.id, (connectionCount.get(paper.id) ?? 0) + 1);
            connectionCount.set(targetPaper.id, (connectionCount.get(targetPaper.id) ?? 0) + 1);
          }
        }
      } catch { /* continue */ }
    }

    // Create nodes with initial positions in a circle
    const cx = 300; const cy = 220; const radius = 160;
    const nodes: NetNode[] = corpusPapers.map((p, i) => {
      const angle = (i / corpusPapers.length) * 2 * Math.PI;
      return {
        id: p.id,
        title: p.title,
        authors: (p.authors[0] || '') + (p.authors.length > 1 ? ' et al.' : ''),
        doi: p.doi,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        connections: connectionCount.get(p.id) ?? 0,
      };
    });

    // Simple force layout — ~80 iterations
    for (let iter = 0; iter < 80; iter++) {
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 4000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].x += fx * 0.1;
          nodes[i].y += fy * 0.1;
          nodes[j].x -= fx * 0.1;
          nodes[j].y -= fy * 0.1;
        }
      }
      // Attraction along edges
      for (const edge of edges) {
        const src = nodes.find(n => n.id === edge.source);
        const tgt = nodes.find(n => n.id === edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * 0.015;
        src.x += (dx / dist) * force;
        src.y += (dy / dist) * force;
        tgt.x -= (dx / dist) * force;
        tgt.y -= (dy / dist) * force;
      }
      // Center pull
      for (const n of nodes) {
        n.x += (cx - n.x) * 0.008;
        n.y += (cy - n.y) * 0.008;
      }
    }

    // Clamp to visible area
    for (const n of nodes) {
      n.x = Math.max(30, Math.min(570, n.x));
      n.y = Math.max(30, Math.min(410, n.y));
    }

    networkNodes = nodes;
    networkEdges = edges;
    networkBuilt = true;
    networkLoading = false;
  }
  let showPresets = $state(false);
  let savingSearch = $state(false);
  let saveSearchLabel = $state('');
  let showSaveInput = $state(false);

  // ── Paper collections ──────────────────────────────────────────
  let activeCollectionId = $state<string | null>(null);
  let showNewCollection = $state(false);
  let newCollectionLabel = $state('');
  const COLL_COLORS: PaperCollection['color'][] = ['ac', 'gn', 'pu', 'yw', 'enzo', 'rd'];
  let newCollectionColor = $state<PaperCollection['color']>('ac');

  function createCollection() {
    if (!newCollectionLabel.trim()) return;
    const c: PaperCollection = { id: nanoid(), label: newCollectionLabel.trim(), color: newCollectionColor };
    store.paperCollections = [...store.paperCollections, c];
    store.saveResearch();
    newCollectionLabel = ''; showNewCollection = false;
  }

  function deleteCollection(id: string) {
    store.paperCollections = store.paperCollections.filter(c => c.id !== id);
    store.pinnedPapers = store.pinnedPapers.map(p => ({ ...p, collectionIds: (p.collectionIds ?? []).filter(c => c !== id) }));
    if (activeCollectionId === id) activeCollectionId = null;
    store.saveResearch(); store.savePinnedPapers?.();
  }

  function togglePaperCollection(paperId: string, collId: string) {
    store.pinnedPapers = store.pinnedPapers.map(p => {
      if (p.id !== paperId) return p;
      const ids = p.collectionIds ?? [];
      return { ...p, collectionIds: ids.includes(collId) ? ids.filter(c => c !== collId) : [...ids, collId] };
    });
    store.savePinnedPapers?.();
  }

  // ── Reading progress (3-state cycle) ───────────────────────────
  function cycleReadStatus(id: string) {
    store.readingList = store.readingList.map(r => {
      if (r.id !== id) return r;
      const next: Record<string, ReadingListItem['readStatus']> = { unread: 'in-progress', 'in-progress': 'done', done: 'unread' };
      const cur = r.readStatus ?? (r.read ? 'done' : 'unread');
      const ns = next[cur] ?? 'unread';
      return { ...r, readStatus: ns, read: ns === 'done', readAt: ns === 'done' ? Date.now() : r.readAt };
    });
    store.saveResearch();
  }

  // ── Enzo paper compare ─────────────────────────────────────────
  let compareSet = $state<Set<string>>(new Set());
  let compareResult = $state('');
  let compareStreaming = $state(false);
  let compareAbort: AbortController | null = null;
  let showCompare = $state(false);

  function toggleCompare(id: string) {
    const s = new Set(compareSet);
    if (s.has(id)) s.delete(id); else if (s.size < 3) s.add(id);
    compareSet = s;
  }

  async function runCompare() {
    if (compareSet.size < 2) return;
    const papers = [...compareSet].map(id => {
      const item = store.readingList.find(r => r.paper.id === id) ?? store.pinnedPapers.find(p => p.id === id);
      return item && 'paper' in item ? item.paper : item as PaperResult | undefined;
    }).filter(Boolean) as PaperResult[];
    if (papers.length < 2) return;
    compareAbort?.abort();
    compareAbort = new AbortController();
    compareResult = ''; compareStreaming = true; showCompare = true;
    try {
      await comparePapers(papers.map(p => ({ title: p.title, authors: p.authors, year: p.year, journal: p.journal, abstract: p.abstract })), (c) => { compareResult += c; }, compareAbort.signal);
    } catch {}
    finally { compareStreaming = false; }
  }

  // ── Related papers (OpenAlex) ──────────────────────────────────
  let relatedForId = $state<string | null>(null);
  let relatedPapers = $state<PaperResult[]>([]);
  let relatedLoading = $state(false);

  async function fetchRelated(paper: PaperResult) {
    if (relatedForId === paper.id) { relatedForId = null; return; }
    if (!paper.doi) { showToast('No DOI — cannot fetch related papers', 'error'); return; }
    relatedForId = paper.id; relatedLoading = true; relatedPapers = [];
    try {
      // Step 1: get OpenAlex work ID from DOI
      const workRes = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(paper.doi)}?select=id`);
      if (!workRes.ok) throw new Error('work not found');
      const workData = await workRes.json();
      const workId = workData.id?.replace('https://openalex.org/', '');
      if (!workId) throw new Error('no id');
      // Step 2: get papers that cite this one
      const citRes = await fetch(`https://api.openalex.org/works?filter=cites:${workId}&select=id,title,authorships,publication_year,primary_location,doi,open_access&sort=cited_by_count:desc&per_page=8`);
      if (!citRes.ok) throw new Error('cites fetch failed');
      const citData = await citRes.json();
      relatedPapers = (citData.results ?? []).map((w: any) => ({
        id: w.id ?? nanoid(),
        title: w.title ?? 'Untitled',
        authors: (w.authorships ?? []).slice(0, 4).map((a: any) => a.author?.display_name ?? ''),
        abstract: '',
        journal: w.primary_location?.source?.display_name ?? '',
        year: w.publication_year ?? 0,
        doi: w.doi?.replace('https://doi.org/', '') ?? '',
        url: w.doi ? `https://doi.org/${w.doi.replace('https://doi.org/', '')}` : w.id ?? '',
        source: 'openalex' as const,
      }));
    } catch { relatedPapers = []; showToast('Could not fetch related papers', 'error'); }
    finally { relatedLoading = false; }
  }

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

  async function createPaperReviewNote(paper: PaperResult) {
    const authorsStr = paper.authors.join(', ');
    const body = `# Paper Review: ${paper.title}

**Authors:** ${authorsStr}
**Journal:** ${paper.journal} (${paper.year})
**DOI:** ${paper.doi ?? ''}

## Key claims

## Methods

## Strengths

## Limitations

## HGSOC relevance

## Questions raised
- [ ] `;
    const note: Note = {
      id: nanoid(),
      title: `Paper Review: ${paper.title.slice(0, 60)}`,
      body,
      tags: ['paper-review', 'paper', paper.source],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      archived: false,
      audioIds: [],
    };
    store.notes = [note, ...store.notes];
    store.currentNoteId = note.id;
    store.view = 'notes';
    await store.saveNotes();
    showToast('Note created');
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
        <button
          class="tab-btn"
          class:active={researchTab === 'radar'}
          onclick={() => researchTab = 'radar'}
        >
          Radar
        </button>
        <button
          class="tab-btn"
          class:active={researchTab === 'markers'}
          onclick={() => researchTab = 'markers'}
        >
          Markers
        </button>
        <button
          class="tab-btn"
          class:active={researchTab === 'network'}
          onclick={() => researchTab = 'network'}
        >
          Network
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
              <button class="btn-icon" onclick={() => sendToEnzo(paper)} title="Ask Enzo about this [Llama 70B]">
                <span class="text-enzo text-xs" style="font-family:var(--mono);font-weight:700">E</span>
              </button>
              <button
                class="btn-icon critique-btn"
                class:critique-active={critiqueId === paper.id}
                onclick={() => doCritique(paper)}
                title="Enzo peer critique [Llama 70B]"
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
                  title="Deep Read — Enzo asks 5 critical questions [Llama 70B]"
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
                  title="Generate AI reading note [Llama 70B]"
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
                title="AI summary for HGSOC context [GPT-OSS 120B]"
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

  {:else if researchTab === 'reading-list'}
    <!-- Reading list tab -->
    <div class="reading-list">

      <!-- Collections bar -->
      <div class="coll-bar">
        <button class="coll-pill" class:coll-pill-active={activeCollectionId === null} onclick={() => activeCollectionId = null}>All</button>
        {#each store.paperCollections as c}
          <div class="coll-pill-wrap">
            <button class="coll-pill" class:coll-pill-active={activeCollectionId === c.id}
              style="--cc:var(--{c.color})" onclick={() => activeCollectionId = activeCollectionId === c.id ? null : c.id}>
              {c.label}
            </button>
            <button class="coll-del" onclick={() => deleteCollection(c.id)} title="Delete collection">×</button>
          </div>
        {/each}
        {#if showNewCollection}
          <div class="coll-new-form">
            <input class="coll-new-input" bind:value={newCollectionLabel} placeholder="Name…"
              onkeydown={(e) => { if (e.key === 'Enter') createCollection(); if (e.key === 'Escape') showNewCollection = false; }}
              autofocus />
            <div class="coll-color-row">
              {#each COLL_COLORS as col}
                <button class="coll-color-swatch" class:coll-color-active={newCollectionColor === col}
                  style="background:var(--{col})" onclick={() => newCollectionColor = col}></button>
              {/each}
            </div>
            <button class="btn btn-primary btn-sm" onclick={createCollection}>Add</button>
          </div>
        {:else}
          <button class="coll-add-btn btn-link text-xs" onclick={() => showNewCollection = true}>+ collection</button>
        {/if}
      </div>

      <!-- Compare panel -->
      {#if compareSet.size >= 2}
        <div class="compare-bar">
          <span class="text-xs text-mu">{compareSet.size} papers selected</span>
          <button class="btn btn-primary btn-sm" onclick={runCompare} disabled={compareStreaming}>
            {compareStreaming ? '⠿ Comparing…' : 'Compare with Enzo'}
          </button>
          <button class="btn btn-ghost btn-sm" onclick={() => { compareSet = new Set(); showCompare = false; }}>Clear</button>
        </div>
      {/if}
      {#if showCompare}
        <div class="compare-result card">
          <div class="compare-result-head">
            <span class="text-sm font-bold" style="color:var(--enzo)">🐾 Enzo — Paper Comparison</span>
            <button class="btn-icon btn-xs" onclick={() => { showCompare = false; compareResult = ''; }}>×</button>
          </div>
          <div class="compare-body">
            {#if compareStreaming}<span class="text-mu text-xs">Comparing…</span>{:else}{@html marked.parse(compareResult)}{/if}
          </div>
        </div>
      {/if}

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
        {@const visibleItems = activeCollectionId
          ? store.readingList.filter(r => (r.paper.collectionIds ?? []).includes(activeCollectionId!))
          : store.readingList}
        {#each (['high', 'medium', 'low'] as const) as priority}
          {@const grp = visibleItems.filter(r => r.priority === priority)}
          {#if grp.length > 0}
            <div class="rl-group">
              <div class="rl-group-head">
                <span class="rl-priority-dot rl-dot-{priority}"></span>
                <span class="rl-group-label">{priority.charAt(0).toUpperCase() + priority.slice(1)} priority</span>
                <span class="text-xs text-mu">({grp.length})</span>
              </div>
              {#each grp as item (item.id)}
                {@const status = item.readStatus ?? (item.read ? 'done' : 'unread')}
                <div class="rl-item card" class:rl-read={status === 'done'}>
                  <div class="rl-item-head">
                    <!-- 3-state status button -->
                    <button class="rl-status-btn rl-status-{status}" onclick={() => cycleReadStatus(item.id)} title="Cycle status">
                      {#if status === 'done'}✓{:else if status === 'in-progress'}⚡{:else}○{/if}
                    </button>
                    <!-- Compare checkbox -->
                    <input type="checkbox" class="rl-compare-cb" checked={compareSet.has(item.paper.id)}
                      onchange={() => toggleCompare(item.paper.id)} title="Add to compare (max 3)" />
                    <div class="rl-item-meta">
                      <span class="tag {SOURCE_CLS[item.paper.source] || ''}">{SOURCE_LABELS[item.paper.source] || item.paper.source}</span>
                      <span class="text-xs text-mu">{item.paper.journal}</span>
                      {#if item.paper.year > 0}<span class="text-xs text-mu">· {item.paper.year}</span>{/if}
                    </div>
                    <div class="rl-item-actions">
                      <select class="rl-priority-sel" value={item.priority}
                        onchange={(e) => setReadingPriority(item.id, (e.target as HTMLSelectElement).value as 'high' | 'medium' | 'low')}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <!-- Collection assign -->
                      {#if store.paperCollections.length > 0}
                        <select class="rl-priority-sel" title="Add to collection"
                          onchange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) togglePaperCollection(item.paper.id, v); (e.target as HTMLSelectElement).value = ''; }}>
                          <option value="">📁</option>
                          {#each store.paperCollections as c}
                            <option value={c.id} selected={(item.paper.collectionIds ?? []).includes(c.id)}>
                              {(item.paper.collectionIds ?? []).includes(c.id) ? '✓ ' : ''}{c.label}
                            </option>
                          {/each}
                        </select>
                      {/if}
                      {#if item.paper.doi}
                        <a href="https://doi.org/{item.paper.doi}" target="_blank" rel="noreferrer" class="btn-icon" title="Open">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      {:else if item.paper.url}
                        <a href={item.paper.url} target="_blank" rel="noreferrer" class="btn-icon" title="Open">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      {/if}
                      <button class="btn-icon cite-btn" onclick={() => copyCitation(item.paper, 'apa')} title="Copy APA">APA</button>
                      <button class="btn-icon cite-btn" onclick={() => copyCitation(item.paper, 'vancouver')} title="Copy Vancouver">VAN</button>
                      <button class="btn-icon cite-btn" onclick={() => copyCitation(item.paper, 'bibtex')} title="Copy BibTeX">BIB</button>
                      <button class="btn-icon" onclick={() => fetchRelated(item.paper)} title="Find related papers (OpenAlex)"
                        class:active={relatedForId === item.paper.id}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      </button>
                      <button class="btn-icon create-note-btn" onclick={() => createPaperReviewNote(item.paper)} title="Create paper review note">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                      </button>
                      <button class="btn-icon" onclick={() => removeReadingItem(item.id)} title="Remove">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                  <p class="rl-title" class:rl-title-done={status === 'done'}>{item.paper.title}</p>
                  {#if item.paper.authors.length > 0}
                    <p class="text-xs text-mu">{item.paper.authors.slice(0, 4).join(', ')}{item.paper.authors.length > 4 ? ' et al.' : ''} · ~{readingTimeMins(item.paper)} min</p>
                  {/if}
                  <!-- Related papers inline -->
                  {#if relatedForId === item.paper.id}
                    <div class="related-panel">
                      <div class="related-head">
                        <span class="text-xs text-mu">Papers citing this work (OpenAlex)</span>
                        {#if relatedLoading}<span class="related-spin"></span>{/if}
                      </div>
                      {#if !relatedLoading && relatedPapers.length === 0}
                        <p class="text-xs text-mu">No citing papers found.</p>
                      {:else}
                        {#each relatedPapers as rp}
                          <div class="related-item">
                            <span class="related-title">{rp.title}</span>
                            <span class="text-xs text-mu">{rp.authors[0] ?? ''}{rp.year ? ` · ${rp.year}` : ''}</span>
                            <div class="related-actions">
                              {#if rp.doi}<a href="https://doi.org/{rp.doi}" target="_blank" rel="noreferrer" class="btn-link text-xs">Open</a>{/if}
                              <button class="btn-link text-xs" onclick={() => toggleReadingList(rp)}>+ List</button>
                              <button class="btn-link text-xs" onclick={() => togglePin(rp)}>
                                {store.pinnedPapers.some(p => p.id === rp.id) ? 'Pinned' : 'Pin'}
                              </button>
                            </div>
                          </div>
                        {/each}
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      {/if}
    </div>
  {:else if researchTab === 'radar'}
    <!-- ── Radar tab ── -->
    <div class="radar-view">
      <div class="radar-terms-row">
        <span class="source-label">Search terms</span>
        <div class="radar-chips">
          {#each radarTerms as term, i}
            <div class="radar-chip">
              <span>{term}</span>
              <button class="radar-chip-del" onclick={() => radarTerms = radarTerms.filter((_, j) => j !== i)}>×</button>
            </div>
          {/each}
        </div>
        <div class="radar-add-row">
          <input
            class="radar-add-input"
            bind:value={radarNewTerm}
            placeholder="Add term…"
            onkeydown={(e) => { if (e.key === 'Enter' && radarNewTerm.trim()) { radarTerms = [...radarTerms, radarNewTerm.trim()]; radarNewTerm = ''; } }}
          />
          <button class="btn btn-ghost btn-sm" onclick={() => { if (radarNewTerm.trim()) { radarTerms = [...radarTerms, radarNewTerm.trim()]; radarNewTerm = ''; } }}>Add</button>
          <button class="btn btn-primary btn-sm" onclick={radarScan} disabled={radarLoading}>
            {#if radarLoading}<span class="spinner-xs"></span> Scanning…{:else}Scan PubMed{/if}
          </button>
        </div>
      </div>

      {#if !radarScanned}
        <div class="radar-examples">
          <p class="text-xs text-mu example-label-row">· example results — press Scan PubMed to see live papers</p>
          {#each RADAR_EXAMPLES as card}
            <div class="radar-card card radar-card-example">
              <div class="radar-card-head">
                <span class="example-paper-badge text-xs">example</span>
                <span class="text-xs text-mu">{card.journal} · {card.year}</span>
              </div>
              <p class="radar-card-title">{card.title}</p>
              <p class="text-xs text-mu">{card.authors}</p>
              <p class="text-sm radar-card-abstract">{card.abstract.slice(0, 180)}…</p>
            </div>
          {/each}
        </div>
      {:else}
        <div class="radar-results">
          {#if radarResults.length === 0}
            <div class="empty-state"><p class="text-mu">No new papers found — all results may already be in your corpus.</p></div>
          {:else}
            {#each radarResults as card (card.pmid)}
              <div class="radar-card card">
                <div class="radar-card-head">
                  <div class="radar-card-meta">
                    <span class="tag tag-ac">PubMed</span>
                    <span class="text-xs text-mu">{card.journal}</span>
                    {#if card.year > 0}<span class="text-xs text-mu">· {card.year}</span>{/if}
                  </div>
                  <button
                    class="btn btn-sm {card.added ? 'btn-ghost' : 'btn-primary'}"
                    disabled={card.added}
                    onclick={() => radarAddToCorpus(card)}
                  >
                    {card.added ? 'Added' : 'Add to corpus'}
                  </button>
                </div>
                <p class="radar-card-title">{card.title}</p>
                <p class="text-xs text-mu">{card.authors}</p>
                {#if card.abstract}
                  <p class="text-sm radar-card-abstract">{card.abstract.slice(0, 200)}…</p>
                {/if}
              </div>
            {/each}
          {/if}
        </div>

        <!-- Enzo Digest -->
        {#if radarResults.length > 0}
          <div class="radar-digest card">
            <div class="radar-digest-head">
              <span class="summary-label" style="color:var(--enzo)">Enzo Digest</span>
              <button
                class="btn btn-sm btn-enzo"
                onclick={radarSummarise}
                disabled={radarDigestStreaming}
              >
                {#if radarDigestStreaming}<span class="spinner-xs"></span> Summarising…{:else}Summarise new papers<span class="model-pill">[70B]</span>{/if}
              </button>
              {#if radarDigest && !radarDigestStreaming}
                <button class="btn btn-ghost btn-sm" onclick={() => navigator.clipboard.writeText(radarDigest).then(() => showToast('Copied'))}>Copy</button>
              {/if}
            </div>
            {#if radarDigest}
              <div class="summary-body text-sm">{radarDigest}</div>
            {:else if !radarDigestStreaming}
              <p class="text-sm text-mu">Click "Summarise new papers" to get Enzo's synthesis of what's new.</p>
            {/if}
          </div>
        {/if}
      {/if}
    </div>

  {:else if researchTab === 'markers'}
    <!-- ── Markers tab ── -->
    <div class="markers-view">
      <div class="markers-search-row">
        <input
          class="markers-input"
          bind:value={markerQuery}
          placeholder="Search gene symbol (e.g. CD8A, FOXP3, FOLR1)…"
          onkeydown={(e) => { if (e.key === 'Enter' && markerQuery.trim()) askMarkerEnzo(markerQuery.trim()); }}
        />
        <button
          class="btn btn-primary btn-sm"
          onclick={() => askMarkerEnzo(markerQuery.trim())}
          disabled={!markerQuery.trim() || markerEnzoStreaming}
        >
          {#if markerEnzoStreaming}<span class="spinner-xs"></span>{:else}Ask Enzo<span class="model-pill">[70B]</span>{/if}
        </button>
      </div>

      {#if markerMatches.length > 0}
        <div class="marker-matches">
          {#each markerMatches as m}
            <button class="marker-match-chip" onclick={() => { markerQuery = m.gene; askMarkerEnzo(m.gene); }}>
              <span class="marker-gene">{m.gene}</span>
              <span class="marker-cell-types text-xs">{m.cellTypes.join(', ')}</span>
              <span class="marker-relevance text-xs text-mu">{m.hgsocRelevance}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if markerEnzoText || markerEnzoStreaming}
        <div class="marker-enzo-box card">
          <div class="summary-header">
            <span class="summary-label" style="color:var(--enzo)">Enzo · {markerQuery || 'Gene'} in HGSOC TME</span>
            {#if markerEnzoStreaming}
              <span class="spinner-xs"></span>
            {:else}
              <button class="btn-link" onclick={() => { markerEnzoAbort?.abort(); markerEnzoStreaming = false; navigator.clipboard.writeText(markerEnzoText).then(() => showToast('Copied')); }}>Copy</button>
              <button class="btn-link" onclick={() => { markerEnzoText = ''; }}>Clear</button>
            {/if}
          </div>
          <div class="summary-body text-sm">{markerEnzoText}</div>
        </div>
      {/if}

      <!-- Marker table -->
      <div class="marker-table card">
        <div class="marker-table-head">
          <span class="source-label">HGSOC Marker Database ({MARKER_DB.length} entries)</span>
        </div>
        <div class="marker-table-body">
          {#each MARKER_DB as m}
            <button
              class="marker-row"
              class:marker-row-active={markerQuery.toLowerCase() === m.gene.toLowerCase()}
              onclick={() => { markerQuery = m.gene; askMarkerEnzo(m.gene); }}
            >
              <span class="marker-gene-col">{m.gene}</span>
              <span class="marker-cells-col text-xs text-mu">{m.cellTypes.join(', ')}</span>
              <span class="marker-role-col text-xs">{m.role}</span>
              <span class="marker-hgsoc-col text-xs text-mu">{m.hgsocRelevance}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

  {:else if researchTab === 'network'}
    <!-- ── Network tab ── -->
    <div class="network-view">
      {#if store.pinnedPapers.filter(p => p.doi).length < 3}
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--mu)" stroke-width="1.2" opacity="0.5">
            <circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/>
            <line x1="9" y1="11" x2="15" y2="7"/><line x1="9" y1="13" x2="15" y2="17"/>
          </svg>
          <p class="text-mu text-sm">Add at least 3 papers with DOIs to your research corpus (via pin) to build a citation network.</p>
        </div>
      {:else}
        <div class="network-toolbar">
          <span class="text-sm text-mu">{store.pinnedPapers.filter(p => p.doi).length} papers in corpus</span>
          <button class="btn btn-primary btn-sm" onclick={buildNetwork} disabled={networkLoading}>
            {#if networkLoading}<span class="spinner-xs"></span> Building…{:else}Build Network{/if}
          </button>
          {#if networkBuilt}
            <span class="text-xs text-mu">{networkEdges.length} citation link{networkEdges.length !== 1 ? 's' : ''} found</span>
          {/if}
        </div>

        {#if networkBuilt}
          <div class="network-body">
            <div class="network-svg-wrap">
              <svg viewBox="0 0 600 440" class="network-svg">
                <!-- Edges -->
                {#each networkEdges as edge}
                  {@const src = networkNodes.find(n => n.id === edge.source)}
                  {@const tgt = networkNodes.find(n => n.id === edge.target)}
                  {#if src && tgt}
                    <line
                      x1={src.x} y1={src.y}
                      x2={tgt.x} y2={tgt.y}
                      stroke="var(--bd2)"
                      stroke-width="1.5"
                      opacity="0.6"
                    />
                  {/if}
                {/each}
                <!-- Nodes -->
                {#each networkNodes as node}
                  {@const r = 8 + Math.min(node.connections * 3, 14)}
                  {@const fill = node.connections > 2 ? 'var(--enzo)' : 'var(--ac)'}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <g
                    role="button"
                    tabindex="0"
                    onclick={() => networkSelectedId = networkSelectedId === node.id ? null : node.id}
                    onkeydown={(e) => e.key === 'Enter' && (networkSelectedId = networkSelectedId === node.id ? null : node.id)}
                    class="net-node-g"
                  >
                    <circle
                      cx={node.x} cy={node.y} r={r}
                      fill={fill}
                      opacity={networkSelectedId && networkSelectedId !== node.id ? 0.4 : 0.9}
                      stroke={networkSelectedId === node.id ? 'var(--tx)' : 'transparent'}
                      stroke-width="2"
                    />
                    <text
                      x={node.x} y={node.y + r + 10}
                      text-anchor="middle"
                      font-size="9"
                      fill="var(--tx2)"
                      class="net-label"
                    >{node.title.slice(0, 22)}{node.title.length > 22 ? '…' : ''}</text>
                  </g>
                {/each}
              </svg>
            </div>

            {#if networkSelectedNode}
              <div class="network-detail card">
                <div class="network-detail-head">
                  <span class="source-label">Selected paper</span>
                  <button class="btn-link" onclick={() => networkSelectedId = null}>Clear</button>
                </div>
                <p class="network-detail-title">{networkSelectedNode.title}</p>
                <p class="text-xs text-mu">{networkSelectedNode.authors}</p>
                <p class="text-xs" style="color:var(--ac)">
                  {networkSelectedNode.connections} citation link{networkSelectedNode.connections !== 1 ? 's' : ''} within corpus
                </p>
                {#if networkSelectedNode.doi}
                  <a href="https://doi.org/{networkSelectedNode.doi}" target="_blank" rel="noreferrer" class="btn-link text-xs">
                    Open paper →
                  </a>
                {/if}
              </div>
            {:else}
              <div class="network-hint">
                <p class="text-xs text-mu">Click a node to see paper details. Larger nodes = more cited within corpus. Purple nodes have &gt;2 connections.</p>
              </div>
            {/if}
          </div>
        {/if}
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

  .create-note-btn { color: var(--mu); }
  .create-note-btn:hover { color: var(--gn); background: var(--gn-bg); }

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

  /* ── Radar tab ─────────────────────────────────────────────────── */
  .radar-view { display: flex; flex-direction: column; gap: 14px; }
  .radar-terms-row { display: flex; flex-direction: column; gap: 8px; }
  .radar-chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .radar-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 20px; font-size: 0.78rem; font-weight: 500;
    background: var(--enzo-bg); border: 1px solid var(--enzo-bd); color: var(--enzo);
  }
  .radar-chip-del {
    background: transparent; border: none; color: var(--enzo); cursor: pointer;
    font-size: 0.9rem; line-height: 1; padding: 0; opacity: 0.6;
  }
  .radar-chip-del:hover { opacity: 1; }
  .radar-add-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .radar-add-input { flex: 1; min-width: 140px; font-size: 0.82rem; }
  .radar-examples, .radar-results { display: flex; flex-direction: column; gap: 10px; }
  .radar-card { display: flex; flex-direction: column; gap: 6px; }
  .radar-card-example { opacity: 0.65; }
  .radar-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .radar-card-meta { display: flex; align-items: center; gap: 6px; }
  .radar-card-title { font-size: 0.88rem; font-weight: 600; color: var(--tx); line-height: 1.4; margin: 0; }
  .radar-card-abstract { color: var(--tx2); line-height: 1.6; margin: 0; }
  .radar-digest { display: flex; flex-direction: column; gap: 10px; background: var(--enzo-bg); border-color: var(--enzo-bd); }
  .radar-digest-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .btn-enzo {
    background: var(--enzo-bg);
    color: var(--enzo);
    border: 1px solid var(--enzo-bd, rgba(168,85,247,0.2));
    font-size: 0.78rem;
    display: flex; align-items: center; gap: 5px;
  }
  .btn-enzo:hover:not(:disabled) { background: rgba(168,85,247,0.2); }
  .btn-enzo:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Markers tab ───────────────────────────────────────────────── */
  .markers-view { display: flex; flex-direction: column; gap: 14px; }
  .markers-search-row { display: flex; gap: 8px; align-items: center; }
  .markers-input { flex: 1; font-size: 0.85rem; }
  .marker-matches { display: flex; flex-direction: column; gap: 4px; }
  .marker-match-chip {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 12px; border-radius: var(--radius-sm);
    background: var(--sf2); border: 1px solid var(--bd);
    cursor: pointer; text-align: left; transition: all var(--transition);
  }
  .marker-match-chip:hover { border-color: var(--enzo); background: var(--enzo-bg); }
  .marker-gene { font-size: 0.88rem; font-weight: 700; font-family: var(--mono); color: var(--tx); min-width: 60px; }
  .marker-cell-types { min-width: 120px; }
  .marker-relevance { flex: 1; }
  .marker-enzo-box { padding: 14px; background: var(--enzo-bg); border-color: var(--enzo-bd); }
  .marker-table { overflow: hidden; }
  .marker-table-head { padding: 10px 14px; border-bottom: 1px solid var(--bd); }
  .marker-table-body { display: flex; flex-direction: column; max-height: 360px; overflow-y: auto; }
  .marker-row {
    display: grid;
    grid-template-columns: 80px 140px 1fr 1fr;
    gap: 8px;
    padding: 7px 14px;
    border-bottom: 1px solid var(--bd);
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background var(--transition);
  }
  .marker-row:hover { background: var(--sf2); }
  .marker-row-active { background: var(--enzo-bg) !important; }
  .marker-gene-col { font-weight: 700; font-family: var(--mono); font-size: 0.82rem; color: var(--enzo); }
  .marker-cells-col, .marker-role-col, .marker-hgsoc-col { align-self: center; }

  /* ── Network tab ───────────────────────────────────────────────── */
  .network-view { display: flex; flex-direction: column; gap: 14px; }
  .network-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .network-body { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
  .network-svg-wrap {
    flex: 1; min-width: 300px;
    border: 1px solid var(--bd); border-radius: var(--radius);
    background: var(--sf); overflow: hidden;
  }
  .network-svg { width: 100%; display: block; }
  .net-node-g { cursor: pointer; }
  .net-label { pointer-events: none; }
  .network-detail { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; }
  .network-detail-head { display: flex; align-items: center; justify-content: space-between; }
  .network-detail-title { font-size: 0.85rem; font-weight: 600; color: var(--tx); line-height: 1.4; margin: 0; }
  .network-hint { padding: 10px 0; }
  .tag-ac { background: var(--ac-bg); color: var(--ac); border: 1px solid var(--ac); border-radius: 10px; padding: 1px 7px; font-size: 0.7rem; font-weight: 700; }

  /* ── Paper collections ───────────────────────────────────────── */
  .coll-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .coll-pill {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 3px 10px; border-radius: 20px; font-size: 0.76rem; font-weight: 600;
    background: var(--sf2); border: 1px solid var(--bd); color: var(--tx2);
    cursor: pointer; transition: all var(--transition);
  }
  .coll-pill:hover { border-color: var(--cc, var(--ac)); color: var(--cc, var(--ac)); background: color-mix(in srgb, var(--cc, var(--ac)) 10%, transparent); }
  .coll-pill.coll-pill-active { background: color-mix(in srgb, var(--cc, var(--ac)) 15%, transparent); border-color: var(--cc, var(--ac)); color: var(--cc, var(--ac)); }
  .coll-pill-wrap { display: inline-flex; align-items: center; gap: 1px; }
  .coll-del {
    background: transparent; border: none; color: var(--mu); cursor: pointer;
    font-size: 1rem; line-height: 1; padding: 2px 4px; border-radius: 3px; opacity: 0.5;
  }
  .coll-del:hover { opacity: 1; color: var(--rd); }
  .coll-new-form { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .coll-new-input { font-size: 0.8rem; padding: 3px 8px; width: 120px; }
  .coll-color-row { display: flex; gap: 4px; }
  .coll-color-swatch {
    width: 14px; height: 14px; border-radius: 50%; border: 2px solid transparent; cursor: pointer;
  }
  .coll-color-swatch.coll-color-active { border-color: var(--tx); }
  .coll-add-btn { font-size: 0.76rem; padding: 3px 8px; }

  /* ── Compare ─────────────────────────────────────────────────── */
  .compare-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; background: var(--enzo-bg); border: 1px solid var(--enzo-bd);
    border-radius: var(--radius); flex-wrap: wrap;
  }
  .compare-result { display: flex; flex-direction: column; gap: 10px; border-color: var(--enzo-bd); }
  .compare-result-head { display: flex; align-items: center; justify-content: space-between; }
  .compare-body { font-size: 0.83rem; line-height: 1.7; color: var(--tx2); overflow-x: auto; }
  .compare-body table { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
  .compare-body th { padding: 6px 10px; background: var(--sf2); border: 1px solid var(--bd); font-weight: 700; text-align: left; }
  .compare-body td { padding: 6px 10px; border: 1px solid var(--bd); vertical-align: top; }

  /* ── 3-state status button ───────────────────────────────────── */
  .rl-status-btn {
    width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--bd);
    background: var(--sf2); display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; cursor: pointer; flex-shrink: 0; transition: all var(--transition);
  }
  .rl-status-unread { border-color: var(--bd2); color: var(--mu); }
  .rl-status-in-progress { border-color: var(--yw); background: var(--yw-bg, color-mix(in srgb, var(--yw) 12%, transparent)); color: var(--yw); }
  .rl-status-done { border-color: var(--gn); background: var(--gn-bg, color-mix(in srgb, var(--gn) 12%, transparent)); color: var(--gn); }

  /* ── Compare checkbox ────────────────────────────────────────── */
  .rl-compare-cb { accent-color: var(--enzo); cursor: pointer; flex-shrink: 0; }

  /* ── Related papers panel ────────────────────────────────────── */
  .related-panel {
    margin-top: 6px; padding: 10px 12px;
    background: var(--sf2); border: 1px solid var(--bd);
    border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 8px;
  }
  .related-head { display: flex; align-items: center; gap: 8px; }
  .related-spin {
    display: inline-block; width: 10px; height: 10px;
    border: 1.5px solid var(--bd2); border-top-color: var(--ac);
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  .related-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-bottom: 1px solid var(--bd); }
  .related-item:last-child { border-bottom: none; }
  .related-title { font-size: 0.82rem; font-weight: 600; color: var(--tx); line-height: 1.4; }
  .related-actions { display: flex; gap: 4px; margin-top: 3px; }
</style>
