// Bake the turntable and winch action from the editable stack. Move the grab and its load
// together, wind the spool by the length lifted, and trim all poses to one ground anchor.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { prepareStack } from '../../src/stack.js';
import { cosDeg, sinDeg } from '../../src/craft.js';

const [input, output]=process.argv.slice(2);
if (!input || !output) throw Error('Supply the .stack.json source and a new .pixel.json output filename');
const source=JSON.parse(await readFile(input,'utf8'));
const [originX,originY]=source.pivot;
const model=prepareStack(source), recipe=model.recipe();
const home=source.headings.indexOf(342);
if (home<0) throw Error('The hoist uses heading 342 from the stack');

// The grab, loose crystal and hook sit beneath the fairlead, in an otherwise empty bay.
// The cable is wound onto a five-cell-radius drum, about eleven degrees per cell lifted.
function lifted(height) {
  const volume=source.slices.map(layer=>layer.map(row=>[...row]));
  const cableX=originX+20, grabTop=24;
  for(let z=0;z<=grabTop;z++) for(const row of volume[z]) row.fill('.',originX+12);
  for(let z=grabTop+1;z<=35;z++) {
    volume[z][originY][cableX]=z<=grabTop+height?'.':source.slices[z-height][originY][cableX];
  }
  for(let z=0;z<=grabTop;z++) for(let y=0;y<volume[z].length;y++) {
    for(let x=originX+12;x<volume[z][y].length;x++) {
      const ink=source.slices[z][y][x];
      if(ink!=='.'&&ink!==' ') volume[z+height][y][x]=ink;
    }
  }
  // Turn the six spokes inside their rim while the axle and flanges stay in their bearings.
  const angle=height*11, c=cosDeg(angle), s=sinDeg(angle);
  for(const y of [originY-7,originY+7]) for(let dx=-5;dx<=5;dx++) for(let dz=-5;dz<=5;dz++) {
    const d=dx*dx+dz*dz;
    if(d>=2.5**2 && d<=5.2**2) {
      const x=dx*c+dz*s, z=dz*c-dx*s;
      volume[14+dz][y][originX-10+dx]=(Math.abs(x)<1.1 || Math.abs(z-x*.5)<.75 || Math.abs(z+x*.5)<.75)?'j':'d';
    }
  }
  const stack={...source,slices:volume.map(layer=>layer.map(row=>row.join('')))};
  return prepareStack(stack).frame(home).ops;
}
const highest=8;
for(let height=0;height<=highest;height++) {
  const ops=height?lifted(height):model.frame(home).ops;
  recipe.frames.push({name:'lift-'+height,duration:height===0?480:height===highest?380:height===1||height===highest-1?120:70,ops});
}
const lifts=Array.from({length:highest+1},(_,i)=>'lift-'+i);
recipe.animations.hoist={frames:[...lifts,...lifts.slice(1,-1).reverse()],loop:true};

// Include the original ground anchor as well as every visible cell. All exports use
// the same crop on every frame, including the low and high positions of the grab.
let [left,top]=recipe.anchor, right=left, bottom=top;
for(const frame of recipe.frames) {
  frame.ops[0].rows.forEach((row,y)=>{
    const start=row.search(/[^. ]/);
    if(start===-1) return;
    const end=row.replace(/[. ]+$/,'').length-1;
    left=Math.min(left,start); right=Math.max(right,end); top=Math.min(top,y); bottom=Math.max(bottom,y);
  });
}
const pad=3;
left=Math.max(0,left-pad); top=Math.max(0,top-pad);
right=Math.min(recipe.width-1,right+pad); bottom=Math.min(recipe.height-1,bottom+pad);
recipe.frames=recipe.frames.map(frame=>({...frame,ops:[{op:'grid',rows:frame.ops[0].rows.slice(top,bottom+1).map(row=>row.slice(left,right+1))}]}));
recipe.width=right-left+1; recipe.height=bottom-top+1;
recipe.anchor=[recipe.anchor[0]-left,recipe.anchor[1]-top];
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(recipe)+'\n',{flag:'wx'});
