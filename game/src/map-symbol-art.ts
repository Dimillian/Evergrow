import type { POIKind } from './world-pois.ts';

export type MapSymbol = POIKind | 'chest' | 'exit' | 'ward' | 'champion' | 'destination' | 'search' | 'direction';
/** Names describe the visual cue, and are also used by the icon workshop. */
export const MAP_SYMBOL_LABELS = {
  rift:'Torn aperture and tendrils', bossLair: 'Horned skull', cursedChest: 'Chest with curse sparks', ruinedChapel: 'Broken chapel', beastDen: 'Clawed paw',
  quarry: 'Pickaxe', hamlet: 'House with occupation banner', crossing: 'Bridge over water', corruptedGrove: 'Blighted tree',
  dungeon: 'Stone arch and descending steps', reliquary: 'Sacred urn', portal: 'Swirling gateway', town: 'Shelters and pennant',
  gambler: 'Three-pip die', stash: 'Locked storage chest', blacksmith: 'Anvil', jeweler: 'Faceted gemstone',
  enchanter: 'Wand and magic spark', merchant: 'Coin purse', inn: 'Bed and pillow', chapel: 'Chapel and cross',
  shrine: 'Flame on an altar', landmark: 'Signpost', camp: 'Enemy tent and flag', watchtower: 'Broken watchtower',
  graveyard: 'Headstone and cross', standingStones: 'Stone circle', caravan: 'Covered wagon',
  chest: 'Treasure chest', exit: 'Door and outward arrow', ward: 'Protective shield and flame', champion: 'Visored helmet',
  destination: 'Destination flag', search: 'Magnifying glass', direction: 'Direction chevron',
} as const satisfies Record<MapSymbol, string>;

/** Filled silhouettes in a 16-unit square. Fine interior marks disappear on the minimap. */
export function drawMapSymbol(c: CanvasRenderingContext2D, symbol: MapSymbol, size: number, color: string, ink: string): void {
  c.save(); c.scale(size / 8, size / 8); c.fillStyle = color; c.strokeStyle = color;
  c.lineWidth = size < 6 ? 2 : 1.55; c.lineCap = 'round'; c.lineJoin = 'round';
  const detail = size >= 6;
  const polygon = (...points: number[]) => {
    c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath(); c.fill();
  };
  const line = (...points: number[]) => {
    c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.stroke();
  };
  const dot = (x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const hole = (draw: () => void) => { c.save(); c.fillStyle = ink; c.strokeStyle = ink; draw(); c.restore(); };
  const spark = (x: number, y: number, r: number) => polygon(x, y-r, x+r*.3, y-r*.3, x+r, y, x+r*.3, y+r*.3, x, y+r, x-r*.3, y+r*.3, x-r, y, x-r*.3, y-r*.3);
  const chest = (locked: boolean) => {
    polygon(-7,-2,-5,-5,5,-5,7,-2,7,6,-7,6);
    hole(() => { c.fillRect(-7,-1,14,1.8); if (detail) { c.fillRect(-4,-4,1,9); c.fillRect(3,-4,1,9); } });
    c.fillRect(-2,-1,4,4); if (locked) hole(() => dot(0,1,1));
  };
  const chapel = (ruined: boolean) => {
    polygon(-7,0,-3,-4,-3,7,-7,7); polygon(-3,-2,1,-6,5,-2,5,7,-3,7);
    c.fillRect(0,-8,2,5); c.fillRect(-2,-7,6,1.5);
    if (ruined) { hole(() => polygon(3,-3,6,-3,6,5,2,3,4,1,1,-1)); line(5,7,7,7); }
    hole(() => c.fillRect(-1,2,3,5));
  };
  switch (symbol) {
    case 'blacksmith':
      polygon(-8,-5,6,-5,5,-1,2,0,2,3,6,5,6,7,-6,7,-6,5,-2,3,-2,0,-5,-1); break;
    case 'gambler':
      polygon(-5,-7,6,-6,7,5,-6,7,-7,-5);
      hole(() => { dot(-3,-3,1.35); dot(0,0,1.35); dot(3,3,1.35); }); break;
    case 'stash': chest(true); break;
    case 'chest': chest(false); break;
    case 'cursedChest':
      c.save(); c.translate(0,2); c.scale(.85,.85); chest(false); c.restore();
      line(-6,-5,-7,-7); spark(0,-6,2.2); line(6,-5,7,-7); break;
    case 'jeweler':
      polygon(-8,-2,-4,-6,4,-6,8,-2,0,7);
      hole(() => { line(-6,-1,6,-1); if (detail) { line(-3,-5,-2,-1,0,5,2,-1,3,-5); } }); break;
    case 'enchanter':
      polygon(-7,5,2,-4,4,-2,-5,7); spark(4,-5,3); if (detail) { dot(-2,-6,.9); dot(7,1,.9); } break;
    case 'merchant':
      polygon(-4,-7,4,-7,2,-3,5,-1,7,3,5,7,-5,7,-7,3,-5,-1,-2,-3);
      hole(() => { line(-3,-3,3,-3); dot(0,2,2); }); if (detail) dot(0,2,.7); break;
    case 'inn':
      c.fillRect(-7,-5,2,12); c.fillRect(5,0,2,7); c.fillRect(-5,0,10,4);
      c.fillRect(-4,-3,3,2); polygon(0,-2,5,-2,7,0,0,0); break;
    case 'chapel': chapel(false); break;
    case 'ruinedChapel': chapel(true); break;
    case 'shrine':
      polygon(0,-8,4,-3,3,0,0,2,-3,0,-4,-3,-1,-5); c.fillRect(-6,3,12,2); c.fillRect(-3,5,6,2);
      if (detail) hole(() => polygon(0,-3,1,0,-1,0)); break;
    case 'reliquary':
      c.fillRect(-1,-8,2,4); c.fillRect(-3,-7,6,1.5); c.fillRect(-5,-3,10,2);
      polygon(-5,0,5,0,3,4,1,5,1,6,5,6,5,8,-5,8,-5,6,-1,6,-1,5,-3,4);
      if (detail) hole(() => c.fillRect(-1,1,2,3)); break;
    case 'rift':
      polygon(0,-9,4,-3,2,2,0,7,-3,3,-4,-3);hole(()=>polygon(0,-5,1,0,0,4,-1,0));line(-3,4,-7,2,-6,-3);line(2,3,7,5,6,-1);break;
    case 'portal':
      c.lineWidth = 2.3; c.beginPath(); c.ellipse(0,-1,5,7,0,.35,Math.PI*2-.35); c.stroke();
      line(5,-3,6,1,2,0); if (detail) { c.lineWidth = 1.35; line(-1,-4,2,-2,1,2,-1,3); } break;
    case 'town':
      polygon(-8,6,-3,-3,2,6); polygon(-1,6,3,0,8,6);
      hole(() => polygon(-5,6,-3,1,-1,6)); line(2,-7,2,-2); polygon(2,-7,7,-6,2,-4); break;
    case 'camp':
      polygon(-8,7,0,-5,8,7); hole(() => polygon(-3,7,0,0,3,7));
      line(0,-8,0,-5); polygon(1,-8,7,-7,1,-5); break;
    case 'hamlet':
      polygon(-8,0,-3,-5,2,0,0,0,0,7,-6,7,-6,0); hole(() => c.fillRect(-4,3,2,4));
      line(4,-7,4,7); polygon(4,-7,8,-7,7,-4,4,-4); break;
    case 'landmark':
      c.fillRect(-1,-8,2,16); polygon(-7,-5,4,-5,7,-3,4,-1,-7,-1);
      polygon(-4,1,6,1,6,4,-4,4,-7,2.5); break;
    case 'watchtower':
      polygon(-6,-8,-3,-8,-3,-5,0,-5,0,-7,3,-5,6,-7,6,-1,4,0,4,7,-4,7,-4,0,-6,-1);
      hole(() => { c.fillRect(-1,-2,2,3); c.fillRect(-2,4,4,3); }); break;
    case 'graveyard':
      c.beginPath(); c.arc(0,-2,5,Math.PI,0); c.lineTo(5,6); c.lineTo(-5,6); c.closePath(); c.fill();
      c.fillRect(-7,6,14,2); hole(() => { c.fillRect(-1,-4,2,7); c.fillRect(-3,-2,6,2); }); break;
    case 'standingStones':
      polygon(-7,6,-6,-4,-3,-5,-2,6); polygon(2,6,3,-5,6,-4,7,6);
      polygon(-5,-8,5,-7,5,-5,-5,-5); if (detail) { dot(-1,7,.8); dot(2,8,.8); } break;
    case 'caravan':
      polygon(-7,3,-7,-2,-4,-6,3,-6,6,-2,6,3); hole(() => { c.fillRect(-5,-1,9,2); if (detail) line(-1,-5,-1,-2); });
      line(-7,4,8,4); dot(-4,6,2); dot(4,6,2); break;
    case 'beastDen':
      dot(-5,-3,2); dot(-1.8,-6,2); dot(2.2,-6,2); dot(5.5,-2.5,2);
      polygon(-5,5,-4,1,0,-1,4,1,5,5,2,7,0,6,-2,7); break;
    case 'quarry':
      polygon(-6,6,2,-5,4,-4,-3,8); polygon(-7,-2,-3,-6,1,-7,5,-5,8,0,3,-3,-1,-4,-5,-3); break;
    case 'crossing':
      c.fillRect(-7,-5,2,10); c.fillRect(5,-5,2,10); c.fillRect(-5,-2,10,4);
      hole(() => { c.fillRect(-2,-2,1,4); c.fillRect(2,-2,1,4); });
      line(-7,7,-4,6,0,7,4,6,7,7); break;
    case 'corruptedGrove':
      polygon(-1,-8,2,-8,1,-2,5,-4,6,-7,8,-7,7,-2,2,1,2,4,6,7,1,6,-1,8,-2,5,-7,7,-3,3,-3,0,-7,-3,-8,-6,-6,-6,-5,-4,-2,-3);
      if (detail) hole(() => polygon(-1,0,1,1,0,4,-1,3)); break;
    case 'dungeon':
      polygon(-7,7,-7,-3,-4,-7,4,-7,7,-3,7,7);
      hole(() => polygon(-4,7,-4,-2,-2,-4,2,-4,4,-2,4,7));
      c.fillRect(-2,1,4,1.5); c.fillRect(-3,4,6,1.5); c.fillRect(-4,7,8,1); break;
    case 'bossLair':
      polygon(-5,-4,-8,-7,-7,-1,-5,1,-4,4,-3,4,-3,7,3,7,3,4,4,4,5,1,7,-1,8,-7,5,-4,3,-6,-3,-6);
      hole(() => { polygon(-4,-1,-1,0,-1,2,-4,1); polygon(4,-1,1,0,1,2,4,1); if (detail) { c.fillRect(-1,5,1,2); c.fillRect(1,5,1,2); } }); break;
    case 'exit':
      polygon(-7,-7,2,-7,2,-3,0,-3,0,-5,-5,-5,-5,5,0,5,0,3,2,3,2,7,-7,7);
      polygon(-2,-1,4,-1,4,-4,8,0,4,4,4,1,-2,1); break;
    case 'ward':
      polygon(-7,-5,0,-8,7,-5,6,2,3,6,0,8,-3,6,-6,2);
      hole(() => polygon(0,-5,3,-1,2,3,0,5,-2,3,-3,0,-1,-2)); break;
    case 'champion':
      polygon(-6,6,-6,-3,-3,-6,-1,-6,-1,-8,2,-8,2,-6,5,-4,6,6,2,8,-2,8);
      hole(() => { c.fillRect(-4,-1,8,2); c.fillRect(-1,1,2,6); }); break;
    case 'destination':
      c.fillRect(-5,-8,2,16); polygon(-2,-7,7,-7,4,-3,7,1,-2,1); c.fillRect(-7,6,7,2); break;
    case 'search':
      c.lineWidth = 2.5; c.beginPath(); c.arc(-2,-2,4.5,0,Math.PI*2); c.stroke();
      c.lineWidth = 3; line(2,2,7,7); break;
    case 'direction': polygon(-6,-6,-2,-6,5,0,-2,6,-6,6,1,0); break;
    default: { const never: never = symbol; throw new Error(`Unknown map symbol: ${never}`); }
  }
  c.restore();
}
