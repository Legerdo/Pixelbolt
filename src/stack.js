// Orthographic sprite stacks. Each nonblank cell occupies one solid unit cube. Trace one ray
// per output pixel. Composite glass and attached facets in depth order on one shared ground
// pivot and canvas. Opaque voxel-only sources retain their original single-grid fast path.
import { fail, frameFits, frameTotalProblem, isObject, parseColor, readRows, renderProject, FRAME_AREA } from './core.js';
import { boolean, fields, integer, number, point } from './authoring.js';
import { cosDeg, sinDeg } from './craft.js';
import { stackGeometry, projectPoint, projectFacets, socketPose, stackFragments, drawFacets } from './stack-facets.js';

const faces = ['west', 'east', 'north', 'south'];
const blank = key => key === '.' || key === ' ';
const sourceFields = ['format', 'version', 'name', 'palette', 'slices', 'pivot', 'projection', 'squash', 'spacing', 'resolution', 'headings', 'duration', 'decals', 'paint', 'facets', 'sockets'];

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
  if (!isObject(source.palette)) fail('stack.palette', 'expected a palette of colours');
  // Reuse the recipe's portable-name and palette limits before allocating the volume.
  renderProject({ version: 1, name: source.name, width: 1, height: 1, palette: source.palette, frames: [{ name: 'check' }] });
  const alpha = new Uint8Array(65536);
  let translucent = false;
  for (const [key, color] of Object.entries(source.palette)) {
    if (key.length !== 1 || blank(key) || key.charCodeAt(0) === 0) fail('stack.palette', 'use single nonblank grid characters');
    const a = parseColor(color, {}, `stack.palette.${key}`)[3];
    alpha[key.charCodeAt(0)] = a;
    translucent ||= a < 255;
  }
  if (!Array.isArray(source.slices) || !source.slices.length || source.slices.length > 64) fail('stack.slices', 'expected 1–64 grids, ground first');
  let width, height, cells;
  const levels = source.slices.length;
  source.slices.forEach((rows, z) => {
    const path = `stack.slices[${z}]`, grid = readRows(rows, path, source.palette, 128);
    if (!z) { width = grid.width; height = grid.height; cells = new Uint16Array(width * height * levels); }
    if (width !== grid.width || height !== grid.height) fail(path, 'all slices must have the same dimensions');
    let i = z * width * height;
    for (const row of rows) for (const key of row) cells[i++] = blank(key) || !alpha[key.charCodeAt(0)] ? 0 : key.charCodeAt(0);
  });
  const model = { width, height, levels, cells, alpha, translucent, geometry:stackGeometry(source), decals: faces.map(() => new Map()) };
  const library = source.decals ?? {};
  if (!isObject(library) || Object.keys(library).length > 256) fail('stack.decals', 'expected at most 256 named grids');
  const grids = new Map();
  let libraryCells = 0;
  for (const [name, rows] of Object.entries(library)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) fail('stack.decals', 'use 1–64 letters, digits, underscores or hyphens, starting with a letter');
    const grid = readRows(rows, `stack.decals.${name}`, source.palette, 128);
    libraryCells += grid.width * grid.height;
    if (libraryCells > 262144) fail('stack.decals', 'decal drawings exceed 262,144 cells');
    grids.set(name, grid);
  }
  const paint = source.paint ?? [];
  if (!Array.isArray(paint) || paint.length > 1024) fail('stack.paint', 'expected at most 1,024 side paintings');
  let paintCells = 0;
  const strokes = paint.map((stroke, i) => {
    const path = `stack.paint[${i}]`;
    fields(stroke, ['face', 'at', 'rows', 'depth', 'decal', 'flipX', 'flipY', 'erase'], path);
    const face = faces.indexOf(stroke.face);
    if (face < 0) fail(`${path}.face`, `expected ${faces.join(', ')}`);
    const [u, v] = point(stroke.at ?? [0, 0], `${path}.at`);
    if (['rows', 'erase', 'decal'].filter(key => key in stroke).length !== 1) fail(path, 'choose one of rows, decal or erase');
    const erase = 'erase' in stroke;
    if (erase && 'depth' in stroke) fail(`${path}.depth`, 'an eraser removes the previous mark including its depth');
    if (!('decal' in stroke) && ('flipX' in stroke || 'flipY' in stroke)) fail(path, 'flips apply to a named decal');
    const grid = 'decal' in stroke ? grids.get(stroke.decal)
      : erase ? readRows(stroke.erase, `${path}.erase`, { x: '#fff' }, 128) : readRows(stroke.rows, `${path}.rows`, source.palette, 128);
    if (!grid) fail(`${path}.decal`, 'unknown decal');
    const depth = integer(stroke.depth ?? 0, `${path}.depth`, 0, 128);
    if (u < 0 || v < 0 || u + grid.width > (face < 2 ? height : width) || v + grid.height > levels) fail(path, 'painting must fit inside the side view');
    paintCells += grid.width * grid.height;
    if (paintCells > 262144) fail('stack.paint', 'side paintings exceed 262,144 cells');
    let rows = grid.rows;
    if (boolean(stroke.flipX ?? false, `${path}.flipX`)) rows = rows.map(row => [...row].reverse().join(''));
    if (boolean(stroke.flipY ?? false, `${path}.flipY`)) rows = [...rows].reverse();
    return { face, u, v, rows, depth, erase };
  });
  // Walk backwards to match each eraser cell to its preceding mark on this face.
  // Replay surviving marks forwards so intersecting depth strokes keep their original order.
  if (strokes.some(stroke => stroke.erase)) {
    const skips = faces.map(() => new Uint16Array(128 * levels));
    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i], skip = skips[stroke.face];
      stroke.rows = stroke.rows.map((row, y) => [...row].map((key, x) => {
        if (blank(key)) return key;
        const at = (stroke.v + y) * 128 + stroke.u + x;
        if (stroke.erase) skip[at]++;
        else if (skip[at]) { skip[at]--; return '.'; }
        return key;
      }).join(''));
    }
  }
  for (const { face, u, v, rows, depth, erase } of strokes) {
    if (erase) continue;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (blank(row[x])) continue;
        const hit = surface(model, face, u + x, v + y);
        if (!hit) continue;
        const color = row.charCodeAt(x);
        if (alpha[color]) model.decals[face].set(hit.at, color);
        else model.decals[face].delete(hit.at);
        const fill = alpha[color] ? color : 0;
        for (let j = 0, at = hit.at; j < Math.min(depth, hit.remaining) && cells[at]; j++, at += hit.step) cells[at] = fill;
      }
    });
  }
  return model;
}

export function stackSide(source, side) {
  return sideRows(readModel(source), side);
}

function sideRows(model, side) {
  const face = faces.indexOf(side);
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
function raster(model, view, angle, heading, budget) {
  const { width: w, height: h, levels, cells, decals } = model;
  const { resolution, squash, spacing, anchor, pivot, width, height } = view;
  const c = cosDeg(angle), s = sinDeg(angle), top = (levels - 1) * spacing + 1;
  const vx = -s / squash, vy = -c / squash, dx = Math.sign(vx), dy = Math.sign(vy);
  const deltaX = dx ? 1 / Math.abs(vx) : Infinity, deltaY = dy ? 1 / Math.abs(vy) : Infinity;
  const faceX = dx > 0 ? 0 : 1, faceY = dy > 0 ? 2 : 3;
  let visits = 0;
  const layered = model.translucent || model.geometry.facets.length > 0;
  const fragments = layered ? stackFragments(width, height, model.alpha) : null;
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
      let entry = enter, glass = false;
      while (x >= 0 && x < w && y >= 0 && y < h && z >= 0) {
        visits++;
        const index = (z / spacing * h + y) * w + x;
        const ink = z % spacing === 0 ? cells[index] : 0;
        if (ink) {
          const paint = face >= 0 ? decals[face].get(index) : 0;
          if (!layered) { row[px] = paint || ink; break; }
          const at = py*width+px, depth = top-entry;
          if (!glass || model.alpha[ink]===255) fragments.add(at,depth,ink);
          if (paint && paint!==ink) fragments.add(at,depth,paint);
          if (model.alpha[ink]===255 || model.alpha[paint]===255) break;
          glass = true;
        } else glass = false;
        const next = Math.min(tx, ty, tz);
        if (next >= leave) break;
        entry = next;
        if (tx <= next + 1e-10) { x += dx; tx += deltaX; face = faceX; }
        if (ty <= next + 1e-10) { y += dy; ty += deltaY; face = faceY; }
        if (tz <= next + 1e-10) { z--; tz++; face = -1; }
      }
    }
    if (visits > budget.left) fail('stack.headings', 'stack exceeds 96 million ray steps; use fewer headings or a lower resolution');
    if (!layered) rows.push(String.fromCharCode(...row));
  }
  budget.left -= visits;
  if (!layered) return [{op:'grid', rows}];
  drawFacets(projectFacets(model.geometry,heading,view,angle),view,fragments,budget);
  return fragments.ops(budget);
}

export function prepareStack(source, { maxPixels = FRAME_AREA } = {}) {
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
  const cameraAngle = heading => (heading + (projection === 'iso' ? 45 : 0)) % 360;
  const angles = headings.map((a, i) => cameraAngle(integer(a, `stack.headings[${i}]`, 0, 359)));
  let left = 0, right = 0, bottom = 0, roof = 0;
  const tall = (levels - 1) * spacing + 1;
  // The top and bottom of the four footprint corners bound every visible cell. Round outwards
  // once for all requested headings, so even an off-centre pivot stays still throughout a turn.
  const sidesX = [-pivot[0] - .5, w - pivot[0] - .5], sidesY = [-pivot[1] - .5, h - pivot[1] - .5];
  for (const [index,angle] of angles.entries()) {
    const c = cosDeg(angle), s = sinDeg(angle);
    const bounds = {pivot,anchor:[0,0],resolution,squash};
    for (const {origin} of socketPose(model.geometry.sockets,headings[index]).values()) {
      const [u,v] = projectPoint(origin,bounds,c,s);
      left=Math.min(left,Math.floor(u)); right=Math.max(right,Math.ceil(u));
      roof=Math.min(roof,Math.floor(v)); bottom=Math.max(bottom,Math.ceil(v));
    }
    for (const facet of projectFacets(model.geometry,headings[index],bounds,angle)) for (const [u,v] of facet.points) {
      left=Math.min(left,Math.floor(u)); right=Math.max(right,Math.ceil(u));
      roof=Math.min(roof,Math.floor(v)); bottom=Math.max(bottom,Math.ceil(v));
    }
    for (const x of sidesX) for (const y of sidesY) {
      const u = (x * c - y * s) * resolution, v = (x * s + y * c) * squash * resolution;
      left = Math.min(left, Math.floor(u)); right = Math.max(right, Math.ceil(u));
      roof = Math.min(roof, Math.floor(v - tall * resolution)); bottom = Math.max(bottom, Math.ceil(v));
    }
  }
  if (model.geometry.facets.length || model.geometry.sockets.size) { left-=2; right+=2; roof-=2; bottom+=2; }
  const width = right - left, height = bottom - roof, anchor = [-left, -roof];
  if (!frameFits(width, height) || frameTotalProblem(angles.length, width, height)) fail('stack.resolution', `the ${width}×${height} canvas at ${resolution}× with ${angles.length} headings exceeds the recipe budget; reduce resolution, spacing or heading count`);
  if (width * height * angles.length > maxPixels) fail('scene.assets', 'sprite stacks together exceed the scene asset pixel budget');
  const view = { resolution, squash, spacing, anchor, pivot, width, height }, budget = { left: 96000000 };
  const frames = new Array(angles.length);
  const metadata = { format: 'pixelforge-stack-metadata', resolution, projection, footprint: [w, h], levels, spacing, pivot, anchor, headings };
  function frame(index) {
    integer(index, 'stack.frame', 0, angles.length - 1);
    if (!frames[index]) {
      const heading = headings[index];
      frames[index] = {name:`heading-${heading}`, duration,
        ...(model.geometry.sockets.size && {points:attachments(heading)}),
        ops:raster(model,view,angles[index],heading,budget)};
    }
    return frames[index];
  }
  function recipe(index) {
    const drawn = index === undefined ? headings.map((_, i) => frame(i)) : [frame(index)];
    return { version: 1, name: source.name, width, height, anchor, palette: source.palette, frames: drawn,
      animations: { turn: { frames: drawn.map(f => f.name), loop: true } } };
  }
  // Follow the centre of the picked vertical face in model space. Keep the original sample
  // lattice and occlusion, even when the face turns away or the angle is between saved frames.
  function detail(side, at, heading, size = 32) {
    const face = faces.indexOf(side);
    if (face < 0) fail('stack.face', 'unknown side');
    const [u, v] = point(at, 'stack.detail.at');
    integer(size, 'stack.detail.size', 1, 128);
    const angle = cameraAngle(integer(heading, 'stack.detail.heading', 0, 359));
    if (u < 0 || u >= (face < 2 ? h : w) || v < 0 || v >= levels) return null;
    const hit = surface(model, face, u, v);
    if (!hit) return null;
    const x = hit.at % w - pivot[0] + (face === 0 ? -.5 : face === 1 ? .5 : 0);
    const y = Math.floor(hit.at / w) % h - pivot[1] + (face === 2 ? -.5 : face === 3 ? .5 : 0);
    const z = (levels - 1 - v) * spacing + .5, c = cosDeg(angle), s = sinDeg(angle);
    const left = Math.floor(anchor[0] + (x*c - y*s)*resolution - size/2);
    const top = Math.floor(anchor[1] + ((x*s + y*c)*squash - z)*resolution - size/2);
    const crop = { ...view, width: size, height: size, anchor: [anchor[0]-left, anchor[1]-top] };
    const ops = raster(model, crop, angle, heading, { left: 96000000 });
    return { left, top, rows:ops[0].rows, ops };
  }
  function comparison(side, at, heading) {
    integer(heading, 'stack.detail.heading', 0, 359);
    const size = 9 * resolution, frames = [];
    for (let offset = -2; offset <= 2; offset++) {
      const angle = (heading + offset + 360) % 360, crop = detail(side, at, angle, size);
      if (!crop) return null;
      frames.push({ name: `heading-${angle}`, duration, ops: crop.ops });
    }
    return { version: 1, name: source.name, width: size, height: size, palette: source.palette, frames, animations: {} };
  }
  function attachments(heading) {
    const angle=cameraAngle(integer(heading,'stack.heading',0,359));
    return Object.fromEntries([...socketPose(model.geometry.sockets,heading)].map(([name,pose])=>
      [name,projectPoint(pose.origin,view,cosDeg(angle),sinDeg(angle)).slice(0,2).map(Math.floor)]));
  }
  return { metadata, frame, recipe, detail, comparison, attachments, side: name => sideRows(model, name) };
}

export function compileStack(source, options) {
  const stack = prepareStack(source, options);
  return { recipe: stack.recipe(), warnings: [], metadata: stack.metadata };
}
