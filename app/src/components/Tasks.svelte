<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { Task, SubTask } from '../lib/types';
  import { exportTasks } from '../lib/export';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  const PREDEFINED_TAGS = ['wet-lab', 'analysis', 'writing', 'grant', 'meeting', 'review', 'data', 'collaboration'];

  const EXAMPLE_TASKS: Task[] = [
    { id: '_et1', text: 'Run NicheNet ligand-receptor analysis on macrophage–T cell interactions', done: false, noteId: null, createdAt: Date.now() - 86400000, dueAt: Date.now() + 172800000, priority: 'high', tags: ['analysis'] },
    { id: '_et2', text: 'Validate FOLR1 expression by multiplex IF on FFPE sections (n=6)', done: false, noteId: null, createdAt: Date.now() - 172800000, dueAt: Date.now() + 432000000, priority: 'medium', tags: ['wet-lab'] },
    { id: '_et3', text: 'Review cell2location output — check mean_cell_abundance thresholds', done: false, noteId: null, createdAt: Date.now() - 259200000, dueAt: null, priority: 'medium', tags: ['analysis', 'review'] },
    { id: '_et4', text: 'Submit first draft of revisions to Nature Cancer', done: true, noteId: null, createdAt: Date.now() - 432000000, dueAt: null, priority: 'high', tags: ['writing'] },
  ];

  // ── Add form state ──
  let newText = $state('');
  let newPriority = $state<Task['priority']>('medium');
  let newDue = $state('');
  let newRepeat = $state<Task['repeat']>(undefined);
  let newTags = $state<string[]>([]);
  let newNoteId = $state<string | null>(null);
  let newTagInput = $state('');
  let saving = $state(false);

  // ── Filter / search state ──
  let filter = $state<'all' | 'open' | 'done'>('open');
  let searchQuery = $state('');
  let tagFilter = $state<string>('');

  // ── Inline edit state ──
  let editingId = $state<string | null>(null);
  let editingText = $state('');

  // ── Subtask expand state ──
  let expandedIds = $state<Set<string>>(new Set());
  let newSubtaskText = $state<Record<string, string>>({});

  const filtered = $derived(
    [...store.tasks]
      .filter(t => {
        if (filter === 'open') return !t.done;
        if (filter === 'done') return t.done;
        return true;
      })
      .filter(t => !searchQuery.trim() || t.text.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(t => !tagFilter || (t.tags ?? []).includes(tagFilter))
      .sort((a, b) => {
        if (a.done && !b.done) return 1;
        if (!a.done && b.done) return -1;
        const p = { high: 0, medium: 1, low: 2 };
        if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority];
        return b.createdAt - a.createdAt;
      })
  );

  const allUsedTags = $derived(
    [...new Set(store.tasks.flatMap(t => t.tags ?? []))]
  );

  async function addTask() {
    if (!newText.trim()) return;
    saving = true;
    try {
      store.tasks = [{
        id: nanoid(),
        text: newText.trim(),
        done: false,
        noteId: newNoteId,
        createdAt: Date.now(),
        dueAt: newDue ? new Date(newDue).getTime() : null,
        priority: newPriority,
        repeat: newRepeat,
        tags: newTags.length ? [...newTags] : undefined,
        subtasks: [],
      }, ...store.tasks];
      await store.saveTasks();
      newText = '';
      newDue = '';
      newPriority = 'medium';
      newRepeat = undefined;
      newTags = [];
      newNoteId = null;
      newTagInput = '';
      showToast('Task added');
    } finally {
      saving = false;
    }
  }

  function nextDueDate(task: Task): number | null {
    if (!task.dueAt || !task.repeat) return null;
    const ms = { daily: 86400000, weekly: 7 * 86400000, monthly: 30 * 86400000 }[task.repeat];
    return task.dueAt + ms;
  }

  async function toggleTask(task: Task) {
    task.done = !task.done;
    if (task.done && task.repeat) {
      const next: Task = {
        id: nanoid(),
        text: task.text,
        done: false,
        noteId: task.noteId,
        createdAt: Date.now(),
        dueAt: nextDueDate(task),
        priority: task.priority,
        repeat: task.repeat,
        tags: task.tags,
        subtasks: [],
      };
      store.tasks = [next, ...store.tasks];
    }
    await store.saveTasks();
  }

  async function toggleSubtask(task: Task, sub: SubTask) {
    sub.done = !sub.done;
    const allDone = (task.subtasks ?? []).every(s => s.done);
    if (allDone && (task.subtasks ?? []).length > 0) {
      task.done = true;
    }
    await store.saveTasks();
  }

  async function addSubtask(task: Task) {
    const text = (newSubtaskText[task.id] ?? '').trim();
    if (!text) return;
    if (!task.subtasks) task.subtasks = [];
    task.subtasks = [...task.subtasks, { id: nanoid(), text, done: false }];
    newSubtaskText = { ...newSubtaskText, [task.id]: '' };
    await store.saveTasks();
  }

  async function deleteSubtask(task: Task, subId: string) {
    task.subtasks = (task.subtasks ?? []).filter(s => s.id !== subId);
    await store.saveTasks();
  }

  async function deleteTask(id: string) {
    store.tasks = store.tasks.filter(t => t.id !== id);
    await store.saveTasks();
    showToast('Task removed');
  }

  function startEdit(task: Task) {
    editingId = task.id;
    editingText = task.text;
  }

  async function commitEdit(task: Task) {
    if (!editingText.trim()) { editingId = null; return; }
    task.text = editingText.trim();
    editingId = null;
    await store.saveTasks();
  }

  function cancelEdit() { editingId = null; }

  function handleEditKey(e: KeyboardEvent, task: Task) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(task); }
    if (e.key === 'Escape') cancelEdit();
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter') addTask();
  }

  function toggleTagOnNew(tag: string) {
    if (newTags.includes(tag)) newTags = newTags.filter(t => t !== tag);
    else newTags = [...newTags, tag];
  }

  function addCustomTag() {
    const t = newTagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !newTags.includes(t)) newTags = [...newTags, t];
    newTagInput = '';
  }

  function handleTagInputKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCustomTag(); }
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds = next;
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

  function subtaskProgress(task: Task): string | null {
    const subs = task.subtasks ?? [];
    if (!subs.length) return null;
    const done = subs.filter(s => s.done).length;
    return `${done}/${subs.length}`;
  }

  const openCount = $derived(store.tasks.filter(t => !t.done).length);
  const doneCount = $derived(store.tasks.filter(t => t.done).length);
  const totalCount = $derived(openCount + doneCount);
  const progressPct = $derived(totalCount ? Math.round((doneCount / totalCount) * 100) : 0);
</script>

<div class="tasks">
  <div class="tasks-header">
    <div>
      <h2>Tasks</h2>
      <p class="text-sm text-mu">{openCount} open · {doneCount} done</p>
    </div>
    {#if store.tasks.length > 0}
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" onclick={() => exportTasks(store.tasks)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-ghost btn-sm" onclick={() => {
          const open = store.tasks.filter(t => !t.done).map(t => `☐ ${t.text}`).join('\n');
          const done = store.tasks.filter(t => t.done).map(t => `☑ ${t.text}`).join('\n');
          store.openCompose({ subject: 'Task list', body: `Open tasks:\n${open || '(none)'}\n\nCompleted:\n${done || '(none)'}` });
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Email
        </button>
      </div>
    {/if}
  </div>

  <!-- Progress bar -->
  {#if totalCount > 0}
    <div class="progress-wrap">
      <div class="progress-track">
        <div class="progress-fill-tasks" style="width: {progressPct}%"></div>
      </div>
      <span class="progress-label">{progressPct}%</span>
    </div>
  {/if}

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
      <select bind:value={newPriority} class="meta-select">
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <input type="date" bind:value={newDue} class="meta-date" />
      <select bind:value={newRepeat} class="meta-select" title="Repeat">
        <option value={undefined}>No repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      {#if store.notes.length > 0}
        <select bind:value={newNoteId} class="meta-select" title="Link to note">
          <option value={null}>— note —</option>
          {#each store.notes as n (n.id)}
            <option value={n.id}>{n.title || 'Untitled'}</option>
          {/each}
        </select>
      {/if}
      <button class="btn btn-primary btn-sm" onclick={addTask} disabled={saving || !newText.trim()}>Add</button>
    </div>
    <!-- Tag picker -->
    <div class="tag-picker">
      {#each PREDEFINED_TAGS as tag}
        <button
          class="tag-pill"
          class:active={newTags.includes(tag)}
          onclick={() => toggleTagOnNew(tag)}
          type="button"
        >{tag}</button>
      {/each}
      <input
        type="text"
        bind:value={newTagInput}
        onkeydown={handleTagInputKey}
        placeholder="custom tag…"
        class="tag-custom-input"
      />
    </div>
    {#if newTags.length}
      <div class="new-tags-row">
        {#each newTags as t}
          <span class="task-tag">
            {t}
            <button class="tag-remove" onclick={() => newTags = newTags.filter(x => x !== t)}>×</button>
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Search -->
  <div class="search-row">
    <div class="search-wrap">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search tasks…"
        class="search-input"
      />
      {#if searchQuery}
        <button class="search-clear" onclick={() => searchQuery = ''}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      {/if}
    </div>
    {#if searchQuery && filtered.length !== store.tasks.length}
      <span class="search-count text-xs text-mu">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
    {/if}
  </div>

  <!-- Filter tabs + tag filter -->
  <div class="filter-bar">
    <div class="filter-tabs">
      {#each (['all', 'open', 'done'] as const) as f}
        <button class="filter-tab" class:active={filter === f} onclick={() => filter = f}>
          {f.charAt(0).toUpperCase() + f.slice(1)}
        </button>
      {/each}
    </div>
    {#if allUsedTags.length > 0}
      <div class="tag-filters">
        <button class="tag-filter-pill" class:active={tagFilter === ''} onclick={() => tagFilter = ''}>All</button>
        {#each allUsedTags as tag}
          <button class="tag-filter-pill" class:active={tagFilter === tag} onclick={() => tagFilter = tagFilter === tag ? '' : tag}>{tag}</button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Task list -->
  <div class="task-list">
    {#each filtered as task (task.id)}
      {@const subProg = subtaskProgress(task)}
      {@const isExpanded = expandedIds.has(task.id)}
      <div class="task-row" class:done={task.done}>
        <input
          type="checkbox"
          checked={task.done}
          onchange={() => toggleTask(task)}
          class="task-check"
        />
        <div class="task-content">
          {#if editingId === task.id}
            <input
              type="text"
              bind:value={editingText}
              onkeydown={(e) => handleEditKey(e, task)}
              onblur={() => commitEdit(task)}
              class="task-edit-input"
              autofocus
            />
          {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              class="task-text"
              ondblclick={() => startEdit(task)}
              title="Double-click to edit"
            >{task.text}</span>
          {/if}
          <div class="task-sub">
            <span class="priority-badge priority-{task.priority}">{task.priority}</span>
            {#if task.repeat}
              <span class="repeat-badge">↻ {task.repeat}</span>
            {/if}
            {#if task.dueAt}
              <span class="due-badge" class:overdue={task.dueAt < Date.now() && !task.done}>
                {fmtDue(task.dueAt)}
              </span>
            {/if}
            {#each (task.tags ?? []) as tag}
              <span class="task-tag">{tag}</span>
            {/each}
            {#if subProg}
              <span class="subtask-prog">{subProg}</span>
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

          <!-- Subtasks -->
          {#if isExpanded}
            <div class="subtask-list">
              {#each (task.subtasks ?? []) as sub (sub.id)}
                <div class="subtask-row">
                  <input
                    type="checkbox"
                    checked={sub.done}
                    onchange={() => toggleSubtask(task, sub)}
                    class="task-check"
                  />
                  <span class="subtask-text" class:done={sub.done}>{sub.text}</span>
                  <button class="btn-icon subtask-del" onclick={() => deleteSubtask(task, sub.id)} title="Remove">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              {/each}
              <div class="subtask-add-row">
                <input
                  type="text"
                  bind:value={newSubtaskText[task.id]}
                  placeholder="Add subtask…"
                  class="subtask-input"
                  onkeydown={(e) => { if (e.key === 'Enter') addSubtask(task); }}
                />
                <button class="btn btn-ghost btn-sm" onclick={() => addSubtask(task)}>Add</button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Row actions -->
        <div class="task-actions">
          {#if editingId !== task.id}
            <button class="btn-icon task-edit" onclick={() => startEdit(task)} title="Edit">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          {/if}
          <button
            class="btn-icon subtask-toggle"
            class:expanded={isExpanded}
            onclick={() => toggleExpand(task.id)}
            title="Subtasks"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="btn-icon task-del" onclick={() => deleteTask(task.id)} title="Remove">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    {:else}
      {#if store.tasks.length === 0 && filter !== 'done' && !searchQuery && !tagFilter}
        {#each EXAMPLE_TASKS.filter(t => filter === 'all' || !t.done) as task (task.id)}
          <div class="task-row example-task">
            <input type="checkbox" checked={task.done} disabled class="task-check" />
            <div class="task-content">
              <span class="task-text" class:done={task.done}>{task.text}</span>
              <div class="task-sub">
                <span class="priority-badge priority-{task.priority}">{task.priority}</span>
                {#each (task.tags ?? []) as tag}
                  <span class="task-tag">{tag}</span>
                {/each}
                {#if task.dueAt}
                  <span class="due-badge">{fmtDue(task.dueAt)}</span>
                {/if}
                <span class="example-label">· example</span>
              </div>
            </div>
          </div>
        {/each}
      {:else}
        <div class="empty-state">
          <p class="text-mu">
            {#if searchQuery}No tasks match "{searchQuery}".
            {:else if tagFilter}No {filter === 'done' ? 'completed' : 'open'} tasks tagged "{tagFilter}".
            {:else if filter === 'done'}No completed tasks yet.
            {:else}No tasks. Add one above, or write - [ ] in any note.{/if}
          </p>
        </div>
      {/if}
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
    gap: 14px;
  }

  .tasks-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .tasks-header h2 { margin-bottom: 2px; }
  .header-actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }

  /* Progress bar */
  .progress-wrap { display: flex; align-items: center; gap: 10px; }
  .progress-track {
    flex: 1;
    height: 4px;
    background: var(--bd);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill-tasks {
    height: 100%;
    background: linear-gradient(90deg, var(--ac), var(--gn));
    border-radius: 2px;
    transition: width 0.4s ease;
  }
  .progress-label { font-size: 0.72rem; color: var(--mu); flex-shrink: 0; min-width: 28px; text-align: right; }

  /* Add form */
  .add-task-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .add-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .task-input { font-size: 0.9rem; }
  .meta-select { width: auto; flex-shrink: 0; font-size: 0.82rem; }
  .meta-date { width: auto; flex-shrink: 0; font-size: 0.82rem; }

  /* Tag picker */
  .tag-picker { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .tag-pill {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--bd);
    background: transparent;
    color: var(--mu);
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
  }
  .tag-pill.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .tag-pill:hover:not(.active) { border-color: var(--bd2); color: var(--tx2); }
  .tag-custom-input {
    width: 110px !important;
    font-size: 0.72rem !important;
    padding: 2px 8px !important;
    height: auto !important;
    min-height: unset !important;
  }
  .new-tags-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .task-tag {
    font-size: 0.68rem;
    padding: 1px 7px;
    border-radius: 10px;
    background: var(--ac-bg);
    color: var(--ac);
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .tag-remove {
    background: none;
    border: none;
    color: var(--ac);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
    line-height: 1;
  }

  /* Search */
  .search-row { display: flex; align-items: center; gap: 8px; }
  .search-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-icon { position: absolute; left: 10px; color: var(--mu); pointer-events: none; flex-shrink: 0; }
  .search-input {
    padding-left: 30px !important;
    font-size: 0.85rem !important;
  }
  .search-clear {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    color: var(--mu);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
  }
  .search-clear:hover { color: var(--tx); }
  .search-count { flex-shrink: 0; }

  /* Filter bar */
  .filter-bar { display: flex; flex-direction: column; gap: 8px; }
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
  .tag-filters { display: flex; flex-wrap: wrap; gap: 4px; }
  .tag-filter-pill {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--bd);
    background: transparent;
    color: var(--mu);
    cursor: pointer;
    transition: all var(--transition);
  }
  .tag-filter-pill.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }

  /* Task list */
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

  .task-check { accent-color: var(--ac); margin-top: 2px; flex-shrink: 0; }
  .task-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .task-text {
    font-size: 0.9rem;
    color: var(--tx);
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.45;
    display: block;
    cursor: default;
  }
  .task-text:hover { color: var(--ac); }
  .task-row.done .task-text { text-decoration: line-through; color: var(--mu); }
  .task-edit-input { font-size: 0.9rem !important; padding: 2px 6px !important; }
  .task-sub { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  /* Badges */
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
  .repeat-badge { font-size: 0.68rem; color: var(--gn); font-weight: 600; background: var(--gn-bg, color-mix(in srgb, var(--gn) 12%, transparent)); border-radius: 8px; padding: 1px 6px; }
  .subtask-prog { font-size: 0.68rem; color: var(--mu); background: var(--sf2); border-radius: 8px; padding: 1px 6px; }

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

  /* Row actions */
  .task-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; margin-top: 1px; }
  .task-edit { opacity: 0; transition: opacity var(--transition); }
  .task-row:hover .task-edit { opacity: 0.5; }
  .task-edit:hover { opacity: 1 !important; }
  .subtask-toggle { opacity: 0.3; transition: opacity var(--transition), transform var(--transition); }
  .subtask-toggle:hover { opacity: 1; }
  .subtask-toggle.expanded { transform: rotate(180deg); opacity: 0.7; }
  .task-del { opacity: 0.3; transition: opacity var(--transition), color var(--transition), background var(--transition); }
  .task-row:hover .task-del { opacity: 0.6; }
  .task-del:hover { color: var(--rd); background: var(--rd-bg); opacity: 1; }

  /* Subtasks */
  .subtask-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
    padding-left: 4px;
    border-left: 2px solid var(--bd);
  }
  .subtask-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-radius: var(--radius-sm);
  }
  .subtask-row:hover { background: var(--sf2); }
  .subtask-text { font-size: 0.84rem; color: var(--tx2); flex: 1; min-width: 0; word-break: break-word; }
  .subtask-text.done { text-decoration: line-through; color: var(--mu); }
  .subtask-del { opacity: 0; padding: 3px; }
  .subtask-row:hover .subtask-del { opacity: 0.5; }
  .subtask-del:hover { opacity: 1 !important; color: var(--rd); }
  .subtask-add-row { display: flex; gap: 6px; align-items: center; margin-top: 2px; }
  .subtask-input { font-size: 0.82rem !important; padding: 4px 8px !important; }

  .empty-state { padding: 40px; text-align: center; }
  .example-task { opacity: 0.55; }
  .example-label { font-size: 0.68rem; color: var(--mu); letter-spacing: 0.04em; }

  /* Mobile */
  @media (max-width: 540px) {
    .tasks { padding: 16px; gap: 12px; }
    .add-meta { flex-wrap: wrap; }
    .meta-select, .meta-date { flex: 1; min-width: 100px; width: 100%; }
    .tag-pill { font-size: 0.68rem; padding: 3px 8px; }
    .tag-custom-input { width: 100% !important; }
    .filter-tab { flex: 1; text-align: center; }
    .task-edit { opacity: 0.4; }
    .tasks-header { flex-wrap: wrap; }
  }
</style>
