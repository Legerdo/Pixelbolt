// Build the editable Lodekeeper sprite stack from ground-level slices. Coordinates are in
// model cells. Positive x points towards the load, z goes up, and y crosses the cable drum.
// Run with a new output filename to keep any hand-painted edits in an existing stack.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const palette = {
  k:'#171927', n:'#25293c', b:'#343d52', s:'#4b596c', t:'#738294', m:'#a3b2bc', w:'#e1e6db',
  f:'#513438', r:'#84432e', o:'#ba622f', a:'#e58e37', g:'#ffc958', h:'#ffe997',
  d:'#154451', e:'#226273', j:'#398496', c:'#69b6b7', i:'#b3f0d3', l:'#99d675',
  p:'#382642', v:'#543768', u:'#7e4593', q:'#ad66bb', z:'#e796da', y:'#ffe1ef'
};
const xmin=-23, xmax=27, ymin=-14, ymax=14, levels=42;
const slices = Array.from({length:levels}, () => Array.from({length:ymax-ymin+1}, () => Array(xmax-xmin+1).fill('.')));
function put(x,y,z,ink) {
  if (x<xmin || x>xmax || y<ymin || y>ymax || z<0 || z>=levels) throw Error('Cell outside the model');
  slices[z][y-ymin][x-xmin]=ink;
}
function box(x0,x1,y0,y1,z0,z1,colour) {
  for(let z=z0;z<=z1;z++) for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
    const k=typeof colour==='function'?colour(x,y,z):colour;
    if(k) put(x,y,z,k);
  }
}
function plate(x0,x1,y0,y1,z0,z1,cut,colour) {
  box(x0,x1,y0,y1,z0,z1,(x,y,z)=>{
    const dx=Math.min(x-x0,x1-x), dy=Math.min(y-y0,y1-y);
    if(dx+dy<cut) return;
    return typeof colour==='function'?colour(x,y,z,dx,dy):colour;
  });
}
// A pin or drum on the y axle. The colour function also sees the radius from the axle.
function drum(cx,cz,r,y0,y1,colour) {
  const ceil=Math.ceil(r);
  box(cx-ceil,cx+ceil,y0,y1,cz-ceil,cz+ceil,(x,y,z)=>{
    const dx=x-cx, dz=z-cz, rr=Math.sqrt(dx*dx+dz*dz);
    if(rr<=r) return typeof colour==='function'?colour(dx,y,dz,rr):colour;
  });
}
// Rounded struts use the distance to a finite centre line, including both end caps.
function strut(from,to,r,colour) {
  const v=to.map((n,i)=>n-from[i]), length=v.reduce((s,n)=>s+n*n,0);
  const lo=from.map((n,i)=>Math.ceil(Math.min(n,to[i])-r));
  const hi=from.map((n,i)=>Math.floor(Math.max(n,to[i])+r));
  box(lo[0],hi[0],lo[1],hi[1],lo[2],hi[2],(x,y,z)=>{
    const p=[x-from[0],y-from[1],z-from[2]];
    const t=Math.max(0,Math.min(1,p.reduce((s,n,i)=>s+n*v[i],0)/length));
    if(p.reduce((s,n,i)=>s+(n-t*v[i])**2,0)<=r*r) return typeof colour==='function'?colour(x,y,z,t):colour;
  });
}
function arm(from,to,r,top,side,bottom) {
  strut(from,to,r,(x,y,z,t)=>{
    const centre=from[2]+(to[2]-from[2])*t;
    return z>centre+.4?top:z<centre-.6?bottom:side;
  });
}

// Four splayed jack feet leave daylight beneath the deck.
for(const x of [-18,0]) for(const sign of [-1,1]) {
  const y=sign*11;
  plate(x-3,x+3,y-3,y+3,0,1,2,(xx,yy,z)=>z?'s':'n');
  plate(x-2,x+2,y-2,y+2,2,2,1,'k');
  box(x-1,x+1,y-1,y+1,3,4,'m');
  arm([x,sign*7,5],[x,y,5],1.6,'g','a','r');
}
plate(-22,4,-10,10,3,5,3,(x,y,z)=>z===3?'k':(y>0?'b':'n'));
plate(-22,4,-10,10,6,7,3,(x,y,z,dx,dy)=>z===6?'d':Math.min(dx,dy)===0?'j':'e');
plate(-21,3,-9,9,8,8,2,(x,y,z,dx,dy)=>Math.min(dx,dy)===0?'s':'b');
// A dark counterweight and ribbed service cover sit behind the reel.
plate(-21,-15,-7,7,9,14,2,(x,y,z,dx,dy)=>z===14?'s':z===13?'b':z===9?'k':'n');
for(const y of [-4,-2,0,2,4]) box(-20,-17,y,y,15,15,'t');
box(-21,-21,-3,3,10,11,'e');
box(-21,-21,-2,2,11,11,'i');
// A swing-out operator's pedestal has sloped glass, a guard rail and a lit pressure gauge.
box(-2,-1,5,6,9,11,'s');
box(-4,1,4,7,12,13,(x,y,z)=>z===12?'n':'o');
for(let y=4;y<=7;y++) {
  const z=y<6?15:14;
  box(-4,1,y,y,14,z,'a');
  box(-3,0,y,y,z,z,(x)=>y===4?'j':x===-3?'c':x===0&&y===6?'l':'d');
}
for(const y of [-8,8]) {
  box(-19,-18,y,y,9,12,'o');
  box(-16,-15,y,y,9,12,'o');
  box(-19,-15,y,y,13,13,'g');
}

// Wound turquoise line. Each turn of the winding is picked out across the reel barrel.
drum(-10,14,5.3,-5,5,(dx,y,dz)=>dz>2?(y%2?'c':'j'):(y%2?'j':'e'));
for(const sign of [-1,1]) {
  const flange=sign*6;
  drum(-10,14,7.3,flange,flange,(dx,y,dz,r)=>r>6.2?(dz>=1?'m':'s'):'n');
  drum(-10,14,6.4,sign*7,sign*7,(dx,y,dz,r)=>{
    if(r>5.2) return dz>=0?'c':'j';
    if(r<2.5) return 'n';
    return (Math.abs(dx)<1.1 || Math.abs(dz-dx*.5)<.75 || Math.abs(dz+dx*.5)<.75)?'j':'d';
  });
  drum(-10,14,2.25,sign*8,sign*8,(dx,y,dz,r)=>r>1.1?'s':'h');
}

// Twin cheeks rise either side of the mechanism. Open space between the ram and arm
// keeps the lifting mechanism readable when the turn presents it directly from the side.
for(const sign of [-1,1]) {
  const rear=[-12,sign*3,15], elbow=[-2,sign*3,31];
  strut(rear,elbow,2.15,(x,y,z,t)=>{
    const lit=z>rear[2]+(elbow[2]-rear[2])*t+.35;
    if ((t>.48&&t<.55)||(t>.63&&t<.68)) return lit?'s':'b';
    return lit?'g':z<rear[2]+(elbow[2]-rear[2])*t-.6?'o':'a';
  });
  arm([1,sign*4,10],[-1,sign*4,22],1.55,'j','e','d');
  arm([-1,sign*4,21],elbow,1,'w','m','s');
  drum(1,10,2.7,Math.min(sign*4,sign*5),Math.max(sign*4,sign*5),(dx,y,dz,r)=>r<1?'g':'b');
}
// The tapered jib is built as two rails with a dark triangular opening between them.
for(const y of [-2,2]) {
  arm([-2,y,33],[17,y,37],1.35,'h','g','a');
  arm([-2,y,26],[17,y,35],.95,'a','o','r');
  arm([1,y,29],[4,y,34],.9,'a','o','r');
  arm([7,y,31],[10,y,35],.9,'a','o','r');
  arm([12,y,33],[14,y,36],.85,'a','o','r');
}
for(const x of [-1,5,12,17]) {
  const z=33+Math.round((x+2)*4/19);
  box(x,x,-2,2,z,z,'a');
}
drum(-2,31,3.25,-4,4,(dx,y,dz,r)=>r>2.25?(dz>0?'g':'o'):'n');
for(const y of [-5,5]) drum(-2,31,1.5,y,y,(dx,yy,dz,r)=>r<.6?'w':'t');
// Fairlead over the elbow, then a contrast edge on the taut cable to the head pulley.
arm([-13,0,19],[-4,0,35],.83,'c','j','d');
drum(-3,34,2,-1,1,(dx,y,dz,r)=>r>1?'b':'m');
arm([-4,0,36],[18,0,39],.9,'c','c','j');
drum(18,36,2.7,-2,2,(dx,y,dz,r)=>r>1.6?'n':'s');
for(const y of [-3,3]) drum(18,36,2.7,y,y,(dx,yy,dz,r)=>r>1.7?(dz>0?'h':'a'):r>.8?'s':'w');
box(20,20,0,0,24,35,(x,y,z)=>z%5===0?'i':'c');

// The ore grows as a six-sided spear, with distinct flat facets and an offset crown.
function shard(cx,cy,bottom,shoulder,crown,rx,ry,lean,tones) {
  const planes=[[1,0], [.55,.78],[-.5,.85],[-1,0],[-.6,-.8],[.58,-.8]];
  for(let z=bottom;z<=crown;z++) {
    const crownPart=Math.max(0,(z-shoulder)/(crown-shoulder));
    const width=z<shoulder?.24+.76*(z-bottom)/(shoulder-bottom):1-.94*crownPart;
    const centre=cx+lean*(z-bottom)/(crown-bottom), drift=cy-.55*crownPart;
    box(Math.floor(centre-rx*1.5),Math.ceil(centre+rx*1.5),Math.floor(cy-ry*1.5),Math.ceil(cy+ry*1.5),z,z,(x,y)=>{
      const distances=planes.map(([a,b])=>a*(x-centre)/rx+b*(y-drift)/ry);
      const distance=Math.max(...distances);
      if(distance>width) return;
      const face=distances.indexOf(distance);
      return tones[crownPart>.08?1:0][face];
    });
  }
}
shard(18,-1,6,13,19,3.4,2.9,-3,['puvqvu','qzuzqu']);
shard(20,1,4,14,21,4.2,3.8,0,['uqzvpu','qzyuqv']);
shard(22,-1,7,14,20,2.8,2.5,3,['vuqvpu','quzqqv']);
shard(18,2,7,12,17,2.3,2.1,-3,['pvvqvu','uzuzyq']);
// The grab closes round the crystal, leaving the broad pink faces showing between the jaws.
drum(20,23,1.75,-1,1,(dx,y,dz)=>dz>0?'m':'s');
plate(17,23,-3,3,20,21,2,(x,y,z)=>z===21?'g':'o');
for(const sign of [-1,1]) {
  arm([19,sign*2,20],[18,sign*5,17],.92,'m','s','b');
  arm([18,sign*5,17],[19,sign*4,13],.92,'s','b','n');
  arm([19,sign*4,13],[20,sign*2,12],.8,'g','a','o');
}
arm([22,0,20],[24,0,16],1,'t','s','n');
arm([24,0,16],[23,0,13],.85,'g','a','r');

// Decals stay independently editable in Studio. A single stencil serves both deck edges.
const decals={ chevron:['gg..gg..','.gg..gg.'], vent:['m.m.m.','b.b.b.'], indicator:['lic'],
  serial:['ww.w','w..w','ww.w'] };
const paint=[];
for(const face of ['north','south']) {
  paint.push({face,at:[-14-xmin,levels-1-7],decal:'chevron',flipX:face==='north'});
  paint.push({face,at:[-20-xmin,levels-1-12],decal:'vent'});
}
paint.push({face:'west',at:[-1-ymin,levels-1-6],decal:'indicator'});
paint.push({face:'south',at:[-5-xmin,levels-1-7],decal:'serial'});
const headings=Array.from({length:40},(_,i)=>(342+i*9)%360);
const stack={format:'pixelforge-stack',version:1,name:'lodekeeper',palette,projection:'iso',resolution:4,
  pivot:[-xmin,-ymin],headings,duration:90,slices:slices.map(layer=>layer.map(row=>row.join(''))),decals,paint};
if(!process.argv[2]) throw Error('Supply a new .stack.json output filename');
await mkdir(dirname(process.argv[2]),{recursive:true});
await writeFile(process.argv[2],JSON.stringify(stack,null,2)+'\n',{flag:'wx'});
