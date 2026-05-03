<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { Note } from '../lib/types';

  let search = $state('');

  const NAV = [
    { id: 'dashboard', label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'notes',     label: 'Notes',       icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'journal',   label: 'Journal',     icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'tasks',     label: 'Tasks',       icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'calendar',  label: 'Calendar',    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'research',  label: 'Research',    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { id: 'audio',     label: 'Audio',       icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z' }
  ] as const;

  type ViewId = typeof NAV[number]['id'];

  function newNote() {
    const note: Note = {
      id: nanoid(),
      title: 'Untitled note',
      body: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      archived: false,
      audioIds: []
    };
    store.notes = [note, ...store.notes];
    store.currentNoteId = note.id;
    store.view = 'notes';
    store.saveNotes();
  }

  const filteredNotes = $derived(
    store.notes
      .filter(n => !n.archived)
      .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt - a.updatedAt;
      })
      .slice(0, 30)
  );

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
        onclick={() => store.view = item.id as ViewId}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d={item.icon}/>
        </svg>
        <span>{item.label}</span>
        {#if item.id === 'tasks' && store.activeTasks.length > 0}
          <span class="badge">{store.activeTasks.length}</span>
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

    <div class="search-wrap">
      <input
        type="search"
        bind:value={search}
        placeholder="Search notes..."
        class="search-input"
      />
    </div>

    <div class="notes-list">
      {#each filteredNotes as note (note.id)}
        <button
          class="note-item"
          class:active={store.currentNoteId === note.id && store.view === 'notes'}
          onclick={() => { store.currentNoteId = note.id; store.view = 'notes'; }}
        >
          <span class="note-title">
            {#if note.pinned}
              <svg class="pin-icon" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" title="Pinned"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
            {/if}
            {note.title || 'Untitled'}
          </span>
          <span class="note-time">{relTime(note.updatedAt)}</span>
        </button>
      {:else}
        <p class="empty-hint">No notes yet — press + to start</p>
      {/each}
    </div>
  </div>
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 10px 0;
  }

  .nav-section { padding: 0 8px; }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--tx2);
    font-size: 0.875rem;
    font-weight: 500;
    text-align: left;
    transition: background var(--transition), color var(--transition);
    position: relative;
  }

  .nav-item:hover { background: var(--sf2); color: var(--tx); }
  .nav-item.active { background: var(--ac-bg); color: var(--ac); }
  .nav-item.active svg { stroke: var(--ac); }

  .badge {
    margin-left: auto;
    background: var(--ac);
    color: white;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }

  .divider { border: none; border-top: 1px solid var(--bd); margin: 8px 0; }

  .notes-section {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0 8px;
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 6px;
  }

  .section-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mu);
  }

  .new-note-btn {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    color: var(--mu);
    border-radius: var(--radius-sm);
  }
  .new-note-btn:hover { background: var(--sf2); color: var(--ac); }

  .search-wrap { margin-bottom: 6px; }
  .search-input {
    padding: 5px 10px;
    font-size: 0.8rem;
    border-radius: var(--radius-sm);
  }

  .notes-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .note-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition);
    position: relative;
  }

  .note-item:hover { background: var(--sf2); }
  .note-item.active { background: var(--ac-bg); }

  .note-title {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--tx);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .note-time {
    font-size: 0.7rem;
    color: var(--mu);
  }

  .pin-icon {
    color: var(--enzo);
    flex-shrink: 0;
  }

  .empty-hint {
    font-size: 0.78rem;
    color: var(--mu);
    text-align: center;
    padding: 16px 8px;
    line-height: 1.5;
  }
</style>
