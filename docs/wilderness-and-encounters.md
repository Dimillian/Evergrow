# Wilderness places and camps

Implemented 2026-09-05. These are procedural environmental encounters in the local prototype, using the same world coordinates for drawing, collision, map discovery and camp members.

| Place | Composition | Encounter role |
| --- | --- | --- |
| Enemy camp | Two stitched tents, watchfire, faction banner, supply crates and barrels, bedrolls, bones, lantern and broken perimeter posts | A fixed garrison of four enemies near the origin, six in generated camps. The simulation owns activation, individual member survival and clearing. |
| Ruined watchtower | Broken stone beacon, surviving arch and buttress, old banner, supply court, bedroll and lantern | Environmental landmark. It does not currently contain an enterable interior, chest or quest. |
| Graveyard | Twelve irregular headstones in rows, open central aisle, vigil altar, lanterns and a broken gate | Environmental landmark with a readable walkable layout. |
| Standing stones | Seven engraved monoliths, inscribed ground circle and luminous altar | Environmental landmark with cyan lighting and subtle rune pulses. |
| Abandoned caravan | Two torn covered wagons, detached wheel, scattered cargo, bedding, bones and a small fire | Environmental landmark suggesting an interrupted journey. |

The first camp, **Ashen Watch**, is at **(740, 180)**, east of the starting clearing. It contains a veteran Stalker, a normal Archer, Hound and Stalker. There is no first-zone elite camp leader. Later camps draw their support composition from biome: swamp camps use Caster leaders and Wisps, while Verdant camps include more Hounds. Generated leaders can be Elite only from geographic area level 3, beyond 6,400 units; individual monster values still come from the shared geographic level and rank rules.

For the default world seed, the nearest landmarks are Mournwatch Ruin at approximately (-2497, 629), Briargrave at (911, -2522), The Elder Choir at (2484, -1033), and Wayfarer’s End at (-2197, -2467). These coordinates describe content placement rather than revealing the map to the player.

## Generation and ownership

`wilderness-sites.ts` is a headless blueprint generator. A 1,600-unit cell owns at most one seeded place; up to four deterministic placement candidates avoid the main road, branches, settlements and starting clearing. Each accepted blueprint has a stable ID, one of five kinds, a name, biome, radius, world-space decorative objects and stable camp member offsets. Geometry and arrays are frozen. Cells use high coordinate bits to avoid repeating at 2^32 cell intervals.

`World.getWildernessSites` and `World.getEnemyCamps` return blueprints intersecting a requested rectangle, including objects whose center falls outside its edge. `World.getPOIs` uses half-open center inclusion so partitioned discovery queries do not duplicate places. The per-world generation cache holds at most 128 cells, including rejected candidates. A single query may enumerate at most 4,096 cells. Site radii remain at or below 220 units, with at most 30 decorative anchors and six camp members per site.

Ambient trunks and rocks are cleared from each site footprint. Tree and willow placement also reserves the projected crown above each trunk, preserving the view of fires and supplies without thinning the surrounding forest. Solid decorative anchors have collision circles shared by point checks and swept movement; drawing cannot change passability. South entrances into each site’s central walking space remain open, and authored camp positions have enough space for the largest current monster body. Camps and landmarks never overwrite town protection or the shared road centerlines.

`wilderness-art.ts` provides a ground pass, depth-sorted object drawing and bounded light candidates. Disturbed soil uses feathered stains rather than hard stamps. Tent stitching, runes, planks, damaged stone, fabric motion, fire and embers are generated from code. Actor depth is interleaved with individual object ground contacts rather than placing the whole site over the player.

`WorldMap.setCampStateReader` reads the current simulation without copying encounter state into saved exploration. A cleared camp becomes a jade tent/check icon, with a **Camp · Cleared** label and a changed tooltip. Unvisited places remain hidden. The world-generation identity remains 3, so existing explored terrain is retained and new places are discovered when revisited. Camp clear state and surviving enemies remain local to the current run.

## Verification

Deterministic tests cover seed/order independence, frozen blueprints, cache/query limits, negative-coordinate partition consistency, road/town/start exclusions, site spacing, member placement, every site’s open south approach, foreground canopy visibility, shared swept collision, discovery and chart round-tripping. Static visual review uses the real renderer without advancing gameplay. Combat feel and encounter difficulty remain for the user’s playtesting.
