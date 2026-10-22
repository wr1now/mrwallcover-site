import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fixtureRevision } from '../src/room-studio/fixtures.ts';
import { compileRoom } from '../src/room-studio/geometry.ts';
import { validateProject } from '../src/room-studio/validation.ts';
import { isProject } from '../src/room-studio/storage.ts';
import type { ArtworkFinish } from '../src/room-studio/types.ts';

test('optional illustrative response survives portable snapshots without changing default materials or geometry', () => {
  const revision = fixtureRevision(), baseline = compileRoom(revision);
  assert.ok(baseline.materials.every(material => !Object.hasOwn(material, 'appearance')));
  const artwork = revision.project.finishes[0] as ArtworkFinish;
  artwork.appearance = { roughness: .42, metalness: .7 };
  const imported = JSON.parse(JSON.stringify(revision));
  assert.ok(isProject(imported.project)); assert.deepEqual(validateProject(imported.project), []);
  const compiled = compileRoom(imported), material = compiled.materials.find(m => m.id === artwork.id)!;
  assert.deepEqual(material.appearance, artwork.appearance);
  assert.equal(material.roughness, .88, 'The pre-existing default remains the fallback');
  assert.deepEqual(compiled.meshes, baseline.meshes, 'Scalar response never changes physical surfaces or UVs');
  assert.deepEqual(compiled.materials.filter(m => m.id !== artwork.id), baseline.materials.filter(m => m.id !== artwork.id));
  material.appearance!.metalness = 0;
  assert.equal(artwork.appearance.metalness, .7, 'Compiled controls are detached from the immutable snapshot');
  delete artwork.appearance;
  assert.deepEqual(compileRoom(revision), baseline, 'Removing the optional controls restores the original package exactly');
});

test('illustrative response is a closed, finite range-checked artwork-only contract including saved schemes', () => {
  const invalid: unknown[] = [null, [], true, 1, {}, { roughness: .5 }, { roughness: .5, metalness: null },
    { roughness: NaN, metalness: .5 }, { roughness: .5, metalness: Infinity },
    { roughness: -.01, metalness: .5 }, { roughness: .5, metalness: 1.01 },
    { roughness: .5, metalness: .5, normalMap: 'https://example.test/map.png' }];
  for (const value of invalid) {
    const revision = fixtureRevision(); (revision.project.finishes[0] as any).appearance = value;
    assert.ok(validateProject(revision.project).some(issue => issue.path === 'finishes.0.appearance'), JSON.stringify(value));
  }
  for (const value of [{ roughness: 0, metalness: 1 }, { roughness: 1, metalness: 0 }]) {
    const revision = fixtureRevision(); (revision.project.finishes[0] as ArtworkFinish).appearance = value;
    assert.deepEqual(validateProject(revision.project), []);
  }
  const revision = fixtureRevision(), project = revision.project;
  (project.finishes.find(f => f.type === 'paint') as any).appearance = { roughness: .5, metalness: .5 };
  assert.ok(validateProject(project).some(issue => /unsupported fields/.test(issue.message)));
  delete (project.finishes.find(f => f.type === 'paint') as any).appearance;
  project.schemes = [{ id: 'saved-metal', name: 'Illustrative response', finishes: structuredClone(project.finishes), assignments: structuredClone(project.assignments) }];
  (project.schemes[0].finishes[0] as any).appearance = { roughness: .5, metalness: -1 };
  assert.ok(validateProject(project).some(issue => issue.path === 'schemes.0.finishes.0.appearance'));
});

test('optional parametric relief accepts only bounded supported profiles and remains detached in compiled metadata', () => {
  const invalid: unknown[] = [null, [], {}, { kind: 'coffered', depthMm: 1, columns: 2 },
    { kind: 'scanned', depthMm: 1, columns: 2, rows: 2 },
    { kind: 'faceted', depthMm: .09, columns: 2, rows: 2 },
    { kind: 'faceted', depthMm: 20.01, columns: 2, rows: 2 },
    { kind: 'faceted', depthMm: Infinity, columns: 2, rows: 2 },
    { kind: 'coffered', depthMm: 1, columns: 2.5, rows: 2 },
    { kind: 'coffered', depthMm: 1, columns: 0, rows: 2 },
    { kind: 'coffered', depthMm: 1, columns: 2, rows: 25 },
    { kind: 'coffered', depthMm: 1, columns: 2, rows: 2, measured: true }];
  for (const relief of invalid) {
    const revision = fixtureRevision(); (revision.project.finishes[0] as any).appearance = { roughness: .5, metalness: 0, relief };
    assert.ok(validateProject(revision.project).some(issue => issue.path === 'finishes.0.appearance.relief'), JSON.stringify(relief));
  }
  for (const relief of [{ kind: 'coffered' as const, depthMm: .1, columns: 1, rows: 1 }, { kind: 'faceted' as const, depthMm: 20, columns: 24, rows: 24 }]) {
    const revision = fixtureRevision(), artwork = revision.project.finishes[0] as ArtworkFinish;
    artwork.appearance = { roughness: .5, metalness: 0, relief };
    artwork.calibration.widthMm = artwork.calibration.heightMm = 30000;
    assert.deepEqual(validateProject(revision.project), []);
    const compiled = compileRoom(revision).materials.find(m => m.id === artwork.id)!;
    assert.deepEqual(compiled.appearance, artwork.appearance);
    assert.notEqual(compiled.appearance!.relief, relief);
  }
});

test('the offline worker validates the same appearance bounds and never treats relief metadata as another mesh deformation', () => {
  const valid = compileRoom(fixtureRevision()), artwork = valid.materials.find(m => m.type === 'wallpaper')!;
  artwork.appearance = { roughness: .42, metalness: .7, relief: { kind: 'faceted', depthMm: 1.2, columns: 4, rows: 3 } };
  const invalid = [null, {}, { roughness: .5, metalness: true }, { roughness: -1, metalness: 0 }, { roughness: .5, metalness: 2 },
    { roughness: .5, metalness: .5, external: 'map' },
    ...[null, { kind: 'unknown', depthMm: 1, columns: 2, rows: 2 }, { kind: 'faceted', depthMm: 0, columns: 2, rows: 2 }, { kind: 'faceted', depthMm: 1, columns: true, rows: 2 }, { kind: 'faceted', depthMm: 1, columns: 2, rows: 25 }, { kind: 'faceted', depthMm: 1, columns: 2, rows: 2, measured: true }].map(relief => ({ roughness: .5, metalness: 0, relief }))];
  const script = `import copy,importlib.util,json,sys\ns=importlib.util.spec_from_file_location('renderer',${JSON.stringify(resolve('workers/room_studio/render.py'))});r=importlib.util.module_from_spec(s);s.loader.exec_module(r)\np,invalid=json.load(sys.stdin)\nbefore=copy.deepcopy(p['meshes']);r.validate_package(p);assert p['meshes']==before\nfor value in invalid:\n q=copy.deepcopy(p);next(m for m in q['materials'] if m['type']=='wallpaper')['appearance']=value\n try:r.validate_package(q)\n except ValueError:pass\n else:raise AssertionError('Invalid appearance accepted: '+repr(value))\nq=copy.deepcopy(p);q['materials'][0]['appearance']={'roughness':.5,'metalness':.5}\ntry:r.validate_package(q)\nexcept ValueError:pass\nelse:raise AssertionError('Non-artwork appearance accepted')\nprint('APPEARANCE_VALIDATED')\n`;
  const result = spawnSync('python3', ['-c', script], { input: JSON.stringify([valid, invalid]), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /APPEARANCE_VALIDATED/);
});

test('Blender shaders use optional illustrative scalars and keep the original fallback', { skip: !process.env.BLENDER_BIN }, t => {
  const folder = mkdtempSync(join(tmpdir(), 'room-studio-appearance-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const scriptPath = join(folder, 'check.py');
  writeFileSync(scriptPath, `import bpy,importlib.util\nfrom pathlib import Path\ns=importlib.util.spec_from_file_location('renderer',${JSON.stringify(resolve('workers/room_studio/render.py'))});r=importlib.util.module_from_spec(s);s.loader.exec_module(r)\nbase={'id':'illustrative','type':'wallpaper','colour':'#c6a15c','roughness':.88}\nfor appearance,expected in [(None,(.88,0)),({'roughness':.42,'metalness':.7},(.42,.7))]:\n data=dict(base)\n if appearance is not None:data['appearance']=appearance\n material=r._material(bpy,data,{},Path('.'),Path('.'));node=material.node_tree.nodes.get('Principled BSDF')\n assert abs(node.inputs['Roughness'].default_value-expected[0])<.000001\n assert abs(node.inputs['Metallic'].default_value-expected[1])<.000001\n assert not any(link.to_socket.name in ('Normal','Displacement') for link in material.node_tree.links)\nprint('ILLUSTRATIVE_SHADER_OK')\n`);
  const result = spawnSync(process.env.BLENDER_BIN!, ['-b', '--python-exit-code', '1', '--python', scriptPath], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr + result.stdout); assert.match(result.stdout, /ILLUSTRATIVE_SHADER_OK/);
});

test('Blender verifies actual angled coffered meshes, custom corner normals and winding without changing flat defaults', { skip: !process.env.BLENDER_BIN }, t => {
  const folder = mkdtempSync(join(tmpdir(), 'room-studio-relief-normals-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const packagePath = join(folder, 'package.json'), scriptPath = join(folder, 'check.py'), revision = fixtureRevision('angled');
  const artwork = revision.project.finishes[0] as ArtworkFinish;
  artwork.calibration.widthMm = 3690; artwork.calibration.heightMm = 2300;
  artwork.appearance = { roughness: .82, metalness: 0, relief: { kind: 'coffered', depthMm: 8, columns: 9, rows: 5 } };
  revision.project.assignments.forEach(assignment => assignment.finishId = artwork.id);
  const compiled = compileRoom(revision); writeFileSync(packagePath, JSON.stringify(compiled));
  assert.ok(compiled.meshes.reduce((sum, mesh) => sum + mesh.positions.length / 3, 0) > 30000);
  writeFileSync(scriptPath, `import bpy,copy,importlib.util,json\ns=importlib.util.spec_from_file_location('renderer',${JSON.stringify(resolve('workers/room_studio/render.py'))});r=importlib.util.module_from_spec(s);s.loader.exec_module(r)\np=json.load(open(${JSON.stringify(packagePath)}));r.validate_package(p);custom=0;chosen=None\nfor item in p['meshes']:\n vertices=[r.blender_point(item['positions'][i:i+3]) for i in range(0,len(item['positions']),3)]\n faces=[item['indices'][i:i+3] for i in range(0,len(item['indices']),3)]\n mesh=bpy.data.meshes.new(item['id']);mesh.from_pydata(vertices,[],faces);mesh.update();layer=mesh.uv_layers.new(name='RoomStudioUV')\n for polygon in mesh.polygons:\n  for loop_index in polygon.loop_indices:\n   vertex=mesh.loops[loop_index].vertex_index;layer.data[loop_index].uv=item['uvs'][vertex*2:vertex*2+2]\n r._apply_compiled_normals(mesh,item);r._verify_compiled_mesh(mesh,item)\n if item['id']=='room-floor':assert not mesh.has_custom_normals\n if mesh.has_custom_normals:custom+=1;chosen=(mesh,item)\nassert custom>0\nmesh,item=chosen;bad=copy.deepcopy(item);bad['normals'][0:3]=[-v for v in bad['normals'][0:3]]\ntry:r._verify_compiled_mesh(mesh,bad)\nexcept ValueError:pass\nelse:raise AssertionError('Incorrect corner normal passed verification')\nprint('ACTUAL_RELIEF_NORMALS_OK',custom)\n`);
  const result = spawnSync(process.env.BLENDER_BIN!, ['-b', '--python-exit-code', '1', '--python', scriptPath], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr + result.stdout); assert.match(result.stdout, /ACTUAL_RELIEF_NORMALS_OK/);
});
