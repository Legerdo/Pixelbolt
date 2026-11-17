import test from 'node:test';
import assert from 'node:assert/strict';
import { compileEffects } from '../src/fx.js';
import { renderProject } from '../src/core.js';

// An effect's canvas is an animation frame: at most 1024 a side and 262,144 pixels, so a full-screen overlay at 320x180
// or 640x360 is one effect, with every frame of it held to the 4,194,304 pixels a recipe's frames share.
const refused = (source, path, message) => assert.throws(() => compileEffects(source), error => {
  assert.equal(error.name, 'PixelError');
  assert.equal(error.path, path);
  if (message instanceof RegExp) assert.match(error.message, message); else assert.equal(error.message, `${path}: ${message}`);
  return true;
});
// Slanted streaks falling from above the screen, each splashing where it ends: a seamless rain loop.
const rain = (width = 320, height = 180, frames = 16) => ({ format: 'pixelforge-fx', version: 1, name: 'rain', width, height,
  palette: { d: '#9fb8d8', l: '#5d7397', s: '#cfe0f4' },
  symbols: { drop: ['d'], splash: ['s'] },
  effects: { rain: { frames, duration: 60, loop: true, seed: 7, edges: ['top', 'left', 'right'], emitters: [
    { name: 'drop', at: [width / 2 - 10, -8], area: [width + 80, 1], rate: 7 * width / 320, angle: [100, 102], speed: [8, 9], life: [16, 21], shapes: ['drop'], trail: { color: 'l', length: 2 } },
    { from: 'drop', when: 'death', burst: 2, angle: [200, 340], speed: [0.5, 1.2], gravity: [0, 0.3], life: [2, 3], shapes: ['splash'] }] } } });

test('a 320x180 rain overlay is one effect: slanted streaks, splashes and a seamless loop', () => {
  const { recipe, metadata, warnings } = compileEffects(rain());
  assert.deepEqual([recipe.width, recipe.height, recipe.frames.length], [320, 180, 16]);
  assert.equal(warnings, undefined);
  assert.equal(metadata.effects.rain.seam.jump, 0, 'the loop has no seam');
  const ops = recipe.frames.flatMap(frame => frame.ops);
  // Streaks lean the way the drops fall (down and a little left) and reach past the old 256-pixel side.
  const streaks = ops.filter(op => op.op === 'line');
  assert.ok(streaks.length > 100 && streaks.every(op => op.y2 > op.y && op.x2 <= op.x) && streaks.some(op => op.x2 < op.x));
  assert.ok(ops.some(op => op.op === 'stamp' && op.symbol === 'drop' && op.x > 256), 'drops fall across the full width');
  assert.ok(ops.some(op => op.op === 'stamp' && op.symbol === 'splash'), 'drops splash where they end');
  const project = renderProject(recipe);
  assert.deepEqual([project.width, project.height, project.frames.length], [320, 180, 16]);
});

test('a 640x360 effect compiles, and a full-width grid (a stream and its shine) renders past 256 columns', () => {
  const { recipe } = compileEffects(rain(640, 360, 8));
  assert.deepEqual([recipe.width, recipe.height, recipe.frames.length], [640, 360, 8]);
  const bright = { format: 'pixelforge-fx', version: 1, name: 'beam', width: 320, height: 180, palette: { W: '#ffffff', g: '#3a4a6a', h: '#8aa0c8' },
    effects: { beam: { frames: 2, looks: { hot: { colors: ['W'], thresholds: [0.2] } }, layers: [{ kind: 'stream', look: 'hot', at: [0, 90], through: [[319, 90]], width: 6 }],
      shine: { keys: { W: 1 }, reach: 12, thresholds: [0.3, 0.7], wall: ['g', 'h'] } } } };
  const lit = compileEffects(bright).recipe, grids = lit.frames[0].ops.filter(op => op.op === 'grid');
  assert.ok(grids.some(op => op.rows[0].length > 256), `grid widths ${grids.map(op => op.rows[0].length)}`);
  assert.equal(renderProject(lit).width, 320);
});

test('an effect follows the animation frame: 1024 a side, 262,144 pixels, and the frames that fit', () => {
  const source = (width, height, frames = 2) => ({ ...rain(width, height, frames), effects: { dot: { frames, emitters: [{ at: [4, 4], burst: 1, shapes: ['drop'] }] } } });
  assert.equal(compileEffects(source(1024, 256)).recipe.width, 1024);
  assert.equal(compileEffects(source(512, 512)).recipe.height, 512);
  refused(source(1025, 64), 'fx.width', /expected .*1 to 1024/);
  refused(source(1024, 512), 'fx', 'a 1024×512 canvas is 524,288 pixels; an effect\'s frame holds at most 262,144 (320×180, 480×270, 640×360 and 512×512 fit), so draw it smaller or enlarge a smaller canvas with sheet.scale');
  // The total is checked before anything is simulated, and says how many frames of this size fit.
  refused(source(320, 180, 73), 'fx.effects', "73 frames of 320×180 are 4,204,800 pixels; a recipe's frames hold at most 4,194,304 in all, so 72 frames of 320×180 fit: use fewer frames or a smaller canvas");
  assert.equal(compileEffects(source(320, 180, 72)).recipe.frames.length, 72);
});

test('spawn boxes, rings and grounds reach across a big canvas; a particle symbol stays at most 256', () => {
  const emitting = emitter => ({ ...rain(640, 360, 2), effects: { e: { frames: 2, emitters: [{ at: [320, 180], burst: 4, shapes: ['drop'], ...emitter }] } } });
  assert.ok(compileEffects(emitting({ area: [2048, 1] })));
  refused(emitting({ area: [2049, 1] }), 'fx.effects.e.emitters[0].area', 'expected a spawn box from 1 to 2048 pixels per side');
  assert.ok(compileEffects(emitting({ area: undefined, ring: { radius: 1024 } })));
  refused(emitting({ ring: { radius: 1025 }, area: undefined }), 'fx.effects.e.emitters[0].ring.radius', /1024/);
  assert.ok(compileEffects(emitting({ ground: 1024, gravity: [0, 1] })));
  refused(emitting({ ground: -1025 }), 'fx.effects.e.emitters[0].ground', /-1024 to 1024/);
  const wide = { ...rain(), symbols: { drop: ['d'.repeat(257)] } };
  refused(wide, 'fx.symbols.drop', 'its rows are 257 characters; a particle\'s symbol is at most 256 a side (a sprite taken from a recipe may span the canvas)');
  // A sprite taken from a recipe spans that recipe's canvas, so it follows the frame; a larger still is refused.
  const still = (width, height) => ({ version: 1, name: 'still', width, height, palette: { d: '#9fb8d8' }, frames: [{ name: 'f', ops: [{ op: 'pixel', x: 1, y: 1, color: 'd' }] }] });
  assert.ok(compileEffects({ ...rain(), symbols: { drop: ['d'], splash: ['s'], screen: { recipe: still(320, 180) } } }));
  refused({ ...rain(), symbols: { drop: ['d'], splash: ['s'], screen: { recipe: still(1024, 512) } } }, 'fx.symbols.screen.recipe', 'its canvas is 1024×512; a symbol or sprite taken from a recipe is at most 1024 pixels a side and 262,144 pixels, as an animation frame is');
});
