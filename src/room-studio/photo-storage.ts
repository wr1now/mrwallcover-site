import type { PhotoProject } from './photo-types.ts';
const NAME = 'mrwallcover-photo-studio-v1';
async function access<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new Error('Local photo saving is unavailable. Download the editable project before closing.')); });
  return new Promise((resolve, reject) => { const tx = db.transaction('drafts', mode), r = callback(tx.objectStore('drafts')); tx.oncomplete = () => { db.close(); resolve(r.result as T); }; tx.onerror = tx.onabort = () => { db.close(); reject(new Error('This photo could not be saved locally. Download an editable copy.')); }; });
}
export const loadPhotoDraft = () => access<PhotoProject | undefined>('readonly', s => s.get('current'));
export const savePhotoDraft = (p: PhotoProject) => access('readwrite', s => s.put(p, 'current'));
export const deletePhotoDraft = () => access('readwrite', s => s.delete('current'));
