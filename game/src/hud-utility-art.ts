import { drawSilverVial, drawPhantomStep } from './hud-utility-shapes.ts';
import type { IconPart } from './skill-icon-content.ts';
import { glassIconDrawing } from './skill-icon.ts';
import { paintGlassIcon } from './skill-icon-canvas.ts';

type Utility = 'potion' | 'dodge' | 'menu';
const body = (path: string, material: IconPart['material']): IconPart => ({ path, material, kind: 'body' });
/** Menu retains its shared glass bars; utilities use the selected silver artwork. */
const recipes = {
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
    stamp = document.createElement('canvas'); stamp.width = stamp.height = 256;
    const context = stamp.getContext('2d')!;
    if (kind === 'menu') paintGlassIcon(context, glassIconDrawing(recipes.menu, 'steel', false), 128, 128, 256);
    else {
      context.scale(4, 4);
      if (kind === 'potion') drawSilverVial(context); else drawPhantomStep(context);
    }
    stamps.set(kind, stamp);
  }
  c.drawImage(stamp, x - size / 2, y - size / 2, size, size);
}
