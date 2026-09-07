# Interactive points of interest

Updated 2026-09-07. This local pass adds recipe-driven encounters, six new landmarks and timed cursed chests. All tuning remains subject to player testing. [World placement](wilderness-and-encounters.md) and [dungeons](dungeons.md) share the same geographic levels and reward owners.

## Activities

| Place | Encounter | Reward beyond enemy drops |
| --- | --- | --- |
| Camp | Clear the existing garrison; open its strongbox | One equipment roll, small coin cache |
| Caravan | Choose goods or coin | Two equipment rolls or a larger coin cache |
| Watchtower | Two-second beacon channel | Reveal nearby terrain and one distant landmark |
| Graveyard | Three guardian waves or three seals | One equipment roll and XP |
| Standing stones | Choose a blessing; defend the circle through two waves | A 90-second build bonus and XP |
| Roadside reliquary | One-second opening | Small coin cache; 25% chance of an item |
| Cursed chest | Clear increasingly large waves within 90 seconds | More completed waves produce more items and gold |
| Ruined chapel | Break three ritual anchors or fight tomb guardians | Grimoire/amulet rolls and gold |
| Beast den | Destroy three nests or fight hunting packs | Leather chest/boots and gold |
| Quarry | Fight crystal guardians or hold the extraction site | Weapon/armor rolls and gold |
| Occupied hamlet | Clear occupying forces or dismantle three standards | Equipment and supplies |
| Contested crossing | Break a blockade or defend the cache | Equipment and gold |
| Corrupted grove | Cleanse three roots or defend the heartwood | Caster equipment and gold |

The seed selects each site's recipe. These are one-time character-owned encounters; revisiting never rerolls or resets them. All new landmarks appear in discovery, map hover and Journeys. The compact active-trial label shows the current wave, casualties and, where relevant, remaining time or hold progress.

## Reusable waves

`event-recipes.ts` owns immutable mode, roster, wave count, growth, time and hold rules. `wave-system.ts` is a pure clock/progress engine. Admission, AI, deaths, persistence and rewards remain separate owners.

- Assault: defeat every admitted member; two seconds between waves.
- Defense: defeat the wave and spend twelve cumulative seconds inside the marked objective. Leaving pauses hold progress.
- Seals: defeat the current wave, then interact with its reachable objective before the next wave. Three distinct anchors are checked and saved when starting.
- Timed: ninety seconds of active gameplay, starting after the first actual admission. The clock includes intermissions. Waves begin at five actors, grow by two to eighteen, and have a twenty-wave recipe limit.

Finite recipes contain two or three waves, generally starting with five to eight foes. Every wave has a veteran; final waves can have an elite from geographic level three, and later waves add another veteran. Cursed chests place an elite leader every third wave when eligible. Existing enemy archetypes supply distinct themed rosters.

There is **no total, ambient, camp, event, dungeon, concurrent-rank or per-archetype actor cap**. Sixteen initial roamers and travel/cooldown-driven packs remain pacing rules. Admission still requires collision-safe, non-sanctuary positions fully outside padded camera coverage. Event members admit independently: one blocked lane cannot stall every other guardian. A bounded search favors nearby viewport edges; shared local navigation routes around obstacles. All guardians start alerted and track the player inside the trial area; attack range and sight checks remain intact.

One trial is active per character. Finite trials suspend on departure and preserve exact wounds, deaths and admitted positions. Timed challenges bank completed waves on expiry, death, leaving the area, town travel or dungeon entry. Surviving enemies keep their source stats and rewards; ending an event does not kill or delete them. Location transitions bank the result in their durable checkpoint. Menus and closed sessions pause game time; reloading resumes the saved clock.

## Rewards and chest presentation

For cursed chests with `W` cleared waves, equipment count is `min(10, floor(W / 2) + (W > 0 ? 1 : 0))`. Gold is a seeded integer between `10W` and `15W`, multiplied by `1 + 0.1 × (siteLevel − 1)`. Every completed wave increases gold; item thresholds add larger rewards. As with every trial reward, the chest opens automatically while the living player is nearby. Full-ground leftovers are delivered automatically as capacity becomes available; no second interaction is required.

Other new trial rewards contain two veteran-weight item rolls and 20–35 base gold. Trials use item level `siteLevel + 1`, bounded by the existing level ceiling, and a small completion XP bonus. Geographic level-gap adjustments and Journey rewards remain shared. Rarity is not guaranteed; difficult-event material weighting uses the ordinary item generator. Guardians also drop their normal rank/source rewards.

`chest-art.ts` supplies shared anticipation, hinged lid motion, light burst and dispersing particles for surface and dungeon chests. `treasure-flight.ts` plans collision-checked landing points and staggered arcs. Ground items and coins own saved flight metadata; pickup waits for landing. Presentation never creates or grants loot. Reduced motion suppresses flight animation without changing rewards or pickup timing.

`poi-command.ts` persists the entire reward/choice change before publishing it. Delivery bits belong to each item and the gold component, including large cursed bundles. Save failure, full ground capacity and reload cannot reroll or duplicate rewards. E starts the event (and remains available for authored seal objectives). Completing waves, defense, seals or a timed challenge automatically commits the reward and opens the chest without an opening channel or second E press. Non-event caches retain their one-second interaction. Completed trial rewards no longer show an interaction prompt. Claimed and partially delivered chests stay open, including when XP has committed but ground capacity temporarily blocks all physical drops. Nearby pending rewards are checked every 250 ms; full-capacity records do not trigger empty saves, and a save failure backs off for 30 seconds before retrying. Reload preserves exact delivery bits and never repeats XP.

## Blessings and retained state

Standing stones offer two biome-weighted choices: Haste (+15% attack/cast speed), Wellspring (20 points of mana-cost reduction), Bulwark (+40% armor), or Fleet (+15 points of movement speed). Normal derived-stat caps apply. One blessing lasts ninety seconds after claiming, pauses in town/menus and disappears on death.

Generated geometry remains immutable. `EventState` retains one trial, casualty records, score, seal anchors, partial deliveries and beacon projections. Older full claims compact into exact IDs; no lifetime interaction quota. Finite payload, presentation and ground-drop bounds remain. Generation **7** changes geography and event recipes and requires fresh test characters; no migration is supplied.

Local review: `/events.html`. All thirteen interaction families use real frozen scenes. **Preview opening** advances presentation only and shows a six-wave cursed payout; it never ticks combat or accesses saves.
