// Contact sheets and motion review of screen-sized frames (up to 1024 a side and 262,144 pixels): what they show when
// one PNG of 16,777,216 pixels cannot hold every cell, and how each route (inspect, render --look, gif --sheet, MCP
// pixel_inspect and pixel_render, --beside, the parts view, every, motion) says so instead of failing in the encoder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PixelError, renderProject, inspectProject, stackViews } from '../src/core.js';
import { inspectMotion } from '../src/motion.js';
import { encodePNG } from '../src/png.js';
import { decodePNG } from '../src/import.js';
import { createToolRunner } from '../src/mcp.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG_PIXELS = 16777216;
// A dark ground and a red square moving right, in two layers; `plays` repeats the frames in the animation.
const screen = (width, height, count, { plays = 1, part = 'square' } = {}) => ({
  version: 1, name: 'screen', width, height, palette: { k: '#102030', r: '#e04030' },
  frames: Array.from({ length: count }, (_, i) => ({ name: `f${i}`, duration: 80, layers: [
    { name: 'ground', ops: [{ op: 'rect', x: 0, y: 0, w: width, h: height, color: 'k' }] },
    { name: part, ops: [{ op: 'rect', x: i * 8, y: 4, w: 8, h: 8, color: 'r' }] }] })),
  animations: { run: { frames: Array.from({ length: count * plays }, (_, i) => `f${i % count}`) } }
});
const encodes = sheet => { assert.ok(sheet.width * sheet.height <= PNG_PIXELS); return decodePNG(encodePNG(sheet.data, sheet.width, sheet.height)); };
const folder = async (t, name) => { const dir = await mkdtemp(path.join(os.tmpdir(), `pixelbolt-${name}-`)); t.after(() => rm(dir, { recursive: true, force: true })); return dir; };
const cliIn = dir => (...args) => spawnSync(process.execPath, [path.join(root, 'bin', 'pixelbolt.js'), ...args], { cwd: dir, encoding: 'utf8' });
const runner = async t => {
  const dir = await folder(t, 'sheets-mcp'), run = createToolRunner({ directory: dir, root: dir, version: '0.0.0' });
  return async (name, args) => {
    const result = await run(name, args);
    assert.ok(!result.isError, result.content?.[0]?.text);
    return { info: JSON.parse(result.content[0].text), images: result.content.filter(c => c.type === 'image') };
  };
};

test('maxCells counts the cells a sheet holds across and down apart, so a 1024x256 preview shows all 16 frames', async t => {
  const project = renderProject(screen(1024, 256, 16)), view = inspectProject(project, { maxCells: 256 });
  // floor(4094 / 1026) * floor(4094 / 258) = 3 * 15 = 45, not floor(4094 / 1026) squared = 9.
  assert.deepEqual([view.cells.length, view.sampling], [16, undefined]);
  // A square frame keeps the old count: 512x512 holds 7 * 7.
  assert.equal(inspectProject(renderProject(screen(512, 512, 16, { plays: 4 })), { animation: 'run', maxCells: 256, scale: 1 }).cells.length, 49);
  const call = await runner(t), { info } = await call('pixel_render', { project: screen(1024, 256, 16) });
  assert.deepEqual([info.preview.cells, info.preview.sampling], [['f0 … f15: 80 ms each'], undefined]);
});

test('every refuses to drop cells that do not fit, naming the every that does', () => {
  const project = renderProject(screen(512, 512, 16, { plays: 4 }));
  assert.throws(() => inspectProject(project, { animation: 'run', every: 80 }), error => error instanceof PixelError && error.path === 'inspect.every'
    && error.message === 'inspect.every: 5120 ms at one cell per 80 ms is 64 cells, and one 4096-pixel sheet of 512×512 cells holds 56; choose every 92 or more');
  const fits = inspectProject(project, { animation: 'run', every: 92 });
  assert.deepEqual([fits.cells.length, fits.sampling.every, fits.sampling.method], [56, 92, 'one cell per 92 ms of playback; a frame fills a cell for each 92 ms it is held']);
  encodes(fits.sheet);
  // maxCells below the cells every makes is refused the same way.
  assert.throws(() => inspectProject(renderProject(screen(32, 32, 16, { plays: 4 })), { animation: 'run', every: 80, maxCells: 10 }),
    { path: 'inspect.every', message: 'inspect.every: 5120 ms at one cell per 80 ms is 64 cells, and maxCells allows 10; choose every 512 or more' });
});

test('the parts legend has room kept for it when big frames are fitted, and the sheet with it encodes', () => {
  // A long part name: without its room, 60 cells of 1024x256 fill the PNG and the legend takes the sheet past it.
  const part = 'a-very-long-part-name-that-widens-the-legend-of-the-parts-view';
  const project = renderProject(screen(1024, 256, 16, { plays: 4, part }), { owners: true });
  const view = inspectProject(project, { animation: 'run', view: 'parts' });
  assert.ok(view.sampling.shown < 60 && view.sampling.shown > 40, `${view.sampling.shown} cells`);
  const sheet = encodes(view.sheet);
  assert.ok(sheet.width > view.sheet.columns * 1024 + 300, 'the legend sits right of the cells');
  // Without the legend the same play order fits more cells.
  assert.ok(inspectProject(project, { animation: 'run' }).sampling.shown > view.sampling.shown);
});

test('beside fits each sheet to its share of the one image, and a stack that would still pass it is a PixelError', async t => {
  const big = renderProject(screen(512, 512, 16, { plays: 4 }));
  // Inspected each on its own, two 3600x4114 sheets stack past the PNG.
  const alone = [1, 2].map(n => ({ ...inspectProject(big, { animation: 'run' }), name: `v${n}` }));
  assert.throws(() => stackViews(alone), error => error instanceof PixelError && error.path === 'beside' && /the 2 sheets stacked would be 3600×\d+ pixels, past the 16,777,216 one PNG holds; compare fewer recipes/.test(error.message));
  const shared = stackViews([1, 2, 3].map(n => ({ ...inspectProject(big, { animation: 'run', sheets: 3 }), name: `v${n}` })));
  encodes(shared.sheet);
  assert.equal(shared.stack.length, 3);
  // The CLI and MCP pass the share themselves.
  const dir = await folder(t, 'sheets-beside'), cli = cliIn(dir);
  await writeFile(path.join(dir, 'a.json'), JSON.stringify(screen(512, 512, 16, { plays: 4 })));
  await writeFile(path.join(dir, 'b.json'), JSON.stringify(screen(512, 512, 16, { plays: 4 })));
  const made = cli('inspect', 'a.json', '--animation', 'run', '--beside', 'b.json,a.json', '--out', 'beside.png');
  assert.equal(made.status, 0, made.stderr);
  const reply = JSON.parse(made.stdout);
  assert.deepEqual(reply.stack.map(s => s.name), ['a.json', 'b.json', 'a.json']);
  encodes(decodePNG(await readFile(path.join(dir, 'beside.png'))));
  const call = await runner(t), { info: first } = await call('pixel_inspect', { project: screen(512, 512, 16, { plays: 4 }) });
  const { info, images } = await call('pixel_inspect', { revision: first.revision, animation: 'run', beside: [first.revision, first.revision] });
  assert.deepEqual([info.stack.length, images.length], [3, 1]);
  assert.ok(info.sheet.width * info.sheet.height <= PNG_PIXELS);
});

test('a 512x512 animation of 16 frames played 4 times is sampled to fit on every route, never a plain encoder error', async t => {
  const dir = await folder(t, 'sheets-routes'), cli = cliIn(dir), recipe = screen(512, 512, 16, { plays: 4 });
  await writeFile(path.join(dir, 'long.json'), JSON.stringify(recipe));
  const said = /^56 of the 64 frames, evenly spaced to fit the 4096-pixel sheet, including endpoints; /;
  const inspected = cli('inspect', 'long.json', '--animation', 'run', '--out', 'long.png');
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.deepEqual([JSON.parse(inspected.stdout).sampling.shown, JSON.parse(inspected.stdout).sampling.total], [56, 64]);
  encodes(decodePNG(await readFile(path.join(dir, 'long.png'))));
  const look = cli('render', 'long.json', '--out', 'made', '--look', '--animation', 'run');
  assert.equal(look.status, 0, look.stderr);
  assert.match(JSON.parse(look.stdout).lookShows, said);
  const gif = cli('gif', 'long.json', '--out', 'long.gif', '--sheet', 'sheet.png');
  assert.equal(gif.status, 0, gif.stderr);
  assert.match(JSON.parse(gif.stdout).sheetShows, said);
  encodes(decodePNG(await readFile(path.join(dir, 'sheet.png'))));
  const call = await runner(t), { info } = await call('pixel_inspect', { project: recipe, animation: 'run' });
  assert.deepEqual([info.sampling.shown, info.sampling.total], [56, 64]);
});

test('motion review fits its timing cells to frames over 256 tall and says what it sampled', async t => {
  const project = renderProject(screen(512, 512, 16));
  // Four columns of 16 512x512 cells pass 4,194,304 pixels; fifteen fit in three columns.
  const review = inspectMotion(project, { animation: 'run', ground: 511 });
  assert.deepEqual(review.sampling, { total: 16, shown: 15, omitted: 1, method: 'evenly spaced, including endpoints: as many 512×512 frames as fit the 4,194,304-pixel image' });
  assert.deepEqual([review.cells.length, review.cells[0].position, review.cells.at(-1).position], [15, 0, 15]);
  assert.ok(review.nativeSheet.width * review.nativeSheet.height <= 4194304);
  // The ground line is drawn under the first cell's last row, 511.
  const { data, width } = review.nativeSheet, [x, y] = review.cells[0].timing, at = ((y + 512) * width + x + 100) * 4;
  assert.deepEqual([...data.subarray(at, at + 4)], [80, 100, 115, 255]);
  // Small frames keep 4 columns of at most 32 samples, and say nothing of sampling when every frame is shown.
  const small = inspectMotion(renderProject(screen(64, 64, 8)), { animation: 'run' });
  assert.deepEqual([small.sampling, small.cells[4].timing[1] > small.cells[3].timing[1]], [undefined, true]);
  // Over MCP, with a ground row past 255.
  const call = await runner(t), { info } = await call('pixel_inspect', { project: screen(512, 512, 16), animation: 'run', view: 'motion', ground: 500 });
  assert.deepEqual([info.sampling.shown, info.motion.ground], [15, 500]);
});
