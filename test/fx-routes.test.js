import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileEffects } from '../src/fx.js';
import { renderProject } from '../src/core.js';
import { keepFrames } from '../src/resize.js';
import { compilePreset } from '../src/presets.js';
import { startMCP } from '../src/mcp.js';

// Every route an fx refusal names compiles when followed: compile --frames counts what a recipe delivers (every
// effect's kept frames, turned copies and parts), --animation charges only the animations kept, and the particle
// refusals say how much fits. The compile also warns about loops that draw a particle twice at once or thin unevenly.
const root = fileURLToPath(new URL('../', import.meta.url));
const fireSpells = JSON.parse(await readFile(new URL('../examples/fire-spells.fx.json', import.meta.url), 'utf8'));
const refusal = (run, pattern) => {
  let match = null;
  assert.throws(run, error => { assert.equal(error.name, 'PixelError'); match = error.message.match(pattern); assert.ok(match, error.message); return true; });
  return match;
};
// What compile --frames delivers, thinned the way the CLI and MCP thin it.
const kept = (source, frames, more) => {
  const thinned = keepFrames(compilePreset(source, { frames, ...more }).recipe, frames);
  return { kept: thinned.kept, frames: renderProject(thinned.recipe).frames.length };
};
const temp = async t => {
  const base = path.resolve(os.tmpdir()), dir = await mkdtemp(path.join(base, 'pixelbolt-fx-routes-'));
  t.after(async () => { assert.ok(dir.startsWith(base + path.sep)); await rm(dir, { recursive: true, force: true }); });
  return dir;
};
const cli = dir => (...args) => spawnSync(process.execPath, [path.join(root, 'bin', 'pixelbolt.js'), ...args], { cwd: dir, encoding: 'utf8' });
const mcp = t => {
  const input = new PassThrough(), output = new PassThrough(), waiting = new Map();
  let buffer = '', next = 0;
  output.on('data', chunk => { buffer += chunk; for (let end; (end = buffer.indexOf('\n')) !== -1; buffer = buffer.slice(end + 1)) { const message = JSON.parse(buffer.slice(0, end)); waiting.get(message.id)?.(message); } });
  const running = startMCP({ input, output, directory: os.tmpdir() });
  t.after(async () => { input.end(); await running; });
  const request = (method, params) => new Promise(resolve => { waiting.set(++next, resolve); input.write(JSON.stringify({ jsonrpc: '2.0', id: next, method, params }) + '\n'); });
  return { request, call: async (name, args) => (await request('tools/call', { name, arguments: args })).result };
};

// Slanted rain over a screen: drops from a box above it, each splashing where it ends.
const rain = ({ width = 320, height = 180, frames = 72, rate = 7, life = [12, 16], name = 'rain', ...more } = {}) => ({ frames, duration: 60, loop: true, seed: 7, edges: ['top', 'left', 'right'], ...more, emitters: [
  { name: 'drop', at: [width / 2 - 10, -8], area: [width + 80, 1], rate, angle: [100, 102], speed: [8, 9], life, shapes: ['drop'], trail: { color: 'l', length: 2 } },
  { from: 'drop', when: 'death', burst: 2, angle: [200, 340], speed: [0.5, 1.2], gravity: [0, 0.3], life: [2, 3], shapes: ['splash'] }] });
const screen = (effects, width = 320, height = 180) => ({ format: 'pixelforge-fx', version: 1, name: 'screen', width, height, palette: { d: '#9fb8d8', l: '#5d7397', s: '#cfe0f4' }, symbols: { drop: ['d'], splash: ['s'] }, effects });

test('compile --frames counts the operations of the frames kept even when every frame fits the recipe: a 72-frame 320x180 rain', async t => {
  // 72 frames of 320x180 are exactly what a recipe holds, so before, the frames kept were never counted: "the effect
  // needs about 26,854 drawing operations ... so about 53 frames fit ... or frames", and --frames 36 got the same.
  const dense = screen({ rain: rain({ rate: 9 }) });
  const named = refusal(() => compileEffects(dense), /^fx\.effects\.rain: the 72 frames the effect makes need about [\d,]+ drawing operations \(\d+ a frame\) and a recipe makes at most 20,000, so frames (\d+) fits \(pixelbolt compile --frames \1\): it keeps that many/);
  assert.deepEqual(kept(dense, Number(named[1])), { kept: { rain: `${named[1]} of 72` }, frames: Number(named[1]) });
  assert.deepEqual(kept(dense, 36), { kept: { rain: '36 of 72' }, frames: 36 });
  // The cold route, on the command line.
  const dir = await temp(t), run = cli(dir), source = path.join(dir, 'rain.fx.json'), out = path.join(dir, 'rain.json');
  await writeFile(source, JSON.stringify(dense));
  const made = run('compile', source, '--out', out, '--frames', '36');
  assert.equal(made.status, 0, made.stdout + made.stderr);
  assert.deepEqual([JSON.parse(made.stdout).frames, JSON.parse(made.stdout).kept], [36, { rain: '36 of 72' }]);
});

test('the 20,000 operations hold the whole recipe delivered: every effect, every turned copy and every part', () => {
  // Two rains at 160x90 that each fit on their own. Before, each passed its own count and the recipe was refused by
  // the renderer ("project exceeds 20,000 drawing operations") with no route.
  const two = screen({ near: rain({ width: 160, height: 90, frames: 48, rate: 8 }), far: rain({ width: 160, height: 90, frames: 48, rate: 8, seed: 9 }) }, 160, 90);
  for (const name of ['near', 'far']) assert.ok(compileEffects(screen({ [name]: two.effects[name] }, 160, 90)));
  const both = refusal(() => compileEffects(two), /^fx\.effects: the 96 frames the effects make need about [\d,]+ drawing operations \(\d+ a frame\) \((near|far) [\d,]+, (near|far) [\d,]+\) and a recipe makes at most 20,000, so frames (\d+) fits \(pixelbolt compile --frames \3\)/);
  assert.equal(kept(two, Number(both[3])).frames, 2 * Number(both[3]));
  // With frames given, the kept frames of both are counted.
  const given = refusal(() => compileEffects(two, { frames: 40 }), /^fx\.effects: the 80 frames kept with frames 40 need about [\d,]+ .*, so frames (\d+) fits \(pixelbolt compile --frames \1\), or lower burst, rate or trail$/);
  assert.equal(kept(two, Number(given[1])).frames, 2 * Number(given[1]));
  // One effect turned four ways makes four copies of every frame, all delivered.
  const burst = { frames: 24, turn: { angles: [0, 90, 180, 270] }, emitters: [{ at: [80, 45], rate: 20, angle: [-20, 20], speed: [2, 3], life: [8, 10], shapes: ['drop'], trail: { color: 'l', length: 2 } }] };
  const turned = refusal(() => compileEffects(screen({ burst }, 160, 90)), /^fx\.effects\.burst: the 96 frames the effect makes need about [\d,]+ drawing operations .*, so frames (\d+) fits \(pixelbolt compile --frames \1\)/);
  assert.equal(kept(screen({ burst }, 160, 90), Number(turned[1])).frames, 4 * Number(turned[1]));
  // One drawn behind a character delivers its whole, its -back and its -front: three copies of what it draws.
  const behind = { frames: 24, emitters: [{ at: [80, 45], rate: 30, angle: [0, 360], speed: [1, 2], life: [8, 10], depth: 'split', shapes: ['drop'], trail: { color: 'l', length: 2 } }] };
  const parts = refusal(() => compileEffects(screen({ behind }, 160, 90)), /^fx\.effects\.behind: the 72 frames the effect makes need about [\d,]+ .*, so frames (\d+) fits \(pixelbolt compile --frames \1\)/);
  assert.equal(kept(screen({ behind }, 160, 90), Number(parts[1])).frames, 3 * Number(parts[1]));
});

test('an fx set authored at a screen size compiles one animation with --animation, and its refusal names frames 1', async t => {
  const big = { ...fireSpells, width: 640, height: 360 };
  // Before: "the effects make 64 frames ... projectile makes 8 turned copies, so each frame of its own makes 8 of the
  // recipe's, and 2 of its own fit", counting neither the effects after it nor naming frames 1, the one that fits.
  refusal(() => compileEffects(big), /^fx\.effects: the effects make 107 frames: 107 frames of 640×360 are 24,652,800 pixels; .* 18 frames of 640×360 fit: use fewer frames or a smaller canvas; projectile makes 8 turned copies, so each frame of its own makes 8 of the recipe's, and not one of its own fits; or compile with frames 1 \(pixelbolt compile --frames 1\)/);
  assert.equal(kept(big, 1).frames, 11);
  // Only the animations kept are simulated and charged: impact's 12 frames fit, as do impact and buff (24 are too many).
  const impact = compileEffects(big, { animation: ['impact'] });
  assert.deepEqual([impact.recipe.frames.length, Object.keys(impact.recipe.animations), Object.keys(impact.metadata.effects)], [12, ['impact'], ['impact']]);
  assert.deepEqual(renderProject(impact.recipe).frames.length, 12);
  refusal(() => compileEffects(big, { animation: ['impact', 'buff'] }), /^fx\.effects: the effects make 24 frames: .*; or compile with frames 9 /);
  assert.equal(kept(big, 9, { animation: ['impact', 'buff'] }).frames, 18);
  // One turned copy of the projectile is one animation.
  assert.equal(compileEffects(big, { animation: 'projectile-90' }).recipe.frames.length, 8);
  // A name the source doesn't make is refused before anything is counted.
  refusal(() => compileEffects(big, { animation: ['impakt'] }), /^animation: no animation "impakt"; this one has projectile-0, projectile-45, .*, impact, area, buff$/);
  // The same on the command line (compile and sequence) and over MCP.
  const dir = await temp(t), run = cli(dir), source = path.join(dir, 'fs640.fx.json');
  await writeFile(source, JSON.stringify(big));
  const made = run('compile', source, '--out', path.join(dir, 'impact.json'), '--animation', 'impact');
  assert.equal(made.status, 0, made.stdout + made.stderr);
  assert.deepEqual([JSON.parse(made.stdout).width, JSON.parse(made.stdout).frames], [640, 12]);
  const typo = run('compile', source, '--out', path.join(dir, 'typo.json'), '--animation', 'impakt');
  assert.match(JSON.parse(typo.stderr || typo.stdout).error, /^--animation: no animation "impakt"/);
  const frames = run('sequence', source, '--out', path.join(dir, 'impact-frames'), '--fps', '12', '--animation', 'impact');
  assert.equal(frames.status, 0, frames.stdout + frames.stderr);
  assert.equal((await readdir(path.join(dir, 'impact-frames'))).filter(name => name.endsWith('.png')).length, JSON.parse(frames.stdout).frames);
  const { request, call } = mcp(t);
  await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  const reply = JSON.parse((await call('pixel_compile', { source: big, animation: 'impact' })).content[0].text);
  assert.deepEqual([reply.ok, reply.width, reply.frames], [true, 640, 12]);
});

test('the frame-total replies count every effect: what they make in all, past 256 first, and only real -back and -front parts', () => {
  const dot = (frames, more) => ({ frames, emitters: [{ at: [4, 4], burst: 1, shapes: ['drop'] }], ...more });
  // 320x180 holds 72 frames. 300 made are past a recipe's 256, which frames can't change, so that comes first; once
  // plain's own fit (156), frames 36 fits too. Before: "the effects make 200 frames: ... or compile with frames 72",
  // which was then refused at 256 with no route.
  refusal(() => compileEffects(screen({ plain: dot(200), more: dot(100) })), /^fx\.effects: the effects make 300 frames; a recipe holds at most 256; then frames 36 fits \(pixelbolt compile --frames 36\)$/);
  assert.deepEqual(kept(screen({ plain: dot(156), more: dot(100) }), 36).kept, { plain: '36 of 156', more: '36 of 100' });
  // An effect turned two ways, with nothing behind a character, gets no aside about -back and -front parts. Before:
  // "the effects make 18 frames (an effect drawn behind a character also makes its -back and -front parts)".
  const twice = screen({ slash: dot(9, { turn: { angles: [0, 180] } }) }, 512, 512);
  refusal(() => compileEffects(twice), /^fx\.effects: the effects make 18 frames: 18 frames of 512×512 .*; slash makes 2 turned copies, so each frame of its own makes 2 of the recipe's, and 8 of its own fit; or compile with frames 8 /);
  assert.equal(kept(twice, 8).frames, 16);
});

test('a particle refusal says how many fit: spawned with frames, the peak alive by emitter, and a release share that compiles', () => {
  // With frames, every source frame is still simulated: "frames" meant the compile's, which changed nothing.
  const pour = frames => screen({ pour: { frames, emitters: [{ at: [160, 20], area: [300, 1], rate: 50, angle: 90, speed: 3, life: 1, shapes: ['drop'] }] } });
  const fewer = refusal(() => compileEffects(pour(100), { frames: 20 }), /^fx\.effects\.pour\.emitters: more than 4096 particles; lower burst or rate, or the effect's frames \(about (\d+) fit\)$/);
  assert.equal(kept(pour(Number(fewer[1])), 20).frames, 20);
  // Past the particles alive at once: the peak, and each emitter's share of it. Before: "lower burst, rate or life".
  const layer = (name, rate) => ({ name, at: [160, 90], area: [300, 160], rate, speed: 0, life: 20, shapes: ['drop'] });
  const snow = far => screen({ snow: { frames: 20, residue: true, emitters: [layer('far', far), layer('mid', 14.6), layer('near', 3.6)] } });
  refusal(() => compileEffects(snow(38)), /^fx\.effects\.snow: more than 1024 particles are alive at once \(about 1,124: far 760, mid 292, near 72\); lower burst, rate or life$/);
  // Lowering far's rate by what it is over (100 of its 760) compiles.
  assert.ok(compileEffects(snow(33)));
  // A release's share is named so that the first one compiles. Before, beside a rain of other particles, 0.28 was
  // named ("about 0.28 fits") and then refused again for 0.26.
  const still = { version: 1, name: 'still', width: 160, height: 90, palette: { d: '#9fb8d8' }, frames: [{ name: 'f0', ops: [{ op: 'rect', x: 0, y: 0, w: 160, h: 90, color: 'd' }] }] };
  const release = (share, life) => ({ ...screen({ e: { frames: 12, emitters: [{ at: [0, 0], sprite: { symbol: 'pic' }, release: { sweep: 0, jitter: 0.5, ...(share !== undefined && { share }) }, start: 1, end: 10, life }, { at: [100, 100], rate: 20, life: [3, 6], shapes: ['drop'] }] } }), symbols: { pic: { recipe: still, frame: 'f0' }, drop: ['d'] } });
  for (const life of [[1, 1], [8, 12]]) {
    const share = refusal(() => compileEffects(release(undefined, life)), /lower its release\.share \(about ([\d.]+) fits\)/);
    assert.ok(compileEffects(release(Number(share[1]), life)), `life ${life}: share ${share[1]}`);
  }
});

test('a loop warns when its particles outlive it or frames thins it unevenly, and following the warning clears it', () => {
  const loop = (frames, life) => screen({ rain: rain({ width: 160, height: 90, frames, rate: 3, life, edges: ['top', 'left', 'right', 'bottom'] }) }, 160, 90);
  // Drops living 21 frames in a 16-frame loop are each drawn twice at once, a cycle apart.
  assert.deepEqual(compileEffects(loop(16, [16, 21])).warnings, ['fx.effects.rain: emitters[0] (drop) lives longer than its 16-frame loop (up to 21 frames), so the loop draws each of its particles up to 2 times at once, a cycle apart, as repeats or columns: keep life within 16 frames or give the loop more frames']);
  assert.equal(compileEffects(loop(16, [12, 16])).warnings, undefined);
  assert.equal(compileEffects(loop(24, [16, 21])).warnings, undefined);
  // frames 31 of a 32-frame loop holds one frame twice as long, once a cycle.
  assert.deepEqual(compileEffects(loop(32, [12, 16]), { frames: 31 }).warnings, ['fx.effects.rain: frames 31 thins its 32-frame loop unevenly, so some kept frames last longer than others and the loop stutters; frames 16, 8 or 4 keep an even step']);
  assert.equal(compileEffects(loop(32, [12, 16]), { frames: 16 }).warnings, undefined);
  const even = keepFrames(compileEffects(loop(32, [12, 16]), { frames: 16 }).recipe, 16).recipe;
  assert.deepEqual(new Set(even.frames.map(frame => frame.duration)), new Set([120]));
  assert.match(compileEffects(loop(31, [12, 16]), { frames: 7 }).warnings[0], /frames 7 thins its 31-frame loop unevenly, .*; give the loop a multiple of 7 frames$/);
});
