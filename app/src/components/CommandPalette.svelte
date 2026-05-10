<script lang="ts">
  import { store } from '../lib/store.svelte';

  const { onClose }: { onClose: () => void } = $props();

  // ── State ───────────────────────────────────────────────────────
  let query = $state('');
  let selected = $state(0);
  let inputEl = $state<HTMLInputElement | undefined>(undefined);

  // Focus input when palette opens
  $effect(() => {
    if (inputEl) {
      const t = setTimeout(() => inputEl?.focus(), 20);
      return () => clearTimeout(t);
    }
  });

  // ── Icons ───────────────────────────────────────────────────────
  const ICONS = {
    note:       'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    task:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    paper:      'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    run:        'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v10a2 2 0 002 2h10a2 2 0 002-2V5M9 13H5a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2v-4a2 2 0 00-2-2z',
    protocol:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    hypothesis: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    grant:      'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    manuscript: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
    conference: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    nav:        'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  };

  // ── Quick nav actions (always shown when query is empty) ─────────
  const QUICK_NAV = [
    { label: 'Dashboard',  view: 'dashboard',  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Tasks',      view: 'tasks',      icon: ICONS.task },
    { label: 'Pipeline',   view: 'pipeline',   icon: ICONS.run },
    { label: 'Research',   view: 'research',   icon: ICONS.paper },
    { label: 'Grants',     view: 'grants',     icon: ICONS.grant },
    { label: 'Manuscript', view: 'manuscript', icon: ICONS.manuscript },
  ];

  // ── Strip markdown for body preview ─────────────────────────────
  function stripMd(s: string): string {
    return s.replace(/[#*`_\[\]>]/g, '').replace(/\s+/g, ' ').trim();
  }

  function trunc(s: string, n = 60): string {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  // ── Type → label mapping ─────────────────────────────────────────
  const TYPE_LABELS: Record<string, string> = {
    note: 'Notes', task: 'Tasks', paper: 'Papers',
    run: 'Runs', protocol: 'Protocols', hypothesis: 'Hypotheses',
    grant: 'Grants', manuscript: 'Manuscripts', conference: 'Conferences',
  };

  type ResultItem = {
    type: string;
    id: string;
    title: string;
    sub: string;
    view: string;
    noteId?: string;
  };

  // ── Derived search results ───────────────────────────────────────
  const results = $derived((() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as ResultItem[];

    const out: ResultItem[] = [];

    // Notes (non-archived)
    for (const n of store.notes) {
      if (n.archived) continue;
      if (n.title.toLowerCase().includes(q) || stripMd(n.body).toLowerCase().includes(q)) {
        const rel = Date.now() - n.updatedAt;
        const when = rel < 86400000 ? 'today' : rel < 172800000 ? 'yesterday' : new Date(n.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        out.push({ type: 'note', id: n.id, title: n.title || 'Untitled note', sub: trunc(stripMd(n.body) || when), view: 'notes', noteId: n.id });
        if (out.length >= 12) break;
      }
    }

    // Demo result when store has no notes and query matches 'nichenet' or 'macrophage'
    if (store.notes.length === 0 && (q.includes('nichenet') || q.includes('macrophage'))) {
      out.push({ type: 'note', id: '__demo__', title: 'NicheNet analysis — macrophage TME interactions', sub: 'HGSOC · updated today', view: 'notes' });
    }

    // Tasks (open only)
    for (const t of store.tasks) {
      if (t.done) continue;
      if (t.text.toLowerCase().includes(q)) {
        out.push({ type: 'task', id: t.id, title: t.text, sub: t.priority !== 'medium' ? t.priority + ' priority' : '', view: 'tasks' });
        if (out.length >= 12) break;
      }
    }

    // Reading list papers
    for (const item of store.readingList) {
      const p = item.paper;
      if (p.title.toLowerCase().includes(q) || p.authors.join(' ').toLowerCase().includes(q)) {
        out.push({ type: 'paper', id: item.id, title: p.title, sub: trunc((p.authors[0] || '') + (p.journal ? ' · ' + p.journal : '')), view: 'research' });
        if (out.length >= 12) break;
      }
    }

    // Pipeline runs
    for (const r of store.pipelineRuns) {
      if (r.title.toLowerCase().includes(q) || r.sampleId.toLowerCase().includes(q)) {
        out.push({ type: 'run', id: r.id, title: r.title, sub: trunc(r.sampleId + (r.status ? ' · ' + r.status : '')), view: 'pipeline' });
        if (out.length >= 12) break;
      }
    }

    // Protocols
    for (const pr of store.protocols) {
      if (pr.title.toLowerCase().includes(q)) {
        out.push({ type: 'protocol', id: pr.id, title: pr.title, sub: '', view: 'pipeline' });
        if (out.length >= 12) break;
      }
    }

    // Hypotheses
    for (const h of store.hypotheses) {
      if (h.text.toLowerCase().includes(q)) {
        out.push({ type: 'hypothesis', id: h.id, title: trunc(h.text, 70), sub: trunc(h.rationale || ''), view: 'pipeline' });
        if (out.length >= 12) break;
      }
    }

    // Grants
    for (const g of store.grants) {
      if (g.title.toLowerCase().includes(q) || (g.agency || '').toLowerCase().includes(q)) {
        out.push({ type: 'grant', id: g.id, title: g.title, sub: trunc(g.agency || ''), view: 'grants' });
        if (out.length >= 12) break;
      }
    }

    // Manuscripts
    for (const m of store.manuscripts) {
      if (m.title.toLowerCase().includes(q) || (m.targetJournal || '').toLowerCase().includes(q)) {
        out.push({ type: 'manuscript', id: m.id, title: m.title, sub: trunc(m.targetJournal || ''), view: 'manuscript' });
        if (out.length >= 12) break;
      }
    }

    // Conferences
    for (const c of store.conferences) {
      if ((c.abstractTitle || '').toLowerCase().includes(q) || (c.conference || '').toLowerCase().includes(q)) {
        out.push({ type: 'conference', id: c.id, title: c.abstractTitle || c.conference || '', sub: trunc(c.conference || ''), view: 'research' });
        if (out.length >= 12) break;
      }
    }

    return out.slice(0, 12);
  })());

  // ── Recent notes (last 5 by updatedAt) ──────────────────────────
  const recentNotes = $derived(
    [...store.notes]
      .filter(n => !n.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
  );

  // ── Grouped results for display ──────────────────────────────────
  type Group = { label: string; items: ResultItem[] };
  const groups = $derived((() => {
    const map = new Map<string, ResultItem[]>();
    for (const r of results) {
      if (!map.has(r.type)) map.set(r.type, []);
      map.get(r.type)!.push(r);
    }
    const out: Group[] = [];
    for (const [type, items] of map) {
      out.push({ label: TYPE_LABELS[type] ?? type, items });
    }
    return out;
  })());

  // Flat list for keyboard navigation
  const flatItems = $derived(results);

  // When query is empty, we show quicknav + recent notes
  // Flat items for empty-query keyboard nav
  type QuickItem = { kind: 'nav'; label: string; view: string; icon: string } | { kind: 'recent'; note: typeof recentNotes[0] };
  const emptyItems = $derived((() => {
    const items: QuickItem[] = [];
    for (const n of QUICK_NAV) items.push({ kind: 'nav', ...n });
    for (const n of recentNotes) items.push({ kind: 'recent', note: n });
    return items;
  })());

  const totalItems = $derived(query.trim() ? flatItems.length : emptyItems.length);

  // Clamp selection when list shrinks; don't reset to 0 while user is navigating
  $effect(() => {
    const total = query.trim() ? flatItems.length : emptyItems.length;
    if (selected >= total) selected = Math.max(0, total - 1);
  });

  // ── Activate selected item ───────────────────────────────────────
  function activateIndex(i: number) {
    if (query.trim()) {
      const item = flatItems[i];
      if (!item) return;
      navigate(item);
    } else {
      const item = emptyItems[i];
      if (!item) return;
      if (item.kind === 'nav') {
        store.view = item.view as typeof store.view;
        onClose();
      } else {
        store.currentNoteId = item.note.id;
        store.view = 'notes';
        onClose();
      }
    }
  }

  function navigate(item: ResultItem) {
    if (item.id === '__demo__') { onClose(); return; }
    store.view = item.view as typeof store.view;
    if (item.noteId) store.currentNoteId = item.noteId;
    onClose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(selected + 1, totalItems - 1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); selected = Math.max(selected - 1, 0); return; }
    if (e.key === 'Enter')     { e.preventDefault(); activateIndex(selected); return; }
  }

  // ── Relative time ─────────────────────────────────────────────────
  function relTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 172800000) return 'yesterday';
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // Running index for keyboard highlight across groups
  let globalIdx = 0;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="cp-backdrop" onclick={onClose}></div>

<div
  class="cp-panel"
  role="dialog"
  tabindex="-1"
  aria-label="Command palette"
  aria-modal="true"
  onkeydown={onKeydown}
>
  <!-- Search input -->
  <div class="cp-input-row">
    <svg class="cp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input
      class="cp-input"
      bind:this={inputEl}
      bind:value={query}
      placeholder="Search notes, tasks, papers, runs, grants…"
      autocomplete="off"
      spellcheck="false"
      aria-label="Search"
      oninput={() => { selected = 0; }}
    />
    <kbd class="cp-esc" onclick={onClose}>Esc</kbd>
  </div>

  <!-- Results area -->
  <div class="cp-body">

    {#if !query.trim()}
      <!-- Empty query: quick nav + recent notes -->

      <div class="cp-section-label">Jump to</div>
      <div class="cp-nav-grid">
        {#each QUICK_NAV as nav, i}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="cp-nav-item"
            class:cp-selected={selected === i}
            onclick={() => { store.view = nav.view as typeof store.view; onClose(); }}
            onmouseenter={() => selected = i}
            role="button"
            tabindex="-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d={nav.icon}/>
            </svg>
            <span>{nav.label}</span>
          </div>
        {/each}
      </div>

      {#if recentNotes.length > 0}
        <div class="cp-section-label" style="margin-top:12px">Recent notes</div>
        {#each recentNotes as note, ri}
          {@const idx = QUICK_NAV.length + ri}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="cp-result"
            class:cp-selected={selected === idx}
            onclick={() => { store.currentNoteId = note.id; store.view = 'notes'; onClose(); }}
            onmouseenter={() => selected = idx}
            role="button"
            tabindex="-1"
          >
            <svg class="cp-result-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d={ICONS.note}/>
            </svg>
            <div class="cp-result-body">
              <span class="cp-result-title">{note.title || 'Untitled note'}</span>
              <span class="cp-result-sub">{trunc(stripMd(note.body) || relTime(note.updatedAt))}</span>
            </div>
            <span class="cp-result-time">{relTime(note.updatedAt)}</span>
            <svg class="cp-enter-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 01-4 4H4"/>
            </svg>
          </div>
        {/each}
      {:else}
        <p class="cp-empty-recent">No notes yet — start typing to search.</p>
      {/if}

      <div class="cp-footer">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>Esc</kbd> close</span>
      </div>

    {:else if results.length === 0}
      <!-- No results -->
      <div class="cp-no-results">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>No results for <em>"{query}"</em></span>
      </div>

    {:else}
      <!-- Grouped results -->
      <div class="cp-results" role="listbox">
        {#each groups as group}
          <div class="cp-group-label">{group.label}</div>
          {#each group.items as item}
            {@const idx = flatItems.indexOf(item)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="cp-result"
              class:cp-selected={selected === idx}
              onclick={() => navigate(item)}
              onmouseenter={() => selected = idx}
              role="option"
              aria-selected={selected === idx}
              tabindex="-1"
            >
              <svg class="cp-result-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d={ICONS[item.type as keyof typeof ICONS] ?? ICONS.note}/>
              </svg>
              <div class="cp-result-body">
                <span class="cp-result-title">{item.title}</span>
                {#if item.sub}
                  <span class="cp-result-sub">{item.sub}</span>
                {/if}
              </div>
              <svg class="cp-enter-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 01-4 4H4"/>
              </svg>
            </div>
          {/each}
        {/each}
      </div>

      <div class="cp-footer">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    {/if}

  </div>
</div>

<style>
  /* ── Backdrop ── */
  .cp-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    z-index: 300;
  }

  /* ── Panel ── */
  .cp-panel {
    position: fixed;
    top: 30%;
    left: 50%;
    transform: translate(-50%, -30%);
    width: min(600px, 94vw);
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    box-shadow: 0 24px 72px rgba(0, 0, 0, 0.32);
    z-index: 301;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: cp-in 0.15s ease;
  }

  @keyframes cp-in {
    from { opacity: 0; transform: translate(-50%, calc(-30% - 8px)); }
    to   { opacity: 1; transform: translate(-50%, -30%); }
  }

  /* ── Input row ── */
  .cp-input-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 15px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .cp-search-icon {
    color: var(--mu);
    flex-shrink: 0;
  }

  .cp-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 1rem;
    color: var(--tx);
    font-family: var(--font);
    outline: none;
    padding: 0;
    min-width: 0;
  }
  .cp-input::placeholder { color: var(--mu); }

  .cp-esc {
    font-size: 0.62rem;
    color: var(--mu);
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 3px;
    padding: 2px 7px;
    cursor: pointer;
    font-family: var(--mono);
    line-height: 1.6;
    flex-shrink: 0;
    user-select: none;
  }
  .cp-esc:hover { background: var(--bd); }

  /* ── Body (scrollable) ── */
  .cp-body {
    max-height: 420px;
    overflow-y: auto;
    padding: 10px 0 0;
    display: flex;
    flex-direction: column;
  }

  /* ── Section / group labels ── */
  .cp-section-label,
  .cp-group-label {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--mu);
    padding: 0 15px 5px;
    margin-top: 4px;
  }

  /* ── Quick nav grid ── */
  .cp-nav-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 0 12px 8px;
  }

  .cp-nav-item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: var(--sf2);
    border: 1px solid var(--bd);
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--tx2);
    cursor: pointer;
    transition: background var(--transition), border-color var(--transition), color var(--transition);
    user-select: none;
  }
  .cp-nav-item svg { flex-shrink: 0; color: var(--mu); }
  .cp-nav-item:hover,
  .cp-nav-item.cp-selected {
    background: var(--ac-bg);
    border-color: var(--ac);
    color: var(--ac);
  }
  .cp-nav-item:hover svg,
  .cp-nav-item.cp-selected svg { color: var(--ac); }

  /* ── Result rows ── */
  .cp-results {
    display: flex;
    flex-direction: column;
    padding: 0 6px;
  }

  .cp-result {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition);
    user-select: none;
    margin: 1px 0;
  }
  .cp-result:hover,
  .cp-result.cp-selected {
    background: var(--ac-bg);
  }

  .cp-result-icon {
    flex-shrink: 0;
    color: var(--mu);
  }
  .cp-result.cp-selected .cp-result-icon { color: var(--ac); }

  .cp-result-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .cp-result-title {
    font-size: 0.87rem;
    font-weight: 500;
    color: var(--tx);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cp-result-sub {
    font-size: 0.74rem;
    color: var(--mu);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cp-result-time {
    font-size: 0.7rem;
    color: var(--mu);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .cp-enter-icon {
    flex-shrink: 0;
    color: var(--mu);
    opacity: 0;
    transition: opacity var(--transition);
  }
  .cp-result:hover .cp-enter-icon,
  .cp-result.cp-selected .cp-enter-icon { opacity: 1; color: var(--ac); }

  /* ── Empty / no-results states ── */
  .cp-no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 32px 20px;
    font-size: 0.87rem;
    color: var(--mu);
    text-align: center;
  }
  .cp-no-results em { font-style: normal; color: var(--tx2); }

  .cp-empty-recent {
    font-size: 0.8rem;
    color: var(--mu);
    padding: 8px 15px 4px;
    margin: 0;
  }

  /* ── Footer hint ── */
  .cp-footer {
    display: flex;
    gap: 14px;
    padding: 9px 15px;
    border-top: 1px solid var(--bd);
    font-size: 0.7rem;
    color: var(--mu);
    margin-top: auto;
    flex-shrink: 0;
  }

  .cp-footer kbd {
    font-size: 0.62rem;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 3px;
    padding: 1px 5px;
    font-family: var(--mono);
    color: var(--tx2);
  }

  /* ── Mobile tweaks ── */
  @media (max-width: 480px) {
    .cp-nav-grid { grid-template-columns: repeat(2, 1fr); }
    .cp-panel { top: 10%; transform: translate(-50%, 0); }
  }
</style>
