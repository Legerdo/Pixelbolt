// Print an editable 2:1 pit lane scene. The same painted car used for the turntable
// stands between the cones. All four cones share one stack and one ground pivot.
import { readFile } from 'node:fs/promises';

const car = JSON.parse(await readFile(new URL('../../examples/copper-rally.stack.json', import.meta.url)));
delete car.squash;
car.projection = 'iso';
car.headings = [0];

const width = 320, height = 192;
// One side of the lane rises by one pixel for every two across. Draw only its visible
// rectangle, so the scene review can flag actual sprite clipping.
function road(x, y) {
  const offset = y - Math.floor(x / 2);
  if (offset < -49 || offset > 79) return 'v';
  if (offset < -44 || offset > 74) return 'e';
  if ((offset >= -41 && offset <= -39) || (offset >= 68 && offset <= 70)) return 'o';
  if (offset >= -26 && offset <= -25 && x % 76 < 32) return 'p';
  return 'r';
}
const ground = {
  version: 1, name: 'pit-lane', width, height,
  palette: { v: '#223b43', e: '#84968e', o: '#c27e56', r: '#23323c', p: '#65797b' },
  frames: [{ name: 'lane', ops: [{ op: 'grid', rows: Array.from({ length: height },
    (_, y) => Array.from({ length: width }, (_, x) => road(x, y)).join('')) }] }]
};
const base = ['.kkk.', 'kkkkk', 'kkkkk', 'kkkkk', '.kkk.'];
const middle = ['.....', '.ooo.', '.ooo.', '.ooo.', '.....'];
const tip = ['.....', '.....', '..o..', '.....', '.....'];
const cone = {
  format: 'pixelforge-stack', version: 1, name: 'track-cone', projection: 'iso', headings: [0],
  palette: { k: '#132630', o: '#f57d48', w: '#ffebc0' },
  slices: [base, middle, middle, middle.map(row => row.replaceAll('o', 'w')), tip, tip]
};
const scene = {
  format: 'pixelforge-scene', version: 1, name: 'copper-rally-pit-lane', width, height,
  assets: { ground, car, cone },
  instances: [
    { asset: 'ground', at: [0, 0] },
    { name: 'near-cone', asset: 'cone', at: [135, 142] },
    { name: 'car', asset: 'car', at: [160, 113] },
    { name: 'far-cone', asset: 'cone', at: [195, 68] },
    { name: 'exit-cone', asset: 'cone', at: [255, 98] },
    { name: 'entry-cone', asset: 'cone', at: [69, 109] }
  ]
};
process.stdout.write(`${JSON.stringify(scene, null, 2)}\n`);
