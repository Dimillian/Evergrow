import { glassDrawingSVG, glassIconDrawing } from './skill-icon.ts';
import type { IconPart } from './skill-icon-content.ts';

// A slender, split flame: two glass ribbons around an open seam.
// The silhouette stays quiet at title size; skill glass supplies its inner light.
const EVERFLAME: readonly IconPart[] = [
  { kind: 'body', material: 'jade', path: 'M36 5C34 20 16 26 18 40C19 47 25 52 31 56C18 53 10 44 12 34C14 21 29 16 36 5Z' },
  { kind: 'body', material: 'steel', path: 'M39 20C49 28 53 39 46 48C42 53 37 56 31 59C38 51 42 45 39 38C37 33 35 28 39 20Z', opacity: .75 },
  { kind: 'body', material: 'gold', path: 'M33 28C33 37 25 40 27 48L30 53C20 47 25 37 33 28Z', opacity: .8 },
];
const drawing = glassIconDrawing(EVERFLAME, 'jade', false);
let lightId = 0;
export function gameEmblemSVG(size = 42, backlight = false): string {
  const svg = glassDrawingSVG(drawing, size);
  if (!backlight) return svg;
  const id = `everflame-light-${lightId++}`;
  const light = `<defs><radialGradient id="${id}" data-emblem-light gradientUnits="userSpaceOnUse" cx="32" cy="32" r="45"><stop stop-color="#fff2cd" stop-opacity=".8"/><stop offset=".32" stop-color="#ffce81" stop-opacity=".55"/><stop offset="1" stop-color="#f9b765" stop-opacity="0"/></radialGradient></defs><g class="game-emblem-light">${drawing.filter(op => op.surface).map(op => `<path d="${op.path}" fill="url(#${id})"/>`).join('')}</g>`;
  return svg.replace('</svg>', `${light}</svg>`);
}
export function gameIdentityMarkup(heading = false, backlight = false): string {
  const tag = heading ? 'h1' : 'span';
  return `<div class="game-identity${backlight ? ' title-identity' : ''}"><div class="game-emblem" aria-hidden="true">${gameEmblemSVG(42, backlight)}</div><${tag} class="game-name">EVERGROW</${tag}></div>`;
}
