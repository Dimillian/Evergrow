# Humanoid death studies

2026-09-06 — proposed animation directions, not selected runtime behavior.

Open [the local animated comparison](http://127.0.0.1:5173/deaths.html) with the development server running. The four designs use a review-only articulated adaptation of the existing Stalker's angular bones, skull, ribs, and burial shroud. A small rendering of the unchanged live Stalker provides a silhouette reference. The enlarged view and 1× view use identical sampled motion.

| Direction | Motion | First major body contact |
| --- | --- | --- |
| Knees give way | Recoil, knee buckle, torso tips onto the shoulder | 0.57 s |
| Backwards impact | Chest recoils, feet slip forward, hips/back land, arms settle | 0.46 s |
| Forward crumple | Stagger, hands reach the ground, elbows fold, chest lands | 0.50 s |
| Twisting side fall | Pelvis turns, asymmetric hip/shoulder contact, trailing arm settles | 0.53 s |

All four loop together with a ready pause and a longer hold on the final pose. Playback supports pause, replay, half/quarter speed, mirroring, and a shared death-time scrubber. Clicking a storyboard frame pauses all four at that frame's time; Landing uses the clicked design's contact time, so other designs may be at different stages. Reduced motion starts paused on the resting pose; users can explicitly play or inspect frames.

`game/src/death-study-rig.ts` owns authored pose keys, fixed-length two-bone limb solving, separately projected ground depth/height, torso/head orientation, depth ordering, contact shadows, and contact-timed dust. `death-study.ts` owns playback and the comparison. Its single shared PostFX pass uses the game's fixed CRT treatment; labels and controls remain native DOM text with the bundled fonts. No generated raster assets or animation dependencies were added.

This is a motion mockup, not a production skeleton or full physics simulation. It samples a common standing start, one authored fall direction per design, and a mirrored counterpart. Actual interrupted attack poses, arbitrary facings/impacts, other humanoid archetypes, terrain-aware contact, and equipped weapons would need a later selected implementation. It does not import Simulation, access saves, emit kill/reward events, or replace `death-art.ts` / `death-presentation.ts`. Existing gameplay and test progress are unchanged.

Validation: strict TypeScript and headless-core compilation, production build, and visual inspection of the local comparison and resting poses in the Codex in-app browser. No browser gameplay tests were run.
