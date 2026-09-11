# Loot quality and combat tuning — 11 September 2026

Local follow-up to the [offensive attribute slice](offensive-attribute-balance-2026-09-11.md). Changes are checkpointed to Git; no Site publication or cloud-character edits.

## Loot worth pursuing

Continuous affixes now roll **65–135% of their midpoint**, previously 85–115%. The midpoint, item rarity multipliers, 0/1/2/3/4 equipment affix counts, drop rates and discrete skill-rank/pierce quantiles remain unchanged. Excellent rolls become stronger; weak rolls become weaker. Rounding and resistance caps still apply, so not every small or capped bonus spans the full ratio.

Examples at level 35 without enhancement: Legendary gloves now range **+22–45% cast speed**, previously +29–39%. A defensive Legendary chest's maximum-life affix spans **+118–245**. Existing items retain affix types, saved quality percentiles, IDs, materials, enhancement and locks; explicit affixes update once on validated load, including stash/buyback and surface/dungeon ground loot. This does not randomly reroll a character's gear or reset progression.

Controlled single-slot comparisons hold all other pieces of the level-35 strong fixture constant:

| Identical Legendary piece, all four rolls low → high | Actual build result |
| --- | --- |
| Ashwood Ember Staff: spell damage, Intelligence, crit chance, crit damage | Expected action DPS **2,460 → 2,759**, **+12.2%** |
| Iron chest: life, armor, Vitality, life regeneration | Maximum life **917 → 1,110**; physical effective life **1,804 → 2,352**, **+30.4%** |

These are complete eligible affix combinations, not typical drops or probabilities of finding four perfect rolls. The staff's raw damage stays fixed in this comparison; percentage affixes add to existing bonuses, rather than independently multiplying total damage. Its spell-damage affix itself changes +22% → +47%. Physical effective life is maximum life divided by one minus the sheet's same-level physical reduction; it excludes block, avoidance and regeneration. Actual survival depends on attacks and play.

## Damage budgets and skill identity

- **Projectile fans:** every enemy takes one full hit, then 35% damage from additional projectiles in that cast. Shared ledgers include explosions and piercing/fan variants; a projectile's own once-per-target ledger remains authoritative.
- **Meteor barrages:** first impact against each enemy is full damage; repeats from that cast deal 20%. Repeated direct hits also scale their explicit burn and life-on-hit. Independent casts do not share ledgers. Ground fire remains a separate authored effect and never stacks additively.
- **Shattered Sky:** outer impact centers spread to 1.6 impact radii, giving the five smaller impacts more coverage to compensate for lower focused damage. Obstructed offsets use the existing center fallback with the same repeat budget.
- **Fireball:** its explicit burn now owns the contact rate: 12%/second for three seconds, rather than a hybrid generic 15% rate for three seconds. Generic fire bolts/melee retain their original burn.
- **Equipment ranks:** first three add 12 percentage points each to the rank multiplier; later ranks add five. At purchased rank 5, +3 remains a **22.5% damage upgrade**; +10 gives 44.4% instead of 93.8%. Purchased rank costs/progression, the ten-rank cap and Bulwark utility are unchanged.

In actual single-cast simulations, centered Cataclysm direct damage falls **19.6× → 6.16× weapon damage**, Falling Stars **20.02× → 5.46×**, and Extinction **16.8× → 7.84×**. Impacts still render and connect individually. Fireball retains its **1.45× direct hit**; its isolated burn becomes **0.522× instead of 0.654×** after tick rounding. Shattered Sky's maximum overlapping budget is 2.754×, with fewer impacts connecting to a centered small body now that its pattern covers more ground.

## Elite challenge without slower trash

Non-boss elite health gains a gradual source-level bonus: unchanged through level 14, rising to **+50% at level 37**, capped thereafter. The home region's +2 elite levels are covered by the unchanged range. Normal/veteran health and boss health, damage, attack cadence, rewards and loot rates are unchanged. This never reads player gear or DPS.

For the same 100 damage-selected level-35 equipment sets per style, noncritical one-shots against the level-37 light elite change as follows:

| Style | Before this follow-up | After wider rolls only | Final skills + elite durability |
| --- | ---: | ---: | ---: |
| Melee / Cleave | 88/100 | 90/100 | **15/100** |
| Bow / Ricochet | 2/100 | 2/100 | **0/100** |
| Caster / Arc Lightning | 46/100 | 46/100 | **1/100** |

The target's life changes **3,250 → 4,875** in the final column; the table does not imply these improvements all came from player damage reductions. Final median noncritical hits are 4,041 melee, 2,262 bow and 3,199 caster, close to 4,044/2,252/3,181 before this follow-up. Gear selection still matters, and exceptional melee sets can cross the new threshold.

In the fixed level-35 strong encounters, elite clear times change **1.18 → 1.69 seconds** melee, **1.60 → 2.13** bow, and **0.85 → 1.69** caster. Trash-pack times remain **0.17/0.63/0.85 seconds**; boss times remain **9.31/15.90/10.11 seconds**. There are no additional deaths in the 84 resource encounters compared with the preceding attribute slice.

## Limits and next decisions

This is a controlled synthetic suite: 24 ordinary/strong builds, 300 greedily damage-selected gear sets, 280 isolated skill/body/formation probes, and 84 stationary resource encounters. It is not a fresh audit of Dimillian's cloud character or a live gameplay test. The gear optimizer can select different winners after tuning. Stationary encounters do not dodge/kite, and late skill points remain unspent.

Elite fights remain short for geared builds; the melee fixture still kills its light elite before it attacks. High critical rolls can also cross thresholds that the noncritical table does not count. The next useful pass is elite action opportunities and mechanics, particularly interruption/knockback and heavy-versus-light archetype identity, rather than making every trash mob a health sponge. Legendary-exclusive effects remain future content; this pass improves roll quality, not unique-item powers.

Restored actors retain their saved current HP while maxima rebuild from current source-level rules. They are not healed by loading; fresh encounters show the complete higher health budget. Progress, item identities and saved encounter levels remain compatible.

Reproduce with `node --experimental-strip-types game/scripts/damage-audit.ts /tmp/damage-audit.json` and `node --experimental-strip-types game/scripts/resource-benchmark.ts /tmp/resource-benchmark.json`. Both are save-free headless tools. The damage audit records current coefficients, target life and the controlled item-upgrade cases.


Validation: the full 1,232-test suite passed. After the final Shattered Sky coverage adjustment, 51 focused skill/combat tests passed, including the new coverage regression (1,233 distinct tests covered overall). TypeScript app/core checks and the final production build passed; the existing large-chunk advisory remains. No browser gameplay automation was run.
