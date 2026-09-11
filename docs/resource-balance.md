# Resource balance benchmark

Local September 11, 2026. `/progression.html?view=power` includes a repeatable before/current resource table. The frozen baseline in `game/src/tools/data/resource-baseline.json` uses pre-tuning rules; do not regenerate it during tuning.

Run `node --experimental-strip-types game/scripts/resource-benchmark.ts /path/to/report.json` for the current 28-build / 84-encounter suite. Fixtures cover levels 10/20/35/50, melee/bow/caster, Rare rank-3 and Epic +5 rank-5 gear. Strong fixtures carry eight deliberately selected recovery pebbles; the caster sustain case fills all 48 cells. These are synthetic comparisons, not estimated Dimillian equipment. Other skill points remain unspent; three attribute points per level go to Intelligence for casters or Strength for physical builds, and two to Vitality.

Encounter probes use actual 120 Hz combat against eight normal Stalkers, one +2 elite Stalker or one +3 Warden. The stationary character repeats its core skill and drinks below 25% mana; no dodge, movement, retreat or deliberate pickup collection. Damage, AI, incidental pickups, level-ups and deaths remain real. A null clear time means uncleared within 45 seconds or player death. The separate burst estimate assumes continuous cadence without kills, pickups or potions; it is not combat survival time.

Chronicle now records actual mana recovery under `manaRecovery:passive`, `:kill`, `:vial` and `:potion`, capped by missing mana as with the existing total. Historical saves retain their totals but have no retrospective source breakdown. No save reset or automatic cloud access.
