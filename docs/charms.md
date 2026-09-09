# Charms

Local implementation · 2026-09-09. Charms are generated magical stones, using ordinary item rarity, item level, requirements, affix recipes, loot labels, storage and vendor transactions.

## Placement and bonuses

The inventory has a 12×6 equipment bag and a separate **12×4 charm grid**. Picked-up charms go directly into that grid, never into the bag. If no footprint fits, the charm stays on the ground. Bag and charm capacity are independent. Dragging rearranges stones within their grid; footprints cannot cross the divider or wrap an edge. Auto-sort packs both regions independently.

Only placed stones whose level requirement is met contribute modifiers. Higher-level stones can be collected and rearranged but remain inactive until that level. Overflow, stash and buyback stones grant no bonuses. Charms can be sold directly at vendors, including bulk sales, or stored to remove their bonuses. Buying back or retrieving a stone requires space in the charm grid. Enchanting and enhancement use normal services. Pickup, storage, sale and level-up refresh the shared character projection; increased life/mana capacity never heals or refills the player.

The same inventory records own both regions, with room for 120 one-cell objects. `inventoryLayout` uses cells 0–71 for equipment and 72–119 for charms. Old 64-/72-record saves remain readable and expand on normal inventory transactions; no reset or save version change. Shared save validation checks shape, ownership and affix budget. Higher-level owned charms remain valid saves.

## Stone sizes

| Shape | Cells | Common affixes | Roll strength |
| --- | --- | ---: | ---: |
| Pebble | 1×1 | 1 | ×0.28 |
| Shard | 1×2 | 1 | ×0.46 |
| Tablet | 2×2 | 2 | ×0.68 |
| Spire | 1×3 | 2 | ×0.58 |
| Heartstone | 2×3 | 3 | ×0.92 |
| Monolith | 2×4 | 4 | ×1.20 |

Magic / Rare / Epic / Legendary add 1 / 2 / 3 / 4 affixes to that size budget. Thus even Common stones have an effect, while a Legendary Monolith has eight distinct affixes. Size weights are 30 / 25 / 16 / 16 / 9 / 4. Rarity uses existing item quality multipliers; enhancement adds the usual 5% per step, up to +10. Affix level growth and numeric caps are shared with items, before the size multiplier and final resistance cap. Higher-tier stones keep their physical dimensions.

Six flavors provide color, carved rune and a ×2 preference for matching affixes:

- Ember: fire resistance and life.
- Rime: frost resistance and mana.
- Storm: lightning resistance and attack/cast speed.
- Astral: arcane resistance, experience and mana regeneration.
- Jade: all resistance, life and life regeneration.
- Amber: gold, movement and mana.

Flavor is a preference, not an implicit or guaranteed affix. `charm-content.ts` owns all 36 size/flavor profiles. `charm-shapes.ts` shares irregular stone silhouettes, cut faces, luminous veins and runes across inventory, vendor, forge and ground art.

## Bonuses and rewards

Shared item affixes cover resistance, speed, resources, regeneration, movement, cost/cooldown reductions, attributes and a smaller chance of offensive bonuses. Utility dominates the pool. One stone can have one single-element **or** all-element resistance affix, and either attack speed **or** cast speed, matching normal family exclusions. No skill-rank, weapon enchantment or shield-only affixes roll on stones.

Two new charm rolls use whole percentage points:

- **Prosperity:** gold found, base 8 + 0.16 × bounded level growth.
- **Wisdom:** experience gained, base 5 + 0.10 × bounded level growth.

These receive stone size, roll quality, rarity and enhancement multipliers. Total gold bonus caps at **+100%** and XP at **+50%**. Gold increases physical piles created by enemy kills, event/dungeon chests and breakable containers, never vendor payments. XP increases kills, event completion and Journey rewards. Apply once when the reward is created/committed, preserving actual HUD and Chronicle amounts. Pickup does not multiply already-dropped gold. Equipment RNG remains independent of the two utility bonuses.

Each enemy item-kind table adds charm weight 2 to its existing equipment weight 100: **about 1.96% of dropped items** are charms. Normal item quantities, rank rarity and source levels remain authoritative. General untyped item generation (including generic POI hoards) has a 4% charm branch; explicitly themed equipment rewards keep their authored kinds. Dungeon chest rolls use the enemy table. Shops and gambling do not offer charms in this pass.

Detailed stats show active charm sources, resistances, gold found and experience gained. Item tooltips show ordinary rarity, level and stat values, with no size/affix-count line or stat explanations. Detailed calculation explanations belong only in character detailed stats.

## Review and verification

`/character.html?charms` stages six sizes in the dedicated charm grid in the existing disposable inventory review. The Item forge supports Charm and all 36 profiles. Both use runtime generation and art, never playable saves.

Headless coverage exercises profiles across every rarity, service rebuilds, fixed footprints, level-gated bonuses, grid separation, sorting, independent capacities, save round-trips, direct sales, bounded utility stats and seeded loot frequency. Gameplay feel and balance remain for the user's local playtest.
