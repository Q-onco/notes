<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { searchPubMed } from '../lib/pubmed';
  import { synthesizeReviewTheme } from '../lib/groq';
  import RichEditor from './RichEditor.svelte';
  import type { ReviewArticle, ReviewTheme, ReviewPaper, ReviewArticleStatus, ReviewThemeStatus, PaperResult } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── Selection state ────────────────────────────────────────────
  let selectedId      = $state<string | null>(null);
  let selectedThemeId = $state<string | null>(null);
  let middleTab       = $state<'corpus' | 'themes'>('themes');
  let themeMode       = $state<'outline' | 'draft'>('outline');

  // ── New article form ───────────────────────────────────────────
  let newOpen     = $state(false);
  let newTitle    = $state('');
  let newJournal  = $state('');
  let newScope    = $state('');
  let newWordTarget = $state(7000);

  // ── New theme form ─────────────────────────────────────────────
  let addThemeOpen  = $state(false);
  let addThemeTitle = $state('');
  let addThemeWords = $state(1500);

  // ── PubMed search ──────────────────────────────────────────────
  let searchQuery   = $state('');
  let searchResults = $state<PaperResult[]>([]);
  let searching     = $state(false);
  let searchError   = $state('');

  // ── Corpus expand ──────────────────────────────────────────────
  let corpusExpanded = $state<string | null>(null);

  // ── Enzo synthesis ─────────────────────────────────────────────
  let synthText      = $state('');
  let synthStreaming  = $state(false);
  let synthAbort     = $state<AbortController | null>(null);

  // ── Autosave ───────────────────────────────────────────────────
  let saveTimer: ReturnType<typeof setTimeout>;

  // ── Derived ───────────────────────────────────────────────────
  const ra    = $derived(store.reviewArticles.find(r => r.id === selectedId) ?? null);
  const theme = $derived(ra?.themes.find(t => t.id === selectedThemeId) ?? null);
  const themeCorpus = $derived(
    theme && ra ? ra.corpus.filter(p => theme.paperIds.includes(p.id)) : []
  );
  const totalWords = $derived(
    ra ? ra.themes.reduce((acc, t) => acc + wc(t.content), 0) : 0
  );

  function wc(html: string): number {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  }

  function articleProgress(r: ReviewArticle): number {
    if (r.themes.length === 0) return 0;
    const score = r.themes.reduce((acc, t) =>
      acc + (t.status === 'polished' ? 2 : t.status === 'draft' ? 1 : 0), 0);
    return Math.round((score / (r.themes.length * 2)) * 100);
  }

  function firstAuthor(p: ReviewPaper): string {
    return p.authors.split(',')[0].split(' et ')[0].trim();
  }

  // ── Save / autosave ────────────────────────────────────────────
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (!ra) return;
      ra.updatedAt = Date.now();
      store.reviewArticles = [...store.reviewArticles];
      await store.saveReviewArticles();
    }, 1200);
  }

  // ── Article CRUD ───────────────────────────────────────────────
  function createArticle() {
    if (!newTitle.trim()) return;
    const r: ReviewArticle = {
      id: nanoid(), title: newTitle.trim(),
      targetJournal: newJournal.trim(), scope: newScope.trim(),
      status: 'planning', wordTarget: newWordTarget,
      corpus: [], themes: [],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    store.reviewArticles = [r, ...store.reviewArticles];
    selectedId = r.id;
    store.saveReviewArticles();
    showToast('Review article created');
    newOpen = false;
    newTitle = ''; newJournal = ''; newScope = ''; newWordTarget = 7000;
  }

  async function deleteArticle(id: string) {
    if (!confirm('Delete this review article and all its data?')) return;
    store.reviewArticles = store.reviewArticles.filter(r => r.id !== id);
    if (selectedId === id) { selectedId = null; selectedThemeId = null; }
    await store.saveReviewArticles();
    showToast('Deleted');
  }

  // ── Corpus CRUD ────────────────────────────────────────────────
  async function doSearch() {
    if (!searchQuery.trim()) return;
    searching = true; searchError = ''; searchResults = [];
    try {
      searchResults = await searchPubMed(searchQuery, 8);
      if (searchResults.length === 0) searchError = 'No results found.';
    } catch {
      searchError = 'Search failed — check connection.';
    } finally {
      searching = false;
    }
  }

  function addToCorpus(paper: PaperResult) {
    if (!ra) return;
    if (ra.corpus.some(p => p.id === paper.id)) { showToast('Already in corpus'); return; }
    const rp: ReviewPaper = {
      id: paper.id, pmid: paper.id,
      title: paper.title,
      authors: paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ' et al.' : ''),
      journal: paper.journal, year: paper.year,
      abstract: paper.abstract, doi: paper.doi, url: paper.url,
      themeIds: [], rating: 2, notes: '',
    };
    ra.corpus = [...ra.corpus, rp];
    scheduleSave();
    showToast('Added to corpus');
  }

  function removeFromCorpus(paperId: string) {
    if (!ra) return;
    ra.corpus = ra.corpus.filter(p => p.id !== paperId);
    ra.themes = ra.themes.map(t => ({ ...t, paperIds: t.paperIds.filter(id => id !== paperId) }));
    scheduleSave();
  }

  function toggleTheme(paperId: string, themeId: string) {
    if (!ra) return;
    const paper = ra.corpus.find(p => p.id === paperId);
    if (!paper) return;
    const has = paper.themeIds.includes(themeId);
    paper.themeIds = has ? paper.themeIds.filter(id => id !== themeId) : [...paper.themeIds, themeId];
    const t = ra.themes.find(t => t.id === themeId);
    if (t) {
      t.paperIds = has ? t.paperIds.filter(id => id !== paperId) : [...t.paperIds, paperId];
    }
    ra.corpus = [...ra.corpus];
    ra.themes = [...ra.themes];
    scheduleSave();
  }

  function setRating(paperId: string, r: 1 | 2 | 3) {
    if (!ra) return;
    const paper = ra.corpus.find(p => p.id === paperId);
    if (paper) { paper.rating = r; ra.corpus = [...ra.corpus]; scheduleSave(); }
  }

  // ── Theme CRUD ─────────────────────────────────────────────────
  function addTheme() {
    if (!ra || !addThemeTitle.trim()) return;
    const t: ReviewTheme = {
      id: nanoid(), title: addThemeTitle.trim(),
      outline: '', content: '',
      wordTarget: addThemeWords, status: 'outline',
      order: ra.themes.length, paperIds: [],
    };
    ra.themes = [...ra.themes, t];
    selectedThemeId = t.id;
    scheduleSave();
    addThemeOpen = false;
    addThemeTitle = ''; addThemeWords = 1500;
  }

  async function deleteTheme(id: string) {
    if (!ra || !confirm('Delete this theme?')) return;
    ra.corpus = ra.corpus.map(p => ({ ...p, themeIds: p.themeIds.filter(tid => tid !== id) }));
    ra.themes = ra.themes.filter(t => t.id !== id);
    if (selectedThemeId === id) selectedThemeId = null;
    scheduleSave();
  }

  function setThemeStatus(s: ReviewThemeStatus) {
    if (!theme) return;
    theme.status = s;
    ra!.themes = [...ra!.themes];
    scheduleSave();
  }

  function setArticleStatus(s: ReviewArticleStatus) {
    if (!ra) return;
    ra.status = s;
    store.reviewArticles = [...store.reviewArticles];
    scheduleSave();
  }

  // ── Enzo synthesis ─────────────────────────────────────────────
  async function doSynthesize() {
    if (!ra || !theme) return;
    if (synthStreaming) { synthAbort?.abort(); synthStreaming = false; return; }
    synthAbort = new AbortController();
    synthText = '';
    synthStreaming = true;
    try {
      await synthesizeReviewTheme(
        theme.title, ra.title,
        themeCorpus.map(p => ({ title: p.title, authors: p.authors, year: p.year, abstract: p.abstract })),
        theme.outline,
        (chunk) => { synthText += chunk; },
        synthAbort.signal
      );
    } catch { /* aborted */ }
    synthStreaming = false;
  }

  function insertSynthesis(mode: 'replace' | 'append') {
    if (!theme || !synthText) return;
    const asHtml = `<p>${synthText.replace(/\n\n+/g, '</p><p>').replace(/\n/g, ' ')}</p>`;
    theme.content = mode === 'replace' ? asHtml : (theme.content || '') + asHtml;
    ra!.themes = [...ra!.themes];
    themeMode = 'draft';
    scheduleSave();
    synthText = '';
  }

  function insertCitation(p: ReviewPaper) {
    if (!theme) return;
    const cite = `[${firstAuthor(p)}, ${p.year}]`;
    theme.content = (theme.content || '') + `<span class="ra-cite">${cite}</span> `;
    ra!.themes = [...ra!.themes];
    scheduleSave();
  }

  // ── Example data ───────────────────────────────────────────────
  function loadExamples() {
    const ex: ReviewArticle[] = [
      {
        id: 'eg-rv-1',
        title: 'Spatial transcriptomics of the HGSOC tumour microenvironment: immunosuppressive architecture and therapeutic implications',
        targetJournal: 'Nature Reviews Cancer',
        scope: 'Comprehensive review mapping the spatial organisation of the HGSOC TME, focusing on LAMP3+ DC immunosuppressive niches, platform comparisons, and therapeutic targeting strategies.',
        status: 'drafting',
        wordTarget: 8000,
        corpus: [
          { id: 'eg1-p1', title: 'Intra-tumoral transcriptomic heterogeneity in HGSOC reveals LAMP3+ DC immunosuppressive niches', authors: 'Hornburg M, Desbois M et al.', journal: 'Nature Cancer', year: 2023, abstract: 'Integrating spatial transcriptomics and scRNA-seq across 40 HGSOC tumour sections reveals spatially organised immunosuppressive niches characterised by LAMP3+ dendritic cells co-localising with exhausted CD8+ T cells at tumour-stroma interfaces. IDO1 upregulation in DC clusters correlates with poor CD8+ infiltration.', doi: '', url: '', themeIds: ['eg1-t1', 'eg1-t3'], rating: 3, notes: 'Primary spatial DC-T cell niche reference.' },
          { id: 'eg1-p2', title: 'scRNA-seq of HGSOC reveals dynamic macrophage polarisation and T cell exhaustion across disease stages', authors: 'Olalekan S, Xin B et al.', journal: 'Nature Communications', year: 2021, abstract: 'scRNA-seq of 12 HGSOC patients identifies MARCO+ TAMs as dominant immunosuppressive cells in primary disease, with progressive CD8+ T cell exhaustion marked by TOX and PDCD1 upregulation in recurrent tumours.', doi: '', url: '', themeIds: ['eg1-t1', 'eg1-t3'], rating: 3, notes: 'Key TAM-T cell axis reference across disease stages.' },
          { id: 'eg1-p3', title: 'Cell2location maps fine-grained cell types in spatial transcriptomics data', authors: 'Kleshchevnikov V, Shmatko A et al.', journal: 'Nature Biotechnology', year: 2022, abstract: 'Cell2location, a Bayesian model for reference-based cell type deconvolution of spatial transcriptomics, substantially outperforms existing methods in recovering fine-grained spatial organisation in complex tissues including solid tumours.', doi: '', url: '', themeIds: ['eg1-t2'], rating: 3, notes: 'Core deconvolution method — used in most HGSOC spatial studies.' },
          { id: 'eg1-p4', title: 'Visium HD enables sub-cellular spatial resolution transcriptomics of solid tumours', authors: '10x Genomics Consortium, Asp M et al.', journal: 'Nature Methods', year: 2024, abstract: 'Visium HD achieves 2μm bin resolution across whole tissue sections, enabling near single-cell resolution spatial transcriptomics and improving cell boundary reconstruction over standard 55μm Visium spots.', doi: '', url: '', themeIds: ['eg1-t2'], rating: 2, notes: 'Important for platform evolution discussion.' },
          { id: 'eg1-p5', title: 'Spatially resolved multi-omics of BRCA1-mutant HGSOC identifies PARPi response niches', authors: 'Regev A, Tanay A et al.', journal: 'Cell', year: 2023, abstract: 'Joint spatial transcriptomics and proteomics reveals spatially defined niches with differential sensitivity to PARP inhibition in BRCA1-mutant HGSOC, with immunosuppressive niches correlating with primary resistance.', doi: '', url: '', themeIds: ['eg1-t3', 'eg1-t4'], rating: 3, notes: 'Critical link between spatial TME and PARPi response heterogeneity.' },
          { id: 'eg1-p6', title: 'IDO1 expression in LAMP3+ DCs mediates CD8+ T cell exclusion via kynurenine accumulation', authors: 'Labidi-Galy SI, Treilleux I et al.', journal: 'Cancer Immunology Research', year: 2022, abstract: 'LAMP3+ dendritic cells in HGSOC express high IDO1 and convert tryptophan to kynurenine, driving functional exhaustion of tumour-infiltrating CD8+ T cells within spatially defined niche boundaries.', doi: '', url: '', themeIds: ['eg1-t3'], rating: 3, notes: 'Mechanistic IDO1 axis in DC-mediated suppression.' },
        ],
        themes: [
          { id: 'eg1-t1', title: 'HGSOC biology and intra-tumoral TME heterogeneity', outline: '• HGSOC as genetically homogeneous but TME-heterogeneous disease\n• TCGA molecular subtypes: immunoreactive, proliferative, mesenchymal, differentiated\n• scRNA-seq evidence for site-specific heterogeneity (omentum vs adnexa vs ascites)\n• Ascites as a distinct immunosuppressive niche vs solid tumour TME', content: '', wordTarget: 1500, status: 'outline', order: 0, paperIds: ['eg1-p1', 'eg1-p2'] },
          { id: 'eg1-t2', title: 'Spatial transcriptomics platforms and cell deconvolution methods', outline: '• Platform comparison: Visium vs Visium HD vs Xenium vs MERFISH\n• Resolution tradeoffs: transcriptome breadth vs spatial resolution vs throughput\n• Deconvolution methods: cell2location, RCTD, CARD, Stereoscope\n• Integration with paired scRNA-seq reference atlases — importance of tumour-matched references', content: '<p>The rapid diversification of spatial transcriptomics platforms has transformed our capacity to resolve the architectural organisation of the HGSOC tumour microenvironment at near-cellular resolution. Standard Visium (10x Genomics) captures the polyadenylated transcriptome at 55 μm spot resolution across whole tumour sections, enabling transcriptome-wide profiling at the cost of subcellular spatial precision [Kleshchevnikov et al., 2022]. The introduction of Visium HD at 2 μm bin resolution and targeted platforms such as Xenium mark a significant technical advance, though each involves tradeoffs between plex, throughput, tissue area, and resolution.</p><p>Cell type deconvolution — resolving the mixture of cell types within each spatial spot — represents a critical analytical layer. Cell2location, a hierarchical Bayesian model trained on paired scRNA-seq references, has demonstrated superior performance in recovering fine-grained TME organisation compared to earlier regression-based methods [Kleshchevnikov et al., 2022]. The quality and cellular composition of the scRNA-seq reference atlas critically determines deconvolution accuracy, underscoring the need for high-quality, tumour site-matched single-cell references for HGSOC studies.</p>', wordTarget: 2000, status: 'draft', order: 1, paperIds: ['eg1-p3', 'eg1-p4'] },
          { id: 'eg1-t3', title: 'Immunosuppressive niches: LAMP3+ DCs, Tregs and T cell exclusion', outline: '• LAMP3+ DC spatial enrichment at tumour-stroma interfaces — spatial co-occurrence with Tregs\n• IDO1 axis and kynurenine-mediated T cell functional exhaustion\n• TOX+ / PD-1+ / TIM-3+ CD8+ T cell phenotype in excluded niches\n• Comparison of immune-desert, excluded and inflamed phenotypes across HGSOC patients', content: '', wordTarget: 2500, status: 'outline', order: 2, paperIds: ['eg1-p1', 'eg1-p2', 'eg1-p5', 'eg1-p6'] },
          { id: 'eg1-t4', title: 'Therapeutic implications of spatial TME mapping', outline: '• Spatial biomarkers for PARPi response prediction\n• Targeting immunosuppressive niches: IDO1 inhibitors, anti-TIGIT, anti-LAG-3\n• Spatial biopsy design considerations for clinical trials', content: '', wordTarget: 1500, status: 'outline', order: 3, paperIds: ['eg1-p5'] },
        ],
        createdAt: Date.now() - 35 * 86400000,
        updatedAt: Date.now() - 3 * 86400000,
      },
      {
        id: 'eg-rv-2',
        title: 'PARPi resistance in BRCA-mutated HGSOC: molecular mechanisms and clinical strategies',
        targetJournal: 'Journal of Clinical Oncology',
        scope: 'Systematic review of acquired and primary PARPi resistance mechanisms in HGSOC, covering HR restoration, non-HR pathways, and combination strategies to overcome resistance.',
        status: 'outline',
        wordTarget: 7000,
        corpus: [
          { id: 'eg2-p1', title: 'Mechanisms of PARP inhibitor resistance in ovarian cancer', authors: 'Dias MP, Moser SC et al.', journal: 'Nature Reviews Cancer', year: 2021, abstract: 'Comprehensive review of PARPi resistance mechanisms categorised as HR pathway restoration (reversion mutations, RAD51 paralog upregulation) versus HR-independent mechanisms (53BP1 loss, drug efflux, PARP1 downregulation).', doi: '', url: '', themeIds: ['eg2-t1', 'eg2-t2', 'eg2-t3'], rating: 3, notes: 'Comprehensive resistance mechanisms overview — primary reference.' },
          { id: 'eg2-p2', title: 'BRCA1 reversion mutations drive olaparib resistance in HGSOC', authors: 'Patch AM, Christie EL et al.', journal: 'Nature', year: 2015, abstract: 'Whole-genome sequencing of olaparib-resistant HGSOC identifies BRCA1 reversion mutations that restore open reading frame in 46% of post-PARPi progression samples, restoring HR capacity.', doi: '', url: '', themeIds: ['eg2-t2'], rating: 3, notes: 'Foundational paper for reversion mutation mechanism.' },
          { id: 'eg2-p3', title: '53BP1 loss enables BRCA1-independent homologous recombination and PARPi resistance', authors: 'Bouwman P, Aly A et al.', journal: 'Nature Structural and Molecular Biology', year: 2010, abstract: 'Loss of 53BP1 restores end-resection in BRCA1-null tumours, enabling RAD51-mediated HR and conferring resistance to PARPi without BRCA1 reversion, identifying a clinically relevant non-HR-restoration resistance route.', doi: '', url: '', themeIds: ['eg2-t3'], rating: 3, notes: 'Key 53BP1-NHEJ/HR balance mechanism.' },
          { id: 'eg2-p4', title: 'PARPi + atezolizumab in HGSOC: ATALANTE clinical trial', authors: 'Ray-Coquard I, Leary A et al.', journal: 'The Lancet Oncology', year: 2023, abstract: 'Phase II ATALANTE trial shows modest benefit of olaparib + atezolizumab in platinum-resistant HGSOC; exploratory biomarker analyses suggest CD8+ T cell density and cGAS-STING pathway activity associate with response.', doi: '', url: '', themeIds: ['eg2-t4'], rating: 2, notes: 'PARPi + IO combination evidence; cGAS-STING rationale.' },
          { id: 'eg2-p5', title: 'HRD scoring beyond BRCA: the BRCAness landscape in HGSOC', authors: 'Marquard AM, Eklund AC et al.', journal: 'Nature Methods', year: 2015, abstract: 'Genome-wide LOH, TAI and LST-based BRCAness scoring identifies HR-deficient tumours beyond BRCA1/2 mutation, with the composite HRD score validating across TCGA HGSOC and predicting PARPi sensitivity.', doi: '', url: '', themeIds: ['eg2-t5'], rating: 3, notes: 'Foundational HRD scoring methodology — Myriad MyChoice basis.' },
        ],
        themes: [
          { id: 'eg2-t1', title: 'PARPi mechanism: synthetic lethality and PARP trapping', outline: '• Synthetic lethality rationale: BER dependency in HR-deficient cells\n• PARP trapping potency hierarchy: talazoparib > niraparib > olaparib > rucaparib\n• cGAS-STING activation as secondary PARPi effect — immune priming rationale', content: '', wordTarget: 1200, status: 'outline', order: 0, paperIds: ['eg2-p1'] },
          { id: 'eg2-t2', title: 'HR restoration: reversion mutations and RAD51 paralog upregulation', outline: '• BRCA1/2 reversion mutations — frequency, timing, WGS detection\n• RAD51 paralog (PALB2, BRCA2 interactors) secondary mutations\n• Polyclonal resistance — multiple resistance clones at progression\n• Clinical implications: re-challenge feasibility?', content: '', wordTarget: 1800, status: 'outline', order: 1, paperIds: ['eg2-p1', 'eg2-p2'] },
          { id: 'eg2-t3', title: 'Non-HR resistance pathways: 53BP1, NHEJ upregulation and drug efflux', outline: '• 53BP1/RIF1 loss restores end resection in BRCA1-null cells\n• NHEJ upregulation as bypass mechanism\n• ABCB1 drug efflux transporter upregulation — relevance in clinical samples\n• PARP1 protein loss — rare but cleanly confers resistance', content: '', wordTarget: 1500, status: 'outline', order: 2, paperIds: ['eg2-p1', 'eg2-p3'] },
          { id: 'eg2-t4', title: 'Combination strategies: PARPi + IO and anti-angiogenics', outline: '• cGAS-STING rationale for PARPi + anti-PD-L1 combination\n• DUO-O, ATALANTE, IMagyn050 trial results and lessons\n• Bevacizumab + PARPi (PAOLA-1) — which patients benefit?\n• Future combinations: PARPi + TIGIT, LAG-3', content: '', wordTarget: 1500, status: 'outline', order: 3, paperIds: ['eg2-p4'] },
          { id: 'eg2-t5', title: 'Predictive biomarkers: BRCAness scores and HRD assays', outline: '• LOH, TAI, LST — what each measures and limitations\n• Myriad MyChoice vs FoundationOne HRD — concordance data\n• Tumour mutational burden as poor predictor in HGSOC — why\n• Emerging: RAD51 foci scoring as functional HR assay', content: '', wordTarget: 1000, status: 'outline', order: 4, paperIds: ['eg2-p5'] },
        ],
        createdAt: Date.now() - 18 * 86400000,
        updatedAt: Date.now() - 8 * 86400000,
      },
      {
        id: 'eg-rv-3',
        title: 'NK cell dysfunction in ovarian cancer ascites: mechanisms and therapeutic opportunities',
        targetJournal: 'Cancer Immunology Research',
        scope: 'Focused review of NK cell suppression in the HGSOC ascites microenvironment, covering suppressive soluble factors, receptor downregulation, and NK cell-based therapeutic strategies.',
        status: 'planning',
        wordTarget: 5500,
        corpus: [
          { id: 'eg3-p1', title: 'NK cell receptor downregulation in HGSOC ascites correlates with poor prognosis', authors: 'Carlsten M, Norell H et al.', journal: 'European Journal of Immunology', year: 2020, abstract: 'NK cells isolated from HGSOC ascites show significant downregulation of NKG2D, NKp30 and NKp46 compared to matched peripheral blood, with VEGF and TGF-β identified as primary suppressive soluble factors.', doi: '', url: '', themeIds: ['eg3-t2'], rating: 3, notes: 'Primary NK receptor downregulation data in ascites.' },
          { id: 'eg3-p2', title: 'IL-18 restores NK cell cytotoxicity in ascites — a phase I signal', authors: 'Romee R, Leong JW et al.', journal: 'Blood', year: 2022, abstract: 'IL-18 stimulation restores NKG2D expression and cytotoxic function in ascites-exhausted NK cells ex vivo, providing rationale for IL-18-based NK cell priming strategies in ovarian cancer.', doi: '', url: '', themeIds: ['eg3-t2', 'eg3-t3'], rating: 2, notes: 'IL-18 restoration signal — early evidence.' },
          { id: 'eg3-p3', title: 'CAR-NK cells targeting FRα in ovarian cancer: preclinical efficacy', authors: 'Marin D, Li Y et al.', journal: 'Nature Medicine', year: 2023, abstract: 'CAR-NK cells targeting folate receptor alpha (FRα) demonstrate potent in vitro and xenograft killing of HGSOC lines, with cord blood-derived CAR-NKs showing superior persistence over CAR-T cells in ascites models.', doi: '', url: '', themeIds: ['eg3-t3'], rating: 3, notes: 'FRα CAR-NK — strong therapeutic rationale for HGSOC.' },
          { id: 'eg3-p4', title: 'NKG2D ligands shed by HGSOC cells impair NK cell activation', authors: 'Groh V, Wu J et al.', journal: 'Nature Immunology', year: 2022, abstract: 'HGSOC cells shed NKG2D ligands (MICA, MICB, ULBP) into ascites via ADAM10/17 metalloprotease cleavage, reducing NK cell NKG2D surface expression and impairing tumour cell killing.', doi: '', url: '', themeIds: ['eg3-t2'], rating: 3, notes: 'Ligand shedding mechanism — mechanistically important.' },
          { id: 'eg3-p5', title: 'NK cell biology: activation, licensing and education', authors: 'Vivier E, Raulet DH et al.', journal: 'Science', year: 2011, abstract: 'Comprehensive review of NK cell activation receptor biology, education/licensing by KIR-MHC interactions, and the balance of activating vs inhibitory signals determining NK cell functional thresholds.', doi: '', url: '', themeIds: ['eg3-t1'], rating: 2, notes: 'Foundational NK biology reference for introduction.' },
        ],
        themes: [
          { id: 'eg3-t1', title: 'NK cell activation, receptor biology and functional licensing', outline: '• Activating receptors: NKG2D, NKp30, NKp46, DNAM-1\n• Inhibitory receptors: KIR, NKG2A/CD94\n• NK licensing/education by KIR-MHC interactions\n• Missing-self hypothesis — relevance in MHC-low HGSOC', content: '', wordTarget: 1200, status: 'outline', order: 0, paperIds: ['eg3-p5'] },
          { id: 'eg3-t2', title: 'Ascites as an immunosuppressive NK cell niche', outline: '• Soluble suppressive factors: VEGF, TGF-β, IL-10, prostaglandin E2\n• Ligand shedding: MICA/MICB cleavage by ADAM10/17\n• NKG2D, NKp30, NKp46 receptor downregulation in ascites NK cells\n• Metabolic suppression: glucose deprivation and lactate accumulation', content: '', wordTarget: 1800, status: 'outline', order: 1, paperIds: ['eg3-p1', 'eg3-p2', 'eg3-p4'] },
          { id: 'eg3-t3', title: 'NK cell-based therapeutic strategies in ovarian cancer', outline: '• Adoptive NK cell transfer — autologous vs allogeneic\n• CAR-NK cells targeting FRα, EpCAM, HER2\n• IL-15/IL-18 cytokine priming strategies\n• Bispecific NK cell engagers (BiKEs, TriKEs)\n• Combination with immune checkpoint blockade', content: '', wordTarget: 1800, status: 'outline', order: 2, paperIds: ['eg3-p2', 'eg3-p3'] },
        ],
        createdAt: Date.now() - 7 * 86400000,
        updatedAt: Date.now() - 7 * 86400000,
      },
    ];
    store.reviewArticles = ex;
    selectedId = ex[0].id;
    selectedThemeId = ex[0].themes[0].id;
    store.saveReviewArticles();
    showToast('Example reviews loaded');
  }

  const STATUS_ORDER: ReviewArticleStatus[] = ['planning', 'outline', 'drafting', 'polishing', 'submitted'];
  const THEME_STATUS_ORDER: ReviewThemeStatus[] = ['outline', 'draft', 'polished'];
  const STATUS_COLORS: Record<ReviewArticleStatus, string> = {
    planning: 'var(--tx2)', outline: 'var(--yw)', drafting: 'var(--ac)',
    polishing: 'var(--pu)', submitted: 'var(--gn)',
  };
  const THEME_STATUS_COLORS: Record<ReviewThemeStatus, string> = {
    outline: 'var(--tx2)', draft: 'var(--ac)', polished: 'var(--gn)',
  };
</script>

<!-- ── Shell ─────────────────────────────────────────────────── -->
<div class="ra-shell">

  <!-- Left: article list -->
  <aside class="ra-sidebar">
    <div class="ra-sidebar-head">
      <span class="ra-sidebar-title">Reviews</span>
      <button class="btn-icon" onclick={() => { newOpen = true; }} title="New review">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>

    {#each store.reviewArticles as r (r.id)}
      {@const prog = articleProgress(r)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="ra-card"
        class:ra-card-active={selectedId === r.id}
        onclick={() => { selectedId = r.id; selectedThemeId = r.themes[0]?.id ?? null; }}
      >
        <div class="ra-card-title">{r.title}</div>
        <div class="ra-card-meta">
          <span class="status-dot" style="background:{STATUS_COLORS[r.status]}" title={r.status}></span>
          <span class="ra-card-sub">{r.themes.length} themes · {r.corpus.length} papers</span>
        </div>
        <div class="ra-prog-track">
          <div class="ra-prog-fill" style="width:{prog}%"></div>
        </div>
        <button class="ra-del-btn" onclick={(e) => { e.stopPropagation(); deleteArticle(r.id); }} title="Delete">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    {:else}
      <div class="ra-empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--bd2)" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        <p>No review articles yet.</p>
        <button class="btn btn-primary btn-sm" onclick={loadExamples}>Load examples</button>
        <button class="btn btn-ghost btn-sm" onclick={() => newOpen = true}>Start blank</button>
      </div>
    {/each}
  </aside>

  <!-- Middle: corpus + themes -->
  {#if ra}
    <div class="ra-middle">
      <!-- Article header -->
      <div class="ra-article-head">
        <input
          class="ra-article-title-input"
          bind:value={ra.title}
          oninput={scheduleSave}
          placeholder="Review title"
        />
        <div class="ra-article-meta-row">
          <input class="ra-journal-input" bind:value={ra.targetJournal} oninput={scheduleSave} placeholder="Target journal" />
          <select class="status-select-sm" value={ra.status} onchange={(e) => setArticleStatus((e.target as HTMLSelectElement).value as ReviewArticleStatus)}>
            {#each STATUS_ORDER as s}
              <option value={s}>{s}</option>
            {/each}
          </select>
        </div>
        <div class="ra-word-summary">
          <span class="ra-word-count">{totalWords.toLocaleString()} / {ra.wordTarget.toLocaleString()} words</span>
          <div class="ra-total-prog">
            <div class="ra-total-fill" style="width:{Math.min(100, Math.round(totalWords / ra.wordTarget * 100))}%"></div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="ra-mid-tabs">
        <button class="ra-tab" class:ra-tab-active={middleTab === 'themes'} onclick={() => middleTab = 'themes'}>
          Themes <span class="tab-badge">{ra.themes.length}</span>
        </button>
        <button class="ra-tab" class:ra-tab-active={middleTab === 'corpus'} onclick={() => middleTab = 'corpus'}>
          Corpus <span class="tab-badge">{ra.corpus.length}</span>
        </button>
      </div>

      <!-- Themes tab -->
      {#if middleTab === 'themes'}
        <div class="ra-mid-body">
          {#each ra.themes as t, i (t.id)}
            {@const thin = t.paperIds.length < 3}
            <button
              class="theme-row"
              class:theme-row-active={selectedThemeId === t.id}
              onclick={() => { selectedThemeId = t.id; themeMode = 'outline'; synthText = ''; }}
            >
              <div class="theme-row-head">
                <span class="theme-num">{i + 1}</span>
                <span class="theme-row-title">{t.title}</span>
                <span class="theme-status-pill" style="color:{THEME_STATUS_COLORS[t.status]}">{t.status}</span>
              </div>
              <div class="theme-row-meta">
                <span>{t.paperIds.length} paper{t.paperIds.length !== 1 ? 's' : ''}</span>
                {#if thin}<span class="thin-warn">thin coverage</span>{/if}
                <span class="theme-words">{wc(t.content)} / {t.wordTarget}w</span>
              </div>
              <div class="theme-mini-bar">
                <div class="theme-mini-fill" style="width:{Math.min(100, Math.round(wc(t.content)/t.wordTarget*100))}%;background:{THEME_STATUS_COLORS[t.status]}"></div>
              </div>
            </button>
          {:else}
            <p class="ra-tab-empty">No themes yet. Add your first section.</p>
          {/each}

          {#if addThemeOpen}
            <div class="add-theme-form">
              <input class="inp" bind:value={addThemeTitle} placeholder="Theme title" autofocus />
              <div class="add-theme-row">
                <input class="inp inp-sm" type="number" bind:value={addThemeWords} min="200" max="5000" step="100" />
                <span class="inp-label">word target</span>
                <button class="btn btn-primary btn-sm" onclick={addTheme} disabled={!addThemeTitle.trim()}>Add</button>
                <button class="btn btn-ghost btn-sm" onclick={() => { addThemeOpen = false; addThemeTitle = ''; }}>Cancel</button>
              </div>
            </div>
          {:else}
            <button class="add-theme-btn" onclick={() => addThemeOpen = true}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add theme
            </button>
          {/if}
        </div>

      <!-- Corpus tab -->
      {:else}
        <div class="ra-mid-body">
          <!-- PubMed search -->
          <div class="corpus-search">
            <input
              class="inp corpus-inp"
              bind:value={searchQuery}
              placeholder="Search PubMed…"
              onkeydown={(e) => e.key === 'Enter' && doSearch()}
            />
            <button class="btn btn-primary btn-sm" onclick={doSearch} disabled={searching}>
              {searching ? '…' : 'Search'}
            </button>
          </div>
          {#if searchError}<p class="search-err">{searchError}</p>{/if}

          {#if searchResults.length > 0}
            <div class="search-results">
              {#each searchResults as p (p.id)}
                <div class="search-result-item">
                  <div class="sri-title">{p.title}</div>
                  <div class="sri-meta">{p.authors[0] ?? ''}{p.authors.length > 1 ? ' et al.' : ''} · {p.journal} · {p.year}</div>
                  <button class="btn btn-ghost btn-xs" onclick={() => addToCorpus(p)}
                    disabled={ra.corpus.some(c => c.id === p.id)}>
                    {ra.corpus.some(c => c.id === p.id) ? 'Added' : '+ Add'}
                  </button>
                </div>
              {/each}
              <button class="btn btn-ghost btn-xs" onclick={() => { searchResults = []; searchQuery = ''; }}>Clear</button>
            </div>
          {/if}

          <!-- Corpus list -->
          {#each ra.corpus as paper (paper.id)}
            <div class="corpus-card" class:corpus-card-open={corpusExpanded === paper.id}>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="corpus-card-head" onclick={() => corpusExpanded = corpusExpanded === paper.id ? null : paper.id} role="button" tabindex="0">
                <span class="corpus-rating">
                  {#each [1,2,3] as star}
                    <button class="star-btn" class:star-on={paper.rating >= star}
                      onclick={(e) => { e.stopPropagation(); setRating(paper.id, star as 1|2|3); }}>★</button>
                  {/each}
                </span>
                <span class="corpus-title">{paper.title}</span>
                <span class="corpus-year">{paper.year}</span>
              </div>
              {#if corpusExpanded === paper.id}
                <div class="corpus-expand">
                  <p class="corpus-authors">{paper.authors} · {paper.journal} · {paper.year}</p>
                  {#if paper.abstract}
                    <p class="corpus-abstract">{paper.abstract.slice(0, 220)}…</p>
                  {/if}
                  <textarea
                    class="corpus-notes"
                    bind:value={paper.notes}
                    oninput={scheduleSave}
                    placeholder="Notes on this paper…"
                    rows="2"
                  ></textarea>
                  <div class="theme-assign">
                    <p class="theme-assign-label">Assign to themes:</p>
                    {#each ra.themes as t}
                      <label class="theme-check">
                        <input type="checkbox"
                          checked={paper.themeIds.includes(t.id)}
                          onchange={() => toggleTheme(paper.id, t.id)}
                        />
                        {t.title}
                      </label>
                    {/each}
                    {#if ra.themes.length === 0}
                      <p class="theme-assign-empty">Add themes first</p>
                    {/if}
                  </div>
                  <button class="btn btn-ghost btn-xs danger-btn" onclick={() => removeFromCorpus(paper.id)}>Remove from corpus</button>
                </div>
              {/if}
            </div>
          {:else}
            <p class="ra-tab-empty">Search PubMed above to build your corpus.</p>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Right: section editor -->
    <div class="ra-editor">
      {#if theme}
        <!-- Editor header -->
        <div class="editor-head">
          <div class="editor-head-top">
            <input
              class="theme-title-input"
              bind:value={theme.title}
              oninput={() => { ra!.themes = [...ra!.themes]; scheduleSave(); }}
              placeholder="Theme title"
            />
            <button class="btn-icon theme-delete-btn" onclick={() => deleteTheme(theme!.id)} title="Delete theme">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
          <div class="editor-head-controls">
            <div class="mode-toggle">
              <button class="mode-btn" class:mode-active={themeMode === 'outline'} onclick={() => themeMode = 'outline'}>Outline</button>
              <button class="mode-btn" class:mode-active={themeMode === 'draft'} onclick={() => themeMode = 'draft'}>Draft</button>
            </div>
            <select
              class="status-select-sm"
              value={theme.status}
              onchange={(e) => setThemeStatus((e.target as HTMLSelectElement).value as ReviewThemeStatus)}
            >
              {#each THEME_STATUS_ORDER as s}
                <option value={s}>{s}</option>
              {/each}
            </select>
            <span class="word-tally">{wc(theme.content)} / {theme.wordTarget}w</span>
          </div>
        </div>

        <!-- Outline mode -->
        {#if themeMode === 'outline'}
          <div class="outline-area-wrap">
            <textarea
              class="outline-area"
              bind:value={theme.outline}
              oninput={() => { ra!.themes = [...ra!.themes]; scheduleSave(); }}
              placeholder="• Key claim or argument&#10;• Supporting evidence&#10;• Contradictions in the field&#10;• Open question this section addresses"
            ></textarea>
          </div>
          {#if themeCorpus.length > 0}
            <div class="outline-refs">
              <p class="outline-refs-label">Assigned papers ({themeCorpus.length})</p>
              {#each themeCorpus as p}
                <div class="outline-ref-item">
                  <span class="ref-rating">{'★'.repeat(p.rating)}</span>
                  <span class="ref-cite">[{firstAuthor(p)}, {p.year}]</span>
                  <span class="ref-title">{p.title.slice(0, 70)}{p.title.length > 70 ? '…' : ''}</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="outline-no-papers">No papers assigned — go to Corpus tab to assign papers to this theme.</p>
          {/if}

        <!-- Draft mode -->
        {:else}
          <div class="draft-wrap">
            <RichEditor
              bind:value={theme.content}
              placeholder="Write your synthesis here…"
              minHeight="240px"
              onchange={() => { ra!.themes = [...ra!.themes]; scheduleSave(); }}
            />
          </div>
          {#if themeCorpus.length > 0}
            <div class="cite-strip">
              <span class="cite-strip-label">Insert citation:</span>
              {#each themeCorpus as p}
                <button class="cite-btn" onclick={() => insertCitation(p)} title="{p.title}">
                  [{firstAuthor(p)}, {p.year}]
                </button>
              {/each}
            </div>
          {/if}
        {/if}

        <!-- Enzo synthesis panel -->
        <div class="synth-panel">
          <div class="synth-panel-head">
            <span class="synth-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--enzo)" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 8v4l3 3"/></svg>
              Enzo synthesis
            </span>
            <button
              class="btn btn-enzo btn-sm"
              onclick={doSynthesize}
            >
              {#if synthStreaming}Stop{:else}{synthText ? 'Re-synthesize' : 'Synthesize theme'}<span class="model-pill">[70B]</span>{/if}
            </button>
          </div>
          {#if synthText || synthStreaming}
            <div class="synth-output" class:synth-streaming={synthStreaming}>
              {synthText}{#if synthStreaming}<span class="synth-cursor">▌</span>{/if}
            </div>
            {#if !synthStreaming && synthText}
              <div class="synth-actions">
                <button class="btn btn-ghost btn-xs" onclick={() => insertSynthesis('replace')}>Replace draft</button>
                <button class="btn btn-ghost btn-xs" onclick={() => insertSynthesis('append')}>Append to draft</button>
                <button class="btn btn-ghost btn-xs" onclick={() => synthText = ''}>Dismiss</button>
              </div>
            {/if}
          {/if}
        </div>

      {:else}
        <div class="editor-placeholder">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--bd2)" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <p>Select a theme to start writing,<br>or add a new one in the Themes tab.</p>
        </div>
      {/if}
    </div>

  {:else}
    <!-- No article selected -->
    <div class="ra-no-selection">
      {#if store.reviewArticles.length > 0}
        <p>Select a review article to open it.</p>
      {:else}
        <div class="ra-welcome">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--bd2)" stroke-width="1.2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <h3>Review Article Writer</h3>
          <p>Build your literature corpus, organise by theme, and write your synthesis section by section — with Enzo to help.</p>
          <div class="ra-welcome-actions">
            <button class="btn btn-primary" onclick={loadExamples}>Load HGSOC examples</button>
            <button class="btn btn-ghost" onclick={() => newOpen = true}>Start blank</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- New article modal -->
{#if newOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => newOpen = false}></div>
  <div class="modal">
    <h3 class="modal-title">New review article</h3>
    <label class="field-label">Title
      <input class="inp" bind:value={newTitle} placeholder="e.g. Spatial transcriptomics of the HGSOC TME" autofocus />
    </label>
    <label class="field-label">Target journal
      <input class="inp" bind:value={newJournal} placeholder="e.g. Nature Reviews Cancer" />
    </label>
    <label class="field-label">Scope / focus
      <textarea class="inp" bind:value={newScope} rows="2" placeholder="One or two sentences describing the review's scope…"></textarea>
    </label>
    <label class="field-label">Word target
      <input class="inp inp-sm" type="number" bind:value={newWordTarget} min="2000" max="20000" step="500" />
    </label>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick={createArticle} disabled={!newTitle.trim()}>Create</button>
      <button class="btn btn-ghost" onclick={() => newOpen = false}>Cancel</button>
    </div>
  </div>
{/if}

<style>
  /* ── Shell layout ──────────────────────────────────────────── */
  .ra-shell {
    display: grid;
    grid-template-columns: 220px 280px 1fr;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
  }

  /* ── Left sidebar ─────────────────────────────────────────── */
  .ra-sidebar {
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ra-sidebar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 14px 10px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .ra-sidebar-title {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--tx2);
  }

  .ra-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 14px;
    border: none;
    border-bottom: 1px solid var(--bd);
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background var(--transition);
    width: 100%;
  }
  .ra-card:hover { background: var(--sf2); }
  .ra-card-active { background: var(--ac-bg); border-right: 2px solid var(--ac); }

  .ra-card-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--tx);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    padding-right: 16px;
  }

  .ra-card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ra-card-sub {
    font-size: 0.63rem;
    color: var(--tx2);
  }

  .ra-prog-track {
    height: 2px;
    background: var(--bd);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 2px;
  }
  .ra-prog-fill {
    height: 100%;
    background: var(--ac);
    border-radius: 2px;
    transition: width 0.4s ease;
  }

  .ra-del-btn {
    position: absolute;
    top: 8px; right: 8px;
    background: transparent;
    border: none;
    color: var(--tx2);
    cursor: pointer;
    opacity: 0;
    padding: 2px;
    border-radius: 4px;
    transition: opacity var(--transition);
    display: flex;
  }
  .ra-card:hover .ra-del-btn { opacity: 1; }
  .ra-del-btn:hover { color: var(--rd); background: var(--rd-bg, color-mix(in srgb, var(--rd) 12%, transparent)); }

  .ra-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 32px 16px;
    color: var(--tx2);
    font-size: 0.8rem;
    text-align: center;
  }

  /* ── Middle panel ────────────────────────────────────────── */
  .ra-middle {
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ra-article-head {
    padding: 12px 14px 10px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ra-article-title-input {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--tx);
    background: transparent;
    border: none;
    outline: none;
    width: 100%;
    padding: 0;
    line-height: 1.3;
  }
  .ra-article-title-input:focus { color: var(--ac); }

  .ra-article-meta-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .ra-journal-input {
    flex: 1;
    font-size: 0.68rem;
    color: var(--tx2);
    background: transparent;
    border: none;
    outline: none;
    min-width: 0;
  }
  .ra-journal-input:focus { color: var(--tx); }

  .status-select-sm {
    font-size: 0.65rem;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    color: var(--tx2);
    padding: 2px 4px;
    cursor: pointer;
  }

  .ra-word-summary {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ra-word-count {
    font-size: 0.62rem;
    color: var(--tx2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .ra-total-prog {
    flex: 1;
    height: 3px;
    background: var(--bd);
    border-radius: 3px;
    overflow: hidden;
  }
  .ra-total-fill {
    height: 100%;
    background: var(--ac);
    border-radius: 3px;
    transition: width 0.4s;
  }

  /* ── Tabs ───────────────────────────────────────────────── */
  .ra-mid-tabs {
    display: flex;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .ra-tab {
    flex: 1;
    padding: 8px 10px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--tx2);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: all var(--transition);
  }
  .ra-tab:hover { color: var(--tx); }
  .ra-tab-active { color: var(--ac); border-bottom-color: var(--ac); }

  .tab-badge {
    background: var(--sf2);
    border-radius: 10px;
    padding: 0 5px;
    font-size: 0.6rem;
    color: var(--tx2);
  }

  .ra-mid-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  /* ── Theme rows ─────────────────────────────────────────── */
  .theme-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 14px;
    border: none;
    border-bottom: 1px solid var(--bd);
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background var(--transition);
    width: 100%;
  }
  .theme-row:hover { background: var(--sf2); }
  .theme-row-active { background: var(--ac-bg); border-left: 2px solid var(--ac); }

  .theme-row-head {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .theme-num {
    font-size: 0.6rem;
    color: var(--tx2);
    background: var(--sf2);
    border-radius: 4px;
    padding: 1px 5px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .theme-row-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--tx);
    line-height: 1.3;
    flex: 1;
    min-width: 0;
  }

  .theme-status-pill {
    font-size: 0.6rem;
    font-weight: 600;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .theme-row-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.63rem;
    color: var(--tx2);
    padding-left: 22px;
  }

  .thin-warn {
    color: var(--yw);
    font-weight: 600;
    font-size: 0.6rem;
  }

  .theme-words { color: var(--tx2); }

  .theme-mini-bar {
    height: 2px;
    background: var(--bd);
    border-radius: 2px;
    overflow: hidden;
    margin-left: 22px;
    margin-top: 2px;
  }
  .theme-mini-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }

  .ra-tab-empty {
    padding: 20px 14px;
    font-size: 0.75rem;
    color: var(--tx2);
    text-align: center;
  }

  /* ── Add theme form ──────────────────────────────────────── */
  .add-theme-form {
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--bd);
  }

  .add-theme-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .inp-sm { width: 70px; }
  .inp-label { font-size: 0.65rem; color: var(--tx2); }

  .add-theme-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    font-size: 0.72rem;
    color: var(--tx2);
    background: transparent;
    border: none;
    border-top: 1px solid var(--bd);
    cursor: pointer;
    transition: color var(--transition);
    margin-top: auto;
  }
  .add-theme-btn:hover { color: var(--ac); }

  /* ── Corpus ─────────────────────────────────────────────── */
  .corpus-search {
    display: flex;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .corpus-inp { flex: 1; }

  .search-err {
    padding: 6px 12px;
    font-size: 0.7rem;
    color: var(--rd);
  }

  .search-results {
    border-bottom: 1px solid var(--bd);
    padding: 6px 0;
  }

  .search-result-item {
    padding: 7px 12px;
    border-bottom: 1px solid var(--bd);
  }
  .search-result-item:last-of-type { border-bottom: none; }

  .sri-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--tx);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .sri-meta {
    font-size: 0.63rem;
    color: var(--tx2);
    margin: 2px 0 4px;
  }

  .corpus-card {
    border-bottom: 1px solid var(--bd);
  }

  .corpus-card-head {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background var(--transition);
  }
  .corpus-card-head:hover { background: var(--sf2); }

  .corpus-rating {
    display: flex;
    gap: 1px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .star-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.7rem;
    color: var(--bd2);
    padding: 0;
    line-height: 1;
    transition: color var(--transition);
  }
  .star-btn.star-on { color: var(--yw); }
  .star-btn:hover { color: var(--yw); }

  .corpus-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--tx);
    line-height: 1.3;
    flex: 1;
    min-width: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .corpus-year {
    font-size: 0.62rem;
    color: var(--tx2);
    flex-shrink: 0;
  }

  .corpus-expand {
    padding: 0 12px 10px 38px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .corpus-authors {
    font-size: 0.63rem;
    color: var(--tx2);
    margin: 0;
  }

  .corpus-abstract {
    font-size: 0.65rem;
    color: var(--tx2);
    line-height: 1.45;
    margin: 0;
    font-style: italic;
  }

  .corpus-notes {
    width: 100%;
    font-size: 0.7rem;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    color: var(--tx);
    padding: 4px 7px;
    resize: none;
    font-family: var(--font);
  }

  .theme-assign { display: flex; flex-direction: column; gap: 3px; }
  .theme-assign-label { font-size: 0.62rem; color: var(--tx2); font-weight: 600; margin: 0; }
  .theme-check {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.68rem;
    color: var(--tx);
    cursor: pointer;
  }
  .theme-assign-empty { font-size: 0.65rem; color: var(--tx2); font-style: italic; margin: 0; }

  .danger-btn { color: var(--rd) !important; }
  .danger-btn:hover { background: color-mix(in srgb, var(--rd) 10%, transparent) !important; }

  /* ── Right editor ────────────────────────────────────────── */
  .ra-editor {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ra-no-selection {
    grid-column: 2 / 4;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tx2);
    font-size: 0.82rem;
  }

  .ra-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    max-width: 320px;
  }

  .ra-welcome h3 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--tx);
    margin: 0;
  }

  .ra-welcome p {
    font-size: 0.8rem;
    color: var(--tx2);
    line-height: 1.5;
    margin: 0;
  }

  .ra-welcome-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .editor-head {
    padding: 12px 16px 10px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .editor-head-top {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .theme-title-input {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--tx);
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    line-height: 1.3;
    min-width: 0;
  }
  .theme-title-input:focus { color: var(--ac); }

  .theme-delete-btn { color: var(--tx2); flex-shrink: 0; }
  .theme-delete-btn:hover { color: var(--rd); }

  .editor-head-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mode-toggle {
    display: flex;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .mode-btn {
    padding: 3px 10px;
    font-size: 0.68rem;
    font-weight: 600;
    background: transparent;
    border: none;
    color: var(--tx2);
    cursor: pointer;
    transition: all var(--transition);
  }
  .mode-active {
    background: var(--ac);
    color: #fff;
  }

  .word-tally {
    font-size: 0.63rem;
    color: var(--tx2);
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }

  /* ── Outline area ──────────────────────────────────────── */
  .outline-area-wrap {
    flex: 1;
    padding: 12px 16px;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .outline-area {
    flex: 1;
    width: 100%;
    font-size: 0.82rem;
    line-height: 1.6;
    color: var(--tx);
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    font-family: var(--mono);
    min-height: 160px;
  }

  .outline-refs {
    border-top: 1px solid var(--bd);
    padding: 10px 16px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .outline-refs-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--tx2);
    margin: 0 0 4px;
  }

  .outline-ref-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.68rem;
    line-height: 1.4;
  }

  .ref-rating { color: var(--yw); flex-shrink: 0; }

  .ref-cite {
    font-weight: 600;
    color: var(--ac);
    flex-shrink: 0;
    font-size: 0.65rem;
  }

  .ref-title { color: var(--tx2); }

  .outline-no-papers {
    padding: 12px 16px;
    font-size: 0.72rem;
    color: var(--tx2);
    font-style: italic;
    border-top: 1px solid var(--bd);
  }

  /* ── Draft area ───────────────────────────────────────── */
  .draft-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    min-height: 0;
  }

  .cite-strip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 16px;
    border-top: 1px solid var(--bd);
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .cite-strip-label {
    font-size: 0.62rem;
    color: var(--tx2);
    font-weight: 600;
    white-space: nowrap;
  }

  .cite-btn {
    font-size: 0.63rem;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    color: var(--ac);
    padding: 2px 7px;
    cursor: pointer;
    font-weight: 600;
    transition: all var(--transition);
    white-space: nowrap;
  }
  .cite-btn:hover { background: var(--ac-bg); border-color: var(--ac); }

  :global(.ra-cite) {
    color: var(--ac);
    font-weight: 600;
  }

  /* ── Enzo synthesis panel ────────────────────────────── */
  .synth-panel {
    border-top: 1px solid var(--bd);
    padding: 10px 16px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .synth-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .synth-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--enzo);
  }

  .btn-enzo {
    background: color-mix(in srgb, var(--enzo) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--enzo) 30%, transparent);
    color: var(--enzo);
  }
  .btn-enzo:hover {
    background: color-mix(in srgb, var(--enzo) 22%, transparent);
  }

  .synth-output {
    font-size: 0.75rem;
    line-height: 1.6;
    color: var(--tx);
    background: color-mix(in srgb, var(--enzo) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--enzo) 15%, transparent);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    white-space: pre-wrap;
    max-height: 180px;
    overflow-y: auto;
  }

  .synth-streaming { border-color: var(--enzo); }

  .synth-cursor {
    display: inline-block;
    color: var(--enzo);
    animation: blink 0.8s step-end infinite;
  }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

  .synth-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* ── Editor placeholder ───────────────────────────────── */
  .editor-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--tx2);
    font-size: 0.78rem;
    text-align: center;
    padding: 24px;
  }

  /* ── Modal ───────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 200;
  }

  .modal {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 201;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 24px;
    width: min(480px, 92vw);
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: var(--shadow-lg);
  }

  .modal-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--tx);
    margin: 0;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--tx2);
  }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* ── Responsive ──────────────────────────────────────── */
  @media (max-width: 900px) {
    .ra-shell { grid-template-columns: 200px 240px 1fr; }
  }
  @media (max-width: 768px) {
    .ra-shell { grid-template-columns: 180px 1fr; }
    .ra-sidebar { display: none; }
  }
  @media (max-width: 640px) {
    .ra-shell { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    .ra-sidebar { display: none; }
    .ra-middle { border-right: none; max-height: 200px; }
  }
</style>
