# Weapons and skills

2026-09-05 · current local prototype catalog.

Weapons supply the basic attack immediately. LMB swings a melee weapon, fires an arrow from a bow, or releases an elemental bolt from a staff. The five active slots remain empty on a new run; major tree nodes unlock skills for assignment to RMB and 1–4. Basic attacks cost no mana. Potion and dodge keep their separate Q and Space shortcuts.

## Weapon profiles

`weapon-content.ts` owns 13 generated weapon profiles and three shields. `equipment.ts` owns the unchanged starting Weathered Sword and the unarmed fallback. Values below are the authored bases before item level, rarity, affixes, and character bonuses. Range is measured in world units; ranged range is projectile travel distance.

| Weapon | Profile ID | Hands | Base damage | Attacks/sec | Range | Basic attack |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Longsword | `longsword` | 1 | 19 | 2.2 | 54 | Physical swing |
| Warden Axe | `hand-axe` | 1 | 24 | 1.8 | 52 | Physical swing |
| Flanged Mace | `flanged-mace` | 1 | 26 | 1.65 | 48 | Physical swing |
| Rondel Dagger | `rondel-dagger` | 1 | 13 | 3 | 40 | Physical strike |
| Greatblade | `greatblade` | 2 | 33 | 1.5 | 69 | Physical swing |
| Greataxe | `greataxe` | 2 | 39 | 1.3 | 67 | Physical swing |
| Grave Maul | `grave-maul` | 2 | 44 | 1.1 | 61 | Physical swing |
| Thorn Shortbow | `thorn-shortbow` | 2 | 18 | 2.2 | 420 | Arrow |
| Crescent Recurve | `crescent-recurve` | 2 | 24 | 1.8 | 520 | Arrow |
| Warden Longbow | `warden-longbow` | 2 | 31 | 1.4 | 600 | Arrow |
| Ember Staff | `ember-staff` | 2 | 28 | 1.5 | 480 | Fire bolt |
| Rime Staff | `rime-staff` | 2 | 24 | 1.65 | 440 | Frost bolt |
| Storm Staff | `storm-staff` | 2 | 17 | 2.3 | 500 | Lightning bolt |
| Weathered Sword — starter | `weathered-sword` | 2 | 24 | 2 | 60 | Physical swing |
| Unarmed — empty main hand | `unarmed` | 1 | 5 | 1.8 | 24 | Physical strike |

Rime Staff's basic bolt slows movement by 20% for one second. Other basic bolts are direct projectiles; the staff's element supplies its appearance and innate attack identity. Area explosions, chaining, and stronger status effects belong to unlocked skills. Any staff can use a staff-required skill, regardless of its innate element.

Physical melee attacks and arrows use `attackDamageMultiplier`; staff bolts use `spellDamageMultiplier`. Both use `attackSpeedMultiplier`. This keeps Strength/attack-damage bonuses and Intelligence/spell-damage bonuses on their respective damage paths. Active skills multiply a compatible held weapon’s derived hit by their potency, preferring the main hand; staff spell scaling is already included and is never applied a second time. Normal direct hits can critically strike and trigger life on hit.

## Shields and hand transactions

| Shield | Profile ID | Block chance | Damage reduced on a block | Base armor |
| --- | --- | ---: | ---: | ---: |
| Iron Buckler | `iron-buckler` | 20% | 55% | 7 |
| Vigil Kite Shield | `vigil-kite` | 28% | 65% | 15 |
| Bastion Tower Shield | `bastion-tower` | 36% | 75% | 22 |

Block chance and blocked-damage reduction are distinct stats. Shield bases and modifiers use whole percentage points; derived combat values use fractions. Chance caps at 75%, reduction at 90%; blocks have no facing restriction. Block stats are zero without a usable equipped shield. Armor reduces incoming damage before the block reduction; a landed hit still deals at least one damage. Bulwark makes incoming hits block for three seconds and raises blocked reduction to at least 75% while the shield remains equipped.

The offhand accepts a shield or a one-handed melee weapon. One-handed weapons can be used alone, with a shield, or together. Dual-wield basic attacks alternate hands, using the selected hand's own damage, cadence, and reach. Melee skills can use a compatible weapon in either hand, preferring the main hand when both fit. Bow and staff skills require their two-handed main weapon. Shield skills require an equipped shield and a one-handed or unarmed main hand.

Equipping a two-handed weapon stows any offhand item; equipping an offhand stows a two-handed main weapon. The transaction first plans the source-cell swap and any additional stow. Its vacated source cell can hold the displaced opposite-hand item when the receiving hand was empty. Replacing two occupied hands with a two-handed weapon needs an additional empty cell. If there is insufficient room, nothing changes and no item is lost.

`generateItem(seed, itemLevel, kind?, profileId?, tierOverride?)` supports deterministic profile/tier selection for content tools and static reviews. Unknown profile IDs and mismatched kinds are rejected. Enemy loot chooses profiles from these registries with biome weights, source-level/rank item levels, and explicit rank-table tiers. Weapon damage and base shield armor use `(1 + 0.13 × (itemLevel − 1)) × tierQuality`; percentage affix growth is bounded separately. Armor mitigation scales against the incoming enemy/projectile's captured level. The [progression and loot model](progression-and-loot.md) documents these shared curves and tables.

The starter bag contains eight level-1 items: Longsword, chest armor, a ring, boots, Iron Buckler, Thorn Shortbow, Ember Staff, and Rondel Dagger. The equipped starter remains the Weathered Sword with neutral worn armor.

## Skill schools and requirements

The atlas contains **2,824 nodes**, **2,923 curved connections**, **150 themed constellations**, and **17 skill majors**. Nine schools branch from the central Might, Cunning, and Arcana arteries. A school's first skill costs four points along its shortest origin route; its advanced skill costs seven total. The dagger school currently has one skill. Crosslinks allow movement between specialties and disciplines.

| Domain | School | First skill — 4 points | Advanced skill — 7 total points |
| --- | --- | --- | --- |
| Might | Way of the Blade | Crescent Cleave | Rift Lunge |
| Might | Way of the Colossus | Whirlwind | Earthshatter |
| Might | Way of the Sentinel | Shield Bash | Bulwark |
| Cunning | Way of the Marksman | Thorn Volley | Piercing Shot |
| Cunning | Way of the Ranger | Ricochet | Rain of Arrows |
| Cunning | Way of the Dagger | Backstab | — |
| Arcana | Way of the Pyromancer | Fireball | Meteor |
| Arcana | Way of the Winter Star | Ice Nova | Frost Lance |
| Arcana | Way of the Stormcaller | Arc Lightning | Soul Siphon |

Each skill requires allocation, an assigned slot, suitable equipment, enough mana, and a ready cooldown. Gear changes retain assignments, but incompatible slots cannot activate. Cooldowns belong to skill IDs and survive reassignment. The UI and combat consume the same requirement and cost metadata.

## Active skill catalog

Costs and cooldowns are authored bases; cooldown reduction changes the effective cooldown. Damage potency multiplies the selected compatible weapon’s derived hit. “Melee” means sword, axe, mace, or dagger; “blade” means sword, axe, or dagger. Heavy skills accept an axe or mace of either handedness.

| Skill | Requirement | Mana | Cooldown | Potency | Effect |
| --- | --- | ---: | ---: | ---: | --- |
| Crescent Cleave | Melee | 12 | 2.5 s | 1.8× | Swept crescent with 1.4× weapon reach; each enemy is hit once. |
| Rift Lunge | Blade | 10 | 4 s | 1.5× | Continuous 0.24 s dash at 520 units/sec, limited by collision; hits enemies along the traversed path once. |
| Whirlwind | Melee | 20 | 4.5 s | 1.6× | Full-circle weapon sweep with 1.25× reach; each enemy is hit once. |
| Earthshatter | Axe or mace | 24 | 6 s | 2.6× | Shockwave in a 125-unit radius; stuns survivors for 1.2 s. |
| Shield Bash | Shield | 10 | 3 s | 1.35× | Frontal 68-unit strike; stuns survivors for 1.1 s. |
| Bulwark | Shield | 18 | 8 s | — | Three seconds of guaranteed blocking with at least 75% blocked-damage reduction. |
| Thorn Volley | Bow | 16 | 3 s | 0.8× per arrow | Three arrows in a spreading fan; each stops at its first enemy. |
| Piercing Shot | Bow | 14 | 3.5 s | 1.6× per target | One arrow pierces up to four distinct enemies. |
| Ricochet | Bow | 18 | 4 s | 1.2× per target | Arrow rebounds to up to three additional enemies within 150 units. |
| Rain of Arrows | Bow | 24 | 6 s | 0.7× per wave | Four waves in a 92-unit area, beginning after 0.4 s and spaced 0.3 s apart. |
| Backstab | Dagger | 10 | 2.5 s | 2.1× | Nearest target in a close frontal thrust; attacking from behind doubles this damage. |
| Fireball | Staff | 12 | 0.85 s | 1.45× | Projectile bursts in an 85-unit radius and ignites survivors for three seconds. |
| Arc Lightning | Staff | 20 | 3 s | 1.4× first hit | Up to five targets; each jump retains 78% of the previous hit's damage. |
| Ice Nova | Staff | 24 | 5 s | 1.5× | Frost in a 115-unit radius; slows survivors by 50% for 2.5 s. |
| Frost Lance | Staff | 14 | 1.8 s | 1.65× per target | Pierces up to four enemies and slows each survivor by 50% for 2.5 s. |
| Meteor | Staff | 32 | 7 s | 3.4× | Aimed 125-unit blast after 0.85 s; ignites survivors. |
| Soul Siphon | Staff | 18 | 4.5 s | 1.65× | Spirit projectile restores 35% of the actual enemy life removed by its direct hit, capped by missing player life. |

A projectile cannot hit the same enemy again after piercing or ricocheting. Fireball's primary target is not struck twice by its own explosion. Walls block projectiles and relevant area/chain line-of-sight checks; aimed ground markers stop before solid terrain.

Fireball and Meteor burns deal a nominal 12% of their pre-critical direct-hit payload damage per second for three seconds. Burns tick every 0.5 seconds, with each tick rounded to integer damage (minimum one), do not critically strike, and do not trigger life on hit. Reapplication keeps the stronger burn rate and longer remaining duration rather than stacking independent burns. Soul Siphon uses actual direct-hit life removed, so overkill does not produce excess healing; normal life-on-hit healing remains a separate effect.

## Boundaries and extension

Gear, XP, attributes, allocations, assignments, statuses, and ground effects remain run-local. Reloading or starting a new run resets them. Exploration persistence stays separate. The expanded schools replace the earlier six-skill layout and IDs directly; no legacy save or skill adapter is retained.

This is a concrete initial catalog for testing. Element labels and status effects are implemented, but an elemental resistance/penetration model, ammunition, durability, skill ranks, respecs, trading, crafting, and persistent characters are not. Skills remain authored action recipes, rather than a general scripting system. Balance and combat feel remain for the user's playtesting.

See [character systems](character-systems.md) for item tiers, point rewards, stat formulas, and inventory rules. Add weapon/profile content in `weapon-content.ts`, shared skill requirements/costs/icons in `skill-content.ts`, actions in `skill-combat.ts`, projectile behavior in `projectile-combat.ts`, and simulation-owned timing/status application in `simulation.ts`. Rendering consumes those definitions and events without awarding damage or effects.
