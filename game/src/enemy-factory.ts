import type { Enemy } from './model.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { applyEnemyModifiers } from './enemy-modifiers.ts';
import { scaledEnemyStats } from './zone-progression.ts';

export type EnemySpawn = Pick<Enemy, 'id' | 'kind' | 'level' | 'rank' | 'biome' | 'lootSeed' | 'x' | 'y'>
  & Partial<Pick<Enemy, 'lootIdentity' | 'rift' | 'dungeonTheme' | 'campId' | 'campMemberId' | 'difficulty' | 'rewardDifficulty'>> & { idleDuration: number };
/** Construct one actor from its source snapshot; admission, RNG and commitment belong to the caller. */
export function createEnemy(s: EnemySpawn): Enemy {
  const { kind, level, rank, lootSeed, rift, x, y } = s;
  const scaled = applyEnemyModifiers(scaledEnemyStats(kind, level, rank), { kind, rank, lootSeed, rift, difficulty:s.difficulty, rewardDifficulty:s.rewardDifficulty });
  return {
    id:s.id, kind, level, rank, biome:s.biome, lootSeed, ...(s.lootIdentity?{lootIdentity:s.lootIdentity}:{}), ...(rift ? {rift} : {}), difficulty:s.difficulty, rewardDifficulty:s.rewardDifficulty, ...scaled, dungeonTheme:s.dungeonTheme,
    ...(s.campId ? {campId:s.campId, campMemberId:s.campMemberId} : {}),
    x, y, prevX:x, prevY:y, vx:0, vy:0, knockbackX:0, knockbackY:0, angle:0, hp:scaled.maxHp,
    state:'idle', stateTime:0, stateDuration:s.idleDuration,
    attackAngle:0, attackTargetX:x, attackTargetY:y, homeX:x, homeY:y, awareness:0, lostSightTime:0,
    lastSeenX:x, lastSeenY:y, senseTime:0, seesPlayer:false, patrolPhase:((s.id+1)*2.399963)%(Math.PI*2),
    hitFlash:0, hitAngle:0, radius:ENEMY_DEFINITIONS[kind].radius, stagger:0, attackHit:false, interrupted:false,
    slowTime:0, slowFactor:1, burnTime:0, burnDps:0, burnTick:0,
  };
}
