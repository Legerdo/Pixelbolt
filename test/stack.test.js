import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { goldens } from '../scripts/goldens.mjs';
import { cliReply } from './fixtures/cli-reply.js';
import { renderProject } from '../src/core.js';
import { readFile } from 'node:fs/promises';
import { compileStack, prepareStack, stackSide } from '../src/stack.js';
import { prepareScene, renderScene } from '../src/scene.js';
import { createSceneBundle } from '../src/scene-export.js';
import { stackPaths } from '../src/stack-paths.js';
import { cosDeg, sinDeg } from '../src/craft.js';

const golden = goldens(new URL('./goldens/stack.json', import.meta.url));
const block = {
  format: 'pixelforge-stack', version: 1, name: 'block', palette: { k: '#111', s: '#fff' },
  slices: [['kkk', 'kkk', 'kkk'], ['kkk', 'kkk', 'kkk']], headings: [0, 90, 180, 270]
};
test('a tip frame carries a rigid crystal and its seam while a sibling stays put', () => {
  const path = (at,end) => ({colors:'k',nodes:[
    {name:'base',at,radius:1},{name:'tip',at:end,radius:.5}
  ]});
  const source = {...block, paths:{
    nail:{...path([0,0,0],[0,0,2]),attach:'index',colors:'g'},
    index:path([0,0,0],[0,0,3]), other:path([3,0,0],[3,0,3])
  }, palette:{...block.palette,g:'#8ef8'}, poses:{open:{},hook:{index:{base:90,tip:90}}},
    poseKeys:[{heading:0,pose:'open'},{heading:180,pose:'hook'}]};
  const rig=stackPaths(source,new Map(),0);
  const open=rig.mesh(rig.anglesAt(0)), hook=rig.mesh(rig.anglesAt(180));
  for (const angle of [0,30,90,150,180]) {
    const {posed,facets}=rig.mesh(rig.anglesAt(angle)), tip=posed.get('index').centres[1];
    const nail=posed.get('nail');
    assert.deepEqual(nail.centres[0],tip);
    assert.deepEqual(posed.get('other'),open.posed.get('other'));
    const expected=open.facets.filter(f=>f.ink===103), moved=facets.filter(f=>f.ink===103);
    for (let i=0;i<expected.length;i++) for (let j=0;j<expected[i].points.length;j++) {
      const xyz=expected[i].points[j].xyz.map((v,k)=>v-open.posed.get('nail').centres[0][k]);
      const [x,y,z]=xyz, c=cosDeg(angle), s=sinDeg(angle);
      const rotated=[x,y*c-z*s,y*s+z*c];
      for (let k=0;k<3;k++) assert.ok(Math.abs(tip[k]+rotated[k]-moved[i].points[j].xyz[k])<1e-5);
    }
  }
  assert.ok(Math.abs(hook.posed.get('nail').centres[1][2]+2)<1e-6);
  assert.equal(rig.anglesAt(90).get('index.tip'),45);
  const edited=structuredClone(source);
  edited.paths.index.nodes[1].at=[3,0,0];
  const reshaped=stackPaths(edited,new Map(),0).mesh(new Map());
  assert.deepEqual(reshaped.posed.get('nail').centres,[[3,0,0],[5,0,0]]);
  const prepared=prepareStack(source), original=prepared.recipe();
  const request={poses:['hook','open'],headings:[21,74,122],focus:'index',size:64};
  const sheet=prepared.poseStudy(request);
  assert.deepEqual(prepared.recipe(),original);
  assert.deepEqual(sheet,prepared.poseStudy(request));
  assert.equal(sheet.frames.length,6);
  assert.throws(()=>prepared.poseStudy({...request,headings:[21,21]}),/headings/);
  assert.throws(()=>prepared.poseStudy({...request,focus:'missing'}),/focus/);
  assert.throws(()=>prepareStack({...source,paths:{index:{...source.paths.index,attach:'nail'},nail:source.paths.nail}}),/cycle/);
  assert.throws(()=>prepareStack({...source,poses:{bad:{index:{typo:20}}}}),/unknown joint/);
  assert.throws(()=>prepareStack({...source,paths:{index:path([0,0,0],[0,0,0])}}),/successive centres/);
});

test('a bent rib stays on the membrane boundary and its vein paints either side', () => {
  const rib=x=>({colors:'k',nodes:[{name:'root',at:[x,0,0],radius:0},{name:'end',at:[x,0,5],radius:0}]});
  const membrane={ribs:['a','b'],colors:'s',sag:-1,scallop:1,veins:[{color:'v',points:[[0,.5,.2],[1,.5,.2]]}]};
  const source={...block,slices:[['.']],paths:{a:rib(0),b:rib(6)},palette:{...block.palette,v:'#ff0000'},
    membranes:[membrane],poses:{open:{},fold:{b:{root:35}}}};
  const rig=stackPaths(source,new Map(),0), mesh=rig.mesh(rig.poses.get('fold'));
  const bands=mesh.facets.filter(f=>f.ink==='s'.charCodeAt(0));
  assert.equal(bands.length,4);
  assert.ok(bands[1].points[2].xyz[1]<0,'a one-colour membrane sags between its ribs');
  assert.deepEqual(bands[0].points[3].xyz,mesh.posed.get('a').centres[1]);
  assert.deepEqual(bands.at(-1).points[2].xyz,mesh.posed.get('b').centres[1]);
  assert.deepEqual(bands[0].points[2],bands[1].points[3]);
  const sheet=renderProject(prepareStack(source).poseStudy({poses:['open','fold'],headings:[0,180]}));
  for (const frame of sheet.frames) assert.ok(frame.data.some((v,i)=>i%4===0&&v===255&&frame.data[i+1]===0));
  assert.throws(()=>prepareStack({...source,membranes:[{...membrane,ribs:['a','absent']}]}),/ribs/);
});

const grid = (source, heading) => compileStack(source).recipe.frames.find(f => f.name === `heading-${heading}`).ops[0].rows;

test('each painted side is visible from its own heading and fully hidden edge-on and behind', () => {
  for (const [face, angle] of [['south', 0], ['east', 90], ['north', 180], ['west', 270]]) {
    const source = { ...block, paint: [{ face, rows: ['sss', 'sss'] }] };
    assert.deepEqual(stackSide(source, face), ['sss', 'sss']);
    for (const frame of compileStack(source).recipe.frames) {
      const silver = frame.ops[0].rows.join('').split('s').length - 1;
      assert.equal(silver, frame.name === `heading-${angle}` ? 96 : 0, `${face}, ${frame.name}`);
    }
  }
});

test('paint depth colours connected solid cells and stops at air', () => {
  const marker = { face: 'west', rows: ['s'], depth: 6 };
  const model = { ...block, slices: [['kk.kk']], paint: [marker] };
  assert.deepEqual(stackSide(model, 'south'), ['ss.kk']);
  assert.deepEqual(stackSide(model, 'east'), ['k']);
  assert.deepEqual(stackSide({ ...model, paint: [{ ...marker, depth: 0 }] }, 'south'), ['kk.kk']);
  assert.deepEqual(stackSide({ ...model, paint: [marker, { face:'west', rows:['k'] }] }, 'west'), ['k']);
});

test('named decals mirror independently and erasing peels one stroke per cell', () => {
  const source = { ...block, decals: { rim: ['s..', '.s.'] }, paint: [
    { face: 'north', decal: 'rim' }, { face: 'south', decal: 'rim', flipX: true, flipY: true }
  ] };
  assert.deepEqual(stackSide(source, 'north'), ['skk','ksk']);
  assert.deepEqual(stackSide(source, 'south'), ['ksk','kks']);
  source.paint.push({ face:'south', at:[1,0], rows:['kk'], depth:3 }, { face:'south', at:[1,0], erase:['x.'] });
  assert.deepEqual(stackSide(source, 'south'), ['ksk','kks']);
  source.paint.push({ face:'south', at:[1,0], erase:['x.'] });
  assert.deepEqual(stackSide(source, 'south'), ['kkk','kks']);
  assert.deepEqual(stackSide(source, 'north'), ['skk','ksk']);
  assert.deepEqual(source.decals.rim, ['s..','.s.']);
  const deep = { ...block, slices:[['kkk']], paint:[{ face:'west', rows:['s'], depth:3 }, { face:'west', erase:['x'] }] };
  assert.deepEqual(stackSide(deep,'south'), ['kkk']);
  for (const place of [{ decal:'missing' }, { rows:['s'], decal:'rim' }, { erase:['s'] },
    { erase:['x'], depth:1 }, { rows:['s'], flipX:false }, { decal:'rim', flipY:2 }, { decal:'rim', flipX:null }]) {
    assert.throws(() => compileStack({ ...source, paint:[{ face:'south', ...place }] }), /stack.paint/);
  }
});

test('an isolated heading and pinned detail match the full turn, including occlusion and padding', () => {
  for (const projection of ['iso','oblique']) {
    const model = prepareStack({ ...block, projection, pivot:[0,2], spacing:2, headings:[359,0,1,90,135],
      paint:[{ face:'south', at:[0,1], rows:['sss'] }] });
    const first = model.recipe(3), full = model.recipe();
    assert.deepEqual(first.anchor, full.anchor);
    assert.deepEqual(first.frames, [full.frames[3]]);
    assert.equal(model.detail('south', [0,2], 0), null);
    for (const [i, heading] of model.metadata.headings.entries()) for (const face of ['north','south','west','east']) {
      const { left, top, rows } = model.detail(face,[0,1],heading,17);
      const whole = full.frames[i].ops[0].rows;
      rows.forEach((row,y) => assert.equal(row,
        Array.from({length:17}, (_,x) => whole[top+y]?.[left+x] ?? '.').join(''), `${projection} ${face} ${heading}°`));
    }
  }
});

test('4× is the native projection default; iso zero follows the 2:1 diagonal', () => {
  const source = { ...block, headings: [0], projection: 'iso' };
  const iso = compileStack(source).recipe, rows = iso.frames[0].ops[0].rows;
  assert.deepEqual(rows, grid({ ...block, headings: [45], squash: .5, resolution: 4 }, 45));
  assert.deepEqual(iso, compileStack({ ...source, resolution: 4 }).recipe);
  // Distinct boundaries within four output scanlines cannot come from repeating low-res pixels.
  assert.ok(new Set(rows.slice(0, 4)).size > 1);
  assert.ok(iso.width > compileStack({ ...source, resolution: 1 }).recipe.width * 2);
  const colours = new Set(rows.join(''));
  assert.deepEqual(colours, new Set(['.', 'k']));
});

const shaded = { format: 'pixelforge-stack', version: 1, name: 'shaded', palette: { d: '#402010', w: '#805030', l: '#c09060', s: '#ffe299' },
  ramps: ['dwl'], slices: Array.from({ length: 6 }, () => Array(6).fill('wwwwww')), resolution: 4 };
const tonesOf = rows => new Set(rows.join('').replaceAll('.', ''));
const runs = row => row.replaceAll('.', '').replaceAll(/(.)\1+/g, '$1');

test('ramps tone a box by its faces under one light, and a stack without them is drawn as written', () => {
  const { recipe } = compileStack({ ...shaded, projection: 'iso', headings: [0] }), rows = recipe.frames[0].ops[0].rows;
  assert.deepEqual(recipe.ramps, [['d', 'w', 'l']]);
  // The roof a step lighter, the side to the light as drawn, the side turned from it a step darker: three whole faces.
  const middle = Math.floor(recipe.width / 2), low = rows[recipe.height - 12];
  assert.equal(rows[8][middle], 'l');
  assert.deepEqual(tonesOf([low.slice(0, middle - 2)]), new Set(['w']));
  assert.deepEqual(tonesOf([low.slice(middle + 2)]), new Set(['d']));
  for (const row of rows) assert.match(runs(row), /^(l|w|d|lw|ld|wd|lwd|wld)?$/, row);
  const plain = compileStack({ ...shaded, ramps: undefined, projection: 'iso', headings: [0] }).recipe;
  assert.deepEqual(tonesOf(plain.frames[0].ops[0].rows), new Set(['w']));
  assert.equal(plain.ramps, undefined);
  // A key on no ramp is left alone, painted or not, and a painted key on a ramp takes the tone of its face.
  const painted = compileStack({ ...shaded, projection: 'iso', headings: [0], paint: [{ face: 'south', at: [0, 0], rows: ['s'] }, { face: 'east', at: [0, 0], rows: ['l'] }] }).recipe.frames[0].ops[0].rows;
  assert.ok(tonesOf(painted).has('s'));
  assert.equal(painted.join('').split('l').length, rows.join('').split('l').length);
});

test('the light stays with the camera through a turn unless lightTurns fixes it to the model', () => {
  const facing = source => compileStack({ ...shaded, ...source }).recipe.frames.map(frame => frame.ops[0].rows.map(runs).findLast(run => run));
  // Oblique: the side that faces the viewer is the south one at 0 and the north one at 180.
  assert.deepEqual(facing({ headings: [0, 180] }), ['w', 'w']);
  assert.deepEqual(facing({ headings: [0, 180], lightTurns: true }), ['w', 'd']);
  assert.deepEqual(facing({ headings: [0, 180], light: [0, -1, 0] }), ['d', 'd']);
  assert.deepEqual(facing({ headings: [0], light: [0, 3, 1] }), ['l']);
});

test('a round column is shaded as one surface, not striped by the two sides of each cell', () => {
  const disc = Array.from({ length: 14 }, (_, y) => Array.from({ length: 14 }, (_, x) => (2 * x - 13) ** 2 + (2 * y - 13) ** 2 <= 148 ? 'w' : '.').join(''));
  const column = { ...shaded, slices: Array(10).fill(disc), projection: 'iso', headings: [0, 23, 45, 68, 90] };
  for (const frame of compileStack(column).recipe.frames) {
    // Below the roof every row is the lit side then the dark one, to the foot of the wall.
    const wall = frame.ops[0].rows.map(runs).filter(run => run && !run.includes('l'));
    assert.ok(wall.length > 30, frame.name);
    for (const run of wall) assert.match(run, /^w?d?$/, `${frame.name}: ${run}`);
    assert.ok(wall.filter(run => run === 'wd').length > 25, frame.name);
  }
  // A roof that climbs a cell for every cell it steps in is one lit slope, treads and risers alike, down to an eave
  // that stands on the ground as a low wall.
  const pitch = Array.from({ length: 5 }, (_, z) => Array.from({ length: 10 }, (_, y) => (y >= z && y <= 9 - z ? 'w' : '.').repeat(10)));
  for (const frame of compileStack({ ...shaded, slices: pitch, headings: [0, 180] }).recipe.frames) {
    const down = runs(frame.ops[0].rows.map(row => runs(row)).join(''));
    assert.equal(down, 'lw', frame.name);
  }
});

test('glass and facets keep the tones the voxels have without them', () => {
  const count = (recipe, red) => { const { data } = renderProject(recipe).frames[0]; let n = 0; for (let i = 0; i < data.length; i += 4) if (data[i] === red) n++; return n; };
  const source = { ...shaded, projection: 'iso', headings: [30] };
  const layered = { ...source, facets: [{ color: 's', points: [[0, 0, 12], [1, 0, 12], [0, 1, 12]] }] };
  for (const red of [0x40, 0x80, 0xc0]) assert.equal(count(compileStack(layered).recipe, red), count(compileStack(source).recipe, red), red.toString(16));
});

test('ramps and the light are checked at the source field', () => {
  const refuse = (extra, pattern) => assert.throws(() => compileStack({ ...shaded, ...extra }), pattern);
  refuse({ ramps: undefined, light: [1, 1, 1] }, /stack\.light: a light shades faces along ramps/);
  refuse({ ramps: undefined, lightTurns: true }, /stack\.lightTurns: a light shades faces along ramps/);
  refuse({ ramps: [] }, /stack\.ramps: expected 1–64 ramps/);
  refuse({ ramps: ['w'] }, /stack\.ramps\[0\]: a ramp is a string of 2–32 palette keys/);
  refuse({ ramps: ['dwq'] }, /stack\.ramps\[0\]: "q" is not a key of the palette/);
  refuse({ ramps: ['dw', 'wl'] }, /stack\.ramps\[1\]: "w" is already in a ramp/);
  refuse({ palette: { ...shaded.palette, g: '#ffffff80' }, ramps: ['dwg'] }, /stack\.ramps\[0\]: a ramp is all solid colours or all see-through ones/);
  refuse({ light: [0, 0, 0] }, /stack\.light: light direction must be nonzero/);
  refuse({ light: [1, 2] }, /stack\.light: expected \[x,y,z\]/);
  refuse({ lightTurns: 1 }, /stack\.lightTurns/);
});

test('cell puts an iso stack on a map grid: a cube is the box op block at every quarter turn', () => {
  const cube = (n, extra) => ({ format: 'pixelforge-stack', version: 1, name: 'cube', palette: { w: '#805030' }, slices: Array.from({ length: n }, () => Array(n).fill('w'.repeat(n))),
    projection: 'iso', headings: [0, 90, 180, 270], ...extra });
  const widths = rows => rows.map(row => row.replaceAll('.', '').length).filter(Boolean);
  // The 32x32 block of a 32x16 grid: a diamond two pixels wider each row, sixteen full rows, and the diamond's near half.
  const far = [2, 6, 10, 14, 18, 22, 26, 30], block = [...far, ...Array(16).fill(32), ...far.toReversed()];
  const box = renderProject({ version: 1, name: 'box', width: 32, height: 32, palette: { w: '#805030' }, frames: [{ name: 'a', ops: [{ op: 'box', w: 16, d: 16, h: 16, top: 'w', left: 'w', right: 'w' }] }] }).frames[0];
  assert.deepEqual(Array.from({ length: 32 }, (_, y) => Array.from({ length: 32 }, (_, x) => box.data[(y * 32 + x) * 4 + 3] > 0).filter(Boolean).length), block);
  for (const source of [cube(16, { cell: 1 }), cube(8, { cell: 2 }), cube(16, { cell: 1, pivot: [8, 8] }), cube(16, { cell: 1, pivot: [3, 12] })]) {
    const { recipe, metadata } = compileStack(source);
    assert.equal(metadata.cell, source.cell);
    for (const frame of recipe.frames) assert.deepEqual(widths(frame.ops[0].rows), block, `${source.slices.length} cells, pivot ${source.pivot}, ${frame.name}`);
  }
  // It turns about the middle of its footprint, so the block lies on the same pixels at each quarter turn, and its
  // anchor is the centre of its ground diamond: 16 across, 16 levels and 8 rows down.
  const { recipe } = compileStack(cube(16, { cell: 1 }));
  assert.deepEqual([recipe.width, recipe.height, recipe.anchor], [32, 32, [16, 24]]);
  for (const frame of recipe.frames) assert.deepEqual(frame.ops[0].rows, recipe.frames[0].ops[0].rows, frame.name);
  // An odd footprint turns about its middle cell and is the same diamond each time, a pixel narrower than two cells more.
  for (const frame of compileStack(cube(15, { cell: 1 })).recipe.frames) assert.deepEqual(widths(frame.ops[0].rows).slice(0, 4), [2, 6, 10, 14], frame.name);
  // Between the quarter turns it is the same solid at the same size, turned.
  const eighth = compileStack(cube(16, { cell: 1, headings: [45] })).recipe;
  assert.equal(Math.max(...widths(eighth.frames[0].ops[0].rows)), 22);
  const refuse = (extra, pattern) => assert.throws(() => compileStack(cube(4, extra)), pattern);
  refuse({ cell: 1, projection: 'oblique' }, /stack\.cell: cell puts a stack on an isometric map/);
  refuse({ cell: 1, resolution: 4 }, /stack\.resolution: cell sets the size on the map's grid/);
  refuse({ cell: 0 }, /stack\.cell/);
  refuse({ cell: 9 }, /stack\.cell/);
});

test('wall pieces a tile long, set a tile apart, are the pixels of one wall two tiles long', async () => {
  const wall = JSON.parse(await readFile(new URL('../examples/iso-wall.stack.json', import.meta.url), 'utf8'));
  delete wall.ramps;
  // Along x at heading 0 the next cell is 16 pixels right and 8 down; at 90 the wall runs the other way.
  for (const [heading, across] of [[0, 8], [90, -8], [180, 8], [270, -8]]) {
    const piece = compileStack({ ...wall, headings: [heading] }).recipe, long = compileStack({ ...wall, headings: [heading], slices: wall.slices.map(rows => rows.map(row => row + row)) }).recipe;
    const joined = Array.from({ length: long.height }, () => Array(long.width).fill('.'));
    // The far piece first, then the near one over it, each by its anchor, half a tile either side of the long wall's.
    for (const side of [-1, 1]) for (const [y, row] of piece.frames[0].ops[0].rows.entries()) for (const [x, key] of [...row].entries()) {
      if (key !== '.') joined[long.anchor[1] + side * 4 + y - piece.anchor[1]][long.anchor[0] + side * across + x - piece.anchor[0]] = key;
    }
    assert.deepEqual(joined.map(row => row.join('')), long.frames[0].ops[0].rows, `heading ${heading}`);
  }
});

test('CLI inspection of a pinned stack cell renders intermediate headings and reports an empty pin', () => {
  const inspect = pin => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../bin/pixelbolt.js', import.meta.url)),
      'inspect', '-', '--pin', pin, '--grid'], { input:JSON.stringify(block), encoding:'utf8' });
    return JSON.parse(result.stdout || result.stderr);
  };
  const review = inspect('south,1,0,0');
  assert.equal(review.ok, true);
  assert.deepEqual([review.width, review.height, review.frames], [36,36,5]);
  assert.deepEqual(review.grids.map(grid => grid.frame), ['heading-358','heading-359','heading-0','heading-1','heading-2']);
  assert.match(inspect('south,100,0,0').error, /solid cell/);
});

test('a camera lock matches the authored pose plus one local rotation, including a vertex on a second socket', () => {
  // Compare in ground coordinates, including every nonblank pixel. A fitted turntable and a
  // full-revolution inspection may have different margins but must agree on the image inside.
  function pixels(recipe) {
    const { data } = renderProject(recipe).frames[0], out = [];
    for (let i = 0; i < data.length; i += 4) if (data[i+3]) {
      out.push([i/4 % recipe.width - recipe.anchor[0], Math.floor(i/4/recipe.width) - recipe.anchor[1], ...data.subarray(i,i+4)]);
    }
    return out;
  }
  const heading = 37;
  for (const axis of ['x','y','z']) {
    const source = { ...block, headings:[0,90], projection:'iso', palette:{...block.palette, g:'#75baa080'},
      sockets:{bit:{at:[1,2,2], axis, keys:[{heading:0,angle:-40},{heading:90,angle:5,offset:[3,1,2]}]},
        cab:{at:[-1,0,1], keys:[{heading:0},{heading:90, angle:80,offset:[1,0,0]}]}, spare:{at:[0,0,0]}},
      facets:[{color:'g',socket:'bit',twoSided:true,points:[[0,1,1],[2,9,5],[5,8,4]]},
        {color:'s',socket:'bit',twoSided:true,points:[[0,2,0],[1,2,0],{socket:'cab',at:[0,0,2]}]}] };
    const model = prepareStack(source), original = structuredClone(model.recipe()), study = model.rotationStudy(heading,'bit');
    assert.deepEqual(model.rotationSockets, ['bit','cab']);
    const start = study.recipe(0);
    for (const rotation of [0,57.25,180,270,360]) {
      const actual = study.recipe(rotation), bit = source.sockets.bit;
      const baked = prepareStack({ ...source, headings:[heading], sockets:{...source.sockets,bit:{...bit,
        keys:bit.keys.map(key => ({...key,angle:key.angle + rotation % 360}))}} }).recipe();
      assert.deepEqual(pixels(actual), pixels(baked), axis + ' at ' + rotation);
      assert.deepEqual([actual.width,actual.height,actual.anchor,actual.frames[0].points],
        [start.width,start.height,start.anchor,start.frames[0].points]);
    }
    assert.deepEqual(study.recipe(360), start);
    assert.deepEqual(model.recipe(), original);
    assert.throws(() => study.recipe(-2), /rotation.offset/);
    assert.throws(() => model.rotationStudy(0,'spare'), /rotation.socket/);
  }
});

test('inspect --rotate selects a single fixed-camera pose and validates its socket, heading and rotation', () => {
  const source = {...block,sockets:{bit:{at:[1,1,1]}},facets:[{socket:'bit',color:'s',points:[[0,0,0],[4,0,2],[4,2,0]],twoSided:true}]};
  const inspect = (...args) => {
    const result = spawnSync(process.execPath,[fileURLToPath(new URL('../bin/pixelbolt.js',import.meta.url)),
      'inspect','-','--rotate',...args],{input:JSON.stringify(source),encoding:'utf8'});
    return cliReply(result, result.status === 0 ? 'stdout' : 'stderr');
  };
  assert.equal(inspect('bit,0,22.5').frames, 1);
  assert.match(inspect('missing,0,0').error, /socket/);
  assert.match(inspect('bit,360,90').error, /heading/);
  assert.match(inspect('bit,0,361').error, /offset/);
  assert.match(inspect('bit,0,').error, /expects/);
  assert.match(inspect('bit,0,90','--pin','south,0,0,0').error, /--pin/);
});

test('glass voxels tint once per contiguous run and reveal the first opaque surface', () => {
  const make = row => ({...block, resolution:4, headings:[0], squash:.25,
    palette:{g:'#a040f080',k:'#183050'}, slices:Array.from({length:4},()=>[...row].map(key=>key.repeat(3)))});
  for(const [row,expected] of [['ggg',[160,64,240,128]],['g.g',[160,64,240,192]],['kgg',[92,56,160,255]]]) {
    const image=renderProject(compileStack(make(row)).recipe);
    const data=image.frames[0].data, i=(Math.floor(image.height/2)*image.width+Math.floor(image.width/2))*4;
    assert.deepEqual([...data.slice(i,i+4)],expected,row);
  }
});

test('clear face paint exposes the voxel and clear depth paint opens a gap', () => {
  const source = { ...block, palette: { ...block.palette, a:'#0000' }, slices:[['ksk']] };
  const cover = { face:'west', rows:['s'] }, clear = { face:'west', rows:['a'] };
  assert.deepEqual(stackSide({ ...source, paint:[cover, clear] }, 'west'), ['k']);
  assert.deepEqual(stackSide({ ...source, paint:[{ ...clear, depth:1 }] }, 'west'), ['s']);
  assert.deepEqual(stackSide({ ...source, paint:[{ ...clear, depth:3 }] }, 'south'), ['...']);
});

test('socket-mounted faces have crisp shared edges, true alpha and stable projection', () => {
  const face={color:'g',socket:'lift',points:[[0,0,0],[3,0,0],[3,3,0],[0,3,0]]};
  const source={...block,headings:[0,90,180],slices:Array.from({length:4},()=>['...','...','...']),palette:{g:'#dd55aa80'},
    sockets:{lift:{at:[0,0,1],keys:[{heading:0},{heading:180,offset:[0,0,2]}]}},facets:[face]};
  const model=prepareStack(source), full=model.recipe(), rendered=renderProject(full);
  for(const f of rendered.frames) {
    const alpha=new Set(f.data.filter((_,i)=>i%4===3));
    assert.deepEqual(alpha,new Set([0,128]));
  }
  assert.deepEqual(model.recipe(1).frames,[full.frames[1]]);
  const middle=model.attachments(90).lift;
  const baked=prepareStack({...source,sockets:{lift:{at:[0,0,2]}}});
  assert.deepEqual(model.frame(1).ops,baked.frame(1).ops);
  assert.deepEqual(full.frames[1].points.lift,middle);
  const glassOnMetal={...source,slices:[['kkk','kkk','kkk']],palette:{...source.palette,k:'#182838'}};
  const solid=renderProject(compileStack(glassOnMetal).recipe);
  assert.ok(solid.frames[0].data.some((x,i)=>i%4===0 && x===123),'glass mixes with metal beneath');
  const bad=[{facets:[{...face,socket:'absent'}]},{facets:[{...face,color:'missing'}]},
    {sockets:{lift:{at:[0,1],keys:[]}}},{sockets:{lift:{at:[0,0,0],keys:[{heading:30},{heading:10}]}}}];
  for(const patch of bad) assert.throws(()=>prepareStack({...source,...patch}),/stack\./);
});

test('two crossing faces swap visibility with depth and a triangulated glass square owns its diagonal once', () => {
  const panel=[[0,1,0],[4,1,0],[4,1,4],[0,1,4]];
  const base={...block,palette:{g:'#bb66dd80',m:'#184866'},slices:[['....','....','....']],
    squash:.5,headings:[0,180],facets:[
      {color:'g',twoSided:true,points:panel},
      {color:'m',twoSided:true,points:[[0,.2,0],[4,1.8,0],[4,1.8,4],[0,.2,4]]}]};
  const recipe=compileStack(base).recipe, project=renderProject(recipe);
  for(const frame of project.frames) {
    const y=recipe.anchor[1]-8, pixels=x=>[...frame.data.slice((y*project.width+x)*4,(y*project.width+x+1)*4)];
    const pair=[pixels(recipe.anchor[0]-3),pixels(recipe.anchor[0]+3)];
    assert.ok(pair.some(p=>p.join() === '24,72,102,255'),frame.name);
    assert.ok(pair.some(p=>p.join() === '106,87,162,255'),frame.name);
  }
  const single=renderProject(compileStack({...base,facets:[base.facets[0]]}).recipe);
  for(const frame of single.frames) assert.equal(frame.data.filter((v,i)=>i%4===3&&v===128).length,16*16);
});

test('lofts paint matching spans and mirror the same diagonal on a moving socket', () => {
  const a = [[0,0,0], [2,1,1], [4,-1,2]], b = [[0,0,4], [2,2,3], [4,1,5]];
  const c = a.map(([x,y,z]) => [x, y + 1, z + 6]);
  const base = { ...block, headings: [0,31,90,180,225,315], resolution: 3,
    palette: { ...block.palette, g: '#98bfdf80' },
    sockets: { head: { at: [1,1,3], axis: 'y', keys: [{heading:0},{heading:180,angle:30}] } } };
  for (const mirror of ['x','y','z']) {
    const axis = 'xyz'.indexOf(mirror);
    const reflect = p => p.map((v, i) => i === axis ? -v : v);
    const facets = [];
    const expected = (p, q, r, s, color) => {
      facets.push({ socket: 'head', color, points: [p,q,r,s] });
      facets.push({ socket: 'head', color, points: [p,s,r,q].map(reflect) });
    };
    expected(a[0],a[1],b[1],b[0],'g');
    expected(a[1],a[2],b[2],b[1],'k');
    expected(a[2],a[0],b[0],b[2],'s');
    expected(b[0],b[1],c[1],c[0],'s');
    expected(b[1],b[2],c[2],c[1],'s');
    expected(b[2],b[0],c[0],c[2],'s');
    const lofts = [{ socket:'head', contours:['a','b','c'], bands:['gks','s'], closed:true, mirror }];
    assert.deepEqual(compileStack({ ...base, contours:{a,b,c}, lofts }).recipe,
      compileStack({ ...base, facets }).recipe);
  }
  // A translucent panel lying entirely on its mirror plane must be emitted once.
  const source = { ...base, contours:{ a:[[0,-2,0],[0,1,0]], b:[[0,-2,3],[0,1,3]] } };
  const panel = { socket:'head', contours:['a','b'], bands:['g'], twoSided:true };
  assert.deepEqual(compileStack({ ...source, lofts:[{...panel, mirror:'x'}] }).recipe,
    compileStack({ ...source, lofts:[panel] }).recipe);
});

test('lofts reject unmatched landmarks, invalid bands and excess geometry at the source field', () => {
  const a = [[0,0,0],[1,1,1]], b = [[0,0,2],[1,1,2]];
  const contours = { a, b, long: [...a,[2,0,1]] };
  const loft = { contours:['a','b'], bands:['k'] };
  for (const [edit,field] of [
    [{contours:['a','missing']}, 'contours'], [{contours:['a','long']}, 'contours'],
    [{contours:['a','a']}, 'contours'], [{closed:true}, 'closed contour'],
    [{bands:[]}, 'bands'], [{bands:['z']}, 'bands'], [{bands:['kk']}, 'bands'],
    [{mirror:'w'}, 'mirror'], [{socket:'typo'}, 'socket'], [{twoSided:3}, 'twoSided']
  ]) assert.throws(() => prepareStack({ ...block, contours, lofts:[{...loft,...edit}] }), new RegExp(field));
  assert.throws(() => prepareStack({ ...block, contours:{ a:[[0,0,0]] } }), /contours.a/);
  const faces = Array(2048).fill({ color:'s', points:[[0,0,0],[1,1,1],[2,0,1]] });
  assert.throws(() => prepareStack({ ...block, contours, lofts:[loft], facets:faces }), /2,048/);
});

test('surface reliefs follow the painted hull, keep their light in model space and close both ends', () => {
  const base = { ...block, slices:Array(3).fill(['kkk','kkk','kkk']), resolution:4, headings:[0,45,90,135,180,225,270,315],
    palette:{ k:'#182431', l:'#8ee4ba', d:'#624477', x:'transparent' } };
  for (const [side, nx, ny] of [['south',0,1],['north',0,-1],['west',-1,0],['east',1,0]]) {
    // Remove the outer voxel on the middle column. The crest attaches one cell deeper;
    // the two rim stations land on the uncut columns. Keep some rise above that rim.
    const paint = [{ face:side, at:[1,0], rows:['x','x','x'], depth:1 }];
    const ridge = { face:side, points:[[1.5,.35,.94,2],[1.5,2.65,.94,2]], ramp:'dl',
      light: nx ? [0,-1,0] : [-1,0,0] };
    const model = { ...base, paint, reliefs:[ridge] };
    const xyz = (u,z,rise) => nx ? [(nx>0?3:0)+nx*rise,u,z] : [u,(ny>0?3:0)+ny*rise,z];
    const a=xyz(.56,.35,0), b=xyz(1.5,.35,1), c=xyz(2.44,.35,0);
    const A=xyz(.56,2.65,0), B=xyz(1.5,2.65,1), C=xyz(2.44,2.65,0);
    const reverse = side === 'north' || side === 'east';
    const facet = (color, p, q, r) => ({ color, points: reverse ? [p,r,q] : [p,q,r] });
    const facets = [facet('l',a,b,c),facet('l',a,A,B),facet('l',a,B,b),
      facet('d',b,B,C),facet('d',b,C,c),facet('l',C,B,A)];
    const want = compileStack({ ...base, paint, facets }).recipe;
    const got = compileStack(model).recipe;
    assert.deepEqual(got, want, side);
    for (const ink of ['l','d']) assert.ok(got.frames.some(f => f.ops[0].rows.some(row => row.includes(ink))), side+' '+ink);
  }
});

test('surface reliefs validate support, lighting, stations and the shared facet budget', () => {
  const ridge = { face:'south', points:[[1,.25,0,0],[1.4,.5,.2,.5],[2,.7,0,0]], ramp:'ks' };
  for (const [edit, reason] of [[{face:'roof'},/face/],[{ramp:'?'},/ramp/],[{light:[0,0,0]},/light/],
    [{points:[[1,1,1,0]]},/points/],[{points:[[1,.5,0,0],[1,.5,0,1]]},/travel/],
    [{points:[[1,.5,0,0],[2,.1,2,1]]},/outside/]]) {
    assert.throws(() => prepareStack({...block,reliefs:[{...ridge,...edit}]}),reason);
  }
  assert.throws(() => prepareStack({...block,slices:[['.k.']],reliefs:[{...ridge,points:[[0,.5,0,0],[1.5,.5,.2,1]]}]}),/voxel under/);
  assert.throws(() => prepareStack({...block,spacing:3,reliefs:[{...ridge,points:[[1,1.5,0,0],[2,3.5,0,0]]}]}),/voxel under/);
  assert.doesNotThrow(() => prepareStack({...block,spacing:3,reliefs:[{...ridge,points:[[1,3.1,0,0],[2,3.5,.15,.4]]}]}));
  const facets = Array(2048).fill({color:'k',points:[[0,0,0],[1,1,1],[1,0,1]]});
  assert.throws(() => prepareStack({...block,facets,reliefs:[ridge]}),/2,048/);
});

test('Rimefiend keeps both outer lids and the mouth visible from profile to profile', async () => {
  const source = JSON.parse(await readFile(new URL('../showcase/rimefiend/rimefiend.stack.json',import.meta.url)));
  const [mouth, eye] = source.lofts;
  // Mark only the outer four eye spans. A visible inner corner cannot mask a lost outer rim.
  Object.assign(source.palette, { U:'#ff00ff', V:'#00ff00', W:'#00ffff', X:'#ffff00' });
  eye.bands[1] = eye.bands[1].slice(0,-4) + 'UUUU';
  eye.bands[6] = eye.bands[6].slice(0,-4) + 'VVVV';
  mouth.bands[2] = 'W'; // recessed opening between the gum and the throat
  mouth.bands[4] = 'X'; // lower lip to jaw ridge
  source.headings = Array.from({length:31}, (_, i) => (225 + i * 6) % 360);
  const colors = [0xff00ff, 0x00ff00, 0x00ffff, 0xffff00];
  for (const {name, data} of renderProject(compileStack(source).recipe).frames) {
    const counts = [0,0,0,0];
    for (let i=0; i<data.length; i+=4) {
      const index = colors.indexOf((data[i] << 16) | (data[i+1] << 8) | data[i+2]);
      if (index >= 0 && data[i+3] === 255) counts[index]++;
    }
    assert.ok(counts.every(n => n >= 5), name + ' visible feature pixels: ' + counts);
  }
});

test('invalid sources and excessive projections are refused before drawing', () => {
  for (const [change, field] of [
    [{ resolution: 1.5 }, 'resolution'], [{ projection: 'iso', squash: 1 }, 'squash'],
    [{ headings: [0, 0] }, 'headings'], [{ pivot: [3,0] }, 'pivot'],
    [{ palette: { k: '#xx17' } }, 'palette'], [{ slices: [['k'], ['kk']] }, 'slices'], [{ decals:null }, 'decals'],
    [{ paint: [{ face:'north', at:[1,1], rows:['sss'] }] }, 'paint'],
    [{ resolution:8, slices:[Array(128).fill('k'.repeat(128))] }, 'resolution'],
    [{ name:'CON' }, 'name']
  ]) assert.throws(() => compileStack({ ...block, ...change }), new RegExp(field));
  assert.throws(() => compileStack(block, { maxPixels: 10 }), /scene asset pixel budget/);
});

// Count contiguous silver regions in the actual exported wheel artwork. Measure area as well:
// a detached fleck or a missing section on a grazing sidewall would pass a frame-count check.
function silverAreas(rows) {
  const width = rows[0].length, cells = Uint8Array.from(rows.join(''), key => Number('mcl'.includes(key)));
  const sizes = [];
  for (let at = 0; at < cells.length; at++) {
    if (!cells[at]) continue;
    let area = 0;
    const pending = [at]; cells[at] = 0;
    while (pending.length) {
      const i = pending.pop(); area++;
      const adjacent = [i - width, i + width];
      if (i % width) adjacent.push(i - 1);
      if (i % width < width - 1) adjacent.push(i + 1);
      for (const j of adjacent) if (cells[j]) { cells[j] = 0; pending.push(j); }
    }
    sizes.push(area);
  }
  return sizes;
}

golden.test('Copper Rally keeps two connected silver rims throughout the turn, with neither visible end-on', async () => {
  const car = JSON.parse(await readFile(new URL('../examples/copper-rally.stack.json', import.meta.url), 'utf8'));
  assert.equal(car.paint.filter(place => place.decal === 'hub').length, 4);
  const { recipe } = compileStack(car);
  assert.deepEqual([recipe.width, recipe.height, recipe.frames.length], [250,210,60]);
  const pixels = createHash('sha256');
  for (const frame of renderProject(recipe).frames) pixels.update(frame.data);
  golden.equal('copper-rally', pixels.digest('hex'), { recipe });
  const areas = new Map(recipe.frames.map(frame => [Number(frame.name.slice(8)), silverAreas(frame.ops[0].rows)]));
  const side = areas.get(0)[0];
  assert.ok(side > 400);
  for (const [angle, sizes] of areas) {
    if (angle === 90 || angle === 270) { assert.deepEqual(sizes, []); continue; }
    assert.equal(sizes.length, 2, `rim fragments at ${angle}°: ${sizes}`);
    const projected = side * Math.abs(cosDeg(angle));
    for (const size of sizes) assert.ok(Math.abs(size - projected) <= 24, `${angle}°: ${size} vs ${projected}`);
  }
});

golden.test('the isometric starters are whole from every heading and shaded by their ramps', async () => {
  for (const name of ['iso-crate', 'iso-barrel', 'iso-pine', 'iso-cottage', 'iso-tower', 'iso-wall']) {
    const source = JSON.parse(await readFile(new URL(`../examples/${name}.stack.json`, import.meta.url), 'utf8'));
    assert.deepEqual([source.projection, source.cell], ['iso', 1], `${name} is on the map's grid at the map's pixel size`);
    assert.ok(source.ramps.length && source.light === undefined, name);
    const { recipe } = compileStack(source), pixels = createHash('sha256'), { frames } = renderProject(recipe);
    assert.equal(frames.length, 16);
    for (const frame of frames) pixels.update(frame.data);
    // Each heading holds at least a lit tone, a tone as drawn and a shaded one.
    for (const frame of recipe.frames) assert.ok(tonesOf(frame.ops[0].rows).size >= 3, `${name} ${frame.name}`);
    golden.equal(name, pixels.digest('hex'), { recipe });
  }
});

golden.test('Rimefiend keeps the crystal nail and painted wing webs registered through a pose study', async () => {
  const source=JSON.parse(await readFile(new URL('../showcase/rimefiend/rimefiend.stack.json',import.meta.url)));
  const hand=JSON.parse(await readFile(new URL('../showcase/rimefiend/index-study.json',import.meta.url)));
  const model=prepareStack(source);
  for(const [name,request] of [['index',hand],['wings',{poses:['open','folded'],headings:[315,153]}],
    ['face',{poses:['open'],headings:[225,315,45]}]]) {
    const recipe=model.poseStudy(request), pixels=createHash('sha256');
    for (const frame of renderProject(recipe).frames) pixels.update(frame.data);
    golden.equal('rimefiend-'+name,pixels.digest('hex'),{recipe});
  }
});

golden.test('the faceted crane keeps transmissive glass and a shared ground pivot through every pose', async () => {
  const source=JSON.parse(await readFile(new URL('../examples/lodekeeper-faceted.stack.json',import.meta.url),'utf8'));
  const model=prepareStack(source), recipe=model.recipe(), {frames}=renderProject(recipe);
  const pixels=createHash('sha256');
  assert.equal(frames.length,72);
  for(const frame of frames) {
    pixels.update(frame.data);
    assert.ok(frame.data.some((v,i)=>i%4===3 && v>0 && v<255),frame.name);
  }
  golden.equal('lodekeeper-faceted',pixels.digest('hex'),{recipe});
});

test('scene placements share the pivot, occlude as whole sprites, and retain the editable source on export', async () => {
  const scene = { format: 'pixelforge-scene', version:1, name:'overlap', width:48, height:48,
    assets:{ front:{ recipe:{ ...block, projection:'iso' } }, other:block },
    instances:[{ name:'first', asset:'front', at:[24,24], frame:'heading-90' }, { name:'second', asset:'other', at:[24,22] }] };
  for (const y of [22,26]) {
    scene.instances[1].at[1] = y;
    const prepared = prepareScene(scene), { depth } = renderScene(prepared, { depth:true });
    assert.deepEqual(prepared.instances.map(i => [i.anchor,i.sort]), [['frame','ground'],['frame','ground']]);
    assert.equal(depth.overlaps.length, 1);
    assert.equal(depth.overlaps[0].front, y > 24 ? 'second' : 'first');
    assert.ok(depth.overlaps[0].pixels > 0);
    assert.deepEqual(prepared.source, scene);
  }
  const { files } = await createSceneBundle(scene);
  assert.deepEqual(JSON.parse(files.get('scene.json')), scene);
  assert.ok(files.has('scene.tmx') && files.has('scene.tscn') && files.has('assets/0/color.png'));
});

// ---- Parts and animations ------------------------------------------------------------------------------------------
// Each frame's pixels by their place from the anchor, so two stacks on different canvases compare.
function fromAnchor(source) {
  const { recipe } = compileStack(source), project = renderProject(recipe), [ax, ay] = recipe.anchor;
  return new Map(project.frames.map(frame => {
    const pixels = new Map();
    for (let y = 0; y < recipe.height; y++) for (let x = 0; x < recipe.width; x++) {
      const at = (y * recipe.width + x) * 4;
      if (frame.data[at + 3]) pixels.set(`${x - ax},${y - ay}`, frame.data.slice(at, at + 4).join(' '));
    }
    return [frame.name, pixels];
  }));
}
const filled = (w, h, key) => Array.from({ length: h }, () => key.repeat(w));
const views = [{ projection: 'iso', cell: 1 }, { projection: 'iso', cell: 2 }, { projection: 'iso', resolution: 3 }, { resolution: 4 }];
const moving = { format: 'pixelforge-stack', version: 1, name: 'moving', palette: { a: '#402010', b: '#804020', c: '#c08040', s: '#405060', t: '#8090a0', u: '#c0d0e0' } };

test('a part draws the pixels its cells draw in the stack, where its socket puts it and as its socket turns it', () => {
  const headings = [0, 30, 90, 135, 180, 270, 300], base = [filled(6, 6, 'b'), filled(6, 6, 'b')], top = ['......', '..tt..', '..tt..', '..tt..', '......', '......'];
  const block = [filled(2, 3, 't'), filled(2, 3, 't')];
  for (const view of views) {
    const common = { ...moving, headings, ...view }, mid = view.cell ? 3 : 3.5, label = JSON.stringify(view);
    // A block on a base: as cells of the stack, as a part placed there, and as a part on a socket.
    const whole = fromAnchor({ ...common, slices: [...base, top, top] });
    const placed = fromAnchor({ ...common, slices: base, parts: { block: { at: [2, 1, 2], slices: block } } });
    const seated = fromAnchor({ ...common, slices: base, sockets: { seat: { at: [3, 2.5, 2] } }, parts: { block: { socket: 'seat', at: [-1, -1.5, 0], slices: block } } });
    for (const heading of headings) {
      assert.deepEqual(placed.get(`heading-${heading}`), whole.get(`heading-${heading}`), `${label} placed, heading ${heading}`);
      assert.deepEqual(seated.get(`heading-${heading}`), whole.get(`heading-${heading}`), `${label} on a socket, heading ${heading}`);
    }
    // Turned about the pivot by its socket, a part is the picture of the heading as far on: under ramps too, since the
    // light stays with the camera.
    const blank = [filled(6, 6, '.')], bar = [filled(2, 5, 't'), filled(2, 5, 'b')];
    const turned = fromAnchor({ ...common, ramps: ['abc', 'stu'], headings: [0, 30, 90, 120, 180, 270], slices: blank, sockets: { hub: { at: [mid, mid, 0] } },
      parts: { bar: { socket: 'hub', at: [-1, -3, 0], slices: bar } },
      animations: { quarter: { frames: 1, sockets: { hub: [{ frame: 0, angle: 90 }] } }, some: { frames: 1, sockets: { hub: [{ frame: 0, angle: 30 }] } } } });
    for (const heading of [0, 90, 180]) assert.deepEqual(turned.get(`quarter-${heading}-0`), turned.get(`heading-${(heading + 90) % 360}`), `${label} a quarter on from ${heading}`);
    for (const heading of [0, 90]) assert.deepEqual(turned.get(`some-${heading}-0`), turned.get(`heading-${heading + 30}`), `${label} thirty degrees on from ${heading}`);
    // A bar lying on the ground, stood on its end by a quarter turn about x, is a post of the same cells.
    const stood = fromAnchor({ ...common, slices: blank, sockets: { foot: { at: [3, 1, 0], axis: 'x' } }, parts: { bar: { socket: 'foot', at: [-1, 0, 0], slices: [filled(2, 4, 't')] } },
      animations: { up: { frames: 1, sockets: { foot: [{ frame: 0, angle: 90 }] } } } });
    const post = fromAnchor({ ...common, slices: blank, parts: { bar: { at: [2, 0, 0], slices: Array(4).fill(filled(2, 1, 't')) } } });
    for (const heading of headings) assert.deepEqual(stood.get(`up-${heading}-0`), post.get(`heading-${heading}`), `${label} stood up, heading ${heading}`);
  }
  // A part behind the stack is covered by it and one in front covers it; side paint and ramps work on a part as on the stack.
  const wall = { ...moving, projection: 'iso', cell: 1, headings: [0, 180], slices: Array(6).fill(['......', '......', 'bbbbbb', 'bbbbbb', '......', '......']) };
  const lone = fromAnchor({ ...wall, slices: [filled(6, 6, '.')], parts: { box: { at: [2, 4, 0], slices: Array(3).fill(filled(2, 2, 't')) } } });
  const both = fromAnchor({ ...wall, parts: { box: { at: [2, 4, 0], slices: Array(3).fill(filled(2, 2, 't')) } } }), alone = fromAnchor(wall);
  const seen = (frame, colour) => [...both.get(frame).values()].filter(value => value === colour).length, grey = '128 144 160 255';
  assert.equal(seen('heading-0', grey), lone.get('heading-0').size, 'in front of the wall the whole part shows');
  assert.ok(seen('heading-180', grey) < lone.get('heading-180').size && seen('heading-180', grey) < seen('heading-0', grey), 'behind it the wall covers a part of it');
  for (const [at, value] of alone.get('heading-0')) if (!lone.get('heading-0').has(at)) assert.equal(both.get('heading-0').get(at), value);
  const painted = compileStack({ ...moving, ramps: ['abc', 'stu'], headings: [0], slices: [filled(4, 4, '.')], parts: { box: { at: [0, 0, 0], slices: Array(3).fill(filled(4, 4, 't')), paint: [{ face: 'south', at: [1, 1], rows: ['bb'] }] } } }).recipe;
  const inks = tonesOf(painted.frames[0].ops.flatMap(op => op.rows));
  assert.ok(inks.has('u') && inks.has('t') && [...inks].some(key => 'abc'.includes(key)), `a lit roof, a side as drawn and the painted mark: ${[...inks]}`);
});

test('an animation keys sockets by frame and is baked for every heading it is given, after the headings', () => {
  const source = { ...moving, projection: 'iso', cell: 2, headings: [0, 90, 180, 270], duration: 70, slices: [filled(6, 6, 'b')],
    sockets: { lift: { at: [3, 3, 1] }, spin: { at: [3, 3, 4], keys: [{ heading: 0, angle: 0 }, { heading: 360, angle: 360 }] } },
    parts: { cab: { socket: 'lift', at: [-1, -1, 0], slices: [filled(2, 2, 't')] }, vane: { socket: 'spin', at: [-2, -.5, 0], slices: [filled(4, 1, 'c')] } },
    animations: {
      rise: { frames: 4, sockets: { lift: [{ frame: 0 }, { frame: 4, offset: [0, 0, 4] }] } },
      drop: { frames: 3, loop: false, durations: [50, 60, 200], headings: [90], sockets: { lift: [{ frame: 0, offset: [0, 0, 4] }, { frame: 1, offset: [0, 0, 4], ease: 'hold' }, { frame: 2, ease: 'hold' }] } } },
    directions: { east: 90 } };
  const plain = { ...source }; delete plain.animations; delete plain.directions;
  const { recipe, metadata } = compileStack(source), still = compileStack(plain).recipe, model = prepareStack(source);
  // The headings keep their names, order and pixels; the animations' frames follow, heading by heading.
  assert.deepEqual(recipe.frames.map(frame => frame.name), ['heading-0', 'heading-90', 'heading-180', 'heading-270',
    ...[0, 'east', 180, 270].flatMap(at => [0, 1, 2, 3].map(frame => `rise-${at}-${frame}`)), 'drop-east-0', 'drop-east-1', 'drop-east-2']);
  assert.deepEqual([recipe.width, recipe.anchor[0], recipe.height - recipe.anchor[1]], [still.width, still.anchor[0], still.height - still.anchor[1]], 'one canvas for every frame, grown only upward, by the lift');
  assert.ok(recipe.height > still.height);
  assert.deepEqual(recipe.animations, { turn: { frames: ['heading-0', 'heading-90', 'heading-180', 'heading-270'], loop: true },
    'rise-0': { frames: ['rise-0-0', 'rise-0-1', 'rise-0-2', 'rise-0-3'], loop: true }, 'rise-east': { frames: [0, 1, 2, 3].map(frame => `rise-east-${frame}`), loop: true },
    'rise-180': { frames: [0, 1, 2, 3].map(frame => `rise-180-${frame}`), loop: true }, 'rise-270': { frames: [0, 1, 2, 3].map(frame => `rise-270-${frame}`), loop: true },
    'drop-east': { frames: ['drop-east-0', 'drop-east-1', 'drop-east-2'], loop: false } });
  assert.deepEqual(metadata.animations, { rise: { frames: 4, loop: true, headings: [0, 90, 180, 270] }, drop: { frames: 3, loop: false, headings: [90] } });
  assert.deepEqual([metadata.directions, model.count, compileStack(plain).metadata.animations], [{ east: 90 }, 23, undefined]);
  assert.deepEqual(recipe.frames.slice(20).map(frame => frame.duration), [50, 60, 200]);
  assert.deepEqual(recipe.frames.slice(0, 20).map(frame => frame.duration), Array(20).fill(70));
  // Frames are drawn when asked for, one at a time, and the whole recipe is the same frames.
  assert.deepEqual(model.frame(21), recipe.frames[21]);
  assert.deepEqual(model.recipe(21).frames, [recipe.frames[21]]);
  // A keyed socket moves by its keys: a slice up a frame, which is `cell` pixels; a key at the frame count is where
  // the loop comes round to, and is never drawn. The socket the animation leaves alone keeps its turn by heading.
  const points = name => recipe.frames.find(frame => frame.name === name).points;
  assert.deepEqual([0, 1, 2, 3].map(frame => points(`rise-0-${frame}`).lift[1] - points('heading-0').lift[1]), [0, -2, -4, -6]);
  assert.deepEqual([0, 1, 2].map(frame => points(`drop-east-${frame}`).lift[1] - points('heading-90').lift[1]), [-8, -8, 0]);
  const shots = fromAnchor(source), rest = fromAnchor(plain);
  for (const heading of [0, 90, 180, 270]) {
    assert.deepEqual(shots.get(`heading-${heading}`), rest.get(`heading-${heading}`));
    assert.deepEqual(shots.get(`rise-${heading === 90 ? 'east' : heading}-0`), rest.get(`heading-${heading}`), 'the first frame is the rest pose');
  }
  assert.notDeepEqual(shots.get('rise-0-1'), shots.get('rise-0-0'));
  const unturned = fromAnchor({ ...source, sockets: { ...source.sockets, spin: { at: [3, 3, 4] } } });
  assert.notDeepEqual(shots.get('rise-east-1'), unturned.get('rise-east-1'), 'in the animation the vane keeps the turn its own keys give it at that heading');
  // Easing bends the time between two keys, and a rotation study turns a part's socket.
  const eased = structuredClone(source); eased.animations.rise.sockets.lift[1].ease = 'in';
  const slow = compileStack(eased).recipe.frames.find(frame => frame.name === 'rise-0-1').points.lift[1];
  assert.ok(slow > points('rise-0-1').lift[1] && slow <= points('rise-0-0').lift[1], 'eased in, it has risen less after a frame');
  assert.deepEqual(model.rotationSockets, ['lift', 'spin']);
  const sweep = renderProject(model.rotationStudy(0, 'spin').recipe([0, 90]));
  assert.notDeepEqual([...sweep.frames[0].data], [...sweep.frames[1].data]);
  // What a source may not say.
  const refused = (change, pattern) => assert.throws(() => compileStack({ ...source, ...change }), pattern);
  refused({ parts: { cab: { ...source.parts.cab, socket: 'missing' } } }, /stack\.parts\.cab\.socket: unknown socket; the stack's sockets are lift, spin/);
  refused({ parts: { cab: { socket: 'lift', slices: [['tt', 't']] } } }, /stack\.parts\.cab\.slices\[0\]/);
  refused({ parts: { 'no good': source.parts.cab } }, /stack\.parts\.no good/);
  refused({ animations: { turn: source.animations.rise } }, /turn is the animation of the headings/);
  refused({ animations: { rise: { frames: 4 } } }, /keys a socket \(sockets\) or a pose \(poses\) by frame/);
  refused({ animations: { rise: { frames: 4, sockets: { hoist: [] } } } }, /stack\.animations\.rise\.sockets\.hoist: unknown socket/);
  refused({ animations: { rise: { frames: 4, sockets: { lift: [{ frame: 5 }] } } } }, /sockets\.lift\[0\]\.frame: expected an integer from 0 to 4/);
  refused({ animations: { rise: { frames: 4, sockets: { lift: [{ frame: 2 }, { frame: 2 }] } } } }, /sockets\.lift\[1\]\.frame: expected an integer from 3 to 4/);
  refused({ animations: { rise: { frames: 4, sockets: { lift: [{ frame: 0, ease: 'slow' }] } } } }, /ease: expected linear, hold/);
  refused({ animations: { rise: { frames: 4, sockets: { lift: [{ frame: 0, heading: 0 }] } } } }, /heading/);
  refused({ animations: { rise: { frames: 2, duration: 80, durations: [80, 80], sockets: { lift: [] } } } }, /not both/);
  refused({ animations: { rise: { frames: 2, durations: [80], sockets: { lift: [] } } } }, /expected 2 durations, one for each frame/);
  refused({ animations: { rise: { frames: 2, headings: [0, 0], sockets: { lift: [] } } } }, /animations\.rise\.headings: expected 1–256 distinct angles/);
  refused({ animations: { rise: { frames: 2, poses: [{ frame: 0, pose: 'open' }] } } }, /poses bend jointed paths, and this stack has none/);
  refused({ animations: { rise: { frames: 64, sockets: { lift: [] } } } }, /4 headings and 256 frames of animations are 260 frames; a recipe holds 256/);
  refused({ directions: { east: 90, right: 90 } }, /stack\.directions\.right: heading 90 is already named east/);
  refused({ directions: { 'b-1': 0 }, headings: [0, 1], animations: { a: { frames: 1, headings: [0], sockets: { lift: [] } }, 'a-b': { frames: 1, headings: [1], sockets: { lift: [] } } } }, /two animations make the name a-b-1/);
  refused({ sockets: { ...source.sockets, lift: { at: [3, 3, 1], keys: [{ heading: 0, ease: 'in' }] } } }, /keys\[0\]\.ease/);
});

test('an animation keys the poses of jointed paths by frame', () => {
  const finger = { colors: 'k', nodes: [{ name: 'base', at: [1, 1, 0], radius: 1 }, { name: 'tip', at: [1, 1, 4], radius: .5 }] };
  const source = { ...block, headings: [0, 90], paths: { finger }, poses: { open: {}, hook: { finger: { base: 80 } } },
    animations: { curl: { frames: 3, headings: [0], poses: [{ frame: 0, pose: 'open' }, { frame: 2, pose: 'hook' }] } } };
  const { recipe } = compileStack(source), frames = fromAnchor(source);
  assert.deepEqual(recipe.frames.map(frame => frame.name), ['heading-0', 'heading-90', 'curl-0-0', 'curl-0-1', 'curl-0-2']);
  assert.deepEqual(frames.get('curl-0-0'), frames.get('heading-0'), 'with no keys by heading the stack rests in its open pose');
  assert.notDeepEqual(frames.get('curl-0-1'), frames.get('curl-0-0'));
  assert.notDeepEqual(frames.get('curl-0-2'), frames.get('curl-0-1'));
  // Keyed by heading as well, the frames of the animation follow its own keys and the headings keep theirs.
  const drawn = fromAnchor({ ...source, poseKeys: [{ heading: 0, pose: 'hook' }] });
  assert.deepEqual(drawn.get('heading-0'), frames.get('curl-0-2'));
  assert.deepEqual(drawn.get('curl-0-0'), frames.get('curl-0-0'));
  assert.throws(() => compileStack({ ...source, animations: { curl: { frames: 3, poses: [{ frame: 0, pose: 'fist' }] } } }), /animations\.curl\.poses\[0\]\.pose: unknown pose/);
});

golden.test('the moving starters play each animation at every heading from the pose they rest in', async () => {
  const expected = { 'iso-windmill': { spin: [8, true] }, 'iso-chest': { open: [6, false] }, 'iso-villager': { walk: [8, true], idle: [2, true] }, 'iso-cannon': { scan: [8, true], fire: [5, false] } };
  for (const [name, clips] of Object.entries(expected)) {
    const source = JSON.parse(await readFile(new URL(`../examples/${name}.stack.json`, import.meta.url), 'utf8'));
    assert.deepEqual([source.projection, source.cell, source.headings], ['iso', 1, [0, 45, 90, 135, 180, 225, 270, 315]], name);
    const { recipe, metadata } = compileStack(source), pixels = createHash('sha256'), { frames } = renderProject(recipe), named = new Map(frames.map(frame => [frame.name, frame]));
    assert.deepEqual(Object.fromEntries(Object.entries(metadata.animations).map(([clip, { frames: count, loop }]) => [clip, [count, loop]])), clips, name);
    assert.equal(frames.length, 8 + 8 * Object.values(clips).reduce((sum, [count]) => sum + count, 0), name);
    for (const frame of frames) pixels.update(frame.data);
    const facing = heading => Object.entries(source.directions ?? {}).find(([, at]) => at === heading)?.[0] ?? heading;
    for (const clip of Object.keys(clips)) for (const heading of source.headings) {
      const playing = recipe.animations[`${clip}-${facing(heading)}`];
      assert.deepEqual([playing.frames.length, playing.loop], clips[clip], `${name} ${clip} at ${heading}`);
      // Every animation starts from the rest pose, so a game cuts from standing to any of them without a jump.
      assert.deepEqual([...named.get(playing.frames[0]).data], [...named.get(`heading-${heading}`).data], `${name} ${clip} at ${heading} starts at rest`);
      const shown = new Set(playing.frames.map(frame => createHash('sha256').update(named.get(frame).data).digest('hex')));
      assert.ok(shown.size >= Math.min(3, playing.frames.length), `${name} ${clip} at ${heading} moves: ${shown.size} different frames`);
    }
    golden.equal(name, pixels.digest('hex'), { recipe });
  }
});

test('a scene plays a stack\'s animation at a heading, on a cell of an iso map', () => {
  const tiles = { version: 1, name: 'tiles', width: 32, height: 32, palette: { t: '#4a8f3c', l: '#2f6b2a', r: '#255522' }, frames: [{ name: 'block', ops: [{ op: 'box', w: 16, d: 16, h: 8, top: 't', left: 'l', right: 'r' }] }] };
  const lift = { ...moving, name: 'lift', projection: 'iso', cell: 1, headings: [0, 90], slices: [filled(8, 8, 'b')], sockets: { lift: { at: [4, 4, 1] } },
    parts: { cab: { socket: 'lift', at: [-2, -2, 0], slices: [filled(4, 4, 't'), filled(4, 4, 't')] } },
    animations: { rise: { frames: 4, duration: 100, sockets: { lift: [{ frame: 0 }, { frame: 4, offset: [0, 0, 8] }] } } } };
  const scene = prepareScene({ format: 'pixelforge-scene', version: 1, name: 'yard', width: 96, height: 80, duration: 400, assets: { tiles, lift },
    instances: [{ name: 'ground', asset: 'tiles', at: [48, 24], sort: 'ground', tilemap: { layout: 'iso', tile: [32, 16], rows: ['bb', 'bb'], legend: { b: 'block' }, surface: 8 } },
      { name: 'lift', asset: 'lift', on: 'ground', cell: [1, 0], animation: 'rise-90' }] });
  const at = time => [...renderScene(scene, { time }).data];
  assert.notDeepEqual(at(0), at(100));
  assert.notDeepEqual(at(100), at(300));
  assert.deepEqual(at(0), at(400), 'the loop comes round');
  assert.throws(() => prepareScene({ ...scene.source, instances: [scene.source.instances[0], { ...scene.source.instances[1], animation: 'rise' }] }), /unknown animation/);
});

test('a part turned by its socket is drawn where the same cells of the stack are, at every resolution', () => {
  const palette = { a: '#402010', b: '#804020' }, floor = Array.from({ length: 6 }, () => 'aaaaaa');
  const block = angle => ({ format: 'pixelforge-stack', version: 1, name: 'turned', palette, slices: [floor], headings: [0, 90, 180, 270],
    sockets: { hub: { at: [3, 3, 1], axis: 'z', keys: [{ heading: 0, angle }, { heading: 360, angle }] } }, parts: { block: { socket: 'hub', at: [-1, -1, 0], slices: [['bb', 'bb'], ['bb', 'bb']] } } });
  // A 2x2x2 block centred on its socket is the same block however far the socket has turned it. At an odd resolution
  // pixel centres fall on the lines between cells, and a turned part once took the other side of each.
  for (const view of [{ resolution: 1 }, { resolution: 3 }, { resolution: 4 }, { resolution: 5 }, { resolution: 3, projection: 'iso' }, { resolution: 1, squash: 1 }]) {
    const still = renderProject(compileStack({ ...block(0), ...view }).recipe);
    for (const angle of [90, 180, 270]) {
      const turned = renderProject(compileStack({ ...block(angle), ...view }).recipe);
      still.frames.forEach((frame, i) => assert.deepEqual([...turned.frames[i].data], [...frame.data], `${JSON.stringify(view)}, turned ${angle}, ${frame.name}`));
    }
  }
});

test('an animation whose frames would have names too long for a recipe is refused where it is written', () => {
  const source = { format: 'pixelforge-stack', version: 1, name: 'long', palette: { a: '#402010' }, slices: [['aa', 'aa']], headings: [0, 90],
    sockets: { hub: { at: [1, 1, 1], axis: 'z' } }, parts: { cap: { socket: 'hub', at: [0, 0, 0], slices: [['a']] } } };
  const keys = { frames: 2, sockets: { hub: [{ frame: 0, angle: 0 }, { frame: 2, angle: 90 }] } };
  assert.throws(() => compileStack({ ...source, animations: { ['w'.repeat(62)]: keys } }), error => error.path === `stack.animations.${'w'.repeat(62)}` && /name longer than 64 characters; shorten the animation's name$/.test(error.message));
  assert.throws(() => compileStack({ ...source, directions: { ['n'.repeat(30)]: 0 }, animations: { ['w'.repeat(40)]: keys } }), /shorten the animation's name or the direction's/);
  assert.equal(compileStack({ ...source, animations: { ['w'.repeat(59)]: keys } }).recipe.frames.length, 6);
});
