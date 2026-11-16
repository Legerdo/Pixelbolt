import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProject, inspectProject } from '../src/core.js';
import { decodePNG } from '../src/import.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A body, a plate that covers its right half, and a half-clear glow over its top row.
const recipe = { version: 1, name: 'parts', width: 4, height: 4, palette: { a: '#ff0000', b: '#0000ff', g: '#ffffff80' }, frames: [
  { name: 'body', ops: [{ op: 'rect', x: 0, y: 1, w: 4, h: 3, color: 'a' }] },
  { name: 'plate', ops: [{ op: 'rect', x: 2, y: 1, w: 2, h: 3, color: 'b' }] },
  { name: 'glow', ops: [{ op: 'rect', x: 0, y: 0, w: 4, h: 2, color: 'g' }] }] };
// The pixel (x, y) of cell n in a sheet drawn at scale 1.
const pixel = (sheet, n, x, y) => { const at = ((sheet.gap + y) * sheet.width + sheet.gap + n * (4 + sheet.gap) + x) * 4; return [...sheet.data.subarray(at, at + 4)]; };

test('P-167: inspect lays frames over one another in one cell, bottom first, as a game stacks them', () => {
  const project = renderProject(recipe);
  const view = inspectProject(project, { stack: [['body'], ['body', 'plate'], ['body', 'plate', 'glow']], scale: 1, background: 'transparent' });
  assert.deepEqual(view.cells.map(cell => cell.frame), ['body', 'body+plate', 'body+plate+glow']);
  assert.deepEqual([pixel(view.sheet, 0, 3, 2), pixel(view.sheet, 1, 0, 2), pixel(view.sheet, 1, 3, 2), pixel(view.sheet, 1, 0, 0)], [[255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 255, 255], [0, 0, 0, 0]]);
  // A half-clear pixel over an opaque one blends; over nothing it is itself.
  assert.deepEqual([pixel(view.sheet, 2, 0, 1), pixel(view.sheet, 2, 0, 0)], [[255, 128, 128, 255], [255, 255, 255, 128]]);
  // The project is not changed by it, and the cells take the other options as frames do.
  assert.deepEqual(project.frames.map(frame => frame.name), ['body', 'plate', 'glow']);
  const cropped = inspectProject(project, { stack: [['body', 'plate']], region: { x: 2, y: 1, w: 2, h: 2 }, scale: 1, background: 'transparent' });
  assert.deepEqual([cropped.region, [...cropped.sheet.data.subarray((cropped.sheet.gap * cropped.sheet.width + cropped.sheet.gap) * 4, (cropped.sheet.gap * cropped.sheet.width + cropped.sheet.gap) * 4 + 4)]], [{ x: 2, y: 1, w: 2, h: 2 }, [0, 0, 255, 255]]);
  for (const [options, where, message] of [[{ stack: [['body', 'nope']] }, 'inspect.stack[0][1]', /unknown frame "nope"/], [{ stack: [] }, 'inspect.stack', /at least one cell/], [{ stack: [[]] }, 'inspect.stack[0]', /one to sixteen frame names/],
    [{ stack: [['body']], frames: ['body'] }, 'inspect.stack', /omit frames and animation/], [{ stack: [['body']], view: 'parts' }, 'inspect.view', /a stack is several frames/]]) {
    assert.throws(() => inspectProject(project, options), error => error.path === where && message.test(error.message), JSON.stringify(options));
  }
});

test('P-167: inspect lays every cell over a picture from elsewhere, repeated: a sprite on its ground', () => {
  const project = renderProject(recipe);
  // A ground two pixels square: green, with one grey pixel.
  const under = { width: 2, height: 2, data: new Uint8ClampedArray([0, 128, 0, 255, 0, 128, 0, 255, 0, 128, 0, 255, 90, 90, 90, 255]) };
  const view = inspectProject(project, { frames: ['plate'], under, scale: 1 });
  assert.deepEqual([pixel(view.sheet, 0, 0, 0), pixel(view.sheet, 0, 1, 1), pixel(view.sheet, 0, 3, 3), pixel(view.sheet, 0, 2, 1)], [[0, 128, 0, 255], [90, 90, 90, 255], [0, 0, 255, 255], [0, 0, 255, 255]]);
  // Under a stack too; and not with what reads the recipe's own pixels.
  assert.deepEqual(pixel(inspectProject(project, { stack: [['body', 'plate']], under, scale: 1 }).sheet, 0, 1, 0), [0, 128, 0, 255]);
  for (const [options, message] of [[{ under, grid: true }, /grid and diagnostics read the recipe's own pixels/], [{ under, view: 'silhouette' }, /omit view/], [{ under: { width: 2, height: 2, data: new Uint8ClampedArray(3) } }, /as RGBA bytes/]]) {
    assert.throws(() => inspectProject(project, options), error => error.path.startsWith('inspect.under') && message.test(error.message), JSON.stringify(Object.keys(options)));
  }
});

test('P-167: the CLI takes --stack groups and --under a frame of another recipe', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pixelbolt-stack-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'parts.json'), ground = path.join(dir, 'ground.json'), out = path.join(dir, 'look.png');
  await writeFile(file, JSON.stringify(recipe));
  await writeFile(ground, JSON.stringify({ version: 1, name: 'ground', width: 2, height: 2, palette: { e: '#008000', s: '#5a5a5a' }, frames: [{ name: 'plain', ops: [{ op: 'rect', x: 0, y: 0, w: 2, h: 2, color: 'e' }] }, { name: 'stone', ops: [{ op: 'rect', x: 0, y: 0, w: 2, h: 2, color: 's' }] }] }));
  const run = (...args) => spawnSync(process.execPath, [path.join(root, 'bin/pixelbolt.js'), 'inspect', file, ...args], { encoding: 'utf8' });
  const stacked = run('--stack', 'body,body+plate', '--under', `${ground}:stone`, '--scale', '1', '--out', out);
  assert.equal(stacked.status, 0, stacked.stderr);
  assert.deepEqual(JSON.parse(stacked.stdout).cells, ['body, body+plate: 100 ms each']);
  const png = decodePNG(await readFile(out)), gap = (png.width - 8) / 3;
  // The top row of the first cell is the ground named (stone), and the second cell's right half is the plate.
  const at = (n, x, y) => { const i = ((gap + y) * png.width + gap + n * (4 + gap) + x) * 4; return [...png.data.subarray(i, i + 4)]; };
  assert.deepEqual([at(0, 0, 0), at(1, 3, 3), at(1, 0, 3)], [[90, 90, 90, 255], [0, 0, 255, 255], [255, 0, 0, 255]]);
  // Its first frame without a name; and a frame it has not is named with those it has.
  assert.equal(run('--under', ground, '--frames', 'plate').status, 0);
  assert.match(JSON.parse(run('--under', `${ground}:moss`).stderr).error, /--under .*ground\.json has no frame "moss"; its frames: plain, stone/);
  assert.match(JSON.parse(run('--stack', 'body++plate').stderr).error, /--stack expects groups of frame names: body\+plate,body\+fin/);
});
