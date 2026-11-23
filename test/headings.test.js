import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderProject, buildAtlas } from '../src/core.js';
import { createBundle } from '../src/export.js';
import { keepFrames } from '../src/resize.js';
import { compileStack } from '../src/stack.js';
import { spriteFrames } from '../src/godot.js';
import { nearestHeading, headingFrame, headingAnimation, headingToward } from '../src/runtime.js';

// A character drawn facing four ways, standing and walking, with nothing to do with a sprite stack.
const dot = (name, x) => ({ name, duration: 100, ops: [{ op: 'pixel', x, y: 1, color: 'k' }] });
const drawn = {
  version: 1, name: 'facing', width: 4, height: 4, palette: { k: '#102030' },
  frames: [dot('south', 0), dot('west', 1), dot('north', 2), dot('east', 3), dot('step-south', 0), dot('step-west', 1), dot('spare', 2)],
  animations: { 'walk-south': { frames: ['south', 'step-south'] }, 'walk-west': { frames: ['west', 'step-west'] }, stand: { frames: ['south'] } },
  headings: { frames: { 0: 'south', 90: 'west', 180: 'north', 270: 'east' }, animations: { walk: { 0: 'walk-south', 90: 'walk-west' } }, toward: { 0: [0, 1], 90: [-1, 0], 180: [0, -1], 270: [1, 0] } }
};

test('a recipe says which frames and animations stand at which heading, and its atlas carries that', async () => {
  const project = renderProject(drawn), atlas = buildAtlas(project).metadata;
  assert.deepEqual(project.headings, drawn.headings);
  assert.deepEqual(atlas.meta.headings, drawn.headings);
  const plain = { ...drawn }; delete plain.headings;
  assert.equal(renderProject(plain).headings, undefined);
  assert.equal(Object.hasOwn(buildAtlas(renderProject(plain)).metadata.meta, 'headings'), false);
  const bundle = await createBundle(drawn);
  assert.deepEqual(JSON.parse(bundle.files.get('facing.atlas.json')).meta.headings, drawn.headings);
  // Only what it lists is accepted, each named by a path.
  const refused = (headings, pattern) => assert.throws(() => renderProject({ ...drawn, headings }), pattern);
  refused({}, /project\.headings: expected frames, animations or both/);
  refused({ frames: {} }, /project\.headings\.frames: expected at least one heading/);
  refused({ frames: { 0: 'sideways' } }, /project\.headings\.frames\.0: unknown frame "sideways"/);
  refused({ frames: { 360: 'south' } }, /project\.headings\.frames\.360: a heading is a whole number of degrees from 0 to 359/);
  refused({ frames: { '090': 'west' } }, /project\.headings\.frames\.090: a heading is a whole number/);
  refused({ frames: { north: 'north' } }, /project\.headings\.frames\.north: a heading is a whole number/);
  refused({ animations: { walk: { 0: 'run-south' } } }, /project\.headings\.animations\.walk\.0: unknown animation "run-south"/);
  refused({ animations: { walk: {} } }, /project\.headings\.animations\.walk: expected at least one heading/);
  refused({ animations: {} }, /project\.headings\.animations: expected 1–64 named animations/);
  refused({ frames: { 0: 'south' }, toward: { 0: [0, 0] } }, /project\.headings\.toward\.0: a direction is not \[0, 0\]/);
  refused({ frames: { 0: 'south' }, toward: { 0: [2, 0] } }, /project\.headings\.toward\.0\[0\]/);
  refused({ frames: { 0: 'south' }, toward: { 0: [1] } }, /project\.headings\.toward\.0: expected \[x, y\]/);
  refused({ frames: { 0: 'south' }, facing: {} }, /project\.headings\.facing/);
  const unnamed = { ...drawn, headings: { animations: { walk: { 0: 'default' } } } }; delete unnamed.animations;
  assert.throws(() => renderProject(unnamed), /project\.headings\.animations: the recipe names no animations/);
});

test('a game picks the nearest heading, its frame, an animation there, and the heading that faces a direction', () => {
  const atlas = buildAtlas(renderProject(drawn)).metadata;
  // Headings go round at 360, and between two equally near the lower is taken.
  assert.deepEqual([0, 44, 45, 46, 135, 200, 314, 315, 316, 359, 360, 450, -90, -1, 725].map(degrees => nearestHeading(atlas, degrees)), [0, 0, 0, 90, 90, 180, 270, 0, 0, 0, 0, 90, 270, 0, 0]);
  assert.deepEqual([0, 100, 170, 280].map(degrees => headingFrame(atlas, degrees)), ['south', 'west', 'north', 'east']);
  // An animation is looked up among its own headings: walk is drawn at two.
  assert.deepEqual([0, 44, 46, 180, 226, 300].map(degrees => nearestHeading(atlas, degrees, 'walk')), [0, 0, 90, 90, 0, 0]);
  assert.deepEqual([10, 80, 200].map(degrees => headingAnimation(atlas, 'walk', degrees)), ['walk-south', 'walk-west', 'walk-west']);
  // By the direction something moves on screen, y down.
  assert.deepEqual([[0, 1], [0, 5], [-1, 0], [0, -1], [3, 0], [-2, 1], [1, 2], [1, -3]].map(([x, y]) => headingToward(atlas, x, y)), [0, 0, 90, 180, 270, 90, 0, 180]);
  assert.deepEqual([[0, 1], [-1, 0], [1, 0], [0, -1], [-1, -5]].map(([x, y]) => headingToward(atlas, x, y, 'walk')), [0, 90, 0, 90, 90]);
  assert.throws(() => nearestHeading(atlas, NaN), /A heading is a number of degrees/);
  assert.throws(() => headingAnimation(atlas, 'run', 0), /lists no headings for the animation: run/);
  assert.throws(() => headingToward(atlas, 0, 0), /not both zero/);
  const plain = { ...drawn }; delete plain.headings;
  const bare = buildAtlas(renderProject(plain)).metadata;
  assert.throws(() => headingFrame(bare, 0), /This atlas lists no frames by heading/);
  assert.throws(() => headingToward(bare, 1, 0), /does not say which way its headings face/);
  const unfaced = buildAtlas(renderProject({ ...drawn, headings: { frames: drawn.headings.frames } })).metadata;
  assert.throws(() => headingToward(unfaced, 1, 0), /does not say which way its headings face/);
});

test('a compiled sprite stack lists its headings, its animations at each and the way its front faces', async () => {
  const fill = (w, h, key) => Array.from({ length: h }, () => key.repeat(w));
  const source = { format: 'pixelforge-stack', version: 1, name: 'facing-stack', palette: { b: '#804020', t: '#8090a0' }, headings: [0, 90, 180, 270], slices: [fill(4, 4, 'b')],
    sockets: { top: { at: [2, 2, 1] } }, parts: { lid: { socket: 'top', at: [-1, -1, 0], slices: [fill(2, 2, 't')] } }, directions: { front: 0 },
    animations: { lift: { frames: 2, headings: [0, 45], sockets: { top: [{ frame: 0 }, { frame: 2, offset: [0, 0, 2] }] } } } };
  const { recipe } = compileStack(source);
  assert.deepEqual(recipe.headings, {
    frames: { 0: 'heading-0', 90: 'heading-90', 180: 'heading-180', 270: 'heading-270' },
    animations: { lift: { 0: 'lift-front', 45: 'lift-45' } },
    // Oblique: at heading 0 the south side, the stack's front, faces the viewer, and it turns clockwise from there.
    toward: { 0: [0, 1], 45: [-0.8384, 0.545], 90: [-1, 0], 180: [0, -1], 270: [1, 0] }
  });
  assert.equal(compileStack({ ...source, animations: undefined, directions: undefined }).recipe.headings.animations, undefined);
  // On an isometric map's grid the front points down a ground axis: two across for one down.
  const iso = compileStack({ ...source, projection: 'iso', cell: 1 }).recipe.headings.toward;
  assert.deepEqual([iso[0], iso[90], iso[180], iso[270], iso[45]], [[-0.8944, 0.4472], [-0.8944, -0.4472], [0.8944, -0.4472], [0.8944, 0.4472], [-1, 0]]);
  // The villager's names are the compass points his front faces on screen.
  const villager = compileStack(JSON.parse(await readFile(new URL('../examples/iso-villager.stack.json', import.meta.url), 'utf8'))).recipe;
  const compass = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };
  for (const [heading, animation] of Object.entries(villager.headings.animations.walk)) {
    const [x, y] = villager.headings.toward[heading], [wantX, wantY] = compass[animation.slice(5)];
    assert.deepEqual([Math.sign(x), Math.sign(y)], [wantX, wantY], `${animation} at ${heading} faces ${[x, y]}`);
  }
  const atlas = buildAtlas(renderProject(villager)).metadata;
  assert.equal(headingAnimation(atlas, 'walk', headingToward(atlas, 3, 1, 'walk')), 'walk-se');
  assert.equal(headingFrame(atlas, headingToward(atlas, -1, -1)), 'heading-90');
  // Kept to fewer frames, the turn loses headings and the lookup loses them with it; the animations keep theirs.
  const fewer = keepFrames(villager, 4).recipe;
  assert.deepEqual(fewer.headings.frames, { 0: 'heading-0', 90: 'heading-90', 180: 'heading-180', 270: 'heading-270' });
  assert.deepEqual(fewer.headings.animations, villager.headings.animations);
  renderProject(fewer);
  // The Godot SpriteFrames says the same as metadata: a heading's frame as the animation that plays it and its place there.
  const { text } = spriteFrames(buildAtlas(renderProject(recipe)).metadata);
  assert.match(text, /\nmetadata\/headings = \{\n"frames": \{\n0: \[&"turn", 0\],\n90: \[&"turn", 1\],\n180: \[&"turn", 2\],\n270: \[&"turn", 3\]\n\},\n"animations": \{\n"lift": \{\n0: &"lift-front",\n45: &"lift-45"\n\}\n\},\n"toward": \{\n0: Vector2\(0\.0, 1\.0\),\n45: Vector2\(-0\.8384, 0\.545\),/);
  // A frame no animation plays has no place in a SpriteFrames, so its heading is left out there.
  const hand = spriteFrames(buildAtlas(renderProject(drawn)).metadata).text;
  assert.match(hand, /"frames": \{\n0: \[&"walk-south", 0\],\n90: \[&"walk-west", 0\]\n\},\n"animations": \{\n"walk": \{\n0: &"walk-south",\n90: &"walk-west"\n\}\n\}/);
  const plain = { ...drawn }; delete plain.headings;
  assert.doesNotMatch(spriteFrames(buildAtlas(renderProject(plain)).metadata).text, /metadata/);
});
