<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { Note } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  const QUICK_PROMPTS = [
    'Summarise my latest note',
    'What tasks are pending?',
    'Suggest next analysis steps',
    'Draft an abstract for my current work',
    'What papers should I read this week?'
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
      </button>
      <button class="stat-card" onclick={() => store.view = 'journal'}>
        <span class="stat-value">{store.journal.length}</span>
        <span class="stat-label">Journal entries</span>
      </button>
      <button class="stat-card" onclick={() => store.view = 'tasks'}>
        <span class="stat-value">{store.activeTasks.length}</span>
        <span class="stat-label">Open tasks</span>
      </button>
      <button class="stat-card" onclick={() => store.view = 'audio'}>
        <span class="stat-value">{store.audioRecords.length}</span>
        <span class="stat-label">Recordings</span>
      </button>
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
          {#each store.recentNotes.slice(0, 5) as note}
            <button
              class="note-row"
              onclick={() => { store.currentNoteId = note.id; store.view = 'notes'; }}
            >
              <span class="note-row-title">{note.title || 'Untitled'}</span>
              <span class="note-row-time text-xs text-mu">{relTime(note.updatedAt)}</span>
            </button>
          {:else}
            <p class="empty text-sm text-mu">No notes yet. Create your first one.</p>
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
          {#each store.activeTasks.slice(0, 5) as task}
            <div class="task-row">
              <input
                type="checkbox"
                checked={task.done}
                onchange={async () => {
                  task.done = !task.done;
                  await store.saveTasks();
                  showToast('Task updated');
                }}
              />
              <span class="task-row-text" class:done={task.done}>{task.text}</span>
              <span class="priority-dot priority-{task.priority}"></span>
            </div>
          {:else}
            <p class="empty text-sm text-mu">No open tasks.</p>
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
          {#each recentJournal as entry}
            <div class="journal-row">
              <span class="journal-date text-xs text-mu">
                {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <span class="journal-body text-sm">{entry.body.slice(0, 80)}{entry.body.length > 80 ? '…' : ''}</span>
            </div>
          {:else}
            <p class="empty text-sm text-mu">No journal entries yet.</p>
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
          {#each QUICK_PROMPTS as prompt}
            <button class="prompt-chip" onclick={() => sendToEnzo(prompt)}>
              {prompt}
            </button>
          {/each}
        </div>
      </section>

    </div>
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
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
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
    overflow: hidden;
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
  }
  .task-row input { accent-color: var(--ac); flex-shrink: 0; }
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

  @media (max-width: 680px) {
    .stats-row { grid-template-columns: repeat(2, 1fr); }
    .dash-grid { grid-template-columns: 1fr; }
  }
</style>
