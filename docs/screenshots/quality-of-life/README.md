# Quality of life UI captures

Captured on 2026-09-07 from the actual runtime components in the local, frozen
review page at the in-app browser's default 1280 x 720 viewport. These are UI
screenshots, not generated mockups. Sample characters are memory-only; no gameplay
ticks or saved-character writes run during capture.

- `shop-overview.png`: `/services.html`, with no item selected and the Sell button visible.
- `shop-sort-filter.png`: the same page with the inventory Sort & filter menu open.
- `shop-sell-menu.png`: the same page with the five direct rarity-ceiling actions open.
- `skill-assignment.png`: `/services.html?view=skills`, with a sword and shield,
  Crescent Cleave already assigned to RMB, and four eligible choices for slot 1.
  The sample also unlocks Fireball, which is excluded by the equipped weapons.

The short viewport retains the shop's normal scrollable columns. The filter icon
is 17px, and its hit area does not add height to the section heading.

Validation: `npm run check` (908 code tests, strict/core TypeScript and production
build). Captures verify the displayed states; gameplay and device input testing
remain separate.
