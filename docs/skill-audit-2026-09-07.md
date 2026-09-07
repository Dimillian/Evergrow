# Existing skills and specializations audit — 2026-09-07

Audited the current working tree based on `27db29a`, including its existing uncommitted work. This is an audit, not an implementation change or a release record. Gameplay, saves, the development server and the user's browser session were not touched.

There are **20 executable active skills, 60 selectable specializations, 120 skill-specific passive stars, 17 mastery nodes and Arcane Overload**. All 20 skills have three variants. The older “nineteen selectable specialization recipes” entry in AGENTS.md is stale. There are no empty skill executors or wholly unwired specialization selections in the current catalog.

The important gaps are interactions, contact/presentation alignment, sustained-effect lifecycle, and how accurately the UI explains the resolved behavior. Having a recipe and passing activation tests does not establish that every variant's promised effect works correctly end to end.

## Priority findings

### 1. High — ordinary melee hits can erase most of an existing stun/freeze

`applyStun` retains the longer existing control duration, but `damageEnemy` later assigns the ordinary **0.16-second** melee stagger directly on interruptible enemies. A melee hit against a Stalker with 2.5 seconds of control remaining reduces it to 0.16 seconds. This undermines Shield Bash, Earthshatter, Snap Freeze and Absolute Zero when followed by ordinary melee damage or another melee skill.

Confirmed with a headless probe using the real status and damage owners. Preserve the longer control timer, and test follow-up hits against every authored long-control effect. There is no authored “melee breaks freeze” rule to explain this behavior; ordinary stuns are affected too.

Sources: [combat-damage.ts](../game/src/combat-damage.ts), [combat-status.ts](../game/src/combat-status.ts).

### 2. Medium — Storm Anchor bypasses Tempest's equipment and travel cancellation

The stationary specialization sets `follow: false`. Equipment/death checks before effect advancement, and removal on `Simulation.relocate`, are coupled to `follow`. Consequently **Storm Anchor continues striking and charging upkeep after switching to a sword, and survives relocation**. Its upkeep branch still stops it on death at the next payable pulse, so it is not an unlimited post-death damage source.

Confirmed with the resolved stationary recipe and the real ground executor/relocation method. Give maintained spells an explicit cancellation policy independent of whether their position follows the caster. Tests currently cover only the following storm.

Sources: [ground-effects.ts](../game/src/ground-effects.ts), [simulation.ts](../game/src/simulation.ts), [skill-progression.ts](../game/src/skill-progression.ts).

### 3. Medium — several active attacks resolve before their visible action develops

Shield Bash, Backstab, Earthshatter, Ice Nova and Arc Lightning apply their hits directly inside `activateSkill`. Bow and magic projectile skills also launch immediately there. Only afterward does their `castTime` drive the visible action/recovery. A probe confirms Earthshatter has already hit while the visible slam's `pose.cast` is still zero.

Active projectile skills also lack the launch snapshot used by basic staff/wand bolts: their presentation starts at the generic character projectile plane, rather than the releasing weapon tip. Basic ranged attacks already have a later release boundary and basic bolts have tip-aligned launch art.

This is a confirmed presentation/timing gap, not a recommendation to add long casting delays to every skill. Define each action's contact/release moment and align its pose, projectile, sparks, sound and damage. Instant novas/lightning can remain instant if their visual response is explicitly designed that way. Preserve the existing cadence and continuous combat.

Sources: [skill-combat.ts](../game/src/skill-combat.ts), [character-pose.ts](../game/src/character-pose.ts), [projectile-launch.ts](../game/src/projectile-launch.ts), [simulation.ts](../game/src/simulation.ts).

### 4. Medium — melee reach specializations have invisible extra reach

Reaching/Crushing Crescent and Gathering Steel/Iron Cyclone alter the contact range. The shared player pose and SwordTrail do not receive that range. Comparing Original Cleave with Reaching Crescent at the same animation phase produces **identical art poses**, despite contact reach changing from **75.6 to 105.84 units** with the probe weapon.

Whirlwind additionally has a radius-aware generic blast, but its blade ribbon still follows the unchanged weapon geometry. Long Shadow likewise changes Backstab's reach without a corresponding reach parameter in the thrust pose. Preserve the visible gold arc and extend/contract the skill's visible reach cue to explain where damage lands; do not simply stretch the equipped weapon.

Sources: [skill-progression.ts](../game/src/skill-progression.ts), [character-pose.ts](../game/src/character-pose.ts), [sword-trail.ts](../game/src/sword-trail.ts), [character-motion.ts](../game/src/character-motion.ts).

### 5. Medium — effect capacity can silently remove paid specialization effects

Ground casts reserve their required slots before spending mana, including multi-meteor casts. Projectile skills have no equivalent check: the simulation's 128-projectile cap silently refuses additional shots. At the cap, a Forked Flame activation succeeds and spends mana while spawning **zero** projectiles; near the cap a fan can be partial.

Living Ember has a related gap: its patch is scheduled only on projectile impact, and `scheduleGroundEffect` silently drops it if the 16 ground-effect slots are occupied. Its specialization cost was already paid. Meteor/Cataclysm's reuse of their reserved impact slot for scorch is a useful existing pattern.

The projectile case was reproduced; the Living Ember capacity path was verified in code. Add explicit admission/reservation or a defined bounded fallback and cover near-cap fan casts and impact-generated ground effects. Do not remove the bounds.

Sources: [skill-combat.ts](../game/src/skill-combat.ts), [simulation.ts](../game/src/simulation.ts), [projectile-combat.ts](../game/src/projectile-combat.ts), [ground-effects.ts](../game/src/ground-effects.ts).

### 6. Medium — Iron Aegis has ineffective higher casting ranks

Iron Aegis begins at 85% guard reduction and reaches the 90% cap at effective rank 3. Higher ranks leave both reduction and duration unchanged while increasing mana/cooldown. In an isolated recipe probe, purchased ranks 3–7 all give 90% reduction for two seconds, while cost grows from 61.2 to 125.3 mana and cooldown from 8.8 to 10.4 seconds. These values exclude the mandatory leaf passives; those passives change duration/cost but do not remove the plateau.

Equipment bonus ranks can bring this plateau forward. Lower casting ranks are supported, so the player can avoid the extra cost, and buying more ranks can still benefit another selected Bulwark variant. Nevertheless, choosing a higher Iron Aegis rank becomes strictly worse. Decide a useful capped-rank benefit or clearly explain the effective cap and recommend the lower cast rank.

Sources: [skill-progression.ts](../game/src/skill-progression.ts), [skill-tree-panel.ts](../game/src/skill-tree-panel.ts).

### 7. Medium — touch targeting previews misrepresent two self-centered ultimates

`touchTargeting` labels every ground recipe as ground-targeted. Original Tempest and Absolute Zero therefore preview a circle at the aimed location, but the executor places them at the caster. Stormfront/Thunderhead and all Absolute Zero variants inherit this mismatch. Storm Anchor really is ground-targeted and should retain that behavior.

Confirmed the classification with resolved content and traced the drawing/placement paths. Classify the resolved targeting origin explicitly, rather than inferring it only from execution kind. Existing touch tests check representative skills and valid category strings, not these ultimate positions.

Sources: [touch-targeting.ts](../game/src/touch-targeting.ts), [game.ts](../game/src/game.ts), [skill-combat.ts](../game/src/skill-combat.ts).

## Descriptions, graphics and feedback

These findings distinguish concrete mismatches from decisions that need an intended design.

| Area | Current implementation and gap |
| --- | --- |
| Pierce wording | Runtime `pierce` counts **additional** targets. Siegebreaker and Diamond Lance say “pierces only one enemy” but can hit two total; Unbroken Flight hits eight total and Hollow Passage three. Original skill descriptions already add one. Standardize “additional enemies” versus “targets total” before changing balance. Siegebreaker's two-target result was reproduced. |
| Executioner | Its 15% global damage penalty also applies to rear hits. Rear damage is 3× its own reduced frontal hit, but **2.55× Original frontal damage**, whereas the description assigns the penalty to “other hits.” Either change the conditional damage or make the wording explicit. The 2.55× result was reproduced. |
| Shattered Sky | It produces five 45%-damage impacts, but each retains Meteor's 125-unit radius. The falling-rock size function also ignores the specialization/radius. “Five smaller impacts” currently means reduced damage, with no smaller blast radius or meteor silhouette. Decide whether a size tradeoff is intended. |
| Freeze/stun readability | Freeze uses the same `stagger` timer as melee reactions and stuns. The target plate calls it “Stagger”; world status art receives slow/burn timers but no freeze/stun identity. Ice effects exist, but frozen targets are visually ordinary chilled targets that have stopped acting. There is no distinct frozen shell or sustained stun cue. |
| Skill/variant visual identity | Projectiles are differentiated by elemental style; ground spells by effect kind. Fans, larger areas, echoes and extra impacts visibly differ through geometry/counts. Most damage/economy/control variants otherwise reuse identical art; specialization identity is not carried into the presentation events. This is a polish gap, not sixty absent effects. |
| Physical impact identity | Earthshatter uses the generic radial blast path, with no dedicated earth shockwave/crack treatment. Shield Bash/Backstab/Lunge have authored bash/thrust gestures, but primarily share cast sparks and ordinary hit feedback. There is no explicit “successful rear strike” event/cue. |
| Audio | Active casts share one cast sound; swings share one swing sound. `GameAudio` has no dedicated ground/blast/chain handlers or skill-specific cast selection. Thus a Meteor landing on empty ground has no dedicated impact sound, and lightning/frost/fire lack distinct cast/impact signatures. Material hits provide some texture when contacts occur. This was established from dispatch code, not a listening playtest. |
| Sustained buffs | Bulwark has a real raised-shield pose, and Tempest has a real rendered storm. The main HUD's active-skill indicator follows action recovery, not guard/storm lifetime. There is no dedicated remaining-duration/upkeep/end-reason display for these effects. Cooldown remains visible separately. |
| Variant previews | Specialization leaves show their authored tradeoff text but do not resolve an absolute alternate mana/damage/cooldown preview. The resolver is called for skill majors. Selecting a variant also replaces the skill's base description with the tradeoff text, hiding the base mechanic in that view. A before/after preview would help players judge rank, gear and leaf modifiers together. |
| Snapshot boundary | Released base damage, specializations, burn payloads and area recipes are captured. Critical chance/multiplier and life-on-hit still read the player's current derived stats at impact in `damageEnemy`. Gear changes can therefore affect final outcomes of an already released projectile/delayed spell. Decide whether this is intentional and narrow the documentation or capture those offensive values too. |
| Living Ember consistency | Living Ember is six direct periodic pulses at 12% impact damage each, with repeated blast feedback; Meteor/Cataclysm scorch refreshes a non-stacking burn without repeated explosions. Both are called burning ground but have different stacking/feedback behavior. This may be intentional, but should be an explicit rule. |

Sources: [skill-progression.ts](../game/src/skill-progression.ts), [projectile-combat.ts](../game/src/projectile-combat.ts), [skill-effects.ts](../game/src/skill-effects.ts), [ground-spell-art.ts](../game/src/ground-spell-art.ts), [projectile-art.ts](../game/src/projectile-art.ts), [enemy-debuffs.ts](../game/src/enemy-debuffs.ts), [status-art.ts](../game/src/status-art.ts), [renderer.ts](../game/src/renderer.ts), [audio.ts](../game/src/audio.ts), [hud.ts](../game/src/hud.ts), [skill-tree-tooltip.ts](../game/src/skill-tree-tooltip.ts), [combat-damage.ts](../game/src/combat-damage.ts).

## Complete catalog coverage

All listed variants are selectable and modify resolved mechanics. “No specific mismatch found” means no additional defect was established in this audit, not full gameplay/visual acceptance. Shared timing, audio, capacity, snapshot and presentation findings above still apply where relevant.

| Skill | Three implemented specializations | Specific audit notes |
| --- | --- | --- |
| Crescent Cleave | Reaching Crescent; Crushing Crescent; Measured Cut | Swept contact works. Reach-changing variants do not change the blade-trail pose. |
| Rift Lunge | Farstrike; Impaling Rush; Fleeting Step | Continuous collision-resolved dash, one hit per crossed target. Distance/contact-width changes execute; thrust feedback remains shared. |
| Whirlwind | Gathering Steel; Iron Cyclone; Steady Revolutions | Full-circle swept damage works. Blade-trail reach gap; extra generic blast does not replace readable weapon contact. |
| Earthshatter | Faultline; Seismic Hammer; Tremor | Radius, damage and stun changes exist. Immediate hit precedes slam pose; subsequent melee can shorten stun. Dedicated earth-impact art is missing. |
| Shield Bash | Shield Wall; Bellringer; Concussion | Cone and stun changes execute. Contact precedes bash gesture; follow-up melee can shorten control. With wand + shield, damage/cadence derive from the main-hand wand; verify that this hybrid scaling is intended. |
| Bulwark | Enduring Guard; Iron Aegis; Ready Guard | Actual guaranteed block, duration and reduction. Iron Aegis rank plateau; no sustained HUD duration. |
| Thorn Volley | Thornburst; Barbed Volley; Needle Fan | Fan count/spread and added pierce are present. Can partially/wholly fail at projectile capacity after paying. Bow launch precedes its draw animation. |
| Piercing Shot | Unbroken Flight; Siegebreaker; Twin Needles | Penetration and two-arrow variants exist. Clarify total target count versus additional penetrations. |
| Ricochet | Endless Pursuit; Heavy Rebound; Skipping Arrow | Rebound counts and damage modifiers exist; next targets honor visibility and uniqueness. No further specific variant mismatch found. |
| Rain of Arrows | Blanket of Thorns; Relentless Rain; Hail of Barbs | Resolved 4/8/3-pulse patterns and radius changes exist. Falling-arrow animation loops use presentation time rather than the scheduled pulse phase, so exact contact synchronization is not established. |
| Backstab | Long Shadow; Executioner; Quiet Blade | Rear detection and one-target hit exist. Executioner wording/math mismatch; Long Shadow has no matching reach cue; no rear-hit identity in feedback. |
| Fireball | Forked Flame; Living Ember; Flashfire | Fork count, scorch-like periodic patch and explosion radius exist. Tip-launch/timing, effect capacity and burning-ground consistency gaps. |
| Arc Lightning | Storm Circuit; Concentrated Current; Static Thread | Circuit revisits and falloff, focused target count and efficient chain all execute. Instant simultaneous links have shared lightning presentation/audio. |
| Ice Nova | Echoing Frost; Deep Winter; Snap Freeze | Echo, larger/stronger slow and freeze execute. Freeze is presented as ordinary chill/stagger and can be shortened by melee. |
| Frost Lance | Glacial Trident; Permafrost Spear; Diamond Lance | Fan, stronger slow and reduced penetration exist. Diamond Lance's target-count wording is ambiguous; active launch lacks tip alignment. |
| Meteor | Shattered Sky; Lasting Inferno; Worldbreaker | Delayed impact, longer/hotter ground fire and no-scorch Worldbreaker exist. Shattered Sky has unchanged radius/silhouette; dedicated landing audio missing. Worldbreaker still ignites on direct impact; its promise is no ground fire, not no burn. |
| Soul Siphon | Soul Feast; Hollow Passage; Soul Rend | Actual-HP-loss healing, penetration and damage/healing tradeoffs execute. Clarify Hollow Passage total targets; no dedicated soul-return animation beyond generic heal feedback. |
| Cataclysm | Falling Stars; Extinction; Sea of Cinders | 7/11/3 impact counts, larger Extinction zones and long-burning aftermath exist; capacity reservation works. Shares Meteor visuals and missing impact audio. |
| Tempest | Stormfront; Thunderhead; Storm Anchor | Radius, 0.3-second pulse interval and stationary nine-second storm exist. Anchor cancellation defect, following-storm touch-preview mismatch and sustained HUD gap. |
| Absolute Zero | Polar Horizon; Frozen Eternity; Shattering Winter | Larger waves, longer control and one stronger wave exist. Elite freeze reduction exists. Touch origin, freeze readability and melee-shortened control gaps. |

The lack of advanced dagger skills or non-Arcana ultimates is an intentional catalog breadth limitation, not an unimplemented existing skill. Respec, elemental resistances/penetration and LMB mastery are also outside the current implemented skill system.

## Verification and next work

- **160 existing focused code tests passed:** 136 across skill progression/execution/tree/presentation, weapon/character combat, status, effects, Meteor and equipment-affix tests; 24 across touch/ranged/directional input tests.
- **Strict browser and headless-core TypeScript checks passed.**
- **Ten additional temporary headless probes confirmed current behavior:** long-control shortening, stationary-storm cancellation bypass, Siegebreaker target count, unchanged Shattered Sky radius, Executioner damage ratio, immediate hit/launch presentation, paid projectile-cap failure, identical reach-variant pose, Iron Aegis plateau and ultimate touch classification. These probes checked the existing implementation; they were not committed as tests that bless the defects.
- No production build, browser automation, gameplay test, screenshot acceptance or listening test was performed. The graphics findings concern data flow and implemented art paths; composition, combat feel, balance and performance still need player review.

The all-sixty-variants test mostly checks successful activation, resource spending and projectile/scheduled-area counts against the resolved recipe. It does not assert every variant's final damage, status duration after later hits, exact collision count, lifecycle cancellation or visual contact timing. Existing snapshot tests mainly cover base damage/payload changes rather than critical/life-on-hit equipment changes.

Recommended order: preserve authored control durations; fix maintained-storm cancellation; make paid effects reliable under capacity; correct targeting previews and resolve description/rank ambiguities; align action/contact and reach visuals; then add distinct freeze, physical-skill and spell-audio feedback. Add focused regression tests alongside those fixes. No gameplay fixes or balance changes are included in this audit.
