<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { askEnzoInline } from '../lib/groq';
  import type { Editor } from '@tiptap/core';
  import type { Task, Protocol, PipelineRun, Hypothesis } from '../lib/types';

  let {
    query,
    x,
    y,
    slashFrom,
    slashTo,
    getEditor,
    noteId,
    noteHtml,
    showToast,
    onClose,
  }: {
    query: string;
    x: number;
    y: number;
    slashFrom: number;
    slashTo: number;
    getEditor: () => Editor | null;
    noteId: string;
    noteHtml: string;
    showToast: (msg: string, type?: 'success' | 'error') => void;
    onClose: () => void;
  } = $props();

  // ── Step management ─────────────────────────────────────────
  type Step = 'list' | 'enzo' | 'param';
  let step = $state<Step>('list');
  let paramCmd = $state<SlashCmd | null>(null);
  let paramVal = $state('');
  let paramVal2 = $state('');
  let enzoMode = $state<string>('');
  let enzoLoading = $state(false);
  let selected = $state(0);

  // ── Note helpers ───────────────────────────────────────────
  function notePlain(): string {
    return noteHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  }

  function noteTitle(): string {
    return store.notes.find(n => n.id === noteId)?.title ?? 'Untitled';
  }

  // ── Delete slash text and run a chain ─────────────────────
  function exec(fn: (e: Editor) => void) {
    const editor = getEditor();
    if (!editor) return;
    editor.chain().focus().deleteRange({ from: slashFrom, to: slashTo }).run();
    fn(editor);
    onClose();
  }

  function execInsert(html: string) {
    exec(e => e.chain().focus().insertContent(html).run());
  }

  // ── Format helpers ─────────────────────────────────────────
  function fmtDate() {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fmtDateTime() {
    return new Date().toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function fmtTime() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Command definitions ────────────────────────────────────
  interface SlashCmd {
    id: string;
    label: string;
    desc: string;
    category: 'format' | 'insert' | 'research' | 'action' | 'ai';
    icon: string;
    keywords: string[];
    hasParam?: boolean;
    paramLabel?: string;
    param2Label?: string;
    run: (param?: string, param2?: string) => void | Promise<void>;
  }

  const COMMANDS: SlashCmd[] = [
    // ── Format ──────────────────────────────────────────────
    {
      id: 'h1', label: 'Heading 1', desc: 'Large section title',
      category: 'format', icon: 'M4 6h1v4m0 0h4m0 0V6h1m-6 0V6M14 6v4m0 0h4m0 0V6h1',
      keywords: ['heading', 'h1', 'title'],
      run: () => exec(e => e.chain().focus().toggleHeading({ level: 1 }).run()),
    },
    {
      id: 'h2', label: 'Heading 2', desc: 'Medium section title',
      category: 'format', icon: 'M4 6h1v4m0 0h4m0 0V6h1m-6 0V6M14 6v4m0 0h4m0 0V6h1',
      keywords: ['heading', 'h2'],
      run: () => exec(e => e.chain().focus().toggleHeading({ level: 2 }).run()),
    },
    {
      id: 'h3', label: 'Heading 3', desc: 'Small section title',
      category: 'format', icon: 'M4 6h1v4m0 0h4m0 0V6h1m-6 0V6M14 6v4m0 0h4m0 0V6h1',
      keywords: ['heading', 'h3'],
      run: () => exec(e => e.chain().focus().toggleHeading({ level: 3 }).run()),
    },
    {
      id: 'bullet', label: 'Bullet list', desc: 'Unordered list',
      category: 'format', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
      keywords: ['bullet', 'list', 'ul'],
      run: () => exec(e => e.chain().focus().toggleBulletList().run()),
    },
    {
      id: 'numbered', label: 'Numbered list', desc: 'Ordered list',
      category: 'format', icon: 'M10 6h11M10 12h11M10 18h11M4 6h1v4m0 0H4m1 0h1',
      keywords: ['numbered', 'ordered', 'ol'],
      run: () => exec(e => e.chain().focus().toggleOrderedList().run()),
    },
    {
      id: 'tasklist', label: 'Task list', desc: 'Checkboxes — synced to Tasks',
      category: 'format', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      keywords: ['task', 'todo', 'checkbox'],
      run: () => exec(e => e.chain().focus().toggleTaskList().run()),
    },
    {
      id: 'quote', label: 'Blockquote', desc: 'Indented quote block',
      category: 'format', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      keywords: ['quote', 'blockquote'],
      run: () => exec(e => e.chain().focus().toggleBlockquote().run()),
    },
    {
      id: 'code', label: 'Code block', desc: 'Monospace code',
      category: 'format', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
      keywords: ['code', 'pre', 'block'],
      run: () => exec(e => e.chain().focus().toggleCodeBlock().run()),
    },
    {
      id: 'table', label: 'Table', desc: '3×3 table',
      category: 'format', icon: 'M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 00-1 2v8a3 3 0 001 2h18',
      keywords: ['table', 'grid'],
      run: () => exec(e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()),
    },
    {
      id: 'divider', label: 'Divider', desc: 'Horizontal rule',
      category: 'format', icon: 'M5 12h14',
      keywords: ['divider', 'hr', 'line', 'separator'],
      run: () => exec(e => e.chain().focus().setHorizontalRule().run()),
    },
    {
      id: 'callout', label: 'Callout', desc: 'Highlighted note-to-self block',
      category: 'format', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      keywords: ['callout', 'note', 'info', 'tip'],
      run: () => execInsert('<blockquote><p>💡 <strong>Note:</strong> </p></blockquote>'),
    },

    // ── Insert ───────────────────────────────────────────────
    {
      id: 'date', label: "Today's date", desc: `Insert ${fmtDate()}`,
      category: 'insert', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      keywords: ['date', 'today'],
      run: () => execInsert(`<p>${fmtDate()}</p>`),
    },
    {
      id: 'datetime', label: 'Date & time', desc: `Insert ${fmtDateTime()}`,
      category: 'insert', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      keywords: ['datetime', 'timestamp', 'now'],
      run: () => execInsert(`<p>${fmtDateTime()}</p>`),
    },
    {
      id: 'time', label: 'Current time', desc: `Insert ${fmtTime()}`,
      category: 'insert', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      keywords: ['time', 'clock'],
      run: () => execInsert(`<p>${fmtTime()}</p>`),
    },
    {
      id: 'progress', label: 'Progress bar', desc: '/progress 3/10 Label',
      category: 'insert', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      keywords: ['progress', 'bar', 'percent'],
      hasParam: true, paramLabel: 'value/total label (e.g. 3/10 Grant draft)',
      run: (p) => {
        const m = (p || '').match(/^(\d+)\s*\/\s*(\d+)\s*(.*)/);
        if (!m) { execInsert('<p>▓▓▓░░░░░░░ 30%</p>'); return; }
        const [, val, total, label] = m;
        const pct = Math.round((+val / +total) * 100);
        const filled = Math.round(pct / 10);
        const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
        execInsert(`<p><code>${bar} ${pct}%${label ? ` — ${label}` : ''}</code></p>`);
      },
    },

    // ── Research ─────────────────────────────────────────────
    {
      id: 'hypothesis', label: 'Hypothesis block', desc: 'Structured hypothesis template',
      category: 'research', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
      keywords: ['hypothesis', 'theory', 'claim'],
      run: () => execInsert(
        '<h3>Hypothesis</h3>' +
        '<blockquote><p><em>State your hypothesis here…</em></p></blockquote>' +
        '<p><strong>Rationale:</strong> </p>' +
        '<p><strong>Predicted outcome:</strong> </p>' +
        '<p><strong>Testing approach:</strong> </p>' +
        '<p><strong>Potential pitfalls:</strong> </p>'
      ),
    },
    {
      id: 'protocol', label: 'Protocol steps', desc: 'Numbered protocol with controls & QC',
      category: 'research', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      keywords: ['protocol', 'steps', 'procedure', 'method'],
      run: () => execInsert(
        '<h3>Protocol: </h3>' +
        '<p><strong>Materials:</strong> </p>' +
        '<p><strong>Steps:</strong></p>' +
        '<ol><li>Step 1</li><li>Step 2</li><li>Step 3</li></ol>' +
        '<p><strong>Controls:</strong> </p>' +
        '<p><strong>QC criteria:</strong> </p>' +
        '<p><strong>Notes:</strong> </p>'
      ),
    },
    {
      id: 'experiment', label: 'Experiment design', desc: 'Full experiment template',
      category: 'research', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
      keywords: ['experiment', 'design', 'study'],
      run: () => execInsert(
        '<h3>Experiment: </h3>' +
        '<p><strong>Hypothesis:</strong> </p>' +
        '<p><strong>Rationale:</strong> </p>' +
        '<h3>Protocol</h3>' +
        '<p><strong>Materials:</strong> </p>' +
        '<ol><li>Step 1</li></ol>' +
        '<p><strong>Controls:</strong> </p>' +
        '<p><strong>Expected readout:</strong> </p>' +
        '<p><strong>QC criteria:</strong> </p>' +
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"> </li></ul>'
      ),
    },
    {
      id: 'gene', label: 'Gene name', desc: 'Styled inline gene chip',
      category: 'research', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
      keywords: ['gene', 'protein', 'marker'],
      hasParam: true, paramLabel: 'Gene symbol (e.g. BRCA1)',
      run: (p) => execInsert(`<code>${(p || 'GENE').toUpperCase()}</code>`),
    },

    // ── Actions ──────────────────────────────────────────────
    {
      id: 'task', label: 'Create task', desc: 'Add to Tasks, linked to this note',
      category: 'action', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      keywords: ['task', 'todo', 'action'],
      hasParam: true, paramLabel: 'Task description',
      run: async (p) => {
        const text = p?.trim();
        if (!text) return;
        const task: Task = {
          id: nanoid(), text, done: false, noteId,
          createdAt: Date.now(), dueAt: null, priority: 'medium',
        };
        store.tasks = [task, ...store.tasks];
        await store.saveTasks();
        execInsert(`<ul data-type="taskList"><li data-type="taskItem" data-checked="false">${text}</li></ul>`);
        showToast('Task created');
      },
    },
    {
      id: 'alarm', label: 'Set alarm', desc: 'Set a timed alarm from here',
      category: 'action', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      keywords: ['alarm', 'timer', 'remind', 'alert'],
      hasParam: true, paramLabel: 'Time (HH:MM)', param2Label: 'Label',
      run: async (p, p2) => {
        const time = p?.trim() || '';
        const label = p2?.trim() || noteTitle();
        if (!/^\d{1,2}:\d{2}$/.test(time)) { showToast('Use HH:MM format', 'error'); return; }
        const hhmm = time.padStart(5, '0');
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        const alarm = { id: nanoid(), time: hhmm, label, enabled: true };
        store.settings.alarms = [...(store.settings.alarms ?? []), alarm];
        await store.saveSettings?.();
        execInsert(`<p>⏰ <strong>Alarm set:</strong> ${label} @ ${hhmm}</p>`);
        showToast(`Alarm set for ${hhmm}`);
      },
    },
    {
      id: 'remind', label: 'Set reminder', desc: 'Date-based browser notification',
      category: 'action', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      keywords: ['remind', 'reminder', 'date', 'schedule'],
      hasParam: true, paramLabel: 'Date (YYYY-MM-DD)', param2Label: 'Message',
      run: async (p, p2) => {
        const date = p?.trim() || '';
        const msg = p2?.trim() || noteTitle();
        if (!date) { showToast('Enter a date', 'error'); return; }
        const ts = new Date(date).getTime();
        if (isNaN(ts)) { showToast('Invalid date', 'error'); return; }
        const reminders = JSON.parse(localStorage.getItem('qonco-reminders') || '[]');
        reminders.push({ id: nanoid(), ts, msg, noteId });
        localStorage.setItem('qonco-reminders', JSON.stringify(reminders));
        const formatted = new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        execInsert(`<p>📅 <strong>Reminder:</strong> ${msg} — ${formatted}</p>`);
        showToast('Reminder saved');
      },
    },
    {
      id: 'timer', label: 'Start timer', desc: 'Countdown timer (Pomodoro-style)',
      category: 'action', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      keywords: ['timer', 'countdown', 'pomodoro', 'focus'],
      hasParam: true, paramLabel: 'Minutes (default 25)',
      run: (p) => {
        const mins = parseInt(p || '25') || 25;
        execInsert(`<p>⏱ <strong>Timer started:</strong> ${mins} min — ${fmtTime()}</p>`);
        // Fire a notification when done (via setTimeout)
        const ms = mins * 60 * 1000;
        setTimeout(() => {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Q·onco — Timer done', {
              body: `${mins}-minute timer from "${noteTitle()}" is up.`,
              icon: '/icon-192.png',
            });
          }
          showToast(`⏱ ${mins}-min timer done`);
        }, ms);
        showToast(`Timer started: ${mins} min`);
      },
    },
    {
      id: 'deadline', label: 'Deadline', desc: 'Insert countdown deadline block',
      category: 'action', icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
      keywords: ['deadline', 'due', 'date', 'grant'],
      hasParam: true, paramLabel: 'Date (YYYY-MM-DD)', param2Label: 'Label',
      run: (p, p2) => {
        const date = p?.trim() || '';
        const label = p2?.trim() || 'Deadline';
        const ts = new Date(date).getTime();
        if (isNaN(ts)) { execInsert(`<p>⚑ <strong>${label}</strong></p>`); return; }
        const days = Math.ceil((ts - Date.now()) / 86400000);
        const formatted = new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const urgency = days < 0 ? 'overdue' : days <= 3 ? 'critical' : days <= 7 ? 'soon' : 'ok';
        const emoji = days < 0 ? '🔴' : days <= 3 ? '🟠' : days <= 7 ? '🟡' : '🟢';
        execInsert(`<p>${emoji} <strong>${label}</strong> — ${formatted} (${days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`})</p>`);
      },
    },

    // ── AI / Enzo ────────────────────────────────────────────
    {
      id: 'enzo', label: 'Ask Enzo', desc: 'Enzo reads this note and acts',
      category: 'ai', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
      keywords: ['enzo', 'ai', 'ask', 'summarise', 'critique', 'expand', 'keywords'],
      run: (p) => {
        if (p?.trim()) {
          enzoMode = p.trim();
          runEnzoFreeText(p.trim());
        } else {
          step = 'enzo';
        }
      },
    },
    {
      id: 'ask', label: 'Inline question', desc: 'Enzo answers inline (no chat)',
      category: 'ai', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      keywords: ['ask', 'question', 'inline', 'query'],
      hasParam: true, paramLabel: 'Question for Enzo',
      run: (p) => { if (p?.trim()) runEnzoFreeText(p.trim()); },
    },
  ];

  // ── Enzo sub-menu options ─────────────────────────────────
  interface EnzoOption {
    id: string;
    label: string;
    desc: string;
    prompt: string;
    isRoute?: boolean;
    routeTarget?: string;
  }

  const ENZO_OPTIONS: EnzoOption[] = [
    { id: 'summarise',  label: 'Summarise',        desc: 'TL;DR of this note',                  prompt: 'Write a concise summary (3–5 sentences) of this note. Focus on the key scientific points.' },
    { id: 'critique',   label: 'Critique',          desc: 'Challenge the reasoning',              prompt: 'Critically review this note. Identify logical gaps, unsupported claims, missing controls, or alternative explanations. Be rigorous.' },
    { id: 'expand',     label: 'Expand',            desc: 'Elaborate the main idea',              prompt: 'Expand the main idea in this note into a more complete scientific paragraph. Add mechanistic detail and relevant context.' },
    { id: 'keywords',   label: 'Extract keywords',  desc: 'Key terms → offer as tags',            prompt: 'Extract 5–8 specific scientific keywords and concepts from this note. Return them as a comma-separated list, lowercase, no explanations.' },
    { id: 'next-steps', label: 'Next steps',        desc: 'Suggest what to do next',              prompt: 'Based on this note, suggest 3–5 concrete next experimental or analytical steps. Be specific, actionable, and scientifically grounded.' },
    { id: 'abstract',   label: 'Draft abstract',    desc: 'Turn note into a mini abstract',       prompt: 'Draft a scientific abstract (150–200 words) based on the content of this note. Use the standard Background/Objective/Methods/Results/Conclusion structure.' },
    { id: 'gaps',       label: 'Research gaps',     desc: 'What is missing or unknown',           prompt: 'Identify the key research gaps and open questions surfaced by this note. What is still unknown? What experiments are missing?' },
    { id: 'methods',    label: 'Suggest methods',   desc: 'Methods to test the hypothesis',       prompt: 'Suggest specific experimental or computational methods to test the hypotheses or answer the questions in this note. Include both primary and validation approaches.' },
    // ── Store routing ───────────────────────────────────────
    { id: 'to-task',    label: 'Extract → Tasks',   desc: 'Parse action items into Tasks',        prompt: 'Extract all action items, to-dos, and next steps from this note as a JSON array: [{"text": "...", "priority": "high|medium|low"}]. Return ONLY the JSON array, nothing else.', isRoute: true, routeTarget: 'tasks' },
    { id: 'to-hypo',    label: 'Extract → Hypothesis', desc: 'Save as hypothesis in Pipeline',    prompt: 'Extract the core scientific hypothesis from this note. Return JSON: {"text": "hypothesis statement", "rationale": "brief rationale"}. Return ONLY the JSON, nothing else.', isRoute: true, routeTarget: 'hypothesis' },
    { id: 'to-protocol',label: 'Save → Protocol',   desc: 'Create protocol from note steps',      prompt: 'Extract a research protocol from this note as JSON: {"title": "...", "type": "custom", "body": "markdown steps"}. Return ONLY the JSON, nothing else.', isRoute: true, routeTarget: 'protocol' },
    { id: 'to-pipeline',label: 'Add → Pipeline run',desc: 'Create pipeline run from note',        prompt: 'Extract pipeline run details from this note as JSON: {"title": "...", "pipelineType": "scrna-seq|spatial|bulk-rna|wes|custom", "sampleDescription": "...", "notes": "..."}. Return ONLY the JSON, nothing else.', isRoute: true, routeTarget: 'pipeline' },
  ];

  let enzoQuery = $state('');
  let enzoSelected = $state(0);

  let enzoFilteredOptions = $derived(
    enzoQuery
      ? ENZO_OPTIONS.filter(o =>
          o.id.includes(enzoQuery.toLowerCase()) ||
          o.label.toLowerCase().includes(enzoQuery.toLowerCase()) ||
          o.desc.toLowerCase().includes(enzoQuery.toLowerCase())
        )
      : ENZO_OPTIONS
  );

  // ── Enzo execution ─────────────────────────────────────────
  async function runEnzoOption(opt: EnzoOption) {
    enzoLoading = true;
    enzoMode = opt.label;
    const editor = getEditor();
    if (!editor) { enzoLoading = false; onClose(); return; }
    editor.chain().focus().deleteRange({ from: slashFrom, to: slashTo }).run();

    try {
      const result = await askEnzoInline(opt.prompt, notePlain());
      if (opt.isRoute) {
        await routeEnzoResult(opt.routeTarget!, result);
      } else {
        // Insert inline result
        const header = `<p><strong>🐾 Enzo · ${opt.label}</strong></p>`;
        let body = result.trim();
        // Wrap in blockquote
        const paragraphs = body.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
        editor.chain().focus().insertContent(`<blockquote>${header}${paragraphs}</blockquote>`).run();
      }
    } catch (err: any) {
      showToast(err.message || 'Enzo error', 'error');
    } finally {
      enzoLoading = false;
      onClose();
    }
  }

  async function runEnzoFreeText(instruction: string) {
    enzoLoading = true;
    const editor = getEditor();
    if (!editor) { enzoLoading = false; onClose(); return; }
    editor.chain().focus().deleteRange({ from: slashFrom, to: slashTo }).run();
    try {
      const result = await askEnzoInline(instruction, notePlain());
      const paragraphs = result.trim().split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
      editor.chain().focus().insertContent(`<blockquote><p><strong>🐾 Enzo:</strong></p>${paragraphs}</blockquote>`).run();
    } catch (err: any) {
      showToast(err.message || 'Enzo error', 'error');
    } finally {
      enzoLoading = false;
      onClose();
    }
  }

  async function routeEnzoResult(target: string, raw: string) {
    // Strip code fences if model wrapped it
    const json = raw.replace(/```(?:json)?/g, '').trim();
    try {
      const data = JSON.parse(json);
      if (target === 'tasks') {
        const items: { text: string; priority?: string }[] = Array.isArray(data) ? data : [data];
        const newTasks: Task[] = items.map(item => ({
          id: nanoid(), text: item.text, done: false, noteId,
          createdAt: Date.now(), dueAt: null,
          priority: (item.priority as Task['priority']) || 'medium',
        }));
        store.tasks = [...newTasks, ...store.tasks];
        await store.saveTasks();
        showToast(`${newTasks.length} task${newTasks.length !== 1 ? 's' : ''} added`);
        getEditor()?.chain().focus().insertContent(`<p>✓ <strong>${newTasks.length} task${newTasks.length !== 1 ? 's' : ''}</strong> added to Tasks</p>`).run();
      } else if (target === 'hypothesis') {
        const hyp: Hypothesis = {
          id: nanoid(), text: data.text || 'Hypothesis', rationale: data.rationale || '',
          status: 'active', result: '', linkedNotes: [noteId],
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        store.hypotheses = [hyp, ...store.hypotheses];
        await store.savePipelines();
        showToast('Hypothesis saved to Pipeline');
        getEditor()?.chain().focus().insertContent(`<p>✓ <strong>Hypothesis</strong> saved to Pipeline</p>`).run();
      } else if (target === 'protocol') {
        const proto: Protocol = {
          id: nanoid(), title: data.title || noteTitle(),
          type: data.type || 'custom', version: '1.0',
          body: data.body || '', tags: [], source: '',
          isTemplate: false, createdAt: Date.now(), updatedAt: Date.now(),
        };
        store.protocols = [proto, ...store.protocols];
        await store.savePipelines();
        showToast('Protocol saved to Pipeline');
        getEditor()?.chain().focus().insertContent(`<p>✓ <strong>Protocol "${proto.title}"</strong> saved</p>`).run();
      } else if (target === 'pipeline') {
        const run: PipelineRun = {
          id: nanoid(), title: data.title || noteTitle(),
          sampleId: '', sampleDescription: data.sampleDescription || '',
          organism: 'Homo sapiens', tissue: '', condition: '',
          pipelineType: data.pipelineType || 'custom',
          protocolId: null, status: 'planned',
          steps: [], qcMetrics: [],
          noteId, journalIds: [], audioIds: [], paperDois: [],
          tags: [], notes: data.notes || '',
          createdAt: Date.now(), updatedAt: Date.now(), completedAt: null,
        };
        store.pipelineRuns = [run, ...store.pipelineRuns];
        await store.savePipelines();
        showToast('Pipeline run created');
        getEditor()?.chain().focus().insertContent(`<p>✓ <strong>Pipeline run "${run.title}"</strong> created</p>`).run();
      }
    } catch {
      showToast('Could not parse Enzo response', 'error');
      getEditor()?.chain().focus().insertContent(`<blockquote><p><strong>🐾 Enzo:</strong></p><p>${raw}</p></blockquote>`).run();
    }
  }

  // ── Filtering ──────────────────────────────────────────────
  const filtered = $derived(
    (() => {
      const q = query.trim().toLowerCase();
      if (!q) return COMMANDS;
      return COMMANDS.filter(c =>
        c.id.startsWith(q) ||
        c.label.toLowerCase().includes(q) ||
        c.keywords.some(k => k.includes(q))
      );
    })()
  );

  $effect(() => {
    // Reset selection when filter changes
    selected = 0;
  });

  // ── Param mode ─────────────────────────────────────────────
  function openParam(cmd: SlashCmd) {
    paramCmd = cmd;
    paramVal = query.startsWith(cmd.id) ? query.slice(cmd.id.length).trim() : '';
    paramVal2 = '';
    step = 'param';
  }

  function confirmParam() {
    paramCmd?.run(paramVal, paramVal2);
  }

  // ── Keyboard navigation ────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (step === 'list') {
      if (e.key === 'ArrowDown') { e.preventDefault(); selected = (selected + 1) % filtered.length; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selected = (selected - 1 + filtered.length) % filtered.length; }
      else if (e.key === 'Enter') { e.preventDefault(); pick(filtered[selected]); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    } else if (step === 'enzo') {
      if (e.key === 'ArrowDown') { e.preventDefault(); enzoSelected = (enzoSelected + 1) % enzoFilteredOptions.length; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); enzoSelected = (enzoSelected - 1 + enzoFilteredOptions.length) % enzoFilteredOptions.length; }
      else if (e.key === 'Enter') { e.preventDefault(); runEnzoOption(enzoFilteredOptions[enzoSelected]); }
      else if (e.key === 'Escape') { e.preventDefault(); step = 'list'; }
    } else if (step === 'param') {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmParam(); }
      else if (e.key === 'Escape') { e.preventDefault(); step = 'list'; }
    }
  }

  function pick(cmd: SlashCmd | undefined) {
    if (!cmd) return;
    // If it needs params and none were provided via inline query, show param step
    if (cmd.hasParam && !query.slice(cmd.id.length).trim()) {
      openParam(cmd);
    } else {
      const param = query.startsWith(cmd.id) ? query.slice(cmd.id.length).trim() : undefined;
      cmd.run(param);
    }
  }

  const CATEGORY_COLORS: Record<string, string> = {
    format: 'var(--mu)', insert: 'var(--ac)', research: 'var(--gn)', action: 'var(--yw)', ai: 'var(--enzo)',
  };

  // ── Position ───────────────────────────────────────────────
  // Clamp so the menu never falls off screen
  const menuX = $derived(Math.min(x, window.innerWidth - 310));
  const menuY = $derived(y + 6);
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="slash-menu"
  style="left: {menuX}px; top: {menuY}px"
  onclick={(e) => e.stopPropagation()}
>
  {#if enzoLoading}
    <!-- Loading state -->
    <div class="slash-loading">
      <div class="enzo-spin"></div>
      <span>Enzo · {enzoMode || 'thinking'}…</span>
    </div>

  {:else if step === 'enzo'}
    <!-- Enzo sub-menu -->
    <div class="slash-header">
      <span class="slash-header-label">🐾 Ask Enzo</span>
      <button class="slash-back" onclick={() => step = 'list'}>← back</button>
    </div>
    <div class="enzo-search-wrap">
      <input
        class="enzo-search"
        bind:value={enzoQuery}
        placeholder="Filter or type a free instruction…"
        autofocus
      />
    </div>
    <div class="slash-list">
      {#each enzoFilteredOptions as opt, i}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          class="slash-item"
          class:slash-selected={i === enzoSelected}
          onclick={() => runEnzoOption(opt)}
          onmouseenter={() => enzoSelected = i}
        >
          <div class="slash-item-info">
            <span class="slash-item-label">{opt.label}</span>
            <span class="slash-item-desc">{opt.desc}</span>
          </div>
          {#if opt.isRoute}
            <span class="slash-route-badge">→ store</span>
          {/if}
        </div>
      {/each}
      {#if enzoQuery.trim()}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          class="slash-item slash-item-free"
          class:slash-selected={enzoSelected === enzoFilteredOptions.length}
          onclick={() => runEnzoFreeText(enzoQuery)}
        >
          <div class="slash-item-info">
            <span class="slash-item-label">"{enzoQuery}"</span>
            <span class="slash-item-desc">Free instruction — note as context</span>
          </div>
        </div>
      {/if}
    </div>

  {:else if step === 'param'}
    <!-- Parameter form -->
    <div class="slash-header">
      <span class="slash-header-label">{paramCmd?.label}</span>
      <button class="slash-back" onclick={() => step = 'list'}>← back</button>
    </div>
    <div class="param-form">
      <input
        class="param-input"
        bind:value={paramVal}
        placeholder={paramCmd?.paramLabel ?? 'Value'}
        autofocus
        onkeydown={(e) => { if (e.key === 'Enter' && !paramCmd?.param2Label) { e.stopPropagation(); confirmParam(); } }}
      />
      {#if paramCmd?.param2Label}
        <input
          class="param-input"
          bind:value={paramVal2}
          placeholder={paramCmd.param2Label}
          onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); confirmParam(); } }}
        />
      {/if}
      <button class="btn btn-primary btn-sm param-submit" onclick={confirmParam}>
        Insert ↵
      </button>
    </div>

  {:else}
    <!-- Command list -->
    {#if filtered.length === 0}
      <div class="slash-empty">No command matches "{query}"</div>
    {:else}
      <div class="slash-list">
        {#each filtered as cmd, i}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            class="slash-item"
            class:slash-selected={i === selected}
            onclick={() => pick(cmd)}
            onmouseenter={() => selected = i}
          >
            <div class="slash-icon" style="color: {CATEGORY_COLORS[cmd.category]}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d={cmd.icon}/>
              </svg>
            </div>
            <div class="slash-item-info">
              <span class="slash-item-label">{cmd.label}</span>
              <span class="slash-item-desc">{cmd.desc}</span>
            </div>
            <span class="slash-cat" style="color: {CATEGORY_COLORS[cmd.category]}">{cmd.category}</span>
          </div>
        {/each}
      </div>
      <div class="slash-footer">↑↓ navigate · ↵ select · Esc dismiss</div>
    {/if}
  {/if}
</div>

<style>
  .slash-menu {
    position: fixed;
    z-index: 500;
    width: 300px;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    box-shadow: 0 16px 48px rgba(0,0,0,0.22);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .slash-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .slash-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    cursor: pointer;
    transition: background var(--transition);
    min-height: 44px;
  }
  .slash-item:hover, .slash-selected {
    background: var(--sf2);
  }
  .slash-selected { background: var(--ac-bg) !important; }

  .slash-icon { flex-shrink: 0; display: flex; align-items: center; }
  .slash-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .slash-item-label { font-size: 0.82rem; font-weight: 500; color: var(--tx); }
  .slash-item-desc { font-size: 0.72rem; color: var(--mu); }
  .slash-cat {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }
  .slash-route-badge {
    font-size: 0.62rem;
    font-weight: 700;
    background: var(--enzo-bg);
    color: var(--enzo);
    border-radius: 6px;
    padding: 1px 5px;
    flex-shrink: 0;
  }
  .slash-item-free { border-top: 1px solid var(--bd); }

  .slash-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf2);
  }
  .slash-header-label { font-size: 0.78rem; font-weight: 600; color: var(--enzo); }
  .slash-back {
    font-size: 0.72rem;
    color: var(--mu);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }
  .slash-back:hover { color: var(--ac); background: var(--ac-bg); }

  .slash-footer {
    font-size: 0.65rem;
    color: var(--mu);
    padding: 5px 12px;
    border-top: 1px solid var(--bd);
    text-align: center;
    background: var(--sf2);
  }

  .slash-empty { padding: 20px 12px; text-align: center; font-size: 0.8rem; color: var(--mu); }

  .slash-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    font-size: 0.82rem;
    color: var(--enzo);
  }
  .enzo-spin {
    width: 16px; height: 16px;
    border: 2px solid var(--enzo-bd);
    border-top-color: var(--enzo);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Enzo sub-menu search */
  .enzo-search-wrap { padding: 8px 10px; border-bottom: 1px solid var(--bd); }
  .enzo-search { font-size: 0.82rem !important; padding: 5px 8px !important; }

  /* Param form */
  .param-form { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; }
  .param-input { font-size: 0.85rem !important; }
  .param-submit { align-self: flex-end; }
</style>
