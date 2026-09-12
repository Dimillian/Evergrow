# Character systems foundation


[Character appearance](character-editor.md) is integrated in creation and inventory with shared world/portrait rendering. Save v4 requires the appearance recipe; valid pre-editor v3 characters migrate automatically with the default look, preserving progress.

2026-09-05 · local, unreleased prototype.

The character sheet now connects equipment, attributes, tree allocations, active skills, and loot to real combat. This is an extensible first foundation, with bounded rules and shared data. Its many tree nodes reuse authored bonus families; it is not a claim of thousands of distinct abilities or a balanced endgame.

## What the player can do

- **C / I:** open the same character window: procedural character doll and eleven equipment slots on the left, a 64-cell inventory in the middle, attributes and detailed combat stats on the right.
- Inspect an item by hovering, keyboard focus, or a tap. Its tooltip shows tier, item level, required level and weapon profile. Eligible candidates combine modifiers and complete effective equip changes in one Stat / Item / On equip table: each matching stat appears once, with additional rows for lost bonuses and indirect effects. Item values stay distinct from rounded or capped character changes; gains are green, losses red and unchanged values use a muted dash. Mouse-hover and keyboard-focus previews keep the full replaced equipped tooltip beside the candidate (both items for a two-hand conflict). There is no selected-item detail view.
- Drag an item onto a compatible equipment slot, use **Shift-click** to equip/unequip. Dragging between bag cells swaps their contents. Rings support either ring slot.
- **Double-click** a bag item to equip its automatic slot; **Enter/Space** equips a focused bag item or unequips a focused equipped item. Rings fill an empty ring slot first.
- The two subtle icons beside **Inventory** open **Sort & filter**, then **Equip Best**. Sort and filter choices live in a compact popover instead of occupying bag space.
- **Equip Best** upgrades by the existing item-power estimate (including enhancement). A higher-power main weapon of a different family or handedness opens a warning showing both weapons: **Equip anyway** allows the replacement and safe offhand stowing; **Keep current weapon only** retains the exact main weapon and upgrades other gear; **Cancel** changes nothing. Same-type upgrades need no warning. All plans respect level and bag capacity, preserve ties, and commit together. This is a convenience score, not an optimizer for every skill build.
- **Sort** uses three priorities: Rarity → Type → Recent pickup; Type → Rarity → Recent pickup; or Recent pickup → Rarity → Type. Only complete ties keep their prior order. Acquisitions include pickups, purchases and buyback, and retain their chronology through sorting, equipping and saves; untracked acquisitions tie behind tracked ones for the recent criterion.
- Type and rarity filters allow multiple selections: any selected type AND any selected rarity. All (or deselecting the last choice) clears that group. Matching items display first without moving the underlying bag; all 64 styled cells remain visible, even with no matches. Real empty cells retain valid drop destinations; placeholders for excluded items cannot equip, drag, receive drops or consume focus.
- **LB/RB** switches between Equipment, Inventory and Attributes, remembering focus without a separate row of section buttons. D-pad/left stick moves spatially through cells and controls; **A/X** equips or unequips the focused item, A operates buttons, and B closes. Popups contain controller/keyboard focus; B or Escape dismisses the popup first and restores its icon's focus. The active section and focused control have persistent highlights while using the controller.
- **T:** open the skill atlas. Pan, zoom, search names/bonuses, filter a domain or reachable stars, inspect a node, and allocate a connected node or an affordable complete route. Hovering or selecting a distant node previews the shortest route from the current build and its remaining point cost. Double-click commits the shortest affordable route; the native Allocate path button does the same. Hover updates the stat preview immediately. Canvas keyboard navigation follows neighboring stars.
- Assign unlocked skills to **RMB, 1, 2, 3, 4** from a major node's detail panel. Assigning a skill to a new slot moves its existing assignment; one skill cannot occupy multiple slots. LMB stays the basic attack, Q the potion, and Space the dodge.

These windows pause combat, clear buffered inputs, trap modal keyboard focus, and close with Escape or their shortcut. Unassigned skill slots stay empty and do nothing. The journal is still unavailable.

## State and ownership

`CharacterSheet` in `character-types.ts` owns four base attributes, unspent stat/skill points, allocated node IDs, the gold wallet, the bag, equipment slots, five skill assignments and persistent commerce state. It is the source of truth. `Player.derived`, basic-attack stats, and rendered equipment are rebuilt projections.

| Module | Responsibility |
| --- | --- |
| `items.ts` | Seeded generation; item tiers, names, affixes, implicit modifiers, starter sheet, explicit profile selection; shared stat labels/formatting |
| `item-improvement.ts`, `commerce.ts`, `commerce-command.ts` | Recipe-based enhancement/enchanting, deterministic stock and pricing, pure transaction planning and save-before-commit execution |
| `weapon-content.ts` | Thirteen immutable generated weapon profiles and three shield profiles; handedness, attack family, element, cadence, reach, defense, and silhouette |
| `inventory.ts` | Pure equipment planning shared by previews/drop eligibility/commits; atomic equip/unequip/hand-conflict stow, bag swap, insertion, and attribute allocation |
| `inventory-tools.ts` | Headless bulk equipment planning, deterministic bag organization and composed filter matching |
| `equipment-preview.ts`, `item-ui.ts`, `item-tooltip.ts` | Complete effective equipment comparisons and reusable item presentation |
| `panel-coordinator.ts` | Shared phase, input, focus, panel transition and save-request lifecycle |
| `character-stats.ts` | Combine equipped-item modifiers, allocated attributes, and tree bonuses into derived stats |
| `character.ts` | Refresh the live player projection; award points for XP levels; validate skill assignment |
| `progression-content.ts`, `progression.ts`, `zone-progression.ts` | Shared level/rank curves, XP thresholds and factors, geographic threat, and spawn-stat snapshots |
| `loot-content.ts`, `loot.ts` | Rank yield/tier tables, archetype/biome weights, isolated reward rolls, and source-level gear |
| `skill-tree.ts` | Immutable cluster/curved-route recipes and bounds, connectivity validation, unique bonus aggregation, unlocked skills |
| `skill-tree-routes.ts` | Pure shortest-route and remaining-point-cost previews from the current allocation |
| `skill-tree-art.ts`, `skill-tree-glyphs.ts` | Culled native-resolution atlas drawing and shared procedural stat/skill engravings |
| `skill-content.ts` | Shared names, costs, cooldowns, damage multipliers, colors, and procedural skill icons |
| `skill-combat.ts` | Execute 30 unlocked, assigned, equipment-compatible active actions |
| `projectile-combat.ts` | Swept projectile contacts, pierce/chain/explosion payloads, and direct-hit status/life-steal application |
| `simulation.ts` | Deterministic tick ordering, state, RNG/IDs, movement, spawning and pickup |
| `combat-damage.ts`, `combat-rewards.ts` | Damage/death commitment and exactly-once source-level XP/loot/flask rewards |
| `combat-status.ts`, `ground-effects.ts` | Shared status reapplication/ticking and snapshotted delayed pulses |
| `character-commands.ts` | Runtime validation, transactional mutation and immediate projection refresh |
| `skill-execution-content.ts` | Frozen execution profiles and numeric skill readouts |
| `inventory-panel.ts`, `skill-tree-panel.ts` | UI state and player actions; no independent stat calculation or mutation rules |
| `item-art.ts`, `loot-art.ts` | Equipment icon/worn appearance and ground-marker/label presentation |

`deriveCharacterStats(sheet, treeBonuses, level)` is pure. `refreshCharacter(player)` supplies tree bonuses and character level, updating combat projections inside `executeCharacterCommand` after successful character actions, and inside the XP award operation after level gain. UI callers submit commands rather than remembering a separate refresh step. Raising maximum life or mana does not refill it; reducing a maximum clamps the current amount. Basic attacks and active skills retain their accepted damage, critical chance/multiplier and life-on-hit snapshots through delayed contact. Presentation never grants points, damage, gear, or XP.

## Progression and attribute rules

A new run starts at **level 1, 0 XP**, with **10 Strength, Dexterity, Intelligence, and Vitality**, zero unspent points, a free allocated origin, and five empty active slots. Each character chooses Sword + Shield, Two-handed Sword, Wand + Grimoire, Fire Staff, Shortbow or Longbow and starts with zero gold and 64 empty bag cells. The shared worn leather outfit has no stat bonuses. The Weathered Sword retains its 24 damage and 1.6 attacks/second; the bow and staff use their own profiles. LMB supplies the equipped weapon’s innate melee, arrow, or elemental-bolt attack; these basics require no skill unlock. Melee and bows remain mana-free; staff basics cost four mana and wand basics cost two mana before reductions.

Level-one normal enemies award **20 XP** for a Hollow Stalker, **30** for a Mire Hexer, and **50** for a Gravebound Brute. Geographic area level increases every 3,200 world units from the origin; enemies snapshot their spawn level and normal/veteran/elite rank. Enemy XP scales by `1 + 0.18 × (enemyLevel − 1)`, then by rank (×1 / ×2 / ×5), with a bounded player-level-difference factor applied on death. Source level also controls life, damage, and item level; player level never upgrades an enemy's loot.

The next level costs `roundToNearest5(S × (5 + 2 × (level − 1)^0.8))`, where `S` is a same-level normal Stalker's rounded XP. Thresholds at levels 1 / 5 / 10 / 20 / 50 are **100 / 375 / 865 / 2,295 / 9,800** XP. Overflow can cross several levels. Each gained level grants **1 skill point + 5 attribute points**, without auto-allocating them or healing the character. See [progression and loot](progression-and-loot.md) for the exact curves, XP-gap rules, encounter policy, and worked examples.

Attribute effects apply per point above the starting baseline of ten, including attribute bonuses from gear/tree:

| Attribute | Effect per point above ten |
| --- | --- |
| Strength | +1.5 percentage points of attack damage |
| Dexterity | +0.25 percentage points of attack speed; +0.075 percentage points of critical chance |
| Intelligence | +2 maximum mana; +1.5 percentage points of spell and added elemental damage |
| Vitality | +6 maximum life |

The September 9 Dexterity pass halves both per-point bonuses. This applies equally to assigned points, item/charm Dexterity and tree Dexterity; direct attack-speed and critical-chance bonuses keep their values. With no other bonuses, the critical cap now takes 1,000 additional Dexterity and the attack-speed cap 2,000. Existing builds recalculate normally without resetting attributes or saves. This delays saturation rather than removing the eventual caps.

Flat and percentage modifiers add within their stat before conversion to derived multipliers. For example, `attackSpeedPercent: 4` means **+4%**, not a 4× multiplier. Item implicit modifiers, item affixes, and tree bonuses use the same `StatKey` vocabulary.

Supported effects include life/mana, armor, attack/spell damage, attack speed, critical chance/damage, movement speed, cooldown reduction, life/mana regeneration, life on hit, block chance, and blocked-damage reduction. Block modifiers become active only with a usable equipped shield; chance caps at 75% and reduction at 90%, applied after armor. Base mana regeneration is 1/second; mana-regeneration modifiers from gear and nodes use mana per five seconds and are divided by five before adding to the baseline. Armor reduces incoming damage by `armor / (armor + 120 × (1 + 0.13 × (attackerLevel − 1)))`, capped at 80%. The character sheet estimates armor against the character's own level; combat uses the captured source level, including projectiles already in flight. Critical chance caps at 75%; critical damage starts at 1.5× and caps at 5×. Cooldown reduction caps at 75% and affects active-skill cooldowns and dodge-charge recovery. Movement multiplier caps at 1.75×; final basic attacks remain within 0.25–12 attacks/second. Other numeric bounds keep extreme generated values finite; these are engine limits, not completed balance targets.

The dual potion restores 42% of maximum life and 40% of maximum mana, with two charges and one recovered charge per eight kills. Every third kill drops a 12%-maximum-life pickup; other kills drop a 16%-maximum-mana pickup. These retain their starting values of 42 / 12 / 16 at 100 maximum resources while remaining useful as gear and attributes grow. No recovery exceeds the missing resource.

## Equipment generation and transactions

Cloth robes share the existing chest slot, with matching caster cowls, handwraps, leggings and slippers. Leather/cloth have distinct affix pools, and four ring/four amulet profiles have different implicits. See [equipment materials](item-materials.md).

There are **twelve item kinds** and **eleven equipment slots**: weapon, offhand, head, chest, gloves, legs, boots, cloak, amulet, and two rings. The offhand accepts a shield, grimoire, orb, one-handed melee weapon or wand. One-handed wands also fit the offhand, allowing sword + wand builds. Each item occupies one inventory cell.

Generation is deterministic from seed, item level, optional kind, optional explicit profile ID, and optional explicit tier, using an item-local RNG. Names combine authored base names, prefixes, suffixes, and titles. Icons and worn pieces share the item's procedural palette/material data; weapon icons use their profile dimensions. Jewelry modifies stats but has no dedicated visible character layer yet.

| Tier | General-generator probability | Affixes | Quality multiplier |
| --- | ---: | ---: | ---: |
| Common | 45% | 0 | 1.00 |
| Magic | 32% | 1 | 1.09 |
| Rare | 17% | 2 | 1.20 |
| Epic | 5% | 3 | 1.34 |
| Legendary | 1% | 4 | 1.50 |

These general-generator tier rolls apply to content tools when no tier is supplied. Enemy loot uses separate rank-specific tier tables and explicitly passes the rolled tier; see below. Affixes use slot-specific weighted pools with stronger specialist rolls, shared by generation and enchanting; see [equipment affixes and hybrids](equipment-affixes.md). Tier affects both affix count and potency; legendary currently means a stronger generated tier, not a unique item-specific mechanic.

Generated item level is normalized to an integer within 1–1,000,000, the current numeric content bound. Required character level is `max(1, itemLevel − 2)`. Flat implicit stats and weapon damage scale using `(1 + (itemLevel − 1) × 0.13) × quality × materialBaseScale`. Flat affixes have individual level slopes and a deterministic 0.85–1.15 roll. Percentage affix slopes use the bounded effective growth `25n / (25 + n)`, where `n = itemLevel − 1`; ring damage implicits scale by `1 + 0.65 × effectiveGrowth / 25`. Raw damage/armor can continue growing without unbounded item-level increases to percentage budgets. The displayed item-power value is an informational score; it is not a second hidden damage multiplier.

The generated catalog contains **17 weapons, 3 shields, 3 grimoires and 3 orbs**: four one-handed melee profiles, three two-handed melee profiles, three bows, three elemental staves, four elemental wands, buckler/kite/tower shields and six caster-focus profiles. The separate Weathered Sword is the sword starter; the other choices use Thorn Shortbow and Ember Staff. Weapons carry explicit family, handedness, attack type, and element metadata; drawing and combat consume the same profile. One-handed melee weapons can pair with a shield or another weapon; paired one-handed weapons alternate basics using each weapon’s own attack/cast cadence, damage, reach and mana cost. Mixed wand/melee equipment selects the compatible hand for skills. Two-handed melee weapons, bows, and staves reserve both hands. Unequipping the main weapon selects an actual unarmed profile. One-handed wands support shields, grimoires and orbs. The 2H off-hand reservation is visible in the inventory. See the [weapon and skill catalog](weapons-and-skills.md) for profile values and current actions.

Equip validates source cell, item type, target slot, and level requirement before changing state. Replacing equipment puts the previous item into the source bag cell. A two-handed weapon also stows an occupied offhand; equipping an offhand stows an equipped two-handed main weapon. The full transaction plans all displaced items before committing. A vacated source cell can hold the opposite-hand item when the receiving slot was empty; otherwise an additional stow requires an empty bag cell. Insufficient room rejects the complete action without mutation. Unequip requires an empty target cell. Failed moves never lose or duplicate items. Automatic ring equip prefers the first empty ring slot, then Ring I; explicit targeting supports Ring II.

## Equipment services

Town NPCs provide buying/selling/buyback, guaranteed +0→+10 enhancement, rarity upgrades, single/all-affix rerolls and releveling to the NPC’s geographic zone. Both equipped and bag items can be improved. The shared workbench puts equipped gear above the bag and previews effective character changes; incompatible equipped releveling is rejected.

Every item retains a source recipe with profile, starter flag, normalized affix rolls, enhancement, revisions and separate reroll counters. `deriveItem` rebuilds values from that recipe, applies `1 + 0.05 × enhancement` and rounds once; it never compounds rounded item values. Final character caps still apply. Common starter leather has no base stat bonuses, so enhancing it cannot multiply a missing bonus; rarity upgrades add actual affixes. Shared +N badges, names and tooltip details appear in inventory, equipment and ground labels. See [NPC services](npcs-and-vendors.md) for prices and operation contracts.

## Skill atlas and active skills

The local **Atlas of Becoming** contains 875 nodes, 932 connections and six territories: Bastion, Forge, Hunt, Veil, Crucible and Wellspring. It has 90 different passive specialties, 30 tree-unlocked active skills, 90 direct one-point Techniques, eight exclusive Doctrine families and four optional keystones. Might/Cunning/Arcana remain content tags. The wide luminous map replaces the three celestial petals; 36 hybrid border gardens fill the gaps between the original 48 territory specialties, and six optional late clusters decorate the Bastion and Veil approaches.

Early active paths cost 2–6 points; advanced attacks cost 8–14; ultimates cost 23–26. Skills and tradeoffs are optional dead ends, never travel tolls. Three purchased ranks replace mastery gates and seven-rank growth. Doctrines permit one paid choice per family with free reconfiguration. The enchanter still provides full skill respec. See [skill progression](skill-progression.md) for exact formulas, all choices, actions, save refunds and verification boundaries.

LMB remains the equipment basic attack. Exactly five assignable skills occupy RMB / 1–4, with Q potion and Space dodge separate. Skills require unlock, assignment, compatible equipment, mana, recovery and a ready skill-owned cooldown. Incompatible equipment retains assignments. Physical melee and bow damage uses attack scaling; spells and magic bolts use spell scaling once. Magic requires staff/wand, bow skills require a bow, shield skills require a usable shield; Sidestep and Brace accept any weapon.

The shared validated command boundary owns allocations, atomic shortest-route purchases, rank/Technique choices and Doctrine replacement. Presentation never writes progression directly. Current saves carry treeVersion 2; valid immediately preceding builds receive their tree/rank points back on decode while retaining character and world progress. Unknown/corrupt builds remain stored. The atlas preview reads only disposable state, not playable saves.

## Enemy gear drops

The first actual enemy kill guarantees at least one gear drop. Otherwise a **normal** enemy has a **28%** one-item chance, a **veteran** has **70%**, and an **elite** guarantees one item with a **25%** chance of a second. There can be at most **96 ground items**. Item level is the enemy's captured spawn level, plus **0 / 1 / 2** for normal/veteran/elite; leveling up on that kill cannot change it. The isolated seed derives from the world seed, spawn ordinal, and spawn position, so unrelated combat RNG and later movement do not reroll rewards. Gear is separate from health/mana pickups.

| Source rank | Common | Magic | Rare | Epic | Legendary |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal | 75% | 22% | 2.7% | 0.28% | 0.02% |
| Veteran | 60% | 32% | 7% | 0.95% | 0.05% |
| Elite | 40% | 45% | 13% | 1.9% | 0.1% |

These are conditional tier probabilities per dropped item, not per kill. Archetype weights bias item kind: Brutes favor shields/heavier armor; Hexers favor jewelry/cloaks. Captured source biome biases weapon/shield profiles: Deadwood favors heavy melee, Verdant bows/daggers, and Swamp elemental staves. Every kind and profile remains eligible. The complete tables and examples are in [progression and loot](progression-and-loot.md).

Ground gear uses its actual procedural equipment silhouette, restrained rarity markers/glints and a native-resolution name/rarity/level label. Labels avoid overlaps; enemy remains fade independently from persistent loot. Moving within **30 world units**, with line of sight, automatically inserts it into the first empty inventory cell. If the bag is full, the item stays on the ground and the notice is throttled. Ground gear has no timed expiry; the population cap bounds it. Unequipped items can be sold at the blacksmith or jeweler. Manual pickup selection, dropping/deleting items, stash and loot filters remain absent.

## Persistence and verification boundary

Character progress now persists in eight browser-local slots. The character hall resumes saved gear, XP, allocations, assignments, resources, position and ground loot, with a separate explored chart per character. New characters have the same worn leather outfit, their selected starter loadout and an empty bag. Gold and uncollected coin piles are also saved. See [character checkpoints](character-saves.md) for backup, validation, autosave and recovery rules. No migration or cloud sync is introduced.

Code tests cover graph connectivity, stable unique nodes, themed cluster membership, spacing and bounds, curved hybrid routes, shortest-route costs, short skill paths, allocation rejection, modifier deduplication, item generation and scaling, inventory conservation, stat derivation, skill execution, and integration behavior. Strict browser/core TypeScript and production builds remain the verification gates. Static in-app review scenes are used for screenshots; they stage data without gameplay or save access. The user owns gameplay feel, visual feedback, and balance acceptance.

### Repeatable skills and action-speed split

The first skill in each of the nine weapon schools has zero cooldown; second skills retain cooldowns and cost 24–40 base mana. All skills still consume mana and respect their action animation/recovery. Attack speed scales melee/bow actions; cast speed scales staff/wand basics and magic actions. Both apply after the shared 0.8 weapon cadence factor, used by basics and compatible skills across every weapon family. Gear and passives can reduce mana costs (first 20% at full value, then diminishing returns toward 40%), with the same effective value used in activation and UI. See the current [skill catalog](weapons-and-skills.md) for costs and sources.

Each of the five terraces now has a direct bridge between every pair of disciplines (15 guaranteed outer bridges), in addition to the three inner bridges and organically selected routes. Crossing a border needs at most two intermediate travel nodes.

### Skill development (2026-09-06)

[Skill progression](skill-progression.md) documents purchased ranks, lower casting ranks, selectable specializations, mastery, Overload and three deep Arcana ultimates. `skill-progression.ts` is the shared resolution path for combat and UI. Rank purchases consume skill points but never gate traversal. Save v3 includes this state and its point accounting.


### Elemental melee affixes · 2026-09-07

Melee weapons may roll one weapon-local fire, frost or lightning added-damage affix in an ordinary affix slot. Both basics and weapon skills include this damage, scaled by attack bonuses; offhand affixes never increase main-hand damage. All item services rebuild its damage and elemental appearance from the recipe. Shared tooltips and equip comparisons include it. See [elemental weapons and held lighting](weapons-and-skills.md#elemental-weapons-and-held-lighting--2026-09-07) for rules and presentation bounds.

The [2026-09-07 skill corrections](skill-progression.md#audit-corrections--2026-09-07) add prospective specialization costs/potency, sustained guard/storm duration, reliable effect admission, and distinct control/skill feedback. They do not change save version or reset character progress.

## Local spatial inventory prototype (2026-09-09)

The character pack is now **12 columns × 6 rows (72 cells)**, followed by **four charm rows**. The [charm system](charms.md) now activates magical stones in those rows; equipment cannot enter them. This replaces the earlier one-item-per-cell bag described above; it is local and unpublished.

- Jewelry occupies 1×1; daggers/wands 1×2; other one-handed weapons 1×3; two-handed weapons/bows/staves 2×4. Chest armor, cloaks, legs and shields occupy 2×3; helmets, gloves, boots and foci occupy 2×2.
- Dragging retains the grabbed cell offset, previews the entire footprint in green/red, and preserves green compatible-equipment hints. A drop swaps at most one overlapping item, only when both resulting footprints fit. Dropping over several items, an edge or the wrong inventory region fails without mutation. Equipment conflicts must have space for every displaced item.
- **Auto-sort** packs taller/wider items first in one click. Inline Type/Rarity/Recent controls offer ordered packing; if an arrangement would increase overflow, it leaves the pack untouched. Acquisition history stays independent of position and sorting.
- Filters dim nonmatching items in place; they never create fake empty destinations or move the underlying layout.
- Shared insertion rules check footprint space for world pickups, purchases, gambling, buyback and stash withdrawals. Selling/storing frees those cells. A failed transaction keeps gold, gear and saved state unchanged.
- Optional `inventoryLayout` maps owned item IDs to top-left pack cells. Item records retain their stable bag indices during dragging. Older 64-entry records remain readable, grow to 120 records when necessary, and are packed deterministically without modifying the original on read. Items that cannot fit remain accessible in an overflow tray; new pickups for that inventory region are blocked until its overflow is cleared. No item is deleted or transferred to a different character. Save validation rejects overlaps, edge crossings, non-owned IDs and placement in the wrong inventory region.

The tipped-pouch icon beside the Inventory heading accepts dragged items from the bag, charm grid or equipment slots. It lights up during dragging and highlights on a valid target. Dropping transfers the exact item into the current location's ground loot with the shared toss animation, and permits ordinary click pickup afterward. Touch inspection offers **Drop on ground**. `drop-item-command.ts` validates source identity and saves inventory removal, ground placement and resource clamps together before committing; save failure leaves the item owned. Active charm/equipment bonuses refresh immediately without healing. The existing oldest-first ground capacity applies.

Vendor bag views (sell/shop/enchanter/gambler/storage) mirror the same positions, footprints, overflow and active charm rows. `inventory-pack.css` supplies their shared dimensions and presentation; cells shrink to fit the available panel width, including borders and gutters, without horizontal scrolling. Item art and drag-placement highlights use the same cell size. No bag capacity counter is shown. Stock and equipped gear remain separate selectors. The storage chest has five purchasable tabs with physical item footprints, hover inspection and independent per-tab sorting; see [storage rules](settlements.md#gambling-and-storage).

`inventory-grid.ts` owns footprint/occupancy/packing and validation; `inventory.ts` owns atomic transactions; the panel only projects that state. The existing `/character.html` and character workspace preview use this exact runtime panel with disposable gear.


## Detailed stat inspection (2026-09-09)

The character window exposes hover and keyboard-focus explanations for every attribute and combat stat. Each compact, square-cornered glass tooltip presents the result first, a short effect, then a calculation with separate cap/timing notes. Attribute calculations show their current bonus contribution without repeating the starting baseline. Named sources include: starting/assigned attributes, individual equipped items (including slot), allocated skill-tree totals and active blessings. Bag items contribute nothing. Weapon damage and cadence come from `deriveAttackStats`; per-hand damage includes only that weapon's elemental enchantment. Paired weapon rates are separate, never summed. Staff/wand rates are labeled casts, including the off hand.

Physical/spell damage, speed and potion **bonus** rows show increases above the baseline. Critical damage and movement retain explicit total multipliers. Armor and the same-level reduction estimate use `effectiveArmor` and `armorReduction`, including active Afterguard and Bulwark blessing. Passive shield stats remain separate from the active guard skill's reduction. Skill-rank bonuses are listed by skill and explain that the skill must first be learned. Damage rows exclude criticals, enemy defenses and conditional Spellweave; each skill still uses its rank, specialization and timing.

`character-stat-details.ts` owns the read-only row catalog; its `DERIVED_STAT_DETAILS` contract requires an explicit inspection entry when `DerivedCharacterStats` grows. `characterModifierSources` supplies the same item, tree and blessing modifiers to calculation and source descriptions. Keep formula explanations in sync when tuning `character-stats.ts`; do not introduce a second combat calculation in the panel. Regression coverage includes every starter, source attribution, off-hand casting, enchantments, caps, shield requirements, temporary armor and bonus ranks. No gameplay balance or save format changes in this pass.


## Elemental defenses (2026-09-09)

The detailed sheet now includes Fire, Frost, Lightning and Arcane resistance, starting at zero. Single-element and all-element equipment bonuses add per element, capped at 75%; hover/focus explains the calculation and individual sources. Armor and its same-level estimate now describe physical damage only. Shield block follows either physical armor or elemental resistance.

Resistance rolls are restricted to rings, amulets, shields and charms, with at most one resistance family per item. [Equipment affixes](equipment-affixes.md#elemental-resistance--2026-09-09) owns current weights, strengths and upgrade limits. Charms now grant bonuses only in their dedicated grid; see [charms](charms.md). Resistance is derived from normal item modifiers; no save-version change or character reset is needed. Existing items retain their rolls and gain no resistance automatically.


## Offensive attribute balance · local September 11 pass

`attribute-content.ts` owns the 1.5-per-point Strength/Intelligence damage conversion used by both combat and detailed stats. It applies equally to assigned, equipped, charm and tree attributes; dedicated attack/spell percentage bonuses still add inside the same multiplier. Offensive attribute item budgets now taper rather than growing linearly. Dexterity/Vitality, direct damage affixes, skill potency and enemy rules are unchanged by this pass. See [before/after audit](offensive-attribute-balance-2026-09-11.md).

Enchanter → Respec → Attributes provides one free full attribute refund per character. It returns assigned points only, restores base attributes to ten and preserves the skill build and equipment. The optional `attributeResetUsed: true` flag is saved with the refund; absent means available. Resources clamp without healing, stale quotes fail, and failed saves consume neither points nor the entitlement.
