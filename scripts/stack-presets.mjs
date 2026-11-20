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
const paint=['north','south'].flatMap(face=>[12,42].map(center=>({face,at:[center-3,7],rows:hub})));
const source={format:'pixelforge-stack',version:1,name:'copper-rally',palette,pivot:[27,14],squash:.60,
  headings:Array.from({length:60},(_,i)=>(30+i*6)%360),duration:70,slices,paint};
await writeFile(new URL('../examples/copper-rally.stack.json',import.meta.url), JSON.stringify(source,null,2)+'\n');
