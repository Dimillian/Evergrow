import type { CombatEvent, Enemy } from './model.ts';

export function enemyEngaged(enemy: Pick<Enemy, 'hp' | 'state'>): boolean {
  return enemy.hp > 0 && (enemy.state === 'chase' || enemy.state === 'windup'
    || enemy.state === 'attack' || enemy.state === 'recover');
}

/** Observe fixed-tick edges after damage and AI, including direct hits and the Warden.
 * No randomness or changes to actors; camera visibility never creates an edge. */
export class EnemyEngagements {
  private engaged = new Map<number, boolean>();
  reset(): void { this.engaged.clear(); }
  update(enemies: readonly Enemy[], time: number, emit: (event: CombatEvent) => void): void {
    const present = new Set(enemies.map(enemy => enemy.id));
    for (const id of this.engaged.keys()) if (!present.has(id)) this.engaged.delete(id);
    for (const enemy of enemies) {
      const engaged = enemyEngaged(enemy);
      if (engaged !== (this.engaged.get(enemy.id) ?? false)) {
        emit({ type: 'engagement', targetId: enemy.id, enemyKind: enemy.kind,
          x: enemy.x, y: enemy.y, engaged, time });
      }
      this.engaged.set(enemy.id, engaged);
    }
  }
}
