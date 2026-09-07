# Wilderness places and camps

Updated 2026-09-07 for generation 7. Twelve landmark families share world coordinates for procedural art, collision, discovery and encounter ownership; roadside reliquaries form a separate thirteenth interaction family. See [interactive POIs](interactive-pois.md) for recipes and rewards.

| Place | Visual identity |
| --- | --- |
| Camp | Stitched tents, watchfire, faction banner, supplies and broken posts |
| Watchtower | Ruined beacon, banner and supply court |
| Graveyard | Headstone rows, vigil altar, lanterns and open aisle |
| Standing stones | Seven monoliths, engraved circle and luminous altar |
| Caravan | Torn wagons, detached wheel and scattered cargo |
| Cursed chest | Chained coffer, bones, grave markers and violet light |
| Ruined chapel | Weathered arch, column remnants, lantern aisle and broken paving |
| Beast den | Woven nests, eggs, bones and a rocky opening |
| Quarry | Exposed crystals, stone workings, abandoned supplies and paving |
| Occupied hamlet | Four ruined cottages around a firelit square |
| Contested crossing | Paired barricades, standards and a guarded wagon |
| Corrupted grove | Glowing fractured roots around infected heartwood |

## Placement

A 1,400-unit cell owns at most one immutable site. Twelve deterministic candidate positions compete by road distance; per-biome preferences and a four-by-four-cell regional theme weight the kind pool. Forests favor dens/groves, marshes groves/stones, rocky climates quarries, and autumn regions hamlets/caravans. These are biases, not exclusive biome locks.

Caravans, crossings and hamlets must be close to a road, with enough clearance for their complete footprint. Inland sites favor quieter clearings. Center and eight perimeter samples reject wet ground and settlements; the start and first camp remain protected. Cell margins keep neighboring footprints separated. Approaches rotate toward the nearest actual road segment when nearby, otherwise use a seeded heading. Props, members and the gate share that rotation. Ground tracks connect the actual anchors, and ambient collision/canopies preserve the activity clearing and approach.

Default seed 7319 sampled over a 16,000-unit square currently contains 110 landmarks, including all twelve kinds. This is a sampled count, not a population target or placement guarantee. The chart reveals only visited/sighted sites. New coordinates replace the previous generation's placements.

**Ashen Watch**, at `(740, 180)`, remains the introductory four-member camp: veteran Stalker, Archer, Hound and Stalker. Ordinary camps contain eight foes. One third of nonstarter camps become warbands with 10–15 goblins and a veteran/elite War Chief. Camp source level and rank are fixed geographically.

## Population and pursuit

Actor-count caps, ambient population targets, reserved camp slots and concurrent rank/archetype ceilings have been removed. New roaming groups still require travel and cooldown after sixteen initial enemies; standing still or changing zoom cannot refill cleared ground. Packs contain four to six foes. Regional rank odds and authored rosters control composition.

The renderer supplies current/pending coverage before automatic births. Shared margins add 80 horizontal and 120 vertical units plus body radius. Fresh camps validate the whole garrison against visibility, collision and sanctuaries. Trials admit reachable members independently. Dungeons stream nearby room rosters. None can visibly materialize because of a teleport or wide zoom.

Distant, wholly hidden inactive roamers can retire without rewards. Camps sleep only when distance and combat/visibility state permit; they never sleep merely to make room for a new camp. Wounds, casualty IDs and source reward identities survive unloading. Thirty-two inactive garrison records may be cached; this is a memory cache, not a limit on living actors or visited camps. Exact receipts persist beyond eviction.

Enemy attacks remain independent. Each aware enemy uses its own sight, range, windup and recovery. Shared local flow fields provide obstacle detours for pursuit. Sanctuary, source stats, locked attacks and line-of-sight damage rules remain unchanged.

War Chiefs alternate rush and surround orders. Rush adds 20% movement/damage for nearby followers; chief death briefly scatters survivors for 2.2 seconds. Orders affect existing same-camp followers and do not summon replacements. Clearing the full garrison unlocks its strongbox.

## Review and checks

`/events.html` shows every interaction family and replays chest openings without gameplay or storage. `/encounters.html?view=warband` retains the frozen goblin study. Tests cover seeded order independence, frozen blueprints, whole-footprint exclusion, oriented approaches, reachable seals, canopy clearance, hidden admission, unlimited actor admission, source identity, exact casualties and rewards. Combat pressure and sustained hardware performance are player checks.

Generation 7 requires fresh test characters. See [world generation](world-generation.md) and [world-state longevity](world-state-longevity.md).
