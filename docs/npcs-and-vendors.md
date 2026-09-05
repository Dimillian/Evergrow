# NPCs, vendors and item improvement

Design specification · 2026-09-05 · **Not implemented yet.** The equipment preview/item UI and panel lifecycle foundation is implemented in checkpoint `85b1b00` (492 passing tests). This document defines the next work. Prices, stock weights and enhancement strength below are initial tuning proposals for playtesting.

## Town services

| NPC | Services | Stock |
| --- | --- | --- |
| Blacksmith | Buy equipment, sell any unequipped item, enhance equipment to +10 | 12 weapons, shields and armor pieces |
| Jeweler | Buy jewelry, sell any unequipped item | 6 pieces: 4 rings and 2 amulets |
| Enchanter | Raise rarity, reroll one affix, reroll all affixes, raise item level | No equipment shop |

Every town supplies all three services. Use the existing forge for the blacksmith, merchant building for the jeweler, and a work area in the chapel for the enchanter. Preserve doors, streets and footprints. Give each service a distinct discovered-map icon and concise role label; replace redundant shop markers rather than overlapping them.

NPC identities derive from world/building ID and role. Procedural names, clothing and accessories remain stable. Start with stationary shopkeepers, relaxed idle animation and a short working gesture: hammer, gemstone inspection or floating rune. Their workstations, lighting and silhouettes distinguish them without oversized labels. Furniture must leave a reachable interaction spot.

Click a nearby NPC or press **E** on the focused NPC to open its service. Initial interaction distance: 70 world units from the designated interaction spot, with an unobstructed approach. Focus requires proximity; clicks through a wall cannot trade. NPC interaction consumes the input instead of attacking. Register the service panel with `PanelCoordinator`: opening clears held actions and pauses combat; Escape closes it and restores gameplay focus. No dialogue tree or daily schedule in this first version.

## Shop experience

Reuse the compact shared window, item cells, rarity treatment, animated tooltips and complete equipment comparisons. Header: **Blacksmith**, **Jeweler** or **Enchanter**, plus wallet and close control. No subtitle or flavor paragraph.

Shop layout: stock on the left, the player's 64-cell bag on the right. Hover shows the ordinary item tooltip, price and effective equip changes. Selecting a shop item exposes one clear **Buy · 285 gold** action. Buying puts it in the bag; it never equips automatically. Shift-click may buy/sell directly, using exactly the same validated command. Ordinary inventory retains hover-only inspection; the service selection exists only to identify the transaction target.

Selling transfers the exact item and credits gold. Equipped items must first be unequipped. Keep a shared **Buyback** list of the last 12 sales per character, available at either shop, at the original sale price. Buyback preserves the item, its enhancement and its reroll history. Display that limit; the thirteenth sale retires the oldest entry. There is no sell-all action in v1.

Blacksmith stock guarantees a sword, bow, staff and shield, with the other eight entries covering armor and randomly selected equipment. All supported weapon profiles can appear. Jewelry stock is generated equipment with fully visible stats, not a blind purchase.

Proposed rarity weights:

| Stock | Common | Magic | Rare | Epic | Legendary |
| --- | ---: | ---: | ---: | ---: | ---: |
| Blacksmith | 55% | 35% | 9% | 1% | 0% |
| Jeweler | 0% | 60% | 35% | 4.8% | 0.2% |

These are separate from monster loot tables. Stock starts at +0 and uses the NPC's geographic zone level, not player level. The jeweler's price premium makes excellent rolls an expensive opportunity.

Stock refreshes at character levels **4, 7, 10, …**, globally for that character. The restock epoch is `floor((level - 1) / 3)`. Returning, reopening, waiting, reloading or unloading a town never refreshes stock. Purchased cells remain sold until the next epoch. Buyback survives restocking. Show only a small functional restock hint when needed. No paid refresh in v1.

## Three independent item axes

| Axis | Meaning | What changes it |
| --- | --- | --- |
| Item level | Geographic power budget and required level | Enchanter relevel |
| Rarity | Common → Magic → Rare → Epic → Legendary; affix count and rarity budget | Enchanter rarity upgrade |
| Enhancement | Permanent +0 through +10 improvement | Blacksmith |

Use **Enhance** for the blacksmith service so it is not confused with rarity. The current blue tier is named **Magic**, not Uncommon. Legendary currently means the highest ordinary rarity; this spec does not invent unique powers.

All improvements preserve the item's instance ID, base/profile, visual seed and name. Append `+N` to the displayed name when enhanced. Changing rarity updates its presentation. Improving an item does not heal the character or refill mana; recompute projections through the existing character command/stat boundary.

### Blacksmith enhancement

Every equippable item, including jewelry and starter gear, can be enhanced one step at a time, up to **+10**. Success is guaranteed. No destruction, downgrade or additional materials.

Initial effect: `enhancementMultiplier = 1 + 0.05 × enhancement`. Thus +5 gives ×1.25 and +10 gives ×1.50 to weapon base damage, armor, stat-bearing implicits and all affix values. Shield base block chance and blocked-damage reduction also receive this multiplier, subject to existing final character caps. Weapon family, handedness, attack geometry, base cadence and range stay intrinsic to the profile; attack/cast-speed affixes do improve.

Derive from the unenhanced recipe, then apply enhancement and round once using the stat's existing precision. Never multiply an already enhanced or rounded item. Percentage budgets still use the existing bounded growth curves, and final character caps remain authoritative. The preview distinguishes an increased item stat from an effective character stat already at its cap.

UI: a legible +N badge separate from rarity, restrained metal highlights on enhanced borders, more intricate trim at +5 and +10. A brief forge pulse traces the item icon when the transaction succeeds. The tooltip shows `Enhancement +4 / 10` and the next-step comparison. Avoid continuous glitter on every bag cell; reduced motion uses static details. Ground labels and equipment slots use the same +N treatment.

### Enchanter: raise rarity

Raise exactly one tier per purchase, guaranteed. Keep existing affix identities and normalized roll quality, recalculate them under the new rarity budget, and add the new affix slot. Counts remain **0 / 1 / 2 / 3 / 4**. The added affix is random and drawn without duplicating an existing stat. Enhancement stays intact. Legendary disables this action.

Before payment show the guaranteed base/existing-affix changes, new affix count, price and eligible new-affix pool. Do not pretend the random added affix is known before purchase.

### Enchanter: reroll affixes

- **Reroll one:** choose one affix row. Replace its type and roll; preserve every other affix. Exclude other occupied stats and, when alternatives exist, the replaced stat. This targeted control costs three times the initial full reroll.
- **Reroll all:** replace all affix types and rolls, keeping the rarity's affix count. Draw distinct stats from the item's eligible pool; previous types may return.

Both preserve implicits, level, rarity, enhancement and appearance. Common items have no affixes, so both actions are disabled. Outcomes replace the previous values; they can be worse. Show the eligible outcomes and a concise replacement warning beside the paid action, not a second modal every time.

Maintain separate targeted/full reroll counters per item; repeated use raises that service's price. They persist through selling, buying back, releveling and rarity upgrades. Randomness advances only for a successfully committed operation. There is no free outcome preview or reload-based reroll.

### Enchanter: raise item level

Raise directly to the **current NPC zone level**, queried through the shared geographic progression rules. It is not the player's level or highest visited area. Capture the target in the quote and validate it at execution. Equal/higher-level items cannot be downgraded or charged.

Keep affix types and their normalized roll quality. Re-evaluate base stats and affixes at the target level using the existing flat and percentage growth functions, then reapply rarity and enhancement. No extra affixes, fresh random rolls or lost +N levels. A good roll stays a good roll within its new budget.

Recalculate the requirement using the current rule `max(1, itemLevel - 2)`. Preview it clearly. If an equipped item would become unusable, require unequipping first; never silently strand it in an invalid equipped state. A bag item may be upgraded beyond the player's level, with the new requirement visible before payment.

## Initial economy

Keep formulas in one headless content/rules module, shared by quotes and execution. They must not depend on UI colors or the summary power score.

Let `B(L) = 30 × (1 + 0.1 × (L - 1))`, rarity factor `R = 1 / 2 / 5 / 12 / 30`, and enhancement investment factor `H = 1 + 0.1 × enhancement`. Round costs up and sale proceeds down to whole gold.

| Operation | Proposed gold price |
| --- | --- |
| Buy equipment | `B(L) × R` |
| Buy jewelry | `2.5 × B(L) × R` |
| Sell | `0.15 × B(L) × R` (also for jewelry) |
| Enhance to step n | `3 × B(L) × R × 1.65^(n - 1)` |
| Raise rarity | `8 × B(L) × targetR × H` |
| Reroll one | `15 × B(L) × R × H × 1.25^targetedCount` |
| Reroll all | `5 × B(L) × R × H × 1.20^fullCount` |
| Relevel from L to Z | `3 × R × H × sum(B(k), k = L + 1 … Z)` |

Compute the relevel sum analytically, not by looping through potentially a million levels. All costs and resulting balances must be finite safe integers. Stop escalating prices at the numeric boundary by disabling the operation; never overflow or silently reduce its price.

Example for a **level-10 Rare +0 item**:

| Action | Gold |
| --- | ---: |
| Buy equipment / jewelry | 285 / 713 |
| Sell | 42 |
| Enhance +0 → +1 | 855 |
| Enhance +9 → +10 | 77,504 |
| Total +0 → +10 at this level/rarity | 195,428 |
| Upgrade to Epic | 5,472 |
| First single / full reroll | 4,275 / 1,425 |
| Relevel 10 → 15 | 4,950 |

This intentionally makes +10 a long-term investment, not an early expectation. Current level-one normal enemies average 3.85 gold per kill before equipment sales; a 30-gold common purchase takes roughly eight normal kills on average. Gold drops and the base shop budget share the same linear level factor, while enhancement steps escalate sharply. Actual affordability must be tuned from the player's sessions.

Enhancing/rerolling does not raise sale proceeds; these are investments, not refundable gold storage. Rarity/relevel changes may raise proceeds, but always less than the service cost. Buyback returns only the original sale price. Verify that no buy/sell/improve sequence creates profit. Improving earlier at a lower level/rarity is intentionally cheaper; the resulting stats at the same final recipe are independent of operation order.

## Implementation contracts

**Item recipe:** separate stable instance identity from procedural seed. Retain explicit base/profile ID, appearance seed, item level, rarity, enhancement, affix definition IDs with normalized roll values, reroll counters and item revision. Starter gear needs explicit recipes too. The current generated weapon ID is an instance ID, so it cannot substitute for its source profile. One derivation path serves drops, shops, improvement previews, saves, icons and combat. Do not add a second stat calculator or infer recipes from rounded affix values.

**Ownership and transactions:** introduce typed buy, sell, buyback and improve commands. A quote contains vendor ID, stock epoch/revision, item ID/revision, operation, target and price. Revalidate ownership, interaction session, affordability, slot capacity, requirements, limits and quote freshness. Plan the complete change before mutation. Commit wallet, inventory/equipment, stock/buyback and random-operation counter together; duplicate or stale requests change nothing. An improvement preview compares the item's old/new form as well as its effective character changes, reusing the consolidated equipment planner.

**Persistence:** character-owned vendor state lives separately from frozen town geometry and exploration. Save it in the same checkpoint as the wallet and inventory. Stock is reconstructed from vendor ID, epoch, slot and a stock-only seed; retain purchased-cell masks rather than hundreds of duplicated item recipes. Issued stock IDs include vendor/epoch/slot and use a namespace distinct from enemy drops. Bought/sold/buyback items transfer their identity, never regenerate it.

Keep only the current epoch's purchase masks, plus 12 exact buyback items and transaction revisions. Initial bound: 2,048 visited vendor masks per epoch. Never evict a current mask and accidentally refill its stock. At this prototype limit, previously visited shops remain available; new stock is unavailable until the next restock, while improvement services still work. Measure the worst-case checkpoint against the existing 700,000-byte limit and adjust encoding/bounds together before shipping the feature.

Extract shared item validation and enforce unique ownership across bag, equipment, ground drops, buyback and available stock identities. Persist a successful transaction before presenting completion. If storage fails or a stale writer is detected, discard the staged trade, leave gold/items unchanged and show the existing save failure feedback. Random results and their counter commit together. This is local consistency, not anti-cheat against edited browser data.

**Presentation:** emit typed transaction results after commitment. Reuse compact notifications: named purchases, concise sales, brief improvement results. Spending gold must not enter the positive gold/XP reward accumulator. No new notification framework or service locator. Service panels reuse `ItemTooltip`, shared item components and the panel coordinator.

## Delivery checkpoints and acceptance

1. **NPC interaction + blacksmith buy/sell/buyback:** stable placement, shared panel, stock generation, item issuance, complete transactions and persistence together. Test full bag, insufficient gold, duplicate clicks, stale quotes, return/reload/restock, storage failure and character switching.
2. **Recipe-backed +10 enhancement:** one derivation path and before/after UI. Test all item kinds, starter items, both hands, caps, +10 rejection, rounding, resources unchanged and save round-trips. Verify equal final stats for enhancement before/after relevel or rarity changes with equivalent recipes.
3. **Jeweler:** jewelry stock, prices, appearance and existing shop machinery. Test stock composition, independent RNG and no profitable resale loop.
4. **Enchanter:** rarity, targeted/full rerolls and geographic releveling. Test affix uniqueness, preserved rolls/identity/enhancement, counter escalation, random failure atomicity, level requirements and extreme numeric bounds.
5. **Static in-app review:** capture town NPCs, vendor layout and +0/+5/+10 tooltip treatments at normal and narrow widths. Leave gameplay and economy testing to the player. Commit and push each coherent implementation checkpoint.

No quest framework, wandering schedules, reputation, materials, repairs, haggling or unique-item powers are required for this first system.
