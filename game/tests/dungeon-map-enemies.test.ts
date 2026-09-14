import test from 'node:test';
import assert from 'node:assert/strict';
import { dungeonMapEnemyVisible } from '../src/dungeon-map-enemies.ts';
import { generateDungeon } from '../src/dungeon.ts';
test('dungeon monster markers respect exploration, death and view bounds',()=>{
 const floor=generateDungeon(7319,30),room=floor.rooms[0];
 const enemy={x:room.x+room.width/2,y:room.y+room.height/2,hp:100,kind:'stalker' as const,rank:'elite' as const};
 const box={x:-10000,y:-10000,width:20000,height:20000};
 assert.equal(dungeonMapEnemyVisible(enemy,floor,new Set(),box),false);
 assert.equal(dungeonMapEnemyVisible(enemy,floor,new Set([room.id]),box),true);
 assert.equal(dungeonMapEnemyVisible({...enemy,hp:0},floor,new Set([room.id]),box),false);
 assert.equal(dungeonMapEnemyVisible(enemy,floor,new Set([room.id]),{x:enemy.x+10,y:enemy.y+10,width:1,height:1}),false);
 const passage=floor.corridors[0],edge=floor.edges[passage.connection!];
 assert.equal(dungeonMapEnemyVisible({...enemy,x:passage.x+passage.width/2,y:passage.y+passage.height/2},floor,new Set([edge[0]]),box),true);
});
