# Interactive points of interest

Implemented locally · 2026-09-06. Companion to [town portals](travel-and-portals.md). Existing camps, watchtowers, graveyards, standing stones and caravans supply the layouts; this pass gives them actions, stakes and outcomes. Counts, weights and durations are initial tuning.

The [exploration and dungeon proposal](dungeons-and-events.md) extends this foundation with denser roaming packs, enemy roles, dungeon entrances, floor persistence and bosses. Its dungeon rules are proposed separately; the six interactions below retain their initial reward/claim contracts.

## Six encounters

| Place | Player action | Payoff and visual identity |
| --- | --- | --- |
| Camp strongbox | Defeat the existing garrison, then open its locked supply chest. No additional wave. | One equipment roll and a small coin spill. Hinged iron straps, a lock glow that extinguishes when the camp clears, then an open chest that stays empty. |
| Abandoned caravan | Choose **Recover goods** or **Take coin** at the cargo seal. The choice is visible before interaction and excludes the other reward. | Goods: two item rolls biased toward weapons/armor. Coin: a larger physical coin cache. Broken cart cloth and hanging straps settle as the hidden compartment opens. |
| Watchtower beacon | Approach the ruined beacon and channel for two seconds, interruptible by movement or damage. | Permanently reveal terrain in a 1,000-unit circle and the nearest undiscovered landmark within 2,400 units, if one exists. No item chest. A single upward light pulse and map ripple make the exploration reward readable. |
| Graveyard vigil | Explicitly start **Disturb the vigil**. Defeat two groups of three guardians before opening the sealed grave. | One equipment roll and bonus XP, plus the enemies' ordinary rewards. A sealed casket marks the interaction; rising motes distinguish an active or completed trial. |
| Standing-stone trial | Choose one of two displayed blessings, then defeat three guardians to bind it. Blessings favor different builds. | A 90-second temporary combat blessing and a small XP reward. The interaction plinth lights during the trial; the selected blessing appears with its remaining duration. |
| Roadside reliquary | Open a small optional container tucked beside the main road, with no forced encounter. | A little gold and a 25% chance of one equipment item. Low stone casket, grass framing and a brief rarity glint. A quick discovery between larger places. |

These are individual site states, not repeatable map services. A completed chest, caravan, beacon or trial never resets for that character. New areas provide new instances. The camp strongbox uses the existing persistent garrison ledger rather than a duplicate clear condition.

### Blessings

Choose two distinct options from a biome-weighted pool, fixed by site seed. Display the bonus before committing:

- **Haste:** +15% attack speed and +15% cast speed.
- **Wellspring:** 20 percentage points of mana-cost reduction; does not bypass the normal 75% cap or grant a mana refill.
- **Bulwark:** +40% armor, applied once to the ordinary derived armor total before its existing reduction cap.
- **Fleet:** +15 percentage points of movement speed, within the existing movement cap.

One active POI blessing at a time; a new blessing replaces it rather than stacking. Its timer advances only during active wilderness play, pauses in town/menus and persists across save/continue. Death removes it. A compact buff label and remaining duration appear beside existing status indicators; damage and stat changes go through the shared character derivation, never renderer-only bonuses. The 90 seconds start when the completed trial reward is claimed, not when the trial is selected.

Biome variation changes silhouette, material, light and enemy composition. Deadwood favors grave candles and stalkers; the Mire uses drowned stone, reeds and casters; Frostpine has ice cracks and brittle chimes; Emberfall uses charred metal and sparks. Keep variants recognizable as the same interaction at normal gameplay zoom. Existing enemies supply these variants; this pass does not require new archetypes or bosses.

## Placement and pacing

Attach the first five actions to their existing deterministic landmark blueprints. Place the reliquary through a separate sparse seeded roadside query with stable IDs, keeping the existing clear approaches, road corridors and town protection. Do not scatter one in every visible chunk.

Initial target: a meaningful optional interaction roughly every 60–90 seconds of fresh exploration, with quick reliquaries between some major sites. Measure actual walking paths before changing the present 1,600-unit landmark cell grid. Respect a 450-unit minimum separation between reliquaries and 300 units from a major-site reward; cap candidate work and reject obstructed placements. No loot containers inside towns or the immediate starting clearing.

The first camp strongbox and one nearby roadside reliquary demonstrate the loop early. Graveyard/stone trials remain optional, show their area level and reward type, and use normal/veteran guardians in zones 1–2. This first pass uses one veteran followed by normal guardians at every zone level; elite trial variants remain future work.

## Combat and encounter rules

E/click interacts only within reach and line of sight. Nearby hostiles do not universally lock every chest; a one-second opening channel, interrupted by movement/damage, creates a small commitment. A locked camp chest instead shows **Clear the camp**. Modal choice panels pause combat and clear held input like existing windows; starting the action resumes play.

Trials are kill objectives with no escort AI, damageable defense target or countdown failure in this first pass. Guardians approach from offscreen, allocated through the existing actor budget and spawned completely outside the padded viewport. No ordinary enemy visibly appears on screen. Ritual light and ground dust can be visible while guardians approach. If valid offscreen space/capacity is unavailable, show **Guardians approaching** and retry bounded placement; never create invisible enemies or advance the wave before admission.

Keep the 24-actor total and nine roaming slots reserved. Event actors share the remaining camp/event budget. Sleep only eligible offscreen camp/ambient actors using their existing rules. At most one active trial per character. Switching to another displays **Finish the active trial**; do not silently discard it.

Leaving, portaling or loading suspends a trial rather than resetting it. Save admitted guardian identities, wounds, dead members and the next wave. Do not recreate defeated guardians or grant completion for missing/unloaded actors. On death the trial remains resumable with its recorded casualties; the character loses any active blessing under the ordinary death rule. There is no repeatable failure-farming loop.

## Rewards and scaling

Rewards are authored separately from monster loot quantities. All sources capture **site geographic level and biome**, not the player's level or where the player opens the reward. Equipment starts at +0. Affix recipes use the ordinary item generator and NPC upgrades remain an investment.

Let `G(L) = 1 + 0.1 × (L − 1)`. Initial bonus rewards:

| Source | Equipment | Gold / XP beyond guardian rewards |
| --- | --- | --- |
| Camp strongbox | Exactly 1, normal rarity weights, item level L | Uniform 8–14 × G(L) gold |
| Caravan: goods | Exactly 2, normal rarity weights, item level L | No bonus gold |
| Caravan: coin | None | Uniform 22–34 × G(L) gold |
| Graveyard vigil | Exactly 1, veteran rarity weights, item level L+1 | Half one same-level normal Stalker's XP |
| Standing-stone trial | None | Blessing and half one same-level normal Stalker's XP |
| Reliquary | 25% chance of 1, normal rarity weights, item level L | Uniform 4–8 × G(L) gold |
| Watchtower | None | Terrain and landmark reveal only |

Round gold once to whole units, clamp item levels at the existing numeric bound, and apply the normal player/source-level XP factor to bonus XP. Reuse the current normal/veteran rarity tables: a chest or trial does **not** guarantee Rare gear. Guardian kills independently use their ordinary rank/level rewards; count those rewards when assessing total profitability. Beacon-revealed POIs are marked **Sighted**, never activated, completed or waypoint-unlocked.

Use separate deterministic reward identities/RNG for each site and reward choice. Opening, camera changes, revisiting, reload or a full bag never rerolls the result. Rewards are physical ground items/coins; XP uses the existing reward accumulator and item pickups retain individual names.

When ground capacity is full, retain a bounded pending reward bundle on the site and show **Reward waiting**. Do not evict existing loot or mark the reward delivered. Later interaction releases what fits, with each issued component committed exactly once. Claimed, pending and partially delivered states all persist atomically with the checkpoint's ground objects and wallet/XP. No backpack-space requirement to finish a fight.

## State, map and presentation

Use stable generated identities and one character-owned site ledger: unseen/discovered, available, active, completed with pending reward, and claimed. Discovery remains in exploration; runtime reads the interaction ledger for availability/completion. Keep generated geometry immutable. Distinguish sighted versus physically visited metadata for beacon reveals.

Implemented ledger bound: 256 interacted sites, one active encounter with at most six guardian records, at most two equipment rewards and one coin component per site. Never evict a claimed entry and regenerate its loot. Existing tracked sites remain usable at the bound; additional stateful interactions display unavailable until the storage design is expanded. Seeded recipes are reconstructed; a delivery bitmask records issued components. Tests measure the full 256-record ledger below 100,000 characters and the combined test checkpoint below the existing 700,000-character save cap. The global cap remains authoritative when other large subsystems are populated; save rejection never silently drops history.

Plan interaction activation/completion/claim as whole commands. Persist before publishing player rewards or committed site state. Save failure/stale-writer rejection changes neither side; combat results awaiting persistence cannot be awarded a second time. Save v3 now includes optional event state and a timed blessing. Existing v3 characters continue without a reset; older invalid versions remain unsupported.

Maps show concise states: Locked, Available, Active, Reward waiting, Claimed, or Beacon lit. Completed markers dim; active/pending rewards remain legible. Hover gives the action and zone level, not a flavor paragraph. The focused world object gets one small E hint. Reuse shared window, tooltip, notifications and ground-loot presentation. Revealing several POIs from a beacon produces one discovery notification, not a burst of cards.

## Verification and review

1. Shared interaction/reward ledger, camp strongbox and reliquary: full inventory/ground capacity, save failure, reload and exactly-once ownership.
2. Caravan choice and beacon exploration: irreversible choice with preview, fixed RNG, bounded conservative map reveal, no accidental waypoint activation.
3. Graveyard and standing-stone trials: real admitted-actor accounting, offscreen spawning, preserved casualties/waves, interruption, travel and death behavior, shared timed-stat modifiers.
4. Frozen in-app captures for each family and map state; the player tests reward pacing, visibility and combat feel.

Portals/waypoints are the companion delivery, not a prerequisite for opening a chest. Do not add quest journals, materials, keys, inventory puzzle items, escort routines or procedural dialogue to deliver these encounters.

Implementation owners: `poi-content.ts`, `poi-sites.ts`, `poi-command.ts`, `poi-rewards.ts`, `poi-runtime.ts`, `poi-validation.ts`, `poi-panel.ts` and `poi-art.ts`. `Simulation` owns the live ledger and guardian snapshots. `/events.html` stages all six families and claimed states without gameplay or storage. Headless tests cover atomic rewards, capacity, reload, guardian admission/suspension, channel interruption, blessings and beacon fog. Dungeon floors, new enemy archetypes and directional approach arrows are deferred.
