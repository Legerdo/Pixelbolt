import test from 'node:test';
import assert from 'node:assert/strict';
import { createLight, spreadLight } from '../src/light.js';
import { compileFluid, createLiveFluid } from '../src/fluid.js';
import { renderProject, PixelError } from '../src/core.js';

// A grid with one full light at (x, y) and the given solid cells.
const scene = (width, height, at, walls = []) => {
  const power = new Float64Array(width * height), solid = new Uint8Array(width * height);
  power[at[1] * width + at[0]] = 1;
  for (const [x, y] of walls) solid[y * width + x] = 1;
  return { memory: createLight(width, height), power, solid, at: (x, y) => y * width + x };
};

test('in the open, light falls by 1 / reach a pixel, about as far every way', () => {
  const { memory, power, solid, at } = scene(64, 64, [32, 32]), light = spreadLight(memory, power, solid, 20, 3);
  assert.equal(light[at(32, 32)], 1);
  assert.ok(Math.abs(light[at(42, 32)] - 0.5) < 1e-9, 'ten pixels along a row');
  assert.ok(Math.abs(light[at(32, 22)] - 0.5) < 1e-9, 'ten pixels up a column');
  // Ten pixels away at every angle the sixteen steps do not lie along: within a twentieth of full light of a round.
  for (const [dx, dy] of [[7, 7], [9, 4], [4, 9], [-6, 8], [-8, -6], [3, -10], [10, 1]]) {
    const far = Math.sqrt(dx * dx + dy * dy), value = light[at(32 + dx, 32 + dy)];
    assert.ok(Math.abs(value - (1 - far / 20)) < 0.05, `${dx},${dy}: ${value} for ${1 - far / 20}`);
  }
  assert.equal(light[at(60, 32)], 0, 'beyond its reach there is none');
});

test('a solid is lit on its face and dark inside, and what is behind it is lit only by the way round', () => {
  // A wall one pixel thick from top to bottom shuts the light in; one with ends lets it round, dimmer.
  const whole = Array.from({ length: 24 }, (_, y) => [20, y]), part = whole.slice(6, 18);
  const shut = scene(40, 24, [10, 12], whole), lightShut = spreadLight(shut.memory, shut.power, shut.solid, 20, 3);
  assert.ok(Math.abs(lightShut[shut.at(19, 12)] - 0.55) < 1e-9, 'in front of the wall');
  assert.ok(lightShut[shut.at(20, 12)] > 0.2 && lightShut[shut.at(20, 12)] < lightShut[shut.at(19, 12)], 'its face is lit, less than the air before it');
  assert.equal(lightShut[shut.at(21, 12)], 0, 'no light passes a wall one pixel thick');
  const open = scene(40, 24, [10, 12], part), lightOpen = Float64Array.from(spreadLight(open.memory, open.power, open.solid, 20, 3));
  const behind = lightOpen[open.at(21, 12)], clear = scene(40, 24, [10, 12]), free = spreadLight(clear.memory, clear.power, clear.solid, 20, 3)[clear.at(21, 12)];
  assert.ok(behind > 0 && behind < free / 2, `behind the wall ${behind}, with no wall ${free}`);
  // A thick block: each pixel in costs 1 / depth.
  const block = [];
  for (let y = 4; y < 20; y++) for (let x = 20; x < 30; x++) block.push([x, y]);
  const thick = scene(40, 24, [10, 12], block), lightThick = spreadLight(thick.memory, thick.power, thick.solid, 20, 4);
  assert.ok(Math.abs(lightThick[thick.at(20, 12)] - (0.55 - 0.25)) < 1e-9, 'one pixel in');
  assert.ok(Math.abs(lightThick[thick.at(21, 12)] - (0.55 - 0.5)) < 1e-9, 'two pixels in');
  assert.equal(lightThick[thick.at(24, 12)], 0, 'deep inside');
});

test('no light leaks between two solid cells that touch at their corners', () => {
  // A stair of single cells from corner to corner: every step of it is a diagonal gap.
  const stair = Array.from({ length: 24 }, (_, k) => [8 + k, k]);
  const { memory, power, solid, at } = scene(40, 24, [4, 20], stair), light = spreadLight(memory, power, solid, 60, 1);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 40; x++) if (x > 8 + y) assert.equal(light[at(x, y)], 0, `${x},${y} is past the stair`);
  assert.ok(light[at(6, 2)] > 0.5, 'the near side is lit');
});

test('each cell takes the most light that reaches it, and a flood is the same every time', () => {
  const two = scene(48, 16, [8, 8]);
  two.power[8 * 48 + 40] = 0.6;
  const both = Float64Array.from(spreadLight(two.memory, two.power, two.solid, 16, 3));
  const one = scene(48, 16, [8, 8]), first = Float64Array.from(spreadLight(one.memory, one.power, one.solid, 16, 3));
  const other = scene(48, 16, [40, 8]);
  other.power[8 * 48 + 40] = 0.6;
  const second = spreadLight(other.memory, other.power, other.solid, 16, 3);
  for (let c = 0; c < both.length; c++) assert.equal(both[c], Math.max(first[c], second[c]));
  // The same memory, used again: the result is the same array, with the same numbers.
  const again = spreadLight(two.memory, two.power, two.solid, 16, 3);
  assert.equal(again, two.memory.light);
  assert.deepEqual(Float64Array.from(again), both);
});

// A fire beside a solid block and before a plate that is only drawn, with every kind of light colour.
const fire = (shine, extra = {}) => ({
  format: 'pixelforge-fluid', version: 1, name: 'lit', width: 48, height: 32,
  palette: { r: '#c33', y: '#fd6', s: '#88888880', k: '#223', p: '#445', D: '#00000080', u: '#00000040', z: '#00000000', H: '#ffcc8840', a: '#ff880020', b: '#ff880040', c: '#ff880060' },
  symbols: { block: Array(12).fill('kkkkkk'), plate: Array(6).fill('pppppppp') },
  effects: { lit: {
    frames: 10, seed: 3, buoyancy: 0.2, cooling: 0.05,
    obstacles: [{ symbol: 'block', x: 30, y: 10 }, { symbol: 'plate', x: 4, y: 20, solid: false, draw: 'under' }],
    emitters: [{ at: [22, 18], radius: 4, rate: 1, temperature: 1.5, density: 0.4 }],
    look: [{ field: 'density', colors: ['s'], thresholds: [0.1], dither: 0 }, { field: 'temperature', colors: ['r', 'y'], thresholds: [0.4, 0.9], dither: 0 }],
    shine: { from: 0.5, reach: 20, depth: 4, dark: 'D', colors: ['u', 'z', 'H'], smoke: ['a', 'b', 'c'], wall: ['a', 'b', 'c'], thresholds: [0.2, 0.5, 0.8], dither: 0, ...shine },
    ...extra
  } }
});
// The key the light's own grid draws at (x, y) of a frame: the last operation of a frame with light is that grid.
const lightAt = (recipe, frame, x, y) => {
  const op = recipe.frames[frame].ops.at(-1), row = op.rows[y - op.y];
  return row === undefined || x < op.x || x >= op.x + row.length ? '.' : row[x - op.x];
};

test('a fire lights the faces of a solid, lies on a decoration by how far it is, and shows on the wall behind only where asked', () => {
  const { recipe, warnings } = compileFluid(fire({}));
  assert.equal(warnings, undefined);
  const last = recipe.frames.length - 1;
  assert.equal(recipe.frames[last].ops.at(-1).op, 'grid');
  // What is drawn runs from dark through a thinner dark and clear (z draws nothing: as drawn) to a highlight.
  const drawn = (x, y) => 'Du.H'.indexOf(lightAt(recipe, last, x, y));
  // The block's face toward the fire is lit; a few pixels in it is dark, and so is its far side.
  assert.ok(drawn(30, 18) > 0, 'the face toward the fire');
  assert.equal(drawn(33, 18), 0, 'inside the block');
  assert.equal(drawn(35, 12), 0, 'its far side');
  // The plate is not solid: light lies on it by how far it is, less at its far end.
  assert.ok(drawn(11, 21) > drawn(4, 25), 'the plate is lighter near the fire than at its far corner');
  assert.equal(drawn(4, 25), 0, 'its far corner is dark');
  // The wall behind: light near the fire, none far from it, and none behind the block where there is some before it.
  const wall = (x, y) => '.abc'.indexOf(lightAt(recipe, last, x, y));
  assert.ok(wall(22, 8) >= 2, 'the wall above the fire');
  assert.equal(wall(1, 1), 0, 'a far corner of the wall');
  assert.ok(wall(28, 16) >= 2 && wall(37, 16) === 0, 'the wall is lit before the block and dark behind it');
  // Nothing is laid over the fire itself.
  const fluid = recipe.frames[last].ops.find(op => op.op === 'grid');
  for (let y = 0; y < fluid.rows.length; y++) for (let x = 0; x < fluid.rows[y].length; x++) if ('ry'.includes(fluid.rows[y][x])) assert.equal(lightAt(recipe, last, fluid.x + x, fluid.y + y), '.', `the fire at ${fluid.x + x},${fluid.y + y}`);
  // Without wall colours the empty pixels stay empty; without any light the frames end with their obstacle.
  const bare = compileFluid(fire({ wall: undefined })).recipe, op = bare.frames[last].ops.at(-1);
  const { animations, ...still } = bare, under = renderProject({ ...still, frames: [{ name: 'under', duration: 100, ops: bare.frames[last].ops.slice(0, -1) }] }).frames[0].data;
  assert.ok(Object.keys(animations).length);
  for (let y = 0; y < op.rows.length; y++) for (let x = 0; x < op.rows[y].length; x++) if (op.rows[y][x] !== '.') assert.ok(under[((op.y + y) * 48 + op.x + x) * 4 + 3] > 0, `light at ${op.x + x},${op.y + y} lies on something drawn`);
  assert.deepEqual(compileFluid(fire({})), compileFluid(fire({})));
});

test('the light follows the fire a little late, is gone after it, and closes with a loop', () => {
  // A fire that burns for four frames: the wall's light is there a frame later and gone by the end.
  const burst = fire({ dark: undefined, colors: undefined, smoke: undefined }, { frames: 24, cooling: 0.3, dissipation: 0.3, obstacles: undefined, emitters: [{ at: [22, 18], radius: 4, rate: 1, end: 4, temperature: 1.5, density: 0.4 }] });
  const { recipe, metadata } = compileFluid(burst), lit = frame => (recipe.frames[frame].ops ?? []).filter(op => op.op === 'grid').length > 1 || (recipe.frames[frame].ops ?? []).some(op => op.rows?.some(row => /[abc]/.test(row)));
  assert.ok(lit(3), 'lit while it burns');
  assert.equal(recipe.frames.at(-1).ops, undefined, 'nothing is left at the end');
  assert.equal(metadata.effects.lit.residue, 0);
  // With ease 1 the light is there with the fire's first frame; eased, it grows over the first frames.
  const wallPixels = (source, frame) => { const ops = compileFluid(source).recipe.frames[frame].ops ?? []; return ops.reduce((sum, op) => sum + (op.rows ?? []).reduce((n, row) => n + [...row].filter(ch => 'abc'.includes(ch)).length, 0), 0); };
  const eased = wallPixels(burst, 0), sudden = wallPixels(fire({ dark: undefined, colors: undefined, smoke: undefined, ease: 1 }, burst.effects.lit && { frames: 24, cooling: 0.3, dissipation: 0.3, obstacles: undefined, emitters: burst.effects.lit.emitters }), 0);
  assert.ok(sudden > eased, `at once ${sudden} pixels, eased ${eased}`);
  // A loop: the light of the last frame flows into the first as one frame flows into the next.
  const loop = compileFluid(fire({ dark: undefined, colors: undefined, smoke: undefined }, { frames: 16, loop: true, obstacles: undefined })).recipe;
  const wall = frame => { const op = loop.frames[frame].ops.at(-1), cells = new Map(); op.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') cells.set(`${op.x + x},${op.y + y}`, ch); })); return cells; };
  const changed = (a, b) => { let n = 0; for (const [cell, ch] of a) if (b.get(cell) !== ch) n++; for (const cell of b.keys()) if (!a.has(cell)) n++; return n; };
  const steps = Array.from({ length: 15 }, (_, i) => changed(wall(i), wall(i + 1))), seam = changed(wall(15), wall(0));
  assert.ok(seam <= Math.max(...steps), `across the seam ${seam} pixels of light change, within the cycle at most ${Math.max(...steps)}`);
});

test('a live runner draws the same light as it steps', () => {
  const live = createLiveFluid(fire({}), { warmup: 8 }), { rgba, keys } = live.render();
  assert.notEqual(keys[18][30], 'D', 'the block\'s face toward the fire is lit');
  assert.equal(keys[12][35], 'D', 'the block\'s far side is dark');
  assert.ok('abc'.includes(keys[8][22]), 'the wall above the fire is lit');
  assert.equal(keys[1][1], '.');
  // The dark lies over the block's own colour: a mix, opaque as the block is.
  assert.equal(rgba[(12 * 48 + 35) * 4 + 3], 255);
  // Unstepped, nothing shines yet.
  assert.equal(createLiveFluid(fire({}), { warmup: 0 }).render().keys[8][22], '.');
});

test('shine is checked with paths, and one that nothing reaches says so', () => {
  const fails = (shine, where, message, extra) => assert.throws(() => compileFluid(fire(shine, extra)), error => error instanceof PixelError && error.path === where && message.test(error.message), where);
  fails({ colors: undefined, smoke: undefined, wall: undefined }, 'fluid.effects.lit.shine.colors', /colors .* smoke .* or wall/);
  fails({ wall: ['a', 'b'] }, 'fluid.effects.lit.shine.wall', /3 palette keys/);
  fails({ colors: ['u', 'z', 'Q'] }, 'fluid.effects.lit.shine.colors[2]', /palette/);
  fails({ thresholds: [0.2, 0.5, 1.5] }, 'fluid.effects.lit.shine.thresholds[2]', /./);
  fails({ thresholds: [0.5, 0.2, 0.8] }, 'fluid.effects.lit.shine.thresholds[1]', /rise/);
  fails({ field: 'speed' }, 'fluid.effects.lit.shine.field', /temperature, density, ionization, current/);
  fails({ field: 'current' }, 'fluid.effects.lit.shine.field', /electric/);
  fails({ from: undefined }, 'fluid.effects.lit.shine.from', /./);
  fails({ full: 0.4 }, 'fluid.effects.lit.shine.full', /more than from/);
  fails({ reach: 1 }, 'fluid.effects.lit.shine.reach', /./);
  fails({ dark: 'Q' }, 'fluid.effects.lit.shine.dark', /palette/);
  assert.throws(() => compileFluid({ ...fire({}), effects: { lit: { kind: 'liquid', frames: 4, fill: [{ x: 0, y: 20, w: 48, h: 8 }], walls: ['bottom'], emitters: [], look: [{ field: 'density', colors: ['s'], thresholds: [0.5] }], shine: fire({}).effects.lit.shine } } }), error => error.path === 'fluid.effects.lit.shine' && /gas/.test(error.message));
  const { warnings } = compileFluid(fire({ from: 9, full: 10 }));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /fluid\.effects\.lit\.shine\.from is 9, above the most temperature the gas reaches \([\d.]+\), so nothing shines/);
});
