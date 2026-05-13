<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { AlarmItem } from '../lib/types';
  import Sidebar from './Sidebar.svelte';
  import Dashboard from './Dashboard.svelte';
  import Editor from './Editor.svelte';
  import Journal from './Journal.svelte';
  import Tasks from './Tasks.svelte';
  import Calendar from './Calendar.svelte';
  import Research from './Research.svelte';
  import Pipeline from './Pipeline.svelte';
  import Audio from './Audio.svelte';
  import Jobs from './Jobs.svelte';
  import Presentations from './Presentations.svelte';
  import Files from './Files.svelte';
  import Grants from './Grants.svelte';
  import Manuscript from './Manuscript.svelte';
  import ReviewArticle from './ReviewArticle.svelte';
  import Settings from './Settings.svelte';
  import Enzo from './Enzo.svelte';
  import Mail from './Mail.svelte';
  import Launchpad from './Launchpad.svelte';
  import Biblio from './Biblio.svelte';
  import Weather from './Weather.svelte';
  import Help from './Help.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import NotesHome from './NotesHome.svelte';

  // ── Command palette ──────────────────────────────────────────────
  let paletteOpen = $state(false);

  // ── DNA character state ───────────────────────────────────────
  let dnaActive = $state(false);
  let dnaExpr   = $state('idle');
  let dnaFactVisible = $state(false);
  let dnaFactText    = $state('');
  let dnaTimer:     ReturnType<typeof setTimeout>;
  let dnaExprTimer: ReturnType<typeof setTimeout>;
  let dnaFactTimer: ReturnType<typeof setTimeout>;

  const IDLE_EXPRS   = ['idle','idle','idle','sleepy','bored','bored','yawn'];
  const ACTIVE_EXPRS = ['focused','focused','thinking','thinking','excited','happy','happy','surprised','wink'];

  const DNA_FACTS = [
    'TP53 is mutated in >96% of high-grade serous ovarian cancers.',
    'PARP inhibitors trap PARP-DNA complexes, stalling replication forks.',
    'CA-125 elevation precedes clinical relapse by a median of 3 months.',
    'HGSOC accounts for ~70% of all ovarian cancer deaths worldwide.',
    'Homologous recombination deficiency predicts PARPi response.',
    'Single-cell RNA-seq can profile individual cells from just 1 ng RNA.',
    'Folate receptor-α is overexpressed in ~90% of ovarian cancers.',
    'CD8+ T-cell infiltration correlates with improved survival in HGSOC.',
    'Tumor ascites in ovarian cancer is rich in IL-6, driving pro-tumor signaling.',
    'The TCGA identified four molecular subtypes of HGSOC in 2011.',
    'Spatial transcriptomics maps gene expression directly onto tissue sections.',
    'Bevacizumab (anti-VEGF) improves PFS but not OS in first-line ovarian cancer.',
    'Macrophage M2 polarization in the TME suppresses anti-tumor immunity.',
    'The average cancer genome harbors 30 000–50 000 somatic mutations.',
    'PD-L1 expression is a biomarker for checkpoint inhibitor response.',
    'BRCA1/2 mutations confer a 40–60% lifetime risk of ovarian cancer.',
    'Cancer-associated fibroblasts remodel the ECM to promote invasion.',
    'Niraparib was the first PARPi approved regardless of BRCA mutation status.',
    'CpG islands cover ~70% of human gene promoters and regulate transcription.',
    'Seurat clusters cells by shared nearest-neighbor graph partitioning.',
    'Scanpy uses AnnData objects for memory-efficient single-cell analysis.',
    'FOXM1 is amplified in HGSOC and drives mitotic progression.',
    'The peritoneum is the most frequent site of ovarian cancer dissemination.',
    'Tumor mutational burden (TMB) predicts immunotherapy benefit across cancers.',
    'Rucaparib was approved for BRCA-mutated ovarian cancer in 2016.',
    'Cell-free DNA in plasma can detect minimal residual disease.',
    'IL-10 from regulatory T cells dampens anti-tumor immune responses.',
    'Olaparib was the first PARPi approved in ovarian cancer (2014).',
    'RNA velocity estimates future cell states from splicing dynamics.',
    'Angiogenesis in ovarian cancer is driven by hypoxia-induced VEGF.',
  ];

  function cycleExpr() {
    const pool = dnaActive ? ACTIVE_EXPRS : IDLE_EXPRS;
    dnaExpr = pool[Math.floor(Math.random() * pool.length)];
    const delay = dnaActive ? (1200 + Math.random() * 2000) : (3000 + Math.random() * 5000);
    if (!dnaFactVisible && Math.random() < 0.22) {
      dnaFactText    = DNA_FACTS[Math.floor(Math.random() * DNA_FACTS.length)];
      dnaFactVisible = true;
      clearTimeout(dnaFactTimer);
      dnaFactTimer   = setTimeout(() => { dnaFactVisible = false; }, 7000);
    }
    dnaExprTimer = setTimeout(cycleExpr, delay);
  }

  $effect(() => {
    cycleExpr();
    function onActivity() {
      dnaActive = true;
      clearTimeout(dnaTimer);
      dnaTimer = setTimeout(() => { dnaActive = false; }, 2000);
    }
    document.addEventListener('mousemove', onActivity, { passive: true });
    document.addEventListener('keydown', onActivity, { passive: true });
    document.addEventListener('click', onActivity, { passive: true });
    return () => {
      document.removeEventListener('mousemove', onActivity);
      document.removeEventListener('keydown', onActivity);
      document.removeEventListener('click', onActivity);
      clearTimeout(dnaTimer);
      clearTimeout(dnaExprTimer);
      clearTimeout(dnaFactTimer);
    };
  });

  let toastMsg = $state('');
  let toastType = $state<'success' | 'error' | ''>('');
  let toastTimer: ReturnType<typeof setTimeout>;
  let helpOpen = $state(false);
  let clockOpen = $state(false);
  let searchOpen = $state(false);
  let searchQuery = $state('');
  let searchSelected = $state(0);
  let searchInputEl = $state<HTMLInputElement | undefined>(undefined);

  // ── Quick capture ─────────────────────────────────────────────
  let captureOpen = $state(false);
  let captureText = $state('');
  let captureRoute = $state<'note' | 'task' | 'journal' | 'reading'>('note');
  let captureInputEl = $state<HTMLInputElement | undefined>(undefined);
  let newAlarmTime = $state('');
  let newAlarmLabel = $state('');
  const firedToday = new Set<string>();

  function fmt24(tz: string): string {
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
    });
  }

  function clocks(): { hbg: string; chn: string } {
    return { hbg: fmt24('Europe/Berlin'), chn: fmt24('Asia/Kolkata') };
  }

  let clockTime = $state(clocks());

  $effect(() => {
    const tick = () => {
      clockTime = clocks();
      const alarms = store.settings.alarms ?? [];
      if (alarms.length === 0) return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dayKey = now.toDateString();
      for (const alarm of alarms) {
        if (!alarm.enabled) continue;
        const fkey = `${alarm.id}|${dayKey}|${hhmm}`;
        if (alarm.time === hhmm && !firedToday.has(fkey)) {
          firedToday.add(fkey);
          showToast(`Alarm: ${alarm.label || alarm.time}`);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Q·onco', { body: alarm.label || alarm.time });
          }
        }
      }
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  });

  // ── Deadline notifications ─────────────────────────────────────
  function checkDeadlines() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const today = new Date().toDateString();
    if (localStorage.getItem('qonco-notif-date') === today) return;
    localStorage.setItem('qonco-notif-date', today);

    const now = Date.now();
    const day = 86400000;

    const overdue = store.tasks.filter(t => !t.done && t.dueAt && t.dueAt < now);
    const dueToday = store.tasks.filter(t => !t.done && t.dueAt && t.dueAt !== null && t.dueAt >= now && t.dueAt < now + day);
    const dueTomorrow = store.tasks.filter(t => !t.done && t.dueAt && t.dueAt >= now + day && t.dueAt < now + 2 * day);

    if (overdue.length) new Notification('Q·onco — Overdue tasks', {
      body: overdue.length === 1 ? `"${overdue[0].text}" is overdue.` : `${overdue.length} tasks are overdue.`,
      tag: 'tasks-overdue', icon: '/icon-192.png'
    });
    if (dueToday.length) new Notification('Q·onco — Due today', {
      body: dueToday.length === 1 ? `"${dueToday[0].text}" is due today.` : `${dueToday.length} tasks due today.`,
      tag: 'tasks-today', icon: '/icon-192.png'
    });
    if (dueTomorrow.length) new Notification('Q·onco — Due tomorrow', {
      body: dueTomorrow.length === 1 ? `"${dueTomorrow[0].text}" is due tomorrow.` : `${dueTomorrow.length} tasks due tomorrow.`,
      tag: 'tasks-tomorrow', icon: '/icon-192.png'
    });

    const grantsDue = store.grants.filter(g =>
      g.deadline && !['awarded', 'rejected', 'withdrawn', 'submitted'].includes(g.status) &&
      g.deadline > now && g.deadline < now + 7 * day
    );
    for (const g of grantsDue) {
      const d = Math.ceil((g.deadline! - now) / day);
      new Notification('Q·onco — Grant deadline', {
        body: `"${g.title}" deadline in ${d} day${d !== 1 ? 's' : ''}.`,
        tag: `grant-${g.id}`, icon: '/icon-192.png'
      });
    }

    const prDue = store.peerReviews.filter(p =>
      p.dueAt && ['accepted', 'in-progress'].includes(p.status) &&
      p.dueAt > now && p.dueAt < now + 7 * day
    );
    for (const p of prDue) {
      const d = Math.ceil((p.dueAt! - now) / day);
      new Notification('Q·onco — Peer review due', {
        body: `Review for "${p.manuscriptTitle}" due in ${d} day${d !== 1 ? 's' : ''}.`,
        tag: `pr-${p.id}`, icon: '/icon-192.png'
      });
    }

    const jobsDue = store.savedJobs.filter(j =>
      j.nextActionAt && j.status !== 'closed' &&
      j.nextActionAt > now && j.nextActionAt < now + 2 * day
    );
    for (const j of jobsDue) {
      const d = Math.ceil((j.nextActionAt! - now) / day);
      new Notification('Q·onco — Job follow-up', {
        body: `"${j.nextAction}" for ${j.listing.company} due in ${d} day${d !== 1 ? 's' : ''}.`,
        tag: `job-${j.id}`, icon: '/icon-192.png'
      });
    }
  }

  $effect(() => {
    if (store.authenticated) checkDeadlines();
  });

  function addAlarm() {
    if (!newAlarmTime) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const alarm: AlarmItem = {
      id: nanoid(),
      time: newAlarmTime,
      label: newAlarmLabel.trim(),
      enabled: true
    };
    store.settings.alarms = [...(store.settings.alarms ?? []), alarm];
    store.saveSettings();
    newAlarmTime = '';
    newAlarmLabel = '';
  }

  function removeAlarm(id: string) {
    store.settings.alarms = (store.settings.alarms ?? []).filter(a => a.id !== id);
    store.saveSettings();
  }

  function toggleAlarm(id: string) {
    store.settings.alarms = (store.settings.alarms ?? []).map(a =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    store.saveSettings();
  }

  type SearchResult = { type: string; id: string; title: string; preview: string; section: string; icon: string };

  const searchResults = $derived((() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [] as SearchResult[];
    const q = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    for (const note of store.notes) {
      if (note.archived) continue;
      if (note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q)) {
        results.push({ type: 'note', id: note.id, title: note.title || 'Untitled note', preview: note.body.replace(/[#*`_\[\]]/g, '').slice(0, 90), section: 'notes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' });
      }
    }

    for (const entry of store.journal) {
      if (entry.body.toLowerCase().includes(q) || entry.contextTag.toLowerCase().includes(q)) {
        const d = new Date(entry.createdAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        results.push({ type: 'journal', id: entry.id, title: `Journal · ${d}`, preview: entry.body.replace(/[#*`_]/g, '').slice(0, 90), section: 'journal', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' });
      }
    }

    for (const task of store.tasks) {
      if (!task.done && task.text.toLowerCase().includes(q)) {
        results.push({ type: 'task', id: task.id, title: task.text, preview: task.noteId ? 'Linked to note' : '', section: 'tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' });
      }
    }

    for (const session of store.chatSessions) {
      let matched = false;
      for (const msg of session.messages) {
        if (msg.content.toLowerCase().includes(q)) {
          const d = new Date(session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          results.push({ type: 'enzo', id: session.date, title: `Enzo · ${d}`, preview: msg.content.slice(0, 90), section: 'enzo', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' });
          matched = true;
          break;
        }
      }
      if (matched && results.length >= 20) break;
    }

    // Pinned papers
    for (const paper of store.pinnedPapers) {
      if (paper.title.toLowerCase().includes(q) || paper.abstract.toLowerCase().includes(q) || paper.authors.join(' ').toLowerCase().includes(q)) {
        results.push({ type: 'paper', id: paper.id, title: paper.title, preview: `${paper.authors[0] ? paper.authors[0] + ' et al.' : ''} · ${paper.journal} ${paper.year}`, section: 'research', icon: 'M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z' });
      }
    }

    // Reading list (unread papers)
    for (const item of store.readingList) {
      if (!store.pinnedPapers.some(p => p.id === item.paper.id)) {
        if (item.paper.title.toLowerCase().includes(q) || (item.note || '').toLowerCase().includes(q)) {
          results.push({ type: 'reading', id: item.id, title: item.paper.title, preview: item.note || `${item.paper.journal} · ${item.paper.year}`, section: 'research', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253' });
        }
      }
    }

    // Protocols
    for (const proto of store.protocols) {
      if (proto.title.toLowerCase().includes(q) || proto.body.toLowerCase().includes(q) || proto.tags.some(t => t.toLowerCase().includes(q))) {
        results.push({ type: 'protocol', id: proto.id, title: `Protocol · ${proto.title}`, preview: proto.body.replace(/<[^>]*>/g, ' ').slice(0, 90), section: 'pipeline', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' });
      }
    }

    // Hypotheses
    for (const hyp of store.hypotheses) {
      if (hyp.text.toLowerCase().includes(q) || hyp.rationale.toLowerCase().includes(q) || hyp.result.toLowerCase().includes(q)) {
        results.push({ type: 'hypothesis', id: hyp.id, title: `Hypothesis · ${hyp.text.slice(0, 60)}`, preview: hyp.rationale.slice(0, 90), section: 'pipeline', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' });
      }
    }

    // Pipeline runs
    for (const run of store.pipelineRuns) {
      if (run.title.toLowerCase().includes(q) || run.sampleId.toLowerCase().includes(q) || run.notes.toLowerCase().includes(q) || run.tags.some(t => t.toLowerCase().includes(q))) {
        results.push({ type: 'run', id: run.id, title: `Run · ${run.title}`, preview: `${run.pipelineType} · ${run.status} · ${run.sampleId}`, section: 'pipeline', icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v10a2 2 0 002 2h10a2 2 0 002-2V5M9 13H5a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2v-4a2 2 0 00-2-2z' });
      }
    }

    // Files
    for (const file of store.files) {
      if (file.name.toLowerCase().includes(q) || file.description.toLowerCase().includes(q) || file.tags.some(t => t.toLowerCase().includes(q))) {
        results.push({ type: 'file', id: file.id, title: file.name, preview: file.description || file.mimeType, section: 'files', icon: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' });
      }
    }

    // Jobs
    for (const job of store.savedJobs) {
      if (job.listing.title.toLowerCase().includes(q) || job.listing.company.toLowerCase().includes(q) || job.notes.toLowerCase().includes(q)) {
        results.push({ type: 'job', id: job.id, title: `${job.listing.title} · ${job.listing.company}`, preview: `${job.status} · ${job.listing.location}`, section: 'jobs', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' });
      }
    }

    // Presentations
    for (const pres of store.presentations) {
      if (pres.title.toLowerCase().includes(q) || pres.slides.some(s => s.content.toLowerCase().includes(q) || s.notes.toLowerCase().includes(q))) {
        results.push({ type: 'presentation', id: pres.id, title: pres.title, preview: `${pres.slides.length} slides · ${pres.theme}`, section: 'presentations', icon: 'M2 3h20v14H2zM8 21h8M12 17v4' });
      }
    }

    // Grants
    for (const g of store.grants) {
      if (g.title.toLowerCase().includes(q) || g.agency.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)) {
        results.push({ type: 'grant', id: g.id, title: g.title, preview: `${g.agency} · ${g.status} · ${g.currency}${g.amount.toLocaleString()}`, section: 'grants', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' });
      }
    }

    // Manuscripts
    for (const m of store.manuscripts) {
      if (m.title.toLowerCase().includes(q) || m.targetJournal.toLowerCase().includes(q) || m.sections.some(s => s.content.replace(/<[^>]*>/g,'').toLowerCase().includes(q))) {
        results.push({ type: 'manuscript', id: m.id, title: m.title, preview: `${m.targetJournal || 'No journal'} · ${m.status} · ${m.sections.length} sections`, section: 'manuscript', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' });
      }
    }

    // Audio transcripts
    for (const rec of store.audioRecords) {
      const plain = rec.transcript.replace(/<[^>]*>/g, ' ');
      if (plain.toLowerCase().includes(q)) {
        const date = new Date(rec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        results.push({ type: 'audio', id: rec.id, title: `Transcript · ${date}`, preview: plain.slice(0, 90), section: 'audio', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z' });
      }
    }

    return results.slice(0, 28);
  })());

  function openSearch() {
    searchOpen = true;
    searchQuery = '';
    searchSelected = 0;
    setTimeout(() => searchInputEl?.focus(), 30);
  }

  function openCapture() {
    captureOpen = true;
    captureText = '';
    captureRoute = 'note';
    setTimeout(() => captureInputEl?.focus(), 30);
  }

  async function submitCapture() {
    if (!captureText.trim()) return;
    const text = captureText.trim();
    if (captureRoute === 'task') {
      store.tasks = [{ id: nanoid(), text, done: false, noteId: null, createdAt: Date.now(), dueAt: null, priority: 'medium' }, ...store.tasks];
      await store.saveTasks();
      store.view = 'tasks';
    } else if (captureRoute === 'journal') {
      store.journal = [{ id: nanoid(), body: text, mood: '', contextTag: 'Research', createdAt: Date.now(), updatedAt: Date.now(), audioIds: [] }, ...store.journal];
      await store.saveJournal();
      store.view = 'journal';
    } else if (captureRoute === 'reading') {
      showToast('Paste the title into Research → search to add to reading list');
      store.view = 'research';
    } else {
      const note = { id: nanoid(), title: text.split('\n')[0].slice(0, 80) || 'Quick note', body: text, tags: [], createdAt: Date.now(), updatedAt: Date.now(), pinned: false, archived: false, audioIds: [] };
      store.notes = [note, ...store.notes];
      store.currentNoteId = note.id;
      await store.saveNotes();
      store.view = 'notes';
    }
    showToast('Captured');
    captureOpen = false;
  }

  function newNoteTab() {
    const n = { id: nanoid(), title: 'Untitled note', body: '', tags: [], createdAt: Date.now(), updatedAt: Date.now(), pinned: false, archived: false, audioIds: [] };
    store.notes = [n, ...store.notes];
    store.currentNoteId = n.id;
    store.view = 'notes';
    store.saveNotes();
  }

  function navigateToResult(result: SearchResult) {
    searchOpen = false;
    if (result.section === 'enzo') {
      store.enzoOpen = true;
    } else {
      store.view = result.section as typeof store.view;
    }
    if (result.type === 'note') store.currentNoteId = result.id;
    if (result.type === 'journal') store.selectedJournalId = result.id;
    if (result.type === 'audio') store.selectedAudioId = result.id;
  }

  function onWindowKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      paletteOpen = !paletteOpen;
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      openCapture();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      newNoteTab();
      return;
    }
    if (e.key === 'Escape') {
      if (paletteOpen) { paletteOpen = false; return; }
      if (captureOpen) { captureOpen = false; return; }
      if (searchOpen) { searchOpen = false; return; }
      helpOpen = false;
      clockOpen = false;
    }
    if (searchOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); searchSelected = Math.min(searchSelected + 1, searchResults.length - 1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); searchSelected = Math.max(searchSelected - 1, 0); }
      if (e.key === 'Enter' && searchResults[searchSelected]) { navigateToResult(searchResults[searchSelected]); }
      return;
    }
    if (e.key === '?' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      helpOpen = true;
    }
  }

  $effect(() => {
    if (window.innerWidth <= 900) {
      store.sidebarOpen = false;
      store.enzoOpen = false;
    }
  });

  const BOTTOM_NAV = [
    { id: 'dashboard', label: 'Home',     icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'notes',     label: 'Notes',    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'tasks',     label: 'Tasks',    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'research',  label: 'Research', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { id: 'review',    label: 'Reviews',  icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  ];

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastMsg = ''; toastType = ''; }, 3200);
  }
</script>

<svelte:window onkeydown={onWindowKey} />

{#if paletteOpen}
  <CommandPalette onClose={() => paletteOpen = false} />
{/if}

{#if helpOpen}
  <Help
    onclose={() => helpOpen = false}
    onnavigate={(section) => { store.view = section as typeof store.view; helpOpen = false; }}
  />
{/if}

{#if searchOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="search-backdrop" onclick={() => searchOpen = false}></div>
  <div class="search-overlay" role="dialog" aria-label="Global search" aria-modal="true">
    <div class="search-input-row">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input
        class="search-global-input"
        bind:value={searchQuery}
        bind:this={searchInputEl}
        placeholder="Search notes, journal, tasks, Enzo…"
        autocomplete="off"
        oninput={() => searchSelected = 0}
      />
      <kbd class="search-esc" onclick={() => searchOpen = false}>Esc</kbd>
    </div>

    {#if searchResults.length > 0}
      <div class="search-results" role="listbox">
        {#each searchResults as result, i}
          <button
            class="search-result"
            class:search-result-active={i === searchSelected}
            role="option"
            aria-selected={i === searchSelected}
            onclick={() => navigateToResult(result)}
            onmouseenter={() => searchSelected = i}
          >
            <span class="sr-section-pill">{result.section}</span>
            <svg class="sr-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d={result.icon}/></svg>
            <div class="sr-body">
              <span class="sr-title">{result.title}</span>
              {#if result.preview}
                <span class="sr-preview">{result.preview}</span>
              {/if}
            </div>
            <svg class="sr-enter" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 01-4 4H4"/></svg>
          </button>
        {/each}
      </div>
    {:else if searchQuery.length >= 2}
      <div class="search-empty">No results for <em>"{searchQuery}"</em></div>
    {:else}
      <div class="search-hint">
        <span>Notes · Journal · Tasks · Research · Pipeline · Files · Jobs · Presentations · Enzo</span>
        <span class="search-hint-keys"><kbd>↑↓</kbd> navigate · <kbd>↵</kbd> open</span>
      </div>
    {/if}
  </div>
{/if}

{#if captureOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="search-backdrop" onclick={() => captureOpen = false}></div>
  <div class="capture-overlay" role="dialog" aria-label="Quick capture" aria-modal="true">
    <div class="capture-route-row">
      {#each ([['note','Note'],['task','Task'],['journal','Journal entry'],['reading','Reading list']] as const) as [val, label]}
        <button class="capture-route-btn" class:capture-route-active={captureRoute === val} onclick={() => captureRoute = val}>{label}</button>
      {/each}
    </div>
    <div class="capture-input-row">
      <input
        class="capture-input"
        bind:value={captureText}
        bind:this={captureInputEl}
        placeholder={captureRoute === 'task' ? 'Task description…' : captureRoute === 'journal' ? 'What\'s on your mind?' : captureRoute === 'reading' ? 'Paper title or note…' : 'Note title or first line…'}
        onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitCapture(); } }}
      />
      <button class="btn btn-primary" onclick={submitCapture} disabled={!captureText.trim()}>
        Capture <kbd style="font-size:0.6rem;opacity:0.7;margin-left:4px">↵</kbd>
      </button>
    </div>
    <p class="capture-hint text-xs text-mu">Ctrl+J to capture · Esc to close</p>
  </div>
{/if}

<div class="shell">
  <header class="top-bar">
    <div class="top-left">
      <button
        class="btn-icon sidebar-toggle"
        onclick={() => store.sidebarOpen = !store.sidebarOpen}
        aria-label="Toggle sidebar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <span class="app-name">Q·onco</span>

      <!-- DNA character: 10 expressions, no face oval — strands show through -->
      <div class="enzo-activity" class:enzo-active={dnaActive} data-expr={dnaExpr} aria-hidden="true">
        <svg class="dna-char" width="80" height="24" viewBox="0 0 80 24" aria-hidden="true">
          <!-- Scrolling helix (period=40, x=0..120, translateX(-40) loops seamlessly) -->
          <g class="dc-scroll">
            <path class="dc-strand-a" d="M0,12 C8,4 12,4 20,12 C28,20 32,20 40,12 C48,4 52,4 60,12 C68,20 72,20 80,12 C88,4 92,4 100,12 C108,20 112,20 120,12"/>
            <path class="dc-strand-b" d="M0,12 C8,20 12,20 20,12 C28,4 32,4 40,12 C48,20 52,20 60,12 C68,4 72,4 80,12 C88,20 92,20 100,12 C108,4 112,4 120,12"/>
            <!-- peak rungs (full height, alternating accent/purple) -->
            <line class="dc-rung dc-rung-a" x1="10"  y1="4" x2="10"  y2="20"/>
            <line class="dc-rung dc-rung-b" x1="30"  y1="4" x2="30"  y2="20"/>
            <line class="dc-rung dc-rung-a" x1="50"  y1="4" x2="50"  y2="20"/>
            <line class="dc-rung dc-rung-b" x1="70"  y1="4" x2="70"  y2="20"/>
            <line class="dc-rung dc-rung-a" x1="90"  y1="4" x2="90"  y2="20"/>
            <line class="dc-rung dc-rung-b" x1="110" y1="4" x2="110" y2="20"/>
            <!-- quarter rungs (short, muted) -->
            <line class="dc-rung dc-rung-q" x1="5"   y1="8" x2="5"   y2="16"/>
            <line class="dc-rung dc-rung-q" x1="15"  y1="8" x2="15"  y2="16"/>
            <line class="dc-rung dc-rung-q" x1="25"  y1="8" x2="25"  y2="16"/>
            <line class="dc-rung dc-rung-q" x1="35"  y1="8" x2="35"  y2="16"/>
            <line class="dc-rung dc-rung-q" x1="45"  y1="8" x2="45"  y2="16"/>
            <line class="dc-rung dc-rung-q" x1="55"  y1="8" x2="55"  y2="16"/>
            <line class="dc-rung dc-rung-q" x1="65"  y1="8" x2="65"  y2="16"/>
            <line class="dc-rung dc-rung-q" x1="75"  y1="8" x2="75"  y2="16"/>
            <line class="dc-rung dc-rung-q" x1="85"  y1="8" x2="85"  y2="16"/>
            <line class="dc-rung dc-rung-q" x1="95"  y1="8" x2="95"  y2="16"/>
            <line class="dc-rung dc-rung-q" x1="105" y1="8" x2="105" y2="16"/>
            <line class="dc-rung dc-rung-q" x1="115" y1="8" x2="115" y2="16"/>
          </g>

          <!-- ── Expressions float directly on the helix ─────────── -->

          <!-- idle: heavy droopy arcs + tiny pupils -->
          <g class="dc-expr dc-expr-idle">
            <path d="M27,9 Q31,14 35,9"   stroke="var(--tx)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M45,9 Q49,14 53,9"   stroke="var(--tx)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <circle cx="31" cy="12" r="1.3" fill="var(--tx)" opacity="0.7"/>
            <circle cx="49" cy="12" r="1.3" fill="var(--tx)" opacity="0.7"/>
          </g>

          <!-- sleepy: flat closed lines -->
          <g class="dc-expr dc-expr-sleepy">
            <line x1="28" y1="12" x2="34" y2="12" stroke="var(--tx)" stroke-width="2.2" stroke-linecap="round"/>
            <line x1="46" y1="12" x2="52" y2="12" stroke="var(--tx)" stroke-width="2.2" stroke-linecap="round"/>
          </g>

          <!-- bored: open circles (transparent face), pupils looking sideways, flat mouth -->
          <g class="dc-expr dc-expr-bored">
            <circle cx="31" cy="11" r="4"   fill="transparent" stroke="var(--tx)" stroke-width="1.5"/>
            <circle cx="49" cy="11" r="4"   fill="transparent" stroke="var(--tx)" stroke-width="1.5"/>
            <circle cx="34" cy="11" r="1.8" fill="var(--tx)"/>
            <circle cx="52" cy="11" r="1.8" fill="var(--tx)"/>
            <line x1="36" y1="17" x2="44" y2="17" stroke="var(--tx)" stroke-width="1.4" stroke-linecap="round"/>
          </g>

          <!-- yawn: flat eyes + open oval mouth -->
          <g class="dc-expr dc-expr-yawn">
            <path d="M28,12 Q31,12.5 35,12" stroke="var(--tx)" stroke-width="2"   fill="none" stroke-linecap="round"/>
            <path d="M46,12 Q49,12.5 53,12" stroke="var(--tx)" stroke-width="2"   fill="none" stroke-linecap="round"/>
            <ellipse cx="40" cy="17.5" rx="3.5" ry="3" fill="var(--tx)"/>
          </g>

          <!-- focused: transparent eye circles, furrowed brows angled inward -->
          <g class="dc-expr dc-expr-focused">
            <ellipse cx="31" cy="11" rx="4.5" ry="4" fill="transparent" stroke="var(--tx)" stroke-width="1.8"/>
            <ellipse cx="49" cy="11" rx="4.5" ry="4" fill="transparent" stroke="var(--tx)" stroke-width="1.8"/>
            <circle cx="31" cy="11" r="2.3" fill="var(--tx)"/>
            <circle cx="49" cy="11" r="2.3" fill="var(--tx)"/>
            <path d="M27,7 L35,8.5"   stroke="var(--tx)" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M45,8.5 L53,7"   stroke="var(--tx)" stroke-width="2.2" stroke-linecap="round"/>
          </g>

          <!-- thinking: transparent eye circles, pupils up-left, arched brows -->
          <g class="dc-expr dc-expr-thinking">
            <ellipse cx="31" cy="11" rx="4" ry="3.5" fill="transparent" stroke="var(--tx)" stroke-width="1.5"/>
            <ellipse cx="49" cy="11" rx="4" ry="3.5" fill="transparent" stroke="var(--tx)" stroke-width="1.5"/>
            <circle cx="29" cy="9.5" r="1.8" fill="var(--tx)"/>
            <circle cx="47" cy="9.5" r="1.8" fill="var(--tx)"/>
            <path d="M27,7 Q31,5 35,7"   stroke="var(--tx)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M45,7 Q49,5 53,7"   stroke="var(--tx)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          </g>

          <!-- excited: 8-point sparkle eyes in accent colour -->
          <g class="dc-expr dc-expr-excited">
            <line x1="31" y1="7.5"  x2="31" y2="14.5"  stroke="var(--ac)" stroke-width="2"   stroke-linecap="round"/>
            <line x1="27.5" y1="11" x2="34.5" y2="11"  stroke="var(--ac)" stroke-width="2"   stroke-linecap="round"/>
            <line x1="28.5" y1="8.5" x2="33.5" y2="13.5" stroke="var(--ac)" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="28.5" y1="13.5" x2="33.5" y2="8.5" stroke="var(--ac)" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="49" y1="7.5"  x2="49" y2="14.5"  stroke="var(--ac)" stroke-width="2"   stroke-linecap="round"/>
            <line x1="45.5" y1="11" x2="52.5" y2="11"  stroke="var(--ac)" stroke-width="2"   stroke-linecap="round"/>
            <line x1="46.5" y1="8.5" x2="51.5" y2="13.5" stroke="var(--ac)" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="46.5" y1="13.5" x2="51.5" y2="8.5" stroke="var(--ac)" stroke-width="1.3" stroke-linecap="round"/>
          </g>

          <!-- happy: upward curved squint eyes + smile -->
          <g class="dc-expr dc-expr-happy">
            <path d="M27,13 Q31,9 35,13"      stroke="var(--tx)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M45,13 Q49,9 53,13"      stroke="var(--tx)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M34,17.5 Q40,21 46,17.5" stroke="var(--tx)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </g>

          <!-- surprised: transparent big eyes, raised brows, O mouth -->
          <g class="dc-expr dc-expr-surprised">
            <circle cx="31" cy="11" r="4.5" fill="transparent" stroke="var(--tx)" stroke-width="1.8"/>
            <circle cx="49" cy="11" r="4.5" fill="transparent" stroke="var(--tx)" stroke-width="1.8"/>
            <circle cx="31" cy="11" r="2.3" fill="var(--tx)"/>
            <circle cx="49" cy="11" r="2.3" fill="var(--tx)"/>
            <path d="M27,5.5 Q31,3 35,5.5"   stroke="var(--tx)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M45,5.5 Q49,3 53,5.5"   stroke="var(--tx)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <ellipse cx="40" cy="18.5" rx="2.5" ry="2" fill="none" stroke="var(--tx)" stroke-width="1.5"/>
          </g>

          <!-- wink: left transparent circle, right closed arc + smile -->
          <g class="dc-expr dc-expr-wink">
            <ellipse cx="31" cy="11" rx="4.5" ry="4"  fill="transparent" stroke="var(--tx)" stroke-width="1.8"/>
            <circle cx="31" cy="11" r="2.2"            fill="var(--tx)"/>
            <path d="M45,11 Q49,14 53,11"              stroke="var(--tx)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M36,17 Q40,20 44,17"              stroke="var(--tx)" stroke-width="1.3" fill="none" stroke-linecap="round"/>
          </g>
        </svg>
      </div>

      {#if dnaFactVisible}
        <span class="dna-fact-pill" role="status">{dnaFactText}</span>
      {/if}
    </div>

    <Weather />

    <div class="top-right">
      <!-- Dual-city clock + alarms -->
      <div class="clock-wrap">
        <button
          class="clock-btn"
          onclick={() => clockOpen = !clockOpen}
          title="Clock & Alarms"
          aria-expanded={clockOpen}
        >
          <span class="tz-seg">HBG {clockTime.hbg}</span>
          <span class="tz-dot">·</span>
          <span class="tz-seg">CHN {clockTime.chn}</span>
          {#if (store.settings.alarms ?? []).some(a => a.enabled)}
            <span class="alarm-active-dot" title="Alarms active"></span>
          {/if}
        </button>

        {#if clockOpen}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="clock-backdrop" onclick={() => clockOpen = false}></div>
          <div class="clock-popover">
            <div class="cpo-cities">
              <div class="cpo-city">
                <span class="cpo-city-label">Heidelberg</span>
                <span class="cpo-city-clock">{clockTime.hbg}</span>
              </div>
              <div class="cpo-city">
                <span class="cpo-city-label">Chennai</span>
                <span class="cpo-city-clock">{clockTime.chn}</span>
              </div>
            </div>

            <div class="cpo-alarms">
              <div class="cpo-alarm-head">
                <span class="cpo-section-title">Alarms (local time)</span>
                <button class="btn-link" onclick={() => { clockOpen = false; store.view = 'calendar'; }}>
                  Calendar →
                </button>
              </div>

              {#each (store.settings.alarms ?? []) as alarm (alarm.id)}
                <div class="alarm-row" class:alarm-off={!alarm.enabled}>
                  <input
                    type="checkbox"
                    checked={alarm.enabled}
                    onchange={() => toggleAlarm(alarm.id)}
                    style="accent-color: var(--ac); width: auto; cursor: pointer;"
                  />
                  <span class="alarm-time">{alarm.time}</span>
                  <span class="alarm-label">{alarm.label || '—'}</span>
                  <button class="btn-icon alarm-del" onclick={() => removeAlarm(alarm.id)} title="Remove">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              {:else}
                <p class="cpo-empty">No alarms set.</p>
              {/each}

              <div class="alarm-add">
                <input
                  type="time"
                  bind:value={newAlarmTime}
                  class="alarm-time-input"
                />
                <input
                  type="text"
                  bind:value={newAlarmLabel}
                  placeholder="Label (optional)"
                  class="alarm-label-input"
                  maxlength="40"
                  onkeydown={(e) => e.key === 'Enter' && addAlarm()}
                />
                <button class="btn btn-primary btn-sm" onclick={addAlarm} disabled={!newAlarmTime}>
                  Add
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <button
        class="btn-icon theme-toggle"
        onclick={() => {
          const cur = store.settings.themeOverride;
          const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
          store.settings.themeOverride = next;
          store.saveSettings();
        }}
        title="Toggle theme"
      >
        {store.settings.themeOverride === 'dark' ? '☀' : store.settings.themeOverride === 'light' ? '◑' : '◐'}
      </button>
      <button
        class="btn-icon enzo-toggle"
        onclick={() => store.enzoOpen = !store.enzoOpen}
        title="Toggle Enzo"
      >
        <span class="enzo-dot"></span>
        <span class="enzo-label">Enzo</span>
      </button>
      <button class="search-trigger" onclick={() => paletteOpen = !paletteOpen} title="Search (Ctrl+K)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span class="search-trigger-label">Search</span>
        <kbd class="search-trigger-kbd">⌘K</kbd>
      </button>
      <button class="btn-icon help-btn" onclick={() => helpOpen = true} title="Help (?)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </button>
      <button class="btn-icon logout-btn" onclick={() => store.logout()} title="Lock">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </button>
    </div>
  </header>

  <div class="main-layout">
    {#if store.sidebarOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="panel-backdrop" onclick={() => store.sidebarOpen = false}></div>
      <aside class="sidebar-panel">
        <Sidebar />
      </aside>
    {/if}

    <main class="content-panel">
      {#if store.view === 'dashboard'}
        <Dashboard {showToast} />
      {:else if store.view === 'notes'}
        {#if store.openTabs.length > 0}
          <div class="notes-tabbar">
            {#each store.openTabs as tabId (tabId)}
              {@const tabNote = store.notes.find(n => n.id === tabId)}
              <button
                class="notes-tab"
                class:notes-tab-active={store.currentNoteId === tabId}
                onclick={() => { store.currentNoteId = tabId; }}
                title={tabNote?.title || 'Untitled'}
              >
                {#if tabNote?.color}<span class="notes-tab-dot" style="background:var(--{tabNote.color})"></span>{/if}
                <span class="notes-tab-title">{tabNote?.title || 'Untitled'}</span>
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <span class="notes-tab-close" role="button" tabindex="-1"
                  onclick={(e) => {
                    e.stopPropagation();
                    const idx = store.openTabs.indexOf(tabId);
                    store.openTabs = store.openTabs.filter(t => t !== tabId);
                    if (store.currentNoteId === tabId)
                      store.currentNoteId = store.openTabs[Math.max(0, idx - 1)] ?? null;
                  }}>×</span>
              </button>
            {/each}
            <button class="notes-tab-add" onclick={newNoteTab} title="New note">+</button>
          </div>
        {/if}
        {#if store.currentNoteId}
          <Editor {showToast} />
        {:else}
          <NotesHome {showToast} />
        {/if}
      {:else if store.view === 'journal'}
        <Journal {showToast} />
      {:else if store.view === 'tasks'}
        <Tasks {showToast} />
      {:else if store.view === 'calendar'}
        <Calendar {showToast} />
      {:else if store.view === 'research'}
        <Research {showToast} />
      {:else if store.view === 'pipeline'}
        <Pipeline {showToast} />
      {:else if store.view === 'jobs'}
        <Jobs {showToast} />
      {:else if store.view === 'audio'}
        <Audio {showToast} />
      {:else if store.view === 'presentations'}
        <Presentations {showToast} />
      {:else if store.view === 'files'}
        <Files {showToast} />
      {:else if store.view === 'grants'}
        <Grants {showToast} />
      {:else if store.view === 'manuscript'}
        <Manuscript {showToast} />
      {:else if store.view === 'review'}
        <ReviewArticle {showToast} />
      {:else if store.view === 'mail'}
        <Mail {showToast} />
      {:else if store.view === 'biblio'}
        <Biblio />
      {:else if store.view === 'launchpad'}
        <Launchpad />
      {:else if store.view === 'settings'}
        <Settings {showToast} />
      {/if}
    </main>

    {#if store.enzoOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="panel-backdrop" onclick={() => store.enzoOpen = false}></div>
      <aside class="enzo-panel">
        <Enzo {showToast} />
      </aside>
    {/if}

    {#if store.mailComposeOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="overlay-backdrop" onclick={() => store.mailComposeOpen = false}></div>
      <div class="compose-sheet">
        <Mail {showToast} />
      </div>
    {/if}
  </div>

  <nav class="bottom-nav" aria-label="Main navigation">
    {#each BOTTOM_NAV as item}
      <button
        class="bn-item"
        class:active={store.view === item.id}
        onclick={() => { store.view = item.id as any; if (item.id === 'notes') store.currentNoteId = null; store.sidebarOpen = false; }}
        aria-label={item.label}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d={item.icon}/>
        </svg>
        <span class="bn-label">{item.label}</span>
        {#if item.id === 'tasks' && store.activeTasks.length > 0}
          <span class="bn-badge">{store.activeTasks.length}</span>
        {/if}
      </button>
    {/each}
    <button
      class="bn-item bn-enzo"
      class:active={store.enzoOpen}
      onclick={() => { store.enzoOpen = !store.enzoOpen; store.sidebarOpen = false; }}
      aria-label="Enzo AI"
    >
      <span class="bn-enzo-orb"></span>
      <span class="bn-label">Enzo</span>
    </button>
  </nav>

  {#if toastMsg}
    <div class="toast {toastType}" role="alert">{toastMsg}</div>
  {/if}
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--bg);
  }

  /* ── Top bar ── */
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 46px;
    background: var(--sf);
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
    gap: 12px;
    z-index: 100;
    overflow: visible;
  }

  .top-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .app-name {
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: -0.02em;
    color: var(--tx);
  }

  /* ── DNA character widget ──────────────────────────────────── */
  .enzo-activity {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    --dna-dur: 5s;
  }
  .enzo-activity.enzo-active { --dna-dur: 0.55s; }

  .dna-char { display: block; flex-shrink: 0; overflow: hidden; }

  /* Helix strands */
  .dc-strand-a { fill: none; stroke: var(--ac); stroke-width: 2.5; stroke-linecap: round; }
  .dc-strand-b { fill: none; stroke: var(--pu); stroke-width: 2;   stroke-linecap: round; opacity: 0.75; }

  /* Rungs */
  .dc-rung   { stroke-linecap: round; }
  .dc-rung-a { stroke: var(--ac);  stroke-width: 1.8; opacity: 0.8; }
  .dc-rung-b { stroke: var(--pu);  stroke-width: 1.8; opacity: 0.8; }
  .dc-rung-q { stroke: var(--bd2); stroke-width: 1.2; opacity: 0.45; }

  /* Helix scroll */
  .dc-scroll { animation: dc-spin var(--dna-dur, 5s) linear infinite; }
  @keyframes dc-spin {
    from { transform: translateX(0); }
    to   { transform: translateX(-40px); }
  }

  /* Expressions: hidden by default, shown via data-expr attribute */
  .dc-expr { opacity: 0; transition: opacity 0.3s ease; pointer-events: none; }
  .enzo-activity[data-expr="idle"]      .dc-expr-idle      { opacity: 1; }
  .enzo-activity[data-expr="sleepy"]    .dc-expr-sleepy    { opacity: 1; }
  .enzo-activity[data-expr="bored"]     .dc-expr-bored     { opacity: 1; }
  .enzo-activity[data-expr="yawn"]      .dc-expr-yawn      { opacity: 1; }
  .enzo-activity[data-expr="focused"]   .dc-expr-focused   { opacity: 1; }
  .enzo-activity[data-expr="thinking"]  .dc-expr-thinking  { opacity: 1; }
  .enzo-activity[data-expr="excited"]   .dc-expr-excited   { opacity: 1; }
  .enzo-activity[data-expr="happy"]     .dc-expr-happy     { opacity: 1; }
  .enzo-activity[data-expr="surprised"] .dc-expr-surprised { opacity: 1; }
  .enzo-activity[data-expr="wink"]      .dc-expr-wink      { opacity: 1; }

  /* Fact pill — inline, fills remaining space in .top-left, wraps to 2 lines */
  .dna-fact-pill {
    flex: 1;
    min-width: 0;
    font-size: 0.65rem;
    line-height: 1.35;
    color: var(--tx2);
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 8px;
    padding: 3px 10px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    pointer-events: none;
    animation: fact-pop 0.2s ease;
  }
  @keyframes fact-pop {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }
  @media (max-width: 480px) {
    .dna-fact-pill { display: none; }
  }

  .top-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  /* ── Dual clock ── */
  .clock-wrap {
    position: relative;
  }

  .clock-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.72rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--tx2);
    background: transparent;
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    padding: 3px 9px;
    letter-spacing: 0.02em;
    transition: all var(--transition);
    cursor: pointer;
    white-space: nowrap;
  }
  .clock-btn:hover,
  .clock-btn[aria-expanded="true"] {
    border-color: var(--ac);
    color: var(--ac);
    background: var(--ac-bg);
  }

  .tz-dot { color: var(--bd2); }

  .alarm-active-dot {
    width: 5px; height: 5px;
    background: var(--rd);
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── Clock popover ── */
  .clock-backdrop {
    position: fixed;
    inset: 0;
    z-index: 98;
    background: transparent;
  }

  .clock-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 99;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    width: 290px;
    overflow: hidden;
  }

  .cpo-cities {
    display: flex;
    border-bottom: 1px solid var(--bd);
  }
  .cpo-city {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 10px 12px;
    gap: 3px;
  }
  .cpo-city:first-child { border-right: 1px solid var(--bd); }
  .cpo-city-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--mu);
  }
  .cpo-city-clock {
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--tx);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .cpo-alarms {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cpo-alarm-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }
  .cpo-section-title {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--mu);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .btn-link {
    background: transparent;
    border: none;
    color: var(--ac);
    cursor: pointer;
    font-size: 0.72rem;
    padding: 2px 4px;
    font-family: var(--font);
    border-radius: var(--radius-sm);
  }
  .btn-link:hover { text-decoration: underline; background: var(--ac-bg); }

  .alarm-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
  }
  .alarm-row.alarm-off { opacity: 0.45; }
  .alarm-time {
    font-size: 0.85rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--tx);
    min-width: 38px;
  }
  .alarm-label {
    flex: 1;
    font-size: 0.8rem;
    color: var(--tx2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .alarm-del {
    opacity: 0.4;
    padding: 3px;
  }
  .alarm-del:hover { opacity: 1; color: var(--rd); background: var(--rd-bg); }

  .cpo-empty {
    font-size: 0.8rem;
    color: var(--mu);
    padding: 2px 0;
  }

  .alarm-add {
    display: flex;
    gap: 6px;
    align-items: center;
    padding-top: 8px;
    border-top: 1px solid var(--bd);
  }
  .alarm-time-input {
    width: 94px;
    flex-shrink: 0;
    font-size: 0.82rem;
    padding: 5px 8px;
  }
  .alarm-label-input {
    flex: 1;
    font-size: 0.82rem;
    min-width: 0;
    padding: 5px 8px;
  }

  /* ── Search trigger ── */
  .search-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--tx2);
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    padding: 4px 9px;
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
  }
  .search-trigger:hover { border-color: var(--ac); color: var(--ac); background: var(--ac-bg); }
  .search-trigger-label { display: none; }
  @media (min-width: 900px) { .search-trigger-label { display: inline; } }
  .search-trigger-kbd {
    font-size: 0.62rem;
    color: var(--mu);
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: 3px;
    padding: 0 4px;
    font-family: var(--mono);
    line-height: 1.5;
  }

  /* ── Search overlay ── */
  .search-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    backdrop-filter: blur(2px);
    z-index: 200;
  }
  .search-overlay {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    width: min(620px, 94vw);
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    box-shadow: 0 24px 64px rgba(0,0,0,0.28);
    z-index: 201;
    overflow: hidden;
  }
  .search-input-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--bd);
  }
  .search-icon { color: var(--mu); flex-shrink: 0; }
  .search-global-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 1rem;
    color: var(--tx);
    font-family: var(--font);
    outline: none;
    padding: 0;
    min-width: 0;
  }
  .search-global-input::placeholder { color: var(--mu); }
  .search-esc {
    font-size: 0.62rem;
    color: var(--mu);
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 3px;
    padding: 2px 6px;
    cursor: pointer;
    font-family: var(--mono);
    flex-shrink: 0;
  }
  .search-esc:hover { background: var(--bd); }

  .search-results {
    max-height: 360px;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .search-result {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background var(--transition);
    width: 100%;
  }
  .search-result:hover, .search-result-active { background: var(--sf2); }
  .sr-section-pill {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ac);
    background: var(--ac-bg);
    padding: 2px 6px;
    border-radius: 10px;
    flex-shrink: 0;
    min-width: 44px;
    text-align: center;
  }
  .sr-icon { color: var(--mu); flex-shrink: 0; }
  .sr-body { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .sr-title {
    font-size: 0.87rem;
    font-weight: 500;
    color: var(--tx);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sr-preview {
    font-size: 0.75rem;
    color: var(--mu);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sr-enter { color: var(--mu); opacity: 0; flex-shrink: 0; }
  .search-result:hover .sr-enter, .search-result-active .sr-enter { opacity: 1; color: var(--ac); }

  .search-empty {
    padding: 24px 18px;
    font-size: 0.87rem;
    color: var(--mu);
    text-align: center;
  }
  .search-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    font-size: 0.75rem;
    color: var(--mu);
  }
  .search-hint-keys { display: flex; gap: 8px; align-items: center; }
  /* ── Quick capture ── */
  .capture-overlay {
    position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
    width: min(520px, 94vw); background: var(--sf);
    border: 1px solid var(--bd); border-radius: var(--radius);
    box-shadow: 0 24px 64px rgba(0,0,0,0.28); z-index: 201;
    padding: 14px; display: flex; flex-direction: column; gap: 10px;
  }
  .capture-route-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .capture-route-btn {
    padding: 4px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 500;
    background: var(--sf2); border: 1px solid var(--bd); color: var(--tx2); cursor: pointer;
    transition: all var(--transition);
  }
  .capture-route-btn:hover { border-color: var(--ac); color: var(--ac); }
  .capture-route-active { background: var(--ac-bg); border-color: var(--ac); color: var(--ac); }
  .capture-input-row { display: flex; gap: 8px; }
  .capture-input {
    flex: 1; font-size: 0.95rem; font-family: var(--font);
    border: 1px solid var(--bd); border-radius: var(--radius-sm);
    padding: 8px 12px; background: var(--sf2); color: var(--tx);
    outline: none;
  }
  .capture-input:focus { border-color: var(--ac); }
  .capture-hint { text-align: right; }

  .search-hint-keys kbd {
    font-size: 0.62rem;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 3px;
    padding: 1px 5px;
    font-family: var(--mono);
    color: var(--tx2);
  }

  /* ── Rest of topbar ── */
  .enzo-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--enzo);
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    background: var(--enzo-bg);
    border: 1px solid var(--enzo-bd);
  }
  .enzo-toggle:hover { opacity: 0.85; }

  .enzo-dot {
    width: 7px; height: 7px;
    background: var(--gn);
    border-radius: 50%;
    display: inline-block;
  }

  .help-btn { color: var(--mu); }
  .help-btn:hover { color: var(--ac); background: var(--ac-bg); }

  .theme-toggle, .logout-btn {
    font-size: 15px;
    color: var(--mu);
  }
  .theme-toggle:hover, .logout-btn:hover { color: var(--tx); background: var(--sf2); }

  /* ── Main layout ── */
  .main-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .sidebar-panel {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    overflow-y: auto;
    background: var(--sf);
  }

  .content-panel {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Notes tab bar ─────────────────────────────────────────────────────── */
  .notes-tabbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px 0;
    background: var(--sf);
    border-bottom: 1px solid var(--bd);
    overflow-x: auto;
    flex-shrink: 0;
    scrollbar-width: none;
  }
  .notes-tabbar::-webkit-scrollbar { display: none; }

  .notes-tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px 5px 10px;
    border-radius: 6px 6px 0 0;
    border: 1px solid transparent;
    border-bottom: none;
    background: transparent;
    color: var(--tx2);
    font-size: 0.78rem;
    cursor: pointer;
    max-width: 160px;
    min-width: 80px;
    transition: background var(--transition), color var(--transition);
    flex-shrink: 0;
    position: relative;
    bottom: -1px;
  }
  .notes-tab:hover { background: var(--sf2); color: var(--tx); }
  .notes-tab-active {
    background: var(--bg) !important;
    color: var(--tx) !important;
    border-color: var(--bd);
    border-bottom-color: var(--bg);
  }
  .notes-tab-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .notes-tab-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
  .notes-tab-close {
    opacity: 0;
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    border-radius: 3px;
    color: var(--mu);
    flex-shrink: 0;
    transition: opacity var(--transition), color var(--transition), background var(--transition);
  }
  .notes-tab:hover .notes-tab-close { opacity: 1; }
  .notes-tab-close:hover { color: var(--rd, #e85d5d); background: color-mix(in srgb, var(--rd, #e85d5d) 12%, transparent); }

  .notes-tab-add {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px dashed var(--bd);
    background: transparent;
    color: var(--mu);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    transition: all var(--transition);
  }
  .notes-tab-add:hover { border-color: var(--ac); color: var(--ac); background: var(--ac-bg); }

  .enzo-panel {
    width: 320px;
    flex-shrink: 0;
    border-left: 1px solid var(--bd);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--sf);
  }

  /* ── Always-visible overlay backdrop ── */
  .overlay-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.42);
    backdrop-filter: blur(1px);
    z-index: 49;
  }

  /* ── Global compose sheet (always overlay) ── */
  .compose-sheet {
    position: absolute;
    top: 0; right: 0;
    height: 100%;
    width: 520px;
    max-width: 92vw;
    z-index: 50;
    background: var(--sf);
    border-left: 1px solid var(--bd);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Overlay backdrop (tablet + mobile) ── */
  .panel-backdrop { display: none; }

  /* ── Bottom nav (mobile only) ── */
  .bottom-nav { display: none; }

  /* ── Tablet: panels become overlays, content stays full-width ── */
  @media (max-width: 900px) {
    .panel-backdrop {
      display: block;
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.42);
      backdrop-filter: blur(1px);
      z-index: 49;
    }

    .sidebar-panel {
      position: absolute;
      top: 0; left: 0;
      height: 100%;
      width: 260px;
      z-index: 50;
      box-shadow: var(--shadow-lg);
      border-right: 1px solid var(--bd);
    }

    .enzo-panel {
      position: absolute;
      top: 0; right: 0;
      height: 100%;
      width: 340px;
      max-width: 88vw;
      z-index: 50;
      box-shadow: var(--shadow-lg);
      border-left: 1px solid var(--bd);
    }
  }

  /* ── Mobile: bottom nav, trimmed top bar ── */
  @media (max-width: 640px) {
    .top-bar { padding: 0 10px; gap: 6px; }
    .app-name { display: none; }
    .help-btn { display: none; }
    .enzo-label { display: none; }
    .tz-seg:not(:first-of-type) { display: none; }
    .tz-dot { display: none; }
    .dna-char { width: 48px; height: auto; }

    .enzo-panel { width: 100%; max-width: 100%; }

    .main-layout { padding-bottom: 60px; }

    .bottom-nav {
      display: flex;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: calc(60px + env(safe-area-inset-bottom, 0px));
      padding-bottom: env(safe-area-inset-bottom, 0px);
      background: var(--sf);
      border-top: 1px solid var(--bd);
      z-index: 110;
    }

    .bn-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      background: transparent;
      border: none;
      color: var(--tx2);
      cursor: pointer;
      position: relative;
      padding: 6px 4px 4px;
      transition: color var(--transition);
    }
    .bn-item:active { opacity: 0.7; }
    .bn-item.active { color: var(--ac); }
    .bn-item.active svg { stroke: var(--ac); }

    .bn-label {
      font-size: 0.58rem;
      font-weight: 600;
      letter-spacing: 0.01em;
    }

    .bn-badge {
      position: absolute;
      top: 4px;
      right: calc(50% - 20px);
      background: var(--ac);
      color: #fff;
      font-size: 0.55rem;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 8px;
      min-width: 14px;
      text-align: center;
      line-height: 1.4;
    }

    .bn-enzo { color: var(--enzo); }
    .bn-enzo.active { color: var(--enzo); }
    .bn-enzo-orb {
      width: 22px; height: 22px;
      border-radius: 50%;
      background: var(--enzo-bg);
      border: 1.5px solid var(--enzo-bd);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bn-enzo-orb::after {
      content: '';
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--gn);
    }
  }

  @media (max-width: 480px) {
    .enzo-activity { display: none; }
    .dna-fact-pill { display: none; }
  }

  @media (max-width: 380px) {
    .search-trigger { display: none; }
    .enzo-toggle { display: none; }
    .theme-toggle { display: none; }
  }
</style>
