# Expeditions and enchanter respec

Implemented local rules · 2026-09-10. Local development; not a published release.

## Enchanter respec

Every enchanter offers Reset skills. A complete reset refunds every purchased tree node except the free origin and every additional purchased skill rank. It costs 25 gold per refunded skill point, with no character-level multiplier or repeat-use surcharge: 10 points cost 250 gold; 40 cost 1,000. Unspent points are not charged. Attributes and equipment stay unchanged. The screen previews refunded points and exact cost before the explicit reset button. Reset clears skill assignments, selected ranks, specializations and Overload. Resources clamp to the new maxima without healing. Gold, refunded points and the new build save atomically; stale quotes and failed writes change nothing.

## Expedition route

A physical chart table in settlements opens Expeditions. The table can be inspected before level 20, but starting requires level 20. An expedition is a ten-stage character-owned route. Stages offer one or two seeded dungeon choices, with themes, enemy level, boss and modifiers visible before entry. Choosing a fork commits that branch. Choices and rewards cannot be rerolled by reopening, traveling or reloading.

The starting level is max(20, current character level), captured once. Each successive stage adds one enemy baseline level; bosses are baseline +3. Larger floors have 10–12 rooms, larger ordinary chambers and a larger boss arena. Modifiers change encounter composition or threat; no hidden reward or damage scaling. The first pass includes elite-heavy guards, ranged-heavy packs and higher-level enemies. Modifiers apply only to the chosen stage, never accumulate accidentally across stages.

Defeating the boss unlocks that stage's final reward chest. Claiming it completes the stage exactly once. The player may collect loot and leave before choosing the next stage at a table. Town visits and saving preserve route progress and the current dungeon. Death inside an expedition ends that route, removes its route instances and return portal, and returns the player through ordinary town recovery. Character level, equipment, gold and previously collected rewards remain. A new attempt generates a new route; there is no entry fee. Wilderness dungeon deaths retain their existing rules.

After stage ten, the final chest becomes the expedition grand chest: six equipment rolls, each 15% Rare / 65% Epic / 20% Legendary, at the final boss's level. Earlier stage chests contain three equipment rolls at 60% Rare / 35% Epic / 5% Legendary. Existing charm eligibility remains available through shared loot creation where supported. All ground rewards are persisted with claim receipts before animation; full bags do not destroy rewards. A route completes only when its final chest is fully delivered. Completed routes can be replaced by a new attempt after leaving and collecting wanted loot; the UI warns that uncollected expedition drops are left behind.

## Dungeon content and presentation

Expand from three to six themes: Rootbound Crypt, Cinder Foundry, Drowned Vault, Rime Cathedral, Sunken Ossuary and Astral Archive. Distinct materials, props, light, enemy mixtures, entrance architecture and boss identities share the runtime generators. The new themes also occur at wilderness entrances. Existing dungeon runs keep their recorded identity and geometry; explicit entrance options select new content without changing old saved seed interpretation.

The expedition panel uses the game's square-edged dark metalwork, restrained gold route links and theme-colored destination cards. Ten numbered stages remain legible; only the current fork is actionable. Compact modifiers explain actual effects. No permanent item-detail panels. The enchanter gets a concise Reset skills service tab. Local tools stage the production panels and dungeon maps in disposable memory; previews never read playable saves.

## Checkpoints and verification

Checkpoint specification, respec, expedition state/transactions/UI, dungeon diversity/art, and final validation separately; push coherent checkpoints to the existing origin. No Sites publication is requested. Verify point conservation, failed-save rollback, stale actions, route choices, exactly-once chest rewards, death reset, save/restore, safe generated routes, wilderness theme selection and production exclusion of tools. User owns combat/balance playtesting.

## Local previews

- `/tools/expeditions.html?stage=1&seed=7319` stages the production route panel. `level=19` shows its level gate; `failed` shows a new attempt.
- `/services.html?role=enchanter&respec` stages the production Reset skills tab.
- `/dungeon.html?view=entrances&seed=7319&expedition` compares all six entrances. Switch to Six themes for maps, then inspect chambers or bosses. `theme=rime`, `theme=ossuary` and `theme=astral` select the new styles.

Regression coverage includes all ten durable stage transitions, failed writes, unchanged character progress on death, partial grand-chest delivery at the gold-pile limit, reopening completed floors for loot, save validation after completion/death, and the Frost/Arcane boss hit channels. No browser gameplay automation was used; combat pacing remains for player testing.

Final local verification: 1,146 code tests pass, application and headless-core type checks pass, and the production build succeeds. The build retains its existing large-bundle advisory. No save reset or Sites publication was performed.
