// ══════════════════════════════════════════════
// OK-LA Planning — Service Worker v2
// Gère le cache, le mode hors ligne et les MAJ automatiques
// ══════════════════════════════════════════════

// Le numéro de version doit être incrémenté à CHAQUE mise à jour du code
// pour forcer le navigateur à détecter le changement et activer la nouvelle version.
const APP_VERSION = 'okla-v3.1';
const CACHE_NAME = APP_VERSION;

const FILES_TO_CACHE = [
  '/okla-planning/',
  '/okla-planning/index.html',
  '/okla-planning/manifest.json',
  '/okla-planning/icon-192.png',
  '/okla-planning/icon-512.png',
];

// ── Installation : mise en cache des fichiers ──
// On N'appelle PAS skipWaiting() automatiquement ici : on attend le signal
// explicite de l'app (SKIP_WAITING) pour éviter les activations en double.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

// ── Réception du signal de l'app : on force l'activation immédiate ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activation : nettoyage des anciens caches + prise de contrôle immédiate ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie Network First avec fallback cache ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Appels Google Apps Script → toujours réseau, jamais d'interception/cache
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return; // Laisser le navigateur gérer nativement, sans passer par le SW
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

  // Fichiers app → Network First (toujours essayer le réseau d'abord pour avoir la dernière version)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || new Response(
            '<h2 style="font-family:Arial;text-align:center;margin-top:40px">📵 Hors ligne<br><small>Reconnectez-vous pour accéder au planning</small></h2>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});
