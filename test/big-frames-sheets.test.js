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
// `parts` above 1 draws that many squares, each its own layer named after `part`.
const screen = (width, height, count, { plays = 1, part = 'square', parts = 1 } = {}) => ({
  version: 1, name: 'screen', width, height, palette: { k: '#102030', r: '#e04030' },
  frames: Array.from({ length: count }, (_, i) => ({ name: `f${i}`, duration: 80, layers: [
    { name: 'ground', ops: [{ op: 'rect', x: 0, y: 0, w: width, h: height, color: 'k' }] },
    ...Array.from({ length: parts }, (_, p) => ({ name: parts > 1 ? `${part}-${String(p).padStart(2, '0')}` : part, ops: [{ op: 'rect', x: (i * 8 + p) % width, y: 4 + p, w: 8, h: 8, color: 'r' }] }))] })),
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
  // Never thinned instead: the sampling of a sheet by time always reads as playback.
  assert.throws(() => inspectProject(project, { animation: 'run', every: 40 }), { path: 'inspect.every',
    message: 'inspect.every: 5120 ms at one cell per 40 ms is 128 cells, and one 4096-pixel sheet of 512×512 cells holds 56; choose every 92 or more' });
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
  assert.deepEqual(review.sampling, { total: 16, shown: 15, omitted: 1, method: 'evenly spaced, including endpoints: as many 512×512 frames as fit the 4,194,304-pixel image, 4096 a side' });
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

test('the parts legend reserves the columns it is drawn in beside the fitted sheet, not one column per twelve names', () => {
  // 30 parts named 40 characters each: the legend beside a sheet thousands of pixels tall is one column.
  for (const [w, h, count, cells] of [[640, 360, 18, 66], [512, 512, 16, 56]]) {
    const project = renderProject(screen(w, h, count, { plays: 4, part: 'p'.repeat(37), parts: 30 }), { owners: true });
    const view = inspectProject(project, { animation: 'run', view: 'parts' });
    assert.equal(view.cells.length, cells, `${w}x${h}`);
    encodes(view.sheet);
  }
});

test('views stacked beside one another stay within 8,000 pixels tall, each sheet fitted to its share', async t => {
  for (const [w, h, count] of [[512, 512, 16], [640, 360, 18]]) for (const n of [4, 9]) {
    const big = renderProject(screen(w, h, count, { plays: 4 }));
    const stacked = stackViews(Array.from({ length: n }, (_, i) => ({ ...inspectProject(big, { animation: 'run', sheets: n }), name: `v${i}` })));
    assert.ok(stacked.sheet.height <= 8000 && stacked.sheet.width <= 4096, `${n} views of ${w}x${h}: ${stacked.sheet.width}x${stacked.sheet.height}`);
    assert.ok(stacked.cells.length >= 6, `${n} views of ${w}x${h}: ${stacked.cells.length} cells`);
    encodes(stacked.sheet);
  }
  // Small frames take a smaller scale rather than nine sheets of 1024 pixels.
  const small = renderProject(screen(64, 64, 16)), nine = scale => Array.from({ length: 9 }, (_, i) => ({ ...inspectProject(small, { scale, sheets: 9 }), name: `v${i}` }));
  assert.ok(stackViews(nine()).sheet.height <= 8000);
  // A scale asked for is kept, so a stack that passes the height is refused by stackViews.
  assert.throws(() => stackViews(nine(4)), error => error instanceof PixelError && error.path === 'beside' && /^beside: the 9 sheets stacked would be \d+×9612 pixels, taller than the 8,000 a model reads an image at; compare fewer recipes/.test(error.message));
  // A frame too tall for its share even alone is refused with how many recipes fit.
  assert.throws(() => inspectProject(renderProject(screen(256, 1024, 4)), { sheets: 9 }), { path: 'inspect.sheets',
    message: 'inspect.sheets: one row of 256×1024 cells is 1052 pixels tall with its gutters and label, past the 888 each of 9 sheets stacked in one image may take (8,000 in all); compare at most 6 other recipes, or show a smaller region' });
  // The CLI passes the share: three copies beside a 512x512 animation.
  const dir = await folder(t, 'sheets-stack'), cli = cliIn(dir);
  await writeFile(path.join(dir, 'a.json'), JSON.stringify(screen(512, 512, 16, { plays: 4 })));
  const made = cli('inspect', 'a.json', '--animation', 'run', '--beside', 'a.json,a.json,a.json', '--out', 'four.png');
  assert.equal(made.status, 0, made.stderr);
  const image = decodePNG(await readFile(path.join(dir, 'four.png')));
  assert.ok(image.height <= 8000 && image.width <= 4096, `${image.width}x${image.height}`);
});

test('motion review keeps both sides of its strip within 4096, in the squarest grid, and says why a trajectory is left out', () => {
  for (const [w, h, count, shown] of [[480, 490, 17, 16], [490, 480, 17, 16], [640, 360, 18, 16], [360, 640, 18, 16]]) {
    const review = inspectMotion(renderProject(screen(w, h, count)), { animation: 'run', ground: h - 1, speed: 20 });
    const { width, height } = review.nativeSheet;
    assert.ok(width <= 4096 && height <= 4096 && width * height <= 4194304, `${w}x${h}x${count}: ${width}x${height}`);
    // Four columns: 16 cells in a square grid rather than one row or column of 17.
    assert.deepEqual([review.cells.length, review.cells[4].timing[1] > review.cells[3].timing[1]], [shown, true], `${w}x${h}x${count}`);
    // A few pixels of travel: what does not fit is the panel of lanes beside the cells, and the reason says so.
    assert.deepEqual(review.trajectory, { shown: false, reason: `The trajectory panel (${Math.round(20 * (count - 1) * 80 / 1000) + w + 8} pixels wide, lanes of ${w}×${h} frames) does not fit beside the timing cells within the 4,194,304-pixel image.` });
  }
  // Tall frames take fewer lanes when that fits: 400x400 in five.
  const lanes = inspectMotion(renderProject(screen(400, 400, 12)), { animation: 'run', speed: 20 });
  assert.deepEqual([lanes.trajectory.shown, lanes.trajectory.lanes], [true, 5]);
  assert.ok(lanes.nativeSheet.width * lanes.nativeSheet.height <= 4194304);
  // Small frames keep eight.
  assert.equal(inspectMotion(renderProject(screen(256, 256, 16)), { animation: 'run', speed: 20 }).trajectory.lanes, 8);
  // Travel wider than the image is said as travel.
  assert.equal(inspectMotion(renderProject(screen(64, 64, 32)), { animation: 'run', speed: 4000 }).trajectory.reason, 'Travel exceeds the 4096-pixel width: 9920 pixels of travel beside a 64-pixel frame.');
});
