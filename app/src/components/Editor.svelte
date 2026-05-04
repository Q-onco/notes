<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { nanoid } from 'nanoid';
  import { exportNote, exportAllNotes } from '../lib/export';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  const EXAMPLE_NOTES = [
    { id: '_ex1', title: 'HGSOC TME scRNA-seq — cohort notes', body: `## Overview\nAnalysing 14 HGSOC samples (8 treatment-naive, 6 post-PARPi).\n\n## Key observations\n- CAF subtype heterogeneity prominent in ascites vs solid tumour\n- CD8+ TIL exhaustion signature (TOX, HAVCR2) elevated post-PARPi\n- CXCL12-CXCR4 axis highly active in myofibroblastic CAFs\n\n## Next\n- [ ] NicheNet on macrophage–T cell interactions\n- [ ] Validate FOLR1 by multiplex IF on FFPE`, tags: ['hgsoc', 'tme', 'scrna-seq'], updatedAt: Date.now() - 7200000 },
    { id: '_ex2', title: 'Cellranger v8 — SORT_FAILS_MEMORY fix', body: `## Problem\nCellranger failing on OV-23-17B — insufficient memory (64GB) for >10k cells.\n\n## Fix\n\`\`\`bash\ncellranger count --localcores=32 --localmem=128\n\`\`\``, tags: ['pipeline', 'cellranger'], updatedAt: Date.now() - 86400000 },
  ];

  function openExample(id: string) {
    const ex = EXAMPLE_NOTES.find(e => e.id === id);
    if (!ex) return;
    const newNote = { ...ex, id: nanoid(), createdAt: Date.now(), updatedAt: Date.now(), pinned: false, archived: false, audioIds: [] };
    store.notes = [newNote, ...store.notes];
    store.currentNoteId = newNote.id;
    store.saveNotes();
  }

  let tab = $state<'edit' | 'preview'>('edit');
  let saving = $state(false);
  let saveTimer: ReturnType<typeof setTimeout>;
  let tagInput = $state('');

  const note = $derived(store.currentNote);

  const rendered = $derived(
    note ? DOMPurify.sanitize(marked.parse(note.body) as string) : ''
  );

  function autoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (!note) return;
      saving = true;
      try {
        await store.saveNotes();
      } finally {
        saving = false;
      }
    }, 1200);
  }

  function updateTitle(e: Event) {
    if (!note) return;
    note.title = (e.target as HTMLInputElement).value;
    note.updatedAt = Date.now();
    autoSave();
  }

  function updateBody(e: Event) {
    if (!note) return;
    note.body = (e.target as HTMLTextAreaElement).value;
    note.updatedAt = Date.now();
    parseTasks();
    autoSave();
  }

  function parseTasks() {
    if (!note) return;
    const lines = note.body.split('\n');
    const existing = new Set(store.tasks.filter(t => t.noteId === note!.id).map(t => t.text));
    for (const line of lines) {
      const m = line.match(/^[-*]\s+\[[ x]\]\s+(.+)/);
      if (m && !existing.has(m[1])) {
        store.tasks = [...store.tasks, {
          id: nanoid(),
          text: m[1].trim(),
          done: line.includes('[x]'),
          noteId: note.id,
          createdAt: Date.now(),
          dueAt: null,
          priority: 'medium'
        }];
      }
    }
  }

  function addTag() {
    if (!note || !tagInput.trim()) return;
    const tag = tagInput.trim().toLowerCase();
    if (!note.tags.includes(tag)) {
      note.tags = [...note.tags, tag];
      autoSave();
    }
    tagInput = '';
  }

  function removeTag(tag: string) {
    if (!note) return;
    note.tags = note.tags.filter(t => t !== tag);
    autoSave();
  }

  async function togglePin() {
    if (!note) return;
    note.pinned = !note.pinned;
    await store.saveNotes();
    showToast(note.pinned ? 'Note pinned' : 'Note unpinned');
  }

  async function archiveNote() {
    if (!note) return;
    note.archived = true;
    store.currentNoteId = null;
    await store.saveNotes();
    showToast('Note archived');
  }

  async function deleteNote() {
    if (!note) return;
    if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    store.notes = store.notes.filter(n => n.id !== note!.id);
    store.currentNoteId = null;
    await store.saveNotes();
    showToast('Note deleted');
  }

  function handleTagKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  }
</script>

<div class="editor">
  {#if !note}
    <div class="empty-state">
      {#if store.notes.filter(n => !n.archived).length === 0}
        <div class="empty-first">
          <p class="empty-headline">Your notes will live here.</p>
          <p class="empty-sub text-mu">Two examples to get you started — click to open and edit.</p>
          <div class="example-cards">
            {#each EXAMPLE_NOTES as ex}
              <button class="example-card" onclick={() => openExample(ex.id)}>
                <span class="example-label">· example</span>
                <span class="example-title">{ex.title}</span>
                <span class="example-preview text-xs text-mu">{ex.body.replace(/[#`\n]/g, ' ').slice(0, 80)}…</span>
                {#each ex.tags as tag}
                  <span class="example-tag">{tag}</span>
                {/each}
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <p class="text-mu text-sm">Select a note from the sidebar, or create a new one.</p>
      {/if}
    </div>
  {:else}
    {#key note.id}
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div class="tab-group">
        <button class="tab-btn" class:active={tab === 'edit'} onclick={() => tab = 'edit'}>Edit</button>
        <button class="tab-btn" class:active={tab === 'preview'} onclick={() => tab = 'preview'}>Preview</button>
      </div>
      <div class="toolbar-actions">
        {#if saving}
          <span class="save-indicator text-xs text-mu">Saving...</span>
        {:else}
          <span class="save-indicator text-xs text-mu">
            Saved {new Date(note.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        {/if}
        <button
          class="btn-icon"
          class:active={note.pinned}
          onclick={togglePin}
          title={note.pinned ? 'Unpin' : 'Pin'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
          </svg>
        </button>
        <button class="btn-icon" onclick={archiveNote} title="Archive">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
        </button>
        <button class="btn-icon" onclick={() => exportNote(note!)} title="Export note as .md">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button class="btn-icon danger" onclick={deleteNote} title="Delete">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Title -->
    <input
      class="title-input"
      type="text"
      value={note.title}
      oninput={updateTitle}
      placeholder="Note title"
    />

    <!-- Tags -->
    <div class="tags-row">
      {#each note.tags as tag}
        <span class="tag">
          {tag}
          <button class="tag-remove" onclick={() => removeTag(tag)} aria-label="Remove tag">×</button>
        </span>
      {/each}
      <input
        class="tag-input"
        type="text"
        bind:value={tagInput}
        onkeydown={handleTagKey}
        placeholder="Add tag..."
      />
    </div>

    <!-- Content -->
    <div class="content-area">
      {#if tab === 'edit'}
        <textarea
          class="body-editor"
          value={note.body}
          oninput={updateBody}
          placeholder="Write in Markdown — tasks with - [ ] are tracked automatically."
          spellcheck="true"
        ></textarea>
      {:else}
        <div class="preview md">
          {#if rendered}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html rendered}
          {:else}
            <p class="text-mu text-sm">Nothing to preview yet.</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer metadata -->
    <div class="editor-footer text-xs text-mu">
      <span>Created {new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <span>{note.body.split(/\s+/).filter(Boolean).length} words</span>
      {#if note.audioIds.length > 0}
        <span>{note.audioIds.length} recording{note.audioIds.length > 1 ? 's' : ''}</span>
      {/if}
    </div>
    {/key}
  {/if}
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
  }

  .empty-first {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 520px;
    text-align: center;
  }

  .empty-headline {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--tx2);
  }

  .empty-sub { margin-bottom: 6px; }

  .example-cards {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
  }

  .example-card {
    flex: 1;
    min-width: 200px;
    max-width: 240px;
    background: var(--sf);
    border: 1px dashed var(--bd2);
    border-radius: var(--radius);
    padding: 14px;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 5px;
    opacity: 0.7;
    transition: opacity var(--transition), border-color var(--transition);
  }
  .example-card:hover { opacity: 1; border-color: var(--ac); }

  .example-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    color: var(--mu);
    text-transform: uppercase;
  }

  .example-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--tx);
    line-height: 1.4;
  }

  .example-preview {
    line-height: 1.5;
    margin-top: 2px;
  }

  .example-tag {
    display: inline-block;
    font-size: 0.68rem;
    padding: 1px 7px;
    background: var(--ac-bg);
    color: var(--ac);
    border-radius: 10px;
    margin-right: 3px;
    margin-top: 2px;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
  }

  .tab-group {
    display: flex;
    gap: 2px;
    background: var(--sf2);
    border-radius: var(--radius-sm);
    padding: 2px;
  }
  .tab-btn {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    background: transparent;
    color: var(--mu);
    transition: background var(--transition), color var(--transition);
  }
  .tab-btn.active { background: var(--sf); color: var(--tx); box-shadow: var(--shadow-sm); }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .save-indicator { color: var(--mu); margin-right: 8px; }
  .btn-icon.active { color: var(--enzo); }
  .btn-icon.danger:hover { color: var(--rd); background: var(--rd-bg); }

  .title-input {
    font-size: 1.3rem;
    font-weight: 700;
    border: none;
    border-bottom: 1px solid var(--bd);
    border-radius: 0;
    padding: 14px 20px;
    letter-spacing: -0.02em;
    background: var(--sf);
    flex-shrink: 0;
  }
  .title-input:focus { border-bottom-color: var(--ac); box-shadow: none; }

  .tags-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 20px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px 2px 10px;
    background: var(--ac-bg);
    color: var(--ac);
    border: 1px solid var(--ac);
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  .tag-remove {
    background: transparent;
    border: none;
    color: var(--ac);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    opacity: 0.7;
  }
  .tag-remove:hover { opacity: 1; }

  .tag-input {
    border: none;
    background: transparent;
    font-size: 0.8rem;
    color: var(--tx2);
    padding: 2px 4px;
    width: 100px;
    flex-shrink: 0;
  }
  .tag-input:focus { box-shadow: none; }

  .content-area {
    flex: 1;
    overflow: hidden;
    display: flex;
  }

  .body-editor {
    flex: 1;
    border: none;
    border-radius: 0;
    resize: none;
    padding: 20px;
    font-size: 0.95rem;
    font-family: var(--mono);
    line-height: 1.75;
    background: var(--bg);
    color: var(--tx);
    height: 100%;
    overflow-y: auto;
  }
  .body-editor:focus { box-shadow: none; }

  .preview {
    flex: 1;
    overflow-y: auto;
    padding: 20px 28px;
    background: var(--bg);
  }

  .editor-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 20px;
    border-top: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
  }
</style>
