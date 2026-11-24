import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProject } from '../src/core.js';
import { prepareWalkEdges, inspectWalkEdges } from '../src/walk-edges.js';

// Use the renderer for both depth orders and rigid stamps. The review receives just the
// visible owners, drawings, transforms and declared feet as it does from inspectWalks.
const width = 20, height = 14;
function walk(symbols, positions, offsets, order = Object.keys(positions), flipped = false) {
  const makeFrame = (name,offset) => ({name,layers:order.map(part=>{
    const [x,y]=positions[part], [dx,dy]=offset[part] ?? [0,0];
    return {name:part,ops:[{op:'stamp',symbol:part,x:x+dx,y:y+dy,flipX:flipped}]};
  })});
  const recipe={version:1,name:'walk',width,height,symbols,
    palette:{a:'#24242a',b:'#a15f38',l:'#e9c25e',w:'#fff0a6'},
    frames:[makeFrame('stand',{}),makeFrame('step',offsets)]};
  const project=renderProject(recipe,{owners:true}), [stand,step]=project.frames;
  const ids=new Map(project.ownerNames.map((n,i)=>[n,i+1]));
  const base=new Map(Object.entries(positions).map(([name,[x,y]])=>[ids.get(name),
    {rows:symbols[name],x,y,flipped,symbol:name}]));
  const feet=new Set([ids.get('shoe'),ids.get('sole')]);
  const evidence=prepareWalkEdges(stand,feet,width,base), reports=[];
  function toStep(i,id) {
    const [dx,dy]=offsets[project.ownerNames[id-1]] ?? [0,0];
    const x=i%width+dx, y=Math.floor(i/width)+dy;
    return x<0 || y<0 || x>=width || y>=height ? -1 : y*width+x;
  }
  inspectWalkEdges(evidence,step,width,toStep,(kind,frame,foot,peer,at,i,count,extra)=>{
    assert.equal(frame,step);
    reports.push({kind,foot:project.ownerNames[foot-1],peer:project.ownerNames[peer-1],
      step:[at%width,Math.floor(at/width)],stand:[i%width,Math.floor(i/width)],count,...extra});
  });
  return reports;
}

const positions={prop:[7,4],shoe:[3,4],sole:[13,4]};
const sole=['aba','aba','aaa'];
const moving=r=>r.kind==='moving-edge';
test('three rim pixels move with a boot; the clean shared outlines point to no transfer',()=>{
  const clean={prop:['alla','awwa','alla','aaaa'],shoe:['abba','abba','abba','.aaa'],sole};
  const damaged={prop:['.lla','.wwa','.lla','aaaa'],shoe:['abbaa','abbaa','abbaa','.aaa.'],sole};
  assert.ok(!walk(clean,positions,{shoe:[-2,1]}).some(moving));
  const row=walk(damaged,positions,{shoe:[-2,1]}).find(moving);
  assert.deepEqual([row.foot,row.peer,row.count],['shoe','prop',3]);
  assert.deepEqual(row.stand,[7,4]);
  assert.deepEqual(row.step,[5,5]);
  assert.deepEqual(row.peerPixel,row.stand);
  assert.deepEqual(row.localPixel,[4,0]);
  // With a complete rim underpainted, the same visible extra edge can travel over it.
  assert.ok(!walk({...damaged,prop:clean.prop},positions,{shoe:[-2,1]}).some(moving));
  assert.ok(!walk(damaged,positions,{shoe:[0,1],prop:[0,1]}).some(moving));
});

test('real same-ink crossings preserve the drawn foreground in either layer order',()=>{
  const drawings={prop:['aaa','aaa','aaa'],shoe:['aaa','aba','aaa'],sole};
  const places={prop:[8,4],shoe:[3,4],sole:[14,4]};
  const front=walk(drawings,places,{shoe:[5,0]}).find(r=>r.kind==='foreground-crossing');
  assert.equal(front.foreground,'part');
  assert.equal(front.count,9);
  assert.equal(front.sameInk,true);
  assert.deepEqual(front.stand,[3,4]);
  assert.deepEqual(front.coveredStandingPixel,[8,4]);
  assert.deepEqual(front.step,[8,4]);
  const behind=walk(drawings,places,{shoe:[5,0]},['shoe','prop','sole']).find(r=>r.kind==='foreground-crossing');
  assert.equal(behind.foreground,'otherPart');
  assert.equal(behind.count,9);
  assert.deepEqual(behind.coveredStandingPixel,behind.stand);
  assert.deepEqual(behind.step,[8,4]);
});

test('a disjoint piece of equipment has a local witness on a reflected foot drawing',()=>{
  const drawings={prop:['lll','lwl'],shoe:['bbb..w','bbb..l','aaa...'],sole};
  const reports=walk(drawings,{prop:[5,4],shoe:[8,4],sole:[14,5]},{shoe:[2,2]},undefined,true);
  const row=reports.find(r=>r.kind==='carried-island');
  assert.deepEqual([row.foot,row.peer,row.count],['shoe','prop',2]);
  assert.deepEqual(row.stand,[8,4]);
  assert.deepEqual(row.localPixel,[5,0]);
  assert.deepEqual(row.step,[10,6]);
});

test('a small patch under the equipment is supported by its pigment and shape',()=>{
  const drawings={prop:['lll','lwl','lll'],shoe:['ll','ll'],sole};
  const row=walk(drawings,{prop:[4,2],shoe:[4,5],sole:[13,5]},{shoe:[4,1]}).find(moving);
  assert.equal(row.count,4);
  assert.match(row.basis,/most foot pixels/);
  assert.ok(!walk({...drawings,sole:['ala','ala','aaa']},
    {prop:[4,2],shoe:[4,5],sole:[13,5]},{shoe:[4,1]}).some(moving));
});

