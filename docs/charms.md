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

The local drop-rate pass uses **5% per item reward** across monster loot, dungeon chests and every item-giving event. `CHARM_DROP_CHANCE` is shared; monster kind tables retain their authored equipment weights and normalize the charm weight to exactly 5%. `generateRewardItem` makes one independent charm choice before the event's equipment theme, retaining rarity and source level. Non-charm rewards keep their original equipment kind, profile and material. Generic rewards do not make a second charm roll. Explicit item generation for shops, gambling and tools does not substitute charms.

This replaces an existing item roll, never adds another drop. Ordinary non-goblin foes have a **1.4% chance per kill** (one charm per 71 kills on average), veterans **3.5%** (one per 29), and elites **6.19%** for at least one (one charm per 16 kills on average, including occasional doubles). Ordinary goblins retain reduced item yield: **0.42%**, or one per 238 kills. There is no pity counter; 300 ordinary non-goblin kills have about a **1.46%** chance of yielding none.

An item-giving chest/event with one, two or three item rolls has approximately **5%, 9.75% or 14.26%** chance of at least one charm. Raid-boss and dungeon-boss chests retain three items; normal dungeon chests retain one. Cursed chests keep their wave-based item count (up to ten rolls, approximately 40.13% chance of at least one charm). These figures assume independent rolls; each actual reward remains seeded and repeatable. Existing gold-only choices, blessings and breakable containers do not gain extra item rewards.

Existing characters use these same live reward rules; no creation-date or charm-unlock flag gates eligibility. Regression coverage restores pre-charm 64- and 72-record saves without a layout, awards a normal monster's charm after 1,200 prior kills, picks it into the charm grid and validates both ground-loot and owned-item save round-trips.

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

Ground recognition: charm nameplates use a rune-cut stone glyph, a subtle silver frame and a leading “Charm” label, followed by the stone name and item level. Rarity colors remain authoritative. The single-row plate shares equipment label packing, pickup hitboxes and hover highlighting; no extra beam or particle layer. `/loot.html?charms` stages common, magic and epic stones beside ordinary equipment in disposable memory.
