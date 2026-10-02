/** Deterministic app/tab icons from the runtime emblem. No browser or new dependency.
 * node --experimental-strip-types game/scripts/export-game-brand.mjs /installed/@napi-rs/canvas
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { gameEmblemSVG } from '../src/game-emblem.ts';
if (!process.argv[2]) throw Error('Provide an installed @napi-rs/canvas package path.');
const { createCanvas, loadImage } = createRequire(import.meta.url)(resolve(process.argv[2]));
const source = gameEmblemSVG(64);
const content = source.slice(source.indexOf('>') + 1, source.lastIndexOf('</svg>'));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" stroke-linecap="round"><rect width="64" height="64" fill="#0b1114"/><g transform="translate(8 8) scale(.75)">${content}</g></svg>`;
const icons = new URL('../public/icons/', import.meta.url);
writeFileSync(new URL('evergrow.svg', icons), svg);
const image = await loadImage(Buffer.from(svg));
for (const size of [192, 512]) {
  const canvas = createCanvas(size, size);
  canvas.getContext('2d').drawImage(image, 0, 0, size, size);
  writeFileSync(new URL(`evergrow-${size}.png`, icons), canvas.toBuffer('image/png'));
  if (size === 512) {
    const native = new URL('../../android/app/src/main/res/drawable-nodpi/', import.meta.url);
    mkdirSync(native, { recursive: true });
    writeFileSync(new URL('ic_evergrow.png', native), canvas.toBuffer('image/png'));
  }
}
// The generated PNG replaces the preceding handwritten launcher vector.
rmSync(new URL('../../android/app/src/main/res/drawable/ic_evergrow.xml', import.meta.url), { force: true });
