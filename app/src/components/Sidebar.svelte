<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { Note } from '../lib/types';

  let search = $state('');
  let activeTagFilter = $state('');
  let showArchived = $state(false);

  // Views with new features — badge clears on first visit
  const NEW_VIEWS = new Set(['review', 'research', 'manuscript', 'grants', 'audio']);
  const _seenRaw = typeof localStorage !== 'undefined'
    ? JSON.parse(localStorage.getItem('qonco-seen-views') ?? '[]') : [];
  let seenViews = $state<Set<string>>(new Set(_seenRaw));

  // Hover preview
  let hoveredNote = $state<Note | null>(null);
  let hoverX = $state(0);
  let hoverY = $state(0);
  let hoverTimer: ReturnType<typeof setTimeout>;

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  function onNoteHover(e: MouseEvent, n: Note) {
    if (isTouch) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      hoverX = rect.right + 10;
      hoverY = Math.min(rect.top, window.innerHeight - 130);
      hoveredNote = n;
    }, 350);
  }

  function onNoteLeave() {
    if (isTouch) return;
    clearTimeout(hoverTimer);
    hoveredNote = null;
  }

  function previewText(n: Note) {
    return n.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  const NAV = [
    { id: 'dashboard', label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'notes',     label: 'Notes',       icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'journal',   label: 'Journal',     icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'tasks',     label: 'Tasks',       icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'calendar',  label: 'Calendar',    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'research',  label: 'Research',    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { id: 'review',        label: 'Reviews',       icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
    { id: 'pipeline',  label: 'Pipeline',    icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v10a2 2 0 002 2h10a2 2 0 002-2V5M9 13H5a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2v-4a2 2 0 00-2-2z' },
    { id: 'jobs',          label: 'Jobs',          icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'presentations', label: 'Presentations', icon: 'M2 3h20v14H2zM8 21h8M12 17v4' },
    { id: 'files',         label: 'Files',         icon: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
    { id: 'grants',        label: 'Grants',        icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
    { id: 'manuscript',    label: 'Manuscripts',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
    { id: 'audio',         label: 'Audio',         icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z' },
    { id: 'mail',          label: 'Mail',          icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'settings',  label: 'Settings',    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
  ] as const;

  type ViewId = typeof NAV[number]['id'];

  function navClick(id: string) {
    store.view = id as ViewId;
    if (id === 'notes' && !store.currentNoteId && store.recentNotes.length > 0) {
      store.currentNoteId = store.recentNotes[0].id;
    }
    store.sidebarOpen = false;
    if (NEW_VIEWS.has(id) && !seenViews.has(id)) {
      seenViews = new Set([...seenViews, id]);
      localStorage.setItem('qonco-seen-views', JSON.stringify([...seenViews]));
    }
  }

  function newNote() {
    const note: Note = {
      id: nanoid(), title: 'Untitled note', body: '', tags: [],
      createdAt: Date.now(), updatedAt: Date.now(),
      pinned: false, archived: false, audioIds: []
    };
    store.notes = [note, ...store.notes];
    store.currentNoteId = note.id;
    store.view = 'notes';
    store.saveNotes();
  }

  // All tags from active (non-archived) notes
  const allTags = $derived(
    [...new Set(store.notes.filter(n => !n.archived).flatMap(n => n.tags))].sort()
  );

  const filteredNotes = $derived(
    store.notes
      .filter(n => !n.archived)
      .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase()))
      .filter(n => !activeTagFilter || n.tags.includes(activeTagFilter))
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt - a.updatedAt;
      })
      .slice(0, 30)
  );

  const archivedNotes = $derived(
    store.notes.filter(n => n.archived).sort((a, b) => b.updatedAt - a.updatedAt)
  );

  async function restoreNote(n: Note) {
    n.archived = false;
    await store.saveNotes();
  }

  function relTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }
</script>

<nav class="sidebar">
  <!-- Main nav -->
  <div class="nav-section">
    {#each NAV as item}
      <button
        class="nav-item"
        class:active={store.view === item.id}
        onclick={() => navClick(item.id)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d={item.icon}/>
        </svg>
        <span>{item.label}</span>
        {#if NEW_VIEWS.has(item.id) && !seenViews.has(item.id)}
          <span class="badge-new">new</span>
        {:else if item.id === 'tasks' && store.activeTasks.length > 0}
          <span class="badge">{store.activeTasks.length}</span>
        {:else if item.id === 'presentations' && store.presentations.length > 0}
          <span class="badge">{store.presentations.length}</span>
        {:else if item.id === 'files' && store.files.length > 0}
          <span class="badge">{store.files.length}</span>
        {:else if item.id === 'grants' && (store.grants.length + store.conferences.length + store.peerReviews.length) > 0}
          <span class="badge">{store.grants.length + store.conferences.length + store.peerReviews.length}</span>
        {:else if item.id === 'manuscript' && store.manuscripts.length > 0}
          <span class="badge">{store.manuscripts.length}</span>
        {:else if item.id === 'mail' && store.mailDrafts.length > 0}
          <span class="badge">{store.mailDrafts.length}</span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="divider"></div>

  <!-- Notes section -->
  <div class="notes-section">
    <div class="section-head">
      <span class="section-label">Notes</span>
      <button class="btn-icon new-note-btn" onclick={newNote} title="New note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- Search -->
    <div class="search-wrap">
      <input type="search" bind:value={search} placeholder="Search notes…" class="search-input" />
    </div>

    <!-- Tag filter chips -->
    {#if allTags.length > 0}
      <div class="tag-chips">
        <button class="tag-chip" class:chip-active={!activeTagFilter} onclick={() => activeTagFilter = ''}>All</button>
        {#each allTags.slice(0, 8) as tag}
          <button class="tag-chip" class:chip-active={activeTagFilter === tag}
            onclick={() => activeTagFilter = activeTagFilter === tag ? '' : tag}>
            {tag}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Note list -->
    <div class="notes-list">
      {#each filteredNotes as note (note.id)}
        <button
          class="note-item"
          class:active={store.currentNoteId === note.id && store.view === 'notes'}
          class:has-color={note.color}
          style={note.color ? `border-left-color: var(--${note.color})` : ''}
          onclick={() => { store.currentNoteId = note.id; store.view = 'notes'; if (window.innerWidth <= 900) store.sidebarOpen = false; }}
          onmouseenter={(e) => onNoteHover(e, note)}
          onmouseleave={onNoteLeave}
        >
          <span class="note-title">
            {#if note.pinned}
              <svg class="pin-icon" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-label="Pinned"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
            {/if}
            {note.title || 'Untitled'}
          </span>
          <span class="note-time">{relTime(note.updatedAt)}</span>
        </button>
      {:else}
        <p class="empty-hint">{activeTagFilter ? `No notes tagged "${activeTagFilter}"` : 'No notes yet — press + to start'}</p>
      {/each}
    </div>

    <!-- Archive section -->
    {#if archivedNotes.length > 0}
      <div class="archive-section">
        <button class="archive-toggle" onclick={() => showArchived = !showArchived}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
          </svg>
          <span>Archived ({archivedNotes.length})</span>
          <svg class="chevron" class:open={showArchived} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {#if showArchived}
          <div class="archived-list">
            {#each archivedNotes as note (note.id)}
              <div class="archived-item">
                <button class="archived-btn" onclick={() => { store.currentNoteId = note.id; store.view = 'notes'; if (window.innerWidth <= 900) store.sidebarOpen = false; }}>
                  <span class="note-title">{note.title || 'Untitled'}</span>
                  <span class="note-time">{relTime(note.updatedAt)}</span>
                </button>
                <button class="restore-btn" onclick={() => restoreNote(note)} title="Restore note">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 12a9 9 0 109-9 9 9 0 00-6 2.3L3 8"/><path d="M3 3v5h5"/>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</nav>

<!-- Hover preview popover -->
{#if hoveredNote}
  <div class="note-preview" style="left: {hoverX}px; top: {hoverY}px">
    <p class="preview-title">{hoveredNote.title || 'Untitled'}</p>
    {#if previewText(hoveredNote)}
      <p class="preview-body">{previewText(hoveredNote)}{hoveredNote.body.length > 180 ? '…' : ''}</p>
    {:else}
      <p class="preview-body preview-empty">Empty note</p>
    {/if}
    {#if hoveredNote.tags.length > 0}
      <div class="preview-tags">
        {#each hoveredNote.tags.slice(0, 4) as tag}
          <span class="preview-tag">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .sidebar {
    display: flex; flex-direction: column; height: 100%; padding: 10px 0;
  }

  .nav-section { padding: 0 8px; flex-shrink: 0; overflow-y: auto; max-height: 60vh; }

  .nav-item {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 7px 10px; border-radius: var(--radius-sm);
    background: transparent; color: var(--tx2); font-size: 0.875rem;
    font-weight: 500; text-align: left;
    transition: background var(--transition), color var(--transition);
    position: relative;
  }
  .nav-item:hover { background: var(--sf2); color: var(--tx); }
  .nav-item.active { background: var(--ac-bg); color: var(--ac); }
  .nav-item.active svg { stroke: var(--ac); }

  .badge {
    margin-left: auto; background: var(--ac); color: white;
    font-size: 0.7rem; font-weight: 700; padding: 1px 6px;
    border-radius: 10px; min-width: 18px; text-align: center;
  }
  .badge-new {
    margin-left: auto; background: var(--enzo); color: white;
    font-size: 0.6rem; font-weight: 800; padding: 1px 5px;
    border-radius: 10px; letter-spacing: 0.04em; text-transform: uppercase;
  }

  .divider { border: none; border-top: 1px solid var(--bd); margin: 8px 0; }

  .notes-section {
    flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 0 8px;
  }

  .section-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 4px 6px;
  }
  .section-label {
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--mu);
  }
  .new-note-btn {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center; color: var(--mu);
    border-radius: var(--radius-sm);
  }
  .new-note-btn:hover { background: var(--sf2); color: var(--ac); }

  .search-wrap { margin-bottom: 5px; }
  .search-input { padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm); }

  /* ── Tag filter chips ── */
  .tag-chips {
    display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 6px; padding: 0 1px;
  }
  .tag-chip {
    font-size: 0.68rem; font-weight: 500; padding: 2px 7px;
    border-radius: 10px; border: 1px solid var(--bd);
    background: var(--sf2); color: var(--tx2); cursor: pointer;
    transition: background var(--transition), color var(--transition), border-color var(--transition);
    white-space: nowrap;
  }
  .tag-chip:hover { border-color: var(--ac); color: var(--ac); }
  .chip-active { background: var(--ac-bg) !important; color: var(--ac) !important; border-color: var(--ac) !important; }

  /* ── Note list ── */
  .notes-list {
    flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1px;
  }

  .note-item {
    display: flex; flex-direction: column; gap: 2px; width: 100%;
    padding: 7px 10px; border-radius: var(--radius-sm);
    background: transparent; text-align: left; cursor: pointer;
    transition: background var(--transition);
    border-left: 2px solid transparent; position: relative;
  }
  .note-item:hover { background: var(--sf2); }
  .note-item.active { background: var(--ac-bg); }
  .note-item.has-color { padding-left: 8px; }

  .note-title {
    font-size: 0.82rem; font-weight: 500; color: var(--tx);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    display: flex; align-items: center; gap: 4px;
  }
  .note-time { font-size: 0.7rem; color: var(--mu); }
  .pin-icon { color: var(--enzo); flex-shrink: 0; }

  .empty-hint {
    font-size: 0.78rem; color: var(--mu); text-align: center;
    padding: 16px 8px; line-height: 1.5;
  }

  /* ── Archive section ── */
  .archive-section { border-top: 1px solid var(--bd); margin-top: 4px; padding-top: 4px; flex-shrink: 0; }
  .archive-toggle {
    display: flex; align-items: center; gap: 5px; width: 100%;
    padding: 5px 4px; background: transparent; border: none;
    font-size: 0.72rem; color: var(--mu); cursor: pointer;
    font-family: var(--font); text-align: left;
  }
  .archive-toggle:hover { color: var(--tx2); }
  .chevron { margin-left: auto; transition: transform var(--transition); flex-shrink: 0; }
  .chevron.open { transform: rotate(180deg); }

  .archived-list { display: flex; flex-direction: column; gap: 1px; max-height: 160px; overflow-y: auto; padding-bottom: 4px; }
  .archived-item { display: flex; align-items: center; gap: 2px; border-radius: var(--radius-sm); }
  .archived-btn {
    flex: 1; display: flex; flex-direction: column; gap: 1px;
    padding: 5px 8px; background: transparent; border: none;
    text-align: left; cursor: pointer; font-family: var(--font);
    opacity: 0.65;
  }
  .archived-btn:hover { opacity: 1; background: var(--sf2); border-radius: var(--radius-sm); }
  .restore-btn {
    flex-shrink: 0; width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; cursor: pointer; color: var(--mu);
    border-radius: var(--radius-sm); opacity: 0;
  }
  .archived-item:hover .restore-btn { opacity: 1; }
  .restore-btn:hover { color: var(--ac); background: var(--ac-bg); }

  /* ── Hover preview ── */
  .note-preview {
    position: fixed; z-index: 800;
    background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius); box-shadow: 0 12px 32px rgba(0,0,0,0.22);
    padding: 10px 14px; width: 220px; pointer-events: none;
  }
  .preview-title {
    font-size: 0.82rem; font-weight: 600; color: var(--tx);
    margin: 0 0 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .preview-body {
    font-size: 0.76rem; color: var(--tx2); line-height: 1.5; margin: 0;
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
  }
  .preview-empty { color: var(--mu); font-style: italic; }
  .preview-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 6px; }
  .preview-tag {
    font-size: 0.66rem; padding: 1px 6px; border-radius: 8px;
    background: var(--ac-bg); color: var(--ac); border: 1px solid var(--ac);
  }
</style>
