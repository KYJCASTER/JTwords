// Basic service worker for offline caching
const CACHE = 'cet6-app-v1';
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.webmanifest'
];
self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE_ASSETS)));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (url.pathname.startsWith('/cet6/')) {
        // Cache-first for dataset chunks
        e.respondWith(caches.open(CACHE).then(cache => cache.match(e.request).then(res => {
            if (res) return res;
            return fetch(e.request).then(net => { cache.put(e.request, net.clone()); return net; });
        })));
        return;
    }
    if (CORE_ASSETS.includes(url.pathname)) {
        e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(r => r || fetch(e.request))));
        return;
    }
});
