import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderProject } from '../src/core.js';
import { createBundle } from '../src/export.js';
import { compileEffects } from '../src/fx.js';
import { helpText } from '../src/help.js';
import { compilePreset } from '../src/presets.js';
import { keepFrames } from '../src/resize.js';
import { prepareScene } from '../src/scene.js';

// What the docs and the generated schema tell an agent making a full-screen overlay, followed as written.
const read = async file => (await readFile(new URL(`../${file}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const recipe = (name, width, height, frames) => ({ version: 1, name, width, height, palette: { d: '#9fb8d8' }, frames: Array.from({ length: frames }, (_, i) => ({ name: `${name}-${i}`, ops: [{ op: 'pixel', x: i % width, y: 0, color: 'd' }] })) });
const overScene = (width, height, frames) => prepareScene({ format: 'pixelforge-scene', version: 1, name: 's', width, height, assets: { bg: recipe('bg', width, height, 1), rain: recipe('rain', width, height, frames) }, instances: [{ name: 'bg', asset: 'bg', at: [0, 0] }, { name: 'rain', asset: 'rain', at: [0, 0] }] });

test('an overlay over a still backdrop in a scene gets one frame fewer: 71 of 320x180, 31 of 480x270', async () => {
  const craft = await read('docs/agent-craft.md'), scene = JSON.parse(await read('scene.schema.json'));
  for (const text of [craft, await read('docs/art-workflow.md'), scene.properties.assets.description]) assert.match(text, /one frame fewer[^.]*71 of 320 ?× ?180, 31 of 480 ?× ?270/);
  for (const [width, height, fits] of [[320, 180, 71], [480, 270, 31]]) {
    assert.ok(overScene(width, height, fits), `${fits} frames of ${width}x${height} sit over the backdrop`);
    assert.throws(() => overScene(width, height, fits + 1), { message: /^scene\.assets\.rain: a scene's assets render at most 4,194,304 pixels in all/ });
  }
});

test('the fx canvas size says a source with more frames than fit compiles with frames, and it does', async () => {
  const width = JSON.parse(await read('fx.schema.json')).properties.width.description;
  assert.match(width, /72 frames of 320×180; a source with more compiles with frames \(--frames\), which keeps that many evenly spaced\./);
  const rain = frames => ({ format: 'pixelforge-fx', version: 1, name: 'rain', width: 320, height: 180, palette: { d: '#9fb8d8' }, symbols: { drop: ['d'] },
    effects: { rain: { frames, duration: 60, loop: true, seed: 7, edges: ['top', 'left', 'right'], emitters: [{ at: [150, -8], area: [400, 1], rate: 2, angle: [100, 102], speed: [8, 9], life: [16, 21], shapes: ['drop'] }] } } });
  assert.throws(() => compileEffects(rain(96)), /72 frames of 320×180 fit/);
  const thinned = keepFrames(compilePreset(rain(96), { frames: 72 }).recipe, 72);
  assert.equal(renderProject(thinned.recipe).frames.length, 72);
});

test('an overlay delivered for Godot is its own render\'s .tres, which plays every frame', async () => {
  assert.match(await read('docs/agent-craft.md'), /bakes an animated placement in as its frame 0, so deliver the overlay's own `\.tres` from `render --out`/);
  const bundle = await createBundle(recipe('rain', 320, 180, 12));
  const tres = bundle.files.get('rain.tres')?.toString();
  assert.ok(tres, 'render --out writes the overlay\'s SpriteFrames');
  assert.equal(tres.match(/"texture": /g)?.length, 12);
});

test('the guide\'s sentence on text in a sorted layer reads right on its own', async () => {
  const guide = await read('docs/agent-guide.md');
  // Before: "Text needs `ground`.", which a word search for text showed alone, though text outside a sorted layer needs none.
  assert.doesNotMatch(guide, /Text needs `ground`\./);
  const sentence = guide.match(/[^.]*text`? operation in a sorted layer[^.]*\./)?.[0];
  assert.match(sentence, /A `text` operation in a sorted layer has no lowest row of its own, so it needs `ground` there\./);
  // Following it: text with ground in a sorted layer renders, as the core's refusal without it asks.
  const sorted = ground => ({ version: 1, name: 't', width: 32, height: 16, palette: { d: '#123456' }, frames: [{ name: 'f', layers: [{ name: 'l', sort: 'ground', ops: [{ op: 'text', x: 1, y: 1, text: 'HI', color: 'd', ...(ground !== undefined && { ground }) }] }] }] });
  assert.throws(() => renderProject(sorted()), /needs ground/);
  assert.equal(renderProject(sorted(6)).frames.length, 1);
  assert.ok((await helpText('guide', 'text')).includes('has no lowest row of its own'));
});
