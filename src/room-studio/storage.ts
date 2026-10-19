import { serializePortableJson } from './portable.ts';
import { validateProject } from './validation.ts';
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
/** Clone editable v1 data. Immutable historical revisions are never migrated or overwritten. */
export function migrateProject(project: RoomProject): RoomProject {
  if (!isProject(project)) throw new Error('Unsupported room document.');
  const issues = validateProject(project);
  if (issues.length) throw new Error(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
  return project.schemaVersion === 2 ? structuredClone(project) : { ...structuredClone(project), schemaVersion: 2 };
}
export async function backupImportedProject(project: RoomProject): Promise<void> {
  if (project.schemaVersion === 1) await access('drafts', 'readwrite', store => store.put(structuredClone(project), `backup-v1-${project.id}-${project.updatedAt}`));
}
export const localProjectBackups = () => access<RoomProject[]>('drafts', 'readonly', store => store.getAll(IDBKeyRange.bound('backup-v1-', 'backup-v1-\uffff')));
export async function loadDraft(): Promise<RoomProject | undefined> {
  const draft = await access<RoomProject | undefined>('drafts', 'readonly', store => store.get('current'));
  // Invalid recovery drafts must stay visible to the existing recovery UI.
  if (!draft || !isProject(draft) || validateProject(draft).length || draft.schemaVersion !== 1) return draft;
  await backupImportedProject(draft);
  return migrateProject(draft);
}
export const saveDraft = (p: RoomProject) => access('drafts', 'readwrite', s => s.put(p, 'current'));
export const deleteDraft = () => access('drafts', 'readwrite', s => s.delete('current'));
export const saveRevision = (r: RoomRevision) => access('revisions', 'readwrite', s => s.put(r));
export const localRevisions = () => access<RoomRevision[]>('revisions', 'readonly', s => s.getAll());
export async function deleteLocalData() {
  await new Promise<void>((resolve,reject) => { const r=indexedDB.deleteDatabase(NAME); r.onsuccess=()=>resolve(); r.onerror=r.onblocked=()=>reject(new Error('Close other Room Studio tabs and try again.')); });
}
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href=url; link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
export function downloadJson(value: unknown, name: string) {
  downloadBlob(new Blob([serializePortableJson(value)], { type: 'application/json' }), name);
}
export function downloadText(value: string, name: string) {
  downloadBlob(new Blob([value], { type: 'text/plain;charset=utf-8' }), name);
}
/** Only our own closed data format is accepted; never execute anything in imports. */
export function isProject(value: unknown): value is RoomProject {
  const p = value as RoomProject;
  return Boolean(p && typeof p==='object' && (p.schemaVersion===1 || p.schemaVersion===2) && typeof p.id==='string' && typeof p.name==='string' &&
    p.room && Array.isArray(p.room.vertices) && Array.isArray(p.room.openings) && Array.isArray(p.finishes) && Array.isArray(p.assignments) && Array.isArray(p.cameras) && Array.isArray(p.schemes));
}
