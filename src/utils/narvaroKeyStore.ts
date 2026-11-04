/**
 * "Kom ihåg på den här enheten": nyckeln till Närvarorutorna sparas i
 * IndexedDB, så att lösenfrasen inte behöver skrivas in varje gång.
 *
 * Det som sparas är själva CryptoKey-objektet, skapat som icke-exporterbart.
 * Webbläsaren kan använda det men inte lämna ut nyckelns bytes, så den går
 * inte att läsa ut med skript. Lösenfrasen sparas aldrig.
 *
 * Nyckeln sparas per användare. Går IndexedDB inte att använda (privat
 * fönster, blockerad lagring) fungerar allt ändå; frasen får bara skrivas in
 * igen nästa gång.
 */

const DB_NAME = 'narvaro';
const STORE = 'keys';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB saknas')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function rememberKey(userId: string, key: CryptoKey): Promise<void> {
  try {
    await run('readwrite', s => s.put(key, userId));
  } catch (error) {
    console.warn('Närvaro: kunde inte spara nyckeln på enheten.', error);
  }
}

export async function recallKey(userId: string): Promise<CryptoKey | null> {
  try {
    const key = await run<unknown>('readonly', s => s.get(userId));
    return key instanceof CryptoKey ? key : null;
  } catch {
    return null;
  }
}

export async function forgetKey(userId: string): Promise<void> {
  try {
    await run('readwrite', s => s.delete(userId));
  } catch {
    /* finns inget att glömma */
  }
}
