// Cache version management
const CACHE_VERSION = 'v1';
const CACHE_NAME = `SonicPages-${CACHE_VERSION}`;

// Separate static and dynamic caches
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;

// Assets that should be cached immediately
const STATIC_ASSETS = [
    '/logo.svg',
    '/index.js',
    '/manifest.json',
    '/offline.html',  
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js'
];

// HTML and dynamic resources configuration
const DYNAMIC_PATHS = [
    '/',
    '/index.html'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting()) // Activate new service worker immediately
    );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => {
                            // Delete old version caches
                            return cacheName.startsWith('SonicPages-') &&
                                   cacheName !== STATIC_CACHE &&
                                   cacheName !== DYNAMIC_CACHE;
                        })
                        .map(cacheName => {
                            console.log(`Deleting old cache: ${cacheName}`);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => self.clients.claim()) // Take control of all clients
    );
});

// Network-first strategy for HTML and dynamic content
async function networkFirstStrategy(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful network response
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
        
        return networkResponse;
    } catch (error) {
        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If both network and cache fail, return offline page
        if (request.headers.get('accept').includes('text/html')) {
            const offlineResponse = await caches.match('/offline.html');
            if (offlineResponse) {
                return offlineResponse;
            }
            // If offline page is somehow not in cache, return a basic error response
            return new Response('Offline - Please check your connection', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
        
        throw error;
    }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // If not in cache, get from network and cache it
    const networkResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
}

// Fetch event - handle requests
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Special handling for HTML and dynamic content
    if (DYNAMIC_PATHS.includes(url.pathname) || 
        event.request.headers.get('accept').includes('text/html')) {
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }
    
    // Cache-first for static assets
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(cacheFirstStrategy(event.request));
        return;
    }
    
    // Default strategy for other requests
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Handle service worker updates
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});