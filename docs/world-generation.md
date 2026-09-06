# World generation 6

The local generation pass replaces the north–south settlement corridor and repeated cross-roads. Each new character receives a random unsigned 32-bit world seed. Character creation shows an editable **World seed** field and a **Randomize** button; saved-character selection keeps the chosen seed visible. Continuing reconstructs that character’s world before restoring its position, encounters and explored chart. Existing characters retain their saved seed, including **7319**; no save reset is required. `/atlas.html?seed=7319&view=extended` also accepts any unsigned 32-bit seed for save-free comparisons. Suggested comparisons are **18427** and **90210**. These are generated worlds, not painted map concepts.

## Settlements and routes

`world-geography.ts` owns deterministic two-dimensional settlement sites. An 11,000-unit lattice is rotated by the seed and jittered by up to 22% per axis. Each site chooses the most habitable dry location from three candidates (up to eight if all three intersect water) using the shared biome weights: forest and autumn ground are favored over marsh, burnt ground and highlands. Neighboring centers remain at least 6,160 units apart. The origin town stays at `(0, -1150)` to retain the clear starting arena. Approximately one in five other settlements is a larger city; the others retain the furnished town layouts and services.

The lattice is an invisible generation partition, not a road grid. Every settlement selects a lower-distance neighboring site as its parent, guaranteeing a connected inward route to Briarwatch. Occasional diagonal links add alternate loops. Roads no longer extend infinitely east/west or repeat on a fixed interval. Dead ends at the displayed chart edge continue into unknown terrain.

`road-shape.ts` builds shared curved polylines between actual settlements. Two candidate bends are compared against the climate field to prefer gentler terrain. North/south town approaches preserve the existing full-width central street, doors, furniture and sanctuary. Terrain material, map strokes, prop/site clearance, roadside shrines and reliquaries consume the same seeded geometry. This is bounded candidate routing, not a river simulation or erosion model. Generation 6 adds sparse descending river networks and irregular receiving lakes through the independent hydrology layer. Roads cross as shallow fords. Physical ridgelines, bridges and branching hamlet trails remain later work. See [living water](living-water.md).

Seeded memoization is bounded: 512 place records, 512 roads, 512 local segment buckets, 512 travel costs, and 2,048 roadside anchors. World instances also retain at most 128 coarse settlement lookup cells so terrain pixels do not repeat site enumeration. Eviction only affects recomputation. Queries validate extents and cap enumeration; there is no global graph build. Numeric settlement identities encode both cell coordinates and are shared with town portals.

## Larger climates

The climate-region spacing increases from 2,400 to **6,400 units**. Adjacent cells can share climates, giving larger irregular interiors. Broader coordinate warps preserve uneven boundaries and smooth transitions. The Deadwood starting core expands to 1,100 units, blending out by 2,600. Actual ground, trees, atmosphere, loot biases and the map share the same climate field.

## Fixed regional danger

`zone-progression.ts` replaces distance rings with warped, jittered districts at approximately 3,600-unit spacing. Each district has a stable identity, name and level. Several danger regions can therefore lie within one large biome.

The district's anchor samples the closest road and its accumulated travel cost from Briarwatch along the connecting tree. Ordinary progression is roughly one level per **6,000 route units**, with a remoteness contribution away from roads. A subset of districts whose anchors are more than 2,500 units from a route gain an additional **3–5 levels**. These hazardous wilderness pockets can sit beside lower-level travel corridors. The starting district remains level one. Road loops interpolate their endpoints' tree costs; this is not a full shortest-path simulation over every incidental road crossing. Beyond 128 parent hops the bounded distant estimate continues outward.

Levels never depend on the player. Enemy level, rank, stats, rewards and projectiles still retain their spawn-time identity. Vendors, event rewards, portal landing checks, map hover and entry notifications use the same world seed and region query. Returning home never rescales existing enemies. Towns remain sanctuaries.

## Map and reviews

The actual runtime large map now shows revealed regional boundaries, names and levels. Orange `!` labels indicate hazardous districts. Region labels avoid town names and one another; overlapping minor POIs are suppressed before hover testing. Zooming reveals more landmarks. Boundary strokes and label anchors respect discovery, including hidden holes. The minimap retains its compact terrain treatment and does not receive regional labels.

The extended atlas stages a roughly 40,000-unit-wide surveyed disk through memory-only Exploration. It uses no simulation ticks, gameplay input or character saves. Native Canvas PNG exports use the real WorldMap renderer and are explicitly identified as CPU renders. Local navigation and PNG export remain available in the in-app browser.

## Prototype reset and verification

Generation version is **6**. Rivers/lakes, water-aware settlements and dry-ground prop placement change the previous geography. On the next gameplay bootstrap, older-generation character slots are removed through the normal repository deletion API, as authorized by the user. Generation-keyed exploration never imports the old chart. This deliberately resets test progress; there is no migration.

Code tests cover minimum settlement separation, two-dimensional dispersion, connectivity to the start, shared walkable road geometry, deterministic generation, interiors and entrances, seeded regional danger and hazards, spawn snapshots, same-level portal landings, conservative map fog and label placement. Gameplay pacing and combat feel remain the user's playtest responsibility.
