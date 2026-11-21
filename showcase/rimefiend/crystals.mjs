// Use the very same RGBA pixels in both panels so only the background can change the crystal.
import { readFile, writeFile } from 'node:fs/promises';
import { prepareStack } from '../../src/stack.js';
import { renderProject, inspectProject } from '../../src/core.js';
import { asGIFShows } from '../../src/gif.js';
import { encodePNG } from '../../src/png.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Supply the demon .stack.json and a new output .png.');
const source = JSON.parse(await readFile(input, 'utf8'));
const project = renderProject(prepareStack(source).recipe(source.headings.indexOf(333)));
const frame = project.frames[0];
const mattes = { slate: [52, 51, 65], parchment: [221, 206, 189] };
const frames = Object.entries(mattes).map(([name, rgb]) => ({
  ...frame, name, data: asGIFShows(frame.data, rgb)
}));
const { sheet } = inspectProject({ ...project, frames, animations: {} }, {
  region: { x: 61, y: 22, w: 140, h: 140 }, scale: 3
});
await writeFile(output, encodePNG(sheet.data, sheet.width, sheet.height), { flag: 'wx' });
