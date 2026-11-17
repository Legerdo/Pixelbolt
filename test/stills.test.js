// Stills ("animations": {}): the flipbook they keep for viewing is never offered as an animation. Patches, the render
// check, inspect, validate --fps, pixel_render's animation and saveAs, and every exported atlas say so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProject, inspectProject, analyzeProject, briefDiagnostics, compareProjects, briefComparison, buildAtlas, exportAtlas, PixelError } from '../src/core.js';
import { patchRecipe } from '../src/patch.js';
import { checkDelivery } from '../src/check.js';
import { frameGrid } from '../src/sequence.js';
import { createBundle } from '../src/export.js';
import { compilePoses, compileAutotile } from '../src/authoring.js';
import { startMCP } from '../src/mcp.js';
import { loadEngine } from '../playground/render.js';
import { handleRequest } from '../playground/worker.js';
import { stampRig } from '../scripts/pose-fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
// A health bar's four states: one, two and three pixels, then full.
const bar = { version: 1, name: 'hp', width: 8, height: 1, palette: { g: '#00ff00' },
  frames: [1, 2, 3, 8].map((n, i) => ({ name: `s${i + 1}`, ops: [{ op: 'rect', x: 0, y: 0, w: n, h: 1, color: 'g' }] })), animations: {} };
const stillsText = /^the frames are stills \("animations": \{\} in the recipe\), so there is no animation to choose: list the frames to play under "animations".*remove the field to play every frame in order$/;
const temp = async t => {
  const base = path.resolve(os.tmpdir()), dir = await mkdtemp(path.join(base, 'pixelbolt-stills-'));
  t.after(async () => { assert.ok(dir.startsWith(base + path.sep)); await rm(dir, { recursive: true, force: true }); });
  return dir;
};
const cli = (...args) => spawnSync(process.execPath, ['bin/pixelbolt.js', ...args], { cwd: root, encoding: 'utf8' });

test('a patch that removes the last animation says once that the frames are now stills, with no phantom "default"', async t => {
  const walk = { ...bar, animations: { walk: { frames: ['s1', 's2'] } } };
  const reply = recipe => { const { image, ...report } = compareProjects(renderProject(walk), renderProject(recipe)); return briefComparison(report); };
  const removed = patchRecipe(walk, [{ remove: 'animations.walk' }]).recipe;
  assert.deepEqual(removed.animations, {});
  const brief = reply(removed);
  assert.deepEqual(brief.animations, { removed: ['walk'] });
  assert.match(brief.stills, /^the frames are now stills \("animations": \{\}\): .*remove the animations field to play every frame in order again/);
  // Back from stills: the named animation is added, and nothing called "default" was removed.
  const { image, ...back } = compareProjects(renderProject(bar), renderProject(walk));
  assert.deepEqual([back.animations, back.stills], [{ added: ['walk'] }, undefined]);
  // Stills to stills say nothing of animations. The flipbook of a recipe that left the field out was played, as
  // "default", so turning it into stills removes it.
  const same = briefComparison(compareProjects(renderProject(bar), renderProject(bar)));
  assert.deepEqual([same.animations, same.stills], [undefined, undefined]);
  const flipbook = briefComparison(compareProjects(renderProject({ ...bar, animations: undefined }), renderProject(bar)));
  assert.deepEqual(flipbook.animations, { removed: ['default'] }); assert.match(flipbook.stills, /now stills/);
  // The CLI's patch reply is shaped the same way.
  const dir = await temp(t), file = path.join(dir, 'walk.json'), changes = path.join(dir, 'changes.json');
  await writeFile(file, JSON.stringify(walk)); await writeFile(changes, JSON.stringify([{ remove: 'animations.walk' }]));
  const run = cli('patch', file, '--changes', changes, '--out', path.join(dir, 'walk2.json'));
  assert.equal(run.status, 0, run.stderr);
  const printed = JSON.parse(run.stdout);
  assert.deepEqual(printed.animations, { removed: ['walk'] }); assert.equal(printed.stills, brief.stills);
  assert.equal(run.stdout.split('now stills').length, 2);
});

test('stills offer no animation to choose: the check, inspect, render and pixel_render refuse one with the stills text', async t => {
  const project = renderProject(bar);
  for (const animation of ['walk', 'default']) {
    assert.throws(() => checkDelivery(project, { recipe: bar, animation }), error => error instanceof PixelError && error.path === 'animation' && stillsText.test(error.message.slice('animation: '.length)));
    assert.throws(() => inspectProject(project, { animation }), error => error.path === 'inspect.animation' && stillsText.test(error.message.slice('inspect.animation: '.length)));
  }
  const dir = await temp(t), file = path.join(dir, 'hp.json');
  await writeFile(file, JSON.stringify(bar));
  const rendered = cli('render', file, '--out', path.join(dir, 'out'), '--animation', 'default');
  assert.equal(rendered.status, 1); assert.doesNotMatch(rendered.stderr, /choose one of|animations\/default/);
  assert.match(JSON.parse(rendered.stderr).error, /^animation: the frames are stills/);
  const inspected = cli('inspect', file, '--animation', 'default');
  assert.equal(inspected.status, 1); assert.match(JSON.parse(inspected.stderr).error, /^inspect\.animation: the frames are stills/);
});

test('the check on stills offers no loop, and expect.gifScale is a problem with the stills text', () => {
  const plain = checkDelivery(renderProject(bar), { recipe: bar });
  assert.equal(plain.hint, 'Pass expect with what the user asked for (width, height, frames, colors, transparent, sheet) to check every file against it.');
  const asked = checkDelivery(renderProject(bar), { recipe: bar, expect: { gifScale: 2 } });
  assert.equal(asked.ok, false);
  assert.deepEqual(asked.problems.map(problem => [problem.file, problem.asked, problem.got]), [['gifs/', { gifScale: 2 }, 'stills']]);
  assert.match(asked.problems[0].fix, /^the frames are stills \("animations": \{\} in the recipe\), so there is no animation to make a GIF of: /);
});

test('validate --fps and inspect --diagnostics measure the frames of stills, not their flipbook', async t => {
  const project = renderProject({ ...bar, frames: bar.frames.map(frame => ({ ...frame, duration: 50 })) });
  const grid = frameGrid(project, 30);
  assert.equal(grid.animations, undefined); assert.equal(grid.offGrid.length, 4);
  assert.deepEqual(grid.notes, ['4 of 4 frame durations are not whole video frames of 33.333 ms; at integer milliseconds, whole frames at 30 fps are multiples of 100 ms.']);
  // The full bar back to one pixel would be a loop jump, if the states played as a loop.
  const flipbook = analyzeProject(renderProject({ ...bar, animations: undefined }));
  assert.ok(flipbook.findings.some(finding => finding.code === 'loop-jump'));
  const diagnostics = analyzeProject(renderProject(bar));
  assert.equal(diagnostics.animations, undefined); assert.equal(diagnostics.findings.some(finding => finding.code === 'loop-jump'), false);
  assert.equal(briefDiagnostics(diagnostics).animations, undefined);
  assert.deepEqual(briefDiagnostics(diagnostics).frames.map(row => row.frame), ['s1', 's2', 's3', 's4']);
  const dir = await temp(t), file = path.join(dir, 'hp.json');
  await writeFile(file, JSON.stringify(bar));
  const validated = cli('validate', file, '--fps', '30');
  assert.equal(validated.status, 0, validated.stderr);
  const reply = JSON.parse(validated.stdout);
  assert.deepEqual([reply.ok, reply.frames, reply.animations, reply.frameGrid.animations], [true, 4, undefined, undefined]);
  const inspected = cli('inspect', file, '--diagnostics');
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.doesNotMatch(inspected.stdout, /"default"|loop-jump/);
});

test('a pose source with "animations": {} compiles to a stills recipe, and validate accepts it', async t => {
  const { recipe } = compilePoses({ ...stampRig(16, 2, 3), animations: {} });
  assert.deepEqual([recipe.animations, recipe.frames.length, renderProject(recipe).stills], [{}, 3, true]);
  const dir = await temp(t), file = path.join(dir, 'stamp.json');
  await writeFile(file, JSON.stringify(recipe));
  const validated = cli('validate', file);
  assert.equal(validated.status, 0, validated.stderr);
  assert.deepEqual([JSON.parse(validated.stdout).frames, JSON.parse(validated.stdout).animations], [3, undefined]);
});

// A 2x2 tile set: two plain tiles with tile fields, on an opaque fill.
const tiles = { version: 1, name: 'floor', width: 2, height: 2, palette: { a: '#336633', b: '#663333' }, sheet: { padding: 0 },
  frames: [{ name: 'grass', tile: { weight: 1 }, ops: [{ op: 'rect', x: 0, y: 0, w: 2, h: 2, color: 'a' }] }, { name: 'dirt', tile: { weight: 2 }, ops: [{ op: 'rect', x: 0, y: 0, w: 2, h: 2, color: 'b' }] }] };
const meadow = compileAutotile(JSON.parse(await readFile(path.join(root, 'examples', 'meadow.autotile.json'), 'utf8'))).recipe;
test('an autotile set with "animations": {} delivers tiles, and the README of a tile set says opaque or transparent as its sheet is', async () => {
  for (const recipe of [meadow, { ...meadow, animations: {} }]) {
    const delivered = checkDelivery(renderProject(recipe), { recipe }).delivered;
    assert.deepEqual([delivered.tiles, delivered.stills, delivered.animations], [meadow.frames.length, undefined, undefined]);
  }
  for (const recipe of [{ ...tiles, animations: {} }]) {
    const delivered = checkDelivery(renderProject(recipe), { recipe }).delivered;
    assert.deepEqual([delivered.tiles, delivered.stills, delivered.animations], [undefined, 2, undefined]);
  }
  const readme = async recipe => (await createBundle(recipe)).files.get('README.txt').toString();
  assert.match(await readme(tiles), /^floor\.png: opaque RGBA tile sheet$/m);
  assert.match(await readme({ ...tiles, animations: {} }), /^floor\.png: opaque RGBA tile sheet$/m);
  assert.match(await readme({ ...tiles, sheet: { padding: 1 } }), /^floor\.png: transparent RGBA tile sheet$/m);
});

test('every exported atlas of stills or a still tile set lists frames alone: createBundle, exportAtlas and the playground', async () => {
  const strip = metadata => Object.keys(metadata).concat(metadata.meta.frameTags ? ['frameTags'] : []);
  for (const recipe of [bar, tiles, { ...tiles, animations: {} }]) {
    const project = renderProject(recipe), metadata = exportAtlas(recipe, project, buildAtlas(project).metadata);
    assert.deepEqual(strip(metadata), ['frames', 'meta']);
    assert.deepEqual(JSON.parse((await createBundle(recipe)).files.get(`${recipe.name}.atlas.json`)), JSON.parse(JSON.stringify(metadata)));
  }
  // A recipe that plays something keeps its animations and tags.
  const playing = { ...bar, animations: undefined }, project = renderProject(playing);
  assert.deepEqual(strip(exportAtlas(playing, project, buildAtlas(project).metadata)), ['frames', 'animations', 'meta', 'frameTags']);
  const engineURL = new URL('../src/', import.meta.url), request = { version: '0.17.0', override: engineURL.href, text: JSON.stringify(bar) };
  const preview = await handleRequest({ ...request, type: 'render' });
  assert.deepEqual([preview.stills, preview.project, preview.recipe], [true, undefined, undefined]);
  const atlas = await handleRequest({ ...request, type: 'export', export: 'atlas', scale: 1, frame: 0, animation: 'default' });
  const written = JSON.parse(new TextDecoder().decode(atlas.files[1].data));
  assert.deepEqual(strip(written), ['frames', 'meta']);
  const engine = await loadEngine(engineURL);
  assert.equal(engine.core.exportAtlas, exportAtlas);
});

// An MCP session whose export directory is <project>/output.
async function session(t, project) {
  const input = new PassThrough(), output = new PassThrough(), waiting = new Map(); let buffer = '', next = 0;
  output.on('data', chunk => { buffer += chunk; for (let end; (end = buffer.indexOf('\n')) !== -1; buffer = buffer.slice(end + 1)) { const message = JSON.parse(buffer.slice(0, end)); waiting.get(message.id)?.(message); } });
  const running = startMCP({ input, output, directory: path.join(project, 'output'), root: project });
  t.after(async () => { input.end(); await running; });
  const request = (method, params) => new Promise(resolve => { waiting.set(++next, resolve); input.write(JSON.stringify({ jsonrpc: '2.0', id: next, method, params }) + '\n'); });
  await request('initialize', { protocolVersion: '2025-11-25' });
  return async args => { const { result } = await request('tools/call', { name: 'pixel_render', arguments: args }); return { isError: result.isError === true, info: JSON.parse(result.content[0].text) }; };
}

test('pixel_render on stills refuses an animation and saveAs aliases stills cannot have, pointing at sheet, atlas or a frame', async t => {
  const project = await temp(t), render = await session(t, project);
  const refused = await render({ project: bar, animation: 'default' });
  assert.equal(refused.isError, true); assert.equal(refused.info.path, 'animation'); assert.match(refused.info.error, /^animation: the frames are stills/);
  const saveAs = /^saveAs\.[^:]+: the frames are stills \("animations": \{\}\), so this export has no SpriteFrames, animated PNGs or GIFs: save sheet, atlas or a still's own PNG, such as frames\/s1\.png$/;
  for (const key of ['godot', 'gif', 'apng', 'gifs/default.gif', 'animations/default.png']) {
    const { isError, info } = await render({ project: bar, saveAs: { [key]: `x${path.extname(key) || (key === 'godot' ? '.tres' : key === 'gif' ? '.gif' : '.png')}` } });
    assert.equal(isError, true, key); assert.match(info.error, saveAs, key);
    assert.doesNotMatch(info.error.slice(`saveAs.${key}: `.length), /default/);
  }
  // A saveAs gif key does not ask for GIFs of stills: no gif note, only the saveAs refusal above. The sheet saves.
  const saved = await render({ project: bar, saveAs: { sheet: 'hp.png', 'frames/s4.png': 'full.png' } });
  assert.equal(saved.isError, false, JSON.stringify(saved.info));
  assert.deepEqual([saved.info.saved.map(item => item.file), saved.info.warnings], [['hp.png', 'frames/s4.png'], []]);
});
