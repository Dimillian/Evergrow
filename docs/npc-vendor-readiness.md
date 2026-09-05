# Consolidation before NPCs and vendors

Reviewed 2026-09-05 at `9058c56`. This is an assessment and implementation sequence, not a runtime refactor. Gameplay, saves and the local server were left unchanged.

## Consolidation completed

The requested shared equipment preview/item UI and panel-lifecycle work is implemented. Equipment planning is pure and shared with commits and drag eligibility; effective comparisons include both-hand displacement. Item slot/tooltip components are reusable outside inventory. `PanelCoordinator` owns the transition lifecycle. All 492 code tests, strict/core TypeScript and the build pass; the corrected tooltip was inspected in the in-app static review. No save reset or NPC/trade implementation is part of this checkpoint. The assessment below records why these boundaries were selected.

## Assessment

The existing foundation is suitable for the next step. Keep the fixed simulation, separate combat owners, generated world blueprints, procedural art, shared UI kit and validated character saves. Consolidate the specific boundaries below before building a vendor screen; an engine rewrite or generic entity/event framework would add work without solving the immediate problems.

The recent iterations are already reasonably separated: gold rules/wallet, reward presentation, notifications, keyboard ownership, patrol steering and starter loadouts each have their own owners. The main remaining pressure is where a future interaction must coordinate several systems at once.

## Verified baseline

- 483 code tests pass, plus strict application/core TypeScript and the production build. Import-cycle and headless-core boundary checks pass.
- 134 runtime TypeScript modules, 15,935 runtime lines, zero runtime package dependencies (`npm run stats`). These counts describe size, not maintainability or test coverage.
- Seven biomes, six enemy archetypes, three ranks, seventeen active skills, 2,113 tree nodes / 2,925 edges, thirteen weapon profiles and three shields.
- Eight browser-local character slots, 64 inventory cells, eleven equipment slots, saved wallet and ground coins, separate character exploration.
- Current large coordinators: Simulation 667 lines, Renderer 644, WorldMap 635, Game 505 and InventoryPanel 410. Their size alone does not justify splitting them.
- Tests cover the recent lost-release input sequences, hound patrol overshoot, wallet operations, coin pickup/save consistency and accumulating reward notifications.
- No browser gameplay or hardware performance benchmark was run. Passing code tests does not establish balance, Safari gameplay feel, or long-session performance.

## 1. Share equipment planning and item presentation first

**Current defect:** `InventoryPanel.comparison` and `itemTooltipMarkup` compare the incoming item with one equipped slot. `equipItem` correctly resolves two-handed/off-hand conflicts separately. The two views can disagree.

A headless check with a common longsword and iron buckler, followed by a common ember staff, produced a tooltip-style armor delta of **0**, while the actual successful equip changed armor by **−7** and removed the shield. This should be corrected before the same comparison UI influences purchases.

Extract a pure equipment-change plan from `inventory.ts`, including target slot, displaced items, capacity validation and resulting equipment. Reuse it for committing equipment and previewing its effect. Present item-to-item properties separately from the complete character-stat change; do not imply that raw weapon damage is the player's final damage.

Move reusable slot markup and item tooltip content out of InventoryPanel, retaining the current shared rarity treatment, icons, typography and tooltip motion. Vendor screens should provide item data, a comparison target and action/price context, rather than copy inventory markup or assume every displayed item has a bag index.

**Acceptance:** shield removal, dual wield, two-handed swaps, ring selection and full-pack failures agree between preview and execution. Existing inventory controls retain their behavior. One item presenter serves inventory and the first vendor.

Sources: `game/src/inventory.ts`, `game/src/inventory-panel.ts:340`, `game/src/character-stats.ts`.

## 2. Make trades a complete transaction

`wallet.ts` validates and atomically changes a gold balance. It does **not** make a sequence of wallet, inventory and vendor-stock mutations atomic. A future implementation that spends gold before checking bag capacity could charge the player without delivering an item.

Add explicit headless buy/sell commands beside the existing character-command boundary. Validate current item/stock identity, stock revision, price, affordability, ownership, capacity and numeric limits before committing. Commit wallet, ownership and stock changes together, then route presentation and persistence. Repeating an already-consumed stock action must fail without charging again. Do not let a DOM callback independently debit gold and insert gear.

Item identity also needs an explicit issuance rule: `generateItem` currently derives identity from seed, level, profile/kind and tier. Generating the same stock recipe again produces the same item ID, while inventory and save validation correctly reject duplicate owned identities. Give each issued copy a stable distinct identity and retain the procedural seed for its stats/art. Bought and sold items should transfer their existing identity; restocked copies need a new one.

**Acceptance:** insufficient funds, full pack, stale stock, double activation, stale bag selection and numeric overflow leave all participating state unchanged. Buying/selling and then saving/reloading preserves exactly one owner per item. Price formulas stay separate from visual rarity and the summary power score.

Sources: `game/src/wallet.ts`, `game/src/character-commands.ts`, `game/src/inventory.ts:addInventoryItem`, `game/src/items.ts:134`.

## 3. Add persistent interaction state with the first NPC

Town/building blueprints already have stable IDs and are frozen, which is the correct basis. They contain geometry and service POIs, not mutable NPCs or vendor stock. Avoid putting shop stock into World's generated/cached buildings or into exploration records.

Introduce character-owned interaction state keyed by stable NPC/vendor IDs derived from the building identity and role. Separate deterministic NPC/stock definitions from mutable purchased stock, stock generation/revision and any future buyback state. Save the mutable state in the same validated checkpoint as wallet and inventory so reloading cannot restore stock while retaining purchases.

Extract reusable item validation from `character-save.ts` when adding stock/buyback containers; extend ownership/identity checks across every persisted item container. Set explicit limits for retained vendor records and stock. Unloading a town must not silently reset a purchase; decide the restock rule explicitly rather than inheriting cache eviction behavior.

**Acceptance:** walking away and back, world-cache eviction, save/reload and character switching preserve intended stock ownership. Malformed stock and duplicate item identities reject the checkpoint. Existing storage-failure and stale-writer behavior remains explicit.

Sources: `game/src/settlements.ts:freezeSettlement`, `game/src/character-save.ts`, `game/src/character-session.ts`, `game/src/character-storage.ts`.

## 4. Consolidate panel and interaction ownership

Game currently repeats panel lists and open/close sequencing across keyboard handlers, resume, map/character switches, title entry and reset. Adding dialogue and vendor phases directly in each branch increases the chance of another stuck-input or wrong-focus bug.

Introduce a small panel coordinator with a single transition path for input clearing, combat suspension, active-panel closure, focus restoration and save requests. Reuse existing dialog focus and keyboard-safety helpers. Keep NPC target/range/line-of-sight checks in a headless interaction owner, separate from enemy aiming; menus should request an interaction rather than decide eligibility themselves.

The event-to-notification/audio mapping in Game can move into a small presentation adapter when trade results arrive. Keep typed payloads and direct ownership; no general event bus is needed.

**Acceptance:** opening, switching and closing inventory, atlas, dialogue and trading cannot leave held movement, attack buffers or hidden focus traps. Vendor actions cannot be triggered through a panel into the world or against a different/out-of-range NPC.

Sources: `game/src/game.ts`, `game/src/game-phase.ts`, `game/src/game-keyboard.ts`, `game/src/ui-components.ts`, `game/src/ui-hit-test.ts`.

## Suggested checkpoints

The first two consolidation checkpoints are complete in `85b1b00`; NPC interaction itself remains future work. See the [NPC and vendor specification](npcs-and-vendors.md) for the next implementation sequence and proposed service rules.

1. Shared equipment plan, correct comparison previews and reusable item UI. Correct current behavior before copying it into shops.
2. Consolidated panel lifecycle and a narrow interaction target/command boundary, exercised by one stationary NPC.
3. Transactional buy/sell, distinct item issuance, bounded vendor state and save validation together; then expose the vendor UI.

The last checkpoint is part of implementing vendors, not speculative infrastructure to complete in isolation. Keep the first vendor small enough to validate the complete loop before adding schedules, dialogue trees, crafting, restocking varieties or quest NPCs.

## Cleanup that can wait

- Keep current renderer and combat architecture. Split further only where the new responsibility requires it; no ECS conversion or global service container.
- Add per-system timings before materially increasing actor density or adding roaming NPC populations. Current FPS smoothing is not a profiling baseline.
- Consolidate the documentation's historical snapshots: `system-status.md` still labels older counts and encounter limits as current, while later sections supersede them. Prefer a compact current summary and clearly labeled historical notes.
- Keep compatibility code out of the design. No save reset is needed for this assessment; decide any schema change as part of the actual implementation.
