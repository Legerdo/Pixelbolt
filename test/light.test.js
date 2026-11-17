import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLight, spreadLight } from '../src/light.js';
import { compileFluid, createLiveFluid } from '../src/fluid.js';
import { compileEffects } from '../src/fx.js';
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

// ---- A particle effect's shine --------------------------------------------------------------------------------------
// A lamp of five by five white pixels (its middle at 14, 16), a block six wide and sixteen tall from (30, 8), a plate
// along the top from the left edge and a grey puff below the lamp, on a canvas of 48 × 32. Each list of the shine has
// keys of its own, so a pixel's key tells what the light took it for.
const spell = (shine = {}, effect = {}) => ({
  format: 'pixelforge-fx', version: 1, name: 'lit', width: 48, height: 32,
  palette: { W: '#ffffff', s: '#667788', p: '#445566', g: '#8899aa', q: '#123456', D: '#00000080', u: '#00000040', H: '#ffffff40', a: '#ffaa0020', b: '#ffaa0050', c: '#ff550020', d: '#ff550050' },
  symbols: { lamp: Array(5).fill('WWWWW'), block: Array(16).fill('ssssss'), plate: Array(3).fill('pppppppppppp'), puff: ['gg', 'gg'], chip: Array(5).fill('ggggg') },
  effects: { glow: {
    frames: 4, edges: ['left', 'right', 'top', 'bottom'],
    emitters: [
      { name: 'lamp', at: [12, 14], sprite: { symbol: 'lamp', draw: true } },
      { name: 'block', at: [30, 8], sprite: { symbol: 'block', draw: true } },
      { name: 'plate', at: [0, 1], sprite: { symbol: 'plate', draw: true } },
      { name: 'puffs', at: [22, 24], burst: 1, life: 4, shapes: ['puff'] }
    ],
    shine: { keys: { W: 1 }, reach: 40, depth: 4, ease: 1, thresholds: [0.25, 0.58], colors: ['u', 'H'], dark: 'D', smoke: ['a', 'b'], wall: ['c', 'd'], solid: ['block'], dither: 0, ...shine },
    ...effect
  } }
});
// A flare: the lamp's pixels as a particle that is there for a few frames.
const flare = (start, life) => ({ at: [14, 16], burst: 1, start, life, shapes: ['lamp'] });
const WALL = { colors: undefined, dark: undefined, smoke: undefined, solid: undefined };

test('what a particle effect draws in its bright colours lights a solid sprite\'s face, lies on a flat one by how far it is, and tints what else is drawn', () => {
  const { recipe, warnings } = compileEffects(spell());
  assert.equal(warnings, undefined);
  const at = (x, y) => lightAt(recipe, 3, x, y);
  // The block is solid: its face toward the lamp is lit, a pixel further in it is dark, and so is its far side.
  assert.equal(at(30, 16), 'u', 'the face toward the lamp');
  assert.equal(at(31, 16), 'D', 'a pixel inside');
  assert.equal(at(35, 16), 'D', 'the far side');
  // The plate is flat: lighter at its end near the lamp than at its far end.
  assert.equal(at(11, 3), 'H', 'the plate near the lamp');
  assert.equal(at(0, 1), 'u', 'its far end');
  // The puff is no sprite and does not shine: it takes the smoke's colours.
  assert.equal(at(21, 23), 'b');
  // The empty pixels: lit near the lamp, less further off, not at all behind the block or in a far corner.
  assert.equal(at(20, 16), 'd', 'the wall beside the lamp');
  assert.equal(at(28, 16), 'd', 'before the block');
  assert.equal(at(37, 16), '.', 'behind the block');
  assert.equal(at(47, 31), '.', 'a far corner');
  // Nothing is laid over what shines.
  for (let y = 14; y < 19; y++) for (let x = 12; x < 17; x++) assert.equal(at(x, y), '.', `the lamp at ${x},${y}`);
  // A sprite that is not listed as solid lets the light across: the wall behind it is lit, and it by how far it is.
  const flat = compileEffects(spell({ solid: undefined })).recipe;
  assert.equal(lightAt(flat, 3, 37, 16), 'c', 'the wall behind a flat block');
  assert.equal(lightAt(flat, 3, 33, 16), 'u', 'the flat block, further from the lamp than its face');
  // Without wall colours every pixel of light lies on something drawn.
  const bare = compileEffects(spell({ wall: undefined })).recipe, op = bare.frames[3].ops.at(-1);
  const { animations, ...still } = bare, under = renderProject({ ...still, frames: [{ name: 'under', duration: 100, ops: bare.frames[3].ops.slice(0, -1) }] }).frames[0].data;
  assert.ok(Object.keys(animations).length);
  for (let y = 0; y < op.rows.length; y++) for (let x = 0; x < op.rows[y].length; x++) if (op.rows[y][x] !== '.') assert.ok(under[((op.y + y) * 48 + op.x + x) * 4 + 3] > 0, `light at ${op.x + x},${op.y + y} lies on something drawn`);
  assert.deepEqual(compileEffects(spell()), compileEffects(spell()));
});

test('a particle effect\'s light follows what shines a little late and is gone after it', () => {
  // A flare in frames 2 and 3 of eight: the wall takes half the light in its first frame, and the light outlasts it.
  const burst = (ease, more) => spell({ ...WALL, ease }, { frames: 8, emitters: [flare(2, 2)], ...more });
  const { recipe, metadata } = compileEffects(burst(0.5));
  assert.equal(recipe.frames[1].ops, undefined, 'dark before the flare');
  assert.deepEqual([2, 3, 4].map(frame => lightAt(recipe, frame, 20, 16)), ['c', 'd', 'c']);
  assert.equal(recipe.frames[4].ops.length, 1, 'the frame after the flare holds only its light');
  assert.equal(recipe.frames[5].ops, undefined, 'and then that is gone too');
  assert.equal(metadata.effects.glow.residue, 0);
  // With ease 1 the light is there at once and gone with the flare.
  const sudden = compileEffects(burst(1)).recipe;
  assert.equal(lightAt(sudden, 2, 20, 16), 'd');
  assert.equal(sudden.frames[4].ops, undefined);
});

test('a looping particle effect\'s light runs on through its seam', () => {
  // A flare in the first three frames of six. Played once, its first frame has half its light; in a loop the first
  // frame also holds what the cycle before left, and the frame that follows the last is the first.
  const cycle = loop => compileEffects(spell({ ...WALL, ease: 0.5 }, { frames: 6, loop, emitters: [flare(0, 3)] }));
  const once = cycle(false), loop = cycle(true);
  assert.equal(loop.warnings, undefined);
  assert.equal(loop.metadata.effects.glow.seam.jump, 0);
  const lightPixels = recipe => recipe.frames[0].ops.at(-1).rows.reduce((n, row) => n + [...row].filter(ch => ch !== '.').length, 0);
  assert.ok(lightPixels(loop.recipe) > lightPixels(once.recipe), `in a loop ${lightPixels(loop.recipe)} pixels of light in the first frame, played once ${lightPixels(once.recipe)}`);
  // 21 pixels along the row from the lamp's middle: 0.475 of full light there, so 0.2375 played once and 0.264 in the loop.
  assert.deepEqual([lightAt(once.recipe, 0, 35, 16), lightAt(loop.recipe, 0, 35, 16)], ['.', 'c']);
});

test('an effect with a back and a front keeps each side\'s light with it, and a stand-in\'s out of both', () => {
  const { recipe, metadata } = compileEffects(spell({ solid: undefined }, { emitters: [
    { name: 'stand-in', at: [20, 8], sprite: { symbol: 'block', draw: true }, depth: 'between' },
    flare(0, 4),
    { at: [8, 24], burst: 1, life: 4, shapes: ['puff'], depth: 'back' },
    { at: [8, 8], burst: 1, life: 4, shapes: ['puff'] }
  ] }));
  assert.deepEqual(metadata.effects.glow.parts, { back: 'glow-back', front: 'glow-front' });
  const light = (name, x, y) => lightAt(recipe, recipe.frames.findIndex(frame => frame.name === name), x, y);
  // The whole effect: the stand-in, both puffs and the wall are lit.
  assert.deepEqual([light('glow-0', 20, 16), light('glow-0', 8, 23), light('glow-0', 8, 8), light('glow-0', 2, 16)], ['H', 'b', 'b', 'd']);
  // Behind a character: the wall's light and the light on what the back draws.
  assert.deepEqual([light('glow-back-0', 20, 16), light('glow-back-0', 8, 23), light('glow-back-0', 8, 8), light('glow-back-0', 2, 16)], ['.', 'b', '.', 'd']);
  // In front: the light on what the front draws. A game lights its own character.
  assert.deepEqual([light('glow-front-0', 20, 16), light('glow-front-0', 8, 23), light('glow-front-0', 8, 8), light('glow-front-0', 2, 16)], ['.', '.', 'b', '.']);
});

test('a tint or a remap to a colour that shines gives light as its key does', () => {
  const lit = (recipe, frame) => recipe.frames[frame].ops.at(-1).op === 'grid';
  // White for the first half of its life, grey for the second: it shines only while it is white.
  const tinted = compileEffects(spell(WALL, { emitters: [{ at: [14, 16], burst: 1, life: 4, shapes: ['chip'], tint: ['W', 'g'] }] })).recipe;
  assert.deepEqual([0, 1, 2, 3].map(frame => lit(tinted, frame)), [true, true, false, false]);
  // A remap to the same colour by its value.
  const remapped = compileEffects(spell(WALL, { emitters: [{ at: [14, 16], burst: 1, life: 4, shapes: ['chip'], remaps: [{ g: '#ffffff' }] }] })).recipe;
  assert.equal(lightAt(remapped, 0, 20, 16), 'd');
  // A key at 0 is part of what shines: it gives no light and takes none.
  const dim = compileEffects(spell({ ...WALL, smoke: ['a', 'b'], keys: { W: 1, g: 0 } }, { emitters: [flare(0, 4), { at: [22, 24], burst: 1, life: 4, shapes: ['puff'] }] })).recipe;
  assert.equal(lightAt(dim, 0, 21, 23), '.');
});

test('a particle effect\'s shine is checked with paths, with its emitters\' errors, and one that nothing gives says so', () => {
  const errorOf = source => { try { compileEffects(source); } catch (error) { assert.ok(error instanceof PixelError, error.stack); return error; } return assert.fail('compiled'); };
  const fails = (shine, where, message, effect) => { const error = errorOf(spell(shine, effect)); assert.equal(error.path, where); assert.match(error.message, message, where); };
  fails({ keys: undefined }, 'fx.effects.glow.shine.keys', /palette keys that shine/);
  fails({ keys: { Q: 1 } }, 'fx.effects.glow.shine.keys.Q', /palette/);
  fails({ keys: { W: 9 } }, 'fx.effects.glow.shine.keys.W', /./);
  fails({ keys: { W: 0 } }, 'fx.effects.glow.shine.keys', /nothing would shine/);
  fails({ solid: ['nobody'] }, 'fx.effects.glow.shine.solid[0]', /no emitter in this effect is named "nobody"/);
  fails({ solid: ['puffs'] }, 'fx.effects.glow.shine.solid[0]', /draws no sprite/);
  fails({ solid: ['block', 'block'] }, 'fx.effects.glow.shine.solid[1]', /once/);
  fails({ colors: ['u'] }, 'fx.effects.glow.shine.colors', /2 palette keys/);
  fails({ colors: undefined, smoke: undefined, wall: undefined }, 'fx.effects.glow.shine.colors', /sprites the effect draws.*what else it draws.*empty pixels/);
  fails({ thresholds: [0.5, 0.2] }, 'fx.effects.glow.shine.thresholds[1]', /rise/);
  fails({ reach: 1 }, 'fx.effects.glow.shine.reach', /./);
  fails({ dark: 'Q' }, 'fx.effects.glow.shine.dark', /palette/);
  fails({ glow: true }, 'fx.effects.glow.shine.glow', /unknown/);
  assert.equal(errorOf(spell({}, { shine: 3 })).path, 'fx.effects.glow.shine');
  // An emitter's error and the shine's come in one reply, and the shine's solid waits for the emitters to read.
  const both = errorOf(spell({ reach: 1, solid: ['nobody'] }, { emitters: [{ at: [1, 1], burst: 1, life: 2, shapes: ['puff'], speed: 'fast' }] }));
  assert.deepEqual(both.errors.map(item => item.path), ['fx.effects.glow.emitters[0].speed', 'fx.effects.glow.shine.reach']);
  // Colours the effect never draws: nothing shines, and the compile says so once.
  const { warnings, recipe } = compileEffects(spell({ keys: { q: 1 } }));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^fx\.effects\.glow\.shine\.keys: nothing the effect draws is in this colour, so nothing shines/);
  // The sprites are still dark where no light reaches: all of them, here.
  assert.equal(lightAt(recipe, 0, 30, 16), 'D');
});

test('the shine fields of a particle effect in the schema match the compiler, and the shipped portal is lit by it', async () => {
  const read = async file => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  const shine = (await read('fx.schema.json')).properties.effects.additionalProperties.properties.shine;
  const unknown = key => { try { compileEffects(spell({ [key]: 0 })); return false; } catch (error) { return /unknown or null field/.test(error.message) && error.path === `fx.effects.glow.shine.${key}`; } };
  for (const key of Object.keys(shine.properties)) assert.equal(unknown(key), false, `${key} is in the schema but the compiler rejects it`);
  assert.equal(unknown('notAField'), true);
  assert.deepEqual(shine.required, ['keys', 'reach', 'thresholds']);
  // The portal: its arch is solid to the light, lit beside the opening and dark at its outer side, in every frame.
  const portal = await read('examples/stone-portal.fx.json'), { recipe, warnings, metadata } = compileEffects(portal);
  assert.equal(warnings, undefined);
  assert.equal(metadata.effects['stone-portal'].seam.jump, 0);
  recipe.frames.forEach((frame, i) => {
    assert.equal(frame.ops.at(-1).op, 'grid');
    assert.equal(lightAt(recipe, i, 14, 60), 'D', `frame ${i}: the pillar's outer side`);
    assert.notEqual(lightAt(recipe, i, 22, 60), 'D', `frame ${i}: the pillar beside the opening`);
  });
});
