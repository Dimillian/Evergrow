# Combat and progression

Status: working design proposal. This document translates the initial vision into systems to prototype; it is not a final balance specification. **Every count, timing, percentage, range, and content quantity below is provisional.** They express a starting hypothesis and must be revised through playtesting.

## What is fixed, and what is proposed

The user requires reactive, dynamic ARPG combat; strong hit feedback, floating numbers, and particles; a central skill tree containing thousands of melee, ranged, magic, stat, and skill nodes; visible equipment on a procedurally drawn 2D character; and a bottom combat HUD inspired by Diablo, including health and mana orbs, skills, inventory, character, and tree access. Progression should support an infinitely scaling game.

The proposals here are a classless character, a shared tree, deliberate enemy telegraphs, a bounded combat loadout, and an endless sequence of optional danger tiers. Initial development assumes single-player desktop browser play with keyboard and mouse. These are reversible choices, not additional user requirements. “Endless” means repeatable progression and recombination of authored rules; it does not promise infinitely many distinct mechanics, skills, or enemy designs.

## The moment-to-moment loop

Explore, read a threat, commit to an attack, reposition, exploit an opening, and collect a reward that suggests a build decision. The desired rhythm alternates quick ordinary encounters with dangerous enemies that require attention. Exploration and town visits provide recovery and anticipation between fights.

Use directional keyboard movement, mouse aiming, and a basic attack that remains available without mana. A mature loadout contains four active skills, a dodge, and a healing flask. The basic attack changes with the equipped weapon. Holding an attack should repeat it when possible; a skill can optionally be configured to cast on press or hold. Key bindings, targeting indicators, damage-number density, and shake intensity are configurable.

Avoid requiring precise clicking on small enemies. Aim projectiles toward the cursor, give melee clear arcs, and use modest target assistance when several targets overlap. Navigation must respect collision; assistance never secretly extends a weapon beyond its displayed reach. Traversal, combat, and building interiors share the same movement rules.

## Responsiveness is a system requirement

An action has anticipation, commitment, impact, and recovery. Anticipation should communicate a heavy attack without making every weapon sluggish. Light attacks have short commitments; heavy attacks buy greater stagger, reach, or area with a longer commitment. Movement, facing, projectile release, sound, and hit feedback must agree on when an action happened.

Start by testing an input buffer around 100 milliseconds and a light-attack commitment around 120–220 milliseconds. These are tuning hypotheses, not universal targets. A buffered action executes once, expires quickly, and clears when control context changes. Dodge cancels ordinary recovery, but cannot erase every committed attack at no cost. Display the costs of heavy skills through animation and skill descriptions.

Dodge uses a separate rechargeable resource so an empty mana pool cannot remove the primary defensive action. Test two charges and a brief invulnerability interval contained inside the dodge animation. Dodge cannot cross solid walls or closed doors. Hit reactions should briefly communicate damage without letting ordinary groups repeatedly stun-lock the player. Strong control effects need distinct tells, short limits, and a recovery window.

Feedback combines a visible contact flash, directional particles, an enemy reaction, a readable health change, and a matching sound. Reserve stronger screen effects for major impacts. Damage numbers may merge rapid repeated hits against one target; critical hits use shape and emphasis as well as color. Enemy attack warnings remain visible above decorative effects. Reduced-motion and reduced-flash settings preserve all gameplay information.

## A classless tree that can be understood

The tree is the principal build interface, not a gigantic undifferentiated maze. Organize it into recognizable regions: close combat, ranged weapons, elemental magic, forbidden magic, defense, movement, and resource manipulation. These labels describe affinities rather than classes. Bridges deliberately enable hybrids such as a shield-bearing caster or a bow user whose marks trigger spells.

Use several node roles:

- **Foundations:** small, understandable stat increases that establish a route.
- **Techniques:** active skills that must remain allocated and connected to be equipped or used. Permanent discovery makes a node available for allocation; it does not grant free combat power.
- **Modifiers:** change a technique’s behavior, such as turning a projectile into a returning shot.
- **Notables:** strong thematic effects that make a route feel distinct.
- **Keystones:** explicit rule changes with an understandable tradeoff.
- **Bridges:** short, useful connections between neighboring build families.

An example path might improve melee reach, unlock a cleave, add bleeding to its outer edge, then offer a keystone exchanging attack speed for stronger stagger. A cross-region bridge could let damage against bleeding enemies replenish a small amount of mana. Every effect must explain its trigger, limit, and affected skills.

Thousands of nodes are the eventual content scale, not the prototype deliverable. Design tree regions from reusable patterns with curated connections and manually reviewed keystones. Procedural placement may help arrange a graph, but cannot determine balance or discoverability. Avoid hundreds of nominally distinct nodes that all grant the same tiny bonus.

At the widest zoom, show named regions and major destinations. At medium zoom, show routes and notables. At close zoom, show each node and its cost. Search by skill, damage type, status, weapon, and mechanical keyword; preview a route’s total cost; pin a destination; show prerequisites and refund consequences. Support a searchable list view for accessibility. Tooltips compare the actual current build before and after allocation.

Early combat and completed objectives grant experience toward levels and allocation points: test one point per level and a new technique or notable opportunity every few levels. Grant the first movement and defensive tools early rather than requiring long travel through stat nodes. The active allocation budget eventually reaches a finite maximum; its size remains an experiment. Later discoveries broaden available choices within that budget. Progression then primarily follows equipment refinement and higher danger tiers, with no compulsory further point accumulation. Permanent discoveries and mastery records supplement this growth while an established build remains comprehensible.

## Skills, equipment, and stats

Each skill declares tags, resource cost, targeting, damage source, and modifiers. Tags such as melee, projectile, fire, duration, and movement permit predictable combinations. Effects should say whether they add to a shared bonus or apply separately. Avoid unrestricted recursive triggers: triggered skills cannot trigger another copy of their own chain, and proc frequency has explicit limits.

Start with health, mana, attack power, spell power, attack or cast speed, critical chance, critical multiplier, movement speed, armor, and elemental resistance. Add stats only when they create decisions. All visually confirmed ordinary hits connect; accuracy and random evasion are deferred. Use armor against physical hits and resistance against its named damage type. A temporary barrier absorbs damage before health. Mitigation has diminishing returns or caps, and the character panel explains effective protection.

Prototype three statuses with distinct jobs: bleed rewards sustained physical pressure, burn creates ongoing elemental damage, and chill reduces enemy movement and action speed. Specify stacking and refresh rules in one shared rules table before implementation. Crowd control against bosses contributes to a stagger meter or has reduced effect; immunity exceptions must be visible. Avoid ubiquitous full immunities that invalidate a chosen damage type.

Equipment supplies the baseline for damage and defense; the tree supplies much of the behavior. Weapon families change reach, cadence, projectile behavior, or blocking, not just a damage number. Gear slots should correspond to visible layers or attachments on the procedural avatar. The appearance record contains silhouette, material, palette, trim, wear, and permitted effects, separate from randomized combat affixes. A dropped sword, its inventory icon, and the sword in the player’s hand share that record.

Reserve rare special items for meaningful rule changes with explicit limits. A lower-tier favorite can eventually be upgraded through a costly, understandable crafting path, preventing a distinctive build from depending on endlessly reacquiring the same item.

## Enemies that create decisions

Build encounter families around roles: pressure fighters, heavy telegraphed attackers, ranged harassers, flankers, supporters, and environmental hazards. The encounter director budgets their combinations as well as their total strength. Several individually fair attacks can become impossible when every enemy fires simultaneously, so coordinate attack windows and bound overlapping control effects.

Biomes reinterpret these roles through silhouettes, movement, and attacks. A swamp ambusher might hide before lunging; a dead-forest defender might root itself to shelter allies. Day and night can change composition and behavior within the selected danger budget. Darkness must not introduce an unannounced difficulty tier or hide essential warnings.

Elites receive a small number of readable modifiers with compatible combinations. A modifier that leaves damaging ground should have a visible creation tell and expiry. Exclude combinations that deny all escape routes in tight rooms. Bosses use a small set of learnable mechanics, then combine or remix them at higher tiers. More health is permitted, but should not be the principal source of encounter length. Town boundaries and interiors must not create unavoidable enemy entry traps.

Defeating a new boss should first teach something, then reward it. Record the cause of death and the last significant damage sources in a concise recap. This is a learning aid rather than an obligation to study a combat log.

## Loot, crafting, and the town economy

Loot should offer a choice among equipping, storing, salvaging, selling, and crafting. Test common, magic, rare, and unique equipment tiers. Quality controls affix complexity rather than making every lower-rarity object useless. Limit drops to a readable amount; display upgrade comparisons and provide loot filters as content grows. Currency and crafting materials can be collected automatically nearby; equipment requires a deliberate decision.

Use one general currency and a small material set initially. Vendors provide reliable replacement gear and basic consumables. Blacksmiths repair or improve equipment, salvage unwanted items, and offer constrained affix changes. A starter recipe might preserve an item’s identity while rerolling one selected affix from a visible pool. Show costs and possible outcomes before committing. Avoid crafting failures that destroy equipped gear in the initial design.

The healing flask has limited charges during an encounter and refills reliably at sanctuaries. Test partial recovery earned through combat to support long expeditions without unlimited passive healing. Mana recovers through a baseline mechanism and build-specific tools; no character should become permanently unable to fight. Town services and loot rewards should justify returning without forcing a shopping trip after every group of enemies.

## Endless scaling without an unreadable number race

Traversal distance and danger tier are separate coordinates. Walking into the next streamed chunk continues the current tier. An optional guardian trial, entered from a sanctuary and fought at the current tier, unlocks the next tier. Unlocking it does not activate it: at a sanctuary waypoint, the player explicitly selects the tier after previewing threats and rewards. Current-tier travel remains freely available. New biomes, nightfall, and distant settlements do not silently raise danger; returning to a lower unlocked tier remains possible.

A tier increases equipment potential and encounter budget, with periodic additions from a finite library of boss variations, affixes, and world conditions. Introduce these mechanics gradually, then remix known mechanics within tested limits. Repetition will exist; interesting recombination, build experimentation, and optional challenges must earn continued play.

Represent power as a tier identifier plus a bounded local rating. Calculate combat with the bounded difference between player equipment and encounter tier, rather than exponentiating a global level into enormous damage values. Display local damage numbers and explain tier relationships through gear comparisons. Higher-tier equipment retains its tier identity; in lower-tier content, normalize its effective advantage to a generous ceiling. This lets players feel stronger while keeping arithmetic and encounters manageable. Lower-tier encounters grant lower-tier rewards, closing the obvious farming shortcut.

Do not endlessly multiply attack speed, movement speed, projectile count, or particle density. Cap or soften these dimensions and convert excess investment into another documented benefit where appropriate. Long-term records, build unlocks, cosmetic variants, crafting options, and optional challenges supplement gear growth. No forced prestige resets are proposed. Infinite progression still needs deliberate repetition limits, bounded simulation costs, and readable UI.

Proposed expedition reset rules:

| State | Reset behavior |
| --- | --- |
| Geography, settlements, unique rewards, completed one-time objectives | Permanent; expedition and tier changes preserve identity and completion. |
| Renewable enemy/resource encounters | Completed or harvested encounters become eligible for a new generation on explicit sanctuary expedition reset. Unload, reload, and ordinary waypoint travel never reset them. |
| Tier changes | Begin a new expedition. Reward identity includes encounter ID, tier, and generation; preserve claimed flags and uncompleted encounters' reward seeds within each tier. Repeated switching cannot reroll an unearned reward. |
| Failed encounters | Reset combat progress without advancing reward generation. |
| Death recovery | Independent persistent claim; never reset with encounters. |

Reset eligibility advances through completed encounters or harvests, never through repeatedly pressing reset. This permits deliberate repeat farming after success without a free preview-and-reroll loop.

## Respec, death, and a playable first slice

Make experimentation inexpensive. Refund and reallocate freely at sanctuaries during the initial progression band; later charge a modest, previewed currency cost. Swapping eligible allocated techniques between slots at a sanctuary is free. Preview disconnected branches and every equipped skill that a refund would remove. Commit the validated allocation and loadout revision atomically after the player accepts its consequences; never silently leave an invalid loadout. Do not sell respec access or require a separate character to correct an early misunderstanding.

On death, respawn at the last sanctuary, reset the failed encounter's combat progress, and apply a recoverable currency loss. Keep equipped gear, remaining carried currency, and permanent unlocks. Store one persistent recovery claim, reachable at the same location across tier changes and settled exactly once. A new death merges any outstanding claim with the new recoverable loss and relocates that single claim to the latest death's nearest reachable recovery spot. Never create a permanent penalty that makes the failed encounter harder to overcome. A safe retreat to a sanctuary is available outside combat; a separate unstuck action returns the player safely when terrain generation fails. Saving and reloading must not duplicate loot or reroll an encounter for free.

The first playable slice should test the core relationship between combat, the tree, and equipment. Proposed content: two weapon families with their basic attacks, two active slots supplied by a small technique pool, dodge, flask, approximately 40–60 connected nodes, three enemy families covering different combat roles, one elite modifier, one boss, and a small visible equipment set. Establish one working melee loop first; use the second weapon family and a spell technique to validate shared skill rules before expanding the graph. Include one sanctuary village with an inn/vendor and blacksmith, two danger tiers with one explicit increase, death recovery, and save/load. Reuse the slice boss for the guardian trial. The village may share service interiors to keep the slice small.

The slice succeeds when movement and attacks feel immediate, enemy damage is explainable, a tree choice visibly changes play, a dropped item visibly changes the character, and choosing a higher danger tier is understandable. Expansion follows those observations rather than the raw node count.
