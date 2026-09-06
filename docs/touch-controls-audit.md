# Touch controls and UI audit

Date: 2026-09-06. Code baseline: `94f1ce6`, plus the current local Journeys, HUD sidebar, and reward changes. Those local changes are still evolving; this document does not approve or publish them.

Scope: runtime controls, every application phase, inventory and services, both maps, skill atlas, character creation, interruptions, and device layout. This is a code audit and implementation proposal, not a touch implementation or a physical-device test. Development art-review pages are outside the player-facing acceptance scope.

Implementation follow-up: [Touch gameplay and interface](touch-controls.md) records the delivered touch pass. The findings below describe the pre-implementation baseline.

## Assessment

**The game is not yet fully playable by touch.** Several DOM menus already support tapping, but movement is keyboard/gamepad-only, the action HUD is mostly noninteractive artwork, inventory equipment actions rely on desktop interactions, and canvas gestures assume one pointer.

The foundation is good: simulation accepts analog movement and independent aim; combat already validates skills and resources; inventory and commerce have validated commands; panel transitions already pause play and clear input. Build a touch input and presentation layer on those owners. Do not create a second combat or inventory implementation.

Recommended initial target: phones and tablets in landscape, with portrait-safe menus and an explicit portrait gameplay layout decision. This is a planning assumption pending device preference. Touch should also work on hybrid laptops without disabling mouse, keyboard, or gamepad.

## Findings, in priority order

| Priority | Finding | Consequence | Required work |
| --- | --- | --- | --- |
| P0 | No touch movement/action adapter | A touch-only player cannot use the full combat kit | Analog movement, independent aiming, basic attack, five skills, potion, dodge, interaction |
| P0 | Gameplay routes pointers through one mouse coordinate and button set | Fingers have no independent roles; one contact can affect another contact's aim/attack | Pointer ownership, capture, cancellation, and device arbitration |
| P0 | Equipment activation uses Shift-click or HTML drag/drop | Tapping can inspect an item but cannot complete the normal equipment workflow | Persistent item details with explicit equipment and move actions |
| P0 | Touch contacts are absent from the state cleanup contract | New controls could remain held or fire after opening/closing panels or travelling | Extend the existing phase/transaction cleanup and require fresh contacts after transitions |
| P1 | Desktop HUD is scaled artwork | Targets become too small, and fingers obscure important information | Dedicated touch layout and independently sized hit targets |
| P1 | Maps and skill atlas lack two-pointer gestures | Second fingers overwrite or disrupt current drag state; no pinch zoom | Shared pan/pinch/tap controller with per-contact ownership |
| P1 | Hover-based information and desktop panel sizing | Item details, map information, and dense skill choices are difficult to inspect | Tap selection, persistent detail sheets, responsive panel composition |
| P1 | No visible gameplay pause entry; sound toggle is keyboard-only outside gamepad support | Touch cannot deliberately access all session controls | Pause/menu button and sound toggle within pause |
| P1 | No safe-area or visual-viewport handling | Notches, browser bars, rotation, and keyboards need explicit layout handling | Shared viewport measurements, safe margins, resize cancellation |
| P2 | Physical mobile performance is unmeasured | Desktop smoothness does not establish sustained phone performance | Real-device profiling after controls exist, especially water and dense scenes |

## Evidence and reusable owners

- `game/src/game-input.ts`: movement is WASD/arrows; held attacks use button numbers 0/2; there is one pointer position and no pointer-ID ownership.
- `game/src/game.ts:bind`: window pointer movement updates mouse aim and disables gamepad mode without distinguishing touch. Canvas pointer down uses the mouse attack/interaction path. Pointer up clears by button number. Cancellation clears input, but gameplay has no dedicated lost-capture handler.
- `game/src/model.ts:Input`, `gamepad-input.ts`, and `game.ts:readInput`: analog movement, independent aim, held basic attack, and action edges already exist. Use the independent-aim path for touch; a thumb on the HUD must not trigger the mouse-over-HUD combat block.
- `game/src/game-shell.ts`: DOM HUD targets exist for menus, minimap, and portal. Basic attack, five assigned skills, potion, and dodge are drawn on Canvas without corresponding touch action controls.
- `game/src/panel-coordinator.ts`: one owner closes the previous panel, clears input, changes phase, opens the new panel, and restores gameplay focus. Extend this contract rather than attaching unrelated modal lifecycles.
- `game/src/inventory-panel.ts`: click inspects; Shift-click activates; bag movement uses HTML drag/drop. Touch hover is explicitly excluded. `item-tooltip.ts` and `.ui-tooltip` provide passive information, not a scrollable action sheet.
- `game/src/world-map.ts`, `dungeon-map.ts`, and `skill-tree-panel.ts`: each has its own single-drag state. The world map releases its drag on any pointer release; dungeon drag has no pointer ID; skill-tree movement does not check the active drag ID. None implements pinch zoom.

### Target-size calculation

Calculated from `Game.resize`, `getHUDLayout`, and `GameShell.resizeControls`, not measured in a browser:

| CSS viewport | Approximate ordinary HUD menu target | Target with raised badge area |
| --- | --- | --- |
| 844 × 390, phone landscape | 25 × 14 px | 25 × 23 px |
| 1024 × 768, tablet landscape | 39 × 22 px | 39 × 37 px |
| 390 × 844, phone portrait | 21 × 22 px | 21 × 37 px |

Use 44–48 CSS-pixel minimum touch controls, with larger movement/attack areas and spacing between destructive or combat actions. The existing shared DOM buttons often already have a 44-pixel minimum; scaled HUD targets bypass it. W3C's enhanced target-size criterion specifies 44 × 44 CSS pixels; that is the AAA criterion, not a claim that all controls currently meet accessibility conformance. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

## Proposed gameplay controls

Keep the Astral materials and resource identity, but arrange controls for thumbs rather than shrinking the desktop ribbon.

| Action | Touch behavior |
| --- | --- |
| Move | Left floating stick within a reserved lower-left activation region; radial dead zone and analog strength |
| Basic attack | Large lower-right attack pad: hold to repeat, drag to aim independently, release to stop |
| Five assigned skills | Five separate visible buttons around/above the attack pad; preserve every existing assignment |
| Directional skill | Drag from its button to aim with a preview; release to commit; explicit cancel region |
| Ground-target skill | Drag to position an offset world reticle, clamped to the skill's range; release to commit |
| Self/guard skill | Tap to activate; show normal cooldown/resource/gear availability |
| Potion | Dedicated button with charges and cooldown |
| Dodge | Dedicated button; use movement direction, or facing when stationary; optional drag direction can follow later |
| Interact | Contextual button for the currently reachable NPC, landmark, entrance, or portal; use existing reach and line-of-sight rules |
| Character, skills, journeys, map | Clearly sized menu controls, with less frequently used entries in a compact menu if needed |
| Pause and sound | Visible pause control; sound toggle inside the pause menu |
| Town portal | Keep the existing start/cancel and return-location behavior, with an obvious touch cancel state |

Keep movement available while aiming or attacking. Starting a skill aim temporarily suppresses basic-attack repetition; resolve competing action contacts deterministically rather than spending two abilities from one ambiguous gesture. Self skills should not require a drag. Empty slots remain inert. Show why an assigned action is unavailable when touched, without spending mana or bypassing cooldowns.

Define targeting metadata alongside the existing skill recipes: directional, ground point, or self, with any required target selection made explicit. Audit all twenty active skills against it. Do not infer targeting from skill names or duplicate range/mana formulas in the touch UI. Previewing is presentation only; validate and commit through the same skill path on release.

Reuse existing body-height correction and bounded ranged assistance for aimed projectiles. Preserve raw ground targeting, range and visibility checks, and non-homing released projectiles. A stationary basic attack can initially use the last aim/facing; stronger automatic enemy selection is a separate combat-feel choice for user feedback.

Do not start with tap-to-move: it introduces navigation/pathfinding and makes world taps compete with attacks and interactions. The current continuous combat model fits independent movement and aiming better.

World camera pinch should only begin from two unclaimed world contacts. Never steal a finger already owning movement or an action. Provide a deliberate camera-zoom alternative in the menu if two free fingers are inconvenient.

## Complete UI coverage

| Surface | Current usable foundation | Touch completion |
| --- | --- | --- |
| Character hall | Native buttons, eight slots, six starter choices, editable seed, randomize, delete confirmation | Compact preview on phones; keep creation/continue actions reachable with keyboard open; visible create/load/delete busy states |
| Gameplay HUD | Clickable menu/minimap/portal targets; shared layout | Touch combat controls, pause, thumb-safe resource placement, context interaction, safe-area margins |
| Character equipment | Click inspection, attribute buttons, portrait rotation, validated equip commands | Tap item → persistent details → Equip/Unequip; choose main/off hand when ambiguous; explain 2H reservation and incompatible slots |
| Bag | 64 real cells, validated moves and swaps | Tap source and destination for movement; adaptive 4/6/8 columns without changing capacity; optional long-press drag later |
| Item information | Shared item stats, rarity and comparison foundations | Scrollable detail sheet with comparison and actions; no reliance on hover, Shift, or right click |
| Skill atlas | Canvas culling, selection, search, zoom buttons, explicit allocation/assignment controls | Pinch/pan, forgiving tap selection, selected-node drawer, all five assignment targets, specialization/rank/Overload controls reachable |
| World map | Single-pointer pan, +/- and recenter, shared projection, decluttered labels | Anchored pinch, persistent tapped POI/district information including zone level, explicit dismissal, no pinch interpreted as selection |
| Dungeon map | Map view, pan, world-map/close buttons | Same gesture controller; explicit zoom controls; tappable room/POI details; verify hit projection against rendered canvas content |
| NPC services | Click selection and explicit buy/sell/improvement actions | Responsive list/detail layout; pinned transaction action; full affix/stat readability; disable stale transaction controls while saving |
| Landmark/event panel | Explicit choices, close, entrance actions | Finger-sized choices and visible channel/cancel feedback; consume the initiating touch before returning to gameplay |
| Journeys | Explicit tracking, dismiss, suggestions, map actions; collapsible HUD rows | Compact tracker on phones, tappable objectives and details; preserve guarded asynchronous commands and map-return context |
| Pause/defeat | Explicit resume, save/return, and revive actions | Touch entry to pause, clear busy/error feedback, resume requiring fresh gameplay contacts |
| Notifications/rewards/loot | Passive feedback and simulation-owned pickups | Keep feedback away from thumb pads, preserve world visibility, do not turn transient notifications into mandatory interactions |

Inventory currently has a 387-pixel minimum bag width before surrounding panel padding. Its narrow layout stacks sections, so phone fit needs more than hiding sidebars. Use Bag / Equipment / Stats views with persistent item details. For the skill atlas, the narrow breakpoint stacks a 450-pixel chart above the sidebar: a chart with a movable detail drawer makes better use of a short phone screen. Keep all advanced skill functions accessible, not just node allocation.

Map and tree taps need a movement threshold and selection arbitration. Larger invisible hit circles alone will overlap in dense constellations: use zoom-dependent selection and prioritize clearly visible candidates. Remove any dependence on double-click to purchase nodes; retain explicit allocation confirmation through the existing button.

Service selection must never purchase or sell immediately. Preserve inspect → quote/action → validated transaction, including save failures and changed equipment eligibility. Long item descriptions must scroll without moving the underlying atlas or character.

## Application phases and additional gates

There are ten explicit phases, plus important asynchronous and environmental gates. Touch availability must follow the combined context, not just whether the overlay looks visible.

| Phase/gate | Allowed touch ownership | Transition requirement |
| --- | --- | --- |
| `ready` | Hall controls and native text fields | No gameplay ownership; create/load/delete guarded by `hallBusy`; entering play clears initiating contacts |
| `playing` | Movement, combat, world interaction, gameplay menus | Only while alive and not in a blocking transaction; shared combat rules still govern each action |
| `paused` | Pause UI only | Clear sticks, held attacks, skill previews, and captures; resume requires a fresh down event |
| `dead` | Defeat/revive/return UI only | Cancel all pending touch actions at defeat, including delayed releases |
| `map` | Active world/dungeon map gestures and controls | No gameplay commands; switching map subviews discards old gesture origins |
| `character` | Bag/equipment/stats and item-detail gestures | No gameplay commands; close or switch to skills clears item drag/selection gesture ownership |
| `skills` | Atlas gestures, search, node and assignment controls | No gameplay commands; cancel gestures on close, allocation-induced layout changes, or context switch |
| `service` | Inspection and validated service actions | No gameplay commands; durable-operation busy state blocks duplicate commits and stale quote changes |
| `event` | Landmark choices/entrance UI | Returning to play must consume the activating touch so it cannot cancel its new channel or attack |
| `journeys` | Journey controls and map navigation | Guard asynchronous actions; preserve intended map/close navigation and discard prior captures |
| `savingAction` | Progress/error presentation; only explicitly permitted UI actions | Simulation and command gating already exist; touch must participate before and after both success and failure |
| Ordinary autosave | Current phase's controls | Continue normal gameplay; do not block every periodic save |
| Portal/event channel | Existing movement/damage/cancel rules | Clear the initiating UI gesture; a later intentional move/cancel remains meaningful |
| World/dungeon travel or revive | No old gameplay gesture may survive relocation | Cancel ownership and targeting before replacing world/position; require fresh contacts afterward |
| Hidden page, focus loss, disposal | None | Cancel everything, release capture safely, pause through existing lifecycle; never replay pending actions on return |
| Native text editing | Native input and its panel only | Do not steal text selection, keyboard gestures, or browser scrolling; recompute visible layout as keyboard changes |
| Resize/orientation/device switch | Cancel or explicitly rebase affected gestures | No coordinate jump, stuck movement, or attack when a control moves under a finger |

Current panel policy permits character ↔ skills switching. Map, service, event, and journeys normally open from playing, with explicit transitions for special flows. Preserve that policy; do not let a global touch menu silently open arbitrary panels over another modal.

Add a control-context generation to touch ownership: after a phase, transaction, or world transition, ignore up/click events from the previous generation. Track canceled fingers until release; do not automatically reacquire a stick because an old finger is still down. Clear touch input from the existing `Game.clearInput` lifecycle.

The portal control already toggles cancellation through `PortalChannel.start` when active. Preserve this existing behavior rather than introducing a separate touch-only channel rule.

## Implementation shape

1. **Headless touch input owner.** Track a bounded `pointerId → role` collection, stick vectors, action edges, skill previews, and neutral/release gating. Produce the existing `Input` contract. Never synthesize keyboard/mouse events to operate combat.
2. **Shared gesture owner for canvases.** Track tap, one-pointer pan, and two-pointer pinch. Zoom around the midpoint in world/chart coordinates. Rebase smoothly on one → two → one contacts. Handle pointer cancel and lost capture by identity. Keep wheel and keyboard support.
3. **Touch HUD layout and bindings.** Draw using shared resource/action state; position real input targets from the same geometry. Keep hit sizes in CSS pixels, independent of world zoom and render resolution. Reuse the Astral palette and native numeral fonts.
4. **Persistent item/detail UI.** Reuse shared item components and validated character/commerce commands. Show selected item actions and comparisons in scrollable sheets. Keep desktop shortcuts as optional accelerators.
5. **Unified availability and device presentation.** Combine phase, transaction, visibility, and editing state at the input boundary. Distinguish intentional touch/mouse/gamepad use; incidental pointer movement must not flip control modes. Keep action availability sourced from existing gameplay definitions.
6. **Shared viewport owner.** Account for safe-area insets, browser chrome, keyboard-visible area, and orientation. Inspect the renderer's 540-unit minimum width against narrow portrait aspect ratios before promising portrait gameplay. Ensure pointer projection uses the actual displayed content rectangle.

Pointer capture and CSS gesture declarations must be designed together: use `touch-action: none` on dedicated gameplay/gesture surfaces, not indiscriminately on scrollable panels or text fields. Handle cancellation and compatibility mouse events deliberately. [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/)

Keyboard-aware layout should observe the visual viewport as well as layout size. This is especially relevant for the character form, skill search, and short landscape screens. [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)

Keep pointer handlers lightweight: update input state, then render at frame cadence. Avoid rebuilding the DOM or reading layout repeatedly during stick movement. Reuse current map culling/caches. Real phones still need sustained GPU, memory, and thermal checks for native-resolution UI, water, lighting, and post-processing. No mobile frame-rate claim follows from this audit.

Audio should unlock from a trusted touch action, including the title entry path, and recover gracefully after interruptions. Verify on the target browsers; do not assume a sound unlock after asynchronous save/load behaves identically everywhere.

## Proposed checkpoints and verification

1. **Safe touch foundation and playable combat:** pointer ownership, context cleanup, movement, aimed basic attack, potion/dodge, interaction, pause, provisional touch layout. User tests movement and aiming before visual polish.
2. **Complete skill controls:** targeting metadata and previews for all twenty skills, all five slots, cancellation, action arbitration, resource/cooldown/gear feedback.
3. **Touch-complete character and services:** item detail sheet, equip/unequip/off-hand selection, bag moves, attributes, buying/selling/upgrades, mobile hall/seed forms.
4. **Maps, skills, journeys and lifecycle polish:** shared pinch controller, persistent details, search and assignment layout, safe areas, keyboard/rotation, channel/travel transitions. Retain existing desktop behavior throughout.
5. **Physical-device acceptance and optimization:** user gameplay feedback plus requested device profiling; resolve remaining interaction and rendering issues, then checkpoint the completed pass.

Code-level tests should cover pointer IDs arriving/releasing out of order; simultaneous movement and attack; a third finger; cancellation and capture loss; old contacts after phase changes; skill cancel without spending resources; duplicate action edges; menu close without click-through; save success/failure; and mouse/gamepad coexistence. Test pinch anchors, two-to-one transitions, bounds, and coordinate mapping as pure geometry. Existing command tests should continue to protect transactional item and skill behavior.

Manual acceptance, performed by the user unless they explicitly request automated/browser gameplay testing:

- Create a character, edit/randomize its seed, enter play, pause, return, and reload using touch only.
- Move and aim independently; use every weapon family, potion, dodge, and all five assigned skill positions. Check directional, ground, and self skills, insufficient mana, cooldowns, empty slots, and incompatible gear.
- Equip/unequip every hand configuration, including 2H reservation and wand/focus, move and swap bag items, allocate attributes, inspect long affix lists, and complete or fail service transactions without losing items.
- Pan/pinch both maps and the skill atlas; tap zones/POIs, inspect levels, search, allocate, specialize, assign/clear skills, and operate Journeys and landmarks.
- Open/close a panel while holding movement/attack, interrupt a skill preview, cancel a portal, enter/leave a dungeon, die/revive, rotate, background/foreground, and interrupt with the on-screen keyboard. No stuck input or ghost attacks afterward.
- Check a small phone and a tablet, both orientations, relevant Safari/Chromium devices, and a hybrid input device. Confirm safe areas, readable numerals, reachable close/action buttons, scrollable details, and no browser gesture competing with combat.
- Sustain traversal and fighting near water and dense effects. Evaluate frame pacing and temperature as well as average FPS. Preserve desktop map and gameplay fluidity.

Completion means every normal gameplay and progression action works without a physical keyboard, mouse, hover, or drag-and-drop dependency. A joystick alone would not meet that bar.
