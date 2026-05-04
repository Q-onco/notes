<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { askEnzo } from '../lib/groq';
  import { nanoid } from 'nanoid';
  import type { ChatSession, ChatMessage, Note } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  const IDLE_STATUSES = [
    '· oncology research AI',
    '· nose in the literature',
    '· tail wagging happily',
    '· decoding the TME',
    '· scRNA-seq enthusiast',
    '· good girl, always',
    '· loves a good hypothesis',
    '· dreaming of spatial data',
  ];

  let statusIdx = $state(0);
  const enzoStatus = $derived(streaming ? '· thinking...' : IDLE_STATUSES[statusIdx]);

  $effect(() => {
    if (streaming) return;
    const t = setInterval(() => {
      statusIdx = (statusIdx + 1) % IDLE_STATUSES.length;
    }, 9000);
    return () => clearInterval(t);
  });

  let tab = $state<'chat' | 'history'>('chat');
  let inputText = $state('');
  let streaming = $state(false);
  let useJournalContext = $state(true);
  let streamBuffer = $state('');
  let abortController: AbortController | null = null;
  let messagesEl = $state<HTMLDivElement | undefined>(undefined);
  let historySearch = $state('');
  let selectedDate = $state<string | null>(null);

  // Current session for today
  const todayKey = new Date().toISOString().slice(0, 10);
  const currentSession = $derived(
    store.chatSessions.find(s => s.id === todayKey) ?? null
  );

  function getOrCreateSession(): ChatSession {
    const existing = store.chatSessions.find(s => s.id === todayKey);
    if (existing) return existing;
    const session: ChatSession = {
      id: todayKey,
      date: todayKey,
      messages: [],
      noteContext: store.currentNote?.title ?? null
    };
    store.chatSessions = [session, ...store.chatSessions];
    return session;
  }

  async function send() {
    const text = inputText.trim();
    if (!text || streaming) return;
    inputText = '';

    const session = getOrCreateSession();
    const userMsg: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      model: '',
      tokens: 0
    };
    session.messages = [...session.messages, userMsg];
    session.noteContext = store.currentNote?.title ?? null;

    const assistantId = nanoid();
    const placeholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: '',
      tokens: 0
    };
    session.messages = [...session.messages, placeholder];
    streamBuffer = '';
    streaming = true;

    scrollToBottom();

    try {
      abortController = new AbortController();
      const noteContext = store.currentNote
        ? `${store.currentNote.title}\n\n${store.currentNote.body.slice(0, 2000)}`
        : '';

      const journalContext = useJournalContext && store.journal.length > 0
        ? [...store.journal]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 3)
            .map(e => {
              const d = new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              return `[${d}] ${e.body.slice(0, 300)}${e.body.length > 300 ? '…' : ''}`;
            })
            .join('\n\n')
        : '';

      const history = session.messages
        .filter(m => m.id !== assistantId)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const { text: full, tokens, model } = await askEnzo(
        history,
        noteContext,
        (chunk) => {
          streamBuffer += chunk;
          const idx = session.messages.findIndex(m => m.id === assistantId);
          if (idx !== -1) {
            session.messages[idx] = { ...session.messages[idx], content: streamBuffer };
          }
          scrollToBottom();
        },
        abortController.signal,
        journalContext
      );

      const idx = session.messages.findIndex(m => m.id === assistantId);
      if (idx !== -1) {
        session.messages[idx] = { ...session.messages[idx], content: full, tokens, model };
      }

      await store.saveChat();
    } catch (e) {
      const idx = session.messages.findIndex(m => m.id === assistantId);
      if (idx !== -1) {
        const err = (e as Error).message;
        if (err !== 'AbortError') {
          session.messages[idx] = { ...session.messages[idx], content: `Error: ${err}` };
        } else {
          session.messages = session.messages.filter(m => m.id !== assistantId);
        }
      }
      if ((e as Error).message !== 'AbortError') {
        showToast((e as Error).message, 'error');
      }
    } finally {
      streaming = false;
      streamBuffer = '';
      abortController = null;
    }
  }

  function stopStream() {
    abortController?.abort();
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // Pre-fill from dashboard quick prompts
  $effect(() => {
    if (store.enzoSearchQuery) {
      inputText = store.enzoSearchQuery;
      store.enzoSearchQuery = '';
      tab = 'chat';
    }
  });

  // History helpers
  const filteredHistory = $derived(
    store.chatSessions
      .filter(s => {
        if (!historySearch) return true;
        return s.messages.some(m =>
          m.content.toLowerCase().includes(historySearch.toLowerCase())
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  );

  const selectedSession = $derived(
    selectedDate ? store.chatSessions.find(s => s.date === selectedDate) ?? null : null
  );

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  async function saveSessionAsNote(session: ChatSession) {
    const dateStr = fmtDate(session.date);
    const lines = session.messages.map(m =>
      `**${m.role === 'user' ? store.settings.userName || 'You' : 'Enzo'}** *(${fmtTime(m.timestamp)})*\n\n${m.content}`
    ).join('\n\n---\n\n');

    const note: Note = {
      id: nanoid(),
      title: `Enzo — ${dateStr}`,
      body: `# Enzo conversation — ${dateStr}\n\n${lines}`,
      tags: ['enzo', 'conversation'],
      createdAt: new Date(session.date).getTime(),
      updatedAt: Date.now(),
      pinned: false,
      archived: false,
      audioIds: []
    };
    store.notes = [note, ...store.notes];
    store.currentNoteId = note.id;
    await store.saveNotes();
    store.view = 'notes';
    store.enzoOpen = false;
    showToast('Conversation saved as note');
  }

  const hasJournal = $derived(store.journal.length > 0);
</script>

<div class="enzo-panel">
  <!-- Header -->
  <div class="enzo-head">
    <div class="enzo-title">
      <span class="enzo-avatar">E</span>
      <div class="enzo-name-stack">
        <span class="enzo-name-label">Enzo</span>
        <span class="enzo-status text-mu" class:thinking={streaming}>{enzoStatus}</span>
      </div>
    </div>
    <div class="enzo-tabs">
      <button class="etab" class:active={tab === 'chat'} onclick={() => tab = 'chat'}>Chat</button>
      <button class="etab" class:active={tab === 'history'} onclick={() => { tab = 'history'; selectedDate = null; }}>History</button>
    </div>
  </div>

  {#if tab === 'chat'}
    <!-- Messages -->
    <div class="messages" bind:this={messagesEl}>
      {#if !currentSession || currentSession.messages.length === 0}
        <div class="enzo-welcome">
          <p class="text-sm text-mu">
            Hello, {store.settings.userName}. I'm Enzo.<br/>
            Ask me anything — your research, your data, or the literature.
          </p>
          {#if store.currentNote}
            <p class="context-hint text-xs">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Reading: {store.currentNote.title}
            </p>
          {/if}
        </div>
      {:else}
        {#each currentSession.messages as msg (msg.id)}
          <div class="message msg-{msg.role}">
            <div class="msg-content">
              {#if msg.role === 'assistant' && !msg.content}
                <span class="thinking-dots">
                  <span></span><span></span><span></span>
                </span>
              {:else}
                {msg.content}
              {/if}
            </div>
            {#if msg.tokens > 0}
              <span class="msg-meta text-xs text-mu">{msg.tokens} tokens · {fmtTime(msg.timestamp)}</span>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <!-- Context bar -->
    {#if store.currentNote || hasJournal}
      <div class="context-bar text-xs text-mu">
        {#if store.currentNote}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          {store.currentNote.title}
        {/if}
        {#if hasJournal}
          <button
            class="journal-ctx-btn"
            class:active={useJournalContext}
            onclick={() => useJournalContext = !useJournalContext}
            title={useJournalContext ? 'Journal context on — click to disable' : 'Journal context off — click to enable'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
            </svg>
            Journal {useJournalContext ? 'on' : 'off'}
          </button>
        {/if}
      </div>
    {/if}

    <!-- Input -->
    <div class="enzo-input-row">
      <textarea
        bind:value={inputText}
        onkeydown={handleKey}
        placeholder="Ask Enzo... (Shift+Enter for new line)"
        rows={2}
        disabled={streaming}
        class="enzo-input"
      ></textarea>
      {#if streaming}
        <button class="btn btn-danger btn-sm" onclick={stopStream}>Stop</button>
      {:else}
        <button class="btn btn-primary btn-sm send-btn" onclick={send} disabled={!inputText.trim()} aria-label="Send message">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      {/if}
    </div>

  {:else}
    <!-- History -->
    <div class="history-panel">
      <div class="history-search">
        <input type="search" bind:value={historySearch} placeholder="Search conversations..." />
      </div>

      {#if selectedDate && selectedSession}
        <div class="history-session">
          <button class="btn btn-ghost btn-sm back-btn" onclick={() => selectedDate = null}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <p class="text-xs text-mu">{fmtDate(selectedDate)}</p>
          <div class="history-msgs">
            {#each selectedSession.messages as msg}
              <div class="message msg-{msg.role}">
                <div class="msg-content">{msg.content}</div>
                <span class="msg-meta text-xs text-mu">{fmtTime(msg.timestamp)}</span>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="sessions-list">
          {#each filteredHistory as session (session.id)}
            <div class="session-item-wrap">
              <button class="session-item" onclick={() => selectedDate = session.date}>
                <span class="session-date">{fmtDate(session.date)}</span>
                <span class="session-count text-xs text-mu">{session.messages.length} messages</span>
                {#if session.noteContext}
                  <span class="session-ctx text-xs text-mu">re: {session.noteContext}</span>
                {/if}
              </button>
              <button
                class="session-save-btn btn-icon"
                onclick={() => saveSessionAsNote(session)}
                title="Save conversation as note"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </button>
            </div>
          {:else}
            <p class="text-sm text-mu" style="padding: 16px;">No conversations yet.</p>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .enzo-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .enzo-head {
    padding: 10px 14px;
    border-bottom: 1px solid var(--enzo-bd);
    background: var(--enzo-bg);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .enzo-title { display: flex; align-items: center; gap: 9px; }
  .enzo-avatar {
    width: 28px; height: 28px;
    background: var(--enzo);
    color: white;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem;
    font-weight: 800;
    flex-shrink: 0;
  }
  .enzo-name-stack { display: flex; flex-direction: column; gap: 1px; line-height: 1; }
  .enzo-name-label { font-weight: 700; font-size: 0.875rem; color: var(--enzo); line-height: 1.3; }
  .enzo-status {
    font-size: 0.68rem;
    line-height: 1.4;
    letter-spacing: 0.01em;
    animation: status-wave 9s ease-in-out infinite;
  }
  .enzo-status.thinking {
    color: var(--enzo);
    animation: thinking-pulse 2.4s ease-in-out infinite;
  }
  @keyframes status-wave {
    0%, 70% { opacity: 0.8; }
    83%     { opacity: 0.1; }
    100%    { opacity: 0.8; }
  }
  @keyframes thinking-pulse {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 1; }
  }

  .enzo-tabs { display: flex; gap: 2px; background: var(--sf2); border-radius: var(--radius-sm); padding: 2px; }
  .etab {
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    background: transparent;
    color: var(--mu);
    border: none;
    cursor: pointer;
    transition: all var(--transition);
  }
  .etab.active { background: var(--sf); color: var(--tx); box-shadow: var(--shadow-sm); }

  /* ── Messages ── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .enzo-welcome { display: flex; flex-direction: column; gap: 10px; padding: 12px 0; }
  .context-hint {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--ac-bg);
    color: var(--ac);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    width: fit-content;
  }

  .message { display: flex; flex-direction: column; gap: 3px; max-width: 90%; }
  .msg-user { align-self: flex-end; }
  .msg-assistant { align-self: flex-start; }

  .msg-content {
    padding: 8px 12px;
    border-radius: var(--radius);
    font-size: 0.85rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .msg-user .msg-content {
    background: var(--ac);
    color: white;
    border-radius: var(--radius) var(--radius) var(--radius-sm) var(--radius);
  }
  .msg-assistant .msg-content {
    background: var(--enzo-bg);
    color: var(--tx);
    border: 1px solid var(--enzo-bd);
    border-radius: var(--radius) var(--radius) var(--radius) var(--radius-sm);
  }

  .msg-meta { align-self: flex-end; padding: 0 4px; }
  .msg-user .msg-meta { align-self: flex-end; }

  .thinking-dots {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 4px 0;
  }
  .thinking-dots span {
    width: 6px; height: 6px;
    background: var(--enzo);
    border-radius: 50%;
    animation: bounce-dot 1.2s ease-in-out infinite;
  }
  .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
  .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce-dot {
    0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* ── Input ── */
  .context-bar {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 14px;
    background: var(--ac-bg);
    color: var(--ac);
    flex-shrink: 0;
    border-top: 1px solid var(--bd);
  }

  .enzo-input-row {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
  }
  .enzo-input {
    flex: 1;
    font-size: 0.85rem;
    resize: none;
    border-radius: var(--radius-sm);
    line-height: 1.5;
    min-height: 52px;
    max-height: 120px;
    overflow-y: auto;
  }
  .send-btn { padding: 8px; border-radius: var(--radius-sm); flex-shrink: 0; }

  /* ── History ── */
  .history-panel { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
  .history-search { padding: 10px 12px; border-bottom: 1px solid var(--bd); flex-shrink: 0; }

  .sessions-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
  .session-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bd);
    background: var(--sf);
    cursor: pointer;
    text-align: left;
    font-family: var(--font);
    transition: border-color var(--transition), background var(--transition);
  }
  .session-item:hover { border-color: var(--enzo-bd); background: var(--enzo-bg); }
  .session-date { font-size: 0.82rem; font-weight: 600; color: var(--tx); }
  .session-ctx { font-style: italic; }

  .history-session { flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 10px 12px; gap: 10px; }
  .back-btn { align-self: flex-start; }
  .history-msgs { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }

  .session-item-wrap { display: flex; align-items: stretch; gap: 0; }
  .session-item-wrap .session-item { flex: 1; border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
  .session-save-btn {
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    border: 1px solid var(--bd);
    border-left: none;
    background: var(--sf);
    opacity: 0;
    flex-shrink: 0;
    transition: opacity var(--transition), background var(--transition);
  }
  .session-item-wrap:hover .session-save-btn { opacity: 1; }
  .session-save-btn:hover { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); opacity: 1; }

  .journal-ctx-btn {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 1px 7px; border-radius: 20px;
    border: 1px solid var(--bd); background: var(--sf2);
    color: var(--mu); font-size: 0.65rem; font-weight: 600;
    cursor: pointer; font-family: var(--font);
    transition: all var(--transition);
    letter-spacing: 0.02em;
  }
  .journal-ctx-btn.active { border-color: var(--gn); color: var(--gn); background: var(--gn-bg); }
  .journal-ctx-btn:hover { border-color: var(--gn); color: var(--gn); }
</style>
