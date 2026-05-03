<script lang="ts">
  import { fetchWeather } from '../lib/weather';
  import type { WeatherData } from '../lib/types';
  import { store } from '../lib/store.svelte';

  let cities = $state<WeatherData[]>([]);

  async function load() {
    try {
      cities = await fetchWeather();
    } catch {
      // fail silently
    }
  }

  $effect(() => {
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(t);
  });

  function tempClass(c: number): string {
    if (c <= 10) return 'cold';
    if (c <= 20) return 'cool';
    if (c <= 28) return 'warm';
    return 'hot';
  }
</script>

{#if cities.length > 0}
  <div class="wx-strip">
    {#each cities as city, i}
      <button
        class="wx-card"
        title="{city.desc} · {city.humidity}% humidity · {city.windKph} km/h wind"
        onclick={() => store.view = 'calendar'}
      >
        <span class="wx-icon">{city.icon}</span>
        <div class="wx-body">
          <span class="wx-city">{city.city}</span>
          <span class="wx-temp {tempClass(city.tempC)}">{city.tempC}°</span>
        </div>
        <span class="wx-desc">{city.desc}</span>
      </button>
      {#if i < cities.length - 1}
        <div class="wx-divider"></div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .wx-strip {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 3px 6px;
    flex: 1;
    max-width: 400px;
    overflow: hidden;
  }

  .wx-card {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: var(--font);
    transition: background var(--transition);
    flex: 1;
    min-width: 0;
  }
  .wx-card:hover { background: var(--sf3); }

  .wx-icon { font-size: 16px; line-height: 1; flex-shrink: 0; }

  .wx-body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.15;
    flex-shrink: 0;
  }

  .wx-city {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mu);
    white-space: nowrap;
  }

  .wx-temp {
    font-size: 0.9rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .wx-temp.cold  { color: var(--ac); }
  .wx-temp.cool  { color: var(--gn); }
  .wx-temp.warm  { color: var(--enzo); }
  .wx-temp.hot   { color: var(--rd); }

  .wx-desc {
    font-size: 0.7rem;
    color: var(--tx2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 72px;
    flex: 1;
    min-width: 0;
  }

  .wx-divider {
    width: 1px;
    height: 22px;
    background: var(--bd);
    flex-shrink: 0;
    margin: 0 2px;
  }

  @media (max-width: 800px) {
    .wx-desc { display: none; }
    .wx-strip { max-width: 240px; }
  }

  @media (max-width: 600px) {
    .wx-strip { display: none; }
  }
</style>
