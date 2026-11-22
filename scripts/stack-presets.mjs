// Draw the rally car as horizontal cuts through its chassis, tires, glazing and spoiler.
// Hub artwork is painted straight onto the two outward-facing sidewalls.
import { writeFile } from 'node:fs/promises';

const palette = { k:'#18202c', t:'#2a2b36', q:'#474651', m:'#819298', c:'#b9cbc7', l:'#e0e9d9', w:'#fff1c9', h:'#ffe593',
  o:'#ffb557', a:'#f78348', r:'#de5541', b:'#a33c3a', d:'#703039', g:'#183a49', v:'#285868', u:'#3f8391', i:'#8ac7c3', e:'#ff4351' };
function section(x, y, z) {
  const side = Math.abs(y), wheel = Math.min(Math.abs(x-15), Math.abs(x+15));
  const radius = wheel*wheel + (z-4.6)**2;
  let ink = side <= 9 && Math.abs(x) <= 19 && z >= 1 && z <= 3 ? 't' : '.';
  if (side >= 9 && side <= 12 && radius <= 23) ink = 'k';
  if (z >= 3 && z <= 9) {
    const nose = [23,25,26,26,26,25,23][z-3], tail = [-23,-25,-26,-26,-25,-24,-23][z-3];
    const edge = (z <= 4 || z === 9 ? 11 : 12) - Math.floor(Math.max(0, Math.abs(x)-20)/2);
    if (x >= tail && x <= nose && side <= edge && !(side >= 9 && radius <= 29)) {
      ink = ['k','d','b','r','a','a','o'][z-3];
      if (z === 5 && Math.abs(x)<10 && side >= edge-1) ink='w';
      if (z >= 7 && side >= edge-1) ink=y>0?'r':'a';
      if (x <= -24 && (z === 6 || z === 7)) ink=side>=3 && side<edge?'e':'k';
      if (x >= 24 && (z === 6 || z === 7)) ink=side>=4?'w':'k';
      if (x >= 24 && z<=5 && side<6) ink='k';
      if (z >= 8 && y>=-4 && y<=-2) ink='w';
      if (z >= 8 && y===1) ink='r';
      if (z === 9 && x<=-16 && x>=-22 && side<=6 && x%3===0) ink='d';
      if (z === 9 && (x-16)**2+(y-5)**2<=11) ink='w';
      if (z === 9 && ((y===3 && x>=15 && x<=17) || (x===16 && y>=4 && y<=7))) ink='g';
    }
  }
  if (z >= 9) {
    const rear=[-17,-16,-15,-13,-11,-9][z-9], front=[12,11,9,7,5,3][z-9], edge=10-Math.floor((z-9)/2);
    if (x>=rear && x<=front && side<=edge-Number(x===rear || x===front)) {
      ink = y>0?'v':'u';
      if (side>=edge-1 || x<=rear+1) ink=y>0?'g':'v';
      if (side>=edge-1 && (x===-4 || x===-3 || x===front || x===rear)) ink='b';
      if (x>=front-1 && y>=-6 && y<=-4) ink='i';
      if (z===9) ink='g';
      if ((z===13 && side<edge && x>rear && x<front) || z===14) {
        ink=side>=edge-1?'a':'o';
        if (y>=-4 && y<=-2) ink='w';
        if (y===1) ink='r';
      }
    }
  }
  if ((z===9 || z===10) && (x===-23 || x===-22) && (side===6 || side===7)) ink='k';
  if (z===11 && x>=-25 && x<=-23 && side<=11) ink=x===-25?'d':y>=-4&&y<=-2?'w':'r';
  if (z===10 && x>=4 && x<=6 && side>=10 && side<=13) ink=x===6?'w':'r';
  return ink;
}
const slices=Array.from({length:15},(_,z)=>Array.from({length:29},(_,y)=>
  Array.from({length:55},(_,x)=>section(x-27,y-14,z)).join('')));
const hub=['..mmm..','.mcccm.','mcclccm','mcllmcm','mccmccm','.mcccm.','..mmm..'];
const paint=['north','south'].flatMap(face=>[12,42].map(center=>({face,at:[center-3,7],decal:'hub'})));
const source={format:'pixelforge-stack',version:1,name:'copper-rally',palette,pivot:[27,14],squash:.60,
  headings:Array.from({length:60},(_,i)=>(30+i*6)%360),duration:70,slices,decals:{hub},paint};
await writeFile(new URL('../examples/copper-rally.stack.json',import.meta.url), JSON.stringify(source,null,2)+'\n');

// The isometric starters: small things a game's map stands on its tiles, each drawn in one base tone per material and
// left to `ramps` and the light for its form. Shapes come from whole-number rules, so every engine writes the same file.
const wood = { a:'#3d2420', b:'#5f372a', c:'#8a5236', d:'#b67646', e:'#dba262', f:'#f3d08f' };
const iron = { i:'#232a36', j:'#3d4a5c', k:'#667a8e', l:'#a2b6c2' };
const turn = { projection:'iso', resolution:4, headings:Array.from({length:16},(_,i)=>Math.round(i*22.5)), duration:120 };
const build = (w, h, levels, ink) => Array.from({length:levels},(_,z)=>Array.from({length:h},(_,y)=>
  Array.from({length:w},(_,x)=>ink(x,y,z)).join('')));
const save = (name, source) => writeFile(new URL(`../examples/${name}.stack.json`,import.meta.url),
  JSON.stringify({format:'pixelforge-stack',version:1,name,...source,...turn},null,2)+'\n');

// A crate: planks inside a frame of lighter boards, a diagonal brace painted on each side.
{
  const n=12, top=10, edge=v=>v===0||v===n-1;
  const slices=build(n,n,top+1,(x,y,z)=>{
    const rim=Number(edge(x))+Number(edge(y))+Number(z===0||z===top);
    if (rim>=2) return 'd';
    if (z===top) return x%4===3?'b':'c';
    if (!edge(x)&&!edge(y)) return 'c';
    return z%4===1?'b':'c';
  });
  const brace=Array.from({length:top-1},(_,v)=>Array.from({length:n-2},(_,u)=>Math.abs(u-Math.round(v*(n-3)/(top-2)))<=1?'d':'.').join(''));
  await save('iso-crate',{palette:wood,ramps:['abcdef'],slices,decals:{brace},
    paint:['south','north'].map(face=>({face,at:[1,1],decal:'brace'})).concat(['east','west'].map(face=>({face,at:[1,1],decal:'brace',flipX:true})))});
}

// A barrel: staves that swell at the waist, two iron hoops and a lid set a step below the rim.
{
  const n=14, top=15, wide=[20,24,30,36,40,43,45,46,46,45,43,40,36,30,24,20];
  const slices=build(n,n,top+1,(x,y,z)=>{
    const u=2*x-n+1, v=2*y-n+1, r=u*u+v*v, limit=wide[z]*4+16;
    if (r>limit) return '.';
    if (z===top) return r>limit-56?'d':'.';
    if (z===top-1 && r<=limit-56) return y===6?'b':'c';
    if (z===3||z===4||z===11||z===12) return 'k';
    const stave=Math.abs(u)>Math.abs(v)?y:x;
    return stave%3===1&&r>limit-64?'b':'c';
  });
  await save('iso-barrel',{palette:{...wood,...iron},ramps:['abcdef','ijkl'],slices});
}

// A pine: a trunk under three skirts of needles, each narrowing to the next and dark where the one above overhangs it.
{
  const n=17, top=27, green={ g:'#16382f', h:'#22573c', m:'#35804a', n:'#62a955', o:'#a5d070' };
  const tiers=[[5,12,62,7],[12,19,46,6],[19,26,30,4]], tier=z=>tiers.find(([from,to])=>z>=from&&z<to);
  const skirt=z=>{ const t=tier(z); return t?t[2]-(z-t[0])*t[3]:z===26?3:z===27?1:0; };
  const slices=build(n,n,top+1,(x,y,z)=>{
    const u=x-8, v=y-8, r=u*u+v*v;
    if (z<6 && r<=2) return 'c';
    if (z<5) return '.';
    const reach=skirt(z)+((u*3+v*5+z*7)%5===0?-4:0), under=tier(z)?.[0]===z&&z>5;
    return r<=reach ? (under||r>reach-9&&(u*7+v*3+z)%4===0?'h':'m') : '.';
  });
  await save('iso-pine',{palette:{...wood,...green},ramps:['abcdef','ghmno'],slices});
}

// A cottage: plaster walls on a stone footing under a pitched roof, with a door, windows and a chimney.
{
  const w=20, h=14, walls=9, top=17;
  const palette={...wood, s:'#4b4a57', t:'#6f6e7c', u:'#9a99a3', v:'#c6c5c9', p:'#a89a80', q:'#d6c8a6', r:'#f1e7c9', x:'#f8f3e2',
    1:'#5a2430', 2:'#8a2f36', 3:'#bb4a3c', 4:'#e07a4e', 5:'#f3a964', w:'#263b52', y:'#4a7896', z:'#9fd0d8', G:'#ffd76a'};
  const slices=build(w,h,top+1,(x,y,z)=>{
    const chimney=x>=14&&x<=15&&y>=3&&y<=4;
    if (chimney && z<=top) return z===top?'t':z>=top-1?'u':'t';
    if (z<walls) {
      if (x<1||x>w-2||y<1||y>h-2) return '.';
      const shell=x===1||x===w-2||y===1||y===h-2;
      if (!shell) return z===0?'b':'.';
      if (z<2) return (x+y+z)%4===0?'t':'u';
      const post=(x===1||x===w-2)&&(y===1||y===h-2);
      return post||z===walls-1?'c':'q';
    }
    const rise=z-walls, inset=rise;            // the roof climbs a cell for every cell it steps in from the eaves
    if (y<inset||y>h-1-inset) return '.';
    if (y===inset||y===h-1-inset||y===inset+1&&rise===Math.floor(h/2)-1) return (x+rise)%3===0?'2':'3';
    if (x===0||x===w-1) return '.';
    return x===1||x===w-2 ? 'q' : '.';
  });
  const door=['cccc','cddc','cddc','cdGc','cddc','cddc','cddc'], pane=['cccc','cyzc','cyyc','cccc'];
  await save('iso-cottage',{palette,ramps:['abcdef','stuv','pqrx','12345','wyz'],slices,decals:{door,pane},paint:[
    {face:'south',at:[8,top-walls+2],decal:'door'},{face:'south',at:[2,top-walls+3],decal:'pane'},{face:'south',at:[14,top-walls+3],decal:'pane'},
    {face:'north',at:[4,top-walls+3],decal:'pane'},{face:'north',at:[12,top-walls+3],decal:'pane'},
    {face:'east',at:[5,top-walls+3],decal:'pane'},{face:'west',at:[5,top-walls+3],decal:'pane'}]});
}

// A watchtower: a round stone shaft with courses of darker blocks, a walkway that steps out and a parapet of merlons.
{
  const n=16, top=25, stone={ s:'#33333f', t:'#55566a', u:'#80829a', v:'#b3b6c6', x:'#e2e5ea' };
  const slices=build(n,n,top+1,(x,y,z)=>{
    const u=2*x-n+1, v=2*y-n+1, r=u*u+v*v, shaft=z<3?196:z<20?148:250;
    if (r>shaft) return '.';
    if (z>=23) {
      if (r<=122) return '.';
      const a=Math.abs(u), b=Math.abs(v);                            // eight merlons, on the axes and the diagonals
      return z===23||11*b<3*a||11*a<3*b||11*Math.abs(a-b)<3*(a+b)?'u':'.';
    }
    if (z===22) return r<=122?'s':'u';
    if (z>=20) return z===20?'t':'u';
    if (z<3) return 't';
    const course=z%4===3, joint=(Math.abs(u)>Math.abs(v)?y:x)+(z>>2)*2;
    return course||joint%4===0&&r>100?'t':'u';
  });
  const gate=['.bb.','bccb','bccb','bccb','bccb'], slit=['s','s','s'];
  await save('iso-tower',{palette:{...wood,...stone},ramps:['abcdef','stuvx'],slices,decals:{gate,slit},paint:[
    {face:'south',at:[6,top-4],decal:'gate',depth:1},{face:'south',at:[7,9],decal:'slit'},{face:'east',at:[7,11],decal:'slit'},
    {face:'west',at:[8,11],decal:'slit'},{face:'north',at:[8,9],decal:'slit'}]});
}
