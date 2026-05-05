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

  // ── Slash commands ────────────────────────────────────────────
  interface EnzoCommand {
    cmd: string;
    usage: string;
    desc: string;
    group: string;
    needsArg: boolean;
  }

  const COMMANDS: EnzoCommand[] = [
    // Capture
    { cmd: 'task',      usage: '/task <description>',    desc: 'Add a task',                   group: 'capture',  needsArg: true  },
    { cmd: 'note',      usage: '/note <title>',          desc: 'Create a note',                group: 'capture',  needsArg: true  },
    { cmd: 'log',       usage: '/log <entry>',           desc: 'Add journal entry',            group: 'capture',  needsArg: true  },
    { cmd: 'hyp',       usage: '/hyp <hypothesis>',      desc: 'Record a hypothesis',          group: 'capture',  needsArg: true  },
    // Research
    { cmd: 'read',      usage: '/read',                  desc: 'Deep read — paste abstract',   group: 'research', needsArg: false },
    { cmd: 'critique',  usage: '/critique',              desc: 'Critique — paste abstract',    group: 'research', needsArg: false },
    { cmd: 'paper',     usage: '/paper <query>',         desc: 'Search literature',            group: 'research', needsArg: true  },
    { cmd: 'cite',      usage: '/cite <DOI or title>',   desc: 'Format a citation',            group: 'research', needsArg: true  },
    // Analysis
    { cmd: 'r',         usage: '/r <code or question>',  desc: 'R code help',                  group: 'analysis', needsArg: true  },
    { cmd: 'py',        usage: '/py <code or question>', desc: 'Python code help',             group: 'analysis', needsArg: true  },
    { cmd: 'code',      usage: '/code <prompt>',         desc: 'Generate analysis code',       group: 'analysis', needsArg: true  },
    // Writing
    { cmd: 'draft',     usage: '/draft <prompt>',        desc: 'Draft scientific text',        group: 'writing',  needsArg: true  },
    { cmd: 'abstract',  usage: '/abstract <title>',      desc: 'Draft an abstract',            group: 'writing',  needsArg: true  },
    // Reports
    { cmd: 'digest',    usage: '/digest',                desc: 'Generate weekly digest',       group: 'reports',  needsArg: false },
    { cmd: 'pi',        usage: '/pi',                    desc: 'Draft PI weekly report',       group: 'reports',  needsArg: false },
    // Files & mail
    { cmd: 'files',     usage: '/files',                 desc: 'List stored files by folder',  group: 'files',    needsArg: false },
    { cmd: 'find',      usage: '/find <query>',          desc: 'Search files',                 group: 'files',    needsArg: true  },
    { cmd: 'send',      usage: '/send <recipient>',      desc: 'Open email compose',           group: 'mail',     needsArg: true  },
    // Utility
    { cmd: 'help',      usage: '/help',                  desc: 'Show all commands',            group: 'utility',  needsArg: false },
    { cmd: 'clear',     usage: '/clear',                 desc: 'Clear this chat session',      group: 'utility',  needsArg: false },
  ];

  let showPicker = $state(false);
  let pickerFilter = $state('');
  let pickerSelected = $state(0);
  let pickerEl = $state<HTMLDivElement | undefined>(undefined);
  let inputEl = $state<HTMLTextAreaElement | undefined>(undefined);

  const pickerCmds = $derived(
    showPicker
      ? COMMANDS.filter(c =>
          pickerFilter === '' ||
          c.cmd.startsWith(pickerFilter) ||
          c.desc.toLowerCase().includes(pickerFilter)
        ).slice(0, 14)
      : []
  );

  function onInputChange() {
    const val = inputText;
    if (val.startsWith('/') && !val.includes(' ')) {
      pickerFilter = val.slice(1).toLowerCase();
      showPicker = true;
      pickerSelected = 0;
    } else {
      showPicker = false;
    }
  }

  function selectCommand(cmd: EnzoCommand) {
    showPicker = false;
    if (cmd.needsArg) {
      inputText = '/' + cmd.cmd + ' ';
      setTimeout(() => inputEl?.focus(), 10);
    } else {
      inputText = '/' + cmd.cmd;
      send();
    }
  }

  function addEnzoMessage(content: string) {
    const session = getOrCreateSession();
    const msg: ChatMessage = {
      id: nanoid(), role: 'assistant', content,
      timestamp: Date.now(), model: 'system', tokens: 0
    };
    session.messages = [...session.messages, msg];
    scrollToBottom();
    store.saveChat();
  }

  async function executeCommand(cmd: EnzoCommand, args: string) {
    if (cmd.cmd === 'task') {
      if (!args) { inputText = '/task '; showPicker = false; inputEl?.focus(); return; }
      store.tasks = [{ id: nanoid(), text: args, done: false, noteId: null, createdAt: Date.now(), dueAt: null, priority: 'medium' }, ...store.tasks];
      await store.saveTasks();
      addEnzoMessage(`Added task: **${args}**`);
      return;
    }

    if (cmd.cmd === 'note') {
      if (!args) { inputText = '/note '; showPicker = false; inputEl?.focus(); return; }
      const note = { id: nanoid(), title: args.slice(0, 80), body: `# ${args}\n\n`, tags: [] as string[], createdAt: Date.now(), updatedAt: Date.now(), pinned: false, archived: false, audioIds: [] as string[] };
      store.notes = [note, ...store.notes];
      store.currentNoteId = note.id;
      await store.saveNotes();
      store.view = 'notes';
      store.enzoOpen = false;
      return;
    }

    if (cmd.cmd === 'log') {
      if (!args) { inputText = '/log '; showPicker = false; inputEl?.focus(); return; }
      store.journal = [{ id: nanoid(), body: args, mood: '', contextTag: 'Research', createdAt: Date.now(), updatedAt: Date.now(), audioIds: [] }, ...store.journal];
      await store.saveJournal();
      addEnzoMessage(`Journal entry added.`);
      return;
    }

    if (cmd.cmd === 'hyp') {
      if (!args) { inputText = '/hyp '; showPicker = false; inputEl?.focus(); return; }
      inputText = `I want to record this hypothesis: "${args}"\n\nCritically evaluate the mechanistic plausibility and suggest how to test it.`;
      await send();
      return;
    }

    if (cmd.cmd === 'read') {
      inputText = `I want to do a deep critical read. Here's the abstract — give me 5 pointed Socratic questions that force me to engage with the paper's design, controls, statistics, and implications:\n\n[paste abstract here]`;
      showPicker = false;
      inputEl?.focus();
      return;
    }

    if (cmd.cmd === 'critique') {
      inputText = `Critique this paper as a peer reviewer — evaluate research question, methodology, novelty, limitations, and give a verdict:\n\n[paste title and abstract here]`;
      showPicker = false;
      inputEl?.focus();
      return;
    }

    if (cmd.cmd === 'paper') {
      if (!args) { inputText = '/paper '; showPicker = false; inputEl?.focus(); return; }
      store.enzoSearchQuery = args;
      store.view = 'research';
      store.enzoOpen = false;
      return;
    }

    if (cmd.cmd === 'cite') {
      if (!args) { inputText = '/cite '; showPicker = false; inputEl?.focus(); return; }
      inputText = `Format a complete APA / Vancouver citation for: ${args}`;
      await send();
      return;
    }

    if (cmd.cmd === 'r') {
      if (!args) { inputText = '/r '; showPicker = false; inputEl?.focus(); return; }
      inputText = `Help me with this R code or question:\n\`\`\`r\n${args}\n\`\`\``;
      await send();
      return;
    }

    if (cmd.cmd === 'py') {
      if (!args) { inputText = '/py '; showPicker = false; inputEl?.focus(); return; }
      inputText = `Help me with this Python code or question:\n\`\`\`python\n${args}\n\`\`\``;
      await send();
      return;
    }

    if (cmd.cmd === 'code') {
      if (!args) { inputText = '/code '; showPicker = false; inputEl?.focus(); return; }
      inputText = `Generate complete, runnable analysis code for: ${args}`;
      await send();
      return;
    }

    if (cmd.cmd === 'draft') {
      if (!args) { inputText = '/draft '; showPicker = false; inputEl?.focus(); return; }
      inputText = `Draft scientific text for: ${args}`;
      await send();
      return;
    }

    if (cmd.cmd === 'abstract') {
      if (!args) { inputText = '/abstract '; showPicker = false; inputEl?.focus(); return; }
      inputText = `Draft a concise, high-impact abstract for a paper titled: "${args}"`;
      await send();
      return;
    }

    if (cmd.cmd === 'digest') {
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      const recentJournal = store.journal.filter(e => e.createdAt > sevenDaysAgo).slice(0, 5);
      const doneTasks = store.tasks.filter(t => t.done).slice(0, 8);
      const openTasks = store.tasks.filter(t => !t.done).slice(0, 6);
      inputText = `Generate my weekly research digest:\n\nJournal (${recentJournal.length} entries): ${recentJournal.map(e => e.body.replace(/<[^>]*>/g, ' ').slice(0, 80)).join(' | ') || 'none'}\nTasks done: ${doneTasks.map(t => t.text).join('; ') || 'none'}\nOpen tasks: ${openTasks.map(t => t.text).join('; ') || 'none'}\n\nInclude: This Week summary, Key themes, and Next Week suggestions.`;
      await send();
      return;
    }

    if (cmd.cmd === 'pi') {
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      const recentJournal = store.journal.filter(e => e.createdAt > sevenDaysAgo).slice(0, 5);
      const doneTasks = store.tasks.filter(t => t.done).slice(0, 8);
      const openTasks = store.tasks.filter(t => !t.done).slice(0, 6);
      const runs = store.pipelineRuns?.slice(0, 4) ?? [];
      inputText = `Draft a concise weekly progress email from me (Dr. Amritha Sathyanarayanan) to my PI. Write in first person.\n\nJournal notes: ${recentJournal.map(e => e.body.replace(/<[^>]*>/g, ' ').slice(0, 100)).join(' | ') || 'none'}\nCompleted: ${doneTasks.map(t => t.text).join('; ') || 'none'}\nIn progress: ${openTasks.map(t => t.text).join('; ') || 'none'}\nPipeline runs: ${runs.map((r: any) => `${r.title} (${r.status})`).join(', ') || 'none'}\n\nKeep it structured and under 350 words. Use plain text, not markdown.`;
      await send();
      return;
    }

    if (cmd.cmd === 'files') {
      const folders = [...new Set(store.files.map(f => f.folder || 'Unfiled'))];
      const parts = folders.map(folder => {
        const items = store.files.filter(f => (f.folder || 'Unfiled') === folder);
        return `**${folder}** (${items.length})\n${items.map(f => `  · ${f.name}${f.description ? ' — ' + f.description.slice(0, 60) : ''}`).join('\n')}`;
      });
      addEnzoMessage(parts.length > 0 ? `## Your files\n\n${parts.join('\n\n')}` : 'No files stored yet. Upload files in the Files section.');
      return;
    }

    if (cmd.cmd === 'find') {
      if (!args) { inputText = '/find '; showPicker = false; inputEl?.focus(); return; }
      const q = args.toLowerCase();
      const matches = store.files.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.tags.some((t: string) => t.toLowerCase().includes(q)) ||
        (f.folder || '').toLowerCase().includes(q)
      );
      if (matches.length === 0) {
        addEnzoMessage(`No files found matching **"${args}"**.`);
      } else {
        addEnzoMessage(`Found ${matches.length} file${matches.length > 1 ? 's' : ''} matching **"${args}"**:\n\n${matches.map(f => `· **${f.name}**${f.folder ? ` [${f.folder}]` : ''}${f.description ? ' — ' + f.description.slice(0, 80) : ''}`).join('\n')}`);
      }
      return;
    }

    if (cmd.cmd === 'send') {
      store.mailComposeOpen = true;
      store.enzoOpen = false;
      if (args) addEnzoMessage(`Opening compose for: **${args}**. I've opened the mail composer — fill in the details and I can draft the body if you need.`);
      return;
    }

    if (cmd.cmd === 'help') {
      const grouped: Record<string, EnzoCommand[]> = {};
      for (const c of COMMANDS) {
        if (!grouped[c.group]) grouped[c.group] = [];
        grouped[c.group].push(c);
      }
      const sections = Object.entries(grouped).map(([g, cmds]) =>
        `**${g.charAt(0).toUpperCase() + g.slice(1)}**\n${cmds.map(c => `\`${c.usage}\` — ${c.desc}`).join('\n')}`
      );
      addEnzoMessage(`## Enzo Commands\n\n${sections.join('\n\n')}`);
      return;
    }

    if (cmd.cmd === 'clear') {
      const session = store.chatSessions.find(s => s.id === todayKey);
      if (session) session.messages = [];
      await store.saveChat();
      return;
    }
  }

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

    // Intercept slash commands
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(/\s+/);
      const cmdName = parts[0].toLowerCase();
      const cmd = COMMANDS.find(c => c.cmd === cmdName);
      if (cmd) {
        inputText = '';
        showPicker = false;
        const args = parts.slice(1).join(' ');
        await executeCommand(cmd, args);
        return;
      }
    }

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

      const journalPart = useJournalContext && store.journal.length > 0
        ? [...store.journal]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 3)
            .map(e => {
              const d = new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              return `[${d}] ${e.body.slice(0, 300)}${e.body.length > 300 ? '…' : ''}`;
            })
            .join('\n\n')
        : '';

      const sevenDaysAgo = Date.now() - 7 * 86400000;
      const pastSessions = store.chatSessions
        .filter(s => s.date !== todayKey && new Date(s.date).getTime() > sevenDaysAgo)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      const memoryPart = pastSessions.length > 0
        ? pastSessions.map(s => {
            const d = new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            const userQ = s.messages.find(m => m.role === 'user')?.content.slice(0, 100) ?? '';
            const enzoA = s.messages.find(m => m.role === 'assistant')?.content.slice(0, 160) ?? '';
            return `[${d}] You: ${userQ}…\nEnzo: ${enzoA}…`;
          }).join('\n\n')
        : '';

      const VIEW_NAMES: Record<string, string> = {
        dashboard: 'Dashboard', notes: 'Notes', journal: 'Lab Journal', tasks: 'Tasks',
        research: 'Literature Research', pipeline: 'Pipeline & Hypotheses', jobs: 'Job Tracker',
        presentations: 'Presentations', files: 'Files', grants: 'Grants & Abstracts',
        manuscript: 'Manuscript Writing', audio: 'Audio', settings: 'Settings'
      };
      const viewCtx = `## Active section\nUser is currently in: ${VIEW_NAMES[store.view] ?? store.view}`;

      // Files index — give Enzo names, folders, tags, descriptions so she can answer "do I have..."
      const filesPart = store.files.length > 0
        ? store.files.slice(0, 60).map(f => {
            const parts = [f.name];
            if (f.folder) parts.push(`[${f.folder}]`);
            if (f.description) parts.push(`— ${f.description}`);
            if (f.tags.length > 0) parts.push(`#${f.tags.join(' #')}`);
            return parts.join(' ');
          }).join('\n')
        : '';

      const contextParts: string[] = [viewCtx];
      if (filesPart) contextParts.push(`## Stored files (index)\n${filesPart}`);
      if (journalPart) contextParts.push(`## Recent journal\n${journalPart}`);
      if (memoryPart) contextParts.push(`## Working memory — past 7 days\n${memoryPart}`);
      const journalContext = contextParts.join('\n\n');

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
    if (showPicker && pickerCmds.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        pickerSelected = Math.min(pickerSelected + 1, pickerCmds.length - 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        pickerSelected = Math.max(pickerSelected - 1, 0);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        selectCommand(pickerCmds[pickerSelected]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        showPicker = false;
        return;
      }
    }
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
  const hasWeeklyMemory = $derived((() => {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    return store.chatSessions.some(s => s.date !== todayKey && new Date(s.date).getTime() > sevenDaysAgo);
  })());
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
    {#if store.currentNote || hasJournal || hasWeeklyMemory}
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
            title={useJournalContext ? 'Journal + 7-day memory on — click to disable' : 'Journal + 7-day memory off — click to enable'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
            </svg>
            {useJournalContext ? (hasWeeklyMemory ? 'journal + memory' : 'journal') : 'context off'}
          </button>
        {/if}
      </div>
    {/if}

    <!-- Command picker -->
    {#if showPicker && pickerCmds.length > 0}
      <div class="cmd-picker" bind:this={pickerEl} role="listbox" aria-label="Commands">
        {#each pickerCmds as cmd, i}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_interactive_supports_focus -->
          <div
            class="cmd-item"
            class:cmd-item-active={i === pickerSelected}
            role="option"
            aria-selected={i === pickerSelected}
            tabindex={i === pickerSelected ? 0 : -1}
            onclick={() => selectCommand(cmd)}
            onmouseenter={() => pickerSelected = i}
          >
            <span class="cmd-name">/{cmd.cmd}</span>
            <span class="cmd-desc">{cmd.desc}</span>
            <span class="cmd-group">{cmd.group}</span>
          </div>
        {/each}
        <div class="cmd-footer">↑↓ navigate · Tab/↵ select · Esc close</div>
      </div>
    {/if}

    <!-- Input -->
    <div class="enzo-input-row">
      <textarea
        bind:value={inputText}
        bind:this={inputEl}
        onkeydown={handleKey}
        oninput={onInputChange}
        placeholder="Ask Enzo… or type / for commands"
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

  /* ── Command picker ── */
  .cmd-picker {
    border-top: 1px solid var(--bd);
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    max-height: 240px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .cmd-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    cursor: pointer;
    transition: background var(--transition);
    user-select: none;
  }
  .cmd-item:hover, .cmd-item-active {
    background: var(--enzo-bg);
  }

  .cmd-name {
    font-size: 0.82rem;
    font-weight: 700;
    font-family: var(--mono);
    color: var(--enzo);
    min-width: 72px;
    flex-shrink: 0;
  }

  .cmd-desc {
    flex: 1;
    font-size: 0.78rem;
    color: var(--tx2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cmd-group {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mu);
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 8px;
    padding: 1px 6px;
    flex-shrink: 0;
  }

  .cmd-footer {
    padding: 5px 14px;
    font-size: 0.62rem;
    color: var(--mu);
    border-top: 1px solid var(--bd);
    background: var(--sf2);
  }
</style>
