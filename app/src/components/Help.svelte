<script lang="ts">
  let { onclose }: { onclose: () => void } = $props();

  let search = $state('');
  let searchEl = $state<HTMLInputElement | undefined>(undefined);

  $effect(() => { searchEl?.focus(); });

  function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onclose(); }

  // ── Navigation sections ──────────────────────────────────────
  const NAV_SECTIONS = [
    { id: 'start',    label: 'Getting started', cls: 'nav-ac' },
    { id: 'flow',     label: 'How it works',    cls: 'nav-gn' },
    { id: 'notes',    label: 'Notes',           cls: 'nav-ac' },
    { id: 'journal',  label: 'Journal',         cls: 'nav-enzo' },
    { id: 'tasks',    label: 'Tasks',           cls: 'nav-rd' },
    { id: 'calendar', label: 'Calendar',        cls: 'nav-yw' },
    { id: 'enzo',     label: 'Enzo AI',         cls: 'nav-enzo' },
    { id: 'research', label: 'Research',        cls: 'nav-pu' },
    { id: 'pipeline', label: 'Pipeline',        cls: 'nav-gn' },
    { id: 'jobs',     label: 'Jobs',            cls: 'nav-ac' },
    { id: 'audio',    label: 'Audio',           cls: 'nav-pu' },
    { id: 'settings', label: 'Settings',        cls: 'nav-mu' },
  ];

  // ── QA sections ───────────────────────────────────────────────
  const SECTIONS = [
    {
      id: 'start', title: 'Getting started', color: 'ac',
      items: [
        { q: 'Logging in', a: 'Enter your GitHub Personal Access Token (PAT) on the login screen. The PAT is both your authentication credential and your encryption key — it never leaves your device in plaintext.' },
        { q: 'Where data lives', a: 'Every save creates a commit in Q-onco/notes repository as an encrypted .enc file. AES-256-GCM encryption with PBKDF2 (600,000 iterations). Nothing is readable without your PAT.' },
        { q: 'PWA install', a: 'Q·onco is a Progressive Web App — install it from your browser install prompt. Once cached, the app shell loads offline; data syncs when connectivity returns.' },
        { q: 'Session trust', a: '"Trust this device" stores your token in sessionStorage. Logging out clears it immediately. The token is never stored in localStorage.' },
      ]
    },
    {
      id: 'notes', title: 'Notes', color: 'ac',
      items: [
        { q: 'Creating notes', a: 'Press + in the sidebar or "New note" on the Dashboard. Notes use Markdown. The formatting toolbar (B / I / H1 / H2 / H3 / UL / code / table…) above the editor wraps selected text.' },
        { q: 'Task extraction', a: 'Write - [ ] task text in any note and it automatically appears in your Tasks list. Use - [x] to mark done. Tasks stay linked to their source note.' },
        { q: 'Auto-save', a: 'Notes save 1.2 s after you stop typing. The timestamp in the toolbar confirms the last save. Every save is a distinct GitHub commit.' },
        { q: 'Pin and archive', a: 'Pinned notes appear at the top of the sidebar. Archived notes are hidden but never deleted — they remain in encrypted storage.' },
        { q: 'Export', a: 'Click the download icon to export a note as a .md file. Use "Export all" in the sidebar to download every note in one ZIP-compatible bundle.' },
      ]
    },
    {
      id: 'journal', title: 'Journal', color: 'enzo',
      items: [
        { q: 'Daily entries', a: 'The journal is for free-form reflection — what happened today, what you discovered, what puzzled you. Entries are date-stamped and fully searchable.' },
        { q: 'Mood and context', a: 'Select a mood chip (Focused, Curious, Frustrated…) and context tag (Research, Writing, Experiment…) before saving. These appear as calendar dots.' },
        { q: 'Markdown toolbar', a: 'The same MD formatting toolbar from Notes is available in the journal editor — bold, italic, headings, lists, code blocks, links.' },
        { q: 'Calendar click-through', a: 'Clicking a journal dot on the Calendar opens that entry for editing directly in the Journal view.' },
      ]
    },
    {
      id: 'tasks', title: 'Tasks', color: 'rd',
      items: [
        { q: 'Adding tasks', a: 'Type in the task field and press Enter or click Add. Set priority (High / Medium / Low) and an optional due date.' },
        { q: 'Due dates on calendar', a: 'Tasks with due dates appear as red dots on the Calendar. Click the day to see all tasks due, and toggle them done from calendar view.' },
        { q: 'Note-linked tasks', a: 'Tasks extracted from a note via - [ ] syntax show a "From note" chip. Click it to jump to the source note.' },
      ]
    },
    {
      id: 'calendar', title: 'Calendar', color: 'yw',
      items: [
        { q: 'Colour-coded dots', a: 'Blue = notes, amber = journal, purple = audio, green = Enzo sessions, yellow = calendar events, red = tasks due. Click any day to see all items.' },
        { q: 'Click-through navigation', a: 'Notes → opens note editor. Journal → opens that entry. Audio → opens recording in Audio section. Enzo sessions → re-opens Enzo panel. Tasks → toggleable in-place.' },
        { q: 'Apple Calendar import', a: 'Export .ics from Apple Calendar (File → Export) and import it here. Events appear as yellow dots. Sync by re-importing after each export.' },
        { q: 'Example events', a: 'Three domain-specific example events are shown when no .ics has been imported — ESMO abstract deadline, lab meeting, and committee review.' },
      ]
    },
    {
      id: 'enzo', title: 'Enzo AI', color: 'enzo',
      items: [
        { q: 'Who is Enzo?', a: 'Enzo is your oncology research AI — expert in HGSOC biology, TME, scRNA-seq, spatial transcriptomics, PARP inhibitors, biomarker discovery, and bioinformatics. She speaks peer-to-peer.' },
        { q: 'Note context', a: 'When a note is open, Enzo reads its content. The blue bar at the bottom of the chat panel shows which note she is referencing.' },
        { q: 'Quick prompts', a: 'Dashboard has shortcut prompts (Summarise my latest note, Suggest next analysis steps…). Clicking one pre-fills Enzo\'s input.' },
        { q: 'Chat history', a: 'Click the History tab in the Enzo panel to search all past conversations. Sessions are grouped by date and stored encrypted.' },
        { q: 'Stopping a response', a: 'Click Stop at any time to abort streaming. The partial text is discarded and input is re-enabled immediately.' },
      ]
    },
    {
      id: 'research', title: 'Research', color: 'pu',
      items: [
        { q: 'Enable first', a: 'Research requires enabling for the session — click the "Enable for this session" button on first visit. Stays active until tab close.' },
        { q: 'Sources', a: 'PubMed, OpenAlex, Europe PMC, bioRxiv, medRxiv, Nature, and Cell. Toggle sources with the chip bar at the top.' },
        { q: 'Quick topics', a: 'Expand "Quick topics" to see curated search presets grouped by domain: TME, scRNA-seq/spatial, PARPi resistance, clinical trials, emerging targets.' },
        { q: 'AI summaries', a: 'Click the summary icon (document icon) on any paper to get a structured Enzo summary: hypothesis, methods, key finding, HGSOC relevance, caveats.' },
        { q: 'Reading list', a: 'Bookmark papers with the bookmark icon. They appear in the Reading List tab with priority tags and read/unread status.' },
      ]
    },
    {
      id: 'pipeline', title: 'Pipeline Tracker', color: 'gn',
      items: [
        { q: 'Enable first', a: 'Pipeline requires enabling for the session — click "Enable for this session" on first visit.' },
        { q: 'Creating a run', a: 'Click + New Run, enter a title, sample ID, pipeline type, tissue, and condition. Pre-configured step templates are created automatically based on pipeline type (scRNA-seq, spatial, bulk RNA, WES, custom).' },
        { q: 'Steps', a: 'Each step has a name, tool, version, params textarea, and status that cycles: pending → running → done → failed → skipped. Click the status circle to advance.' },
        { q: 'QC metrics', a: 'Add key-value QC metrics (median_genes, mapping_rate…) with pass/warn/fail flags. Useful for cohort QC documentation.' },
        { q: 'Protocols', a: 'Store reusable protocol bodies as Markdown in the Protocols tab. Link protocols to runs for reproducibility.' },
      ]
    },
    {
      id: 'jobs', title: 'Jobs Portal', color: 'ac',
      items: [
        { q: 'Enable first', a: 'The Jobs portal requires enabling for the session — click "Enable for this session" on first visit.' },
        { q: 'Tabs overview', a: 'Feed (live RSS), Tracker (kanban), Companies (EU/India grid), CV Builder, Cover Letters (AI-generated), Network, Salary, Analytics.' },
        { q: 'CV Builder', a: '8 sub-tabs: personal info, experience, education, publications, skills, conferences, awards, and live Markdown preview. Export as .md.' },
        { q: 'AI cover letters', a: 'From the Tracker, open a job and click "Generate cover letter". Enzo uses your CV data to write a tailored 400-500 word letter.' },
        { q: 'Salary benchmarks', a: 'Add salary data from offers, Glassdoor, LinkedIn, or estimates. Salary tab shows all benchmarks by region and role.' },
      ]
    },
    {
      id: 'audio', title: 'Audio & Transcription', color: 'pu',
      items: [
        { q: 'Enable first', a: 'Audio requires enabling for the session — click "Enable for this session" on first visit. Requires Worker URL in Settings.' },
        { q: 'Recording', a: 'Click "Start recording". Audio is transcribed in 15-second chunks via Groq Whisper (large-v3) in real time. Click Stop to finish.' },
        { q: 'Daily quota', a: '2 hours per day per device. The progress bar in the Audio view shows remaining time. Resets at midnight.' },
        { q: 'Calendar click-through', a: 'Clicking an audio dot on the Calendar navigates to the Audio section and highlights that recording.' },
      ]
    },
    {
      id: 'settings', title: 'Settings', color: 'mu',
      items: [
        { q: 'Worker URL', a: 'Cloudflare Worker URL that proxies all AI calls. Use the Test button to verify connectivity. Default: enzo.quant-onco.workers.dev.' },
        { q: 'Researcher profile', a: 'Specializations, target roles, and target locations are used by Enzo for job matching and cover letter generation.' },
        { q: 'Accent colour', a: 'Choose from blue, green, purple, teal, or rose. Applied on next app load after saving.' },
        { q: 'Export data', a: 'Downloads all your notes, journal, tasks, audio records, and jobs as a single JSON file. AES decrypted locally before export.' },
        { q: 'Danger zone', a: 'Log out clears your session. Data remains encrypted in GitHub — you can log back in with the same PAT.' },
      ]
    },
  ];

  const filtered = $derived(
    search.trim()
      ? SECTIONS.map(s => ({
          ...s,
          items: s.items.filter(
            it =>
              it.q.toLowerCase().includes(search.toLowerCase()) ||
              it.a.toLowerCase().includes(search.toLowerCase()) ||
              s.title.toLowerCase().includes(search.toLowerCase())
          )
        })).filter(s => s.items.length > 0)
      : SECTIONS
  );

  // ── Flow steps data ─────────────────────────────────────────
  const FLOW_STEPS = [
    { label: 'GitHub PAT', cls: 'step-ac',   desc: 'Your Personal Access Token — authentication + encryption key' },
    { label: 'Login',      cls: 'step-gn',   desc: 'Validate token, fetch user info' },
    { label: 'Decrypt',    cls: 'step-enzo', desc: 'loadAll() — 14 encrypted files decrypted in parallel' },
    { label: 'App state',  cls: 'step-pu',   desc: 'All data loaded into reactive Svelte store' },
    { label: 'Sections',   cls: 'step-ac',   desc: 'Dashboard, Notes, Journal, Tasks, Calendar, Enzo always on' },
    { label: 'Toggle',     cls: 'step-yw',   desc: 'Pipeline / Research / Audio / Jobs — enable per session' },
    { label: 'Edit',       cls: 'step-gn',   desc: 'Changes update store state reactively' },
    { label: 'Auto-save',  cls: 'step-ac',   desc: 'Encrypted, committed to GitHub as distinct commit' },
  ];
</script>

<svelte:window onkeydown={handleKey} />

<div class="backdrop" onclick={onclose} role="presentation"></div>

<div class="help-dialog" role="dialog" aria-modal="true" aria-label="Help">
  <div class="help-head">
    <div class="help-title-row">
      <h2>Help &amp; reference</h2>
      <button class="btn-icon close-btn" onclick={onclose} aria-label="Close help">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <input
      type="search"
      bind:value={search}
      placeholder="Search help topics…"
      class="help-search"
      bind:this={searchEl}
    />
    <!-- Nav chips -->
    <div class="nav-chips">
      {#each NAV_SECTIONS as sec}
        <a href="#{sec.id}" class="nav-chip {sec.cls}" onclick={() => {}}>{sec.label}</a>
      {/each}
    </div>
  </div>

  <div class="help-body">

    <!-- ── How it works: master flow ── -->
    {#if !search.trim()}
      <section class="help-section" id="flow">
        <h3 class="section-title clr-gn">How Q·onco works</h3>
        <div class="flow-diagram">
          {#each FLOW_STEPS as step, i}
            <div class="flow-chip {step.cls}" title={step.desc}>{step.label}</div>
            {#if i < FLOW_STEPS.length - 1}
              <span class="lf-arr">→</span>
            {/if}
          {/each}
        </div>
        <div class="flow-notes">
          {#each FLOW_STEPS as step}
            <div class="flow-note">
              <span class="flow-note-chip {step.cls}">{step.label}</span>
              <span class="flow-note-desc text-xs text-mu">{step.desc}</span>
            </div>
          {/each}
        </div>
      </section>

      <!-- Section quick-flow cards -->
      <section class="help-section" id="start">
        <h3 class="section-title clr-ac">Getting started — step by step</h3>
        <div class="step-flow">
          <div class="flow-step step-ac">1 · Get a GitHub PAT</div>
          <span class="lf-arr">→</span>
          <div class="flow-step step-ac">2 · Paste on login screen</div>
          <span class="lf-arr">→</span>
          <div class="flow-step step-gn">3 · Data decrypts</div>
          <span class="lf-arr">→</span>
          <div class="flow-step step-gn">4 · All sections available</div>
        </div>
        <div class="qa-list">
          {#each SECTIONS[0].items as item}
            <details class="qa-item">
              <summary class="qa-q">{item.q}</summary>
              <p class="qa-a text-sm">{item.a}</p>
            </details>
          {/each}
        </div>
      </section>
    {/if}

    <!-- ── Filtered/all sections ── -->
    {#if filtered.length === 0}
      <p class="no-results text-sm text-mu">No results for "{search}"</p>
    {/if}

    {#each (search.trim() ? filtered : filtered.slice(1)) as section}
      <section class="help-section" id={section.id}>
        <h3 class="section-title clr-{section.color}">{section.title}</h3>
        <div class="qa-list">
          {#each section.items as item}
            <details class="qa-item">
              <summary class="qa-q">{item.q}</summary>
              <p class="qa-a text-sm">{item.a}</p>
            </details>
          {/each}
        </div>
      </section>
    {/each}

    <p class="help-footer text-xs text-mu">Q·onco — encrypted research intelligence for Dr. Amritha Sathyanarayanan.</p>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .help-dialog {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1001;
    width: min(680px, calc(100vw - 32px));
    max-height: calc(100vh - 60px);
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: dialog-in 0.18s ease;
  }

  @keyframes dialog-in {
    from { opacity: 0; transform: translate(-50%, -52%); }
    to   { opacity: 1; transform: translate(-50%, -50%); }
  }

  .help-head {
    padding: 16px 18px 10px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .help-title-row { display: flex; align-items: center; justify-content: space-between; }
  .help-title-row h2 { font-size: 1rem; }
  .close-btn { color: var(--mu); }
  .close-btn:hover { color: var(--tx); background: var(--sf2); }

  .help-search { font-size: 0.875rem; }

  /* ── Nav chips ── */
  .nav-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .nav-chip {
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    border: 1px solid var(--bd);
    text-decoration: none;
    transition: all var(--transition);
  }
  .nav-ac   { background: var(--ac-bg);   color: var(--ac);   border-color: var(--ac); }
  .nav-gn   { background: var(--gn-bg);   color: var(--gn);   border-color: var(--gn); }
  .nav-enzo { background: var(--enzo-bg); color: var(--enzo); border-color: var(--enzo-bd); }
  .nav-rd   { background: var(--rd-bg);   color: var(--rd);   border-color: var(--rd); }
  .nav-yw   { background: var(--yw-bg);   color: var(--yw);   border-color: var(--yw); }
  .nav-pu   { background: var(--pu-bg);   color: var(--pu);   border-color: var(--pu); }
  .nav-mu   { background: var(--sf2);     color: var(--mu);   border-color: var(--bd2); }
  .nav-chip:hover { opacity: 0.8; }

  .help-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 18px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .no-results { padding: 16px 0; }

  .help-section { display: flex; flex-direction: column; gap: 10px; }

  .section-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--bd);
  }
  .clr-ac   { color: var(--ac);   border-color: var(--ac-bg); }
  .clr-gn   { color: var(--gn);   border-color: var(--gn-bg); }
  .clr-enzo { color: var(--enzo); border-color: var(--enzo-bd); }
  .clr-rd   { color: var(--rd);   border-color: var(--rd-bg); }
  .clr-yw   { color: var(--yw);   border-color: var(--yw-bg); }
  .clr-pu   { color: var(--pu);   border-color: var(--pu-bg); }
  .clr-mu   { color: var(--mu);   border-color: var(--bd); }

  /* ── Flow diagram ── */
  .flow-diagram {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    padding: 12px;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
  }

  .flow-chip, .flow-step {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    border: 1px solid;
    cursor: default;
    white-space: nowrap;
  }

  .step-ac   { background: var(--ac-bg);   color: var(--ac);   border-color: var(--ac); }
  .step-gn   { background: var(--gn-bg);   color: var(--gn);   border-color: var(--gn); }
  .step-enzo { background: var(--enzo-bg); color: var(--enzo); border-color: var(--enzo-bd); }
  .step-pu   { background: var(--pu-bg);   color: var(--pu);   border-color: var(--pu); }
  .step-yw   { background: var(--yw-bg);   color: var(--yw);   border-color: var(--yw); }

  .lf-arr {
    font-size: 0.75rem;
    color: var(--mu);
    flex-shrink: 0;
  }

  .flow-notes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }
  .flow-note { display: flex; align-items: center; gap: 8px; }
  .flow-note-chip {
    padding: 1px 8px;
    border-radius: 12px;
    font-size: 0.65rem;
    font-weight: 700;
    border: 1px solid;
    flex-shrink: 0;
    min-width: 80px;
    text-align: center;
  }
  .flow-note-desc { line-height: 1.4; }

  .step-flow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }

  /* ── QA accordion ── */
  .qa-list { display: flex; flex-direction: column; gap: 0; }

  .qa-item {
    border-bottom: 1px solid var(--bd);
  }
  .qa-item:last-child { border-bottom: none; }

  .qa-q {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--tx);
    padding: 9px 4px;
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
    transition: color var(--transition);
  }
  .qa-q::-webkit-details-marker { display: none; }
  .qa-q::before { content: '›'; color: var(--mu); font-size: 1rem; line-height: 1; transition: transform 0.15s; flex-shrink: 0; }
  details[open] > .qa-q::before { transform: rotate(90deg); }
  .qa-q:hover { color: var(--ac); }

  .qa-a {
    color: var(--tx2);
    line-height: 1.65;
    padding: 0 4px 10px 18px;
  }

  .help-footer { text-align: center; padding-top: 8px; }

  @media (max-width: 500px) {
    .help-dialog { max-height: calc(100vh - 20px); }
    .flow-diagram { padding: 8px; }
    .flow-chip { font-size: 0.68rem; padding: 3px 8px; }
  }
</style>
