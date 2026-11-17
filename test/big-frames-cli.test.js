import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProject } from '../src/core.js';
import { checkDelivery } from '../src/check.js';
import { patchRecipe } from '../src/patch.js';
import { prepareScene } from '../src/scene.js';
import { sceneGIF } from '../src/scene-export.js';
import { createToolRunner } from '../src/mcp.js';

// What the CLI, the check and the scene GIF say when a big frame passes a limit: each refusal names the change that
// gets through, and following it does.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screen = (width, height, frames, extra = {}) => ({
  version: 1, name: 'screen', width, height, palette: { k: '#102030', s: '#a0c0f0' },
  frames: Array.from({ length: frames }, (_, i) => ({ name: `f${i}`, ops: [{ op: 'rect', x: 0, y: 0, w: width, h: height, color: 'k' }, { op: 'pixel', x: i % width, y: 0, color: 's' }] })),
  ...extra
});
const pixelbolt = (args, cwd) => {
  const run = spawnSync(process.execPath, [path.join(root, 'bin', 'pixelbolt.js'), ...args], { cwd, encoding: 'utf8' });
  return JSON.parse(run.status === 0 ? run.stdout : run.stderr);
};
const folder = async t => { const dir = await mkdtemp(path.join(os.tmpdir(), 'pixelbolt-big-cli-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; };

test('the CLI\'s budget for every GIF names the largest --gif-scale that fits, as MCP names gif.scale', async t => {
  const dir = await folder(t), names = Array.from({ length: 12 }, (_, i) => `f${i}`);
  await writeFile(path.join(dir, 'title.json'), JSON.stringify(screen(640, 360, 12, { animations: { a: { frames: names }, b: { frames: names } } })));
  // Before: "all animations at this scale exceed 67,108,864 pixels; use a lower scale", naming none.
  const refused = pixelbolt(['render', 'title.json', '--out', 'four', '--gif-scale', '4'], dir);
  assert.equal(refused.error, '--gif-scale: the GIFs of every animation at scale 4 pass the 67,108,864 pixels one render\'s GIFs hold; --gif-scale 3 is the largest that fits');
  const followed = pixelbolt(['render', 'title.json', '--out', 'three', '--gif-scale', '3'], dir);
  assert.equal(followed.ok, true);
  assert.deepEqual([followed.gifs.width, followed.gifs.height], [1920, 1080]);
});

test('compile --size refuses a recipe tied to its canvas before counting its frames', async t => {
  const dir = await folder(t);
  // Before: "19 frames of 640×360 ... 18 frames fit: use fewer frames", and after --frames 1 the outline refusal.
  const iso = pixelbolt(['compile', '--preset', 'iso-tiles', '--size', '640x360', '--out', 'iso.json'], dir);
  assert.match(iso.error, /^--size: frames\[\d+\]\.ops\[\d+\] is "outline", which reads the whole canvas, so this recipe cannot move to another canvas size/);
  // Before: "151 frames ... 72 fit", and after --frames 72 the tile refusal.
  for (const size of ['640x360', '320x180']) {
    const ground = pixelbolt(['compile', '--preset', 'ground', '--size', size, '--out', 'ground.json'], dir);
    assert.equal(ground.error, '--size: frames[0].tile is tied to the canvas size, so this recipe cannot move to another one; change the size in its source instead');
  }
});

test('a frame-total refusal for several animations names the --frames that fits, and --animation', async t => {
  const dir = await folder(t);
  // Before: "... so 72 frames of 320×180 fit: use fewer frames or a smaller canvas", and --frames 72 changed nothing.
  const total = "107 frames of 320×180 are 6,163,200 pixels; a recipe's frames hold at most 4,194,304 in all, so 72 frames of 320×180 fit: use fewer frames or a smaller canvas";
  const refused = pixelbolt(['compile', '--preset', 'fire-spells', '--size', '320x180', '--out', 'all.json'], dir);
  assert.equal(refused.error, `--size: ${total}; --frames 6 keeps 66 (6 of each animation's, evenly spaced), or keep fewer animations with --animation <name>`);
  const kept = pixelbolt(['compile', '--preset', 'fire-spells', '--size', '320x180', '--frames', '6', '--out', 'six.json'], dir);
  assert.deepEqual([kept.ok, kept.frames, kept.width], [true, 66, 320]);
  assert.equal(pixelbolt(['compile', '--preset', 'fire-spells', '--size', '320x180', '--animation', 'impact', '--out', 'one.json'], dir).ok, true);
  // A GIF plays one animation, so --animation keeps only it before the canvas moves.
  const gif = pixelbolt(['gif', '--preset', 'fire-spells', '--size', '320x180', '--animation', 'impact', '--out', 'impact.gif'], dir);
  assert.deepEqual([gif.ok, gif.width, gif.frames], [true, 320, 12]);
  // MCP names its own options.
  const run = createToolRunner({ directory: dir, root: dir, version: '0.0.0' });
  const mcp = JSON.parse((await run('pixel_compile', { preset: 'fire-spells', size: '320x180', frames: 72 })).content[0].text);
  assert.equal(mcp.error, `size: ${total}; frames 6 keeps 66 (6 of each animation's, evenly spaced), or keep fewer animations with animation <name>`);
  const followed = JSON.parse((await run('pixel_compile', { preset: 'fire-spells', size: '320x180', frames: 6 })).content[0].text);
  assert.deepEqual([followed.ok, followed.frames], [true, 66]);
});

test('the check\'s direct fix sets sheet.scale 1 inside its patch, and applying the patch passes', () => {
  const recipe = screen(24, 24, 2, { sheet: { scale: 2 } }), expect = { width: 600, height: 400 };
  const fix = checkDelivery(renderProject(recipe), { recipe, expect }).problems[0].fix;
  // Before: "(pixel_patch [width, height] and sheet.scale 1)", whose quoted patch left the sheet at 2x.
  assert.match(fix, /^the canvas is 24x24 at sheet\.scale 2: change the recipe's width and height with sheet\.scale 1 \(pixel_patch \[/);
  const patch = JSON.parse(/pixel_patch (\[.*?\])\)/.exec(fix)[1]);
  assert.deepEqual(patch, [{ set: 'width', value: 600 }, { set: 'height', value: 400 }, { set: 'sheet.scale', value: 1 }]);
  const patched = patchRecipe(recipe, patch).recipe, check = checkDelivery(renderProject(patched), { recipe: patched, expect });
  assert.equal(check.problems, undefined);
  // At scale 1 the patch is the canvas alone.
  const plain = screen(24, 24, 2);
  assert.match(checkDelivery(renderProject(plain), { recipe: plain, expect }).problems[0].fix, /^the canvas is 24x24: change the recipe's width and height \(pixel_patch \[\{ "set": "width", "value": 600 \}, \{ "set": "height", "value": 400 \}\]\)/);
});

test('a scene GIF names the largest scale at which its whole loop fits, up front', () => {
  // 18 frames of a 320x180 asset in a 320x180 scene, played as 45 GIF frames: 2,592,000 pixels at scale 1.
  const scene = prepareScene({ format: 'pixelforge-scene', version: 1, name: 's', width: 320, height: 180, duration: 1800,
    assets: { a: screen(320, 180, 18, { frames: screen(320, 180, 18).frames.map(frame => ({ ...frame, duration: 100 })) }) },
    instances: [{ asset: 'a', at: [0, 0], animation: 'default' }] });
  // Before: "8 or less fits" for one image at 16, then at 8 "more than 12 frames at 2560×1440 exceed 134,217,728 pixels;
  // shorten the loop or use smaller frames", naming no scale.
  assert.throws(() => sceneGIF(scene, { scale: 16 }), { path: 'scale', message: 'scale: at scale 16 the 45 frames of the 320×180 scene are 5120×2880, 663,552,000 pixels in all, past the 134,217,728 a GIF holds; scale 7 is the largest that fits, or shorten the scene' });
  assert.throws(() => sceneGIF(scene, { scale: 8 }), { message: /; scale 7 is the largest that fits, or shorten the scene$/ });
  const gif = sceneGIF(scene, { scale: 7 });
  assert.deepEqual([gif.width, gif.height, gif.frames], [2240, 1260, 45]);
});

test('a sheet refusal names --columns or columns when the call set the columns', async t => {
  const dir = await folder(t), recipe = screen(420, 420, 3);
  await writeFile(path.join(dir, 'tall.json'), JSON.stringify(recipe));
  const tail = 'at scale 5 the 3 frames of 420×420 make an atlas of 4200×4200, past the 16,777,216 pixels one PNG holds; scale 4 is the largest that fits, or';
  // Before: "sheet.columns 1 at scale 5", which --columns 2 overrides, so the patch changed nothing.
  assert.equal(pixelbolt(['render', 'tall.json', '--out', 'o', '--scale', '5', '--columns', '2'], dir).error, `project.sheet.scale: ${tail} --columns 1 at scale 5`);
  const run = createToolRunner({ directory: dir, root: dir, version: '0.0.0' });
  assert.equal(JSON.parse((await run('pixel_render', { project: recipe, scale: 5, columns: 2 })).content[0].text).error, `project.sheet.scale: ${tail} columns 1 at scale 5`);
  // Columns from the recipe itself are still the recipe's.
  await writeFile(path.join(dir, 'two.json'), JSON.stringify({ ...recipe, sheet: { columns: 2 } }));
  assert.equal(pixelbolt(['render', 'two.json', '--out', 'p', '--scale', '5'], dir).error, `project.sheet.scale: ${tail} sheet.columns 1 at scale 5`);
});

test('help says how the largest render scale and a --beside stack are bounded', () => {
  const help = spawnSync(process.execPath, [path.join(root, 'bin', 'pixelbolt.js'), '--help'], { encoding: 'utf8' }).stdout.replace(/\s+/g, ' ');
  assert.match(help, /sheet\.scale, for this export; the largest depends on frame size and count\)/);
  assert.match(help, /at the automatic scale the stack is kept within 8,000 px tall/);
});
