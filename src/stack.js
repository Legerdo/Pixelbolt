// Orthographic sprite stacks. Each nonblank cell occupies one solid unit cube. Trace one ray
// per output pixel through the original slices, sampling the first visible face. All headings
// share a ground pivot and canvas. Palette values survive exactly at any rendering resolution.
import { fail, frameFits, frameTotalProblem, isObject, parseColor, readRows, renderProject, FRAME_AREA } from './core.js';
import { fields, integer, number, point } from './authoring.js';
import { cosDeg, sinDeg } from './craft.js';

const faces = ['west', 'east', 'north', 'south'];
const blank = key => key === '.' || key === ' ';
const sourceFields = ['format', 'version', 'name', 'palette', 'slices', 'pivot', 'projection', 'squash', 'spacing', 'resolution', 'headings', 'duration', 'paint'];

// A side drawing reads across x (north/south) or y (west/east); its first row is the roof.
// Find the outermost solid cell on that line, including through an opening in the silhouette.
function surface(model, face, u, row) {
  const { width, height, levels, cells } = model;
  const acrossY = face < 2, depth = acrossY ? width : height;
  const step = (face % 2 ? -1 : 1) * (acrossY ? 1 : width);
  const start = (levels - 1 - row) * width * height + (acrossY ? u * width : u)
    + (face % 2 ? (depth - 1) * -step : 0);
  for (let i = 0, at = start; i < depth; i++, at += step) {
    if (cells[at]) return { at, step, remaining: depth - i };
  }
  return null;
}

function readModel(source) {
  fields(source, sourceFields, 'stack');
  if (source.format !== 'pixelforge-stack' || source.version !== 1) fail('stack', 'expected version-1 pixelforge-stack');
  if (!isObject(source.palette)) fail('stack.palette', 'expected a palette of opaque colours');
  // Reuse the recipe's portable-name and palette limits before allocating the volume.
  renderProject({ version: 1, name: source.name, width: 1, height: 1, palette: source.palette, frames: [{ name: 'check' }] });
  for (const [key, color] of Object.entries(source.palette)) {
    if (key.length !== 1 || blank(key) || key.charCodeAt(0) === 0) fail('stack.palette', 'use single nonblank grid characters');
    if (parseColor(color, {}, `stack.palette.${key}`)[3] !== 255) fail(`stack.palette.${key}`, 'solid cells need opaque colours; use dots for air');
  }
  if (!Array.isArray(source.slices) || !source.slices.length || source.slices.length > 64) fail('stack.slices', 'expected 1–64 grids, ground first');
  let width, height, cells;
  const levels = source.slices.length;
  source.slices.forEach((rows, z) => {
    const path = `stack.slices[${z}]`, grid = readRows(rows, path, source.palette, 128);
    if (!z) { width = grid.width; height = grid.height; cells = new Uint16Array(width * height * levels); }
    if (width !== grid.width || height !== grid.height) fail(path, 'all slices must have the same dimensions');
    let i = z * width * height;
    for (const row of rows) for (const key of row) cells[i++] = blank(key) ? 0 : key.charCodeAt(0);
  });
  const model = { width, height, levels, cells, decals: faces.map(() => new Map()) };
  const paint = source.paint ?? [];
  if (!Array.isArray(paint) || paint.length > 1024) fail('stack.paint', 'expected at most 1,024 side paintings');
  let paintCells = 0;
  paint.forEach((stroke, i) => {
    const path = `stack.paint[${i}]`;
    fields(stroke, ['face', 'at', 'rows', 'depth'], path);
    const face = faces.indexOf(stroke.face);
    if (face < 0) fail(`${path}.face`, `expected ${faces.join(', ')}`);
    const [u, v] = point(stroke.at ?? [0, 0], `${path}.at`);
    const grid = readRows(stroke.rows, `${path}.rows`, source.palette, 128);
    const depth = integer(stroke.depth ?? 0, `${path}.depth`, 0, 128);
    if (u < 0 || v < 0 || u + grid.width > (face < 2 ? height : width) || v + grid.height > levels) fail(path, 'painting must fit inside the side view');
    paintCells += grid.width * grid.height;
    if (paintCells > 262144) fail('stack.paint', 'side paintings exceed 262,144 cells');
    stroke.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (blank(row[x])) continue;
        const hit = surface(model, face, u + x, v + y);
        if (!hit) continue;
        const color = row.charCodeAt(x);
        model.decals[face].set(hit.at, color);
        for (let j = 0, at = hit.at; j < Math.min(depth, hit.remaining) && cells[at]; j++, at += hit.step) cells[at] = color;
      }
    });
  });
  return model;
}

export function stackSide(source, side) {
  const model = readModel(source), face = faces.indexOf(side);
  if (face < 0) fail('stack.face', `expected ${faces.join(', ')}`);
  return Array.from({ length: model.levels }, (_, row) => {
    let line = '';
    for (let u = 0; u < (face < 2 ? model.height : model.width); u++) {
      const hit = surface(model, face, u, row);
      line += hit ? String.fromCharCode(model.decals[face].get(hit.at) ?? model.cells[hit.at]) : '.';
    }
    return line;
  });
}

// Grid traversal from the camera. Clip to the volume first, then advance directly to cell
// boundaries. At a corner cross all tied axes together; the top face wins a visibility tie.
function raster(model, view, angle, budget) {
  const { width: w, height: h, levels, cells, decals } = model;
  const { resolution, squash, spacing, anchor, pivot, width, height } = view;
  const c = cosDeg(angle), s = sinDeg(angle), top = (levels - 1) * spacing + 1;
  const vx = -s / squash, vy = -c / squash, dx = Math.sign(vx), dy = Math.sign(vy);
  const deltaX = dx ? 1 / Math.abs(vx) : Infinity, deltaY = dy ? 1 / Math.abs(vy) : Infinity;
  const faceX = dx > 0 ? 0 : 1, faceY = dy > 0 ? 2 : 3;
  let visits = 0;
  const rows = [];
  for (let py = 0; py < height; py++) {
    const row = new Uint16Array(width).fill(46), sy = (py + .5 - anchor[1]) / resolution / squash;
    for (let px = 0; px < width; px++) {
      const sx = (px + .5 - anchor[0]) / resolution;
      const ox = pivot[0] + .5 + sx * c + sy * s - top * vx;
      const oy = pivot[1] + .5 - sx * s + sy * c - top * vy;
      if ((!dx && (ox < 0 || ox >= w)) || (!dy && (oy < 0 || oy >= h))) continue;
      const enterX = dx ? ((dx > 0 ? 0 : w) - ox) / vx : -Infinity;
      const enterY = dy ? ((dy > 0 ? 0 : h) - oy) / vy : -Infinity;
      const leaveX = dx ? ((dx > 0 ? w : 0) - ox) / vx : Infinity;
      const leaveY = dy ? ((dy > 0 ? h : 0) - oy) / vy : Infinity;
      const enter = Math.max(0, enterX, enterY), leave = Math.min(top, leaveX, leaveY);
      if (enter >= leave) continue;
      const probe = Math.min(enter + 1e-9, (enter + leave) / 2);
      let x = Math.floor(ox + vx * probe), y = Math.floor(oy + vy * probe), z = Math.floor(top - probe);
      let tx = dx ? (x + (dx > 0 ? 1 : 0) - ox) / vx : Infinity;
      let ty = dy ? (y + (dy > 0 ? 1 : 0) - oy) / vy : Infinity;
      let tz = top - z, face = enter === 0 ? -1 : enterX >= enterY ? faceX : faceY;
      while (x >= 0 && x < w && y >= 0 && y < h && z >= 0) {
        visits++;
        if (z % spacing === 0) {
          const index = (z / spacing * h + y) * w + x;
          if (cells[index]) { row[px] = (face >= 0 && decals[face].get(index)) || cells[index]; break; }
        }
        const next = Math.min(tx, ty, tz);
        if (next >= leave) break;
        if (tx <= next + 1e-10) { x += dx; tx += deltaX; face = faceX; }
        if (ty <= next + 1e-10) { y += dy; ty += deltaY; face = faceY; }
        if (tz <= next + 1e-10) { z--; tz++; face = -1; }
      }
    }
    if (visits > budget.left) fail('stack.headings', 'stack exceeds 96 million ray steps; use fewer headings or a lower resolution');
    rows.push(String.fromCharCode(...row));
  }
  budget.left -= visits;
  return rows;
}

export function compileStack(source, { maxPixels = FRAME_AREA } = {}) {
  const model = readModel(source), { width: w, height: h, levels } = model;
  const projection = source.projection ?? 'oblique';
  if (!['oblique', 'iso'].includes(projection)) fail('stack.projection', 'expected oblique or iso');
  if (projection === 'iso' && source.squash !== undefined) fail('stack.squash', 'iso uses a 2:1 ground grid; set squash with oblique projection');
  const squash = number(source.squash ?? (projection === 'iso' ? .5 : .65), 'stack.squash', .25, 1);
  const resolution = integer(source.resolution ?? 4, 'stack.resolution', 1, 8);
  const spacing = integer(source.spacing ?? 1, 'stack.spacing', 1, 8);
  const pivot = point(source.pivot ?? [Math.floor(w / 2), Math.floor(h / 2)], 'stack.pivot');
  if (pivot[0] < 0 || pivot[0] >= w || pivot[1] < 0 || pivot[1] >= h) fail('stack.pivot', 'ground pivot must be inside the slice');
  const headings = source.headings ?? Array.from({ length: 16 }, (_, i) => Math.round(i * 360 / 16));
  if (!Array.isArray(headings) || !headings.length || headings.length > 256 || new Set(headings).size !== headings.length) fail('stack.headings', 'expected 1–256 distinct angles in degrees');
  const duration = integer(source.duration ?? 80, 'stack.duration', 1, 60000);
  const angles = headings.map((a, i) => (integer(a, `stack.headings[${i}]`, 0, 359) + (projection === 'iso' ? 45 : 0)) % 360);
  let left = 0, right = 0, bottom = 0, roof = 0;
  const tall = (levels - 1) * spacing + 1;
  // The top and bottom of the four footprint corners bound every visible cell. Round outwards
  // once for all requested headings, so even an off-centre pivot stays still throughout a turn.
  const sidesX = [-pivot[0] - .5, w - pivot[0] - .5], sidesY = [-pivot[1] - .5, h - pivot[1] - .5];
  for (const angle of angles) {
    const c = cosDeg(angle), s = sinDeg(angle);
    for (const x of sidesX) for (const y of sidesY) {
      const u = (x * c - y * s) * resolution, v = (x * s + y * c) * squash * resolution;
      left = Math.min(left, Math.floor(u)); right = Math.max(right, Math.ceil(u));
      roof = Math.min(roof, Math.floor(v - tall * resolution)); bottom = Math.max(bottom, Math.ceil(v));
    }
  }
  const width = right - left, height = bottom - roof, anchor = [-left, -roof];
  if (!frameFits(width, height) || frameTotalProblem(angles.length, width, height)) fail('stack.resolution', `the ${width}×${height} canvas at ${resolution}× with ${angles.length} headings exceeds the recipe budget; reduce resolution, spacing or heading count`);
  if (width * height * angles.length > maxPixels) fail('scene.assets', 'sprite stacks together exceed the scene asset pixel budget');
  const view = { resolution, squash, spacing, anchor, pivot, width, height }, budget = { left: 96000000 };
  const frames = angles.map((angle, i) => ({
    name: `heading-${headings[i]}`, duration, ops: [{ op: 'grid', rows: raster(model, view, angle, budget) }]
  }));
  const recipe = {
    version: 1, name: source.name, width, height, anchor, palette: source.palette, frames,
    animations: { turn: { frames: frames.map(frame => frame.name), loop: true } }
  };
  return {
    recipe, warnings: [],
    metadata: { format: 'pixelforge-stack-metadata', resolution, projection, footprint: [w, h], levels, spacing, pivot, anchor, headings }
  };
}
