// A patch whose corrections pass what a frame holds is refused with advice that works when followed: operations on the
// frame's top layer when it draws with layers (core draws frame.ops beneath them), and the same advice for a region
// change too large even to merge, on stills larger than an animation frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProject, PixelError } from '../src/core.js';
import { patchRecipe } from '../src/patch.js';
import { createToolRunner } from '../src/mcp.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const wall = (layers, extra = {}) => ({ version: 1, name: 'wall', width: 2048, height: 2048, palette: { a: '#102030', b: '#a0c0f0' }, frames: [{ name: 'f0', layers, ...extra }] });
const filled = color => ({ op: 'rect', x: 0, y: 0, w: 2048, h: 2048, color, filled: true });
const layered = wall([{ name: 'l', ops: [filled('a')] }]);
const recolor = { recolor: 'frames[f0]', value: { x: 0, y: 0, w: 600, h: 600, from: 'a', to: 'b' } };
const square = { op: 'rect', x: 0, y: 0, w: 600, h: 600, color: 'b', filled: true };
const advice = ops => `with this recolor, frame "f0" would have 360,000 pixel corrections, and a frame's corrections together hold at most 262,144: recolour or redraw an area this large with its top layer's operations (a set of ${ops} or an insert at ${ops}[-]), or change a smaller region`;
const insertAt = message => message.match(/an insert at (\S+)\)/)[1];
// The pixels that differ between two renders of the one frame, by colour key.
const differ = (before, after) => {
  const [a, b] = [before, after].map(recipe => renderProject(recipe).frames[0].data);
  let count = 0;
  for (let at = 0; at < a.length; at += 4) if (a[at] !== b[at] || a[at + 1] !== b[at + 1] || a[at + 2] !== b[at + 2] || a[at + 3] !== b[at + 3]) count++;
  return count;
};

test('the overflow advice on a layered frame names its top layer, and following it changes the 360,000 pixels', () => {
  assert.throws(() => patchRecipe(layered, [recolor]), error => error instanceof PixelError && error.path === 'changes[0].value' && error.message === `changes[0].value: ${advice('frames[f0].layers[l].ops')}`);
  // Old advice against new: an insert at frames[f0].ops[-] draws beneath the layer and changes nothing; the top layer's
  // operations change every pixel of the area, by insert or by set.
  const followed = path => patchRecipe(layered, [{ insert: path, value: square }]).recipe;
  assert.equal(differ(layered, followed('frames[f0].ops[-]')), 0);
  assert.equal(differ(layered, followed(insertAt(advice('frames[f0].layers[l].ops')))), 360000);
  const set = patchRecipe(layered, [{ set: 'frames[f0].layers[l].ops', value: [filled('a'), square] }]).recipe;
  assert.equal(differ(layered, set), 360000);
  // An unnamed top layer goes by index, and a hidden one is passed over for the shown layer beneath it.
  const unnamed = wall([{ name: 'back', ops: [filled('a')] }, { ops: [] }, { name: 'ghost', visible: false, ops: [] }]);
  assert.throws(() => patchRecipe(unnamed, [recolor]), { message: `changes[0].value: ${advice('frames[f0].layers[1].ops')}` });
  assert.equal(differ(unnamed, patchRecipe(unnamed, [{ insert: 'frames[f0].layers[1].ops[-]', value: square }]).recipe), 360000);
});

test('the overflow advice says the frame\'s pixel corrections still draw over its operations', () => {
  const corrected = wall([{ name: 'l', ops: [filled('a')] }], { pixels: [{ x: 5, y: 5, color: 'a' }, { x: 900, y: 900, color: 'b' }] });
  assert.throws(() => patchRecipe(corrected, [recolor]), { message: `changes[0].value: ${advice('frames[f0].layers[l].ops').replace('360,000', '360,001')}. The frame's 2 pixel corrections still draw over its operations (remove frames[f0].pixels to drop them)` });
  // As it says: the correction at 5,5 keeps its colour over the new rectangle until the corrections are removed.
  const drawn = patchRecipe(corrected, [{ insert: 'frames[f0].layers[l].ops[-]', value: square }]).recipe;
  assert.equal(differ(corrected, drawn), 359999);
  assert.equal(differ(corrected, patchRecipe(drawn, [{ remove: 'frames[f0].pixels' }]).recipe), 360001);
});

test('a region change too large to merge on a big still gets the same advice, and grid rows stay 1024 wide', () => {
  const at = { path: 'changes[0].value' };
  const refusal = (verb, count) => `changes[0].value: with this ${verb}, frame "f0" would have ${count} pixel corrections, and a frame's corrections together hold at most 262,144: recolour or redraw an area this large with its top layer's operations (a set of frames[f0].layers[l].ops or an insert at frames[f0].layers[l].ops[-]), or change a smaller region`;
  // A 600x600 move clears and writes 720,000 entries over 366,000 distinct pixels; before, each was 'expected a bounded pixel list'.
  assert.throws(() => patchRecipe(layered, [{ move: 'frames[f0]', value: { x: 0, y: 0, w: 600, h: 600, dx: 10, dy: 0 } }]), { ...at, message: refusal('move', '366,000') });
  assert.throws(() => patchRecipe(layered, [{ recolor: 'frames[f0]', value: { x: 0, y: 0, w: 2048, h: 2048, from: 'a', to: 'b' } }]), { ...at, message: refusal('recolor', '4,194,304') });
  assert.throws(() => patchRecipe(layered, [{ grid: 'frames[f0]', value: { x: 0, y: 0, rows: Array(1024).fill('b'.repeat(1024)) } }]), { ...at, message: refusal('grid', '1,048,576') });
  // A grid row is at most 1024 characters, as core's readRows takes, though the still is 2048 wide.
  assert.throws(() => patchRecipe(layered, [{ grid: 'frames[f0]', value: { x: 0, y: 0, rows: Array(1024).fill('b'.repeat(2048)) } }]), { path: 'changes[0].value.rows[0]', message: 'changes[0].value.rows[0]: row must contain 1–1024 characters' });
  assert.equal(patchRecipe(layered, [{ grid: 'frames[f0]', value: { x: 1024, y: 0, rows: Array(256).fill('b'.repeat(1024)) } }]).recipe.frames[0].pixels.length, 262144);
});

test('over the CLI and MCP, following the overflow advice on a layered 2048x2048 still changes the 360,000 pixels', async t => {
  const base = path.resolve(os.tmpdir()), dir = await mkdtemp(path.join(base, 'pixelbolt-patch-overflow-'));
  t.after(async () => { assert.ok(dir.startsWith(base + path.sep)); await rm(dir, { recursive: true, force: true }); });
  const file = name => path.join(dir, name);
  await writeFile(file('wall.json'), JSON.stringify(layered));
  const cli = async (changes, out) => {
    await writeFile(file('changes.json'), JSON.stringify(changes));
    const run = spawnSync(process.execPath, [path.join(root, 'bin', 'pixelbolt.js'), 'patch', file('wall.json'), '--changes', file('changes.json'), '--out', file(out)], { encoding: 'utf8' });
    return JSON.parse(run.stdout || run.stderr);
  };
  const refused = await cli([recolor], 'refused.json');
  assert.deepEqual([refused.ok, refused.path, refused.error], [false, 'changes[0].value', `changes[0].value: ${advice('frames[f0].layers[l].ops')}`]);
  const moved = await cli([{ move: 'frames[f0]', value: { x: 0, y: 0, w: 600, h: 600, dx: 10, dy: 0 } }], 'moved.json');
  assert.match(moved.error, /would have 366,000 pixel corrections.*an insert at frames\[f0\]\.layers\[l\]\.ops\[-\]/);
  const followed = await cli([{ insert: insertAt(refused.error), value: square }], 'followed.json');
  assert.deepEqual(followed.frames.changed, [{ frame: 'f0', pixels: 360000, box: { x: 0, y: 0, w: 600, h: 600 }, transitions: [{ from: 'a', to: 'b', pixels: 360000 }] }]);
  assert.equal(differ(layered, JSON.parse(await readFile(file('followed.json'), 'utf8'))), 360000);

  const run = createToolRunner({ directory: dir, root: dir, version: '0.0.0' });
  const failed = await run('pixel_patch', { project: layered, changes: [recolor] });
  assert.equal(failed.isError, true);
  const reply = JSON.parse(failed.content[0].text);
  assert.equal(reply.path, 'changes[0].value');
  assert.ok(reply.error.endsWith(advice('frames[f0].layers[l].ops')), reply.error);
  const grid = await run('pixel_patch', { project: layered, changes: [{ grid: 'frames[f0]', value: { x: 0, y: 0, rows: Array(1024).fill('b'.repeat(1024)) } }] });
  assert.match(JSON.parse(grid.content[0].text).error, /would have 1,048,576 pixel corrections.*an insert at frames\[f0\]\.layers\[l\]\.ops\[-\]/);
  const done = await run('pixel_patch', { project: layered, changes: [{ insert: insertAt(reply.error), value: square }] });
  assert.ok(!done.isError, done.content[0].text);
  assert.deepEqual(JSON.parse(done.content[0].text).frames.changed[0].transitions, [{ from: 'a', to: 'b', pixels: 360000 }]);
});
