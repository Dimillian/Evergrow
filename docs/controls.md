# Controls

| Control | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Mouse wheel over the world | Smooth camera zoom in / out |
| Hold left mouse | Repeat the basic weapon attack |
| Right mouse / 1–4 | Use assigned skills; empty slots do nothing |
| E / click a nearby NPC, town anchor or event object | Open services, use anchors or interact with a POI |
| P / portal control below minimap | Cast town portal outside sanctuary; locate your return portal while in sanctuary |
| C / I | Character, equipment, inventory, and attributes |
| T | Skill tree and active skill assignments |
| J / mini log below minimap | Open or close Journeys; Track explicitly pins an activity |
| Space | Dodge, using one of two regenerating charges |
| Q | Dual potion: restores life and mana; charges return through kills |
| Escape | Close a panel, pause, or resume |
| M | Open or close the world map |
| Tab while playing / click minimap | Open the world map |
| Map: drag / scroll / + and − | Pan / zoom |
| N | Toggle synthesized sound |
| F3 | Frame-rate and coordinate overlay |

A town portal channels for three seconds. Movement, damage, attacking, skills, dodge, Escape, P again or leaving the gameplay input context cancels it. It costs nothing and refills nothing. E/click the town endpoint returns once to your departure point.

Unlock skills in the tree, then assign them to RMB or 1–4. Empty slots do nothing. Character, inventory, skill tree, Journeys, map and town-service panels pause combat.

In shops, select an item and Buy/Sell, or Shift-click for a direct trade. The Equipped section at the blacksmith or enchanter upgrades worn gear in place. Escape closes the service.

In the inventory, hover/focus inspects, double-click equips a bag item, Enter/Space or Shift-click equips/unequips, and drag/drop moves or equips items. The first icon beside Inventory opens Sort & filter; the second runs Equip Best by item power. A different best weapon type asks: Equip anyway, Keep current weapon only (upgrade other gear), or Cancel. The sort/filter popover organizes the whole bag by rarity, type or recent pickup and combines type and rarity filters. Escape or B closes a popup before the inventory. In the tree, single-click inspects; double-click or Allocate path spends points on the complete highlighted route if affordable. Wheel zooms and dragging pans the atlas.

## Gamepad

Inventory sort priorities are Rarity → Type → Recent pickup, Type → Rarity → Recent pickup, and Recent pickup → Rarity → Type. Select multiple type or rarity filters by toggling their buttons; All clears that group. Both groups combine, and the complete bag grid stays visible even when no items match.

Connect a controller, focus the local game, press a button so the browser exposes it, then release the buttons and center both sticks. Controllers exposed with the browser's [standard Gamepad mapping](https://www.w3.org/TR/gamepad/#remapping) are supported; unmapped devices are ignored. Labels use Xbox positions: A/B/X/Y correspond to the bottom/right/left/top face buttons (Cross/Circle/Square/Triangle on PlayStation).

| Control | Action |
| --- | --- |
| Left stick | Analog movement; also faces movement direction when the right stick is centered |
| Right stick | Aim independently; stick tilt sets the ground-target distance from 60 to 280 world units |
| RT / R2 (hold) | Repeat basic attack |
| LT / L2 | Assigned RMB skill; holding repeats |
| RB / R1, X / Square, Y / Triangle, right-stick click | Assigned skills 1–4, once per press |
| B / Circle | Dodge |
| LB / L1 | Dual potion |
| A / Cross | Interact with nearby NPC, portal anchor or POI |
| D-pad left / right | Character and inventory |
| D-pad up | Skill atlas |
| D-pad down | Town portal |
| View / Share | Open or close the world map |
| Menu / Options | Pause/resume or close a panel; cancel an active portal channel |

The HUD's small bindings follow the active input device. Stick deadzones suppress drift and preserve analog movement speed. Releasing both sticks retains the last facing; ranged attacks use the existing cursor-local aim assistance without projectile homing. Skills still require unlocking, assignment and compatible equipment.

In menus, use D-pad/left stick to navigate and A to activate. LB/RB move through focusable controls. B closes gameplay panels/resumes pause and cancels the character hall's delete confirmation. In the character/inventory window, LB/RB instead switches Equipment, Inventory and Attributes section tabs with remembered focus; D-pad/left stick moves spatially between cells and buttons, A/X equips or unequips, and A operates Equip Best, sorting, filters and attribute buttons. The active section and selected control stay highlighted, and navigation scrolls the selected control into view. In shops, select an item with A, then focus and activate the ordinary purchase/sale/upgrade button. On the focused map or skill-atlas canvas, D-pad pans the map or inspects connected stars; LT/RT zoom out/in. Select fields change with D-pad; A on the atlas centers the inspected star, and the ordinary Allocate/Assign controls remain reachable with LB/RB.

Character names and search text still use a keyboard. Inventory drag/drop and gameplay camera zoom remain mouse controls. This is an initial fixed controller layout; remapping, rumble and an on-screen keyboard are not implemented. Hardware compatibility and combat feel await player testing.

Pause, panels, focus loss and travel clear controller actions and require neutral sticks/released buttons before accepting input again. Disconnecting the active controller pauses combat. Keyboard/mouse input takes over when used; no character save format or progress reset is involved.

POI openings take one second (beacons: two). Movement, combat, damage or leaving play cancels the channel. Choice windows pause combat; selecting a choice resumes play before the channel.
