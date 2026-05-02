<script lang="ts">
  import './app.css';
  import { store } from './lib/store.svelte';
  import Login from './components/Login.svelte';
  import Shell from './components/Shell.svelte';

  let themeTimer: ReturnType<typeof setInterval>;

  function applyTheme() {
    const override = store.settings.themeOverride;
    if (override !== 'auto') {
      document.documentElement.setAttribute('data-theme', override);
      const meta = document.getElementById('theme-meta');
      if (meta) meta.setAttribute('content', override === 'dark' ? '#080c14' : '#ffffff');
      return;
    }
    const h = new Date().getHours();
    const isDark = h < 6 || h >= 19;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const meta = document.getElementById('theme-meta');
    if (meta) meta.setAttribute('content', isDark ? '#080c14' : '#ffffff');
  }

  $effect(() => {
    applyTheme();
    themeTimer = setInterval(applyTheme, 60000);
    return () => clearInterval(themeTimer);
  });

  $effect(() => {
    // Re-apply when theme override changes
    store.settings.themeOverride;
    applyTheme();
  });

  // Restore session on page load
  $effect(() => {
    const saved = sessionStorage.getItem('_qt');
    if (saved && !store.authenticated) {
      store.login(saved).catch(() => sessionStorage.removeItem('_qt'));
    }
  });
</script>

{#if store.authenticated}
  <Shell />
{:else}
  <Login />
{/if}
