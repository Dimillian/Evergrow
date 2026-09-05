import type { CombatEvent } from '../src/model.ts';
import type { CharacterCommand } from '../src/character-commands.ts';
import type { SkillExecution } from '../src/skill-execution-content.ts';

/** Compile-only negative contracts. npm run typecheck fails if these invalid
 * payloads ever become accepted. This file is never loaded by the game. */
export function verifyTypeContracts(event: (event: CombatEvent) => void,
  command: (command: CharacterCommand) => void, recipe: (recipe: SkillExecution) => void): void {
  // @ts-expect-error A hit requires identity, health snapshot, direction and critical flag.
  event({ type: 'hit', x: 0, y: 0, value: 8 });
  // @ts-expect-error Chain effects cannot omit their destination.
  event({ type: 'chain', x: 0, y: 0 });
  // @ts-expect-error Damage to the player must include the resulting health.
  event({ type: 'hurt', x: 0, y: 0, angle: 0, value: 8, heavy: false });
  // @ts-expect-error A death event cannot claim positive remaining health.
  event({ type: 'kill', x: 0, y: 0, angle: 0, targetId: 1, enemyKind: 'stalker', remainingHp: 5 });
  // @ts-expect-error A spawn event is not a hit event with target health.
  event({ type: 'spawn', x: 0, y: 0, enemyKind: 'hound', remainingHp: 5 });
  // @ts-expect-error A ground warning must describe its footprint and timing.
  event({ type: 'ground', x: 0, y: 0, skill: 'meteor', style: 'fire' });
  // @ts-expect-error Equip commands require a source cell.
  command({ type: 'equip', slot: 'weapon' });
  // @ts-expect-error Item movement cannot be mistaken for skill assignment.
  command({ type: 'moveItem', slot: 0, skill: 'fireball' });
  // @ts-expect-error A chain recipe cannot omit jump count, range and falloff.
  recipe({ kind: 'chain', style: 'lightning', duration: .2 });
}
