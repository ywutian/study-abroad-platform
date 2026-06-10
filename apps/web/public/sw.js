/**
 * Self-destroying service worker (kill-switch). DO NOT DELETE.
 *
 * Why this file exists (2026-06 incident): the app shipped a next-pwa
 * precaching service worker from 2026-01. The locale proxy later started
 * 307-redirecting /sw.js, and browsers reject redirected SW scripts, so every
 * installed worker was pinned forever with a stale precache — affected
 * visitors couldn't navigate after deploys ("页面无法跳转"). The PWA build
 * hook was also silently dead under Turbopack, so no fresh sw.js existed.
 *
 * This static worker is what those pinned browsers download on their next
 * update check (now that /sw.js serves 200 again — guarded by
 * proxy.matcher.test.ts and the release-runtime CI assert step). It installs,
 * takes over immediately, deletes every cache, unregisters itself, and
 * reloads its clients so they leave SW control and go straight to network.
 *
 * If you ever reintroduce a real service worker, read the incident notes in
 * src/proxy.ts first: /sw.js must serve 200 (never a locale redirect), and
 * the build must actually generate the worker (webpack-only plugins do
 * nothing under Turbopack).
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    })()
  );
});
// Intentionally no fetch handler: pages fall through to the network.
