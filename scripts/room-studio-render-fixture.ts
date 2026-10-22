import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { compileRoom } from '../src/room-studio/geometry.ts';
import { fixtureRevision } from '../src/room-studio/fixtures.ts';

const args = process.argv.slice(2);
const value = (flag: string, fallback: string): string => {
  const index = args.indexOf(flag);
  if (index < 0) return fallback;
  const supplied = args[index + 1];
  if (!supplied || supplied.startsWith('--')) throw new Error(`Supply a value after ${flag}.`);
  return supplied;
};
const shape = value('--shape', 'rectangle') as NonNullable<Parameters<typeof fixtureRevision>[0]>;
if (!['rectangle', 'l-shape', 'lshape', 'angled'].includes(shape)) throw new Error('Choose rectangle, l-shape or angled.');
const output = resolve(value('--output-dir', '.tmp/room-studio-render'));
const packagePath = resolve(output, 'render-package.json');
await mkdir(output, { recursive: true });
const compiled = compileRoom(fixtureRevision(shape));
await writeFile(packagePath, JSON.stringify(compiled, null, 2));
console.log(`Compiled ${shape}: ${compiled.meshes.length} meshes. Package: ${packagePath}`);
if (!args.includes('--render')) {
  console.log('Add --render --blender /absolute/path/to/blender for a local Cycles check. Add --production for full-size outputs.');
} else {
  const executable = value('--blender', process.env.BLENDER_BIN || 'blender');
  const child = spawn(executable, ['-b', '--python-exit-code', '1', '--python', resolve('workers/room_studio/render.py'), '--', '--package', packagePath, '--output-dir', resolve(output, 'images'), '--quality', args.includes('--production') ? 'production' : 'fast'], { stdio: 'inherit' });
  child.on('error', error => { console.error(`Blender did not start: ${error.message}. Install Blender 4.5 LTS or set BLENDER_BIN.`); process.exitCode = 1; });
  await new Promise<void>(resolveExit => child.on('close', code => { if (code !== 0) process.exitCode = code ?? 1; resolveExit(); }));
}
