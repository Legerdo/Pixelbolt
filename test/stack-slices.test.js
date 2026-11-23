import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderProject, buildAtlas } from '../src/core.js';
import { createBundle } from '../src/export.js';
import { compileStack, compileStackSlices, prepareStack } from '../src/stack.js';
import { spriteFrames } from '../src/godot.js';
import { drawStack } from '../src/runtime.js';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMCP } from '../src/mcp.js';
import { cliReply } from './fixtures/cli-reply.js';

const root = fileURLToPath(new URL('../', import.meta.url));

const fill = (w, h, key) => Array.from({ length: h }, () => key.repeat(w));
const stack = { format: 'pixelforge-stack', version: 1, name: 'sliced', palette: { a: '#402010', b: '#804020', c: '#c08040', t: '#8090a0', k: '#102030' }, headings: [0, 90, 180, 270] };

// A canvas context that keeps its transform and draws images by nearest sampling, as a canvas with smoothing off does.
function softCanvas(width, height) {
  const data = new Uint8ClampedArray(width * height * 4), saved = [];
  let m = [1, 0, 0, 1, 0, 0];
  const mul = ([a, b, c, d, e, f], [A, B, C, D, E, F]) => [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
  return { data, width, height, draws: 0,
    save() { saved.push(m); }, restore() { m = saved.pop(); },
    translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); }, scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate(turn) { const c = Math.round(Math.cos(turn) * 1e9) / 1e9, s = Math.round(Math.sin(turn) * 1e9) / 1e9; m = mul(m, [c, s, -s, c, 0, 0]); },
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
      this.draws++;
      const [a, b, c, d, e, f] = m, det = a * d - b * c;
      for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
        const X = px + .5 - e, Y = py + .5 - f, u = ((d * X - c * Y) / det - dx) / dw, v = ((a * Y - b * X) / det - dy) / dh;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        const at = ((sy + Math.floor(v * sh)) * image.width + sx + Math.floor(u * sw)) * 4;
        if (image.data[at + 3]) data.set(image.data.subarray(at, at + 4), (py * width + px) * 4);
      }
    } };
}
const sheetOf = (recipe, options) => { const atlas = buildAtlas(renderProject(recipe), options); return { image: { data: atlas.data, width: atlas.width }, atlas: atlas.metadata }; };

test('a stack\'s slices compile to a sheet: a frame a slice, ground first, with the pivot and a cell\'s one colour', () => {
  const source = { ...stack, slices: [fill(4, 3, 'b'), ['....', '.tt.', '....'], ['....', '....', '....'], ['....', '.k..', '....']],
    paint: [{ face: 'south', at: [0, 3], rows: ['k'] }, { face: 'west', at: [1, 3], rows: ['t'], depth: 2 }] };
  const { recipe, metadata, warnings } = compileStackSlices(source);
  assert.deepEqual([recipe.width, recipe.height, recipe.frames.map(frame => frame.name), recipe.animations, recipe.sheet], [4, 3, ['slice-0', 'slice-1', 'slice-2', 'slice-3'], { slices: { frames: ['slice-0', 'slice-1', 'slice-2', 'slice-3'], loop: true } }, { columns: 4 }]);
  // A mark on a side with no depth colours its cell, one with depth the cells it reaches, and a blank slice stays in its place.
  assert.deepEqual(recipe.frames.map(frame => frame.ops[0].rows), [['bbbb', 'ttbb', 'kbbb'], ['....', '.tt.', '....'], ['....', '....', '....'], ['....', '.k..', '....']]);
  // The middle cell's centre is the pivot: the anchor names its pixel, and pivot-x2 the point itself, doubled.
  assert.deepEqual([recipe.anchor, recipe.frames[0].points, metadata], [[2, 1], { 'pivot-x2': [5, 3] }, { format: 'pixelforge-stack-slices', slices: 4, footprint: [4, 3], pivot: [2.5, 1.5], spacing: 1, squash: 0.65, projection: 'oblique' }]);
  assert.deepEqual(warnings, []);
  renderProject(recipe);
  // On a map's grid an even footprint turns about the corner where four cells meet.
  const grid = compileStackSlices({ ...stack, projection: 'iso', cell: 1, slices: [fill(4, 4, 'b')] });
  assert.deepEqual([grid.recipe.anchor, grid.recipe.frames[0].points, grid.metadata.pivot, grid.metadata.squash], [[2, 2], { 'pivot-x2': [4, 4] }, [2, 2], 0.5]);
  // The baked frames are untouched, and what a sheet cannot hold is named.
  const moving = { ...source, sockets: { top: { at: [2, 1, 4] } }, parts: { cap: { socket: 'top', at: [0, 0, 0], slices: [['t']] } }, facets: [{ color: 't', points: [[0, 0, 5], [1, 0, 5], [0, 1, 5]] }],
    animations: { lift: { frames: 2, sockets: { top: [{ frame: 0 }, { frame: 2, offset: [0, 0, 1] }] } } } };
  assert.deepEqual(compileStackSlices(moving).warnings, ['parts, animations, facets and lofts are not in the slices: a slice sheet is the stack\'s own slices, and a game that wants the rest plays the baked frames']);
  assert.deepEqual(compileStackSlices(moving).recipe.frames, recipe.frames);
  assert.deepEqual(prepareStack(source).recipe(), compileStack(source).recipe);
  assert.throws(() => compileStackSlices({ ...moving, paint: undefined, slices: [fill(4, 3, '.')] }), /stack\.slices: the stack's own slices are blank/);
  assert.throws(() => compileStackSlices({ ...source, resolution: 9 }), /stack\.resolution/);
});

test('with ramps a slice takes a light fixed to the stack: open tops a key lighter, the sides turned from it a key darker', () => {
  // A 4x4 block two slices high with a 2x2 block on it: light from the west and south, above.
  const source = { ...stack, ramps: ['abc'], slices: [fill(4, 4, 'b'), fill(4, 4, 'b'), ['....', '.bb.', '.bb.', '....']] };
  const rows = compileStackSlices(source).recipe.frames.map(frame => frame.ops[0].rows);
  // The top slice and the open part of the one under it are roofs.
  assert.deepEqual(rows[2], ['....', '.cc.', '.cc.', '....']);
  assert.deepEqual(rows[1], ['cccc', 'cbbc', 'cbbc', 'cccc']);
  // The bottom slice shows only its sides: as drawn to the west and south, a key darker to the east and north and at
  // the corners between, and as drawn inside, where nothing shows.
  assert.deepEqual(rows[0], ['aaaa', 'bbba', 'bbba', 'bbba']);
  // Without ramps every cell is as it is drawn.
  assert.deepEqual(compileStackSlices({ ...source, ramps: undefined }).recipe.frames[0].ops[0].rows, fill(4, 4, 'b'));
});

test('drawStack stacks the slices at any heading: at a quarter turn the picture is the baked frame, pixel for pixel', () => {
  const shown = (context, x, y) => { const at = (y * context.width + x) * 4; return context.data[at + 3] ? [...context.data.slice(at, at + 4)].join(' ') : null; };
  // What a stack bakes at a heading, and what its slices stack to there with the pivot at (20, 30): the pixels that differ.
  const differ = (source, heading, options = {}) => {
    const baked = compileStack({ ...source, headings: [heading] }).recipe, [ax, ay] = baked.anchor, frame = renderProject(baked).frames[0];
    const canvas = softCanvas(48, 44), turn = source.projection === 'iso' ? heading + 45 : heading;
    drawStack(canvas, sheetOf(compileStackSlices(source).recipe), 20, 30, { heading: turn, scale: source.resolution ?? 4, squash: source.projection === 'iso' ? 0.5 : source.squash ?? 0.5, ...options });
    let count = 0;
    for (let y = 0; y < 44; y++) for (let x = 0; x < 48; x++) {
      const bx = x - 20 + ax, by = y - 30 + ay, at = (by * baked.width + bx) * 4, inside = bx >= 0 && by >= 0 && bx < baked.width && by < baked.height;
      const want = inside && frame.data[at + 3] ? [...frame.data.slice(at, at + 4)].join(' ') : null;
      if (want !== shown(canvas, x, y)) count++;
    }
    return count;
  };
  // A pivot at a cell's centre across and at a corner down, one at a centre both ways, and a ragged footprint: with
  // an odd resolution or a flattened ground, canvas pixel centres fall on the lines between slice pixels, and each is
  // settled as the baked frame settles it.
  const shapes = [
    [['bbbbb', 'bcccb', 'bbbba', 'bbbbb'], ['.....', '.ttt.', '.tk..', '.....'], ['.....', '..k..', '.....', '.....']],
    [['bbbbb', 'bcccb', 'bbbba'], ['.....', '.ttt.', '.....'], ['.....', '..k..', '.....']],
    [['.bbb..', 'bcccba', 'bcc.ba', '.bbbaa', '..a...'], ['......', '.tt...', '.tk...', '......', '......'], ['......', '.k....', '......', '......', '......']],
  ];
  for (const slices of shapes) for (const resolution of [1, 2, 3, 4, 5]) for (const view of [{ squash: 1 }, { squash: 0.5 }, { projection: 'iso' }]) {
    // A cell thinner than a pixel can't be stacked from whole copies.
    if (resolution === 1 && view.squash !== 1) continue;
    const source = { ...stack, slices, resolution, ...view };
    for (const heading of view.projection === 'iso' ? [45, 135, 225, 315] : [0, 90, 180, 270]) assert.equal(differ(source, heading), 0, `${JSON.stringify(view)} at ${resolution}×, heading ${heading}`);
  }
  const source = { ...stack, slices: shapes[1], resolution: 3, squash: 1 }, { recipe } = compileStackSlices(source), sheet = sheetOf(recipe);
  // Each slice is drawn once for every pixel it rises and once more at its top, so the sides are solid.
  const big = softCanvas(48, 44);
  drawStack(big, sheet, 20, 30, { scale: 3 });
  assert.equal(big.draws, 3 * 4);
  // Between quarter turns it is a turned picture of the same stack: as many pixels, within a tenth.
  const count = context => { let n = 0; for (let i = 3; i < context.data.length; i += 4) if (context.data[i]) n++; return n; };
  const turned = softCanvas(48, 44);
  drawStack(turned, sheet, 20, 30, { scale: 3, heading: 30 });
  assert.ok(Math.abs(count(turned) - count(big)) < count(big) / 10, `${count(turned)} pixels turned, ${count(big)} unturned`);
  // A rise other than the scale stretches the stack: the ground stays, and the top slice's one cell is two pixels
  // higher for each of the three slices under its roof.
  const tall = softCanvas(48, 44), rowsOf = context => { let top = 44, bottom = -1; for (let y = 0; y < 44; y++) for (let x = 0; x < 48; x++) if (shown(context, x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); } return [top, bottom]; };
  drawStack(tall, sheet, 20, 30, { scale: 3, rise: 5 });
  assert.deepEqual([rowsOf(big), rowsOf(tall)], [[20, 33], [14, 33]]);
  // A trimmed, scaled sheet stacks to the same picture: the pivot is read in the sheet's own pixels.
  const trimmed = softCanvas(48, 44), scaled = sheetOf({ ...recipe, sheet: { scale: 3, trim: true, padding: 1 } });
  drawStack(trimmed, scaled, 20, 30, { rise: 3 });
  assert.deepEqual([...trimmed.data], [...big.data]);
  // What it refuses.
  assert.throws(() => drawStack(softCanvas(4, 4), sheetOf(compileStack(source).recipe), 0, 0), /no slices to stack: no animation slices/);
  for (const [options, message] of [[{ heading: '90' }, /heading must be a number/], [{ scale: 1.5 }, /scale must be an integer/], [{ rise: 0 }, /rise must be an integer/], [{ squash: 0 }, /squash must be a number above 0/], [{ squash: 2 }, /squash/]]) {
    assert.throws(() => drawStack(softCanvas(4, 4), sheet, 0, 0, options), message);
  }
});

test('a slice sheet exports as any recipe: an atlas that names the pivot, and a Godot SpriteFrames that carries it', async () => {
  const source = JSON.parse(await readFile(new URL('../examples/iso-barrel.stack.json', import.meta.url), 'utf8'));
  const { recipe, metadata } = compileStackSlices(source), bundle = await createBundle(recipe), atlas = JSON.parse(bundle.files.get('iso-barrel.atlas.json'));
  assert.deepEqual([atlas.animations.slices.frames.length, atlas.frames['slice-0'].points, metadata.pivot], [11, { 'pivot-x2': { x: 8, y: 8 } }, [4, 4]]);
  assert.match(bundle.files.get('iso-barrel.tres').toString(), /\nmetadata\/stack_pivot = Vector2\(4\.0, 4\.0\)\n/);
  const scaled = spriteFrames(buildAtlas(renderProject({ ...recipe, sheet: { scale: 2 } })).metadata).text;
  assert.match(scaled, /\nmetadata\/stack_pivot = Vector2\(8\.0, 8\.0\)\n/);
  assert.doesNotMatch(spriteFrames(buildAtlas(renderProject(compileStack(source).recipe)).metadata).text, /stack_pivot/);
});

test('compile --slices and pixel_compile slices write the sheet, for a stack only', async t => {
  const base = path.resolve(os.tmpdir()), dir = await mkdtemp(path.join(base, 'pixelbolt-slices-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cli = (...args) => spawnSync(process.execPath, [path.join(root, 'bin/pixelbolt.js'), ...args], { cwd: root, encoding: 'utf8' });
  const out = path.join(dir, 'slices.json'), meta = path.join(dir, 'meta.json'), crate = JSON.parse(await readFile(path.join(root, 'examples/iso-crate.stack.json'), 'utf8'));
  const reply = cliReply(cli('compile', 'examples/iso-crate.stack.json', '--slices', '--out', out, '--metadata', meta));
  assert.deepEqual([reply.ok, reply.frames, reply.width, reply.height, reply.animations], [true, 8, 8, 8, { slices: { frames: 8, duration: 960, loop: true, fps: 8.33 } }]);
  assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), compileStackSlices(crate).recipe);
  assert.equal(JSON.parse(await readFile(meta, 'utf8')).format, 'pixelforge-stack-slices');
  assert.match(cliReply(cli('compile', 'examples/hero.poses.json', '--slices', '--out', path.join(dir, 'no.json')), 'stderr').error, /--slices writes the slices of a sprite stack source/);
  assert.match(cliReply(cli('compile', 'examples/iso-crate.stack.json', '--slices', '--frames', '4', '--out', path.join(dir, 'no.json')), 'stderr').error, /--frames shapes baked frames/);
  // The same over MCP.
  const input = new PassThrough(), output = new PassThrough(), waiting = new Map(); let buffer = '', next = 0;
  output.on('data', chunk => { buffer += chunk; for (let end; (end = buffer.indexOf('\n')) !== -1; buffer = buffer.slice(end + 1)) { const message = JSON.parse(buffer.slice(0, end)); waiting.get(message.id)?.(message); } });
  const running = startMCP({ input, output, directory: dir, root: dir });
  t.after(() => { input.end(); return running; });
  const request = (method, params) => new Promise(resolve => { waiting.set(++next, resolve); input.write(JSON.stringify({ jsonrpc: '2.0', id: next, method, params }) + '\n'); });
  const call = async (name, args) => { const { result } = await request('tools/call', { name, arguments: args }); return { result, info: JSON.parse(result.content[0].text) }; };
  await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  const made = await call('pixel_compile', { source: crate, slices: true, metadata: true });
  assert.deepEqual([made.info.ok, made.info.frames, made.info.width, made.info.metadata?.format], [true, 8, 8, 'pixelforge-stack-slices']);
  const refused = await call('pixel_compile', { preset: 'hero', slices: true });
  assert.deepEqual([refused.result.isError, refused.info.path], [true, 'slices']);
  assert.match(refused.info.error, /slices are a sprite stack's/);
  assert.match((await call('pixel_compile', { source: crate, slices: true, frames: 4 })).info.error, /frames shapes baked frames/);
  // A stack with a socket compiles to two revisions: the recipe's draws, and the source's, sent where a recipe goes,
  // is told what to send.
  const chest = JSON.parse(await readFile(new URL('../examples/iso-chest.stack.json', import.meta.url), 'utf8')), lid = await call('pixel_compile', { source: chest });
  assert.equal((await call('pixel_validate', { revision: lid.info.revision })).info.ok, true);
  for (const args of [{ revision: lid.info.sourceRevision }, { project: crate }]) {
    const sent = await call('pixel_validate', args);
    assert.equal(sent.result.isError, true);
    assert.match(sent.info.error, /this is a pixelforge-stack source, not a recipe: pixel_compile it, then send the revision that returns/);
  }
  // A socket's rotation still reads the source's revision.
  assert.equal((await call('pixel_inspect', { revision: lid.info.sourceRevision, rotate: { socket: 'hinge', heading: 0, degrees: [0, 90] } })).info.ok, true);
});
