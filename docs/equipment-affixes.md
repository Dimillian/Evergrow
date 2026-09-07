# Equipment affixes and hybrids

Current rules · September 7, 2026. Generation, rarity upgrades and rerolls share `itemAffixPool`, `rollAffix` and `affixConflicts` in `items.ts`. There are still 24 affix definitions; this pass adds no new stat families. Tier counts remain 0 / 1 / 2 / 3 / 4.

## Slot pools

| Slot / family | Eligible explicit affixes |
| --- | --- |
| Head | Mana, Intelligence, mana cost reduction, cooldown reduction, life, armor |
| Chest | Life, armor, Vitality, life regeneration, Strength |
| Gloves | Attack speed **or** cast speed, critical chance, attack damage, spell damage, Dexterity, armor |
| Legs | Life, armor, Vitality, life regeneration, Strength, Dexterity |
| Boots | Movement speed, life, armor, Vitality, Dexterity |
| Cloak | Life/mana regeneration, cooldown reduction, life, mana, Intelligence |
| Rings | Critical chance/damage, attack/spell damage, Strength/Dexterity/Intelligence, mana, mana regeneration |
| Amulet | All 19 general affixes plus both block affixes; weaker specialist rolls |
| Shields | Block chance/reduction, armor, life, Vitality, life regeneration, Strength |
| Melee weapons | Attack damage, critical chance/damage, life on hit, Strength, Dexterity, Intelligence, spell damage, one fire/frost/lightning enchantment |
| Bows | Attack damage, critical chance/damage, Dexterity, life on hit, Strength |
| Staves / wands | Spell damage, Intelligence, mana, critical chance/damage, mana cost reduction, mana regeneration |
| Grimoires | Mana, mana regeneration, mana cost/cooldown reduction, Intelligence, spell damage |
| Orbs | Spell damage, critical chance/damage, Intelligence, mana, mana cost reduction |

Amulets are the explicit exception to boots-only movement and gloves-only speed. Weapon elemental affixes are local to melee weapons and are not in the amulet pool. Amulet block affixes still require a shield to function. Attack/cast-speed rolls are mutually exclusive on one item. These restrictions concern explicit rolls; attribute/tree bonuses and existing focus implicits retain their roles.

## Weights and specialist budgets

Ordinary affixes have weight **1**. Critical chance, life on hit, cooldown reduction and mana cost reduction have weight **0.55**. Each of the three melee elemental affixes has weight **0.12**. Draw without replacement, removing conflicting families after each choice. Weights apply equally to drops and enchanting. An initial melee affix is elemental with probability `0.36 / 7.46 ≈ 4.8%`; higher tiers provide additional opportunities, never two elements. Item rarity/drop tables are unchanged.

Multiply the existing affix base and growth by these slot budgets before rounding:

| Specialty | Multiplier |
| --- | ---: |
| Boots movement / amulet movement | ×5 / ×2.5 |
| Gloves attack or cast speed / amulet speed | ×4 / ×2 |
| Chest life, armor, life regeneration | ×1.75 |
| Head mana and mana cost reduction | ×1.5 |
| Cloak life/mana regeneration and cooldown reduction | ×1.5 |
| Grimoire mana, mana regeneration and cost reduction | ×1.5 |
| Orb spell damage and critical chance/damage | ×1.5 |
| Shield block chance/reduction | ×2 |
| Weapon attack/spell damage | ×2 |

Other affixes remain ×1. At level 1, a midpoint magic roll gives **10.9% movement** on boots and **13.1% attack or cast speed** on gloves. Percentage growth remains bounded by `25n / (25 + n)`; tier, roll quality and enhancement still apply. No auto-reroll of already-owned items: new loot and newly rolled affixes use the new pools; services rebuild values from their recipes. Existing characters remain loadable, without resetting progress.

## Damage and hybrid hands

- Physical melee/bow damage = base physical damage × attack multiplier. Each Strength above 10 supplies +2% attack damage.
- Added elemental melee damage = the weapon's elemental affix × spell multiplier. Each Intelligence above 10 supplies +3% spell/elemental damage and +4 mana.
- Sum the two portions, then round once. Strength does not scale the elemental portion; Intelligence does not scale the physical portion. Critical hits multiply the combined direct hit. There is no double multiplication.
- Staff/wand bolts remain base elemental damage × spell multiplier. Melee/bows use attack speed; wands/staves and magic skills use cast speed.
- Skill potency multiplies the compatible weapon's derived hit, including its elemental portion for melee skills. A fire sword does not add damage to a separate wand spell or to the other hand.

One-handed swords, axes, maces and daggers can pair with a wand. Drag the wand into the offhand slot; ordinary automatic equip still targets the main hand. LMB alternates the two equipped one-handed weapons, including sword + wand: one click starts one hand, and the next click starts the other. Holding LMB repeats that sequence. Each action waits for the preceding action to recover, uses its own attack/cast speed, and pays its own mana cost. If the wand turn is unaffordable, it waits instead of skipping to a free sword swing. Magic skills select a compatible wand in either hand; melee skills similarly select their compatible hand, with main-hand preference. A two-handed weapon still reserves both hands. Fireball must be unlocked and assigned; an elemental sword alone does not satisfy its staff/wand requirement.

Mixed-hand casting shares aim assistance, mana checks, cast speed, sustained-effect compatibility, hand animation, item comparisons and save validation. It does not let the character cast and swing simultaneously.

## Elemental contact effects

All player elemental weapon/spell contacts share `ELEMENTAL_CONTACT` through the damage owner:

- **Fire:** burn for 2 seconds at 15% of that hit's elemental damage per second (30% total before tick rounding).
- **Frost:** 20% movement slow for 1.5 seconds.
- **Lightning:** a 0.12-second interrupt, subject to the Warden's existing control resistance/immunity.
- **Arcane:** direct damage; no generic additional status.

Melee burn potency uses only the snapshotted elemental portion, not the physical portion or later equipment. Stronger skill-authored burns/slows remain stronger; reapplication preserves strongest potency and longest duration without adding stacks. Periodic burn damage cannot crit, trigger life on hit or recursively ignite. Lightning enchantments do not automatically chain; chaining and explosions belong to skills. Enemy damage/defense rules are unchanged; separate elemental resistances are not implemented.
