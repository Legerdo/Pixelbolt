// Model-space sockets and flat faces for sprite stacks. Rasterize at pixel centres with a
// half-open edge rule, then depth-sort glass and solid hits together with the voxel traversal.
import { fail, isObject, portableName } from './core.js';
import { fields, number, integer, boolean } from './authoring.js';
import { cosDeg, sinDeg } from './craft.js';

function triple(value, path) {
  if (!Array.isArray(value) || value.length !== 3) fail(path, 'expected [x,y,z]');
  return value.map((n, i) => number(n, path + '[' + i + ']', -512, 512));
}

export function stackGeometry(source) {
  const sockets = new Map(),
    definitions = source.sockets ?? {};
  if (!isObject(definitions) || Object.keys(definitions).length > 64) fail('stack.sockets', 'expected at most 64 named attachments');
  for (const [name, socket] of Object.entries(definitions)) {
    const path = 'stack.sockets.' + name;
    portableName(name, path);
    fields(socket, ['at', 'axis', 'keys'], path);
    const axis = socket.axis ?? 'z',
      keys = socket.keys ?? [];
    if (!['x', 'y', 'z'].includes(axis)) fail(path + '.axis', 'expected x, y or z');
    if (!Array.isArray(keys) || keys.length > 64) fail(path + '.keys', 'expected up to 64 keys');
    let last = -1;
    sockets.set(name, {
      at: triple(socket.at, path + '.at'),
      axis,
      keys: keys.map((key, i) => {
        const p = path + '.keys[' + i + ']';
        fields(key, ['heading', 'offset', 'angle'], p);
        last = integer(key.heading, p + '.heading', last + 1, 360);
        return {
          heading: last,
          offset: triple(key.offset ?? [0, 0, 0], p + '.offset'),
          angle: number(key.angle ?? 0, p + '.angle', -3600, 3600)
        };
      })
    });
  }
  const faces = source.facets ?? [];
  if (!Array.isArray(faces) || faces.length > 2048) fail('stack.facets', 'expected up to 2,048 faces');
  const readSocket = (name, path) => {
    if (name !== undefined && !sockets.has(name)) fail(path, 'unknown socket');
    return name;
  };
  const facets = faces.map((face, i) => {
    const path = 'stack.facets[' + i + ']';
    fields(face, ['points', 'color', 'socket', 'twoSided'], path);
    const socket = readSocket(face.socket, path + '.socket');
    if (!Array.isArray(face.points) || face.points.length < 3 || face.points.length > 16)
      fail(path + '.points', 'expected 3–16 vertices in boundary order');
    if (typeof face.color !== 'string' || !Object.hasOwn(source.palette, face.color)) fail(path + '.color', 'unknown palette key');
    return {
      ink: face.color.charCodeAt(0),
      twoSided: boolean(face.twoSided ?? false, path + '.twoSided'),
      points: face.points.map((point, i) => {
        const p = path + '.points[' + i + ']';
        if (Array.isArray(point)) return { xyz: triple(point, p), socket };
        fields(point, ['at', 'socket'], p);
        return { xyz: triple(point.at, p + '.at'), socket: readSocket(point.socket ?? socket, p + '.socket') };
      })
    };
  });
  return { sockets, facets };
}

export function socketPose(sockets, heading) {
  const posed = new Map();
  for (const [name, { at, axis, keys }] of sockets) {
    let origin = at,
      angle = 0;
    if (keys.length) {
      const next = keys.findIndex(k => k.heading >= heading);
      const end = next < 0 ? keys.length - 1 : next;
      const start = next < 0 ? end : Math.max(0, end - 1);
      const a = keys[start],
        b = keys[end];
      const t = start === end ? 0 : (heading - a.heading) / (b.heading - a.heading);
      origin = at.map((v, i) => v + a.offset[i] + (b.offset[i] - a.offset[i]) * t);
      angle = a.angle + (b.angle - a.angle) * t;
    }
    posed.set(name, { origin, axis, c: cosDeg(angle), s: sinDeg(angle) });
  }
  return posed;
}

function placed({ xyz, socket }, pose) {
  if (!socket) return xyz;
  const { origin, axis, c, s } = pose.get(socket),
    [x, y, z] = xyz;
  let rotated;
  if (axis === 'x') rotated = [x, y * c - z * s, y * s + z * c];
  else if (axis === 'y') rotated = [x * c + z * s, y, z * c - x * s];
  else rotated = [x * c - y * s, x * s + y * c, z];
  return rotated.map((n, i) => n + origin[i]);
}

export function projectPoint([x, y, z], view, c, s) {
  x -= view.pivot[0] + 0.5;
  y -= view.pivot[1] + 0.5;
  return [view.anchor[0] + (x * c - y * s) * view.resolution, view.anchor[1] + ((x * s + y * c) * view.squash - z) * view.resolution, z];
}

export function projectFacets(geometry, heading, view, angle) {
  const pose = socketPose(geometry.sockets, heading),
    c = cosDeg(angle),
    s = sinDeg(angle);
  return geometry.facets.map(face => ({ ...face, points: face.points.map(p => projectPoint(placed(p, pose), view, c, s)) }));
}

// Convert the depth samples at each pixel to ordinary back-to-front recipe grids.
// z is the camera depth along a ray: higher world z is closer. Equal-depth overlays draw last.
export function stackFragments(width, height, alpha) {
  const hits = new Array(width * height);
  let count = 0;
  function add(index, z, ink) {
    if (!alpha[ink]) return;
    if (++count > 2000000) fail('stack.facets', 'over two million surface samples in one frame');
    const list = (hits[index] ??= []);
    if (list.length >= 128) fail('stack.facets', 'over 128 surfaces at one pixel');
    list.push({ z, ink });
  }
  function ops(budget) {
    const layers = [];
    for (let i = 0; i < hits.length; i++) {
      const list = hits[i];
      if (!list) continue;
      list.sort((a, b) => a.z - b.z);
      let base = list.length - 1;
      while (base > 0 && alpha[list[base].ink] !== 255) base--;
      const x = i % width,
        y = Math.floor(i / width);
      for (let j = base; j < list.length; j++) {
        const k = j - base;
        const layer = (layers[k] ??= { points: [], left: width, right: 0, top: height, bottom: 0 });
        layer.left = Math.min(layer.left, x);
        layer.right = Math.max(layer.right, x);
        layer.top = Math.min(layer.top, y);
        layer.bottom = y;
        layer.points.push([x, y, list[j].ink]);
      }
    }
    if (!layers.length) return [{ op: 'grid', rows: Array(height).fill('.'.repeat(width)) }];
    return layers.map((l, i) => {
      if (!i) {
        l.left = 0;
        l.top = 0;
        l.right = width - 1;
        l.bottom = height - 1;
      }
      const area = (l.right - l.left + 1) * (l.bottom - l.top + 1);
      budget.gridCells = (budget.gridCells ?? 0) + area;
      if (budget.gridCells > 16777216) fail('stack.facets', 'layered grids exceed 16 million cells; reduce resolution or heading count');
      const grid = Array.from({ length: l.bottom - l.top + 1 }, () => new Uint16Array(l.right - l.left + 1).fill(46));
      for (const [x, y, ink] of l.points) grid[y - l.top][x - l.left] = ink;
      return { op: 'grid', ...(l.left && { x: l.left }), ...(l.top && { y: l.top }), rows: grid.map(row => String.fromCharCode(...row)) };
    });
  }
  return { add, ops };
}

// Fixed-point pixel centres and the top-left rule assign each shared edge to one triangle.
const edge = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
const inclusive = (a, b) => a[1] > b[1] || (a[1] === b[1] && a[0] < b[0]);
export function drawFacets(faces, view, fragments, budget) {
  for (const face of faces) {
    const points = face.points.map(([x, y, z]) => [Math.round(x * 256), Math.round(y * 256), z]);
    for (let i = 1; i < points.length - 1; i++) {
      let a = points[0],
        b = points[i],
        c = points[i + 1],
        area = edge(a, b, c[0], c[1]);
      if (area < 0 && face.twoSided) {
        [b, c] = [c, b];
        area = -area;
      }
      if (area <= 0) continue;
      const left = Math.max(0, Math.ceil((Math.min(a[0], b[0], c[0]) - 128) / 256));
      const right = Math.min(view.width - 1, Math.floor((Math.max(a[0], b[0], c[0]) - 128) / 256));
      const top = Math.max(0, Math.ceil((Math.min(a[1], b[1], c[1]) - 128) / 256));
      const bottom = Math.min(view.height - 1, Math.floor((Math.max(a[1], b[1], c[1]) - 128) / 256));
      if (left > right || top > bottom) continue;
      budget.left -= (right - left + 1) * (bottom - top + 1);
      if (budget.left < 0) fail('stack.facets', 'stack exceeds the surface sampling budget');
      const ab = inclusive(a, b),
        bc = inclusive(b, c),
        ca = inclusive(c, a);
      for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++) {
          const px = x * 256 + 128,
            py = y * 256 + 128;
          const u = edge(b, c, px, py),
            v = edge(c, a, px, py),
            w = edge(a, b, px, py);
          if ((u > 0 || (u === 0 && bc)) && (v > 0 || (v === 0 && ca)) && (w > 0 || (w === 0 && ab)))
            fragments.add(y * view.width + x, (u * a[2] + v * b[2] + w * c[2]) / area, face.ink);
        }
    }
  }
}
