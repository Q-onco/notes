<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { decryptWithToken } from '../lib/crypto';

  const API = 'https://api.github.com';
  const REPO = 'Q-onco/notes';
  const GH_API_TOKEN = import.meta.env.VITE_GH_API_TOKEN as string;

  type DocEntry = { name: string; path: string; sha: string };
  type LoadedDoc = { name: string; content: string; isHtml: boolean };

  let docs = $state<DocEntry[]>([]);
  let selected = $state<LoadedDoc | null>(null);
  let loading = $state(true);
  let loadingDoc = $state(false);
  let error = $state('');
  let iframeRef = $state<HTMLIFrameElement | undefined>(undefined);

  const hdrs = {
    Authorization: `token ${GH_API_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  };

  const DOC_LABELS: Record<string, string> = {
    'biotools-report.enc': 'Biotools Research Report',
    'enzo-character.enc': 'Enzo Character Map',
  };

  async function loadList() {
    loading = true;
    error = '';
    try {
      const r = await fetch(`${API}/repos/${REPO}/contents/docs`, { headers: hdrs });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      const items: any[] = await r.json();
      docs = items.filter(i => i.type === 'file' && i.name.endsWith('.enc'));

      // Also include settings/*.enc doc (enzo character)
      const r2 = await fetch(`${API}/repos/${REPO}/contents/settings`, { headers: hdrs });
      if (r2.ok) {
        const sitems: any[] = await r2.json();
        const enc = sitems.filter(i => i.type === 'file' && i.name === 'enzo-character.enc');
        docs = [...docs, ...enc];
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function openDoc(entry: DocEntry) {
    if (!store.tok) return;
    loadingDoc = true;
    selected = null;
    try {
      const r = await fetch(`${API}/repos/${REPO}/contents/${entry.path}`, { headers: hdrs });
      const j = await r.json();
      const rawContent = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))));
      const text = await decryptWithToken(rawContent, store.tok);
      const isHtml = entry.name.endsWith('.enc') &&
        (entry.path.includes('report') || text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html'));
      selected = { name: DOC_LABELS[entry.name] ?? entry.name.replace(/\.enc$/, ''), content: text, isHtml };
      if (isHtml && iframeRef) {
        setTimeout(() => {
          if (iframeRef) {
            iframeRef.srcdoc = text;
          }
        }, 50);
      }
    } catch (e) {
      error = `Failed to decrypt ${entry.name}: ${(e as Error).message}`;
    } finally {
      loadingDoc = false;
    }
  }

  $effect(() => { loadList(); });
</script>

<div class="docs-wrap">
  <div class="docs-header">
    <h2 class="docs-title">Vault</h2>
    <p class="docs-sub">Encrypted documents — decrypted locally, never sent anywhere.</p>
  </div>

  {#if error}
    <div class="docs-error">{error}</div>
  {/if}

  <div class="docs-layout">
    <aside class="docs-list">
      {#if loading}
        <div class="docs-loading">Loading…</div>
      {:else if docs.length === 0}
        <div class="docs-empty">No encrypted documents found.</div>
      {:else}
        {#each docs as entry (entry.sha)}
          {@const label = DOC_LABELS[entry.name] ?? entry.name.replace(/\.enc$/, '')}
          <button
            class="doc-item"
            class:doc-item-active={selected?.name === label}
            onclick={() => openDoc(entry)}
          >
            <svg class="doc-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span class="doc-item-name">{label}</span>
          </button>
        {/each}
      {/if}
    </aside>

    <div class="docs-viewer">
      {#if loadingDoc}
        <div class="docs-loading">Decrypting…</div>
      {:else if selected}
        <div class="docs-doc-header">
          <span class="docs-doc-title">{selected.name}</span>
          <span class="docs-doc-badge">Decrypted locally</span>
        </div>
        {#if selected.isHtml}
          <iframe
            bind:this={iframeRef}
            class="docs-iframe"
            title={selected.name}
            sandbox="allow-same-origin"
            srcdoc={selected.content}
          ></iframe>
        {:else}
          <pre class="docs-content">{selected.content}</pre>
        {/if}
      {:else}
        <div class="docs-placeholder">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.25">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Select a document to decrypt and view</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .docs-wrap   { display: flex; flex-direction: column; height: 100%; overflow: hidden; padding: 24px; gap: 16px; }
  .docs-header { flex-shrink: 0; }
  .docs-title  { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 4px; }
  .docs-sub    { font-size: 0.82rem; color: var(--mu); margin: 0; }

  .docs-error {
    background: var(--rd-bg); border: 1px solid var(--rd); border-radius: var(--radius-sm);
    color: var(--rd); font-size: 0.8rem; padding: 8px 12px; flex-shrink: 0;
  }

  .docs-layout { display: flex; gap: 16px; flex: 1; min-height: 0; }

  .docs-list {
    width: 220px; flex-shrink: 0; overflow-y: auto;
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 6px; display: flex; flex-direction: column;
  }

  .doc-item {
    display: flex; align-items: center; gap: 8px; padding: 9px 10px;
    border: none; background: transparent; cursor: pointer; border-radius: var(--radius-sm);
    text-align: left; transition: background var(--transition); width: 100%;
  }
  .doc-item:hover       { background: var(--sf2); }
  .doc-item-active      { background: var(--ac-bg); }
  .doc-icon             { color: var(--mu); flex-shrink: 0; }
  .doc-item-active .doc-icon { color: var(--ac); }
  .doc-item-name        { font-size: 0.78rem; color: var(--tx2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .doc-item-active .doc-item-name { color: var(--ac); font-weight: 600; }

  .docs-viewer {
    flex: 1; min-width: 0; overflow: hidden;
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    display: flex; flex-direction: column;
  }

  .docs-doc-header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 16px; border-bottom: 1px solid var(--bd); flex-shrink: 0;
  }
  .docs-doc-title { font-size: 0.85rem; font-weight: 600; color: var(--tx); }
  .docs-doc-badge {
    font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--gn); background: var(--gn-bg); border: 1px solid var(--gn);
    padding: 2px 7px; border-radius: 999px;
  }

  .docs-iframe {
    flex: 1; border: none; width: 100%; min-height: 0;
    background: white;
  }

  .docs-content {
    font-family: var(--mono); font-size: 0.75rem; line-height: 1.65;
    color: var(--tx2); padding: 16px; white-space: pre-wrap; word-break: break-word;
    flex: 1; margin: 0; overflow-y: auto;
  }

  .docs-placeholder, .docs-loading, .docs-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; flex: 1; color: var(--mu); font-size: 0.82rem;
  }

  @media (max-width: 640px) {
    .docs-layout { flex-direction: column; }
    .docs-list { width: 100%; max-height: 150px; }
  }
</style>
