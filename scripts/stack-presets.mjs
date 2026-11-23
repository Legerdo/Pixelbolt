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
// left to `ramps` and the light for its form. `cell: 1` puts them on a map's grid at the map's own pixel size: 16 cells
// are a 32x16 tile across, and a slice is a pixel high. Shapes come from whole-number rules, so every engine writes the
// same file.
const wood = { a:'#3d2420', b:'#5f372a', c:'#8a5236', d:'#b67646', e:'#dba262', f:'#f3d08f' };
const iron = { i:'#232a36', j:'#3d4a5c', k:'#667a8e', l:'#a2b6c2' };
const stone = { s:'#33333f', t:'#55566a', u:'#80829a', v:'#b3b6c6', x:'#e2e5ea' };
const turn = { projection:'iso', cell:1, headings:Array.from({length:16},(_,i)=>Math.round(i*22.5)), duration:120 };
const build = (w, h, levels, ink) => Array.from({length:levels},(_,z)=>Array.from({length:h},(_,y)=>
  Array.from({length:w},(_,x)=>ink(x,y,z)).join('')));
const save = (name, source) => writeFile(new URL(`../examples/${name}.stack.json`,import.meta.url),
  JSON.stringify({format:'pixelforge-stack',version:1,name,...source,...turn},null,2)+'\n');

// A crate: planks inside a frame of lighter boards, a diagonal brace painted on each side.
{
  const n=8, top=7, edge=v=>v===0||v===n-1;
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
  const n=8, top=10, wide=[22,30,38,43,46,46,46,43,38,30,22];
  const slices=build(n,n,top+1,(x,y,z)=>{
    const u=2*x-n+1, v=2*y-n+1, r=u*u+v*v, limit=wide[z]+18;
    if (r>limit) return '.';
    if (z===top) return r>limit-26?'d':'.';
    if (z===top-1 && r<=limit-26) return y===3?'b':'c';
    if (z===2||z===7) return 'k';
    const stave=Math.abs(u)>Math.abs(v)?y:x;
    return stave%3===1&&r>limit-30?'b':'c';
  });
  await save('iso-barrel',{palette:{...wood,...iron},ramps:['abcdef','ijkl'],slices});
}

// A pine: a trunk under three skirts of needles, each narrowing to the next and dark where the one above overhangs it.
{
  const n=17, top=38, green={ g:'#16382f', h:'#22573c', m:'#35804a', n:'#62a955', o:'#a5d070' };
  const tiers=[[7,17,62,5],[17,27,46,4],[27,37,30,3]], tier=z=>tiers.find(([from,to])=>z>=from&&z<to);
  const skirt=z=>{ const t=tier(z); return t?t[2]-(z-t[0])*t[3]:z===37?3:z===38?1:0; };
  const slices=build(n,n,top+1,(x,y,z)=>{
    const u=x-8, v=y-8, r=u*u+v*v;
    if (z<8 && r<=2) return 'c';
    if (z<7) return '.';
    const reach=skirt(z)+((u*3+v*5+z*7)%5===0?-4:0), under=tier(z)?.[0]===z&&z>7;
    return r<=reach ? (under||r>reach-9&&(u*7+v*3+z)%4===0?'h':'m') : '.';
  });
  await save('iso-pine',{palette:{...wood,...green},ramps:['abcdef','ghmno'],slices});
}

// A cottage: plaster walls on a stone footing under a pitched roof, with a door, windows and a chimney. Two tiles
// long and a tile and a half deep.
{
  const w=32, h=24, walls=13, top=walls+h/2-1;
  const palette={...wood, s:'#4b4a57', t:'#6f6e7c', u:'#9a99a3', v:'#c6c5c9', p:'#a89a80', q:'#d6c8a6', r:'#f1e7c9', x:'#f8f3e2',
    1:'#5a2430', 2:'#8a2f36', 3:'#bb4a3c', 4:'#e07a4e', 5:'#f3a964', w:'#263b52', y:'#4a7896', z:'#9fd0d8', G:'#ffd76a'};
  const slices=build(w,h,top+3,(x,y,z)=>{
    if (x>=22&&x<=24&&y>=6&&y<=8) return z===top+2?'t':z>=top?'u':z%3===0?'t':'u';
    if (z>top) return '.';
    if (z<walls) {
      if (x<1||x>w-2||y<1||y>h-2) return '.';
      const shell=x===1||x===w-2||y===1||y===h-2;
      if (!shell) return z===0?'b':'.';
      if (z<3) return (x+y+z*2)%5===0?'t':'u';
      const post=(x===1||x===w-2)&&(y===1||y===h-2);
      return post||z===walls-1?'c':'q';
    }
    const rise=z-walls, inset=rise;            // the roof climbs a cell for every cell it steps in from the eaves
    if (y<inset||y>h-1-inset) return '.';
    if (y===inset||y===h-1-inset) return (x+rise*2)%4===0?'2':'3';
    if (x===0||x===w-1) return '.';
    return x===1||x===w-2 ? 'q' : '.';
  });
  const door=['cccccc','cddddc','cddddc','cddddc','cddddc','cdddGc','cddddc','cddddc','cddddc','cddddc'];
  const pane=['ccccc','cyzyc','cyyyc','ccccc','cyyzc','cyyyc','ccccc'], sill=top+2-walls;
  await save('iso-cottage',{palette,ramps:['abcdef','stuv','pqrx','12345','wyz'],slices,decals:{door,pane},paint:[
    {face:'south',at:[13,sill+3],decal:'door'},{face:'south',at:[4,sill+2],decal:'pane'},{face:'south',at:[23,sill+2],decal:'pane'},
    {face:'north',at:[7,sill+2],decal:'pane'},{face:'north',at:[20,sill+2],decal:'pane'},
    {face:'east',at:[9,sill+2],decal:'pane'},{face:'west',at:[10,sill+2],decal:'pane'}]});
}

// A watchtower: a round stone shaft with courses of darker blocks, a walkway that steps out and a parapet of merlons.
// One tile across.
{
  const n=16, top=35;
  const slices=build(n,n,top+1,(x,y,z)=>{
    const u=2*x-n+1, v=2*y-n+1, r=u*u+v*v, shaft=z<4?196:z<28?148:250;
    if (r>shaft) return '.';
    if (z>=33) {
      if (r<=122) return '.';
      const a=Math.abs(u), b=Math.abs(v);                            // eight merlons, on the axes and the diagonals
      return z===33||11*b<3*a||11*a<3*b||11*Math.abs(a-b)<3*(a+b)?'u':'.';
    }
    if (z>=31) return r<=122?(z===31?'s':'.'):'u';
    if (z>=28) return z===28?'t':'u';
    if (z<4) return 't';
    const course=z%4===3, joint=(Math.abs(u)>Math.abs(v)?y:x)+(z>>2)*2;
    return course||joint%4===0&&r>100?'t':'u';
  });
  const gate=['.bb.','bccb','bccb','bccb','bccb','bccb','bccb'], slit=['s','s','s','s'];
  await save('iso-tower',{palette:{...wood,...stone},ramps:['abcdef','stuvx'],slices,decals:{gate,slit},paint:[
    {face:'south',at:[6,top-6],decal:'gate',depth:1},{face:'south',at:[7,12],decal:'slit'},{face:'east',at:[7,15],decal:'slit'},
    {face:'west',at:[8,15],decal:'slit'},{face:'north',at:[8,12],decal:'slit'}]});
}

// A wall: a length of battlement that fills one tile from edge to edge, so pieces set on neighbouring cells join into
// one wall along the map's x axis, or along y at headings 90 and 270.
{
  const n=16, top=19, from=5, to=10;
  const slices=build(n,n,top+1,(x,y,z)=>{
    if (y<from||y>to) return '.';
    const face=y===from||y===to;
    if (z>=17) return face&&(z===17||x%4<2)?'u':'.';
    if (z===16) return face?'u':'s';
    if (z<3) return 't';
    return z%4===3||(x+(z>>2)*2)%4===0&&face?'t':'u';
  });
  await save('iso-wall',{palette:stone,ramps:['stuvx'],slices});
}

// The moving starters: the same kind of thing with parts that ride sockets, and animations that key those sockets by
// frame. Each is baked for eight headings, so a game has every animation from every side.
const eight = Array.from({length:8},(_,i)=>i*45);
const move = (name, source) => writeFile(new URL(`../examples/${name}.stack.json`,import.meta.url),
  JSON.stringify({format:'pixelforge-stack',version:1,name,projection:'iso',cell:1,...source},null,2)+'\n');

// A windmill: a tapering stone tower under a shingled cap, with four sails on a shaft that turn about it.
{
  const n=16, body=24, top=body+6, cloth={ p:'#8f8468', q:'#c9bd9a', r:'#efe6c8' }, roof={ 1:'#5a2430', 2:'#8a2f36', 3:'#bb4a3c', 4:'#e07a4e' };
  const slices=build(n,n,top+1,(x,y,z)=>{
    const u=2*x-n+1, v=2*y-n+1, r=u*u+v*v;
    if (z<body) {
      if (r>226-z*5) return '.';                // the tower narrows as it rises
      if (z<2) return 't';
      return (x*3+y*5+z*7)%13===0?'t':'u';
    }
    const rise=z-body, d=13-2*rise;             // the cap: a cone of shingles with eaves past the wall
    return r<=d*d+1 ? (rise%2?'2':'3') : '.';
  });
  // The sails are one slab in the plane the shaft turns it in: four arms, each a spar with a lattice of cloth behind it.
  const span=27, mid=13;
  const arm=(a,b)=>{                            // a along the arm from the hub, b across it
    if (a<=1&&Math.abs(b)<=1) return 'b';       // the hub
    if (b===0&&a<=mid) return 'b';              // the spar
    if (a>=4&&a<=mid&&b>=1&&b<=4) return (a%3===1||b===4||a===mid)?'c':'q';   // cloth between battens
    return '.';
  };
  const sails=Array.from({length:span},(_,z)=>[Array.from({length:span},(_,x)=>{
    const u=x-mid, w=z-mid;
    for (const [a,b] of [[u,w],[w,-u],[-u,-w],[-w,u]]) { const ink=a>=0?arm(a,b):'.'; if (ink!=='.') return ink; }
    return '.';
  }).join('')]);
  const door=['bbbb','bccb','bccb','bccb','bccb','bccb'], pane=['bbb','byb','byb','bbb'];
  await move('iso-windmill',{ palette:{...wood,...stone,...cloth,...roof,y:'#4a7896'}, ramps:['abcdef','stuvx','pqr','1234'],
    slices, headings:eight, duration:120, decals:{door,pane},
    paint:[{face:'east',at:[6,body-6],decal:'door',depth:1},{face:'west',at:[6,body-14],decal:'pane'},{face:'north',at:[6,body-15],decal:'pane'},{face:'east',at:[7,body-18],decal:'pane'}],
    sockets:{ shaft:{ at:[8,15.5,20], axis:'y' } },
    parts:{ sails:{ socket:'shaft', at:[-span/2,-.5,-span/2], slices:sails } },
    animations:{ spin:{ frames:8, duration:120, sockets:{ shaft:[{frame:0,angle:0},{frame:8,angle:90}] } } } });
}

// A chest: iron-bound planks with a lid on a hinge along its back, and coins under it.
{
  const w=12, h=8, walls=6, gold={ G:'#a8641e', H:'#e0a030', I:'#ffd76a', J:'#fff3b0' };
  const edge=(v,n)=>v===0||v===n-1;
  const slices=build(w,h,walls,(x,y,z)=>{
    const shell=edge(x,w)||edge(y,h)||z===0;
    if (!shell) return z<walls-2 ? ((x*5+y*3+z)%4===0?'I':'H') : z===walls-2&&(x*3+y*7)%5<2?'I':'.';   // a heap of coins
    if ((x===2||x===w-3)&&(edge(y,h)||z===0)) return 'k';       // two iron straps
    if (Number(edge(x,w))+Number(edge(y,h))+Number(z===0)>=2) return 'k';
    return (z%3===2)?'b':'c';
  });
  const lid=build(w,h,3,(x,y,z)=>{
    const inside=!edge(x,w)&&!edge(y,h)&&z<2;
    if (inside) return '.';
    if (x===2||x===w-3) return 'k';
    if (z===2&&(edge(x,w)||edge(y,h))) return '.';              // rounded shoulders
    if (Number(edge(x,w))+Number(edge(y,h))>=2) return 'k';
    return (y%3===1)?'b':'c';
  });
  const lock=['kk','kl'];
  await move('iso-chest',{ palette:{...wood,...iron,...gold}, ramps:['abcdef','ijkl','GHIJ'],
    slices, headings:eight, duration:120, decals:{lock},
    sockets:{ hinge:{ at:[0,0,walls], axis:'x' } },
    parts:{ lid:{ socket:'hinge', at:[0,0,0], slices:lid, paint:[{face:'south',at:[5,1],decal:'lock'}] } },
    animations:{ open:{ frames:6, loop:false, durations:[90,70,70,70,90,300],
      sockets:{ hinge:[{frame:0,angle:0},{frame:4,angle:112,ease:'out'},{frame:5,angle:104}] } } } });
}

// A villager: a body that dips as he steps, and legs and arms that swing from the hips and shoulders.
{
  const skin={ m:'#8a4b3a', n:'#c9795a', o:'#f0b088', p:'#ffd9b8' }, tunic={ 1:'#1d3557', 2:'#2f5f9a', 3:'#5a92d0', 4:'#a8cdf0' }, hair={ g:'#38241c', h:'#4a2e22', H:'#6b4630' };
  // The body: a tunic four wide and three deep under a head six across, facing +y.
  const body=build(6,5,10,(x,y,z)=>{
    if (z<5) return x>=1&&x<=4&&y>=1&&y<=3 ? (z===0?'1':z===1?'d':'2') : '.';   // tunic, with a hem and a belt
    if (z===9) return 'h';                                                       // hair on top,
    if (y===0||(z>=8&&y<=2&&(x===0||x===5))||(z===8&&y===4)) return 'h';         // behind, at the temples and as a fringe
    return 'o';
  });
  const leg=build(2,2,5,(x,y,z)=>z<1?'a':'c');                                    // boots under trousers
  const arm=build(1,2,5,(x,y,z)=>z<1?'o':'2');                                    // a hand under a sleeve
  const face=['k..k'];
  const dip=[0,0,-1,0,0,0,-1,0,0], wave=[0,.7,1,.7,0,-.7,-1,-.7,0];
  const swing=(side,most)=>wave.map((v,f)=>({frame:f,angle:Math.round(side*most*v),offset:[0,0,dip[f]]}));
  const still=wave.map((_,f)=>({frame:f,offset:[0,0,dip[f]]}));
  const breath=[{frame:0},{frame:1,offset:[0,0,-1],ease:'hold'},{frame:2,ease:'hold'}];
  await move('iso-villager',{ palette:{...wood,...skin,...tunic,...hair,k:'#18202c'}, ramps:['abcdef','mnop','1234','ghH'],
    slices:[Array(10).fill('..........')], headings:eight, duration:140, decals:{face},
    directions:{ sw:0, w:45, nw:90, n:135, ne:180, e:225, se:270, s:315 },
    sockets:{ body:{at:[5,5,5]}, hipL:{at:[4,5,5],axis:'x'}, hipR:{at:[6,5,5],axis:'x'}, shoulderL:{at:[2.5,5,9.5],axis:'x'}, shoulderR:{at:[7.5,5,9.5],axis:'x'} },
    parts:{
      body:{ socket:'body', at:[-3,-2.5,0], slices:body, paint:[{face:'south',at:[1,3],decal:'face'}] },
      legL:{ socket:'hipL', at:[-1,-1,-5], slices:leg }, legR:{ socket:'hipR', at:[-1,-1,-5], slices:leg },
      armL:{ socket:'shoulderL', at:[-.5,-1,-4.5], slices:arm }, armR:{ socket:'shoulderR', at:[-.5,-1,-4.5], slices:arm } },
    animations:{
      walk:{ frames:8, duration:100, sockets:{ body:still, hipL:swing(1,32), hipR:swing(-1,32), shoulderL:swing(-1,26), shoulderR:swing(1,26) } },
      idle:{ frames:2, durations:[720,240], sockets:{ body:breath, shoulderL:breath, shoulderR:breath } } } });
}

// A cannon on a stone emplacement: the gun swivels on its carriage to scan, and kicks back when it fires.
{
  const n=16, drum=3, brass={ B:'#5a3a1c', C:'#9a6a2a', D:'#d0a040', E:'#f6dc84' };
  const slices=build(n,n,drum+1,(x,y,z)=>{
    const u=2*x-n+1, v=2*y-n+1, r=u*u+v*v;
    if (r>226) return '.';
    if (z===drum) return r>146 ? 'u' : '.';                     // a low rim round
    if (z===drum-1) return r>146?'u':(x+y)%4===0?'b':'c';        // a plank floor
    return z<1?'t':(x*3+y*5+z*7)%11===0?'t':'u';
  });
  // The gun: a wooden carriage on two wheels, and a barrel along +y that swells at the breech and the muzzle.
  const gun=build(8,14,7,(x,y,z)=>{
    const across=2*x-7, up=2*z-8, bore=across*across+up*up;      // doubled distances from the barrel's line
    const girth=y===13||y===12||y<=2?20:y<=5?13:10;
    if (y>=1&&bore<=girth) return y===13&&bore<=4?'i':(y===11||y===3)?'C':'D';
    if (z<=2&&y>=2&&y<=9&&(x===2||x===5)) return 'c';            // the carriage's two cheeks
    if (z===0&&y>=2&&y<=9&&x>=2&&x<=5) return 'b';               // and its bed
    if ((x<=1||x>=6)&&(2*y-9)*(2*y-9)+(2*z-4)*(2*z-4)<=26) return (2*y-9)*(2*y-9)+(2*z-4)*(2*z-4)<=2?'k':'b';   // a wheel each side
    return '.';
  });
  await move('iso-cannon',{ palette:{...wood,...iron,...stone,...brass}, ramps:['abcdef','ijkl','stuvx','BCDE'],
    slices, headings:eight, duration:120,
    sockets:{ swivel:{ at:[8,8,drum] } },
    parts:{ gun:{ socket:'swivel', at:[-4,-6,0], slices:gun } },
    animations:{
      scan:{ frames:8, duration:120, sockets:{ swivel:[{frame:0,angle:0},{frame:2,angle:40,ease:'out'},{frame:6,angle:-40,ease:'inOut'},{frame:8,angle:0,ease:'in'}] } },
      fire:{ frames:5, loop:false, durations:[60,60,90,120,200], sockets:{ swivel:[{frame:0},{frame:1,offset:[0,-3,0],ease:'out'},{frame:4,ease:'inOut'}] } } } });
}
