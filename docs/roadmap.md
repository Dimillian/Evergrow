# Evergrow roadmap

Updated 2026-09-05. This tracks implementation progress and the next agreed work. The original M0–M5 proposal remains in Git history; its old content targets, sanctuary danger tiers and deferred-save assumptions no longer describe the current plan. There are no release dates or deployment commitments.

## Completed foundations

- [x] Local browser game, Git checkpoints and pushes to origin.
- [x] Procedural character/equipment art, responsive movement/combat, lighting and fixed CRT/phosphor treatment.
- [x] Seven blended biomes, natural roads, procedural towns/cities, furnished seamless interiors and environmental life.
- [x] Six enemy archetypes, ranks, camps and natural offscreen roaming encounters.
- [x] Geographic level scaling, rank-based loot, gear/stats, XP and point allocation.
- [x] Connected skill atlas, 17 active skills, attack/cast speed, route allocation and hover comparisons.
- [x] Shared UI kit, Astral HUD, 64-cell inventory, minimap and explored-world atlas.
- [x] Eight saved characters, three starter weapons, title hall, automatic checkpoints and recovery safeguards.
- [x] Named loot, discrete notifications, improved ground remains/labels, gold wallet and stacked gold/XP feedback.
- [x] Consolidated combat/content ownership, equipment planning/item presentation and panel lifecycle.
- [x] [Town NPCs and economy](npcs-and-vendors.md): blacksmith trading/buyback/+10, jeweler and enchanting, with atomic save-backed transactions.

These are implemented foundations, not declarations of finished balance, final art or production readiness. See [current system status](system-status.md) for verified counts and limits.

## Town economy delivery

| Order | Deliverable | State | Exit check |
| --- | --- | --- | --- |
| 1 | Town NPC interaction and blacksmith buy/sell/buyback | Implemented | Reachable service, shared panel, atomic gold/item/stock changes, durable stock and failure-safe saves |
| 2 | Guaranteed equipment enhancement through +10 | Implemented | Shared recipe/stat derivation, correct previews, visible +N treatment, no lost upgrades or invalid equipped state |
| 3 | Jeweler with expensive visible random stock | Implemented | Jewelry catalog, consistent prices, deterministic stock and existing trade rules |
| 4 | Enchanter rarity upgrades, one/all-affix rerolls and zone-level upgrades | Implemented | Preserved item identity/rolls where required, deterministic committed outcomes, bounded costs and no duplicate charges |
| 5 | Static UI review and player economy testing | Static review complete; player feedback pending | Desktop/narrow captures, then affordability and usefulness tuning |

Transaction commands stage item issuance, wallet, stock and buyback together, persist before live commitment, and reject stale or failed writes. Save version 2 requires new characters; older slots remain stored. Use the [NPC spec](npcs-and-vendors.md) as the service contract and the [architecture](architecture.md) for implementation ownership. Commit and push coherent checkpoints.

## Next: travel and interactive exploration

Selected 2026-09-05. Town portals implemented and code-verified; permanent waypoints and interactive POIs remain specified.

1. [Town portals and waypoints](travel-and-portals.md): free interruptible town return, saved single-use return link and home-town anchors **implemented**; permanent anchor network/map travel remains next.
2. [Interactive POIs](interactive-pois.md): durable site/reward ledger, camp strongboxes and reliquaries; caravan choices and beacons; then graveyard/standing-stone trials.
3. Validate travel/event persistence and exactly-once rewards together; static visual reviews followed by player testing. Initial rewards and timings are tuning proposals.

## First dungeon delivered

- [x] [Rootbound Crypt](dungeons.md): generated 13-room floor, persistent enemies, Warden mechanics, guarded/final chests, separate maps and location-aware saving/travel.
- [ ] Player validation of pacing, navigation, difficulty and rewards.
- [ ] Additional themes, deeper floors and broader graph templates after that feedback.

## Following the economy loop

These are candidates, not authorization to implement them now:

- Deeper enemy/elite mechanics and bosses, driven by combat playtests.
- Build balance, affix diversity, item identity and a deliberate respec design.
- Long-session profiling before larger actor counts or world complexity; measure Safari frame times, memory and save growth.
- Save export/import and broader accessibility/input work when prioritized.
- Sustained endgame goals and a tested scaling model beyond the current bounded geographic progression.

Cloud saves, multiplayer, seasons, procedural quest frameworks, public hosting and release preparation are outside the current scope. Keep the game local. Avoid compatibility layers and save migrations for obsolete prototype designs unless explicitly requested.

## Quality gates for each increment

1. Commands preserve ownership, resources and deterministic outcomes on success and failure.
2. `npm run check` passes code tests, strict browser/headless compilation and the build; no automatic gameplay tests.
3. Shared UI/art components are reused, with concise labels and readable controls above post-processing.
4. Static in-app reviews can check layout; the player evaluates gameplay, progression and feel.
5. Update the affected system guide, this roadmap when scope changes, and [system status](system-status.md) when implementation changes. Clearly distinguish completed code, design proposals and historical evidence.

## Skill development · implemented 2026-09-06

Upgradeable skill ranks, lower casting-rank selection, 19 specialization choices, 17 mastery nodes, Arcane Overload and three deep Arcana ultimates are implemented. See [skill progression](skill-progression.md). Save v3 requires a new character for older slots. Respecs and further skill content remain future work.

### Interactive POIs — delivered 2026-09-06

Camp strongboxes, caravan choices, watchtower reveals, graveyard and standing-stone trials, and roadside reliquaries are implemented. Persistent partial claims, guardian casualties, offscreen spawning and timed blessings share existing save/combat boundaries. Next: player feedback on encounter/reward pacing, then the separate procedural dungeon proposal.
