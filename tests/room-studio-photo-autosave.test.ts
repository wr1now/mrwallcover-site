import test from 'node:test';
import assert from 'node:assert/strict';
import { PhotoDraftAutosave } from '../src/room-studio/photo-autosave.ts';
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

test('deleting during the photo debounce cancels the pending write permanently', async () => {
  let stored: string | undefined = 'original'; const operations: string[] = [];
  const writer = new PhotoDraftAutosave<string>(async value => { operations.push(`write:${value}`); stored = value; }, async () => { await delay(20); operations.push('delete'); stored = undefined; }, 5);
  writer.schedule('last edit', () => {}, () => {}); const deletion = writer.delete(); assert.equal(writer.deleting, true); await deletion; await delay(20);
  assert.equal(stored, undefined); assert.deepEqual(operations, ['delete']); writer.dispose();
});
test('deletion drains an in-flight write before erasure and rejects intervening autosaves', async () => {
  const started = deferred(), finish = deferred(), operations: string[] = []; let stored: string | undefined;
  const writer = new PhotoDraftAutosave<string>(async value => { operations.push(`start:${value}`); started.resolve(); await finish.promise; stored = value; operations.push(`finish:${value}`); }, async () => { stored = undefined; operations.push('delete'); }, 1);
  writer.schedule('in flight', () => operations.push('saved notification'), () => {}); await started.promise;
  writer.schedule('pending second write', () => {}, () => {}); const deletion = writer.delete();
  assert.equal(writer.schedule('edit during deletion', () => {}, () => {}), false); assert.equal(writer.delete(), deletion);
  await delay(10); assert.deepEqual(operations, ['start:in flight']); finish.resolve(); await deletion; await delay(10);
  assert.equal(stored, undefined); assert.deepEqual(operations, ['start:in flight', 'finish:in flight', 'delete']); writer.dispose();
});
test('after successful deletion, only an explicitly new draft can resume saving', async () => {
  let stored: string | undefined = 'old'; const saved = deferred();
  const writer = new PhotoDraftAutosave<string>(async value => { stored = value; }, async () => { stored = undefined; }, 1);
  writer.schedule('cancelled draft', () => {}, () => {}); await writer.delete(); await delay(10); assert.equal(stored, undefined);
  writer.schedule('new photograph', saved.resolve, () => {}); await saved.promise; assert.equal(stored, 'new photograph'); writer.dispose();
});
test('failed writes do not prevent deletion, and failed deletion does not report success', async () => {
  const failed = deferred(); let removed = 0;
  const writer = new PhotoDraftAutosave<string>(async () => { throw new Error('storage write interrupted'); }, async () => { removed++; }, 1);
  writer.schedule('photo', () => assert.fail('failed write reported success'), failed.resolve); await failed.promise; await writer.delete(); assert.equal(removed, 1); writer.dispose();
  const failedDelete = new PhotoDraftAutosave<string>(async () => {}, async () => { throw new Error('database unavailable'); }, 1);
  await assert.rejects(failedDelete.delete(), /database unavailable/); assert.equal(failedDelete.deleting, false); failedDelete.dispose();
});
test('disposing a photo workspace cancels its delayed save', async () => {
  let writes = 0; const writer = new PhotoDraftAutosave<string>(async () => { writes++; }, async () => {}, 5);
  writer.schedule('old photo', () => {}, () => {}); writer.dispose(); await delay(20); assert.equal(writes, 0); assert.equal(writer.schedule('late callback', () => {}, () => {}), false);
});
