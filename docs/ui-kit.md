# Evergrow interface kit

The interface combines dark slate surfaces, fine brass edges, warm text, muted jade actions, and Pixelify Sans lettering paired with clear Barlow numerals. Ornament stays at the edges; content and actions get generous space. World post-processing never touches UI text or controls.

Frosted-material refresh (September 10): `ui-glass.css` owns the shared square-edged window surface. Every panel uses the approved inventory material: the same cool edge highlights, translucency, blur and saturation. The scene behind each window supplies its changing tint; there are no panel-specific color washes. Service icons/actions and item rarity retain their semantic colors. Home libraries reuse their outer frame instead of stacking glass windows. Opaque map canvases remain readable within translucent chrome. Blur is applied to a noninteractive background pseudo-element so viewport-positioned tooltips retain their coordinate system. Full-screen modal scrims only dim the world; they do not add another blur pass. The pause menu and its system windows reuse this surface, with translucent sidebar/footer wells and restrained silver selection highlights rather than opaque green washes.

`tooltip-material.css` shares frosted surfaces across explanations and item cards. Item cards retain their rarity colors, with stronger corner light and a single short sheen on the candidate card. Equipped comparison cards stay quieter. Reduced motion removes the sheen; reduced transparency and unsupported blur use opaque material, and forced colors remove decoration. `inventory-glass.css` only adjusts inventory wells to reveal the shared material.

Fantasy-material refinement (v0.3.8): the shared frosted surfaces now use silver-blue frosted glass, tarnished silver bevels, small procedural silver corner fittings and a faint etched grain. The world still supplies the background tint; no panel-specific hues were restored. Inventory uses a shield emblem and recessed neutral wells. Item inspection concentrates rarity light in the frame, adds a tiny gemstone divider, and replaces the broad sheen with a single inset-engraving glint. The original cool palette is restored at the user’s request, retaining the medieval framing and layout refinements. A second refinement reduces frame fittings to 22px (16px on narrow screens), reserves header clearance, quiets the etched grain, and carries the metal bevels through square controls. Inventory uses an arched portrait niche, ruled section headings and recessed pack cells; tooltip stat rows have subtle engraved separators. Text and numerical fonts, interactions and save behavior stay unchanged. Reduced motion removes the glint; transparency and forced-color fallbacks remain available.

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

Item artwork uses per-render SVG resource IDs for gradients and clipping. Never derive these IDs only from item identity: a hidden inventory and a visible vendor can render the same item simultaneously, and SVG IDs are document-wide. Gradient fills retain a solid material-color fallback.

`ui-icons.ts` provides decorative code-defined SVG icons with a common grid and stroke. Give every icon-only button an accessible name. `ui-components.ts` exports the icons, `escapeUI()` for interpolated markup, and dialog focus management. Prefer `textContent` for dynamic labels when no markup is needed.

## Numeric typography

Every number uses locally bundled Barlow Medium, including HUD resources, damage, XP, levels, bindings, prices, stat values, ranks, maps, notifications and mixed labels. `font.ts` registers a numeric-only `Evergrow Numerals` face before Pixelify Sans in the shared font stack. Its Unicode range includes digits and numeric punctuation (signs, decimal/group separators, percentages, ratios and multiplication). Letters retain the retro display font; small interface labels retain system sans lettering. No per-value spans or hand-drawn numerals are needed.

Use `text`/`textWidth` for Canvas readouts and `UI_THEME.typography.font` / `--ui-font` for other surfaces. Both rendering and measurement resolve the same numeric face. DOM numerals use lining, tabular figures. Await `loadGameFont()` before rendering or measuring static previews; it loads both local fonts and reuses registered faces during hot replacement. New interface-font exceptions must also put `Evergrow Numerals` first. Font licenses ship in `public/licenses/`; no remote font requests are made.

## Windows and interaction

Window headers use compact 8px vertical padding, a single 18–20px screen title and 28px decorative emblems. Do not add subtitle/eyebrow text or replace the screen title with a character or location name. Circular emblems use `.ui-header-emblem` with centered SVG geometry and a fixed, nonshrinking square. Keep screen-specific color treatments, but inherit shared header sizing rather than adding large banners. Desktop close buttons retain 44px targets. Touch panels use the user-requested compact 32px header and toolbar buttons, 16px titles and 20px emblems with 4px vertical padding; see `touch-ui.css`. In landscape, character section tabs share the title row. Header labels are not text-selectable on touch; inputs keep native editing.

Character and Inventory are separate windows. Character uses a compact 720px sheet with identity, XP, attribute allocation and Offense / Defense / Resources tabs; the body scrolls beneath its fixed header and footer. Inventory uses a 980px two-column equipment/pack layout; at 820px and below the sections stack, with touch/controller section navigation on handhelds. Headers show the title and close icon without shortcut letters beside the close button. Enabled attribute + icons and their button borders gently pulse together while stat points remain; the Skill atlas button carries a small badge with the exact unspent skill-point count, hidden at zero. Reduced motion leaves the + icons and borders steadily highlighted. These cues add no extra rows to the sheet.

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

The title screen uses `title-screen.ts` and the shared window/action primitives for its eight-slot character hall. Pause and defeat enter through `game-menu.ts`. The compact pause window uses `pause-menu-markup.ts` / `pause-menu.css`. Its panel stays vertically centered at its original preferred height, with the EVERGROW wordmark positioned above it outside the layout. Short viewports constrain the panel only enough to keep the wordmark on screen. The header pairs a pause glyph with Paused and explicitly labels the current Location. Character, Adventure and System tabs organize destinations. The bottom action row puts Character hall with a left-pointing door on the left and the primary Resume action with its Esc shortcut on the right. A small text-only Save button sits beside the save status in the footer without increasing the status row height, separate from navigation and the run summary. Opening the pause menu still autosaves, and returning to the character hall still saves before leaving. `pause-menu.ts` owns category navigation, nested system windows and action feedback: sound uses existing saved preferences, zoom uses the bounded camera, and fullscreen appears only where supported. Its controls disclosure stays inside the pause menu. Escape, controller B/Menu and Android Back return from Options first, then resume. Manual save and exit await the existing durable save/flush path, block repeat actions while pending, and preserve the paused session on failure. Exit returns to the character hall; it does not try to close the browser. Both use the shared theme and tooltip motion. The world map uses the same header, controls, POI cards, and footer language. Notifications share the native-resolution materials and typography. The Canvas HUD, enemy plate, and minimap share the palette while preserving their functional health, mana, skill, and map colors.

Use `/hud.html?state=healthy&motion` to inspect animated resource glass and energy currents without gameplay or saves; omit `motion` for the existing frozen states, or add `size=narrow` for compact framing. PNG export captures the displayed frame.

Open the local [interface review](http://127.0.0.1:5173/ui.html) to compare real windows and component states in desktop and 390px previews. It draws a frozen procedural background, never advances gameplay, and uses memory-only map discovery. Example item slots demonstrate the presentation API; real inventory behavior is reviewed in `/character.html?panel=character`. The review route is development-only.

## Character panels and extension

The Character body fades its bottom 32px while more content remains below. The fade clears at the end or when content fits. Scroll and resize/content measurements update the cue; it never covers pointer input or floating tooltips. Forced-color mode retains an unmasked surface.

The inventory filter uses the shared silver-and-glass window material, compact icon tiles for item types and runtime rarity-colored gems. Pressed borders and checkmarks identify selected choices without relying on color. The groups scroll within the compact dialog on short screens; Clear filters and Done remain in its footer. Every choice retains a 44px minimum target.

Sort prioritizes Rarity → Type → Recent, Type → Rarity → Recent, or Recent → Rarity → Type. Filter buttons are independent `aria-pressed` toggles, with OR within a group and AND between type and rarity. Empty selections mean All. The bag always retains its complete 8×8 styling: the view maps matching items first, then actual empty sources, then inert filler cells for excluded items. Each actionable cell keeps its actual bag index for equip, drag/drop and tooltip comparison; fillers never become inventory destinations. Filtering is presentation-only.

Inventory retains its two columns without a separate desktop section-navigation row. Two quiet 17px icons sit immediately after the Inventory title: Sort & filter and Equip Best. Their desktop targets are 32px, expanding to 44px for coarse pointers. Sort/filter choices live in an anchored compact dialog. Lock mode and active filters use a persistent warm-gold icon, filled metal background, outlined frame and corner diamond; the filter also lights while its dialog is open. Equip Best shows a three-choice warning when the best eligible weapon changes family or handedness. Both dialogs make the parent content inert, contain focus, restore it to the opener, and dismiss on outside click, Escape or controller B. LB/RB still selects sections and restores their last visible, enabled focus targets. Controller focus uses an explicit high-contrast outline independent of browser `:focus-visible`; the active section receives a silver top edge. D-pad/stick follows control geometry within the active section or popup. Mutations still go through character commands.

Compose the shared window, wells, slots, stat rows, badges, and tooltip surfaces. Keep equipment and item state outside the presentation helpers. Use the game's existing phase/input boundary when opening a new modal, and register its bounds with UI hit testing. Maintain 44px interactive targets, responsive overflow, native-resolution text, and keyboard access. Expand the shared primitives when a repeated pattern is needed instead of creating another independent panel theme.

## Experience presentation

`hud-experience.ts` supplies the violet XP rail, level label, and exact current/required XP. It consumes `progression.ts` thresholds rather than duplicating the curve. Its feedback state lives with the renderer, resets with a new run, and never modifies player progression. The layout and pointer boundary include the XP rail and labels. Keep XP distinct from the blue mana glass and retain native text rendering.

`inventory-panel.ts` owns equipment/doll, the 12×6 spatial pack and four charm rows. `character-panel.ts` owns identity, XP, attributes and effective-stat tabs, using the same frame and shared stat calculations. `skill-tree-panel.ts` uses the same materials with a culled Canvas atlas and native controls. Both accept callbacks, never mutate character rules themselves, and expose open/refresh/close/dispose lifecycles. The game owns pausing, Escape and P/I/T switching. Headers/footers remain visible in short viewports; content scrolls within the panel. Item/skill SVGs come from code-defined art and retain native-resolution text.

The atlas's engraved surface uses subdued bronze, jade, and violet for the three disciplines, with warm gold marking allocated paths. `skill-tree-art.ts` owns curves, medallions, label density, and route emphasis; `skill-tree-glyphs.ts` supplies the same stat and active-skill engravings to Canvas and the native inspector. Hit targets consume the painter's shared node radii. Search can dim unrelated content, but the selected route and allocated build stay readable. Keep the reviewed scene's camera/content staging in `character-review.ts`, outside the live panel.

## Weapon and skill presentation

The eleven equipment slots place Head above the doll, five armor slots to the left, and Main hand, Off hand, and jewelry to the right. Item tooltips show handedness, attack family, range, and damage element; shields show both block chance and blocked-damage reduction. Drag eligible one-handed items onto the Off hand slot to dual wield. Detailed stats include the second weapon's damage and cadence when dual wielding. Every hand change still goes through the inventory transaction rules.

`weapon-shapes.ts` supplies shared geometry for the procedural inventory SVGs and held weapons/shields. Bow draw, staff grip, shield guard, and active-hand motion belong to the character rig. The basic-attack HUD well reflects the equipped weapon. `skill-content.ts` owns the seventeen active icons and requirement labels; the atlas inspector and assigned slots show when gear is incompatible. Preserve an assigned skill across gear changes, communicate the unmet requirement, and let combat validate activation. Do not duplicate requirement logic in the UI.

Frozen development reviews at `/character.html?loadout=shield`, `?loadout=dual`, `?loadout=bow`, and `?loadout=staff` use the actual equip rules and doll. Add `&panel=skills` to inspect the corresponding skill availability. These pages do not advance simulation or access saves. [Weapon-school captures](captures/2026-09-05/weapon-schools/README.md) record the default 1280×720 in-app viewport.

## Progression readouts

Enemy plates show source level and rank beside their health readout, preserving the compact shared frame. The eight-pixel garnet channel has slow blood currents and at most eighteen small rising bubbles, clipped to the exact remaining health width. A bright liquid edge separates current health from the delayed damage trail. These native-resolution effects use the renderer clock and freeze with reduced motion; name, rank, health and target selection remain unchanged. Veteran/elite accents use the shared rank colors. Minimap and world-map location labels show area level or Sanctuary; hovering revealed ground can inspect its area level, while fogged terrain reveals no metadata. Character armor reduction is explicitly an estimate against the character's own level; actual combat uses attacker level.

The development-only `/progression.html` study composes shared windows, stat rows, native controls, tier colors and procedural item icons into a scrollable balance reference. All displayed calculations consume runtime modules. Keep probabilities conditional where appropriate, label hypothetical ranks and benchmark gear, and distinguish expected rewards from guaranteed outcomes. This study stays outside gameplay menus and production entrypoints.

The character hall combines the live procedural forest background with the shared equipped portrait, compact slot cards, explicit delete confirmation, level/power metadata, and a required name field for creation. The static `/title.html` preview uses memory-only saves.

HUD navigation and utilities share one shallow glass rail aligned to the six skill plates below, with fine silver edging, subtle dividers and a small suspended compass diamond. Potion and dodge retain distinct utility sections, charges and cooldown feedback; P/I/T/J retain their shared native shortcut targets. Unspent-point badges dock above the rail in amber/violet. `HUD_ART.rail`, `.menu`, `.utility` and `.crest` keep frame geometry and input coverage aligned. The resource orbs sit closer to the skill plates. Ruby and blue energy crescents wrap their inner collars, with tapered moving wisps beneath the end plates; these decorative currents leave open space clickable. `hud-energy.ts` draws the bounded native-resolution glow behind the frame, while `hud-orb.ts` draws eleven staggered hollow bubbles in the health orb; mana contains nine small cyan/lavender motes with soft halos and very short fading wakes, drifting upward at a similar scale to the health bubbles. Both stay clipped to the exact filled resource segment. Reduced motion freezes both effects through the shared HUD clock. Resource readouts share a single frame, and the six skill leaves have aligned upper and lower edges.

Keep interface copy functional and brief. Use direct labels such as Characters, Name, Create character and Continue. Avoid flavor captions, taglines, repeated empty-slot descriptions and redundant status labels; let the artwork establish atmosphere.

In the skill tree, single-click inspects and double-click allocates. The inspector’s Allocate path action and double-click commit the highlighted shortest route, charging only missing nodes. Show the full cost; insufficient points leave the entire build unchanged. Panning must never allocate.

## Notifications

`notification-queue.ts` owns bounded queues, duplicate suppression and stable biome-entry detection. `notifications.ts` / `.css` present one compact two-card feed beside the HUD, with no central banner. Every item gets a separate notification with its icon, name, rarity and item level, including common and magic gear. Cards enter and leave with short fades and follow reduced motion. Native number/detail fonts keep earned points readable. Messages never take focus or intercept gameplay input; screen-reader announcements batch same-frame arrivals. The feed retains up to 24 pending notices. Reward accumulation and level celebrations live in the dedicated HUD presentation.

Successful inventory insertion emits a typed item payload; a full bag emits a separate status and leaves the item on the ground. Level events include the destination level and exact point gains, not parsed strings. Exploration calls `onDiscover` only for newly revealed POIs, never while loading/merging saved discoveries. Settlement shops share their town notification. Biome entry requires 1.6 seconds of sustained presence and has a six-second cooldown; it announces entry, not permanent first discovery. Character switches clear the feed. Gold and XP pickups use dedicated HUD flights and delayed accumulating counters; level-ups have a world celebration and an above-character announcement. These no longer create feed cards; equipment remains individually named. See [reward presentation](reward-presentation.md). `reward-feedback.ts` supplies bounded presentation, while wallet/XP owners alone grant rewards. Existing saves need no migration.

`/notifications.html` stages actual cards over the frozen renderer without gameplay or save access. Add `?view=discovery` or `?view=area` to review discoveries; the default shows named item pickups, with additional items queued individually.


### Ground item labels

Equipment and charm nameplates render at 85% of their authored size, uniformly scaling text, icons, padding and packing gaps. Hover rectangles return to display coordinates at the same scale; item silhouettes and the full hover tooltip keep their existing size. Loot-name options use two inline styled buttons with an explicit selected state, avoiding native dropdown colors.

Escape → Options → Loot names offers **Always** (default) and a remappable **Hold key**, persisted in device preferences rather than character saves. Either Shift key reveals all nameplates by default. Without the hold binding, hovering a physical item reveals its plate; the revealed plate remains clickable while hovered, and a selected pickup target stays visible while approaching it. Hidden plates have no clickable rectangle. Blur, pause and input cancellation clear the held reveal. Touch/controller input keeps names visible without a hold binding.

Mouse hover on a label or its item silhouette highlights the ground label and shows one shared item card fixed to the bottom-right screen corner. It includes the full name, rarity, item/required level, weapon or shield properties and item bonuses, with at most four prioritized On equip changes and an explicit replacement-slot summary. Alt reveals full changes and all displaced gear in one additional panel (maximum two panels); equal elemental-resistance deltas are grouped. Shift switches the comparison slot. Enhancement stays in the name without the explanatory upgrade banner. Both panels have viewport-bounded scroll access. Inventory and vendor tooltips retain their existing comparison behavior. `ground-loot-highlight.ts` owns both surfaces and caches the card until the hovered item, player stats/level or comparison key state changes; it does not rebuild markup every frame. The card uses shared tooltip motion, reduced-motion support, square corners and viewport/safe-area bounds. It accepts hover and scrolling, with a short grace period to cross from the label. Leaving hover, entering a panel, switching to touch/controller or collecting the item hides inspection. A click-to-walk target retains its highlight without keeping its tooltip open. Inspection does not gate on nearby enemies, pause combat or change pickup rules. `/loot.html?pickup&state=hovered` stages this presentation without gameplay or save access.

`loot-art.ts` uses actual equipment silhouettes resting on the ground, small rarity marks and occasional glints for rare or better gear. Health/mana pickups use distinct stoppered vials instead of glowing diamonds. Ground labels are compact single-line ink pills, rendered after CRT at display resolution. Common/magic gear uses its short base name (e.g. Signet rather than Gloaming Signet of Embers); rare and better gear retains its unique name. Enhancement remains visible, a tiny diamond/name color carries rarity, and item level sits quietly at the right. Text is measured and ellipsized within a 210-unit width cap. Full generated names remain in item tooltips and pickup notifications. `loot-label-layout.ts` packs individual labels within the viewport, checks every occupied rectangle, and draws faint leaders only for labels displaced away from their items. Extremely crowded views omit labels that cannot fit instead of overlapping; the items remain on the ground. Shared pickup coordinates, capacity, rarity odds and save data are unchanged.

`death-presentation.ts` retains at most 45 enemy remains independently of simulation actors. The actual creature art collapses over 0.65 seconds in the hit direction, sheds material scraps and settles into a corpse, fading over its final three seconds (14-second lifetime; wisps dissipate within five). Reduced motion shows settled remains immediately. Death and loot presentation can be inspected in `/loot.html` without gameplay or save access.


## Shared item presentation and panel ownership

`item-ui.ts` / `.css` supply slot content/rarity styling and item tooltip markup. Item cells show the icon, rarity, item level and enhancement; handedness belongs in the tooltip, without a 1H/2H icon overlay. `item-tooltip.ts` owns mounting, viewport-clamped card groups and `aria-describedby`, retaining the shared `ui-tooltip` motion. Shared tooltips use smoked glass with 24px backdrop blur, faint borders, gentle corners and compact spacing; unsupported blur and reduced-transparency preferences use opaque ink. The comparison host stays transparent and unframed regardless of CSS import order; rarity is carried by a small badge, item name and softly fading corner glow. Hovering eligible bag or vendor gear adds adjacent equipped-item cards for the exact displacement plan, including both hands. Empty slots and failed equip plans do not invent comparisons. The primary card retains effective On equip changes; secondary cards show item values with their equipment slot. Narrow layouts stack the cards. Touch inspection continues to use its existing single-item sheet. Panels supply an item plus character/level context, optional source bag index, explicit target slot, equipped flag and escaped action/price context. UI never mutates equipment.

`inventory.ts:planEquipmentChange` plans the complete swap, capacity and both-hand displacements. Commits, drop eligibility and `equipment-preview.ts` reuse it. Tooltip item values describe the item itself; the separate On equip section reports effective build changes and all replaced gear. A failed plan shows its reason. `ItemTooltip` places the hovered item's card in the visual column nearest its slot after viewport positioning; equipped comparisons extend away from it. This also covers three-card hand comparisons and below-slot placement. Stacked mobile comparisons keep the hovered item first. `/character.html?comparison=twohand` stages the staff-versus-sword-and-shield case.

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

Ground-loot inspection stays in the bottom-right corner with a 16-pixel viewport margin. It uses the shared equipment preview: the candidate keeps its original property rows with green (+x) or red (-x) net changes beside each value. Additional lost or derived stats retain their own compact change rows. Adjacent cards identify displaced gear with a small Equipped indicator beside the item type; its title names the slot. There is no extra comparison column or heading row. Two-handed swaps include both displaced hands. Empty slots have no equipped card; unavailable equip plans show their reason instead of a misleading comparison. Cards stack on narrow screens and scroll when their contents exceed the viewport. A brief hover grace period lets the pointer reach the cards; leaving them dismisses inspection. Clicking a card never collects an item. Selected walking targets keep only their ground highlight when the pointer leaves.

The skill atlas now mounts one DOM tooltip over its cached Canvas, using that same material and a domain-colored corner glow. Live bonuses, gear ranks, costs and route requirements still come from the current character; the shared visibility envelope retains outgoing details through its fade without rebuilding the atlas. World-map tips use the same corner glow instead of a stripe, and dungeon-map tips inherit the shared surface rather than painting an opaque override. Tooltip geometry remains clamped to its viewport. Atlas explanations now accept pointer/focus input for the nested terms described below.

Skill hover cards separate node identity, the owning skill, effects, cast facts and allocation status. The sidebar uses the same `skill-node-presentation.ts` ownership/role projection, including specialization/passive/mastery nodes. Skill-specific passive leaves state that their bonuses apply across all variants. Hover emphasizes a skill's leaf connections; only focused specialization names appear at close zoom, avoiding repeated school labels.


## Main-menu changelog

What's new opens a read-only release panel from the character hall. A compact version/date/time history sits beside New/Tweaks/Fixes notes; narrow layouts turn the history into a horizontal strip. Release headings use version numbers only; bullets stay brief. Notes use the shared game/numeral fonts, restrained category colors and the existing window shell. Focus is trapped in the reader and returns to the opener; Escape, controller B and native Back dismiss it first. LB/RB changes releases and the right stick scrolls notes. The same bundled `CHANGELOG.md` powers the repository and panel, with no network or save access. See [release workflow](releases.md).

The equipment heading displays a compact Gear power score using the same equipped-only calculation as the leaderboard. It refreshes with the character sheet, counts two-handed weapons across both hands, and replaces the occupied-slot counter.

Shared control hover uses a thin translucent silver edge and a slight surface lift. Keyboard focus retains a distinct 1px silver outline; semantic danger, rarity and valid-drop colors remain separate.

### Active-skill stained glass

`skill-icon-content.ts` owns all 30 active-skill compositions in a 64-unit space: reusable blades, shields, arrows, crystals and greaves, with skill-specific motion silhouettes. Gold, jade and elemental glass use an interior radial backlight, saturated panes, dark lead seams and a faint colored halo. Neutral weapon and shield surfaces pick a presentation palette from the skill’s domain or authored theme; this never changes its damage element. `skill-icon.ts` compiles the same bounded drawing list for SVG controls and Canvas. SVG paint and clipping IDs are instance-local. Shared clipped polygons divide each silhouette into six irregular panes for inspection, or three below 40px; fine engraving is omitted at small sizes. Light uses bounded radial gradients and translucent edge strokes, without blur filters or animation.

`skill-icon-canvas.ts` draws synchronously and caches at most two 144px stamps per skill for the native hotbar and atlas. Large inspection drawings stay vector. Skill identity retains its material colors; allocation, route, hover and search states remain on the atlas lenses/connections, and parent opacity still dims unavailable controls. Passive engravings retain their separate, lightweight paths. The former outline-only active artwork and asynchronous HUD image loader have been removed. See the local Skill icon workshop for actual-size samples; no generated bitmap assets are used.

### Active buffs and nested explanations

`active-buffs.ts` projects the player's actual Spellweave, Afterguard, ward, stance, shelter and guard state into a reusable `ActiveBuff` contract. `BuffBar` owns square effect icons, an expiring fill, native-resolution time and optional charges. It never advances timers or changes the player. Empty, expired, dead and equipment-ineligible effects disappear; wards show remaining absorption in their details. The strip sits above the floating HUD and hides with gameplay chrome. New effects supply identity, icon, actual remaining duration, full duration and one short summary.

`UITooltipStack` reuses `UITooltip` and the shared glass material. `effectTerm` marks a short, underlined explanation link; `effectExplanation` resolves its content. Hover, keyboard focus or tap opens the next card, retaining parents. A short exit grace permits crossing the gap; mouse-click focus does not pin cards open, while visible keyboard focus retains inspection. Repeated pointer exits do not extend the primary card’s dismissal deadline; one branch is limited to three cards, with cycle prevention. Cards choose adjacent or vertical placements to avoid parent text and viewport edges. Escape closes the deepest card; outside clicks, phase changes and disposal clear the stack. Keep primary content to the effect and its current value; put rules and equipment examples behind terms. The skill atlas's primary tooltip now accepts pointer input for these explanations.

Spellweave uses separate melee/spell glyphs, highlights eligible ready hotbar actions, and confirms consumption with a brief hand engraving and quiet sound. Reduced motion removes the expanding stroke. Bonuses, mana costs and the four-second rule are unchanged. The frozen `/character.html?panel=hud&loadout=shield&buffs` review exposes the real components without playable saves.

### Effect explanations and status strips · September 13

`effect-terms.ts` provides escaped, underlined terms shared by equipment, character stats, the atlas, Unique collection and effect cards. `RetainedTooltip` keeps item comparisons/stat cards open across pointer gaps and keyboard focus; `UITooltipStack` opens a bounded branch of deeper explanations. Placement avoids earlier cards, including an external equipment comparison. Escape closes the deepest explanation; owner close, target replacement, drag and resize clear stale cards. Touch inspection and the Thor item projection use the same terms.

`BuffBar` renders both player buffs and target debuffs with square skill glyphs, actual remaining time, draining fill and hover/focus/tap details. `activeBuffs` and `enemyDebuffs` are read-only projections. Persistent effects say On or show reserved mana; buildup uses progress. Cooldowns remain on action buttons. Target inspection retains only the visible living target, never an attack target or expired mark. Enemy application owns original durations for correct fills after refresh and control resistance; staged states missing those durations show time without inventing progress.

All eighteen Uniques have concise primary powers and separate full rules. The ninety Techniques have short effect/tradeoff summaries, current → selected mana/cooldown/potency and expandable resolved effect values. Base-rule exceptions are explicitly labeled before rank and gear. No tooltip owns combat, character mutations or saves.

Inventory, vendor and ground equipment comparisons use the actual default equip slot, including an empty second ring slot. Hold Shift to inspect the other ring or an eligible off-hand weapon; pressing or releasing Shift updates an already visible comparison. External gear can be compared with a full pack; actual equip and pickup commands still enforce storage capacity.

Skill atlas hover intent: node highlights, route previews and sidebar feedback remain immediate; floating cards wait 350 ms on the same node, tolerating movement within it. Every newly hovered node waits again. Leaving before the delay cancels the card; visible cards allow 200 ms to reach their explanations. Dragging, zooming, navigator movement and explicit node selection dismiss floating cards immediately. Reduced motion preserves the intent delay but removes the entry animation.

## Character hall — September 14

The selected character’s header has the shared appearance palette and a trash icon with explicit delete confirmation. Both hints open inward below their buttons. Keyboard/controller directions include these header actions alongside equipped gear. Chronicle and What’s new use outer windows capped at 1080px, aligned to the right edge of the hall’s existing content row; the hidden, inert character panels retain row sizing, and library content scrolls internally. The wordmark, navigation, window height and vertical position, and Sound placement stay fixed when switching home tabs, including handheld layouts.

The character-select view uses a narrow roster, a shared equipped portrait over a stone platform, and a separate summary window. `title-character-details.ts` presents saved gear, the same average equipped Gear power as the character screen, wallet gold and a four-bar effective attribute chart. Bars share a scale normalized to the largest current attribute; numeric values remain authoritative. Level / Gear power use labels above the values with a ruled diamond divider. Play time is shown in minutes or hours/minutes, and Last played includes the local date and time.

`title-character-summary.ts` resolves settlement names / wilderness districts from the saved seed and position, and active dungeon/rift names from saved expedition identity. It reads no character storage and does not change saves. Gear details reuse `ItemTooltip` without equip actions or comparisons: hover or keyboard/controller focus reveals the tooltip, and touch can tap to reveal it. Escape/B dismisses it without moving focus or blocking hall navigation. Tooltips clear on character/detail/home changes, appearance editing and hall close; the shared retained surface allows moving onto the card to read and scroll its details. Empty slots retain the shared `equipment-slot-art.ts` silhouettes; two-handed weapons visibly reserve the off hand.

Handheld landscape uses Gear / Attributes tabs with a persistent Continue action. X changes the detail tab while LB/RB retains home navigation. Directional navigation considers only visible, enabled, focusable header and gear controls, so the hidden Gear pane cannot intercept movement while Attributes is selected. Narrow portrait screens use a horizontal roster and scrolling details. The original runtime map background and translucent vignette are restored; `drawCharacterPortrait` uses its shared rig framing with `title-plinth.ts` for the platform. No generated raster backdrop, save migration or game-state mutation is involved.
