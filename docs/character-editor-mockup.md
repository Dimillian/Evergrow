# Character editor MVP mockup

2026-09-07 · Local, save-free appearance study on `character-editor`.

Open [the character editor](http://127.0.0.1:5173/character-editor.html) with the existing local Vite server running. This development entry is excluded from the production entrypoints. It is a working visual mockup, not the live new-character form.

## Scope

- Eight skin palettes and eight independent hair palettes.
- Eight hairstyles: windswept, cropped, bob, long, braid, high bun, curls and shaved.
- None, stubble, moustache and short beard facial-hair choices.
- None, gold hoop, moon circlet and eyepatch accessory choices.
- Full equipped character, face close-up, desktop small-scale view, eight facing buttons and drag-to-rotate.
- All six starter loadouts and a show-hood preview. Switching gear preserves the appearance draft.
- Name preview, independent cosmetic randomization, appearance reset and a review dialog with PNG portrait export.
- Keyboard/pointer/touch controls, reduced-motion handling, and a compact sticky preview above the scrolling narrow-screen controls. Gamepad navigation and native packaging are not part of this mockup.

Height, body proportions and body presets are deliberately excluded by the user's MVP direction. There are no simulation ticks, combat controls, character sessions, storage reads/writes or cloud requests. No existing test progress is reset. No Site was created or deployed.

## Implementation

`appearance-content.ts` holds the study's palette/part recipes. `appearance-shapes.ts` draws head-local skin, hair, facial hair and accessories. `CharacterPose.appearance` is an optional presentation input, passed through the actual player rig to `headArmor`; gameplay does not supply it. The existing gameplay head drawing remains unchanged when no study recipe is supplied. This is an experimental presentation path to review before adopting appearance as a required character/save contract.

`character-editor-review.ts` owns the disposable UI draft, native-density canvases, facing and portrait export. It reuses the existing character body, equipment silhouettes and procedural rendering, with no new runtime dependency. Item creation and facing-envelope work stay outside the animation loop. The clock only animates the existing idle pose, runs at most 60 draws per second and stops drawing when hidden or reduced motion is requested. Typography and controls use the shared UI kit and bundled fonts.

All current hair shapes fit within the existing body framing plus the study's conservative margin. Hair/accessories are head-local in this MVP: long hair has no independent physics or articulated rear-body pass. The hood covers hair, hoops and circlets; facial hair and eyepatches remain visible. The drawing rules are intentionally limited to the current hood/open-helmet geometry.

The small-scale view is an unlit art preview, not a claim of final world/CRT readability. Final lighting, animation overlap and art preferences need review before production integration.

## Verification

The checkpoint passed `npm run check`: 760 code tests, strict application/core compilation and the local production build. The added art contract covers every hairstyle across sixteen angles, covered/uncovered heads and rest, movement, attack, cast and defeat, checking finite drawing and restoration of Canvas state.

The in-app browser was used to inspect desktop and narrow layouts and the appearance-selection/review interaction. No automated gameplay browser suite or playable-session testing was run. User acceptance of the new looks remains the next step.

The [feasibility analysis](character-editor-feasibility.md) describes the later creation/save integration. Its body-preset suggestions are outside the current MVP scope.
