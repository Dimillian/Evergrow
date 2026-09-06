import { creditGold, goldBalance } from './wallet.ts';
import type { Simulation } from './simulation.ts';
import type { CombatEvent } from './model.ts';
import { awardCharacterExperience } from './character.ts';
export const REWARD_SCENES = ['level', 'xp', 'gold', 'burst', 'multi'] as const;
export type RewardScene = typeof REWARD_SCENES[number];
export const REWARD_SCENE_LABELS: Record<RewardScene, string> = {
  level: 'Level up', xp: 'XP stream', gold: 'Gold spill & pickup', burst: 'Rapid rewards', multi: 'Multiple levels',
};
/** Authored presentation timeline. Never ticks simulation or reads/writes saves. */
export function resetRewardScene(sim: Simulation, scene: RewardScene = 'level'): void {
  sim.reset(); sim.player.character.gold = 1240; sim.player.xp = 45;
  const positions = scene === 'gold' ? [[75, 5], [10, 19], [-55, 33]]
    : scene === 'xp' ? [[100, -50], [40, -70], [-20, -90]]
    : scene === 'burst' ? Array.from({ length: 8 }, (_, i) => [Math.cos(i * 2.4) * 120, -40 + Math.sin(i * 2.4) * 70]) : [[110, -50]];
  for (const [x, y] of positions) { const enemy = sim.spawnEnemy('stalker', x, y); if (enemy) { enemy.state = 'idle'; enemy.stateDuration = 99; } }
  sim.player.angle = Math.PI / 2; sim.player.prevX = sim.player.x; sim.player.prevY = sim.player.y;
}
export function rewardSceneEvents(sim: Simulation, scene: RewardScene, before: number, time: number): CombatEvent[] {
  const events: CombatEvent[] = [], p = sim.player;
  const due = (at: number) => before < at && time >= at;
  const fallen = (x: number, y: number) => {
    const enemy = sim.enemies.find(e => e.hp > 0 && Math.hypot(e.x - x, e.y - y) < 4);
    if (enemy) { enemy.hp = 0; events.push({ type: 'kill', x, y, angle: Math.atan2(y, x), facing: enemy.angle, targetId: enemy.id, remainingHp: 0, enemyKind: enemy.kind }); }
  };
  const xp = (amount: number, x = 110, y = -50) => {
    fallen(x, y);
    const levels = awardCharacterExperience(p, amount);
    events.push({ type: 'experience', amount, x, y });
    if (levels) events.push({ type: 'level', x: p.x, y: p.y, level: p.level, skillPoints: levels, statPoints: levels * 5 });
  };
  if (scene === 'level' && due(.5)) xp(65);
  if (scene === 'multi' && due(.5)) xp(720);
  if (scene === 'xp') for (const [i, at] of [.4, .7, 1.05].entries()) if (due(at)) xp(12 + i * 3, 100 - i * 60, -50 - i * 20);
  if (scene === 'burst') for (let i = 0; i < 8; i++) if (due(.4 + i * .3)) xp(14, Math.cos(i * 2.4) * 120, -40 + Math.sin(i * 2.4) * 70);
  if (scene === 'gold' || scene === 'burst') {
    for (let i = 0; i < 3; i++) {
      const born = .25 + i * .18, collect = 1.05 + i * .22, id = 700 + i;
      if (due(born)) { fallen(75 - i * 65, 5 + i * 14); sim.groundGold.push({ id, x: 75 - i * 65, y: 5 + i * 14, amount: [17, 28, 36][i], age: 0 }); }
      const pile = sim.groundGold.find(g => g.id === id);
      if (pile) {
        pile.age = time - born;
        const pull = Math.max(0, Math.min(1, (time - collect + .24) / .24));
        pile.x = (75 - i * 65) * (1 - pull * pull); pile.y = (5 + i * 14) * (1 - pull * pull);
      }
      if (due(collect) && pile) {
        creditGold(p.character, pile.amount);
        events.push({ type: 'gold', amount: pile.amount, balance: goldBalance(p.character), x: pile.x, y: pile.y });
        sim.groundGold = sim.groundGold.filter(g => g.id !== id);
      }
    }
  }
  return events;
}
