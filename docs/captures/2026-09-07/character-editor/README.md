# Character editor screenshot review · 2026-09-07

These 25 PNGs were captured in the existing Codex in-app browser from local, memory-only review routes. Desktop captures use 1440 × 1060; individual phone captures use 390 × 844. No user saves were edited and no gameplay automation was run.

The editor harness uses the production component. `?runtime` exposes Save/Cancel, and `&creation` changes the primary action to Create character; the harness retains an **Inventory preview** shortcut for inspection. The three-phone comparison also exposes a study-only starting-gear selector. These helper controls are not additional gameplay menus.

World samples use the real `World`, `Simulation` player model, `Renderer`, world lighting, `PostFX` CRT and native HUD, frozen at a collision-free surface location without simulation steps. Six loadouts receive seeded random skin, hair, facial hair, accessories and independent armor tints. Recipe seed: 9072026; world seed: 7319. Sample 6 shows its helmet. These are staged runtime-rendered scenes, not evidence of combat or device playtesting. The overview omits HUD to make the six looks easier to compare; each individual scene includes HUD.

## Reproduce locally

Run `npm run dev` from the repository root, then open:

- `/character-editor.html?runtime` — production editing actions.
- `/character-editor.html?runtime&creation` — creation actions.
- `/character-editor.html?runtime&view=armor` — Armor tab.
- `/character-editor.html?view=inventory` — inventory entry point.
- `/character-editor-phone.html` — three 390 × 844 iframe studies.
- `/appearance-catalog.html?kind=hair&page=0` (also pages 1/2), `?kind=beards`, `?kind=accessories`.
- `/appearance-world.html` — six random recipes; `?sample=0` through `?sample=5` for native HUD views.

Double-click Teal and confirm Apply to all before opening Inventory preview to reproduce the matching teal editor/inventory captures. Use Next skin tone, Next hair color and Next hairstyle to inspect the additional pages. On phone, select Equipment in inventory to find its editor icon. All review routes are development-only.

See [the implementation guide](../../../character-editor.md) for design, command ownership, controls and the v3 → v4 save migration contract.

## Desktop editor and inventory

### Create character: production creation action

![Create character: production creation action](desktop-creation.png)

### Character tab: standard palettes and live figure

![Character tab: standard palettes and live figure](desktop-character.png)

### Second color pages and third hairstyle page

![Second color pages and third hairstyle page](desktop-extra-options.png)

### Armor tab: all seven parts tinted teal

![Armor tab: all seven parts tinted teal](desktop-armor.png)

### Apply one palette color to all parts confirmation

![Apply one palette color to all parts confirmation](desktop-apply-all.png)

### Inventory: matching saved tint and edit icon beside Equipment

![Inventory: matching saved tint and edit icon beside Equipment](desktop-inventory.png)

## Smartphone layouts

### Three smartphone mockup views

![Three smartphone mockup views](phone-comparison.png)

### Phone creation action

![Phone creation action](phone-creation.png)

### Phone Character tab

![Phone Character tab](phone-character.png)

### Phone Armor tab with Original swatch and helmet toggle

![Phone Armor tab with Original swatch and helmet toggle](phone-armor.png)

### Phone apply-to-all confirmation

![Phone apply-to-all confirmation](phone-apply-all.png)

### Phone Equipment tab with matching teal armor and edit icon

![Phone Equipment tab with matching teal armor and edit icon](phone-inventory-equipment.png)

### Phone bag layout

![Phone bag layout](phone-inventory-bag.png)

## Procedural style catalog

### Hairstyles 1–8, four facings

![Hairstyles 1–8, four facings](catalog-hair-1.png)

### Hairstyles 9–16, four facings

![Hairstyles 9–16, four facings](catalog-hair-2.png)

### Hairstyles 17–24, four facings

![Hairstyles 17–24, four facings](catalog-hair-3.png)

### All eight facial-hair choices, four facings

![All eight facial-hair choices, four facings](catalog-beards.png)

### All eight accessories, four facings

![All eight accessories, four facings](catalog-accessories.png)

## Random world appearances

### Six seeded random looks in the actual world renderer

![Six seeded random looks in the actual world renderer](world-random-gallery.png)

### World sample 1: Sword and shield, native HUD

![World sample 1: Sword and shield, native HUD](world-sample-1.png)

### World sample 2: Two-handed sword, native HUD

![World sample 2: Two-handed sword, native HUD](world-sample-2.png)

### World sample 3: Wand and grimoire, native HUD

![World sample 3: Wand and grimoire, native HUD](world-sample-3.png)

### World sample 4: Fire staff, native HUD

![World sample 4: Fire staff, native HUD](world-sample-4.png)

### World sample 5: Shortbow, native HUD

![World sample 5: Shortbow, native HUD](world-sample-5.png)

### World sample 6: Longbow, native HUD

![World sample 6: Longbow, native HUD](world-sample-6.png)
