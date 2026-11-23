import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderProject } from '../src/core.js';
import { prepareScene, renderScene, scenePlanes, wholeDraws } from '../src/scene.js';
import { isoLayout } from '../src/autotile.js';

const schema = name => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const FACES = { t: '#ff0000', l: '#00ff00', r: '#0000ff', e: '#ffffff', k: '#202020' };
const boxes = (ops, width = 32, height = 32) => renderProject({ version: 1, name: 'boxes', width, height, palette: FACES, frames: [{ name: 'a', ops }] }).frames[0];
// Opaque pixels of each colour, and each row of a frame as a string of palette keys.
const counts = frame => {
  const byColour = {};
  for (let i = 0; i < frame.data.length; i += 4) if (frame.data[i + 3]) { const hex = `#${[0, 1, 2].map(c => frame.data[i + c].toString(16).padStart(2, '0')).join('')}`; byColour[hex] = (byColour[hex] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(FACES).map(([key, hex]) => [key, byColour[hex] ?? 0]));
};
const rows = (frame, width) => Array.from({ length: frame.data.length / 4 / width }, (_, y) => Array.from({ length: width }, (_, x) => {
  const at = (y * width + x) * 4;
  return frame.data[at + 3] ? Object.keys(FACES).find(key => FACES[key] === `#${[0, 1, 2].map(c => frame.data[at + c].toString(16).padStart(2, '0')).join('')}`) : '.';
}).join(''));

test('a flat box is the 2:1 diamond of its grid, two pixels wider each row', () => {
  const diamond = rows(boxes([{ op: 'box', w: 16, d: 16, top: 't' }], 32, 16), 32);
  const widths = diamond.map(row => row.replaceAll('.', '').length);
  assert.deepEqual(widths, [2, 6, 10, 14, 18, 22, 26, 30, 30, 26, 22, 18, 14, 10, 6, 2]);
  for (const row of diamond) assert.equal(row, [...row].reverse().join(''), 'each row is centred');
  // Diamonds on the grid's lattice ([16, 8] apart) cover the plane once: no gaps, no overlaps.
  const coverage = new Uint8Array(32 * 16);
  for (const [x, y] of [[0, 0], [16, 8], [-16, 8], [16, -8], [-16, -8], [0, 16], [0, -16]]) {
    const frame = boxes([{ op: 'box', x, y, w: 16, d: 16, top: 't' }], 32, 16);
    for (let i = 0; i < coverage.length; i++) coverage[i] += frame.data[i * 4 + 3] ? 1 : 0;
  }
  assert.ok(coverage.every(n => n === 1), 'every pixel belongs to exactly one diamond');
});

test('box faces each cover exactly their area, meet without overlap, and edges mark the front lines', () => {
  for (const [w, d, h] of [[16, 16, 16], [20, 12, 10], [2, 2, 1], [30, 6, 7]]) {
    const frame = boxes([{ op: 'box', w, d, h, top: 't', left: 'l', right: 'r' }], w + d, (w + d) / 2 + h);
    assert.deepEqual(counts(frame), { t: w * d, l: w * h, r: d * h, e: 0, k: 0 }, `${w}/${d}/${h}`);
  }
  const block = rows(boxes([{ op: 'box', w: 16, d: 16, h: 16, top: 't', left: 'l', right: 'r', edge: 'e' }]), 32);
  assert.equal(block[0], '...............tt...............');
  assert.equal(block[12], 'lllllllll' + 'ee' + 'tttttttttt' + 'ee' + 'rrrrrrrrr', 'the top face meets each side along a 2:1 edge line');
  assert.equal(block[15], 'lllllllllllllll' + 'ee' + 'rrrrrrrrrrrrrrr', 'the top face ends in a two-pixel point');
  assert.equal(block[31], '...............er...............', 'the corner between the sides runs to a two-pixel point');
  // The top's front edges have one pixel in each of its 30 columns (a diamond's corner columns belong to its
  // neighbours), and the corner between the sides runs 16 rows.
  assert.equal(counts(boxes([{ op: 'box', w: 16, d: 16, h: 16, top: 't', left: 'l', right: 'r', edge: 'e' }])).e, 30 + 16);
  // A face without a colour is left out, and the box sits at x, y.
  const open = rows(boxes([{ op: 'box', x: 2, y: 3, w: 8, d: 8, h: 4, left: 'l', right: 'r' }], 20, 16), 20);
  assert.equal(open.join('').replaceAll(/[lr.]/g, ''), '');
  assert.equal(open.findIndex(row => row !== '.'.repeat(20)), 3 + 8 / 2, "the left face starts at the top face's left corner, d / 2 rows down");
});

test('box is checked where it is written and stands on its bottom row in a sorted layer', () => {
  const fails = (op, message) => assert.throws(() => boxes([{ op: 'box', ...op }]), message);
  fails({ w: 15, d: 16, top: 't' }, /ops\[0\]\.w: expected an even number/);
  fails({ w: 16, d: 3, top: 't' }, /ops\[0\]\.d: expected an even number/);
  fails({ w: 16, d: 16 }, /give at least one face a colour/);
  fails({ w: 16, d: 16, top: 't', depth: 2 }, /depth/);
  fails({ w: 16, d: 16, h: -1, top: 't' }, /ops\[0\]\.h/);
  // In a sorted layer, a tall box behind a short one is drawn first, whatever the list says.
  const layer = sorted => renderProject({ version: 1, name: 'stack', width: 32, height: 40, palette: FACES, frames: [{ name: 'a', layers: [{ ...(sorted && { sort: 'ground' }), ops: [
    { op: 'box', x: 0, y: 8, w: 16, d: 16, h: 16, top: 'k', left: 'k', right: 'k' },
    { op: 'box', x: 0, y: 0, w: 16, d: 16, h: 16, top: 't', left: 'l', right: 'r' }] }] }] }).frames[0].data;
  const at = (data, x, y) => [...data.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 3)];
  assert.deepEqual(at(layer(false), 16, 20), [0, 0, 255], 'in list order the box behind covers the one in front');
  assert.deepEqual(at(layer(true), 16, 20), [32, 32, 32], 'sorted, the box in front (bottom row 39) is drawn last');
});

test('iso layout lays cells on a 2:1 grid, back to front, and recipe tilemaps stand symbols on their diamonds', () => {
  const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
  assert.deepEqual(isoLayout(cells, 2, [4, 2]).map(c => [c.x, c.y, c.left, c.top]), [[0, 0, 2, 0], [0, 1, 0, 1], [1, 0, 4, 1], [1, 1, 2, 2]]);
  // A 2x2 map of 4x2 tiles: a flat symbol fills its diamond, a taller one rises above its cell, centred.
  const project = renderProject({ version: 1, name: 'map', width: 8, height: 8, palette: FACES,
    symbols: { f: ['.tt.', 'tttt'], b: ['ll', 'll', 'll'] },
    frames: [{ name: 'a', ops: [{ op: 'tilemap', y: 4, tile: [4, 2], layout: 'iso', rows: ['ff', 'fb'], legend: { f: 'f', b: 'b' } }] }] });
  // Cells [0, 0], [0, 1], [1, 0] are floor diamonds at map [2, 0], [0, 1], [4, 1]; the block stands on cell [1, 1]
  // (diamond at [2, 2]), centred across it, its bottom on the diamond's bottom row, and drawn last.
  assert.deepEqual(rows(project.frames[0], 8), ['........', '........', '........', '........', '...tt...', '.ttlltt.', 'tttllttt', '...ll...']);
  const draw = (layout, extra = {}) => () => renderProject({ version: 1, name: 'map', width: 8, height: 8, palette: FACES, symbols: { f: ['tt'] }, frames: [{ name: 'a', ops: [{ op: 'tilemap', tile: [3, 2], layout, rows: ['f'], legend: { f: 'f' }, ...extra }] }] });
  assert.throws(draw('iso'), /an iso tile has an even width and height/);
  assert.throws(draw('hex'), /layout: expected square or iso/);
  assert.doesNotThrow(draw('square'));
  assert.throws(() => renderProject({ version: 1, name: 'map', width: 8, height: 8, palette: FACES, symbols: { t: Array(12).fill('tttttttt') }, frames: [{ name: 'a', ops: [{ op: 'tilemap', tile: [4, 2], layout: 'iso', rows: ['w'], legend: { w: { template: 't', autotile: 'blob' } } }] }] }), /draws square tiles; an iso map takes symbols/);
});

test('a sorted iso scene map covers what stands behind a block and stays under what stands on top of it', () => {
  // 8x8 frames on an 8x4 grid: a floor diamond and a block rising 4 pixels.
  const tiles = { version: 1, name: 'tiles', width: 8, height: 8, palette: FACES, frames: [
    { name: 'floor', ops: [{ op: 'box', y: 4, w: 4, d: 4, top: 'k' }] },
    { name: 'block', ops: [{ op: 'box', w: 4, d: 4, h: 4, top: 't', left: 'l', right: 'r' }] }] };
  const figure = { version: 1, name: 'figure', width: 2, height: 4, palette: { e: '#ffffff' }, anchor: [1, 3], frames: [{ name: 'a', ops: [{ op: 'rect', w: 2, h: 4, color: 'e' }] }] };
  // Cell [x, y] of a 3-row map at [0, 0] has its centre at [(x - y + 3) * 4, (x + y + 1) * 2].
  const centre = (x, y) => [(x - y + 3) * 4, (x + y + 1) * 2];
  const scene = (at, extra = {}) => prepareScene({ format: 'pixelforge-scene', version: 1, name: 'iso', width: 24, height: 16, background: '#000000', assets: { tiles, figure },
    instances: [
      { name: 'floor', asset: 'tiles', at: [0, 2], tilemap: { layout: 'iso', tile: [8, 4], rows: ['fff', 'fff', 'fff'], legend: { f: 'floor' } } },
      { name: 'blocks', asset: 'tiles', at: [0, 2], sort: 'ground', tilemap: { layout: 'iso', tile: [8, 4], rows: ['...', '.b.', '...'], legend: { b: 'block' } } },
      { name: 'figure', asset: 'figure', at: [at[0], at[1] + 2], anchor: 'frame', sort: 'ground', ...extra }] });
  const depth = view => view.depth.sorted.map(s => s.name);
  const behind = renderScene(scene(centre(1, 0)), { depth: true }), front = renderScene(scene(centre(1, 2)), { depth: true }), top = renderScene(scene(centre(1, 1), { lift: 4 }), { depth: true });
  assert.deepEqual(depth(behind), ['figure', 'blocks']);
  assert.deepEqual(depth(front), ['blocks', 'figure']);
  assert.deepEqual(depth(top), ['blocks', 'figure'], 'standing on the block, in its cell, the figure is drawn over it');
  // The block's tile row stands just above its diamond's centre: map row (1 + 1) * 2 + 2, less one, plus the map's 2.
  assert.deepEqual(behind.depth.sorted[1], { name: 'blocks', ground: 2 + 4 + 2 - 1, tiles: 1 });
  assert.ok(behind.depth.overlaps.some(o => o.front === 'blocks' && o.behind === 'figure'));
  // The map's bounds are its diamonds: (columns + rows) * 4 wide and * 2 tall.
  assert.deepEqual(behind.placements.find(p => p.name === 'floor'), { name: 'floor', tilemap: true, x: 0, y: 2, w: 24, h: 12, tiles: 9, scale: 1 });
  // The floor fills the grid with no gaps: every pixel across the map's widest row is drawn, but for its corner
  // columns, which would belong to diamonds beyond the map.
  const row = 2 + 6, data = renderScene(scene([100, 100])).data;
  for (let x = 1; x < 23; x++) assert.notDeepEqual([...data.subarray((row * 24 + x) * 4, (row * 24 + x) * 4 + 3)], [0, 0, 0], `pixel ${x}`);
});

test('a placement stands on a cell of a named map, and a raised cell lifts its tile and whatever stands on it', () => {
  const tiles = { version: 1, name: 'tiles', width: 8, height: 8, palette: FACES, frames: [{ name: 'block', ops: [{ op: 'box', w: 4, d: 4, h: 4, top: 't', left: 'l', right: 'r' }] }] };
  const figure = { version: 1, name: 'figure', width: 2, height: 4, palette: { e: '#ffffff' }, anchor: [1, 3], frames: [{ name: 'a', ops: [{ op: 'rect', w: 2, h: 4, color: 'e' }] }] };
  const source = (placement, map = {}) => ({ format: 'pixelforge-scene', version: 1, name: 'iso', width: 24, height: 32, background: '#000000', assets: { tiles, figure },
    instances: [
      { name: 'figure', asset: 'figure', anchor: 'frame', sort: 'ground', ...placement },
      { name: 'ground', asset: 'tiles', at: [0, 16], sort: 'ground', tilemap: { layout: 'iso', tile: [8, 4], rows: ['bbb', 'bbb', 'bbb'], legend: { b: 'block' }, ...map } }] });
  const view = (placement, map) => renderScene(prepareScene(source(placement, map)), { depth: true });
  const placed = (placement, map) => { const { x, y } = view(placement, map).placements.find(p => p.name === 'figure'); return [x + 1, y + 3]; };
  // Cell [x, y] of a 3-row map has its centre at [(x - y + 3) * 4, (x + y + 1) * 2] from the map's corner, and the
  // map may be listed after what stands on it.
  assert.deepEqual(placed({ on: 'ground', cell: [2, 1] }), [16, 16 + 8]);
  assert.deepEqual(view({ on: 'ground', cell: [2, 1] }).data, view({ at: [16, 24] }).data);
  assert.deepEqual(placed({ on: 'ground', cell: [1.5, 0.5] }), [16, 16 + 6], 'halves stand between cells');
  // `surface` is the block's thickness: the figure stands that much higher, on the top the tile shows, and still after
  // the tile of its own cell.
  const thick = view({ on: 'ground', cell: [1, 1] }, { surface: 4 });
  assert.deepEqual(placed({ on: 'ground', cell: [1, 1] }, { surface: 4 }), [12, 16 + 6 - 4]);
  const order = reply => reply.depth.sorted.map(s => s.name === 'figure' ? 'figure' : s.ground);
  assert.deepEqual(order(thick), [17, 19, 21, 'figure', 23, 25]);
  assert.deepEqual(thick.depth.sorted[3], { name: 'figure', at: [12, 18], raise: 4 });
  // A raised cell is drawn `rise` pixels higher a level and keeps its place in the order; what stands on it rises too.
  const heights = ['...', '.2.', '...'];
  const raised = view({ on: 'ground', cell: [1, 1] }, { heights, rise: 3 }), flat = view({ on: 'ground', cell: [1, 1] });
  assert.deepEqual(placed({ on: 'ground', cell: [1, 1] }, { heights, rise: 3 }), [12, 16 + 6 - 6]);
  assert.deepEqual(order(raised), order(flat));
  const topRow = reply => { for (let y = 0; y < 32; y++) for (let x = 0; x < 24; x++) if (reply.data[(y * 24 + x) * 4] === 255 && reply.data[(y * 24 + x) * 4 + 1] === 0) return y; };
  assert.equal(topRow(flat) - topRow(raised), 2, 'two levels of 3 lift the middle cell 6 rows: 2 above the back cell, which stands 4 rows up the screen from it');
  assert.equal(view({ on: 'ground', cell: [1, 1] }, { heights: ['...', '.3.', '...'], rise: 3 }).placements.find(p => p.name === 'figure').y, 16 + 6 - 9 - 3);
  // The default rise is half the tile's height, and `level` stands a placement at another height than its cell's.
  assert.deepEqual(placed({ on: 'ground', cell: [1, 1] }, { heights }), [12, 16 + 6 - 4]);
  assert.deepEqual(placed({ on: 'ground', cell: [1, 1], level: 0 }, { heights }), [12, 16 + 6]);
  assert.deepEqual(placed({ on: 'ground', cell: [0, 0], level: 3 }, { heights }), [12, 16 + 2 - 6]);
  // A solid map draws the tile again at each level under a raised cell.
  const tilesOf = map => view({ on: 'ground', cell: [0, 0] }, map).placements.find(p => p.name === 'ground').tiles;
  assert.deepEqual([tilesOf({ heights }), tilesOf({ heights, solid: true })], [9, 11]);
  // On a square map a placement stands on the middle of the cell's bottom edge.
  const square = prepareScene({ ...source({ on: 'ground', cell: [2, 1] }), instances: [source({ on: 'ground', cell: [2, 1] }).instances[0], { name: 'ground', asset: 'tiles', at: [0, 4], tilemap: { rows: ['bbb', 'bbb'], legend: { b: 'block' } } }] });
  assert.deepEqual(renderScene(square).placements.find(p => p.name === 'figure').y + 3, 4 + 16);
  const refuse = (placement, map, pattern) => assert.throws(() => prepareScene(source(placement, map)), pattern);
  refuse({ on: 'floor', cell: [0, 0] }, {}, /instances\[0\]\.on: expected the name of a tilemap placement/);
  refuse({ on: 'ground' }, {}, /instances\[0\]\.cell: expected \[column, row\] on ground/);
  refuse({ on: 'ground', cell: [0, 0], at: [1, 1] }, {}, /instances\[0\]\.at: a placement on a cell stands where the cell is/);
  refuse({ on: 'ground', cell: [0, 0], level: 1 }, {}, /instances\[0\]\.level: ground has no heights/);
  refuse({ at: [0, 0] }, { heights: ['...', '.2.'] }, /tilemap\.heights: expected 3 rows of 3 characters/);
  refuse({ at: [0, 0] }, { rise: 3 }, /tilemap\.rise: rise and solid go with heights/);
  refuse({ at: [0, 0] }, { layout: 'square', heights }, /tilemap\.heights: heights raise the cells of an iso map/);
});

test('what stands on cells of a sorted map is drawn with them: the ground never covers a wide thing, and a cliff or a post beside it covers only what is behind', () => {
  // A slab two cells long and one deep, four pixels high, on a map of 8x4 cells: a tile is four of its cells.
  const tiles = { version: 1, name: 'tiles', width: 8, height: 8, palette: FACES, frames: [{ name: 'block', ops: [{ op: 'box', w: 4, d: 4, h: 4, top: 't', left: 'l', right: 'r' }] }] };
  const slab = { format: 'pixelforge-stack', version: 1, name: 'slab', palette: { e: '#ffffff' }, projection: 'iso', cell: 1, headings: [0], slices: Array(4).fill(Array(4).fill('eeeeeeee')) };
  const post = { version: 1, name: 'post', width: 2, height: 6, palette: { k: '#202020' }, anchor: [1, 5], frames: [{ name: 'a', ops: [{ op: 'rect', w: 2, h: 6, color: 'k' }] }] };
  const ground = (map, sort = true, rows = ['bbbb', 'bbbb', 'bbbb', 'bbbb']) => ({ name: 'ground', asset: 'tiles', at: [8, 14], ...(sort && { sort: 'ground' }), tilemap: { layout: 'iso', tile: [8, 4], rows, legend: { b: 'block' }, surface: 4, ...map } });
  const stands = { name: 'slab', asset: 'slab', on: 'ground', cell: [1.5, 1], frame: 'heading-0' }, stood = cell => ({ name: 'post', asset: 'post', on: 'ground', cell, anchor: 'frame', sort: 'ground' });
  const scene = instances => prepareScene({ format: 'pixelforge-scene', version: 1, name: 'iso', width: 48, height: 40, background: '#000000', assets: { tiles, slab, post }, instances });
  const shot = instances => [...renderScene(scene(instances)).data];
  // Whatever the map's cells hold, the slab is listed first, so only where it stands puts it after a tile.
  const sorted = (map, ...things) => shot([stands, ...things, ground(map)]);
  // The same with nothing sorted by the map: the ground first, then the placements in the order given.
  const listed = (map, ...things) => shot([ground(map, false), ...things]);
  assert.deepEqual(sorted({}), listed({}, stands), 'flat ground is under all of it');
  const flat = renderScene(scene([stands, ground({})]), { lit: false, draws: true });
  const parts = flat.draws.filter(draw => draw.asset === 'slab');
  // It stands on cells [1, 1] and [2, 1], with a corner column over the cell behind each end, and is drawn in three
  // pieces that share its columns out between them: the first corner, then [1, 1] and the other corner, which nothing
  // is drawn between, then [2, 1].
  assert.deepEqual(parts.map(part => part.cols), [[[0, 1]], [[1, 5], [11, 12]], [[5, 11]]]);
  assert.deepEqual(flat.placements.filter(p => p.name === 'slab').length, 1);
  // The planes bake each piece where it is drawn, and whatever draws a frame whole draws it once, after its last piece.
  const { planes } = scenePlanes(scene([stands, ground({})]), flat.draws), [plane] = planes;
  assert.equal(planes.length, 1);
  for (let y = 0; y < plane.height; y++) for (let x = 0; x < plane.width; x++) if (plane.data[(y * plane.width + x) * 4 + 3]) assert.deepEqual([...plane.data.slice((y * plane.width + x) * 4, (y * plane.width + x) * 4 + 3)], [...flat.data.slice(((y + plane.at[1]) * 48 + x + plane.at[0]) * 4, ((y + plane.at[1]) * 48 + x + plane.at[0]) * 4 + 3)]);
  const whole = wholeDraws(scene([stands, ground({})]), flat.draws);
  assert.deepEqual([whole.draws.filter(draw => draw.asset === 'slab').map(draw => draw.cols), whole.covered, whole.draws.at(-1).asset], [[undefined], [], 'tiles']);
  assert.equal(whole.draws.findIndex(draw => draw.asset === 'slab'), flat.draws.findLastIndex(draw => draw.asset === 'slab') - 2);
  // On a terrace it stands as high as its cells and is still above them.
  const terrace = { heights: ['....', '.11.', '....', '....'], solid: true };
  assert.deepEqual(sorted(terrace), listed(terrace, stands));
  // A raised cell beside its near half, at its right end or along its near side, covers the part of it behind that
  // cell and nothing else; one behind it covers none of it.
  const only = (heights, row) => { const data = shot([ground({ heights, solid: true }, false, ['....', '....', '....', '....'].map((empty, y) => y === row[1] ? empty.slice(0, row[0]) + 'b' + empty.slice(row[0] + 1) : empty))]); return Array.from({ length: 48 * 40 }, (_, p) => data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2] > 0); };
  for (const [cell, covers] of [[[3, 1], true], [[1, 2], true], [[2, 2], true], [[1, 0], false], [[0, 1], false]]) {
    const heights = ['....', '....', '....', '....'].map((row, y) => y === cell[1] ? row.slice(0, cell[0]) + '2' + row.slice(cell[0] + 1) : row), map = { heights, solid: true };
    const cliff = only(heights, cell), over = listed(map, stands), under = listed(map), drawn = sorted(map);
    const expected = over.map((value, k) => covers && cliff[k >> 2] ? under[k] : value);
    assert.deepEqual(drawn, expected, `a raised cell at ${cell}`);
    if (covers) assert.notDeepEqual(drawn, over, `the cell at ${cell} covers a part of it`);
    // Drawn whole, after its last piece, it would be over a cell that is in front of its first.
    const view = renderScene(scene([stands, ground(map)]), { lit: false, draws: true });
    assert.deepEqual(wholeDraws(scene([stands, ground(map)]), view.draws).covered, cell[0] === 1 && cell[1] === 2 ? ['slab'] : [], `whole, a raised cell at ${cell}`);
  }
  // A post in front of its far end is drawn after the piece behind it, though it stands behind the slab's middle;
  // one behind the slab is covered by it.
  assert.deepEqual(sorted({}, stood([0.75, 1.6])), listed({}, stands, stood([0.75, 1.6])));
  assert.deepEqual(sorted({}, stood([2.4, 1.7])), listed({}, stands, stood([2.4, 1.7])));
  assert.deepEqual(sorted({}, stood([1.5, 0.3])), listed({}, stood([1.5, 0.3]), stands));
  assert.deepEqual(sorted({}, stood([2.7, 0.8])), listed({}, stood([2.7, 0.8]), stands));
});

test('the hamlet example stands every sprite stack on a cell of one terraced, sorted map', async () => {
  const { resolveReferences } = await import('../src/resolve.js');
  const { fileURLToPath } = await import('node:url');
  const source = JSON.parse(readFileSync(new URL('../examples/iso-hamlet.scene.json', import.meta.url), 'utf8'));
  const [ground, ...things] = source.instances;
  assert.deepEqual([ground.name, ground.sort, ground.tilemap.solid, ground.tilemap.surface], ['ground', 'ground', true, 10]);
  for (const thing of things) assert.deepEqual([thing.on, thing.at, thing.cell.length], ['ground', undefined, 2], thing.asset);
  const { document } = await resolveReferences(source, { baseDir: fileURLToPath(new URL('../examples/', import.meta.url)) });
  const scene = prepareScene(document), view = renderScene(scene, { depth: true });
  assert.deepEqual(scene.warnings, []);
  // The tower stands on the back corner, three levels of 8 and the tiles' 10 pixels of earth above its cell's centre.
  const tower = view.depth.sorted.find(entry => entry.name.startsWith('tower'));
  assert.deepEqual(tower, { name: 'tower#1', at: [16 + 8 * 16, 94 + 8 - 34], raise: 34 });
  // The raised tiles are drawn at every level under them: 64 cells and 3, 3, 3, 3, 2 + 3, 3, 3, 3, 2 + 3, 3, 3, 2, 1 + 2, 2, 2, 1 more.
  assert.equal(view.placements.find(p => p.name === 'ground').tiles, 64 + 14 + 14 + 12 + 7);
  // The ground covers no part of anything standing on it, the two cottages two tiles long included.
  assert.deepEqual(view.depth.overlaps.filter(pair => pair.front === 'ground'), []);
  const loose = renderScene(prepareScene({ ...document, instances: document.instances.map(instance => (instance.tilemap ? { ...instance, sort: undefined } : instance)) }));
  assert.deepEqual([...view.data], [...loose.data], 'as it is with the ground drawn first: no cliff here has anything behind it');
  // The mill's sails, the cannon and the villagers play animations of their stacks at a heading, and the ground is
  // under every frame of them as it is under the first.
  assert.deepEqual(things.filter(thing => thing.animation).map(thing => `${thing.asset} ${thing.animation}`), ['windmill spin-0', 'cannon scan-0', 'villager idle-sw', 'villager idle-se']);
  const later = renderScene(scene, { time: 360 }), looseLater = renderScene(prepareScene({ ...document, instances: document.instances.map(instance => (instance.tilemap ? { ...instance, sort: undefined } : instance)) }), { time: 360 });
  assert.notDeepEqual([...later.data], [...view.data]);
  assert.deepEqual([...later.data], [...looseLater.data]);
  // Every wall piece and the tower between them is one of the four quarter headings, where cells are whole pixels.
  for (const thing of things) if (thing.asset === 'wall' || thing.asset === 'tower') assert.match(thing.frame, /^heading-(0|90|180|270)$/);
});

test('the schemas offer box and the iso layout', () => {
  const recipe = schema('schema.json'), box = recipe.$defs.op.oneOf.find(op => op.properties.op.const === 'box');
  assert.deepEqual(box.required, ['op', 'w', 'd']);
  assert.equal(box.properties.w.multipleOf, 2);
  assert.deepEqual(recipe.$defs.op.oneOf.find(op => op.properties.op.const === 'tilemap').properties.layout.enum, ['square', 'iso']);
  const placement = schema('scene.schema.json').properties.instances.items;
  assert.deepEqual(placement.properties.tilemap.properties.layout.enum, ['square', 'iso']);
  for (const key of ['on', 'cell', 'level']) assert.ok(placement.properties[key], key);
  for (const key of ['heights', 'rise', 'solid', 'surface']) assert.ok(placement.properties.tilemap.properties[key], key);
  assert.deepEqual(placement.required, ['asset'], 'a placement stands at pixels or on a cell');
  assert.ok(schema('stack.schema.json').properties.cell);
});

test('the isometric examples: a tile set on 32x16 diamonds, and a scene that lays it out, shades it, sorts it and hovers a coin over a cell', async () => {
  const { resolveReferences } = await import('../src/resolve.js');
  const { fileURLToPath } = await import('node:url');
  const examples = fileURLToPath(new URL('../examples/', import.meta.url));
  const read = name => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
  const tiles = read('iso-tiles.json'), set = renderProject(tiles);
  assert.deepEqual([tiles.width, tiles.height], [32, 64]);
  // The opaque pixels in each row of a frame, and its first drawn row.
  const widths = name => {
    const frame = set.frames[tiles.frames.findIndex(item => item.name === name)];
    return Array.from({ length: 64 }, (_, y) => Array.from({ length: 32 }, (_, x) => frame.data[(y * 32 + x) * 4 + 3] > 0).filter(Boolean).length);
  };
  const first = name => widths(name).findIndex(Boolean);
  const far = [2, 6, 10, 14, 18, 22, 26, 30], near = [...far].reverse();
  // A frame's last 16 rows are its cell. A ground tile is that diamond 10 pixels up over 10 pixels of earth, so its foot
  // is the near half of its cell and the tile in front covers its sides.
  const turf = widths('turf');
  assert.deepEqual(turf, [...Array(38).fill(0), ...far, ...Array(10).fill(32), ...near]);
  // Every other ground tile is drawn over the turf and stays inside it: nothing crosses a seam or hangs off the map's edge.
  for (const name of ['grass', 'grass-tufts', 'grass-flowers', 'paver', 'paver-worn']) {
    assert.equal(tiles.frames.find(item => item.name === name).from, 'turf', `${name} starts from the turf`);
    assert.deepEqual(widths(name), turf, `${name} keeps the turf's silhouette`);
  }
  for (const name of tiles.animations.water.frames) assert.deepEqual(widths(name), [...Array(41).fill(0), ...far, ...Array(7).fill(32), ...near], `${name} lies 3 pixels below the turf`);
  // Proportions, from the centre row of the cell: a wall block rises 12 pixels and a step 6, a pine stands four blocks
  // tall and a sapling more than two.
  assert.deepEqual([48 - first('block'), 48 - first('step')], [12, 6]);
  assert.ok(56 - first('pine') >= 4 * 12 && 56 - first('sapling') >= 2 * 12, 'trees are several blocks tall');

  const source = read('iso-glade.scene.json');
  const prepare = async document => prepareScene((await resolveReferences(document, { baseDir: examples })).document);
  const scene = await prepare(source), view = renderScene(scene);
  assert.deepEqual(view.warnings ?? [], []);
  const hex = (image, x, y) => `#${[0, 1, 2].map(c => image.data[(y * image.width + x) * 4 + c].toString(16).padStart(2, '0')).join('')}`;
  assert.deepEqual(source.instances.map(item => item.name), ['ground', 'shadows', 'coin-shadow', 'things', 'coin']);
  const [ground, shadows, coinShadow, things, coin] = source.instances, rows = things.tilemap.rows.length;
  // What stands on the ground is mapped 10 pixels above the ground, the thickness of a ground tile, so the centre of a
  // cell of that map is the middle of the ground tile's top.
  assert.deepEqual([ground.at[0] - things.at[0], ground.at[1] - things.at[1]], [0, 10]);
  assert.deepEqual(shadows.at, things.at);
  const centre = (x, y) => [things.at[0] + (x - y + rows) * 16, things.at[1] + (x + y + 1) * 8];
  assert.equal(hex(view, ...centre(1, 1)), tiles.palette.G, 'open grass at the centre of cell [1, 1]');
  const [bx, by] = centre(4, 0), [sx, sy] = centre(5, 0);
  assert.deepEqual([hex(view, bx, by - 12), hex(view, sx, sy - 6)], [tiles.palette.S, tiles.palette.S], 'the tops of the block and the step, 12 and 6 pixels over their cells');

  // The coin stands at the centre of cell [0, 3], on the middle of its bottom row, and is lifted clear of the paver;
  // its shadow is placed by the centre of the shadow frame's cell.
  const [cx, cy] = centre(0, 3), coinSet = renderProject(read('coin.json')), box = { left: 99, right: -1, bottom: -1 };
  for (let y = 0; y < coinSet.height; y++) for (let x = 0; x < coinSet.width; x++) if (coinSet.frames[0].data[(y * coinSet.width + x) * 4 + 3]) { box.left = Math.min(box.left, x); box.right = Math.max(box.right, x); box.bottom = Math.max(box.bottom, y); }
  assert.deepEqual([coin.at, coinShadow.at], [[cx, cy], [cx, cy]]);
  assert.deepEqual(coin.anchor, [(box.left + box.right + 1) / 2, box.bottom], 'the coin is anchored at the middle of its bottom row');
  assert.deepEqual(coinShadow.anchor, [16, 56], 'a shadow frame placed alone is anchored at the centre of its cell');
  assert.ok(coin.lift > 6, 'the coin hovers above the far rim of its paver');

  // Shadows draw no colour: they move the ground under a thing one step down its ramp and touch nothing else.
  const bare = renderScene(await prepare({ ...source, instances: source.instances.filter(item => item.shade === undefined) }));
  const darker = new Map(tiles.ramps.flatMap(ramp => ramp.slice(1).map((key, i) => [tiles.palette[key], tiles.palette[ramp[i]]])));
  let shaded = 0;
  for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) if (hex(view, x, y) !== hex(bare, x, y)) { assert.equal(hex(view, x, y), darker.get(hex(bare, x, y)), `a shaded pixel at [${x}, ${y}]`); shaded++; }
  assert.ok(shaded > 300, `${shaded} shaded pixels`);
  assert.deepEqual([hex(bare, cx, cy), hex(view, cx, cy)], [tiles.palette.S, tiles.palette.s], 'the coin\'s shadow lies on its paver');

  // The scene's loop is a whole number of every loop it plays, so nothing jumps where it repeats: the water turns once
  // while the coin spins twice.
  const length = (recipe, name) => recipe.animations[name].frames.reduce((sum, frame) => sum + recipe.frames.find(item => item.name === frame).duration, 0);
  const loops = [length(tiles, 'water'), length(tiles, 'water-late'), length(read('coin.json'), coin.animation)];
  assert.deepEqual(loops, [1320, 1320, 660]);
  for (const loop of loops) assert.equal(source.duration % loop, 0);
  const same = (a, b) => a.data.every((value, i) => value === b.data[i]);
  assert.ok(same(renderScene(scene, { time: source.duration }), view) && !same(renderScene(scene, { time: 330 }), view), 'the scene moves and comes back to its first frame');

  for (const doc of ['skills/pixelbolt-pixel-art/SKILL.md', 'docs/agent-craft.md', 'docs/art-workflow.md', 'llms.txt']) {
    const text = readFileSync(new URL(`../${doc}`, import.meta.url), 'utf8');
    for (const file of ['examples/iso-tiles.json', 'examples/iso-glade.scene.json']) assert.ok(text.includes(file), `${doc} cites ${file}`);
  }
});
