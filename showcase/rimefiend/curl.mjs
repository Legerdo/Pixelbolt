// Sample the three named hand poses with the same camera columns and locked wrist
// as the inspection sheet. The lossless animation and matted GIF use the same frames.
import { readFile, writeFile } from 'node:fs/promises';
import { prepareStack } from '../../src/stack.js';
import { renderProject } from '../../src/core.js';
import { animationGIF } from '../../src/gif.js';
import { encodeAPNG } from '../../src/png.js';

const [input, outputStem] = process.argv.slice(2);
if (!input || !outputStem) throw Error('Supply the editable stack and a new output filename without its extension.');
const source = JSON.parse(await readFile(input, 'utf8'));
const study = JSON.parse(await readFile(new URL('index-study.json', import.meta.url), 'utf8'));
const steps = 16;
for (let i = 0; i <= steps; i++) {
  const segment = i < steps / 2 ? 0 : 1,
    t = (i - (segment * steps) / 2) / (steps / 2);
  const a = source.poses[study.poses[segment]].index ?? {};
  const b = source.poses[study.poses[segment + 1]].index ?? {};
  const index = {};
  for (const joint of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const start = a[joint] ?? 0;
    index[joint] = start + ((b[joint] ?? 0) - start) * t;
  }
  source.poses['curl-' + i] = { index };
}
const stack = prepareStack(source),
  gap = 2;
const frames = Array.from({ length: steps + 1 }, (_, i) => {
  const solo = stack.poseStudy({ ...study, poses: ['curl-' + i] });
  const ops = solo.frames.flatMap((frame, col) =>
    frame.ops.map(op => ({
      ...op,
      x: (op.x ?? 0) + col * (study.size + gap)
    }))
  );
  return { name: 'curl-' + i, duration: i === 0 || i === steps ? 420 : 60, ops };
});
const playback = [...frames, ...frames.slice(1, -1).reverse()];
const recipe = {
  version: 1,
  name: 'rimefiend-hand',
  width: (study.size + gap) * study.headings.length - gap,
  height: study.size,
  palette: source.palette,
  frames,
  animations: { curl: { frames: playback.map(f => f.name), loop: true } }
};
const project = renderProject(recipe);
const gif = animationGIF(project, 'curl', { scale: 3, background: '#434152' });
const clip = project.animations.curl.frames.map(i => project.frames[i]);
await writeFile(outputStem + '.png', encodeAPNG(clip, project.width, project.height, true), { flag: 'wx' });
await writeFile(outputStem + '.gif', gif.data, { flag: 'wx' });
