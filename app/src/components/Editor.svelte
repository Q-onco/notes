<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { exportNote, exportNoteDocx, exportNotePdf } from '../lib/export';
  import RichEditor from './RichEditor.svelte';

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

  let saving = $state(false);
  let saveTimer: ReturnType<typeof setTimeout>;
  let tagInput = $state('');
  let focusMode = $state(false);
  let showTemplates = $state(false);

  const NOTE_TEMPLATES = [
    { label: 'Lab meeting',        body: `# Lab Meeting — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n## Attendees\n\n## Agenda\n\n## Discussion\n\n## Action items\n- [ ] \n\n## Next meeting\n` },
    { label: 'Paper review',       body: `# Paper Review\n\n**Title:**\n**Authors:**\n**Journal/Year:**\n**DOI:**\n\n## Key claims\n\n## Methods\n\n## Strengths\n\n## Limitations\n\n## HGSOC relevance\n\n## Questions raised\n- [ ] \n` },
    { label: 'Experiment design',  body: `# Experiment: \n\n## Hypothesis\n\n## Rationale\n\n## Protocol\n\n### Materials\n\n### Steps\n1. \n\n## Controls\n\n## Expected readout\n\n## QC criteria\n\n## Tasks\n- [ ] \n` },
    { label: 'Grant section',      body: `# Grant Section: \n\n## Specific aim\n\n## Background & significance\n\n## Preliminary data\n\n## Approach\n\n### Year 1\n\n### Year 2\n\n## Innovation\n\n## Potential pitfalls\n` },
    { label: 'Literature summary', body: `# Literature Summary: \n\n## Topic\n\n## Key papers\n\n## Consensus findings\n\n## Open questions\n\n## Gaps relevant to our work\n\n## References\n` },
  ];

  function applyTemplate(tpl: typeof NOTE_TEMPLATES[0]) {
    if (!note) return;
    note.body = tpl.body;
    note.title = note.title === 'Untitled note' ? tpl.label : note.title;
    note.updatedAt = Date.now();
    showTemplates = false;
    autoSave();
  }

  const note = $derived(store.currentNote);

  function autoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (!note) return;
      saving = true;
      try { await store.saveNotes(); } finally { saving = false; }
    }, 1200);
  }

  function updateTitle(e: Event) {
    if (!note) return;
    note.title = (e.target as HTMLInputElement).value;
    note.updatedAt = Date.now();
    autoSave();
  }

  function onBodyChange(html: string) {
    if (!note) return;
    note.body = html;
    note.updatedAt = Date.now();
    parseTasks();
    autoSave();
  }

  function parseTasks() {
    if (!note) return;
    const doc = new DOMParser().parseFromString(note.body, 'text/html');
    const items = doc.querySelectorAll('ul[data-type="taskList"] li');
    const existing = new Set(store.tasks.filter(t => t.noteId === note!.id).map(t => t.text));
    items.forEach(li => {
      const text = li.textContent?.trim();
      const done = li.getAttribute('data-checked') === 'true';
      if (text && !existing.has(text)) {
        store.tasks = [...store.tasks, {
          id: nanoid(), text, done, noteId: note!.id,
          createdAt: Date.now(), dueAt: null, priority: 'medium'
        }];
      }
    });
  }

  function wordCount(html: string) {
    return html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  }

  function addTag() {
    if (!note || !tagInput.trim()) return;
    const tag = tagInput.trim().toLowerCase();
    if (!note.tags.includes(tag)) { note.tags = [...note.tags, tag]; autoSave(); }
    tagInput = '';
  }

  function removeTag(tag: string) {
    if (!note) return;
    note.tags = note.tags.filter(t => t !== tag);
    autoSave();
  }

  function handleTagKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
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

  function onEditorKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') { e.preventDefault(); focusMode = !focusMode; }
    if (e.key === 'Escape' && focusMode) focusMode = false;
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
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="focus-backdrop" class:focus-active={focusMode} onkeydown={onEditorKey}>
    {#key note.id}

    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div class="tab-group">
        <div class="template-wrap">
          <button class="tab-btn" onclick={() => showTemplates = !showTemplates} title="Insert template">Template</button>
          {#if showTemplates}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="template-backdrop" onclick={() => showTemplates = false}></div>
            <div class="template-dropdown">
              {#each NOTE_TEMPLATES as tpl}
                <button class="template-item" onclick={() => applyTemplate(tpl)}>{tpl.label}</button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <div class="toolbar-actions">
        {#if saving}
          <span class="save-indicator text-xs text-mu">Saving...</span>
        {:else}
          <span class="save-indicator text-xs text-mu">
            Saved {new Date(note.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        {/if}
        <button class="btn-icon" class:active={note.pinned} onclick={togglePin} title={note.pinned ? 'Unpin' : 'Pin'}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
          </svg>
        </button>
        <button class="btn-icon" onclick={archiveNote} title="Archive">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
        </button>
        <button class="btn-icon" onclick={() => exportNote(note!)} title="Export as .md">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button class="btn-icon" onclick={() => exportNoteDocx(note!)} title="Export as .doc (Word)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h7M7 16h5"/></svg>
        </button>
        <button class="btn-icon" onclick={() => exportNotePdf(note!)} title="Print / Save as PDF">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </button>
        <button class="btn-icon danger" onclick={deleteNote} title="Delete">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/>
          </svg>
        </button>
        <button class="btn-icon focus-btn" class:focus-on={focusMode} onclick={() => focusMode = !focusMode} title="Focus mode (Ctrl+Shift+F)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Title -->
    <input class="title-input" type="text" value={note.title} oninput={updateTitle} placeholder="Note title" />

    <!-- Tags -->
    <div class="tags-row">
      {#each note.tags as tag}
        <span class="tag">
          {tag}
          <button class="tag-remove" onclick={() => removeTag(tag)} aria-label="Remove tag">×</button>
        </span>
      {/each}
      <input class="tag-input" type="text" bind:value={tagInput} onkeydown={handleTagKey} placeholder="Add tag..." />
    </div>

    <!-- Rich editor -->
    <div class="content-area">
      <RichEditor
        bind:value={note.body}
        onchange={onBodyChange}
        placeholder="Start writing… use the toolbar above for formatting"
        minHeight="100%"
        class="note-body-editor"
      />
    </div>

    <!-- Footer -->
    <div class="editor-footer text-xs text-mu">
      <span>Created {new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <span>{wordCount(note.body)} words</span>
      {#if note.audioIds.length > 0}
        <span>{note.audioIds.length} recording{note.audioIds.length > 1 ? 's' : ''}</span>
      {/if}
    </div>

    {/key}
    </div>
  {/if}
</div>

<style>
  .editor { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .empty-state { display: flex; align-items: center; justify-content: center; height: 100%; padding: 24px; }
  .empty-first { display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: 520px; text-align: center; }
  .empty-headline { font-size: 1.05rem; font-weight: 600; color: var(--tx2); }
  .empty-sub { margin-bottom: 6px; }
  .example-cards { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; width: 100%; }
  .example-card {
    flex: 1; min-width: 200px; max-width: 240px;
    background: var(--sf); border: 1px dashed var(--bd2);
    border-radius: var(--radius); padding: 14px; text-align: left; cursor: pointer;
    display: flex; flex-direction: column; gap: 5px;
    opacity: 0.7; transition: opacity var(--transition), border-color var(--transition);
  }
  .example-card:hover { opacity: 1; border-color: var(--ac); }
  .example-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.07em; color: var(--mu); text-transform: uppercase; }
  .example-title { font-size: 0.82rem; font-weight: 600; color: var(--tx); line-height: 1.4; }
  .example-preview { line-height: 1.5; margin-top: 2px; }
  .example-tag { display: inline-block; font-size: 0.68rem; padding: 1px 7px; background: var(--ac-bg); color: var(--ac); border-radius: 10px; margin-right: 3px; margin-top: 2px; }

  .editor-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 16px; border-bottom: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0;
  }
  .tab-group { display: flex; gap: 2px; }
  .tab-btn {
    padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: 500;
    background: var(--sf2); color: var(--tx2); border: 1px solid var(--bd);
    transition: background var(--transition), color var(--transition);
  }
  .tab-btn:hover { background: var(--sf); color: var(--tx); }
  .toolbar-actions { display: flex; align-items: center; gap: 4px; }
  .save-indicator { color: var(--mu); margin-right: 8px; }
  .btn-icon.active { color: var(--enzo); }
  .btn-icon.danger:hover { color: var(--rd); background: var(--rd-bg); }

  .title-input {
    font-size: 1.3rem; font-weight: 700; border: none;
    border-bottom: 1px solid var(--bd); border-radius: 0;
    padding: 14px 20px; letter-spacing: -0.02em;
    background: var(--sf); flex-shrink: 0;
  }
  .title-input:focus { border-bottom-color: var(--ac); box-shadow: none; }

  .tags-row {
    display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
    padding: 8px 20px; border-bottom: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0;
  }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px 2px 10px; background: var(--ac-bg); color: var(--ac); border: 1px solid var(--ac); border-radius: 20px; font-size: 0.75rem; font-weight: 500; }
  .tag-remove { background: transparent; border: none; color: var(--ac); cursor: pointer; font-size: 14px; line-height: 1; padding: 0; opacity: 0.7; }
  .tag-remove:hover { opacity: 1; }
  .tag-input { border: none; background: transparent; font-size: 0.8rem; color: var(--tx2); padding: 2px 4px; width: 100px; flex-shrink: 0; }
  .tag-input:focus { box-shadow: none; }

  .content-area { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

  :global(.note-body-editor) {
    flex: 1;
    border: none !important;
    border-radius: 0 !important;
  }
  :global(.note-body-editor .re-toolbar) {
    border-top: none;
    background: var(--sf);
    border-bottom: 1px solid var(--bd);
  }
  :global(.note-body-editor .re-content) {
    flex: 1;
    overflow-y: auto;
    padding: 20px 28px;
    background: var(--bg);
  }

  .editor-footer {
    display: flex; align-items: center; gap: 16px;
    padding: 8px 20px; border-top: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0;
  }

  /* Focus mode */
  .focus-backdrop { display: contents; }
  .focus-backdrop.focus-active {
    position: fixed; inset: 0; z-index: 300;
    background: var(--bg); display: flex; flex-direction: column;
    overflow: hidden;
  }
  .focus-btn { color: var(--mu); }
  .focus-btn.focus-on { color: var(--ac); background: var(--ac-bg); }

  /* Template picker */
  .template-wrap { position: relative; }
  .template-backdrop { position: fixed; inset: 0; z-index: 10; }
  .template-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0;
    background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius); box-shadow: var(--shadow-lg);
    z-index: 11; min-width: 160px; overflow: hidden;
  }
  .template-item {
    display: block; width: 100%; text-align: left;
    padding: 9px 14px; background: transparent; border: none;
    font-size: 0.85rem; color: var(--tx); cursor: pointer;
    font-family: var(--font); border-bottom: 1px solid var(--bd);
  }
  .template-item:last-child { border-bottom: none; }
  .template-item:hover { background: var(--sf2); color: var(--ac); }
</style>
