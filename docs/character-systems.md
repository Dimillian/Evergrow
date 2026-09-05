# Character systems foundation

2026-09-05 · local, unreleased prototype.

The character sheet now connects equipment, attributes, tree allocations, active skills, and loot to real combat. This is an extensible first foundation, with bounded rules and shared data. Its many tree nodes reuse authored bonus families; it is not a claim of thousands of distinct abilities or a balanced endgame.

## What the player can do

- **C / I:** open the same character window: procedural character doll and ten equipment slots on the left, a 48-cell inventory in the middle, attributes and detailed combat stats on the right.
- Inspect an item by hovering, keyboard focus, or selection. Its tooltip/detail card shows tier, item level, required level, weapon profile, modifiers, and comparison against the relevant equipped item.
- Drag an item onto a compatible equipment slot, use **Shift-click** to equip/unequip, or use the selected item's button. Dragging between bag cells swaps their contents. Rings support either ring slot.
- **T:** open the skill atlas. Pan, zoom, search names/bonuses, filter a domain or reachable stars, inspect a node, and spend a point on a connected node. Canvas keyboard navigation follows neighboring stars; the allocation button remains a native control.
- Assign unlocked skills to **RMB, 1, 2, 3, 4** from a major node's detail panel. Assigning a skill to a new slot moves its existing assignment; one skill cannot occupy multiple slots. LMB stays the basic attack, Q the potion, and Space the dodge.

These windows pause combat, clear buffered inputs, trap modal keyboard focus, and close with Escape or their shortcut. Unassigned skill slots stay empty and do nothing. The journal is still unavailable.

## State and ownership

`CharacterSheet` in `character-types.ts` owns four base attributes, unspent stat/skill points, allocated node IDs, the bag, equipment slots, and five skill assignments. It is the source of truth. `Player.derived`, basic-attack stats, and rendered equipment are rebuilt projections.

| Module | Responsibility |
| --- | --- |
| `items.ts` | Seeded generation; item tiers, names, base profiles, affixes, implicit modifiers, starter sheet; shared stat labels/formatting |
| `inventory.ts` | Validated equip, unequip, bag swap, insertion, and attribute allocation |
| `character-stats.ts` | Combine equipped-item modifiers, allocated attributes, and tree bonuses into derived stats |
| `character.ts` | Refresh the live player projection; award points for XP levels; validate skill assignment |
| `skill-tree.ts` | Immutable graph/content recipes, connectivity validation, unique bonus aggregation, unlocked skills |
| `skill-content.ts` | Shared names, costs, cooldowns, damage multipliers, colors, and procedural skill icons |
| `skill-combat.ts` | Execute the six unlocked and assigned active actions |
| `simulation.ts` | Deterministic timing, damage, kill XP, drops, pickup, and combat/resource effects |
| `inventory-panel.ts`, `skill-tree-panel.ts` | UI state and player actions; no independent stat calculation or mutation rules |
| `item-art.ts`, `loot-art.ts` | Equipment icon/worn appearance and ground-marker/label presentation |

`deriveCharacterStats(sheet, treeBonuses)` is pure. `refreshCharacter(player)` supplies the tree bonuses and updates combat projections after a successful character action. Raising maximum life or mana does not refill it; reducing a maximum clamps the current amount. Existing basic-attack snapshots retain their start-time attack stats. Presentation never grants points, damage, gear, or XP.

## Progression and attribute rules

A new run starts at **level 1, 0 XP**, with **10 Strength, Dexterity, Intelligence, and Vitality**, zero unspent points, a free allocated origin, and five empty active slots. Starter armor is cosmetic, without hidden bonuses; the Weathered Sword retains its 24 damage and 2 attacks/second. Four rolled level-1 items are included in the bag to make equipment interaction immediately testable.

Kills award **20 XP** for a Hollow Stalker, **30** for a Mire Hexer, and **50** for a Gravebound Brute. The next level costs `100 + 50 × (level − 1)` XP. Overflow can cross several levels. Each gained level grants **1 skill point + 5 attribute points**, without auto-allocating them or healing the character.

Attribute effects apply per point above the starting baseline of ten, including attribute bonuses from gear/tree:

| Attribute | Effect per point above ten |
| --- | --- |
| Strength | +2 percentage points of attack damage |
| Dexterity | +0.5 percentage points of attack speed; +0.15 percentage points of critical chance |
| Intelligence | +4 maximum mana; +3 percentage points of spell damage |
| Vitality | +6 maximum life |

Flat and percentage modifiers add within their stat before conversion to derived multipliers. For example, `attackSpeedPercent: 4` means **+4%**, not a 4× multiplier. Item implicit modifiers, item affixes, and tree bonuses use the same `StatKey` vocabulary.

Supported effects include life/mana, armor, attack/spell damage, attack speed, critical chance/damage, movement speed, cooldown reduction, life/mana regeneration, and life on hit. Base mana regeneration is 9/second. Armor reduces incoming damage by `armor / (armor + 120)`, capped at 80%. Critical chance caps at 75%; critical damage starts at 1.5× and caps at 5×. Cooldown reduction caps at 75% and affects active-skill cooldowns and dodge-charge recovery. Movement multiplier caps at 1.75×; final basic attacks remain within 0.25–12 attacks/second. Other numeric bounds keep extreme generated values finite; these are engine limits, not completed balance targets.

## Equipment generation and transactions

There are **nine item kinds** and **ten equipment slots**: weapon, head, chest, gloves, legs, boots, cloak, amulet, and two rings. Each item occupies one inventory cell. There is no off-hand slot in this increment.

Generation is deterministic from seed, item level, and optional kind, using an item-local RNG. Names combine authored base names, prefixes, suffixes, and titles. Icons and worn pieces share the item's procedural palette/material data; weapon icons use their profile dimensions. Jewelry modifies stats but has no dedicated visible character layer yet.

| Tier | Drop-tier probability | Affixes | Quality multiplier |
| --- | ---: | ---: | ---: |
| Common | 45% | 0 | 1.00 |
| Magic | 32% | 1 | 1.09 |
| Rare | 17% | 2 | 1.20 |
| Epic | 5% | 3 | 1.34 |
| Legendary | 1% | 4 | 1.50 |

These are tier rolls **conditional on an item being generated**, not the chance for an enemy to drop gear. Affix stats are sampled without repetition from 17 supported families. Tier affects both affix count and potency; legendary currently means a stronger generated tier, not a unique item-specific mechanic.

Generated item level is normalized to an integer within 1–1,000,000. Required character level is `max(1, itemLevel − 2)`. Base implicit stats and weapon damage scale using `(1 + (itemLevel − 1) × 0.13) × quality`. Affixes have individual level slopes and a deterministic 0.85–1.15 roll. The displayed item-power value is an informational score; it is not a second hidden damage multiplier.

The three sword profiles trade base damage, cadence, reach, and silhouette: Longsword, Dusk Sabre, and Greatblade. All equipped swords use the existing two-handed grip. Unequipping the weapon selects an actual unarmed profile instead of retaining an invisible sword. Shields, dual wield, bows, and wands are not implemented.

Equip validates source cell, item type, target slot, and level requirement before changing state. Replacing equipment puts the previous item into the source bag cell, including when the bag is full. Unequip requires an empty target cell. Failed moves do not lose or duplicate items. Automatic ring equip prefers the first empty ring slot, then Ring I; explicit targeting supports Ring II.

## Skill atlas and active skills

The fixed atlas contains **2,779 nodes**, **5,886 undirected connections**, and **397 hexagonal constellations** across **Might, Cunning, and Arcana**:

- 1 free origin.
- 2,382 minor nodes using six bonus families per domain.
- 390 notable nodes using three combined-bonus families per domain.
- 6 major nodes, each unlocking one executable active skill.

All nodes have stable coordinate-derived IDs. The graph contains loops and links across domain boundaries; there are no class locks. Every node can be reached from the origin, and each active-skill major is exactly **three allocated points** away. Allocate requires a real node, an integer unspent point, an allocated neighbor, and no existing allocation. Duplicate/unknown IDs do not add bonuses. Allocation is permanent for the current run; respec is not present.

| Major skill | Domain | Mana | Base cooldown | Damage multiplier | Current action |
| --- | --- | ---: | ---: | ---: | --- |
| Crescent Cleave | Might | 12 | 2.5 s | 1.80× | Swept weapon strike with 1.4× reach and a broader arc |
| Rift Lunge | Might | 10 | 4 s | 1.50× | Collision-resolved forward movement up to 96 units; damages along the traversed path |
| Thorn Volley | Cunning | 16 | 3 s | 0.80× per thorn | Three projectiles in a spread |
| Soul Siphon | Cunning | 18 | 4.5 s | 1.65× | Spirit projectile; restores life on contact |
| Astral Nova | Arcana | 22 | 5 s | 2.10× | Area hit within 115 units plus enemy radius, respecting line of sight |
| Ember Lance | Arcana | 9 | 0.65 s | 1.45× | One aimed fire projectile |

The damage basis is the current derived weapon attack. Ember Lance, Astral Nova, and Soul Siphon additionally receive the spell-damage multiplier; Cleave, Lunge, and Volley do not. Normal hit resolution supplies critical rolls and life on hit. Siphon additionally restores 35% of its projectile's base damage on contact, capped by missing life. It is not computed from post-critical damage dealt.

Skills require both unlocking and assignment, enough mana, and a ready cooldown. Cooldowns belong to skill IDs and survive reassignment. There is no universal default right-click attack, default fireball, automatic sword combo, or wand requirement in this increment. Six real actions establish the shared pipeline; more varied animations, weapon-specific restrictions, richer major nodes, and balance remain iteration work.

The atlas uses event-driven native-resolution Canvas drawing with geometry culling, rather than one DOM node per star. The detail pane, search, filtering, zoom controls, and skill assignment use ordinary UI controls. It shares Astral steel/silver/violet materials with the inventory and live HUD; world CRT processing does not touch text.

## Enemy gear drops

The first actual enemy kill guarantees a gear drop. Subsequent kills have a **45%** gear-drop chance while fewer than **96 ground items** exist. Generated item level uses the player's level after that kill's XP award. The drop seed derives from the simulation seed and entity ID. Gear is independent of the existing health/mana pickup system.

Ground gear has a tier-colored marker, glow, and a crisp native-resolution name label. Moving within **30 world units**, with line of sight, automatically inserts it into the first empty inventory cell. If the bag is full, the item stays on the ground and the notice is throttled. Ground gear has no timed expiry; the population cap bounds it. Manual pickup selection, dropping/deleting items, stash, selling, crafting, and loot filters are absent.

## Persistence and verification boundary

Character level/XP, equipment, inventory, allocations, assignments, and ground loot are **run-local**. A new run or reload resets them. Exploration-chart persistence remains separate and unchanged. No character save format, migration, or backward-compatibility layer is introduced.

Code tests cover graph connectivity, stable unique nodes, short skill paths, allocation rejection, modifier deduplication, item generation and scaling, inventory conservation, stat derivation, skill execution, and integration behavior. Strict browser/core TypeScript and production builds remain the verification gates. Static in-app review scenes are used for screenshots; they stage data without gameplay or save access. The user owns gameplay feel, visual feedback, and balance acceptance.
