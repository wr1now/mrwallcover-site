import type { RoomProject, RoomRevision } from './types.ts';
const NAME = 'mrwallcover-room-studio-v1';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('drafts'); request.result.createObjectStore('revisions', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local storage is unavailable. Download your room to keep a copy.'));
  });
}
async function access<T>(store: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode); const request = run(tx.objectStore(store));
    tx.oncomplete = () => { resolve(request.result as T); db.close(); };
    tx.onerror = tx.onabort = () => { reject(new Error('Your browser could not save this room. Download a copy before closing.')); db.close(); };
  });
}
export const loadDraft = () => access<RoomProject | undefined>('drafts', 'readonly', s => s.get('current'));
export const saveDraft = (p: RoomProject) => access('drafts', 'readwrite', s => s.put(p, 'current'));
export const deleteDraft = () => access('drafts', 'readwrite', s => s.delete('current'));
export const saveRevision = (r: RoomRevision) => access('revisions', 'readwrite', s => s.put(r));
export const localRevisions = () => access<RoomRevision[]>('revisions', 'readonly', s => s.getAll());
export async function deleteLocalData() {
  await new Promise<void>((resolve,reject) => { const r=indexedDB.deleteDatabase(NAME); r.onsuccess=()=>resolve(); r.onerror=r.onblocked=()=>reject(new Error('Close other Room Studio tabs and try again.')); });
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href=url; link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
/** Only our own closed data format is accepted; never execute anything in imports. */
export function isProject(value: unknown): value is RoomProject {
  const p = value as RoomProject;
  return Boolean(p && typeof p==='object' && p.schemaVersion===1 && typeof p.id==='string' && typeof p.name==='string' &&
    p.room && Array.isArray(p.room.vertices) && Array.isArray(p.room.openings) && Array.isArray(p.finishes) && Array.isArray(p.assignments) && Array.isArray(p.cameras) && Array.isArray(p.schemes));
}
