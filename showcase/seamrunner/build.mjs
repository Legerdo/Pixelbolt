// Build an original tracked survey rover from cross-sections, glazing and a helical cutter.
// All dimensions are model units. Positive x points along the bore, positive z points up.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cosDeg, sinDeg } from '../../src/craft.js';
import { formatJSON } from '../../src/export.js';

const palette = {
  k: '#1c2031', n: '#2b3144', b: '#39465a', s: '#51667a', t: '#80959c', l: '#b6c8bd',
  r: '#713847', o: '#ab4f3f', a: '#df7046', f: '#fc9b5b', h: '#ffbf74',
  u: '#b69d81', c: '#efddae', w: '#fff1cd', d: '#80583e', g: '#d99242', y: '#ffd25d',
  v: '#244b61', e: '#32788b', j: '#4aacae', i: '#89e4d1', L: '#dcffe0',
  p: '#5c4662', m: '#96536b', R: '#f27e80', B: '#7bb5d1',
  G: '#54beb838', F: '#70ccc84f', H: '#ade8d857', S: '#8af6eb95'
};
const iron = ['b','n','s','k'], alloy = ['t','s','l','b'], hull = ['a','o','f','r'];
const cream = ['c','u','w','s'], gold = ['y','g','w','d'], teal = ['j','e','i','v'];
const facets = [];
const plus = (a,b) => a.map((n,i) => n+b[i]);
const minus = (a,b) => a.map((n,i) => n-b[i]);
const mul = (a,n) => a.map(v => v*n);
const dot = (a,b) => a.reduce((sum,v,i) => sum+v*b[i],0);
const cross = ([x,y,z],[a,b,c]) => [y*c-z*b,z*a-x*c,x*b-y*a];
const unit = a => mul(a,1/Math.sqrt(dot(a,a)));
const mid = points => points[0].map((_,i) => points.reduce((sum,p) => sum+p[i],0)/points.length);
const tidy = p => p.map(n => +n.toFixed(4));
function face(points,color,socket='body',twoSided=false) {
  facets.push({ color, socket, points:points.map(tidy), ...(twoSided && {twoSided}) });
}
function outside(points,inside,colors,socket) {
  let normal = cross(minus(points[1],points[0]),minus(points[2],points[0]));
  if (dot(normal,minus(mid(points),inside)) < 0) {
    points = points.toReversed();
    normal = mul(normal,-1);
  }
  const [x,y,z] = unit(normal);
  const color = typeof colors === 'string' ? colors :
    colors[z>.51 ? 2 : z<-.38 ? 3 : .48*x+.78*y>-.16 ? 0 : 1];
  face(points,color,socket);
}
function prism(lo,hi,colors,socket='body') {
  const centre = mid([...lo,...hi]);
  outside(lo,centre,colors,socket);
  outside(hi,centre,colors,socket);
  for (let i=0; i<lo.length; i++) {
    const j=(i+1)%lo.length;
    outside([lo[i],lo[j],hi[j],hi[i]],centre,colors,socket);
  }
}
function sideProfile(profile,y0,y1,colors) {
  prism(profile.map(([x,z])=>[x,y0,z]),profile.map(([x,z])=>[x,y1,z]),colors);
}
function box(x0,x1,y0,y1,z0,z1,colors) {
  sideProfile([[x0,z0],[x1,z0],[x1,z1],[x0,z1]],y0,y1,colors);
}
function rod(start,end,radius,colors,sides=6) {
  const axis=unit(minus(end,start)), across=unit(cross(axis,Math.abs(axis[2])>.85?[0,1,0]:[0,0,1]));
  const up=cross(axis,across);
  const ring=Array.from({length:sides},(_,i)=>plus(mul(across,radius*cosDeg(i*360/sides)),mul(up,radius*sinDeg(i*360/sides))));
  prism(ring.map(p=>plus(start,p)),ring.map(p=>plus(end,p)),colors);
}
function yDisc(x,z,y0,y1,r,colors,count=12) {
  sideProfile(Array.from({length:count},(_,i)=>[x+r*cosDeg(i*360/count),z+r*sinDeg(i*360/count)]),y0,y1,colors);
}
function sideMark(profile,y,color) {
  face(profile.map(([x,z])=>[x,y,z]),color,'body',true);
}
function topMark(x0,x1,y0,y1,z,color) {
  face([[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],color);
}
function xMark(x,y0,y1,z0,z1,color) {
  face([[x,y0,z0],[x,y1,z0],[x,y1,z1],[x,y0,z1]],color,'body',true);
}

// Continuous rubber belts, broad spaced grousers and three serviceable wheel hubs per side.
const belt=[[-17,2.6],[-14.4,.3],[8.8,.3],[13,3.8],[13,5.8],[10.3,8.5],[-14,8.5],[-17,6.3]];
for (const side of [-1,1]) {
  const yInner=side*6.4, yOuter=side*10.3;
  sideProfile(belt,yInner,yOuter,iron);
  sideMark([[-16,3.2],[-14.1,1.2],[9,1.2],[12,4.1],[11.4,6.1],[9.7,7.4],[-13.7,7.4],[-16,5.8]],side*10.34,'k');
  for (const x of [-11.8,-2.25]) {
    sideMark([[x,3.8],[x+.9,3.45],[x+5.5,6.1],[x+7.2,6.1],[x+7.2,6.85],[x+5.25,6.85]],side*10.38,'b');
  }
  for (const [x,r] of [[-12.4,2.85],[-2.8,3.08],[7.3,2.85]]) {
    yDisc(x,4.2,side*10.34,side*10.72,r,['s','s','t','b']);
    yDisc(x,4.2,side*10.73,side*10.85,r*.71,iron,10);
    yDisc(x,4.2,side*10.87,side*11.06,r*.41,['g','g','y','d'],8);
    sideMark([[x-.42,3.92],[x+.4,3.92],[x+.4,4.48],[x-.42,4.48]],side*11.08,'k');
  }
  for (let x=-13.5;x<10;x+=3.65) {
    const y0=side*6.5, y1=side*10.47;
    face([[x,y0,8.55],[x+.88,y0,8.55],[x+1.65,y1,8.55],[x+.77,y1,8.55]],'s','body',true);
    sideMark([[x+.77,8.54],[x+1.65,8.54],[x+1.42,7.76],[x+.65,7.76]],y1,'b');
    sideMark([[x,.32],[x+.78,.32],[x+.65,.86],[x-.12,.86]],side*10.35,'s');
  }
  // The shoes wrap up the two inclined end faces of the belt.
  for (const [a,b] of [[belt[0],belt[1]],[belt[2],belt[3]],[belt[4],belt[5]],[belt[6],belt[7]]]) {
    const dx=b[0]-a[0], dz=b[1]-a[1], length=Math.sqrt(dx*dx+dz*dz);
    const shoe=(t,y)=>[a[0]+dx*t+dz*.08/length,y,a[1]+dz*t-dx*.08/length];
    for (const t of [.15,.57]) face([shoe(t,side*6.49),shoe(t+.13,side*6.49),shoe(t+.16,side*10.37),shoe(t+.03,side*10.37)],'s','body',true);
  }
}
// Armoured tub, upswept fenders and the white chevron and unit number on each skirt.
sideProfile([[-16,8],[-13.5,5.5],[8.8,5.5],[13,8],[11.5,11.4],[-13.5,11.4],[-16,10]],-7,7,hull);
for (const side of [-1,1]) {
  const skirt=[[-16.3,9],[-13.8,8],[7.8,8],[12.2,9.6],[10.4,11.2],[-13.7,11.2]];
  sideProfile(skirt,side*6.6,side*9.25,hull);
  const y=side*9.29;
  for (const x of [-9.8,-7.9]) {
    sideMark([[x,8.42],[x+.88,8.42],[x+2.65,10.95],[x+1.75,10.95]],y,'c');
  }
  sideMark([[1.7,8.35],[7.4,8.35],[8.45,10.82],[2.5,10.82]],y,'r');
  for (const x of [-13.2,-12.15]) sideMark([[x,9.24],[x+.43,9.24],[x+.99,10.56],[x+.55,10.56]],y,'r');
  // The side facing away gets its stencil mirrored in model space to read the same way.
  const glyph=['101','101','111','..1','..1'], size=.43;
  for (let v=0;v<glyph.length;v++) for (let u=0;u<3;u++) if (glyph[v][u]==='1') {
    const x=4.55+size*(side>0?u:2-u), z=10.6-v*size;
    sideMark([[x,z],[x+size,z],[x+size,z-size],[x,z-size]],y+side*.025,'w');
  }
}
// Rear tether cassette, teal cable turns, fairlead handle, and two red tail lamps.
box(-17.3,-10,-5.9,5.9,10,12,iron);
for (const side of [-1,1]) {
  sideProfile([[-17,11.5],[-11.3,11.5],[-12.7,15.3],[-15.7,15.3]],side*4.2,side*5.6,cream);
}
yDisc(-14.4,14.2,-4.1,4.1,2.45,teal);
for (const y of [-3.35,-1.7,0,1.7,3.35]) yDisc(-14.4,14.2,y-.28,y+.28,2.59,['e','e','i','v']);
for (const side of [-1,1]) {
  yDisc(-14.4,14.2,side*4.15,side*4.73,2.98,iron);
  yDisc(-14.4,14.2,side*5.64,side*5.82,.94,gold,8);
  sideMark([[-14.88,14.06],[-14.08,13.9],[-14.01,14.22],[-14.81,14.4]],side*5.84,'d');
  rod([-17.4,side*2.8,10.8],[-18.9,side*2.8,13],.38,alloy);
  xMark(-17.33,side*5.4,side*3.2,10.55,11.37,'R');
}
rod([-18.9,-2.8,13],[-18.9,2.8,13],.46,teal);
box(-17.6,-15.6,-5.55,5.55,7.15,9.78,iron);
for (const y of [-3.05,-1.5,.05,1.6]) xMark(-17.62,y,y+.69,7.65,9.17,'s');
for (const side of [-1,1]) xMark(-17.62,side*4.05,side*5.12,8.65,9.24,'R');
// Offside survey aerial with a striped sleeve and a ruby signal lamp.
rod([-11.55,-6.25,11],[-11.55,-6.25,15.2],.81,iron);
rod([-11.55,-6.25,15.15],[-12.0,-6.25,20.5],.35,alloy);
rod([-11.94,-6.25,19.7],[-12.03,-6.25,20.65],.53,gold);
rod([-12.03,-6.25,20.6],[-12.03,-6.25,21.8],.61,['R','m','h','r'],8);

// An occupied cab: a low instrument rail, brass joystick, burgundy seat and a helmet visor.
sideProfile([[-9.9,11.1],[8.5,11.1],[7.5,12.8],[-8.7,12.8]],-5.9,5.9,cream);
box(-8.5,6.55,-5,5,12.72,13.02,iron);
sideProfile([[-6.5,13.05],[-1.15,13.05],[-.7,14.3],[-4.65,14.9],[-5.5,18.2],[-6.65,18.2]],-2.35,2.35,['m','p','R','p']);
sideProfile([[-5,14.45],[-.85,14.45],[.15,15.1],[-.65,17.15],[-3.8,17.85],[-5,17]],-1.65,1.65,['e','v','j','v']);
sideProfile([[-4.45,18.05],[-3.8,17.5],[-1.55,17.5],[-.5,19],[-.95,20.6],[-2.25,21.35],[-3.8,21],[-4.55,19.95]],-1.68,1.68,gold);
sideProfile([[-1.95,18.35],[-.54,18.47],[-.32,19.55],[-.73,20],[-1.98,19.7]],-1.76,1.76,iron);
for (const side of [-1,1]) {
  sideMark([[-1.58,19.1],[-.65,19.2],[-.69,19.55],[-1.6,19.52]],side*1.79,'i');
  yDisc(-3.6,19.15,side*1.69,side*1.92,.68,iron,8);
  yDisc(-3.6,19.15,side*1.93,side*1.98,.36,gold,6);
  rod([-2.1,side*1.55,16.9],[.55,side*2.3,15.85],.52,teal);
  rod([.55,side*2.3,15.85],[1.75,side*2.3,16.47],.38,gold);
}
sideProfile([[2.1,13],[5.15,13],[5.88,15.2],[4.45,16.5],[2.4,15.4]],-3.9,3.9,iron);
face([[2.62,-2.8,15.57],[3.98,-2.8,16.27],[3.98,-.42,16.27],[2.62,-.42,15.57]],'i','body',true);
for (const y of [.25,1.25,2.25]) face([[3,y,15.78],[3.6,y,16.1],[3.6,y+.63,16.1],[3,y+.63,15.78]],'h','body',true);

// Eight-sided canopy with outward-facing glass, narrow mullions and a glazed roof.
const lower=[[-9,-3.6],[-7.2,-5.6],[3.9,-5.6],[7.5,-3.55],[7.5,3.55],[3.9,5.6],[-7.2,5.6],[-9,3.6]].map(([x,y])=>[x,y,12.95]);
const upper=[[-7.15,-3],[-5.7,-4.7],[1.35,-4.7],[3.05,-3],[3.05,3],[1.35,4.7],[-5.7,4.7],[-7.15,3]].map(([x,y])=>[x,y,22.92]);
const inner=upper.map(([x,y,z])=>[-2+(x+2)*.86,y*.83,z+.28]);
for (let i=0;i<8;i++) {
  const j=(i+1)%8;
  outside([lower[i],lower[j],upper[j],upper[i]],[-2,0,17],['G','F','G','H','G','F','G','F'][i]);
  rod(lower[i],upper[i],i%2===0?.22:.27,alloy,5);
  face([upper[i],upper[j],inner[j],inner[i]],'c');
}
face(inner,'F');
box(-6.55,-4.2,-3.3,3.3,23.22,23.49,cream);
topMark(-6.18,-4.58,-2.55,2.55,23.5,'b');
for (const y of [-1.8,-.65,.5,1.65]) topMark(-6.09,-4.67,y,y+.32,23.52,'t');
// Narrow reflections leave the pilot, console and the opposite window readable.
for (const i of [1,3,5]) {
  const j=(i+1)%8;
  const pane=(u,v)=>plus(plus(lower[i],mul(minus(lower[j],lower[i]),u*(1-v))),plus(mul(minus(upper[i],lower[i]),v),mul(minus(upper[j],upper[i]),u*v)));
  const delta=mul(unit(cross(minus(lower[j],lower[i]),minus(upper[i],lower[i]))),.025);
  outside([[.10,.74],[.55,.74],[.60,.80],[.15,.80]].map(([u,v])=>plus(pane(u,v),delta)),[-2,0,17],'S');
}
// Faceted nose fairing and twin work lamps sit clear of the rotating chuck.
sideProfile([[6.3,9],[12.6,8.4],[15,9.5],[13.6,12.15],[7.4,13.6],[6.3,12.3]],-4.9,4.9,cream);
for (const x of [8.6,9.8,11]) {
  const hood=(u,v)=>[u,v,13.64-(u-7.4)*1.45/6.2];
  face([hood(x,-3.25),hood(x+.57,-3.25),hood(x+.9,-.55),hood(x+.33,-.55)],'s');
}
for (const side of [-1,1]) {
  box(10.2,13,side*4.7,side*7.2,10.3,12.1,iron);
  xMark(13.04,side*4.98,side*6.9,10.62,11.83,'L');
}

// The chuck and the single-start screw are local to the spindle. Each flight has
// a dark underside, a pale cutting lip and a broad amber face that travels around the cone.
const polar=(x,r,a)=>[x,r*cosDeg(a),r*sinDeg(a)];
function barrel(x0,x1,r0,r1,colors,count=12) {
  const ring=(x,r)=>Array.from({length:count},(_,i)=>polar(x,r,i*360/count));
  prism(ring(x0,r0),ring(x1,r1),colors,'spindle');
}
barrel(-.9,2.5,3.25,4.2,iron);
barrel(1.15,2.28,4.27,4.27,alloy);
barrel(2.45,4.15,4.38,4.38,iron);
for (let a=0;a<360;a+=60) {
  face([polar(2.64,4.41,a),polar(3.78,4.41,a+2),polar(3.78,4.41,a+21),polar(2.64,4.41,a+19)],a===0?'i':'g','spindle',true);
}
barrel(4.06,18.7,4.4,.76,['b','n','s','k']);
const steps=58;
const flight=Array.from({length:steps+1},(_,i)=>{
  const t=i/steps, x=4.14+14.5*t, core=4.4-3.64*t, r=core+(.5+1.75*(1-t)), a=36+t*860;
  return [polar(x-.35,core-.15,a),polar(x-.28,r-.54,a),polar(x+.05,r,a),polar(x+.72,r-.20,a),polar(x+1.39,Math.max(.38,core-.46),a)];
});
for (let i=0;i<steps;i++) {
  for (const [j,color] of ['d','w','y','g'].entries()) {
    face([flight[i][j],flight[i+1][j],flight[i+1][j+1],flight[i][j+1]],color,'spindle',true);
  }
}
face(flight[0],'g','spindle',true);
face(flight.at(-1),'y','spindle',true);
barrel(18.55,20.85,1.12,.12,gold,6);

const slices=Array.from({length:8},(_,z)=>Array.from({length:9},(_,y)=>
  Array.from({length:24},(_,x)=>z>=4 && x>1 && x<22 && y>0 && y<8?'n':'.').join('')));
const source={ format:'pixelforge-stack', version:1, name:'seamrunner', projection:'iso', resolution:4,
  pivot:[15,4], headings:Array.from({length:96},(_,i)=>Math.round(315+(i+6)*360/96)%360),duration:50, palette, slices,
  sockets:{body:{at:[11.5,4.5,0]},spindle:{at:[24.6,4.5,8.5],axis:'x',keys:[{heading:0,angle:0},{heading:360,angle:1080}]}}, facets };
if (!process.argv[2]) throw Error('Supply a new .stack.json filename.');
await mkdir(dirname(process.argv[2]),{recursive:true});
await writeFile(process.argv[2],formatJSON(source,160),{flag:'wx'});
