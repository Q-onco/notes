<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { Note } from '../lib/types';
  import { exportPapers } from '../lib/export';
  import { generateWeeklyDigest, generatePiReport } from '../lib/groq';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  const EX_NOTES = [
    { id: '_en1', title: 'HGSOC TME scRNA-seq — cohort notes', updatedAt: Date.now() - 7200000 },
    { id: '_en2', title: 'Cellranger v8 SORT_FAILS_MEMORY fix', updatedAt: Date.now() - 86400000 },
  ];
  const EX_TASKS = [
    { id: '_et1', text: 'Run NicheNet on macrophage–T cell interactions', done: false, priority: 'high' as const },
    { id: '_et2', text: 'Validate FOLR1 by multiplex IF on FFPE slides', done: false, priority: 'medium' as const },
    { id: '_et3', text: 'Submit revisions to Nature Cancer', done: true, priority: 'high' as const },
  ];
  const EX_JOURNAL = [
    { id: '_ej1', body: 'Good session — finally resolved the UMAP instability issue by increasing n_neighbors to 50. The CAF subclusters are now cleanly separated.', createdAt: Date.now() - 86400000 },
    { id: '_ej2', body: 'Reviewed SOLO-2 extension data. The PFS benefit in HRD-positive patients is striking but the tail-off at 36 months raises questions about acquired resistance mechanisms.', createdAt: Date.now() - 172800000 },
  ];

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

  function relTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function sendToEnzo(prompt: string) {
    store.enzoOpen = true;
    store.enzoSearchQuery = prompt;
  }

  const tasksDone = $derived(store.tasks.filter(t => t.done).length);
  const tasksTotal = $derived(store.tasks.length);
  const taskPct = $derived(tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0);
  const recentJournal = $derived(
    [...store.journal].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3)
  );

  // F4k recent files
  const recentFiles = $derived(
    [...store.files]
      .filter(f => f.openedAt)
      .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
      .slice(0, 5)
  );

  // Week activity
  const weekMs = 7 * 86400000;
  const weekStart = $derived(Date.now() - weekMs);
  const papersThisWeek = $derived(store.readingList.filter(r => r.addedAt > weekStart).length);
  const journalThisWeek = $derived(store.journal.filter(e => e.createdAt > weekStart).length);
  const notesThisWeek = $derived(store.notes.filter(n => n.updatedAt > weekStart && !n.archived).length);

  // Upcoming deadlines from job tracker
  const nextDeadline = $derived(
    store.savedJobs
      .filter(j => j.listing.deadline && j.listing.deadline > Date.now())
      .sort((a, b) => (a.listing.deadline ?? 0) - (b.listing.deadline ?? 0))[0] ?? null
  );

  const jobsActive = $derived(
    store.savedJobs.filter(j => j.status !== 'closed' && j.status !== 'offer').length
  );

  // Dynamic Enzo prompts — contextual to actual data
  const quickPrompts = $derived((() => {
    const prompts: string[] = [];
    const latestJournal = [...store.journal].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (latestJournal) {
      const d = new Date(latestJournal.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      prompts.push(`My journal entry from ${d}: "${latestJournal.body.slice(0, 80)}…" — what should I focus on next?`);
    }
    if (store.activeTasks.length > 0) {
      prompts.push(`I have ${store.activeTasks.length} open tasks. Given my research context, what should I prioritise today?`);
    }
    if (store.pinnedPapers.length > 0) {
      prompts.push(`I have ${store.pinnedPapers.length} pinned papers. Identify the common themes and any methodological gaps I should address.`);
    }
    if (nextDeadline) {
      const daysLeft = Math.ceil(((nextDeadline.listing.deadline ?? 0) - Date.now()) / 86400000);
      prompts.push(`I have ${daysLeft} days until my ${nextDeadline.listing.company} application deadline. Help me plan my remaining preparation.`);
    }
    prompts.push('What are the most important open questions in spatial transcriptomics of HGSOC right now?');
    prompts.push('Suggest an experiment to probe PARPi resistance mechanisms in my HGSOC cohort.');
    return prompts.slice(0, 5);
  })());

  // ── Analytics ─────────────────────────────────────────────────
  const heatmapCells = $derived((() => {
    const now = Date.now();
    return Array.from({ length: 84 }, (_, i) => {
      const dayStart = now - (83 - i) * 86400000;
      const dayEnd = dayStart + 86400000;
      const a = store.notes.filter(n => n.updatedAt >= dayStart && n.updatedAt < dayEnd && !n.archived).length
              + store.journal.filter(e => e.createdAt >= dayStart && e.createdAt < dayEnd).length;
      return {
        x: Math.floor(i / 7) * 14,
        y: (i % 7) * 14,
        a,
        label: new Date(dayStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + a + ' edits',
      };
    });
  })());

  const papersReadWeekly = $derived((() => {
    const weeks = Array<number>(8).fill(0);
    const now = Date.now();
    store.readingList.filter(r => r.read && r.readAt).forEach(r => {
      const w = Math.floor((now - r.readAt!) / (7 * 86400000));
      if (w >= 0 && w < 8) weeks[7 - w]++;
    });
    return weeks;
  })());
  const maxPW = $derived(Math.max(...papersReadWeekly, 1));

  let pubStats = $state<{ hIndex: number; citations: number; works: number } | null>(null);
  let pubLoading = $state(false);

  async function fetchPubImpact() {
    const orcid = store.cvProfile.orcid;
    if (!orcid || pubStats || pubLoading) return;
    pubLoading = true;
    try {
      const res = await fetch(`https://api.openalex.org/authors?filter=orcid:${orcid}&select=summary_stats,works_count,cited_by_count`);
      const data = await res.json();
      const a = data.results?.[0];
      if (a) pubStats = { hIndex: a.summary_stats?.h_index ?? 0, citations: a.cited_by_count ?? 0, works: a.works_count ?? 0 };
    } catch { /* offline */ }
    pubLoading = false;
  }
  $effect(() => { fetchPubImpact(); });

  // ── Grant countdown (60-day window) ───────────────────────────
  const EX_GRANTS = [
    { title: 'ERC Starting Grant — HGSOC Immune Evasion', daysLeft: 28, agency: 'ERC' },
    { title: 'CRUK Early Career Award', daysLeft: 8, agency: 'CRUK' },
  ];
  const upcomingGrants = $derived((() => {
    const now = Date.now();
    const window60 = now + 60 * 86400000;
    return store.grants
      .filter(g =>
        g.deadline !== null &&
        g.deadline > now &&
        g.deadline < window60 &&
        g.status !== 'awarded' &&
        g.status !== 'rejected' &&
        g.status !== 'withdrawn'
      )
      .sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0))
      .slice(0, 5)
      .map(g => ({
        title: g.title,
        daysLeft: Math.ceil((g.deadline! - now) / 86400000),
        agency: g.agency,
      }));
  })());
  const showExampleGrants = $derived(store.grants.length === 0 || upcomingGrants.length === 0);

  const todayStartTs = $derived((() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })());
  const journalToday = $derived(store.journal.some(e => e.createdAt >= todayStartTs));
  const todayTopTasks = $derived(store.activeTasks.slice(0, 4));
  const upcomingDeadlines = $derived((() => {
    const soon = Date.now() + 7 * 86400000;
    return [
      ...store.savedJobs.filter(j => j.listing.deadline && j.listing.deadline > Date.now() && j.listing.deadline < soon)
        .map(j => ({ label: j.listing.company, at: j.listing.deadline! })),
    ].sort((a, b) => a.at - b.at).slice(0, 3);
  })());

  // ── Weekly digest ─────────────────────────────────────────────
  let digestText = $state('');
  let digestStreaming = $state(false);
  let digestOpen = $state(false);
  let digestAbort: AbortController | null = null;
  let digestBodyEl = $state<HTMLElement | null>(null);

  // ── PI Report ─────────────────────────────────────────────────
  let piText = $state('');
  let piStreaming = $state(false);
  let piOpen = $state(false);
  let piAbort: AbortController | null = null;
  let piBodyEl = $state<HTMLElement | null>(null);

  $effect(() => { digestText; if (digestBodyEl) digestBodyEl.scrollTop = digestBodyEl.scrollHeight; });
  $effect(() => { piText;     if (piBodyEl)     piBodyEl.scrollTop     = piBodyEl.scrollHeight; });

  async function runPiReport() {
    if (piStreaming) { piAbort?.abort(); piStreaming = false; return; }
    piAbort = new AbortController();
    piOpen = true;
    piText = '';
    piStreaming = true;
    const ws = Date.now() - 7 * 86400000;
    const data = {
      journalEntries: [...store.journal].filter(e => e.createdAt > ws).sort((a,b) => b.createdAt - a.createdAt).map(e => ({
        date: new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        body: e.body.replace(/<[^>]*>/g, ' ').slice(0, 200),
        mood: e.mood,
      })),
      tasksDone: store.tasks.filter(t => t.done).slice(0, 12).map(t => t.text),
      tasksOpen: store.tasks.filter(t => !t.done).slice(0, 10).map(t => t.text),
      pipelineRuns: store.pipelineRuns.filter(r => r.updatedAt > ws).map(r => ({ title: r.title, status: r.status, pipelineType: r.pipelineType })),
      papersRead: store.readingList.filter(r => r.read && r.readAt && r.readAt > ws).map(r => ({ title: r.paper.title, journal: r.paper.journal })),
      hypotheses: store.hypotheses.slice(0, 6).map(h => ({ text: h.text, status: h.status })),
    };
    try {
      await generatePiReport(data, (chunk) => { piText += chunk; }, piAbort.signal);
    } catch { /* aborted */ }
    piStreaming = false;
  }

  async function runDigest() {
    if (digestStreaming) { digestAbort?.abort(); digestStreaming = false; return; }
    digestAbort = new AbortController();
    digestOpen = true;
    digestText = '';
    digestStreaming = true;
    const ws = Date.now() - 7 * 86400000;
    const data = {
      papersRead: store.readingList.filter(r => r.read && r.readAt && r.readAt > ws).map(r => ({ title: r.paper.title, journal: r.paper.journal })),
      papersAdded: store.readingList.filter(r => r.addedAt > ws).map(r => ({ title: r.paper.title })),
      journalEntries: [...store.journal].filter(e => e.createdAt > ws).sort((a,b) => b.createdAt - a.createdAt).map(e => ({
        date: new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        body: e.body.slice(0, 200),
        mood: e.mood,
      })),
      tasksDone: store.tasks.filter(t => t.done).slice(0, 10).map(t => t.text),
      tasksOpen: store.tasks.filter(t => !t.done).slice(0, 10).map(t => t.text),
    };
    try {
      await generateWeeklyDigest(data, (chunk) => { digestText += chunk; }, digestAbort.signal);
    } catch { /* aborted */ }
    digestStreaming = false;
  }
</script>

<div class="dashboard">
  <div class="dash-inner">
    <!-- Header -->
    <div class="dash-header">
      <div>
        <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {store.settings.userName}.</h1>
        <p class="text-mu text-sm">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
      <button class="btn btn-primary" onclick={newNote}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New note
      </button>
    </div>

    <!-- Stats row -->
    <div class="stats-row">
      <button class="stat-card" onclick={() => store.view = 'notes'}>
        <span class="stat-value">{store.notes.filter(n => !n.archived).length}</span>
        <span class="stat-label">Notes</span>
        {#if notesThisWeek > 0}<span class="stat-week">+{notesThisWeek} this week</span>{/if}
      </button>
      <button class="stat-card" onclick={() => store.view = 'journal'}>
        <span class="stat-value">{store.journal.length}</span>
        <span class="stat-label">Journal</span>
        {#if journalThisWeek > 0}<span class="stat-week">+{journalThisWeek} this week</span>{/if}
      </button>
      <button class="stat-card" onclick={() => store.view = 'tasks'}>
        <span class="stat-value">{store.activeTasks.length}</span>
        <span class="stat-label">Open tasks</span>
        {#if tasksTotal > 0}<span class="stat-week">{taskPct}% done</span>{/if}
      </button>
      <button class="stat-card" onclick={() => store.view = 'research'}>
        <span class="stat-value">{store.readingList.length}</span>
        <span class="stat-label">Reading list</span>
        {#if papersThisWeek > 0}<span class="stat-week">+{papersThisWeek} this week</span>{/if}
      </button>
      <button class="stat-card" onclick={() => store.view = 'jobs'}>
        <span class="stat-value">{jobsActive}</span>
        <span class="stat-label">Active jobs</span>
        {#if nextDeadline}
          <span class="stat-week stat-deadline">
            {Math.ceil(((nextDeadline.listing.deadline ?? 0) - Date.now()) / 86400000)}d · {nextDeadline.listing.company}
          </span>
        {/if}
      </button>
      <button class="stat-card" onclick={() => store.view = 'audio'}>
        <span class="stat-value">{store.audioRecords.length}</span>
        <span class="stat-label">Recordings</span>
      </button>
    </div>

    <!-- Upcoming deadline banner -->
    {#if nextDeadline}
      <div class="deadline-banner">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>
          <strong>{nextDeadline.listing.company}</strong> — {nextDeadline.listing.title} ·
          {Math.ceil(((nextDeadline.listing.deadline ?? 0) - Date.now()) / 86400000)} days left
        </span>
        <button class="btn btn-ghost btn-sm deadline-go" onclick={() => store.view = 'jobs'}>Go →</button>
      </div>
    {/if}

    <!-- Weekly digest -->
    {#if store.aiSettings.weeklyDigest}
      <div class="digest-row">
        <button class="btn btn-ghost btn-sm" onclick={runDigest}>
          {#if digestStreaming}
            <span class="spinner-xs-inline"></span> Stop
          {:else}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Weekly digest<span class="model-pill">[70B]</span>
          {/if}
        </button>
        {#if digestOpen}
          <button class="btn-link" onclick={() => digestOpen = false}>Close ✕</button>
        {/if}
      </div>
      {#if digestOpen && (digestText || digestStreaming)}
        <div class="digest-panel card">
          <div class="digest-body text-sm" bind:this={digestBodyEl}>{digestText || '…'}</div>
        </div>
      {/if}
    {/if}

    <!-- PI Report -->
    <div class="digest-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--bd);">
      <button class="btn btn-ghost btn-sm pi-report-btn" onclick={runPiReport}>
        {#if piStreaming}
          <span class="spinner-xs-inline"></span> Stop
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Enzo's progress report<span class="model-pill">[70B]</span>
        {/if}
      </button>
      {#if piOpen}
        <button class="btn-link" onclick={() => { piOpen = false; piText = ''; }}>Close ✕</button>
        {#if piText && !piStreaming}
          <button class="btn-link" onclick={() => { navigator.clipboard.writeText(piText); showToast('Report copied'); }}>Copy</button>
          <button class="btn-link" onclick={() => store.openCompose({ subject: 'Progress Report', body: piText })}>Email</button>
        {/if}
      {/if}
    </div>
    {#if piOpen && (piText || piStreaming)}
      <div class="digest-panel card pi-report-panel">
        <div class="digest-body text-sm" style="white-space:pre-wrap" bind:this={piBodyEl}>{piText || '…'}</div>
      </div>
    {/if}

    <!-- Analytics strip -->
    <div class="analytics-strip">

      <!-- Activity heatmap -->
      <div class="analytics-card">
        <div class="ac-head">
          <span class="ac-label">Writing activity</span>
          <span class="ac-sub">12 weeks</span>
        </div>
        <svg class="heatmap-svg" viewBox="0 0 168 110" width="168" height="110">
          {#each heatmapCells as cell}
            <rect x={cell.x} y={cell.y} width={12} height={12} rx="2"
              fill={cell.a === 0 ? 'var(--sf3)' : cell.a === 1 ? 'var(--gn-muted)' : cell.a >= 2 ? 'var(--gn)' : 'var(--sf3)'}
              opacity={cell.a === 0 ? 1 : 0.85}
            >
              <title>{cell.label}</title>
            </rect>
          {/each}
        </svg>
        <div class="heatmap-legend">
          <span>Less</span>
          <div class="hm-box" style="background:var(--sf3)"></div>
          <div class="hm-box" style="background:var(--gn-muted)"></div>
          <div class="hm-box" style="background:var(--gn)"></div>
          <span>More</span>
        </div>
      </div>

      <!-- Papers read per week -->
      <div class="analytics-card">
        <div class="ac-head">
          <span class="ac-label">Papers read</span>
          <span class="ac-sub">8 weeks</span>
        </div>
        <div class="bar-chart">
          {#each papersReadWeekly as count, i}
            <div class="bar-col">
              <div class="bar" style="height:{count > 0 ? Math.max((count / maxPW) * 72, 6) : 3}px; background:{count > 0 ? 'var(--ac)' : 'var(--sf3)'};" title="{count} papers · week {i+1}"></div>
              {#if i === 7}<span class="bar-label">now</span>{/if}
            </div>
          {/each}
        </div>
        <div class="ac-total">
          <span class="ac-num">{store.readingList.filter(r => r.read).length}</span>
          <span class="ac-unit">total read</span>
        </div>
      </div>

      <!-- Publication impact -->
      <div class="analytics-card pub-card" onclick={fetchPubImpact}>
        <div class="ac-head">
          <span class="ac-label">Publication impact</span>
          <span class="ac-sub">via OpenAlex</span>
        </div>
        {#if pubLoading}
          <div class="pub-loading"><span class="spinner-xs-inline"></span> Fetching…</div>
        {:else if pubStats}
          <div class="pub-stats">
            <div class="pub-stat">
              <span class="pub-val">{pubStats.hIndex}</span>
              <span class="pub-key">h-index</span>
            </div>
            <div class="pub-divider"></div>
            <div class="pub-stat">
              <span class="pub-val">{pubStats.citations}</span>
              <span class="pub-key">citations</span>
            </div>
            <div class="pub-divider"></div>
            <div class="pub-stat">
              <span class="pub-val">{pubStats.works}</span>
              <span class="pub-key">works</span>
            </div>
          </div>
        {:else if store.cvProfile.orcid}
          <button class="fetch-pub-btn" onclick={fetchPubImpact}>Fetch from OpenAlex →</button>
        {:else}
          <p class="pub-no-orcid text-xs text-mu">Set your ORCID in Settings → CV Profile to see impact stats</p>
        {/if}
      </div>

    </div>

    <!-- Daily focus -->
    <div class="daily-focus">
      <div class="df-head">
        <div>
          <span class="df-label">Daily focus</span>
          <span class="df-date text-mu text-xs">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        {#if !journalToday}
          <button class="df-journal-btn" onclick={() => store.view = 'journal'}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Write today's journal
          </button>
        {:else}
          <span class="df-done text-xs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--gn)"><path d="M20 6L9 17l-5-5"/></svg>
            Journal written
          </span>
        {/if}
      </div>
      <div class="df-body">
        <div class="df-tasks">
          {#if todayTopTasks.length > 0}
            {#each todayTopTasks as task}
              <div class="df-task">
                <span class="df-priority df-{task.priority}"></span>
                <span class="df-task-text">{task.text}</span>
              </div>
            {/each}
            {#if store.activeTasks.length > 4}
              <button class="df-more" onclick={() => store.view = 'tasks'}>+{store.activeTasks.length - 4} more tasks →</button>
            {/if}
          {:else}
            <p class="text-xs text-mu" style="padding:4px 0">No open tasks — <button class="btn-link" onclick={() => store.view = 'tasks'}>add one</button></p>
          {/if}
        </div>
        {#if upcomingDeadlines.length > 0}
          <div class="df-deadlines">
            {#each upcomingDeadlines as dl}
              <div class="df-dl">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--yw);flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span class="text-xs">{dl.label}</span>
                <span class="text-xs text-mu">{Math.ceil((dl.at - Date.now()) / 86400000)}d</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Main grid -->
    <div class="dash-grid">

      <!-- Recent notes -->
      <section class="card dash-card">
        <div class="card-head">
          <h3>Recent notes</h3>
          <button class="btn btn-ghost btn-sm" onclick={() => store.view = 'notes'}>All</button>
        </div>
        <div class="note-rows">
          {#each (store.recentNotes.length > 0 ? store.recentNotes.slice(0, 5) : EX_NOTES) as note}
            <button
              class="note-row"
              class:example-row={note.id.startsWith('_')}
              onclick={() => { if (!note.id.startsWith('_')) { store.currentNoteId = note.id; store.view = 'notes'; } else store.view = 'notes'; }}
            >
              <span class="note-row-title">{note.title || 'Untitled'}{note.id.startsWith('_') ? '' : ''}</span>
              <span class="note-row-time text-xs text-mu">{note.id.startsWith('_') ? '· example' : relTime(note.updatedAt)}</span>
            </button>
          {/each}
        </div>
      </section>

      <!-- Tasks progress -->
      <section class="card dash-card">
        <div class="card-head">
          <h3>Tasks</h3>
          <button class="btn btn-ghost btn-sm" onclick={() => store.view = 'tasks'}>All</button>
        </div>
        {#if tasksTotal > 0}
          <div class="task-progress">
            <div class="task-progress-bar">
              <div class="task-progress-fill" style="width: {taskPct}%"></div>
            </div>
            <span class="text-xs text-mu">{tasksDone}/{tasksTotal} complete</span>
          </div>
        {/if}
        <div class="task-rows">
          {#each (store.activeTasks.length > 0 ? store.activeTasks.slice(0, 5) : EX_TASKS) as task}
            <div class="task-row" class:example-row={task.id.startsWith('_')}>
              <input type="checkbox" checked={task.done} disabled={task.id.startsWith('_')}
                onchange={() => { task.done = !task.done; store.saveTasks(); }} />
              <span class="task-row-text" class:done={task.done}>{task.text}</span>
              {#if task.id.startsWith('_')}
                <span class="example-mu">· example</span>
              {:else}
                <span class="priority-dot priority-{task.priority}"></span>
              {/if}
            </div>
          {/each}
        </div>
      </section>

      <!-- Journal -->
      <section class="card dash-card">
        <div class="card-head">
          <h3>Journal</h3>
          <button class="btn btn-ghost btn-sm" onclick={() => store.view = 'journal'}>All</button>
        </div>
        <div class="journal-rows">
          {#each (recentJournal.length > 0 ? recentJournal : EX_JOURNAL) as entry}
            <div class="journal-row" class:example-row={entry.id.startsWith('_')}>
              <span class="journal-date text-xs text-mu">
                {entry.id.startsWith('_') ? '· example' : new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <span class="journal-body text-sm">{entry.body.slice(0, 80)}{entry.body.length > 80 ? '…' : ''}</span>
            </div>
          {/each}
        </div>
      </section>

      <!-- F4k Recent files -->
      {#if recentFiles.length > 0}
        <section class="card dash-card">
          <div class="card-head">
            <h3>Recent Files</h3>
            <button class="btn btn-ghost btn-sm" onclick={() => store.view = 'files'}>All</button>
          </div>
          <div class="recent-files-rows">
            {#each recentFiles as f}
              <button class="recent-file-row" onclick={() => { store.view = 'files'; }}>
                <span class="recent-file-icon" style="color:{f.mimeType.startsWith('image/') ? 'var(--gn)' : f.mimeType==='application/pdf' ? 'var(--rd)' : 'var(--ac)'}">
                  {#if f.mimeType.startsWith('image/')}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  {:else if f.mimeType==='application/pdf'}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {:else}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
                  {/if}
                </span>
                <span class="recent-file-name">{f.name}</span>
                <span class="recent-file-time text-xs text-mu">
                  {new Date(f.openedAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Enzo quick prompts -->
      <section class="card dash-card enzo-card">
        <div class="card-head">
          <h3 class="text-enzo">Ask Enzo</h3>
          <button class="btn btn-enzo btn-sm" onclick={() => store.enzoOpen = true}>Open</button>
        </div>
        <div class="prompt-chips">
          {#each quickPrompts as prompt}
            <button class="prompt-chip" onclick={() => sendToEnzo(prompt)}>
              {prompt.length > 90 ? prompt.slice(0, 90) + '…' : prompt}
            </button>
          {/each}
        </div>
      </section>

      <!-- Upcoming grant deadlines -->
      <section class="card dash-card">
        <div class="card-head">
          <h3>Upcoming deadlines</h3>
          <button class="btn btn-ghost btn-sm" onclick={() => store.view = 'grants'}>All</button>
        </div>
        <div class="grant-rows">
          {#if showExampleGrants}
            {#each EX_GRANTS as g}
              <div class="grant-row example-row">
                <span class="grant-title">{g.title.length > 48 ? g.title.slice(0, 48) + '…' : g.title}</span>
                <div class="grant-row-right">
                  <span class="days-badge days-badge-{g.daysLeft <= 7 ? 'red' : g.daysLeft <= 14 ? 'yellow' : 'green'}">{g.daysLeft}d</span>
                  <span class="example-mu">· example</span>
                </div>
              </div>
            {/each}
          {:else}
            {#each upcomingGrants as g}
              <div class="grant-row">
                <span class="grant-title">{g.title.length > 52 ? g.title.slice(0, 52) + '…' : g.title}</span>
                <span class="days-badge days-badge-{g.daysLeft <= 7 ? 'red' : g.daysLeft <= 14 ? 'yellow' : 'green'}">{g.daysLeft}d</span>
              </div>
            {/each}
          {/if}
        </div>
      </section>

    </div>

    <!-- Pinned research papers -->
    {#if store.pinnedPapers.length > 0}
      <section class="card pinned-section">
        <div class="card-head">
          <h3>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="color: var(--enzo); margin-right: 5px; vertical-align: -1px;">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
            </svg>
            Pinned papers
            <span class="pin-count">{store.pinnedPapers.length}</span>
          </h3>
          <button class="btn btn-ghost btn-sm" onclick={() => exportPapers(store.pinnedPapers)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
        <div class="pinned-list">
          {#each store.pinnedPapers as paper (paper.id)}
            <div class="pinned-row">
              <div class="pinned-main">
                <a
                  class="pinned-title"
                  href={paper.doi ? `https://doi.org/${paper.doi}` : paper.url}
                  target="_blank"
                  rel="noreferrer"
                >{paper.title}</a>
                <div class="pinned-meta">
                  <span class="source-badge source-{paper.source}">{paper.source === 'pubmed' ? 'PubMed' : paper.source === 'biorxiv' ? 'bioRxiv' : paper.source === 'medrxiv' ? 'medRxiv' : paper.source.charAt(0).toUpperCase() + paper.source.slice(1)}</span>
                  <span class="text-xs text-mu">{paper.journal}{paper.year > 0 ? ` · ${paper.year}` : ''}</span>
                </div>
              </div>
              <button
                class="btn-icon unpin-btn"
                onclick={async () => { await store.unpinPaper(paper.id); showToast('Unpinned'); }}
                title="Unpin"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      </section>
    {/if}

  </div>
</div>

<style>
  .dashboard {
    height: 100%;
    overflow-y: auto;
    padding: 24px;
  }

  .dash-inner {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .dash-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .dash-header h1 { font-size: 1.4rem; }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
  }

  .stat-card {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 14px 16px;
    cursor: pointer;
    transition: border-color var(--transition), box-shadow var(--transition);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-card:hover { border-color: var(--ac); box-shadow: var(--shadow); }

  .stat-value { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.03em; color: var(--tx); }
  .stat-label { font-size: 0.75rem; color: var(--mu); }
  .stat-week { font-size: 0.68rem; color: var(--gn); font-weight: 600; }
  .stat-deadline { color: var(--yw) !important; }

  .digest-row { display: flex; align-items: center; gap: 10px; }
  .digest-panel { padding: 16px; white-space: pre-wrap; line-height: 1.7; }
  .digest-body { white-space: pre-wrap; max-height: 320px; overflow-y: auto; scroll-behavior: smooth; }
  .pi-report-btn { color: var(--enzo, #a855f7); border-color: rgba(168,85,247,0.25); }
  .pi-report-btn:hover { background: var(--enzo-bg, rgba(168,85,247,0.1)); }
  .pi-report-panel { background: var(--enzo-bg, rgba(168,85,247,0.05)); border-color: rgba(168,85,247,0.2); }
  .spinner-xs-inline { display: inline-block; width: 10px; height: 10px; border: 1.5px solid var(--bd2); border-top-color: var(--ac); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn-link { background: transparent; border: none; color: var(--ac); cursor: pointer; font-size: 0.78rem; padding: 2px 6px; border-radius: var(--radius-sm); font-family: var(--font); }
  .btn-link:hover { background: var(--ac-bg); }

  .deadline-banner {
    display: flex; align-items: center; gap: 10px;
    background: var(--yw-bg, rgba(255,200,0,.08));
    border: 1px solid var(--yw);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    color: var(--tx2);
    font-size: 0.85rem;
  }
  .deadline-banner svg { color: var(--yw); flex-shrink: 0; }
  .deadline-banner strong { color: var(--tx); }
  .deadline-go { margin-left: auto; flex-shrink: 0; }

  .dash-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .dash-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    overflow: visible;
    box-sizing: border-box;
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .note-rows, .task-rows, .journal-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow: hidden;
  }

  .note-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background var(--transition);
  }
  .note-row:hover { background: var(--sf2); }
  .note-row-title { font-size: 0.875rem; color: var(--tx); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .note-row-time { flex-shrink: 0; margin-left: 8px; }

  .task-progress { display: flex; align-items: center; gap: 10px; }
  .task-progress-bar { flex: 1; height: 5px; background: var(--sf3); border-radius: 3px; overflow: hidden; }
  .task-progress-fill { height: 100%; background: var(--gn); border-radius: 3px; transition: width 0.4s ease; }

  .task-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 4px;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }
  .task-row input[type="checkbox"] {
    accent-color: var(--ac);
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    margin: 0;
  }
  .task-row-text { font-size: 0.875rem; color: var(--tx); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .task-row-text.done { text-decoration: line-through; color: var(--mu); }

  .priority-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  }
  .priority-high { background: var(--rd); }
  .priority-medium { background: var(--yw); }
  .priority-low { background: var(--gn); }

  .journal-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 4px;
    border-bottom: 1px solid var(--bd);
  }
  .journal-row:last-child { border-bottom: none; }

  /* ── F4k Recent files ──────────────────────────────────────────── */
  .recent-files-rows { display: flex; flex-direction: column; }
  .recent-file-row {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 4px; border-bottom: 1px solid var(--bd);
    background: none; border-left: none; border-right: none; border-top: none;
    cursor: pointer; text-align: left; width: 100%;
    transition: background var(--transition);
  }
  .recent-file-row:last-child { border-bottom: none; }
  .recent-file-row:hover { background: var(--sf2); }
  .recent-file-icon { flex-shrink: 0; display: flex; align-items: center; }
  .recent-file-name { flex: 1; min-width: 0; font-size: 0.82rem; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .recent-file-time { flex-shrink: 0; }

  .enzo-card { background: var(--enzo-bg); border-color: var(--enzo-bd); }

  .prompt-chips {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .prompt-chip {
    background: var(--sf);
    border: 1px solid var(--enzo-bd);
    border-radius: var(--radius-sm);
    color: var(--tx2);
    font-size: 0.8rem;
    padding: 7px 12px;
    text-align: left;
    cursor: pointer;
    transition: border-color var(--transition), background var(--transition);
  }
  .prompt-chip:hover { border-color: var(--enzo); background: var(--enzo-bg); color: var(--enzo); }

  .empty { padding: 8px 4px; }
  .example-row { opacity: 0.6; pointer-events: none; }
  .example-mu { font-size: 0.68rem; color: var(--mu); margin-left: 4px; letter-spacing: 0.04em; }

  /* Grant countdown */
  .grant-rows { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .grant-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 6px;
    border-radius: var(--radius-sm);
  }
  .grant-row:not(.example-row):hover { background: var(--sf2); }
  .grant-title {
    font-size: 0.84rem;
    color: var(--tx);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .grant-row-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .days-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 10px;
    flex-shrink: 0;
    letter-spacing: 0.02em;
  }
  .days-badge-red    { background: var(--rd-bg); color: var(--rd); }
  .days-badge-yellow { background: var(--yw-bg); color: var(--yw); }
  .days-badge-green  { background: var(--gn-bg); color: var(--gn); }

  /* Pinned papers */
  .pinned-section { display: flex; flex-direction: column; gap: 10px; }
  .pin-count {
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--enzo-bg); color: var(--enzo); border: 1px solid var(--enzo-bd);
    font-size: 0.68rem; font-weight: 700;
    width: 18px; height: 18px; border-radius: 50%;
    margin-left: 6px; vertical-align: 1px;
  }
  .pinned-list { display: flex; flex-direction: column; gap: 6px; }
  .pinned-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    background: var(--sf2);
    min-width: 0;
  }
  .pinned-row:hover { border-color: var(--enzo-bd); background: var(--enzo-bg); }
  .pinned-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .pinned-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--tx);
    line-height: 1.4;
    text-decoration: none;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pinned-title:hover { color: var(--ac); text-decoration: underline; }
  .pinned-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .source-badge {
    font-size: 0.65rem; font-weight: 700; padding: 1px 6px; border-radius: 10px;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .source-pubmed  { background: var(--ac-bg);   color: var(--ac);   }
  .source-biorxiv { background: var(--gn-bg);   color: var(--gn);   }
  .source-medrxiv { background: var(--gn-bg);   color: var(--gn);   }
  .source-nature  { background: var(--enzo-bg); color: var(--enzo); }
  .source-cell    { background: var(--rd-bg);   color: var(--rd);   }
  .unpin-btn { flex-shrink: 0; opacity: 0.4; margin-top: 1px; }
  .pinned-row:hover .unpin-btn { opacity: 1; }
  .unpin-btn:hover { color: var(--rd); background: var(--rd-bg); opacity: 1; }

  /* ── Analytics strip ── */
  .analytics-strip {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    gap: 12px;
    align-items: stretch;
  }

  .analytics-card {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ac-head { display: flex; align-items: center; justify-content: space-between; }
  .ac-label { font-size: 0.78rem; font-weight: 700; color: var(--tx); }
  .ac-sub   { font-size: 0.68rem; color: var(--mu); }

  .heatmap-svg { display: block; }
  .heatmap-legend {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.65rem; color: var(--mu);
  }
  .hm-box { width: 10px; height: 10px; border-radius: 2px; }

  :global(.dashboard) { --gn-muted: rgba(34,197,94,0.35); --sf3: var(--sf2); }

  /* ── Bar chart ── */
  .bar-chart {
    flex: 1; display: flex; align-items: flex-end; gap: 5px;
    height: 80px; padding-bottom: 4px;
  }
  .bar-col { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; }
  .bar { width: 100%; border-radius: 2px 2px 0 0; transition: height 0.3s ease; }
  .bar-label { font-size: 0.55rem; color: var(--mu); }
  .ac-total { display: flex; align-items: baseline; gap: 4px; }
  .ac-num { font-size: 1.4rem; font-weight: 800; color: var(--tx); letter-spacing: -0.03em; }
  .ac-unit { font-size: 0.72rem; color: var(--mu); }

  /* ── Publication impact ── */
  .pub-card { cursor: default; }
  .pub-loading { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--mu); }
  .pub-stats { display: flex; align-items: center; gap: 0; flex: 1; }
  .pub-stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .pub-val { font-size: 1.6rem; font-weight: 800; color: var(--tx); letter-spacing: -0.03em; }
  .pub-key { font-size: 0.68rem; color: var(--mu); }
  .pub-divider { width: 1px; height: 40px; background: var(--bd); }
  .fetch-pub-btn {
    font-size: 0.8rem; color: var(--ac); background: transparent; border: none;
    cursor: pointer; font-family: var(--font); padding: 0; text-align: left;
  }
  .fetch-pub-btn:hover { text-decoration: underline; }
  .pub-no-orcid { line-height: 1.5; }

  /* ── Daily focus ── */
  .daily-focus {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .df-head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .df-label {
    font-size: 0.78rem; font-weight: 700; color: var(--tx);
    display: block;
  }
  .df-date { display: block; }
  .df-journal-btn {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.78rem; font-weight: 600;
    background: var(--enzo-bg); color: var(--enzo);
    border: 1px solid var(--enzo-bd); border-radius: 20px;
    padding: 4px 12px; cursor: pointer;
    white-space: nowrap; flex-shrink: 0;
    transition: opacity var(--transition);
    font-family: var(--font);
  }
  .df-journal-btn:hover { opacity: 0.8; }
  .df-done {
    display: flex; align-items: center; gap: 5px;
    color: var(--gn); flex-shrink: 0;
  }
  .df-body { display: flex; gap: 20px; flex-wrap: wrap; }
  .df-tasks { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 5px; }
  .df-task { display: flex; align-items: center; gap: 8px; }
  .df-priority { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .df-high   { background: var(--rd); }
  .df-medium { background: var(--yw); }
  .df-low    { background: var(--gn); }
  .df-task-text { font-size: 0.84rem; color: var(--tx); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .df-more {
    font-size: 0.75rem; color: var(--ac); background: transparent; border: none;
    cursor: pointer; font-family: var(--font); padding: 2px 0; text-align: left;
  }
  .df-deadlines {
    display: flex; flex-direction: column; gap: 5px;
    min-width: 140px;
  }
  .df-dl { display: flex; align-items: center; gap: 6px; }

  @media (max-width: 900px) {
    .stats-row { grid-template-columns: repeat(3, 1fr); }
    .analytics-strip { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 680px) {
    .stats-row { grid-template-columns: repeat(2, 1fr); }
    .dash-grid { grid-template-columns: 1fr; }
    .analytics-strip { grid-template-columns: 1fr; }
  }
  @media (max-width: 540px) {
    .stats-row { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .stat-card { padding: 10px 12px; }
    .stat-val { font-size: 1.4rem; }
  }
</style>
