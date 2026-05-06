<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { assistManuscriptSection } from '../lib/groq';
  import { exportManuscriptPdf } from '../lib/export';
  import RichEditor from './RichEditor.svelte';
  import type { Manuscript, ManuscriptSection, ManuscriptStatus } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── State ─────────────────────────────────────────────────────
  let selectedId    = $state<string | null>(null);
  let selectedSecId = $state<string | null>(null);
  let newOpen       = $state(false);
  let saving        = $state(false);
  let saveTimer: ReturnType<typeof setTimeout>;

  // new manuscript form
  let newTitle   = $state('');
  let newJournal = $state('');
  let newAuthors = $state('');

  // Enzo assistance
  let enzoOpen    = $state(false);
  let enzoText    = $state('');
  let enzoLoading = $state(false);
  let enzoAbort   = $state<AbortController | null>(null);

  // Citation picker
  let citeOpen = $state(false);

  // Section add
  let addSecOpen = $state(false);
  let addSecType = $state<ManuscriptSection['type']>('custom');
  let addSecLabel = $state('');

  const ms = $derived(store.manuscripts.find(m => m.id === selectedId) ?? null);
  const sec = $derived(ms?.sections.find(s => s.id === selectedSecId) ?? null);

  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ');
  }

  const wordCount = $derived((() => {
    if (!sec) return 0;
    return stripHtml(sec.content).trim().split(/\s+/).filter(Boolean).length;
  })());

  const wcProgressPct = $derived((() => {
    if (!sec || sec.wordTarget <= 0) return 0;
    return Math.min(100, Math.round((wordCount / sec.wordTarget) * 100));
  })());

  const wcColor = $derived((() => {
    if (!sec || sec.wordTarget <= 0) return 'var(--mu)';
    if (wordCount > sec.wordTarget) return 'var(--rd, #ef4444)';
    if (wordCount > sec.wordTarget * 0.9) return 'var(--yw)';
    return 'var(--gn)';
  })());

  const totalWords = $derived((() => {
    if (!ms) return 0;
    return ms.sections.reduce((acc, s) => {
      return acc + stripHtml(s.content).trim().split(/\s+/).filter(Boolean).length;
    }, 0);
  })());

  const STATUS_LABELS: Record<ManuscriptStatus, string> = {
    drafting: 'Drafting', 'internal-review': 'Internal Review',
    submitted: 'Submitted', revisions: 'Revisions',
    accepted: 'Accepted', published: 'Published'
  };
  const STATUS_COLORS: Record<ManuscriptStatus, string> = {
    drafting: '#60a5fa', 'internal-review': '#a78bfa',
    submitted: '#f59e0b', revisions: '#fb923c',
    accepted: '#34d399', published: '#22c55e'
  };

  const DEFAULT_SECTIONS: { type: ManuscriptSection['type']; label: string }[] = [
    { type: 'abstract',      label: 'Abstract' },
    { type: 'introduction',  label: 'Introduction' },
    { type: 'methods',       label: 'Methods' },
    { type: 'results',       label: 'Results' },
    { type: 'discussion',    label: 'Discussion' },
    { type: 'conclusion',    label: 'Conclusion' },
  ];

  function createManuscript() {
    if (!newTitle.trim()) return;
    const m: Manuscript = {
      id: nanoid(), title: newTitle.trim(),
      targetJournal: newJournal.trim(),
      status: 'drafting',
      sections: DEFAULT_SECTIONS.map(s => ({
        id: nanoid(), type: s.type, label: s.label,
        content: '', wordTarget: 0, notes: ''
      })),
      authors: newAuthors.split(',').map(a => a.trim()).filter(Boolean),
      keywords: [], linkedNoteIds: [],
      submittedAt: null, acceptedAt: null, publishedAt: null,
      doi: '', notes: '',
      createdAt: Date.now(), updatedAt: Date.now()
    };
    store.manuscripts = [m, ...store.manuscripts];
    store.saveManuscripts();
    selectedId = m.id;
    selectedSecId = m.sections[0]?.id ?? null;
    newOpen = false;
    newTitle = ''; newJournal = ''; newAuthors = '';
  }

  function deleteManuscript(id: string) {
    if (!confirm('Delete this manuscript? This cannot be undone.')) return;
    store.manuscripts = store.manuscripts.filter(m => m.id !== id);
    if (selectedId === id) { selectedId = null; selectedSecId = null; }
    store.saveManuscripts();
  }

  function updateMs(patch: Partial<Manuscript>) {
    if (!ms) return;
    const updated = { ...ms, ...patch, updatedAt: Date.now() };
    store.manuscripts = store.manuscripts.map(m => m.id === ms.id ? updated : m);
    scheduleSave();
  }

  function updateSec(patch: Partial<ManuscriptSection>) {
    if (!ms || !sec) return;
    const updatedSections = ms.sections.map(s => s.id === sec.id ? { ...s, ...patch } : s);
    updateMs({ sections: updatedSections });
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saving = true;
      try { await store.saveManuscripts(); } catch { showToast('Save failed', 'error'); }
      saving = false;
    }, 1500);
  }

  function addSection() {
    if (!ms) return;
    const label = addSecLabel.trim() || addSecType;
    const s: ManuscriptSection = { id: nanoid(), type: addSecType, label, content: '', wordTarget: 0, notes: '' };
    updateMs({ sections: [...ms.sections, s] });
    selectedSecId = s.id;
    addSecOpen = false;
    addSecLabel = '';
    addSecType = 'custom';
  }

  function deleteSection(sid: string) {
    if (!ms) return;
    const updated = ms.sections.filter(s => s.id !== sid);
    updateMs({ sections: updated });
    if (selectedSecId === sid) selectedSecId = updated[0]?.id ?? null;
  }

  function moveSection(sid: string, dir: -1 | 1) {
    if (!ms) return;
    const idx = ms.sections.findIndex(s => s.id === sid);
    if (idx < 0) return;
    const ni = idx + dir;
    if (ni < 0 || ni >= ms.sections.length) return;
    const arr = [...ms.sections];
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    updateMs({ sections: arr });
  }

  async function runEnzo() {
    if (!ms || !sec || enzoLoading) return;
    enzoAbort?.abort();
    const ctrl = new AbortController();
    enzoAbort = ctrl;
    enzoOpen = true;
    enzoText = '';
    enzoLoading = true;
    const paperContext = store.readingList.slice(0, 8).map(r => r.paper.title).join('; ');
    try {
      await assistManuscriptSection(
        sec.type, sec.content.replace(/<[^>]*>/g, ' '),
        ms.title, ms.targetJournal, paperContext,
        chunk => { enzoText += chunk; },
        ctrl.signal
      );
    } catch (e: any) {
      if (e?.name !== 'AbortError') enzoText += '\n\n[Error]';
    }
    enzoLoading = false;
  }

  function insertCitation(paper: { authors: string[]; title: string; journal: string; year: number; doi: string }) {
    const a = paper.authors.slice(0, 3).map(n => {
      const p = n.trim().split(/\s+/); const last = p.pop() ?? '';
      return `${last} ${p.map(x => x[0]).join('')}`.trim();
    }).join(', ') + (paper.authors.length > 3 ? ' et al.' : '');
    const cite = `[${a}. ${paper.title}. ${paper.journal}. ${paper.year}${paper.doi ? ' doi:' + paper.doi : ''}]`;
    updateSec({ content: sec!.content + `<p>${cite}</p>` });
    citeOpen = false;
    showToast('Citation inserted');
  }

  function exportMarkdown() {
    if (!ms) return;
    const md = [`# ${ms.title}`, `**Journal:** ${ms.targetJournal}`, `**Authors:** ${ms.authors.join(', ')}`, '---',
      ...ms.sections.map(s => `## ${s.label}\n\n${s.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}`)
    ].join('\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${ms.title.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click(); URL.revokeObjectURL(url);
  }
</script>

<!-- ── New manuscript modal ─────────────────────────────────────── -->
{#if newOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ms-backdrop" onclick={() => newOpen = false}></div>
  <div class="ms-modal" role="dialog" aria-label="New manuscript">
    <h3 class="modal-title">New Manuscript</h3>
    <div class="field-row">
      <label>Title</label>
      <input class="field-input" bind:value={newTitle} placeholder="Manuscript title" />
    </div>
    <div class="field-row">
      <label>Target Journal</label>
      <input class="field-input" bind:value={newJournal} placeholder="e.g. Nature Cancer" />
    </div>
    <div class="field-row">
      <label>Authors (comma-separated)</label>
      <input class="field-input" bind:value={newAuthors} placeholder="e.g. Sathyanarayanan A, Müller J" />
    </div>
    <p class="hint-text">Sections (Abstract → Conclusion) will be pre-created. You can add or remove sections afterwards.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick={() => newOpen = false}>Cancel</button>
      <button class="btn btn-primary" onclick={createManuscript} disabled={!newTitle.trim()}>Create</button>
    </div>
  </div>
{/if}

<!-- ── Add section modal ────────────────────────────────────────── -->
{#if addSecOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ms-backdrop" onclick={() => addSecOpen = false}></div>
  <div class="ms-modal" role="dialog" aria-label="Add section">
    <h3 class="modal-title">Add Section</h3>
    <div class="field-row">
      <label>Type</label>
      <select class="field-input" bind:value={addSecType}>
        <option value="abstract">Abstract</option>
        <option value="introduction">Introduction</option>
        <option value="methods">Methods</option>
        <option value="results">Results</option>
        <option value="discussion">Discussion</option>
        <option value="conclusion">Conclusion</option>
        <option value="supplementary">Supplementary</option>
        <option value="custom">Custom</option>
      </select>
    </div>
    <div class="field-row">
      <label>Label (optional)</label>
      <input class="field-input" bind:value={addSecLabel} placeholder="Defaults to type name" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick={() => addSecOpen = false}>Cancel</button>
      <button class="btn btn-primary" onclick={addSection}>Add</button>
    </div>
  </div>
{/if}

<!-- ── Citation picker ──────────────────────────────────────────── -->
{#if citeOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ms-backdrop" onclick={() => citeOpen = false}></div>
  <div class="cite-modal" role="dialog" aria-label="Insert citation">
    <h3 class="modal-title">Insert Citation</h3>
    <div class="cite-list">
      {#each store.readingList as item (item.id)}
        <button class="cite-item" onclick={() => insertCitation(item.paper)}>
          <span class="cite-title">{item.paper.title}</span>
          <span class="cite-meta">{item.paper.authors[0] ? item.paper.authors[0] + ' et al.' : ''} · {item.paper.journal} {item.paper.year}</span>
        </button>
      {:else}
        <p class="empty-hint">No papers in reading list yet.</p>
      {/each}
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick={() => citeOpen = false}>Close</button>
    </div>
  </div>
{/if}

<div class="ms-shell">
  <!-- ── Left: manuscript list ─────────────────────────────────── -->
  <div class="ms-list-col">
    <div class="ms-list-head">
      <span class="col-label">Manuscripts</span>
      <button class="btn-icon" onclick={() => newOpen = true} title="New manuscript">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
    <div class="ms-list">
      {#each store.manuscripts as m (m.id)}
        <button
          class="ms-item"
          class:ms-item-active={selectedId === m.id}
          onclick={() => { selectedId = m.id; selectedSecId = m.sections[0]?.id ?? null; }}
        >
          <span class="ms-item-title">{m.title}</span>
          <span class="ms-item-meta">
            <span class="status-dot" style="background:{STATUS_COLORS[m.status]}"></span>
            {STATUS_LABELS[m.status]}
          </span>
        </button>
      {:else}
        <p class="empty-hint">No manuscripts yet.<br/>Press + to start writing.</p>
      {/each}
    </div>
  </div>

  <!-- ── Center: section list ──────────────────────────────────── -->
  {#if ms}
    <div class="sec-list-col">
      <div class="sec-list-head">
        <span class="col-label">Sections</span>
        <button class="btn-icon" onclick={() => addSecOpen = true} title="Add section">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <!-- manuscript meta -->
      <div class="ms-meta-strip">
        <div class="ms-meta-title">{ms.title}</div>
        {#if ms.targetJournal}
          <div class="ms-meta-journal">{ms.targetJournal}</div>
        {/if}
        <div class="ms-meta-row">
          <select
            class="status-select"
            value={ms.status}
            onchange={(e) => updateMs({ status: (e.target as HTMLSelectElement).value as ManuscriptStatus })}
          >
            {#each Object.entries(STATUS_LABELS) as [val, label]}
              <option value={val}>{label}</option>
            {/each}
          </select>
          <span class="ms-words">{totalWords.toLocaleString()} w</span>
        </div>
      </div>

      <div class="sec-list">
        {#each ms.sections as s (s.id)}
          <div class="sec-item" class:sec-item-active={selectedSecId === s.id}>
            <button class="sec-item-btn" onclick={() => selectedSecId = s.id}>
              <span class="sec-label">{s.label}</span>
              {#if s.content.length > 20}
                <span class="sec-wc">{s.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length}w</span>
              {/if}
            </button>
            <div class="sec-item-actions">
              <button class="sec-action" onclick={() => moveSection(s.id, -1)} title="Move up">↑</button>
              <button class="sec-action" onclick={() => moveSection(s.id, 1)} title="Move down">↓</button>
              <button class="sec-action sec-del" onclick={() => deleteSection(s.id)} title="Delete">×</button>
            </div>
          </div>
        {/each}
      </div>

      <div class="ms-list-footer">
        <button class="btn btn-ghost btn-sm" onclick={exportMarkdown} title="Export as Markdown">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-ghost btn-sm" onclick={() => exportManuscriptPdf(ms.title, ms.sections, ms.targetJournal)} title="Print / Save as PDF">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          PDF
        </button>
        <button class="btn btn-ghost btn-sm" onclick={() => {
          const body = ms.sections.map(s => `## ${s.label}\n\n${s.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}`).join('\n\n');
          store.openCompose({ subject: `Manuscript draft — ${ms.title}`, body: `${ms.title}\nTarget journal: ${ms.targetJournal || 'TBD'}\nStatus: ${ms.status}\n\n${body}` });
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Email
        </button>
        <button class="btn btn-ghost btn-sm del-ms-btn" onclick={() => deleteManuscript(ms.id)}>Delete</button>
      </div>
    </div>

    <!-- ── Right: editor + Enzo ───────────────────────────────── -->
    <div class="editor-col">
      {#if sec}
        <div class="editor-top-bar">
          <div class="editor-section-info">
            <span class="editor-sec-label">{sec.label}</span>
            {#if sec.wordTarget > 0}
              <span class="wc-target" class:wc-over={wordCount > sec.wordTarget}>
                {wordCount} / {sec.wordTarget} words
              </span>
            {:else}
              <span class="wc-count">{wordCount} words</span>
            {/if}
            {#if saving}<span class="saving-dot">saving…</span>{/if}
          </div>
          <div class="editor-toolbar">
            <input
              class="target-input"
              type="number"
              value={sec.wordTarget || ''}
              placeholder="Word target"
              min="0"
              oninput={(e) => updateSec({ wordTarget: parseInt((e.target as HTMLInputElement).value) || 0 })}
            />
            <button class="btn btn-sm btn-ghost" onclick={() => citeOpen = true} title="Insert citation">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M16 3h5v5M10 14L21 3"/></svg>
              Cite
            </button>
            <button class="btn btn-sm btn-enzo" onclick={runEnzo} disabled={enzoLoading}>
              <span class="enzo-dot-sm"></span>
              {enzoLoading ? 'Thinking…' : 'Ask Enzo'}
            </button>
            {#if enzoOpen}
              <button class="btn btn-sm btn-ghost" onclick={() => { enzoOpen = false; enzoAbort?.abort(); }}>
                Close Enzo
              </button>
            {/if}
          </div>
        </div>

        <div class="editor-body" class:editor-body-split={enzoOpen}>
          <div class="rich-wrap">
            <RichEditor
              value={sec.content}
              onchange={(v) => updateSec({ content: v })}
              placeholder={`Write your ${sec.label.toLowerCase()} here…`}
            />
            <div class="wc-bar">
              {#if sec.wordTarget > 0}
                <span class="wc-bar-count" style="color:{wcColor}">
                  {wordCount} / {sec.wordTarget} words
                </span>
                <div class="wc-progress-track">
                  <div
                    class="wc-progress-fill"
                    style="width:{wcProgressPct}%; background:{wcColor};"
                  ></div>
                </div>
              {:else}
                <span class="wc-bar-count">{wordCount} words</span>
              {/if}
            </div>
          </div>

          {#if enzoOpen}
            <div class="enzo-assist-panel">
              <div class="enzo-assist-head">
                <span class="enzo-assist-title">Enzo · {sec.label} assistance</span>
                <button class="btn-icon" onclick={() => { enzoOpen = false; enzoAbort?.abort(); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div class="enzo-assist-body">
                {#if enzoText}
                  <div class="enzo-assist-text">{enzoText}</div>
                {:else if enzoLoading}
                  <div class="enzo-pulse">Enzo is thinking…</div>
                {:else}
                  <div class="enzo-assist-empty">Click "Ask Enzo" to get section-specific writing guidance, critique, or suggestions tailored to your manuscript and target journal.</div>
                {/if}
              </div>
              {#if enzoText && !enzoLoading}
                <div class="enzo-assist-footer">
                  <button class="btn btn-sm btn-ghost" onclick={() => { navigator.clipboard.writeText(enzoText); showToast('Copied'); }}>Copy</button>
                  <button class="btn btn-sm btn-enzo" onclick={runEnzo}>Regenerate</button>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Section notes -->
        <div class="sec-notes-bar">
          <input
            class="sec-notes-input"
            type="text"
            placeholder="Section notes (e.g. TODO, reviewer comments)…"
            value={sec.notes}
            oninput={(e) => updateSec({ notes: (e.target as HTMLInputElement).value })}
          />
        </div>
      {:else}
        <div class="no-sec">Select a section to start writing.</div>
      {/if}
    </div>
  {:else}
    <div class="ms-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--mu)" stroke-width="1.2" opacity="0.4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      <p>Select a manuscript or create a new one to start writing.</p>
      <button class="btn btn-primary" onclick={() => newOpen = true}>New manuscript</button>
    </div>
  {/if}
</div>

<style>
  .ms-shell {
    display: flex;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
  }

  /* ── List columns ─────────────────────────────────────────────── */
  .ms-list-col {
    width: 200px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sec-list-col {
    width: 190px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ms-list-head, .sec-list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 8px;
    border-bottom: 1px solid var(--bd);
  }

  .col-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mu);
  }

  .ms-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }

  .ms-item {
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .ms-item:hover { background: var(--sf2); }
  .ms-item-active { background: var(--ac-bg) !important; }

  .ms-item-title {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--tx);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }

  .ms-item-meta {
    font-size: 0.7rem;
    color: var(--mu);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── Manuscript meta strip ────────────────────────────────────── */
  .ms-meta-strip {
    padding: 10px 10px 8px;
    border-bottom: 1px solid var(--bd);
  }

  .ms-meta-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--tx);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 2px;
  }

  .ms-meta-journal {
    font-size: 0.7rem;
    color: var(--mu);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 6px;
  }

  .ms-meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-select {
    font-size: 0.7rem;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    background: var(--sf2);
    border: 1px solid var(--bd);
    color: var(--tx);
    flex: 1;
  }

  .ms-words {
    font-size: 0.68rem;
    color: var(--mu);
    white-space: nowrap;
  }

  /* ── Section list ─────────────────────────────────────────────── */
  .sec-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }

  .sec-item {
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    transition: background var(--transition);
    margin-bottom: 1px;
  }
  .sec-item:hover { background: var(--sf2); }
  .sec-item-active { background: var(--ac-bg); }

  .sec-item-btn {
    flex: 1;
    padding: 6px 8px;
    text-align: left;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }

  .sec-label {
    font-size: 0.8rem;
    color: var(--tx);
    font-weight: 500;
  }

  .sec-wc {
    font-size: 0.65rem;
    color: var(--mu);
  }

  .sec-item-actions {
    display: none;
    gap: 1px;
    padding-right: 4px;
  }
  .sec-item:hover .sec-item-actions { display: flex; }

  .sec-action {
    width: 20px; height: 20px;
    font-size: 0.7rem;
    color: var(--mu);
    background: transparent;
    border-radius: 3px;
    display: flex; align-items: center; justify-content: center;
  }
  .sec-action:hover { background: var(--sf3); color: var(--tx); }
  .sec-del:hover { color: var(--rd, #ef4444); }

  .ms-list-footer {
    padding: 8px;
    border-top: 1px solid var(--bd);
    display: flex;
    gap: 6px;
  }

  .del-ms-btn { color: var(--rd, #ef4444) !important; }

  /* ── Editor area ─────────────────────────────────────────────── */
  .editor-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .editor-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
    gap: 12px;
  }

  .editor-section-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .editor-sec-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--tx);
  }

  .wc-count { font-size: 0.75rem; color: var(--mu); }
  .wc-target { font-size: 0.75rem; color: var(--ac); }
  .wc-over { color: var(--rd, #ef4444) !important; }
  .saving-dot { font-size: 0.7rem; color: var(--mu); }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .target-input {
    width: 90px;
    font-size: 0.75rem;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    background: var(--sf2);
    border: 1px solid var(--bd);
    color: var(--tx);
  }

  .btn-enzo {
    background: var(--enzo-bg, rgba(168,85,247,0.12));
    color: var(--enzo, #a855f7);
    border: 1px solid rgba(168,85,247,0.2);
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .btn-enzo:hover:not(:disabled) { background: rgba(168,85,247,0.22); }
  .btn-enzo:disabled { opacity: 0.5; cursor: not-allowed; }

  .enzo-dot-sm {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--enzo, #a855f7);
    display: inline-block;
  }

  .editor-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    min-height: 0;
  }

  .editor-body-split .rich-wrap { flex: 1; }

  .rich-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  /* Word count bar */
  .wc-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 14px;
    border-top: 1px solid var(--bd);
    flex-shrink: 0;
    background: var(--sf);
  }
  .wc-bar-count {
    font-size: 0.72rem;
    color: var(--mu);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .wc-progress-track {
    flex: 1;
    height: 4px;
    background: var(--sf2);
    border-radius: 2px;
    overflow: hidden;
  }
  .wc-progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease, background 0.3s ease;
  }

  /* ── Enzo assist panel ───────────────────────────────────────── */
  .enzo-assist-panel {
    width: 320px;
    flex-shrink: 0;
    border-left: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    background: var(--enzo-bg, rgba(168,85,247,0.04));
  }

  .enzo-assist-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--bd);
  }

  .enzo-assist-title {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--enzo, #a855f7);
  }

  .enzo-assist-body {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
  }

  .enzo-assist-text {
    font-size: 0.82rem;
    line-height: 1.65;
    color: var(--tx);
    white-space: pre-wrap;
  }

  .enzo-assist-empty {
    font-size: 0.8rem;
    color: var(--mu);
    line-height: 1.6;
  }

  .enzo-pulse {
    font-size: 0.8rem;
    color: var(--enzo, #a855f7);
    opacity: 0.7;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.9; }
  }

  .enzo-assist-footer {
    padding: 8px 12px;
    border-top: 1px solid var(--bd);
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  .sec-notes-bar {
    border-top: 1px solid var(--bd);
    padding: 6px 12px;
    flex-shrink: 0;
  }

  .sec-notes-input {
    width: 100%;
    font-size: 0.78rem;
    padding: 4px 8px;
    background: transparent;
    border: none;
    color: var(--mu);
    outline: none;
  }
  .sec-notes-input::placeholder { color: var(--mu); opacity: 0.6; }
  .sec-notes-input:focus { color: var(--tx); }

  /* ── Modals ──────────────────────────────────────────────────── */
  .ms-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 100;
  }

  .ms-modal {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    background: var(--sf1);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 24px;
    width: min(480px, 96vw);
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }

  .cite-modal {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    background: var(--sf1);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 20px;
    width: min(560px, 96vw);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 16px;
    color: var(--tx);
  }

  .field-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }
  .field-row label { font-size: 0.75rem; color: var(--mu); font-weight: 500; }
  .field-input {
    padding: 7px 10px;
    font-size: 0.875rem;
    border-radius: var(--radius-sm);
    background: var(--sf2);
    border: 1px solid var(--bd);
    color: var(--tx);
  }

  .hint-text {
    font-size: 0.75rem;
    color: var(--mu);
    margin: 0 0 16px;
    line-height: 1.5;
  }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .cite-list {
    flex: 1;
    overflow-y: auto;
    margin: 0 -4px;
    padding: 4px;
  }

  .cite-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    text-align: left;
    background: transparent;
    transition: background var(--transition);
    cursor: pointer;
  }
  .cite-item:hover { background: var(--sf2); }
  .cite-title { font-size: 0.82rem; font-weight: 500; color: var(--tx); line-height: 1.3; }
  .cite-meta { font-size: 0.7rem; color: var(--mu); }

  /* ── Empty / no-sec ──────────────────────────────────────────── */
  .ms-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: var(--mu);
    text-align: center;
    padding: 40px;
  }
  .ms-empty p { font-size: 0.88rem; max-width: 300px; line-height: 1.6; }

  .no-sec {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--mu);
    font-size: 0.88rem;
  }

  .empty-hint {
    font-size: 0.78rem;
    color: var(--mu);
    text-align: center;
    padding: 16px 8px;
    line-height: 1.5;
  }

  .btn-sm { padding: 4px 10px; font-size: 0.75rem; }
  .btn-icon {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    background: transparent; color: var(--mu);
    border-radius: var(--radius-sm);
  }
  .btn-icon:hover { background: var(--sf2); color: var(--tx); }

  @media (max-width: 700px) {
    .ms-list-col { width: 140px; }
    .sec-list-col { display: none; }
    .enzo-assist-panel { display: none; }
  }

  @media (max-width: 540px) {
    .ms-list-col { display: none; }
    .ms-shell { flex-direction: column; }
    .ms-editor-col { min-width: 0; width: 100%; }
  }
</style>
