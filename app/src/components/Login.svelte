<script lang="ts">
  import { store } from '../lib/store.svelte';

  let token = $state('');
  let error = $state('');
  let loading = $state(false);
  let showToken = $state(false);
  let trustDevice = $state(false);

  async function handleLogin() {
    if (!token.trim()) { error = 'Please enter your GitHub token.'; return; }
    loading = true;
    error = '';
    try {
      await store.login(token.trim());
      if (trustDevice) {
        localStorage.setItem('qonco_device', token.trim());
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter') handleLogin();
  }

  // Try trusted device on mount
  $effect(() => {
    const saved = localStorage.getItem('qonco_device');
    if (saved && !store.authenticated) {
      token = saved;
      trustDevice = true;
    }
  });
</script>

<div class="login-bg">
  <!-- Animated background blobs -->
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>

  <div class="login-wrap">
    <!-- Enzo dog animation -->
    <div class="enzo-stage" aria-hidden="true">
      <div class="enzo-container" class:loading>
        <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" class="enzo-dog">
          <!-- Tail (wags) -->
          <g class="tail">
            <path d="M 88 72 Q 108 52 100 34 Q 112 42 108 60 Q 118 50 112 68" stroke="#c87941" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
          <!-- Body -->
          <ellipse cx="62" cy="94" rx="30" ry="22" fill="#c87941"/>
          <!-- Chest lighter -->
          <ellipse cx="47" cy="97" rx="13" ry="17" fill="#e8a55a"/>
          <!-- Back leg -->
          <rect x="74" y="108" width="11" height="24" rx="5" fill="#b06830"/>
          <!-- Front legs -->
          <rect x="52" y="108" width="11" height="26" rx="5" fill="#c87941"/>
          <rect x="36" y="108" width="11" height="26" rx="5" fill="#c87941"/>
          <!-- Paws -->
          <ellipse cx="57" cy="135" rx="7" ry="4" fill="#7a4010"/>
          <ellipse cx="41" cy="135" rx="7" ry="4" fill="#7a4010"/>
          <ellipse cx="79" cy="133" rx="7" ry="4" fill="#7a4010"/>
          <!-- Neck -->
          <rect x="47" y="70" width="22" height="24" rx="9" fill="#c87941"/>
          <!-- Head -->
          <circle cx="57" cy="58" r="22" fill="#c87941"/>
          <!-- Snout -->
          <ellipse cx="49" cy="63" rx="13" ry="11" fill="#e8a55a"/>
          <!-- Left ear (flaps) -->
          <g class="ear-l">
            <path d="M 40 42 Q 28 24 35 14 Q 44 30 48 44 Z" fill="#7a4010"/>
          </g>
          <!-- Right ear (flaps) -->
          <g class="ear-r">
            <path d="M 74 42 Q 86 24 79 14 Q 70 30 66 44 Z" fill="#7a4010"/>
          </g>
          <!-- Eyes -->
          <circle cx="48" cy="53" r="4.5" fill="#1a0a00"/>
          <circle cx="66" cy="53" r="4.5" fill="#1a0a00"/>
          <circle cx="49.5" cy="51.5" r="1.8" fill="white"/>
          <circle cx="67.5" cy="51.5" r="1.8" fill="white"/>
          <!-- Nose -->
          <ellipse cx="50" cy="63" rx="5.5" ry="4" fill="#1a0a00"/>
          <ellipse cx="49" cy="62" rx="2" ry="1.5" fill="rgba(255,255,255,0.2)"/>
          <!-- Mouth -->
          <path d="M 44 68 Q 50 73 56 68" stroke="#7a4010" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          <!-- Tongue -->
          <ellipse cx="50" cy="71" rx="4.5" ry="3.5" fill="#e06060"/>
          <!-- Collar -->
          <rect x="44" y="75" width="26" height="7" rx="3.5" fill="#3a5fc8"/>
          <!-- Collar tag -->
          <circle cx="57" cy="83" r="5" fill="#e8943a"/>
          <text x="57" y="86" text-anchor="middle" fill="white" font-size="5" font-weight="700" font-family="Inter, sans-serif">E</text>
        </svg>
      </div>
      <p class="enzo-name">Enzo</p>
    </div>

    <!-- Login card -->
    <div class="lbox">
      <div class="lbox-head">
        <h1>Q·onco</h1>
        <p class="subtitle">Research intelligence — private, encrypted, yours.</p>
      </div>

      <div class="field">
        <label for="token-input">GitHub token</label>
        <div class="token-wrap">
          <input
            id="token-input"
            type={showToken ? 'text' : 'password'}
            bind:value={token}
            onkeydown={handleKey}
            placeholder="ghp_•••••••••••••••••••••••••"
            autocomplete="off"
            spellcheck="false"
            disabled={loading}
          />
          <button
            class="btn-icon show-btn"
            onclick={() => showToken = !showToken}
            tabindex="-1"
            type="button"
            aria-label={showToken ? 'Hide token' : 'Show token'}
          >
            {showToken ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {#if error}
        <div class="error-msg">{error}</div>
      {/if}

      <label class="trust-label">
        <input type="checkbox" bind:checked={trustDevice} />
        <span>Trust this device</span>
      </label>

      <button
        class="btn btn-primary login-btn"
        onclick={handleLogin}
        disabled={loading || !token.trim()}
      >
        {#if loading}
          <span class="spinner"></span> Unlocking...
        {:else}
          Open workspace
        {/if}
      </button>

      {#if loading}
        <div class="progress-bar mt-3">
          <div class="progress-fill"></div>
        </div>
        <p class="loading-msg text-sm text-mu">{store.loadingMsg}</p>
      {/if}

      <p class="hint text-xs text-mu mt-3">
        Token never leaves your device. All data is encrypted with it client-side.
      </p>
    </div>
  </div>
</div>

<style>
  .login-bg {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    position: relative;
    overflow: hidden;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.35;
    pointer-events: none;
  }
  .blob-1 {
    width: 500px; height: 400px;
    background: radial-gradient(circle, rgba(184,120,60,0.4), transparent);
    top: -10%; left: -10%;
    animation: blob-float 8s ease-in-out infinite alternate;
  }
  .blob-2 {
    width: 400px; height: 500px;
    background: radial-gradient(circle, rgba(58,95,200,0.3), transparent);
    bottom: -15%; right: -5%;
    animation: blob-float 10s ease-in-out infinite alternate-reverse;
  }
  .blob-3 {
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(107,79,160,0.2), transparent);
    top: 40%; left: 60%;
    animation: blob-float 12s ease-in-out infinite alternate;
  }
  @keyframes blob-float {
    from { transform: translate(0,0) scale(1); }
    to   { transform: translate(30px, 20px) scale(1.08); }
  }

  .login-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
    max-width: 420px;
    padding: 24px 16px;
    position: relative;
    z-index: 1;
  }

  /* ── Enzo dog ── */
  .enzo-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .enzo-container {
    width: 110px;
    height: 130px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .enzo-dog {
    width: 100px;
    height: 120px;
    animation: dog-bounce 0.9s ease-in-out infinite alternate;
    transform-origin: 60px 135px;
    filter: drop-shadow(0 4px 12px rgba(184,120,60,0.3));
  }

  .enzo-container.loading .enzo-dog {
    animation: dog-bounce-fast 0.45s ease-in-out infinite alternate;
  }

  .tail {
    transform-origin: 88px 72px;
    animation: tail-wag 0.55s ease-in-out infinite alternate;
  }

  .ear-l {
    transform-origin: 40px 42px;
    animation: ear-flap 1.1s ease-in-out infinite alternate;
  }

  .ear-r {
    transform-origin: 74px 42px;
    animation: ear-flap-r 1.3s ease-in-out infinite alternate;
  }

  @keyframes dog-bounce {
    from { transform: translateY(0) rotate(-1.5deg); }
    to   { transform: translateY(-11px) rotate(1.5deg); }
  }
  @keyframes dog-bounce-fast {
    from { transform: translateY(0) rotate(-2deg); }
    to   { transform: translateY(-16px) rotate(2deg); }
  }
  @keyframes tail-wag {
    from { transform: rotate(-28deg); }
    to   { transform: rotate(22deg); }
  }
  @keyframes ear-flap {
    from { transform: rotate(-7deg); }
    to   { transform: rotate(9deg); }
  }
  @keyframes ear-flap-r {
    from { transform: rotate(7deg); }
    to   { transform: rotate(-9deg); }
  }

  .enzo-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--enzo);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* ── Login card ── */
  .lbox {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius-lg);
    padding: 28px;
    width: 100%;
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .lbox-head { margin-bottom: 20px; }
  .lbox-head h1 { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.03em; }
  .subtitle { font-size: 0.875rem; color: var(--mu); margin-top: 4px; }

  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-size: 0.8rem; font-weight: 600; color: var(--tx2); }

  .token-wrap { position: relative; }
  .token-wrap input { padding-right: 40px; font-family: var(--mono); font-size: 0.82rem; }
  .show-btn {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    background: transparent; border: none; cursor: pointer; font-size: 14px;
    color: var(--mu); padding: 4px;
  }

  .error-msg {
    background: var(--rd-bg);
    border: 1px solid var(--rd);
    border-radius: var(--radius-sm);
    color: var(--rd);
    font-size: 0.8rem;
    padding: 8px 12px;
    margin-top: 8px;
  }

  .trust-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var(--tx2);
    cursor: pointer;
    margin-top: 10px;
    user-select: none;
  }
  .trust-label input { width: auto; accent-color: var(--ac); }

  .login-btn {
    width: 100%;
    justify-content: center;
    padding: 10px;
    font-size: 0.95rem;
    margin-top: 12px;
    border-radius: var(--radius);
  }

  .spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .loading-msg { margin-top: 6px; text-align: center; }
  .hint { text-align: center; line-height: 1.5; }
</style>
