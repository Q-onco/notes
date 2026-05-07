<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { MODELS, DAILY_TOKEN_REF, getAllTokenUsage, type ModelKey, WORKER_URL } from '../lib/groq';
  import { nanoid } from 'nanoid';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  type Tab = 'identity' | 'appearance' | 'ai' | 'notifications' | 'data';
  let activeTab = $state<Tab>('identity');

  let saving       = $state(false);
  let importing    = $state(false);
  let exporting    = $state(false);
  let testSending  = $state(false);
  let workerTesting = $state(false);
  let workerStatus  = $state<'idle' | 'ok' | 'error'>('idle');
  let workerMsg     = $state('');
  let tokenUsage    = $state(getAllTokenUsage());

  let specInput       = $state(store.profile.specializations.join(', '));
  let targetRolesInput = $state(store.profile.targetRoles.join(', '));
  let targetLocInput  = $state(store.profile.targetLocations.join(', '));

  // Refresh token counts every 3s while open
  $effect(() => {
    tokenUsage = getAllTokenUsage();
    const t = setInterval(() => { tokenUsage = getAllTokenUsage(); }, 3000);
    return () => clearInterval(t);
  });

  // Apply font size whenever it changes
  $effect(() => { store.applyFontSize(); });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'identity',      label: 'Identity' },
    { id: 'appearance',    label: 'Appearance' },
    { id: 'ai',            label: 'AI' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'data',          label: 'Data' },
  ];

  const MODEL_ROWS: { key: ModelKey; label: string; note: string }[] = [
    { key: 'enzo',     label: 'Enzo chat',            note: '70B · always' },
    { key: 'research', label: 'Research & summaries',  note: '120B · on click' },
    { key: 'quick',    label: 'Light tasks',           note: '8B · on click' },
    { key: 'whisper',  label: 'Transcription',         note: 'audio · see Audio tab' },
  ];

  const AI_TOGGLES: { key: keyof typeof store.aiSettings; label: string; desc: string }[] = [
    { key: 'coverLetter',    label: 'Cover letter generator',   desc: 'WRITER — job-application cover letters. Enable during job-search sessions.' },
    { key: 'writerBullets',  label: 'WRITER bullet improver',   desc: 'CAR-format CV bullet rewrites. Enable during CV editing.' },
    { key: 'weeklyDigest',   label: 'Weekly digest',            desc: 'Enzo compiles a research week summary. Enable on Mondays.' },
    { key: 'deepRead',       label: 'Deep Read (Socratic)',      desc: '5 critical questions per paper. Enable during focused reading.' },
    { key: 'readingNote',    label: 'AI reading note',          desc: 'Structured note (Claims · Methods · Limits · Relevance) from abstract.' },
    { key: 'critique',       label: 'Paper critique',           desc: 'Enzo critiques methodology and assumptions. Enable during literature review.' },
    { key: 'devilsAdvocate', label: "Devil's advocate",         desc: 'Challenges hypotheses with counter-evidence. Enable during hypothesis work.' },
    { key: 'interviewPrep',  label: 'Interview prep',           desc: 'Generates interview questions from job description + your CV.' },
    { key: 'manuscriptEnzo', label: 'Manuscript Enzo assist',   desc: 'Enzo drafts and improves manuscript sections. Enable during writing.' },
  ];

  const SHORTCUTS = [
    { keys: ['?'],         desc: 'Open help' },
    { keys: ['Ctrl', 'K'], desc: 'Global search' },
    { keys: ['Ctrl', 'E'], desc: 'Toggle Enzo panel' },
    { keys: ['Ctrl', 'B'], desc: 'Toggle sidebar' },
    { keys: ['Ctrl', '/'], desc: 'Quick capture' },
    { keys: ['Esc'],       desc: 'Close overlay / deselect' },
  ];

  function fmtTokens(n: number) {
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n/1_000).toFixed(1)}k`;
    return String(n);
  }

  function tokenPct(key: ModelKey) {
    const ref = DAILY_TOKEN_REF[key];
    if (!ref) return 0;
    return Math.min(100, Math.round((tokenUsage[key] / ref) * 100));
  }

  async function save() {
    saving = true;
    try {
      store.profile.specializations  = specInput.split(',').map(s => s.trim()).filter(Boolean);
      store.profile.targetRoles      = targetRolesInput.split(',').map(s => s.trim()).filter(Boolean);
      store.profile.targetLocations  = targetLocInput.split(',').map(s => s.trim()).filter(Boolean);
      await Promise.all([store.saveSettings(), store.saveProfile()]);
      store.applyFontSize();
      showToast('Settings saved');
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { saving = false; }
  }

  async function testWorker() {
    const url = store.settings.workerUrl || WORKER_URL;
    workerTesting = true; workerStatus = 'idle'; workerMsg = '';
    try {
      const res = await fetch(`${url}/ping`, { signal: AbortSignal.timeout(8000) });
      workerStatus = res.ok ? 'ok' : 'error';
      workerMsg = res.ok ? `Online — ${url}` : `HTTP ${res.status}`;
    } catch (e) { workerStatus = 'error'; workerMsg = (e as Error).message; }
    finally { workerTesting = false; }
  }

  async function sendTestEmail() {
    if (!store.settings.supervisorEmail) { showToast('Enter supervisor email first', 'error'); return; }
    testSending = true;
    try {
      await store.sendMail(store.settings.supervisorEmail, 'Supervisor', 'Q·onco test email', 'This is a test email from Q·onco. Your email integration is working correctly.');
      showToast('Test email sent!');
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { testSending = false; }
  }

  async function exportData() {
    exporting = true;
    try {
      const data = {
        notes: store.notes, journal: store.journal, tasks: store.tasks,
        audioRecords: store.audioRecords, savedJobs: store.savedJobs,
        settings: store.settings, grants: store.grants,
        manuscripts: store.manuscripts, hypotheses: store.hypotheses,
        pipelineRuns: store.pipelineRuns, readingList: store.readingList,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: `qonco-export-${new Date().toISOString().slice(0,10)}.json` }).click();
      URL.revokeObjectURL(url);
      showToast('Data exported');
    } finally { exporting = false; }
  }

  let importInput = $state<HTMLInputElement | undefined>(undefined);

  async function importData(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    importing = true;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.notes)        { store.notes        = data.notes;        await store.saveNotes(); }
      if (data.journal)      { store.journal      = data.journal;      await store.saveJournal(); }
      if (data.tasks)        { store.tasks        = data.tasks;        await store.saveTasks(); }
      if (data.grants)       { store.grants       = data.grants;       await store.saveGrants(); }
      if (data.manuscripts)  { store.manuscripts  = data.manuscripts;  await store.saveManuscripts(); }
      if (data.hypotheses)   { store.hypotheses   = data.hypotheses;   }
      if (data.pipelineRuns) { store.pipelineRuns = data.pipelineRuns; await store.savePipelines(); }
      if (data.readingList)  { store.readingList  = data.readingList;  await store.saveResearch(); }
      showToast('Data imported successfully');
    } catch (err) { showToast('Import failed: invalid file', 'error'); }
    finally { importing = false; if (importInput) importInput.value = ''; }
  }

  function clearSessionToggles() {
    ['qonco_jobs_on','qonco_pipeline_on','qonco_research_on','qonco_audio_on'].forEach(k => sessionStorage.removeItem(k));
    showToast('Section toggles reset — refresh to apply');
  }

  function logout() {
    if (!confirm('Log out? Your data stays encrypted in GitHub.')) return;
    store.logout();
  }

  function toggleAi(key: keyof typeof store.aiSettings) {
    store.settings.ai = { ...store.aiSettings, [key]: !store.aiSettings[key] };
  }

  // ── Storage stats ─────────────────────────────────────────────────────────
  type R2TypeStats = { count: number; bytes: number };
  type StorageStats = { totalCount: number; totalBytes: number; byType: Record<string, R2TypeStats>; fetchedAt: number } | null;

  let storageStats    = $state<StorageStats>(null);
  let storageFetching = $state(false);
  let storageError    = $state('');

  async function fetchStorageStats() {
    storageFetching = true; storageError = '';
    try {
      const base = store.workerBase;
      const res = await fetch(`${base}/storage/stats`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`Worker returned ${res.status}`);
      storageStats = await res.json() as StorageStats;
    } catch (e) { storageError = (e as Error).message; }
    finally { storageFetching = false; }
  }

  function fmtBytes(b: number): string {
    if (b >= 1073741824) return `${(b / 1073741824).toFixed(2)} GB`;
    if (b >= 1048576)    return `${(b / 1048576).toFixed(1)} MB`;
    if (b >= 1024)       return `${(b / 1024).toFixed(0)} KB`;
    return `${b} B`;
  }

  const TYPE_META: Record<string, { label: string; color: string }> = {
    pdf:   { label: 'PDF',   color: 'var(--rd)' },
    image: { label: 'Image', color: 'var(--gn)' },
    audio: { label: 'Audio', color: 'var(--pu)' },
    data:  { label: 'Data',  color: 'var(--yw)' },
    code:  { label: 'Code',  color: 'var(--ac)' },
    other: { label: 'Other', color: 'var(--mu)' },
  };

  const SYNC_STATS: { label: string; val: () => number }[] = [
    { label: 'Notes',        val: () => store.notes.length },
    { label: 'Journal',      val: () => store.journal.length },
    { label: 'Tasks',        val: () => store.tasks.length },
    { label: 'Audio',        val: () => store.audioRecords.length },
    { label: 'Files',        val: () => store.files.length },
    { label: 'Reading list', val: () => store.readingList.length },
    { label: 'Hypotheses',   val: () => store.hypotheses.length },
    { label: 'Pipeline runs',val: () => store.pipelineRuns.length },
    { label: 'Protocols',    val: () => store.protocols.length },
    { label: 'Grants',       val: () => store.grants.length },
    { label: 'Conferences',  val: () => store.conferences.length },
    { label: 'Peer reviews', val: () => store.peerReviews.length },
    { label: 'Manuscripts',  val: () => store.manuscripts.length },
    { label: 'Jobs tracked', val: () => store.savedJobs.length },
    { label: 'Cover letters',val: () => store.coverLetters.length },
    { label: 'Chat sessions',val: () => store.chatSessions.length },
    { label: 'Pinned papers',val: () => store.pinnedPapers.length },
    { label: 'Mail contacts',val: () => store.mailContacts.length },
  ];
</script>

<input type="file" accept=".json" bind:this={importInput} onchange={importData} style="display:none" />

<div class="settings-view">
  <div class="settings-header">
    <h2>Settings</h2>
    <p class="text-sm text-mu">Profile · Appearance · AI · Notifications · Data</p>
  </div>

  <!-- Tab bar -->
  <div class="tab-bar">
    {#each TABS as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        onclick={() => activeTab = tab.id}
      >{tab.label}</button>
    {/each}
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       IDENTITY
  ══════════════════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'identity'}
    <div class="tab-content">
      <div class="card settings-card">
        <span class="section-title">Profile</span>
        <div class="field-grid">
          <div class="field">
            <label for="s-name">Display name</label>
            <input id="s-name" type="text" bind:value={store.settings.userName} placeholder="Your name" />
          </div>
          <div class="field">
            <label for="s-orcid">
              ORCID
              {#if store.settings.orcid}
                <a class="orcid-link" href="https://orcid.org/{store.settings.orcid}" target="_blank" rel="noreferrer">↗ view</a>
              {/if}
            </label>
            <input id="s-orcid" type="text" bind:value={store.settings.orcid} placeholder="0000-0000-0000-0000" />
          </div>
          <div class="field form-full">
            <label for="s-inst">Institution</label>
            <input id="s-inst" type="text" bind:value={store.settings.institution} placeholder="Heidelberg University" />
          </div>
          <div class="field form-full">
            <label for="s-dept">Department</label>
            <input id="s-dept" type="text" bind:value={store.settings.department} placeholder="Department name" />
          </div>
        </div>
      </div>

      <div class="card settings-card">
        <span class="section-title">Researcher profile</span>
        <p class="section-hint text-xs text-mu">Used by Enzo for job matching, interview prep, and cover letter generation.</p>
        <div class="field">
          <label for="s-spec">Specializations <span class="hint-label">(comma-separated)</span></label>
          <input id="s-spec" type="text" bind:value={specInput} placeholder="ovarian cancer, scRNA-seq, PARP inhibitors…" />
        </div>
        <div class="field">
          <label for="s-roles">Target roles <span class="hint-label">(comma-separated)</span></label>
          <input id="s-roles" type="text" bind:value={targetRolesInput} placeholder="Senior Scientist, Translational Scientist…" />
        </div>
        <div class="field">
          <label for="s-locs">Target locations <span class="hint-label">(comma-separated)</span></label>
          <input id="s-locs" type="text" bind:value={targetLocInput} placeholder="Germany, UK, Switzerland…" />
        </div>
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       APPEARANCE
  ══════════════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'appearance'}
    <div class="tab-content">
      <div class="card settings-card">
        <span class="section-title">Theme</span>
        <div class="choice-row">
          {#each [['auto','◐ Auto'],['light','☀ Light'],['dark','☾ Dark']] as [val, label]}
            <button
              class="choice-btn"
              class:sel={store.settings.themeOverride === val}
              onclick={() => { store.settings.themeOverride = val as 'auto'|'light'|'dark'; }}
            >{label}</button>
          {/each}
        </div>
      </div>

      <div class="card settings-card">
        <span class="section-title">Accent colour</span>
        <div class="accent-row">
          {#each [['blue','#5b8fd4'],['green','#4caf7d'],['purple','#9b7fe8'],['teal','#38a89d'],['rose','#d45b87']] as [val, hex]}
            <button
              class="accent-btn"
              class:sel={store.settings.accentColor === val || (!store.settings.accentColor && val === 'blue')}
              onclick={() => { store.settings.accentColor = val as 'blue'|'green'|'purple'|'teal'|'rose'; }}
              title={val}
              style="background:{hex}"
            ></button>
          {/each}
          <span class="text-xs text-mu" style="margin-left:4px">Takes effect after saving</span>
        </div>
      </div>

      <div class="card settings-card">
        <span class="section-title">Font size</span>
        <p class="section-hint text-xs text-mu">Useful when switching between your laptop and a lab monitor.</p>
        <div class="choice-row">
          {#each [['compact','Compact'],['normal','Normal'],['large','Large']] as [val, label]}
            <button
              class="choice-btn"
              class:sel={(store.settings.fontSize ?? 'normal') === val}
              onclick={() => { store.settings.fontSize = val as 'compact'|'normal'|'large'; store.applyFontSize(); }}
            >{label}</button>
          {/each}
        </div>
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       AI
  ══════════════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'ai'}
    <div class="tab-content">
      <div class="card settings-card">
        <span class="section-title">Worker</span>
        <div class="field">
          <label for="s-worker">Worker URL</label>
          <div class="worker-row">
            <input id="s-worker" type="url" bind:value={store.settings.workerUrl} placeholder="https://enzo.quant-onco.workers.dev" class="worker-input" />
            <button class="btn btn-ghost btn-sm" onclick={testWorker} disabled={workerTesting}>
              {workerTesting ? 'Testing…' : 'Test'}
            </button>
          </div>
          {#if workerStatus === 'ok'}
            <p class="status-ok text-xs">✓ {workerMsg}</p>
          {:else if workerStatus === 'error'}
            <p class="status-err text-xs">✗ {workerMsg}</p>
          {:else}
            <p class="field-hint">Cloudflare Worker — proxies Groq, Whisper, PubMed, bioRxiv, R2, mail.</p>
          {/if}
        </div>
      </div>

      <div class="card settings-card">
        <div class="model-header">
          <span class="section-title">Models &amp; today's usage</span>
          {#if store.aiPending > 0}
            <span class="pending-badge">
              <span class="pending-dot"></span>
              {store.aiPending} in flight
            </span>
          {/if}
        </div>
        <div class="model-table">
          {#each MODEL_ROWS as row}
            {@const pct  = tokenPct(row.key)}
            {@const used = tokenUsage[row.key]}
            {@const ref  = DAILY_TOKEN_REF[row.key]}
            <div class="model-row">
              <div class="model-left">
                <span class="model-fn">{row.label}</span>
                <code class="model-id">{MODELS[row.key]}</code>
              </div>
              <div class="model-right">
                <div class="model-stats">
                  <span class="model-note">{row.note}</span>
                  {#if ref > 0}<span class="tok-count" class:tok-warn={pct > 75}>{fmtTokens(used)} / {fmtTokens(ref)} tok</span>{/if}
                </div>
                {#if ref > 0}
                  <div class="tok-track">
                    <div class="tok-fill" class:tok-fill-warn={pct > 75} style="width:{pct}%"></div>
                    {#if store.aiPending > 0 && used > 0}<div class="tok-pending-pulse"></div>{/if}
                  </div>
                {:else if row.key === 'whisper'}
                  <p class="text-xs text-mu">Quota tracked in Audio section</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        <p class="field-hint">Daily counts reset at midnight. Reference limits are indicative.</p>
      </div>

      <div class="card settings-card">
        <span class="section-title">AI features</span>
        <p class="section-hint text-xs text-mu">Features not used daily default to <strong>off</strong>. Toggle on before a session, off after.</p>
        {#each AI_TOGGLES as t}
          <div class="ai-feature-row">
            <div class="ai-feature-info">
              <span class="ai-feature-label">{t.label}</span>
              <span class="ai-feature-desc text-xs text-mu">{t.desc}</span>
            </div>
            <button
              class="toggle-btn"
              class:toggle-on={!!(store.aiSettings as unknown as Record<string, boolean>)[t.key]}
              onclick={() => toggleAi(t.key)}
            ><span class="toggle-knob"></span></button>
          </div>
        {/each}

        <div class="field" style="margin-top:8px; padding-top:8px; border-top:1px solid var(--bd)">
          <label for="s-goal">Weekly reading goal <span class="hint-label">(papers)</span></label>
          <input id="s-goal" type="number" min="1" max="20" style="width:80px"
            value={store.settings.weeklyReadingGoal ?? 3}
            oninput={(e) => { store.settings.weeklyReadingGoal = parseInt((e.target as HTMLInputElement).value) || 3; }} />
        </div>
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       NOTIFICATIONS
  ══════════════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'notifications'}
    <div class="tab-content">
      <div class="card settings-card">
        <span class="section-title">Email — outbox</span>
        <p class="section-hint text-xs text-mu">Sends via Brevo from <strong>quant.onco@gmail.com</strong>. Replies arrive in your normal Gmail.</p>

        <div class="field">
          <label for="s-sup-email">Supervisor / PI email</label>
          <input id="s-sup-email" type="email" bind:value={store.settings.supervisorEmail} placeholder="supervisor@hospital.org" />
          <p class="field-hint">Pre-filled in compose when sending progress reports, note shares, and summaries.</p>
        </div>

        <div class="field">
          <label for="s-prefix">Subject prefix <span class="hint-label">(optional)</span></label>
          <input id="s-prefix" type="text" bind:value={store.settings.emailSubjectPrefix} placeholder="[Q-onco]" style="max-width:180px" />
          <p class="field-hint">Prepended to every email subject, e.g. <em>[Q-onco] Weekly Progress Report</em>.</p>
        </div>

        <div class="notif-test-row">
          <button class="btn btn-ghost btn-sm" onclick={sendTestEmail} disabled={testSending || !store.settings.supervisorEmail}>
            {testSending ? 'Sending…' : 'Send test email'}
          </button>
          {#if !store.settings.supervisorEmail}
            <span class="text-xs text-mu">Enter supervisor email above first</span>
          {/if}
        </div>
      </div>

      <div class="card settings-card">
        <span class="section-title">Browser notifications</span>
        <p class="section-hint text-xs text-mu">Fires on app open (once per day): overdue tasks, tasks due today/tomorrow, grant deadlines within 7 days, peer review due dates, job follow-ups. Alarms fire at the exact minute you set them.</p>
        {#if typeof Notification !== 'undefined'}
          {#if Notification.permission === 'granted'}
            <div class="notif-status notif-ok">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Notifications enabled
            </div>
          {:else if Notification.permission === 'denied'}
            <div class="notif-status notif-denied">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Blocked — allow in browser site settings
            </div>
          {:else}
            <button class="btn btn-ghost btn-sm" onclick={() => Notification.requestPermission()}>
              Enable notifications
            </button>
          {/if}
        {:else}
          <p class="text-xs text-mu">Not supported in this browser.</p>
        {/if}
      </div>

      <div class="card settings-card">
        <span class="section-title">Send as email — available in</span>
        <div class="send-locations">
          {#each ['Dashboard (progress report)', 'Journal entries', 'Notes', 'Task plans', 'Research (reading list)', 'Manuscripts (section drafts)', 'Grants summaries', 'Pipeline hypotheses', 'Audio transcripts'] as loc}
            <div class="send-loc-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--gn);flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
              <span class="text-xs">{loc}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       DATA
  ══════════════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'data'}
    <div class="tab-content">

      <!-- ── R2 Storage progress ── -->
      <div class="card settings-card">
        <div class="storage-head">
          <span class="section-title">Cloud storage (R2)</span>
          <button class="btn btn-ghost btn-sm" onclick={fetchStorageStats} disabled={storageFetching}>
            {#if storageFetching}
              <span class="storage-spin"></span> Checking…
            {:else}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              {storageStats ? 'Refresh' : 'Check usage'}
            {/if}
          </button>
        </div>

        {#if storageError}
          <p class="field-hint" style="color:var(--rd)">{storageError}</p>
        {:else if !storageStats}
          <p class="field-hint">Click "Check usage" to query your Cloudflare R2 bucket.</p>
        {:else}
          {@const total = storageStats.totalBytes}
          {@const types = Object.entries(storageStats.byType).sort((a,b) => b[1].bytes - a[1].bytes)}

          <!-- Summary row -->
          <div class="storage-summary">
            <span class="storage-total">{fmtBytes(total)}</span>
            <span class="text-xs text-mu">across {storageStats.totalCount} file{storageStats.totalCount !== 1 ? 's' : ''}</span>
          </div>

          <!-- Segmented progress bar -->
          <div class="storage-bar" title="{fmtBytes(total)} used">
            {#if total === 0}
              <div class="storage-bar-empty"></div>
            {:else}
              {#each types as [t, s]}
                {@const meta = TYPE_META[t] ?? TYPE_META.other}
                {@const pct = (s.bytes / total) * 100}
                <div class="storage-seg" style="width:{pct}%;background:{meta.color}" title="{meta.label}: {fmtBytes(s.bytes)}"></div>
              {/each}
            {/if}
          </div>

          <!-- Per-type breakdown -->
          <div class="storage-types">
            {#each types as [t, s]}
              {@const meta = TYPE_META[t] ?? TYPE_META.other}
              <div class="storage-type-row">
                <span class="storage-type-dot" style="background:{meta.color}"></span>
                <span class="storage-type-label">{meta.label}</span>
                <span class="storage-type-count text-mu">{s.count} file{s.count !== 1 ? 's' : ''}</span>
                <span class="storage-type-bytes">{fmtBytes(s.bytes)}</span>
              </div>
            {/each}
          </div>

          <p class="field-hint">Checked {new Date(storageStats.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
        {/if}
      </div>

      <div class="card settings-card">
        <span class="section-title">Sync stats</span>
        <div class="sync-grid">
          {#each SYNC_STATS as s}
            <div class="sync-stat">
              <span class="sync-label">{s.label}</span>
              <span class="sync-val">{s.val()}</span>
            </div>
          {/each}
        </div>
        <p class="field-hint">All research data is encrypted AES-256-GCM and stored in GitHub. Files and audio in Cloudflare R2.</p>
      </div>

      <div class="card settings-card">
        <span class="section-title">Import &amp; export</span>
        <div class="io-row">
          <div class="io-item">
            <p class="io-label">Export all data</p>
            <p class="field-hint">Downloads notes, journal, tasks, grants, manuscripts, hypotheses, and reading list as JSON.</p>
            <button class="btn btn-ghost btn-sm" onclick={exportData} disabled={exporting}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {exporting ? 'Exporting…' : 'Export JSON'}
            </button>
          </div>
          <div class="io-item">
            <p class="io-label">Import data</p>
            <p class="field-hint">Imports from a previous Q·onco JSON export. Existing data is overwritten.</p>
            <button class="btn btn-ghost btn-sm" onclick={() => importInput?.click()} disabled={importing}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {importing ? 'Importing…' : 'Import JSON'}
            </button>
          </div>
        </div>
      </div>

      <div class="card settings-card">
        <span class="section-title">Keyboard shortcuts</span>
        <div class="shortcuts-grid">
          {#each SHORTCUTS as s}
            <div class="shortcut-row">
              <div class="shortcut-keys">
                {#each s.keys as k}
                  <kbd class="kbd">{k}</kbd>
                {/each}
              </div>
              <span class="text-sm">{s.desc}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="card settings-card">
        <span class="section-title">Session</span>
        <div class="session-row">
          <div>
            <p class="session-label">Reset section toggles</p>
            <p class="text-xs text-mu">Clears the session-storage flags that hide advanced sections (Jobs, Pipeline, Research, Audio).</p>
          </div>
          <button class="btn btn-ghost btn-sm" onclick={clearSessionToggles}>Reset</button>
        </div>
      </div>

      <div class="card settings-card danger-card">
        <span class="section-title danger-title">Danger zone</span>
        <div class="danger-row">
          <div>
            <p class="danger-label">Log out</p>
            <p class="text-xs text-mu">Clears your session. Data remains encrypted in GitHub.</p>
          </div>
          <button class="btn btn-danger-outline btn-sm" onclick={logout}>Log out</button>
        </div>
      </div>

      <div class="app-version text-xs text-mu">Q·onco Research Notes · v2.0 · encrypted · GitHub + Cloudflare</div>
    </div>
  {/if}

  <!-- Sticky save bar -->
  <div class="save-bar">
    <button class="btn btn-primary" onclick={save} disabled={saving}>
      {saving ? 'Saving…' : 'Save settings'}
    </button>
    <p class="save-hint text-xs text-mu">Settings and profile encrypted and synced to GitHub.</p>
  </div>
</div>

<style>
  .settings-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .settings-header {
    padding: 20px 24px 0;
    flex-shrink: 0;
  }
  .settings-header h2 { margin-bottom: 2px; }

  /* ── Tab bar ── */
  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 12px 24px 0;
    border-bottom: 1px solid var(--bd);
    background: var(--bg);
    flex-shrink: 0;
  }
  .tab-btn {
    padding: 6px 14px;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    border: 1px solid transparent;
    border-bottom: none;
    background: transparent;
    color: var(--tx2);
    font-size: 0.82rem;
    font-family: var(--font);
    cursor: pointer;
    transition: all var(--transition);
    margin-bottom: -1px;
  }
  .tab-btn:hover { color: var(--tx); background: var(--sf2); }
  .tab-btn.active {
    color: var(--tx);
    background: var(--bg);
    border-color: var(--bd);
    border-bottom-color: var(--bg);
    font-weight: 600;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* ── Cards ── */
  .settings-card { display: flex; flex-direction: column; gap: 14px; }
  .section-title {
    display: block;
    font-size: 0.7rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--mu);
  }
  .section-hint { margin-top: -6px; }

  .field { display: flex; flex-direction: column; gap: 5px; }
  .field label { font-size: 0.82rem; font-weight: 500; color: var(--tx); }
  .hint-label { font-weight: 400; color: var(--mu); font-size: 0.72rem; }
  .field-hint { font-size: 0.77rem; color: var(--mu); line-height: 1.5; margin-top: 2px; }

  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-full { grid-column: 1/-1; }

  .orcid-link { font-size: 0.72rem; font-weight: 400; color: var(--ac); margin-left: 6px; }

  /* ── Appearance choices ── */
  .choice-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .choice-btn {
    padding: 6px 16px; border-radius: var(--radius-sm);
    border: 1px solid var(--bd); background: transparent;
    color: var(--tx2); font-size: 0.875rem; font-family: var(--font);
    cursor: pointer; transition: all var(--transition);
  }
  .choice-btn:hover { background: var(--sf2); border-color: var(--bd2); }
  .choice-btn.sel { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }

  .accent-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .accent-btn {
    width: 26px; height: 26px; border-radius: 50%;
    border: 2px solid transparent; cursor: pointer; transition: all 0.15s;
  }
  .accent-btn.sel { border-color: var(--tx); transform: scale(1.2); }
  .accent-btn:hover:not(.sel) { transform: scale(1.1); }

  /* ── Worker ── */
  .worker-row { display: flex; gap: 8px; align-items: center; }
  .worker-input { flex: 1; }
  .status-ok  { color: var(--gn); margin-top: 2px; }
  .status-err { color: var(--rd); margin-top: 2px; }

  /* ── Model table ── */
  .model-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .pending-badge {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.72rem; color: var(--ac);
    background: var(--ac-bg); border: 1px solid var(--ac);
    border-radius: 20px; padding: 2px 8px;
  }
  .pending-dot { width: 6px; height: 6px; background: var(--ac); border-radius: 50%; animation: blink 0.9s ease-in-out infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

  .model-table { border: 1px solid var(--bd); border-radius: var(--radius-sm); overflow: hidden; }
  .model-row {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 9px 12px; border-bottom: 1px solid var(--bd); background: var(--sf);
  }
  .model-row:last-child { border-bottom: none; }
  .model-row:nth-child(even) { background: var(--sf2); }
  .model-left { display: flex; flex-direction: column; gap: 2px; width: 160px; flex-shrink: 0; }
  .model-fn { font-size: 0.82rem; font-weight: 500; }
  .model-id { font-size: 0.68rem; color: var(--ac); background: transparent; padding: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .model-right { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-top: 1px; }
  .model-stats { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .model-note { font-size: 0.72rem; color: var(--mu); }
  .tok-count { font-size: 0.72rem; color: var(--tx2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tok-count.tok-warn { color: var(--yw); }
  .tok-track { height: 4px; background: var(--sf3); border-radius: 2px; overflow: hidden; position: relative; }
  .tok-fill { height: 100%; background: var(--gn); border-radius: 2px; transition: width 0.6s; }
  .tok-fill-warn { background: var(--yw); }
  .tok-pending-pulse { position: absolute; top:0; right:0; height:100%; width:20%; background: linear-gradient(90deg, transparent, rgba(91,143,212,0.5)); animation: pulse-right 1.2s ease-in-out infinite; }
  @keyframes pulse-right { 0%{transform:translateX(-100%);opacity:0} 50%{opacity:1} 100%{transform:translateX(100%);opacity:0} }

  /* ── AI feature toggles ── */
  .ai-feature-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 9px 0; border-bottom: 1px solid var(--bd);
  }
  .ai-feature-row:last-of-type { border-bottom: none; }
  .ai-feature-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .ai-feature-label { font-size: 0.87rem; font-weight: 500; }
  .ai-feature-desc { line-height: 1.4; }
  .toggle-btn {
    width: 40px; height: 22px; border-radius: 11px; flex-shrink: 0;
    background: var(--bd2); border: none; cursor: pointer;
    position: relative; transition: background 0.2s; padding: 0;
  }
  .toggle-btn.toggle-on { background: var(--ac); }
  .toggle-knob {
    position: absolute; top: 3px; left: 3px;
    width: 16px; height: 16px; border-radius: 50%;
    background: #fff; transition: left 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .toggle-on .toggle-knob { left: 21px; }

  /* ── Notifications ── */
  .notif-test-row { display: flex; align-items: center; gap: 10px; }
  .notif-status {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.82rem; font-weight: 500;
    padding: 5px 10px; border-radius: var(--radius-sm);
  }
  .notif-ok { color: var(--gn); background: var(--gn-bg); }
  .notif-denied { color: var(--rd); background: var(--rd-bg); }
  .send-locations { display: flex; flex-direction: column; gap: 5px; }
  .send-loc-item { display: flex; align-items: center; gap: 8px; }

  /* ── Data ── */
  .sync-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .sync-stat {
    background: var(--sf2); border: 1px solid var(--bd);
    border-radius: var(--radius-sm); padding: 8px 12px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .sync-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mu); }
  .sync-val { font-size: 1.05rem; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* ── Storage stats ── */
  .storage-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .storage-summary { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
  .storage-total { font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--tx); }
  .storage-bar {
    height: 12px; border-radius: 6px; overflow: hidden; background: var(--sf2);
    display: flex; margin-bottom: 12px; border: 1px solid var(--bd);
  }
  .storage-bar-empty { width: 100%; background: var(--sf2); }
  .storage-seg { height: 100%; transition: width 0.4s ease; }
  .storage-types { display: flex; flex-direction: column; gap: 5px; margin-bottom: 6px; }
  .storage-type-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
  .storage-type-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .storage-type-label { width: 44px; font-weight: 600; color: var(--tx2); }
  .storage-type-count { flex: 1; }
  .storage-type-bytes { font-variant-numeric: tabular-nums; font-weight: 500; color: var(--tx); }
  .storage-spin {
    display: inline-block; width: 10px; height: 10px;
    border: 1.5px solid currentColor; border-top-color: transparent;
    border-radius: 50%; animation: storage-spin 0.7s linear infinite;
  }
  @keyframes storage-spin { to { transform: rotate(360deg); } }

  .io-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .io-item { display: flex; flex-direction: column; gap: 6px; }
  .io-label { font-size: 0.82rem; font-weight: 500; }

  .shortcuts-grid { display: flex; flex-direction: column; gap: 7px; }
  .shortcut-row { display: flex; align-items: center; gap: 10px; }
  .shortcut-keys { display: flex; gap: 4px; align-items: center; }
  .kbd {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 2px 7px; min-width: 32px;
    background: var(--sf2); border: 1px solid var(--bd2);
    border-radius: var(--radius-sm); font-family: var(--mono);
    font-size: 0.72rem; font-weight: 600; color: var(--tx2); white-space: nowrap;
  }

  .session-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  .session-label { font-size: 0.85rem; font-weight: 500; margin-bottom: 2px; }

  .danger-card { border-color: var(--rd); }
  .danger-title { color: var(--rd); }
  .danger-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .danger-label { font-size: 0.85rem; font-weight: 500; margin-bottom: 2px; }
  .btn-danger-outline {
    border: 1px solid var(--rd); color: var(--rd); background: transparent;
    padding: 5px 12px; border-radius: var(--radius-sm); cursor: pointer;
    font-size: 0.82rem; font-family: var(--font); transition: all var(--transition);
  }
  .btn-danger-outline:hover { background: var(--rd-bg); }

  .app-version { text-align: center; padding: 4px 0 12px; }

  /* ── Sticky save bar ── */
  .save-bar {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 24px;
    border-top: 1px solid var(--bd);
    background: var(--bg);
    flex-shrink: 0;
  }
  .save-hint { margin-top: 2px; }

  @media (max-width: 640px) {
    .tab-content { padding: 16px; }
    .field-grid { grid-template-columns: 1fr; }
    .sync-grid { grid-template-columns: 1fr 1fr; }
    .io-row { grid-template-columns: 1fr; }
    .settings-header { padding: 16px 16px 0; }
    .tab-bar { padding: 10px 16px 0; }
    .save-bar { padding: 12px 16px; }
  }
  @media (max-width: 540px) {
    .tab-bar { gap: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .tab-btn { padding: 6px 10px; font-size: 0.75rem; white-space: nowrap; }
    .sync-grid { grid-template-columns: 1fr; }
    .save-bar { flex-wrap: wrap; }
  }
</style>
