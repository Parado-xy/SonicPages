const VERSION = "sonicpages-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const SHELL = ["/offline.html", "/manifest.webmanifest", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, STATIC_CACHE].includes(key)).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/logo.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sonicpages-sync") event.waitUntil(flushMutations());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "FLUSH_QUEUE") event.waitUntil(flushMutations());
});

async function flushMutations() {
  const database = await openDatabase();
  const mutations = await readAll(database, "mutations");
  if (!mutations.length) return database.close();
  const sessionResponse = await fetch("/api/offline/session", { credentials: "include", cache: "no-store" }).catch(() => null);
  if (!sessionResponse?.ok) return database.close();
  const session = await sessionResponse.json();
  for (const mutation of mutations) {
    if (mutation.ownerId !== session.userId) continue;
    const response = await fetch(mutation.url, { method: mutation.method, headers: mutation.headers, body: mutation.body, credentials: "include" }).catch(() => null);
    if (!response) break;
    if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 401)) await remove(database, "mutations", mutation.id);
  }
  database.close();
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("sonicpages-offline", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("documents")) database.createObjectStore("documents", { keyPath: "id" });
      if (!database.objectStoreNames.contains("mutations")) database.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function readAll(database, store) { return new Promise((resolve, reject) => { const request = database.transaction(store).objectStore(store).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function remove(database, store, key) { return new Promise((resolve, reject) => { const transaction = database.transaction(store, "readwrite"); const request = transaction.objectStore(store).delete(key); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); }
