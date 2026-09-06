import type { ThorAction } from './thor-protocol.ts';
import { previewCharacter } from './character-summary.ts';
import { generateItem } from './items.ts';
import { thorSnapshot } from './thor-state.ts';
import { freshJourneys } from './journey-state.ts';
import { World } from './world.ts';
import { Exploration } from './exploration.ts';
import { WorldMap } from './world-map.ts';
/** Save-free UI fixture: no Game, simulation ticks, or character storage. */
export function thorStudy() {
    const player = previewCharacter(null);
    player.level = 9;
    player.xp = 180;
    player.hp = 72;
    player.mana = 68;
    player.character.gold = 2480;
    player.character.skillPoints = 2;
    player.character.statPoints = 5;
    for (let i = 0; i < 19; i++)
        player.character.inventory[i] = generateItem(410 + i, 8 + i % 3, undefined, undefined, i % 6 === 0 ? 'rare' : i % 3 === 0 ? 'magic' : 'common');
    const journeys = freshJourneys();
    journeys.offers = [{ id: 'review:crypt', kind: 'dungeon', name: 'Rotbound Crypt', x: 1300, y: 500, level: 9, region: 'Deadwood' },
        { id: 'review:camp', kind: 'camp', name: 'Briarwatch Garrison', x: 1800, y: 400, level: 8, region: 'Deadwood' }];
    const snapshot = thorSnapshot({ player, journeys }, 'review', 'Wayfarer', 'playing', 'Briarwatch', 8, null);
    const world = new World(7319), exploration = new Exploration(world);
    for (let y = -1800; y < 1800; y += 800)
        for (let x = -2000; x < 2400; x += 800)
            exploration.reveal(x, y, 850);
    const chart = new WorldMap(world, exploration, document.createElement('div'), () => { });
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 380;
    chart.drawCompanion(canvas.getContext('2d')!, player, 512, 380, .085);
    snapshot.map = canvas.toDataURL('image/png');
    chart.dispose();
    exploration.dispose();
    let selected:string|null=null,phase='playing';
    return {state:snapshot,action(action:ThorAction){
        if(action.type==='inspect'){selected=action.id;phase='paused';}
        if(action.type==='closeInspect')selected=null;
        if(action.type==='resume'){selected=null;phase='playing';}
        return {...thorSnapshot({player,journeys},'review','Wayfarer',phase,'Briarwatch',8,selected),map:snapshot.map};
    }};
}
