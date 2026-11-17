import test from 'node:test';
import assert from 'node:assert/strict';
import { compileEffects } from '../src/fx.js';
import { renderProject } from '../src/core.js';
import { keepFrames } from '../src/resize.js';

// Each route an fx refusal names is followed as an agent would follow it, and the source then compiles in one step,
// with no stutter warning: a release share judged frame by frame, a loop's frames confirmed by simulating them, counts
// that divide every loop thinned, a change to a loop's own frames where no good count divides it, the other effects
// named when they alone pass 256 frames, and the effects before one named when they took the simulation's room.

// What a reply asks for, applied to a copy of the source and the compile's options: an effect's own frames ("the
// effect's frames", the effect the error's path names, or "<name>'s frames"), loops' frames ("once the loop has",
// "once a's loop has N frames and b's M", "giving the loop N frames"), every effect's frames ("a N, b M of their own
// frames fit together"), "<name>: N of its own frames fit", a release's share and compile --frames.
const apply = (error, source, options) => {
  const message = error.message, at = error.path.match(/^fx\.effects\.([\w-]+)/)?.[1], only = Object.keys(source.effects);
  const frames = (name, n) => { source.effects[name].frames = Number(n); };
  let x, done = false;
  if ((x = message.match(/giv(?:e|ing) (the loop|[\w-]+'s loop) (\d+) frames/))) { frames(x[1] === 'the loop' ? only[0] : x[1].slice(0, -"'s loop".length), x[2]); done = true; }
  if ((x = message.match(/once the loop has (\d+) frames/))) { frames(only[0], x[1]); done = true; }
  if ((x = message.match(/once ((?:[\w-]+'s (?:loop has )?\d+(?: frames)?(?:, | and )?)+)/))) for (const [, name, n] of x[1].matchAll(/([\w-]+)'s (?:loop has )?(\d+)/g)) { frames(name, n); done = true; }
  if ((x = message.match(/none: (.*) of their own frames fit together/))) for (const [, name, n] of x[1].matchAll(/([\w-]+) (\d+)/g)) { frames(name, n); done = true; }
  if ((x = message.match(/, or ([\w-]+)'s frames(?:: (\d+) fit| \((\d+) fit\))/))) { frames(x[1], x[2] ?? x[3]); done = true; }
  else if ((x = message.match(/the effect's frames(?:: (\d+) fit| \((\d+) fit\))/))) { frames(at, x[1] ?? x[2]); done = true; }
  if ((x = message.match(/([\w-]+): (\d+) of its own frames fit/))) { frames(x[1], x[2]); done = true; }
  if ((x = message.match(/emitters\[(\d+)\] releases .* release\.share \(about ([\d.]+) fits\)/))) { source.effects[at].emitters[Number(x[1])].release.share = Number(x[2]); done = true; }
  if ((x = message.match(/frames (\d+) fits/) ?? message.match(/compiled? with frames (\d+)/))) { options.frames = Number(x[1]); done = true; }
  assert.ok(done, `no route to follow: ${message}`);
};
// The first reply, and what following it compiles: the source and options followed, the compile, and the frames
// compile --frames delivers, thinned as the CLI and MCP thin them.
const follow = (original, given = {}) => {
  const source = structuredClone(original), options = { ...given };
  let reply = null;
  assert.throws(() => compileEffects(source, options), error => { assert.equal(error.name, 'PixelError'); reply = error; return true; });
  apply(reply, source, options);
  const compiled = compileEffects(source, options);
  const recipe = options.frames ? keepFrames(compiled.recipe, options.frames).recipe : compiled.recipe;
  return { reply: reply.message, source, options, compiled, frames: renderProject(recipe).frames.length };
};
// A followed compile thins no loop unevenly.
const even = compiled => assert.ok(!(compiled.warnings ?? []).some(warning => warning.includes('unevenly')), JSON.stringify(compiled.warnings));

const fx = (effects, width, height) => ({ format: 'pixelforge-fx', version: 1, name: 'fx', width, height, palette: { d: '#9fb8d8', l: '#5d7397' }, symbols: { drop: ['d'] }, effects });
const sides = ['top', 'left', 'right', 'bottom'];
// Drops falling from above the canvas, as the rains in the field reports are written.
const rain = ({ frames, width, rate, life = [4, 15], trail = 2, seed = 5, loop = true, floor }) => ({ frames, duration: 60, loop, seed, edges: sides, emitters: [
  { name: 'drop', at: [width / 2, -4], area: [width, 1], rate, angle: [80, 100], speed: [1, 4], life, shapes: ['drop'], ...(trail && { trail: { color: 'l', length: trail } }), ...(floor && { floor }) }] });

test('a release share is judged frame by frame beside the other emitters: the share named compiles', () => {
  const still = { version: 1, name: 'still', width: 90, height: 60, palette: { d: '#9fb8d8' }, frames: [{ name: 'f0', ops: [{ op: 'rect', x: 0, y: 0, w: 90, h: 60, color: 'd' }] }] };
  // A 90x60 sprite released at frames 18–24, and two drop emitters that peak at 720 alive each, at different times.
  const source = (first = [0, 12], second = [34, 46]) => ({ ...fx({ e: { frames: 60, residue: true, emitters: [
    { at: [0, 0], sprite: { symbol: 'big' }, release: { sweep: 0, jitter: 0.5 }, start: 18, end: 24, life: [6, 8], speed: [0.5, 1.5], angle: [0, 360] },
    { at: [100, 60], rate: 60, start: first[0], end: first[1], life: [12, 12], speed: [0.2, 0.5], angle: [0, 360], shapes: ['drop'] },
    { at: [100, 60], rate: 60, start: second[0], end: second[1], life: [12, 12], speed: [0.2, 0.5], angle: [0, 360], shapes: ['drop'] }] } }, 200, 120), symbols: { big: { recipe: still, frame: 'f0' }, drop: ['d'] } });
  // Before: "no share of emitters[0]'s release fits: the other emitters' peaks alone pass 1024 alive (emitters[1] 720,
  // emitters[2] 720)", the sum of two peaks that never meet; a share of 0.15 compiled.
  const followed = follow(source());
  assert.match(followed.reply, /^fx\.effects\.e: more than 1024 particles are alive at once; emitters\[0\] releases every one of its sprite's 5,400 pixels: lower its release\.share \(about ([\d.]+) fits\) or use a smaller sprite$/);
  assert.ok(followed.source.effects.e.emitters[0].release.share >= 0.15, followed.reply);
  assert.equal(followed.frames, 60);
  // When the two meet after the release, they alone keep more than 1024 alive in one frame, and that is said; a share
  // of 0 is refused too.
  assert.throws(() => compileEffects(source([34, 46], [40, 52])), { message: /^fx\.effects\.e: more than 1024 particles are alive at once, and no share of emitters\[0\]'s release fits: the other emitters alone keep more than 1024 alive in frame \d+ \(emitters\[1\] [\d,]+, emitters\[2\] [\d,]+\); lower burst, rate or life$/ });
  const none = source([34, 46], [40, 52]);
  none.effects.e.emitters[0].release.share = 0;
  assert.throws(() => compileEffects(none), { message: /more than 1024 particles are alive at once/ });
});

test('a loop\'s frames route is confirmed by simulating the loop it names, so the first route compiles', () => {
  // A 151-frame 256x256 rain with trails, compiled with frames 64. Before: "the effect's frames: 80 fit, compiled with
  // frames 20", then at 80 "needs about 80,588 drawing operations (1007 a frame) of the 80,000 ... (60 fit)".
  const heavy = fx({ e0: rain({ frames: 151, width: 256, rate: 30, life: [4, 30], floor: 252, seed: 80 }) }, 256, 256);
  const followed = follow(heavy, { frames: 64 });
  assert.match(followed.reply, /^fx\.effects\.e0: the effect simulates all 151 of its frames, kept or not, and needs about [\d,]+ drawing operations \(\d+ a frame\) of the 80,000 a compile may simulate: lower burst, rate or trail, or the effect's frames: (\d+) fit, compiled with frames (\d+) \(pixelbolt compile --frames \2\)$/);
  assert.equal(followed.source.effects.e0.frames % followed.options.frames, 0);
  assert.equal(followed.frames, followed.options.frames);
  even(followed.compiled);
  // The particles spawned, counted on a shorter loop: a 214-frame 320x180 loop compiled with frames 2. Before: "(128
  // fit)", then at 128 "(126 fit)".
  const spawned = fx({ e0: { frames: 214, duration: 60, loop: true, seed: 33, edges: sides, emitters: [
    { name: 'drop', at: [160, -4], area: [320, 1], rate: 8, angle: [80, 100], speed: [1, 4], life: [4, 7], shapes: ['drop'] },
    { at: [160, 90], burst: 10, start: 72, angle: [0, 359], speed: [0.5, 2], life: [3, 12], shapes: ['drop'] },
    { from: 'drop', when: 'death', burst: 3, angle: [200, 340], speed: [0.6, 1.4], life: [3, 4], shapes: ['drop'] }] } }, 320, 180);
  const fewer = follow(spawned, { frames: 2 });
  assert.match(fewer.reply, /^fx\.effects\.e0\.emitters: more than 4096 particles; lower burst or rate, or the effect's frames \(\d+ fit\)$/);
  assert.equal(fewer.frames, 2);
});

test('a count named for compile --frames divides every loop the compile thins, not only the refused effect\'s', () => {
  // Two 256x256 loops of 96 and 144 frames, compiled with frames 24. Before: "the effect's frames: 84 fit, compiled
  // with frames 21", and 21 thinned the 144-frame loop unevenly.
  const two = fx({ e0: rain({ frames: 96, width: 256, rate: 30, life: [4, 27], seed: 35 }), e1: rain({ frames: 144, width: 256, rate: 0.5, life: [4, 36], floor: 252, seed: 55 }) }, 256, 256);
  const followed = follow(two, { frames: 24 });
  assert.match(followed.reply, /^fx\.effects\.e0: .* of the 80,000 a compile may simulate: lower burst, rate or trail, or the effect's frames: (\d+) fit, compiled with frames (\d+) \(pixelbolt compile --frames \2\)$/);
  assert.equal(144 % followed.options.frames, 0, followed.reply);
  even(followed.compiled);
  // A one-shot beside a 90-frame loop: the frames kept divide the loop. Before: "33 fit, compiled with frames 32".
  const beside = fx({ e0: rain({ frames: 90, width: 256, rate: 16, floor: 124, seed: 0 }), e1: { ...rain({ frames: 166, width: 256, rate: 8, life: [4, 25], trail: 2, seed: 12, loop: false }), residue: true, emitters: [
    ...rain({ frames: 166, width: 256, rate: 8, life: [4, 25], seed: 12 }).emitters, { from: 'drop', when: 'death', burst: 3, angle: [200, 340], speed: [0.6, 1.4], life: [3, 4], shapes: ['drop'] }] } }, 256, 128);
  const kept = follow(beside, { frames: 45 });
  assert.match(kept.reply, /^fx\.effects\.e1\.emitters: more than 4096 particles; lower burst or rate, or the effect's frames: \d+ fit, compiled with frames (\d+) /);
  assert.equal(90 % kept.options.frames, 0, kept.reply);
  even(kept.compiled);
  // Past 256 frames with frames given: the count kept divides the other loop, and the loop named is a multiple of it.
  // Before: "c: 56 of its own frames fit beside the others; then frames 24 fits", which thinned both loops unevenly.
  const dots = (frames, more) => ({ frames, duration: 60, ...more, emitters: [{ at: [32, 32], rate: 0.5, angle: [0, 359], speed: [0.5, 1], life: [3, 6], shapes: ['drop'] }] });
  const past = follow(fx({ a: dots(100, { residue: true }), b: dots(100, { loop: true }), c: dots(100, { loop: true }) }, 64, 64), { frames: 24 });
  assert.equal(past.reply, 'fx.effects: the effects make 300 frames; a recipe holds at most 256; c: 40 of its own frames fit beside the others; then frames 20 fits (pixelbolt compile --frames 20)');
  assert.equal(past.frames, 3 * 20);
  even(past.compiled);
});

test('where no good count divides a loop, the loop\'s own frames are named with the count, never a 2-frame thinning', () => {
  const screen = (frames, rate) => ({ format: 'pixelforge-fx', version: 1, name: 'rain', width: 320, height: 180, palette: { d: '#b8d4f0c0', t: '#8fb0d880', s: '#d8ecffd0' }, symbols: { drop: ['d', 'd'], bead: ['s'] },
    effects: { rain: { frames, duration: 50, seed: 7, loop: true, edges: sides, emitters: [
      { name: 'drops', at: [170, -8], area: [420, 1], rate, angle: [98, 102], speed: [6.5, 7.5], life: [15, 25], shapes: ['drop'], trail: { color: 't', length: 3 } },
      { name: 'beads', from: 'drops', when: 'death', burst: 1, angle: [220, 320], speed: [0.8, 1.4], gravity: [0, 0.35], life: [3, 4], shapes: ['bead'] }] } } });
  // 146 frames of 320x180 past the pixels a recipe holds. Before: "or compile with frames 2", a 2-frame rain.
  const pixels = follow(screen(146, 1));
  assert.match(pixels.reply, /; or compile with frames 72 \(pixelbolt compile --frames 72\) once the loop has 144 frames: it keeps that many of each animation's, evenly spaced, without cutting the effect short$/);
  assert.deepEqual([pixels.source.effects.rain.frames, pixels.frames], [144, 72]);
  even(pixels.compiled);
  // A 58-frame loop past the 20,000 operations. Before: "so frames 2 fits".
  const operations = follow(screen(58, 12));
  assert.match(operations.reply, /, so frames (\d+) fits \(pixelbolt compile --frames \1\) once the loop has (\d+) frames: it keeps that many/);
  assert.ok(operations.options.frames > 3 && operations.source.effects.rain.frames % operations.options.frames === 0, operations.reply);
  even(operations.compiled);
});

test('when the other effects alone pass 256 frames, the reply names them, how many must go and what fits together', () => {
  const dots = (frames, more) => ({ frames, duration: 60, ...more, emitters: [{ at: [80, 45], rate: 0.5, angle: [0, 359], speed: [0.5, 1], life: [3, 6], shapes: ['drop'] }] });
  const three = fx({ e0: dots(121, { residue: true, turn: { angles: [0, 180] } }), e1: dots(178, { loop: true }), e2: dots(206, { loop: true }) }, 160, 90);
  // Before: "the effects make 626 frames; a recipe holds at most 256; e1: not one of its own frames fits beside the
  // others", with no route.
  const followed = follow(three, { frames: 16 });
  assert.equal(followed.reply, 'fx.effects: the effects make 626 frames; a recipe holds at most 256, so 370 must go, and the others alone make 448 (e0 121 × 2, e2 206), leaving e1 none: e0 49, e1 64 and e2 80 of their own frames fit together; then frames 16 fits (pixelbolt compile --frames 16)');
  assert.equal(followed.frames, 4 * 16);
  even(followed.compiled);
});

test('when the effects before one took the simulation\'s room, the reply names them and routes to their frames', () => {
  // A heavy rain first, then a burst turned four ways that has no room left for even one frame of its four copies.
  // Before: "(77,632 taken by the effects before it): lower burst, rate or trail", with nothing to follow.
  const heavy = fx({ e1: rain({ frames: 68, width: 64, rate: 24, trail: 6 }), e2: { frames: 12, residue: true, turn: { angles: [0, 90, 180, 270] }, emitters: [{ at: [32, 32], burst: 900, angle: [0, 359], speed: [0.5, 2], life: [3, 6], shapes: ['drop'] }] } }, 64, 64);
  for (const given of [{ frames: 4 }, {}]) {
    const followed = follow(heavy, given);
    assert.match(followed.reply, /^fx\.effects\.e2: .* of the 80,000 a compile may simulate \(77,632 taken by the effects before it: e1 77,632\): lower burst, rate or trail \(here or in e1\), or e1's frames(: \d+ fit, compiled with frames \d+ \(pixelbolt compile --frames \d+\)| \(\d+ fit\))$/);
    assert.ok(followed.source.effects.e1.frames < 68 && followed.source.effects.e2.frames === 12, followed.reply);
    even(followed.compiled);
  }
});
