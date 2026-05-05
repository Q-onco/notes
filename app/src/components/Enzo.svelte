<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { askEnzo, getAllTokenUsage, DAILY_TOKEN_REF } from '../lib/groq';
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
    // ── Capture ──────────────────────────────────────────────────
    { cmd: 'task',       usage: '/task <description>',          desc: 'Add a task',                        group: 'capture',    needsArg: true  },
    { cmd: 'note',       usage: '/note <title>',                desc: 'Create a note and open it',        group: 'capture',    needsArg: true  },
    { cmd: 'log',        usage: '/log <entry>',                 desc: 'Add a lab journal entry',           group: 'capture',    needsArg: true  },
    { cmd: 'idea',       usage: '/idea <text>',                 desc: 'Capture a quick idea',              group: 'capture',    needsArg: true  },
    { cmd: 'hyp',        usage: '/hyp <hypothesis>',            desc: 'Record & evaluate a hypothesis',    group: 'capture',    needsArg: true  },
    { cmd: 'todo',       usage: '/todo',                        desc: 'List all open tasks by priority',   group: 'capture',    needsArg: false },
    { cmd: 'today',      usage: '/today',                       desc: "Today's tasks + journal snapshot",  group: 'capture',    needsArg: false },
    // ── Research ─────────────────────────────────────────────────
    { cmd: 'read',       usage: '/read',                        desc: 'Deep read — paste abstract',        group: 'research',   needsArg: false },
    { cmd: 'critique',   usage: '/critique',                    desc: 'Peer-review critique — paste abstract', group: 'research', needsArg: false },
    { cmd: 'reading',    usage: '/reading',                     desc: 'Generate structured reading note',  group: 'research',   needsArg: false },
    { cmd: 'devil',      usage: '/devil <hypothesis>',          desc: "Devil's advocate on a hypothesis",  group: 'research',   needsArg: true  },
    { cmd: 'paper',      usage: '/paper <query>',               desc: 'Search literature',                 group: 'research',   needsArg: true  },
    { cmd: 'pubmed',     usage: '/pubmed <query>',              desc: 'Search PubMed',                     group: 'research',   needsArg: true  },
    { cmd: 'cite',       usage: '/cite <DOI or title>',         desc: 'Format a citation (APA/Vancouver)', group: 'research',   needsArg: true  },
    { cmd: 'explain',    usage: '/explain <term or concept>',   desc: 'Explain a scientific concept',      group: 'research',   needsArg: true  },
    { cmd: 'compare',    usage: '/compare <A> vs <B>',          desc: 'Compare two methods or concepts',   group: 'research',   needsArg: true  },
    { cmd: 'mechanism',  usage: '/mechanism <pathway or drug>', desc: 'Deep-dive mechanism of action',     group: 'research',   needsArg: true  },
    // ── Analysis ─────────────────────────────────────────────────
    { cmd: 'r',          usage: '/r <code or question>',        desc: 'R / Seurat / Bioconductor help',    group: 'analysis',   needsArg: true  },
    { cmd: 'py',         usage: '/py <code or question>',       desc: 'Python / Scanpy / AnnData help',    group: 'analysis',   needsArg: true  },
    { cmd: 'code',       usage: '/code <prompt>',               desc: 'Generate complete analysis code',   group: 'analysis',   needsArg: true  },
    { cmd: 'seurat',     usage: '/seurat <question>',           desc: 'Seurat v4/v5 + scRNA-seq help',     group: 'analysis',   needsArg: true  },
    { cmd: 'scanpy',     usage: '/scanpy <question>',           desc: 'Scanpy + AnnData help',             group: 'analysis',   needsArg: true  },
    { cmd: 'spatial',    usage: '/spatial <question>',          desc: 'Spatial transcriptomics help',      group: 'analysis',   needsArg: true  },
    { cmd: 'stats',      usage: '/stats <question>',            desc: 'Statistics / DESeq2 / methods',     group: 'analysis',   needsArg: true  },
    { cmd: 'bash',       usage: '/bash <question>',             desc: 'Shell / SLURM / HPC scripting',     group: 'analysis',   needsArg: true  },
    { cmd: 'debug',      usage: '/debug <code or error>',       desc: 'Debug code or error message',       group: 'analysis',   needsArg: true  },
    { cmd: 'nextflow',   usage: '/nextflow <question>',         desc: 'Nextflow / Snakemake workflow help', group: 'analysis',   needsArg: true  },
    // ── Writing ──────────────────────────────────────────────────
    { cmd: 'draft',      usage: '/draft <prompt>',              desc: 'Draft scientific text',             group: 'writing',    needsArg: true  },
    { cmd: 'abstract',   usage: '/abstract <title>',            desc: 'Draft a paper abstract',            group: 'writing',    needsArg: true  },
    { cmd: 'slides',     usage: '/slides <topic>',              desc: 'Outline a presentation',            group: 'writing',    needsArg: true  },
    { cmd: 'cover',      usage: '/cover <role at company>',     desc: 'Draft a cover letter',              group: 'writing',    needsArg: true  },
    { cmd: 'bullets',    usage: '/bullets <role>',              desc: 'Improve CV bullet points',          group: 'writing',    needsArg: true  },
    { cmd: 'interview',  usage: '/interview <role at company>', desc: 'Interview questions & prep',        group: 'writing',    needsArg: true  },
    { cmd: 'email',      usage: '/email <prompt>',              desc: 'Draft a professional email',        group: 'writing',    needsArg: true  },
    { cmd: 'reply',      usage: '/reply <context>',             desc: 'Draft a reply',                     group: 'writing',    needsArg: true  },
    { cmd: 'translate',  usage: '/translate <text>',            desc: 'Translate to English',              group: 'writing',    needsArg: true  },
    { cmd: 'simplify',   usage: '/simplify <text>',             desc: 'Simplify for a lay audience',       group: 'writing',    needsArg: true  },
    // ── Manuscript ───────────────────────────────────────────────
    { cmd: 'methods',    usage: '/methods',                     desc: 'Help with Methods section',         group: 'manuscript', needsArg: false },
    { cmd: 'intro',      usage: '/intro',                       desc: 'Help with Introduction section',    group: 'manuscript', needsArg: false },
    { cmd: 'results',    usage: '/results',                     desc: 'Help with Results section',         group: 'manuscript', needsArg: false },
    { cmd: 'discussion', usage: '/discussion',                  desc: 'Help with Discussion section',      group: 'manuscript', needsArg: false },
    { cmd: 'revise',     usage: '/revise <text>',               desc: 'Revise / tighten a paragraph',      group: 'manuscript', needsArg: true  },
    { cmd: 'title',      usage: '/title <one-line summary>',    desc: 'Generate paper title options',      group: 'manuscript', needsArg: true  },
    // ── Reports ──────────────────────────────────────────────────
    { cmd: 'digest',     usage: '/digest',                      desc: 'Generate weekly digest',            group: 'reports',    needsArg: false },
    { cmd: 'pi',         usage: '/pi',                          desc: 'Draft PI weekly report email',      group: 'reports',    needsArg: false },
    { cmd: 'status',     usage: '/status',                      desc: 'App stats + token usage',           group: 'reports',    needsArg: false },
    // ── Files & mail ─────────────────────────────────────────────
    { cmd: 'files',      usage: '/files',                       desc: 'List stored files by folder',       group: 'files',      needsArg: false },
    { cmd: 'find',       usage: '/find <query>',                desc: 'Search files',                      group: 'files',      needsArg: true  },
    { cmd: 'send',       usage: '/send <recipient>',            desc: 'Open email compose',                group: 'mail',       needsArg: true  },
    // ── Navigation ───────────────────────────────────────────────
    { cmd: 'go',         usage: '/go <section>',                desc: 'Navigate to any section',           group: 'nav',        needsArg: true  },
    { cmd: 'summarize',  usage: '/summarize',                   desc: 'Summarize the current note',        group: 'nav',        needsArg: false },
    // ── Utility ──────────────────────────────────────────────────
    { cmd: 'help',       usage: '/help',                        desc: 'Show all commands',                 group: 'utility',    needsArg: false },
    { cmd: 'clear',      usage: '/clear',                       desc: 'Clear this chat session',           group: 'utility',    needsArg: false },
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

  // ── helper: prompt-then-send shortcut ─────────────────────────
  async function promptSend(text: string) {
    inputText = text;
    await send();
  }

  // ── helper: fill input and focus ──────────────────────────────
  function fillInput(text: string) {
    showPicker = false;
    inputText = text;
    setTimeout(() => inputEl?.focus(), 10);
  }

  async function executeCommand(cmd: EnzoCommand, args: string) {
    showPicker = false;

    // ── CAPTURE ────────────────────────────────────────────────
    if (cmd.cmd === 'task') {
      if (!args) { fillInput('/task '); return; }
      store.tasks = [{ id: nanoid(), text: args, done: false, noteId: null, createdAt: Date.now(), dueAt: null, priority: 'medium' }, ...store.tasks];
      await store.saveTasks();
      addEnzoMessage(`Task added: **${args}**`);
      return;
    }

    if (cmd.cmd === 'note') {
      if (!args) { fillInput('/note '); return; }
      const note: Note = { id: nanoid(), title: args.slice(0, 80), body: `# ${args}\n\n`, tags: [], createdAt: Date.now(), updatedAt: Date.now(), pinned: false, archived: false, audioIds: [] };
      store.notes = [note, ...store.notes];
      store.currentNoteId = note.id;
      await store.saveNotes();
      store.view = 'notes';
      store.enzoOpen = false;
      return;
    }

    if (cmd.cmd === 'log') {
      if (!args) { fillInput('/log '); return; }
      store.journal = [{ id: nanoid(), body: args, mood: '', contextTag: 'Research', createdAt: Date.now(), updatedAt: Date.now(), audioIds: [] }, ...store.journal];
      await store.saveJournal();
      addEnzoMessage(`Journal entry added.`);
      return;
    }

    if (cmd.cmd === 'idea') {
      if (!args) { fillInput('/idea '); return; }
      store.journal = [{ id: nanoid(), body: args, mood: '💡', contextTag: 'Idea', createdAt: Date.now(), updatedAt: Date.now(), audioIds: [] }, ...store.journal];
      await store.saveJournal();
      addEnzoMessage(`Idea captured: **${args.slice(0, 100)}**`);
      return;
    }

    if (cmd.cmd === 'hyp') {
      if (!args) { fillInput('/hyp '); return; }
      await promptSend(`I want to record this hypothesis: "${args}"\n\nCritically evaluate mechanistic plausibility and suggest how to test it experimentally.`);
      return;
    }

    if (cmd.cmd === 'todo') {
      const open = store.tasks.filter(t => !t.done);
      if (!open.length) { addEnzoMessage('No open tasks. Add one with `/task <description>`.'); return; }
      const byPriority = (p: string) => open.filter(t => t.priority === p);
      const fmt = (ts: typeof open) => ts.map(t => `· ${t.text}`).join('\n');
      const high = byPriority('high'), med = byPriority('medium'), low = byPriority('low');
      const parts = [`**${open.length} open task${open.length > 1 ? 's' : ''}**`];
      if (high.length) parts.push(`**High priority**\n${fmt(high)}`);
      if (med.length)  parts.push(`**Medium**\n${fmt(med)}`);
      if (low.length)  parts.push(`**Low**\n${fmt(low)}`);
      addEnzoMessage(parts.join('\n\n'));
      return;
    }

    if (cmd.cmd === 'today') {
      const today = new Date();
      const isToday = (ts: number) => new Date(ts).toDateString() === today.toDateString();
      const todayTasks = store.tasks.filter(t => !t.done).slice(0, 10);
      const todayJournal = store.journal.filter(e => isToday(e.createdAt));
      const label = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const taskLines = todayTasks.length
        ? todayTasks.map(t => `· ${t.text}${t.priority === 'high' ? ' ★' : ''}`).join('\n')
        : 'Nothing open.';
      const journalLines = todayJournal.length
        ? todayJournal.map(e => `· ${e.body.replace(/<[^>]*>/g, ' ').slice(0, 120)}`).join('\n')
        : 'No entries today.';
      addEnzoMessage(`## ${label}\n\n**Open tasks**\n${taskLines}\n\n**Journal today**\n${journalLines}`);
      return;
    }

    // ── RESEARCH ───────────────────────────────────────────────
    if (cmd.cmd === 'read') {
      fillInput(`Deep read — give me 5 pointed Socratic questions that force critical engagement with the paper's design, controls, statistics, and implications. Here's the abstract:\n\n[paste abstract here]`);
      return;
    }

    if (cmd.cmd === 'critique') {
      fillInput(`Critique this paper as a rigorous peer reviewer — evaluate research question, methodology, novelty, limitations, and give a verdict:\n\n[paste title and abstract here]`);
      return;
    }

    if (cmd.cmd === 'reading') {
      fillInput(`Generate a structured reading note for this paper:\n\nTitle:\nAuthors:\nJournal/Year:\nAbstract:\n\n[fill in above, then send]`);
      return;
    }

    if (cmd.cmd === 'devil') {
      if (!args) { fillInput('/devil '); return; }
      await promptSend(`Play devil's advocate against this hypothesis:\n\n"${args}"\n\nArgue against it with: counter-evidence from literature, alternative explanations, methodological challenges, confounds, and the experiments that would most decisively falsify it.`);
      return;
    }

    if (cmd.cmd === 'paper') {
      if (!args) { fillInput('/paper '); return; }
      store.enzoSearchQuery = args;
      store.view = 'research';
      store.enzoOpen = false;
      return;
    }

    if (cmd.cmd === 'pubmed') {
      if (!args) { fillInput('/pubmed '); return; }
      store.enzoSearchQuery = args;
      store.view = 'research';
      store.enzoOpen = false;
      return;
    }

    if (cmd.cmd === 'cite') {
      if (!args) { fillInput('/cite '); return; }
      await promptSend(`Format a complete, correctly structured citation in both APA and Vancouver formats for:\n\n${args}`);
      return;
    }

    if (cmd.cmd === 'explain') {
      if (!args) { fillInput('/explain '); return; }
      await promptSend(`Explain this concept thoroughly, from mechanism to clinical/research relevance: **${args}**`);
      return;
    }

    if (cmd.cmd === 'compare') {
      if (!args) { fillInput('/compare '); return; }
      await promptSend(`Give me a rigorous comparison: **${args}**\n\nCover: underlying mechanism or principle, key differences, when to use each, and any important caveats.`);
      return;
    }

    if (cmd.cmd === 'mechanism') {
      if (!args) { fillInput('/mechanism '); return; }
      await promptSend(`Deep-dive the mechanism of: **${args}**\n\nCover: molecular/cellular pathway, key regulators, known resistance mechanisms or pathway crosstalk, and what is still unresolved.`);
      return;
    }

    // ── ANALYSIS ──────────────────────────────────────────────
    if (cmd.cmd === 'r') {
      if (!args) { fillInput('/r '); return; }
      await promptSend(`Help me with this R code or question:\n\`\`\`r\n${args}\n\`\`\``);
      return;
    }

    if (cmd.cmd === 'py') {
      if (!args) { fillInput('/py '); return; }
      await promptSend(`Help me with this Python code or question:\n\`\`\`python\n${args}\n\`\`\``);
      return;
    }

    if (cmd.cmd === 'code') {
      if (!args) { fillInput('/code '); return; }
      await promptSend(`Generate complete, runnable, commented analysis code for:\n\n${args}`);
      return;
    }

    if (cmd.cmd === 'seurat') {
      if (!args) { fillInput('/seurat '); return; }
      await promptSend(`Seurat / scRNA-seq question:\n\n${args}\n\nGive a complete, version-specific answer with runnable R code where relevant.`);
      return;
    }

    if (cmd.cmd === 'scanpy') {
      if (!args) { fillInput('/scanpy '); return; }
      await promptSend(`Scanpy / AnnData question:\n\n${args}\n\nGive a complete answer with runnable Python code where relevant.`);
      return;
    }

    if (cmd.cmd === 'spatial') {
      if (!args) { fillInput('/spatial '); return; }
      await promptSend(`Spatial transcriptomics question:\n\n${args}\n\nCover relevant tools (Visium, Xenium, cell2location, RCTD, spatialDM, etc.) as appropriate.`);
      return;
    }

    if (cmd.cmd === 'stats') {
      if (!args) { fillInput('/stats '); return; }
      await promptSend(`Statistics / bioinformatics methods question:\n\n${args}\n\nBe specific about assumptions, when the method applies, and implementation in R or Python.`);
      return;
    }

    if (cmd.cmd === 'bash') {
      if (!args) { fillInput('/bash '); return; }
      await promptSend(`Shell / SLURM / HPC question:\n\n${args}\n\nProvide complete, copy-paste-ready commands.`);
      return;
    }

    if (cmd.cmd === 'debug') {
      if (!args) { fillInput('/debug '); return; }
      await promptSend(`Debug this code or error:\n\n\`\`\`\n${args}\n\`\`\`\n\nIdentify the root cause, explain why it fails, and provide the corrected code.`);
      return;
    }

    if (cmd.cmd === 'nextflow') {
      if (!args) { fillInput('/nextflow '); return; }
      await promptSend(`Nextflow / Snakemake / workflow question:\n\n${args}\n\nProvide complete, runnable workflow code where relevant.`);
      return;
    }

    // ── WRITING ────────────────────────────────────────────────
    if (cmd.cmd === 'draft') {
      if (!args) { fillInput('/draft '); return; }
      await promptSend(`Draft scientific text for: ${args}`);
      return;
    }

    if (cmd.cmd === 'abstract') {
      if (!args) { fillInput('/abstract '); return; }
      await promptSend(`Draft a concise, high-impact structured abstract (Background / Methods / Results / Conclusion) for a paper about: "${args}"`);
      return;
    }

    if (cmd.cmd === 'slides') {
      if (!args) { fillInput('/slides '); return; }
      await promptSend(`Create a detailed presentation outline for: **${args}**\n\nFor each slide provide: slide number, title, 3–5 bullet points, and speaker notes. Aim for 10–12 slides. First slide is title/overview, last is Summary/Next Steps.`);
      return;
    }

    if (cmd.cmd === 'cover') {
      if (!args) { fillInput('/cover '); return; }
      await promptSend(`Draft a cover letter for: **${args}**\n\nApply all cover letter rules: no hollow openers, specific organisational hook in first sentence, connect my HGSOC TME / scRNA-seq / spatial transcriptomics expertise to their programme, 380–480 words, 4 paragraphs.`);
      return;
    }

    if (cmd.cmd === 'bullets') {
      if (!args) { fillInput('/bullets <role>\n\nBullets:\n· '); return; }
      await promptSend(`Rewrite these CV bullet points for the role below. CAR format (Context → Action → Result), front-load achievement, quantify everything possible, cut passive voice. Output only the improved bullets.\n\nRole: ${args}`);
      return;
    }

    if (cmd.cmd === 'interview') {
      if (!args) { fillInput('/interview '); return; }
      await promptSend(`Generate interview questions and prep for: **${args}**\n\n5 technical/scientific questions, 4 behavioural, 3 strategic/fit. Then add ## Enzo's Tips with 3 specific prep suggestions.`);
      return;
    }

    if (cmd.cmd === 'email') {
      if (!args) { fillInput('/email '); return; }
      await promptSend(`Draft a clear, professional email for:\n\n${args}\n\nNo hollow openers. Direct, specific, appropriate register for academic context.`);
      return;
    }

    if (cmd.cmd === 'reply') {
      if (!args) { fillInput('/reply <paste the email or message context here>'); return; }
      await promptSend(`Draft a professional reply to this message:\n\n${args}`);
      return;
    }

    if (cmd.cmd === 'translate') {
      if (!args) { fillInput('/translate '); return; }
      await promptSend(`Translate to English, preserving scientific terminology precisely:\n\n${args}`);
      return;
    }

    if (cmd.cmd === 'simplify') {
      if (!args) { fillInput('/simplify '); return; }
      await promptSend(`Rewrite this for a non-specialist lay audience, removing jargon but keeping accuracy:\n\n${args}`);
      return;
    }

    // ── MANUSCRIPT ─────────────────────────────────────────────
    if (cmd.cmd === 'methods') {
      const ms = store.manuscripts?.[0];
      const ctx = ms ? `Manuscript: ${ms.title}, target journal: ${ms.targetJournal || 'TBD'}` : 'No manuscript open';
      await promptSend(`Help me write or improve the **Methods** section of my manuscript.\n\n${ctx}\n\nFocus on: experimental design, scRNA-seq / spatial transcriptomics protocols, statistical approach, HGSOC patient cohort description. Use HTML formatting where appropriate.`);
      return;
    }

    if (cmd.cmd === 'intro') {
      const ms = store.manuscripts?.[0];
      const ctx = ms ? `Manuscript: ${ms.title}, target journal: ${ms.targetJournal || 'TBD'}` : 'No manuscript open';
      await promptSend(`Help me write or improve the **Introduction** section.\n\n${ctx}\n\nStructure: broad problem → specific gap → our approach. Cite the relevant landscape of HGSOC biology, TME, and scRNA-seq where it fits. No jargon without justification.`);
      return;
    }

    if (cmd.cmd === 'results') {
      const ms = store.manuscripts?.[0];
      const ctx = ms ? `Manuscript: ${ms.title}` : 'No manuscript open';
      await promptSend(`Help me write or improve the **Results** section.\n\n${ctx}\n\nResults should present data logically, not editorially — save interpretation for Discussion. Each paragraph should have a topic sentence stating the finding.`);
      return;
    }

    if (cmd.cmd === 'discussion') {
      const ms = store.manuscripts?.[0];
      const ctx = ms ? `Manuscript: ${ms.title}` : 'No manuscript open';
      await promptSend(`Help me write or improve the **Discussion** section.\n\n${ctx}\n\nStructure: key finding → mechanistic interpretation → comparison to literature → limitations → future directions. Be direct — state what the findings mean, not just what was done.`);
      return;
    }

    if (cmd.cmd === 'revise') {
      if (!args) { fillInput('/revise <paste paragraph here>'); return; }
      await promptSend(`Revise and tighten this paragraph. Cut every unnecessary word. Strengthen the topic sentence. Preserve all factual content:\n\n${args}`);
      return;
    }

    if (cmd.cmd === 'title') {
      if (!args) { fillInput('/title '); return; }
      await promptSend(`Generate 5 paper title options for: "${args}"\n\nRange from descriptive to punchy. Each title should clearly convey the main finding, not just the topic. Flag which is most likely to pass editorial screening.`);
      return;
    }

    // ── REPORTS ────────────────────────────────────────────────
    if (cmd.cmd === 'digest') {
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      const recentJournal = store.journal.filter(e => e.createdAt > sevenDaysAgo).slice(0, 5);
      const doneTasks = store.tasks.filter(t => t.done).slice(0, 8);
      const openTasks = store.tasks.filter(t => !t.done).slice(0, 6);
      await promptSend(`Generate my weekly research digest:\n\nJournal (${recentJournal.length} entries): ${recentJournal.map(e => e.body.replace(/<[^>]*>/g, ' ').slice(0, 80)).join(' | ') || 'none'}\nTasks done: ${doneTasks.map(t => t.text).join('; ') || 'none'}\nOpen tasks: ${openTasks.map(t => t.text).join('; ') || 'none'}\n\nSections: ## This Week (2–3 sentences), ## Key Themes (2–3 bullets), ## Next Week (2–3 specific suggestions).`);
      return;
    }

    if (cmd.cmd === 'pi') {
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      const recentJournal = store.journal.filter(e => e.createdAt > sevenDaysAgo).slice(0, 5);
      const doneTasks = store.tasks.filter(t => t.done).slice(0, 8);
      const openTasks = store.tasks.filter(t => !t.done).slice(0, 6);
      const runs = (store.pipelineRuns ?? []).slice(0, 4);
      await promptSend(`Draft my weekly progress email to my PI (write in first person as Dr. Amritha Sathyanarayanan).\n\nJournal: ${recentJournal.map(e => e.body.replace(/<[^>]*>/g, ' ').slice(0, 100)).join(' | ') || 'none'}\nCompleted: ${doneTasks.map(t => t.text).join('; ') || 'none'}\nIn progress: ${openTasks.map(t => t.text).join('; ') || 'none'}\nPipeline: ${runs.map((r: any) => `${r.title} (${r.status})`).join(', ') || 'none'}\n\nStructured, professional, under 350 words, plain text.`);
      return;
    }

    if (cmd.cmd === 'status') {
      const usage = getAllTokenUsage();
      const openTasks = store.tasks.filter(t => !t.done).length;
      const doneTasks = store.tasks.filter(t => t.done).length;
      const folders = [...new Set(store.files.map(f => f.folder || 'Unfiled'))];
      const pct = (n: number, max: number) => Math.round((n / max) * 100);
      addEnzoMessage(
        `## Q·onco Status\n\n` +
        `**Content**\n· Notes: ${store.notes.length} · Tasks: ${openTasks} open, ${doneTasks} done\n· Files: ${store.files.length} across ${folders.length} folder${folders.length !== 1 ? 's' : ''}\n· Journal: ${store.journal.length} entries · Chat sessions: ${store.chatSessions.length}\n\n` +
        `**Today's token usage**\n· Enzo: ${usage.enzo.toLocaleString()} / ${DAILY_TOKEN_REF.enzo.toLocaleString()} (${pct(usage.enzo, DAILY_TOKEN_REF.enzo)}%)\n· Research: ${usage.research.toLocaleString()} / ${DAILY_TOKEN_REF.research.toLocaleString()} (${pct(usage.research, DAILY_TOKEN_REF.research)}%)`
      );
      return;
    }

    // ── FILES & MAIL ───────────────────────────────────────────
    if (cmd.cmd === 'files') {
      const folders = [...new Set(store.files.map(f => f.folder || 'Unfiled'))];
      if (!folders.length) { addEnzoMessage('No files stored yet. Upload files in the Files section.'); return; }
      const parts = folders.map(folder => {
        const items = store.files.filter(f => (f.folder || 'Unfiled') === folder);
        return `**${folder}** (${items.length})\n${items.map(f => `  · ${f.name}${f.description ? ' — ' + f.description.slice(0, 60) : ''}`).join('\n')}`;
      });
      addEnzoMessage(`## Your files\n\n${parts.join('\n\n')}`);
      return;
    }

    if (cmd.cmd === 'find') {
      if (!args) { fillInput('/find '); return; }
      const q = args.toLowerCase();
      const matches = store.files.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.tags ?? []).some((t: string) => t.toLowerCase().includes(q)) ||
        (f.folder ?? '').toLowerCase().includes(q)
      );
      addEnzoMessage(
        matches.length === 0
          ? `No files found matching **"${args}"**.`
          : `Found **${matches.length}** file${matches.length > 1 ? 's' : ''} matching **"${args}"**:\n\n${matches.map(f => `· **${f.name}**${f.folder ? ` [${f.folder}]` : ''}${f.description ? ' — ' + f.description.slice(0, 80) : ''}`).join('\n')}`
      );
      return;
    }

    if (cmd.cmd === 'send') {
      store.mailComposeOpen = true;
      store.enzoOpen = false;
      return;
    }

    // ── NAVIGATION ─────────────────────────────────────────────
    if (cmd.cmd === 'go') {
      if (!args) { fillInput('/go '); return; }
      const SECTION_MAP: Record<string, string> = {
        notes: 'notes', note: 'notes', editor: 'notes',
        research: 'research', lit: 'research', papers: 'research', literature: 'research',
        pipeline: 'pipeline', pipe: 'pipeline', hypotheses: 'pipeline',
        files: 'files', file: 'files',
        tasks: 'tasks', task: 'tasks',
        journal: 'journal',
        grants: 'grants', grant: 'grants',
        manuscript: 'manuscript', ms: 'manuscript', writing: 'manuscript',
        jobs: 'jobs', job: 'jobs',
        audio: 'audio',
        calendar: 'calendar', cal: 'calendar',
        dashboard: 'dashboard', home: 'dashboard',
        presentations: 'presentations', slides: 'presentations', pres: 'presentations',
        settings: 'settings', setting: 'settings',
        mail: 'mail',
      };
      const section = SECTION_MAP[args.toLowerCase().trim()];
      if (!section) {
        addEnzoMessage(`Unknown section **"${args}"**. Options: notes, research, pipeline, files, tasks, journal, grants, manuscript, jobs, calendar, dashboard, presentations, mail, settings`);
        return;
      }
      store.view = section as typeof store.view;
      store.enzoOpen = false;
      return;
    }

    if (cmd.cmd === 'summarize') {
      if (!store.currentNote) {
        addEnzoMessage('No note is currently open. Navigate to Notes and open one first.');
        return;
      }
      await promptSend(`Summarize this note in 3–5 bullet points, preserving every key finding or decision:\n\n**${store.currentNote.title}**\n\n${store.currentNote.body.replace(/<[^>]*>/g, ' ').slice(0, 3000)}`);
      return;
    }

    // ── UTILITY ────────────────────────────────────────────────
    if (cmd.cmd === 'help') {
      const grouped: Record<string, EnzoCommand[]> = {};
      for (const c of COMMANDS) {
        if (!grouped[c.group]) grouped[c.group] = [];
        grouped[c.group].push(c);
      }
      const sections = Object.entries(grouped).map(([g, cmds]) =>
        `**${g.charAt(0).toUpperCase() + g.slice(1)}**\n${cmds.map(c => `\`${c.usage}\` — ${c.desc}`).join('\n')}`
      );
      addEnzoMessage(`## Enzo Commands (${COMMANDS.length} total)\n\n${sections.join('\n\n')}`);
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
