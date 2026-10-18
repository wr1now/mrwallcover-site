import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureArtwork, fixtureProject } from '../src/room-studio/fixtures.ts';
import { compileRoom } from '../src/room-studio/geometry.ts';
import { isBauwerkProductUrl, validateProject } from '../src/room-studio/validation.ts';
import type { RoomProject } from '../src/room-studio/types.ts';

function withScheme(): RoomProject {
  const project = fixtureProject();
  project.schemes = [{ id: 'saved-one', name: 'First combination', finishes: structuredClone(project.finishes), assignments: structuredClone(project.assignments) }];
  return project;
}

test('saved combinations are bounded, independently validated and excluded from rendered assets', () => {
  const project = withScheme(), unused = fixtureArtwork();
  unused.id = 'scheme-only-finish'; unused.texture.id = 'scheme-only-image';
  project.schemes[0].finishes.push(unused);
  project.schemes.push({ ...structuredClone(project.schemes[0]), id: 'saved-two' }, { ...structuredClone(project.schemes[0]), id: 'saved-three' });
  assert.deepEqual(validateProject(project), []);
  const pkg = compileRoom({ id: 'confirmed-fixture', projectId: project.id, number: project.revision, createdAt: project.updatedAt, project });
  assert.ok(!pkg.materials.some(m => m.id === unused.id));
  assert.ok(!pkg.textures.some(t => t.id === unused.texture.id));
  project.schemes.push({ ...structuredClone(project.schemes[0]), id: 'saved-four' });
  assert.ok(validateProject(project).some(i => i.path === 'schemes'));
});

test('malformed nested schemes never bypass checks when the active combination is valid', () => {
  const mutations: ((p: any) => void)[] = [
    p => { p.schemes[0] = null; },
    p => { p.schemes[0].name = 'x'.repeat(121); },
    p => { p.schemes.push(structuredClone(p.schemes[0])); },
    p => { p.schemes[0].finishes = [null]; },
    p => { p.schemes[0].finishes = Array.from({ length: 49 }, (_, i) => ({ id: `paint-${i}`, type: 'paint', name: 'Paint', colour: '#ffffff', sheen: 'matte' })); },
    p => { p.schemes[0].assignments[0].finishId = 'missing'; },
    p => { p.schemes[0].assignments[0].wallId = 'missing'; },
    p => { p.schemes[0].assignments[0].toMm = 9000; },
    p => { p.schemes[0].assignments.push({ ...p.schemes[0].assignments[0], id: 'overlap' }); },
    p => { p.schemes[0].assignments = Array.from({ length: 97 }, () => ({})); },
    p => { p.schemes[0].finishes[0].texture.sha256 = 'f'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const project = withScheme(); mutate(project);
    assert.ok(validateProject(project).some(i => i.path.startsWith('schemes.')), mutate.toString());
  }
});

test('Bauwerk provenance has bounded metadata and only official HTTPS product links', () => {
  assert.equal(isBauwerkProductUrl('https://www.bauwerkcolour.com/en-gb/product/olive-limewash-paint-colour'), true);
  const unsafe: unknown[] = ['javascript:alert(1)', 'data:text/html,test', '//www.bauwerkcolour.com/en-gb/product/olive', 'http://www.bauwerkcolour.com/en-gb/product/olive', 'https://www.bauwerkcolour.com.evil.test/en-gb/product/olive', 'https://www.bauwerkcolour.com@evil.test/en-gb/product/olive', 'https://www.bauwerkcolour.com/en-gb/product/olive?redirect=https://evil.test', 'https://www.bauwerkcolour.com/en-gb/product/../account', 'https://www.bauwerkcolour.com/en-gb/product/%2e%2e', null, {}, 1];
  for (const value of unsafe) {
    assert.equal(isBauwerkProductUrl(value), false);
    const project = withScheme(); (project.schemes[0].finishes[2] as any).productUrl = value;
    assert.ok(validateProject(project).some(i => i.path === 'schemes.0.finishes.2.productUrl'));
  }
  for (const [key, value] of Object.entries({ shadeId: '../shade', catalogueVersion: 'x'.repeat(121), colourProvenance: 'official-rgb-invented', seed: Number.MAX_SAFE_INTEGER })) {
    const project = fixtureProject(); (project.finishes[2] as any)[key] = value;
    assert.ok(validateProject(project).some(i => i.path === `finishes.2.${key}`));
  }
});

test('imported metadata, names, IDs, timestamps and artwork destinations form a closed contract', () => {
  const mutations: ((p: any) => void)[] = [
    p => { p.id = '../project'; }, p => { p.name = 'room\u0000name'; }, p => { p.name = ''; },
    p => { p.ownerId = {}; }, p => { p.revision = Number.MAX_SAFE_INTEGER + 1; },
    p => { p.updatedAt = '2026-02-30T00:00:00Z'; }, p => { p.updatedAt = 'tomorrow'; },
    p => { p.room.confirmed = 'yes'; }, p => { p.room.vertices[0].wallId = '../../wall'; },
    p => { p.room.openings[0].id = 'x'.repeat(101); },
    p => { p.cameras[1].id = p.cameras[0].id; }, p => { p.finishes[0].name = []; },
    p => { p.finishes[0].texture.dataUrl = 'https://evil.test/tracking.png'; },
    p => { p.finishes[0].texture.dataUrl = 'data:image/svg+xml;base64,PHN2Zz4='; },
    p => { p.finishes[0].texture.dataUrl = 'data:image/png;base64,invalid!'; },
    p => { p.finishes[0].texture.storagePath = 'https://evil.test/private.png'; },
    p => { p.finishes[0].texture.url = 'https://evil.test/private.png'; },
    p => { p.extra = { deeply: { nested: 'untrusted metadata' } }; },
  ];
  for (const mutate of mutations) {
    const project = fixtureProject(); mutate(project);
    assert.ok(validateProject(project).length, mutate.toString());
  }
  const project = fixtureProject(); project.updatedAt = '2026-10-18T12:00:00.000000+00:00';
  assert.deepEqual(validateProject(project), [], 'database ISO timestamps remain valid');
});

test('unexpected primitive collection values return validation issues instead of throwing', () => {
  for (const key of ['room', 'finishes', 'assignments', 'cameras', 'schemes']) {
    for (const value of [null, 42, 'invalid', [null]]) {
      const project = fixtureProject(); (project as any)[key] = value;
      assert.ok(validateProject(project).length, `${key}: ${JSON.stringify(value)}`);
    }
  }
});


test('imported murals cannot stretch the prepared crop', () => {
  const project = fixtureProject(), mural = project.finishes[0];
  assert.ok(mural.type === 'wallpaper'); mural.type = 'mural';
  mural.calibration.widthMm = 2000; mural.calibration.heightMm = 1000;
  assert.ok(validateProject(project).some(issue => /Mural dimensions/.test(issue.message)));
  mural.calibration.crop.width = .5; mural.calibration.crop.height = 1;
  mural.calibration.rotation = 90;
  assert.deepEqual(validateProject(project), []);
});
