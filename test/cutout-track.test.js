import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePNG } from '../src/png.js';
import { renderProject } from '../src/core.js';
import { compilePoses } from '../src/authoring.js';
import { importCutoutPNG } from '../src/cutout-import.js';
import { inspectMotion } from '../src/motion.js';

// The two dark pixels at [7,5..6] belong to the prop. The broad foot box also selects them.
const rows = ['.........','..#####..','..#####..','..#####..','..######.','..##.###.','..##.###.','..##.##..'];
const pixels = new Uint8Array(9*8*4);
rows.forEach((row,y) => [...row].forEach((cell,x) => {
  if (cell === '#') pixels.set([31,43,55,255],4*(y*9+x));
}));
const png = encodePNG(pixels,9,8);
const pivot = [4,8], rects = [[7,4,1,3]];
function fixture(view = {}) {
  const cutout = { margin:4, pivot, views:{right:{
    feet:[[2,5,2,3],[5,5,3,3]], arms:[[2,3,1,1],[6,3,1,1]],
    stride:2, lift:0, bob:0, mirror:true, ...view
  }}};
  return compilePoses(importCutoutPNG(png, {cutout}).source);
}
function examine({recipe,metadata}, track = {part:'body',pivot,rects}, animation = 'walk-right') {
  const project = renderProject(recipe, {owners:true});
  return inspectMotion(project, {animation,metadata,track},recipe).motion.cutout.track;
}
test('same-coloured prop pixels keep their owner through real occlusions and a reflected walk', () => {
  const starter = fixture(), dirty = examine(starter);
  assert.equal(dirty.checked,3);
  assert.equal(dirty.wrongPixels,2);
  assert.deepEqual(dirty.wrong,[{owner:'footB',rect:[7,5,1,1]}, {owner:'footB',rect:[7,6,1,1]}]);
  assert.equal(dirty.passed,false);
  // Both disputed pixels have identical ink. Only the lower one touches coloured boot leather.
  starter.recipe.palette.F = '#985c48';
  const boot = starter.recipe.symbols['right-footB'];
  boot[1] = boot[1].slice(0,1) + 'F' + boot[1].slice(2);
  assert.deepEqual(examine(starter).edgesToReview,[
    {owner:'footB',pixel:[7,5],ownerNeighbor:null,partNeighbor:null},
    {owner:'footB',pixel:[7,6],ownerNeighbor:[6,6],partNeighbor:null}
  ]);
  const repaired = fixture({keepWith:{body:[[7,5,1,2]]}, overlap:[[7,5,1,2]]});
  assert.deepEqual(renderProject(repaired.recipe).frames[0].data,renderProject(fixture().recipe).frames[0].data);
  const clean = examine(repaired);
  assert.equal(clean.passed,true);
  assert.ok(clean.steps.some(step => step.coveredBy?.footB > 0));
  assert.ok(clean.steps.some(step => step.visible === 3));
  for (const step of clean.steps) assert.equal(step.visible + (step.coveredBy?.footB ?? 0),3);
  const mirrored = examine(repaired, {part:'body',rects:[[11,8,1,3]]},'walk-left');
  assert.deepEqual(mirrored.steps.map(s => [s.visible,s.coveredBy]), clean.steps.map(s => [s.visible,s.coveredBy]));
  const step = repaired.recipe.frames.find(f => f.name === 'walk-right-3');
  step.layers.find(layer => layer.name === 'body').visible = false;
  const lost = examine(repaired);
  assert.equal(lost.passed,false);
  assert.equal(lost.steps[2].lost,3);
});

test('pixels may be reserved for a moving arm; transparent gaps, overlaps and invalid masks are handled', () => {
  const arm = fixture({keepWith:{armA:rects},overlap:rects,extendFeet:2});
  const track = examine(arm, {part:'armA',pivot,rects:[...rects,...rects]});
  assert.equal(track.checked,3);
  assert.equal(track.passed,true);
  const body = arm.recipe.frames[0].layers.find(l => l.name === 'body');
  const bareBody = renderProject({...arm.recipe, animations:{}, frames:[{name:'only-body',layers:[body]}]});
  for (const y of [4,5,6]) assert.equal(bareBody.frames[0].data[4*((y+4)*17+11)+3],0);
  for (const keepWith of [{hat:rects},{body:[]},{body:[[20,0,1,1]]},{body:rects,armA:rects},
    {body:[[2,5,2,3]]}]) assert.throws(() => fixture({keepWith}), /keepWith|limb/);
  for (const mask of [null,{}, {part:'none',rects,pivot}, {part:'body',rects:[],pivot},
    {part:'body',rects:[[0,0,1,1]],pivot}, {part:'body',rects,pivot:[0.2,8]},
    {part:'body',rects:[[-10,0,1,1]],pivot}, {part:'body',rects,pivot,other:1}])
    assert.throws(() => examine(arm,mask), /track/);
  const step = arm.recipe.frames.find(f => f.name === 'walk-right-1');
  step.layers.find(layer => layer.name === 'armA').ops[0].rotate = 90;
  assert.throws(() => examine(arm,{part:'armA',pivot,rects}), /changes shape/);
});
