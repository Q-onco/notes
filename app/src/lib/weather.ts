import type { WeatherData } from './types';

const CITIES: { name: string; query: string }[] = [
  { name: 'Heidelberg', query: 'Heidelberg,Germany' },
  { name: 'Chennai',    query: 'Chennai,India' }
];

const WMO_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️',
  45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌧',
  61: '🌧', 63: '🌧', 65: '🌧',
  71: '🌨', 73: '🌨', 75: '❄️',
  80: '🌦', 81: '🌧', 82: '⛈',
  95: '⛈', 96: '⛈', 99: '⛈'
};

const WMO_DESC: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Severe storm'
};

const GEO: Record<string, { lat: number; lon: number }> = {
  'Heidelberg,Germany': { lat: 49.3988, lon: 8.6724 },
  'Chennai,India':      { lat: 13.0827, lon: 80.2707 }
};

async function fetchCity(city: { name: string; query: string }): Promise<WeatherData> {
  const { lat, lon } = GEO[city.query];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed for ${city.name}`);
  const json = await res.json();

  const cur = json.current;
  const code = cur.weather_code as number;

  return {
    city: city.name,
    tempC: Math.round(cur.temperature_2m as number),
    desc: WMO_DESC[code] ?? 'Unknown',
    humidity: Math.round(cur.relative_humidity_2m as number),
    windKph: Math.round(cur.wind_speed_10m as number),
    icon: WMO_ICONS[code] ?? '🌡'
  };
}

export async function fetchWeather(): Promise<WeatherData[]> {
  const results = await Promise.allSettled(CITIES.map(fetchCity));
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          city: CITIES[i].name,
          tempC: 0,
          desc: 'Unavailable',
          humidity: 0,
          windKph: 0,
          icon: '—'
        }
  );
}
