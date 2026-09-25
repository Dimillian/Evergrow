# Merchant window layout audit

Local review, 2026-09-23. Scope: Blacksmith Shop, Enhance, Sell and Buyback, including Inventory/Charms and empty stock. The jeweler shares the same merchant layout. Stash, gambler and enchanter keep their specialized service arrangements.

## Findings and changes

| Area | Finding | Updated behavior |
| --- | --- | --- |
| Main panes | Sell changed the column ratio; Enhance alone included equipped gear. Switching tabs moved the inventory and divider. | Equal columns throughout. The same equipped slots stay above Inventory/Charms on every merchant tab. Every merchant tab includes the live inventory avatar between the rails, without changing the section height. Tab changes retain the mounted equipment section and canvas, preserving its rendered frame and animation instead of flashing a fresh canvas. |
| Primary action | Shop/Sell/Buyback used a window-wide footer, while Enhance used its left pane. | Every primary action sits at the bottom of the left pane. Offer content scrolls independently on desktop. A reserved options/status area keeps the button anchored. |
| Sale filters | Rarity selection and charm consent pushed the inventory down. | Filters sit with the sale receipt on the left; the inventory remains in place. |
| Carried items | Inventory/Charms separation existed only in Enhance. | Both categories and auto-sort use the same toolbar across merchant tabs. Charm cells no longer gain a separate margin/header in other tabs. |
| Empty stock | The message was positioned relative to the full pane, wider than a capped item tray. It appeared as a floating banner across the grid. | Each tray contains its own inset empty state. Never-stocked categories and sold-out stock use distinct messages; only sold-out stock suggests refreshing. |
| Buyback | Empty Buyback showed an unexplained bare lattice. | The tray says “No recent sales,” with a short explanation. Populated and empty trays retain the same geometry. |
| Purchase context | The chosen item was repeated in a remote footer; remaining balance was absent. | Item name and remaining gold sit above the buy button. Unaffordable purchases show the shortfall. Pack-space and transaction errors remain visible. |
| Scroll position | One offer scroll offset was reused for unrelated tabs. | Each service/stock category remembers its own position; the shared right pane retains its offset across service changes. Stable scrollbar gutters prevent horizontal nudges. |
| Narrow screens | Sell reversed the pane order while Enhance did not. | Every merchant tab stacks the offer/action first, then equipped gear and inventory, within the same scrolling body. |
| Equipped-item interaction | Reusing equipped cells outside Enhance would silently switch tabs. | Outside Enhance, clicking equipped gear opens inspection. Enhance still selects worn gear directly. |
| Forge feedback | Markup/controller still referenced missing bar, completion-burst and result styles. | Restored charge rail, bounded success strike, readable completion/save-error receipt and reduced-motion/skip overrides. No economy or transaction timing changes. |

## Preserved utility

The window retains stock category counts, paid refresh, exact quotes, drag-to-trade, double-click purchases, multi-item sale receipts, rarity selection, locked-item checks, active-charm consent, buyback and shared item comparison tooltips. Enhancement retains current/next ranks, per-rank incremental tooltips, free rounded-rank skips, cancellation before commitment and the persistent Skip animation preference. All enhancements remain guaranteed.

## Review and verification

Equipment → **Merchant layout** opens the existing save-free services review with eight resettable fixtures: Shop, Empty accessories, Sold-out stock, Enhance, Sell selection, Empty inventory, Buyback and Empty buyback. Direct entry: `/services.html?tier=city&layout=stock`; the `layout` value selects the fixture. Reset restores disposable state; populated Buyback is prepared through the actual commerce planner. The normal runtime tabs remain usable for comparing transitions. The separate Enhancement workbench retains its animation controls.

Code verification: strict and headless-core TypeScript checks; commerce, inventory hardening and enhancement transaction/feedback/preview/art tests; production build. Visual acceptance at desktop, short-window and narrow sizes remains with the user; no automated browser gameplay or playable-save access was used.
