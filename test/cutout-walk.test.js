import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compilePoses, expandPoses } from '../src/authoring.js';
import { renderProject, buildAtlas } from '../src/core.js';
import { inspectMotion } from '../src/motion.js';
import { importCutoutPNG } from '../src/cutout-import.js';
import { encodePNG } from '../src/png.js';
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

test('motion review catches a detached boot, clipped stride and sliding contact and accepts a repaired joint', () => {
  const width = 7, height = 5, bytes = new Uint8Array(width*height*4);
  for (const [y,row] of ['.......','..###..','.#####.','..#.#..','..#.#..'].entries())
    for (let x = 0; x < width; x++) if (row[x] === '#') bytes.set([16,32,48,255], 4*(y*width+x));
  const png = encodePNG(bytes,width,height);
  const view = { feet: [[2,3,1,2],[4,3,1,2]], stride: 2, mirror: true };
  const review = (cutout, speed) => {
    const { source } = importCutoutPNG(png, { cutout });
    const { recipe, metadata } = compilePoses(source);
    return inspectMotion(renderProject(recipe), { animation: 'walk-right', metadata, speed }).motion.cutout;
  };
  const broken = review({ margin: 0, views: { right: { ...view, stride: 5 } } }, 70);
  assert.ok(broken.clipped.length > 0);
  assert.ok(broken.slide.some(s => s.pixels > 1));
  const separated = review({ views: { right: view } }, 10);
  assert.ok(separated.separated.length > 0);
  const repaired = review({ views: { right: { ...view, overlap: [[2,3,3,1]] } } }, 10);
  assert.deepEqual(repaired.separated, []);
  assert.deepEqual(repaired.clipped, []);
  assert.ok(repaired.slide.every(s => s.pixels === 0));
  assert.equal(repaired.profile.exactMirror, true);
});

for (const [name, png] of [['dwarf','dwarf_f_idle_anim_f0.png'],['demon','big_demon_idle_anim_f0.png']]) {
  test(name + ': both visible feet stay edge-connected in every walk frame', async () => {
    const sample = new URL('../showcase/cutout-walks/', import.meta.url);
    const json = async file => JSON.parse(await readFile(new URL(file, sample), 'utf8'));
    const views = buildAtlas(renderProject(await json(name + '.views.pixel.json')));
    const cutout = await json(name + '.cuts.json');
    const { source } = importCutoutPNG(encodePNG(views.data, views.width, views.height), { atlas: views.metadata, cutout });
    const { recipe, metadata } = compilePoses(source), project = renderProject(recipe, { owners: true });
    const original = decodePNG(await readFile(new URL('sources/' + png, sample)));
    const stand = project.frames.find(f => f.name === 'stand-down');
    for (let y = 0; y < original.height; y++) {
      const start = 4*((y+4)*project.width+4);
      assert.deepEqual([...stand.data.slice(start,start+4*original.width)], [...original.data.slice(4*y*original.width,4*(y+1)*original.width)]);
    }
    for (const direction of ['up','down','left','right']) {
      const view = inspectMotion(project, { animation: 'walk-' + direction, metadata });
      assert.equal(view.cells.length, 8);
      const report = view.motion.cutout;
      assert.deepEqual(report.separated, []);
      assert.deepEqual(report.clipped, []);
      assert.equal(report.footJoints.length, 2);
      for (const joint of report.footJoints) assert.ok(joint.minimumEdgePixels >= 2, direction + '/' + joint.foot);
      if (report.profile) assert.equal(report.profile.exactMirror, name === 'demon');
    }
  });
}

test('a crossing boot can cover a sound joint, while a real air gap still needs repair', () => {
  const pose = (name, nearY, farX, farY) => ({ name, parts: [
    { name: 'body', part: 'coat', at: [2,1] },
    { name: 'far', part: 'wideBoot', at: [farX,farY] },
    { name: 'near', part: 'boot', at: [4,nearY] }
  ] });
  const steps = Array.from({ length: 8 }, (_, i) => pose('step-' + i, i === 1 ? 7 : 4, 3, 3));
  const source = { format: 'pixelforge-poses', version: 1, name: 'crossing', width: 12, height: 12,
    palette: { a: '#b44', b: '#222', c: '#3b3' }, parts: {
      coat: { rows: ['aaaaaaa','aaaaaaa','aaaaaaa'] }, wideBoot: { rows: ['bbbb','bbbb','bbbb','bbbb'] },
      boot: { rows: ['cc','cc','cc'] }
    }, poses: [pose('stand',4,7,4), ...steps], animations: { walk: { frames: steps.map(p => p.name) } },
    walkReview: { walk: { rest: 'stand', direction: 'right', feet: ['near','far'], speed: 5 } } };
  const { recipe, metadata } = compilePoses(source), project = renderProject(recipe, { owners: true });
  const options = { animation: 'walk', metadata };
  const visible = inspectMotion(project, options).motion.cutout.footJoints[0];
  assert.equal(visible.standingEdgePixels, 2);
  assert.ok(visible.weak.includes('step-0'));
  const joint = inspectMotion(project, options, recipe).motion.cutout.footJoints[0];
  assert.ok(joint.occluded.includes('step-0'));
  assert.deepEqual(joint.weak, ['step-1']);
  assert.equal(joint.minimumEdgePixels, 0);
});

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
