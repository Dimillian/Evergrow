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
export function gameEmblemSVG(size = 42): string {
  return glassDrawingSVG(drawing, size);
}
