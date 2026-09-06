# Creature death animations

Implemented 2026-09-06 on `codex/humanoid-death-studies`. Nine current enemy types each have four death recipes, for 36 animations. The original four Stalker-only mockups are historical; the twisting flat-body fourth option was replaced by a seated slump with an upright torso and independent head/arm settling.

## Current sets

| Creature | First | Second | Third | Fourth |
| --- | --- | --- | --- | --- |
| Hollow Stalker | Knees give way | Backwards impact | Forward crumple | Seated slump |
| Gravebound Brute | Heavy genuflection | Backbreaker fall | Failed brace | Dead weight |
| Mire Hexer | Staff gives way | Broken channel | Robe crumple | Last supplication |
| Ashen Ranger | Broken stance | Reeling fall | Stumbling dive | Bowman's slump |
| Scrap Goblin | Scrabbling collapse | Heel-over fall | Face-first stumble | Scrap heap |
| Goblin War Chief | Fallen standard | Dethroned | Last command | Hollow throne |
| Hollow Warden | The sentinel kneels | Falling monument | Broken oath | Silent vigil |
| Briar Hound | Forelegs buckle | Flank roll | Haunch collapse | Curl into the ground |
| Lantern Wisp | Lantern extinguished | Iron tumble | Unwinding spirit | Core escapes |

Humanoids share an articulated skeleton, with creature-specific proportions, materials, equipment, timing, travel and twist. Hounds use a four-leg rig, tapered ribcage, separate muzzle and tail. Wisps keep a rigid iron cage; their flame can extinguish, unwind or escape separately. Solid body parts expose side surfaces through true rotations. No death animation shears or squashes the complete standing image.

Each armed humanoid retains its weapon in the first and fourth recipes. The second throws it free during recoil; the third lets it slip before the brace fails. `death-weapon.ts` samples the shared solved hand at release and follows an independent arc, rotation, ground contact and brief settling motion. The entire weapon keeps its volume and markings and rests on its side. The dropped weapon is part of the bounded corpse presentation, not collectible gear; it cannot award duplicate loot or persist independently. The chief's horn remains in the off hand.

## Selection and ownership

`death-content.ts` exhaustively defines four immutable recipes for every `EnemyKind`. `EnemyDeaths.handle` consumes one presentation-local random sample on a new kill, selects each variant with 25% probability and stores it on the remains. Duplicate active kill events and later draws never reroll. Choices can repeat. Simulation and equipment/coin RNG are untouched.

`death-rig.ts` owns orthonormal frames, fixed-length limb solving and humanoid motion. `death-mesh.ts` projects depth/height and draws solid parts. `death-humanoid-art.ts` and `death-creature-art.ts` adapt the existing procedural creature shapes, palette and signature gear. `death-art.ts` is shared by gameplay and the review. It blends from a neutral living silhouette for the first 0.1 seconds; exact interrupted attack/gait snapshots remain future refinement. Falls follow captured facing. This is authored animation, not physics-driven ragdolls or terrain-aware corpse collision.

All remains stay in actor depth order, including the seated bodies and upright empty lanterns. Settled art is cached at 2× resolution with at most 45 entries and cleared on renderer reset. Corpses themselves are capped at 45; ordinary remains last 14 seconds and wisps 5 seconds, fading over the last 3 seconds. Reduced motion jumps directly to the selected final pose with no dust. Weapons, banners and cloth stop at the shared settle time before caching. Corpses have no collision, AI, rewards, map identity or saved state. Kill commitment, damage, loot and XP timing are unchanged. No character/test-progress reset is required.

## Local comparison

Open [the creature death atlas](http://127.0.0.1:5173/deaths.html) with the local development server running. Select any creature, compare its four synchronized animations, choose eight facings, use normal/half/quarter speed, pause, replay, scrub, or click a storyboard pose. Contact and settle times come directly from the runtime recipes. `Roll a death` exercises the same `EnemyDeaths` selector and highlights its choice. This uses a local presentation event only; no simulation, storage or reward handler is connected.

Every card places the live figure beside its death figure at equal scale and full brightness. The four frozen poses use the same death renderer. Warden framing fits its full axe. One shared fixed PostFX pass keeps the game CRT treatment, with native DOM labels and bundled fonts. The operating system's reduced-motion preference starts the study paused at rest.

The detail-preservation pass restores the brute's engraved breastplate and hammer bevel/inlay, the hexer's split stole/pendant/open staff cage, the ranger's shared procedural bow shapes and fletched quiver, the stalker's shroud and skull markings, both goblins' facial planes/tusks/blade edges, the chief's crown trim and skull banner, the warden's breastplate and asymmetric axe edge, the hound's tapered skull/sockets/jaw/four spine spikes, and the lantern's cap/base trim, pendant, bars and ribbons. Rigid surface markings inherit their part's floor correction and paint immediately after that surface, preventing the part from hiding its own detail during rotation. Equipment remains three-dimensional; eye and flame light may fade. Front details are naturally occluded when a body rests face down or turns away.

Each creature repair was checked image-to-image in the atlas against the live renderer, with all four designs visible during the fall and at rest. Rear views were inspected separately. These remain articulated adaptations of the live procedural art, not identical pose snapshots; proportion and pose differences are still possible.

The brute's complete rectangular eye band is attached to the skull surface. The ranger uses the live bow's procedural shape data, painting its trim and single string only on the camera-visible face to avoid doubled outlines and strings during rotation.

Validation covers all recipes, random-choice boundaries, exactly-once selection, expiry/capacity, reduced motion, orthonormal frames, degenerate limb targets, eight facing directions, finite geometry, cache bounds, canvas-state restoration and final-pose stability. Local art pages are inspected separately from gameplay; player acceptance of motion and combat readability remains the next feedback step.
