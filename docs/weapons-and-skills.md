# Weapons and skills

2026-09-05 · current local prototype catalog.

Weapons supply the basic attack immediately. LMB swings a melee weapon, fires an arrow from a bow, or releases an elemental bolt from a staff. The five active slots remain empty on a new run; major tree nodes unlock skills for assignment to RMB and 1–4. Melee/bow basic attacks cost no mana; staff bolts cost 4 base mana, reduced by mana efficiency. Potion and dodge keep their separate Q and Space shortcuts.

## Weapon profiles

`weapon-content.ts` owns 13 generated weapon profiles and three shields. `equipment.ts` owns the starting Weathered Sword and the unarmed fallback. Values below include shared cadence tuning, before item level, rarity, affixes, and character bonuses. All weapon actions use 80% of their authored weapon rate; this applies to existing gear as well as new drops. Range is measured in world units; ranged range is projectile travel distance.

| Weapon | Profile ID | Hands | Base damage | Attacks/sec | Range | Basic attack |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Longsword | `longsword` | 1 | 19 | 1.76 | 54 | Physical swing |
| Warden Axe | `hand-axe` | 1 | 24 | 1.44 | 52 | Physical swing |
| Flanged Mace | `flanged-mace` | 1 | 26 | 1.32 | 48 | Physical swing |
| Rondel Dagger | `rondel-dagger` | 1 | 13 | 2.4 | 40 | Physical strike |
| Greatblade | `greatblade` | 2 | 33 | 1.2 | 69 | Physical swing |
| Greataxe | `greataxe` | 2 | 39 | 1.04 | 67 | Physical swing |
| Grave Maul | `grave-maul` | 2 | 44 | 0.88 | 61 | Physical swing |
| Thorn Shortbow | `thorn-shortbow` | 2 | 18 | 1.76 | 420 | Arrow |
| Crescent Recurve | `crescent-recurve` | 2 | 24 | 1.44 | 520 | Arrow |
| Warden Longbow | `warden-longbow` | 2 | 31 | 1.12 | 600 | Arrow |
| Ember Staff | `ember-staff` | 2 | 28 | 1.2 | 480 | Fire bolt |
| Rime Staff | `rime-staff` | 2 | 24 | 1.32 | 440 | Frost bolt |
| Storm Staff | `storm-staff` | 2 | 17 | 1.84 | 500 | Lightning bolt |
| Weathered Sword — starter | `weathered-sword` | 2 | 24 | 1.6 | 60 | Physical swing |
| Unarmed — empty main hand | `unarmed` | 1 | 5 | 1.44 | 24 | Physical strike |

Rime Staff's basic bolt slows movement by 20% for one second. Other basic bolts are direct projectiles; the staff's element supplies its appearance and innate attack identity. Area explosions, chaining, and stronger status effects belong to unlocked skills. Any staff can use a staff-required skill, regardless of its innate element.

Physical melee attacks and arrows use `attackDamageMultiplier`; staff bolts use `spellDamageMultiplier`. Melee and arrows use `attackSpeedMultiplier`; staff bolts and magic spells use the independent `castSpeedMultiplier`. This keeps Strength/attack-damage bonuses and Intelligence/spell-damage bonuses on their respective damage paths. Active skills multiply a compatible held weapon’s derived hit by their potency, preferring the main hand; staff spell scaling is already included and is never applied a second time. Normal direct hits can critically strike and trigger life on hit.

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

New characters choose Sword (Weathered Sword), Bow (Thorn Shortbow) or Fire Staff (Ember Staff). They share neutral worn leather armor and 64 empty inventory cells; no test items are granted.

## Skill schools and requirements

The atlas contains **2,185 nodes**, **3,047 curved connections**, **150 passive constellations plus 12 development groups**, and **20 skill majors**. Nine schools branch from the central Might, Cunning, and Arcana arteries. A school's first skill costs three points along its shortest origin route; its advanced skill costs four total. The dagger school currently has one skill. Crosslinks allow movement between specialties and disciplines.

| Domain | School | First skill — 3 points | Advanced skill — 4 total points |
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

## Skill development

Skills now support purchased ranks, optional lower casting ranks, deeper specializations, mastery and three Arcana ultimates. See [skill progression](skill-progression.md) for implemented formulas, choices and the full ultimate catalog.

## Active skill catalog

First-row skills have no cooldown; the eight second-row skills cost 24–40 base mana and retain cooldowns. All tiers respect action recovery. Costs and cooldowns below are rank-1 authored bases; mana-cost reduction and cooldown reduction independently change their effective values. Mana reduction adds across gear and tree, caps at 75%, and costs round to tenths with a minimum of one mana. Damage potency multiplies the selected compatible weapon’s derived hit. “Melee” means sword, axe, mace, or dagger; “blade” means sword, axe, or dagger. Heavy skills accept an axe or mace of either handedness.

| Skill | Requirement | Mana | Cooldown | Potency | Effect |
| --- | --- | ---: | ---: | ---: | --- |
| Crescent Cleave | Melee | 12 | None | 1.8× | Swept crescent with 1.4× weapon reach; each enemy is hit once. |
| Rift Lunge | Blade | 24 | 4 s | 1.5× | Continuous 0.24 s dash at 520 units/sec, limited by collision; hits enemies along the traversed path once. |
| Whirlwind | Melee | 12 | None | 1.6× | Full-circle weapon sweep with 1.25× reach; each enemy is hit once. |
| Earthshatter | Axe or mace | 36 | 6 s | 2.6× | Shockwave in a 125-unit radius; stuns survivors for 1.2 s. |
| Shield Bash | Shield | 10 | None | 1.35× | Frontal 68-unit strike; stuns survivors for 1.1 s. |
| Bulwark | Shield | 32 | 8 s | — | Three seconds of guaranteed blocking with at least 75% blocked-damage reduction. |
| Thorn Volley | Bow | 10 | None | 0.8× per arrow | Three arrows in a spreading fan; each stops at its first enemy. |
| Piercing Shot | Bow | 28 | 3.5 s | 1.6× per target | One arrow pierces up to four distinct enemies. |
| Ricochet | Bow | 12 | None | 1.2× per target | Arrow rebounds to up to three additional enemies within 150 units. |
| Rain of Arrows | Bow | 36 | 6 s | 0.7× per wave | Four waves in a 92-unit area, beginning after 0.4 s and spaced 0.3 s apart. |
| Backstab | Dagger | 10 | None | 2.1× | Nearest target in a close frontal thrust; attacking from behind doubles this damage. |
| Fireball | Staff | 12 | None | 1.45× | Projectile bursts in an 85-unit radius and ignites survivors for three seconds. |
| Arc Lightning | Staff | 12 | None | 1.4× first hit | Up to five targets; each jump retains 78% of the previous hit's damage. |
| Ice Nova | Staff | 14 | None | 1.5× | Frost in a 115-unit radius; slows survivors by 50% for 2.5 s. |
| Frost Lance | Staff | 28 | 1.8 s | 1.65× per target | Pierces up to four enemies and slows each survivor by 50% for 2.5 s. |
| Meteor | Staff | 40 | 7 s | 3.4× | Aimed 125-unit blast after 0.85 s; ignites survivors. |
| Soul Siphon | Staff | 30 | 4.5 s | 1.65× | Spirit projectile restores 35% of the actual enemy life removed by its direct hit, capped by missing player life. |

A projectile cannot hit the same enemy again after piercing or ricocheting. Fireball's primary target is not struck twice by its own explosion. Walls block projectiles and relevant area/chain line-of-sight checks; aimed ground markers stop before solid terrain.

Fireball and Meteor burns deal a nominal 12% of their pre-critical direct-hit payload damage per second for three seconds. Burns tick every 0.5 seconds, with each tick rounded to integer damage (minimum one), do not critically strike, and do not trigger life on hit. Reapplication keeps the stronger burn rate and longer remaining duration rather than stacking independent burns. Soul Siphon uses actual direct-hit life removed, so overkill does not produce excess healing; normal life-on-hit healing remains a separate effect.

## Boundaries and extension

Gear, XP, attributes, allocations, assignments, resources and skill cooldowns persist in each character’s local save slot. Each character also has a separate explored map. Temporary statuses, projectiles and ground effects are rebuilt when continuing; see [Character saves](character-saves.md). The expanded schools replace the earlier six-skill layout and IDs directly; no legacy save or skill adapter is retained.

This is a concrete initial catalog for testing. Element labels and status effects are implemented, but an elemental resistance/penetration model, ammunition, durability and respecs are not. Persistent characters are implemented through the eight-slot save system. Skills remain authored action recipes, rather than a general scripting system. Balance and combat feel remain for the user's playtesting.

See [character systems](character-systems.md) for item tiers, point rewards, stat formulas, and inventory rules. Add weapon/profile content in `weapon-content.ts`, shared skill requirements/costs/icons in `skill-content.ts`, typed execution profiles in `skill-execution-content.ts`, execution-kind handlers in `skill-combat.ts`, projectile behavior in `projectile-combat.ts`, shared statuses in `combat-status.ts`, and delayed pulses in `ground-effects.ts`. Damage/death and rewards live in `combat-damage.ts` and `combat-rewards.ts`; Simulation preserves their ordered fixed-tick integration. Rendering consumes those definitions and events without awarding damage or effects.

## Action speed and efficiency

Melee and bows use attack speed. Staff innate bolts and staff-required spells use cast speed, independently of attack speed. Action duration is the reciprocal of the compatible weapon's effective actions per second (bounded to 0.25–12). Sweeps and casting recovery snapshot that duration; changing gear cannot shorten an action already underway. Dash travel retains its authored duration, while action recovery lasts at least that long. Casting poses, charging lights and dodge-cancel timing use the same snapshotted duration. Cooldown begins at activation and is separate from recovery.

Gear can roll Invocation (cast speed) and Efficiency (mana-cost reduction), with bounded percentage scaling. Inner Flame nodes grant cast speed; Battle Rhythm, Keen Pursuit and Quiet Current grant mana efficiency. Existing cooldown-reduction gear and nodes affect the second-row skills; a zero cooldown stays zero. Character statistics show both speed bonuses and mana-cost reduction. HUD affordability and atlas costs use the actual derived values.


## Ranged aiming

Bow/staff cursor input compensates for the shared 16-unit projectile drawing height. Close to a visible creature silhouette, a small assist region (10 horizontal / 8 vertical units beyond its body ellipse) resolves to the creature's ground position. A modest preference keeps adjacent targets from flickering; leaving the region immediately restores free aim. Assistance rejects dead, obscured, offscreen and out-of-weapon-range targets, with shared obstruction checks. Moving targets receive a partial lead capped at 18 units. The aim controls anticipation and locks at release; projectiles never home.

The native UI draws a faint short sight line and brackets around the assisted target. Ground-targeted skills keep the raw cursor position; melee keeps raw direction. Player projectiles get five extra units of enemy contact tolerance without increasing terrain collision or enemy-shot hitboxes. Arrow trails are slightly more visible. Six new regression tests cover selection, exclusion, lead limits, direction separation and grazes/walls; all 464 code tests and the build pass. Combat feel remains for player feedback.

## Weapon cadence and staff basic costs · 2026-09-06

`WEAPON_ACTION_RULES`, `weaponActionRate` and `basicAttackManaCost` in `equipment.ts` define shared weapon pacing and staff basic costs. Every weapon uses 80% of its authored rate, followed by attack-speed bonuses for melee/bows or cast-speed bonuses for staves. The same cadence drives basic attacks and compatible skills. Starter sword and bow now attack at 1.6 and 1.76 attacks/second; staff cadence stays unchanged. Basic bolts pay four mana at windup, reduced by the normal mana-cost multiplier, rounded to tenths with a one-mana floor. Insufficient mana prevents the windup; release never charges again. Cancelling a paid windup does not refund mana. LMB shows its effective cost and dims when unaffordable; item tooltips show tuned base cadence and base bolt cost. Existing version-3 characters and equipment receive this tuning without a reset.

Basic hit damage already grows with weapon item level, rarity, enhancement, attack/spell modifiers, attributes and critical stats; attack/cast speed scales damage per second. Purchased active-skill ranks do not affect LMB. An optional LMB-only mastery per weapon school is a design candidate, not implemented: it could trade skill points (and higher staff bolt costs) for stronger basics and later weapon-specific behavior. It should remain a deliberate basic-attack build choice rather than a required upgrade for spell builds.
