import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
test('offline worker payment recovery and unpaid-render denial',()=>{
 const result=execFileSync('python3',['workers/room_studio/test_payments.py'],{cwd:new URL('..',import.meta.url),encoding:'utf8',stdio:'pipe'});
 assert.equal(result,'');
});
