import type { Item } from './character-types.ts';
import { TIER_COLORS } from './items.ts';
import type { GearShape } from './weapon-shapes.ts';
export function riftKeyShapes(item:Item):readonly GearShape[] {const color=TIER_COLORS[item.tier];return [
 {points:[[-2,0],[2,0],[2,19],[7,19],[7,22],[2,22],[2,27],[-2,27]],fill:'#ac789c',stroke:'#e7abc9',width:.6},
 {points:[[-7,-6],[0,-15],[7,-6],[5,2],[0,6],[-5,2]],fill:'#41162f',stroke:color,width:1},
 {points:[[0,-11],[4,-5],[0,1],[-4,-5]],fill:color},
 {points:[[0,-10],[1,-5],[0,-1],[-1,-5]],fill:'#fff1ed'},
 {points:[[-6,-3],[-10,3],[-7,8],[-5,5]],fill:color},
 {points:[[6,-3],[10,3],[7,8],[5,5]],fill:color},
];}
