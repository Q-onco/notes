<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { marked } from 'marked';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let search = $state('');
  let activeTag = $state<string | null>(null);
  let sortBy = $state<'updated' | 'created' | 'title'>('updated');
  let filterMode = $state<'all' | 'pinned' | 'archived'>('all');
  let importing = $state(false);
  let fileInput: HTMLInputElement;
  let dragOver = $state(false);

  const allTags = $derived([...new Set(store.notes.flatMap(n => n.tags))].sort());

  const filtered = $derived((() => {
    let list = store.notes;
    if (filterMode === 'pinned')   list = list.filter(n => n.pinned && !n.archived);
    else if (filterMode === 'archived') list = list.filter(n => n.archived);
    else list = list.filter(n => !n.archived);
    if (activeTag) list = list.filter(n => n.tags.includes(activeTag!));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.replace(/<[^>]+>/g, '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'created') return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt;
    });
  })());

  function openNote(id: string) {
    store.currentNoteId = id;
  }

  function newNote() {
    const n = {
      id: nanoid(), title: 'Untitled note', body: '', tags: [],
      createdAt: Date.now(), updatedAt: Date.now(),
      pinned: false, archived: false, audioIds: [],
    };
    store.notes = [n, ...store.notes];
    store.currentNoteId = n.id;
    store.saveNotes();
  }

  function preview(body: string): string {
    return body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  function timeAgo(ts: number): string {
    const d = Date.now() - ts;
    if (d < 60000) return 'just now';
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    if (d < 604800000) return `${Math.floor(d / 86400000)}d ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    importing = true;
    let lastId = '';
    for (const file of Array.from(files)) {
      try {
        let body = '';
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'md' || ext === 'txt') {
          const text = await file.text();
          body = ext === 'md' ? (marked.parse(text) as string) : `<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        } else if (ext === 'docx') {
          const mammoth = await import('mammoth');
          const arr = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer: arr });
          body = result.value;
        } else {
          showToast(`Unsupported format: .${ext}`, 'error');
          continue;
        }
        const title = file.name.replace(/\.[^.]+$/, '');
        const n = { id: nanoid(), title, body, tags: [], createdAt: Date.now(), updatedAt: Date.now(), pinned: false, archived: false, audioIds: [] };
        store.notes = [n, ...store.notes];
        lastId = n.id;
      } catch {
        showToast(`Failed to import ${file.name}`, 'error');
      }
    }
    if (lastId) {
      await store.saveNotes();
      showToast(`Imported ${files.length} note${files.length > 1 ? 's' : ''}`);
      store.currentNoteId = lastId;
    }
    importing = false;
  }

  function onFileInput() { importFiles(fileInput?.files ?? null); }

  function onDrop(e: DragEvent) {
    e.preventDefault(); dragOver = false;
    importFiles(e.dataTransfer?.files ?? null);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="notes-home"
  class:drag-active={dragOver}
  ondragover={(e) => { e.preventDefault(); dragOver = true; }}
  ondragleave={() => dragOver = false}
  ondrop={onDrop}
>
  <input type="file" bind:this={fileInput} onchange={onFileInput}
    accept=".md,.txt,.docx" multiple style="display:none" />

  <!-- Header -->
  <div class="nh-header">
    <div class="nh-title-row">
      <h2 class="nh-title">Notes</h2>
      <div class="nh-actions">
        <button class="btn btn-ghost btn-sm" onclick={() => fileInput?.click()} disabled={importing}>
          {#if importing}
            <span class="nh-spin"></span> Importing…
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import
          {/if}
        </button>
        <button class="btn btn-primary btn-sm" onclick={newNote}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New note
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="nh-search-row">
      <div class="nh-search-wrap">
        <svg class="nh-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="nh-search" bind:value={search} placeholder="Search notes…" />
        {#if search}<button class="nh-search-clear" onclick={() => search = ''}>×</button>{/if}
      </div>
      <select class="nh-sort" bind:value={sortBy}>
        <option value="updated">Last edited</option>
        <option value="created">Created</option>
        <option value="title">Title A–Z</option>
      </select>
    </div>

    <!-- Filter pills -->
    <div class="nh-filters">
      <button class="nh-pill" class:nh-pill-active={filterMode === 'all' && !activeTag} onclick={() => { filterMode = 'all'; activeTag = null; }}>All</button>
      <button class="nh-pill" class:nh-pill-active={filterMode === 'pinned'} onclick={() => { filterMode = 'pinned'; activeTag = null; }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        Pinned
      </button>
      <button class="nh-pill" class:nh-pill-active={filterMode === 'archived'} onclick={() => { filterMode = 'archived'; activeTag = null; }}>Archived</button>
      {#if allTags.length > 0}
        <div class="nh-pill-sep"></div>
        {#each allTags.slice(0, 8) as tag}
          <button class="nh-pill nh-pill-tag" class:nh-pill-active={activeTag === tag}
            onclick={() => { activeTag = activeTag === tag ? null : tag; filterMode = 'all'; }}>
            #{tag}
          </button>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Grid -->
  <div class="nh-grid-wrap">
    {#if filtered.length === 0}
      <div class="nh-empty">
        {#if search}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <p>No notes match <strong>"{search}"</strong></p>
        {:else}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>No notes yet</p>
          <p class="nh-empty-sub">Create one or drag a .md / .txt / .docx file here to import</p>
          <button class="btn btn-primary" onclick={newNote}>Create your first note</button>
        {/if}
      </div>
    {:else}
      <div class="nh-grid">
        {#each filtered as note (note.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="nh-card"
            class:nh-card-pinned={note.pinned}
            style={note.color ? `--card-accent: var(--${note.color})` : ''}
            onclick={() => openNote(note.id)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && openNote(note.id)}
          >
            {#if note.color}
              <div class="nh-card-bar"></div>
            {/if}
            <div class="nh-card-body">
              <div class="nh-card-head">
                <span class="nh-card-title">{note.title || 'Untitled'}</span>
                {#if note.pinned}
                  <svg class="nh-card-pin" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                {/if}
              </div>
              {#if preview(note.body)}
                <p class="nh-card-preview">{preview(note.body)}</p>
              {/if}
              <div class="nh-card-meta">
                <span class="nh-card-time">{timeAgo(note.updatedAt)}</span>
                {#if note.tags.length > 0}
                  <div class="nh-card-tags">
                    {#each note.tags.slice(0, 3) as tag}
                      <span class="nh-card-tag">#{tag}</span>
                    {/each}
                    {#if note.tags.length > 3}
                      <span class="nh-card-tag nh-card-tag-more">+{note.tags.length - 3}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if dragOver}
    <div class="nh-drop-overlay">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <p>Drop .md, .txt or .docx to import</p>
    </div>
  {/if}
</div>

<style>
  .notes-home {
    display: flex; flex-direction: column; height: 100%;
    background: var(--bg); position: relative; overflow: hidden;
  }
  .notes-home.drag-active::after {
    content: ''; position: absolute; inset: 0;
    border: 3px dashed var(--ac); border-radius: var(--radius);
    background: color-mix(in srgb, var(--ac) 6%, transparent);
    pointer-events: none; z-index: 10;
  }

  /* Header */
  .nh-header { padding: 20px 24px 0; flex-shrink: 0; }
  .nh-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .nh-title { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; color: var(--tx); }
  .nh-actions { display: flex; gap: 8px; }

  .nh-search-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
  .nh-search-wrap { position: relative; flex: 1; }
  .nh-search-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--mu); pointer-events: none; }
  .nh-search { width: 100%; padding: 7px 28px 7px 30px; font-size: 0.85rem; border: 1px solid var(--bd); border-radius: var(--radius-sm); background: var(--sf); color: var(--tx); }
  .nh-search:focus { border-color: var(--ac); outline: none; box-shadow: none; }
  .nh-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--mu); cursor: pointer; font-size: 16px; line-height: 1; padding: 0; }
  .nh-sort { padding: 6px 8px; font-size: 0.8rem; border: 1px solid var(--bd); border-radius: var(--radius-sm); background: var(--sf); color: var(--tx); cursor: pointer; }

  .nh-filters { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid var(--bd); }
  .nh-pill {
    padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 500;
    border: 1px solid var(--bd); background: transparent; color: var(--tx2);
    cursor: pointer; display: flex; align-items: center; gap: 4px;
    transition: all var(--transition);
  }
  .nh-pill:hover { background: var(--sf2); color: var(--tx); }
  .nh-pill-active { background: var(--ac-bg) !important; color: var(--ac) !important; border-color: var(--ac) !important; }
  .nh-pill-sep { width: 1px; height: 14px; background: var(--bd); margin: 0 2px; }
  .nh-pill-tag { font-style: italic; }

  /* Grid */
  .nh-grid-wrap { flex: 1; overflow-y: auto; padding: 16px 24px 24px; }
  .nh-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  /* Card */
  .nh-card {
    border: 1px solid var(--bd); border-radius: var(--radius);
    background: var(--sf); cursor: pointer; overflow: hidden;
    transition: box-shadow var(--transition), transform var(--transition), border-color var(--transition);
    position: relative; display: flex; flex-direction: column;
  }
  .nh-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); transform: translateY(-1px); border-color: var(--ac); }
  .nh-card-pinned { border-color: color-mix(in srgb, var(--ac) 40%, var(--bd)); }

  .nh-card-bar { height: 3px; background: var(--card-accent, var(--ac)); flex-shrink: 0; }
  .nh-card-body { padding: 12px 14px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .nh-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
  .nh-card-title { font-size: 0.88rem; font-weight: 700; color: var(--tx); line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; flex: 1; }
  .nh-card-pin { color: var(--ac); flex-shrink: 0; margin-top: 2px; }
  .nh-card-preview { font-size: 0.76rem; color: var(--tx2); line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; flex: 1; }
  .nh-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; margin-top: auto; }
  .nh-card-time { font-size: 0.68rem; color: var(--mu); flex-shrink: 0; }
  .nh-card-tags { display: flex; gap: 3px; flex-wrap: wrap; }
  .nh-card-tag { font-size: 0.63rem; padding: 1px 6px; background: var(--ac-bg); color: var(--ac); border-radius: 10px; }
  .nh-card-tag-more { background: var(--sf2); color: var(--mu); }

  /* Empty state */
  .nh-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; height: 100%; min-height: 240px; color: var(--mu); text-align: center; }
  .nh-empty p { font-size: 0.88rem; color: var(--tx2); }
  .nh-empty-sub { font-size: 0.78rem !important; color: var(--mu) !important; }

  /* Drop overlay */
  .nh-drop-overlay {
    position: absolute; inset: 0; z-index: 20;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
    color: var(--ac); pointer-events: none;
  }
  .nh-drop-overlay p { font-size: 0.95rem; font-weight: 600; }

  /* Spinner */
  .nh-spin {
    display: inline-block; width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--ac) 25%, transparent);
    border-top-color: var(--ac); animation: nh-spin 0.7s linear infinite;
  }
  @keyframes nh-spin { to { transform: rotate(360deg); } }

  /* Responsive */
  @media (max-width: 768px) {
    .nh-header { padding: 14px 14px 0; }
    .nh-grid-wrap { padding: 12px 14px 20px; }
    .nh-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  }
  @media (max-width: 430px) {
    .nh-grid { grid-template-columns: 1fr; }
  }
</style>
