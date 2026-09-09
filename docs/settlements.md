# Settlements · local generation 10

This replaces the old grid-town layouts. Local only; not pushed or published. The starting town is always a **settlement**, in the same seeded home biome with the dry southern arrival and home portal. Other sites can be settlements, villages or cities. Generation-9 characters upgrade on Continue: progress, owned gear, buyback, exploration and compatible encounters are preserved. Changed shops refresh stock; unsafe surface positions move to a safe town arrival. Older unsupported generations remain stored.

## Places

- **Settlement:** no houses. Four outdoor merchants, three canvas shelters without visible beds, a shared fire with firewood and a storage chest. Crescent, fork and commons recipes vary plot positions, sizes, supplies and disconnected timber barricades. Work racks, benches, sacks and carts occupy checked spare space rather than the walking routes.
- **Village:** eight main structures, mixing service buildings, outdoor stalls, an inn and private family homes; stronger palisades and watchtowers.
- **City:** twelve main structures, including a larger count’s hall with stone turrets and banners, service shops, a gambling stall, an inn and unmarked homes. Stone defenses and towers surround the neighborhoods.

Villages and cities use spaced neighbourhood plots and stepped, asymmetric boundaries. The north/south world-road approaches form the main lanes; each entrance connects to the nearest existing lane with a short spur. Private homes can have kitchen gardens, while wells and work supplies occupy checked spare ground. The home portal landing is kept clear.

Fortifications are connected ground ribbons with joined corners, subdivided only for collision and actor depth sorting. `settlement-walls.ts` preserves continuous distance along each run, clips openings around approaches and buildings, and shares exact joint edges between adjacent spans. Wood, palisade and stone use the same geometry: upright timbers and continuous rails, or aligned masonry courses, coping and battlements. Selected authored corners carry towers; exposed gate ends are capped. `settlement-wall-art.ts` projects faces and thickness in the actual boundary direction and fills overlapping wall shadows together once, avoiding repeated block shadows. Frostpine caps receive snow. Collision follows each short span’s ground bounds; walls remain solid and path openings stay clear.

`settlements.ts` owns every footprint, furniture obstacle, gate opening, fixture and walking path. Routes use bounded local search around footprints, visibility simplification and validated corner smoothing. Paths are broad, feathered areas of local soil in refuges and villages, with intermittent worn paving in cities. The underlying climate stays visible instead of bright road ribbons. House entrances join existing lanes; unused east/west exits are not generated. Barricades leave gaps wherever a generated route crosses them. Each tier independently selects among three seeded compositions and varied dimensions; this is a procedural recipe system, not unlimited free-form urban planning.

`World` retains sanctuary protection but no longer strips every prop from a perfect circle. Trees/rocks can reach unused edges; collision radii and projected crowns stay clear of buildings, facilities, the central commons and access paths. Stable building/fixture IDs share the normal world query, collision and depth ordering. Stalls/tents are outdoors; houses still have enterable furnished interiors and fading roofs. Storage fixtures cannot be broken as loot containers.

## Architecture and visual identity

Houses vary proportions, gabled/hipped/thatched/terrace roofs and nine biome palettes. Snow accumulates on northern roofs and eaves, damp climates show moss, Emberfall and Sunscar have ash/sand weathering, and Amberwood has drifting leaves. Low desert terraces differ from steep northern roofs. Weather effects are anchored and bounded; reduced motion freezes moving details.

Vendor identities share colors and symbols between world signs, clothing and panels: amber hammer, teal gem, violet arcane star and red/gold dice. Outdoor blacksmith stalls have no chimney. Outdoor vendors stand 22 units in front of their stall footprint. Side-post banners avoid counters and faces. The jeweler displays gems and necklaces, the enchanter an open grimoire and glowing orb, and the gambler cards, dice and wrapped prizes. Tents have tensioned canvas planes, seams, patches, ropes and pegs. Carts put their wheels toward the rear with handles forward.

Visual references: [Rogue Encampment ground/prop staging](https://www.invenglobal.com/articles/13794/review-diablo-2-resurrection-big-stash-clear-graphics-differences-from-the-original), [Weald & Downland timber courtyards](https://danieljamesgreenwood.com/2025/08/25/late-summer-timbers-at-the-weald-downland-museum/). These inform ground wear and grouped work areas; no external art is imported.

## People

All merchants and residents use the complete player character renderer, including seeded skin/hair palettes, hairstyles, facial hair, accessories, clothing materials, cloak selection and ordinary walking gait. The small body scale of children is presentation only. Family members stay within their household’s furnished aisle; outside residents walk the generated paths with short pauses. Their analytic schedules use simulation time, so pause freezes them. Residents are ambient, non-colliding, invulnerable people, not enemy actors or save records. Render culling and a bounded appearance cache limit offscreen work.

Nearby residents use the existing native-resolution speech bubble renderer and layout. One resident speaks at a time, with a twelve-second cooldown, proximity and line-of-sight checks. Lines mix brief biome flavor, rumors and accurate gameplay hints. There are no quests attached to those lines. Private homes and their families have no map marker. Vendors and residents share the player's contact and directional ground shadows; children's shadows match their smaller bodies, and roaming shadows follow their movement and local lighting.

## Gambling and storage

A **Gambler** appears in every tier. Choose from twelve item categories; the UI shows gold cost and rarity odds, and conceals the item until the saved transaction succeeds. Results use normal item generation, material pools and affixes at the vendor’s region-bounded player level.

Gambling uses these initial playtest weights (Common / Magic / Rare / Epic / Legendary):

| Tier | Weights | Price multiplier |
|---|---|---|
| Settlement | 45 / 38 / 14 / 2.8 / 0.2 | 1 |
| Village | 30 / 46 / 20 / 3.7 / 0.3 | 1.35 |
| City | 15 / 52 / 27 / 5.5 / 0.5 | 1.8 |

Base price is four times `30 + 3 × (effective level − 1)`, with a further 1.5 multiplier for rings/amulets; round the final price upward. The regional cap remains authoritative. Normal item generation receives a bounded merchant material advantage of 1 / 1.7 / 2.6. A persistent commerce operation counter supplies each result’s deterministic identity; reopening cannot refresh the same offer. Full inventory, insufficient funds, stale quotes and failed persistence do not charge gold or advance the counter. Successful reveals use shared item details and reduced-motion-aware animation.

Blacksmith/jeweler stocks contain 12/8 items in settlements, 18/12 in villages and 24/16 in cities. Village shops reserve one premium slot, city shops three: these are guaranteed rare or better, with 90% rare / 9.5% epic / 0.5% legendary. City blacksmith premium slots cover melee, bow and caster equipment. Larger blacksmith inventories include axes, maces and daggers and expose a family filter. Stock still refreshes every three player levels and uses the region-bounded bracket level. Bought slots, including indices above 11, retain ordinary saved ownership and buyback rules.

Normal blacksmith rarity weights are 55/35/9/1/0, 25/52/21/1.9/0.1, and 10/55/31/3.8/0.2 by tier. Jeweler weights are 0/60/35/4.8/0.2, 0/52/44/3.8/0.2, and 0/42/52/5.7/0.3. Premium slots use their separate table. Improvements already offered in settlements remain available there.

Enchanters show conflict-aware affix odds. City enchanters can favor offense, defense or utility for rerolls: the chosen group receives triple weight and the service costs 75% extra. Preferences that cannot change the available odds are disabled and rejected by the planner. This changes selection weights, not which affixes an item can legally hold. Reroll-all displays first-roll odds, since later choices exclude conflicts. The quote planner validates city eligibility and price before persistence. The journal carries the town tier and describes its service benefits before travel.

The **Storage** chest beside each hearth exposes the same **96-item personal stash**, separate from the carried bag. It is per character, not an account-wide item exchange. Select carried gear and Store item, or stored gear and Take item. Stored gear uses the same 12-column grid, physical item footprints, art and tooltips as inventory. Cells shrink to fit the panel without horizontal scrolling; the grid starts with eight rows and expands vertically as needed to retain the 96-item capacity. Stored charms keep their physical size but grant no bonuses. Visual packing preserves saved slot identities for retrieval. Transfers retain exact item identity, recipe and enhancements, never spend gold and never change equipment. The existing service phase supplies Escape/controller closing and the durable transaction boundary.

Optional `CharacterSheet.stash` travels in the ordinary character checkpoint, local/worker/cloud validation and existing save cadence. Validation checks all 96 cells and uniqueness against bag, equipment, buyback and ground items across locations. Failed saves leave both containers unchanged. No new cloud endpoint or database migration is needed.

## Review

`/layouts.html?view=town&seed=7324` shows the refuge. Village, City overview, Hearth & stalls and Furnished interior inspect the actual runtime World and Renderer without gameplay ticks or saves. Seed input and New seed generate more examples. The World workspace registers this as Settlements. `/services.html?role=gambler&tier=city`, `/services.html?role=enchanter&tier=city&operation=rerollOne` and `/services.html?role=stash` use the real panels in disposable memory.

Headless tests cover tier composition, seeded reproducibility, immutable layouts, bounds, checked paths, access, family/roaming positions, transaction identity, full containers, failed writes and save ownership. Gameplay, economy feel and device performance remain player acceptance.
