# Equipment affixes and hybrids

Current rules · September 9, 2026. Generation, rarity upgrades and rerolls share `itemAffixPool`, `rollAffix` and `affixConflicts` in `items.ts`. There are 55 explicit definitions: 24 original affixes, six specialist affixes, five resistance affixes and 20 individual skill-rank rolls (one shared rarity family). Tier counts remain 0 / 1 / 2 / 3 / 4.

## Slot pools

The head/chest/gloves/legs/boots rows below describe metal armor. Leather and cloth now have construction-specific pools: leather favors Dexterity, physical damage and critical hits; cloth favors Intelligence, mana and spell stats. Eight jewelry profiles also bias related rolls. See [material identities and weights](item-materials.md#armor-identities-and-jewelry).

| Slot / family | Eligible explicit affixes |
| --- | --- |
| Head | Mana, Intelligence, mana cost reduction, cooldown reduction, life, armor; any skill rank |
| Chest | Life, armor, Vitality, life regeneration, Strength |
| Gloves | Attack speed **or** cast speed, critical chance, attack damage, spell damage, Dexterity, armor |
| Legs | Life, armor, Vitality, life regeneration, Strength, Dexterity |
| Boots | Movement speed, life, armor, Vitality, Dexterity |
| Cloak | Life/mana regeneration, cooldown reduction, life, mana, Intelligence, Deep Draught |
| Rings | Life, Vitality, life regeneration, critical chance/damage, attack/spell damage, Strength/Dexterity/Intelligence, mana, mana regeneration, Wellsip; elemental resistance; any skill rank |
| Amulet | General affixes, elemental resistance and both block affixes; any skill rank; weaker movement/speed rolls |
| Shields | Block chance/reduction, armor, life, Vitality, life regeneration, Strength, Afterguard; elemental resistance; shield skill ranks |
| Melee weapons | Attack damage, critical chance/damage, life on hit, Strength, Dexterity, Intelligence, spell damage, Expanse, one fire/frost/lightning enchantment; compatible melee skill ranks |
| Bows | Attack damage, critical chance/damage, Dexterity, life on hit, Strength, Piercing; bow skill ranks |
| Staves / wands | Spell damage, Intelligence, mana, critical chance/damage, mana cost reduction, mana regeneration; Expanse (staff) / Piercing (wand); magic skill ranks |
| Grimoires | Mana, mana regeneration, mana cost/cooldown reduction, Intelligence, spell damage, Wellsip, Spellweave; magic skill ranks |
| Orbs | Spell damage, critical chance/damage, Intelligence, mana, mana cost reduction; magic skill ranks |

Amulets are the explicit exception to boots-only movement and gloves-only speed. Weapon elemental affixes are local to melee weapons and are not in the amulet pool. Amulet block affixes still require a shield to function. Attack/cast-speed rolls are mutually exclusive on one item. These restrictions concern explicit rolls; attribute/tree bonuses and existing focus implicits retain their roles.

## Weights and specialist budgets

Ordinary affixes have weight **1**. Critical chance, life on hit, cooldown reduction and mana cost reduction have weight **0.55**. Each of the three melee elemental affixes has weight **0.12**. Draw without replacement, removing conflicting families after each choice. Construction and jewelry affinity multiply favored weights by 2.2 and fallback weights by 0.75; the unmodified weapon pools below retain their original probabilities. Weights apply equally to drops and enchanting. With Expanse and the skill-rank family, an initial melee affix is elemental with probability `0.36 / 8.51 ≈ 4.2%`; higher tiers provide additional opportunities, never two elements. Item rarity/drop tables are unchanged.

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

Other affixes remain ×1. At level 1, a midpoint magic roll gives **11% movement** on boots and **13% attack or cast speed** on gloves. Percentage growth remains bounded by `25n / (25 + n)`; tier, roll quality and enhancement still apply. Services rebuild values from their recipes. Existing characters remain loadable, without resetting progress.

All actual item bonuses now use **whole numbers**, including explicit affixes, focus/jewelry implicits and shield block values. Round to the nearest integer after level, roll quality, rarity, slot/size potency, enhancement and resistance limits; positive bonuses have a minimum of 1. Recipes retain precise coefficients and roll quantiles, so later upgrades rebuild from the original inputs rather than multiplying rounded bonuses. Small upgrade steps can leave a bonus unchanged until the next whole-number threshold.

Validated saves normalize fractional bonuses in equipped gear, inventory, charms, stash, buyback and active/stored ground loot on the parsed copy. Elemental weapon damage is refreshed from the rounded enchantment. Item identities, names, recipes, prices and progression remain intact; no random reroll or save reset. Original stored bytes are unchanged until the next successful save. Derived combat rates and attribute conversion formulas retain their precision; this rule concerns item bonuses.

Worn starter clothing begins without base protection. A successful service improvement clears its starter-only neutral recipe and restores the normal base stats as well as applying the quoted upgrade; enhancement/releveling must not charge for a zero-base-stat result. See the [September 9 stats audit](stats-audit-2026-09-09.md) for correctness fixes and remaining scaling concerns.

## Damage and hybrid hands

- Physical melee/bow damage = base physical damage × attack multiplier. Each Strength above 10 supplies +2% attack damage.
- Added elemental melee damage = the weapon's elemental affix × spell multiplier. Each Intelligence above 10 supplies +3% spell/elemental damage and +2 mana.
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

Melee burn potency uses only the snapshotted elemental portion, not the physical portion or later equipment. Stronger skill-authored burns/slows remain stronger; reapplication preserves strongest potency and longest duration without adding stacks. Periodic burn damage cannot crit, trigger life on hit or recursively ignite. Lightning enchantments do not automatically chain; chaining and explosions belong to skills. Enemy defenses are unchanged. Incoming player damage now separates physical armor from elemental resistance, as described below.

## Specialist affixes · 2026-09-07

| Affix | Effect | Slots | Relative weight |
| --- | --- | --- | ---: |
| Wellsip | Restore flat mana on a committed enemy kill, capped at maximum mana; no credit after player death | Rings, grimoires, amulets | 1 |
| Expanse | Increased skill area: sweep reach, cone/nova/ground radii and projectile explosions | Melee weapons, staves, amulets | 0.55 |
| Deep Draught | More life **and** mana restored by the dual potion, still one charge | Cloaks, amulets | 1 |
| Piercing | +1 additional target for non-explosive player projectiles | Bows, wands, amulets | 0.12 |
| Spellweave | A direct melee hit primes the next spell/bolt; a direct magic hit primes the next melee action | Grimoires, amulets | 0.18 |
| Afterguard | Blocking grants increased armor for three seconds, against subsequent hits | Shields, amulets | 0.55 |

These are relative selection weights within each slot pool, not drop percentages. Base/growth: Wellsip 2 + 0.12 per level; Expanse 10% + 0.3; Deep Draught 12% + 0.35; Spellweave 16% + 0.4; Afterguard 20% + 0.5. Percentage growth uses the existing tapered budget, then roll quality, rarity and enhancement. Piercing always stays +1, even with enhancement/releveling. Rerolls and rarity upgrades share the same pools and exclusions.

Expanse adds **area**, so radius/reach scales by the square root of the increased-area factor; it does not extend projectile travel, chain distance, dashes or basic weapon reach. Total increased area caps at 100%. Deep Draught caps at 100% increased restoration. Piercing adds to skill-native pierce, with at most four equipment pierces; ricochets keep their existing priority and explosions still detonate on contact instead of piercing. Payloads retain their bonus after release.

Spellweave lasts four seconds, refreshes rather than stacks, and is consumed once when a valid opposite-type action begins. It multiplies that whole action's snapshotted damage, including its projectiles/ground payload; failed activation keeps the buff, and a missed valid action still spends it. Physical arrows do not prime it. Periodic burn/ember damage cannot prime Spellweave, crit or trigger life on hit. Afterguard refreshes its three-second timer without stacking, uses source-level armor mitigation and ends when shield/affix eligibility is lost. Spellweave and Afterguard each cap at 100%. These temporary buffs are not saved or part of the character's permanent armor/DPS projection.

## Equipment skill ranks

At most **one skill affix per item**, naming a particular active skill. Equipment ranks require that skill unlocked and its normal weapon requirement; they never grant tree ownership, ranks purchased with points, mastery, specializations or hotbar assignments. They add to the chosen casting rank for potency (including Bulwark's existing reduction cap), without changing that rank's mana/cooldown costs. Bonuses sum across equipped items up to +10 per skill and can exceed the ordinary purchased-rank limit. Unequipping removes them immediately; released actions keep their damage snapshot.

| Roll | Minimum item level | Chance among skill-rank rolls at level 80+ |
| --- | ---: | ---: |
| +1 | 1 | 88% |
| +2 | 12 | 10% |
| +3 | 30 | 1.7% |
| +4 | 55 | 0.27% |
| +5 | 80 | 0.03% |

Below a threshold, higher quantiles collapse to the highest eligible rank. Enhancement and rarity never multiply this integer. Geographic releveling re-evaluates the saved quantile against the new level gate, shown in the service preview; rerolling draws a new quantile. Save validation checks the integer against the exact stored roll and item level.

The **entire skill family** has weight 0.50 on weapons, 0.45 on grimoires/orbs, 0.35 on shields, 0.25 on helmets, 0.18 on rings and 0.40 on amulets. This budget is split among eligible skills, so adding more skills does not flood the affix pool. Weapons favor compatible skills, shields their two skills, caster foci magic, and helmets/jewelry can roll any skill. Fire/frost/lightning profiles and focus motifs give matching skills three times the individual weight; ultimate skills receive one quarter of ordinary weight. Generation depends on the item's identity, never the current player's build or post-kill level. Existing item rarity/quantity tables are unchanged.

The skill atlas shows purchased ranks and extra gear ranks separately; item and equipment-comparison tooltips show the exact named bonus. Existing saves remain usable, and old items are not randomly rerolled on load.

## Elemental resistance · 2026-09-09

Players start at **0% Fire, Frost, Lightning and Arcane resistance**. Rings, amulets, shields and charms can roll resistance, in a normal explicit affix slot. A piece may have **one single-element roll or one all-element roll**, never both or several single elements. Existing gear is not rerolled.

| Affix | Resistance | Base / bounded growth | Relative weight | Maximum per roll |
| --- | --- | --- | ---: | ---: |
| Cinderskin / Rimeward / Stormward / Spellward | Fire / Frost / Lightning / Arcane | 10 + 0.12 × growth | 0.15 each | 24% |
| Sanctuary | All four elements | 3 + 0.035 × growth | 0.10 | 8% |

Growth uses `25n / (25 + n)`, where `n = item level - 1`; roll quality, rarity and enhancement apply before the hard per-roll limit. These are percentage points and relative selection weights, not drop probabilities. Jewelry profile affinity still applies. Rerolls, rarity upgrades and releveling share these rules. Common items have no explicit affixes and therefore no resistance. No new resistance implicits, passive nodes or automatic level bonuses are introduced.

For each element, add its specific bonuses and all-element bonuses, then clamp the total to **0–75%**. Four all-resistance pieces can supply at most 32% to all elements; reaching the cap requires focused single-element investment. Charms supply additional investment through their separate size budgets; see [charms](charms.md). Item comparisons and detailed-stat tooltips show the actual capped totals and named sources. See [incoming damage](progression-and-loot.md#item-growth-and-defenses) for combat rules.

## Local mana budget pass — September 11, 2026

Mana regeneration item rolls are whole **mana per five seconds**, divided by five in the derived combat stat. Life regeneration remains life per second. The Wellspring now uses `8 + 0.8 × bounded growth`, Clarity `2 + 0.12 × bounded growth`, and Wellsip `1 + 0.04 × bounded growth`. All three use the existing `25n/(25+n)` taper, rather than linear level growth. Slot, rarity, roll-quality and enhancement multipliers still apply. Mana and regeneration implicits use `1 + 0.04 × bounded growth`; non-resource implicits and damage are unchanged.

Mana cost reduction preserves the first 20 percentage points, then approaches 40% with diminishing returns. A raw 50% bonus gives about 35.54% effective reduction; 75% gives about 38.72%. Shared derivation feeds spells, basic bolts, upkeep and tooltips. Individual affix numbers show the raw contribution; detailed stats explain the effective result.

Existing recipes without `manaVersion: 1` reprice resource bonuses on validated save read, retaining rolls, IDs, enhancement and all non-resource bonuses. New and rebuilt recipes carry the marker. The matching client and Worker must ship together; local testing requires reloading the character. See [resource benchmark](resource-balance.md).
