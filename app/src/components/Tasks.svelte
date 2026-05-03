<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { Task } from '../lib/types';
  import { exportTasks } from '../lib/export';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let newText = $state('');
  let newPriority = $state<Task['priority']>('medium');
  let newDue = $state('');
  let filter = $state<'all' | 'open' | 'done'>('open');
  let saving = $state(false);

  const filtered = $derived(
    [...store.tasks]
      .filter(t => {
        if (filter === 'open') return !t.done;
        if (filter === 'done') return t.done;
        return true;
      })
      .sort((a, b) => {
        if (a.done && !b.done) return 1;
        if (!a.done && b.done) return -1;
        const p = { high: 0, medium: 1, low: 2 };
        if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority];
        return b.createdAt - a.createdAt;
      })
  );

  async function addTask() {
    if (!newText.trim()) return;
    saving = true;
    try {
      store.tasks = [{
        id: nanoid(),
        text: newText.trim(),
        done: false,
        noteId: null,
        createdAt: Date.now(),
        dueAt: newDue ? new Date(newDue).getTime() : null,
        priority: newPriority
      }, ...store.tasks];
      await store.saveTasks();
      newText = '';
      newDue = '';
      newPriority = 'medium';
      showToast('Task added');
    } finally {
      saving = false;
    }
  }

  async function toggleTask(task: Task) {
    task.done = !task.done;
    await store.saveTasks();
  }

  async function deleteTask(id: string) {
    store.tasks = store.tasks.filter(t => t.id !== id);
    await store.saveTasks();
    showToast('Task removed');
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter') addTask();
  }

  function fmtDue(ts: number): string {
    const d = new Date(ts);
    const diff = d.getTime() - Date.now();
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return `Overdue by ${Math.abs(days)}d`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days}d`;
  }

  const openCount = $derived(store.tasks.filter(t => !t.done).length);
  const doneCount = $derived(store.tasks.filter(t => t.done).length);
</script>

<div class="tasks">
  <div class="tasks-header">
    <div>
      <h2>Tasks</h2>
      <p class="text-sm text-mu">{openCount} open · {doneCount} done</p>
    </div>
    {#if store.tasks.length > 0}
      <button class="btn btn-ghost btn-sm" onclick={() => exportTasks(store.tasks)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export
      </button>
    {/if}
  </div>

  <!-- Add task -->
  <div class="add-task-row card">
    <input
      type="text"
      bind:value={newText}
      onkeydown={handleKey}
      placeholder="New task..."
      class="task-input"
    />
    <div class="add-meta">
      <select bind:value={newPriority} class="priority-select">
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <input type="date" bind:value={newDue} class="due-input" />
      <button class="btn btn-primary btn-sm" onclick={addTask} disabled={saving || !newText.trim()}>Add</button>
    </div>
  </div>

  <!-- Filter tabs -->
  <div class="filter-tabs">
    {#each (['all', 'open', 'done'] as const) as f}
      <button class="filter-tab" class:active={filter === f} onclick={() => filter = f}>
        {f.charAt(0).toUpperCase() + f.slice(1)}
      </button>
    {/each}
  </div>

  <!-- Task list -->
  <div class="task-list">
    {#each filtered as task (task.id)}
      <div class="task-row" class:done={task.done}>
        <input
          type="checkbox"
          checked={task.done}
          onchange={() => toggleTask(task)}
          class="task-check"
        />
        <div class="task-content">
          <span class="task-text">{task.text}</span>
          <div class="task-sub">
            <span class="priority-badge priority-{task.priority}">{task.priority}</span>
            {#if task.dueAt}
              <span class="due-badge" class:overdue={task.dueAt < Date.now() && !task.done}>
                {fmtDue(task.dueAt)}
              </span>
            {/if}
            {#if task.noteId}
              <button
                class="note-link text-xs"
                onclick={() => { store.currentNoteId = task.noteId; store.view = 'notes'; }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                From note
              </button>
            {/if}
          </div>
        </div>
        <button class="btn-icon task-del" onclick={() => deleteTask(task.id)} title="Remove">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    {:else}
      <div class="empty-state">
        <p class="text-mu">
          {filter === 'done' ? 'No completed tasks yet.' : 'No tasks. Add one above, or write - [ ] in any note.'}
        </p>
      </div>
    {/each}
  </div>
</div>

<style>
  .tasks {
    height: 100%;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .tasks-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .tasks-header h2 { margin-bottom: 2px; }

  .add-task-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .add-meta { display: flex; gap: 8px; align-items: center; }
  .task-input { font-size: 0.9rem; }
  .priority-select { width: auto; flex-shrink: 0; font-size: 0.82rem; }
  .due-input { width: auto; flex-shrink: 0; font-size: 0.82rem; }

  .filter-tabs { display: flex; gap: 4px; }
  .filter-tab {
    padding: 5px 14px;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 500;
    background: transparent;
    color: var(--mu);
    border: 1px solid var(--bd);
    cursor: pointer;
    transition: all var(--transition);
  }
  .filter-tab.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }

  .task-list { display: flex; flex-direction: column; gap: 4px; }

  .task-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bd);
    background: var(--sf);
    transition: opacity var(--transition);
  }
  .task-row.done { opacity: 0.55; }
  .task-row:hover { border-color: var(--bd2); }

  .task-check { accent-color: var(--ac); margin-top: 3px; flex-shrink: 0; }
  .task-content { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .task-text { font-size: 0.9rem; color: var(--tx); word-break: break-word; }
  .task-row.done .task-text { text-decoration: line-through; color: var(--mu); }
  .task-sub { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .priority-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 10px;
    text-transform: capitalize;
  }
  .priority-high { background: var(--rd-bg); color: var(--rd); }
  .priority-medium { background: var(--yw-bg); color: var(--yw); }
  .priority-low { background: var(--gn-bg); color: var(--gn); }

  .due-badge { font-size: 0.72rem; color: var(--mu); }
  .due-badge.overdue { color: var(--rd); font-weight: 600; }

  .note-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--ac);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.72rem;
    padding: 0;
    font-family: var(--font);
  }
  .note-link:hover { text-decoration: underline; }

  .task-del { opacity: 0.4; transition: opacity var(--transition), color var(--transition), background var(--transition); flex-shrink: 0; margin-top: 1px; }
  .task-row:hover .task-del { opacity: 1; }
  .task-del:hover { color: var(--rd); background: var(--rd-bg); opacity: 1; }

  .empty-state { padding: 40px; text-align: center; }
</style>
