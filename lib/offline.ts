export type OfflineSection = { id: string; index: number; title: string | null; text: string };
export type OfflineSnapshot = {
  id: string;
  ownerId: string;
  title: string;
  author: string | null;
  format: string;
  savedAt: string;
  sections: OfflineSection[];
  annotations: { bookmarks: unknown[]; highlights: unknown[]; notes: unknown[] };
};

type QueuedMutation = { id?: number; ownerId: string; url: string; method: string; headers: Record<string, string>; body: string | null; createdAt: string };

const databaseName = "sonicpages-offline";
const databaseVersion = 1;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("documents")) database.createObjectStore("documents", { keyPath: "id" });
      if (!database.objectStoreNames.contains("mutations")) database.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineDocument(snapshot: OfflineSnapshot) {
  const database = await openDatabase();
  await transactionPromise(database, "documents", "readwrite", (store) => store.put(snapshot));
  database.close();
}

export async function hasOfflineDocument(documentId: string) {
  const database = await openDatabase();
  const value = await transactionPromise(database, "documents", "readonly", (store) => store.get(documentId));
  database.close();
  return Boolean(value);
}

export async function removeOfflineDocument(documentId: string) {
  const database = await openDatabase();
  await transactionPromise(database, "documents", "readwrite", (store) => store.delete(documentId));
  database.close();
}

export async function queueMutation(mutation: QueuedMutation) {
  const database = await openDatabase();
  await transactionPromise(database, "mutations", "readwrite", (store) => store.add(mutation));
  database.close();
  const registration = await navigator.serviceWorker?.ready.catch(() => null);
  if (registration && "sync" in registration) await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register("sonicpages-sync").catch(() => undefined);
}

export async function resilientMutation(ownerId: string, url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (navigator.onLine) throw error;
    if (!isQueueableMutation(init.method ?? "POST", url)) throw error;
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    await queueMutation({ ownerId, url, method: init.method ?? "POST", headers, body: typeof init.body === "string" ? init.body : null, createdAt: new Date().toISOString() });
    return null;
  }
}

export function isQueueableMutation(method: string, url: string) {
  const path = new URL(url, "https://sonicpages.local").pathname;
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "PUT" && (/^\/api\/documents\/[^/]+\/progress$/.test(path) || path === "/api/reader/preferences" || path === "/api/audio/preferences")) return true;
  if (normalizedMethod === "POST" && /^\/api\/documents\/[^/]+\/annotations$/.test(path)) return true;
  return ["PATCH", "DELETE"].includes(normalizedMethod) && /^\/api\/annotations\/(bookmark|highlight|note)\/[^/]+$/.test(path);
}

export async function clearOfflineData() {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

function transactionPromise(database: IDBDatabase, storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest) {
  return new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
