<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { Grant, ConferenceAbstract, PeerReview, GrantStatus, AbstractStatus, PeerReviewStatus } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let tab = $state<'grants' | 'conferences' | 'reviews'>('grants');

  // ── Grants ─────────────────────────────────────────────────────
  let grantModal = $state(false);
  let editingGrant = $state<Grant | null>(null);
  let grantForm = $state<Omit<Grant, 'id' | 'createdAt' | 'updatedAt'>>({
    title: '', agency: '', programme: '', amount: 0, currency: 'EUR',
    deadline: null, submittedAt: null, status: 'idea',
    piName: '', collaborators: [], description: '', notes: '', tags: [],
  });
  let grantCollabInput = $state('');
  let grantTagInput = $state('');

  const GRANT_STATUS_COLORS: Record<GrantStatus, string> = {
    idea: 'mu', drafting: 'yw', submitted: 'ac',
    'under-review': 'pu', awarded: 'gn', rejected: 'rd', withdrawn: 'mu',
  };

  function openNewGrant() {
    editingGrant = null;
    grantForm = { title: '', agency: '', programme: '', amount: 0, currency: 'EUR', deadline: null, submittedAt: null, status: 'idea', piName: '', collaborators: [], description: '', notes: '', tags: [] };
    grantModal = true;
  }

  function editGrant(g: Grant) {
    editingGrant = g;
    grantForm = { title: g.title, agency: g.agency, programme: g.programme, amount: g.amount, currency: g.currency, deadline: g.deadline, submittedAt: g.submittedAt, status: g.status, piName: g.piName, collaborators: [...g.collaborators], description: g.description, notes: g.notes, tags: [...g.tags] };
    grantModal = true;
  }

  async function saveGrant() {
    if (!grantForm.title.trim()) return;
    if (editingGrant) {
      store.grants = store.grants.map(g => g.id === editingGrant!.id ? { ...editingGrant!, ...grantForm, updatedAt: Date.now() } : g);
    } else {
      store.grants = [{ id: nanoid(), ...grantForm, createdAt: Date.now(), updatedAt: Date.now() }, ...store.grants];
    }
    await store.saveGrants();
    showToast('Grant saved');
    grantModal = false;
  }

  async function deleteGrant(id: string) {
    if (!confirm('Delete this grant?')) return;
    store.grants = store.grants.filter(g => g.id !== id);
    await store.saveGrants();
    showToast('Deleted');
  }

  function daysUntil(ts: number | null): string {
    if (!ts) return '';
    const d = Math.ceil((ts - Date.now()) / 86400000);
    if (d < 0) return `${Math.abs(d)}d overdue`;
    if (d === 0) return 'today';
    return `${d}d`;
  }

  // ── Conferences ────────────────────────────────────────────────
  let confModal = $state(false);
  let editingConf = $state<ConferenceAbstract | null>(null);
  let confForm = $state<Omit<ConferenceAbstract, 'id' | 'createdAt' | 'updatedAt'>>({
    conference: '', location: '', dates: '', abstractTitle: '',
    body: '', wordLimit: 250, submissionDeadline: null,
    notificationDate: null, status: 'drafting', presentationId: null,
    notes: '', tags: [],
  });
  let confTagInput = $state('');

  const CONF_STATUS_COLORS: Record<AbstractStatus, string> = {
    drafting: 'mu', submitted: 'ac', 'accepted-oral': 'gn',
    'accepted-poster': 'gn', rejected: 'rd', withdrawn: 'mu',
  };
  const CONF_STATUS_LABELS: Record<AbstractStatus, string> = {
    drafting: 'Drafting', submitted: 'Submitted', 'accepted-oral': 'Accepted — Oral',
    'accepted-poster': 'Accepted — Poster', rejected: 'Rejected', withdrawn: 'Withdrawn',
  };

  function openNewConf() {
    editingConf = null;
    confForm = { conference: '', location: '', dates: '', abstractTitle: '', body: '', wordLimit: 250, submissionDeadline: null, notificationDate: null, status: 'drafting', presentationId: null, notes: '', tags: [] };
    confModal = true;
  }

  function editConf(c: ConferenceAbstract) {
    editingConf = c;
    confForm = { ...c };
    confModal = true;
  }

  async function saveConf() {
    if (!confForm.conference.trim()) return;
    if (editingConf) {
      store.conferences = store.conferences.map(c => c.id === editingConf!.id ? { ...editingConf!, ...confForm, updatedAt: Date.now() } : c);
    } else {
      store.conferences = [{ id: nanoid(), ...confForm, createdAt: Date.now(), updatedAt: Date.now() }, ...store.conferences];
    }
    await store.saveConferences();
    showToast('Conference abstract saved');
    confModal = false;
  }

  async function deleteConf(id: string) {
    if (!confirm('Delete this abstract?')) return;
    store.conferences = store.conferences.filter(c => c.id !== id);
    await store.saveConferences();
    showToast('Deleted');
  }

  const abstractWordCount = $derived(confForm.body.trim().split(/\s+/).filter(Boolean).length);

  // ── Peer reviews ───────────────────────────────────────────────
  let reviewModal = $state(false);
  let editingReview = $state<PeerReview | null>(null);
  let reviewForm = $state<Omit<PeerReview, 'id' | 'createdAt' | 'updatedAt'>>({
    journal: '', manuscriptTitle: '', editorName: '',
    invitedAt: Date.now(), dueAt: null, submittedAt: null,
    status: 'invited', recommendation: '', notes: '',
  });

  const REVIEW_STATUS_COLORS: Record<PeerReviewStatus, string> = {
    invited: 'yw', accepted: 'ac', declined: 'mu',
    'in-progress': 'enzo', submitted: 'gn', done: 'gn',
  };

  function openNewReview() {
    editingReview = null;
    reviewForm = { journal: '', manuscriptTitle: '', editorName: '', invitedAt: Date.now(), dueAt: null, submittedAt: null, status: 'invited', recommendation: '', notes: '' };
    reviewModal = true;
  }

  function editReview(r: PeerReview) {
    editingReview = r;
    reviewForm = { ...r };
    reviewModal = true;
  }

  async function saveReview() {
    if (!reviewForm.journal.trim()) return;
    if (editingReview) {
      store.peerReviews = store.peerReviews.map(r => r.id === editingReview!.id ? { ...editingReview!, ...reviewForm, updatedAt: Date.now() } : r);
    } else {
      store.peerReviews = [{ id: nanoid(), ...reviewForm, createdAt: Date.now(), updatedAt: Date.now() }, ...store.peerReviews];
    }
    await store.savePeerReviews();
    showToast('Review logged');
    reviewModal = false;
  }

  async function deleteReview(id: string) {
    if (!confirm('Delete this review log?')) return;
    store.peerReviews = store.peerReviews.filter(r => r.id !== id);
    await store.savePeerReviews();
    showToast('Deleted');
  }

  function tsToDate(ts: number | null): string {
    if (!ts) return '';
    return new Date(ts).toISOString().slice(0, 10);
  }
  function dateToTs(s: string): number | null {
    return s ? new Date(s).getTime() : null;
  }

  // Counts for tab badges
  const activeGrants = $derived(store.grants.filter(g => g.status !== 'awarded' && g.status !== 'rejected' && g.status !== 'withdrawn').length);
  const pendingConfs = $derived(store.conferences.filter(c => c.status === 'drafting' || c.status === 'submitted').length);
  const activeReviews = $derived(store.peerReviews.filter(r => r.status === 'accepted' || r.status === 'in-progress').length);
</script>

<div class="tracker">

  <!-- Header -->
  <div class="tracker-header">
    <div class="header-tabs">
      <button class="htab" class:htab-active={tab === 'grants'} onclick={() => tab = 'grants'}>
        Grants
        {#if activeGrants > 0}<span class="htab-badge">{activeGrants}</span>{/if}
      </button>
      <button class="htab" class:htab-active={tab === 'conferences'} onclick={() => tab = 'conferences'}>
        Conferences
        {#if pendingConfs > 0}<span class="htab-badge">{pendingConfs}</span>{/if}
      </button>
      <button class="htab" class:htab-active={tab === 'reviews'} onclick={() => tab = 'reviews'}>
        Peer Reviews
        {#if activeReviews > 0}<span class="htab-badge">{activeReviews}</span>{/if}
      </button>
    </div>
    <button class="btn btn-ghost btn-sm" onclick={() => {
      if (tab === 'grants' && store.grants.length > 0) {
        const list = store.grants.map(g => `• ${g.title} — ${g.agency} (${g.status}) — ${g.currency}${g.amount.toLocaleString()}`).join('\n');
        store.openCompose({ subject: 'Grant pipeline summary', body: `Grant applications:\n\n${list}` });
      } else if (tab === 'conferences' && store.conferences.length > 0) {
        const list = store.conferences.map(c => `• ${c.conference} (${c.status})${c.deadline ? ' — deadline: ' + new Date(c.deadline).toLocaleDateString('en-GB') : ''}`).join('\n');
        store.openCompose({ subject: 'Conference abstract status', body: `Conference submissions:\n\n${list}` });
      }
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      Email
    </button>
    <button class="btn btn-primary btn-sm" onclick={tab === 'grants' ? openNewGrant : tab === 'conferences' ? openNewConf : openNewReview}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      {tab === 'grants' ? 'New Grant' : tab === 'conferences' ? 'New Abstract' : 'Log Review'}
    </button>
  </div>

  <!-- ── GRANTS TAB ── -->
  {#if tab === 'grants'}
    <div class="list-area">
      {#if store.grants.length === 0}
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--mu)"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          <p>No grants tracked yet</p>
          <button class="btn btn-primary btn-sm" onclick={openNewGrant}>Track your first grant</button>
        </div>
      {:else}
        {#each store.grants as g (g.id)}
          <div class="tracker-card">
            <div class="tc-top">
              <div class="tc-main">
                <span class="tc-status tc-{GRANT_STATUS_COLORS[g.status]}">{g.status.replace('-', ' ')}</span>
                <h4 class="tc-title">{g.title}</h4>
                <div class="tc-meta">
                  {#if g.agency}<span class="tc-tag">{g.agency}</span>{/if}
                  {#if g.programme}<span class="tc-tag">{g.programme}</span>{/if}
                  {#if g.amount > 0}<span class="tc-amount">{g.currency} {g.amount.toLocaleString()}</span>{/if}
                </div>
              </div>
              <div class="tc-right">
                {#if g.deadline}
                  <div class="tc-deadline" class:overdue={g.deadline < Date.now()}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {daysUntil(g.deadline)}
                  </div>
                {/if}
                <div class="tc-actions">
                  <button class="btn-icon" onclick={() => editGrant(g)} title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon danger" onclick={() => deleteGrant(g.id)} title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
            {#if g.notes}
              <p class="tc-notes">{g.notes.slice(0, 140)}{g.notes.length > 140 ? '…' : ''}</p>
            {/if}
            {#if g.collaborators.length > 0}
              <div class="tc-collabs">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                {g.collaborators.join(', ')}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

  <!-- ── CONFERENCES TAB ── -->
  {:else if tab === 'conferences'}
    <div class="list-area">
      {#if store.conferences.length === 0}
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--mu)"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p>No conference abstracts tracked</p>
          <button class="btn btn-primary btn-sm" onclick={openNewConf}>Track an abstract</button>
        </div>
      {:else}
        {#each store.conferences as c (c.id)}
          <div class="tracker-card">
            <div class="tc-top">
              <div class="tc-main">
                <span class="tc-status tc-{CONF_STATUS_COLORS[c.status]}">{CONF_STATUS_LABELS[c.status]}</span>
                <h4 class="tc-title">{c.abstractTitle || c.conference}</h4>
                <div class="tc-meta">
                  <span class="tc-tag">{c.conference}</span>
                  {#if c.location}<span class="tc-tag">{c.location}</span>{/if}
                  {#if c.dates}<span class="tc-tag">{c.dates}</span>{/if}
                </div>
              </div>
              <div class="tc-right">
                {#if c.submissionDeadline}
                  <div class="tc-deadline" class:overdue={c.submissionDeadline < Date.now()}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {daysUntil(c.submissionDeadline)}
                  </div>
                {/if}
                <div class="tc-actions">
                  <button class="btn-icon" onclick={() => editConf(c)} title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon danger" onclick={() => deleteConf(c.id)} title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
            {#if c.body}
              <div class="tc-abstract-preview">
                <span class="wc-badge" class:wc-over={c.body.trim().split(/\s+/).filter(Boolean).length > c.wordLimit}>{c.body.trim().split(/\s+/).filter(Boolean).length}/{c.wordLimit} words</span>
                <p class="tc-notes">{c.body.slice(0, 160)}{c.body.length > 160 ? '…' : ''}</p>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

  <!-- ── PEER REVIEWS TAB ── -->
  {:else}
    <div class="list-area">
      {#if store.peerReviews.length === 0}
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--mu)"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <p>No peer reviews logged</p>
          <button class="btn btn-primary btn-sm" onclick={openNewReview}>Log a review</button>
        </div>
      {:else}
        {#each store.peerReviews as r (r.id)}
          <div class="tracker-card">
            <div class="tc-top">
              <div class="tc-main">
                <span class="tc-status tc-{REVIEW_STATUS_COLORS[r.status]}">{r.status.replace('-', ' ')}</span>
                <h4 class="tc-title">{r.manuscriptTitle || '(untitled)'}</h4>
                <div class="tc-meta">
                  <span class="tc-tag">{r.journal}</span>
                  {#if r.editorName}<span class="tc-tag text-mu">via {r.editorName}</span>{/if}
                  {#if r.recommendation}<span class="tc-tag">→ {r.recommendation}</span>{/if}
                </div>
              </div>
              <div class="tc-right">
                {#if r.dueAt}
                  <div class="tc-deadline" class:overdue={r.dueAt < Date.now() && r.status !== 'done' && r.status !== 'submitted'}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {daysUntil(r.dueAt)}
                  </div>
                {/if}
                <div class="tc-actions">
                  <button class="btn-icon" onclick={() => editReview(r)} title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon danger" onclick={() => deleteReview(r.id)} title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
            {#if r.notes}
              <p class="tc-notes">{r.notes.slice(0, 140)}{r.notes.length > 140 ? '…' : ''}</p>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {/if}

</div>

<!-- ── Grant modal ── -->
{#if grantModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => grantModal = false}>
    <div class="modal-card" onclick={e => e.stopPropagation()}>
      <div class="modal-head">
        <h3>{editingGrant ? 'Edit Grant' : 'New Grant'}</h3>
        <button class="btn-icon" onclick={() => grantModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>Title *</label>
          <input bind:value={grantForm.title} placeholder="Grant title" />
        </div>
        <div class="form-2col">
          <div class="form-row">
            <label>Agency</label>
            <input bind:value={grantForm.agency} placeholder="DFG, EMBO, HFSP…" />
          </div>
          <div class="form-row">
            <label>Programme</label>
            <input bind:value={grantForm.programme} placeholder="e.g. Research Grant" />
          </div>
        </div>
        <div class="form-2col">
          <div class="form-row">
            <label>Amount</label>
            <input type="number" bind:value={grantForm.amount} min="0" />
          </div>
          <div class="form-row">
            <label>Currency</label>
            <select bind:value={grantForm.currency}>
              {#each ['EUR','GBP','USD','CHF','INR'] as c}<option>{c}</option>{/each}
            </select>
          </div>
        </div>
        <div class="form-2col">
          <div class="form-row">
            <label>Status</label>
            <select bind:value={grantForm.status}>
              {#each (['idea','drafting','submitted','under-review','awarded','rejected','withdrawn'] as const) as s}
                <option value={s}>{s.replace('-',' ')}</option>
              {/each}
            </select>
          </div>
          <div class="form-row">
            <label>Deadline</label>
            <input type="date" value={tsToDate(grantForm.deadline)} oninput={e => grantForm.deadline = dateToTs((e.target as HTMLInputElement).value)} />
          </div>
        </div>
        <div class="form-row">
          <label>PI name</label>
          <input bind:value={grantForm.piName} placeholder="Principal investigator" />
        </div>
        <div class="form-row">
          <label>Collaborators</label>
          <div class="tag-row">
            {#each grantForm.collaborators as c}
              <span class="tag">{c}<button onclick={() => grantForm.collaborators = grantForm.collaborators.filter(x => x !== c)}>×</button></span>
            {/each}
            <input class="tag-input" bind:value={grantCollabInput} placeholder="Add collaborator…" onkeydown={e => { if (e.key === 'Enter' && grantCollabInput.trim()) { grantForm.collaborators = [...grantForm.collaborators, grantCollabInput.trim()]; grantCollabInput = ''; }}} />
          </div>
        </div>
        <div class="form-row">
          <label>Description</label>
          <textarea bind:value={grantForm.description} rows={2} placeholder="Brief description of the grant scope"></textarea>
        </div>
        <div class="form-row">
          <label>Notes</label>
          <textarea bind:value={grantForm.notes} rows={2} placeholder="Internal notes, reviewer names, etc."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick={() => grantModal = false}>Cancel</button>
        <button class="btn btn-primary" onclick={saveGrant} disabled={!grantForm.title.trim()}>Save</button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Conference modal ── -->
{#if confModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => confModal = false}>
    <div class="modal-card wide" onclick={e => e.stopPropagation()}>
      <div class="modal-head">
        <h3>{editingConf ? 'Edit Abstract' : 'New Conference Abstract'}</h3>
        <button class="btn-icon" onclick={() => confModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>Conference *</label>
          <input bind:value={confForm.conference} placeholder="ESMO, AACR, ESHG…" />
        </div>
        <div class="form-2col">
          <div class="form-row">
            <label>Location</label>
            <input bind:value={confForm.location} placeholder="City, Country" />
          </div>
          <div class="form-row">
            <label>Dates</label>
            <input bind:value={confForm.dates} placeholder="e.g. 2025-09-14 to 2025-09-17" />
          </div>
        </div>
        <div class="form-row">
          <label>Abstract title</label>
          <input bind:value={confForm.abstractTitle} placeholder="Title of your abstract" />
        </div>
        <div class="form-2col">
          <div class="form-row">
            <label>Status</label>
            <select bind:value={confForm.status}>
              {#each (Object.keys(CONF_STATUS_LABELS) as AbstractStatus[]) as s}
                <option value={s}>{CONF_STATUS_LABELS[s]}</option>
              {/each}
            </select>
          </div>
          <div class="form-row">
            <label>Word limit</label>
            <input type="number" bind:value={confForm.wordLimit} min="50" max="2000" />
          </div>
        </div>
        <div class="form-2col">
          <div class="form-row">
            <label>Submission deadline</label>
            <input type="date" value={tsToDate(confForm.submissionDeadline)} oninput={e => confForm.submissionDeadline = dateToTs((e.target as HTMLInputElement).value)} />
          </div>
          <div class="form-row">
            <label>Notification date</label>
            <input type="date" value={tsToDate(confForm.notificationDate)} oninput={e => confForm.notificationDate = dateToTs((e.target as HTMLInputElement).value)} />
          </div>
        </div>
        <div class="form-row">
          <label>Abstract text <span class="wc-inline" class:wc-over={abstractWordCount > confForm.wordLimit}>{abstractWordCount}/{confForm.wordLimit} words</span></label>
          <textarea bind:value={confForm.body} rows={6} placeholder="Paste or write your abstract here…"></textarea>
        </div>
        <div class="form-row">
          <label>Notes</label>
          <textarea bind:value={confForm.notes} rows={2} placeholder="Co-authors, track, poster dimensions…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick={() => confModal = false}>Cancel</button>
        <button class="btn btn-primary" onclick={saveConf} disabled={!confForm.conference.trim()}>Save</button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Peer review modal ── -->
{#if reviewModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => reviewModal = false}>
    <div class="modal-card" onclick={e => e.stopPropagation()}>
      <div class="modal-head">
        <h3>{editingReview ? 'Edit Review' : 'Log Peer Review'}</h3>
        <button class="btn-icon" onclick={() => reviewModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>Journal *</label>
          <input bind:value={reviewForm.journal} placeholder="Nature Cancer, JCI…" />
        </div>
        <div class="form-row">
          <label>Manuscript title</label>
          <input bind:value={reviewForm.manuscriptTitle} placeholder="Title of manuscript being reviewed" />
        </div>
        <div class="form-2col">
          <div class="form-row">
            <label>Editor name</label>
            <input bind:value={reviewForm.editorName} placeholder="Handling editor" />
          </div>
          <div class="form-row">
            <label>Status</label>
            <select bind:value={reviewForm.status}>
              {#each (['invited','accepted','declined','in-progress','submitted','done'] as const) as s}
                <option value={s}>{s.replace('-',' ')}</option>
              {/each}
            </select>
          </div>
        </div>
        <div class="form-2col">
          <div class="form-row">
            <label>Due date</label>
            <input type="date" value={tsToDate(reviewForm.dueAt)} oninput={e => reviewForm.dueAt = dateToTs((e.target as HTMLInputElement).value)} />
          </div>
          <div class="form-row">
            <label>Recommendation</label>
            <select bind:value={reviewForm.recommendation}>
              <option value="">–</option>
              {#each ['Accept','Minor revision','Major revision','Reject'] as r}<option value={r}>{r}</option>{/each}
            </select>
          </div>
        </div>
        <div class="form-row">
          <label>Notes</label>
          <textarea bind:value={reviewForm.notes} rows={3} placeholder="Key scientific concerns, timeline notes…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick={() => reviewModal = false}>Cancel</button>
        <button class="btn btn-primary" onclick={saveReview} disabled={!reviewForm.journal.trim()}>Save</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tracker {
    display: flex; flex-direction: column; height: 100%; overflow: hidden;
  }
  .tracker-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 20px; border-bottom: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0; gap: 12px;
  }
  .header-tabs { display: flex; gap: 4px; }
  .htab {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 20px; font-size: 0.82rem; font-weight: 500;
    background: var(--sf2); border: 1px solid var(--bd); color: var(--tx2);
    cursor: pointer; transition: all var(--transition); font-family: var(--font);
  }
  .htab:hover { border-color: var(--ac); color: var(--ac); }
  .htab-active { background: var(--ac-bg); border-color: var(--ac); color: var(--ac); }
  .htab-badge {
    background: var(--ac); color: #fff; font-size: 0.65rem; font-weight: 700;
    padding: 1px 6px; border-radius: 10px; min-width: 18px; text-align: center;
  }

  .list-area { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }

  .empty-state {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 14px; color: var(--mu); min-height: 300px;
  }
  .empty-state p { font-size: 0.9rem; }

  .tracker-card {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
    transition: border-color var(--transition);
  }
  .tracker-card:hover { border-color: var(--ac); }

  .tc-top { display: flex; align-items: flex-start; gap: 12px; }
  .tc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .tc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }

  .tc-status {
    display: inline-block; font-size: 0.62rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.07em;
    padding: 2px 8px; border-radius: 10px; width: fit-content;
  }
  .tc-ac   { background: var(--ac-bg);   color: var(--ac);   }
  .tc-gn   { background: var(--gn-bg);   color: var(--gn);   }
  .tc-rd   { background: var(--rd-bg);   color: var(--rd);   }
  .tc-yw   { background: rgba(234,179,8,.1); color: var(--yw); }
  .tc-pu   { background: rgba(139,92,246,.1); color: #8b5cf6; }
  .tc-mu   { background: var(--sf2);     color: var(--mu);   }
  .tc-enzo { background: var(--enzo-bg); color: var(--enzo); }

  .tc-title { font-size: 0.9rem; font-weight: 700; color: var(--tx); line-height: 1.3; }
  .tc-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
  .tc-tag { font-size: 0.72rem; background: var(--sf2); border: 1px solid var(--bd); border-radius: var(--radius-sm); padding: 1px 7px; color: var(--tx2); }
  .tc-amount { font-size: 0.78rem; font-weight: 700; color: var(--gn); }
  .tc-deadline { display: flex; align-items: center; gap: 4px; font-size: 0.72rem; font-weight: 700; color: var(--yw); }
  .tc-deadline.overdue { color: var(--rd); }
  .tc-actions { display: flex; gap: 4px; }
  .btn-icon.danger:hover { color: var(--rd); background: var(--rd-bg); }
  .tc-notes { font-size: 0.8rem; color: var(--tx2); line-height: 1.55; margin: 0; }
  .tc-collabs { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--mu); }
  .tc-abstract-preview { display: flex; flex-direction: column; gap: 4px; }
  .wc-badge {
    display: inline-block; font-size: 0.68rem; font-weight: 700;
    background: var(--gn-bg); color: var(--gn); padding: 1px 7px; border-radius: 10px;
  }
  .wc-badge.wc-over { background: var(--rd-bg); color: var(--rd); }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(2px);
    z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal-card {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    box-shadow: var(--shadow-lg); width: min(520px, 96vw); max-height: 88vh;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .modal-card.wide { width: min(640px, 96vw); }
  .modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--bd); flex-shrink: 0;
  }
  .modal-head h3 { font-size: 1rem; font-weight: 700; }
  .modal-body { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
  .modal-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 14px 20px; border-top: 1px solid var(--bd); flex-shrink: 0;
  }

  .form-row { display: flex; flex-direction: column; gap: 5px; }
  .form-row label { font-size: 0.78rem; font-weight: 600; color: var(--tx2); }
  .form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-row input, .form-row textarea, .form-row select {
    font-size: 0.85rem; padding: 7px 10px; border-radius: var(--radius-sm);
    border: 1px solid var(--bd); background: var(--sf2); color: var(--tx);
    font-family: var(--font); width: 100%; box-sizing: border-box;
  }
  .form-row textarea { resize: vertical; }
  .form-row input:focus, .form-row textarea:focus, .form-row select:focus { border-color: var(--ac); outline: none; }

  .tag-row { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; min-height: 36px; padding: 4px 8px; border: 1px solid var(--bd); border-radius: var(--radius-sm); background: var(--sf2); }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--ac-bg); color: var(--ac); border: 1px solid var(--ac); border-radius: 20px; font-size: 0.75rem; }
  .tag button { background: transparent; border: none; color: var(--ac); cursor: pointer; font-size: 14px; padding: 0; }
  .tag-input { border: none; background: transparent; font-size: 0.82rem; color: var(--tx); min-width: 100px; flex: 1; outline: none; font-family: var(--font); }
  .wc-inline { font-size: 0.7rem; font-weight: 600; color: var(--gn); margin-left: 6px; }
  .wc-inline.wc-over { color: var(--rd); }

  @media (max-width: 640px) {
    .form-2col { grid-template-columns: 1fr; }
    .tracker-header { flex-wrap: wrap; }
  }
</style>
