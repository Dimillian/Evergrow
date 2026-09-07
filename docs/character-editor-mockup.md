# Character editor MVP mockup

2026-09-07 · Local, save-free appearance study on `character-editor`.

Open [the character editor](http://127.0.0.1:5173/character-editor.html) with the existing local Vite server running. This development entry is excluded from the production entrypoints. It is a working visual mockup, not the live new-character form.

## Scope

- Sixteen skin palettes and sixteen independent hair palettes, including natural and uncommon colors, on two pages each.
- Twenty-four hairstyles on three pages, including cropped cuts, waves/coils, locs, braids, buns and ponytail variants.
- Eight facial-hair choices: none, stubble, moustache, short beard, goatee, full beard, handlebar and braided beard.
- Eight accessory choices: none, gold hoops, moon circlet, eyepatch, spectacles, silver studs, ear cuff and nose ring. Eyepatch straps terminate on the eye-centered patch; glasses have contrasting rims.
- Section-wide hover or keyboard focus reveals previous/next paging arrows and a page counter. Touch devices show them continuously. Paging preserves the selected look.
- Armor tab with sixteen tints for helmet, chest, shoulders, gloves, legs, boots and cloak independently. Each part can use its original color; reset restores all original colors. Helmet visibility is an independent checkbox and survives color resets.
- **Inventory preview** opens the actual inventory panel around a disposable character. The edit icon immediately after the **Equipment** title uses the same sizing as the inventory sort tools and opens the Character tab directly, with the draft intact. Armor remains available through its tab. This proposed entry point is not enabled in gameplay yet.
- Full equipped character, face close-up, desktop small-scale view, eight facing buttons and drag-to-rotate.
- All six starter loadouts and a show-hood preview. Switching gear preserves the appearance draft.
- Name preview, independent cosmetic randomization, appearance reset and a review dialog with PNG portrait export.
- Keyboard/pointer/touch controls, reduced-motion handling, and a compact sticky preview above the scrolling narrow-screen controls. Gamepad navigation and native packaging are not part of this mockup.

Height, body proportions and body presets are deliberately excluded by the user's MVP direction. There are no simulation ticks, combat controls, character sessions, storage reads/writes or cloud requests. No existing test progress is reset. No Site was created or deployed.

## Implementation

`appearance-content.ts` holds the study's palette/part recipes. `appearance-shapes.ts` composes head-local skin with `appearance-hair-shapes.ts` and `appearance-face-details.ts`. `CharacterPose.appearance` is an optional presentation input, passed through the actual player rig to `headArmor`; gameplay does not supply it. The existing gameplay head drawing remains unchanged when no study recipe is supplied. This is an experimental presentation path to review before adopting appearance as a required character/save contract.

`appearance-armor.ts` creates a tinted outfit projection while preserving original items, material shading, trim, geometry styles and seeds. Tints currently belong to visual parts, not individual items: changing equipment keeps that part's tint. Shoulders derive their geometry from the chest item but have an independent tint. `appearance-inventory-review.ts` supplies the actual inventory panel with an optional portrait renderer and a memory-only player; its sample bag/equip commands never write saves.

`character-editor-review.ts` owns the disposable UI draft, native-density canvases, facing and portrait export. It reuses the existing character body, equipment silhouettes and procedural rendering, with no new runtime dependency. Item creation and facing-envelope work stay outside the animation loop. The clock only animates the existing idle pose, runs at most 60 draws per second and stops drawing when hidden or reduced motion is requested. Typography and controls use the shared UI kit and bundled fonts.

Character framing includes the selected appearance's actual contours. Hair/accessories are head-local in this MVP: long hair has no independent physics or articulated rear-body pass. The hood covers hair, ear jewelry and circlets; facial hair, eyepatches, spectacles and nose rings remain visible. The drawing rules are intentionally limited to the current hood/open-helmet geometry.

The development-only [appearance catalog](http://127.0.0.1:5173/appearance-catalog.html) shows enlarged front/right/left/back comparisons of all hairstyles, beards and accessories using the same procedural drawing.

The small-scale view is an unlit art preview, not a claim of final world/CRT readability. Final lighting, animation overlap and art preferences need review before production integration.

## Verification

The first mockup checkpoint passed 760 code tests (historical). The expanded checkpoint ran 762 code tests: 761 passed initially; the existing cloud-save concurrency test failed because it assumes the first concurrent request wins. Its full ten-test file passed on rerun. Strict application/core compilation and the local production build passed. The art contract covers every hairstyle across sixteen angles, covered/uncovered heads and rest, movement, attack, cast and defeat, checking finite drawing and restoration of Canvas state. Tint tests cover all part/color combinations, input isolation, original-color restoration and independent helmet visibility.

The in-app browser was used to inspect layouts, all part comparison sheets, paging, individual/all color resets and the inventory editing entry point. The subsequent header-icon simplification passed type checking and visual/direct-opening review. No automated gameplay browser suite or playable-session testing was run. User acceptance of the new looks remains the next step.

The [feasibility analysis](character-editor-feasibility.md) describes the later creation/save integration. Its body-preset suggestions are outside the current MVP scope.
