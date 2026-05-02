<script lang="ts">
  import { fetchWeather } from '../lib/weather';
  import type { WeatherData } from '../lib/types';

  let cities = $state<WeatherData[]>([]);
  let lastFetch = $state(0);

  async function load() {
    try {
      cities = await fetchWeather();
      lastFetch = Date.now();
    } catch {
      // fail silently — weather is non-critical
    }
  }

  $effect(() => {
    load();
    const timer = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(timer);
  });
</script>

<div class="weather-strip">
  {#each cities as city}
    <div class="city-chip" title="{city.desc} · Humidity {city.humidity}% · Wind {city.windKph} km/h">
      <span class="city-icon">{city.icon}</span>
      <span class="city-name">{city.city}</span>
      <span class="city-temp">{city.tempC}°C</span>
      <span class="city-desc">{city.desc}</span>
    </div>
    {#if cities.indexOf(city) < cities.length - 1}
      <span class="sep">·</span>
    {/if}
  {/each}
</div>

<style>
  .weather-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
    color: var(--tx2);
    flex: 1;
    justify-content: center;
    overflow: hidden;
  }

  .city-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
    cursor: default;
  }

  .city-icon { font-size: 14px; line-height: 1; }
  .city-name { font-weight: 600; color: var(--tx); }
  .city-temp { font-weight: 600; color: var(--ac); }
  .city-desc { color: var(--mu); }

  .sep { color: var(--bd2); font-size: 0.9em; }
</style>
