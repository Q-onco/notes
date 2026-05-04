<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { MODELS, DAILY_TOKEN_REF, getAllTokenUsage, type ModelKey, WORKER_URL } from '../lib/groq';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let saving = $state(false);
  let tokenUsage = $state(getAllTokenUsage());
  let workerTesting = $state(false);
  let workerStatus = $state<'idle' | 'ok' | 'error'>('idle');
  let workerMsg = $state('');
  let exporting = $state(false);
  let specInput = $state(store.profile.specializations.join(', '));
  let targetRolesInput = $state(store.profile.targetRoles.join(', '));
  let targetLocInput = $state(store.profile.targetLocations.join(', '));

  // Refresh token counts every 3s while view is open
  $effect(() => {
    tokenUsage = getAllTokenUsage();
    const t = setInterval(() => { tokenUsage = getAllTokenUsage(); }, 3000);
    return () => clearInterval(t);
  });

  const MODEL_ROWS: { key: ModelKey; label: string; note: string }[] = [
    { key: 'enzo',     label: 'Enzo chat',              note: '70B · always' },
    { key: 'research', label: 'Research & summaries',   note: '120B · on click' },
    { key: 'quick',    label: 'Light tasks',             note: '8B · on click' },
    { key: 'whisper',  label: 'Transcription',          note: 'audio · see Audio tab' },
  ];

  function fmtTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  function tokenPct(key: ModelKey): number {
    const ref = DAILY_TOKEN_REF[key];
    if (!ref) return 0;
    return Math.min(100, Math.round((tokenUsage[key] / ref) * 100));
  }

  async function save() {
    saving = true;
    try {
      // sync profile fields
      store.profile.specializations = specInput.split(',').map(s => s.trim()).filter(Boolean);
      store.profile.targetRoles = targetRolesInput.split(',').map(s => s.trim()).filter(Boolean);
      store.profile.targetLocations = targetLocInput.split(',').map(s => s.trim()).filter(Boolean);
      await Promise.all([store.saveSettings(), store.saveProfile()]);
      showToast('Settings saved');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      saving = false;
    }
  }

  async function testWorker() {
    const url = store.settings.workerUrl || WORKER_URL;
    workerTesting = true;
    workerStatus = 'idle';
    workerMsg = '';
    try {
      const res = await fetch(`${url}/ping`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        workerStatus = 'ok';
        workerMsg = `Online — ${url}`;
      } else {
        workerStatus = 'error';
        workerMsg = `HTTP ${res.status}`;
      }
    } catch (e) {
      workerStatus = 'error';
      workerMsg = (e as Error).message;
    } finally {
      workerTesting = false;
    }
  }

  async function exportData() {
    exporting = true;
    try {
      const data = {
        notes: store.notes,
        journal: store.journal,
        tasks: store.tasks,
        audioRecords: store.audioRecords,
        savedJobs: store.savedJobs,
        settings: store.settings,
        exportedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qonco-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported');
    } finally {
      exporting = false;
    }
  }

  function clearSessionToggles() {
    ['qonco_jobs_on', 'qonco_pipeline_on', 'qonco_research_on', 'qonco_audio_on'].forEach(k => sessionStorage.removeItem(k));
    showToast('Section toggles reset (refresh to apply)');
  }

  function logout() {
    if (!confirm('Log out? Your data stays encrypted in GitHub.')) return;
    store.logout();
  }

</script>

<div class="settings-view">
  <div class="settings-header">
    <h2>Settings</h2>
    <p class="text-sm text-mu">Profile, appearance, sync, and AI configuration</p>
  </div>

  <!-- ── Profile ── -->
  <div class="card settings-card">
    <span class="section-title">Profile</span>
    <div class="field-grid">
      <div class="field">
        <label for="display-name">Display name</label>
        <input id="display-name" type="text" bind:value={store.settings.userName} placeholder="Your name" />
      </div>
      <div class="field">
        <label for="orcid-field">ORCID</label>
        <input id="orcid-field" type="text" bind:value={store.settings.orcid} placeholder="0000-0000-0000-0000" />
      </div>
      <div class="field form-full">
        <label for="institution-field">Institution</label>
        <input id="institution-field" type="text" bind:value={store.settings.institution} placeholder="Heidelberg University" />
      </div>
      <div class="field form-full">
        <label for="dept-field">Department</label>
        <input id="dept-field" type="text" bind:value={store.settings.department} placeholder="Department name" />
      </div>
    </div>
  </div>

  <!-- ── Researcher profile ── -->
  <div class="card settings-card">
    <span class="section-title">Researcher profile</span>
    <p class="section-hint text-xs text-mu">Used by Enzo for job matching and cover letter generation.</p>
    <div class="field">
      <label for="spec-field">Specializations <span class="hint-label">(comma-separated)</span></label>
      <input id="spec-field" type="text" bind:value={specInput} placeholder="ovarian cancer, scRNA-seq, PARP inhibitors…" />
    </div>
    <div class="field">
      <label for="roles-field">Target roles <span class="hint-label">(comma-separated)</span></label>
      <input id="roles-field" type="text" bind:value={targetRolesInput} placeholder="Senior Scientist, Translational Scientist…" />
    </div>
    <div class="field">
      <label for="loc-field">Target locations <span class="hint-label">(comma-separated)</span></label>
      <input id="loc-field" type="text" bind:value={targetLocInput} placeholder="Germany, UK, Switzerland…" />
    </div>
  </div>

  <!-- ── Appearance ── -->
  <div class="card settings-card">
    <span class="section-title">Appearance</span>
    <div class="field">
      <span class="field-label">Theme</span>
      <div class="theme-row">
        {#each [['auto','◐ Auto'],['light','☀ Light'],['dark','☾ Dark']] as [val, label]}
          <button
            class="theme-btn"
            class:sel={store.settings.themeOverride === val}
            onclick={() => { store.settings.themeOverride = val as 'auto' | 'light' | 'dark'; }}
          >{label}</button>
        {/each}
      </div>
    </div>
    <div class="field">
      <span class="field-label">Accent colour</span>
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
      </div>
      <p class="field-hint">Accent colour applies after saving — the app will use it on next load.</p>
    </div>
  </div>

  <!-- ── AI & Worker ── -->
  <div class="card settings-card">
    <span class="section-title">AI &amp; Worker</span>

    <div class="field">
      <label for="worker-url">Worker URL</label>
      <div class="worker-row">
        <input
          id="worker-url"
          type="url"
          bind:value={store.settings.workerUrl}
          placeholder="https://enzo.quant-onco.workers.dev"
          class="worker-input"
        />
        <button class="btn btn-ghost btn-sm" onclick={testWorker} disabled={workerTesting}>
          {workerTesting ? 'Testing…' : 'Test'}
        </button>
      </div>
      {#if workerStatus === 'ok'}
        <p class="status-ok text-xs">✓ {workerMsg}</p>
      {:else if workerStatus === 'error'}
        <p class="status-err text-xs">✗ {workerMsg}</p>
      {:else}
        <p class="field-hint">Cloudflare Worker proxying Groq, Whisper, PubMed, bioRxiv, Nature/Cell.</p>
      {/if}
    </div>

    <!-- Model table with token usage -->
    <div class="field">
      <div class="model-header">
        <span class="field-label">Models &amp; today's usage</span>
        {#if store.aiPending > 0}
          <span class="pending-badge">
            <span class="pending-dot"></span>
            {store.aiPending} request{store.aiPending !== 1 ? 's' : ''} in flight
          </span>
        {/if}
      </div>
      <div class="model-table">
        {#each MODEL_ROWS as row}
          {@const pct = tokenPct(row.key)}
          {@const used = tokenUsage[row.key]}
          {@const ref = DAILY_TOKEN_REF[row.key]}
          <div class="model-row">
            <div class="model-left">
              <span class="model-fn">{row.label}</span>
              <code class="model-id">{MODELS[row.key]}</code>
            </div>
            <div class="model-right">
              <div class="model-stats">
                <span class="model-note">{row.note}</span>
                {#if ref > 0}
                  <span class="tok-count" class:tok-warn={pct > 75}>
                    {fmtTokens(used)} / {fmtTokens(ref)} tok
                  </span>
                {/if}
              </div>
              {#if ref > 0}
                <div class="tok-track">
                  <div class="tok-fill" class:tok-fill-warn={pct > 75} style="width: {pct}%"></div>
                  {#if store.aiPending > 0 && used > 0}
                    <div class="tok-pending-pulse"></div>
                  {/if}
                </div>
              {:else if row.key === 'whisper'}
                <p class="text-xs text-mu whisper-hint">Quota tracked in Audio section</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      <p class="field-hint">Daily counts reset at midnight. Reference limits are indicative.</p>
    </div>
  </div>

  <!-- ── Sync & Storage ── -->
  <div class="card settings-card">
    <span class="section-title">Sync &amp; storage</span>
    <div class="sync-grid">
      <div class="sync-stat">
        <span class="sync-label">Notes</span>
        <span class="sync-val">{store.notes.length}</span>
      </div>
      <div class="sync-stat">
        <span class="sync-label">Journal</span>
        <span class="sync-val">{store.journal.length}</span>
      </div>
      <div class="sync-stat">
        <span class="sync-label">Tasks</span>
        <span class="sync-val">{store.tasks.length}</span>
      </div>
      <div class="sync-stat">
        <span class="sync-label">Audio</span>
        <span class="sync-val">{store.audioRecords.length}</span>
      </div>
      <div class="sync-stat">
        <span class="sync-label">Saved jobs</span>
        <span class="sync-val">{store.savedJobs.length}</span>
      </div>
      <div class="sync-stat">
        <span class="sync-label">Chat sessions</span>
        <span class="sync-val">{store.chatSessions.length}</span>
      </div>
    </div>
    <div class="sync-actions">
      <button class="btn btn-ghost btn-sm" onclick={exportData} disabled={exporting}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        {exporting ? 'Exporting…' : 'Export all data (JSON)'}
      </button>
    </div>
    <p class="field-hint">All data is encrypted with AES-256-GCM and stored as commits in your GitHub repository at Q-onco/notes.</p>
  </div>

  <!-- ── Danger zone ── -->
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

  <div class="save-row">
    <button class="btn btn-primary" onclick={save} disabled={saving}>
      {saving ? 'Saving…' : 'Save settings'}
    </button>
    <p class="save-hint text-xs text-mu">Settings and profile encrypted and synced to GitHub.</p>
  </div>
</div>

<style>
  .settings-view {
    height: 100%;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 680px;
  }

  .settings-header h2 { margin-bottom: 2px; }

  .settings-sections { display: flex; flex-direction: column; gap: 14px; }
  .settings-card { display: flex; flex-direction: column; gap: 14px; }

  .section-title {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mu);
  }
  .section-hint { margin-top: -6px; }

  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .form-full { grid-column: 1 / -1; }

  .field { display: flex; flex-direction: column; gap: 5px; }
  .field label, .field-label {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--tx);
  }
  .hint-label { font-weight: 400; color: var(--mu); font-size: 0.72rem; }
  .field-hint { font-size: 0.77rem; color: var(--mu); line-height: 1.5; }

  /* Worker test */
  .worker-row { display: flex; gap: 8px; align-items: center; }
  .worker-input { flex: 1; }
  .status-ok { color: var(--gn); margin-top: 2px; }
  .status-err { color: var(--rd); margin-top: 2px; }

  /* ── Model table ── */
  .model-header {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;
  }
  .pending-badge {
    display: flex; align-items: center; gap: 5px; font-size: 0.72rem;
    color: var(--ac); background: var(--ac-bg); border: 1px solid var(--ac);
    border-radius: 20px; padding: 2px 8px;
  }
  .pending-dot {
    width: 6px; height: 6px; background: var(--ac); border-radius: 50%;
    animation: blink 0.9s ease-in-out infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

  .model-table {
    border: 1px solid var(--bd); border-radius: var(--radius-sm); overflow: hidden;
  }
  .model-row {
    display: flex; align-items: flex-start; gap: 12px; padding: 9px 12px;
    border-bottom: 1px solid var(--bd); background: var(--sf);
  }
  .model-row:last-child { border-bottom: none; }
  .model-row:nth-child(even) { background: var(--sf2); }
  .model-left { display: flex; flex-direction: column; gap: 2px; width: 170px; flex-shrink: 0; }
  .model-fn { font-size: 0.82rem; font-weight: 500; color: var(--tx); }
  .model-id { font-size: 0.7rem; color: var(--ac); background: transparent; padding: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .model-right { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-top: 1px; }
  .model-stats { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .model-note { font-size: 0.72rem; color: var(--mu); }
  .tok-count { font-size: 0.72rem; color: var(--tx2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tok-count.tok-warn { color: var(--yw); }
  .tok-track { height: 4px; background: var(--sf3); border-radius: 2px; overflow: hidden; position: relative; }
  .tok-fill { height: 100%; background: var(--gn); border-radius: 2px; transition: width 0.6s ease; min-width: 0; }
  .tok-fill-warn { background: var(--yw); }
  .tok-pending-pulse {
    position: absolute; top: 0; right: 0; height: 100%; width: 20%;
    background: linear-gradient(90deg, transparent, rgba(91,143,212,0.5));
    animation: pulse-right 1.2s ease-in-out infinite;
  }
  @keyframes pulse-right { 0%{transform:translateX(-100%);opacity:0} 50%{opacity:1} 100%{transform:translateX(100%);opacity:0} }
  .whisper-hint { padding-top: 1px; }

  /* ── Appearance ── */
  .theme-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .theme-btn {
    padding: 6px 14px; border-radius: var(--radius-sm); border: 1px solid var(--bd);
    background: transparent; color: var(--tx2); font-size: 0.875rem;
    font-family: var(--font); cursor: pointer; transition: all var(--transition);
  }
  .theme-btn:hover { background: var(--sf2); border-color: var(--bd2); }
  .theme-btn.sel { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }

  .accent-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .accent-btn {
    width: 24px; height: 24px; border-radius: 50%;
    border: 2px solid transparent; cursor: pointer; transition: all 0.15s;
  }
  .accent-btn.sel { border-color: var(--tx); transform: scale(1.2); }
  .accent-btn:hover:not(.sel) { transform: scale(1.1); }

  /* ── Sync grid ── */
  .sync-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .sync-stat {
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sync-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mu); }
  .sync-val { font-size: 1.1rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--tx); }
  .sync-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  /* ── Shortcuts ── */
  .shortcuts-grid { display: flex; flex-direction: column; gap: 6px; }
  .shortcut-row { display: flex; align-items: center; gap: 10px; }
  .kbd {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 2px 8px; min-width: 48px;
    background: var(--sf2); border: 1px solid var(--bd2);
    border-radius: var(--radius-sm); font-family: var(--mono);
    font-size: 0.72rem; font-weight: 600; color: var(--tx2);
    white-space: nowrap;
  }

  /* ── Danger zone ── */
  .danger-card { border-color: var(--rd); }
  .danger-title { color: var(--rd); }
  .danger-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  .danger-label { font-size: 0.85rem; font-weight: 500; color: var(--tx); margin-bottom: 2px; }
  .btn-danger-outline {
    border: 1px solid var(--rd); color: var(--rd); background: transparent;
    padding: 5px 12px; border-radius: var(--radius-sm); cursor: pointer;
    font-size: 0.82rem; font-family: var(--font); transition: all var(--transition);
  }
  .btn-danger-outline:hover { background: var(--rd-bg); }

  .save-row { display: flex; align-items: center; gap: 12px; padding-bottom: 8px; }
  .save-hint { margin-top: 2px; }

  @media (max-width: 600px) {
    .field-grid { grid-template-columns: 1fr; }
    .sync-grid { grid-template-columns: 1fr 1fr; }
    .settings-view { padding: 16px; }
  }
</style>
