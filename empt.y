// Old Service Worker Code. 

// Name of the cache
const cacheName = 'SonicPages';

// Tap into the service worker install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(cacheName)
        .then(cache => {
            // Add files to the cache
            cache.addAll([
              '/logo.svg',
              '/index.js'
            ])
        })
        .catch(err => {
            console.log(`Encountered an error while caching: ${err}`)
        })
    )
});

// Service worker installation will only take place if no errors occur

// Listen for application fetch events to redirect them here
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request, {
            ignoreSearch: true
        })
        .then(res => {
            if (res) { // If there's a match in the cache, return it
                console.log(`Returned from cache: ${res.body}`);
                return res;
            }
            // Clone the request (an event is a stream and can only be consumed once)
            const requestToCache = event.request.clone();
            return fetch(requestToCache) // Fetch from the server if not in cache
            .then(res => {
                if (!res || res.status !== 200) {
                    return res;
                }
                // Clone the response
                const responseToCache = res.clone();
                // Open the cache and put the response in it
                caches.open(cacheName)
                .then(cache => {
                    cache.put(requestToCache, responseToCache);
                    console.log('Resource cached');
                }).catch(err => {
                    console.log(err)
                });
                // Return the response
                return res;
            });
        })
    );
});
