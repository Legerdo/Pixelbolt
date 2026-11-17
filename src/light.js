// Light that spreads from what shines, for effects whose fire, lava or arcs light what is around them. `spreadLight`
// floods light from the cells that shine through a grid of open and solid cells: it loses 1 / reach with every pixel
// of open air and 1 / depth with every pixel into or out of a solid. So the light takes the shape of the space it is
// in: it lights the faces of solids and leaves their insides dark, and what lies behind a solid is lit only round its
// corners, by a longer way, and so less. A light made this way is never a disc laid over a scene: where it shows and
// how far it gets come from what it meets. (The model is the one the game Tetherbore lights its tunnels with.)
// What must stay true: browser-compatible and the same on every engine (only + − × ÷; cells start in index order and
// their neighbours are visited in the order of STEP), and light is never raised by less than CLEAR, which is what ends
// the flood.
const DIAGONAL = 1.41421356, KNIGHT = 2.23606798, CLEAR = 1 / 1024;
// The sixteen steps from a cell: [across, down, length, then the two cells the step passes between, as offsets]. With
// the knight's moves beside the straight and diagonal ones, light in the open falls off in a round, not an octagon.
const STEP = [
  [1, 0, 1, 0, 0, 0, 0], [-1, 0, 1, 0, 0, 0, 0], [0, 1, 1, 0, 0, 0, 0], [0, -1, 1, 0, 0, 0, 0],
  [1, 1, DIAGONAL, 1, 0, 0, 1], [-1, 1, DIAGONAL, -1, 0, 0, 1], [1, -1, DIAGONAL, 1, 0, 0, -1], [-1, -1, DIAGONAL, -1, 0, 0, -1],
  [1, 2, KNIGHT, 0, 1, 1, 1], [-1, 2, KNIGHT, 0, 1, -1, 1], [1, -2, KNIGHT, 0, -1, 1, -1], [-1, -2, KNIGHT, 0, -1, -1, -1],
  [2, 1, KNIGHT, 1, 0, 1, 1], [-2, 1, KNIGHT, -1, 0, -1, 1], [2, -1, KNIGHT, 1, 0, 1, -1], [-2, -1, KNIGHT, -1, 0, -1, -1]
];

// A flood's working memory for a width × height grid: made once and used for every frame of a run.
export function createLight(width, height) {
  const N = width * height;
  return { width, height, light: new Float64Array(N), queue: new Int32Array(N), queued: new Uint8Array(N) };
}

// The light that reaches every cell: `power` is how much each cell shines of itself (0 for one that doesn't; 1 is a
// full light), `solid` marks the cells that drink light, `reach` is how many pixels of open air a full light crosses
// before it is gone, and `depth` how many pixels into a solid it gets. Each cell takes the most light that reaches it
// by any way: its own, or a neighbour's less the step between them. A step that starts or ends in a solid costs the
// solid's rate. So does a diagonal step between two solid cells that touch at their corners, and a knight's move past
// a solid cell, so no light leaks through a wall one pixel thick. Returns `memory.light`, which the next call
// overwrites.
export function spreadLight(memory, power, solid, reach, depth) {
  const { width, height, light, queue, queued } = memory, N = width * height, air = 1 / reach, rock = 1 / depth;
  let head = 0, waiting = 0;
  light.fill(0);
  for (let c = 0; c < N; c++) if (power[c] > 0) { light[c] = power[c]; queue[waiting++] = c; queued[c] = 1; }
  while (waiting) {
    const c = queue[head];
    head = head + 1 === N ? 0 : head + 1; waiting--; queued[c] = 0;
    const here = light[c], x = c % width, y = (c - x) / width;
    for (let s = 0; s < 16; s++) {
      const step = STEP[s], nx = x + step[0], ny = y + step[1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      let through = solid[c] || solid[j];
      if (!through && s > 3) {
        const a = solid[c + step[4] * width + step[3]], b = solid[c + step[6] * width + step[5]];
        through = s > 7 ? a || b : a && b;
      }
      const next = here - (through ? rock : air) * step[2];
      if (next <= light[j] + CLEAR) continue;
      light[j] = next;
      if (!queued[j]) { queue[head + waiting < N ? head + waiting : head + waiting - N] = j; waiting++; queued[j] = 1; }
    }
  }
  return light;
}
