// Paint the exposed side of a stack in source coordinates. A drag is one sparse brush stroke
// in the JSON editor and uses its existing validation, draft recovery and save path.
import { stackSide } from '/stack.js';
import { parseColor } from '/core.js';
import { traceLine } from '/craft.js';
import { $ } from '/page.js';

export function stackEditor(seek) {
  const panel = $('stack-tools'), canvas = $('stack-side'), ctx = canvas.getContext('2d');
  const face = $('stack-face'), ink = $('stack-ink'), depth = $('stack-depth'), slider = $('stack-heading');
  let source, sourceText, rows, stroke, cursor = [0, 0], headingNames = [];
  function draw() {
    rows = stackSide(source, face.value);
    canvas.width = rows[0].length; canvas.height = rows.length;
    const colors = Object.fromEntries(Object.entries(source.palette).map(([key, hex]) => [key, parseColor(hex)]));
    const data = ctx.createImageData(canvas.width, canvas.height);
    rows.forEach((row, y) => [...row].forEach((key, x) => {
      if (colors[key]) data.data.set(colors[key], (y*canvas.width+x)*4);
    }));
    ctx.putImageData(data, 0, 0);
  }
  function mark(x, y) {
    if (x<0 || x>=canvas.width || y<0 || y>=canvas.height || rows[y][x]==='.') return;
    stroke.points.add(y*canvas.width+x);
    ctx.fillStyle = source.palette[stroke.ink]; ctx.fillRect(x,y,1,1);
  }
  function begin() {
    // While a JSON edit is pending, the canvas still belongs to the last compiled source.
    if ($('source').value !== sourceText || !depth.reportValidity()) return false;
    stroke = { points: new Set(), ink: ink.value, face: face.value, depth: Number(depth.value) };
    return true;
  }
  function finish() {
    const edit = stroke; stroke = null;
    const editor = $('source');
    if (!edit || !edit.points.size || editor.value !== sourceText || !source) return;
    const points = [...edit.points].map(at => [at % canvas.width, Math.floor(at / canvas.width)]);
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    const grid = Array.from({ length: Math.max(...ys) - y + 1 }, () => Array(Math.max(...xs) - x + 1).fill('.'));
    for (const [px, py] of points) grid[py - y][px - x] = edit.ink;
    const value = JSON.parse(editor.value.replace(/^\uFEFF/, ''));
    (value.paint ??= []).push({ face: edit.face, at: [x, y], rows: grid.map(row => row.join('')), depth: edit.depth });
    source = { ...source, paint: value.paint };
    sourceText = editor.value = JSON.stringify(value, null, 2);
    editor.dispatchEvent(new Event('input'));
  }
  function cell(event) {
    const box = canvas.getBoundingClientRect();
    return [Math.floor((event.clientX - box.left) * canvas.width / box.width),
      Math.floor((event.clientY - box.top) * canvas.height / box.height)];
  }
  canvas.onpointerdown = event => {
    if (!source || stroke || event.button !== 0 || !begin()) return;
    canvas.setPointerCapture(event.pointerId); cursor = cell(event); mark(...cursor);
  };
  canvas.onpointermove = event => {
    if (!stroke || !canvas.hasPointerCapture(event.pointerId)) return;
    const next=cell(event).map((v,i)=>Math.max(0, Math.min(v,(i?canvas.height:canvas.width)-1)));
    traceLine(...cursor,...next,mark); cursor=next;
  };
  canvas.onpointerup = event => { if (canvas.hasPointerCapture(event.pointerId)) finish(); };
  canvas.onpointercancel = () => { stroke=null; if(source) draw(); };
  canvas.onkeydown = event => {
    const delta = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] }[event.key];
    if (!source || (!delta && event.key!==' ')) return;
    event.preventDefault();
    if (delta) cursor=cursor.map((v,i)=>Math.max(0, Math.min(v+delta[i],(i?canvas.height:canvas.width)-1)));
    else if (!stroke && begin()) { mark(...cursor); finish(); }
    $('stack-cell').textContent=cursor.join(', ');
  };
  face.onchange = () => { stroke=null; cursor=[0,0]; draw(); };
  slider.oninput = () => seek(Number(slider.value));
  return {
    update(value, names = []) {
      source = value; sourceText = $('source').value;
      stroke = null; panel.hidden = !source;
      if (!source) return;
      headingNames=names; slider.max=String(names.length-1);
      const old=ink.value;
      ink.replaceChildren(...Object.entries(source.palette).map(([key,hex])=>new Option(`${key} · ${hex}`,key)));
      if (Object.hasOwn(source.palette,old)) ink.value=old;
      draw();
    },
    heading(index) {
      if (!source) return;
      slider.value=String(index); $('stack-angle').textContent=headingNames[index]?.replace('heading-','')+'°';
    }
  };
}
