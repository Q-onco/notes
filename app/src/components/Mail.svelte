<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { MailContact, MailDraft } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  type Tab = 'compose' | 'sent' | 'drafts' | 'contacts';
  let tab = $state<Tab>('compose');

  // ── Compose state ───────────────────────────────────────────
  let toInput = $state('');
  let toName = $state('');
  let subject = $state('');
  let body = $state('');
  let sending = $state(false);
  let contactSuggestions = $derived(
    toInput.length > 1
      ? store.mailContacts.filter(c =>
          c.email.toLowerCase().includes(toInput.toLowerCase()) ||
          c.name.toLowerCase().includes(toInput.toLowerCase())
        ).slice(0, 5)
      : []
  );
  let showSuggestions = $state(false);
  let savingDraft = $state(false);
  let currentDraftId = $state<string | null>(null);

  // ── Template presets ────────────────────────────────────────
  const TEMPLATES = [
    {
      label: 'Weekly report',
      subject: 'Weekly Research Update',
      body: `Hi,\n\nHere's a brief update on my research progress this week:\n\n**Progress:**\n- \n\n**Next week:**\n- \n\n**Blockers / questions:**\n- \n\nBest regards`
    },
    {
      label: 'Paper share',
      subject: 'Interesting paper — ',
      body: `Hi,\n\nI came across this paper and thought it might be relevant to our work:\n\n**Paper:** \n**Authors:** \n**Journal:** \n\n**Why it's relevant:**\n\nLet me know your thoughts.\n\nBest regards`
    },
    {
      label: 'Grant update',
      subject: 'Grant Application Update',
      body: `Hi,\n\nQuick update on the grant application:\n\n**Submission deadline:** \n**Status:** \n**Outstanding items:** \n- \n\n**Notes:**\n\nBest regards`
    },
    {
      label: 'Meeting notes',
      subject: 'Meeting Notes — ',
      body: `Hi,\n\nHere are the notes from our meeting on [date]:\n\n**Discussion points:**\n- \n\n**Action items:**\n- \n\n**Next meeting:** \n\nBest regards`
    }
  ];

  function applyTemplate(t: typeof TEMPLATES[0]) {
    subject = t.subject;
    body = t.body;
  }

  // ── Load mail on mount ───────────────────────────────────────
  $effect(() => {
    store.loadMail();
  });

  // ── Pre-fill from global compose state ──────────────────────
  $effect(() => {
    if (store.mailComposeOpen && store.mailComposeDraft) {
      toInput = store.mailComposeDraft.to || '';
      toName = store.mailComposeDraft.toName || '';
      subject = store.mailComposeDraft.subject || '';
      body = store.mailComposeDraft.body || '';
      tab = 'compose';
      store.mailComposeOpen = false;
    }
  });

  function selectContact(c: MailContact) {
    toInput = c.email;
    toName = c.name;
    showSuggestions = false;
  }

  async function send() {
    if (!toInput.trim() || !subject.trim()) {
      showToast('Fill in To and Subject', 'error');
      return;
    }
    sending = true;
    try {
      await store.sendMail(toInput.trim(), toName.trim(), subject.trim(), body);
      if (currentDraftId) { await store.deleteDraft(currentDraftId); currentDraftId = null; }
      showToast('Email sent');
      toInput = ''; toName = ''; subject = ''; body = '';
    } catch (e: any) {
      showToast(e.message || 'Send failed', 'error');
    }
    sending = false;
  }

  async function saveDraft() {
    if (!body.trim() && !subject.trim()) return;
    savingDraft = true;
    const draft: MailDraft = {
      id: currentDraftId ?? nanoid(),
      toEmail: toInput.trim(),
      toName: toName.trim(),
      subject: subject.trim(),
      body,
      updatedAt: Date.now()
    };
    await store.saveDraft(draft);
    currentDraftId = draft.id;
    showToast('Draft saved');
    savingDraft = false;
  }

  function resumeDraft(d: MailDraft) {
    toInput = d.toEmail;
    toName = d.toName;
    subject = d.subject;
    body = d.body;
    currentDraftId = d.id;
    tab = 'compose';
  }

  function sendDraftToEnzo() {
    if (!body.trim() && !subject.trim()) return;
    const ctx = subject ? `Subject: ${subject}\n\n${body}` : body;
    store.enzoSearchQuery = `Help me improve this email draft:\n\n${ctx}\n\nSuggest improvements for tone, clarity, and conciseness.`;
    store.enzoOpen = true;
  }

  // ── Contacts ────────────────────────────────────────────────
  let editingContact = $state<MailContact | null>(null);
  let newName = $state('');
  let newEmail = $state('');
  let newRole = $state<MailContact['role'] | ''>('');
  let savingContact = $state(false);

  function startNewContact() {
    editingContact = { id: nanoid(), name: '', email: '', role: 'other', createdAt: Date.now() };
    newName = ''; newEmail = ''; newRole = '';
  }

  function startEditContact(c: MailContact) {
    editingContact = { ...c };
    newName = c.name; newEmail = c.email; newRole = c.role;
  }

  async function saveContact() {
    if (!newEmail.trim()) { showToast('Email required', 'error'); return; }
    savingContact = true;
    const c: MailContact = { ...editingContact!, name: newName.trim(), email: newEmail.trim(), role: (newRole || 'other') as MailContact['role'] };
    await store.saveMailContact(c);
    editingContact = null;
    showToast('Contact saved');
    savingContact = false;
  }

  // ── Helpers ─────────────────────────────────────────────────
  function relTime(ts: number) {
    const d = Date.now() - ts;
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  let viewingSent = $state<string | null>(null);
  let viewingDraft = $state<string | null>(null);
</script>

<div class="mail-view">
  <div class="mail-header">
    <h2>Mail</h2>
    {#if store.mailDrafts.length > 0}
      <span class="draft-badge">{store.mailDrafts.length} draft{store.mailDrafts.length !== 1 ? 's' : ''}</span>
    {/if}
  </div>

  <!-- Tabs -->
  <div class="mail-tabs">
    {#each (['compose', 'sent', 'drafts', 'contacts'] as Tab[]) as t}
      <button class="mail-tab" class:active={tab === t} onclick={() => tab = t}>
        {#if t === 'drafts' && store.mailDrafts.length > 0}
          {t.charAt(0).toUpperCase() + t.slice(1)} <span class="tab-count">{store.mailDrafts.length}</span>
        {:else}
          {t.charAt(0).toUpperCase() + t.slice(1)}
        {/if}
      </button>
    {/each}
  </div>

  <!-- Compose -->
  {#if tab === 'compose'}
    <div class="compose-panel">
      <!-- Templates -->
      <div class="template-row">
        <span class="text-xs text-mu">Templates:</span>
        {#each TEMPLATES as tpl}
          <button class="chip" onclick={() => applyTemplate(tpl)}>{tpl.label}</button>
        {/each}
      </div>

      <!-- To field with suggestions -->
      <div class="field">
        <label class="field-label" for="mail-to">To</label>
        <div class="to-wrap">
          <input
            id="mail-to"
            class="field-input"
            type="email"
            placeholder="email@example.com"
            bind:value={toInput}
            onfocus={() => showSuggestions = true}
            onblur={() => setTimeout(() => showSuggestions = false, 150)}
          />
          {#if showSuggestions && contactSuggestions.length > 0}
            <div class="suggestions">
              {#each contactSuggestions as c}
                <button class="suggestion-item" onclick={() => selectContact(c)}>
                  <span class="sug-name">{c.name}</span>
                  <span class="sug-email text-xs text-mu">{c.email}</span>
                  {#if c.role}<span class="sug-role text-xs text-mu">· {c.role}</span>{/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="mail-name">Name (optional)</label>
        <input id="mail-name" class="field-input" type="text" placeholder="Recipient name" bind:value={toName} />
      </div>

      <div class="field">
        <label class="field-label" for="mail-subject">Subject</label>
        <input id="mail-subject" class="field-input" type="text" placeholder="Subject" bind:value={subject} />
      </div>

      <div class="field">
        <label class="field-label" for="mail-body">Body</label>
        <textarea id="mail-body" class="field-input mail-body" rows="12" placeholder="Write your email..." bind:value={body}></textarea>
      </div>

      <div class="compose-actions">
        <button class="btn btn-ghost btn-sm" onclick={sendDraftToEnzo} title="Ask Enzo to improve this draft">
          <span class="text-enzo" style="font-family:var(--mono);font-weight:700;font-size:0.78rem">E</span>
          Enzo assist
        </button>
        <button class="btn btn-ghost btn-sm" onclick={saveDraft} disabled={savingDraft}>
          {savingDraft ? 'Saving…' : currentDraftId ? 'Update draft' : 'Save draft'}
        </button>
        <button class="btn btn-primary" onclick={send} disabled={sending}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>

      {#if !store.settings.workerUrl}
        <p class="compose-warn text-xs text-mu">Worker URL not set — configure in Settings → AI to enable sending.</p>
      {/if}
    </div>

  <!-- Sent -->
  {:else if tab === 'sent'}
    <div class="mail-list">
      {#if store.mailSent.length === 0}
        <div class="empty-state"><p class="text-mu text-sm">No sent emails yet.</p></div>
      {:else}
        {#each store.mailSent as s (s.id)}
          <div class="mail-item card" class:mail-item-open={viewingSent === s.id}>
            <button class="mail-item-head" onclick={() => viewingSent = viewingSent === s.id ? null : s.id}>
              <div class="mail-item-meta">
                <span class="mail-to">{s.toName || s.toEmail}</span>
                <span class="text-xs text-mu">{relTime(s.sentAt)}</span>
              </div>
              <span class="mail-subject">{s.subject}</span>
              <svg class="mail-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                {#if viewingSent === s.id}
                  <polyline points="18 15 12 9 6 15"/>
                {:else}
                  <polyline points="6 9 12 15 18 9"/>
                {/if}
              </svg>
            </button>
            {#if viewingSent === s.id}
              <div class="mail-body-view">
                <pre class="mail-body-pre">{s.body}</pre>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

  <!-- Drafts -->
  {:else if tab === 'drafts'}
    <div class="mail-list">
      {#if store.mailDrafts.length === 0}
        <div class="empty-state"><p class="text-mu text-sm">No drafts.</p></div>
      {:else}
        {#each store.mailDrafts as d (d.id)}
          <div class="mail-item card">
            <div class="mail-item-head">
              <div class="mail-item-meta">
                <span class="mail-to">{d.toName || d.toEmail || 'No recipient'}</span>
                <span class="text-xs text-mu">{relTime(d.updatedAt)}</span>
              </div>
              <span class="mail-subject">{d.subject || '(no subject)'}</span>
              <div class="mail-item-actions">
                <button class="btn btn-ghost btn-sm" onclick={() => resumeDraft(d)}>Resume</button>
                <button class="btn-icon" onclick={async () => { await store.deleteDraft(d.id); showToast('Draft deleted'); }} title="Delete draft">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                </button>
              </div>
            </div>
            {#if d.body}
              <p class="mail-preview text-xs text-mu">{d.body.slice(0, 100)}{d.body.length > 100 ? '…' : ''}</p>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

  <!-- Contacts -->
  {:else if tab === 'contacts'}
    <div class="contacts-panel">
      <div class="contacts-head">
        <h3 class="text-sm">Contacts</h3>
        <button class="btn btn-ghost btn-sm" onclick={startNewContact}>+ Add</button>
      </div>

      {#if editingContact}
        <div class="contact-form card">
          <div class="field">
            <label class="field-label" for="c-name">Name</label>
            <input id="c-name" class="field-input" type="text" placeholder="Name" bind:value={newName} />
          </div>
          <div class="field">
            <label class="field-label" for="c-email">Email *</label>
            <input id="c-email" class="field-input" type="email" placeholder="email@example.com" bind:value={newEmail} />
          </div>
          <div class="field">
            <label class="field-label" for="c-role">Role</label>
            <input id="c-role" class="field-input" type="text" placeholder="e.g. Supervisor, Collaborator" bind:value={newRole} />
          </div>
          <div class="form-actions">
            <button class="btn btn-ghost btn-sm" onclick={() => editingContact = null}>Cancel</button>
            <button class="btn btn-primary btn-sm" onclick={saveContact} disabled={savingContact}>
              {savingContact ? 'Saving…' : 'Save contact'}
            </button>
          </div>
        </div>
      {/if}

      <div class="mail-list">
        {#if store.mailContacts.length === 0 && !editingContact}
          <div class="empty-state"><p class="text-mu text-sm">No contacts yet.</p></div>
        {:else}
          {#each store.mailContacts as c (c.id)}
            <div class="contact-item card">
              <div class="contact-main">
                <div class="contact-avatar">{c.name ? c.name[0].toUpperCase() : c.email[0].toUpperCase()}</div>
                <div class="contact-info">
                  <span class="contact-name">{c.name || c.email}</span>
                  {#if c.name}<span class="text-xs text-mu">{c.email}</span>{/if}
                  {#if c.role}<span class="contact-role text-xs">{c.role}</span>{/if}
                </div>
              </div>
              <div class="contact-actions">
                <button
                  class="btn btn-ghost btn-sm"
                  onclick={() => { toInput = c.email; toName = c.name; tab = 'compose'; }}
                >
                  Compose
                </button>
                <button class="btn-icon" onclick={() => startEditContact(c)} title="Edit">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon" onclick={async () => { await store.deleteMailContact(c.id); showToast('Deleted'); }} title="Delete">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .mail-view {
    height: 100%;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .mail-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .mail-header h2 { flex: 1; }
  .draft-badge {
    font-size: 0.72rem;
    background: var(--yw-bg, rgba(234,179,8,0.15));
    color: var(--yw, #ca8a04);
    border: 1px solid rgba(234,179,8,0.3);
    border-radius: 10px;
    padding: 2px 8px;
  }

  /* ── Tabs ── */
  .mail-tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--bd);
    padding-bottom: 0;
  }
  .mail-tab {
    padding: 7px 14px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--mu);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color var(--transition), border-color var(--transition);
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .mail-tab:hover { color: var(--tx); }
  .mail-tab.active { color: var(--ac); border-bottom-color: var(--ac); }
  .tab-count {
    background: var(--ac-bg);
    color: var(--ac);
    border-radius: 8px;
    padding: 0 5px;
    font-size: 0.7rem;
  }

  /* ── Compose ── */
  .compose-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .template-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip {
    font-size: 0.72rem;
    padding: 3px 9px;
    border-radius: 10px;
    background: var(--sf2);
    border: 1px solid var(--bd);
    cursor: pointer;
    color: var(--tx2);
    transition: background var(--transition), color var(--transition);
  }
  .chip:hover { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }

  .field { display: flex; flex-direction: column; gap: 4px; }
  .field-label { font-size: 0.72rem; font-weight: 700; color: var(--mu); text-transform: uppercase; letter-spacing: 0.06em; }
  .field-input {
    font-family: var(--font);
    font-size: 0.875rem;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    padding: 7px 10px;
    color: var(--tx);
    width: 100%;
    transition: border-color var(--transition);
  }
  .field-input:focus { outline: none; border-color: var(--ac); }
  .mail-body { resize: vertical; min-height: 200px; font-family: var(--mono); line-height: 1.6; }

  .to-wrap { position: relative; }
  .suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    z-index: 10;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }
  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background var(--transition);
  }
  .suggestion-item:hover { background: var(--sf2); }
  .sug-name { font-size: 0.82rem; font-weight: 600; color: var(--tx); }

  .compose-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    padding-top: 4px;
  }
  .compose-warn {
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-style: italic;
  }

  /* ── Mail list ── */
  .mail-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mail-item { overflow: hidden; }
  .mail-item-head {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    width: 100%;
    background: transparent;
    border: none;
    padding: 0;
    text-align: left;
  }
  .mail-item-head:has(.mail-item-actions) {
    cursor: default;
    grid-template-columns: 1fr auto;
  }
  .mail-item-meta { display: flex; align-items: center; gap: 8px; }
  .mail-to { font-size: 0.82rem; font-weight: 700; color: var(--tx); }
  .mail-subject { font-size: 0.82rem; color: var(--tx2); grid-column: 1 / -2; margin-top: 2px; }
  .mail-chevron { color: var(--mu); flex-shrink: 0; }
  .mail-item-actions { display: flex; align-items: center; gap: 4px; }

  .mail-body-view {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--bd);
  }
  .mail-body-pre {
    font-family: var(--font);
    font-size: 0.82rem;
    color: var(--tx2);
    white-space: pre-wrap;
    line-height: 1.6;
    margin: 0;
  }

  .mail-preview {
    margin-top: 4px;
    font-style: italic;
  }

  /* ── Contacts ── */
  .contacts-panel { display: flex; flex-direction: column; gap: 12px; }
  .contacts-head { display: flex; align-items: center; justify-content: space-between; }
  .contact-form { display: flex; flex-direction: column; gap: 10px; }
  .form-actions { display: flex; gap: 8px; justify-content: flex-end; }

  .contact-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .contact-main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .contact-avatar {
    width: 34px; height: 34px;
    border-radius: 50%;
    background: var(--ac-bg);
    color: var(--ac);
    font-weight: 700;
    font-size: 0.875rem;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .contact-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .contact-name { font-size: 0.875rem; font-weight: 600; color: var(--tx); }
  .contact-role {
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 8px;
    padding: 1px 6px;
    color: var(--mu);
    display: inline-block;
    width: fit-content;
  }
  .contact-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

  .empty-state { padding: 40px; text-align: center; }

  @media (max-width: 540px) {
    .compose-actions { flex-wrap: wrap; justify-content: stretch; }
    .compose-actions .btn { flex: 1; justify-content: center; }
    .mail-body { min-height: 140px; }
  }
</style>
