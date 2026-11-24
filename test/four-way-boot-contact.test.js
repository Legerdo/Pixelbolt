import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compilePoses } from '../src/authoring.js';
import { renderProject } from '../src/core.js';

const facings = ['down', 'right', 'up', 'left'];
// RGBA of the four original complete stand cells, including the artist's negative space.
const stands = {
  mage: 'eff23167bb9ed44b975483e1b0cba45782c7bb08ad36e5e0b3bc1c2980456e5f',
  knight: '3c813681665d4c0445d5be720f4c3502738b056e9ae33d9a0b3be38629b9b289',
  ranger: '7283b8c4bc89110d1c67880c85ded2d5816d6d98a56f317a3238e042912b7a80'
};

function neighbors(pixel, width, length) {
  const adjacent = [];
  if (pixel % width > 0) adjacent.push(pixel - 1);
  if (pixel % width < width - 1) adjacent.push(pixel + 1);
  if (pixel >= width) adjacent.push(pixel - width);
  if (pixel + width < length) adjacent.push(pixel + width);
  return adjacent;
}

function checkBoot(project, frame, boot, minimumEdge, checkFragments) {
  const { owners } = frame;
  const foot = project.ownerNames.indexOf(boot) + 1;
  const body = project.ownerNames.indexOf('body') + 1;
  const label = frame.name + '/' + boot;
  const visible = [];
  for (let i = 0; i < owners.length; i++) if (owners[i] === foot) visible.push(i);
  if (!visible.length) return; // The hem or nearer leg can cover the whole shoe.
  const edge = visible.filter(i => neighbors(i, project.width, owners.length).some(j => owners[j] === body));
  assert.ok(edge.length >= minimumEdge, label + ': boot pixels sharing an edge with the outfit = ' + edge.length);
  if (!checkFragments) return;
  const remaining = new Set(visible);
  const pending = [visible[0]];
  remaining.delete(visible[0]);
  while (pending.length) {
    for (const j of neighbors(pending.pop(), project.width, owners.length)) {
      if (remaining.delete(j)) pending.push(j);
    }
  }
  assert.equal(remaining.size, 0, label + ': a heel fragment separates from the visible boot');
}

for (const [name, digest] of Object.entries(stands)) {
  test(name + ': all standing pixels and both boot joints through each four-way step', async () => {
    const source = JSON.parse(await readFile(new URL('../showcase/four-way-walk/' + name + '.poses.json', import.meta.url), 'utf8'));
    const { recipe } = compilePoses(source);
    const full = renderProject(recipe, { owners: true });
    const hash = createHash('sha256');
    for (const facing of facings) hash.update(full.frames.find(frame => frame.name === 'stand-' + facing).data);
    assert.equal(hash.digest('hex'), digest);

    for (const boot of ['boot-a', 'boot-b']) {
      // The sleeve and the crossing boot can conceal a seam, or appear to join a floating heel.
      const exposed = renderProject({ ...recipe, frames: recipe.frames.map(frame => ({
        ...frame, layers: frame.layers.filter(layer => layer.name === boot || layer.name === 'body')
      })) }, { owners: true });
      for (const facing of facings) {
        const clip = full.animations['walk-' + facing];
        assert.equal(clip.frames.length, 8);
        for (const index of clip.frames) {
          checkBoot(full, full.frames[index], boot, 1, true);
          checkBoot(exposed, exposed.frames[index], boot, 2, false);
        }
      }
    }
  });
}
