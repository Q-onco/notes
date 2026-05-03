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
  import Audio from './Audio.svelte';
  import Settings from './Settings.svelte';
  import Enzo from './Enzo.svelte';
  import Weather from './Weather.svelte';
  import Help from './Help.svelte';

  let toastMsg = $state('');
  let toastType = $state<'success' | 'error' | ''>('');
  let toastTimer: ReturnType<typeof setTimeout>;
  let helpOpen = $state(false);
  let clockOpen = $state(false);
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

  function onWindowKey(e: KeyboardEvent) {
    if (e.key === '?' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      helpOpen = true;
    }
    if (e.key === 'Escape') {
      helpOpen = false;
      clockOpen = false;
    }
  }

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
        <Research {showToast} />
      {:else if store.view === 'audio'}
        <Audio {showToast} />
      {:else if store.view === 'settings'}
        <Settings {showToast} />
      {/if}
    </main>

    {#if store.enzoOpen}
      <aside class="enzo-panel">
        <Enzo {showToast} />
      </aside>
    {/if}
  </div>

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

  @media (max-width: 540px) {
    .main-layout { position: relative; }
    .sidebar-panel {
      position: absolute;
      top: 0; left: 0;
      height: 100%;
      z-index: 50;
      width: 260px;
      box-shadow: var(--shadow-lg);
    }
    .enzo-panel { display: none; }
    .top-bar { padding: 0 10px; }
    .tz-seg { display: none; }
    .tz-seg:first-of-type { display: inline; }
    .tz-dot { display: none; }
  }
</style>
