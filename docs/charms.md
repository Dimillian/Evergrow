# Charms

Local implementation · 2026-09-09. Charms are generated magical stones, using ordinary item rarity, item level, requirements, affix recipes, loot labels, storage and vendor transactions.

## Placement and bonuses

The inventory has a 12×6 equipment bag and a separate **12×4 charm grid**. Picked-up charms go directly into that grid, never into the bag. If no footprint fits, the charm stays on the ground. Bag and charm capacity are independent. Dragging rearranges stones within their grid; footprints cannot cross the divider or wrap an edge. Auto-sort packs both regions independently.

Only placed stones whose level requirement is met contribute modifiers. Higher-level stones can be collected and rearranged but remain inactive until that level. Overflow, stash and buyback stones grant no bonuses. Charms can be sold directly at vendors, including bulk sales, stored, or dragged onto the inventory drop icon to put them on the ground. Each removes their bonuses; dropped stones can be picked up again. Buying back or retrieving a stone requires space in the charm grid. Enchanting and enhancement use normal services. Pickup, storage, sale and level-up refresh the shared character projection; increased life/mana capacity never heals or refills the player.

The same inventory records own both regions, with room for 120 one-cell objects. `inventoryLayout` uses cells 0–71 for equipment and 72–119 for charms. Old 64-/72-record saves remain readable and expand on normal inventory transactions; no reset or save version change. Shared save validation checks shape, ownership and affix budget. Higher-level owned charms remain valid saves.

## Stone sizes

| Shape | Cells | Affixes: Common / Magic / Rare / Epic / Legendary | Roll strength |
| --- | --- | --- | ---: |
| Pebble | 1×1 | 1 / 1 / 2 / 2 / 2 | ×0.28 |
| Shard | 1×2 | 1 / 2 / 2 / 2 / 2 | ×0.50 |
| Tablet | 2×2 | 2 / 2 / 3 / 3 / 4 | ×0.64 |
| Spire | 1×3 | 2 / 2 / 2 / 3 / 3 | ×0.57 |
| Heartstone | 2×3 | 3 / 3 / 4 / 4 / 5 | ×0.86 |
| Monolith | 2×4 | 4 / 4 / 5 / 6 / 6 | ×1.12 |

The local post-0.3.0 pass caps small stones at two focused bonuses. Larger stones have stronger individual rolls and better nominal Legendary budget per cell: Pebble 0.56 versus Monolith 0.84, before rarity quality, rounding and caps. Shape weights remain 30 / 25 / 16 / 16 / 9 / 4; drop rates are unchanged. Higher-tier stones keep their dimensions.

New recipes carry `charmVersion: 1`. Shared save decoding first validates pre-budget charm recipes, then rebalances them on the parsed copy across carried/stashed/buyback and dungeon/surface ground items. It retains IDs, enhancement, level, locks and progression, prefers the existing thematic roll, and trims excess affixes deterministically. Stored bytes remain untouched until the next save. This deliberately changes existing charm bonuses without resetting characters. Client and Worker must ship the new rules together.

Final bonuses round to the nearest whole number, with a minimum of 1 for every positive roll. This changes actual combat bonuses, not only tooltip formatting, and also normalizes existing saved charms. In particular, small regeneration rolls become stronger, and nearby rolls may share a value until their next integer threshold. The saved roll quantile remains precise for future upgrades. See [whole-number item bonuses](equipment-affixes.md#weights-and-specialist-budgets).

Six flavors provide color, carved rune and a ×2 preference for matching affixes:

- Ember: fire resistance and life.
- Rime: frost resistance and mana.
- Storm: lightning resistance and attack/cast speed.
- Astral: arcane resistance, experience and mana regeneration.
- Jade: all resistance, life and life regeneration.
- Amber: gold, movement and mana.

The first affix is guaranteed to match the flavor, and enchanting preserves this identity. Remaining affixes retain the ×2 thematic preference. If a targeted first-affix reroll has no alternative compatible thematic stat, it rerolls that stat’s strength; the service explains this behavior. `charm-content.ts` owns all 36 size/flavor profiles. `charm-shapes.ts` shares irregular stone silhouettes, cut faces, luminous veins and runes across inventory, vendor, forge and ground art.

## Bonuses and rewards

Shared item affixes cover resistance, speed, resources, regeneration, movement, cost/cooldown reductions, attributes and a smaller chance of offensive bonuses. Utility dominates the pool. One stone can have one single-element **or** all-element resistance affix, and either attack speed **or** cast speed, matching normal family exclusions. No skill-rank, weapon enchantment or shield-only affixes roll on stones.

Two new charm rolls use whole percentage points:

- **Prosperity:** gold found, base 8 + 0.16 × bounded level growth.
- **Wisdom:** experience gained, base 5 + 0.10 × bounded level growth.

These receive stone size, roll quality, rarity and enhancement multipliers. Total gold bonus caps at **+100%** and XP at **+50%**. Gold increases physical piles created by enemy kills, event/dungeon chests and breakable containers, never vendor payments. XP increases kills, event completion and Journey rewards. Apply once when the reward is created/committed, preserving actual HUD and Chronicle amounts. Pickup does not multiply already-dropped gold. Equipment RNG remains independent of the two utility bonuses.

Kill XP, gold and mana-on-kill use eligibility before that kill's experience award. If a level-up activates a higher-level stone, its bonuses apply to subsequent kills. See the [stats audit](stats-audit-2026-09-09.md) for full-grid and size/rarity budget comparisons.

Each enemy item-kind table adds charm weight 2 to its existing equipment weight 100: **about 1.96% of dropped items** are charms. Normal item quantities, rank rarity and source levels remain authoritative. General untyped item generation (including generic POI hoards) has a 4% charm branch; explicitly themed equipment rewards keep their authored kinds. Dungeon chest rolls use the enemy table. Shops and gambling do not offer charms in this pass.

Detailed stats show active charm sources, resistances, gold found and experience gained. Item tooltips show ordinary rarity, level and stat values, with no size/affix-count line or stat explanations. Detailed calculation explanations belong only in character detailed stats.

## Review and verification

`/character.html?charms` stages six sizes in the dedicated charm grid in the existing disposable inventory review. The Item forge supports Charm and all 36 profiles. Both use runtime generation and art, never playable saves.

Headless coverage exercises profiles across every rarity, service rebuilds, fixed footprints, level-gated bonuses, grid separation, sorting, independent capacities, save round-trips, direct sales, bounded utility stats and seeded loot frequency. Gameplay feel and balance remain for the user's local playtest.

## Local inventory hardening after 0.3.0

- Locked items cannot be sold or dropped. Lock mode in the inventory toolbar toggles a piece on click; L toggles a focused piece. Storing, rearranging, upgrading and equipping remain allowed.
- Vendor rarity shortcuts exclude locked items and active charms. “Include active charms” opts them into shortcuts; manual selection plus Sell is also an explicit charm sale. Transaction validation enforces the lock and active-charm consent. Buyback remains the last 12 sales.
- Auto-sort tries eight bounded shape/direction combinations when needed. It never increases overflow; bag and charm space remain separate. Pickup and service failures distinguish full capacity from a missing rectangular space.
- The inventory’s Compare button previews a stored/inactive charm against selected active stones, including the real capped stat changes and packing feasibility. It never changes items, resources or saves; actual storage transfers still require a storage chest.
- Enhancements skip rounded-away ranks to the next real increase, at the current step’s price. The +N preview shows the destination; at most +10. Rarity upgrades skip ineffective tiers and quote the destination tier’s normal price. Releveling that changes no actual bonus is unavailable. Random rerolls remain allowed to produce worse or equal outcomes.
