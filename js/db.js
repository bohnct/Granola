// Small IndexedDB key-value store for on-device settings and the offline copy
// of the Google Sheet data. The Sheet itself is the real record.
const DB_NAME = 'grain-pwa';
const STORE = 'kv';

let dbPromise;
function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const getItem = async (key, fallback) => (await tx('readonly', (s) => s.get(key))) ?? fallback;
export const setItem = (key, value) => tx('readwrite', (s) => s.put(value, key));

export const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

// Ask the browser not to evict our data under storage pressure.
export async function persist() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}
