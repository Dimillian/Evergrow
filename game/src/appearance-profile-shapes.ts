import { appearancePalette, HAIR_PALETTES, SKIN_PALETTES, type CharacterAppearance } from './appearance-content.ts';
import { profileHairShapes } from './appearance-hair-directions.ts';
import { mixColor, type Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';

/** A right-facing skull, nose, jaw and one visible eye; mirror for west. All
 * cosmetics stay on this head mount, including the projected hairstyle recipe. */
export function appearanceProfileShapes(appearance: Readonly<CharacterAppearance>, facing: number, covered: boolean): GearShape[] {
  const skin = appearancePalette(SKIN_PALETTES, appearance.skin);
  const hair = appearancePalette(HAIR_PALETTES, appearance.hairColor);
  const sign = Math.cos(facing) >= 0 ? 1 : -1;
  const shapes: GearShape[] = [];
  const f = (points: readonly Point[], fill: string) => shapes.push({ points, fill });
  const l = (points: readonly Point[], stroke: string, width = .55) => shapes.push({ points, stroke, width });
  const layers = covered ? { rear: [], front: [] } : profileHairShapes(appearance.hair, hair);
  shapes.push(...layers.rear);
  f([[-3.8,-1.3],[-3.3,-3.6],[-1.3,-4.7],[1.8,-4.4],[3.2,-2.7],[3.4,-.5],
    [3.1,.6],[4.7,2],[4.5,2.65],[3.1,2.8],[3.2,3.8],[2.2,5],[.1,5.1],[-1.4,3.8],[-3.2,2.2]], '#403b39');
  f([[-3.2,-1.2],[-2.8,-3.3],[-1,-4.1],[1.7,-3.9],[2.7,-2.3],[2.8,.5],
    [4.15,2.15],[2.55,2.4],[2.7,3.6],[1.9,4.5],[.2,4.6],[-1.2,3.3],[-2.8,1.9]], skin.base);
  f([[-3.2,-1.2],[-1.3,-1.7],[-.7,1.1],[-.5,3.4],[.2,4.6],[-1.2,3.3],[-2.8,1.9]], skin.shadow);
  f([[1.8,-.8],[2.7,-.5],[2.8,.5],[4.15,2.15],[2.55,2.4],[1.8,1.9]], skin.light);
  l([[1.65,.7],[2.85,.85]], '#263239', .8);
  l([[2.2,3.2],[3,3.15]], mixColor(skin.shadow,'#553c3e',.3), .5);
  l([[.8,4.2],[2,4.25]], skin.light, .4);
  const beard = appearance.facialHair;
  if (beard !== 'none') {
    const bottom = beard === 'fullbeard' ? 7.5 : beard === 'chinbraid' ? 6 : beard === 'beard' ? 5.8 : 4.7;
    if (['stubble','beard','fullbeard','chinbraid'].includes(beard)) {
      f([[-.2,2.8],[1.1,3.8],[2.65,3.5],[2.4,4.6],[1.2,bottom],[-.5,bottom-.5],[-1,3]],
        beard === 'stubble' ? mixColor(skin.base,hair.shadow,.42) : hair.base);
      if (beard !== 'stubble') l([[.3,4.2],[.7,bottom-.5]],hair.light,.35);
    }
    if (beard === 'goatee') {
      f([[1.1,3.8],[2.65,3.6],[2.5,4.7],[1.5,6.4],[.65,5.7],[.8,4.4]],hair.base);
      l([[1.5,4.5],[1.4,5.7]],hair.light,.35);
    }
    if (beard !== 'stubble') l([[1.8,2.8],[2.9,2.95],[3.1,3.4]],hair.base,.65);
    if (beard === 'handlebar') {
      l([[2.9,3.05],[3.7,3.15],[4,2.75],[3.8,2.35]],hair.base,.7);
      l([[3.3,3.05],[3.65,2.85]],hair.light,.3);
    }
    if (beard === 'chinbraid') for(let i=0;i<3;i++) {
      const y=5.2+i*1.05; f([[.1,y],[1,y-.2],[1.5,y+.5],[.7,y+1.2],[0,y+.6]],i%2?hair.shadow:hair.base);
    }
  }
  const accessory=appearance.accessory;
  if (accessory === 'spectacles') {
    l([[1.55,.15],[2.9,.3],[3.1,1.55],[1.8,1.8],[1.55,.15]],'#d3bc86',.55);
    l([[-1,.65],[1.6,.55]],'#7b725f',.45);
  }
  if (accessory === 'eyepatch') {
    l([[-3,.15],[2,.55]],'#303038',.6);
    // The patch covers the anatomical right eye, visible from the east view.
    if (sign > 0) f([[1.5,.15],[3,.35],[2.9,1.65],[2,1.85],[1.5,1.1]],'#222a2f');
  }
  if (accessory === 'nosering') l([[3.8,2.25],[4,2.9],[3.4,3],[3.3,2.6]],'#e0c38b',.3);
  shapes.push(...layers.front);
  // Near ear overlaps the sideburn, giving the profile a readable depth cue.
  if (!covered) {
    f([[-1.4,.15],[-.3,-.15],[.15,.65],[-.1,2.15],[-1,2.45],[-1.6,1.45]],skin.base);
    l([[-1, .65],[-.55,.45],[-.4,1.45],[-.9,1.8]],skin.shadow,.45);
    if(accessory==='hoop') l([[-.65,2],[-.1,2.5],[-.2,3.6],[-1,3.8],[-1.35,2.9],[-.65,2]],'#d5b478',.55);
    if(accessory==='studs') f([[-.7,1.5],[-.15,2],[-.7,2.5],[-1.2,2]],'#d2dbda');
    if(accessory==='earcuff') l([[-1.3,.6],[-.4,.4],[-.15,1.1],[-1,1.4]],'#c9d5d7',.65);
    if(accessory==='circlet') { l([[-3.2,-1.8],[.4,-1.4],[2.8,-.9]],'#d5dcca',.6); f([[2.5,-1.4],[3,-.8],[2.6,-.1],[2.2,-.8]],'#abd2d5'); }
  }
  return shapes.map(shape => ({ ...shape, points: shape.points.map(([x,y]) => [x*sign,y] as Point) }));
}
