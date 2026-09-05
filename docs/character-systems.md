# Character systems foundation

2026-09-05 · local, unreleased prototype.

The character sheet now connects equipment, attributes, tree allocations, active skills, and loot to real combat. This is an extensible first foundation, with bounded rules and shared data. Its many tree nodes reuse authored bonus families; it is not a claim of thousands of distinct abilities or a balanced endgame.

## What the player can do

- **C / I:** open the same character window: procedural character doll and eleven equipment slots on the left, a 48-cell inventory in the middle, attributes and detailed combat stats on the right.
- Inspect an item by hovering, keyboard focus, or selection. Its tooltip/detail card shows tier, item level, required level, weapon profile, modifiers, and comparison against the relevant equipped item.
- Drag an item onto a compatible equipment slot, use **Shift-click** to equip/unequip, or use the selected item's button. Dragging between bag cells swaps their contents. Rings support either ring slot.
- **T:** open the skill atlas. Pan, zoom, search names/bonuses, filter a domain or reachable stars, inspect a node, and spend a point on a connected node. Hovering or selecting a distant node previews the shortest route from the current build and its remaining point cost. Canvas keyboard navigation follows neighboring stars; the allocation button remains a native control.
- Assign unlocked skills to **RMB, 1, 2, 3, 4** from a major node's detail panel. Assigning a skill to a new slot moves its existing assignment; one skill cannot occupy multiple slots. LMB stays the basic attack, Q the potion, and Space the dodge.

These windows pause combat, clear buffered inputs, trap modal keyboard focus, and close with Escape or their shortcut. Unassigned skill slots stay empty and do nothing. The journal is still unavailable.

## State and ownership

`CharacterSheet` in `character-types.ts` owns four base attributes, unspent stat/skill points, allocated node IDs, the bag, equipment slots, and five skill assignments. It is the source of truth. `Player.derived`, basic-attack stats, and rendered equipment are rebuilt projections.

| Module | Responsibility |
| --- | --- |
| `items.ts` | Seeded generation; item tiers, names, affixes, implicit modifiers, starter sheet, explicit profile selection; shared stat labels/formatting |
| `weapon-content.ts` | Thirteen immutable generated weapon profiles and three shield profiles; handedness, attack family, element, cadence, reach, defense, and silhouette |
| `inventory.ts` | Atomic equip/unequip/hand-conflict stow, bag swap, insertion, and attribute allocation |
| `character-stats.ts` | Combine equipped-item modifiers, allocated attributes, and tree bonuses into derived stats |
| `character.ts` | Refresh the live player projection; award points for XP levels; validate skill assignment |
| `skill-tree.ts` | Immutable cluster/curved-route recipes and bounds, connectivity validation, unique bonus aggregation, unlocked skills |
| `skill-tree-routes.ts` | Pure shortest-route and remaining-point-cost previews from the current allocation |
| `skill-tree-art.ts`, `skill-tree-glyphs.ts` | Culled native-resolution atlas drawing and shared procedural stat/skill engravings |
| `skill-content.ts` | Shared names, costs, cooldowns, damage multipliers, colors, and procedural skill icons |
| `skill-combat.ts` | Execute seventeen unlocked, assigned, equipment-compatible active actions |
| `projectile-combat.ts` | Swept projectile contacts, pierce/chain/explosion payloads, and direct-hit status/life-steal application |
| `simulation.ts` | Deterministic timing, damage, kill XP, drops, pickup, and combat/resource effects |
| `inventory-panel.ts`, `skill-tree-panel.ts` | UI state and player actions; no independent stat calculation or mutation rules |
| `item-art.ts`, `loot-art.ts` | Equipment icon/worn appearance and ground-marker/label presentation |

`deriveCharacterStats(sheet, treeBonuses)` is pure. `refreshCharacter(player)` supplies the tree bonuses and updates combat projections after a successful character action. Raising maximum life or mana does not refill it; reducing a maximum clamps the current amount. Existing basic-attack snapshots retain their start-time attack stats. Presentation never grants points, damage, gear, or XP.

## Progression and attribute rules

A new run starts at **level 1, 0 XP**, with **10 Strength, Dexterity, Intelligence, and Vitality**, zero unspent points, a free allocated origin, and five empty active slots. Starter armor is cosmetic, without hidden bonuses; the Weathered Sword retains its 24 damage and 2 attacks/second. Eight level-1 bag items provide immediate equipment choices: Longsword, chest armor, ring, boots, Iron Buckler, Thorn Shortbow, Ember Staff, and Rondel Dagger. LMB supplies the equipped weapon’s innate melee, arrow, or elemental-bolt attack; these basics require no skill unlock or mana.

Kills award **20 XP** for a Hollow Stalker, **30** for a Mire Hexer, and **50** for a Gravebound Brute. The next level costs `100 + 50 × (level − 1)` XP. Overflow can cross several levels. Each gained level grants **1 skill point + 5 attribute points**, without auto-allocating them or healing the character.

Attribute effects apply per point above the starting baseline of ten, including attribute bonuses from gear/tree:

| Attribute | Effect per point above ten |
| --- | --- |
| Strength | +2 percentage points of attack damage |
| Dexterity | +0.5 percentage points of attack speed; +0.15 percentage points of critical chance |
| Intelligence | +4 maximum mana; +3 percentage points of spell damage |
| Vitality | +6 maximum life |

Flat and percentage modifiers add within their stat before conversion to derived multipliers. For example, `attackSpeedPercent: 4` means **+4%**, not a 4× multiplier. Item implicit modifiers, item affixes, and tree bonuses use the same `StatKey` vocabulary.

Supported effects include life/mana, armor, attack/spell damage, attack speed, critical chance/damage, movement speed, cooldown reduction, life/mana regeneration, life on hit, block chance, and blocked-damage reduction. Block modifiers become active only with a usable equipped shield; chance caps at 75% and reduction at 90%, applied after armor. Base mana regeneration is 9/second. Armor reduces incoming damage by `armor / (armor + 120)`, capped at 80%. Critical chance caps at 75%; critical damage starts at 1.5× and caps at 5×. Cooldown reduction caps at 75% and affects active-skill cooldowns and dodge-charge recovery. Movement multiplier caps at 1.75×; final basic attacks remain within 0.25–12 attacks/second. Other numeric bounds keep extreme generated values finite; these are engine limits, not completed balance targets.

## Equipment generation and transactions

There are **ten item kinds** and **eleven equipment slots**: weapon, offhand, head, chest, gloves, legs, boots, cloak, amulet, and two rings. The offhand accepts a shield or a one-handed melee weapon. Each item occupies one inventory cell.

Generation is deterministic from seed, item level, optional kind, and optional explicit profile ID, using an item-local RNG. Names combine authored base names, prefixes, suffixes, and titles. Icons and worn pieces share the item's procedural palette/material data; weapon icons use their profile dimensions. Jewelry modifies stats but has no dedicated visible character layer yet.

| Tier | Drop-tier probability | Affixes | Quality multiplier |
| --- | ---: | ---: | ---: |
| Common | 45% | 0 | 1.00 |
| Magic | 32% | 1 | 1.09 |
| Rare | 17% | 2 | 1.20 |
| Epic | 5% | 3 | 1.34 |
| Legendary | 1% | 4 | 1.50 |

These are tier rolls **conditional on an item being generated**, not the chance for an enemy to drop gear. Affix stats are sampled without repetition from 17 shared families; shields can also roll block chance and blocked-damage reduction. Tier affects both affix count and potency; legendary currently means a stronger generated tier, not a unique item-specific mechanic.

Generated item level is normalized to an integer within 1–1,000,000. Required character level is `max(1, itemLevel − 2)`. Base implicit stats and weapon damage scale using `(1 + (itemLevel − 1) × 0.13) × quality`. Affixes have individual level slopes and a deterministic 0.85–1.15 roll. The displayed item-power value is an informational score; it is not a second hidden damage multiplier.

The generated catalog contains **13 weapons and 3 shields**: four one-handed melee profiles, three two-handed melee profiles, three bows, three elemental staves, and buckler/kite/tower shields. The separate Weathered Sword remains the equipped starter. Weapons carry explicit family, handedness, attack type, and element metadata; drawing and combat consume the same profile. One-handed melee weapons can pair with a shield or another weapon; dual-wield basics alternate hands using each weapon’s own cadence, damage, and reach. Two-handed melee weapons, bows, and staves reserve both hands. Unequipping the main weapon selects an actual unarmed profile. Wands remain future content. See the [weapon and skill catalog](weapons-and-skills.md) for profile values and current actions.

Equip validates source cell, item type, target slot, and level requirement before changing state. Replacing equipment puts the previous item into the source bag cell. A two-handed weapon also stows an occupied offhand; equipping an offhand stows an equipped two-handed main weapon. The full transaction plans all displaced items before committing. A vacated source cell can hold the opposite-hand item when the receiving slot was empty; otherwise an additional stow requires an empty bag cell. Insufficient room rejects the complete action without mutation. Unequip requires an empty target cell. Failed moves never lose or duplicate items. Automatic ring equip prefers the first empty ring slot, then Ring I; explicit targeting supports Ring II.

## Skill atlas and active skills

The fixed atlas contains **2,824 nodes**, **2,923 undirected curved connections**, and **150 irregular constellations** across **Might, Cunning, and Arcana**:

- 1 free origin.
- 1,528 minor nodes within themed constellations.
- 1,128 minor travel nodes connecting specialties; these grant their discipline's attribute.
- 150 notable nodes, one concentrated reward in each constellation.
- 17 major nodes, each unlocking one executable active skill.

Three winding arteries lead outward through organically spaced regions. Ellipses, open crescents, fans, and branching boughs contain 9–14 nodes each. Each constellation develops one consistent specialty, such as armor, critical chance, or mana regeneration; its notable strengthens that theme and adds a related bonus. Seven authored specialty recipes per discipline provide the current content. The connecting network adds 47 circuit crosslinks, including routes across discipline boundaries, so hybrid builds can traverse between regions without returning to the origin. Node centers remain at least 22 world units apart, and cluster bounds include their actual geometry.

All nodes have stable IDs from deterministic content recipes. There are no class locks. Every node can be reached from the origin. Nine named weapon schools lead to **four-point first skills** and **seven-point advanced skills** along their shortest origin routes; the dagger school currently has one skill. Allocate requires a real node, an integer unspent point, an allocated neighbor, and no existing allocation. Duplicate/unknown IDs do not add bonuses. Allocation is permanent for the current run; respec is not present.

The shortest-route preview starts at any already allocated node, highlights the fewest additional points to the hovered or selected destination, and reports that cost. It is informational: points are still spent individually on connected nodes. Equivalent builds resolve tied routes deterministically.

The seventeen skills cover melee sweeps and dashes, heavy-weapon shocks, shield strikes/guarding, bow fans/piercing/ricochets/area rain, dagger backstabs, fire/ice/lightning spells, and life-stealing spirits. Shared metadata includes equipment requirements, mana costs, cooldowns, potency, and icons. The full [weapon and skill catalog](weapons-and-skills.md) lists every school, skill, and profile.

Physical melee and bow attacks use the derived attack-damage multiplier; staff bolts use the derived spell-damage multiplier. Both share attack-speed modifiers. A skill multiplies the compatible weapon's derived hit by its authored potency; spell scaling is applied once. When a melee skill can use either held weapon, the main hand takes priority. Bow/staff skills require their two-handed main weapon; shield skills require a usable equipped shield. Assignments survive gear changes, but incompatible slots cannot activate.

Skills require unlocking, assignment, compatible equipment, enough mana, and a ready cooldown. Cooldowns belong to skill IDs and survive reassignment. Innate LMB attacks are separate from the five assignable skills: there is no universal right-click cast or automatic sword combo. Rift Lunge is a timed, collision-resolved dash. Rain of Arrows delivers four area pulses; Meteor delivers a delayed blast and ignition. Normal direct hits can critically strike and trigger life on hit. Soul Siphon heals 35% of actual enemy life removed by its direct hit, capped by missing player life. Burns tick every 0.5 seconds without critical rolls or life-on-hit healing. Requirements, mechanics, and balance remain authored initial content for iteration.

The atlas uses event-driven native-resolution Canvas drawing with curved-geometry culling, rather than one DOM node per star. Overview zoom emphasizes regions and connecting routes; closer views reveal constellation names, notable frames, and code-defined engravings for the actual stat or skill. The same engraving paths appear in node details. The detail pane, search, filtering, zoom controls, and skill assignment use ordinary UI controls. It shares Astral steel/silver/violet materials with the inventory and live HUD; world CRT processing does not touch text.

## Enemy gear drops

The first actual enemy kill guarantees a gear drop. Subsequent kills have a **45%** gear-drop chance while fewer than **96 ground items** exist. Generated item level uses the player's level after that kill's XP award. The drop seed derives from the simulation seed and entity ID. Gear is independent of the existing health/mana pickup system.

Ground gear has a tier-colored marker, glow, and a crisp native-resolution name label. Moving within **30 world units**, with line of sight, automatically inserts it into the first empty inventory cell. If the bag is full, the item stays on the ground and the notice is throttled. Ground gear has no timed expiry; the population cap bounds it. Manual pickup selection, dropping/deleting items, stash, selling, crafting, and loot filters are absent.

## Persistence and verification boundary

Character level/XP, equipment, inventory, allocations, assignments, and ground loot are **run-local**. A new run or reload resets them. Exploration-chart persistence remains separate and unchanged. No character save format, migration, or backward-compatibility layer is introduced.

Code tests cover graph connectivity, stable unique nodes, themed cluster membership, spacing and bounds, curved hybrid routes, shortest-route costs, short skill paths, allocation rejection, modifier deduplication, item generation and scaling, inventory conservation, stat derivation, skill execution, and integration behavior. Strict browser/core TypeScript and production builds remain the verification gates. Static in-app review scenes are used for screenshots; they stage data without gameplay or save access. The user owns gameplay feel, visual feedback, and balance acceptance.
