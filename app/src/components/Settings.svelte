<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { MODELS } from '../lib/groq';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let saving = $state(false);

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

      <div class="field">
        <span class="field-label">Models (fixed per function)</span>
        <div class="model-table">
          <div class="model-row">
            <span class="model-fn">Enzo chat</span>
            <code class="model-id">{MODELS.enzo}</code>
            <span class="model-note">70B · always</span>
          </div>
          <div class="model-row">
            <span class="model-fn">Research &amp; summaries</span>
            <code class="model-id">{MODELS.research}</code>
            <span class="model-note">120B · on click</span>
          </div>
          <div class="model-row">
            <span class="model-fn">Light tasks</span>
            <code class="model-id">{MODELS.quick}</code>
            <span class="model-note">8B · on click</span>
          </div>
          <div class="model-row">
            <span class="model-fn">Transcription</span>
            <code class="model-id">{MODELS.whisper}</code>
            <span class="model-note">audio · on click</span>
          </div>
        </div>
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
    max-width: 580px;
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

  .opt { font-size: 0.78rem; font-weight: 400; color: var(--mu); }

  .field-hint { font-size: 0.78rem; color: var(--mu); line-height: 1.5; }

  .model-table {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    overflow: hidden;
    font-size: 0.8rem;
  }

  .model-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
  }
  .model-row:last-child { border-bottom: none; }
  .model-row:nth-child(even) { background: var(--sf2); }

  .model-fn {
    width: 160px;
    flex-shrink: 0;
    color: var(--tx2);
    font-weight: 500;
  }

  .model-id {
    flex: 1;
    color: var(--ac);
    font-size: 0.75rem;
    background: transparent;
    padding: 0;
  }

  .model-note {
    color: var(--mu);
    font-size: 0.72rem;
    white-space: nowrap;
  }

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
