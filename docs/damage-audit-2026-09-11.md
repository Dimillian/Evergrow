# Offensive scaling audit — 11 September 2026

Audit of published v0.3.13 source `97753ec961415fedf661ac883c2337ff9760017b`. No runtime balance changes, save edits or deployment. Reproduce with `node --experimental-strip-types game/scripts/damage-audit.ts /tmp/damage-audit.json`.

Follow-up: the approved attribute-only slice and its repeated measurements are documented in [the implementation report](offensive-attribute-balance-2026-09-11.md). The numbers below remain the original pre-change audit.

## Conclusion

There is no broad duplicate spell-damage multiplier in the inspected combat path. The principal problem is the combined offensive budget: leveled and enhanced weapons, attribute rolls, skill potency and multiple contacts can exceed light-elite health before criticals or speed caps become relevant. This affects physical builds too. Halving Intelligence alone would leave a substantial problem.

## Evidence and limitations

- The original 24 ordinary/strong fixtures cover levels 10, 20, 35 and 50 across Cleave, Ricochet and Arc Lightning. These reuse the resource benchmark, with its intentionally unspent later skill points and eight recovery charms on strong builds.
- An additional 100 equipment sets per style use level 35, rank 5, Epic +5 equipment, three offensive attribute points and two Vitality points per level. Each slot greedily chooses among eight generated candidates for expected first-target DPS. Melee can choose a one- or two-handed sword/axe; bows and staves have light/heavy alternatives. No charms, specializations, extra passive spending or offhand bonuses. These model selection for damage, not a random-drop distribution, acquisition time, an optimal build or a controlled class-equality experiment.
- Actual 120 Hz simulation probes cover all 20 skills and 60 variants against one or eight pinned high-life bodies (160 cases), plus 120 distance/body-size cases. One cast, rank 1, no crits or prerequisite passives, large training mana and a 1,000-damage training weapon isolate contact coefficients over 20 seconds. Eight-body clusters deliberately overlap to measure coverage bounds. These are not practical DPS or survival tests.
- No fresh full Dimillian checkpoint was available to this audit. The prior September 11 observation was a level-34 cloud summary with historical Chronicle totals, not current equipment. None of the builds below are presented as Dimillian.

## 1. Strong builds exceed light-elite health across styles

A level-37 elite Stalker has **3,250 life**. A level-37 elite Brute has **9,343 life**. Archetype matters; the result does not mean every elite has 3,250 life.

| Level-35 damage-selected sample | Median noncritical first hit | Median expected hit including crit chance | Sets exceeding Stalker life without a crit |
| --- | ---: | ---: | ---: |
| Melee / Cleave | 5,687 | 6,622 | 100 / 100 |
| Bow / Ricochet | 3,139 | 3,619 | 39 / 100 |
| Caster / Arc Lightning | 6,272 | 6,408 | 100 / 100 |

These are analytical hits derived from the runtime formulas, not a claim that every aimed attack lands. Cleave must connect in melee; Ricochet must travel and collide. Arc Lightning selects a visible in-range target and applies the entire chain immediately on activation, then imposes recovery. That makes its high first-hit damage especially reliable before enemies can act.

The less deliberately selected, original strong fixtures already cleared the light elite in 0.675 seconds with Cleave, 1.083 seconds with Ricochet and one simulation tick with Arc Lightning. Their Warden probes took 7.275, 12.75 and 5.9 seconds respectively. These are the prior resource benchmark's stationary, potion-enabled encounters, not the new pinned-target probes. They remain far below the proposed elite 4–8-second / boss 30–60-second playtest bands.

## 2. Attributes are strong offensive affixes, not just character foundations

Strength adds 2 percentage points of attack damage per point; Intelligence adds 3 of spell damage. Allocated points, equipment attributes, charm attributes and tree attributes all use those rates. Attributes and direct damage bonuses add inside one multiplier; they do not multiply each other separately.

A level-35 Epic +5 cloth head item at a middle roll can grant:

| Affix | Roll | Damage contribution |
| --- | ---: | ---: |
| Intelligence | +18 | +54 percentage points of spell damage, plus 36 mana |
| Spell damage | +19% | +19 percentage points of spell damage |

Both are eligible on the same item. Intelligence is nearly three times as strong offensively in this example while also supplying mana. Attribute affixes grow linearly with item level; direct percentage affixes taper. Therefore the imbalance widens with level. Strength has the same structural issue, at a smaller conversion rate.

In the original strong caster fixture, 102 allocated Intelligence points, 75 equipment points and two tree points produce 189 Intelligence. The complete spell multiplier is **7.01×**, including +64% direct spell bonuses. Its 280 weapon damage becomes 1,963 before Arc Lightning's rank-5 **2.24×** potency, producing **4,397 noncritical damage**. It has no bonus skill ranks or damage specialization and only 5.275% crit chance.

An analytical reduction of Intelligence's damage conversion to 1.5% lowers this fixture's expected hit from 4,606 to 2,841 (about 38%). That alone still allows very short elite fights and does not address physical builds.

## 3. Weapon and skill upgrades compound

The main chain is:

`weapon profile × level × material × rarity × enhancement → attribute/direct-damage multiplier → skill potency × effective-rank factor × leaf potency × specialization × optional Overload/Spellweave → critical → contacts`

Attack/cast speed increases actions per second, not per-hit damage. Cooldowns limit advanced skills independently. Elemental melee damage is an additional weapon-local component scaled by spell bonuses and included once before skill/critical scaling.

- Weapon level grows as `1 + 0.13 × (level − 1)`.
- Same-material Common → Legendary +10 multiplies weapon base damage by **2.25**, before changed affixes or skill bonuses. This comparison excludes material upgrades.
- A crystal melee/caster weapon adds another **1.55×** over its ordinary material. These are useful rewards, but enemy health does not gain parallel gear-quality or enhancement layers.
- Monster health is already quadratic: weapon-level growth multiplied by `1 + 0.055 × (level − 1)`. With three offensive allocated points per level, the corresponding additional attribute factor is `1 + 0.09n` for magic and `1 + 0.06n` for physical damage. This is a coefficient/budget mismatch, not a simple linear-monsters-versus-exponential-players problem.

## 4. Equipment ranks add cost-free potency

Rank potency uses `1 + 0.15 × (purchased rank + bonus ranks − 1)`. Mana and cooldown growth use purchased rank only.

| Purchased rank 5 | Potency relative to no equipment ranks | Additional mana cost |
| --- | ---: | ---: |
| +3 equipment ranks | +28.1% | None |
| +10 equipment ranks | +93.8% | None |

The +10 case is a cap scenario, not an observed typical build. Individual +3 rolls require level 30 and occupy the upper 2% of the rank quantile before the low chance of rolling the desired skill affix. The additional gear samples reached only +3 melee/caster or +4 bow ranks. Crucially, the original caster's elite one-shot occurs at **zero** equipment ranks.

Skill leaves add another 6–18% in a separate multiplier. Arcane Overload adds 30% with a 60% cost tradeoff. These rules are applied once, but must share a total offensive budget.

## 5. Multi-contact spells need total-cast budgets

| Action, original rank 1 | Verified direct damage to one centered stationary target, relative to derived weapon damage |
| --- | ---: |
| Meteor | 3.4×, one impact |
| Shattered Sky | 7.65×, all five impacts |
| Cataclysm | 19.6×, all seven impacts |
| Falling Stars | 20.02×, all eleven impacts |
| Forked Flame against a Warden at 100 units | About 2.83×, all three projectiles |

Scattered meteor centers are at most 70% of their own blast radius away from the aim point. Consequently every impact includes a centered target, even a small Stalker. The apparent spread does not spread damage away from that target. This is authored overlap, not duplicate collision handling. Dodging and moving can still avoid later impacts.

Projectile fans are geometry-dependent: Forked Flame hit a small Stalker with all three projectiles at 35 units, but only one at 100 or 300 units. Against the larger Warden, all three connected at 100. Each projectile owns its own hit ledger. A projectile's direct impact plus explosion does **not** double-hit the same enemy, and ordinary ricochet/pierce excludes previously hit targets.

Arc Lightning Original visits five distinct targets with falloff. Storm Circuit deliberately allows revisits: the nearest-target rule can alternate between two neighbors, concentrating damage even in a larger pack. It does not gain eight full-power contacts; falloff remains applied. Concentrated Current increases first-target damage 60% while retaining three targets. Static Thread preserves about 92% of Original's aggregate five-target direct damage for 70% of its base mana, before required leaf bonuses.

## 6. One concrete burn-budget inconsistency

Generic fire contact applies a 15%-of-hit burn for two seconds. Fireball then requests a 12%-of-hit burn for three seconds. The shared strongest-value/longest-duration rule combines the **15% rate with three seconds**, yielding approximately **45%** extra noncritical hit damage, rather than the explicit Fireball payload's 36%.

This is not two additive burn stacks or recursive burn damage. It is two independently authored sources merging into a stronger rate/longer duration combination. The 1,000-weapon probe recorded 1,450 direct damage and 654 burn damage (integer tick rounding). Meteor/ground-fire budgets also interact with this shared contact burn. One authoritative burn recipe per action would make total damage easier to predict. No fix applied during this audit.

## 7. Charms and critical/speed limits

At level 35, a middle-roll Rare Storm Pebble can pair +2% cast speed with +4 Intelligence. Eight such selected stones add **16% cast speed and 32 Intelligence (+96 percentage points of spell damage)** in eight cells. These are possible selected rolls, not guaranteed drops; the first affix remains thematic.

For the same eight-cell area, a Rare Monolith's individual middle rolls are +8% cast speed and +14 Intelligence, although it has five affixes versus sixteen total across eight Rare pebbles. Thus the small-stone concentration advantage persists for offense after the mana-regeneration correction. It needs per-cell/per-affix tradeoffs, not simply another reduction of regeneration.

In the 300 damage-selected equipment sets, median crit chance was 13.7% melee, 16.3% bow and 4% caster—far below the 75% cap. Median crit multipliers were 1.89×, 2× and 1.68×—far below the 5× cap. Median action rates were approximately 1.95, 1.91 and 1.72/sec. Lowering extreme crit/speed caps alone would not fix this observed power range. Highly selected offensive charm grids can add more, but are not needed to reproduce excessive damage.

## Recommended order

1. Rebalance allocated and rolled attributes together with direct damage affixes. Compare both Strength and Intelligence; preserve meaningful character investment and offer an attribute respec if live allocations change.
2. Give each skill a total single-target and pack damage budget per cast. Address guaranteed meteor overlap, close-range projectile fan overlap, and the burn-source inconsistency before trying to offset them with universal enemy health.
3. Reduce the marginal payoff from equipment ranks while keeping +skill items desirable. Test lower/tapered rank benefits before imposing costs that make a newly equipped item unusable.
4. Evaluate offensive charms by occupied cells and available affix slots. Keep utility identities useful; avoid replacing infinite mana with a full small-stone damage/speed grid.
5. Re-run this fixed suite, then tune light/heavy elites and bosses separately against the corrected player output. Preserve quick trash clearing and existing regional snapshots. Do not use per-player DPS scaling or invisible minimum-hit protection.

No balance changes are included in this audit checkpoint. The script and this report are development-only and excluded from production entrypoints.
