<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { Note } from '../lib/types';
  import { exportPapers } from '../lib/export';

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
    store.savedJobs.filter(j => j.status !== 'rejected' && j.status !== 'offer').length
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
              <input type="checkbox" checked={task.done} disabled={task.id.startsWith('_')} />
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
  .example-row { opacity: 0.72; pointer-events: none; }
  .example-mu { font-size: 0.68rem; color: var(--mu); margin-left: auto; letter-spacing: 0.04em; }

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

  @media (max-width: 900px) {
    .stats-row { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 680px) {
    .stats-row { grid-template-columns: repeat(2, 1fr); }
    .dash-grid { grid-template-columns: 1fr; }
  }
</style>
