import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compilePoses, expandPoses } from '../src/authoring.js';
import { renderProject } from '../src/core.js';
import { decodePNG } from '../src/import.js';

const dir = new URL('../showcase/four-way-walk/', import.meta.url);
const character = async name => JSON.parse(await readFile(new URL(`${name}.poses.json`, dir), 'utf8'));

for (const name of ['mage', 'knight', 'ranger']) {
  test(`${name}: four cutout walks keep the standing drawing, timing, pivot and opposite side`, async () => {
    const source = await character(name), initial = structuredClone(source);
    const expanded = expandPoses(source);
    const direct = compilePoses(source);
    assert.deepEqual(compilePoses(expanded), direct);
    assert.deepEqual(source, initial);
    const project = renderProject(direct.recipe);
    const frames = new Map(project.frames.map(frame => [frame.name, frame]));
    const original = decodePNG(await readFile(new URL(`sources/${name}.png`, dir)));
    const front = frames.get('stand-down').data;
    for (let y = 0; y < 16; y++) {
      const start = ((y + 3) * 24 + 4) * 4;
      assert.deepEqual([...front.slice(start, start + 64)], [...original.data.slice(y * 64, (y + 1) * 64)]);
    }
    for (const direction of ['left', 'right', 'up', 'down']) {
      const clip = direct.recipe.animations[`walk-${direction}`];
      assert.equal(clip.frames.length, 8);
      assert.equal(clip.loop, true);
      const drawings = new Set(clip.frames.map(key => Buffer.from(frames.get(key).data).toString('hex')));
      assert.ok(drawings.size >= 4);
      for (const key of clip.frames) assert.equal(frames.get(key).duration, source.walkCycles['walk-down'].duration);
    }
    assert.deepEqual(direct.recipe.anchor, [12, 19]);
    for (let i = 1; i <= 8; i++) {
      const left = Buffer.from(frames.get(`walk-left-${i}`).data), right = Buffer.from(frames.get(`walk-right-${i}`).data);
      for (let y = 0; y < project.height; y++) for (let x = 0; x < project.width; x++) {
        const a = 4 * (y * project.width + x), b = 4 * (y * project.width + project.width - 1 - x);
        assert.equal(left.readUInt32BE(a), right.readUInt32BE(b));
      }
    }
  });
}

test('cutout roles, name collisions and supported mirroring report the authoring field', async () => {
  const source = await character('mage');
  const invalid = (edit, path) => {
    const copy = structuredClone(source);
    edit(copy);
    assert.throws(() => compilePoses(copy), err => err.path === path);
  };
  invalid(s => { s.walkCycles['walk-up'].feet = ['boot-a', 'boot-a']; }, 'poses.walkCycles.walk-up.feet[1]');
  invalid(s => { s.walkCycles['walk-right'].arms[0] = 'missing'; }, 'poses.walkCycles.walk-right.arms[0]');
  invalid(s => { s.walkCycles['walk-right'].mirrorAs = 'stand-left'; }, 'poses.walkCycles.walk-right');
  invalid(s => { s.walkCycles['walk-down'].mirrorAs = 'walk-up'; }, 'poses.walkCycles.walk-down.mirrorAs');
  invalid(s => { s.walkCycles['walk-right'].duration = 0; }, 'poses.walkCycles.walk-right.duration');
});

test('a mirrored walk reports an unusable pivot and accepts an off-centre interior pivot', async () => {
  const source = await character('knight');
  const rest = source.poses.find(p => p.name === 'stand-right');
  for (const x of [undefined, 0, source.width, source.width + 1]) {
    if (x === undefined) delete rest.origin;
    else rest.origin = [x, 19];
    assert.throws(() => expandPoses(source), err =>
      err.path === 'poses.walkCycles.walk-right.mirrorAs' && /root part's at/.test(err.message));
  }
  rest.origin = [11, 19];
  const project = renderProject(compilePoses(source).recipe);
  const right = project.frames.find(f => f.name === 'walk-right-1');
  const left = project.frames.find(f => f.name === 'walk-left-1');
  assert.deepEqual(left.anchor, [11, 19]);
  let ink = 0;
  for (let y = 0; y < project.height; y++) for (let x = 0; x < project.width; x++) {
    const alpha = right.data[(y * project.width + x) * 4 + 3];
    if (!alpha) continue;
    ink++;
    assert.equal(left.data[(y * project.width + 21 - x) * 4 + 3], alpha);
  }
  assert.ok(ink > 0);
});
