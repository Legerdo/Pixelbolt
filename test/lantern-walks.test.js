import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compilePoses } from '../src/authoring.js';
import { parseColor, renderProject } from '../src/core.js';

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

const bootFits = [
  { name: 'lamplighter', boots: ['footA', 'footB'], outlineKey: 'a', maxAtRim: 1 },
  { name: 'watchmaker', boots: ['boot-a', 'boot-b'], outlineKey: 'A', maxAtRim: 0 }
];
for (const { name, boots, outlineKey, maxAtRim } of bootFits) {
  test(name + ': both boots stay joined and emerge below the body on every step', async () => {
    const source = JSON.parse(await readFile(new URL('../showcase/lantern-walks/' + name + '.poses.json', import.meta.url)));
    const { recipe } = compilePoses(source);
    const project = renderProject(recipe, { owners: true });
    const { width } = project, body = characters[name].body;
    const outline = Buffer.from(parseColor(source.palette[outlineKey]));

    for (const boot of boots) {
      // A passing arm, lantern or second boot can hide a detached leg.
      const isolated = renderProject(recipe, { owners: true, layers: [body, boot] });
      const legId = isolated.ownerNames.indexOf(boot) + 1, bodyId = isolated.ownerNames.indexOf(body) + 1;
      const bootId = project.ownerNames.indexOf(boot) + 1;
      for (const [index, frame] of project.frames.entries()) {
        if (!frame.name.startsWith('walk-')) continue;
        const stamp = recipe.frames[index].layers.find(layer => layer.name === body).ops[0];
        // Measure at the centre of the body to exclude equipment hanging down at its side.
        const centre = frame.anchor[0] - stamp.x;
        const rim = stamp.y + recipe.symbols[stamp.symbol].findLastIndex(row => row[centre] !== '.');
        const owners = isolated.frames[index].owners;
        let touching = 0, pixelsAtRim = 0;
        for (let i = 0; i < owners.length; i++) {
          if (owners[i] === legId && (owners[i-width] === bodyId || owners[i+width] === bodyId ||
              (i % width > 0 && owners[i-1] === bodyId) || (i % width < width-1 && owners[i+1] === bodyId))) touching++;
          if (frame.owners[i] !== bootId) continue;
          const y = Math.floor(i / width), label = frame.name + '/' + boot + ' at ' + [i % width, y];
          assert.ok(y >= rim, 'exposed boot shaft above the body rim: ' + label);
          if (y === rim) {
            pixelsAtRim++;
            assert.equal(frame.owners[i+width], bootId, 'tapered edge must lead into the boot: ' + label);
          }
          if (y === rim || (y <= rim+2 && !frame.data[4*(i-width)+3])) {
            assert.deepEqual(Buffer.from(frame.data.subarray(4*i, 4*i+4)), outline, 'unoutlined boot corner: ' + label);
          }
        }
        assert.ok(touching >= 2, 'weak boot joint: ' + frame.name + '/' + boot);
        assert.ok(pixelsAtRim <= maxAtRim, 'flat boot cap outside the body: ' + frame.name + '/' + boot);
      }
    }
  });
}
