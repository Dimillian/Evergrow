# Offensive attribute balance — 11 September 2026

Local implementation following the [v0.3.13 damage audit](damage-audit-2026-09-11.md). No Site publication or online save edits.

## Implemented slice

- Strength damage conversion: **2% → 1.5%** per point above ten.
- Intelligence spell/elemental conversion: **3% → 1.5%**. Mana remains two per point; Intelligence grants no regeneration.
- Strength/Intelligence item and charm affixes now taper with level. A level-35 Epic +5 middle head roll becomes **+9 instead of +18**. Sage/Lion pendant implicits follow the same bounded budget. Actual rolls remain whole numbers.
- Dedicated damage affixes retain their values. The example's **+19% spell damage** now beats the Intelligence roll's **+13.5% spell damage**, while Intelligence also supplies 18 mana.
- Enchanter → Respec → Attributes offers **one free full attribute reset per character**. Assigned points are refunded; existing skill builds and equipment persist. No automatic reset.
- Old items reprice once on validated load across equipment, charms, stash, buyback and ground/dungeon loot. Item identities, rolls, locks, enhancement and unrelated affixes survive. Character progress remains compatible.

Dexterity, Vitality, direct offensive affixes, weapon base damage, skill ranks/multipliers, contacts/status rules and enemy health/attacks are unchanged. Lower gear Intelligence also reduces maximum mana; the previous mana patch's direct bonuses and regeneration rules are not reduced again.

## Repeat method

Same 24 deterministic ordinary/strong fixtures (levels 10, 20, 35, 50; melee/bow/caster), same 300 damage-selected level-35 equipment samples, and the same 280 isolated single-cast contact probes. The sample optimizer selects among the same eight candidates per slot under the new rules, so individual winners can change; the fixed fixtures keep the same recipes and rolls. The resource benchmark covers 28 builds and 84 actual headless encounters, including four extreme sustain fixtures.

These are synthetic builds, **not a fresh capture of Dimillian's cloud character**. The stationary encounter probes do not dodge or kite, drink when mana falls below 25%, and use a 45-second limit. Later skill points remain unspent in these fixtures. Their clear times measure this fixed scenario, not expected full-game fight lengths or class parity. Contact probes use pinned high-life targets and one cast to isolate coefficients, not player survival.

## Selected gear still has excessive elite burst

Level 35, Epic +5, purchased rank 5, three offensive/two Vitality points per level; no charms, specialization, additional tree passives or offhand. Target: level-37 elite Stalker, **3,250 life**.

| Style | Median noncritical first hit, before → after | Reduction | Sets one-shotting without a crit, before → after |
| --- | ---: | ---: | ---: |
| Melee / Cleave | 5,687 → 4,044 | 29% | 100/100 → 88/100 |
| Bow / Ricochet | 3,139 → 2,252 | 28% | 39/100 → 2/100 |
| Caster / Arc Lightning | 6,272 → 3,181 | 49% | 100/100 → 46/100 |

Including critical probability, median expected hits fall 6,622 → 4,861 melee, 3,619 → 2,711 bow, and 6,408 → 3,255 caster. This is a meaningful improvement, but high-end melee/caster light-elite one-shots remain frequent. A level-37 elite Brute has 9,343 life; these figures do not describe every elite archetype.

## Fixed encounters preserve fast trash clearing

Level-35 strong fixtures, actual simulation seconds:

| Style | Eight-foe trash pack | Light elite | Warden boss |
| --- | ---: | ---: | ---: |
| Melee | 0.17 → 0.17 | 0.68 → 1.18 | 7.27 → 9.31 |
| Bow | 0.63 → 0.63 | 1.08 → 1.60 | 12.75 → 15.90 |
| Caster | 0.85 → 0.85 | 0.008 → 0.85 | 5.90 → 10.11 |

Caster first-target expected damage falls **4,606 → 2,478**; the elite now requires two casts in this probe. Its maximum mana drops **563 → 489**, regeneration remains **9/sec**, and the tested skill still costs **16.8 mana**. Its analytical isolated burst window falls 50.45 → 43.82 seconds. All three level-35 strong fixtures still clear these encounters without running out of mana.

The ordinary melee fixtures at levels 35 and 50 newly die against the Warden when standing still. Seven other fixture deaths already existed before this slice. This argues against another blanket player-damage reduction without separately examining lower-gear survival and skill efficiency.

Across levels 10/20/35/50, the fixed strong caster's expected hits change **829/1,987/4,606/8,234 → 569/1,198/2,478/4,082**. The correction grows with gear and level rather than heavily changing the baseline starter attack.

## What remains

All **160 skill/formation and 120 distance/body probes match the original normalized results exactly**. Equipment-rank potency/mana cases also match. This confirms the slice isolated attribute budgets; it does not fix guaranteed meteor overlap, projectile fan concentration, Fireball's merged burn budget or cost-free extra-rank potency.

Next, give skills explicit total single-target/pack budgets, starting with the overlapping multihit actions and burn inconsistency. Then taper equipment-rank potency and recheck elite archetypes. Retain rewarding dedicated damage affixes and fast trash clearing; avoid another universal stat nerf or universal monster health increase before those measurements.

## Reproduction

Run from the repository root; output files contain no cloud save data:

```sh
node --experimental-strip-types game/scripts/damage-audit.ts /tmp/damage-audit.json
node --experimental-strip-types game/scripts/resource-benchmark.ts /tmp/resource-benchmark.json
```

The audit now records the actual source revision, working-tree state and shared attribute rates instead of a hardcoded old revision. The old half-Intelligence counterfactual was removed because that rate is now implemented.


Validation: all 1,221 tests in the full suite passed, followed by the additional resource-clamp regression (1,222 distinct passing tests). TypeScript app/core checks and the production build passed. The build retains the existing large-chunk advisory. No automated browser gameplay or online character edits were performed.
