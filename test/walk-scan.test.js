import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePoses} from '../src/authoring.js';
import {renderProject} from '../src/core.js';
import {inspectWalks} from '../src/walk-scan.js';

function report(source) {
  const {recipe,metadata} = compilePoses(source);
  return inspectWalks(renderProject(recipe,{owners:true}),{},metadata,recipe).walkReview;
}

test('a square piston becomes visible beside its housing only in the wide profile',async () => {
  const file = new URL('../showcase/lantern-walks/watchmaker.poses.json',import.meta.url);
  const actor = JSON.parse(await readFile(file));
  assert.ok(report(actor).clips.every(clip=>!clip.findings.some(f=>f.kind==='exposed-shaft')));
  actor.parts['right-boot-b'].rows.splice(0,4,...Array(4).fill('AJJA..'));
  const clips = report(actor).clips;
  const affected = clips.filter(clip=>clip.findings.some(f=>f.kind==='exposed-shaft'));
  assert.deepEqual(affected.map(clip=>clip.clip),['walk-right']);
  const shaft = affected[0].findings.find(f=>f.kind==='exposed-shaft');
  assert.equal(shaft.part,'boot-b');
  assert.equal(shaft.otherPart,'shell');
  assert.equal(shaft.steps.length,1);
  assert.equal(shaft.steps[0].symbol,'right-boot-b');
  const [x,y] = shaft.steps[0].localPixel;
  assert.notEqual(actor.parts['right-boot-b'].rows[y][x],'.');
});

function jointStudy() {
  const poses = [{name:'stand',origin:[10,18],parts:[
    {name:'coat',part:'coat',at:[-4,-13]},
    {name:'sleeve',part:'cuff',at:[-2,-11]},
    {name:'back',part:'dot',at:[3,-7]},
    {name:'boot',part:'dot',at:[-2,-5]},
    {name:'shoe',part:'dot',at:[2,-5]},
    {name:'ring',part:'ring',at:[-8,-10]}
  ]}];
  return {format:'pixelforge-poses',version:1,name:'study',width:22,height:21,palette:{a:'#677788',b:'#323949'},
    parts:{coat:{rows:['aaaaa','aaaaa','aa.aa','aaaaa','aaaaa']},cuff:{rows:['b']},dot:{rows:['a']},ring:{rows:['bbb','b.b','bbb']}},
    poses,walkCycles:{walk:{rest:'stand',direction:'right',mirrorAs:'reflected',feet:['boot','shoe'],arms:['sleeve','back'],stride:4,bob:0,lift:1,duration:100}}};
}

test('a gap under a sleeve and an intended ring opening retain their native coordinates through reflection',()=>{
  const actor = jointStudy();
  const {clips} = report(actor);
  for (const clip of clips) {
    const gap = clip.findings.find(f=>f.kind==='underpaint-gap');
    assert.equal(gap.part,'coat');
    assert.equal(gap.otherPart,'sleeve');
    assert.deepEqual(gap.steps[0].localPixel,[2,2]);
    assert.deepEqual(gap.steps[0].standingPixel,[8,7]);
    assert.deepEqual(gap.steps[0].pixel,[clip.clip==='walk' ? 8 : 11,7]);
    const ring = clip.controls.find(row=>row.kind==='standing-opening' && row.part==='ring');
    assert.equal(ring.steps.length,8);
  }
  actor.parts.coat.rows[2]='aaaaa';
  assert.ok(report(actor).clips.every(clip=>!clip.findings.some(f=>f.kind==='underpaint-gap')));
});

test('a walk scan rejects mismatched steps in compiled metadata',()=>{
  const {recipe,metadata} = compilePoses(jointStudy());
  const project = renderProject(recipe,{owners:true});
  metadata.animations.walk.entries[0].frame='elsewhere';
  assert.throws(()=>inspectWalks(project,{},metadata,recipe),/steps of walk disagree/);
});
