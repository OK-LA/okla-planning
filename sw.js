// ══════════════════════════════════════════════
// OK-LA Planning — Service Worker
// Gère le cache, le mode hors ligne et les MAJ
// ══════════════════════════════════════════════

const APP_VERSION = 'okla-v1.0';
const CACHE_NAME = APP_VERSION;

// Fichiers à mettre en cache pour le mode hors ligne
const FILES_TO_CACHE = [
  '/okla-planning/',
  '/okla-planning/index.html',
  '/okla-planning/manifest.json',
  '/okla-planning/icon-192.png',
  '/okla-planning/icon-512.png',
];

// ── Installation : mise en cache des fichiers ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── Activation : nettoyage des anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => {
      // Notifier l'app qu'une mise à jour est disponible
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'APP_UPDATED', version: APP_VERSION });
        });
      });
      return self.clients.claim();
    })
  );
});

// ── Fetch : stratégie Network First avec fallback cache ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Appels Google Apps Script → toujours réseau (pas de cache)
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Polices Google → cache puis réseau
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Fichiers app → Network First (mise à jour auto) avec fallback cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre en cache la nouvelle version
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Pas de réseau → utiliser le cache
        return caches.match(event.request).then(cached => {
          return cached || new Response(
            '<h2 style="font-family:Arial;text-align:center;margin-top:40px">📵 Hors ligne<br><small>Reconnectez-vous pour accéder au planning</small></h2>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});
