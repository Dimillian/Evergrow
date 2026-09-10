# Themed dungeons

Local regional scaling, 2026-09-08: New expeditions capture the regional baseline on first entry. Members use normal variation and rank offsets; the Warden is +3. Final treasure uses the boss level, side treasure baseline +1. New expeditions keep their captured levels and chest receipts. The layout-version change below deliberately invalidates older expedition payloads. See [regional scaling](region-scaling.md).

Updated 2026-09-08. Three themed variants of a complete, persistent dungeon floor; pacing, difficulty and art remain subject to player feedback. The original proposal is in [dungeons and events](dungeons-and-events.md).

## Finding and entering

A stone crypt entrance appears near the starting route, around **(-520, 380)** (its exact clear-ground position is seeded). Other entrances sit near graveyards, offset from their event interaction. Discovered entrances appear on the overworld chart. Approach and press **E**, click, or use the controller interaction button to preview its bounded level and boss level, then enter.

Each entrance owns a separate floor, not distant overworld coordinates. On first entry, dungeon baseline level is the player level clamped to the entrance region’s ordinary range. Ranked guards and the Warden add their shared offsets. Monsters never rescale when the player changes rooms, equipment or level. Entry uses the existing transition and short arrival protection without healing or restoring mana.

## Floor and encounters

- Seeded 7–9-room floors: entry, branching combat routes, two optional encounter leaves and an exterior Warden arena.
- A short main route with two optional side chambers, occasional clear-wall shortcuts and eight whole-floor orientations. Rooms pack at varied offsets without a fixed grid. Passages join actual doorways, span 260–600-unit room gaps and can sweep around a longer corner. Continuous curves widen into small landings; their 128–160-unit base width expands along worn banks. There is no forced loop or repeated right-angle connector.
- Mostly rectangular halls, occasional cross-shaped chambers and clipped octagonal rooms vary their dimensions and proportions by theme; the final arena is larger. Wall wear stays subtle so the architecture remains readable. Maps, collision and navigation consume the same worn contours.
- Six to ten foes per ordinary chamber, authored event wave rosters, the Warden and four threshold guardians. Theme-specific enemy mixtures retain shared regional level and loot rules.
- No actor-count cap. Ordinary members admit individually outside camera exclusion bounds. Event reinforcements use nearby hidden, body-clear approaches connected to the player through the shared navigation field. Admission retries are throttled to twice per second; wave clocks advance every simulation tick.
- Decorative tombs, roots, anvils, furnaces, crystals, pools and containers sit in perimeter alcoves away from corridor mouths. They do not add invisible collision or obstruct navigation.

## Chamber encounters

Each floor has two optional encounter chambers drawn from three reusable recipes. Approach the altar and press E/controller interaction to begin; starting is persisted before live commitment.

- **Bound Reliquary:** defeat three waves of five awakened guards.
- **Fading Ward:** hold its circle for ten seconds per wave and defeat two waves of six guardians. Hold time only accumulates inside the circle.
- **Oathbound Sentinel:** defeat an elite leader and its seven retainers.

The shared wave system owns admission, two-second intermissions where applicable, hold progress and completion. A wave cannot clear before every roster member is defeated. Progress pauses when the player moves more than 650 units away and survives saves and travel. Other chamber events wait until the active event finishes. Completion unlocks the chamber treasure; approaching a cleared chest opens it automatically through the normal durable reward transaction.

The entrance remains usable throughout. Killing the Warden unlocks the final chest and another exit near the arena. Exits return to the surface entrance.

## Themes and atmosphere

The entrance seed selects one of three named themes, shared by entrance labels, maps and the interior renderer:

| Theme | Materials and props | Light and monsters |
| --- | --- | --- |
| Rootbound Crypt | Mossy masonry, split tombs, exposed roots and burial debris | Green witchlight; stalkers, hounds, archers, brutes and casters |
| Cinder Foundry | Warm basalt, riveted plates, anvils and burning furnaces | Ember-orange cores; acolytes, brutes, archers and storm sentinels |
| Drowned Vault | Blue limestone, shallow water patches and crystal alcoves | Cold blue light; revenants, mire spitters, wisps and archers |

Each uses dark ambient illumination independent of outdoor daylight. Wall torches, suspended orbs and emissive furnace/crystal fixtures illuminate actual floor, walls and actors, with masonry-aware cached visibility fans. Player/spell lights retain the shared dynamic budget. Hot cores and sparks render before CRT bloom; reduced motion freezes animation.

Terrain remains tile-cached and world-aligned. Light masks are limited to 96 rays per source, cached at eight-unit positions with 256 masks per floor and a bounded occupancy cache; the renderer retains its eighteen-light budget. Fixture anchors are shared by art and illumination. The Hollow Warden remains the shared final boss in this pass.

## Hollow Warden

The Warden has a distinct procedural silhouette and a persistent top boss plate. Its level-one baseline is 1,800 life and 18 damage, using shared geographic monster scaling.

| Move | Rule |
| --- | --- |
| Grave sweep | Broad frontal sector, 0.9-second locked warning, followed by recovery |
| Root fracture | Three locked ground lanes after a one-second warning; impacts spaced 0.16 seconds apart, at most one hit per sequence |
| Call the buried | Two finite guardians at 65% life and two at 30%; phase flags persist across travel and saving |
| Final phase | Recovery shortens to 0.65 seconds; warning duration stays unchanged |

Hard control lasts 25% of its ordinary duration, capped at 0.35 seconds, followed by 2.5 seconds of stun immunity. Slows have half duration and cannot reduce speed below 65%. Damage-over-time still works. The control hint appears when focusing the boss.

The arena stays escapable. Wounds, deaths and triggered guardian waves persist; neither retreat nor town travel resets boss life. This permits wearing down the boss across attempts in this prototype. The player will validate actual fight duration and pressure.

## Treasure

Ordinary enemies keep the existing source-level loot tables. The Warden awards six normal Stalkers' baseline XP through the normal level-gap adjustment, and one kill's potion credit, with no extra generic equipment or coin roll.

Each optional chest provides one veteran-weight item at baseline +1. The final chest provides three items using normal/veteran/elite rarity tables at the Warden’s level (baseline +3). Gold is 18 for side treasure or 45–70 for final treasure, multiplied by 1 + 0.1 × (reward level − 1). Shared regional reward ceilings and item-level limits apply. No guaranteed Rare item or enhancement bonus.

Cleared chests open automatically when approached, with E also supported and no channel or countdown; animated lids and warm light feedback play after the durable claim. Items and coins appear physically and use existing pickup notifications. Delivery masks and ground insertion persist together before commitment. Equipment always delivers into the newest-1,024 ground queue, replacing its oldest items as needed. Full gold-pile capacity leaves only gold pending; subsequent interaction delivers the missing gold without repeating equipment. A full bag does not erase treasure or block the exit. Shared chest art animates anticipation, hinged lids and a burst of light. Staggered item/coin arcs use checked landing positions and persist their flight metadata; pickup waits for landing.

## Travel, maps and saving

Only the active location simulates. Switching stages both locations and persists before committing. The suspended surface retains living actors, wounded sleeping camp members, camp casualties, ground items, coins and resource vials. A suspended floor retains its roster, health, guardian thresholds, ground loot and visited rooms. Character resources, cooldowns, gear and wallet stay shared.

Town portal P uses the existing cancellable channel. Its return endpoint includes the dungeon identity and exact floor position; vendor visits do not reroll the floor. Death uses town recovery, preserves the expedition, and clears the one-use portal link. Re-enter the original crypt to continue. Reloaded attacks restart safely rather than resuming at impact.

The minimap shows the local explored floor. The large map supports drag/zoom, discovered chest/boss hover labels and an Overworld button. Floor discovery never writes to the surface chart. Surface entrance tooltips identify active/cleared expeditions.

One unfinished ordinary wilderness dungeon is allowed per character; the separate expedition route can coexist with it. There is no eight-expedition lifetime quota. Unfinished floors, optional rewards, loose loot and return links retain their runs. Fully exhausted floors retire to exact cleared-entrance receipts during durable travel; these entrances remain marked cleared and cannot regenerate rewards. The 8,388,608-code-unit checkpoint safety ceiling still applies; failed writes preserve both locations. Dungeon layout version 4 is stored explicitly per expedition. Older saved expeditions cannot load into these new layouts; their saves remain stored and are never deleted. Use a fresh test character if an old character contains an expedition. Characters without an old expedition are unaffected by this layout change. See [world-state longevity](world-state-longevity.md).

## Ownership and review

`dungeon-layout.ts` packs chambers and connects doors; `dungeon-passage.ts` builds shared curved passage polygons; `dungeon-content.ts` owns theme/event recipes; `dungeon-events.ts` advances persisted chamber encounters; `dungeon.ts` owns immutable blueprints and headless geometry; `dungeon-contours.ts` shares worn outlines, `dungeon-surface.ts` draws cached masonry, and `dungeon-lighting.ts` owns fixture anchors and bounded visibility masks; `dungeon-world.ts` adapts them to rendering/collision; `dungeon-state.ts` owns persistent location contents; `dungeon-runtime.ts` admits roster actors; `dungeon-boss.ts` owns boss decisions; `dungeon-command.ts` stages transitions and chest transactions. Damage, statuses, XP, item generation and gold remain shared with the existing game.

`/dungeon.html?view=gallery&seed=7319` is the local, save-free Dungeon workshop in the World workspace. Compare six themed maps and entrances, enter a seed, generate a new seed, click rooms, inspect chambers/corridors/encounters and export maps to PNG. It uses the actual generator, map and scene renderer. Lights animate at up to 30 FPS over frozen actors; it never advances gameplay and respects reduced motion. Tests cover deterministic seeds, collision-safe routes, offscreen admission, casualties, threshold waves, control, reward ownership, full ground capacity, failed saves and town/death returns.

### Local lighting detail pass

Dungeon presentation now shares the existing wall-clipped light sources with two bounded WebGL passes: slow, illuminated ground mist and broken specular highlights on damp flagstones. Moisture is strongest in the Drowned Vault, moderate in the Rootbound Crypt and sparse in the Cinder Foundry. Procedural slab normals and mortar seams follow the existing 24×16 staggered masonry. This first slice covers the floor; wall/prop normal maps remain future work.

Wet highlights draw before actors and their shadows. Mist draws after surface lighting, before emissive cores and native-resolution overlays. Floor coverage uses the actual room/corridor outlines; each of eight lights samples its existing visibility fan. Buffers run at half world-render resolution, capped at 640 pixels per axis, with a 512×256 light visibility atlas. Stationary coverage/visibility masks reuse their uploads; moving sources refresh only the affected atlas content. Reduced motion freezes air movement. Unsupported/lost WebGL retains the established dungeon presentation; restored contexts rebuild their resources.

Dungeon fixture cores also feed a small explicit emission texture to the shared bloom shader. Ordinary bright surfaces retain restrained phosphor glow. Leaving a dungeon restores the usual outdoor extraction. The fixed CRT treatment and HUD ordering are unchanged. This is presentation only: no world generation, collision, combat or save changes.

Inspect `/dungeon.html?view=lighting&seed=7319&room=4` locally; seeds 7317/7318/7319 show the three themes. The workshop freezes actors, animates lighting at 30 Hz and exports the composed runtime image. Chamber mode also exposes bounded CPU timings, which do not measure GPU completion or gameplay performance.

## Expedition routes and additional themes · 2026-09-10

Settlement chart tables now open a level-20 ten-stage expedition route. Forks expose one or two dungeon choices, enemy levels and Elite guard / Firing lines / Deep peril modifiers. Route floors have 10–12 rooms with 20% larger chambers and a larger boss arena; their bosses use Veteran durability with the normal boss level offset. Route choices, casualties, stage rewards and town return links persist. Death inside a route resets the route; ordinary wilderness dungeon deaths retain their previous persistence. See [Expeditions](expeditions.md) for costs, rewards and exact rules.

Explicit entrance themes add Rime Cathedral (ice pillars and a frozen nave), Sunken Ossuary (sandstone sarcophagi) and Astral Archive (bookcases, orreries and engraved star circles). They appear in the wilderness as well as expedition choices. Rootbound keeps its Warden; newly themed Foundry uses the Furnace Sovereign's eruption/sweep patterns, Drowned the Matron's rush/fractures, Ossuary the Sepulchral King's command/rush. Rime Prelate fires wider Frost fractures; Astral Custodian locks five Arcane lanes with a longer warning. Warnings share the damaging geometry. The latter two share the Warden rig with distinct crown/shoulder or orbital ornaments; the other three reuse the established wilderness boss rigs and attacks. No new enemy species are implied.

Older entrances without an explicit theme keep their original three-theme seed interpretation, layout and Warden. New art, palettes and names are shared by the generator, preview and game. `/tools/expeditions.html` previews the production route UI; `/services.html?role=enchanter&respec` previews respec; `/dungeon.html?theme=rime&expedition&view=map` previews a larger route floor. Review state is disposable and does not read playable saves.

## Crowd performance

Frozen dungeon floors share a 64-unit spatial collision index. Cells proven to contain no silhouette edges reuse an exact inside/outside result; boundary cells retain the original polygon checks and 16-point body-clearance sampling. Unfrozen generator work continues to use the original geometry queries. The weakly owned index disappears with its floor. This changes no collision contours, actor limits, AI tick rate or combat timing. Room roster lookups are cached per floor and active member IDs use a set during admission. Wholly offscreen enemy rigs skip drawing with a generous 256-unit margin while their simulation continues. See `world-performance.md` for the reproducible CPU study.
