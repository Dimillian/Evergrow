import { mixColor, type Point } from './art-primitives.ts';
import { materializeGear } from './gear-material.ts';
import { gearShapesSVG, type GearShape } from './weapon-shapes.ts';
import { WORLD_DIFFICULTIES, worldDifficulty, type WorldDifficulty } from './world-difficulty.ts';

/** Forged heraldry, using the same faceted geometry and metal response as equipment. */
export function difficultyBadgeShapes(id: WorldDifficulty): GearShape[] {
  const tier = WORLD_DIFFICULTIES.indexOf(worldDifficulty(id)), { metal, color } = worldDifficulty(id);
  const dark = mixColor(metal, '#071019', .78), edge = mixColor(metal, '#e5ece8', .35);
  const shapes: GearShape[] = [];
  const plate = (points: Point[], fill: string, stroke?: string, width = .7) => shapes.push({ points, fill, stroke, width });
  const line = (points: Point[], stroke: string, width = .7) => shapes.push({ points, stroke, width });
  const diamond = (x: number, y: number, w: number, h: number, fill: string) => plate([[x-w,y],[x,y-h],[x+w,y],[x,y+h]],fill);
  for (const side of [-1, 1]) {
    const reflect = (points: Point[]): Point[] => points.map(([x,y])=>[side*x,y]);
    if (tier >= 1) { // Crossed swords rise behind the crest.
      plate(reflect([[9,22],[12,25],[35,-27],[34,-40],[24,-30]]), dark, metal);
      plate(reflect([[11,21],[34,-38],[28,-28]]), edge);
      plate(reflect([[6,17],[8,13],[19,21],[16,25]]),metal);
      line(reflect([[8,24],[3,31]]),dark,5); line(reflect([[8,24],[3,31]]),metal,2);
    }
    if (tier >= 2) {
      for (let i=0;i<4;i++) {
        const y=-16+i*10, reach=44-i*3;
        plate(reflect([[21,y+4],[reach,y-13],[reach-5,y+3],[23,y+13]]),dark,metal);
        line(reflect([[24,y+4],[reach-3,y-9]]),edge,.9);
      }
    } else { // Engraved laurel leaves for the first two ranks.
      for(let i=0;i<5;i++) {
        const x=25+Math.sin(i*.6)*6,y=20-i*8;
        plate(reflect([[x,y+6],[x-3,y-2],[x+4,y-7],[x+3,y+1]]),metal);
      }
    }
    if(tier===3) {
      plate(reflect([[16,-15],[22,-31],[24,-46],[34,-39],[37,-20],[30,-3]]),dark,metal);
      plate(reflect([[24,-43],[32,-36],[33,-22],[26,-7],[28,-27]]),edge);
      line(reflect([[29,-32],[32,-23],[27,-12]]),color,1.2);
    }
  }
  plate([[-25,-25],[0,-34],[25,-25],[23,11],[15,26],[0,38],[-15,26],[-23,11]],dark,edge,1.4);
  plate([[-21,-22],[0,-29],[21,-22],[19,10],[12,23],[0,32],[-12,23],[-19,10]],metal);
  plate([[-18,-20],[0,-26],[18,-20],[16,10],[10,20],[0,28],[-10,20],[-16,10]],'#12212b',metal);
  plate([[0,-25],[17,-20],[15,10],[0,27]],'#1d2a35');
  line([[-20,-19],[-18,10],[-10,22]],edge,.7);
  if(tier<2) { // A closed knight's helm, taller and crowned on Veteran.
    plate([[-12,-12],[-7,-21],[5,-23],[13,-13],[12,6],[0,16],[-12,6]],metal,edge);
    plate([[0,-22],[6,-19],[10,-11],[9,5],[0,13]],dark);
    plate([[-10,-9],[-2,-6],[-2,-1],[-10,-3]],'#080e16');
    plate([[2,-6],[10,-9],[10,-3],[2,-1]],'#080e16');
    line([[0,-16],[0,9]],edge,1.2);
    for(const side of [-1,1])line([[side*4,2],[side*8,0]],edge,.7);
    if(tier===1)plate([[-10,-22],[-11,-31],[-4,-27],[0,-35],[4,-27],[11,-31],[10,-22]],metal,edge);
  } else { // Bone-metal death mask with glowing recessed eyes.
    plate([[-12,-15],[-7,-22],[7,-22],[12,-15],[13,-5],[8,1],[7,11],[-7,11],[-8,1],[-13,-5]],metal,edge);
    plate([[0,-21],[7,-19],[10,-13],[8,-4],[3,0],[5,9],[0,11]],dark);
    plate([[-11,-11],[-3,-8],[-4,-2],[-10,-4]],'#080d17');
    plate([[11,-11],[3,-8],[4,-2],[10,-4]],'#080d17');
    line([[-10,-8],[-5,-5]],color,2); line([[10,-8],[5,-5]],color,2);
    plate([[0,-3],[-3,2],[3,2]],'#080d17');
    for(let x=-4;x<=4;x+=4)line([[x,5],[x,11]],'#09121b',1.3);
    if(tier===3)plate([[-9,-23],[-10,-30],[-4,-27],[0,-37],[4,-27],[10,-30],[9,-23]],metal,edge);
  }
  diamond(0,22,3,4,color);
  for(let i=0;i<=tier;i++)diamond((i-tier/2)*9,44,2,2.4,color);
  return materializeGear(shapes,'steel',130+tier*77,new Map([[color,'gem']])).map(shape => {
    if(shape.fill===metal||shape.fill===edge||shape.fill===color)return shape;
    const {surface: _surface,...inlay}=shape;return inlay;
  });
}
let serial=0;
export function difficultyBadgeSVG(id:WorldDifficulty,size=144):string {
  return `<svg class="difficulty-badge" width="${size}" height="${size}" viewBox="-52 -52 104 104" aria-hidden="true" focusable="false">${gearShapesSVG(difficultyBadgeShapes(id),true,`difficulty-${++serial}`)}</svg>`;
}
