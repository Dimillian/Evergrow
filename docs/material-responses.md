# Material responses

Implemented 2026-09-07. One procedural presentation system serves containers, combat contacts, solid scenery and elemental deaths. No textures, sprite sheets or physics library are needed.

## Materials

| Material | Motion and appearance | Current uses |
| --- | --- | --- |
| Wood | Long spinning splinters, warm dust, short bounce | Crates, barrels, hits on trunks/fences/wagons |
| Stone | Heavy irregular chips, low arcs, powder | Stone scenery, crypt walls, Warden physical impacts |
| Metal | Fast bright sparks, sharp bounces, short life | Shield blocks, chief armor, lightning impacts |
| Ice | Angular cyan shards, cold haze, brief light | Frost hits/deaths, ice-crystal scenery |
| Bone | Ivory fragments, dry dust, moderate bounce | Physical impacts on skeletal creatures |
| Glass | Violet/cyan facets, light shards, short shimmer | Spectral/caster and arcane impacts |
| Ember | Rising warm particles, drifting ash, brief light | Fire hits and deaths |

`material-content.ts` contains immutable silhouettes, palettes, travel/lift/flight/bounce, lifetime, glow and acoustic texture recipes. `material-response.ts` resolves actual events and builds seeded fragments once. `fragmentPose` evaluates analytic trajectories: rendering at another frame rate cannot change their destinations. `material-response-art.ts` draws geometry, shadows, dust and restrained local glow. Wood barrels mix two broken hoops into the wood response. The old separate container-debris renderer is removed.

## Integration

`hit` and `kill` carry the actual damaging projectile, ground pulse, skill or melee weapon element. Released missiles and delayed effects never infer the element from equipment at impact time; burn ticks explicitly carry fire. Physical hits use the target's material. The final hit delegates its solid fragment burst to the kill event, preventing a duplicate burst. The existing impact flashes, damage text and articulated enemy deaths remain in place.

Frost deaths briefly retain a cracked, icy silhouette before dispersing. Fire deaths collapse into darkened remains with rising embers and an earlier fade. `EnemyDeaths` snapshots these choices; it never modifies living actors. The original four articulated physical death variants remain.

A melee swing produces at most one non-destructive scenery response. Swept projectile obstruction contacts classify the actual tree, ice crystal, site decor or wall; a shattered container already owns its burst and cannot trigger a duplicate surface response. Stone walls and trees remain solid. Meteor impacts now share this budget for stone fragments plus rising embers. Fire/frost blasts add their corresponding material response, and Earthshatter adds stone. Burning patches do not emit repeated blast fragments. Chests and boss reveals remain future consumers.

Material noise layers add quiet texture to elemental impacts, kills and blocks. Container/scenery impacts use their material's crack/body recipe. Existing loot, XP and level-up sounds remain unchanged.

## Bounds and persistence

All consumers share a maximum of **48 bursts and 384 fragments**, evicting oldest presentation if saturated. At most six brief material lights are submitted; reduced motion disables these lights, dust, glows and flight/spin, showing settled fragments that fade. Expired bursts release their fragment arrays. Particle presentation never advances simulation RNG, rolls loot, alters damage/collision, or enters saves. Saved container destruction and physical gold remain owned by the existing simulation checkpoint. No character reset.

## Review and verification

`/loot.html?materials` compares impact and aftermath for all seven materials. `/loot.html?containers` shows intact-to-fading crate/barrel stages using the same engine. `/loot.html?element=frost` and `?element=fire` show elemental creature death poses. These are static, save-free art studies.

Headless tests cover deterministic immutable recipes, finite and reduced-motion trajectories, burst/fragment/light budgets, lethal-hit deduplication, container hoops, weapon changes after projectile release, unchanged reward/checkpoint state, and actual surface classification. Gameplay feel remains player testing.
