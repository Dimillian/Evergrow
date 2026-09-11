# Resource balance benchmark

Local September 11, 2026. `/progression.html?view=power` includes a repeatable before/current resource table. The frozen baseline in `game/src/tools/data/resource-baseline.json` uses pre-tuning rules; do not regenerate it during tuning.

Run `node --experimental-strip-types game/scripts/resource-benchmark.ts /path/to/report.json` for the current 28-build / 84-encounter suite. Fixtures cover levels 10/20/35/50, melee/bow/caster, Rare rank-3 and Epic +5 rank-5 gear. Strong fixtures carry eight deliberately selected recovery pebbles; the caster sustain case fills all 48 cells. These are synthetic comparisons, not estimated Dimillian equipment. Other skill points remain unspent; three attribute points per level go to Intelligence for casters or Strength for physical builds, and two to Vitality.

Encounter probes use actual 120 Hz combat against eight normal Stalkers, one +2 elite Stalker or one +3 Warden. The stationary character repeats its core skill and drinks below 25% mana; no dodge, movement, retreat or deliberate pickup collection. Damage, AI, incidental pickups, level-ups and deaths remain real. A null clear time means uncleared within 45 seconds or player death. The separate burst estimate assumes continuous cadence without kills, pickups or potions; it is not combat survival time.

Chronicle now records actual mana recovery under `manaRecovery:passive`, `:kill`, `:vial` and `:potion`, capped by missing mana as with the existing total. Historical saves retain their totals but have no retrospective source breakdown. No save reset or automatic cloud access.

## First local tuning slice

- Intelligence grants +2 mana per added point, down from +4; spell damage remains +3%.
- Resource affixes and implicit mana bonuses taper with item level. Mana on kill is reduced alongside passive recovery.
- Mana-regeneration modifiers use mana per five seconds; whole item rolls no longer become a minimum +1/sec per pebble. Tree recovery values are converted to the new unit with their original per-second strength.
- Cost reduction is linear through 20%, then tapers toward 40%. Life recovery, potion fractions and charge cadence remain unchanged.
- Mana vials snapshot `round(8 + 0.35 × (enemyLevel − 1))` at death and restore at most 16% of the collecting character's maximum mana, capped by missing mana. Existing stored mana vials without a source amount use the level-one amount (8); this avoids inventing a historical enemy level. They remain valid and collectible. Health vials keep percentage recovery.
- Existing owned and dropped item recipes without `manaVersion: 1` are repriced for resource stats only during validated read. No character/world reset. Deploy client and Worker together in a future requested release; reload clients to use the new units.

The original benchmark remains the before reference. The first slice deliberately leaves damage, criticals, skill potency, control, monster stats and enemy cadence unchanged. Strong caster fixtures may still kill an elite immediately; resource correction alone does not establish the target combat difficulty.

Level-35 synthetic caster comparison (not a cloud character):

| Build | Maximum mana, before → after | Mana/sec, before → after |
| --- | --- | --- |
| Ordinary | 881 → 465 | 14 → 4 |
| Strong, eight recovery pebbles | 1,134 → 563 | 37 → 9 |

Expected first-hit damage is unchanged across all 28 fixtures, covered by a regression against the frozen baseline. The strong caster still immediately kills the benchmark elite; that is evidence for the next damage/encounter slice, not a successful difficulty target.
