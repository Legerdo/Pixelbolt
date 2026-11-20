import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { goldens } from '../scripts/goldens.mjs';
import { renderProject } from '../src/core.js';
import { readFile } from 'node:fs/promises';
import { compileStack, prepareStack, stackSide } from '../src/stack.js';
import { prepareScene, renderScene } from '../src/scene.js';
import { createSceneBundle } from '../src/scene-export.js';
import { cosDeg } from '../src/craft.js';

const golden = goldens(new URL('./goldens/stack.json', import.meta.url));
const block = {
  format: 'pixelforge-stack', version: 1, name: 'block', palette: { k: '#111', s: '#fff' },
  slices: [['kkk', 'kkk', 'kkk'], ['kkk', 'kkk', 'kkk']], headings: [0, 90, 180, 270]
};
const grid = (source, heading) => compileStack(source).recipe.frames.find(f => f.name === `heading-${heading}`).ops[0].rows;

test('each painted side is visible from its own heading and fully hidden edge-on and behind', () => {
  for (const [face, angle] of [['south', 0], ['east', 90], ['north', 180], ['west', 270]]) {
    const source = { ...block, paint: [{ face, rows: ['sss', 'sss'] }] };
    assert.deepEqual(stackSide(source, face), ['sss', 'sss']);
    for (const frame of compileStack(source).recipe.frames) {
      const silver = frame.ops[0].rows.join('').split('s').length - 1;
      assert.equal(silver, frame.name === `heading-${angle}` ? 96 : 0, `${face}, ${frame.name}`);
    }
  }
});

test('paint depth colours connected solid cells and stops at air', () => {
  const marker = { face: 'west', rows: ['s'], depth: 6 };
  const model = { ...block, slices: [['kk.kk']], paint: [marker] };
  assert.deepEqual(stackSide(model, 'south'), ['ss.kk']);
  assert.deepEqual(stackSide(model, 'east'), ['k']);
  assert.deepEqual(stackSide({ ...model, paint: [{ ...marker, depth: 0 }] }, 'south'), ['kk.kk']);
  assert.deepEqual(stackSide({ ...model, paint: [marker, { face:'west', rows:['k'] }] }, 'west'), ['k']);
});

test('named decals mirror independently and erasing peels one stroke per cell', () => {
  const source = { ...block, decals: { rim: ['s..', '.s.'] }, paint: [
    { face: 'north', decal: 'rim' }, { face: 'south', decal: 'rim', flipX: true, flipY: true }
  ] };
  assert.deepEqual(stackSide(source, 'north'), ['skk','ksk']);
  assert.deepEqual(stackSide(source, 'south'), ['ksk','kks']);
  source.paint.push({ face:'south', at:[1,0], rows:['kk'], depth:3 }, { face:'south', at:[1,0], erase:['x.'] });
  assert.deepEqual(stackSide(source, 'south'), ['ksk','kks']);
  source.paint.push({ face:'south', at:[1,0], erase:['x.'] });
  assert.deepEqual(stackSide(source, 'south'), ['kkk','kks']);
  assert.deepEqual(stackSide(source, 'north'), ['skk','ksk']);
  assert.deepEqual(source.decals.rim, ['s..','.s.']);
  const deep = { ...block, slices:[['kkk']], paint:[{ face:'west', rows:['s'], depth:3 }, { face:'west', erase:['x'] }] };
  assert.deepEqual(stackSide(deep,'south'), ['kkk']);
  for (const place of [{ decal:'missing' }, { rows:['s'], decal:'rim' }, { erase:['s'] },
    { erase:['x'], depth:1 }, { rows:['s'], flipX:false }, { decal:'rim', flipY:2 }, { decal:'rim', flipX:null }]) {
    assert.throws(() => compileStack({ ...source, paint:[{ face:'south', ...place }] }), /stack.paint/);
  }
});

test('an isolated heading and pinned detail match the full turn, including occlusion and padding', () => {
  for (const projection of ['iso','oblique']) {
    const model = prepareStack({ ...block, projection, pivot:[0,2], spacing:2, headings:[359,0,1,90,135],
      paint:[{ face:'south', at:[0,1], rows:['sss'] }] });
    const first = model.recipe(3), full = model.recipe();
    assert.deepEqual(first.anchor, full.anchor);
    assert.deepEqual(first.frames, [full.frames[3]]);
    assert.equal(model.detail('south', [0,2], 0), null);
    for (const [i, heading] of model.metadata.headings.entries()) for (const face of ['north','south','west','east']) {
      const { left, top, rows } = model.detail(face,[0,1],heading,17);
      const whole = full.frames[i].ops[0].rows;
      rows.forEach((row,y) => assert.equal(row,
        Array.from({length:17}, (_,x) => whole[top+y]?.[left+x] ?? '.').join(''), `${projection} ${face} ${heading}°`));
    }
  }
});

test('4× is the native projection default; iso zero follows the 2:1 diagonal', () => {
  const source = { ...block, headings: [0], projection: 'iso' };
  const iso = compileStack(source).recipe, rows = iso.frames[0].ops[0].rows;
  assert.deepEqual(rows, grid({ ...block, headings: [45], squash: .5, resolution: 4 }, 45));
  assert.deepEqual(iso, compileStack({ ...source, resolution: 4 }).recipe);
  // Distinct boundaries within four output scanlines cannot come from repeating low-res pixels.
  assert.ok(new Set(rows.slice(0, 4)).size > 1);
  assert.ok(iso.width > compileStack({ ...source, resolution: 1 }).recipe.width * 2);
  const colours = new Set(rows.join(''));
  assert.deepEqual(colours, new Set(['.', 'k']));
});

test('CLI inspection of a pinned stack cell renders intermediate headings and reports an empty pin', () => {
  const inspect = pin => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../bin/pixelbolt.js', import.meta.url)),
      'inspect', '-', '--pin', pin, '--grid'], { input:JSON.stringify(block), encoding:'utf8' });
    return JSON.parse(result.stdout || result.stderr);
  };
  const review = inspect('south,1,0,0');
  assert.equal(review.ok, true);
  assert.deepEqual([review.width, review.height, review.frames], [36,36,5]);
  assert.deepEqual(review.grids.map(grid => grid.frame), ['heading-358','heading-359','heading-0','heading-1','heading-2']);
  assert.match(inspect('south,100,0,0').error, /solid cell/);
});

test('invalid sources and excessive projections are refused before drawing', () => {
  for (const [change, field] of [
    [{ resolution: 1.5 }, 'resolution'], [{ projection: 'iso', squash: 1 }, 'squash'],
    [{ headings: [0, 0] }, 'headings'], [{ pivot: [3,0] }, 'pivot'],
    [{ palette: { k: '#1117' } }, 'palette'], [{ slices: [['k'], ['kk']] }, 'slices'], [{ decals:null }, 'decals'],
    [{ paint: [{ face:'north', at:[1,1], rows:['sss'] }] }, 'paint'],
    [{ resolution:8, slices:[Array(128).fill('k'.repeat(128))] }, 'resolution'],
    [{ name:'CON' }, 'name']
  ]) assert.throws(() => compileStack({ ...block, ...change }), new RegExp(field));
  assert.throws(() => compileStack(block, { maxPixels: 10 }), /scene asset pixel budget/);
});

// Count contiguous silver regions in the actual exported wheel artwork. Measure area as well:
// a detached fleck or a missing section on a grazing sidewall would pass a frame-count check.
function silverAreas(rows) {
  const width = rows[0].length, cells = Uint8Array.from(rows.join(''), key => Number('mcl'.includes(key)));
  const sizes = [];
  for (let at = 0; at < cells.length; at++) {
    if (!cells[at]) continue;
    let area = 0;
    const pending = [at]; cells[at] = 0;
    while (pending.length) {
      const i = pending.pop(); area++;
      const adjacent = [i - width, i + width];
      if (i % width) adjacent.push(i - 1);
      if (i % width < width - 1) adjacent.push(i + 1);
      for (const j of adjacent) if (cells[j]) { cells[j] = 0; pending.push(j); }
    }
    sizes.push(area);
  }
  return sizes;
}

golden.test('Copper Rally keeps two connected silver rims throughout the turn, with neither visible end-on', async () => {
  const car = JSON.parse(await readFile(new URL('../examples/copper-rally.stack.json', import.meta.url), 'utf8'));
  assert.equal(car.paint.filter(place => place.decal === 'hub').length, 4);
  const { recipe } = compileStack(car);
  assert.deepEqual([recipe.width, recipe.height, recipe.frames.length], [250,210,60]);
  const pixels = createHash('sha256');
  for (const frame of renderProject(recipe).frames) pixels.update(frame.data);
  golden.equal('copper-rally', pixels.digest('hex'), { recipe });
  const areas = new Map(recipe.frames.map(frame => [Number(frame.name.slice(8)), silverAreas(frame.ops[0].rows)]));
  const side = areas.get(0)[0];
  assert.ok(side > 400);
  for (const [angle, sizes] of areas) {
    if (angle === 90 || angle === 270) { assert.deepEqual(sizes, []); continue; }
    assert.equal(sizes.length, 2, `rim fragments at ${angle}°: ${sizes}`);
    const projected = side * Math.abs(cosDeg(angle));
    for (const size of sizes) assert.ok(Math.abs(size - projected) <= 24, `${angle}°: ${size} vs ${projected}`);
  }
});

test('scene placements share the pivot, occlude as whole sprites, and retain the editable source on export', async () => {
  const scene = { format: 'pixelforge-scene', version:1, name:'overlap', width:48, height:48,
    assets:{ front:{ recipe:{ ...block, projection:'iso' } }, other:block },
    instances:[{ name:'first', asset:'front', at:[24,24], frame:'heading-90' }, { name:'second', asset:'other', at:[24,22] }] };
  for (const y of [22,26]) {
    scene.instances[1].at[1] = y;
    const prepared = prepareScene(scene), { depth } = renderScene(prepared, { depth:true });
    assert.deepEqual(prepared.instances.map(i => [i.anchor,i.sort]), [['frame','ground'],['frame','ground']]);
    assert.equal(depth.overlaps.length, 1);
    assert.equal(depth.overlaps[0].front, y > 24 ? 'second' : 'first');
    assert.ok(depth.overlaps[0].pixels > 0);
    assert.deepEqual(prepared.source, scene);
  }
  const { files } = await createSceneBundle(scene);
  assert.deepEqual(JSON.parse(files.get('scene.json')), scene);
  assert.ok(files.has('scene.tmx') && files.has('scene.tscn') && files.has('assets/0/color.png'));
});
