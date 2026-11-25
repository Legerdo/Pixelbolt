// Print the Copper Rally pit lane, parked or with a ground-plane collision baked into its tracks.
// The near verge passes in front of both wheels, even where it lies above the car's centre on screen.
import { readFile } from 'node:fs/promises';
import { compileBodies } from '../../src/bodies.js';
import { headingFrame } from '../../src/runtime.js';
import { compileStack } from '../../src/stack.js';

const moving = process.argv.includes('--cone-run');

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
const parked = [
  { name: 'near-cone', asset: 'cone', at: [135, 142] },
  { name: 'car', asset: 'car', at: [160, 113] },
  { name: 'far-cone', asset: 'cone', at: [195, 68] },
  { name: 'exit-cone', asset: 'cone', at: [255, 98] },
  { name: 'entry-cone', asset: 'cone', at: [69, 109] }
];

// One solver unit is one horizontal slice cell. X runs along the lane, Y towards the near verge.
// The front bumper's bevel steers a glancing impact out of the car's path.
const frames = 104, frameMs = 40;
function coneRun(coneRecipe) {
  const start = [28, 28], screenStart = [14, 23];
  const marker = (name, at, angle = 0) => ({
    name, at, angle, shape: 'box', size: [5, 5], asleep: true,
    bounce: 0.7, friction: 0.18, drag: 0.055, spinDrag: 0.085, fill: 'x'
  });
  const bodies = [
    { name: 'car', shape: 'polygon', at: start, velocity: [2.15, 0],
      points: [[-26,-9], [-21,-12], [19,-12], [26,-8], [26,8], [19,12], [-21,12], [-26,9]],
      density: 8, bounce: 0.6, friction: 0.3, spinDrag: 0.5, fill: 'x' },
    marker('struck-cone', [103, 41], 8),
    { ...marker('second-cone', [111, 58]), drag: 0.025 },
    marker('foreground-cone', [162, 44])
  ];
  const { metadata } = compileBodies({
    format: 'pixelforge-bodies', version: 1, name: 'pit-lane-floor', width: 256, height: 96,
    palette: { x: '#ffffff' }, effects: { run: { frames, duration: frameMs, gravity: [0, 0], walls: [], bodies } }
  });
  const axis = car.resolution / Math.SQRT2, atlas = { meta: { headings: coneRecipe.headings } };
  return Object.entries(metadata.effects.run.paths).map(([name, path]) => {
    const trajectory = path.map(([x, y], i) => {
      const dx = x - start[0], dy = y - start[1];
      return { time: i * frameMs, at: [
        Math.round(screenStart[0] + (dx - dy) * axis),
        Math.round(screenStart[1] + (dx + dy) * axis / 2)
      ] };
    });
    const at = trajectory[0].at, asset = name === 'car' ? 'car' : 'cone';
    const instance = { name, asset, at };
    if (trajectory.some(key => key.at[0] !== at[0] || key.at[1] !== at[1])) instance.trajectory = trajectory;
    if (asset === 'cone') {
      const cues = path.map(([, , angle], i) => ({ time: i * frameMs, frame: headingFrame(atlas, angle) }));
      const sequence = cues.filter((cue, i) => !i || cue.frame !== cues[i - 1].frame);
      if (sequence.length > 1) instance.sequence = sequence;
      else instance.frame = sequence[0].frame;
    }
    return instance;
  });
}

if (moving) {
  car.resolution = cone.resolution = 3;
  cone.headings = Array.from({ length: 24 }, (_, i) => i * 15);
}
// The road's lines have slope 1/2. At the same road depth y - x/2 is constant along
// the full length of the car. Bake the cones to anchored frames so the scene honours
// the verge order. The two cones that meet travel outwards and keep their order.
const coneRecipe = compileStack(cone).recipe;
const verge = ({ at: [x, y] }) => y - x / 2;
const placements = (moving ? coneRun(coneRecipe) : parked).sort((a, b) => verge(a) - verge(b));
const scene = {
  format: 'pixelforge-scene', version: 1, name: moving ? 'copper-rally-cone-run' : 'copper-rally-pit-lane', width, height,
  ...(moving && { duration: frames * frameMs }),
  assets: { ground, car, cone: coneRecipe },
  instances: [
    { asset: 'ground', at: [0, 0] },
    ...placements.map(instance => ({ ...instance, anchor: 'frame' }))
  ]
};
process.stdout.write(`${JSON.stringify(scene, null, 2)}\n`);
