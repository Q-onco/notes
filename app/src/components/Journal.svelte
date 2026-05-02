<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { JournalEntry } from '../lib/types';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let editingId = $state<string | null>(null);
  let draftBody = $state('');
  let draftMood = $state('');
  let draftTag = $state('');
  let saving = $state(false);
  let search = $state('');

  const MOODS = ['Focused', 'Curious', 'Frustrated', 'Energised', 'Tired', 'Inspired', 'Uncertain'];
  const CONTEXT_TAGS = ['Research', 'Writing', 'Analysis', 'Meeting', 'Experiment', 'Reading', 'Planning'];

  const sorted = $derived(
    [...store.journal]
      .filter(e => !search || e.body.toLowerCase().includes(search.toLowerCase()) || e.contextTag.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.createdAt - a.createdAt)
  );

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
    if (!draftBody.trim()) return;
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
</script>

<div class="journal">
  <!-- Header -->
  <div class="journal-header">
    <div>
      <h2>Journal</h2>
      <p class="text-sm text-mu">{store.journal.length} entries</p>
    </div>
    <div class="header-actions">
      <input type="search" bind:value={search} placeholder="Search entries..." class="search" />
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

      <textarea
        class="journal-textarea"
        bind:value={draftBody}
        placeholder="What happened today? What did you discover, struggle with, or learn? Write freely in Markdown."
        rows={8}
      ></textarea>

      <div class="form-actions">
        <button class="btn btn-ghost" onclick={() => editingId = null}>Cancel</button>
        <button class="btn btn-primary" onclick={save} disabled={saving || !draftBody.trim()}>
          {saving ? 'Saving...' : 'Save entry'}
        </button>
      </div>
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
          {@html DOMPurify.sanitize(marked.parse(entry.body) as string)}
        </div>
      </article>
    {:else}
      <div class="empty-state">
        <p class="text-mu">No journal entries yet. Start with how your research is going today.</p>
        <button class="btn btn-primary mt-3" onclick={startNew}>Write first entry</button>
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

  .journal-textarea {
    font-family: var(--mono);
    font-size: 0.9rem;
    min-height: 180px;
  }

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

  .empty-state {
    text-align: center;
    padding: 60px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
