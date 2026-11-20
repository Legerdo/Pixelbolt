// Author the Lodekeeper's facelift in model space. The plinth is paintable voxel work;
// machined faces share vertices, and the moving drum, cable and grab share named sockets.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cosDeg, sinDeg } from '../../../src/craft.js';
import { formatJSON } from '../../../src/export.js';

const original=JSON.parse(await readFile(new URL('../lodekeeper.stack.json',import.meta.url),'utf8'));
const palette={...original.palette,
  k:'#181e2b', n:'#253140', b:'#354759', s:'#526979', t:'#79969e', m:'#aec5c6',
  d:'#194653', e:'#256a79', j:'#41939d', c:'#80c7bd', i:'#c8f4d6',
  r:'#814831', o:'#b86931', a:'#ec9b39', g:'#ffd16c', h:'#fff0a5',
  P:'#493066cb', V:'#7546acd1', U:'#9a60c895', Q:'#bb77dda6', Z:'#eab3edc5',
  Y:'#ffddf1ed', N:'#8748ac78', I:'#dfabf18c', H:'#fff1fd'};
const facets=[];
const angles=Array.from({length:72},(_,i)=>(335+i*5)%360);
const liftKeys=Array.from({length:13},(_,i)=>{
  const heading=i*30, rise=+(3.9*(1-cosDeg(heading))).toFixed(3);
  return {heading,offset:[0,0,rise]};
});
const world=([x,y,z])=>[x+23.5,y+14.5,z];
const sockets={
  chassis:{at:world([0,0,0])},
  axle:{at:world([-10,0,14]),axis:'y',keys:liftKeys.map(({heading,offset})=>({heading,angle:-offset[2]*11}))},
  sheave:{at:world([18,0,36])},
  grab:{at:world([20.35,0,20]),keys:liftKeys}
};
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const avg=points=>points[0].map((_,i)=>points.reduce((sum,p)=>sum+p[i],0)/points.length);
const tidy=p=>p.map(n=>+n.toFixed(4));
function face(points,color,socket='chassis',twoSided=false) {
  facets.push({socket,color,points:points.map(tidy),...(twoSided&&{twoSided})});
}
function skin(points,center,color,socket) {
  const normal=cross(sub(points[1],points[0]),sub(points[2],points[0]));
  face(dot(normal,sub(avg(points),center))<0?[...points].reverse():points,color,socket);
}
// Extrude a convex outline in x/z through y. Choose top, underside and end colours
// from the edge normal; broad surfaces keep their authored tones as the camera turns.
function cheek(xz,y0,y1,colors,socket='chassis') {
  const lo=xz.map(([x,z])=>[x,y0,z]), hi=xz.map(([x,z])=>[x,y1,z]), center=avg([...hi,...lo]);
  skin(hi,center,colors[0],socket); skin(lo,center,colors[1],socket);
  for(let i=0;i<xz.length;i++){
    const j=(i+1)%xz.length, z=(xz[i][1]+xz[j][1])/2-center[2];
    skin([lo[i],hi[i],hi[j],lo[j]],center,z>.05?colors[2]:colors[3],socket);
  }
}
function beam(x1,z1,x2,z2,thickness,y0,y1,colors,socket) {
  const dx=x2-x1,dz=z2-z1,length=Math.sqrt(dx*dx+dz*dz);
  const u=-dz*thickness/(2*length),v=dx*thickness/(2*length);
  cheek([[x1+u,z1+v],[x2+u,z2+v],[x2-u,z2-v],[x1-u,z1-v]],y0,y1,colors,socket);
}
function disc(x,y0,y1,z,r,colors,socket='chassis',sides=16) {
  const ring=Array.from({length:sides},(_,i)=>[x+r*cosDeg(i*360/sides),z+r*sinDeg(i*360/sides)]);
  cheek(ring,y0,y1,colors,socket);
}
function sidePatch(xz,y,ink,socket='chassis') { face(xz.map(([x,z])=>[x,y,z]),ink,socket,true); }
function ringMark(cx,y,cz,radius,width,ink,socket='chassis',count=16){
  for(let i=0;i<count;i++){
    const a=i*360/count,b=(i+1)*360/count;
    const p=(r,angle)=>[cx+r*cosDeg(angle),cz+r*sinDeg(angle)];
    sidePatch([p(radius,a),p(radius,b),p(radius-width,b),p(radius-width,a)],y,ink,socket);
  }
}
function label07(x,y,z,unit,mirror) {
  const letters=['111.111','101...1','101..1.','101..1.','111..1.'];
  letters.forEach((row,v)=>[...row].forEach((key,u)=>{
    if(key!== '1')return;
    const a=x+(mirror?6-u:u)*unit,b=z-v*unit;
    sidePatch([[a,b],[a+unit,b],[a+unit,b-unit],[a,b-unit]],y,'w');
  }));
}
const amber=['a','o','g','r'], dark=['n','b','s','k'], brass=['g','a','h','o'], hydraulic=['e','d','c','d'];

// Rear counterweight and louvres. The deck stays relatively dark beneath the reel.
cheek([[-21,8],[-15,8],[-14,12],[-16,15],[-20,15],[-22,13]],-7,7,dark);
for(let y=-5;y<=5;y+=2) face([[-20,y,15.06],[-16,y,15.06],[-16,y+.65,15.06],[-20,y+.65,15.06]],'t');
for(const side of [-1,1]) {
  const y=side*7.05;
  sidePatch([[-20,10],[-16,10],[-16,12],[-20,12]],y,'d');
  for(const x of [-19.5,-18.5,-17.5]) sidePatch([[x,10.7],[x+.55,10.7],[x+.55,11.45],[x,11.45]],y+side*.03,'i');
}
// Hinge-to-hinge mast and polished hydraulic piston, separated by a wedge of daylight.
for(const side of [-1,1]) {
  const y=side*3.9;
  cheek([[-13,14],[-10,12],[-7,15],[.3,30],[-.8,33],[-3.7,33]],y-1,y+1,amber);
  beam(.5,9,-.7,22.5,2.7,y-.9,y+.9,hydraulic);
  beam(-.7,22,-2,31,1.15,y-.58,y+.58,['m','s','w','t']);
  for(const [x,z] of [[-7.6,22],[-6.65,24]]) beam(x,z,x+1.1,z+2,1,y+side*1.01-.01,y+side*1.01+.01,dark);
}
disc(-2,-5.3,5.3,31,2.9,amber);
for(const side of [-1,1]){
  disc(-2,side*5.52-.17,side*5.52+.17,31,2.05,dark);
  disc(-2,side*5.83-.15,side*5.83+.15,31,1.31,['m','m','w','s'],'chassis',6);
  sidePatch([[-2.59,30.91],[-1.57,31.48],[-1.44,31.17],[-2.45,30.60]],side*6.01,'s');
}

// A through-truss with five open bays, top deck stays and pale wear caps on the bearings.
for(const y of [-2.5,2.5]) {
  beam(-2,33,18,37,1.65,y-.52,y+.52,brass);
  beam(-2,26.9,18,35.5,1.1,y-.52,y+.52,amber);
  for(const [x,z,xx,zz] of [[-2,27,2.5,33.7],[2.5,33.7,5.6,30.1],[5.6,30.1,9.2,35.1],[9.2,35.1,12.1,33],[12.1,33,15.4,36.4]])
    beam(x,z,xx,zz,.75,y-.30,y+.30,['o','r','a','r']);
}
for(const x of [-1,6,13,17]) {
  const z=33+(x+2)*.2;
  cheek([[x-.35,z],[x+.35,z],[x+.35,z+.45],[x-.35,z+.45]],-2.9,2.9,amber);
}
beam(-12,19,-3.3,35.2,.68,-.28,.28,['j','e','c','d']);
beam(-3.3,35.2,18,38.4,.56,-.28,.28,['c','j','i','e']);
disc(0,-2,2,0,2.55,dark,'sheave');
for(const y of [-2.5,2.2]) {
  disc(0,y,y+.3,0,2.48,brass,'sheave');
  disc(0,y-.03,y+.33,0,1.27,['s','s','m','n'],'sheave');
}
// Tether runs from the tangent of the sheave to the shackle. Its two attachment
// points keep it taut throughout the hoist. A square cross-section keeps it visible end-on.
const rope=[[-.28,-.28],[.28,-.28],[.28,.28],[-.28,.28]];
for(let i=0;i<4;i++){
  const j=(i+1)%4;
  const point=(socket,p)=>({socket,at:socket==='sheave'?[2.35+p[0],p[1],0]:[p[0],p[1],2.6]});
  facets.push({color:['j','c','i','e'][i],twoSided:true,points:[point('sheave',rope[i]),point('sheave',rope[j]),point('grab',rope[j]),point('grab',rope[i])]});
}
// The moving winding and end plates are local to the axle. Side marks are offset from their plate.
disc(0,-5.3,5.3,0,4.9,hydraulic,'axle');
for(let y=-4.7;y<5;y+=1.45) disc(0,y,y+.45,0,5.15,['j','e','c','d'],'axle');
for(const side of [-1,1]) {
  const y=6.5*side;
  disc(0,y-.46,y+.46,0,7,['e','e','c','d'],'axle');
  disc(0,y-.48,y+.48,0,5.65,['n','n','t','b'],'axle');
  for(let a=0;a<360;a+=120) {
    const coords=[[.9,-.75],[5.25,-1.2],[5.55,-.15],[4.6,.7],[1.2,1.05]];
    sidePatch(coords.map(([x,z])=>[x*cosDeg(a)-z*sinDeg(a),x*sinDeg(a)+z*cosDeg(a)]),y+side*.51,'j','axle');
  }
  ringMark(0,y+side*.54,0,6.95,.48,'c','axle');
  ringMark(0,y+side*.56,0,5.68,.30,'s','axle');
  for(let a=0;a<360;a+=60) {
    const x=6.3*cosDeg(a),z=6.3*sinDeg(a);
    sidePatch([[x-.36,z-.32],[x+.36,z-.32],[x+.36,z+.32],[x-.36,z+.32]],y+side*.5,'m','axle');
  }
  disc(0,y-.7,y+.7,0,2.05,dark,'axle',8);
  disc(0,y-.8,y+.8,0,1.15,brass,'axle',6);
  sidePatch([[-.45,-.12],[.48,-.12],[.48,.13],[-.45,.13]],y+side*.82,'r','axle');
}
// A recessed service hatch and cast number plate belong to the counterweight.
for(const side of [-1,1]){
  const y=side*7.10;
  sidePatch([[-21.2,9.8],[-15.85,9.8],[-15.85,13.35],[-20.82,13.35],[-21.2,12.9]],y,'s');
  sidePatch([[-20.96,10.03],[-16.08,10.03],[-16.08,13.09],[-20.72,13.09],[-20.96,12.85]],y+side*.04,'n');
  label07(-20.27,y+side*.08,12.77,.46,side<0);
}
// Operator's enamel panel, two keys and a luminous meter. Stripe plates sit flush with the deck.
cheek([[-3,8],[0,8],[0,12],[-3,12]],5.2,6.2,dark);
cheek([[-4,12],[1.5,12],[1.5,13.5],[-4,14.8]],4,7.4,amber);
const panelZ=x=>14.81-(x+4)*1.3/5.5;
function panel(x0,x1,y0,y1,ink,offset) {
  face([[x0,y0,panelZ(x0)+offset],[x1,y0,panelZ(x1)+offset],[x1,y1,panelZ(x1)+offset],[x0,y1,panelZ(x0)+offset]],ink);
}
panel(-3.65,1.1,4.3,7.1,'n',.03);panel(-3.3,-.75,4.55,6.65,'e',.06);
panel(-3,-2.45,5,6.45,'i',.10);panel(-2.25,-1.7,5,6.05,'c',.10);
panel(.05,.72,4.7,5.4,'g',.08);panel(.05,.72,5.9,6.6,'m',.08);

// Gem faces enclose an empty interior. Only outward-facing planes draw; an inclusion and
// two subsidiary spires show through the broad faces. Sharp, opaque glints pick out two ridges.
function crystal(x,y,z,rx,ry,h,lean,colors) {
  const center=[x,y,z+h*.54], crown=[x+lean,y-.15,z+h], tip=[x-.4*lean,y+.1,z];
  const ring=Array.from({length:6},(_,i)=>[x+rx*cosDeg(i*60+15),y+ry*sinDeg(i*60+15),z+h*(i%2?.61:.67)]);
  for(let i=0;i<ring.length;i++) {
    const j=(i+1)%6;
    skin([ring[i],ring[j],crown],center,colors[0][i],'grab');
    skin([tip,ring[j],ring[i]],center,colors[1][i],'grab');
  }
  const near=ring[1], v=sub(crown,near);
  const start=near.map((n,i)=>n+v[i]*.13), end=near.map((n,i)=>n+v[i]*.82);
  const delta=sub(ring[2],near).map(n=>n*.105);
  skin([start,end,add(start,delta)],center,'Y','grab');
}
crystal(-2,-1,-13,2.5,2.05,11,-2.4,['VUZQIV','PVUVNQ']);
crystal(2.1,-.9,-12,2.25,1.9,10.6,2.1,['QZUVQI','VUNQUP']);
crystal(0,.65,-15.8,4.1,3.35,15.3,.65,['UZYQVU','VUQZUP']);
crystal(-.8,.65,-12.6,.85,.72,5.7,-.2,['ZZYYYY','QQZIZZ']);
// Steel jaws grip the shoulders, leaving the longest faces and crystal tip visible.
disc(0,-1.25,1.25,2.42,1.4,['m','t','w','s'],'grab',8);
cheek([[-2.75,0],[-2.1,-.8],[2.1,-.8],[2.75,0],[2.2,1.05],[-2.2,1.05]],-2.15,2.15,brass,'grab');
for(const sign of [-1,1]){
  const y=sign*2.45;
  beam(-1.3,-.5,-3.9,-3.8,1.05,y-.45,y+.45,['t','s','m','b'],'grab');
  beam(-3.9,-3.8,-3.35,-7.05,.9,y-.45,y+.45,dark,'grab');
  beam(-3.35,-7.05,-1.9,-8.05,.68,y-.45,y+.45,amber,'grab');
}
beam(1.85,-.1,4.25,-4.35,.90,-.65,.65,['s','s','t','n'],'grab');
beam(4.25,-4.35,3.1,-7,.7,-.65,.65,amber,'grab');

const stack={format:'pixelforge-stack',version:1,name:'lodekeeper-faceted',projection:'iso',resolution:4,
  pivot:[23,14],headings:angles,duration:60,palette,
  slices:original.slices.slice(0,9).map(layer=>layer.map(row=>row.slice(0,28))),
  decals:{chevron:['gg..gg..','.gg..gg.']},paint:['north','south'].map(face=>({face,at:[9,1],decal:'chevron',flipX:face==='north'})),
  sockets,facets};
if(!process.argv[2]) throw Error('Supply a new .stack.json filename');
await mkdir(dirname(process.argv[2]),{recursive:true});
await writeFile(process.argv[2],formatJSON(stack,160),{flag:'wx'});
