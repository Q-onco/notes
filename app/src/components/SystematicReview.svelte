<script lang="ts">
  import type { SystematicReview, SRPaper, SRDecision, SRExtractionField } from '../lib/types';
  import { store } from '../lib/store.svelte';
  import { srScreenPaper, srExtractPaper, srDraftSection } from '../lib/groq';
  import { searchPubMed, searchOpenAlex, searchEuropePMC } from '../lib/pubmed';
  import type { PaperResult } from '../lib/types';
  import { nanoid } from 'nanoid';
  import { marked } from 'marked';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── Default extraction fields (HGSOC-relevant) ────────────────────────────
  const DEFAULT_FIELDS: SRExtractionField[] = [
    { id: 'study_design',    label: 'Study Design' },
    { id: 'sample_size',     label: 'Sample Size / N' },
    { id: 'population',      label: 'Population / Model' },
    { id: 'intervention',    label: 'Intervention' },
    { id: 'comparator',      label: 'Comparator / Control' },
    { id: 'primary_outcome', label: 'Primary Outcome' },
    { id: 'main_result',     label: 'Main Result / Finding' },
    { id: 'effect_size',     label: 'Effect Size / HR / OR / p-value' },
    { id: 'follow_up',       label: 'Follow-up Duration' },
    { id: 'limitations',     label: 'Key Limitations' },
    { id: 'conclusion',      label: 'Author Conclusion' },
  ];

  // ── HGSOC example review (shown when store is empty) ─────────────────────
  const EXAMPLE: SystematicReview = {
    id: '__example__',
    title: 'PARPi Resistance Mechanisms in High-Grade Serous Ovarian Cancer: A Systematic Review',
    pico: {
      population: 'Patients with HGSOC or BRCA-mutated ovarian cancer',
      intervention: 'PARP inhibitor therapy (olaparib, niraparib, rucaparib, veliparib)',
      comparator: 'Placebo, standard chemotherapy, or other treatment arms',
      outcome: 'PARPi resistance mechanisms, progression-free survival, biomarkers of resistance',
      studyDesign: 'RCTs, cohort studies, translational studies, in vitro / in vivo mechanistic studies',
    },
    inclusion: [
      'HGSOC or germline/somatic BRCA1/2-mutated ovarian cancer',
      'PARP inhibitor treatment or mechanistic study of PARPi resistance',
      'Published 2015 or later in peer-reviewed journal',
      'English language',
    ],
    exclusion: [
      'Non-ovarian cancer primary (unless directly comparing to HGSOC)',
      'Conference abstracts without full text',
      'Review articles and editorials',
      'Animal studies without clinical correlate',
    ],
    extractionFields: DEFAULT_FIELDS,
    papers: [
      {
        id: 'ex1', title: 'Olaparib maintenance therapy in platinum-sensitive relapsed BRCA-mutated ovarian cancer', authors: ['Ledermann J', 'Harter P', 'Gourley C'], year: 2014, journal: 'NEJM', abstract: 'In this phase 2 randomised study, olaparib maintenance therapy significantly improved progression-free survival (8.4 vs 4.8 months; HR 0.35) in patients with BRCA1/2-mutated platinum-sensitive relapsed ovarian cancer. Adverse events were manageable.', doi: '10.1056/nejmoa1402451', source: 'pubmed',
        s1Decision: 'include', s1EnzoSuggestion: 'include', s1EnzoReason: 'RCT in BRCA-mutated ovarian cancer with PARPi, matches all inclusion criteria',
        s2Decision: 'include',
        extraction: { study_design: 'Phase 2 RCT', sample_size: 'N=265', population: 'BRCA1/2-mutated platinum-sensitive relapsed OC', intervention: 'Olaparib 400mg BID maintenance', comparator: 'Placebo', primary_outcome: 'Progression-free survival', main_result: 'PFS 8.4 vs 4.8 months', effect_size: 'HR 0.35 (95% CI 0.25–0.49); p<0.001', follow_up: 'Median 36 months', limitations: 'Phase 2, unblinded investigators', conclusion: 'Olaparib significantly improves PFS in BRCA-mutated OC' }
      },
      {
        id: 'ex2', title: 'Rucaparib in relapsed, platinum-sensitive high-grade ovarian carcinoma', authors: ['Swisher EM', 'Lin KK', 'Oza AM'], year: 2017, journal: 'Lancet Oncology', abstract: 'ARIEL2 Part 1 prospectively identified genomic LOH as a predictive biomarker for rucaparib response in HGSOC. Patients with BRCA mutations or high genomic LOH showed the greatest benefit (PFS 12.8 months), while LOH-low tumours had limited benefit (PFS 5.7 months), suggesting genomic scarring as a biomarker beyond BRCA status.', doi: '10.1016/S1470-2045(16)30559-9', source: 'pubmed',
        s1Decision: 'include', s1EnzoSuggestion: 'include', s1EnzoReason: 'Translational study identifying LOH as PARPi biomarker in HGSOC',
        s2Decision: 'include',
        extraction: { study_design: 'Phase 2 biomarker study (ARIEL2)', sample_size: 'N=204', population: 'Relapsed HGSOC', intervention: 'Rucaparib 600mg BID', comparator: 'None (single arm)', primary_outcome: 'PFS by genomic LOH subgroup', main_result: 'BRCA/high-LOH PFS 12.8m vs LOH-low 5.7m', effect_size: 'HR 0.27 (BRCA vs LOH-low)', follow_up: 'Median 14 months', limitations: 'Single arm, retrospective LOH analysis', conclusion: 'Genomic LOH identifies PARPi-sensitive HGSOC beyond BRCA status' }
      },
      {
        id: 'ex3', title: 'Restoration of BRCA1/2 function as a resistance mechanism to PARPi in ovarian cancer', authors: ['Sakai W', 'Swisher EM', 'Karlan BY'], year: 2008, journal: 'Nature', abstract: 'This landmark study identified secondary intragenic mutations that restore BRCA2 reading frame as a major mechanism of acquired PARPi resistance in ovarian cancer cell lines and patient tumours. Restoration of BRCA2 function rescued HR capacity and conferred cisplatin cross-resistance.', doi: '10.1038/nature06633', source: 'pubmed',
        s1Decision: 'include', s1EnzoSuggestion: 'include', s1EnzoReason: 'Mechanistic study directly identifying PARPi resistance mechanism in OC',
        s2Decision: 'include',
        extraction: { study_design: 'In vitro + patient tumour analysis', sample_size: 'N=6 cell lines + 22 patient samples', population: 'BRCA2-mutated OC cell lines and patient tumours', intervention: 'Carboplatin / cisplatin treatment', comparator: 'Sensitive vs resistant cells', primary_outcome: 'BRCA2 reversion mutation frequency', main_result: 'Secondary BRCA2 mutations restore HR in resistant tumours', effect_size: 'Reversion in 6/22 resistant samples (27%)', follow_up: 'N/A (in vitro)', limitations: 'Largely in vitro, limited patient numbers', conclusion: 'BRCA2 reversion is a primary mechanism of acquired PARPi/platinum resistance' }
      },
      {
        id: 'ex4', title: 'Niraparib in patients with newly diagnosed advanced ovarian cancer', authors: ['González-Martín A', 'Pothuri B', 'Vergote I'], year: 2019, journal: 'NEJM', abstract: 'PRIMA trial: niraparib maintenance in newly diagnosed advanced ovarian cancer after platinum-based chemotherapy. In homologous recombination-deficient (HRD) patients, PFS was 21.9 vs 10.4 months with placebo (HR 0.43). The overall population also benefited (13.8 vs 8.2 months). HRD status was the strongest predictor of benefit.', doi: '10.1056/NEJMoa1900244', source: 'pubmed',
        s1Decision: 'include', s1EnzoSuggestion: 'include', s1EnzoReason: 'Phase 3 RCT in newly diagnosed OC with niraparib, HRD biomarker analysis',
        s2Decision: 'include',
        extraction: { study_design: 'Phase 3 RCT (PRIMA)', sample_size: 'N=733', population: 'Newly diagnosed advanced OC (all comers + HRD subgroup)', intervention: 'Niraparib 300mg/200mg QD maintenance', comparator: 'Placebo', primary_outcome: 'PFS in HRD population then overall', main_result: 'HRD: 21.9 vs 10.4m; Overall: 13.8 vs 8.2m', effect_size: 'HR 0.43 (HRD); 0.62 (overall)', follow_up: 'Median 13.8 months', limitations: 'No OS data yet, cross-resistance with later lines unclear', conclusion: 'Niraparib maintenance benefits newly diagnosed OC; HRD status enriches benefit' }
      },
    ],
    searches: [
      { source: 'PubMed', query: 'PARP inhibitor resistance HGSOC ovarian cancer BRCA', date: Date.now() - 86400000 * 2, count: 156 },
      { source: 'OpenAlex', query: 'PARP inhibitor resistance high-grade serous ovarian', date: Date.now() - 86400000 * 2, count: 98 },
    ],
    stage: 'extraction',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000,
  };

  // ── Navigation state ────────────────────────────────────────────────────
  let openId = $state<string | null>(null);
  let tab = $state<'protocol' | 'search' | 'screening' | 'fulltext' | 'extraction' | 'synthesis'>('protocol');
  let showNewForm = $state(false);

  // New review form
  let draftTitle = $state('');
  let draftP = $state(''); let draftI = $state(''); let draftC = $state(''); let draftO = $state(''); let draftSD = $state('');
  let draftInc = $state<string[]>(['']);
  let draftExc = $state<string[]>(['']);

  // ── Search tab ──────────────────────────────────────────────────────────
  let searchSource = $state<'pubmed' | 'openalex' | 'europepmc'>('pubmed');
  let searchQuery = $state('');
  let searchResults = $state<SRPaper[]>([]);
  let searchLoading = $state(false);
  let searchCount = $state(0);

  // ── Screening tab ───────────────────────────────────────────────────────
  let screenFilter = $state<'all' | 'unscreened' | 'include' | 'exclude' | 'uncertain'>('unscreened');
  let screenCardIdx = $state(0);
  let screenMode = $state<'s1' | 's2'>('s1');
  let enzoScreening = $state(false);
  let enzoScreenIdx = $state(0);
  let enzoScreenAbort: AbortController | null = null;
  let screenSearch = $state('');

  // ── Extraction tab ──────────────────────────────────────────────────────
  let extractPaperId = $state<string | null>(null);
  let extractDraft = $state<Record<string, string>>({});
  let enzoExtracting = $state(false);
  let extractAbort: AbortController | null = null;
  let newFieldLabel = $state('');

  // ── Synthesis tab ───────────────────────────────────────────────────────
  let draftMode = $state<'methods' | 'results' | null>(null);
  let draftText = $state('');
  let draftLoading = $state(false);
  let draftAbort: AbortController | null = null;

  // ── Auto-save ───────────────────────────────────────────────────────────
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.saveSysReviews().catch(() => {}), 1200);
  }

  // ── Computed ────────────────────────────────────────────────────────────
  const allReviews = $derived(store.sysReviews);

  const openReview = $derived(
    openId === '__example__' ? EXAMPLE :
    store.sysReviews.find(r => r.id === openId) ?? null
  );

  const isExample = $derived(openId === '__example__');

  const prismaNumbers = $derived.by(() => {
    if (!openReview) return null;
    const papers = openReview.papers;
    const identified = openReview.searches.reduce((s, q) => s + q.count, 0) || papers.length;
    const deduped = papers.length;
    const s1done = papers.filter(p => p.s1Decision).length;
    const included1 = papers.filter(p => p.s1Decision === 'include').length;
    const excluded1 = papers.filter(p => p.s1Decision === 'exclude').length;
    const fulltext = included1;
    const included2 = papers.filter(p => p.s2Decision === 'include').length;
    const excluded2 = papers.filter(p => p.s2Decision === 'exclude').length;
    return { identified, deduped, screened: deduped, excluded1, fulltext, excluded2, included: included2 || included1 };
  });

  const screeningList = $derived.by((): SRPaper[] => {
    if (!openReview) return [];
    const papers = screenMode === 's1'
      ? openReview.papers
      : openReview.papers.filter(p => p.s1Decision === 'include');
    const filtered = screenFilter === 'all' ? papers
      : screenFilter === 'unscreened'
        ? papers.filter(p => screenMode === 's1' ? !p.s1Decision : !p.s2Decision)
        : screenFilter === 'include'
          ? papers.filter(p => (screenMode === 's1' ? p.s1Decision : p.s2Decision) === 'include')
          : screenFilter === 'exclude'
            ? papers.filter(p => (screenMode === 's1' ? p.s1Decision : p.s2Decision) === 'exclude')
            : papers.filter(p => (screenMode === 's1' ? p.s1Decision : p.s2Decision) === 'uncertain');
    if (!screenSearch.trim()) return filtered;
    const q = screenSearch.toLowerCase();
    return filtered.filter(p => p.title.toLowerCase().includes(q) || p.abstract?.toLowerCase().includes(q));
  });

  const currentCard = $derived(screeningList[screenCardIdx] ?? null);

  const includedPapers = $derived(
    (openReview?.papers ?? []).filter(p => p.s2Decision === 'include' || (p.s1Decision === 'include' && !openReview?.papers.some(x => x.id === p.id && x.s2Decision)))
      .filter(p => p.s1Decision === 'include')
  );

  const extractPaper = $derived(
    openReview?.papers.find(p => p.id === extractPaperId) ?? null
  );

  // ── Review management ───────────────────────────────────────────────────
  function createReview() {
    if (!draftTitle.trim()) return;
    const review: SystematicReview = {
      id: nanoid(),
      title: draftTitle.trim(),
      pico: { population: draftP, intervention: draftI, comparator: draftC, outcome: draftO, studyDesign: draftSD },
      inclusion: draftInc.filter(s => s.trim()),
      exclusion: draftExc.filter(s => s.trim()),
      extractionFields: [...DEFAULT_FIELDS],
      papers: [],
      searches: [],
      stage: 'protocol',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    store.sysReviews = [review, ...store.sysReviews];
    store.saveSysReviews().catch(() => {});
    openId = review.id;
    tab = 'protocol';
    showNewForm = false;
    draftTitle = ''; draftP = ''; draftI = ''; draftC = ''; draftO = ''; draftSD = '';
    draftInc = ['']; draftExc = [''];
  }

  function deleteReview(id: string) {
    store.sysReviews = store.sysReviews.filter(r => r.id !== id);
    store.saveSysReviews().catch(() => {});
    if (openId === id) openId = null;
  }

  function updateReview(fn: (r: SystematicReview) => void) {
    if (!openId || isExample) return;
    const idx = store.sysReviews.findIndex(r => r.id === openId);
    if (idx < 0) return;
    fn(store.sysReviews[idx]);
    store.sysReviews[idx].updatedAt = Date.now();
    scheduleSave();
  }

  // ── Search ─────────────────────────────────────────────────────────────
  async function runSearch() {
    if (!searchQuery.trim()) return;
    searchLoading = true;
    searchResults = [];
    try {
      let results: PaperResult[] = [];
      if (searchSource === 'pubmed') results = await searchPubMed(searchQuery, 50);
      else if (searchSource === 'openalex') results = await searchOpenAlex(searchQuery, 50);
      else results = await searchEuropePMC(searchQuery, 50);
      searchResults = results.map(p => ({
        id: nanoid(), title: p.title, authors: p.authors, year: p.year,
        journal: p.journal, abstract: p.abstract, doi: p.doi, source: p.source,
      }));
      searchCount = searchResults.length;
    } catch (e) {
      showToast('Search failed', 'error');
    } finally { searchLoading = false; }
  }

  function importToPool() {
    if (!openId || isExample || !searchResults.length) return;
    updateReview(r => {
      const existingDOIs = new Set(r.papers.map(p => p.doi).filter(Boolean));
      const existingTitles = new Set(r.papers.map(p => normaliseTitle(p.title)));
      const toAdd = searchResults.filter(p => {
        if (p.doi && existingDOIs.has(p.doi)) return false;
        if (existingTitles.has(normaliseTitle(p.title))) return false;
        return true;
      });
      r.papers.push(...toAdd);
      r.searches.push({ source: searchSource, query: searchQuery, date: Date.now(), count: searchResults.length });
      showToast(`${toAdd.length} papers added (${searchResults.length - toAdd.length} duplicates removed)`);
    });
    searchResults = [];
    searchQuery = '';
  }

  function normaliseTitle(t: string): string {
    return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  // ── Screening ───────────────────────────────────────────────────────────
  function setDecision(paperId: string, decision: SRDecision, reason = '') {
    updateReview(r => {
      const p = r.papers.find(x => x.id === paperId);
      if (!p) return;
      if (screenMode === 's1') { p.s1Decision = decision; if (reason) p.s1Reason = reason; }
      else { p.s2Decision = decision; if (reason) p.s2Reason = reason; }
    });
    // advance card
    const nextIdx = screeningList.findIndex((p, i) => i > screenCardIdx && (screenMode === 's1' ? !p.s1Decision : !p.s2Decision));
    screenCardIdx = nextIdx >= 0 ? nextIdx : Math.min(screenCardIdx, screeningList.length - 1);
  }

  async function enzoScreenAll() {
    if (!openReview || enzoScreening || isExample) return;
    const unscreened = openReview.papers.filter(p => screenMode === 's1' ? !p.s1Decision : (p.s1Decision === 'include' && !p.s2Decision));
    if (!unscreened.length) { showToast('All papers already screened'); return; }
    enzoScreenAbort?.abort();
    enzoScreenAbort = new AbortController();
    enzoScreening = true;
    enzoScreenIdx = 0;
    for (let i = 0; i < unscreened.length; i++) {
      if (enzoScreenAbort.signal.aborted) break;
      enzoScreenIdx = i + 1;
      const paper = unscreened[i];
      const result = await srScreenPaper(paper, openReview.inclusion, openReview.exclusion, enzoScreenAbort.signal);
      updateReview(r => {
        const p = r.papers.find(x => x.id === paper.id);
        if (!p) return;
        if (screenMode === 's1') {
          p.s1EnzoSuggestion = result.decision;
          p.s1EnzoReason = result.reason;
          if (!p.s1Decision) { p.s1Decision = result.decision; p.s1Reason = `Enzo: ${result.reason}`; }
        } else {
          if (!p.s2Decision) { p.s2Decision = result.decision; p.s2Reason = `Enzo: ${result.reason}`; }
        }
      });
    }
    enzoScreening = false;
    showToast(`Enzo screened ${Math.min(enzoScreenIdx, unscreened.length)} papers`);
  }

  // ── Extraction ──────────────────────────────────────────────────────────
  function openExtract(paperId: string) {
    extractPaperId = paperId;
    const paper = openReview?.papers.find(p => p.id === paperId);
    extractDraft = paper?.extraction ? { ...paper.extraction } : {};
  }

  function saveExtraction() {
    if (!extractPaperId) return;
    updateReview(r => {
      const p = r.papers.find(x => x.id === extractPaperId);
      if (p) p.extraction = { ...extractDraft };
    });
    showToast('Extraction saved');
  }

  async function enzoExtract() {
    if (!extractPaper || enzoExtracting || isExample) return;
    extractAbort?.abort();
    extractAbort = new AbortController();
    enzoExtracting = true;
    const fields = openReview?.extractionFields ?? DEFAULT_FIELDS;
    try {
      const result = await srExtractPaper(extractPaper, fields, extractAbort.signal);
      extractDraft = { ...extractDraft, ...result };
    } catch { /* aborted */ }
    finally { enzoExtracting = false; }
  }

  function addExtractionField() {
    if (!newFieldLabel.trim() || isExample) return;
    const id = newFieldLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    updateReview(r => { r.extractionFields.push({ id, label: newFieldLabel.trim() }); });
    newFieldLabel = '';
  }

  function removeField(id: string) {
    updateReview(r => { r.extractionFields = r.extractionFields.filter(f => f.id !== id); });
  }

  // ── Synthesis ───────────────────────────────────────────────────────────
  async function generateDraft(mode: 'methods' | 'results') {
    if (!openReview || !prismaNumbers || draftLoading) return;
    draftAbort?.abort();
    draftAbort = new AbortController();
    draftMode = mode;
    draftText = '';
    draftLoading = true;
    const included = openReview.papers.filter(p => p.s1Decision === 'include');
    try {
      await srDraftSection(mode, {
        title: openReview.title,
        pico: openReview.pico,
        inclusion: openReview.inclusion,
        exclusion: openReview.exclusion,
        searches: openReview.searches,
        prisma: prismaNumbers,
        included: included.map(p => ({ ...p, extraction: p.extraction ?? {} })),
      }, c => { draftText += c; }, draftAbort.signal);
    } catch { /* aborted */ }
    finally { draftLoading = false; }
  }

  function exportTSV() {
    if (!openReview) return;
    const fields = openReview.extractionFields;
    const included = openReview.papers.filter(p => p.s1Decision === 'include');
    const header = ['Author', 'Year', 'Journal', 'DOI', ...fields.map(f => f.label)].join('\t');
    const rows = included.map(p => [
      p.authors[0] ?? 'Unknown', p.year, p.journal, p.doi,
      ...fields.map(f => (p.extraction?.[f.id] ?? '').replace(/\t/g, ' '))
    ].join('\t'));
    const tsv = [header, ...rows].join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${openReview.title.slice(0, 40).replace(/\s+/g, '_')}_extraction.tsv`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  // ── PRISMA SVG ──────────────────────────────────────────────────────────
  function prismaBox(x: number, y: number, w: number, h: number, label: string, n: number, color = '#1d2d42'): string {
    const tw = Math.min(w - 16, label.length * 6.5);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${color}" stroke="#2a3f5f" stroke-width="1.5"/>
      <text x="${x + w / 2}" y="${y + h / 2 - 8}" text-anchor="middle" fill="#9ca3af" font-size="9" font-family="Inter,system-ui">${label}</text>
      <text x="${x + w / 2}" y="${y + h / 2 + 9}" text-anchor="middle" fill="#e2f0ff" font-size="14" font-weight="700" font-family="Inter,system-ui">${n.toLocaleString()}</text>`;
  }

  function prismaArrow(x: number, y1: number, y2: number): string {
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 6}" stroke="#2a3f5f" stroke-width="1.5"/>
      <polygon points="${x - 4},${y2 - 6} ${x + 4},${y2 - 6} ${x},${y2}" fill="#2a3f5f"/>`;
  }

  function buildPrismaSVG(p: NonNullable<typeof prismaNumbers>): string {
    const W = 600, H = 480;
    const bw = 180, bh = 52;
    const cx = W / 2 - bw / 2;
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#0a0f1a;border-radius:8px">`;

    // Main flow column
    const boxes = [
      { label: 'Records identified', n: p.identified, y: 20 },
      { label: 'After deduplication', n: p.deduped, y: 110 },
      { label: 'Title/Abstract screened', n: p.screened, y: 200 },
      { label: 'Full-texts assessed', n: p.fulltext, y: 290 },
      { label: 'Studies included', n: p.included, y: 390, color: '#0d2a1a' },
    ];
    boxes.forEach((b, i) => {
      svg += prismaBox(cx, b.y, bw, bh, b.label, b.n, b.color);
      if (i < boxes.length - 1) svg += prismaArrow(cx + bw / 2, b.y + bh, boxes[i + 1].y);
    });

    // Side exclusion boxes
    const sx = cx + bw + 24;
    const sbw = 150;
    if (p.identified > p.deduped) {
      svg += `<line x1="${cx + bw / 2}" y1="${boxes[0].y + bh / 2}" x2="${cx + bw}" y2="${boxes[0].y + bh / 2}" stroke="#2a3f5f" stroke-width="1.5"/>`;
      svg += `<line x1="${cx + bw}" y1="${boxes[0].y + bh / 2}" x2="${sx}" y2="${boxes[0].y + bh / 2}" stroke="#2a3f5f" stroke-width="1.5"/>`;
      svg += prismaBox(sx, boxes[0].y + bh / 2 - bh / 2, sbw, bh, `Duplicates removed`, p.identified - p.deduped, '#1e0808');
    }
    if (p.excluded1 > 0) {
      const midY = boxes[2].y + bh / 2;
      svg += `<line x1="${cx + bw}" y1="${midY}" x2="${sx}" y2="${midY}" stroke="#2a3f5f" stroke-width="1.5"/>`;
      svg += prismaBox(sx, midY - bh / 2, sbw, bh, `Excluded (title/abstract)`, p.excluded1, '#1e0808');
    }
    if (p.excluded2 > 0) {
      const midY = boxes[3].y + bh / 2;
      svg += `<line x1="${cx + bw}" y1="${midY}" x2="${sx}" y2="${midY}" stroke="#2a3f5f" stroke-width="1.5"/>`;
      svg += prismaBox(sx, midY - bh / 2, sbw, bh, `Excluded (full-text)`, p.excluded2, '#1e0808');
    }
    // Source labels
    const sources = [...new Set(openReview?.searches.map(s => s.source) ?? [])].join(', ');
    if (sources) {
      svg += `<text x="${cx + bw / 2}" y="${boxes[0].y - 8}" text-anchor="middle" fill="#3d4f6e" font-size="8" font-family="Inter,system-ui">${sources}</text>`;
    }
    svg += '</svg>';
    return svg;
  }
</script>

<!-- ── Template ──────────────────────────────────────────────────────────── -->

{#if showNewForm}
  <!-- New Review Form -->
  <div class="sr-page">
    <div class="sr-form-wrap">
      <div class="sr-form-header">
        <button class="btn-icon" onclick={() => showNewForm = false}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <h2>New Systematic Review</h2>
      </div>

      <label class="sr-field-label">Review Title *</label>
      <input class="sr-input" bind:value={draftTitle} placeholder="e.g. PARPi resistance mechanisms in HGSOC…" />

      <div class="sr-section-title">PICO Framework</div>
      <div class="sr-pico-grid">
        <div>
          <label class="sr-field-label">P — Population</label>
          <input class="sr-input" bind:value={draftP} placeholder="e.g. HGSOC patients" />
        </div>
        <div>
          <label class="sr-field-label">I — Intervention</label>
          <input class="sr-input" bind:value={draftI} placeholder="e.g. PARP inhibitors (olaparib, niraparib)" />
        </div>
        <div>
          <label class="sr-field-label">C — Comparator</label>
          <input class="sr-input" bind:value={draftC} placeholder="e.g. Placebo or standard chemotherapy" />
        </div>
        <div>
          <label class="sr-field-label">O — Outcome</label>
          <input class="sr-input" bind:value={draftO} placeholder="e.g. Progression-free survival, resistance mechanisms" />
        </div>
        <div style="grid-column:1/-1">
          <label class="sr-field-label">Study Design</label>
          <input class="sr-input" bind:value={draftSD} placeholder="e.g. RCTs, cohort studies, translational/mechanistic studies" />
        </div>
      </div>

      <div class="sr-section-title">Inclusion Criteria</div>
      {#each draftInc as _, i}
        <div class="sr-criteria-row">
          <input class="sr-input" bind:value={draftInc[i]} placeholder="Add inclusion criterion…" />
          <button class="btn-icon" onclick={() => draftInc = draftInc.filter((_, j) => j !== i)}>×</button>
        </div>
      {/each}
      <button class="sr-add-btn" onclick={() => draftInc = [...draftInc, '']}>+ Add criterion</button>

      <div class="sr-section-title">Exclusion Criteria</div>
      {#each draftExc as _, i}
        <div class="sr-criteria-row">
          <input class="sr-input" bind:value={draftExc[i]} placeholder="Add exclusion criterion…" />
          <button class="btn-icon" onclick={() => draftExc = draftExc.filter((_, j) => j !== i)}>×</button>
        </div>
      {/each}
      <button class="sr-add-btn" onclick={() => draftExc = [...draftExc, '']}>+ Add criterion</button>

      <div class="sr-form-actions">
        <button class="btn btn-ghost btn-sm" onclick={() => showNewForm = false}>Cancel</button>
        <button class="btn btn-primary btn-sm" onclick={createReview} disabled={!draftTitle.trim()}>Create Review</button>
      </div>
    </div>
  </div>

{:else if openReview}
  <!-- Open Review -->
  <div class="sr-page sr-open">
    <!-- Header -->
    <div class="sr-review-header">
      <button class="btn-icon" onclick={() => { openId = null; draftText = ''; }} title="Back to list">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      </button>
      <div class="sr-review-title-wrap">
        <h2 class="sr-review-title">{openReview.title}</h2>
        {#if isExample}
          <span class="sr-example-badge">Example</span>
        {/if}
      </div>
      <div class="sr-header-stats">
        {#if prismaNumbers}
          <span class="sr-stat"><span class="sr-stat-n">{openReview.papers.length}</span> in pool</span>
          <span class="sr-stat"><span class="sr-stat-n sr-stat-gn">{prismaNumbers.included}</span> included</span>
        {/if}
      </div>
    </div>

    <!-- Tabs -->
    <div class="sr-tabs">
      {#each (['protocol','search','screening','fulltext','extraction','synthesis'] as const) as t}
        <button class="sr-tab" class:active={tab === t} onclick={() => tab = t}>
          {t === 'protocol' ? '1. Protocol' : t === 'search' ? '2. Search' : t === 'screening' ? '3. Title/Abstr.' : t === 'fulltext' ? '4. Full-text' : t === 'extraction' ? '5. Extraction' : '6. Synthesis'}
          {#if t === 'screening'}
            {@const n = openReview.papers.filter(p => !p.s1Decision).length}
            {#if n > 0}<span class="sr-tab-badge">{n}</span>{/if}
          {:else if t === 'fulltext'}
            {@const n = openReview.papers.filter(p => p.s1Decision === 'include' && !p.s2Decision).length}
            {#if n > 0}<span class="sr-tab-badge">{n}</span>{/if}
          {/if}
        </button>
      {/each}
    </div>

    <!-- Tab content -->
    <div class="sr-tab-body">

      {#if tab === 'protocol'}
        <!-- ── Protocol ── -->
        <div class="sr-protocol">
          <div class="sr-section-title">PICO Framework</div>
          <div class="sr-pico-grid">
            {#each ([['population','P — Population'],['intervention','I — Intervention'],['comparator','C — Comparator'],['outcome','O — Outcome'],['studyDesign','Study Design']] as const) as [key, label]}
              <div class:full={key === 'studyDesign'}>
                <label class="sr-field-label">{label}</label>
                <input class="sr-input" value={openReview.pico[key]}
                  oninput={(e) => !isExample && updateReview(r => r.pico[key] = (e.target as HTMLInputElement).value)}
                  disabled={isExample} />
              </div>
            {/each}
          </div>

          <div class="sr-criteria-cols">
            <div>
              <div class="sr-section-title" style="color:var(--gn)">Inclusion Criteria</div>
              {#each openReview.inclusion as crit, i}
                <div class="sr-criteria-row">
                  <span class="sr-crit-bullet gn">+</span>
                  <input class="sr-input" value={crit}
                    oninput={(e) => !isExample && updateReview(r => r.inclusion[i] = (e.target as HTMLInputElement).value)}
                    disabled={isExample} />
                  {#if !isExample}
                    <button class="btn-icon" onclick={() => updateReview(r => r.inclusion.splice(i, 1))}>×</button>
                  {/if}
                </div>
              {/each}
              {#if !isExample}
                <button class="sr-add-btn" onclick={() => updateReview(r => r.inclusion.push(''))}>+ Add</button>
              {/if}
            </div>
            <div>
              <div class="sr-section-title" style="color:var(--rd)">Exclusion Criteria</div>
              {#each openReview.exclusion as crit, i}
                <div class="sr-criteria-row">
                  <span class="sr-crit-bullet rd">−</span>
                  <input class="sr-input" value={crit}
                    oninput={(e) => !isExample && updateReview(r => r.exclusion[i] = (e.target as HTMLInputElement).value)}
                    disabled={isExample} />
                  {#if !isExample}
                    <button class="btn-icon" onclick={() => updateReview(r => r.exclusion.splice(i, 1))}>×</button>
                  {/if}
                </div>
              {/each}
              {#if !isExample}
                <button class="sr-add-btn" onclick={() => updateReview(r => r.exclusion.push(''))}>+ Add</button>
              {/if}
            </div>
          </div>

          <div class="sr-section-title">Extraction Fields
            <span class="sr-section-sub">Define what data to extract from each included paper</span>
          </div>
          <div class="sr-fields-grid">
            {#each openReview.extractionFields as f}
              <div class="sr-field-chip">
                <span>{f.label}</span>
                {#if !isExample}
                  <button class="sr-field-rm" onclick={() => removeField(f.id)}>×</button>
                {/if}
              </div>
            {/each}
          </div>
          {#if !isExample}
            <div class="sr-add-field-row">
              <input class="sr-input sr-input-sm" bind:value={newFieldLabel} placeholder="New field name…"
                onkeydown={(e) => e.key === 'Enter' && addExtractionField()} />
              <button class="btn btn-ghost btn-sm" onclick={addExtractionField} disabled={!newFieldLabel.trim()}>Add Field</button>
            </div>
          {/if}
        </div>

      {:else if tab === 'search'}
        <!-- ── Search ── -->
        <div class="sr-search">
          <div class="sr-search-bar">
            <div class="sr-source-tabs">
              {#each (['pubmed','openalex','europepmc'] as const) as src}
                <button class="sr-src-tab" class:active={searchSource === src} onclick={() => searchSource = src}>{src}</button>
              {/each}
            </div>
            <input class="sr-input sr-query-input" bind:value={searchQuery}
              placeholder="e.g. PARP inhibitor resistance HGSOC BRCA olaparib"
              onkeydown={(e) => e.key === 'Enter' && runSearch()} />
            <button class="btn btn-primary btn-sm" onclick={runSearch} disabled={searchLoading || !searchQuery.trim()}>
              {searchLoading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {#if openReview.searches.length > 0}
            <div class="sr-search-history">
              <span class="sr-section-title">Search history</span>
              {#each openReview.searches as s}
                <div class="sr-hist-row">
                  <span class="sr-hist-src">{s.source}</span>
                  <span class="sr-hist-q">"{s.query}"</span>
                  <span class="sr-hist-n">{s.count} records</span>
                  <span class="sr-hist-date">{new Date(s.date).toLocaleDateString()}</span>
                </div>
              {/each}
            </div>
          {/if}

          {#if searchResults.length > 0}
            <div class="sr-results-header">
              <span class="sr-section-title">{searchResults.length} results — preview before import</span>
              {#if !isExample}
                <button class="btn btn-primary btn-sm" onclick={importToPool}>
                  Import to Pool ({openReview.papers.length} existing)
                </button>
              {/if}
            </div>
            <div class="sr-results-list">
              {#each searchResults.slice(0, 30) as paper}
                <div class="sr-result-card">
                  <div class="sr-result-title">{paper.title}</div>
                  <div class="sr-result-meta">{paper.authors.slice(0,2).join(', ')}{paper.authors.length > 2 ? ' et al.' : ''} · {paper.journal} · {paper.year}</div>
                </div>
              {/each}
              {#if searchResults.length > 30}
                <p class="text-xs text-mu" style="padding:8px">{searchResults.length - 30} more results will also be imported</p>
              {/if}
            </div>
          {:else if openReview.papers.length > 0}
            <div class="sr-pool-summary">
              <div class="sr-pool-n">{openReview.papers.length}</div>
              <div class="sr-pool-label">papers in pool</div>
              <div class="sr-pool-sources">{[...new Set(openReview.papers.map(p => p.source))].join(', ')}</div>
            </div>
          {:else if !searchLoading}
            <div class="sr-empty-search">
              <p class="text-mu text-sm">Enter a query above to search and import papers into your review pool.</p>
            </div>
          {/if}
        </div>

      {:else if tab === 'screening' || tab === 'fulltext'}
        <!-- ── Screening ── -->
        {#if tab !== screenMode}
          {#if true}{ screenMode = tab === 'screening' ? 's1' : 's2' }{/if}
        {/if}
        {@const mode = tab === 'screening' ? 's1' : 's2'}
        {@const total = mode === 's1' ? openReview.papers.length : openReview.papers.filter(p => p.s1Decision === 'include').length}
        {@const done = mode === 's1' ? openReview.papers.filter(p => p.s1Decision).length : openReview.papers.filter(p => p.s1Decision === 'include' && p.s2Decision).length}

        <div class="sr-screen-wrap">
          <!-- Progress bar + controls -->
          <div class="sr-screen-controls">
            <div class="sr-progress-wrap">
              <div class="sr-progress-bar"><div class="sr-progress-fill" style="width:{total > 0 ? (done / total) * 100 : 0}%"></div></div>
              <span class="sr-progress-txt">{done}/{total} screened</span>
            </div>
            <input class="sr-input sr-input-sm sr-screen-search" bind:value={screenSearch} placeholder="Filter papers…" />
            {#if !isExample}
              {#if enzoScreening}
                <button class="btn btn-ghost btn-sm" onclick={() => enzoScreenAbort?.abort()}>
                  Stop Enzo ({enzoScreenIdx}/{openReview.papers.filter(p => mode === 's1' ? !p.s1Decision : (p.s1Decision === 'include' && !p.s2Decision)).length})
                </button>
              {:else}
                <button class="btn btn-enzo btn-sm" onclick={enzoScreenAll}>
                  Enzo Screen All
                </button>
              {/if}
            {/if}
            <div class="sr-filter-pills">
              {#each (['unscreened','include','uncertain','exclude','all'] as const) as f}
                <button class="sr-filter-pill" class:active={screenFilter === f} onclick={() => { screenFilter = f; screenCardIdx = 0; }}>
                  {f === 'unscreened' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span class="sr-pill-n">
                    {f === 'all' ? openReview.papers.length
                      : f === 'unscreened' ? openReview.papers.filter(p => mode === 's1' ? !p.s1Decision : (p.s1Decision === 'include' && !p.s2Decision)).length
                      : openReview.papers.filter(p => (mode === 's1' ? p.s1Decision : p.s2Decision) === f).length}
                  </span>
                </button>
              {/each}
            </div>
          </div>

          <!-- Card view -->
          {#if currentCard}
            <div class="sr-card-nav">
              <button class="btn-icon" onclick={() => screenCardIdx = Math.max(0, screenCardIdx - 1)} disabled={screenCardIdx === 0}>‹</button>
              <span class="sr-card-pos">{screenCardIdx + 1} / {screeningList.length}</span>
              <button class="btn-icon" onclick={() => screenCardIdx = Math.min(screeningList.length - 1, screenCardIdx + 1)}>›</button>
            </div>
            <div class="sr-card">
              <div class="sr-card-head">
                <div class="sr-card-title">{currentCard.title}</div>
                <div class="sr-card-meta">
                  {currentCard.authors.slice(0, 2).join(', ')}{currentCard.authors.length > 2 ? ' et al.' : ''} ·
                  {currentCard.journal} · {currentCard.year}
                  {#if currentCard.doi}<span class="sr-card-doi">{currentCard.doi}</span>{/if}
                </div>
                {#if currentCard.s1EnzoSuggestion && mode === 's1'}
                  <div class="sr-enzo-suggestion" style="--clr:{currentCard.s1EnzoSuggestion === 'include' ? 'var(--gn)' : currentCard.s1EnzoSuggestion === 'exclude' ? 'var(--rd)' : 'var(--yw)'}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                    Enzo: <strong>{currentCard.s1EnzoSuggestion}</strong> — {currentCard.s1EnzoReason}
                  </div>
                {/if}
              </div>
              <p class="sr-card-abstract">{currentCard.abstract?.slice(0, 600) ?? 'Abstract not available.'}</p>
              {#if (mode === 's1' ? currentCard.s1Decision : currentCard.s2Decision)}
                <div class="sr-current-decision" style="--clr:{((mode === 's1' ? currentCard.s1Decision : currentCard.s2Decision) === 'include') ? 'var(--gn)' : ((mode === 's1' ? currentCard.s1Decision : currentCard.s2Decision) === 'exclude') ? 'var(--rd)' : 'var(--yw)'}">
                  Decision: <strong>{mode === 's1' ? currentCard.s1Decision : currentCard.s2Decision}</strong>
                  <span class="sr-decision-reason">{mode === 's1' ? (currentCard.s1Reason ?? '') : (currentCard.s2Reason ?? '')}</span>
                </div>
              {/if}
              {#if !isExample}
                <div class="sr-card-actions">
                  <button class="sr-decision-btn include" onclick={() => setDecision(currentCard.id, 'include')}>✓ Include</button>
                  <button class="sr-decision-btn uncertain" onclick={() => setDecision(currentCard.id, 'uncertain')}>? Uncertain</button>
                  <button class="sr-decision-btn exclude" onclick={() => setDecision(currentCard.id, 'exclude')}>✗ Exclude</button>
                </div>
              {/if}
            </div>
          {:else if screeningList.length === 0 && total === 0}
            <div class="sr-screen-empty">
              <p class="text-mu text-sm">{mode === 's1' ? 'No papers in pool yet. Go to the Search tab to import papers.' : 'No papers included from title/abstract screening yet.'}</p>
            </div>
          {:else}
            <div class="sr-screen-empty">
              <p class="text-mu text-sm">All {screenFilter !== 'all' ? screenFilter : ''} papers screened for this filter.</p>
            </div>
          {/if}

          <!-- List view below card -->
          {#if screeningList.length > 0}
            <div class="sr-screen-list">
              {#each screeningList as paper, i}
                {@const dec = mode === 's1' ? paper.s1Decision : paper.s2Decision}
                <div class="sr-list-row" class:active={i === screenCardIdx} onclick={() => screenCardIdx = i}>
                  <div class="sr-list-dec" class:inc={dec === 'include'} class:exc={dec === 'exclude'} class:unc={dec === 'uncertain'} class:none={!dec}></div>
                  <div class="sr-list-title">{paper.title.length > 90 ? paper.title.slice(0, 88) + '…' : paper.title}</div>
                  <div class="sr-list-year">{paper.year}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      {:else if tab === 'extraction'}
        <!-- ── Extraction ── -->
        <div class="sr-extract-wrap">
          <div class="sr-extract-list">
            <div class="sr-section-title">Included papers ({includedPapers.length})</div>
            {#each includedPapers as paper}
              {@const done = paper.extraction && Object.keys(paper.extraction).length > 0}
              <div class="sr-extract-item" class:active={extractPaperId === paper.id} onclick={() => openExtract(paper.id)}>
                <div class="sr-extract-status" class:done={done}></div>
                <div class="sr-extract-item-title">{paper.title.length > 70 ? paper.title.slice(0, 68) + '…' : paper.title}</div>
                <span class="sr-extract-year">{paper.year}</span>
              </div>
            {/each}
            {#if includedPapers.length === 0}
              <p class="text-mu text-xs" style="padding:12px">No included papers yet. Complete screening first.</p>
            {/if}
          </div>

          <div class="sr-extract-form">
            {#if extractPaper}
              <div class="sr-extract-form-head">
                <div class="sr-extract-paper-title">{extractPaper.title}</div>
                <div class="sr-extract-paper-meta">{extractPaper.authors.slice(0,2).join(', ')}{extractPaper.authors.length > 2 ? ' et al.' : ''} · {extractPaper.journal} · {extractPaper.year}</div>
                {#if !isExample}
                  <div class="sr-extract-form-actions">
                    <button class="btn btn-enzo btn-sm" onclick={enzoExtract} disabled={enzoExtracting}>
                      {enzoExtracting ? 'Extracting…' : 'Enzo Pre-fill'}
                    </button>
                    <button class="btn btn-primary btn-sm" onclick={saveExtraction}>Save</button>
                  </div>
                {/if}
              </div>
              <div class="sr-extract-fields">
                {#each (openReview.extractionFields ?? DEFAULT_FIELDS) as field}
                  <div class="sr-extract-field">
                    <label class="sr-field-label">{field.label}</label>
                    <textarea class="sr-input sr-extract-ta" rows="2"
                      value={extractDraft[field.id] ?? extractPaper.extraction?.[field.id] ?? ''}
                      oninput={(e) => { extractDraft = { ...extractDraft, [field.id]: (e.target as HTMLTextAreaElement).value }; }}
                      placeholder="Not reported"
                      disabled={isExample}></textarea>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="sr-extract-empty">
                <p class="text-mu text-sm">← Select a paper to extract data</p>
              </div>
            {/if}
          </div>
        </div>

      {:else if tab === 'synthesis'}
        <!-- ── Synthesis ── -->
        <div class="sr-synthesis">
          <div class="sr-synth-cols">
            <!-- PRISMA diagram -->
            <div class="sr-prisma-col">
              <div class="sr-section-title">PRISMA 2020 Flow</div>
              {#if prismaNumbers}
                <div class="sr-prisma-wrap">{@html buildPrismaSVG(prismaNumbers)}</div>
                <div class="sr-prisma-stats">
                  <div class="sr-pstat"><span class="sr-pstat-n">{prismaNumbers.identified}</span>identified</div>
                  <div class="sr-pstat"><span class="sr-pstat-n rd">{prismaNumbers.excluded1}</span>excluded</div>
                  <div class="sr-pstat"><span class="sr-pstat-n gn">{prismaNumbers.included}</span>included</div>
                </div>
              {/if}
            </div>

            <!-- Evidence table -->
            <div class="sr-evidence-col">
              <div class="sr-section-title">
                Evidence Table
                {#if includedPapers.length > 0}
                  <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick={exportTSV}>↓ TSV</button>
                {/if}
              </div>
              {#if includedPapers.length > 0}
                <div class="sr-evidence-wrap">
                  <table class="sr-evidence-table">
                    <thead>
                      <tr>
                        <th>Author</th><th>Year</th><th>Journal</th>
                        {#each (openReview.extractionFields ?? DEFAULT_FIELDS) as f}<th>{f.label}</th>{/each}
                      </tr>
                    </thead>
                    <tbody>
                      {#each includedPapers as p}
                        <tr>
                          <td class="sr-ev-author">{p.authors[0]?.split(' ')[0] ?? '?'} et al.</td>
                          <td>{p.year}</td>
                          <td class="sr-ev-journal">{p.journal.split(' ').slice(0, 3).join(' ')}</td>
                          {#each (openReview.extractionFields ?? DEFAULT_FIELDS) as f}
                            <td>{p.extraction?.[f.id] ?? '—'}</td>
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <p class="text-mu text-sm sr-no-evidence">Include papers in screening to build the evidence table.</p>
              {/if}
            </div>
          </div>

          <!-- Draft generation -->
          <div class="sr-draft-section">
            <div class="sr-section-title">
              Enzo Draft Generation
              <span class="sr-section-sub">Stream a PRISMA-compliant methods or results section</span>
            </div>
            {#if !isExample}
              <div class="sr-draft-btns">
                <button class="btn btn-enzo btn-sm" onclick={() => generateDraft('methods')} disabled={draftLoading}>
                  {draftLoading && draftMode === 'methods' ? 'Writing…' : 'Generate Methods'}
                </button>
                <button class="btn btn-enzo btn-sm" onclick={() => generateDraft('results')} disabled={draftLoading}>
                  {draftLoading && draftMode === 'results' ? 'Writing…' : 'Generate Results'}
                </button>
                {#if draftLoading}
                  <button class="btn btn-ghost btn-sm" onclick={() => draftAbort?.abort()}>Stop</button>
                {/if}
                {#if draftText && !draftLoading}
                  <button class="btn btn-ghost btn-sm" onclick={() => { draftText = ''; draftMode = null; }}>Clear</button>
                {/if}
              </div>
            {/if}
            {#if draftText}
              <div class="sr-draft-output md">{@html marked(draftText)}</div>
            {:else if draftLoading}
              <div class="sr-draft-loading">
                <span></span><span></span><span></span>
              </div>
            {:else if !isExample}
              <p class="text-mu text-sm sr-draft-hint">Click Generate Methods or Results to produce a PRISMA-compliant manuscript section.</p>
            {/if}
          </div>
        </div>
      {/if}

    </div>
  </div>

{:else}
  <!-- ── Review list / Landing ── -->
  <div class="sr-page sr-landing">
    <div class="sr-landing-header">
      <div>
        <h2>Systematic Review Conductor</h2>
        <p class="text-mu text-sm">PRISMA-guided workflow from protocol to synthesis</p>
      </div>
      <button class="btn btn-primary" onclick={() => showNewForm = true}>+ New Review</button>
    </div>

    <!-- Example card always shown -->
    <div class="sr-review-card example" onclick={() => { openId = '__example__'; tab = 'protocol'; }}>
      <div class="sr-review-card-head">
        <div class="sr-review-card-title">{EXAMPLE.title}</div>
        <span class="sr-example-badge">Example</span>
      </div>
      <div class="sr-review-card-pico">
        <span><strong>P:</strong> {EXAMPLE.pico.population.slice(0, 50)}…</span>
        <span><strong>I:</strong> {EXAMPLE.pico.intervention.slice(0, 50)}…</span>
      </div>
      <div class="sr-review-card-stats">
        <span>{EXAMPLE.papers.length} papers</span>
        <span>{EXAMPLE.papers.filter(p => p.s1Decision === 'include').length} included</span>
        <span>{EXAMPLE.stage}</span>
      </div>
    </div>

    {#each allReviews as review}
      {@const inc = review.papers.filter(p => p.s1Decision === 'include').length}
      {@const pct = review.papers.length > 0 ? Math.round((review.papers.filter(p => p.s1Decision).length / review.papers.length) * 100) : 0}
      <div class="sr-review-card" onclick={() => { openId = review.id; tab = 'protocol'; }}>
        <div class="sr-review-card-head">
          <div class="sr-review-card-title">{review.title}</div>
          <div class="sr-card-actions-row">
            <span class="sr-stage-badge {review.stage}">{review.stage}</span>
            <button class="btn-icon" onclick={(e) => { e.stopPropagation(); if (confirm('Delete this review?')) deleteReview(review.id); }} title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
        <div class="sr-review-card-pico">
          {#if review.pico.population}<span><strong>P:</strong> {review.pico.population.slice(0,55)}</span>{/if}
          {#if review.pico.intervention}<span><strong>I:</strong> {review.pico.intervention.slice(0,55)}</span>{/if}
        </div>
        <div class="sr-review-card-stats">
          <span>{review.papers.length} in pool</span>
          <span class="gn">{inc} included</span>
          {#if review.papers.length > 0}
            <div class="sr-mini-bar"><div style="width:{pct}%"></div></div>
            <span>{pct}% screened</span>
          {/if}
        </div>
        <div class="sr-review-card-date">Updated {new Date(review.updatedAt).toLocaleDateString()}</div>
      </div>
    {/each}

    {#if allReviews.length === 0}
      <div class="sr-no-reviews">
        <p class="text-mu text-sm">No reviews yet. Click the example above to explore, or create your own.</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .sr-page {
    height: 100%; overflow-y: auto;
    padding: 20px 24px;
    display: flex; flex-direction: column; gap: 16px;
    background: var(--bg);
  }
  .sr-open { padding: 0; overflow: hidden; }
  .sr-landing { gap: 12px; }

  /* ── Landing ── */
  .sr-landing-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    padding-bottom: 4px;
  }
  .sr-landing-header h2 { font-size: 1.1rem; font-weight: 700; }
  .sr-review-card {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 14px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 8px;
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .sr-review-card:hover { border-color: var(--ac); box-shadow: var(--shadow-sm); }
  .sr-review-card.example { border-color: var(--ac); background: var(--ac-bg); }
  .sr-review-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .sr-review-card-title { font-size: 0.9rem; font-weight: 600; color: var(--tx); line-height: 1.4; flex: 1; }
  .sr-review-card-pico { display: flex; flex-direction: column; gap: 2px; font-size: 0.78rem; color: var(--tx2); }
  .sr-review-card-stats { display: flex; align-items: center; gap: 10px; font-size: 0.74rem; color: var(--mu); }
  .sr-review-card-stats .gn { color: var(--gn); font-weight: 600; }
  .sr-review-card-date { font-size: 0.72rem; color: var(--mu); }
  .sr-mini-bar { width: 60px; height: 4px; background: var(--sf3); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
  .sr-mini-bar div { height: 100%; background: var(--ac); }
  .sr-card-actions-row { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .sr-no-reviews { padding: 24px 0; text-align: center; }
  .sr-stage-badge { font-size: 0.65rem; font-weight: 700; padding: 1px 7px; border-radius: 10px; text-transform: uppercase; letter-spacing: .04em; background: var(--sf2); color: var(--mu); }
  .sr-stage-badge.synthesis { background: var(--gn-bg); color: var(--gn); }
  .sr-stage-badge.extraction { background: var(--ac-bg); color: var(--ac); }
  .sr-example-badge { font-size: 0.65rem; font-weight: 700; padding: 1px 7px; border-radius: 10px; background: var(--ac-bg); color: var(--ac); flex-shrink: 0; }

  /* ── Open review header ── */
  .sr-review-header {
    display: flex; align-items: center; gap: 10px; padding: 10px 16px;
    background: var(--sf); border-bottom: 1px solid var(--bd); flex-shrink: 0; flex-wrap: wrap;
  }
  .sr-review-title-wrap { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
  .sr-review-title { font-size: 0.92rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sr-header-stats { display: flex; gap: 12px; align-items: center; flex-shrink: 0; }
  .sr-stat { font-size: 0.75rem; color: var(--mu); }
  .sr-stat-n { font-weight: 700; color: var(--tx); }
  .sr-stat-n.sr-stat-gn { color: var(--gn); }

  /* ── Tabs ── */
  .sr-tabs {
    display: flex; gap: 0; border-bottom: 1px solid var(--bd);
    background: var(--sf2); flex-shrink: 0; overflow-x: auto;
  }
  .sr-tab {
    padding: 9px 14px; font-size: 0.78rem; font-weight: 500; color: var(--mu);
    background: transparent; border: none; border-bottom: 2px solid transparent;
    cursor: pointer; transition: color var(--transition); white-space: nowrap;
    display: flex; align-items: center; gap: 5px;
  }
  .sr-tab:hover { color: var(--tx); }
  .sr-tab.active { color: var(--ac); border-bottom-color: var(--ac); background: var(--sf); }
  .sr-tab-badge { font-size: 0.62rem; font-weight: 800; padding: 0 5px; border-radius: 8px; background: var(--rd-bg); color: var(--rd); }
  .sr-tab-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

  /* ── Section title ── */
  .sr-section-title {
    font-size: 0.7rem; font-weight: 800; letter-spacing: .07em; text-transform: uppercase;
    color: var(--mu); margin-bottom: 8px; display: flex; align-items: center; gap: 8px;
  }
  .sr-section-sub { font-size: 0.65rem; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--mu); }
  .sr-field-label { font-size: 0.74rem; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 4px; }
  .sr-input {
    width: 100%; padding: 7px 10px; border: 1px solid var(--bd); border-radius: var(--radius-sm);
    background: var(--sf); color: var(--tx); font-size: 0.84rem; font-family: var(--font);
    transition: border-color var(--transition); outline: none;
  }
  .sr-input:focus { border-color: var(--ac); box-shadow: 0 0 0 2px var(--ac-bg); }
  .sr-input:disabled { opacity: 0.6; cursor: default; }
  .sr-input-sm { max-width: 260px; }
  .sr-criteria-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .sr-crit-bullet { font-size: 1rem; font-weight: 700; flex-shrink: 0; width: 16px; text-align: center; }
  .sr-crit-bullet.gn { color: var(--gn); }
  .sr-crit-bullet.rd { color: var(--rd); }
  .sr-add-btn { font-size: 0.76rem; color: var(--ac); background: transparent; border: 1px dashed var(--bd); border-radius: var(--radius-sm); padding: 4px 10px; cursor: pointer; }
  .sr-add-btn:hover { border-color: var(--ac); background: var(--ac-bg); }

  /* ── Protocol tab ── */
  .sr-protocol { padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; }
  .sr-pico-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sr-pico-grid .full { grid-column: 1 / -1; }
  .sr-criteria-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .sr-fields-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .sr-field-chip { display: flex; align-items: center; gap: 5px; padding: 3px 9px; background: var(--sf2); border: 1px solid var(--bd); border-radius: 12px; font-size: 0.74rem; color: var(--tx2); }
  .sr-field-rm { background: transparent; border: none; color: var(--mu); font-size: 0.9rem; cursor: pointer; padding: 0; }
  .sr-field-rm:hover { color: var(--rd); }
  .sr-add-field-row { display: flex; gap: 8px; align-items: center; }

  /* ── Search tab ── */
  .sr-search { padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }
  .sr-search-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .sr-source-tabs { display: flex; gap: 2px; background: var(--sf2); border-radius: var(--radius-sm); padding: 2px; }
  .sr-src-tab { padding: 4px 10px; font-size: 0.75rem; font-weight: 500; border-radius: 4px; background: transparent; color: var(--mu); border: none; cursor: pointer; text-transform: uppercase; letter-spacing: .04em; }
  .sr-src-tab.active { background: var(--sf); color: var(--ac); }
  .sr-query-input { flex: 1; min-width: 200px; }
  .sr-search-history { display: flex; flex-direction: column; gap: 4px; }
  .sr-hist-row { display: flex; align-items: center; gap: 8px; font-size: 0.76rem; padding: 5px 8px; background: var(--sf2); border-radius: 5px; }
  .sr-hist-src { font-weight: 700; color: var(--ac); text-transform: uppercase; font-size: 0.65rem; flex-shrink: 0; }
  .sr-hist-q { color: var(--tx2); flex: 1; font-style: italic; }
  .sr-hist-n { color: var(--gn); font-weight: 600; flex-shrink: 0; }
  .sr-hist-date { color: var(--mu); flex-shrink: 0; }
  .sr-results-header { display: flex; justify-content: space-between; align-items: center; }
  .sr-results-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
  .sr-result-card { padding: 8px 10px; background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius-sm); }
  .sr-result-title { font-size: 0.82rem; font-weight: 500; color: var(--tx); line-height: 1.35; }
  .sr-result-meta { font-size: 0.72rem; color: var(--mu); margin-top: 2px; }
  .sr-pool-summary { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 32px; background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius); }
  .sr-pool-n { font-size: 2.5rem; font-weight: 800; color: var(--ac); line-height: 1; }
  .sr-pool-label { font-size: 0.78rem; color: var(--mu); }
  .sr-pool-sources { font-size: 0.72rem; color: var(--mu); }
  .sr-empty-search { padding: 32px; text-align: center; }

  /* ── Screening tab ── */
  .sr-screen-wrap { padding: 12px 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .sr-screen-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sr-progress-wrap { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .sr-progress-bar { width: 120px; height: 5px; background: var(--sf3); border-radius: 3px; overflow: hidden; }
  .sr-progress-fill { height: 100%; background: var(--ac); border-radius: 3px; transition: width 0.3s; }
  .sr-progress-txt { font-size: 0.74rem; color: var(--mu); white-space: nowrap; }
  .sr-screen-search { flex: 1; }
  .sr-filter-pills { display: flex; gap: 4px; flex-wrap: wrap; }
  .sr-filter-pill { font-size: 0.72rem; padding: 3px 9px; border-radius: 10px; background: var(--sf2); border: 1px solid var(--bd); color: var(--mu); cursor: pointer; display: flex; align-items: center; gap: 4px; }
  .sr-filter-pill.active { background: var(--ac-bg); border-color: var(--ac); color: var(--ac); }
  .sr-pill-n { font-weight: 700; font-size: 0.65rem; }
  .sr-card-nav { display: flex; align-items: center; gap: 8px; }
  .sr-card-pos { font-size: 0.76rem; color: var(--mu); }
  .sr-card { background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .sr-card-head { display: flex; flex-direction: column; gap: 4px; }
  .sr-card-title { font-size: 0.95rem; font-weight: 700; color: var(--tx); line-height: 1.4; }
  .sr-card-meta { font-size: 0.76rem; color: var(--mu); }
  .sr-card-doi { font-family: var(--mono); font-size: 0.68rem; color: var(--mu); margin-left: 6px; }
  .sr-enzo-suggestion { font-size: 0.76rem; display: flex; align-items: center; gap: 5px; color: var(--clr, var(--mu)); background: color-mix(in srgb, var(--clr, transparent) 10%, transparent); padding: 4px 8px; border-radius: 5px; border: 1px solid color-mix(in srgb, var(--clr, var(--bd)) 30%, transparent); margin-top: 2px; }
  .sr-current-decision { font-size: 0.78rem; display: flex; align-items: center; gap: 6px; color: var(--clr, var(--mu)); padding: 4px 8px; border-radius: 5px; background: color-mix(in srgb, var(--clr, transparent) 8%, var(--sf2)); }
  .sr-decision-reason { font-weight: 400; color: var(--tx2); font-size: 0.73rem; }
  .sr-card-abstract { font-size: 0.8rem; color: var(--tx2); line-height: 1.65; max-height: 180px; overflow-y: auto; }
  .sr-card-actions { display: flex; gap: 8px; }
  .sr-decision-btn { flex: 1; padding: 9px; font-size: 0.82rem; font-weight: 700; border: 2px solid transparent; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.12s; font-family: var(--font); }
  .sr-decision-btn.include { background: var(--gn-bg); color: var(--gn); border-color: var(--gn); }
  .sr-decision-btn.include:hover { background: var(--gn); color: #fff; }
  .sr-decision-btn.uncertain { background: var(--yw-bg); color: var(--yw); border-color: var(--yw); }
  .sr-decision-btn.uncertain:hover { background: var(--yw); color: #fff; }
  .sr-decision-btn.exclude { background: var(--rd-bg); color: var(--rd); border-color: var(--rd); }
  .sr-decision-btn.exclude:hover { background: var(--rd); color: #fff; }
  .sr-screen-empty { padding: 32px; text-align: center; }
  .sr-screen-list { display: flex; flex-direction: column; gap: 1px; max-height: 260px; overflow-y: auto; border: 1px solid var(--bd); border-radius: var(--radius-sm); }
  .sr-list-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer; transition: background var(--transition); }
  .sr-list-row:hover, .sr-list-row.active { background: var(--sf2); }
  .sr-list-dec { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--bd); }
  .sr-list-dec.inc { background: var(--gn); }
  .sr-list-dec.exc { background: var(--rd); }
  .sr-list-dec.unc { background: var(--yw); }
  .sr-list-dec.none { background: var(--sf3); border: 1px solid var(--bd); }
  .sr-list-title { flex: 1; font-size: 0.76rem; color: var(--tx2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sr-list-year { font-size: 0.7rem; color: var(--mu); flex-shrink: 0; }

  /* ── Extraction tab ── */
  .sr-extract-wrap { display: flex; flex: 1; overflow: hidden; }
  .sr-extract-list { width: 260px; flex-shrink: 0; border-right: 1px solid var(--bd); overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
  .sr-extract-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; transition: background var(--transition); }
  .sr-extract-item:hover, .sr-extract-item.active { background: var(--sf2); }
  .sr-extract-status { width: 8px; height: 8px; border-radius: 50%; background: var(--sf3); border: 1px solid var(--bd); flex-shrink: 0; }
  .sr-extract-status.done { background: var(--gn); border-color: var(--gn); }
  .sr-extract-item-title { font-size: 0.76rem; color: var(--tx2); flex: 1; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.35; }
  .sr-extract-year { font-size: 0.68rem; color: var(--mu); flex-shrink: 0; }
  .sr-extract-form { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .sr-extract-form-head { display: flex; flex-direction: column; gap: 3px; padding-bottom: 10px; border-bottom: 1px solid var(--bd); }
  .sr-extract-paper-title { font-size: 0.88rem; font-weight: 700; color: var(--tx); line-height: 1.35; }
  .sr-extract-paper-meta { font-size: 0.74rem; color: var(--mu); }
  .sr-extract-form-actions { display: flex; gap: 8px; margin-top: 6px; }
  .sr-extract-fields { display: flex; flex-direction: column; gap: 8px; }
  .sr-extract-field { display: flex; flex-direction: column; gap: 3px; }
  .sr-extract-ta { resize: vertical; min-height: 52px; }
  .sr-extract-empty { display: flex; align-items: center; justify-content: center; flex: 1; }

  /* ── Synthesis tab ── */
  .sr-synthesis { padding: 14px 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; }
  .sr-synth-cols { display: grid; grid-template-columns: 280px 1fr; gap: 16px; }
  .sr-prisma-col { display: flex; flex-direction: column; gap: 8px; }
  .sr-prisma-wrap { border-radius: 8px; overflow: hidden; }
  .sr-prisma-wrap :global(svg) { width: 100%; height: auto; }
  .sr-prisma-stats { display: flex; gap: 12px; }
  .sr-pstat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .sr-pstat-n { font-size: 1.1rem; font-weight: 800; color: var(--tx); }
  .sr-pstat-n.gn { color: var(--gn); }
  .sr-pstat-n.rd { color: var(--rd); }
  .sr-pstat { font-size: 0.68rem; color: var(--mu); }
  .sr-evidence-col { overflow: hidden; display: flex; flex-direction: column; gap: 8px; }
  .sr-evidence-wrap { overflow-x: auto; overflow-y: auto; max-height: 300px; border: 1px solid var(--bd); border-radius: var(--radius-sm); }
  .sr-evidence-table { border-collapse: collapse; width: 100%; font-size: 0.72rem; }
  .sr-evidence-table th { padding: 6px 10px; background: var(--sf2); border-bottom: 1px solid var(--bd); font-weight: 700; text-align: left; white-space: nowrap; position: sticky; top: 0; z-index: 1; font-size: 0.66rem; text-transform: uppercase; letter-spacing: .04em; color: var(--mu); }
  .sr-evidence-table td { padding: 6px 10px; border-bottom: 1px solid var(--sf3); vertical-align: top; color: var(--tx2); }
  .sr-evidence-table tbody tr:hover td { background: var(--sf2); }
  .sr-ev-author { font-weight: 600; color: var(--tx); white-space: nowrap; }
  .sr-ev-journal { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sr-no-evidence { padding: 16px 0; }
  .sr-draft-section { display: flex; flex-direction: column; gap: 10px; }
  .sr-draft-btns { display: flex; gap: 8px; flex-wrap: wrap; }
  .sr-draft-output { font-size: 0.84rem; line-height: 1.75; color: var(--tx2); background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius); padding: 14px 16px; max-height: 400px; overflow-y: auto; }
  .sr-draft-output :global(p) { margin: 0 0 0.8em; color: var(--tx2); }
  .sr-draft-output :global(strong) { color: var(--tx); }
  .sr-draft-loading { display: flex; gap: 6px; padding: 8px 0; }
  .sr-draft-loading span { width: 7px; height: 7px; border-radius: 50%; background: var(--ac); opacity: 0; animation: srDot 1.4s ease-in-out infinite; }
  .sr-draft-loading span:nth-child(2) { animation-delay: 0.2s; }
  .sr-draft-loading span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes srDot { 0%,80%,100%{opacity:0;transform:scale(0.6)} 40%{opacity:1;transform:scale(1)} }
  .sr-draft-hint { padding: 8px 0; }

  /* ── New form ── */
  .sr-form-wrap { max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
  .sr-form-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .sr-form-header h2 { font-size: 1.1rem; font-weight: 700; }
  .sr-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

  @media (max-width: 640px) {
    .sr-pico-grid { grid-template-columns: 1fr; }
    .sr-criteria-cols { grid-template-columns: 1fr; }
    .sr-synth-cols { grid-template-columns: 1fr; }
    .sr-extract-wrap { flex-direction: column; }
    .sr-extract-list { width: 100%; max-height: 200px; border-right: none; border-bottom: 1px solid var(--bd); }
  }
</style>
