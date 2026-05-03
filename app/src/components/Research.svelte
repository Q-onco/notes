<script lang="ts">
  import { searchPubMed, fetchBioRxiv, fetchNatureCell, fetchPubMedAbstract } from '../lib/pubmed';
  import type { PaperResult } from '../lib/types';
  import { store } from '../lib/store.svelte';
  import { exportPapers } from '../lib/export';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let activeTab = $state<'pubmed' | 'preprints' | 'journals'>('pubmed');
  let query = $state('ovarian cancer tumor microenvironment');
  let papers = $state<PaperResult[]>([]);
  let loading = $state(false);
  let error = $state('');
  let expandedId = $state<string | null>(null);
  let abstractText = $state<Record<string, string>>({});

  const SOURCE_LABELS: Record<string, string> = {
    pubmed: 'PubMed', biorxiv: 'bioRxiv', medrxiv: 'medRxiv', nature: 'Nature', cell: 'Cell'
  };

  const SOURCE_COLORS: Record<string, string> = {
    pubmed: 'tag-ac', biorxiv: 'tag-gn', medrxiv: 'tag-gn', nature: 'tag-enzo', cell: 'tag-rd'
  };

  async function search() {
    loading = true;
    error = '';
    papers = [];
    try {
      if (activeTab === 'pubmed') {
        papers = await searchPubMed(query, 15);
      } else if (activeTab === 'preprints') {
        papers = await fetchBioRxiv(14);
      } else {
        papers = await fetchNatureCell();
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    activeTab;
    search();
  });

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

  <!-- Tabs -->
  <div class="tabs">
    <button class="tab" class:active={activeTab === 'pubmed'} onclick={() => activeTab = 'pubmed'}>PubMed</button>
    <button class="tab" class:active={activeTab === 'preprints'} onclick={() => activeTab = 'preprints'}>Preprints (bioRxiv · medRxiv)</button>
    <button class="tab" class:active={activeTab === 'journals'} onclick={() => activeTab = 'journals'}>Nature · Cell</button>
  </div>

  <!-- Search (PubMed only) -->
  {#if activeTab === 'pubmed'}
    <div class="search-row">
      <input
        type="text"
        bind:value={query}
        placeholder="Search PubMed..."
        onkeydown={(e) => e.key === 'Enter' && search()}
        class="search-input"
      />
      <button class="btn btn-primary btn-sm" onclick={search} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>
    </div>
  {/if}

  <!-- Error -->
  {#if error}
    <div class="error-box">{error}</div>
  {/if}

  <!-- Loading -->
  {#if loading}
    <div class="loading-row">
      <span class="spinner-sm"></span>
      <span class="text-sm text-mu">Fetching papers...</span>
    </div>
  {/if}

  <!-- Results -->
  <div class="papers-list">
    {#each papers as paper (paper.id)}
      <article class="paper-card card">
        <div class="paper-head">
          <div class="paper-meta">
            <span class="tag {SOURCE_COLORS[paper.source] || ''}">{SOURCE_LABELS[paper.source] || paper.source}</span>
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
              <span class="text-enzo text-xs font-mono">E</span>
            </button>
            {#if paper.doi}
              <a href="https://doi.org/{paper.doi}" target="_blank" rel="noreferrer" class="btn-icon" title="Open paper">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            {:else}
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
          <p class="paper-authors text-xs text-mu">{paper.authors.join(', ')}{paper.authors.length >= 5 ? ' et al.' : ''}</p>
        {/if}

        {#if expandedId === paper.id}
          <div class="abstract-box">
            {#if abstractText[paper.id]}
              <p class="text-sm">{abstractText[paper.id]}</p>
            {:else if paper.abstract}
              <p class="text-sm">{paper.abstract}</p>
            {:else}
              <p class="text-sm text-mu">Loading abstract...</p>
            {/if}
          </div>
        {/if}
      </article>
    {:else}
      {#if !loading}
        <div class="empty-state">
          <p class="text-mu">
            {activeTab === 'pubmed' ? 'Search PubMed above.' : 'No recent results found. Try again later.'}
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

  .pin-btn { color: var(--mu); }
  .pin-btn.pinned { color: var(--enzo); }
  .pin-btn:hover { color: var(--enzo); background: var(--enzo-bg); }

  .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--bd); padding-bottom: 0; }
  .tab {
    padding: 7px 14px;
    font-size: 0.82rem;
    font-weight: 500;
    background: transparent;
    color: var(--mu);
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    margin-bottom: -1px;
    transition: color var(--transition), border-color var(--transition);
  }
  .tab.active { color: var(--ac); border-bottom-color: var(--ac); }
  .tab:hover:not(.active) { color: var(--tx); }

  .search-row { display: flex; gap: 8px; }
  .search-input { flex: 1; }

  .error-box {
    background: var(--rd-bg);
    border: 1px solid var(--rd);
    border-radius: var(--radius-sm);
    color: var(--rd);
    font-size: 0.82rem;
    padding: 10px 14px;
  }

  .loading-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
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

  .paper-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .paper-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .paper-actions { display: flex; gap: 2px; }

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
