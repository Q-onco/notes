<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { JournalEntry } from '../lib/types';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { exportJournal, exportJournalDocx, exportJournalPdf } from '../lib/export';
  import RichEditor from './RichEditor.svelte';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  const EXAMPLE_JOURNAL: JournalEntry[] = [
    { id: '_ej1', body: 'Good session today — finally resolved the UMAP instability issue by setting `n_neighbors=50` and `min_dist=0.3`. The myofibroblastic CAF subcluster (iCAF-like) is now clearly separated from the matrix-remodelling CAFs. Will need to validate with published signatures from Öhlund et al.', mood: 'Focused', contextTag: 'Analysis', createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000, audioIds: [] },
    { id: '_ej2', body: 'Reviewed the SOLO-2 extension data from Poveda et al. The PFS benefit in HRD-positive patients is striking — but the 36-month tail-off raises questions about acquired PARPi resistance mechanisms. Our BRCA1-reversion mutations might explain some of this. Need to discuss with the group.', mood: 'Curious', contextTag: 'Research', createdAt: Date.now() - 172800000, updatedAt: Date.now() - 172800000, audioIds: [] },
  ];

  let editingId = $state<string | null>(null);
  let draftBody = $state('');
  let draftMood = $state('');
  let draftTag = $state('');
  let saving = $state(false);
  let search = $state('');
  let viewMode = $state<'list' | 'timeline'>('list');
  let dateFilter = $state<string | null>(null);

  const MOODS = ['Focused', 'Curious', 'Frustrated', 'Energised', 'Tired', 'Inspired', 'Uncertain'];
  const CONTEXT_TAGS = ['Research', 'Writing', 'Analysis', 'Meeting', 'Experiment', 'Reading', 'Planning'];

  const sorted = $derived(
    [...store.journal]
      .filter(e => {
        if (dateFilter) return new Date(e.createdAt).toISOString().slice(0, 10) === dateFilter;
        return !search || e.body.toLowerCase().includes(search.toLowerCase()) || e.contextTag.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  );

  // ── Streak counter ────────────────────────────────────────────
  const streak = $derived((() => {
    const days = new Set(store.journal.map(e => new Date(e.createdAt).toISOString().slice(0, 10)));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    let d = new Date(today);
    // allow today or yesterday to start the streak
    const todayKey = today.toISOString().slice(0, 10);
    const hasTodayOrYesterday = days.has(todayKey) || days.has(new Date(today.getTime() - 86400000).toISOString().slice(0, 10));
    if (!hasTodayOrYesterday) return 0;
    if (!days.has(todayKey)) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })());

  // ── Heatmap ───────────────────────────────────────────────────
  const heatmap = $derived((() => {
    const counts = new Map<string, number>();
    for (const e of store.journal) {
      const key = new Date(e.createdAt).toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);
    // pad back to nearest Monday
    const startMs = today.getTime() - 83 * 86400000;
    const startDay = new Date(startMs);
    let dow = startDay.getDay();
    if (dow === 0) dow = 7;
    startDay.setDate(startDay.getDate() - (dow - 1));
    const rangeStart = new Date(today.getTime() - 83 * 86400000);
    rangeStart.setHours(0, 0, 0, 0);
    const cells: { key: string; count: number; label: string; inRange: boolean; isToday: boolean }[] = [];
    const d = new Date(startDay);
    while (cells.length < 91) {
      const key = d.toISOString().slice(0, 10);
      const inRange = d >= rangeStart && d <= today;
      cells.push({
        key,
        count: inRange ? (counts.get(key) ?? 0) : 0,
        label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        inRange,
        isToday: key === todayKey,
      });
      d.setDate(d.getDate() + 1);
      if (d > today && cells.length % 7 === 0) break;
    }
    // chunk into weeks (columns)
    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    // month labels per week
    const monthLabels = weeks.map(w => {
      const firstInRange = w.find(c => c.inRange);
      if (!firstInRange) return '';
      const d2 = new Date(firstInRange.key);
      return d2.getDate() <= 7 ? d2.toLocaleDateString('en-GB', { month: 'short' }) : '';
    });
    return { weeks, monthLabels, maxCount: Math.max(1, ...counts.values()) };
  })());

  function selectHeatmapDay(key: string) {
    dateFilter = key;
    viewMode = 'list';
  }

  function intensityLevel(count: number, max: number): number {
    if (count === 0) return 0;
    if (count >= max) return 4;
    return Math.ceil((count / max) * 3);
  }

  function startNew() {
    editingId = 'new';
    draftBody = '';
    draftMood = '';
    draftTag = 'Research';
  }

  function startEdit(entry: JournalEntry) {
    editingId = entry.id;
    draftBody = entry.body;
    draftMood = entry.mood;
    draftTag = entry.contextTag;
  }

  async function save() {
    if (!draftBody.replace(/<[^>]*>/g, '').trim()) return;
    saving = true;
    try {
      if (editingId === 'new') {
        const entry: JournalEntry = {
          id: nanoid(),
          body: draftBody,
          mood: draftMood,
          contextTag: draftTag,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          audioIds: []
        };
        store.journal = [entry, ...store.journal];
      } else {
        const entry = store.journal.find(e => e.id === editingId);
        if (entry) {
          entry.body = draftBody;
          entry.mood = draftMood;
          entry.contextTag = draftTag;
          entry.updatedAt = Date.now();
        }
      }
      await store.saveJournal();
      showToast('Journal entry saved');
      editingId = null;
    } finally {
      saving = false;
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this journal entry?')) return;
    store.journal = store.journal.filter(e => e.id !== id);
    await store.saveJournal();
    showToast('Entry deleted');
  }

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Open entry from Calendar click-through ────────────────────
  $effect(() => {
    if (store.selectedJournalId) {
      const entry = store.journal.find(e => e.id === store.selectedJournalId);
      if (entry) startEdit(entry);
      store.selectedJournalId = null;
    }
  });

  function renderBody(body: string): string {
    const html = body.trimStart().startsWith('<') ? body : (marked.parse(body) as string);
    return DOMPurify.sanitize(html);
  }
</script>

<div class="journal">
  <!-- Header -->
  <div class="journal-header">
    <div>
      <h2>Journal</h2>
      <p class="text-sm text-mu">
        {store.journal.length} entries
        {#if streak > 0}<span class="streak-badge">{streak}-day streak</span>{/if}
      </p>
    </div>
    <div class="header-actions">
      {#if viewMode === 'list'}
        <input type="search" bind:value={search} oninput={() => dateFilter = null} placeholder="Search entries..." class="search" />
      {/if}
      {#if store.journal.length > 0}
        <button
          class="btn btn-ghost"
          class:active-toggle={viewMode === 'timeline'}
          onclick={() => { viewMode = viewMode === 'list' ? 'timeline' : 'list'; dateFilter = null; }}
          title="Toggle timeline view"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="3" y="16" width="4" height="4" rx="1"/>
            <rect x="9" y="4" width="4" height="4" rx="1"/><rect x="9" y="10" width="4" height="4" rx="1"/>
            <rect x="15" y="4" width="4" height="4" rx="1"/><rect x="15" y="10" width="4" height="4" rx="1"/><rect x="15" y="16" width="4" height="4" rx="1"/>
          </svg>
          Timeline
        </button>
        <button class="btn btn-ghost" onclick={() => exportJournal(store.journal)} title="Export journal as .md">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          .md
        </button>
        <button class="btn btn-ghost" onclick={() => exportJournalDocx(store.journal)} title="Export as Word .doc">.doc</button>
        <button class="btn btn-ghost" onclick={() => exportJournalPdf(store.journal)} title="Print / PDF">PDF</button>
      {/if}
      <button class="btn btn-primary" onclick={startNew}>New entry</button>
    </div>
  </div>

  <!-- New / edit form -->
  {#if editingId !== null}
    <div class="entry-form card">
      <div class="form-meta">
        <div class="field-group">
          <label id="mood-label">Mood</label>
          <div class="chip-group" aria-labelledby="mood-label">
            {#each MOODS as mood}
              <button
                class="chip"
                class:active={draftMood === mood}
                onclick={() => draftMood = mood}
              >{mood}</button>
            {/each}
          </div>
        </div>
        <div class="field-group">
          <label id="ctx-label">Context</label>
          <div class="chip-group" aria-labelledby="ctx-label">
            {#each CONTEXT_TAGS as tag}
              <button
                class="chip"
                class:active={draftTag === tag}
                onclick={() => draftTag = tag}
              >{tag}</button>
            {/each}
          </div>
        </div>
      </div>

      <RichEditor
        bind:value={draftBody}
        placeholder="What happened today? What did you discover, struggle with, or learn?"
        minHeight="180px"
      />

      <div class="form-actions">
        <button class="btn btn-ghost" onclick={() => editingId = null}>Cancel</button>
        <button class="btn btn-primary" onclick={save} disabled={saving || !draftBody.replace(/<[^>]*>/g, '').trim()}>
          {saving ? 'Saving...' : 'Save entry'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Timeline heatmap -->
  {#if viewMode === 'timeline' && store.journal.length > 0}
    <div class="heatmap-wrap card">
      <p class="heatmap-title">Activity · last 12 weeks</p>
      <div class="heatmap-scroll">
        <div class="heatmap-inner">
          <!-- month labels row -->
          <div class="heatmap-month-row">
            <div class="heatmap-dow-col"></div>
            {#each heatmap.weeks as _, wi}
              <div class="heatmap-month-cell">{heatmap.monthLabels[wi]}</div>
            {/each}
          </div>
          <!-- day-of-week rows -->
          {#each ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'] as dayLabel, di}
            <div class="heatmap-row">
              <span class="heatmap-dow">{dayLabel}</span>
              {#each heatmap.weeks as week}
                {#if week[di]}
                  {@const cell = week[di]}
                  <button
                    class="heatmap-cell"
                    class:heatmap-today={cell.isToday}
                    class:heatmap-faded={!cell.inRange}
                    data-level={cell.inRange ? intensityLevel(cell.count, heatmap.maxCount) : 0}
                    title={cell.inRange ? `${cell.label}${cell.count ? ' · ' + cell.count + ' entr' + (cell.count === 1 ? 'y' : 'ies') : ''}` : ''}
                    onclick={() => cell.inRange && cell.count > 0 && selectHeatmapDay(cell.key)}
                    disabled={!cell.inRange || cell.count === 0}
                  ></button>
                {:else}
                  <span class="heatmap-cell heatmap-faded"></span>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      </div>
      <div class="heatmap-legend">
        <span class="heatmap-legend-label">Less</span>
        {#each [0,1,2,3,4] as lvl}
          <span class="heatmap-cell heatmap-legend-cell" data-level={lvl}></span>
        {/each}
        <span class="heatmap-legend-label">More</span>
      </div>
    </div>
  {/if}

  <!-- Date filter badge -->
  {#if dateFilter}
    <div class="date-filter-bar">
      <span class="date-filter-label">
        Showing entries for {new Date(dateFilter + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
      <button class="btn-link" onclick={() => { dateFilter = null; }}>Clear ✕</button>
    </div>
  {/if}

  <!-- Entries list -->
  <div class="entries-list">
    {#each sorted as entry (entry.id)}
      <article class="entry-card card">
        <div class="entry-head">
          <div class="entry-meta">
            <span class="entry-date">{fmtDate(entry.createdAt)}</span>
            <span class="entry-time text-xs text-mu">{fmtTime(entry.createdAt)}</span>
            {#if entry.mood}
              <span class="tag">{entry.mood}</span>
            {/if}
            {#if entry.contextTag}
              <span class="tag tag-ac">{entry.contextTag}</span>
            {/if}
            {#if entry.audioIds.length > 0}
              <span class="tag">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                </svg>
                {entry.audioIds.length}
              </span>
            {/if}
          </div>
          <div class="entry-actions">
            <button class="btn-icon" onclick={() => {
              const date = new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              const plain = entry.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              store.openCompose({ subject: `Journal entry — ${date}`, body: plain });
            }} title="Send as email">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            </button>
            <button class="btn-icon" onclick={() => startEdit(entry)} title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon danger" onclick={() => deleteEntry(entry.id)} title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="entry-body md">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html renderBody(entry.body)}
        </div>
      </article>
    {:else}
      {#each EXAMPLE_JOURNAL as entry (entry.id)}
        <article class="entry-card card example-entry">
          <div class="entry-head">
            <div class="entry-meta">
              <span class="entry-date">{new Date(entry.createdAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span class="tag">{entry.mood}</span>
              <span class="tag tag-ac">{entry.contextTag}</span>
              <span class="example-badge">· example</span>
            </div>
          </div>
          <div class="entry-body md">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html renderBody(entry.body)}
          </div>
        </article>
      {/each}
      <div class="empty-cta">
        <p class="text-mu text-sm">No journal entries yet. Start with how your research is going today.</p>
        <button class="btn btn-primary" onclick={startNew}>Write first entry</button>
      </div>
    {/each}
  </div>
</div>

<style>
  .journal {
    height: 100%;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .journal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .header-actions { display: flex; gap: 10px; align-items: center; }
  .search { width: 200px; }

  .entry-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-color: var(--ac);
  }

  .form-meta { display: flex; flex-direction: column; gap: 10px; }
  .field-group { display: flex; flex-direction: column; gap: 6px; }
  .field-group label { font-size: 0.75rem; font-weight: 600; color: var(--mu); text-transform: uppercase; letter-spacing: 0.06em; }

  .chip-group { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 500;
    background: var(--sf2);
    border: 1px solid var(--bd);
    color: var(--tx2);
    cursor: pointer;
    transition: all var(--transition);
  }
  .chip.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .chip:hover:not(.active) { border-color: var(--bd2); }

  .form-actions { display: flex; justify-content: flex-end; gap: 8px; }

  .entries-list { display: flex; flex-direction: column; gap: 14px; }

  .entry-card { display: flex; flex-direction: column; gap: 12px; }

  .entry-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .entry-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .entry-date { font-weight: 600; font-size: 0.9rem; }
  .entry-time { margin-left: 4px; }
  .entry-actions { display: flex; gap: 2px; flex-shrink: 0; }
  .entry-actions .danger:hover { color: var(--rd); background: var(--rd-bg); }

  .entry-body { font-size: 0.9rem; line-height: 1.7; }

  .example-entry { opacity: 0.6; pointer-events: none; }
  .example-badge {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--mu);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .empty-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0 8px;
  }

  /* ── Streak ── */
  .streak-badge {
    display: inline-block;
    margin-left: 8px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--ac);
    background: var(--ac-bg);
    border: 1px solid var(--ac);
    border-radius: 20px;
    padding: 1px 8px;
  }

  /* ── Active toggle ── */
  .active-toggle {
    background: var(--ac-bg);
    color: var(--ac);
    border-color: var(--ac);
  }

  /* ── Heatmap ── */
  .heatmap-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
  }
  .heatmap-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mu);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .heatmap-scroll { overflow-x: auto; }
  .heatmap-inner { display: flex; flex-direction: column; gap: 3px; }

  .heatmap-month-row {
    display: flex;
    gap: 3px;
    margin-bottom: 2px;
  }
  .heatmap-dow-col { width: 26px; flex-shrink: 0; }
  .heatmap-month-cell {
    width: 14px;
    font-size: 0.6rem;
    color: var(--mu);
    font-weight: 600;
    flex-shrink: 0;
    text-align: left;
    white-space: nowrap;
    overflow: visible;
  }

  .heatmap-row {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .heatmap-dow {
    font-size: 0.6rem;
    color: var(--mu);
    width: 24px;
    flex-shrink: 0;
    text-align: right;
    padding-right: 4px;
  }

  .heatmap-cell {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
    border: none;
    cursor: default;
    background: var(--sf2);
    padding: 0;
    transition: opacity 0.1s;
  }
  .heatmap-cell[data-level="0"] { background: var(--sf2); }
  .heatmap-cell[data-level="1"] { background: color-mix(in srgb, var(--ac) 25%, var(--sf2)); }
  .heatmap-cell[data-level="2"] { background: color-mix(in srgb, var(--ac) 50%, var(--sf2)); }
  .heatmap-cell[data-level="3"] { background: color-mix(in srgb, var(--ac) 75%, var(--sf2)); }
  .heatmap-cell[data-level="4"] { background: var(--ac); }
  button.heatmap-cell:not(:disabled) { cursor: pointer; }
  button.heatmap-cell:not(:disabled):hover { opacity: 0.75; outline: 1.5px solid var(--ac); outline-offset: 1px; }
  .heatmap-today { outline: 1.5px solid var(--tx2); outline-offset: 1px; }
  .heatmap-faded { opacity: 0.2; }

  .heatmap-legend {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }
  .heatmap-legend-label {
    font-size: 0.6rem;
    color: var(--mu);
  }
  .heatmap-legend-cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    opacity: 1;
  }

  /* ── Date filter ── */
  .date-filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    background: var(--ac-bg);
    border: 1px solid var(--ac);
    border-radius: var(--radius);
    font-size: 0.82rem;
  }
  .date-filter-label { flex: 1; color: var(--ac); font-weight: 500; }
  .btn-link {
    background: transparent;
    border: none;
    color: var(--ac);
    cursor: pointer;
    font-size: 0.78rem;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-family: var(--font);
  }
  .btn-link:hover { background: var(--ac); color: #fff; }

  @media (max-width: 640px) {
    .journal { padding: 16px; }
    .journal-header { flex-direction: column; gap: 8px; }
    .header-actions { flex-wrap: wrap; }
    .form-meta { gap: 8px; }
  }
  @media (max-width: 540px) {
    .journal-header { flex-direction: column; gap: 10px; }
    .header-actions { flex-wrap: wrap; }
    .search { width: 100%; }
    .chip-group { gap: 4px; }
    .chip { font-size: 0.72rem; padding: 3px 8px; }
    .journal { padding: 14px; }
    .entry-actions { flex-shrink: 0; }
  }
</style>
