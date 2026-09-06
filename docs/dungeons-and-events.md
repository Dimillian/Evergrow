# Exploration, events and procedural dungeons

**Implementation update, 2026-09-06:** POIs, warbands and the first Rootbound Crypt are implemented. This document preserves the design proposal; [Dungeons](dungeons.md) records the shipped prototype rules and explicit first-slice limits.


Design proposal · 2026-09-06 · **Not implemented.** This extends [interactive POIs](interactive-pois.md), whose existing interaction/reward rules remain the starting point. All new population, duration, difficulty and reward numbers below are playtest targets, not current guarantees.

## Intended loop

Discover a place → choose a challenge → fight a distinctive encounter → collect a visible reward → improve the build in town → tackle something harder.

The world needs three scales of activity: frequent roaming encounters, short optional landmark events, and substantial dungeon expeditions. Difficulty should ask for movement, target priority and resource management as well as stronger gear. More health alone is not enough.

| Layer | Initial target | Purpose |
| --- | --- | --- |
| Roaming packs | A new encounter every 15–30 seconds of travel through fresh hostile ground | Keep travel active, supply ordinary XP/gold/gear |
| Interactive landmarks | An opportunity every 60–90 seconds of exploration; encounters last 30–120 seconds | Offer a choice, objective and concentrated reward |
| Dungeons | An entrance roughly every 4–6 minutes of fresh exploration; 6–10 minutes per floor | A committed run with optional branches, a dangerous boss and a completion chest |

These are measured pacing targets, not timers that materialize encounters. Site spacing, route length, movement upgrades and camera coverage all affect actual cadence. Towns and the starting clearing stay protected; some quiet space preserves contrast.

## More interesting wilderness combat

Raise the proposed travelling ambient target from 9–14 to 12–16, still under the existing 24 living-actor cap and with at least nine slots reserved from camps/events. Prefer packs of 3–5 over isolated actors, with occasional smaller scouting groups. Admit whole packs only when capacity and offscreen geometry allow; retain travel/cooldown requirements and do not refill cleared ground while the player waits. Camp/event actors share the remaining budget; unavailable capacity queues an encounter rather than spawning partially counted objectives.

Build packs around roles: a melee screen, ranged pressure and at most one disruptive support. Examples: three stalkers with an archer; two hounds flanking a caster; a brute screening two ranged enemies. Tune concurrent attacks separately from population so adding bodies does not mean every actor attacks at once. Keep the existing rank limits initially; difficulty can increase through composition before raising those limits.

Add three enemy behaviors, each useful in events and dungeons:

| Enemy | Recognizable behavior | Player response |
| --- | --- | --- |
| Shieldbearer | Guards a frontal sector, then commits to a broad shield shove and exposes its flank | Reposition, interrupt or attack during recovery; guarding reduces rather than nullifies all damage |
| Hex Cantor | Channels a clearly linked offensive blessing onto nearby allies; cannot heal or resurrect them | Prioritize the support or break line of sight |
| Burrower | Marks a location before a committed underground charge; emerges into a long recovery | Move out of the marked lane, then punish the recovery |

A burrow animation is an existing admitted actor's attack, not a new on-screen spawn. No invisible invulnerability chase, unavoidable offscreen strike, resurrection of rewarded enemies, or repeated summoning rewards.

Later elite modifiers can add one readable rule: delayed death burst, a rotating ward with an exposed side, or a periodically marked ground fissure. Start with one modifier per eligible elite and exclude bosses. Display a small icon plus a concise tooltip. Early zones keep their existing normal/veteran limits; modifiers begin at geographic level 3.

## Give existing landmarks a purpose

The precise initial rewards, blessings and persistence rules remain in [interactive POIs](interactive-pois.md).

| Place | Encounter |
| --- | --- |
| Camp | Clear the garrison to unlock its strongbox. Later strongholds add an authored captain and support composition. |
| Graveyard | Disturb the vigil; two finite guardian groups guard a sealed grave. |
| Standing stones | Select one of two build bonuses, beat the guardians, gain the chosen temporary blessing. |
| Caravan | Choose equipment cargo or a gold cache. Later guarded variants disclose the encounter before selection. |
| Watchtower | Light a beacon to reveal nearby terrain and a landmark; a dungeon entrance is an eligible sighting. |
| Reliquary | A brief roadside gold/item find between larger encounters. |
| Dungeon entrance | Inspect its theme, fixed level and challenge, then enter explicitly. |

Future variants: destroy three linked corruption anchors to expose a sentinel, hunt a marked elite patrol between two landmarks, or accept a curse for an extra chest roll. Reuse objective primitives (defeat roster, interact with anchors, choose reward, reach exit); avoid a separate quest engine for every event. No escort or fragile NPC-defense objective in the first delivery.

Event states are explicit: available, active, suspended, completed, reward pending, claimed. Unseen/sighted/visited belong to exploration, not a second reward ledger. Clearing a camp still reads the existing camp ledger. Leaving and loading preserve casualties and progress. Only one wilderness trial may be active; entering a dungeon suspends it and retains that ownership until it is finished.

## Dungeon run

An entrance belongs to a stable overworld site. Its seed fixes theme, layout, roster, boss and loot. Entry uses the shared E/click interaction with controller parity. Preview only the name, level and challenge; no full floor reveal or long introduction. The first entrance sits near an early exploration route outside the starting sanctuary, without replacing the player's current climate geography.

The first delivery has **one complete floor**, not an unfinished stack of floors:

1. A safe vestibule establishes the exit and visual theme.
2. Explore 10–14 rooms: an entrance, 6–9 combat rooms, optional chambers, a boss approach and an arena. Generated counts must stay inside the total room budget.
3. Two optional branches offer a guarded chest and a small event or elite encounter. Early floors respect the existing rank unlock levels; an elite branch is not required below level 3. A loop reconnects one branch to the main route; avoid constant dead-end backtracking.
4. Reach the boss through the main route. Ordinary doors stay open; no need to kill every stray monster or find three random keys. Optional rooms can be skipped.
5. Defeat the boss to unlock the final chest and a permanent exit to the overworld entrance. Opening the chest never closes the exit.

Population starts at 4–7 enemies per combat room, with 40–65 ordinary enemies across the entire floor. These are persistent roster entries, not simultaneous actors. At most 24 actors are live in the dungeon; it has no wilderness ambient reserve or ambient refill. Admit adjacent room packs through the same visual/collision rules, and target at most 8–12 engaged ordinary foes at once. Boss encounters allow the boss and at most six authored adds; count nearby ordinary actors before admitting adds.

No inescapable room lock can depend on enemies that have not been admitted. The boss door stays open for the first delivery: retreat is allowed, but neither the boss nor its adds reset. Other enemies cannot wander into a sealed optional encounter from another room. Entrance arrival gives the existing short protection, not a resource refill.

### Themes

| Dungeon | Procedural identity | Encounter identity | Boss |
| --- | --- | --- | --- |
| Rootbound Crypt — first delivery | Crooked burial chambers, fractured tile, roots through masonry, cold braziers, amber burial seals | Melee screens, archers, a few hexers, open flanking lanes | The Hollow Warden |
| Drowned Cistern — later | Flooded vaults, bridges, drainage channels, cyan water reflections | Ranged pressure with safe banks and alternating water hazards | The Bell-Drowned |
| Ember Reliquary — later | Broken forge halls, basalt, chain silhouettes, molten channels | Armored guards and interruptible furnace hazards | The Cinder Prior |

The existing seven overworld biomes weight entrance themes and gear tendencies. Start with one excellent kit. Do not build seven shallow dungeon themes in the first pass.

## First boss: The Hollow Warden

A distinct large silhouette, dedicated top-screen boss plate, authored attack scheduler and arena geometry. A boss is not simply an elite with a larger health multiplier. Initial target: 60–90 seconds for an adequately equipped same-level character, calibrated with actual damage/mana throughput. Do not adapt its health to the player's equipped gear.

- **Grave sweep:** a marked broad front swing; the back and a clear outer lane remain safe. Follow with a readable punish window.
- **Root fracture:** narrow ground lines appear, then erupt in sequence. Preserve at least one reachable escape corridor; lock aim before impact.
- **Call the buried:** once at 65% and once at 30% life, call two finite guardians from side passages while the Warden recovers. The side passages must put admission points outside maximum camera coverage; otherwise delay admission and keep the encounter escapable. No repeated threshold wave after re-entry.
- **Final phase:** below 30%, alternate the existing attacks with shorter recovery; do not shorten their warning windows or add an unexplained instant attack.

Proposed warning windows: 0.7–1.0 seconds, followed by 0.6–1.0 seconds of recovery depending on the move. The arena needs enough room for the widest supported camera, safe lanes and offscreen add approaches. Cap concurrent threats so a sweep, fissure and add volley cannot form an unavoidable hit. Ordinary damage is meaningful; the first boss should not deliberately one-shot a reasonably equipped same-level character.

Bosses use explicit reduced durations for hard control, with a short post-control immunity window to prevent permanent stunlock; damaging effects still work. Surface the rule in the boss tooltip. Exact duration reductions need combat testing. Avoid blanket immunity to whole builds.

## Challenge and long-term scaling

Let L be the entrance's geographic area level. A normal first floor uses D = L + 1, clamped to the game's level bound. This fixed value is previewed before entering. Monsters, armor calculations, XP and chest recipes use D; walking to a different room, changing gear or leveling up never changes the source level. The floor's own x/y coordinates must never feed overworld geographic danger.

Later, an explicit **Perilous** choice can generate a separate D = L + 3 expedition with one disclosed modifier and one extra veteran-weight chest roll. Select it before creating the instance; it cannot be toggled to refill rewards or reroll an active floor. Do not implement selectable difficulties in the first slice.

A later **Delve deeper** action after boss completion can create a new floor at D + 2 with a fresh seed derived from entrance ID and depth. Its warning shows the new level; the player can leave instead. This offers an eventual repeatable ascent in difficulty without tying monsters to player level. First delivery ends after its single floor. No same-floor reset button, keys or new crafting currency yet.

## Rewards worth reaching

Regular dungeon enemies use current source-level/rank tables. More enemies must not make rare/gold equipment the default outcome. Each optional guarded chest supplies one veteran-weight item roll at D + 1 and a modest gold cache; the boss chest is the main completion reward.

Proposed final chest: three independent items, one each from the current normal, veteran and elite rarity distributions, at item levels D, D + 1 and D + 2 respectively. All begin at enhancement +0. No guaranteed Rare item. At current weights, the three rolls together have about a 24.1% chance of at least one Rare-or-better item, before optional chests and ordinary enemy drops. Reuse shared table definitions rather than copying those probabilities into runtime logic.

Boss death awards XP equivalent to six same-level normal Stalkers, adjusted by the ordinary player/source-level factor, and grants the ordinary single kill's potion credit. It produces no second generic equipment/gold roll. The final chest contains the equipment plus 45–70 × (1 + 0.1 × (D − 1)) gold, rounded once. These are initial budgets to compare against the full floor's regular XP/gold/items and vendor prices, not an extra multiplier applied to every monster.

Rewards land physically: lid movement, a restrained light pulse, staggered item/coin emergence, readable item names. Use existing individual item notices and stacking gold/XP feed. No guaranteed Rare explosion, auto-equipped reward, or modal loot summary. Full ground capacity preserves a pending bundle; claim and ground insertion must be one exactly-once transaction. A full backpack does not prevent completion or erase the reward.

## Generation and persistence foundations

Use a room graph first, geometry second. Choose a main path, branches and loop; place bounded room footprints; route corridors; reserve doors, safe approach zones, boss lanes and encounter anchors; then decorate. Validate connectivity with the player's collision radius before exposing the floor. At most a bounded number of generation attempts; fall back to a known-valid seeded layout instead of looping indefinitely. Rooms vary proportions, floor materials, lighting and props within recognizable themed recipes.

Solid walls, door thresholds, projectiles, enemy navigation and player collision consume the same floor geometry. Add a bounded room/door navigation graph with local obstacle routing; do not expect current local wilderness steering to navigate a maze. Root/litter/light art must never close the validated paths. Use generated 2D geometry and the current lighting, shadows, particles and world-only CRT. Hide near walls/ceilings through presentation without changing collision.

Introduce an explicit location contract: overworld position or dungeon instance/floor position. Travel return links, saves, exploration, enemy source identities and pending loot all include that location identity. A dungeon is a separate generated world, not a far-away coordinate rectangle in the overworld. Only the active location simulates. Serialize the leaving location's persistent roster/resources/ground loot before switching; do not call a new-run reset or reuse an overworld seed namespace for dungeon members.

Generate the initial scene and register camera coverage before revealing entry. Subsequent ordinary births must stay outside the padded viewport. Boss awakening animates an already present body. Ritual light is not permission to silently materialize a new actor in front of the player.

Town portals work from a dungeon with the usual interruptible channel. Returning restores that exact instance and floor; vendor improvements do not reroll it. Portal departure suspends health, deaths, completed phase thresholds and admitted adds. On return, restore the roster and start a safe warning/recovery rather than resuming an attack mid-impact. Do not refill player resources on scene switches. Death uses current town recovery but preserves the floor and its defeated members; reopening the entrance resumes the expedition. If a boss can be worn down across attempts, that is intentional in this first prototype, not a hidden reset.

Save explored dungeon rooms separately from the overworld chart. The minimap shows local walls/doors and discovered rooms; the large map shows that floor, with an explicit overworld-tab option. Discovery cannot reveal unopened loot or complete objectives. A cleared entrance stays marked cleared, and an active expedition remains identifiable on the overworld map.

Share the POI interaction/claim ledger and typed objective primitives with dungeons. Keep immutable blueprints, mutable encounter state, reward recipes and presentation separate. Proposed owners: dungeon generation/content, location state/transitions, event commands, dungeon encounter roster, boss execution and shared reward bundles. Reuse existing damage/status/loot/wallet/command boundaries, NPC proximity interaction and panel lifecycle rather than duplicating a second combat or economy engine. Coordinate future actor/weapon art edits with the GFX task.

Bounds must be measured before committing a save schema: 14 rooms, 65 ordinary roster entries plus boss/add records per floor, at most one unfinished dungeon expedition per character initially. Different entrances ask the player to finish the active expedition; do not silently erase it. Completed instances retain compact completion/claim records and only unresolved loot state; unopened optional rewards still count as unresolved. Never evict claimed identities in a way that regenerates rewards. Define a tested ledger cap inside the existing save-size budget. Failure to persist leaves both locations and reward ownership unchanged. No migration layer is required; announce any necessary prototype save reset before implementation is delivered.

## Implementation order

1. **Interactive wilderness:** shared typed interaction/objective/reward ledger; camp strongbox and reliquary; caravan/beacon; graveyard and stone trials. Test persistence and exactly-once rewards before expanding content.
2. **Encounter variety:** denser travelling packs, composition scheduling and the first support/guard behavior. Keep the current actor ceiling until profiling justifies a change.
3. **Dungeon foundation:** location-aware saves/travel/maps, one seeded crypt floor, guaranteed routes, door-aware navigation, persistent room rosters and optional branch chest.
4. **Finish the expedition:** Hollow Warden mechanics, boss persistence, final chest and exit. This is the first complete dungeon delivery; do not call a room generator a playable dungeon system.
5. **Expand after playtesting:** additional themes/bosses, elite modifiers, Perilous expeditions and deeper floors. Adjust rewards and density from the user's playthroughs.

Acceptance includes seed determinism, geometry/path validity, bounded generation, maximum-zoom spawn safety, actor admission versus objective accounting, once-only phase/add/reward commitment, boss control interactions, interrupted travel and failed saves, dungeon death/continue, full bag/ground storage, map isolation and stale-writer rejection. Static in-app reviews cover floor layouts, arena warnings, entrance UI and reward states. The user tests gameplay, pacing and difficulty.
