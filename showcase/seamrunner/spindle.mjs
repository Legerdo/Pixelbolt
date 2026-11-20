// A fixed-camera detail of the same cutter used in the turntable. Register each
// pose on its projected spindle so changes to the fitted stack canvas cannot wobble the crop.
import { readFile, writeFile } from 'node:fs/promises';
import { prepareStack } from '../../src/stack.js';
import { renderProject } from '../../src/core.js';
import { animationGIF } from '../../src/gif.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Supply the rover .stack.json and a new output .gif.');
const source = JSON.parse(await readFile(input, 'utf8'));
const count = 32, heading = 0;
const frames = Array.from({ length: count }, (_, i) => {
  const spindle = { ...source.sockets.spindle, keys: [{ heading, angle: i * 360 / count }] };
  const model = prepareStack({ ...source, headings: [heading], sockets: { ...source.sockets, spindle } });
  const frame = model.frame(0), [x, y] = frame.points.spindle;
  return { name: 'phase-' + i, duration: 50, ops: frame.ops.map(op => ({
    ...op, x: (op.x ?? 0) - x + 24, y: (op.y ?? 0) - y + 29
  })) };
});
const recipe = { version: 1, name: 'seamrunner-spindle', width: 94, height: 68,
  palette: source.palette, frames, animations: { spin: { frames: frames.map(f => f.name), loop: true } } };
const gif = animationGIF(renderProject(recipe), 'spin', { scale:3, background:'#33384b' });
await writeFile(output, gif.data, { flag:'wx' });
