import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('worker image rejects a changed Blender archive before extraction',()=>{
  const result=spawnSync('python3',['workers/room_studio/test_worker_image.py'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
  assert.match(result.stderr,/Ran 1 test/);
});
