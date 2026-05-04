<script lang="ts">
  let { onclose, onnavigate }: { onclose: () => void; onnavigate?: (section: string) => void } = $props();

  let activeTab = $state('overview');

  function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onclose(); }

  function go(section: string) {
    onnavigate?.(section);
    onclose();
  }

  const TABS = [
    { id: 'overview',  label: 'Overview',  color: 'ac' },
    { id: 'notes',     label: 'Notes',     color: 'ac' },
    { id: 'journal',   label: 'Journal',   color: 'enzo' },
    { id: 'tasks',     label: 'Tasks',     color: 'rd' },
    { id: 'calendar',  label: 'Calendar',  color: 'yw' },
    { id: 'enzo',      label: 'Enzo AI',   color: 'enzo' },
    { id: 'research',  label: 'Research',  color: 'pu' },
    { id: 'pipeline',  label: 'Pipeline',  color: 'gn' },
    { id: 'jobs',      label: 'Jobs',      color: 'ac' },
    { id: 'audio',     label: 'Audio',     color: 'pu' },
    { id: 'settings',  label: 'Settings',  color: 'mu' },
  ];
</script>

<svelte:window onkeydown={handleKey} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="guide-overlay" onclick={onclose}>
  <div class="guide-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <!-- ── Header ── -->
    <div class="guide-head">
      <span class="guide-title">Q·onco Guide</span>
      <button class="close-btn btn-icon" onclick={onclose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- ── Tab bar ── -->
    <div class="guide-tabs">
      {#each TABS as tab}
        <button
          class="guide-tab"
          class:active={activeTab === tab.id}
          class:tab-{tab.color}={activeTab === tab.id}
          onclick={() => activeTab = tab.id}
        >{tab.label}</button>
      {/each}
    </div>

    <!-- ── Content ── -->
    <div class="guide-body">

      {#if activeTab === 'overview'}
        <div class="section-hero">
          <p class="hero-desc">Q·onco is your encrypted research command centre — notes, analysis pipeline tracking, literature, Enzo AI, job search, and audio transcription, all committed to GitHub as AES-256-GCM ciphertext.</p>
        </div>
        <div class="how-flow">
          {#each [
            { label: 'GitHub PAT', desc: 'Your token = authentication + encryption key', cls: 'fc-ac' },
            { label: 'Login', desc: 'Token validated, user info loaded', cls: 'fc-gn' },
            { label: 'Decrypt', desc: '14 .enc files decrypted in parallel', cls: 'fc-enzo' },
            { label: 'Store', desc: 'All data in reactive Svelte state', cls: 'fc-pu' },
            { label: 'Edit', desc: 'Notes, journal, tasks, research…', cls: 'fc-gn' },
            { label: 'Auto-save', desc: 'Re-encrypted, committed to GitHub', cls: 'fc-ac' },
          ] as step}
            <div class="flow-item">
              <div class="flow-pill {step.cls}">{step.label}</div>
              <p class="flow-item-desc text-xs text-mu">{step.desc}</p>
            </div>
            <span class="flow-arr" aria-hidden="true">→</span>
          {/each}
        </div>
        <div class="section-grid">
          {#each [
            { id: 'notes',    label: 'Notes',     desc: 'Markdown editor with auto-save and task extraction', cls: 'sc-ac' },
            { id: 'journal',  label: 'Journal',   desc: 'Daily reflections with mood tags and calendar dots', cls: 'sc-enzo' },
            { id: 'tasks',    label: 'Tasks',     desc: 'Priority tasks with due dates linked to calendar', cls: 'sc-rd' },
            { id: 'calendar', label: 'Calendar',  desc: 'Everything on one view — click dots to navigate', cls: 'sc-yw' },
            { id: 'enzo',     label: 'Enzo AI',   desc: 'Oncology-expert AI trained on your exact domain', cls: 'sc-enzo' },
            { id: 'research', label: 'Research',  desc: 'PubMed, OpenAlex, bioRxiv — search and bookmark', cls: 'sc-pu' },
            { id: 'pipeline', label: 'Pipeline',  desc: 'Track scRNA-seq, spatial, WES runs step-by-step', cls: 'sc-gn' },
            { id: 'jobs',     label: 'Jobs',      desc: 'Live feed, tracker, CV builder, AI cover letters', cls: 'sc-ac' },
            { id: 'audio',    label: 'Audio',     desc: 'Live Whisper transcription of meetings and notes', cls: 'sc-pu' },
          ] as sec}
            <button class="section-card {sec.cls}" onclick={() => go(sec.id)}>
              <span class="sc-label">{sec.label}</span>
              <span class="sc-desc text-xs">{sec.desc}</span>
              <span class="sc-go">Open →</span>
            </button>
          {/each}
        </div>

      {:else if activeTab === 'notes'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Notes</h3>
            <p>Markdown-first note editor. Every save is a distinct encrypted GitHub commit. Inline task extraction connects notes to your task list automatically.</p>
            <button class="go-btn" onclick={() => go('notes')}>Open Notes →</button>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label">Markdown toolbar</span><span class="feat-desc">B / I / H1–H3 / UL / code / table — wraps selected text</span></div>
            <div class="feature-item"><span class="feat-label">Task extraction</span><span class="feat-desc">Write <code>- [ ] task</code> → appears instantly in Tasks list</span></div>
            <div class="feature-item"><span class="feat-label">Auto-save</span><span class="feat-desc">1.2 s debounce — timestamp in toolbar confirms last save</span></div>
            <div class="feature-item"><span class="feat-label">Pin / archive</span><span class="feat-desc">Pinned notes float to top; archived = hidden but not deleted</span></div>
            <div class="feature-item"><span class="feat-label">Export</span><span class="feat-desc">Download any note as .md, or export all as a bundle</span></div>
            <div class="feature-item"><span class="feat-label">Enzo context</span><span class="feat-desc">Open a note and Enzo reads it — blue bar confirms context</span></div>
          </div>
          <div class="example-block">
            <span class="example-label">Example note structure</span>
            <pre class="example-code"># HGSOC TME scRNA-seq — batch 3

## QC summary
- Total cells post-filter: 42,847
- Median genes/cell: 1,840
- MT% threshold: &lt;20%

## Action items
- [ ] Re-run DoubletFinder with pK=0.05
- [ ] Cross-reference CXCL12-high cluster with Hornburg signatures
- [x] Submit Cell Ranger output to long-term storage</pre>
          </div>
        </div>

      {:else if activeTab === 'journal'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Journal</h3>
            <p>Free-form daily reflections. Mood + context tags appear as coloured dots on the Calendar. Click any journal dot in Calendar to jump straight to that entry.</p>
            <button class="go-btn" onclick={() => go('journal')}>Open Journal →</button>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label">Mood chips</span><span class="feat-desc">Focused · Curious · Frustrated · Excited · Tired</span></div>
            <div class="feature-item"><span class="feat-label">Context tags</span><span class="feat-desc">Research · Writing · Experiment · Meeting · Admin</span></div>
            <div class="feature-item"><span class="feat-label">Calendar dots</span><span class="feat-desc">Amber dot per journal entry — click to open inline</span></div>
            <div class="feature-item"><span class="feat-label">Markdown toolbar</span><span class="feat-desc">Full formatting available in journal body</span></div>
            <div class="feature-item"><span class="feat-label">Search</span><span class="feat-desc">Full-text search across all journal entries by date or content</span></div>
          </div>
          <div class="example-block">
            <span class="example-label">Example entry</span>
            <div class="example-journal">
              <div class="ej-meta"><span class="ej-date">4 May 2026</span><span class="ej-mood mood-focused">Focused</span><span class="ej-ctx">Research</span></div>
              <p class="ej-body">Finally resolved the UMAP instability — bumping n_neighbors to 50 stabilised the CAF subclusters. The CXCL12-high population now separates cleanly. Will cross-reference with Hornburg et al. Nature Cancer signatures tomorrow. The Visium deconvolution is still converging slowly with n_cells=10.</p>
            </div>
          </div>
        </div>

      {:else if activeTab === 'tasks'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Tasks</h3>
            <p>Priority task list with due dates. Tasks extracted from notes via <code>- [ ]</code> syntax are automatically linked back to their source note. Due dates appear as red dots on the Calendar.</p>
            <button class="go-btn" onclick={() => go('tasks')}>Open Tasks →</button>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label">Priority</span><span class="feat-desc">High (red) · Medium (amber) · Low (muted)</span></div>
            <div class="feature-item"><span class="feat-label">Due dates</span><span class="feat-desc">Red dots on Calendar; overdue tasks highlighted</span></div>
            <div class="feature-item"><span class="feat-label">Note-linked</span><span class="feat-desc">"From note" chip — click to jump to source note</span></div>
            <div class="feature-item"><span class="feat-label">Add via note</span><span class="feat-desc"><code>- [ ] task text</code> in any note auto-creates a task</span></div>
          </div>
          <div class="example-block">
            <span class="example-label">Example task list</span>
            <div class="example-tasks">
              {#each [
                { text: 'Re-run DoubletFinder with pK=0.05', pri: 'high', done: false },
                { text: 'Validate FOLR1 by multiplex IF on FFPE slides', pri: 'high', done: false },
                { text: 'Submit Nature Cancer revisions', pri: 'high', done: true },
                { text: 'Update CellChat db to v2.1.2', pri: 'medium', done: false },
                { text: 'Book ESMO 2026 accommodation', pri: 'low', done: false },
              ] as task}
                <div class="ex-task" class:ex-done={task.done}>
                  <span class="ex-check">{task.done ? '✓' : '○'}</span>
                  <span class="ex-pri pri-{task.pri}"></span>
                  <span class="ex-text">{task.text}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>

      {:else if activeTab === 'calendar'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Calendar</h3>
            <p>Everything on one timeline. Click any dot to navigate directly to that note, journal entry, audio recording, or task — the calendar is fully click-through, not read-only.</p>
            <button class="go-btn" onclick={() => go('calendar')}>Open Calendar →</button>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label"><span class="dot dot-ac"></span> Notes</span><span class="feat-desc">Blue — click opens note editor</span></div>
            <div class="feature-item"><span class="feat-label"><span class="dot dot-yw"></span> Journal</span><span class="feat-desc">Amber — click opens that journal entry</span></div>
            <div class="feature-item"><span class="feat-label"><span class="dot dot-pu"></span> Audio</span><span class="feat-desc">Purple — click navigates to recording in Audio</span></div>
            <div class="feature-item"><span class="feat-label"><span class="dot dot-rd"></span> Tasks</span><span class="feat-desc">Red — due date; toggle done/undone in-place</span></div>
            <div class="feature-item"><span class="feat-label"><span class="dot dot-gn"></span> Events</span><span class="feat-desc">Green — calendar events from .ics import</span></div>
            <div class="feature-item"><span class="feat-label">.ics import</span><span class="feat-desc">File → Export from Apple Calendar, import here</span></div>
          </div>
        </div>

      {:else if activeTab === 'enzo'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Enzo AI</h3>
            <p>Your oncology research peer — expert in HGSOC, TME, scRNA-seq, spatial transcriptomics, PARP inhibitors, biomarker discovery. She does not over-explain your own field to you. Press <kbd>Ctrl+K</kbd> to open her from anywhere.</p>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label">Note context</span><span class="feat-desc">Open a note → Enzo reads it. Blue bar confirms which note.</span></div>
            <div class="feature-item"><span class="feat-label">Quick prompts</span><span class="feat-desc">Dashboard shortcuts pre-fill her input — click to fire</span></div>
            <div class="feature-item"><span class="feat-label">History</span><span class="feat-desc">History tab — all sessions searchable, stored encrypted</span></div>
            <div class="feature-item"><span class="feat-label">Stop stream</span><span class="feat-desc">Click Stop at any time — partial text discarded immediately</span></div>
            <div class="feature-item"><span class="feat-label">Research mode</span><span class="feat-desc">Research summaries use 120B model for higher quality</span></div>
            <div class="feature-item"><span class="feat-label">Cover letters</span><span class="feat-desc">120B model generates tailored academic cover letters from your CV</span></div>
          </div>
          <div class="example-block">
            <span class="example-label">Example questions Enzo handles well</span>
            <div class="example-prompts">
              {#each [
                'What CXCL12-high cell populations are known in HGSOC TME and how do they relate to immune exclusion?',
                'Compare olaparib vs niraparib PFS data in HRD-positive HGSOC from SOLO-2 and PRIMA trials.',
                'Suggest QC thresholds for 10x Chromium scRNA-seq from fresh HGSOC ascites.',
                'Write a methods section for CellChat v2 ligand-receptor analysis between macrophage clusters.',
              ] as p}
                <div class="ep-item text-xs">› {p}</div>
              {/each}
            </div>
          </div>
        </div>

      {:else if activeTab === 'research'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Research</h3>
            <p>Multi-source literature search across PubMed, OpenAlex, bioRxiv, medRxiv, Nature, and Cell. AI summaries, reading list, and bookmark export. Enable for the session first.</p>
            <button class="go-btn" onclick={() => go('research')}>Open Research →</button>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label">Sources</span><span class="feat-desc">PubMed · OpenAlex · bioRxiv · medRxiv · Nature · Cell — toggle chips</span></div>
            <div class="feature-item"><span class="feat-label">Quick topics</span><span class="feat-desc">Curated presets: TME, PARPi resistance, scRNA-seq, clinical trials</span></div>
            <div class="feature-item"><span class="feat-label">AI summary</span><span class="feat-desc">Click document icon → structured: hypothesis, methods, HGSOC relevance</span></div>
            <div class="feature-item"><span class="feat-label">Reading list</span><span class="feat-desc">Bookmark icon → saved to Reading List tab with priority tags</span></div>
            <div class="feature-item"><span class="feat-label">Export</span><span class="feat-desc">Export reading list as .md or .bib for citation managers</span></div>
          </div>
        </div>

      {:else if activeTab === 'pipeline'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Pipeline Tracker</h3>
            <p>Track analysis runs for scRNA-seq, spatial, bulk RNA-seq, WES. Pre-configured step templates. QC metrics with pass/warn/fail flags. Protocol library. Enable for the session first.</p>
            <button class="go-btn" onclick={() => go('pipeline')}>Open Pipeline →</button>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label">Run templates</span><span class="feat-desc">scRNA-seq · Spatial · Bulk RNA · WES · Custom — steps auto-created</span></div>
            <div class="feature-item"><span class="feat-label">Step status</span><span class="feat-desc">Click circle: pending → running → done → failed → skipped</span></div>
            <div class="feature-item"><span class="feat-label">QC metrics</span><span class="feat-desc">Key-value pairs: median_genes, mapping_rate — with pass/warn/fail</span></div>
            <div class="feature-item"><span class="feat-label">Protocols</span><span class="feat-desc">Reusable Markdown protocol bodies linked to runs</span></div>
          </div>
          <div class="example-block">
            <span class="example-label">scRNA-seq pipeline steps</span>
            <div class="example-steps">
              {#each [
                { name: 'Library prep', tool: '10x Chromium', status: 'done' },
                { name: 'Sequencing', tool: 'Illumina NovaSeq', status: 'done' },
                { name: 'Cell Ranger alignment', tool: 'CellRanger 7.1', status: 'done' },
                { name: 'QC filtering', tool: 'Seurat / Scanpy', status: 'running' },
                { name: 'Doublet detection', tool: 'DoubletFinder', status: 'pending' },
                { name: 'Clustering + annotation', tool: 'Leiden + SingleR', status: 'pending' },
              ] as step}
                <div class="ex-step">
                  <span class="step-dot st-{step.status}"></span>
                  <span class="ex-step-name text-xs">{step.name}</span>
                  <span class="ex-step-tool text-xs text-mu">{step.tool}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>

      {:else if activeTab === 'jobs'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Jobs Portal</h3>
            <p>Curated job feed (EU pharma, India biotech, startups), Kanban tracker, CV builder, AI-powered cover letters using 120B model, salary benchmarks, and network contacts. Enable for the session first.</p>
            <button class="go-btn" onclick={() => go('jobs')}>Open Jobs →</button>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label">Feed</span><span class="feat-desc">Nature Careers, EMBL, EurAxess, Indeed — filter by region and type</span></div>
            <div class="feature-item"><span class="feat-label">Tracker</span><span class="feat-desc">Kanban pipeline: Radar → Queued → Applied → Screening → Offer</span></div>
            <div class="feature-item"><span class="feat-label">Companies</span><span class="feat-desc">Curated EU pharma/biotech + India pharma with careers page links</span></div>
            <div class="feature-item"><span class="feat-label">CV Builder</span><span class="feat-desc">8 sections: personal, experience, education, publications, skills, conferences, awards, preview. Export .md</span></div>
            <div class="feature-item"><span class="feat-label">Cover letters</span><span class="feat-desc">120B AI — tailored from your CV + job description in seconds</span></div>
            <div class="feature-item"><span class="feat-label">Salary</span><span class="feat-desc">Log offer data and benchmarks by region and role type</span></div>
          </div>
        </div>

      {:else if activeTab === 'audio'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Audio & Transcription</h3>
            <p>Record lab meetings, spoken observations, and ideas. Transcribed in 15-second chunks via Groq Whisper large-v3 in real time. Transcripts link to notes and appear on your Calendar. Enable for the session first.</p>
            <button class="go-btn" onclick={() => go('audio')}>Open Audio →</button>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label">Live transcription</span><span class="feat-desc">15-second chunk streaming via Whisper large-v3</span></div>
            <div class="feature-item"><span class="feat-label">Edit transcript</span><span class="feat-desc">Review and edit before saving — correct proper nouns</span></div>
            <div class="feature-item"><span class="feat-label">Link to note</span><span class="feat-desc">Attach a recording to a specific note for context</span></div>
            <div class="feature-item"><span class="feat-label">Daily quota</span><span class="feat-desc">2 hours/day per device — resets at midnight, bar shows remaining</span></div>
            <div class="feature-item"><span class="feat-label">Calendar dot</span><span class="feat-desc">Purple dot per recording — click to navigate to Audio section</span></div>
          </div>
          <div class="example-block">
            <span class="example-label">Example transcript excerpt</span>
            <p class="ex-transcript text-xs">Lab meeting — 4 May 2026 · 5m 12s<br><br>"…the doublet rate in samples OV-23-14A and OV-23-17B is higher than expected. We're switching to cold active protease dissociation for the next cohort. The CXCL12-high cluster needs cross-referencing with the Hornburg Nature Cancer paper signatures before we can call it CAF-like…"</p>
          </div>
        </div>

      {:else if activeTab === 'settings'}
        <div class="tab-content">
          <div class="tab-hero">
            <h3>Settings</h3>
            <p>Profile, appearance, AI worker config, and data export. Changes sync to GitHub on save.</p>
            <button class="go-btn" onclick={() => go('settings')}>Open Settings →</button>
          </div>
          <div class="feature-grid">
            <div class="feature-item"><span class="feat-label">Worker URL</span><span class="feat-desc">Cloudflare Worker for Groq / Whisper / PubMed. Use Test button to verify.</span></div>
            <div class="feature-item"><span class="feat-label">Researcher profile</span><span class="feat-desc">Specializations, target roles, target locations — used by Enzo for matching</span></div>
            <div class="feature-item"><span class="feat-label">Accent colour</span><span class="feat-desc">Blue · Green · Purple · Teal · Rose — applied on next save+reload</span></div>
            <div class="feature-item"><span class="feat-label">Theme</span><span class="feat-desc">Auto (time-based) · Light · Dark</span></div>
            <div class="feature-item"><span class="feat-label">Export</span><span class="feat-desc">Full JSON export — all notes, journal, tasks, jobs, audio records</span></div>
            <div class="feature-item"><span class="feat-label">Danger zone</span><span class="feat-desc">Log out clears session only — data stays encrypted in GitHub</span></div>
          </div>
          <div class="example-block">
            <span class="example-label">Keyboard shortcuts</span>
            <div class="shortcuts-grid">
              {#each [['?','Open this guide'],['Ctrl+K','Focus Enzo input'],['Ctrl+N','New note'],['Ctrl+J','New journal entry'],['Ctrl+T','New task'],['Esc','Close panels'],['←/→','Calendar month navigation'],['T','Jump calendar to today']] as [k, d]}
                <div class="sc-row"><kbd class="sc-kbd">{k}</kbd><span class="text-xs text-mu">{d}</span></div>
              {/each}
            </div>
          </div>
        </div>
      {/if}

    </div><!-- .guide-body -->
  </div><!-- .guide-card -->
</div><!-- .guide-overlay -->

<style>
  .guide-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 1200;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 20px;
    overflow: hidden;
    backdrop-filter: blur(3px);
  }

  .guide-card {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: 100%;
    max-width: 860px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0,0,0,0.28);
    animation: card-in 0.18s ease;
  }
  @keyframes card-in {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .guide-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }
  .guide-title { font-size: 0.88rem; font-weight: 800; letter-spacing: 0.02em; color: var(--tx); }
  .close-btn { color: var(--mu); }
  .close-btn:hover { color: var(--tx); background: var(--sf2); }

  .guide-tabs {
    display: flex;
    gap: 3px;
    padding: 10px 16px 8px;
    border-bottom: 1px solid var(--bd);
    flex-wrap: wrap;
    flex-shrink: 0;
    background: var(--sf2);
  }
  .guide-tab {
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
    color: var(--mu);
    background: none;
    transition: 0.15s;
    white-space: nowrap;
  }
  .guide-tab:hover:not(.active) { background: var(--sf3, var(--sf)); color: var(--tx); }
  .guide-tab.active { color: #fff; }
  .guide-tab.active.tab-ac   { background: var(--ac);   border-color: var(--ac); }
  .guide-tab.active.tab-gn   { background: var(--gn);   border-color: var(--gn); }
  .guide-tab.active.tab-pu   { background: var(--pu);   border-color: var(--pu); }
  .guide-tab.active.tab-yw   { background: var(--yw);   border-color: var(--yw); color: #333; }
  .guide-tab.active.tab-rd   { background: var(--rd);   border-color: var(--rd); }
  .guide-tab.active.tab-enzo { background: var(--enzo); border-color: var(--enzo); }
  .guide-tab.active.tab-mu   { background: var(--mu);   border-color: var(--mu); }

  .guide-body {
    overflow-y: auto;
    flex: 1;
    padding: 22px 26px 28px;
  }

  /* ── Overview ── */
  .section-hero { margin-bottom: 16px; }
  .hero-desc { font-size: 0.88rem; color: var(--tx2); line-height: 1.7; }

  .how-flow {
    display: flex;
    align-items: flex-start;
    gap: 0;
    flex-wrap: wrap;
    margin-bottom: 20px;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .flow-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .flow-arr { color: var(--mu); font-size: 0.8rem; padding: 0 4px; line-height: 32px; }
  .flow-pill {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 700;
    border: 1px solid;
    white-space: nowrap;
  }
  .flow-item-desc { text-align: center; max-width: 90px; line-height: 1.3; }
  .fc-ac   { background: var(--ac-bg);   color: var(--ac);   border-color: var(--ac); }
  .fc-gn   { background: var(--gn-bg);   color: var(--gn);   border-color: var(--gn); }
  .fc-enzo { background: var(--enzo-bg); color: var(--enzo); border-color: var(--enzo-bd, var(--enzo)); }
  .fc-pu   { background: var(--pu-bg);   color: var(--pu);   border-color: var(--pu); }

  .section-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .section-card {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid var(--bd);
    background: var(--sf2);
    text-align: left;
    cursor: pointer;
    transition: 0.15s;
  }
  .section-card:hover { border-color: var(--ac); background: var(--ac-bg); }
  .sc-label { font-size: 0.82rem; font-weight: 700; color: var(--tx); }
  .sc-desc  { color: var(--tx2); line-height: 1.4; }
  .sc-go    { font-size: 0.7rem; color: var(--ac); margin-top: 4px; font-weight: 600; }
  .sc-ac:hover   { border-color: var(--ac); }
  .sc-gn:hover   { border-color: var(--gn); }
  .sc-pu:hover   { border-color: var(--pu); }
  .sc-enzo:hover { border-color: var(--enzo); }
  .sc-rd:hover   { border-color: var(--rd); }
  .sc-yw:hover   { border-color: var(--yw); }

  /* ── Section tabs ── */
  .tab-content { display: flex; flex-direction: column; gap: 18px; }

  .tab-hero { display: flex; flex-direction: column; gap: 8px; }
  .tab-hero h3 { font-size: 1.05rem; font-weight: 700; margin: 0; }
  .tab-hero p  { font-size: 0.875rem; color: var(--tx2); line-height: 1.7; margin: 0; }

  .go-btn {
    align-self: flex-start;
    padding: 7px 16px;
    background: var(--ac);
    color: #fff;
    border: none;
    border-radius: 7px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: 0.15s;
  }
  .go-btn:hover { opacity: 0.88; }

  .feature-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .feature-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 8px;
  }
  .feat-label { font-size: 0.8rem; font-weight: 700; color: var(--tx); }
  .feat-desc  { font-size: 0.75rem; color: var(--tx2); line-height: 1.45; }
  .feat-desc code { font-size: 0.72rem; background: var(--sf3, var(--bd)); padding: 1px 4px; border-radius: 3px; }

  /* ── Example blocks ── */
  .example-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .example-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mu);
  }
  .example-code {
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 0.75rem;
    line-height: 1.6;
    color: var(--tx);
    overflow-x: auto;
    white-space: pre-wrap;
    font-family: 'JetBrains Mono', 'Fira Mono', ui-monospace, monospace;
  }

  /* journal example */
  .example-journal {
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ej-meta { display: flex; align-items: center; gap: 6px; }
  .ej-date { font-size: 0.75rem; font-weight: 700; color: var(--tx2); }
  .ej-mood { padding: 2px 8px; border-radius: 20px; font-size: 0.68rem; font-weight: 700; }
  .mood-focused { background: var(--ac-bg); color: var(--ac); border: 1px solid var(--ac); }
  .ej-ctx { font-size: 0.68rem; color: var(--mu); background: var(--sf3, var(--bd)); padding: 2px 6px; border-radius: 4px; }
  .ej-body { font-size: 0.78rem; color: var(--tx2); line-height: 1.65; margin: 0; }

  /* task example */
  .example-tasks { display: flex; flex-direction: column; gap: 4px; background: var(--sf2); border: 1px solid var(--bd); border-radius: 8px; padding: 12px 14px; }
  .ex-task { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
  .ex-done { opacity: 0.45; }
  .ex-check { font-size: 0.75rem; color: var(--mu); width: 12px; }
  .ex-done .ex-check { color: var(--gn); }
  .ex-pri { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .pri-high   { background: var(--rd); }
  .pri-medium { background: var(--yw); }
  .pri-low    { background: var(--mu); }
  .ex-text { font-size: 0.78rem; color: var(--tx); }
  .ex-done .ex-text { text-decoration: line-through; }

  /* calendar dots */
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 2px; vertical-align: middle; }
  .dot-ac { background: var(--ac); }
  .dot-yw { background: var(--yw); }
  .dot-pu { background: var(--pu); }
  .dot-rd { background: var(--rd); }
  .dot-gn { background: var(--gn); }

  /* pipeline steps */
  .example-steps { display: flex; flex-direction: column; gap: 5px; background: var(--sf2); border: 1px solid var(--bd); border-radius: 8px; padding: 12px 14px; }
  .ex-step { display: flex; align-items: center; gap: 8px; }
  .step-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; border: 2px solid; }
  .st-done    { background: var(--gn);  border-color: var(--gn); }
  .st-running { background: var(--ac);  border-color: var(--ac); animation: pulse 1.5s infinite; }
  .st-pending { background: transparent; border-color: var(--bd2, var(--bd)); }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .ex-step-name { flex: 1; font-size: 0.78rem; color: var(--tx); }
  .ex-step-tool { font-size: 0.72rem; }

  /* prompts */
  .example-prompts { display: flex; flex-direction: column; gap: 6px; background: var(--sf2); border: 1px solid var(--bd); border-radius: 8px; padding: 12px 14px; }
  .ep-item { color: var(--tx2); line-height: 1.5; }

  /* transcript */
  .ex-transcript { background: var(--sf2); border: 1px solid var(--bd); border-radius: 8px; padding: 12px 14px; color: var(--tx2); line-height: 1.65; }

  /* shortcuts */
  .shortcuts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .sc-row { display: flex; align-items: center; gap: 8px; }
  .sc-kbd {
    display: inline-block;
    padding: 2px 7px;
    background: var(--sf2);
    border: 1px solid var(--bd2, var(--bd));
    border-bottom-width: 2px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-family: ui-monospace, monospace;
    color: var(--tx);
    white-space: nowrap;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .guide-overlay { padding: 12px; }
    .guide-body { padding: 16px; }
    .section-grid { grid-template-columns: 1fr 1fr; }
    .feature-grid { grid-template-columns: 1fr; }
    .shortcuts-grid { grid-template-columns: 1fr; }
    .how-flow { gap: 2px; }
  }
</style>
