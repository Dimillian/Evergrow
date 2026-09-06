# Evergrow interface kit

The interface combines dark slate surfaces, fine brass edges, warm text, muted jade actions, and Pixelify Sans lettering paired with clear Barlow numerals. Ornament stays at the edges; content and actions get generous space. World post-processing never touches UI text or controls.

The selected bottom-HUD direction is **The Astral Instrument**: calibrated silver rings, celestial engraving, and separate black-steel skill plates. The shared `silver`, `silverDim`, `steel`, and `steelDeep` tokens supply its control materials. Use these and restrained celestial edge details when expanding the inventory; keep content legible and controls familiar. `hud-frame.ts` draws the metalwork, `hud-layout.ts` owns its shared geometry, and `hud.ts` presents live resource and ability states. The six main wells reserve LMB for basic attack and RMB/1–4 for five assignable skills; Q potion and Space dodge sit in separate utility plates. Preserve this distinction when adding equipped skills, and keep unassigned wells visibly empty and inert.

## Shared foundations

`game/src/ui-theme.ts` owns immutable palette, typography, geometry, and motion tokens. `installUITheme()` exposes these as CSS variables; Canvas HUD, enemy plate, and minimap consume the same palette directly. Load `ui-kit.css` before screen-specific styles so each screen can set its layout without replacing the shared materials.

| Primitive | Use |
| --- | --- |
| `.ui-window` | Panel surface, border, subtle corner details, and shadow |
| `.ui-window-header`, `.ui-window-body`, `.ui-window-footer` | Standard window regions; `__header`, `__body`, and `__footer` aliases are also supported |
| `.ui-button` | A 44px minimum control with hover, pressed, focus, and disabled states |
| `.ui-button--primary`, `--quiet`, `--danger`, `--icon` | Action emphasis and icon-only controls |
| `.ui-kicker`, `.ui-title`, `.ui-body`, `.ui-muted` | Consistent text hierarchy |
| `.ui-well`, `.ui-divider` | Inset content and section separation |
| `.ui-scroll-area` | Contained scrolling with a thin scrollbar using shared colors |
| `.ui-stat`, `.ui-stat-label`, `.ui-stat-value` | Label/value pairs |
| `.ui-badge`, `.ui-status`, `.ui-key` | Compact metadata, feedback, and key bindings |
| `.ui-tooltip` | Shared detail-card surface |
| `.ui-slot` | Shared equipment and bag-slot presentation primitive |

`ui-icons.ts` provides decorative code-defined SVG icons with a common grid and stroke. Give every icon-only button an accessible name. `ui-components.ts` exports the icons, `escapeUI()` for interpolated markup, and dialog focus management. Prefer `textContent` for dynamic labels when no markup is needed.

## Numeric typography

Every number uses locally bundled Barlow Medium, including HUD resources, damage, XP, levels, bindings, prices, stat values, ranks, maps, notifications and mixed labels. `font.ts` registers a numeric-only `Evergrow Numerals` face before Pixelify Sans in the shared font stack. Its Unicode range includes digits and numeric punctuation (signs, decimal/group separators, percentages, ratios and multiplication). Letters retain the retro display font; small interface labels retain system sans lettering. No per-value spans or hand-drawn numerals are needed.

Use `text`/`textWidth` for Canvas readouts and `UI_THEME.typography.font` / `--ui-font` for other surfaces. Both rendering and measurement resolve the same numeric face. DOM numerals use lining, tabular figures. Await `loadGameFont()` before rendering or measuring static previews; it loads both local fonts and reuses registered faces during hot replacement. New interface-font exceptions must also put `Evergrow Numerals` first. Font licenses ship in `public/licenses/`; no remote font requests are made.

## Windows and interaction

Window headers use compact 8px vertical padding, a single 18–20px screen title and 28px decorative emblems. Do not add subtitle/eyebrow text or replace the screen title with a character or location name. Circular emblems use `.ui-header-emblem` with centered SVG geometry and a fixed, nonshrinking square. Keep screen-specific color treatments, but inherit shared header sizing rather than adding large banners. Close buttons retain 44px targets.

The character window uses three independently scrolling columns on desktop. At 1080px and below, equipment and inventory share the first row, with attributes and combat details below; below 740px the sections stack. The shared scrolling body must use content-sized rows and automatic section minimum heights so equipment cannot overlap the stats beneath it.

```html
<section class="ui-window" role="dialog" aria-modal="true" aria-labelledby="panel-title">
  <header class="ui-window-header">
    <h2 class="ui-title" id="panel-title">Inventory</h2>
    <button class="ui-button ui-button--icon" aria-label="Close inventory">…</button>
  </header>
  <div class="ui-window-body">…</div>
  <footer class="ui-window-footer">…</footer>
</section>
```

Use `trapDialogFocus(container, { signal, initialFocus, restoreFocus })` for modal windows. It moves focus inside, wraps Tab among available controls, and removes its listeners when the signal aborts or its returned `dispose()` runs. The game phase coordinator owns Escape, pausing, input clearing, and canvas focus restoration. Nonmodal panels should not trap focus.

Use native `disabled` when an action is unavailable. `aria-disabled` communicates a state but requires the caller to prevent activation. Keep labels understandable without relying on color, and preserve the kit's visible keyboard focus. Reduced motion and forced-color rules are included.

All tooltips share `ui-tooltip-motion.ts`: a 160ms fade/lift entrance and 120ms exit, with only 4px of movement. DOM cards use `.ui-tooltip` and toggle `hidden`; CSS starting styles and discrete display transitions preserve the outgoing card through its exit without timers or detached overlays. Button hints use the same tokens. Canvas tooltips use `TooltipMotion`, retaining outgoing content and requesting frames only while transitioning. Reversing hover preserves current opacity; changing targets while visible keeps the card visible. Reduced motion bypasses both treatments. Older engines without discrete transitions fall back to immediate DOM hiding.

Short control hints use `data-tooltip` (including the transparent HUD controls); they appear on hover or keyboard focus. Use `data-tooltip-placement="below"` near a panel's top edge and `data-tooltip-align="end"` near its right edge. Essential information belongs in a label or accessible name, not only a tooltip.

## Implemented surfaces

The title screen uses `title-screen.ts` and the shared window/action primitives for its eight-slot character hall. Pause and defeat windows share `game-menu.ts`. Both use the shared theme and tooltip motion. The world map uses the same header, controls, POI cards, and footer language. Notifications share the native-resolution materials and typography. The Canvas HUD, enemy plate, and minimap share the palette while preserving their functional health, mana, skill, and map colors.

Use `/hud.html?state=healthy&motion` to inspect animated resource glass and energy currents without gameplay or saves; omit `motion` for the existing frozen states, or add `size=narrow` for compact framing. PNG export captures the displayed frame.

Open the local [interface review](http://127.0.0.1:5173/ui.html) to compare real windows and component states in desktop and 390px previews. It draws a frozen procedural background, never advances gameplay, and uses memory-only map discovery. Example item slots demonstrate the presentation API; real inventory behavior is reviewed in `/character.html?panel=character`. The review route is development-only.

## Character panels and extension

Compose the shared window, wells, slots, stat rows, badges, and tooltip surfaces. Keep equipment and item state outside the presentation helpers. Use the game's existing phase/input boundary when opening a new modal, and register its bounds with UI hit testing. Maintain 44px interactive targets, responsive overflow, native-resolution text, and keyboard access. Expand the shared primitives when a repeated pattern is needed instead of creating another independent panel theme.

## Experience presentation

`hud-experience.ts` supplies the violet XP rail, level label, and exact current/required XP. It consumes `progression.ts` thresholds rather than duplicating the curve. Its feedback state lives with the renderer, resets with a new run, and never modifies player progression. The layout and pointer boundary include the XP rail and labels. Keep XP distinct from the blue mana glass and retain native text rendering.

`inventory-panel.ts` composes the kit into a three-column Astral armory: equipment/doll, an 8×8 bag, and attributes/effective stats. `skill-tree-panel.ts` uses the same materials with a culled Canvas atlas and native controls. Both accept callbacks, never mutate character rules themselves, and expose open/refresh/close/dispose lifecycles. The game owns pausing, Escape and C/I/T switching. Headers/footers remain visible in short viewports; content scrolls within the panel. Item/skill SVGs come from code-defined art and retain native-resolution text.

The atlas's engraved surface uses subdued bronze, jade, and violet for the three disciplines, with warm gold marking allocated paths. `skill-tree-art.ts` owns curves, medallions, label density, and route emphasis; `skill-tree-glyphs.ts` supplies the same stat and active-skill engravings to Canvas and the native inspector. Hit targets consume the painter's shared node radii. Search can dim unrelated content, but the selected route and allocated build stay readable. Keep the reviewed scene's camera/content staging in `character-review.ts`, outside the live panel.

## Weapon and skill presentation

The eleven equipment slots place Head above the doll, five armor slots to the left, and Main hand, Off hand, and jewelry to the right. Item tooltips show handedness, attack family, range, and damage element; shields show both block chance and blocked-damage reduction. Drag eligible one-handed items onto the Off hand slot to dual wield. Detailed stats include the second weapon's damage and cadence when dual wielding. Every hand change still goes through the inventory transaction rules.

`weapon-shapes.ts` supplies shared geometry for the procedural inventory SVGs and held weapons/shields. Bow draw, staff grip, shield guard, and active-hand motion belong to the character rig. The basic-attack HUD well reflects the equipped weapon. `skill-content.ts` owns the seventeen active icons and requirement labels; the atlas inspector and assigned slots show when gear is incompatible. Preserve an assigned skill across gear changes, communicate the unmet requirement, and let combat validate activation. Do not duplicate requirement logic in the UI.

Frozen development reviews at `/character.html?loadout=shield`, `?loadout=dual`, `?loadout=bow`, and `?loadout=staff` use the actual equip rules and doll. Add `&panel=skills` to inspect the corresponding skill availability. These pages do not advance simulation or access saves. [Weapon-school captures](captures/2026-09-05/weapon-schools/README.md) record the default 1280×720 in-app viewport.

## Progression readouts

Enemy plates show source level and rank beside their health readout, preserving the compact shared frame. The eight-pixel garnet channel has slow blood currents and at most eighteen small rising bubbles, clipped to the exact remaining health width. A bright liquid edge separates current health from the delayed damage trail. These native-resolution effects use the renderer clock and freeze with reduced motion; name, rank, health and target selection remain unchanged. Veteran/elite accents use the shared rank colors. Minimap and world-map location labels show area level or Sanctuary; hovering revealed ground can inspect its area level, while fogged terrain reveals no metadata. Character armor reduction is explicitly an estimate against the character's own level; actual combat uses attacker level.

The development-only `/progression.html` study composes shared windows, stat rows, native controls, tier colors and procedural item icons into a scrollable balance reference. All displayed calculations consume runtime modules. Keep probabilities conditional where appropriate, label hypothetical ranks and benchmark gear, and distinguish expected rewards from guaranteed outcomes. This study stays outside gameplay menus and production entrypoints.

The character hall combines the live procedural forest background with the shared equipped portrait, compact slot cards, explicit delete confirmation, level/power metadata, and a required name field for creation. The static `/title.html` preview uses memory-only saves.

HUD navigation and utilities share one shallow glass rail aligned to the six skill plates below, with fine silver edging, subtle dividers and a small suspended compass diamond. Potion and dodge retain distinct utility sections, charges and cooldown feedback; C/I/T/J retain their shared native shortcut targets. Unspent-point badges dock above the rail in amber/violet. `HUD_ART.rail`, `.menu`, `.utility` and `.crest` keep frame geometry and input coverage aligned. The resource orbs sit closer to the skill plates. Ruby and blue energy crescents wrap their inner collars, with tapered moving wisps beneath the end plates; these decorative currents leave open space clickable. `hud-energy.ts` draws the bounded native-resolution glow behind the frame, while `hud-orb.ts` draws eleven staggered hollow bubbles in the health orb; mana contains nine small cyan/lavender motes with soft halos and very short fading wakes, drifting upward at a similar scale to the health bubbles. Both stay clipped to the exact filled resource segment. Reduced motion freezes both effects through the shared HUD clock. Resource readouts share a single frame, and the six skill leaves have aligned upper and lower edges.

Keep interface copy functional and brief. Use direct labels such as Characters, Name, Create character and Continue. Avoid flavor captions, taglines, repeated empty-slot descriptions and redundant status labels; let the artwork establish atmosphere.

In the skill tree, single-click inspects and double-click allocates. The inspector’s Allocate path action and double-click commit the highlighted shortest route, charging only missing nodes. Show the full cost; insufficient points leave the entire build unchanged. Panning must never allocate.

## Notifications

`notification-queue.ts` owns bounded queues, duplicate suppression, exact multi-level reward aggregation, and stable biome-entry detection. `notifications.ts` / `.css` present one compact two-card feed beside the HUD, with no central banner. Every item gets a separate notification with its icon, name, rarity and item level, including common and magic gear. Cards enter and leave with short fades and follow reduced motion. Native number/detail fonts keep earned points readable. Messages never take focus or intercept gameplay input; screen-reader announcements batch same-frame arrivals. The feed retains up to 24 pending notices, with level-ups protected and prioritized during exceptional bursts.

Successful inventory insertion emits a typed item payload; a full bag emits a separate status and leaves the item on the ground. Level events include the destination level and exact point gains, not parsed strings. Exploration calls `onDiscover` only for newly revealed POIs, never while loading/merging saved discoveries. Settlement shops share their town notification. Biome entry requires 1.6 seconds of sustained presence and has a six-second cooldown; it announces entry, not permanent first discovery. Character switches clear the feed. Gold and XP pickups share one accumulating rewards card, refreshed until it expires; equipment remains individually named. `reward-feedback.ts` supplies bounded presentation, while wallet/XP owners alone grant rewards. Existing saves need no migration.

`/notifications.html` stages actual cards over the frozen renderer without gameplay or save access. Add `?view=discovery` or `?view=area` to review discoveries; the default shows a level-up and a rare item, with other item pickups queued individually.


### Ground item labels

`loot-art.ts` uses actual equipment silhouettes resting on the ground, small rarity marks and occasional glints for rare or better gear. Health/mana pickups use distinct stoppered vials instead of glowing diamonds. Names render after CRT at display resolution, with explicit quality and item level in a clean small font. `loot-label-layout.ts` packs individual labels within the viewport, checks every occupied rectangle, and draws leaders back to the items. Extremely crowded views omit labels that cannot fit instead of overlapping; the items remain on the ground. Shared pickup coordinates, capacity, rarity odds and save data are unchanged.

`death-presentation.ts` retains at most 45 enemy remains independently of simulation actors. The actual creature art collapses over 0.65 seconds in the hit direction, sheds material scraps and settles into a corpse, fading over its final three seconds (14-second lifetime; wisps dissipate within five). Reduced motion shows settled remains immediately. Death and loot presentation can be inspected in `/loot.html` without gameplay or save access.


## Shared item presentation and panel ownership

`item-ui.ts` / `.css` supply slot content/rarity styling and item tooltip markup. `item-tooltip.ts` owns mounting, anchor placement and `aria-describedby`, retaining the shared `ui-tooltip` motion. Panels supply an item plus character/level context, optional source bag index, explicit target slot, equipped flag and escaped action/price context. UI never mutates equipment.

`inventory.ts:planEquipmentChange` plans the complete swap, capacity and both-hand displacements. Commits, drop eligibility and `equipment-preview.ts` reuse it. Tooltip item values describe the item itself; the separate On equip section reports effective build changes and all replaced gear. A failed plan shows its reason. `/character.html?comparison=twohand` stages the staff-versus-sword-and-shield case.

`PanelCoordinator` owns application phase, allowed opens/toggles, input clearing, old-panel closure, menu updates, new-panel opening, focus return and save requests. Each view still owns/disposes its own focus trap. Game advances combat only while the coordinator reports playing. New panel phases must be registered with this coordinator; title/defeat entry and pause/resume use the same transition path.

## Town services

`service-panel.ts` uses shared windows, buttons, item slots, `ItemTooltip` and effective-stat comparisons. Role-colored procedural emblems distinguish Blacksmith, Jeweler and Enchanter. Stock/workbench is on the left; clearly separated Equipped and Inventory sections are on the right. Equipped gear appears first and can be improved in place. Empty bags collapse to one quiet message. Narrow screens scroll the content while retaining the paid-action footer. Keyboard focus survives operation changes and successful transactions.

`item-ui.ts` supplies enhanced +N badges and borders for all equipment/bag cells and enhancement details for every item tooltip. +5/+10 receive stronger trim without continuous glitter. Successful service actions pulse the selected icon, with a static reduced-motion treatment. Random rerolls show eligible stats and a concise replacement warning, never a free rolled-outcome preview. See [static captures](captures/2026-09-05/town-services/README.md).

## Portal control

A compact native button below the minimap provides P access, channel progress/cancellation and return-portal location. Its bounds are shared with game UI hit testing; hovering or clicking it cannot fire a weapon. Native world labels use the same concise framing as NPC hints. Arrival fades follow reduced motion, and canceled channels unravel over 250ms. Permanent travel selection is still deferred. See [portal captures](captures/2026-09-05/town-portal/README.md).

## Large Canvas panels

The skill atlas retains its native-resolution surface during tooltip animation and prepares search matches when filter/build state changes. The map coalesces input and builds new detail progressively. See [panel performance](panel-performance.md) for cache lifetimes, invalidation and CPU measurements.
