# Weapons and skills

2026-09-06 · current local prototype catalog.

Weapons supply the basic attack immediately. LMB swings a melee weapon, fires an arrow from a bow, or releases an elemental bolt from a staff or wand. The five active slots remain empty on a new run; major tree nodes unlock skills for assignment to RMB and 1–4. Melee/bow basic attacks cost no mana; staff bolts cost 4 base mana and wand bolts cost 2, reduced by mana efficiency. Potion and dodge keep their separate Q and Space shortcuts.

## Weapon profiles

`weapon-content.ts` owns 17 generated weapon profiles and three shields. `equipment.ts` owns the starting Weathered Sword and the unarmed fallback. Values below include shared cadence tuning, before item level, rarity, affixes, and character bonuses. All weapon actions use 80% of their authored weapon rate; this applies to existing gear as well as new drops. Range is measured in world units; ranged range is projectile travel distance.

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
| Cinder Wand | `cinder-wand` | 1 | 16 | 1.92 | 440 | Fire bolt |
| Hoarfrost Wand | `hoarfrost-wand` | 1 | 14 | 2.08 | 420 | Frost bolt |
| Spark Wand | `spark-wand` | 1 | 11 | 2.48 | 460 | Lightning bolt |
| Star Wand | `star-wand` | 1 | 17 | 1.84 | 450 | Arcane bolt |
| Weathered Sword — starter | `weathered-sword` | 2 | 24 | 1.6 | 60 | Physical swing |
| Unarmed — empty main hand | `unarmed` | 1 | 5 | 1.44 | 24 | Physical strike |

Melee basics cut from the attacking shoulder across the body: main-hand contact sweeps from the positive arc edge to the negative edge, and off-hand contact mirrors it. The projected blade and physical contacts share this handed progression; damage, range and action phase durations remain profile-driven.

Fire contacts burn, frost contacts slow movement by 20% for 1.5 seconds, and lightning contacts briefly interrupt. Arcane bolts remain direct damage. Area explosions, chaining, and stronger status effects belong to unlocked skills. Any staff or wand can use a magic-required skill, regardless of its innate element.

Physical melee attacks and arrows use `attackDamageMultiplier`; staff and wand bolts use `spellDamageMultiplier`. Melee and arrows use `attackSpeedMultiplier`; staff/wand bolts and magic spells use the independent `castSpeedMultiplier`. This keeps Strength/attack-damage bonuses and Intelligence/spell-damage bonuses on their respective damage paths. Active skills multiply a compatible held weapon’s derived hit by their potency, preferring the main hand; staff spell scaling is already included and is never applied a second time. Normal direct hits can critically strike and trigger life on hit.

Local challenge tuning (2026-09-11): Arc Lightning heals full life-on-hit on its first contact, 25% on each additional distinct target and none on revisits within that cast. Single-target recovery, mana costs and damage are unchanged. Veterans/elites/bosses now share bounded control durations and a protected recovery window across melee stagger, lightning, stun and freeze. Ordinary foes remain controllable. See [combat power audit](combat-power-audit.md).

## Caster off-hands

`focus-content.ts` owns six focus profiles, each with normal generated names, rarity, materials, affixes, enhancement and releveling. All occupy the offhand slot. Their base implicits are:

| Profile | Item | Base implicit bonuses |
| --- | --- | --- |
| `ember-codex` | Ember Codex | +14 mana, +0.4 mana/sec |
| `rime-folio` | Rime Folio | +18 mana, +3% mana-cost reduction |
| `astral-grimoire` | Astral Grimoire | +12 mana, +3% cooldown reduction |
| `cinder-orb` | Cinder Reliquary | +7% spell damage, +5% critical damage |
| `rime-orb` | Rimeglass Orb | +5% spell damage, +3% cast speed |
| `astral-orb` | Astral Sphere | +6% spell damage, +1.5% critical chance |

Grimoires emphasize reserves and sustain; orbs emphasize potency. Wands and staves share a seven-stat caster pool; grimoires and orbs each have a distinct six-stat pool. See [equipment affixes](equipment-affixes.md) for slot identities, weighted rarity and specialist budgets. Percentage implicits use the same bounded item-level curve as rings; flat implicits use normal item power scaling. Rerolls, rarity previews and generation consume the same pool. Every biome can drop all profiles, with climate-specific elemental weights; caster and wisp loot favors foci. Blacksmiths carry a wand and jewelers carry a grimoire and orb.

The off-hand socket shows a dimmed weapon silhouette, hatching and **2H** when the main weapon reserves both hands. Hover explains the reservation and swapping behavior. Weapon cells also carry a small 1H/2H badge. This is visual occupancy: a valid off-hand equip still stows the two-handed weapon safely.

## Shields and hand transactions

| Shield | Profile ID | Block chance | Damage reduced on a block | Base armor |
| --- | --- | ---: | ---: | ---: |
| Iron Buckler | `iron-buckler` | 20% | 55% | 7 |
| Vigil Kite Shield | `vigil-kite` | 28% | 65% | 15 |
| Bastion Tower Shield | `bastion-tower` | 36% | 75% | 22 |

Block chance and blocked-damage reduction are distinct stats. Shield bases and modifiers use whole percentage points; derived combat values use fractions. Chance caps at 75%, reduction at 90%; blocks have no facing restriction. Block stats are zero without a usable equipped shield. Armor reduces incoming damage before the block reduction; a landed hit still deals at least one damage. Bulwark makes incoming hits block for three seconds and raises blocked reduction to at least 75% while the shield remains equipped.

The offhand accepts a shield, grimoire, orb, one-handed melee weapon or wand. Wands fit either hand and support mixed sword + wand builds; full-sized staves remain two-handed. One-handed weapons can be used alone, with a shield, or together. Paired one-handed weapons, including sword + wand, alternate basics using each hand’s own damage, attack/cast cadence, reach and mana cost. One click starts one action; neither hand fires simultaneously. Melee skills can use a compatible weapon in either hand, preferring the main hand when both fit. Bow skills require a bow; magic skills accept either a staff or wand. Shield skills require an equipped shield and a one-handed or unarmed main hand.

Equipping a two-handed weapon stows any offhand item; equipping an offhand stows a two-handed main weapon. The transaction first plans the source-cell swap and any additional stow. Its vacated source cell can hold the displaced opposite-hand item when the receiving hand was empty. Replacing two occupied hands with a two-handed weapon needs an additional empty cell. If there is insufficient room, nothing changes and no item is lost.

`generateItem(seed, itemLevel, kind?, profileId?, tierOverride?)` supports deterministic profile/tier selection for content tools and static reviews. Unknown profile IDs and mismatched kinds are rejected. Enemy loot chooses profiles from these registries with biome weights, source-level/rank item levels, and explicit rank-table tiers. Weapon damage and base shield armor use `(1 + 0.13 × (itemLevel − 1)) × tierQuality`; percentage affix growth is bounded separately. Armor mitigation scales against the incoming enemy/projectile's captured level. The [progression and loot model](progression-and-loot.md) documents these shared curves and tables.

New characters choose Sword (Weathered Sword), Bow (Thorn Shortbow) or Fire Staff (Ember Staff). They share neutral worn leather armor and 64 empty inventory cells; no test items are granted.

## Skill territories and requirements

The local atlas has 875 nodes, 932 connections, 90 passive specialties, 30 skill groups and six territories. Origin route costs vary from 2 to 33 points. See [skill progression](skill-progression.md#unlock-pacing-and-assignments) for the complete unlock table and the six new movement, defensive and ultimate actions.

Each skill requires allocation, an assigned slot, suitable equipment, enough mana, and a ready cooldown. Gear changes retain assignments, but incompatible slots cannot activate. Cooldowns belong to skill IDs and survive reassignment. The UI and combat consume the same requirement and cost metadata.

## Skill development

Skills now support twenty purchased ranks, optional lower casting ranks, 90 direct Techniques, eight Doctrine families, four keystones and seven ultimates. See [skill progression](skill-progression.md) for implemented formulas, choices and the full ultimate catalog.

## Active skill catalog

Repeatable basic skills have no cooldown; advanced and ultimate actions retain individual cooldowns. All tiers respect action recovery. Costs and cooldowns below are rank-1 authored bases; mana-cost reduction and cooldown reduction independently change their effective values. Mana reduction adds across gear and tree, tapers after 20% toward 40%, and costs round to tenths with a minimum of one mana. Damage potency multiplies the selected compatible weapon’s derived hit. “Melee” means sword, axe, mace, or dagger; “blade” means sword, axe, or dagger. Heavy skills accept an axe or mace of either handedness.

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
| Fireball | Staff or wand | 12 | None | 1.45× | Projectile bursts in an 85-unit radius and ignites survivors for three seconds. |
| Arc Lightning | Staff or wand | 12 | None | 1.4× first hit | Up to five targets; each jump retains 78% of the previous hit's damage. |
| Ice Nova | Staff or wand | 14 | None | 1.5× | Frost in a 115-unit radius; slows survivors by 50% for 2.5 s. |
| Frost Lance | Staff or wand | 28 | 1.8 s | 1.65× per target | Pierces up to four enemies and slows each survivor by 50% for 2.5 s. |
| Meteor | Staff or wand | 40 | 7 s | 3.4× | Aimed 125-unit blast after 0.85 s; ignites survivors. |
| Soul Siphon | Staff or wand | 30 | 4.5 s | 1.65× | Spirit projectile restores 35% of the actual enemy life removed by its direct hit, capped by missing player life. |

Arc Lightning checks the actual displayed camera rectangle for its first target and every jump; ricochets also require an on-screen body when choosing a new target. Partly visible silhouettes qualify. `combat-visibility.ts` shares this rule, and missing/invalid viewport data prevents automatic acquisition. Spawn exclusion padding is deliberately separate. Released projectiles retain their physical flight and collisions.

A projectile cannot hit the same enemy again after piercing or ricocheting. Fireball's primary target is not struck twice by its own explosion. Walls block projectiles and relevant area/chain line-of-sight checks; aimed ground markers stop before solid terrain.

Fireball and Meteor recipes specify a three-second burn at 12% pre-critical damage per second; shared fire contact raises the rate to 15% while retaining that longer duration (45% nominal total before tick rounding). Burns tick every 0.5 seconds, with each tick rounded to integer damage (minimum one), do not critically strike, and do not trigger life on hit. Reapplication keeps the stronger burn rate and longer remaining duration rather than stacking independent burns. Soul Siphon uses actual direct-hit life removed, so overkill does not produce excess healing; normal life-on-hit healing remains a separate effect.

## Boundaries and extension

Gear, XP, attributes, allocations, assignments, resources and skill cooldowns persist in each character’s local save slot. Each character also has a separate explored map. Temporary statuses, projectiles and ground effects are rebuilt when continuing; see [Character saves](character-saves.md). The expanded schools replace the earlier six-skill layout and IDs directly; no legacy save or skill adapter is retained.

This is a concrete initial catalog for testing. Element labels and status effects are implemented, but an elemental resistance/penetration model, ammunition, durability and respecs are not. Persistent characters are implemented through the eight-slot save system. Skills remain authored action recipes, rather than a general scripting system. Balance and combat feel remain for the user's playtesting.

See [character systems](character-systems.md) for item tiers, point rewards, stat formulas, and inventory rules. Add weapon/profile content in `weapon-content.ts`, shared skill requirements/costs/icons in `skill-content.ts`, typed execution profiles in `skill-execution-content.ts`, execution-kind handlers in `skill-combat.ts`, projectile behavior in `projectile-combat.ts`, shared statuses in `combat-status.ts`, and delayed pulses in `ground-effects.ts`. Damage/death and rewards live in `combat-damage.ts` and `combat-rewards.ts`; Simulation preserves their ordered fixed-tick integration. Rendering consumes those definitions and events without awarding damage or effects.

## Action speed and efficiency

Melee and bows use attack speed. Staff innate bolts and staff-or-wand-required spells use cast speed, independently of attack speed. Action duration is the reciprocal of the compatible weapon's effective actions per second (bounded to 0.25–12). Sweeps and casting recovery snapshot that duration; changing gear cannot shorten an action already underway. Dash travel retains its authored duration, while action recovery lasts at least that long. Casting poses, charging lights and dodge-cancel timing use the same snapshotted duration. Cooldown begins at activation and is separate from recovery.

Gear can roll Invocation (cast speed) and Efficiency (mana-cost reduction), with bounded percentage scaling. Inner Flame nodes grant cast speed; Battle Rhythm, Keen Pursuit and Quiet Current grant mana efficiency. Existing cooldown-reduction gear and nodes affect the second-row skills; a zero cooldown stays zero. Character statistics show both speed bonuses and mana-cost reduction. HUD affordability and atlas costs use the actual derived values.


## Ranged aiming

Bow/staff cursor input compensates for the shared 16-unit projectile drawing height. Close to a visible creature silhouette, a small assist region (10 horizontal / 8 vertical units beyond its body ellipse) resolves to the creature's ground position. A modest preference keeps adjacent targets from flickering; leaving the region immediately restores free aim. Assistance rejects dead, obscured, offscreen and out-of-weapon-range targets, with shared obstruction checks. Moving targets receive a partial lead capped at 18 units. The aim controls anticipation and locks at release; projectiles never home.

The native UI draws a faint short sight line and brackets around the assisted target. Ground-targeted skills keep the raw cursor position; melee keeps raw direction. Player projectiles get five extra units of enemy contact tolerance without increasing terrain collision or enemy-shot hitboxes. Arrow trails are slightly more visible. Six new regression tests cover selection, exclusion, lead limits, direction separation and grazes/walls; all 464 code tests and the build pass. Combat feel remains for player feedback.

## Weapon cadence and staff basic costs · 2026-09-06

`WEAPON_ACTION_RULES`, `weaponActionRate` and `basicAttackManaCost` in `equipment.ts` define shared weapon pacing and staff/wand basic costs. Every weapon uses 80% of its authored rate, followed by attack-speed bonuses for melee/bows or cast-speed bonuses for staves and wands. The same cadence drives basic attacks and compatible skills. Starter sword and bow now attack at 1.6 and 1.76 attacks/second; staff cadence stays unchanged. Staff bolts pay four mana and wand bolts pay two mana at windup, reduced by the normal mana-cost multiplier, rounded to tenths with a one-mana floor. Insufficient mana prevents the windup; release never charges again. Cancelling a paid windup does not refund mana. LMB shows its effective cost and dims when unaffordable; item tooltips show tuned base cadence and base bolt cost. Existing version-3 characters and equipment receive this tuning without a reset.

Basic hit damage already grows with weapon item level, rarity, enhancement, attack/spell modifiers, attributes and critical stats; attack/cast speed scales damage per second. Purchased active-skill ranks do not affect LMB. An optional LMB-only mastery per weapon school is a design candidate, not implemented: it could trade skill points (and higher staff bolt costs) for stronger basics and later weapon-specific behavior. It should remain a deliberate basic-attack build choice rather than a required upgrade for spell builds.

## Six starting loadouts

The new-game screen presents three paired rows: Sword + Shield / Two-handed Sword; Wand + Grimoire / Fire Staff; Shortbow / Longbow. `STARTER_LOADOUTS` owns this order and `createStarterLoadout` supplies the same actual equipment to the card icons, portrait and first saved checkpoint. Starting off-hands retain their ordinary base defenses or caster implicits and support normal enhancements. All starting gear is level-one common with no affixes; the bag and five assigned skill slots start empty.


## Elemental weapons and held lighting · 2026-09-07

Magic and higher melee weapons can roll **Kindling**, **Rime** or **Stormbound**, adding fire, frost or lightning damage respectively. An item has at most one elemental affix, occupying an ordinary affix slot; bows, staves, wands and nonweapon equipment cannot roll these weapon-local bonuses. Generation, rarity upgrades and single/all-affix rerolls share that restriction.

The flat added damage is `(4 + 0.52 × (itemLevel − 1)) × roll × tierQuality × (1 + 0.05 × enhancement)`, rounded to tenths. The roll is 0.85–1.15. Physical base damage remains separate. Basic attacks and compatible weapon skills use `base × attack multiplier + elemental bonus × spell multiplier`, followed by normal skill potency/crit rules. Intelligence scales the elemental portion; it does not add damage to the other hand or a separate spell. Dual-wield attacks use the striking weapon's enchantment; swings/dashes snapshot their damage and impact element. Elemental contacts burn, chill or briefly interrupt according to element. There is no resistance/penetration interaction or automatic chain from an enchantment.

`elemental-weapon.ts` owns affix definitions, element colors and weapon-local projection. `deriveItem` rebuilds that projection after services and clears removed powers. Shared item tooltips show the physical base and a colored added-damage line; equip comparisons include the total bonus. Recipe validation rejects mismatched bonus projections. Existing saves continue without a reset; existing melee gear gains these powers only through future rolls/rerolls/upgrades.

Staves, wands, orbs, grimoires and enchanted melee weapons illuminate their surroundings through at most two held-equipment lights. `weapon-emission.ts` uses the same arm/body projection as the actual held geometry, including offhand movement, staff length and orb bob. Element-colored light falls on terrain and uses the existing dungeon wall clipping, shadow and eighteen-light scene budget. Caster tips and orb cores draw after scene darkening and before bloom/CRT so they remain luminous while idle. Fire has warm embers, frost cold glints, lightning short arcs and arcane a soft mote halo. Melee weapons retain their steel silhouette with elemental engravings, a thin moving sheath and a matching sweep/impact response. Reduced motion freezes decorative flicker and drift.

`/weapon-lights.html` is a static, save-free nine-loadout crypt study; `?sample=0` opens the staff close-up. No gameplay or save access is needed to review the lighting.


## Basic caster release · 2026-09-07

Staff basics raise both palms and the upright shaft noticeably, releasing at the lift's peak before smoothly lowering. Wand basics wind back into a compact wrist flick with a short forward hand movement. The offhand stays guarded and staff palms retain their eight-unit spacing. Timing still follows the existing basic ranged phases and snapshotted cast-speed duration; mana and cadence are unchanged.

Basic bolts snapshot their emitting weapon, facing and gait at release. `projectile-launch.ts` computes the same animated tip used by the rig, and places the visible bolt, light and launch flash there. Over 0.18 seconds the elevated launch converges smoothly onto the existing aimed flight/collision plane; a short wake grows behind the moving projectile. This is a bounded visual offset, not homing or extra range, and does not let a raised tip bypass walls. Active bow and magic projectile skills now share this presentation using their instant release pose; innate arrows and enemy projectiles retain their existing origins. Launch snapshots are transient; a weapon change or turning after release cannot move the old launch point. `/weapon-lights.html?sample=0&attack=0.42` shows the basic release, with Idle/Windup/Recovery stage links; sample 3 is the wand.

## Slot pools and elemental hybrids

[Equipment affixes and hybrids](equipment-affixes.md) is the current reference for slot-specific weighted rolls, stronger specialist budgets, split physical/elemental scaling, sword + wand equipment and shared burn/chill/interrupt effects. Mixed one-handed weapons alternate basic attacks one action at a time; assigned skills use the compatible hand.

## Spell anticipation and Meteor aftermath · 2026-09-07

Attack warnings share a stable contact boundary with gathering light and moving material streaks. Enemy warnings use crimson/red shades with pale red highlights and matching surface lights; player warnings retain their elemental colors. Melee sectors, pounce lanes, targeted circles, and Warden fractures read their geometry from the combat definitions. Basic Archer arrows and the Hexer’s three bolts have no ground telegraph or warning light; their cast animations and visible projectiles provide the cue. Shot timing, aim locks and projectile behavior are unchanged. Ground spell art reads live effects rather than independent event timers: Tempest follows its caster and disappears on cancellation; delayed frost and arrow rain retain their actual positions and lifetimes. Surface lights use the existing 18-light scene budget and dungeon masks; hot emission is composed before bloom/CRT. Reduced motion removes travelling fronts and the falling meteor body while keeping timing/boundary cues.

Meteor and Cataclysm now show a molten rock descending into their marked target, followed by an expanding pressure front, flame crown, stone fragments and embers. Each impact still deals its original direct damage exactly once. Its reserved ground-effect slot then becomes **four seconds of burning ground**, refreshing a non-stacking burn on visible enemies within the impact radius every 0.25 seconds. New entrants also burn. Ground burn potency is **12% of the snapshotted impact damage per second**; a stronger existing burn remains strongest under the shared status rules. The ground itself never crits, triggers life on hit, or repeats the explosion. A refreshed burn can persist up to 0.5 seconds after leaving the patch.

`SkillExecution.scorch` owns duration, refresh interval and damage multiplier, so future rank/specialization tuning can change the same resolved recipe without a new executor. Current upgrades already scale its damage through their impact snapshot; base duration remains four seconds at every rank, while Lasting Inferno and Sea of Cinders extend it through their specialization recipes. Shattered Sky and Cataclysm share the aftermath; overlapping patches refresh the strongest burn rather than stacking it. This pass does not change cooldowns, mana costs, attack ranges or saves.


## Skill contact and feedback — 2026-09-07

Crescent Cleave has a broad gold energy crescent that sweeps, tapers and disperses beyond the physical blade. Whirlwind has a full revolving sweep with a second inner wake. `skill-melee-art.ts` reads the attack's actual range, arc, hand and active angular progression, so reach specializations visibly extend or contract the strike. The equipped weapon is not stretched, and the ordinary LMB metal-gold ribbon remains. Rift Lunge leaves bounded afterimages along actual movement, including collision stops.

Shield Bash draws its resolved cone; Backstab draws its thrust and marks successful rear strikes. Earthshatter has ground cracks and a shockwave. Soul Siphon returns a spirit mote only when it actually heals. Rain of Arrows descents use the scheduled wave phase, and Shattered Sky stones scale with their smaller impact radius. Skill audio now has nine physical/elemental families plus landing and chain responses, including Meteor impacts on empty ground. Damage/economy variants may share their parent skill's visual family; geometry, control, extra hits and elemental identity carry the functional differences.

Instant skills retain immediate contact/release and begin their pose at that contact, then recover over the snapshotted action duration. Earthshatter begins in its grounded slam, and active arrows/bolts, lights and release sparks share a weapon-tip snapshot. Cleave/Whirlwind keep their timed damage sweep; innate ranged windup and the shared 0.8 cadence factor are unchanged. This defines a responsive instant-action presentation without introducing new cast delays.

Critical chance/multiplier and life on hit now travel with attacks, dashes, projectiles and delayed direct-damage pulses. Equipment changes after acceptance cannot rewrite these offensive values. Periodic burns still cannot crit or trigger life on hit. Shield skills continue to derive damage and cadence from the held main weapon, including wand + shield; this existing hybrid rule is retained.

The code audit fixes are covered by headless regression tests. No automated gameplay, browser visual acceptance or listening test was performed; the user owns combat-feel and visual testing. This pass preserves saves and introduces no progress reset.
