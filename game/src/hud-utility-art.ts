import type { IconPart } from './skill-icon-content.ts';
import { glassIconDrawing } from './skill-icon.ts';
import { paintGlassIcon } from './skill-icon-canvas.ts';

type Utility = 'potion' | 'dodge' | 'menu';
const body = (path: string, material: IconPart['material']): IconPart => ({ path, material, kind: 'body' });
const facet = (path: string, material: IconPart['material']): IconPart => ({ path, material, kind: 'facet' });
/** Full silhouettes, backlit panes and lead seams match the active skill artwork. */
const recipes: Record<Utility, readonly IconPart[]> = {
  potion: [
    body('M24 9H40V22C40 27 51 30 51 42V50Q50 59 40 60H24Q14 59 13 50V42C13 30 24 27 24 22Z', 'ice'),
    body('M17 37Q24 34 31 39V56H24Q18 55 17 49Z', 'rose'),
    body('M33 39Q40 43 47 37V49Q46 55 40 56H33Z', 'violet'),
    facet('M20 38 29 41 23 53 19 49Z', 'rose'),
    body('M22 6H42V14H22Z', 'gold'),
    body('M23 17H41V21H23Z', 'gold'),
    facet('M27 23H30Q31 29 23 34L20 35Q28 29 27 23Z', 'steel'),
    facet('M20 38 22 38 21 47 19 44Z', 'steel'),
  ],
  dodge: [
    body('M5 18 21 13 19 19 4 23ZM2 31 16 26 15 32 3 36ZM7 44 17 37 17 42 7 48Z', 'jade'),
    body('M27 6 45 9 41 28 44 36 56 43 59 49 55 54H23L20 48 25 36 29 28Z', 'jade'),
    body('M26 6 46 9 45 17 28 14Z', 'gold'),
    facet('M30 18 39 20 35 31 29 39 25 42 30 28Z', 'steel'),
    body('M22 46 30 43 43 46 57 48 55 54H24Z', 'gold'),
    facet('M35 36 41 33 43 38 49 42 42 44 29 42Z', 'jade'),
  ],
  menu: [
    // Three broad silver bars stay recognizable inside the small round control.
    body('M16 15H48L50 17V21L48 23H16L14 21V17Z', 'steel'),
    body('M16 28H48L50 30V34L48 36H16L14 34V30Z', 'steel'),
    body('M16 41H48L50 43V47L48 49H16L14 47V43Z', 'steel'),
  ],
};
const stamps = new Map<Utility, HTMLCanvasElement>();
export function drawHUDUtility(c: CanvasRenderingContext2D, kind: Utility, x: number, y: number, size: number): void {
  let stamp = stamps.get(kind);
  if (!stamp) {
    stamp = document.createElement('canvas'); stamp.width = stamp.height = 144;
    const context = stamp.getContext('2d')!;
    paintGlassIcon(context, glassIconDrawing(recipes[kind], kind === 'potion' ? 'rose' : kind === 'dodge' ? 'jade' : 'steel', false), 72, 72, 144);
    stamps.set(kind, stamp);
  }
  c.drawImage(stamp, x - size / 2, y - size / 2, size, size);
}
