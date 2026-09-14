# Level-50 loot audit — retuned, September 14, 2026

Same deterministic 150,000 monster kills (50,000 per rank) and 20,000 unkeyed rift completions as the [original audit](loot-level50-2026-09-14.md). **265,062 equipment/charm drops; zero invalid items.** Working-tree tuning based on `71ecbea`; the JSON records source state. No player saves are used by the audit.

## Shipped local rules

- Random melee weapons and bows exclude caster-only affixes. Existing obsolete physical-weapon caster affixes receive nonconflicting weapon replacements with their saved quantiles retained.
- Weapon material premiums retain 35% of their former size: Crystal melee/caster bases are +19.25%, down from +55%; Crystal bows are +12.25%, down from +35%. Ordinary Iron/Ashwood bases stay unchanged.
- Random weapon damage affix potency doubles (×2 → ×4). Random glove speed potency falls by 25% (×4 → ×3).
- Armor, resource sustain, affix counts, rarity and quantity tables remain unchanged. All Unique combat stats were compared with the preceding implementation at levels 1/25/50/100 and remain identical.
- Gear power now accounts for actual roll values and affix relevance; it remains a build-neutral quality estimate, not build DPS or Unique power valuation.

## Repeated results

Affix uplift compares each winning item against its own identical base/level/rarity without affixes. Each run can select a different winner. DPS is the same isolated basic-attack fixture as before, not encounter DPS; compare within each category.

| Category | Previous best | Current best | Previous affix uplift | Current affix uplift | Legendary median change |
|---|---:|---:|---:|---:|---:|
| One-handed melee | 2,103.07 | 1,877.91 | 22.8% | 34.7% | +2.0% |
| Two-handed melee | 2,597.92 | 2,255.79 | 16.7% | 31.7% | +2.5% |
| Bow | 1,234.11 | 1,278.99 | 64.9% | 105.6% | +16.5% |
| Wand | 2,065.57 | 1,785.43 | 20.3% | 35.1% | +1.9% |
| Staff | 2,067.12 | 1,876.12 | 18.9% | 38.2% | +3.2% |
| Caster robe — damage | 898.80 | 898.80 | 13.5% | 13.5% | +0.0% |
| Caster robe — mana sustain | 2.99 | 2.99 | 199.0% | 199.0% | +0.0% |
| Metal body armor | 1,722.23 | 1,722.23 | 117.4% | 117.4% | +0.0% |
| Leather body armor | 483.94 | 483.94 | 31.3% | 31.3% | +0.0% |
| Shield | 2,191.50 | 2,191.50 | 82.4% | 82.4% | +0.0% |
| Melee gloves | 1,290.29 | 1,189.26 | 63.3% | 50.5% | +0.0% |
| Caster orb | 937.06 | 937.06 | 16.4% | 16.4% | +0.0% |

The old sample had caster bonuses on 3,615 / 5,707 unenchanted Epic/Legendary melee weapons (63.3%). The new sample has **0 / 5476**. The denominator changes because selecting from the smaller pool also changes which weapons roll elemental enchantments.

The best two-handed melee affix uplift rises from 16.7% to 31.7%, and wand uplift from 20.3% to 35.1%. Typical Legendary melee/caster throughput is within +2–3.2% of the prior medians. Bow median DPS rises 16.5% because bows already had a coherent physical pool; this is the clearest follow-up playtest target. The strongest sampled bow is only 3.6% above its previous winner, while precious-base melee/caster extremes come down.

Body armor, robe damage/sustain, shields and caster off-hands produce the same results as before. Glove high-roll throughput falls from +63.3% to +50.5% over the fixed weapon baseline; useful speed rolls remain exciting.

## Standout current drops

All unenhanced. The companion JSON retains the top three full recipes per category.

| Role | Base / name | Seed | Affixes |
|---|---|---:|---|
| One-handed melee | Gold Warden Axe — Thornwrought Memory | 4068419175 | Whirlwind ranks +2; Attack damage +72%; Strength +9; Dexterity +22 |
| Two-handed melee | Crystal Greataxe — Thornwrought Oath | 3580665801 | Life on hit +12; Dexterity +24; Attack damage +74%; Area of effect +27% |
| Bow | Crystal Warden Longbow — Ashen Remnant | 1882913485 | Strength +11; Critical chance +4%; Dexterity +22; ✦ Attack damage +76% |
| Wand | Crystal Star Wand — Gloaming Remnant | 2437883567 | Intelligence +9; Mana / 5 sec +6; Critical chance +3%; Spell damage +93% |
| Staff | Gold Ember Staff — Graveglass Promise | 407616364 | Critical damage +13%; ✦ Spell damage +98%; Critical chance +4%; Intelligence +9 |
| Metal body armor | Iron Cuirass — Mournful Oath | 1977594883 | ✦ Vitality +29; ✦ Maximum life +336; Life / sec +9; ✦ Armor +253 |
| Melee gloves | Iron Gauntlets — Moonlit Oath | 439539799 | ✦ Attack speed +35%; Dexterity +25; Attack damage +13%; Critical chance +3% |

## Power and save checks

The same level-50 Legendary Iron Cuirass (seed 1977594883; Vitality, life, regeneration, armor) previously scored 548 at both minimum and maximum rolls. It now scores **852 → 1,128**, with level/material/rarity held fixed. This is a new score scale; old and new score magnitudes are not directly comparable.

A controlled 147-Strength / 98-Vitality allocation with no other gear verifies that a maximum-roll Iron Greataxe (attack damage, Strength, Dexterity, crit chance) beats a minimum-roll Crystal Greataxe with the same four affixes. This is an authored comparison separate from the randomly found winners.

On load, affected random weapon/glove budgets are refreshed only after save validation. Item IDs, levels, enhancements, quantiles, ownership, unrelated stats and character progress persist. Starter equipment and Unique combat budgets remain intact. Cached power numbers are recalculated; Unique fixed affix values are still strictly validated.

## Validation

- 1,531 code tests pass, including generation, all enchantment operations, saved-weapon replacement, power scoring, Unique integrity and higher-resolution prop geometry.
- Type checks and production build pass (existing bundle-size advisory).
- No automated gameplay tests or deployment. The user will judge combat feel locally.

```sh
node --experimental-strip-types game/scripts/loot-audit.ts /tmp/evergrow-loot-audit-retuned.json
```
