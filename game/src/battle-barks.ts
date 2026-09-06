import type { CombatEvent } from './model.ts';
import { GAME_FEATURES } from './game-features.ts';
import { BARK_RULES as RULES, BATTLE_BARKS, canBark, type BarkKind } from './battle-bark-content.ts';

export interface BattleBark { id: number; kind: BarkKind; text: string; started: number; }
interface Encounter { engaged: boolean; disengagedAt: number; attemptedAt: number; }
type Engagement = Extract<CombatEvent, { type: 'engagement' }>;

/** Bounded, disposable presentation. Fixed-tick engagement edges are the only trigger.
 * Randomness is injected independently of every simulation/loot RNG. */
export class BattleBarks {
  private encounters = new Map<number, Encounter>();
  private pending = new Map<number, Engagement>();
  private recent = new Map<BarkKind, string[]>();
  private bubbles: BattleBark[] = [];
  private nextStart = -Infinity;
  private random: () => number;
  constructor(random: () => number = Math.random) { this.random = random; }
  get active(): readonly BattleBark[] { return this.bubbles; }
  get trackedCount(): number { return this.encounters.size; }
  reset(): void {
    this.encounters.clear(); this.pending.clear(); this.recent.clear();
    this.bubbles = []; this.nextStart = -Infinity;
  }
  noteEvents(events: readonly CombatEvent[]): void {
    if (!GAME_FEATURES.battleBarks) { this.reset(); return; }
    for (const event of events) {
      if (event.type === 'kill') { this.remove(event.targetId); continue; }
      if (event.type !== 'engagement' || !canBark(event.enemyKind)) continue;
      let encounter = this.encounters.get(event.targetId);
      if (!encounter) {
        // No unbounded historical actor ledger, and no eviction that rearms a living foe.
        if (this.encounters.size >= RULES.maxTracked) continue;
        encounter = { engaged: false, disengagedAt: -Infinity, attemptedAt: -Infinity };
        this.encounters.set(event.targetId, encounter);
      }
      if (event.engaged === encounter.engaged) continue;
      encounter.engaged = event.engaged;
      if (!event.engaged) {
        encounter.disengagedAt = event.time; this.remove(event.targetId); continue;
      }
      if (event.time - encounter.disengagedAt < RULES.disengagedFor
        || event.time - encounter.attemptedAt < RULES.retryAfter) continue;
      encounter.attemptedAt = event.time;
      // One roll even when space/visibility later suppresses the result. No retries.
      if (this.random() < RULES.chance) this.pending.set(event.targetId, event);
    }
  }
  private remove(id: number): void {
    this.pending.delete(id); this.bubbles = this.bubbles.filter(bark => bark.id !== id);
  }
  /** Place rechecks all active speakers first. Rejected bubbles disappear, never queue.
   * time is the simulation clock: menus and durable save barriers cannot age speech. */
  update(time: number, livingIds: ReadonlySet<number>, enabled: boolean,
    visible: (id: number, event?: Engagement) => boolean,
    place: (bark: BattleBark) => boolean): void {
    if (!GAME_FEATURES.battleBarks) { this.reset(); return; }
    for (const id of this.encounters.keys()) if (!livingIds.has(id)) {
      this.encounters.delete(id); this.remove(id);
    }
    this.bubbles = this.bubbles.filter(bark => time - bark.started < RULES.duration && visible(bark.id));
    if (!enabled) { this.pending.clear(); return; }
    this.bubbles = this.bubbles.filter(place);
    const candidates = [...this.pending.values()]; this.pending.clear();
    // Fisher-Yates avoids first-in-roster bias when several enemies engage on one tick.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(this.random() * (i + 1)));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const event of candidates) {
      if (time + 1e-9 < this.nextStart || this.bubbles.length >= RULES.maxVisible
        || !visible(event.targetId, event) || !canBark(event.enemyKind)) continue;
      const previous = this.recent.get(event.enemyKind) ?? [];
      const choices = BATTLE_BARKS[event.enemyKind].filter(line => !previous.includes(line));
      const line = choices[Math.min(choices.length - 1, Math.floor(this.random() * choices.length))];
      const bark = { id: event.targetId, kind: event.enemyKind, text: line, started: time };
      if (!place(bark)) continue;
      this.bubbles.push(bark); this.nextStart = time + RULES.spacing;
      this.recent.set(event.enemyKind, [...previous, line].slice(-3));
    }
  }
}
