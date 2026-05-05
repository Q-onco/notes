const CACHE_APP = 'qonco-app-v2';
const CACHE_CDN = 'qonco-cdn-v2';

const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const BYPASS_HOSTS = [
  'api.github.com',
  'api.groq.com',
  'eutils.ncbi.nlm.nih.gov',
  'api.biorxiv.org',
  'api.open-meteo.com',
  'workers.dev',         // Cloudflare Worker (R2 streams, LLM, mail)
  'brevo.com',
];

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_APP && k !== CACHE_CDN)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Bypass all external APIs and non-GET requests
  if (BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;
  if (e.request.method !== 'GET') return;

  // CDN fonts: cache-first
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    e.respondWith(
      caches.open(CACHE_CDN).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            cache.put(e.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // App shell: network-first, fallback to cache for offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_APP).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
