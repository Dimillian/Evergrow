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

Window headers use compact 8px vertical padding, a single 18–20px screen title and 28px decorative emblems. Do not add subtitle/eyebrow text or replace the screen title with a character or location name. Circular emblems use `.ui-header-emblem` with centered SVG geometry and a fixed, nonshrinking square. Keep screen-specific color treatments, but inherit shared header sizing rather than adding large banners. Desktop close buttons retain 44px targets. Touch panels use the user-requested compact 32px header and toolbar buttons, 16px titles and 20px emblems with 4px vertical padding; see `touch-ui.css`. In landscape, character section tabs share the title row. Header labels are not text-selectable on touch; inputs keep native editing.

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

The title screen uses `title-screen.ts` and the shared window/action primitives for its eight-slot character hall. Pause and defeat enter through `game-menu.ts`. The compact pause window uses `pause-menu-markup.ts` / `pause-menu.css`, with Resume, Options, Save game and Save & exit beside a location/run summary. `pause-menu.ts` owns only nested options and action feedback: sound uses existing saved preferences, zoom uses the bounded camera, and fullscreen appears only where supported. Its controls disclosure stays inside the pause menu. Escape, controller B/Menu and Android Back return from Options first, then resume. Manual save and exit await the existing durable save/flush path, block repeat actions while pending, and preserve the paused session on failure. Exit returns to the character hall; it does not try to close the browser. Both use the shared theme and tooltip motion. The world map uses the same header, controls, POI cards, and footer language. Notifications share the native-resolution materials and typography. The Canvas HUD, enemy plate, and minimap share the palette while preserving their functional health, mana, skill, and map colors.

Use `/hud.html?state=healthy&motion` to inspect animated resource glass and energy currents without gameplay or saves; omit `motion` for the existing frozen states, or add `size=narrow` for compact framing. PNG export captures the displayed frame.

Open the local [interface review](http://127.0.0.1:5173/ui.html) to compare real windows and component states in desktop and 390px previews. It draws a frozen procedural background, never advances gameplay, and uses memory-only map discovery. Example item slots demonstrate the presentation API; real inventory behavior is reviewed in `/character.html?panel=character`. The review route is development-only.

## Character panels and extension

Sort prioritizes Rarity → Type → Recent, Type → Rarity → Recent, or Recent → Rarity → Type. Filter buttons are independent `aria-pressed` toggles, with OR within a group and AND between type and rarity. Empty selections mean All. The bag always retains its complete 8×8 styling: the view maps matching items first, then actual empty sources, then inert filler cells for excluded items. Each actionable cell keeps its actual bag index for equip, drag/drop and tooltip comparison; fillers never become inventory destinations. Filtering is presentation-only.

The character window retains its three columns without a separate section-navigation row. Two quiet 17px icons sit immediately after the Inventory title: Sort & filter and Equip Best. Their desktop targets are 32px, expanding to 44px for coarse pointers. Sort/filter choices live in an anchored compact dialog; an active filter leaves a small dot on its icon. Equip Best shows a three-choice warning when the best eligible weapon changes family or handedness. Both dialogs make the parent content inert, contain focus, restore it to the opener, and dismiss on outside click, Escape or controller B. LB/RB still selects sections and restores their last visible, enabled focus targets. Controller focus uses an explicit high-contrast outline independent of browser `:focus-visible`; the active section receives a silver top edge. D-pad/stick follows control geometry within the active section or popup. Mutations still go through character commands.

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

`notification-queue.ts` owns bounded queues, duplicate suppression and stable biome-entry detection. `notifications.ts` / `.css` present one compact two-card feed beside the HUD, with no central banner. Every item gets a separate notification with its icon, name, rarity and item level, including common and magic gear. Cards enter and leave with short fades and follow reduced motion. Native number/detail fonts keep earned points readable. Messages never take focus or intercept gameplay input; screen-reader announcements batch same-frame arrivals. The feed retains up to 24 pending notices. Reward accumulation and level celebrations live in the dedicated HUD presentation.

Successful inventory insertion emits a typed item payload; a full bag emits a separate status and leaves the item on the ground. Level events include the destination level and exact point gains, not parsed strings. Exploration calls `onDiscover` only for newly revealed POIs, never while loading/merging saved discoveries. Settlement shops share their town notification. Biome entry requires 1.6 seconds of sustained presence and has a six-second cooldown; it announces entry, not permanent first discovery. Character switches clear the feed. Gold and XP pickups use dedicated HUD flights and delayed accumulating counters; level-ups have a world celebration and an above-character announcement. These no longer create feed cards; equipment remains individually named. See [reward presentation](reward-presentation.md). `reward-feedback.ts` supplies bounded presentation, while wallet/XP owners alone grant rewards. Existing saves need no migration.

`/notifications.html` stages actual cards over the frozen renderer without gameplay or save access. Add `?view=discovery` or `?view=area` to review discoveries; the default shows named item pickups, with additional items queued individually.


### Ground item labels

Mouse hover on a label or its item silhouette opens the shared full item tooltip, including equipped-item comparisons. `ground-loot-hover.ts` gates inspection while living enemies are visible or within 420 world units of the player/item, while hostile projectiles are nearby, or while the player is attacking, casting, dodging or taking a hit. `ground-loot-tooltip.ts` anchors the shared cards to the moving canvas labels without remounting them each frame. Leaving hover, entering a panel, switching to touch/controller, collecting the item or a new threat closes inspection. This presentation never pauses combat or changes pickup rules. `/loot.html` supports passive hover inspection without gameplay or save access.

`loot-art.ts` uses actual equipment silhouettes resting on the ground, small rarity marks and occasional glints for rare or better gear. Health/mana pickups use distinct stoppered vials instead of glowing diamonds. Ground labels are compact single-line ink pills, rendered after CRT at display resolution. Common/magic gear uses its short base name (e.g. Signet rather than Gloaming Signet of Embers); rare and better gear retains its unique name. Enhancement remains visible, a tiny diamond/name color carries rarity, and item level sits quietly at the right. Text is measured and ellipsized within a 210-unit width cap. Full generated names remain in item tooltips and pickup notifications. `loot-label-layout.ts` packs individual labels within the viewport, checks every occupied rectangle, and draws faint leaders only for labels displaced away from their items. Extremely crowded views omit labels that cannot fit instead of overlapping; the items remain on the ground. Shared pickup coordinates, capacity, rarity odds and save data are unchanged.

`death-presentation.ts` retains at most 45 enemy remains independently of simulation actors. The actual creature art collapses over 0.65 seconds in the hit direction, sheds material scraps and settles into a corpse, fading over its final three seconds (14-second lifetime; wisps dissipate within five). Reduced motion shows settled remains immediately. Death and loot presentation can be inspected in `/loot.html` without gameplay or save access.


## Shared item presentation and panel ownership

`item-ui.ts` / `.css` supply slot content/rarity styling and item tooltip markup. Item cells show the icon, rarity, item level and enhancement; handedness belongs in the tooltip, without a 1H/2H icon overlay. `item-tooltip.ts` owns mounting, viewport-clamped card groups and `aria-describedby`, retaining the shared `ui-tooltip` motion. Shared tooltips use smoked glass with 24px backdrop blur, faint borders, gentle corners and compact spacing; unsupported blur and reduced-transparency preferences use opaque ink. The comparison host stays transparent and unframed regardless of CSS import order; rarity is carried by a small badge, item name and softly fading corner glow. Hovering eligible bag or vendor gear adds adjacent equipped-item cards for the exact displacement plan, including both hands. Empty slots and failed equip plans do not invent comparisons. The primary card retains effective On equip changes; secondary cards show item values with their equipment slot. Narrow layouts stack the cards. Touch inspection continues to use its existing single-item sheet. Panels supply an item plus character/level context, optional source bag index, explicit target slot, equipped flag and escaped action/price context. UI never mutates equipment.

`inventory.ts:planEquipmentChange` plans the complete swap, capacity and both-hand displacements. Commits, drop eligibility and `equipment-preview.ts` reuse it. Tooltip item values describe the item itself; the separate On equip section reports effective build changes and all replaced gear. A failed plan shows its reason. `/character.html?comparison=twohand` stages the staff-versus-sword-and-shield case.

`PanelCoordinator` owns application phase, allowed opens/toggles, input clearing, old-panel closure, menu updates, new-panel opening, focus return and save requests. Each view still owns/disposes its own focus trap. Game advances combat only while the coordinator reports playing. New panel phases must be registered with this coordinator; title/defeat entry and pause/resume use the same transition path.

## Town services

`service-panel.ts` uses shared windows, buttons, item slots, `ItemTooltip` and effective-stat comparisons. Role-colored procedural emblems distinguish Blacksmith, Jeweler and Enchanter. Stock/workbench is on the left; clearly separated Equipped and Inventory sections are on the right. Equipped gear appears first and can be improved in place. Empty bags collapse to one quiet message. Narrow screens scroll the content while retaining the paid-action footer. Keyboard focus survives operation changes and successful transactions.

`item-ui.ts` supplies enhanced +N badges and borders for all equipment/bag cells and enhancement details for every item tooltip. +5/+10 receive stronger trim without continuous glitter. Successful service actions pulse the selected icon, with a static reduced-motion treatment. Random rerolls show eligible stats and a concise replacement warning, never a free rolled-outcome preview. See [static captures](captures/2026-09-05/town-services/README.md).

## Portal control

A compact native button below the minimap provides P access, channel progress/cancellation and return-portal location. Its bounds are shared with game UI hit testing; hovering or clicking it cannot fire a weapon. Native world labels use the same concise framing as NPC hints. Arrival fades follow reduced motion, and canceled channels unravel over 250ms. Permanent travel selection is still deferred. See [portal captures](captures/2026-09-05/town-portal/README.md).

## Large Canvas panels

The skill atlas retains its native-resolution surface during tooltip animation and prepares search matches when filter/build state changes. The map coalesces input and builds new detail progressively. See [panel performance](panel-performance.md) for cache lifetimes, invalidation and CPU measurements.

## Journeys

`journey-panel.ts` uses shared window, button, badge, scroll, focus-trap and tooltip primitives. A compact clickable list beneath the minimap opens the same registered Journeys panel as J. Inspection and explicit tracking are separate. The HUD list joins `ui-hit-test.ts` so hovering it cannot aim at or attack actors behind it. See [Journeys](journeys.md).

The minimap, portal and short log form one aligned sidebar. `map-view.ts` shares their geometry; `hud-sidebar.css` supplies the attached controls' slate surface and quiet keycaps. The portal occupies a full-width 25-unit row immediately below the map, with a code-defined arch icon, remaining cast time and a thin progress line. The log continues beneath it with an inset divider, restrained level labels and one gold accent for the tracked activity. Collapse and portal behavior remain unchanged; all control rectangles still block combat input.

Journeys now separates Recommended and Nearby, with a fixed manually tracked lead. Lists show the same activity name everywhere and tint their level number for difficulty; matching levels have no repeated status text. The journal detail adds Easier/Harder only when relevant, and shows metres/kilometres instead of exposing world units. Completion shares the native level-up announcement frame; its bounded queue waits while level-up is visible, so both remain legible. No duplicate completion feed card is emitted.

## Touch presentation · 2026-09-06

`touch-ui.css` scopes touch layouts to `.touch-mode`; `.touch-only` controls stay hidden in desktop and static reviews. `touch-hud.ts` supplies 48px action/menu targets independently of render scale. Inventory adds touch-only Bag/Equipment/Stats tabs and a scrollable item action sheet using `itemTooltipMarkup`; commands and desktop shortcuts remain shared. Maps/atlas add touch-only gesture adapters without replacing mouse handlers. Native editing preserves touch mode, safe-area margins and visual viewport sizing. See [Touch controls](touch-controls.md).

## Android companion

The Thor lower screen shares the theme, local fonts, item geometry and tooltip markup. Its compact equipment strip and 8×8 pack are sized for the lower display; inspection has a persistent Back control and controller B dismissal. WebView versions without `color-mix` receive opaque shared item-tooltip, rarity-badge and equipment-cell surfaces through `item-ui.css`. Never depend on an unsupported gradient as the only tooltip background. See [Android/Thor](android-thor.md).

## Compact character hall

The hall uses one eight-slot roster beside a creation/continue pane with short labels, shared controls and quiet transfer actions. Sites adds Cloud / Local tabs and sync status; Android hides those tabs and browser transfer controls. Starting gear uses six native radio cards with procedural equipment icons. Portrait decoration gives way to controls on small/short displays; no essential action sits below a decorative hero. Names truncate in slot cards but remain readable in the selected pane. Sign-in links join controller navigation. The real memory-only review supports `?cloud&full`, `?cloud&signedout`, `?cloud&conflict` and `?empty`.

## Handheld controller panels

The character window shows a quiet LB/RB section rail only during controller use. At widths up to 1080px it displays the selected section at full width, with preserved section focus. Pointer/touch use returns to the existing responsive layout.

The skill atlas separates its scrollable node inspector from a pinned five-slot loadout. Small inline node emblems, left-aligned effects, compact cost facts and optional specialization-path disclosure reduce vertical travel. Controller LB/RB chooses Tree, Node or Skills; X reaches assignment directly. Shared menu selects reserve left/right for values and up/down for focus, avoiding a controller focus trap. All actions still go through validated character commands.

Camera wheel zoom is bounded to 0.8–1.8× with the existing smooth response. The zoom-out limit shows 18.75% less world width/height than the former 0.65× limit. Combat target selection uses the last displayed viewport; spawning retains its wider predictive exclusion envelope.

### Enemy debuff rail

The target/boss plate includes one compact row beneath its health readout for active Burn, Chill and Stagger. `enemy-debuffs.ts` projects actual burn/slow/control timers; `enemy-debuff-art.ts` draws distinct flame, snowflake and interruption glyphs with shared interface typography and numeric countdowns. Stagger covers melee reactions, skill stuns and lightning interrupts; a stale `interrupted` flag is not an active effect. Dead targets and expired effects produce no badge. Warden control immunity remains separate from debuffs.

The row is centered, uses quiet opaque surfaces, and switches to icons plus duration when full labels cannot fit. Its 24 extra logical pixels are included in layout bounds; exceptionally short surfaces retain the health/name plate even when the row cannot fit. Boss resistance text follows the full plate bounds. The save-free `/hud.html` study includes examples with two and three debuffs; gameplay timers and saves are unchanged.

Tooltip surfaces are owned by `tooltip-material.css`, shared by item cards, generic tooltips and shortcut hints. Each comparison card owns its own blur and fading rarity corner glow; the group owns only layout and motion. The material uses no `color-mix`, preserves an opaque fallback, and does not animate blur or install persistent compositor hints.

The skill atlas now mounts one DOM tooltip over its cached Canvas, using that same material and a domain-colored corner glow. Live bonuses, gear ranks, costs and route requirements still come from the current character; the shared visibility envelope retains outgoing details through its fade without rebuilding the atlas. World-map tips use the same corner glow instead of a stripe, and dungeon-map tips inherit the shared surface rather than painting an opaque override. Tooltip geometry remains clamped to its viewport and does not capture input.

Skill hover cards separate node identity, the owning skill, effects, cast facts and allocation status. The sidebar uses the same `skill-node-presentation.ts` ownership/role projection, including specialization/passive/mastery nodes. Skill-specific passive leaves state that their bonuses apply across all variants. Hover emphasizes a skill's leaf connections; only focused specialization names appear at close zoom, avoiding repeated school labels.


## Main-menu changelog

What's new opens a read-only release panel from the character hall. A compact version/date/time history sits beside New/Tweaks/Fixes notes; narrow layouts turn the history into a horizontal strip. Release headings use version numbers only; bullets stay brief. Notes use the shared game/numeral fonts, restrained category colors and the existing window shell. Focus is trapped in the reader and returns to the opener; Escape, controller B and native Back dismiss it first. LB/RB changes releases and the right stick scrolls notes. The same bundled `CHANGELOG.md` powers the repository and panel, with no network or save access. See [release workflow](releases.md).
