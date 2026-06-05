<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { decryptWithToken } from '../lib/crypto';

  const API = 'https://api.github.com';
  const REPO = 'Q-onco/notes';
  const GH_API_TOKEN = import.meta.env.VITE_GH_API_TOKEN as string;

  type LogEntry = { name: string; path: string; sha: string };
  type LoadedLog = { name: string; content: string };

  let logs = $state<LogEntry[]>([]);
  let selected = $state<LoadedLog | null>(null);
  let loading = $state(true);
  let loadingDoc = $state(false);
  let error = $state('');

  const hdrs = {
    Authorization: `token ${GH_API_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  };

  async function loadList() {
    loading = true;
    error = '';
    try {
      const r = await fetch(`${API}/repos/${REPO}/contents/logs`, { headers: hdrs });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      const items: any[] = await r.json();
      logs = items
        .filter(i => i.type === 'file' && i.name.endsWith('.enc'))
        .sort((a, b) => b.name.localeCompare(a.name));
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function openLog(entry: LogEntry) {
    if (!store.tok) return;
    loadingDoc = true;
    selected = null;
    try {
      const r = await fetch(`${API}/repos/${REPO}/contents/${entry.path}`, { headers: hdrs });
      const j = await r.json();
      const rawContent = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))));
      const text = await decryptWithToken(rawContent, store.tok);
      selected = { name: entry.name.replace(/\.enc$/, ''), content: text };
    } catch (e) {
      error = `Failed to decrypt ${entry.name}: ${(e as Error).message}`;
    } finally {
      loadingDoc = false;
    }
  }

  function fmtName(name: string): string {
    return name.replace(/\.enc$/, '').replace(/_/g, ' ');
  }

  function isSessionLog(name: string): boolean {
    return name.includes('session');
  }

  $effect(() => { loadList(); });
</script>

<div class="sl-wrap">
  <div class="sl-header">
    <h2 class="sl-title">Session Logs</h2>
    <p class="sl-sub">Encrypted development logs — decrypted locally after login.</p>
  </div>

  {#if error}
    <div class="sl-error">{error}</div>
  {/if}

  <div class="sl-layout">
    <aside class="sl-list">
      {#if loading}
        <div class="sl-loading">Loading…</div>
      {:else if logs.length === 0}
        <div class="sl-empty">No logs found.</div>
      {:else}
        {#each logs as entry (entry.sha)}
          <button
            class="sl-item"
            class:sl-item-active={selected?.name === entry.name.replace(/\.enc$/, '')}
            onclick={() => openLog(entry)}
          >
            <span class="sl-item-dot" class:sl-dot-session={isSessionLog(entry.name)}></span>
            <span class="sl-item-name">{fmtName(entry.name)}</span>
          </button>
        {/each}
      {/if}
    </aside>

    <div class="sl-viewer">
      {#if loadingDoc}
        <div class="sl-loading">Decrypting…</div>
      {:else if selected}
        <div class="sl-doc-header">
          <span class="sl-doc-title">{selected.name}</span>
          <span class="sl-doc-badge">Decrypted locally</span>
        </div>
        <pre class="sl-content">{selected.content}</pre>
      {:else}
        <div class="sl-placeholder">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.25">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Select a log to decrypt and read</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .sl-wrap { display: flex; flex-direction: column; height: 100%; overflow: hidden; padding: 24px; gap: 16px; }
  .sl-header { flex-shrink: 0; }
  .sl-title  { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 4px; }
  .sl-sub    { font-size: 0.82rem; color: var(--mu); margin: 0; }

  .sl-error {
    background: var(--rd-bg); border: 1px solid var(--rd); border-radius: var(--radius-sm);
    color: var(--rd); font-size: 0.8rem; padding: 8px 12px; flex-shrink: 0;
  }

  .sl-layout {
    display: flex; gap: 16px; flex: 1; min-height: 0;
  }

  .sl-list {
    width: 240px; flex-shrink: 0; overflow-y: auto;
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    display: flex; flex-direction: column; padding: 6px;
  }

  .sl-item {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px;
    border: none; background: transparent; cursor: pointer; border-radius: var(--radius-sm);
    text-align: left; transition: background var(--transition); width: 100%;
  }
  .sl-item:hover { background: var(--sf2); }
  .sl-item-active { background: var(--ac-bg); }

  .sl-item-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    background: var(--bd2);
  }
  .sl-dot-session { background: var(--ac); }

  .sl-item-name {
    font-size: 0.75rem; color: var(--tx2); overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sl-item-active .sl-item-name { color: var(--ac); font-weight: 600; }

  .sl-viewer {
    flex: 1; min-width: 0; overflow-y: auto;
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    display: flex; flex-direction: column;
  }

  .sl-doc-header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 16px; border-bottom: 1px solid var(--bd); flex-shrink: 0;
  }
  .sl-doc-title  { font-size: 0.85rem; font-weight: 600; color: var(--tx); }
  .sl-doc-badge  {
    font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--gn); background: var(--gn-bg); border: 1px solid var(--gn);
    padding: 2px 7px; border-radius: 999px;
  }

  .sl-content {
    font-family: var(--mono); font-size: 0.75rem; line-height: 1.65;
    color: var(--tx2); padding: 16px; white-space: pre-wrap; word-break: break-word;
    flex: 1; margin: 0;
  }

  .sl-placeholder, .sl-loading, .sl-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; flex: 1; color: var(--mu); font-size: 0.82rem;
  }

  @media (max-width: 640px) {
    .sl-layout { flex-direction: column; }
    .sl-list { width: 100%; max-height: 180px; }
  }
</style>
