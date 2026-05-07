<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { marked } from 'marked';
  import { generateSlides, askEnzoInline } from '../lib/groq';
  import RichEditor from './RichEditor.svelte';
  import type { Presentation, Slide, PresTheme } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── State ─────────────────────────────────────────────────────
  let selectedId      = $state<string | null>(null);
  let presentMode     = $state(false);
  let presentIdx      = $state(0);
  let notesVisible    = $state(false);
  let genOpen         = $state(false);
  let genTopic        = $state('');
  let genCount        = $state(10);
  let genFrom         = $state<'prompt' | 'note' | 'paper'>('prompt');
  let genNoteId       = $state('');
  let genPaperId      = $state('');
  let generating      = $state(false);
  let saving          = $state(false);
  let saveTimer: ReturnType<typeof setTimeout>;
  let dragIdx         = $state<number | null>(null);
  let dragOver        = $state<number | null>(null);
  let renamingId      = $state<string | null>(null);
  let renameDraft     = $state('');
  let showTemplates   = $state(false);
  let activeSlideIdx  = $state(0);
  let enzoLoadingIdx  = $state<number | null>(null);

  // ── Presenter timer ───────────────────────────────────────────
  let presentTimer    = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (presentMode) {
      presentTimer = 0;
      timerInterval = setInterval(() => { presentTimer++; }, 1000);
    } else {
      if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
    return () => {
      if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };
  });

  function fmtTimer(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // ── Transition ────────────────────────────────────────────────
  let slideTransition = $state('slide');

  const pres = $derived(store.presentations.find(p => p.id === selectedId) ?? null);

  const THEMES: Record<PresTheme, { bg: string; fg: string; accent: string; muted: string; label: string }> = {
    white:   { bg: '#ffffff', fg: '#1a1a1a', accent: '#2563eb', muted: '#6b7280', label: 'White' },
    dark:    { bg: '#0f172a', fg: '#e2e8f0', accent: '#60a5fa', muted: '#94a3b8', label: 'Dark' },
    moon:    { bg: '#002b36', fg: '#93a1a1', accent: '#268bd2', muted: '#657b83', label: 'Moon' },
    serif:   { bg: '#faf7f0', fg: '#2c1810', accent: '#9b4208', muted: '#a0785a', label: 'Serif' },
    minimal: { bg: '#fefefe', fg: '#111111', accent: '#111111', muted: '#555555', label: 'Minimal' },
  };

  // ── Slide layout templates ────────────────────────────────────
  const SLIDE_TEMPLATES = [
    {
      name: 'Title slide',
      html: '<h1 style="font-size:2em;font-weight:700">Presentation Title</h1><p style="font-size:1.1em;opacity:0.7">Author · Institution · Date</p>',
    },
    {
      name: 'Section header',
      html: '<h2 style="font-size:1.8em;border-bottom:3px solid currentColor;padding-bottom:0.3em">Section Title</h2>',
    },
    {
      name: 'Content + bullets',
      html: '<h2>Key Points</h2><ul><li>Finding one — with supporting data</li><li>Finding two — mechanism or implication</li><li>Finding three — clinical relevance</li></ul>',
    },
    {
      name: 'Hypothesis',
      html: '<h2>Hypothesis</h2><blockquote style="border-left:4px solid currentColor;padding-left:1em;font-style:italic">H₁: [State your hypothesis here]</blockquote><p style="font-size:0.85em"><strong>Rationale:</strong> Based on [evidence]…</p>',
    },
    {
      name: 'Results',
      html: '<h2>Results</h2><p style="font-size:0.85em"><strong>Key finding:</strong> [Describe main result]</p><div style="border:2px dashed rgba(128,128,128,0.4);border-radius:8px;padding:2em;text-align:center;margin-top:1em;font-size:0.8em;opacity:0.6">[ Figure / Table placeholder ]</div>',
    },
    {
      name: 'Methods',
      html: '<h2>Methods</h2><ol style="font-size:0.85em"><li>Sample preparation: [describe]</li><li>Assay / analysis: [describe]</li><li>Statistical analysis: [test + software]</li></ol>',
    },
    {
      name: 'Two-column',
      html: '<h2>Comparison</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5em;font-size:0.85em"><div><h3 style="font-size:1em">Condition A</h3><ul><li>Point</li></ul></div><div><h3 style="font-size:1em">Condition B</h3><ul><li>Point</li></ul></div></div>',
    },
    {
      name: 'Quote / Key stat',
      html: '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center"><p style="font-size:2.5em;font-weight:700;line-height:1.2">72%</p><p style="font-size:1em;opacity:0.8">of patients showed [outcome] after [treatment]</p><p style="font-size:0.75em;opacity:0.5;margin-top:0.5em">Source: [Citation]</p></div>',
    },
    {
      name: 'Conclusions',
      html: '<h2>Conclusions</h2><ul><li>✓ [Main conclusion]</li><li>✓ [Supporting finding]</li><li>→ [Implication / next step]</li></ul>',
    },
    {
      name: 'Acknowledgements',
      html: '<h2>Acknowledgements</h2><p style="font-size:0.85em"><strong>Funding:</strong> [Grant agency, grant number]</p><p style="font-size:0.85em"><strong>Collaborators:</strong> [Names]</p><p style="font-size:0.85em"><strong>Lab members:</strong> [Names]</p>',
    },
  ];

  function insertTemplate(html: string) {
    if (!pres) return;
    // If current active slide is empty (default content), replace it
    const current = pres.slides[activeSlideIdx];
    const isEmptySlide = !current || current.content === '<h2>New Slide</h2>' || current.content === '<h2>New Slide</h2><ul><li>Point one</li><li>Point two</li></ul>' || current.content.trim() === '';
    if (isEmptySlide && current) {
      mutate(p => { p.slides[activeSlideIdx].content = html; });
    } else {
      mutate(p => {
        const s: Slide = { id: nanoid(), content: html, notes: '' };
        p.slides.splice(activeSlideIdx + 1, 0, s);
        activeSlideIdx = activeSlideIdx + 1;
      });
    }
    showTemplates = false;
    // Scroll to the slide
    setTimeout(() => {
      const el = document.getElementById(`slide-${pres!.slides[activeSlideIdx]?.id ?? ''}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  // ── CRUD ──────────────────────────────────────────────────────
  function newPresentation() {
    const p: Presentation = {
      id: nanoid(), title: 'Untitled presentation',
      slides: [{ id: nanoid(), content: '<h2>Title</h2><p>Your name · ' + new Date().getFullYear() + '</p>', notes: '' }],
      theme: 'white', createdAt: Date.now(), updatedAt: Date.now(),
    };
    store.presentations = [p, ...store.presentations];
    selectedId = p.id;
    renamingId = p.id; renameDraft = p.title;
    scheduleSave();
  }

  async function deletePresentation(id: string) {
    if (!confirm('Delete this presentation?')) return;
    store.presentations = store.presentations.filter(p => p.id !== id);
    if (selectedId === id) selectedId = null;
    await store.savePresentations();
    showToast('Presentation deleted');
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saving = true;
      try { await store.savePresentations(); } finally { saving = false; }
    }, 1400);
  }

  function mutate(fn: (p: Presentation) => void) {
    if (!pres) return;
    fn(pres); pres.updatedAt = Date.now();
    store.presentations = [...store.presentations];
    scheduleSave();
  }

  function commitRename() {
    if (!renamingId) return;
    const p = store.presentations.find(x => x.id === renamingId);
    if (p && renameDraft.trim()) { p.title = renameDraft.trim(); store.presentations = [...store.presentations]; scheduleSave(); }
    renamingId = null;
  }

  function setTheme(t: PresTheme) { mutate(p => p.theme = t); }

  // ── Slides ────────────────────────────────────────────────────
  function addSlide(afterIdx: number) {
    mutate(p => {
      const s: Slide = { id: nanoid(), content: '<h2>New Slide</h2><ul><li>Point one</li><li>Point two</li></ul>', notes: '' };
      p.slides.splice(afterIdx + 1, 0, s);
    });
  }

  function deleteSlide(idx: number) {
    mutate(p => { if (p.slides.length > 1) p.slides.splice(idx, 1); });
  }

  function duplicateSlide(i: number, slide: Slide) {
    mutate(p => p.slides.splice(i + 1, 0, { id: nanoid(), content: slide.content, notes: slide.notes }));
  }

  function updateContent(idx: number, html: string) { mutate(p => p.slides[idx].content = html); }
  function updateNotes(idx: number, val: string)    { mutate(p => p.slides[idx].notes = val); }

  // ── Drag-to-reorder ───────────────────────────────────────────
  function onDragStart(idx: number) { dragIdx = idx; }
  function onDragOver(e: DragEvent, idx: number) { e.preventDefault(); dragOver = idx; }
  function onDrop(toIdx: number) {
    if (dragIdx === null || dragIdx === toIdx) { dragIdx = null; dragOver = null; return; }
    mutate(p => {
      const [removed] = p.slides.splice(dragIdx!, 1);
      p.slides.splice(toIdx, 0, removed);
    });
    dragIdx = null; dragOver = null;
  }

  // ── Thumbnail strip drag-to-reorder ──────────────────────────
  let thumbDragIdx  = $state<number | null>(null);
  let thumbDragOver = $state<number | null>(null);

  function onThumbDragStart(idx: number) { thumbDragIdx = idx; }
  function onThumbDragOver(e: DragEvent, idx: number) { e.preventDefault(); thumbDragOver = idx; }
  function onThumbDrop(toIdx: number) {
    if (thumbDragIdx === null || thumbDragIdx === toIdx) { thumbDragIdx = null; thumbDragOver = null; return; }
    mutate(p => {
      const [removed] = p.slides.splice(thumbDragIdx!, 1);
      p.slides.splice(toIdx, 0, removed);
    });
    if (activeSlideIdx === thumbDragIdx) activeSlideIdx = toIdx;
    thumbDragIdx = null; thumbDragOver = null;
  }

  function selectSlideFromThumb(i: number) {
    activeSlideIdx = i;
    const slideId = pres?.slides[i]?.id;
    if (slideId) {
      const el = document.getElementById(`slide-${slideId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ── Present mode ──────────────────────────────────────────────
  function startPresent() {
    if (!pres || pres.slides.length === 0) return;
    presentIdx = 0; presentMode = true; notesVisible = false;
  }

  function exitPresent() { presentMode = false; }

  function onPresentKey(e: KeyboardEvent) {
    if (!presentMode || !pres) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      if (presentIdx < pres.slides.length - 1) presentIdx++;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (presentIdx > 0) presentIdx--;
    } else if (e.key === 'Escape') {
      exitPresent();
    } else if (e.key === 's' || e.key === 'S') {
      notesVisible = !notesVisible;
    }
  }

  // ── Enzo inline slide improvement ────────────────────────────
  async function improveSlide(idx: number, slide: Slide) {
    enzoLoadingIdx = idx;
    try {
      const result = await askEnzoInline(
        'Rewrite this slide content to be clearer, more concise, and scientifically precise. Keep the same structure and topic. Return only the improved HTML, no explanations.',
        slide.content
      );
      // Strip markdown code fences if Enzo wraps in them
      const cleaned = result.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/, '').trim();
      mutate(p => { p.slides[idx].content = cleaned; });
      showToast('Slide improved by Enzo');
    } catch (e) {
      showToast('Enzo improvement failed: ' + (e as Error).message, 'error');
    } finally {
      enzoLoadingIdx = null;
    }
  }

  // ── AI generation ─────────────────────────────────────────────
  async function runGenerate() {
    if (!pres) return;
    generating = true;
    try {
      let context = '';
      if (genFrom === 'note' && genNoteId) {
        const n = store.notes.find(n => n.id === genNoteId);
        if (n) context = n.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      } else if (genFrom === 'paper' && genPaperId) {
        const p = store.readingList.find(r => r.id === genPaperId);
        if (p) context = `Title: ${p.paper.title}\nAuthors: ${p.paper.authors.join(', ')}\nAbstract: ${p.paper.abstract}`;
      }
      const topic = genFrom === 'prompt' ? genTopic : (genFrom === 'note' ? (store.notes.find(n => n.id === genNoteId)?.title ?? genTopic) : (store.readingList.find(r => r.id === genPaperId)?.paper.title ?? genTopic));
      const raw = await generateSlides(topic, genCount, context);
      mutate(p => {
        p.slides = raw.map(s => ({
          id: nanoid(),
          content: `<h2>${s.title}</h2>${s.content}`,
          notes: s.notes,
        }));
      });
      genOpen = false;
      showToast(`${raw.length} slides generated`);
    } catch (e) {
      showToast('Generation failed: ' + (e as Error).message, 'error');
    } finally {
      generating = false;
    }
  }

  // ── Export HTML (reveal.js via CDN) ──────────────────────────
  function exportHtml() {
    if (!pres) return;
    const theme = pres.theme === 'dark' ? 'black' : pres.theme === 'moon' ? 'moon' : pres.theme === 'serif' ? 'serif' : 'white';
    const slidesHtml = pres.slides.map(s =>
      `<section>${s.content}${s.notes ? `<aside class="notes">${s.notes}</aside>` : ''}</section>`
    ).join('\n      ');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pres.title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/${theme}.css">
<style>
  .reveal h2 { font-size: 1.6em; }
  .reveal ul { font-size: 0.9em; text-align: left; }
  .reveal li { margin-bottom: 0.4em; }
  .reveal p { font-size: 0.85em; }
</style>
</head>
<body>
<div class="reveal">
  <div class="slides">
    ${slidesHtml}
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"><\/script>
<script>Reveal.initialize({ hash: true, transition: '${slideTransition}', slideNumber: 'c/t' });<\/script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${pres.title.replace(/\s+/g, '-')}.html` });
    a.click(); URL.revokeObjectURL(url);
  }

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // ── Example presentations (display-only) ──────────────────────
  const EXAMPLE_PRES = [
    { title: 'HGSOC TME — Macrophage Crosstalk', slides: 8, date: 'example' },
    { title: 'PARP Inhibitor Resistance — Lab Meeting', slides: 12, date: 'example' },
  ];
</script>

<!-- ── Present mode overlay ─────────────────────────────────── -->
{#if presentMode && pres}
  {@const th = THEMES[pres.theme]}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="present-overlay"
    style="background:{th.bg};color:{th.fg}"
    onkeydown={onPresentKey}
    tabindex="-1"
    role="presentation"
  >
    <div class="present-slide-wrap">
      <div class="present-content" style="--pac:{th.accent};--pmuted:{th.muted}">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html pres.slides[presentIdx]?.content ?? ''}
      </div>
    </div>

    {#if notesVisible && pres.slides[presentIdx]?.notes}
      <div class="present-notes-bar" style="background:{th.bg};border-color:{th.muted}">
        <span class="present-notes-label" style="color:{th.muted}">Notes</span>
        {pres.slides[presentIdx].notes}
      </div>
    {/if}

    <!-- Next slide preview -->
    {#if pres.slides[presentIdx + 1]}
      <div class="present-next-preview" style="border-color:{th.muted}44;background:{th.bg}cc">
        <span class="present-next-label" style="color:{th.muted}">Next →</span>
        <div class="present-next-thumb-wrap">
          <div
            class="present-next-thumb-inner"
            style="--pac:{th.accent};--pmuted:{th.muted};color:{th.fg};background:{th.bg}"
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html pres.slides[presentIdx + 1].content}
          </div>
        </div>
      </div>
    {/if}

    <div class="present-footer" style="background:{th.bg}88;color:{th.muted}">
      <button class="present-nav-btn" style="color:{th.fg}" onclick={() => { if (presentIdx > 0) presentIdx--; }} disabled={presentIdx === 0}>←</button>
      <span class="present-counter">{presentIdx + 1} / {pres.slides.length}</span>
      <button class="present-nav-btn" style="color:{th.fg}" onclick={() => { if (presentIdx < pres.slides.length - 1) presentIdx++; }} disabled={presentIdx === pres.slides.length - 1}>→</button>
      <span class="present-timer" style="color:{th.muted}">{fmtTimer(presentTimer)}</span>
      <span class="present-hint">S — notes &nbsp;·&nbsp; Esc — exit</span>
      <button class="present-exit" style="color:{th.muted}" onclick={exitPresent}>✕ Exit</button>
    </div>

    <div class="present-progress-bar" style="background:{th.accent}44">
      <div class="present-progress-fill" style="background:{th.accent};width:{((presentIdx+1)/pres.slides.length)*100}%"></div>
    </div>
  </div>
{/if}

<!-- ── Generate modal ────────────────────────────────────────── -->
{#if genOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => genOpen = false}></div>
  <div class="gen-modal card">
    <h3>Generate slides with Enzo</h3>
    <div class="gen-tabs">
      {#each (['prompt', 'note', 'paper'] as const) as t}
        <button class="gen-tab" class:active={genFrom === t} onclick={() => genFrom = t}>
          {t === 'prompt' ? 'Topic / Prompt' : t === 'note' ? 'From Note' : 'From Paper'}
        </button>
      {/each}
    </div>

    {#if genFrom === 'prompt'}
      <textarea class="gen-textarea" bind:value={genTopic} placeholder="e.g. PARPi resistance mechanisms in HGSOC — 2024 updates" rows={4}></textarea>
    {:else if genFrom === 'note'}
      <select class="gen-select" bind:value={genNoteId}>
        <option value="">Select a note…</option>
        {#each store.notes.filter(n => !n.archived) as n}
          <option value={n.id}>{n.title}</option>
        {/each}
      </select>
    {:else}
      <select class="gen-select" bind:value={genPaperId}>
        <option value="">Select a paper…</option>
        {#each store.readingList as r}
          <option value={r.id}>{r.paper.title.slice(0, 70)}…</option>
        {/each}
      </select>
    {/if}

    <div class="gen-count-row">
      <label class="text-sm">Slides:</label>
      {#each [5, 8, 10, 12, 15] as n}
        <button class="count-chip" class:active={genCount === n} onclick={() => genCount = n}>{n}</button>
      {/each}
      <input type="number" class="count-input" bind:value={genCount} min={3} max={30} />
    </div>

    <div class="gen-actions">
      <button class="btn btn-ghost" onclick={() => genOpen = false}>Cancel</button>
      <button
        class="btn btn-primary"
        onclick={runGenerate}
        disabled={generating || (genFrom === 'prompt' && !genTopic.trim()) || (genFrom === 'note' && !genNoteId) || (genFrom === 'paper' && !genPaperId)}
      >
        {#if generating}Generating…{:else}Generate<span class="model-pill">[70B]</span>{/if}
      </button>
    </div>
    {#if generating}
      <p class="text-xs text-mu" style="text-align:center;margin-top:6px">Enzo is writing your slides…</p>
    {/if}
  </div>
{/if}

<!-- ── Templates popover backdrop ────────────────────────────── -->
{#if showTemplates}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop templates-backdrop" onclick={() => showTemplates = false}></div>
{/if}

<!-- ── Main layout ────────────────────────────────────────────── -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pres-shell" onkeydown={onPresentKey} tabindex="-1">

  <!-- Left panel -->
  <aside class="pres-list-panel">
    <div class="pres-list-header">
      <span class="section-label">Presentations</span>
      <button class="btn-icon" onclick={newPresentation} title="New presentation">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <div class="pres-list">
      {#each store.presentations as p (p.id)}
        <div class="pres-item" class:active={selectedId === p.id} onclick={() => selectedId = p.id}>
          <div class="pres-item-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <div class="pres-item-body">
            {#if renamingId === p.id}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                class="pres-rename-input"
                bind:value={renameDraft}
                autofocus
                onblur={commitRename}
                onkeydown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') renamingId = null; }}
                onclick={(e) => e.stopPropagation()}
              />
            {:else}
              <span class="pres-item-title">{p.title}</span>
            {/if}
            <span class="pres-item-meta">{p.slides.length} slide{p.slides.length !== 1 ? 's' : ''} · {fmtDate(p.updatedAt)}</span>
          </div>
          <div class="pres-item-actions">
            <button class="btn-icon pres-action-btn" title="Rename" onclick={(e) => { e.stopPropagation(); renamingId = p.id; renameDraft = p.title; }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon pres-action-btn danger" title="Delete" onclick={(e) => { e.stopPropagation(); deletePresentation(p.id); }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
            </button>
          </div>
        </div>
      {:else}
        <!-- Example presentations when list is empty -->
        <div class="pres-list-empty">
          <p class="text-mu text-xs">No presentations yet.</p>
          <button class="btn btn-ghost btn-sm" onclick={newPresentation}>Create one</button>
        </div>
        {#each EXAMPLE_PRES as ex}
          <div class="pres-item pres-item-example">
            <div class="pres-item-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </div>
            <div class="pres-item-body">
              <span class="pres-item-title">{ex.title}</span>
              <span class="pres-item-meta">{ex.slides} slides · <em>example</em></span>
            </div>
          </div>
        {/each}
      {/each}
    </div>
  </aside>

  <!-- Thumbnail strip -->
  {#if pres}
    <aside class="pres-thumb-strip">
      {#each pres.slides as slide, i (slide.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="thumb-item"
          class:active={activeSlideIdx === i}
          class:thumb-drag-over={thumbDragOver === i}
          draggable="true"
          ondragstart={() => onThumbDragStart(i)}
          ondragover={(e) => onThumbDragOver(e, i)}
          ondrop={() => onThumbDrop(i)}
          ondragend={() => { thumbDragIdx = null; thumbDragOver = null; }}
          onclick={() => selectSlideFromThumb(i)}
          title="Slide {i + 1}"
        >
          <div class="thumb-drag-handle" title="Drag to reorder">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="8" r="1.5"/><circle cx="9" cy="14" r="1.5"/><circle cx="15" cy="8" r="1.5"/><circle cx="15" cy="14" r="1.5"/></svg>
          </div>
          <div class="thumb-preview-wrap">
            <div class="thumb-preview-inner">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html slide.content}
            </div>
          </div>
          <span class="thumb-num">{i + 1}</span>
        </div>
      {/each}
    </aside>
  {/if}

  <!-- Main editor -->
  <div class="pres-main">
    {#if !pres}
      <div class="pres-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.25">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
        <p class="text-mu text-sm">Select or create a presentation</p>
        <button class="btn btn-primary btn-sm" onclick={newPresentation}>+ New presentation</button>
      </div>
    {:else}
      <!-- Toolbar -->
      <div class="pres-toolbar">
        <div class="pres-toolbar-left">
          {#if renamingId === pres.id}
            <input
              class="pres-title-input"
              bind:value={renameDraft}
              onblur={commitRename}
              onkeydown={(e) => { if (e.key === 'Enter') commitRename(); }}
            />
          {:else}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <h2 class="pres-title" onclick={() => { renamingId = pres!.id; renameDraft = pres!.title; }}>{pres.title}</h2>
          {/if}
        </div>
        <div class="pres-toolbar-right">
          {#if saving}<span class="save-ind text-xs text-mu">Saving…</span>{/if}
          <select class="theme-select" value={pres.theme} onchange={(e) => setTheme((e.target as HTMLSelectElement).value as PresTheme)}>
            {#each Object.entries(THEMES) as [key, val]}
              <option value={key}>{val.label}</option>
            {/each}
          </select>
          <!-- Transition select -->
          <select class="transition-select" bind:value={slideTransition} title="Slide transition">
            <option value="none">No transition</option>
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
            <option value="convex">Convex</option>
            <option value="concave">Concave</option>
            <option value="zoom">Zoom</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick={() => genOpen = true}>
            <span class="enzo-e">E</span> Generate<span class="model-pill">[70B]</span>
          </button>
          <!-- Templates button -->
          <div class="templates-wrap">
            <button class="btn btn-ghost btn-sm" onclick={() => showTemplates = !showTemplates}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Templates
            </button>
            {#if showTemplates}
              <div class="templates-dropdown card">
                <p class="templates-hint text-xs text-mu">Insert layout at current slide position</p>
                {#each SLIDE_TEMPLATES as tpl}
                  <button class="template-item" onclick={() => insertTemplate(tpl.html)}>
                    {tpl.name}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <button class="btn btn-ghost btn-sm" onclick={exportHtml} title="Export as reveal.js HTML">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export HTML
          </button>
          <button class="btn btn-primary btn-sm" onclick={startPresent}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Present
          </button>
        </div>
      </div>

      <!-- Slide editor -->
      <div class="slides-editor">
        {#each pres.slides as slide, i (slide.id)}
          <!-- Add slide above (first slot) -->
          {#if i === 0}
            <div class="add-slide-zone">
              <button class="add-slide-btn" onclick={() => { mutate(p => p.slides.unshift({ id: nanoid(), content: '<h2>New Slide</h2>', notes: '' })); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          {/if}

          <!-- Slide card -->
          <div
            id="slide-{slide.id}"
            class="slide-card"
            class:drag-over={dragOver === i}
            draggable="true"
            ondragstart={() => onDragStart(i)}
            ondragover={(e) => onDragOver(e, i)}
            ondrop={() => onDrop(i)}
            ondragend={() => { dragIdx = null; dragOver = null; }}
            onclick={() => activeSlideIdx = i}
          >
            <div class="slide-card-header">
              <div class="slide-drag-handle" title="Drag to reorder">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="7" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="17" r="1.5"/></svg>
              </div>
              <!-- Duplicate button -->
              <button
                class="btn-icon slide-dup"
                onclick={(e) => { e.stopPropagation(); duplicateSlide(i, slide); }}
                title="Duplicate slide"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
              <span class="slide-num">Slide {i + 1}</span>
              <!-- Enzo improve button -->
              <button
                class="btn-icon slide-enzo-btn"
                onclick={(e) => { e.stopPropagation(); improveSlide(i, slide); }}
                disabled={enzoLoadingIdx !== null}
                title="Improve this slide with Enzo"
              >
                {#if enzoLoadingIdx === i}
                  <span class="enzo-spinner"></span>
                {:else}
                  <span class="enzo-e-purple">E</span>
                {/if}
              </button>
              <button class="btn-icon slide-del" onclick={(e) => { e.stopPropagation(); deleteSlide(i); }} disabled={pres.slides.length <= 1} title="Delete slide">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div class="slide-content-wrap">
              <RichEditor
                value={slide.content}
                onchange={(html) => updateContent(i, html)}
                placeholder="Slide content…"
                minHeight="160px"
                class="slide-rich-editor"
              />
            </div>

            <div class="slide-notes-row">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="notes-icon"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              <input
                class="slide-notes-input"
                type="text"
                value={slide.notes}
                oninput={(e) => updateNotes(i, (e.target as HTMLInputElement).value)}
                placeholder="Speaker notes (press S during presentation)…"
              />
            </div>
          </div>

          <!-- Add slide between -->
          <div class="add-slide-zone">
            <button class="add-slide-btn" onclick={() => addSlide(i)} title="Add slide after">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .pres-shell {
    display: flex;
    height: 100%;
    overflow: hidden;
    outline: none;
  }

  /* ── Left panel ── */
  .pres-list-panel {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    background: var(--sf);
    overflow: hidden;
  }
  .pres-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 10px 8px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }
  .section-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mu); }
  .pres-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; padding: 6px; }
  .pres-list-empty { padding: 16px 8px 8px; text-align: center; display: flex; flex-direction: column; gap: 8px; align-items: center; }

  .pres-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition);
    position: relative;
  }
  .pres-item:hover { background: var(--sf2); }
  .pres-item.active { background: var(--ac-bg); }
  .pres-item-icon { color: var(--mu); flex-shrink: 0; margin-top: 2px; }
  .pres-item.active .pres-item-icon { color: var(--ac); }
  .pres-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .pres-item-title { font-size: 0.8rem; font-weight: 500; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pres-item.active .pres-item-title { color: var(--ac); }
  .pres-item-meta { font-size: 0.68rem; color: var(--mu); }
  .pres-item-actions { display: flex; gap: 1px; opacity: 0; transition: opacity var(--transition); flex-shrink: 0; }
  .pres-item:hover .pres-item-actions { opacity: 1; }
  .pres-action-btn { width: 22px; height: 22px; border-radius: 4px; }
  .pres-action-btn.danger:hover { color: var(--rd); background: var(--rd-bg); }
  .pres-rename-input { font-size: 0.8rem; font-weight: 500; border: 1px solid var(--ac); border-radius: 3px; padding: 1px 4px; width: 100%; background: var(--bg); color: var(--tx); }

  /* Example pres items */
  .pres-item-example {
    opacity: 0.6;
    cursor: default;
    pointer-events: none;
  }

  /* ── Thumbnail strip ── */
  .pres-thumb-strip {
    width: 130px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    background: var(--sf);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 6px;
  }

  .thumb-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: 4px;
    transition: background var(--transition);
    border: 2px solid transparent;
    position: relative;
  }
  .thumb-item:hover { background: var(--sf2); }
  .thumb-item.active { border-color: var(--ac); background: var(--ac-bg); }
  .thumb-item.thumb-drag-over { border-color: var(--ac); border-style: dashed; }

  .thumb-drag-handle {
    position: absolute;
    top: 3px;
    left: 3px;
    color: var(--mu);
    opacity: 0;
    cursor: grab;
    transition: opacity var(--transition);
  }
  .thumb-item:hover .thumb-drag-handle { opacity: 1; }
  .thumb-drag-handle:active { cursor: grabbing; }

  .thumb-preview-wrap {
    width: 110px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 3px;
    border: 1px solid var(--bd);
    background: #fff;
    position: relative;
  }

  .thumb-preview-inner {
    width: 611px; /* 110 / 0.18 = ~611px */
    height: 344px; /* 611 * 9/16 */
    transform: scale(0.18);
    transform-origin: top left;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.4;
    overflow: hidden;
    color: #1a1a1a;
    background: #fff;
    pointer-events: none;
  }

  .thumb-num {
    font-size: 0.65rem;
    color: var(--mu);
    font-weight: 600;
  }

  /* ── Main ── */
  .pres-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .pres-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; }

  .pres-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
    gap: 12px;
  }
  .pres-toolbar-left { flex: 1; min-width: 0; }
  .pres-toolbar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
  .pres-title { font-size: 1rem; font-weight: 700; margin: 0; cursor: text; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pres-title:hover { color: var(--ac); }
  .pres-title-input { font-size: 1rem; font-weight: 700; border: none; border-bottom: 2px solid var(--ac); background: transparent; color: var(--tx); width: 100%; padding: 0; }
  .pres-title-input:focus { outline: none; }
  .save-ind { margin-right: 4px; }
  .theme-select { font-size: 0.78rem; border-radius: var(--radius-sm); padding: 4px 8px; width: auto; flex-shrink: 0; }
  .transition-select { font-size: 0.78rem; border-radius: var(--radius-sm); padding: 4px 8px; width: auto; flex-shrink: 0; }
  .enzo-e { font-family: var(--mono); font-weight: 700; font-size: 0.78rem; color: var(--enzo); }

  /* ── Templates popover ── */
  .templates-wrap { position: relative; }
  .templates-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 500;
    width: 220px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 360px;
    overflow-y: auto;
    box-shadow: var(--shadow);
  }
  .templates-hint {
    padding: 2px 6px 6px;
    border-bottom: 1px solid var(--bd);
    margin-bottom: 4px;
  }
  .template-item {
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--tx);
    cursor: pointer;
    transition: background var(--transition);
  }
  .template-item:hover { background: var(--ac-bg); color: var(--ac); }
  .templates-backdrop { background: transparent; }

  /* ── Slide editor ── */
  .slides-editor { flex: 1; overflow-y: auto; padding: 20px 32px; display: flex; flex-direction: column; align-items: center; background: var(--sf2); }

  .slide-card {
    width: 100%;
    max-width: 800px;
    background: var(--bg);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: box-shadow var(--transition), border-color var(--transition);
  }
  .slide-card:hover { box-shadow: var(--shadow); }
  .slide-card.drag-over { border-color: var(--ac); box-shadow: 0 0 0 2px var(--ac-bg); }

  .slide-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
  }
  .slide-drag-handle { cursor: grab; color: var(--mu); padding: 2px; }
  .slide-drag-handle:active { cursor: grabbing; }
  .slide-num { font-size: 0.72rem; font-weight: 600; color: var(--mu); letter-spacing: 0.05em; flex: 1; }
  .slide-del { opacity: 0.4; }
  .slide-del:hover:not(:disabled) { opacity: 1; color: var(--rd); background: var(--rd-bg); }
  .slide-del:disabled { opacity: 0.2; cursor: not-allowed; }

  /* Duplicate button */
  .slide-dup { opacity: 0.45; transition: opacity var(--transition); }
  .slide-dup:hover { opacity: 1; color: var(--ac); background: var(--ac-bg); }

  /* Enzo inline button */
  .slide-enzo-btn {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: opacity var(--transition), background var(--transition);
  }
  .slide-enzo-btn:hover:not(:disabled) { opacity: 1; background: #ede9fe; }
  .slide-enzo-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .enzo-e-purple {
    font-family: var(--mono);
    font-weight: 700;
    font-size: 0.78rem;
    color: #7c3aed;
  }
  .enzo-spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid #7c3aed44;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .slide-content-wrap { border-bottom: 1px solid var(--bd); }
  :global(.slide-rich-editor) { border: none !important; border-radius: 0 !important; }
  :global(.slide-rich-editor .re-toolbar) { background: var(--sf) !important; }
  :global(.slide-rich-editor .re-content) { padding: 14px 18px !important; min-height: 160px; }

  .slide-notes-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: var(--sf);
  }
  .notes-icon { color: var(--mu); flex-shrink: 0; }
  .slide-notes-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.78rem;
    color: var(--tx2);
    font-family: var(--font);
  }
  .slide-notes-input:focus { outline: none; }
  .slide-notes-input::placeholder { color: var(--mu); }

  /* Add slide zone */
  .add-slide-zone { display: flex; justify-content: center; padding: 4px 0; width: 100%; max-width: 800px; }
  .add-slide-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--sf);
    border: 1px dashed var(--bd2);
    color: var(--mu);
    cursor: pointer;
    transition: all var(--transition);
    opacity: 0.5;
  }
  .add-slide-btn:hover { opacity: 1; border-color: var(--ac); color: var(--ac); background: var(--ac-bg); }

  /* ── Present overlay ── */
  .present-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .present-slide-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 80px;
    overflow: hidden;
  }
  .present-content {
    max-width: 900px;
    width: 100%;
    font-size: clamp(1rem, 2.5vw, 1.6rem);
    line-height: 1.5;
  }
  :global(.present-content h1) { font-size: 2.2em; font-weight: 800; margin-bottom: 0.5em; color: var(--pac, inherit); }
  :global(.present-content h2) { font-size: 1.7em; font-weight: 700; margin-bottom: 0.5em; color: var(--pac, inherit); }
  :global(.present-content h3) { font-size: 1.3em; font-weight: 600; margin-bottom: 0.4em; }
  :global(.present-content ul, .present-content ol) { padding-left: 1.4em; }
  :global(.present-content li) { margin-bottom: 0.4em; }
  :global(.present-content p) { margin-bottom: 0.6em; opacity: 0.9; }

  .present-notes-bar {
    padding: 10px 40px;
    font-size: 0.85rem;
    border-top: 1px solid;
    opacity: 0.85;
    line-height: 1.5;
  }
  .present-notes-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-right: 10px; opacity: 0.6; }

  /* Next slide preview */
  .present-next-preview {
    position: absolute;
    bottom: 60px;
    right: 20px;
    width: 200px;
    border: 1px solid;
    border-radius: var(--radius-sm, 6px);
    overflow: hidden;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    backdrop-filter: blur(6px);
  }
  .present-next-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.7;
  }
  .present-next-thumb-wrap {
    width: 188px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 3px;
    background: #fff;
    position: relative;
  }
  .present-next-thumb-inner {
    width: 1044px; /* 188 / 0.18 */
    height: 588px;
    transform: scale(0.18);
    transform-origin: top left;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.4;
    overflow: hidden;
    pointer-events: none;
  }

  .present-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 24px;
    font-size: 0.82rem;
    flex-shrink: 0;
  }
  .present-nav-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: opacity var(--transition); }
  .present-nav-btn:disabled { opacity: 0.25; cursor: default; }
  .present-counter { font-size: 0.8rem; font-weight: 600; min-width: 60px; text-align: center; }
  .present-timer { font-size: 0.78rem; font-weight: 600; font-variant-numeric: tabular-nums; min-width: 44px; text-align: center; opacity: 0.75; }
  .present-hint { font-size: 0.72rem; opacity: 0.55; flex: 1; }
  .present-exit { background: none; border: none; cursor: pointer; font-size: 0.8rem; padding: 4px 8px; border-radius: 4px; transition: opacity var(--transition); }
  .present-exit:hover { opacity: 0.7; }

  .present-progress-bar { height: 3px; width: 100%; flex-shrink: 0; }
  .present-progress-fill { height: 100%; transition: width 0.3s ease; }

  /* ── Generate modal ── */
  .modal-backdrop { position: fixed; inset: 0; z-index: 8999; background: rgba(0,0,0,0.4); }
  .gen-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9000;
    width: min(480px, 90vw);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .gen-modal h3 { margin: 0; font-size: 1rem; }
  .gen-tabs { display: flex; gap: 4px; }
  .gen-tab { padding: 5px 12px; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 500; background: transparent; border: 1px solid var(--bd); color: var(--mu); cursor: pointer; transition: all var(--transition); }
  .gen-tab.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .gen-textarea { font-size: 0.87rem; resize: vertical; }
  .gen-select { font-size: 0.87rem; }
  .gen-count-row { display: flex; align-items: center; gap: 6px; }
  .count-chip { padding: 3px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; border: 1px solid var(--bd); background: transparent; color: var(--tx2); cursor: pointer; transition: all var(--transition); }
  .count-chip.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .count-input { width: 56px; font-size: 0.82rem; padding: 3px 6px; text-align: center; }
  .gen-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
