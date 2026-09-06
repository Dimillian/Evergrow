# Touch gameplay and interface

Implemented 2026-09-06. The earlier [audit](touch-controls-audit.md) records the starting problems and proposed acceptance scenarios. This implementation adds a device-specific input and presentation layer; combat rules, item transactions, character saves and desktop bindings remain shared.

## Activation and controls

Devices whose primary pointer is coarse show touch controls automatically. A real touch also enables them on hybrid devices. Intentional mouse/pen input, physical gameplay keys or gamepad input restores the desktop/controller presentation. Typing in native text fields does not switch the layout. There is no new settings screen, display filter or save format.

| Control | Behavior |
| --- | --- |
| Left movement disc | Drag in any direction for analog movement, independently of aiming |
| Attack pad | Hold to repeat the basic attack; drag away from the initial contact to aim |
| Five skill buttons | Touch and drag to aim, then release; self-centered skills can simply be tapped |
| Cancel target | Drag a skill finger into Cancel and release to discard its preview without spending mana |
| Potion | Tap to use the existing dual potion; shows charges and cooldown |
| Dodge | Tap to dodge along movement or current facing; shows charges |
| Interact | Use the existing nearby interaction resolver; a tap on a nearby world object also works |
| Portal | Start the town channel, tap again to cancel; in sanctuary locate the return portal |
| Character / skills / journeys / map / pause | Dedicated touch menu buttons |
| Camera | Pinch with two free fingers on the world, or use zoom buttons in Pause |
| Sound | Touch-only sound control in Pause, using the same N-key preference |

Aim persists between attacks. Skill aiming temporarily takes ownership from the basic-attack finger while movement remains available. All five slots retain their original assignments; empty slots do nothing. Resource cost, gear compatibility, action recovery and cooldown still go through the existing combat rules. This is manual independent aiming with the existing bounded ranged assistance, not automatic enemy targeting or tap-to-move pathfinding.

`touch-input.ts` owns bounded contact IDs, analog vectors, aim ownership and one-shot edges. `touch-targeting.ts` classifies every resolved skill recipe, including specializations. `skill-target-point.ts` is the shared ground-target range/obstruction calculation used by combat and previews. Preview circles and direction lines render after world post-processing.

## UI workflows

On touch, the character window has Bag, Equipment and Stats tabs. Tap an item to open its scrollable shared stat/comparison card. Equip buttons name the destination, including main/off hand and rings when eligible. Unequip and Move use the same validated character commands as desktop. Move highlights valid destinations; tap a destination to move or swap, or Cancel. Reserved 2H slots explain why they are occupied. Desktop hover, Shift-click and drag/drop are retained.

Both maps and the skill atlas use `touch-gesture.ts` and `touch-canvas.ts` for touch-only pan, pinch and tap. Existing mouse and wheel handlers remain in place. Pinch tracks the midpoint and transitions back to one finger without jumping; a pinch or drag never selects a point. Tapped map information remains visible until another gesture or dismissal. Skill selection opens the actual inspector, including allocation, rank/specialization, mastery, Overload and all five assignment positions. Touch slot numbers correspond to the five combat buttons.

Services retain inspect-then-confirm buying, selling and improvements. Native selectors, save-backed command guards and full comparison detail remain shared. Hall forms retain all eight slots, six starters and editable/randomizable world seeds. Native keyboards are supported, with viewport-height updates while editing. Busy hall actions lock duplicate input; service changes are guarded during durable transactions.

Touch styles are scoped to `.touch-mode`. Menus, inventory, services, the atlas, journeys and event choices have scrollable layouts for small/short viewports. Safe-area margins protect the controls. The very narrow touch layout omits the drawn minimap and mini journey tracker to preserve world space; their full panels remain accessible. Desktop HUD artwork and targets remain unchanged. Touch keeps the shared delayed XP rail/reward landing point and uses compact life/mana readouts with separate thumb controls.

The compact HUD uses 40px menu, skill and utility buttons, a 72px attack pad and a 108px movement disc. All bottom controls leave a dedicated clearance band for the existing XP rail, numeric readout and accumulating XP caption; reward flights retain their shared landing coordinates. Interaction/portal sit above the movement disc, and screens at most 700px wide place menus above the thumb controls. Enemy and boss plates stay centered at the top on touch, respecting the safe-area inset instead of moving below the minimap or disappearing because of the desktop HUD bounds. The local touch study includes a staged target plate for layout feedback. Desktop geometry is unchanged.

## State and lifecycle safety

`Game.clearInput`, phase changes, durable transactions, focus loss and visibility changes cancel touch ownership along with existing keyboard/gamepad input. Touch UI hides immediately outside play and during blocking saves. Rotation, viewport changes, map closure and input-mode switches cancel captures. Old pointer moves/releases cannot recreate cleared actions.

Releasing basic attack clears its queued repeat without interrupting a committed swing. Capture cancellation discards queued touch actions. A skill finger owns its own aim while another finger holds attack. Panels, native inputs and camera gestures do not pass their touches through as mouse attacks. Sound unlock is attempted from a direct touch gesture.

The renderer preserves aspect ratio on narrow touch screens without changing the desktop minimum logical width. Character creation, travel and save data are unchanged; no character-progress reset is required.

## Verification and remaining acceptance

`/touch.html` is a local, save-free responsive layout study using the actual renderer, native UI canvas, touch controls and seeded starting area. Its touch presentation stays active during desktop mouse navigation. `?panel=inventory`, `?panel=skills` and `?panel=map` open the real panels with staged data. It never advances gameplay or accesses character saves; mutation actions are intentionally inert. Viewport screenshots of this study establish layout only, not input or mobile performance correctness.

The full code suite passed after PR reconciliation (704 tests at this checkpoint). The touch suite includes twelve tests covering simultaneous analog movement/attack, aim arbitration, quick taps, cancel/capture loss, all ten phase transitions, pointer bounds, tap/pan/pinch discrimination, two-to-one pinch transitions, all twenty targeting recipes, obstructed ground targeting and attack-repeat cancellation. Two inventory integration tests additionally cover equipping and moving through filtered source mappings without losing items or acquisition order. Strict/core type checks and the production build pass. The build retains the existing large-bundle advisory.

No browser gameplay automation or physical-device gameplay test was performed. The user should check thumb reach, comfortable aiming distance, aiming while moving, long item cards, all skill targeting types, keyboard/rotation interruptions, and sustained combat on a phone/tablet. Those ergonomic and hardware-performance observations remain acceptance feedback, not claims established by the code tests.

## Inventory PR reconciliation

Integrated PR #2 (`0e61b26`), including compact sorting/filtering, Equip Best and its weapon-type confirmation, acquisition ordering, and LB/RB section navigation with gamepad A/X activation. Touch uses the same filtered source-index projection: empty destinations are actual empty bag cells, and inert filter placeholders cannot become destinations. Opening the shared sort/Equip Best popups closes any touch item card or pending move; reorganized items invalidate stale cards. Double-tap on touch never invokes desktop double-click equip. The desktop toolbar retains its compact styling; its touch targets are 48px. Switching input modes clears the touch card, and the controller resumes from the last selected inventory section.

The tab click handler matches only `button[data-touch-tab]`. The window's `data-touch-tab` attribute is layout state, not an action; matching it as an ancestor would swallow all inventory clicks, including desktop Sort, Equip Best and Close.
