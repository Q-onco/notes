<script lang="ts">
  import { searchPubMed, fetchBioRxiv, fetchNatureCell, fetchPubMedAbstract, searchSemanticScholar, searchEuropePMC } from '../lib/pubmed';
  import type { PaperResult } from '../lib/types';
  import { store } from '../lib/store.svelte';
  import { exportPapers } from '../lib/export';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  type SourceKey = 'pubmed' | 'biorxiv' | 'medrxiv' | 'nature' | 'cell' | 'semanticscholar' | 'europepmc';

  const SOURCES: { key: SourceKey; label: string; cls: string; worker?: boolean }[] = [
    { key: 'pubmed',         label: 'PubMed',            cls: 'sc-ac' },
    { key: 'semanticscholar',label: 'Semantic Scholar',  cls: 'sc-pu' },
    { key: 'europepmc',      label: 'Europe PMC',        cls: 'sc-yw' },
    { key: 'biorxiv',        label: 'bioRxiv',           cls: 'sc-gn' },
    { key: 'medrxiv',        label: 'medRxiv',           cls: 'sc-gn' },
    { key: 'nature',         label: 'Nature',            cls: 'sc-enzo', worker: true },
    { key: 'cell',           label: 'Cell',              cls: 'sc-rd',   worker: true },
  ];

  const SOURCE_LABELS: Record<string, string> = {
    pubmed: 'PubMed', biorxiv: 'bioRxiv', medrxiv: 'medRxiv',
    nature: 'Nature', cell: 'Cell',
    semanticscholar: 'Semantic Scholar', europepmc: 'Europe PMC'
  };
  const SOURCE_CLS: Record<string, string> = {
    pubmed: 'tag-ac', biorxiv: 'tag-gn', medrxiv: 'tag-gn',
    nature: 'tag-enzo', cell: 'tag-rd',
    semanticscholar: 'tag-pu', europepmc: 'tag-yw'
  };

  const CONCEPT_POOL = [
    // TME & immune landscape
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
    // scRNA-seq & spatial
    'scRNA-seq tumor immune landscape',
    'spatial transcriptomics HGSOC',
    'single cell sequencing ascites',
    'cell-cell communication ligand receptor',
    'trajectory analysis pseudotime tumor',
    'clonotype TCR scRNA ovarian',
    // PARP inhibitors & HR
    'PARP inhibitor resistance mechanisms',
    'olaparib niraparib rucaparib resistance',
    'PARP1 trapping catalytic inhibition',
    'BRCAness reversion mutation',
    'RAD51 homologous recombination deficiency',
    '53BP1 RIF1 NHEJ pathway',
    'homologous recombination deficiency HRD',
    // HGSOC biology
    'HGSOC platinum resistance',
    'BRCA1 BRCA2 ovarian cancer',
    'copy number alteration HGSOC',
    'TP53 mutation high grade serous',
    'fallopian tube carcinogenesis STIC',
    'clonal evolution chemotherapy resistance',
    // Clinical trials
    'SOLO-1 SOLO-2 olaparib maintenance',
    'PRIMA niraparib ovarian',
    'DUO-O veliparib bevacizumab',
    'IMagyn050 atezolizumab ovarian',
    'KEYNOTE-100 pembrolizumab ovarian',
    'ARIEL3 rucaparib biomarker',
    // Pathways & targets
    'VEGF bevacizumab anti-angiogenic ovarian',
    'PI3K AKT mTOR ovarian cancer',
    'WNT signaling ovarian cancer',
    'folate receptor alpha FOLR1',
    'mesothelin ovarian peritoneal',
    'MUC16 CA125 biomarker',
    // Dissemination & metastasis
    'peritoneal dissemination ovarian cancer',
    'ascites immunosuppression ovarian',
    'epithelial mesenchymal transition ovarian',
    'integrin fibronectin peritoneal adhesion',
    // Therapy
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
      const needsQuery = activeSources.has('pubmed') || activeSources.has('semanticscholar') || activeSources.has('europepmc');
      if (needsQuery && !q) {
        error = 'Enter a search term.';
        loading = false;
        return;
      }
      if (activeSources.has('pubmed') && q)           fetches.push(searchPubMed(q, 12));
      if (activeSources.has('semanticscholar') && q)  fetches.push(searchSemanticScholar(q, 10));
      if (activeSources.has('europepmc') && q)        fetches.push(searchEuropePMC(q, 10));
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
</script>

<div class="research">
  <div class="research-header">
    <div>
      <h2>Research</h2>
      <p class="text-sm text-mu">Literature, preprints, and journal feeds</p>
    </div>
    <div class="header-actions">
      {#if store.pinnedPapers.length > 0}
        <button class="btn btn-ghost btn-sm" onclick={() => exportPapers(store.pinnedPapers)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export pinned ({store.pinnedPapers.length})
        </button>
      {/if}
    </div>
  </div>

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

  <!-- Search + concepts -->
  <div class="search-row">
    <div class="search-wrap">
      <input
        type="text"
        bind:value={query}
        placeholder="Search PubMed, preprints…"
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
      </article>
    {:else}
      {#if !loading}
        <div class="empty-state">
          <p class="text-mu">
            Toggle sources above, type a query (concepts appear as you type), then press Search.
          </p>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
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
  .header-actions { display: flex; gap: 8px; align-items: center; }

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

  .search-row { display: flex; gap: 8px; align-items: flex-start; }
  .search-wrap { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .search-input { width: 100%; }
  .search-btn { flex-shrink: 0; align-self: flex-start; }

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
  @keyframes spin { to { transform: rotate(360deg); } }

  .papers-list { display: flex; flex-direction: column; gap: 10px; }
  .paper-card { display: flex; flex-direction: column; gap: 8px; }

  .paper-head { display: flex; align-items: center; justify-content: space-between; }
  .paper-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .paper-actions { display: flex; gap: 2px; align-items: center; }

  .pin-btn { color: var(--mu); }
  .pin-btn.pinned { color: var(--enzo); }
  .pin-btn:hover { color: var(--enzo); background: var(--enzo-bg); }

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

  .empty-state { padding: 40px; text-align: center; }
</style>
