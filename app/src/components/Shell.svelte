<script lang="ts">
  import { store } from '../lib/store.svelte';
  import Sidebar from './Sidebar.svelte';
  import Dashboard from './Dashboard.svelte';
  import Editor from './Editor.svelte';
  import Journal from './Journal.svelte';
  import Tasks from './Tasks.svelte';
  import Calendar from './Calendar.svelte';
  import Research from './Research.svelte';
  import Audio from './Audio.svelte';
  import Enzo from './Enzo.svelte';
  import Weather from './Weather.svelte';
  import Help from './Help.svelte';

  let toastMsg = $state('');
  let toastType = $state<'success' | 'error' | ''>('');
  let toastTimer: ReturnType<typeof setTimeout>;
  let helpOpen = $state(false);

  // Live clock
  function fmtClock() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  let clockTime = $state(fmtClock());
  $effect(() => {
    const t = setInterval(() => { clockTime = fmtClock(); }, 15000);
    return () => clearInterval(t);
  });

  // ? key opens help
  function onWindowKey(e: KeyboardEvent) {
    if (e.key === '?' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      helpOpen = true;
    }
  }

  // Close panels by default on small screens
  $effect(() => {
    if (window.innerWidth <= 540) {
      store.sidebarOpen = false;
      store.enzoOpen = false;
    }
  });

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastMsg = ''; toastType = ''; }, 3200);
  }
</script>

<svelte:window onkeydown={onWindowKey} />

{#if helpOpen}
  <Help onclose={() => helpOpen = false} />
{/if}

<div class="shell">
  <!-- Top weather strip -->
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
    </div>

    <Weather />

    <div class="top-right">
      <button
        class="clock-btn"
        onclick={() => store.view = 'calendar'}
        title="Go to calendar"
      >
        {clockTime}
      </button>
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
        Enzo
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

  <!-- Main three-panel layout -->
  <div class="main-layout">
    {#if store.sidebarOpen}
      <aside class="sidebar-panel">
        <Sidebar />
      </aside>
    {/if}

    <main class="content-panel">
      {#if store.view === 'dashboard'}
        <Dashboard {showToast} />
      {:else if store.view === 'notes'}
        <Editor {showToast} />
      {:else if store.view === 'journal'}
        <Journal {showToast} />
      {:else if store.view === 'tasks'}
        <Tasks {showToast} />
      {:else if store.view === 'calendar'}
        <Calendar {showToast} />
      {:else if store.view === 'research'}
        <Research />
      {:else if store.view === 'audio'}
        <Audio {showToast} />
      {/if}
    </main>

    {#if store.enzoOpen}
      <aside class="enzo-panel">
        <Enzo {showToast} />
      </aside>
    {/if}
  </div>

  <!-- Toast -->
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
  }

  .top-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .app-name {
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: -0.02em;
    color: var(--tx);
  }

  .top-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

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

  .clock-btn {
    font-size: 0.78rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--tx2);
    background: transparent;
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    padding: 3px 9px;
    letter-spacing: 0.04em;
    transition: all var(--transition);
    cursor: pointer;
  }
  .clock-btn:hover { border-color: var(--ac); color: var(--ac); background: var(--ac-bg); }

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

  .enzo-panel {
    width: 320px;
    flex-shrink: 0;
    border-left: 1px solid var(--bd);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--sf);
  }

  @media (max-width: 900px) {
    .enzo-panel { width: 280px; }
  }

  @media (max-width: 680px) {
    .sidebar-panel { width: 200px; }
    .enzo-panel { display: none; }
  }

  /* iPhone / small mobile — sidebar overlays instead of pushing content */
  @media (max-width: 540px) {
    .main-layout { position: relative; }
    .sidebar-panel {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      z-index: 50;
      width: 260px;
      box-shadow: var(--shadow-lg);
    }
    .enzo-panel { display: none; }
    .top-bar { padding: 0 10px; }
  }
</style>
