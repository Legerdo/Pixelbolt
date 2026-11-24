import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compilePoses } from '../src/authoring.js';
import { renderProject } from '../src/core.js';

const characters = {
  lamplighter: { body:'body', reflection:36, shoulderY:18, shoulderX:[9,10,11,12,22,23,24,25],
    wrist:[12,21], original:'d36ad051ef844fd10c88ab57ffc1687fde3b1af17e2ed37dd8c1c1381de4c281' },
  watchmaker: { body:'shell', reflection:29, shoulderY:13, shoulderX:[6,7,8,19,20,21],
    wrist:[20,20], original:'0a4831d5aab0b821eaa4ba04a59d706cf6e64839b05543077cd4cae65dbc9e64' }
};
for (const [name, art] of Object.entries(characters)) {
  test(name + ': standing drawings match and shoulder and wrist joints stay opaque', async () => {
    const source = JSON.parse(await readFile(new URL('../showcase/lantern-walks/' + name + '.poses.json',import.meta.url)));
    const {recipe} = compilePoses(source), project = renderProject(recipe);
    const stands = createHash('sha256');
    const bodyY = frame => recipe.frames.find(f => f.name === frame.name).layers.find(l => l.name === art.body).ops[0].y;
    for (const facing of ['down','right','up','left']) {
      const rest = project.frames.find(f => f.name === 'stand-' + facing);
      stands.update(rest.data);
      if (!['down','up'].includes(facing)) continue;
      const joints = [...art.shoulderX.map(x => [x,art.shoulderY]),art.wrist];
      for (const index of project.animations['walk-' + facing].frames) {
        const frame = project.frames[index], bob = bodyY(frame)-bodyY(rest);
        for (const [frontX,y] of joints) {
          const x = facing === 'up' ? art.reflection-frontX : frontX;
          assert.equal(frame.data[4*((y+bob)*project.width+x)+3],255,frame.name + ' at ' + [x,y+bob]);
        }
      }
    }
    assert.equal(stands.digest('hex'),art.original);
  });
}

test('Lamplighter: the moving boots emerge below the coat on every step', async () => {
  const source = JSON.parse(await readFile(new URL('../showcase/lantern-walks/lamplighter.poses.json',import.meta.url)));
  const {recipe} = compilePoses(source), project = renderProject(recipe,{owners:true});
  const width = project.width, outline = Buffer.from(source.palette.a.slice(1),'hex');
  const bootIds = ['footA','footB'].map(name => project.ownerNames.indexOf(name) + 1);
  for (const frame of project.frames.filter(f => f.name.startsWith('walk-'))) {
    const layers = recipe.frames.find(f => f.name === frame.name).layers;
    const coat = layers.find(l => l.name === 'body').ops[0];
    // The centre column follows the coat as it bobs. The lantern hangs lower at the side.
    const centre = frame.anchor[0] - coat.x;
    const hem = coat.y + recipe.symbols[coat.symbol].findLastIndex(row => row[centre] !== '.');
    for (const boot of bootIds) {
      let pixelsAtHem = 0;
      for (let i = 0; i < frame.owners.length; i++) {
        if (frame.owners[i] !== boot) continue;
        const y = Math.floor(i / width), label = frame.name + ' at ' + [i % width,y];
        assert.ok(y >= hem, 'exposed boot shaft above the hem: ' + label);
        if (y === hem) {
          pixelsAtHem++;
          assert.equal(frame.owners[i+width],boot,'the tapered edge must lead into the boot: ' + label);
        }
        if (y === hem || (y <= hem+2 && !frame.data[4*(i-width)+3])) {
          assert.deepEqual(Buffer.from(frame.data.subarray(4*i,4*i+4)),outline,'unoutlined boot corner: ' + label);
        }
      }
      assert.ok(pixelsAtHem <= 1,'flat cap outside the coat: ' + frame.name);
    }
  }
});
