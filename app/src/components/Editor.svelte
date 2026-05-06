<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { exportNote, exportNoteDocx, exportNotePdf } from '../lib/export';
  import RichEditor from './RichEditor.svelte';
  import SlashMenu from './SlashMenu.svelte';
  import { askEnzoInline } from '../lib/groq';
  import type { SlashRef } from './RichEditor.svelte';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let saving = $state(false);
  let saveTimer: ReturnType<typeof setTimeout>;
  let tagInput = $state('');
  let focusMode = $state(false);
  let showTemplates = $state(false);
  let showSaveTemplate = $state(false);
  let templateLabel = $state('');

  // Slash menu
  let slashVisible = $state(false);
  let slashQuery = $state('');
  let slashX = $state(0);
  let slashY = $state(0);
  let slashFrom = $state(0);
  let slashTo = $state(0);
  let editorRef = $state<SlashRef | null>(null);

  // Enzo analyse toolbar
  let analysing = $state(false);
  let analyseMode = $state<'summarise' | 'findings' | 'devil' | null>(null);
  let analyseResult = $state('');
  let showAnalysis = $state(false);
  let analyseAbort: AbortController | null = null;

  // ToC
  let showToc = $state(false);

  // Colour picker
  let showColorPicker = $state(false);

  // Backlinks
  let showBacklinks = $state(false);

  // Note links ([[…]] picker)
  let nlVisible = $state(false);
  let nlQuery   = $state('');
  let nlX       = $state(0);
  let nlY       = $state(0);
  let nlFrom    = $state(0);
  let nlTo      = $state(0);

  const NOTE_COLORS = [
    { id: 'ac'   as const, label: 'Blue',   css: 'var(--ac)' },
    { id: 'gn'   as const, label: 'Green',  css: 'var(--gn)' },
    { id: 'rd'   as const, label: 'Red',    css: 'var(--rd)' },
    { id: 'yw'   as const, label: 'Yellow', css: 'var(--yw)' },
    { id: 'pu'   as const, label: 'Purple', css: 'var(--pu)' },
    { id: 'enzo' as const, label: 'Orange', css: 'var(--enzo)' },
  ];

  const NOTE_TEMPLATES = [
    { label: 'Lab meeting',        body: `# Lab Meeting — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n## Attendees\n\n## Agenda\n\n## Discussion\n\n## Action items\n- [ ] \n\n## Next meeting\n` },
    { label: 'Paper review',       body: `# Paper Review\n\n**Title:**\n**Authors:**\n**Journal/Year:**\n**DOI:**\n\n## Key claims\n\n## Methods\n\n## Strengths\n\n## Limitations\n\n## HGSOC relevance\n\n## Questions raised\n- [ ] \n` },
    { label: 'Experiment design',  body: `# Experiment: \n\n## Hypothesis\n\n## Rationale\n\n## Protocol\n\n### Materials\n\n### Steps\n1. \n\n## Controls\n\n## Expected readout\n\n## QC criteria\n\n## Tasks\n- [ ] \n` },
    { label: 'Grant section',      body: `# Grant Section: \n\n## Specific aim\n\n## Background & significance\n\n## Preliminary data\n\n## Approach\n\n### Year 1\n\n### Year 2\n\n## Innovation\n\n## Potential pitfalls\n` },
    { label: 'Literature summary', body: `# Literature Summary: \n\n## Topic\n\n## Key papers\n\n## Consensus findings\n\n## Open questions\n\n## Gaps relevant to our work\n\n## References\n` },
  ];

  const ANALYSE_PROMPTS = {
    summarise: 'Write a concise summary (3–5 sentences) of this note. Focus on the key scientific points. Be direct, no preamble.',
    findings:  'Extract the 3–7 key scientific claims, findings, or data points from this note as a numbered list. Be specific and precise. No preamble.',
    devil:     "Play devil's advocate against the main conclusions in this note. What assumptions are questionable? What alternative explanations exist? What controls are missing to validate these conclusions? Be rigorous.",
  };

  function applyTemplate(tpl: { label: string; body: string }) {
    if (!note) return;
    note.body = tpl.body;
    note.title = note.title === 'Untitled note' ? tpl.label : note.title;
    note.updatedAt = Date.now();
    showTemplates = false;
    showSaveTemplate = false;
    autoSave();
  }

  const note = $derived(store.currentNote);

  // Reactive derived values
  const backlinkTasks       = $derived(note ? store.tasks.filter(t => t.noteId === note.id) : []);
  const backlinkAudio       = $derived(note ? store.audioRecords.filter(a => a.noteId === note.id) : []);
  const backlinkManuscripts = $derived(note ? store.manuscripts.filter(m => m.linkedNoteIds.includes(note.id)) : []);
  const backlinkNotes       = $derived(note ? store.notes.filter(n => n.id !== note!.id && n.body.includes(`note:${note!.id}`)) : []);
  const hasBacklinks        = $derived(backlinkTasks.length + backlinkAudio.length + backlinkManuscripts.length + backlinkNotes.length > 0);

  const nlFiltered = $derived(
    store.notes.filter(n => !n.archived && n.id !== (note?.id ?? ''))
      .filter(n => !nlQuery.trim() || n.title.toLowerCase().includes(nlQuery.toLowerCase()))
      .slice(0, 8)
  );

  const tocItems = $derived(
    showToc && note
      ? Array.from(
          new DOMParser().parseFromString(note.body, 'text/html').querySelectorAll('h1, h2, h3')
        ).map(h => ({ level: parseInt(h.tagName[1]), text: h.textContent?.trim() || '' }))
      : []
  );

  // Reset panels when note changes
  let _prevNoteId: string | null = null;
  $effect(() => {
    const id = note?.id ?? null;
    if (id !== _prevNoteId) {
      _prevNoteId = id;
      showAnalysis = false;
      analyseResult = '';
      analyseMode = null;
      showToc = false;
      showColorPicker = false;
      showBacklinks = false;
      slashVisible = false;
      nlVisible = false;
    }
  });

  function scrollToHeading(text: string) {
    const ed = editorRef?.getEditor();
    if (!ed) return;
    const headings = ed.view.dom.querySelectorAll('h1, h2, h3');
    for (const h of headings) {
      if (h.textContent?.trim() === text) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }

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

  function readingTime(html: string) {
    return Math.max(1, Math.ceil(wordCount(html) / 200));
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

  async function duplicateNote() {
    if (!note) return;
    const copy = {
      ...note,
      id: nanoid(),
      title: `${note.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
    };
    store.notes = [copy, ...store.notes];
    store.currentNoteId = copy.id;
    await store.saveNotes();
    showToast('Note duplicated');
  }

  async function setNoteColor(color: typeof NOTE_COLORS[number]['id'] | undefined) {
    if (!note) return;
    note.color = color;
    showColorPicker = false;
    await store.saveNotes();
  }

  async function saveAsTemplate() {
    if (!note || !templateLabel.trim()) return;
    const existing = store.settings.customTemplates ?? [];
    store.settings.customTemplates = [...existing, { label: templateLabel.trim(), body: note.body }];
    await store.saveSettings();
    templateLabel = '';
    showSaveTemplate = false;
    showTemplates = false;
    showToast('Template saved');
  }

  async function runAnalysis(mode: 'summarise' | 'findings' | 'devil') {
    if (!note) return;
    // Toggle off if same mode is clicked again
    if (showAnalysis && analyseMode === mode) { showAnalysis = false; return; }
    analyseAbort?.abort();
    analyseAbort = new AbortController();
    analysing = true;
    analyseMode = mode;
    analyseResult = '';
    showAnalysis = true;
    const plain = note.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
    try {
      analyseResult = await askEnzoInline(ANALYSE_PROMPTS[mode], plain, analyseAbort.signal);
    } catch (e: any) {
      if (e?.name !== 'AbortError') showToast('Enzo error', 'error');
    } finally {
      analysing = false;
    }
  }

  function onSlashQuery(query: string, x: number, y: number, from: number, to: number) {
    slashQuery = query; slashX = x; slashY = y; slashFrom = from; slashTo = to;
    slashVisible = true;
  }

  function onSlashClose() { slashVisible = false; }

  function onNoteLinkQuery(query: string, x: number, y: number, from: number, to: number) {
    nlQuery = query; nlX = x; nlY = y; nlFrom = from; nlTo = to;
    nlVisible = true;
  }

  function onNoteLinkClose() { nlVisible = false; }

  function selectNoteLink(targetNote: { id: string; title: string }) {
    editorRef?.insertNoteLink(targetNote.id, targetNote.title, nlFrom, nlTo);
    nlVisible = false;
  }

  function handleContentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (href.startsWith('note:')) {
      e.preventDefault();
      const targetId = href.slice(5);
      const target = store.notes.find(n => n.id === targetId);
      if (target) { store.currentNoteId = targetId; }
    }
  }

  function onEditorKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') { e.preventDefault(); focusMode = !focusMode; }
    if (e.key === 'Escape' && focusMode) focusMode = false;
    if (e.key === 'Escape') { slashVisible = false; showColorPicker = false; showTemplates = false; }
  }
</script>

<div class="editor">
  {#if !note}
    <div class="empty-state">
      <button class="new-note-big" onclick={() => {
        const n = { id: nanoid(), title: 'Untitled note', body: '', tags: [], createdAt: Date.now(), updatedAt: Date.now(), pinned: false, archived: false, audioIds: [] };
        store.notes = [n, ...store.notes];
        store.currentNoteId = n.id;
        store.view = 'notes';
        store.saveNotes();
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <p class="text-mu text-sm">New note</p>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="focus-backdrop" class:focus-active={focusMode} onkeydown={onEditorKey}>
    {#key note.id}

    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div class="tab-group">

        <!-- Template dropdown -->
        <div class="template-wrap">
          <button class="tab-btn" onclick={() => { showTemplates = !showTemplates; showSaveTemplate = false; }} title="Insert template">Template</button>
          {#if showTemplates}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="template-backdrop" onclick={() => { showTemplates = false; showSaveTemplate = false; }}></div>
            <div class="template-dropdown">
              {#each NOTE_TEMPLATES as tpl}
                <button class="template-item" onclick={() => applyTemplate(tpl)}>{tpl.label}</button>
              {/each}
              {#each (store.settings.customTemplates ?? []) as tpl}
                <button class="template-item template-custom" onclick={() => applyTemplate(tpl)}>★ {tpl.label}</button>
              {/each}
              <div class="template-divider"></div>
              {#if showSaveTemplate}
                <div class="save-template-form">
                  <input class="save-tpl-input" bind:value={templateLabel} placeholder="Template name" autofocus
                    onkeydown={(e) => { if (e.key === 'Enter') saveAsTemplate(); if (e.key === 'Escape') showSaveTemplate = false; }} />
                  <button class="btn btn-primary btn-sm" onclick={saveAsTemplate}>Save</button>
                </div>
              {:else}
                <button class="template-item template-save-btn" onclick={() => showSaveTemplate = true}>Save current note as template…</button>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Enzo analyse -->
        <button class="tab-btn enzo-tab" class:enzo-tab-active={showAnalysis && analyseMode === 'summarise'} onclick={() => runAnalysis('summarise')} title="Enzo: summarise this note">Summarise</button>
        <button class="tab-btn enzo-tab" class:enzo-tab-active={showAnalysis && analyseMode === 'findings'}  onclick={() => runAnalysis('findings')}  title="Enzo: extract key findings">Key findings</button>
        <button class="tab-btn enzo-tab" class:enzo-tab-active={showAnalysis && analyseMode === 'devil'}     onclick={() => runAnalysis('devil')}     title="Enzo: devil's advocate">Devil's advocate</button>

      </div>

      <div class="toolbar-actions">
        {#if saving}
          <span class="save-indicator text-xs text-mu">Saving…</span>
        {:else}
          <span class="save-indicator text-xs text-mu">Saved {new Date(note.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        {/if}

        <!-- Colour label -->
        <div class="color-wrap">
          <button class="btn-icon color-dot-btn" onclick={() => showColorPicker = !showColorPicker} title="Note colour label">
            <span class="color-dot" style={note.color ? `background: var(--${note.color})` : 'background: var(--bd)'}></span>
          </button>
          {#if showColorPicker}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="color-backdrop" onclick={() => showColorPicker = false}></div>
            <div class="color-picker">
              <button class="color-swatch color-none" onclick={() => setNoteColor(undefined)} title="Remove colour">×</button>
              {#each NOTE_COLORS as c}
                <button class="color-swatch" class:color-active={note.color === c.id}
                  style="background: {c.css}" onclick={() => setNoteColor(c.id)} title={c.label}></button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- ToC toggle -->
        <button class="btn-icon" class:active={showToc} onclick={() => showToc = !showToc} title="Table of contents">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="12" y2="18"/>
          </svg>
        </button>

        <!-- Duplicate -->
        <button class="btn-icon" onclick={duplicateNote} title="Duplicate note">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>

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
        <button class="btn-icon" onclick={() => exportNoteDocx(note!)} title="Export as .doc">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h7M7 16h5"/></svg>
        </button>
        <button class="btn-icon" onclick={() => exportNotePdf(note!)} title="Print / Save as PDF">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </button>
        <button class="btn-icon" onclick={() => {
          if (!note) return;
          const plain = note.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          store.openCompose({ subject: note.title || 'Note', body: plain });
        }} title="Send as email">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
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

    <!-- Enzo analysis panel -->
    {#if showAnalysis}
      <div class="analysis-panel">
        <div class="analysis-head">
          <span class="analysis-label">
            {#if analysing}
              <span class="enzo-spin-sm"></span>
              Enzo · {analyseMode === 'summarise' ? 'Summarising' : analyseMode === 'findings' ? 'Extracting findings' : "Playing devil's advocate"}…
            {:else}
              🐾 Enzo · {analyseMode === 'summarise' ? 'Summary' : analyseMode === 'findings' ? 'Key findings' : "Devil's advocate"}
            {/if}
          </span>
          <button class="btn-icon btn-xs" onclick={() => showAnalysis = false} title="Close">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="analysis-body">
          {#if analysing}
            <span class="text-mu">Thinking…</span>
          {:else}
            {analyseResult}
          {/if}
        </div>
      </div>
    {/if}

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
      <input class="tag-input" type="text" bind:value={tagInput} onkeydown={handleTagKey} placeholder="Add tag…" />
    </div>

    <!-- Content wrapper (ToC + editor) -->
    <div class="content-wrapper">

      <!-- ToC side panel -->
      {#if showToc}
        <div class="toc-panel">
          <div class="toc-head">
            <span class="toc-label">Contents</span>
            <button class="btn-icon btn-xs" onclick={() => showToc = false} title="Close">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="toc-list">
            {#each tocItems as item}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div class="toc-item toc-h{item.level}" onclick={() => scrollToHeading(item.text)}>
                {item.text || '(untitled heading)'}
              </div>
            {:else}
              <p class="toc-empty text-mu text-xs">No headings found</p>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Rich editor -->
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="content-area" onclick={handleContentClick}>
        <RichEditor
          bind:value={note.body}
          onchange={onBodyChange}
          placeholder="Start writing… type / for commands, [[ to link a note"
          minHeight="100%"
          class="note-body-editor"
          {onSlashQuery}
          {onSlashClose}
          {onNoteLinkQuery}
          {onNoteLinkClose}
          bind:slashRef={editorRef}
        />
      </div>
    </div>

    <!-- Backlinks panel -->
    {#if hasBacklinks}
      <div class="backlinks-panel">
        <button class="backlinks-toggle" onclick={() => showBacklinks = !showBacklinks}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
          <span>Linked items ({backlinkTasks.length + backlinkAudio.length + backlinkManuscripts.length + backlinkNotes.length})</span>
          <svg class="chevron" class:open={showBacklinks} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {#if showBacklinks}
          <div class="backlinks-body">
            {#if backlinkTasks.length > 0}
              <div class="bl-section">
                <span class="bl-label">Tasks</span>
                {#each backlinkTasks as t}
                  <button class="bl-item" onclick={() => store.view = 'tasks'}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                    <span class:item-done={t.done}>{t.text}</span>
                  </button>
                {/each}
              </div>
            {/if}
            {#if backlinkAudio.length > 0}
              <div class="bl-section">
                <span class="bl-label">Recordings</span>
                {#each backlinkAudio as a}
                  <button class="bl-item" onclick={() => store.view = 'audio'}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
                    <span>{new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {Math.round(a.durationSec)}s</span>
                  </button>
                {/each}
              </div>
            {/if}
            {#if backlinkManuscripts.length > 0}
              <div class="bl-section">
                <span class="bl-label">Manuscripts</span>
                {#each backlinkManuscripts as m}
                  <button class="bl-item" onclick={() => store.view = 'manuscript'}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>{m.title}</span>
                  </button>
                {/each}
              </div>
            {/if}
            {#if backlinkNotes.length > 0}
              <div class="bl-section">
                <span class="bl-label">Linked from</span>
                {#each backlinkNotes as n}
                  <button class="bl-item" onclick={() => { store.currentNoteId = n.id; }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    <span>{n.title || 'Untitled'}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Footer -->
    <div class="editor-footer text-xs text-mu">
      <span>Created {new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <span>{wordCount(note.body)} words</span>
      <span>~{readingTime(note.body)} min read</span>
      {#if note.audioIds.length > 0}
        <span>{note.audioIds.length} recording{note.audioIds.length > 1 ? 's' : ''}</span>
      {/if}
    </div>

    {/key}
    </div>
  {/if}
</div>

<!-- Note link picker — fixed position portal -->
{#if nlVisible}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="nl-backdrop" onclick={onNoteLinkClose}></div>
  <div class="nl-picker" style="left:{nlX}px; top:{nlY + 6}px;">
    {#if nlFiltered.length === 0}
      <div class="nl-empty text-xs text-mu">No notes match "{nlQuery}"</div>
    {:else}
      {#each nlFiltered as n (n.id)}
        <button class="nl-item" onclick={() => selectNoteLink(n)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span class="nl-title">{n.title || 'Untitled'}</span>
        </button>
      {/each}
    {/if}
  </div>
{/if}

<!-- Slash command menu — fixed position portal -->
{#if slashVisible && note}
  <SlashMenu
    query={slashQuery}
    x={slashX}
    y={slashY}
    slashFrom={slashFrom}
    slashTo={slashTo}
    getEditor={() => editorRef?.getEditor() ?? null}
    noteId={note.id}
    noteHtml={note.body}
    {showToast}
    onClose={onSlashClose}
  />
{/if}

<style>
  .editor { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px; }
  .new-note-big {
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--ac-bg); color: var(--ac); border: 2px dashed var(--ac);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background var(--transition), transform var(--transition);
  }
  .new-note-big:hover { background: var(--ac); color: #fff; transform: scale(1.08); }

  /* ── Toolbar ── */
  .editor-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 12px; border-bottom: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0; gap: 4px; flex-wrap: wrap;
  }
  .tab-group { display: flex; gap: 2px; flex-wrap: wrap; }
  .tab-btn {
    padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; font-weight: 500;
    background: var(--sf2); color: var(--tx2); border: 1px solid var(--bd);
    transition: background var(--transition), color var(--transition);
    white-space: nowrap;
  }
  .tab-btn:hover { background: var(--sf); color: var(--tx); }
  .enzo-tab { color: var(--enzo); border-color: color-mix(in srgb, var(--enzo) 30%, var(--bd)); }
  .enzo-tab:hover { background: color-mix(in srgb, var(--enzo) 8%, var(--sf)); }
  .enzo-tab-active { background: color-mix(in srgb, var(--enzo) 12%, var(--sf)) !important; color: var(--enzo) !important; font-weight: 600; }

  .toolbar-actions { display: flex; align-items: center; gap: 3px; }
  .save-indicator { color: var(--mu); margin-right: 6px; white-space: nowrap; }
  .btn-icon.active { color: var(--ac); background: var(--ac-bg); }
  .btn-icon.danger:hover { color: var(--rd); background: var(--rd-bg); }
  .focus-btn { color: var(--mu); }
  .focus-btn.focus-on { color: var(--ac); background: var(--ac-bg); }
  .btn-xs { width: 22px !important; height: 22px !important; }

  /* ── Colour picker ── */
  .color-wrap { position: relative; }
  .color-dot-btn { display: flex; align-items: center; justify-content: center; }
  .color-dot { display: block; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--bd); flex-shrink: 0; }
  .color-backdrop { position: fixed; inset: 0; z-index: 50; }
  .color-picker {
    position: absolute; right: 0; top: calc(100% + 5px); z-index: 51;
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius-sm);
    padding: 7px; display: flex; gap: 5px; align-items: center;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  }
  .color-swatch {
    width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent;
    cursor: pointer; transition: transform var(--transition);
  }
  .color-swatch:hover { transform: scale(1.25); }
  .color-swatch.color-active { border-color: var(--tx); }
  .color-none {
    background: var(--sf2) !important; border-color: var(--bd) !important;
    font-size: 13px; color: var(--mu); display: flex; align-items: center; justify-content: center; line-height: 1;
  }

  /* ── Template dropdown ── */
  .template-wrap { position: relative; }
  .template-backdrop { position: fixed; inset: 0; z-index: 10; }
  .template-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 11;
    background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    min-width: 210px; overflow: hidden;
  }
  .template-item {
    display: block; width: 100%; text-align: left;
    padding: 8px 14px; background: transparent; border: none;
    font-size: 0.83rem; color: var(--tx); cursor: pointer;
    font-family: var(--font); border-bottom: 1px solid var(--bd);
  }
  .template-item:last-child { border-bottom: none; }
  .template-item:hover { background: var(--sf2); color: var(--ac); }
  .template-custom { color: var(--ac); }
  .template-save-btn { color: var(--mu); font-style: italic; font-size: 0.78rem !important; }
  .template-save-btn:hover { color: var(--tx); }
  .template-divider { border: none; border-top: 1px solid var(--bd); margin: 2px 0; }
  .save-template-form { display: flex; gap: 6px; padding: 8px 10px; align-items: center; }
  .save-tpl-input { flex: 1; font-size: 0.82rem !important; padding: 4px 8px !important; }

  /* ── Enzo analysis panel ── */
  .analysis-panel {
    border-bottom: 1px solid var(--bd); flex-shrink: 0;
    background: color-mix(in srgb, var(--enzo) 6%, var(--sf));
  }
  .analysis-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 16px;
  }
  .analysis-label {
    font-size: 0.78rem; font-weight: 600; color: var(--enzo);
    display: flex; align-items: center; gap: 7px;
  }
  .analysis-body {
    padding: 2px 16px 10px; font-size: 0.84rem; color: var(--tx2);
    line-height: 1.65; white-space: pre-wrap; max-height: 220px; overflow-y: auto;
  }
  .enzo-spin-sm {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--enzo) 25%, transparent);
    border-top-color: var(--enzo);
    animation: spin-sm 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes spin-sm { to { transform: rotate(360deg); } }

  /* ── Title & tags ── */
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

  /* ── Content wrapper (ToC + editor) ── */
  .content-wrapper { flex: 1; overflow: hidden; display: flex; }

  .toc-panel {
    width: 196px; flex-shrink: 0; border-right: 1px solid var(--bd);
    background: var(--sf); display: flex; flex-direction: column; overflow: hidden;
  }
  .toc-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 10px; border-bottom: 1px solid var(--bd); flex-shrink: 0;
  }
  .toc-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mu); }
  .toc-list { overflow-y: auto; flex: 1; padding: 4px 0; }
  .toc-item { padding: 5px 10px; font-size: 0.8rem; color: var(--tx2); cursor: pointer; }
  .toc-item:hover { background: var(--sf2); color: var(--ac); }
  .toc-h1 { padding-left: 10px; font-weight: 600; color: var(--tx); }
  .toc-h2 { padding-left: 18px; }
  .toc-h3 { padding-left: 26px; font-size: 0.75rem; color: var(--mu); }
  .toc-empty { padding: 12px 10px; }

  .content-area { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

  :global(.note-body-editor) { flex: 1; border: none !important; border-radius: 0 !important; }
  :global(.note-body-editor .re-toolbar) { border-top: none; background: var(--sf); border-bottom: 1px solid var(--bd); }
  :global(.note-body-editor .re-content) { flex: 1; overflow-y: auto; padding: 20px 28px; background: var(--bg); }

  /* ── Backlinks panel ── */
  .backlinks-panel { border-top: 1px solid var(--bd); background: var(--sf); flex-shrink: 0; }
  .backlinks-toggle {
    display: flex; align-items: center; gap: 6px; width: 100%;
    padding: 6px 20px; background: transparent; border: none;
    font-size: 0.74rem; color: var(--mu); cursor: pointer; text-align: left;
    font-family: var(--font);
  }
  .backlinks-toggle:hover { color: var(--tx2); background: var(--sf2); }
  .chevron { margin-left: auto; transition: transform var(--transition); }
  .chevron.open { transform: rotate(180deg); }
  .backlinks-body { padding: 4px 20px 10px; }
  .bl-section { margin-bottom: 8px; }
  .bl-label { font-size: 0.63rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mu); display: block; margin-bottom: 3px; }
  .bl-item {
    display: flex; align-items: center; gap: 6px; width: 100%;
    padding: 3px 0; background: transparent; border: none;
    font-size: 0.78rem; color: var(--tx2); cursor: pointer; text-align: left; font-family: var(--font);
  }
  .bl-item:hover { color: var(--ac); }
  .bl-item .item-done { text-decoration: line-through; opacity: 0.5; }

  /* ── Footer ── */
  .editor-footer {
    display: flex; align-items: center; gap: 16px;
    padding: 8px 20px; border-top: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0;
  }

  /* ── Focus mode ── */
  .focus-backdrop { display: contents; }
  .focus-backdrop.focus-active {
    position: fixed; inset: 0; z-index: 300;
    background: var(--bg); display: flex; flex-direction: column; overflow: hidden;
  }

  /* ── Note link picker (fixed portal) ── */
  .nl-backdrop { position: fixed; inset: 0; z-index: 199; }
  .nl-picker {
    position: fixed; z-index: 200;
    background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius-sm); box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    min-width: 230px; max-width: 340px; max-height: 220px;
    overflow-y: auto; padding: 4px 0;
  }
  .nl-item {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 6px 12px; background: transparent; border: none;
    font-size: 0.82rem; color: var(--tx2); cursor: pointer;
    text-align: left; font-family: var(--font);
  }
  .nl-item:hover { background: var(--ac-bg); color: var(--ac); }
  .nl-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nl-empty { padding: 10px 14px; }
</style>
