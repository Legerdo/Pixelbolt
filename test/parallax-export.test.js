// A scene's parallax and haze in its exports: each Tiled layer carries its plane's parallax, hazed placements draw from
// hazed copies of their sheets, and each plane is an image a Godot scene scrolls with Parallax2D. scripts/verify-tiled.mjs
// and scripts/verify-godot.mjs check the same scene in a real Tiled and Godot; these tests pin the files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { createSceneBundle } from '../src/scene-export.js';
import { writeBundle } from '../src/export.js';
import { startMCP } from '../src/mcp.js';
import { prepareScene, renderScene, scenePlanes, sceneHaze } from '../src/scene.js';
import { parallaxScene as godotScene } from '../src/godot.js';
import { decodePNG } from '../src/import.js';
import { parallaxScene, PARALLAX_CAMERAS } from '../scripts/parallax-scene.mjs';

const dot = color => ({ version: 1, name: 'dot', width: 2, height: 2, palette: { c: color }, frames: [{ name: 'a', ops: [{ op: 'rect', x: 0, y: 0, w: 2, h: 2, color: 'c' }] }] });

// Lays the planes on the background at a camera position, each moved by its parallax share of the camera in whole
// pixels, a half rounded down (23.5 moves 23), as docs/game-integration.md tells an engine to.
const share = (parallax, camera) => Math.ceil(parallax * camera - 0.5);
function layPlanes(scene, planes, camera) {
  const data = new Uint8ClampedArray(scene.width * scene.height * 4);
  for (let at = 0; at < data.length; at += 4) data.set(scene.background, at);
  for (const plane of planes) {
    const left = plane.at[0] - share(plane.parallax[0], camera[0]), top = plane.at[1] - share(plane.parallax[1], camera[1]);
    for (let y = 0; y < plane.height; y++) for (let x = 0; x < plane.width; x++) {
      const sx = left + x, sy = top + y, from = (y * plane.width + x) * 4, alpha = plane.data[from + 3] / 255;
      if (sx < 0 || sy < 0 || sx >= scene.width || sy >= scene.height || !alpha) continue;
      const to = (sy * scene.width + sx) * 4;
      for (let c = 0; c < 3; c++) data[to + c] = Math.round(plane.data[from + c] * alpha + data[to + c] * (1 - alpha));
    }
  }
  return data;
}

test('each layer of scene.tmx carries its plane\'s parallax, and the hills draw from their hazed tileset', async () => {
  const { files, warnings } = await createSceneBundle(await parallaxScene()), map = files.get('scene.tmx').toString();
  assert.deepEqual(warnings, []);
  assert.deepEqual(map.split('\n').filter(line => /^ <(layer|objectgroup|tileset) /.test(line)), [
    ' <tileset firstgid="1" source="assets/0/tileset.tsx"/>', ' <tileset firstgid="3" source="assets/1/tileset.tsx"/>', ' <tileset firstgid="163" source="assets/2/tileset.tsx"/>',
    ' <tileset firstgid="323" source="assets/3/tileset.tsx"/>', ' <tileset firstgid="329" source="assets/2/haze-0.6/tileset.tsx"/>',
    ' <objectgroup draworder="index" id="1" name="sun, cloud" parallaxx="0" parallaxy="0">',
    ' <layer id="2" name="hills" width="18" height="7" offsetx="-16" offsety="-8" parallaxx="0.5" parallaxy="0.5">',
    ' <layer id="3" name="ground" width="18" height="7" offsetx="-16" offsety="-8">',
    ' <objectgroup draworder="index" id="4" name="spirit">']);
  // The map keeps Tiled's parallax origin, which Tiled 1.11 reads the other way round from 1.8–1.10.
  assert.doesNotMatch(map, /parallaxorigin/);
  const cells = name => map.split(`name="${name}"`)[1].split('<data encoding="csv">\n')[1].split('\n</data>')[0].split(/,\n?/).map(Number).filter(Boolean);
  assert.ok(cells('hills').every(gid => gid >= 329 && gid < 489), 'hills: the hazed tileset');
  assert.ok(cells('ground').every(gid => gid >= 3 && gid < 163), 'ground: its own tileset');
  // The hazed copy: the same grid and terrains under its own name, over its own sheet beside it.
  const base = files.get('assets/2/tileset.tsx').toString(), hazed = files.get('assets/2/haze-0.6/tileset.tsx').toString();
  assert.equal(hazed, base.replace('name="hills" ', 'name="hills haze 0.6" '));
  assert.deepEqual(JSON.parse(files.get('alignment.json')).assets.hills.haze, [{ amount: 0.6, color: 'assets/2/haze-0.6/color.png', tiled: 'assets/2/haze-0.6/tileset.tsx', godot: 'assets/2/haze-0.6/sprite_frames.tres' }]);
  assert.equal(files.get('assets/2/haze-0.6/sprite_frames.tres').toString(), files.get('assets/2/sprite_frames.tres').toString());
});

test('a hazed sheet fades each colour as a whole, exactly as the scene draws it', async () => {
  const source = await parallaxScene(), scene = prepareScene(source), { files } = await createSceneBundle(source), haze = sceneHaze(scene);
  const base = decodePNG(files.get('assets/2/color.png')), hazed = decodePNG(files.get('assets/2/haze-0.6/color.png')), mapped = new Map();
  assert.deepEqual([hazed.width, hazed.height], [base.width, base.height]);
  let paler = 0;
  for (let at = 0; at < base.data.length; at += 4) {
    const from = [...base.data.subarray(at, at + 4)], to = [...hazed.data.subarray(at, at + 4)];
    assert.equal(to[3], from[3], 'alpha stays');
    if (!from[3]) continue;
    assert.deepEqual(to.slice(0, 3), haze(0.6, from), `pixel ${at / 4}`);
    // One colour in, one colour out.
    const key = from.join(), seen = mapped.get(key);
    assert.ok(!seen || seen === to.join());
    mapped.set(key, to.join());
    // Toward the haze colour, which is lighter than every colour of the hills.
    if (to.slice(0, 3).reduce((a, b) => a + b) > from.slice(0, 3).reduce((a, b) => a + b)) paler++;
  }
  assert.ok(paler > 0 && mapped.size > 4);
});

test('a scene\'s planes, laid on the background by their parallax, draw the unlit scene at every camera position', async () => {
  const source = await parallaxScene(), scene = prepareScene(source), start = renderScene(scene, { lit: false, draws: true });
  const { planes, shaded, oversized } = scenePlanes(scene, start.draws);
  assert.deepEqual([shaded, oversized], [[], []]);
  assert.deepEqual(planes.map(plane => [plane.parallax, plane.at, plane.width, plane.height, plane.instances.map(i => scene.instances[i].name)]), [
    [[0, 0], [14, 4], 136, 24, ['sun', 'cloud', 'cloud']], [[0.5, 0.5], [-16, 24], 240, 80, ['hills']], [[1, 1], [-16, 49], 288, 55, ['ground', 'spirit']]]);
  for (const camera of [...PARALLAX_CAMERAS, [17, 0], [33, 5]]) {
    const view = renderScene(prepareScene({ ...source, camera }), { lit: false });
    assert.deepEqual(layPlanes(scene, planes, camera), view.data, `camera at ${camera}`);
  }
  // The export writes them and says where each goes, but for the bobbing spirit, which scene.tscn plays on a sprite.
  const { files } = await createSceneBundle(source), alignment = JSON.parse(files.get('alignment.json'));
  const baked = scenePlanes(scene, start.draws.filter(draw => scene.instances[draw.instance].name !== 'spirit')).planes;
  assert.deepEqual(alignment.planes.map(plane => [plane.image, plane.parallax, plane.at, plane.size, plane.placements]), baked.map((plane, k) => [`planes/${k}.png`, plane.parallax, plane.at, [plane.width, plane.height], plane.instances.map(i => scene.instances[i].name)]));
  assert.deepEqual(alignment.planes.map(plane => plane.placements), [['sun', 'cloud', 'cloud'], ['hills'], ['ground']]);
  assert.deepEqual(decodePNG(files.get('planes/1.png')).data, planes[1].data);
  assert.deepEqual(decodePNG(files.get('planes/2.png')).data, baked[2].data);
});

test('planes are runs of draws on one plane: an attached placement rides its target\'s, and a shade placement is left out', async () => {
  const source = { format: 'pixelforge-scene', version: 1, name: 'runs', width: 16, height: 8, background: '#000000', camera: [0, 0], haze: { color: '#ffffff' },
    assets: { red: dot('#ff0000'), green: dot('#00ff00'), blue: dot('#0000ff') },
    instances: [
      { name: 'far', asset: 'red', at: [0, 0], parallax: 0.5, haze: 0.5 }, { name: 'pin', asset: 'blue', at: [2, 0], attach: { instance: 'far' } },
      { name: 'near', asset: 'green', at: [6, 2] }, { name: 'shadow', asset: 'green', at: [6, 4], shade: -1 }, { name: 'far2', asset: 'red', at: [10, 0], parallax: 0.5 },
      { name: 'wide', asset: 'blue', at: [12, 4], parallax: [2, 0] }
    ] };
  source.assets.green = { ...dot('#00ff00'), palette: { c: '#00ff00', d: '#008000' }, ramps: [['d', 'c']] };
  const scene = prepareScene(source), { draws } = renderScene(scene, { lit: false, draws: true }), result = scenePlanes(scene, draws);
  assert.deepEqual(result.planes.map(plane => [plane.parallax, plane.instances.map(i => scene.instances[i].name)]), [[[0.5, 0.5], ['far', 'pin']], [[1, 1], ['near']], [[0.5, 0.5], ['far2']], [[2, 0], ['wide']]]);
  assert.deepEqual(result.shaded, ['shadow']);
  // The far placement is hazed halfway to white; its pin is not.
  assert.deepEqual([...result.planes[0].data.subarray(0, 4)], [255, 128, 128, 255]);
  assert.deepEqual([...result.planes[0].data.subarray(8, 12)], [0, 0, 255, 255]);
  const map = (await createSceneBundle(source)).files.get('scene.tmx').toString();
  assert.deepEqual(map.split('\n').filter(line => / <objectgroup /.test(line)), [
    ' <objectgroup draworder="index" id="1" name="far, pin" parallaxx="0.5" parallaxy="0.5">', ' <objectgroup draworder="index" id="2" name="near">',
    ' <objectgroup draworder="index" id="3" name="far2" parallaxx="0.5" parallaxy="0.5">', ' <objectgroup draworder="index" id="4" name="wide" parallaxx="2" parallaxy="0">']);
});

test('scene.tscn scrolls each plane with a Parallax2D under a top-left camera at the camera\'s start', async () => {
  const source = await parallaxScene(), { files } = await createSceneBundle(source);
  assert.equal(JSON.parse(files.get('alignment.json')).godot, 'scene.tscn');
  assert.equal(files.get('scene.tscn').toString(), [
    '[gd_scene format=3]', '',
    '[ext_resource type="Texture2D" path="planes/0.png" id="1_plane"]', '[ext_resource type="Texture2D" path="planes/1.png" id="2_plane"]', '[ext_resource type="Texture2D" path="planes/2.png" id="3_plane"]',
    '[ext_resource type="SpriteFrames" path="assets/3/sprite_frames.tres" id="4_frames"]', '',
    '[node name="hills" type="Node2D"]', 'texture_filter = 1', '',
    '[node name="Camera2D" type="Camera2D" parent="."]', 'anchor_mode = 0', '',
    '[node name="Background" type="Parallax2D" parent="."]', 'scroll_scale = Vector2(0, 0)', '',
    '[node name="Color" type="ColorRect" parent="Background"]', 'offset_right = 160.0', 'offset_bottom = 96.0', 'color = Color(0.611765, 0.811765, 0.901961, 1)', '',
    '[node name="sun" type="Parallax2D" parent="."]', 'scroll_scale = Vector2(0, 0)', '',
    '[node name="Image" type="Sprite2D" parent="sun"]', 'position = Vector2(14, 4)', 'texture = ExtResource("1_plane")', 'centered = false', '',
    '[node name="hills" type="Parallax2D" parent="."]', 'scroll_scale = Vector2(0.5, 0.5)', '',
    '[node name="Image" type="Sprite2D" parent="hills"]', 'position = Vector2(-16, 24)', 'texture = ExtResource("2_plane")', 'centered = false', '',
    '[node name="ground" type="Parallax2D" parent="."]', '',
    '[node name="Image" type="Sprite2D" parent="ground"]', 'position = Vector2(-16, 56)', 'texture = ExtResource("3_plane")', 'centered = false', '',
    // The bobbing spirit is in no plane: it plays on its own sprite, after the ground.
    '[node name="spirit" type="Parallax2D" parent="."]', '',
    '[node name="Sprite" type="AnimatedSprite2D" parent="spirit"]', 'position = Vector2(32, 49)', 'sprite_frames = ExtResource("4_frames")', 'animation = &"bob"', 'autoplay = "bob"', 'centered = false', ''].join('\n'));
  // A camera that starts elsewhere starts the Camera2D there.
  const moved = (await createSceneBundle({ ...source, camera: [{ time: 0, at: [12, 3] }, { time: 3000, at: [96, 0] }] })).files.get('scene.tscn').toString();
  assert.match(moved, /\[node name="Camera2D" type="Camera2D" parent="\."\]\nposition = Vector2\(12, 3\)\nanchor_mode = 0\n/);
});

test('scene.tscn plays an animated placement on an AnimatedSprite2D, out of the planes; stills and moving placements stay baked', async () => {
  const frame = (name, x, color) => ({ name, duration: 100, ops: [{ op: 'pixel', x, y: 0, color }] });
  const two = (name, width, height, animation) => ({ version: 1, name, width, height, palette: { a: '#ff8000', b: '#ffe040' }, frames: [frame('f0', 0, 'a'), frame('f1', 1, 'b')], animations: { [animation]: { frames: ['f0', 'f1'] } } });
  const sky = { version: 1, name: 'sky', width: 32, height: 18, palette: { s: '#203040' }, frames: [{ name: 'sky', ops: [{ op: 'rect', x: 0, y: 0, w: 32, h: 18, color: 's' }] }], animations: {} };
  const source = { format: 'pixelforge-scene', version: 1, name: 'rainy', width: 32, height: 18, duration: 1000, background: '#000000', camera: [0, 0], haze: { color: '#ffffff' },
    assets: { sky, rain: two('rain', 32, 18, 'fall'), torch: two('torch', 2, 2, 'flicker'), walker: two('walker', 2, 2, 'step') },
    instances: [
      { name: 'backdrop', asset: 'sky', at: [0, 0] },
      { name: 'torch', asset: 'torch', animation: 'flicker', at: [4, 4], scale: 2, repeat: [2, 1], step: [8, 0], parallax: 0.5, haze: 0.5 },
      { name: 'walker', asset: 'walker', animation: 'step', at: [0, 12], trajectory: [{ time: 0, at: [0, 12] }, { time: 1000, at: [20, 12] }] },
      { name: 'rain', asset: 'rain', animation: 'fall', at: [0, 0], parallax: 0 }
    ] };
  const { files, warnings } = await createSceneBundle(source), alignment = JSON.parse(files.get('alignment.json')), tscn = files.get('scene.tscn').toString();
  // The torch and the rain play from their SpriteFrames (the torch's hazed copy), each copy of the torch a sprite.
  assert.deepEqual(alignment.sprites, [
    { placement: 'torch', frames: 'assets/2/haze-0.5/sprite_frames.tres', animation: 'flicker', parallax: [0.5, 0.5], scale: 2, at: [[4, 4], [12, 4]] },
    { placement: 'rain', frames: 'assets/1/sprite_frames.tres', animation: 'fall', parallax: [0, 0], scale: 1, at: [[0, 0]] }]);
  // The backdrop's plane is the backdrop alone; the walker, which moves, is baked as it is at the start, and said so.
  assert.deepEqual(alignment.planes.map(plane => plane.placements), [['backdrop'], ['walker']]);
  const backdrop = decodePNG(files.get(alignment.planes[0].image));
  assert.ok(backdrop.data.every((value, i) => value === [0x20, 0x30, 0x40, 255][i % 4]), 'no overlay pixel in the backdrop\'s plane');
  assert.deepEqual(warnings.filter(warning => warning.startsWith('scene.tscn')), ['scene.tscn: walker: shown as at the scene\'s start, since it moves, follows cues or changes anchor as the scene plays; animate it in Godot with its asset\'s sprite_frames.tres']);
  // Drawn in the scene's order: backdrop, torch, walker, then the rain over everything, on the screen (parallax 0).
  assert.deepEqual([...tscn.matchAll(/\[node name="([^"]+)" type="(Parallax2D|Sprite2D|AnimatedSprite2D)" parent="([^"]+)"\]/g)].map(m => `${m[3]}/${m[1]} ${m[2]}`),
    ['./Background Parallax2D', './backdrop Parallax2D', 'backdrop/Image Sprite2D', './torch Parallax2D', 'torch/Sprite AnimatedSprite2D', 'torch/Sprite 2 AnimatedSprite2D',
      './walker Parallax2D', 'walker/Image Sprite2D', './rain Parallax2D', 'rain/Sprite AnimatedSprite2D']);
  assert.ok(tscn.includes(['[node name="Sprite 2" type="AnimatedSprite2D" parent="torch"]', 'position = Vector2(12, 4)', 'scale = Vector2(2, 2)', 'sprite_frames = ExtResource("2_frames")', 'animation = &"flicker"', 'autoplay = "flicker"', 'centered = false'].join('\n')), tscn);
  assert.ok(tscn.includes(['[node name="rain" type="Parallax2D" parent="."]', 'scroll_scale = Vector2(0, 0)', '', '[node name="Sprite" type="AnimatedSprite2D" parent="rain"]', 'sprite_frames = ExtResource("4_frames")', 'animation = &"fall"'].join('\n')), tscn);
  assert.ok(tscn.includes('[ext_resource type="SpriteFrames" path="assets/2/haze-0.5/sprite_frames.tres" id="2_frames"]') && tscn.includes('[ext_resource type="SpriteFrames" path="assets/1/sprite_frames.tres" id="4_frames"]'), tscn);
  // The sheet's scale divides the placement's: a sheet drawn at 2 plays a scale-2 placement at 1.
  const doubled = await createSceneBundle({ ...source, assets: { ...source.assets, torch: { ...source.assets.torch, sheet: { scale: 2 } } } });
  assert.equal(JSON.parse(doubled.files.get('alignment.json')).sprites[0].scale, 1);
  assert.doesNotMatch(doubled.files.get('scene.tscn').toString(), /^scale = /m);
});

test('plane nodes take names Godot accepts, each its own among its siblings', () => {
  const plane = name => ({ name, image: 'p.png', at: [0, 0], parallax: [1, 1] });
  const text = godotScene({ name: 'a.b', width: 4, height: 4, background: [0, 0, 0, 255], camera: [0, 0], planes: ['sky', 'sky', 'Background', 'a/b:c@d"e%f', '  ', 'Camera2D'].map(plane) });
  assert.deepEqual([...text.matchAll(/\[node name="((?:[^"\\]|\\.)*)" type="(\w+)"( parent="(?:[^"\\]|\\.)*")?\]/g)].filter(m => m[2] === 'Parallax2D' || !m[3]).map(m => m[1]),
    ['a_b', 'Background', 'sky', 'sky 2', 'Background 2', 'a_b_c_d_e_f', 'plane', 'Camera2D 2']);
});

test('a plane\'s share of the camera rounds to whole pixels, a half down, as Godot draws it with snapping on', () => {
  const source = { format: 'pixelforge-scene', version: 1, name: 'halves', width: 16, height: 8, background: '#000000', camera: [7, -3],
    assets: { red: dot('#ff0000') }, instances: [{ name: 'far', asset: 'red', at: [8, 4], parallax: 0.5 }, { name: 'near', asset: 'red', at: [4, 4], parallax: [1.5, 0] }] };
  // far: 3.5 and -1.5, rounded to 3 and -2; near: 10.5 and none of the camera's rise, rounded to 10 and 0.
  const { draws } = renderScene(prepareScene(source), { lit: false, draws: true });
  assert.deepEqual(draws.map(draw => [draw.x, draw.y, ...draw.shift]), [[5, 6, 3, -2], [-6, 4, 10, 0]]);
  // A camera at [0, 0] shifts nothing, and by 0, not -0.
  assert.ok(renderScene(prepareScene({ ...source, camera: [0, 0] }), { draws: true }).draws.every(draw => Object.is(draw.shift[0], 0) && Object.is(draw.shift[1], 0)));
});

test('haze amounts alike to six decimals are one amount: one hazed copy, which the map and the renderer both use', async () => {
  const source = { format: 'pixelforge-scene', version: 1, name: 'close', width: 32, height: 8, background: '#000000', haze: { color: '#ffffff' }, camera: [0, 0],
    assets: { blue: dot('#2080ff') }, instances: [0.3, 0.1 + 0.2, 0.3000001, 0.3].map((haze, k) => ({ name: `p${k}`, asset: 'blue', at: [k * 4, 0], parallax: 0.5, haze })) };
  const scene = prepareScene(source);
  assert.deepEqual(scene.instances.map(instance => instance.haze), [0.3, 0.3, 0.3, 0.3]);
  const { files } = await createSceneBundle(source);
  assert.deepEqual(JSON.parse(files.get('alignment.json')).assets.blue.haze.map(copy => copy.amount), [0.3]);
  assert.deepEqual([...files.keys()].filter(file => file.includes('haze-')), ['assets/0/haze-0.3/color.png', 'assets/0/haze-0.3/tileset.tsx', 'assets/0/haze-0.3/sprite_frames.tres']);
  const map = files.get('scene.tmx').toString(), first = Number(map.match(/<tileset firstgid="(\d+)" source="assets\/0\/haze-0\.3\/tileset\.tsx"\/>/)[1]);
  assert.deepEqual([...map.matchAll(/<object [^>]*gid="(\d+)"/g)].map(match => Number(match[1])), [first, first, first, first]);
  const sheet = decodePNG(files.get('assets/0/haze-0.3/color.png')), at = sheet.data.findIndex((_, i) => i % 4 === 3 && sheet.data[i]) - 3, view = renderScene(scene, { lit: false });
  for (let k = 0; k < 4; k++) assert.deepEqual([...view.data.subarray(k * 16, k * 16 + 4)], [...sheet.data.subarray(at, at + 4)], `p${k}`);
});

test('a forced export over an earlier export of a scene removes the planes and copies that one wrote and this one doesn\'t, and nothing else', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pixelbolt-scene-force-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const scene = (instances, assets) => ({ format: 'pixelforge-scene', version: 1, name: 'again', width: 16, height: 8, background: '#000000', camera: [0, 0], haze: { color: '#ffffff' }, assets, instances });
  const colours = { red: dot('#ff0000'), green: dot('#00ff00') }, far = { name: 'far', asset: 'red', at: [0, 0], parallax: 0.5, haze: 0.5 }, near = { name: 'near', asset: 'green', at: [6, 2] };
  const before = await createSceneBundle(scene([far, near, { name: 'far2', asset: 'red', at: [10, 0], parallax: 0.5, haze: 0.25 }, { name: 'wide', asset: 'blue', at: [12, 4], parallax: [2, 0] }], { ...colours, blue: dot('#0000ff') }));
  await writeBundle(before, dir);
  assert.ok(['planes/3.png', 'assets/0/haze-0.25/color.png', 'assets/2/color.png'].every(file => existsSync(path.join(dir, file))));
  // Files of someone else's in the export's folders, one named as a plane is.
  await writeFile(path.join(dir, 'planes', '9.png'), 'mine');
  await writeFile(path.join(dir, 'planes', 'notes.txt'), 'mine');
  await writeFile(path.join(dir, 'assets', '0', 'haze-0.25', 'keep.png'), 'mine');
  const after = await createSceneBundle(scene([far, near], colours));
  await assert.rejects(writeBundle(after, dir), /Output already exists/);
  const written = await writeBundle(after, dir, { force: true });
  assert.deepEqual(written.removed.map(file => path.relative(dir, file).split(path.sep).join('/')), [
    'assets/0/haze-0.25/color.png', 'assets/0/haze-0.25/sprite_frames.tres', 'assets/0/haze-0.25/tileset.tsx',
    'assets/2/atlas.json', 'assets/2/color.png', 'assets/2/sprite_frames.tres', 'assets/2/tileset.tsx', 'planes/2.png', 'planes/3.png']);
  // The folder of the asset the scene dropped goes with its files; the one holding someone else's file stays.
  assert.equal(existsSync(path.join(dir, 'assets', '2')), false);
  assert.ok(['planes/9.png', 'planes/notes.txt', 'assets/0/haze-0.25/keep.png', 'planes/1.png', 'assets/0/haze-0.5/color.png'].every(file => existsSync(path.join(dir, file))));
  // An alignment.json Pixelbolt didn't write lists nothing to remove.
  await mkdir(path.join(dir, 'other', 'planes'), { recursive: true });
  await writeFile(path.join(dir, 'other', 'alignment.json'), JSON.stringify({ planes: [{ image: 'planes/0.png' }] }));
  await writeFile(path.join(dir, 'other', 'planes', '0.png'), 'mine');
  await writeBundle(await createSceneBundle(scene([near], colours)), path.join(dir, 'other'), { force: true });
  assert.ok(existsSync(path.join(dir, 'other', 'planes', '0.png')));
});

test('MCP pixel_scene with export: true replies with the export\'s warnings too, each once', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pixelbolt-scene-mcp-')), input = new PassThrough(), output = new PassThrough(), waiting = new Map();
  t.after(async () => { input.end(); await rm(dir, { recursive: true, force: true }); });
  let buffer = '', next = 0;
  output.on('data', chunk => { buffer += chunk; for (let end; (end = buffer.indexOf('\n')) !== -1; buffer = buffer.slice(end + 1)) { const message = JSON.parse(buffer.slice(0, end)); waiting.get(message.id)?.(message); } });
  startMCP({ input, output, directory: dir, root: dir });
  const request = (method, params) => new Promise(resolve => { waiting.set(++next, resolve); input.write(JSON.stringify({ jsonrpc: '2.0', id: next, method, params }) + '\n'); });
  await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  const green = { ...dot('#00ff00'), palette: { c: '#00ff00', d: '#008000' }, ramps: [['d', 'c']] };
  const source = { format: 'pixelforge-scene', version: 1, name: 'shady', width: 16, height: 8, background: '#000000', camera: [0, 0], assets: { green },
    instances: [{ name: 'near', asset: 'green', at: [2, 2], scale: 2 }, { name: 'shadow', asset: 'green', at: [8, 4], shade: -1 }] };
  const { warnings } = await createSceneBundle(source);
  assert.equal(warnings.filter(warning => /2× pixels/.test(warning)).length, 1);
  assert.equal(warnings.filter(warning => /shadow: left out/.test(warning)).length, 2);
  const reply = JSON.parse((await request('tools/call', { name: 'pixel_scene', arguments: { scene: source, export: true } })).result.content[0].text);
  assert.deepEqual(reply.warnings, warnings);
});
