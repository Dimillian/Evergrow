# Character editor MVP mockup

2026-09-07 · Local, save-free appearance study on `character-editor`.

Integration follow-up: [Character appearance editor](character-editor.md) documents the live creation/inventory flow and save v4 change. The review routes now reuse `character-editor.ts`; the scope below records the approved mockup.

Open [the character editor](http://127.0.0.1:5173/character-editor.html) with the existing local Vite server running. This development entry is excluded from the production entrypoints. It is a working visual mockup, not the live new-character form.

## Scope

- Sixteen skin palettes and sixteen independent hair palettes, including natural and uncommon colors, on two pages each.
- Twenty-four hairstyles on three pages, including cropped cuts, waves/coils, locs, braids, buns and ponytail variants.
- Eight facial-hair choices: none, stubble, moustache, short beard, goatee, full beard, handlebar and braided beard.
- Eight accessory choices: none, gold hoops, moon circlet, eyepatch, spectacles, silver studs, ear cuff and nose ring. Eyepatch straps terminate on the eye-centered patch; glasses have contrasting rims.
- Section-wide hover or keyboard focus reveals previous/next paging arrows and a page counter. Touch devices show them continuously. Paging preserves the selected look.
- Armor tab with sixteen tints for helmet, chest, shoulders, gloves, legs, boots and cloak independently. Each part can use its original color; reset restores all original colors. Helmet visibility is an independent checkbox and survives color resets.
- **Inventory preview** opens the actual inventory panel around a disposable character. The edit icon immediately after the **Equipment** title uses the same sizing as the inventory sort tools and opens the Character tab directly, with the draft intact. Armor remains available through its tab. This entry point is now enabled in gameplay through the shared component.
- Full equipped character, face close-up, desktop small-scale view, eight facing buttons and drag-to-rotate.
- All six starter loadouts and a Show helmet preview toggle, labeled consistently with the Armor tab. Switching gear preserves the appearance draft.
- Name preview, independent cosmetic randomization and appearance reset. The live character view is the preview; the redundant Review look dialog and its portrait export were removed.
- Keyboard/pointer/touch controls, reduced-motion handling, and a fixed phone preview above independently scrolling controls with sticky Character/Armor tabs. Gamepad navigation and native packaging are not part of this mockup.

Height, body proportions and body presets are deliberately excluded by the user's MVP direction. There are no simulation ticks, combat controls, character sessions, storage reads/writes or cloud requests. No existing test progress is reset. No Site was created or deployed.

## Smartphone mockups

Open [Smartphone study](http://127.0.0.1:5173/character-editor-phone.html) for three independent interactive 390 × 844 views: Character, Armor and Inventory. They embed the same local editor, using `?view=armor` or `?view=inventory` for their starting screen; drafts are separate and disappear on reload.

Below 700 CSS pixels, the character and face remain visible above a scrolling control sheet. Paging arrows are always visible with 44-pixel targets, palettes use four columns, and the tab strip stays at the sheet's top. Short displays use a smaller preview. Inventory reuses the existing touch Bag/Equipment/Stats sections; the Equipment heading icon opens Character directly. The same responsive editor is integrated into gameplay; these embedded review instances remain save-free. Native packaging was not changed.

## Implementation

`appearance-content.ts` holds the study's palette/part recipes. `appearance-shapes.ts` composes head-local skin with `appearance-hair-shapes.ts` and `appearance-face-details.ts`. `CharacterPose.appearance` is supplied by the shared player pose from required saved `CharacterSheet.look` and passed through the actual player rig to `headArmor`. Enemy rendering keeps its own head recipes.

`appearance-armor.ts` creates a tinted outfit projection while preserving original items, material shading, trim, geometry styles and seeds. Tints currently belong to visual parts, not individual items: changing equipment keeps that part's tint. Shoulders derive their geometry from the chest item but have an independent tint. `appearance-inventory-review.ts` supplies the actual inventory panel with the shared runtime portrait renderer and a memory-only player; its sample bag/equip commands never write saves.

`character-editor.ts` owns the disposable UI draft, native-density canvases, facing and responsive presentation; `character-editor-review.ts` is now only a memory-only harness. It reuses the existing character body, equipment silhouettes and procedural rendering, with no new runtime dependency. Item creation and facing-envelope work stay outside the animation loop. The clock only animates the existing idle pose, runs at most 60 draws per second and stops drawing when hidden or reduced motion is requested. Typography and controls use the shared UI kit and bundled fonts.

Character framing includes the selected appearance's actual contours. Hair/accessories are head-local in this MVP: long hair has no independent physics or articulated rear-body pass. The hood covers hair, ear jewelry and circlets; facial hair, eyepatches, spectacles and nose rings remain visible. The drawing rules are intentionally limited to the current hood/open-helmet geometry.

The development-only [appearance catalog](http://127.0.0.1:5173/appearance-catalog.html) shows enlarged front/right/left/back comparisons of all hairstyles, beards and accessories using the same procedural drawing.

The small-scale view is an unlit art preview, not a claim of final world/CRT readability. Final lighting, animation overlap and art preferences need review before production integration.

## Verification

The first mockup checkpoint passed 760 code tests (historical). The expanded appearance checkpoint ran 762 code tests: 761 passed initially; the existing cloud-save concurrency test failed because it assumes the first concurrent request wins. Its full ten-test file passed on rerun. Strict application/core compilation and the local production build passed. The art contract covers every hairstyle across sixteen angles, covered/uncovered heads and rest, movement, attack, cast and defeat, checking finite drawing and restoration of Canvas state. Tint tests cover all part/color combinations, input isolation, original-color restoration and independent helmet visibility.

The in-app browser was used to inspect layouts, all part comparison sheets, paging, individual/all color resets and the inventory editing entry point. The subsequent header-icon simplification passed type checking and visual/direct-opening review. No automated gameplay browser suite or playable-session testing was run. The smartphone revision passed type checking/build and was reviewed in phone-sized in-app browser canvases, including paging, armor selection and inventory-to-editor navigation. User acceptance of the new looks remains the next step.

The [feasibility analysis](character-editor-feasibility.md) describes the later creation/save integration. Its body-preset suggestions are outside the current MVP scope.
