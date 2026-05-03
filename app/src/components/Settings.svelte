<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { MODELS, DAILY_TOKEN_REF, getAllTokenUsage, type ModelKey } from '../lib/groq';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let saving = $state(false);
  let tokenUsage = $state(getAllTokenUsage());

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

  function pendingFor(key: ModelKey): boolean {
    if (key === 'whisper') return false;
    return store.aiPending > 0;
  }

  async function save() {
    saving = true;
    try {
      await store.saveSettings();
      showToast('Settings saved');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      saving = false;
    }
  }
</script>

<div class="settings-view">
  <div class="settings-header">
    <h2>Settings</h2>
    <p class="text-sm text-mu">Preferences and API configuration</p>
  </div>

  <div class="settings-sections">
    <!-- Profile -->
    <div class="card settings-card">
      <span class="section-title">Profile</span>
      <div class="field">
        <label for="display-name">Display name</label>
        <input id="display-name" type="text" bind:value={store.settings.userName} placeholder="Your name" />
      </div>
    </div>

    <!-- AI / Worker -->
    <div class="card settings-card">
      <span class="section-title">AI &amp; Worker</span>

      <div class="field">
        <label for="worker-url">Worker URL</label>
        <input
          id="worker-url"
          type="url"
          bind:value={store.settings.workerUrl}
          placeholder="https://enzo.quant-onco.workers.dev"
        />
        <p class="field-hint">Cloudflare Worker that proxies all AI calls, PubMed, bioRxiv, and Nature/Cell RSS. Auto-deploys from GitHub on push.</p>
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
                    <div
                      class="tok-fill"
                      class:tok-fill-warn={pct > 75}
                      style="width: {pct}%"
                    ></div>
                    {#if pendingFor(row.key) && used > 0}
                      <div class="tok-pending-pulse"></div>
                    {/if}
                  </div>
                {:else if row.key === 'whisper'}
                  <p class="text-xs text-mu whisper-hint">Quota tracked in Audio view</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        <p class="field-hint">Daily counts reset at midnight. Reference limits are indicative — actual Groq limits vary by plan.</p>
      </div>
    </div>

    <!-- Appearance -->
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
            >
              {label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <div class="save-row">
    <button class="btn btn-primary" onclick={save} disabled={saving}>
      {saving ? 'Saving…' : 'Save settings'}
    </button>
    <p class="save-hint text-xs text-mu">Settings are encrypted and synced to GitHub.</p>
  </div>
</div>

<style>
  .settings-view {
    height: 100%;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 600px;
  }

  .settings-sections { display: flex; flex-direction: column; gap: 14px; }
  .settings-card { display: flex; flex-direction: column; gap: 16px; }

  .section-title {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mu);
  }

  .field { display: flex; flex-direction: column; gap: 6px; }

  .field label, .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--tx);
  }

  .field-hint { font-size: 0.78rem; color: var(--mu); line-height: 1.5; }

  /* ── Pending badge ── */
  .model-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .pending-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.72rem;
    color: var(--ac);
    background: var(--ac-bg);
    border: 1px solid var(--ac);
    border-radius: 20px;
    padding: 2px 8px;
  }

  .pending-dot {
    width: 6px; height: 6px;
    background: var(--ac);
    border-radius: 50%;
    animation: blink 0.9s ease-in-out infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

  /* ── Model table ── */
  .model-table {
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .model-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 9px 12px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
  }
  .model-row:last-child { border-bottom: none; }
  .model-row:nth-child(even) { background: var(--sf2); }

  .model-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 170px;
    flex-shrink: 0;
  }

  .model-fn {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--tx);
  }

  .model-id {
    font-size: 0.7rem;
    color: var(--ac);
    background: transparent;
    padding: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .model-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding-top: 1px;
  }

  .model-stats {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .model-note { font-size: 0.72rem; color: var(--mu); }

  .tok-count {
    font-size: 0.72rem;
    color: var(--tx2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .tok-count.tok-warn { color: var(--yw); }

  .tok-track {
    height: 4px;
    background: var(--sf3);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  .tok-fill {
    height: 100%;
    background: var(--gn);
    border-radius: 2px;
    transition: width 0.6s ease;
    min-width: 0;
  }
  .tok-fill-warn { background: var(--yw); }

  .tok-pending-pulse {
    position: absolute;
    top: 0; right: 0;
    height: 100%;
    width: 20%;
    background: linear-gradient(90deg, transparent, rgba(91,143,212,0.5));
    animation: pulse-right 1.2s ease-in-out infinite;
  }
  @keyframes pulse-right {
    0%   { transform: translateX(-100%); opacity: 0; }
    50%  { opacity: 1; }
    100% { transform: translateX(100%); opacity: 0; }
  }

  .whisper-hint { padding-top: 1px; }

  /* ── Appearance ── */
  .theme-row { display: flex; gap: 8px; flex-wrap: wrap; }

  .theme-btn {
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bd);
    background: transparent;
    color: var(--tx2);
    font-size: 0.875rem;
    font-family: var(--font);
    cursor: pointer;
    transition: all var(--transition);
  }
  .theme-btn:hover { background: var(--sf2); border-color: var(--bd2); }
  .theme-btn.sel { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }

  .save-row { display: flex; align-items: center; gap: 12px; padding-bottom: 8px; }
  .save-hint { margin-top: 2px; }
</style>
