# Evergrowing interface kit

The interface combines dark slate surfaces, fine brass edges, warm text, muted jade actions, and the bundled Pixelify Sans font. Ornament stays at the edges; content and actions get generous space. World post-processing never touches UI text or controls.

The selected bottom-HUD direction is **The Astral Instrument**: calibrated silver rings, celestial engraving, and separate black-steel skill plates. The shared `silver`, `silverDim`, `steel`, and `steelDeep` tokens supply its control materials. Use these and restrained celestial edge details when expanding the inventory; keep content legible and controls familiar. `hud-frame.ts` draws the metalwork, `hud-layout.ts` owns its shared geometry, and `hud.ts` presents live resource and ability states.

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
| `.ui-slot` | An item-slot presentation primitive for future inventory work |

`ui-icons.ts` provides decorative code-defined SVG icons with a common grid and stroke. Give every icon-only button an accessible name. `ui-components.ts` exports the icons, `escapeUI()` for interpolated markup, and dialog focus management. Prefer `textContent` for dynamic labels when no markup is needed.

## Windows and interaction

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

Short button hints use `data-tooltip`; they appear on hover or keyboard focus. Use `data-tooltip-placement="below"` near a panel's top edge and `data-tooltip-align="end"` near its right edge. Essential information belongs in a label or accessible name, not only a tooltip.

## Implemented surfaces

Start, pause, and defeat windows share the markup builder in `game-menu.ts` and the kit's window/action primitives. The world map uses the same header, controls, POI cards, and footer language. Toasts share the status treatment. The Canvas HUD, enemy plate, and minimap share the palette while preserving their functional health, mana, skill, and map colors.

Open the local [interface review](http://127.0.0.1:5173/ui.html) to compare real windows and component states in desktop and 390px previews. It draws a frozen procedural background, never advances gameplay, and uses memory-only map discovery. Example item slots demonstrate the presentation API; inventory behavior is not implemented. The review route is development-only.

## Extending for inventory

Compose the shared window, wells, slots, stat rows, badges, and tooltip surfaces. Keep equipment and item state outside the presentation helpers. Use the game's existing phase/input boundary when opening a new modal, and register its bounds with UI hit testing. Maintain 44px interactive targets, responsive overflow, native-resolution text, and keyboard access. Expand the shared primitives when a repeated pattern is needed instead of creating another independent panel theme.
