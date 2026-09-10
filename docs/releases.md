# Player-facing release notes

`CHANGELOG.md` is the single source for both the repository changelog and **What's new** in the character hall. The reader bundles it into the game; no save, login, network request or external Markdown renderer is involved. Android includes the same reader when its next APK is built.

## Prototype version policy

Player-facing versions remain below **0.5.0** until the user explicitly approves a new milestone. The user approved **0.2.0** for the settlement and gambler milestone and **0.3.0** for the spatial inventory, charms and resistance milestone on 2026-09-09. Routine publications after 0.3.0 increment the patch number (**0.3.1**, **0.3.2**, and so on). Patch numbers have no single-digit limit. Minor versions (0.2, 0.3, 0.4) mark deliberate product milestones, not each feature pass. Do not advance to 0.5 or 1.0 automatically.

On 2026-09-09 the display history was renumbered, preserving every date, note and development-recap marker. The renumbered history ships with 0.2.0; it does not redeploy historical builds. The audit records below retain their original published labels, source SHAs and Sites IDs. Save schema v4, world generation 10, dungeon layout versions and Sites snapshot numbers are independent technical identifiers; never lower them to match a game release label.

| Original published label | Current display label |
| --- | --- |
| 0.1.0 | 0.1.0 |
| 0.2.0 | 0.1.1 |
| 0.3.0 | 0.1.2 |
| 0.3.1 | 0.1.3 |
| 0.3.2 | 0.1.4 |
| 0.3.3 | 0.1.5 |
| 0.4.0 | 0.1.6 |
| 0.5.0 | 0.1.7 |
| 0.5.1 | 0.1.8 |
| 0.6.0 | 0.1.9 |
| 0.6.1 | 0.1.10 |
| 0.6.2 | 0.1.11 |
| 0.7.0 | 0.1.12 |
| 0.7.1 | 0.1.13 |
| 0.8.0 | 0.1.14 |
| 0.9.0 | 0.1.15 |

## Last verified publication

- Game v0.3.10 / Sites version 41, publicly deployed on 2026-09-10 at 19:22:57 UTC.
- Published source: `b12ee24d269730964f27d3b45cb115077735384e`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_e367358dda808191893dd5a073056ff5`.
- Deployment: `appgdep_6aa3037aaddc8191bccc613226912e43`; Sites returned `succeeded`.
- Expedition tables share reachable-edge checks for opening and entering, with distinct level, distance and obstruction messages.
- Expedition backdrops fill the panel while preserving centered route geometry; the character hall shows loading placeholders until the roster arrives.
- Cloud initialization no longer creates a phantom slot while processing an early synchronization status.
- Existing characters and progress are unchanged; no save reset or database migration.
- Passed 14 expedition tests and eight title-action/changelog tests, application/core type checking, cloud-enabled client/Worker build, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.9 / Sites version 40, publicly deployed on 2026-09-10 at 19:14:36 UTC.
- Published source: `7b7f3ced19a41f542eaf16e822ee74087c33be9d`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_f1d272a5f50c8191ade227102abf7879`.
- Deployment: `appgdep_6aa3018d9e9c81918263dd48217bb53b`; Sites returned `succeeded`.
- Cloud-first character inspection and Continue checks, separate cloud/recovery choices with comparable progress, and explicit offline/pending labels.
- Lost upload receipts reconcile without false conflicts; delayed reads preserve concurrent uploads and incompatible recovery cannot hide a valid cloud character.
- Existing characters and progress are preserved; no save reset or database migration.
- Passed 91 focused cloud, save, Chronicle, title-action and changelog tests, application/core type checking, cloud-enabled client/Worker build, archive validation and clean-source release validation. Live cross-device acceptance remains player testing.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.8 / Sites version 39, publicly deployed on 2026-09-10 at 19:00:05 UTC.
- Published source: `d543c5a0bc28d88830590dd444fe18739d62e553`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_01560e5860a48191bc8382d3c46fb642`.
- Deployment: `appgdep_6aa2fe1e32d881918e60cbbc22774ec9`; Sites returned `succeeded`.
- Refined silver-blue frosted frames, portrait-safe corner fittings, lighter interaction highlights and quieter item tooltips.
- Equipped gear-power display uses the leaderboard calculation; inventory items remain within their physical footprints.
- Existing characters and progress are unchanged; no save reset or database migration.
- Passed 13 changelog, spatial-inventory and leaderboard tests, application/core type checking, cloud-enabled client/Worker build, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.7 / Sites version 38, publicly deployed on 2026-09-10 at 12:24:50 UTC.
- Published source: `02564a52b6eec53daadcae9cf146b4f5855d721e`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_d0ddda91bbe48191bde922809a66216c`.
- Deployment: `appgdep_6aa2a1842ce08191b4b5ae1e5c66045b`; Sites returned `succeeded`.
- Unified frosted panel materials using the approved inventory treatment, background-driven tint, square edges and shared rarity-lit item tooltips.
- Reduced-motion/transparency and forced-color fallbacks retained; embedded home panels reuse a single glass surface.
- Existing characters and progress are unchanged; no save reset or database migration.
- Passed three changelog tests, application/core type checking, cloud-enabled client/Worker build, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.6 / Sites version 37, publicly deployed on 2026-09-10 at 11:57:42 UTC.
- Published source: `9cb0458f289c11e9b2b62d523e84cc0d6f64bbd6`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_80060e300e988191a42d29f7e477e4fd`.
- Deployment: `appgdep_6aa29b22f82c8191b893b1204813d8d5`; Sites returned `succeeded`.
- Level-20 ten-stage expeditions, revealed route map, eight modifiers, grand-chest rewards, affordable enchanter skill respec and three additional dungeon themes with distinct entrances/bosses.
- Dungeon-specific Journey guidance, accelerated crowd collision and roster queries, and offscreen enemy drawing culling.
- Cloud roster/upload failure isolation, clearer recovery actions and Chronicle-backed replacement/deletion recovery.
- Existing characters and progress are preserved; no save reset or database migration.
- The 1,166-test regression run passed 1,165 tests; its remaining core-boundary check exposed two missing compiler-list entries. Both architecture tests passed after correction, followed by full type checking, cloud-enabled client/Worker build, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.5 / Sites version 36, publicly deployed on 2026-09-10 at 06:13:19 UTC.
- Published source: `7d969525dec524642f1bcc16e5469bcd37c156d8`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_43e24ace2bd881919fe2af15a207de7b`.
- Deployment: `appgdep_6aa24a6ba91c8191bed8f4eeb15dfc2d`; Sites returned `succeeded`.
- Dynamic day/night lighting and minimap clock, nine biome atmospheres, cloud shadows, directional scenery/water highlights, warmer settlement nights and dungeon reflections/glow.
- Smoother Mire fog, cached fortification artwork and reusable flickering-light shadows.
- Existing characters and progress are preserved; the clock follows saved simulation time. No save reset or database migration.
- Passed all 1,137 code tests, type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.4 / Sites version 35, publicly deployed on 2026-09-09 at 19:15:47 UTC.
- Published source: `08697db396647d0c51821e1fd1d0136458b39459`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_dd23519f8e948191a9bdb88b409fcc6e`.
- Deployment: `appgdep_6aa1b0505eb48191a47cd3c76d2d48dc`; Sites returned `succeeded`.
- Charms occupy 5% of item rewards across monsters, dungeon chests and item-giving events, including themed equipment rewards. Total item quantities, rarity and source levels remain unchanged.
- Ground-loot corner tooltips, tooltip-only vendor inspection, hovered-item-first comparison placement, automatic skill rank/specialization activation, compact progression controls and redrawn supply carts.
- Existing characters and progress are preserved; no save reset or database migration. Older 64-/72-slot saves pass charm reward, pickup and save round-trip checks.
- Broad regression run passed 1,125 checks; its remaining item-corpus fixture was updated to the new reward entrypoint and passed with all 28 final item/charm/loot checks. Three changelog checks, type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation also passed.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.3 / Sites version 34, publicly deployed on 2026-09-09 at 15:43:43 UTC.
- Published source: `c29201cf41550758f8738c1bc50de920925ea2a6`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_89174902b5348191831c9df8d9c43cd3`.
- Deployment: `appgdep_6aa17ea05e8c819198181a49cbe61ea7`; Sites returned `succeeded`.
- Taller storage without persistent item details, five 96-item tabs, escalating permanent unlock purchases and independent per-tab sorting.
- Tab purchases persist gold and capacity together; selected-tab transfers, stale quote protection and scroll preservation retain item ownership.
- Existing 96-item storage remains the free first tab. Matching client/Worker validation supports up to 480 stored items; no character reset or database migration.
- Passed the 1,119-test regression suite, seven final storage-tab checks including five full tabs, three changelog checks, type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.2 / Sites version 33, publicly deployed on 2026-09-09 at 15:23:30 UTC.
- Published source: `1b2e948580ec16cec303b3f9d90696e3de74f40a`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_39c617126c348191931b8edc03f420eb`.
- Deployment: `appgdep_6aa179df5618819186f39f20bd0ea731`; Sites returned `succeeded`.
- Inventory/charm/vendor grids fit their panel widths; overhead NPC and monster speech is half-size.
- Storage displays physical item footprints in a growing 12-column grid, retaining its 96-item capacity. Independent chest and inventory Auto-sort controls save organization and clear stale item selections.
- Passed targeted speech, inventory, character-command, commerce and charm tests, three changelog checks, type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- No character reset, save schema change or database migration. This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.1 / Sites version 32, publicly deployed on 2026-09-09 at 14:54:46 UTC.
- Published source: `5c72271fc94422b3bbee5c609e9b6a5b0dbf985f`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_36ca7c9065708191970e590af16e08f3`.
- Deployment: `appgdep_6aa1732247488191b0756c624261062d`; Sites returned `succeeded`.
- Item locks, active-charm sale protection, bounded packing fallback and read-only multi-stone replacement comparisons.
- Focused small-charm budgets, stronger large stones and guaranteed thematic first affixes. Upgrades skip ineffective steps; zero-gain releveling cannot charge gold.
- Validated older charms rebalance on read, retaining ownership and character progress. Matching client/Worker validators shipped together; no character reset or database migration.
- Passed the 1,110-test suite, 33 final targeted checks (including the additional city-reroll regression), three changelog checks, type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.0 / Sites version 31, publicly deployed on 2026-09-09 at 14:05:58 UTC.
- Published source: `1d7b20b216cf6551753c7541c67a1f7d60d569fd`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_8d4ef43cf4548191ad40d1ba69d4f092`.
- Deployment: `appgdep_6aa167ae640c8191b9f067ee8e8b52f5`; Sites returned `succeeded`.
- Spatial inventory, dedicated charm grid and stone loot, elemental resistances, shared vendor selling, repeat gambling and saved item dropping.
- Detailed stat explanations, whole-number item bonuses and halved Dexterity conversion; starter armor upgrades and reward/stat accounting fixes.
- Existing characters retain progress. Saved item bonuses normalize to whole numbers on read; matching client/Worker validators ship together. No character reset or database migration.
- Passed 1,104 code tests, three release-note checks, type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Earlier verified publication

- Game v0.2.1 / Sites version 30, publicly deployed on 2026-09-09 at 11:58:22 UTC.
- Published source: `d21d361dd328721cf559e682f11f6705b680d9ba`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_0726321e2cb48191ba7f593ce5969740`.
- Deployment: `appgdep_6aa149d095d88191bb4a72b1a9f6095c`; Sites returned `succeeded`.
- Valid equipment slots glow green throughout a drag and brighten over the drop target, using existing equip restrictions.
- Passed 15 inventory/changelog checks, type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation. No save or database changes.

## Earlier verified publication

- Game v0.2.0 / Sites version 29, publicly deployed on 2026-09-09 at 11:53:57 UTC.
- Published source: `4ef69a631cf603d763e61023a7181cebb30ac0f2`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_e123bdb67a6081918f68b3b42c43afc4`.
- Deployment: `appgdep_6aa148c49a7c8191a288247b41b11214`; Sites returned `succeeded`.
- Settlement/village/city layouts, roaming residents, personal storage, gambling, tiered shops and city enchantment preferences.
- Biome architecture, continuous fortifications, refined stalls and NPC shadows; deliberate equipment pickup, consistent item grids and layered wilderness lighting.
- Generation-9 characters upgrade to generation 10 on Continue, preserving progress and exploration. Town stock refreshes once; obstructed surface positions move safely. Unsupported older expedition formats remain preserved and unsupported. Matching client/Worker validators shipped together; no database migration.
- Passed 1,058 code tests, type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- Display history is now 0.1.0–0.1.15 followed by the user-approved 0.2.0 milestone. Future routine publications use 0.2.x.

## Earlier verified publication

- Game v0.9.0 / Sites version 28, publicly deployed on 2026-09-08 at 19:19:56 UTC.
- Published source: `87d3172333451b9c3b8ed1aefd0b32bb462b0bf1`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_0bfdf63d6b9881919cf9e715ef473a61`.
- Deployment: `appgdep_6aa05fcf6e048191abbfbb80bb502469`; Sites returned `succeeded`.
- Three dungeon themes, compact 7–9-room floors with winding passages, two optional chamber events and automatically opening event treasure.
- Shared event approaches and body-sized navigation reduce distant or stranded reinforcements.
- Dungeon layout version 4 deliberately rejects older expedition payloads. Characters containing older saved expeditions require a fresh character; existing saves remain stored. Characters without an older expedition are unaffected. Client and Worker validators were published together; no database migration.
- Passed 1,032 code tests, three release-note checks, type checking, the cloud-enabled client/Worker build, archive validation and clean-source release validation. Dungeon workshop remains local-only and excluded from the production archive.

## Earlier verified publication

- Game v0.8.0 / Sites version 27, publicly deployed on 2026-09-08 at 17:57:50 UTC.
- Published source: `7bc26887d942089f54ba565bbaf38578af37c46c`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_1962625b91dc81919b5702fd7b8ab456`.
- Deployment: `appgdep_6aa04c7e71d481919ad096613f3dd864`; Sites returned `succeeded`.
- Bounded regional enemy, encounter, reward and vendor scaling; consistent rank advantages; onward journal guidance and accurate shop stock levels.
- All event families and wilderness bosses are eligible from level one outside the protected arrival area.
- Existing generation-9 characters and activated encounter progress are preserved. Matching client/server save validators were published together; no database migration or character reset.
- Passed 1,023 code tests, three release-note checks, type checking, the cloud-enabled client/Worker build, archive validation and clean-source release validation. Expanded atlas surveys are committed for local development and excluded from the production archive.

## Earlier verified publication

- Game v0.7.1 / Sites version 26, publicly deployed on 2026-09-08 at 16:24:20 UTC.
- Published source: `89e073dbc30de27d0a6bd573e67b1c38d8ff9e1b`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_08a45de33f008191b8f1c500d521db75`.
- Deployment: `appgdep_6aa036a175908191a4a6a514378fc791`; Sites returned `succeeded`.
- Ground equipment retains the newest 1,024 drops, evicting oldest items instead of blocking fresh enemy and chest rewards. Previously pending boss equipment can deliver automatically.
- Passed focused reward/save checks, three changelog checks, type checking, the cloud-enabled client/server build and release validation.
- Client/server ground-item validation shares the expanded limit. No database migration or character reset.
- Regional level scaling remains proposed and is not part of this release.

## Before each requested Sites publication

1. Resolve the source of the last **successful publication** from the Sites history/current release record. A saved version alone is not proof of publication. For the initial changelog release the known published baseline is `1978bf9d210533cb83b11c8c9863e766f7c13562` (Sites version 14).
2. Read the commits and relevant implementation since that source. Summarize what players can actually experience; omit internal refactors, unpublished experiments and changes later reverted.
3. Prepend a versioned, timestamped release entry in `CHANGELOG.md`. Use **New**, **Tweaks**, and **Fixes** (omit empty sections). Lead with exciting features and meaningful balance changes; describe bugs in terms of what players experienced. Explicitly call out save resets. Use short factual bullets, ideally one line each. No themed titles or promotional copy. Increment the patch version for each publication under the prototype policy above; record its UTC preparation time, displayed in Europe/Paris time in the reader.
4. Validate the reader, run appropriate code tests and the production Site build. Commit the notes alongside the exact release source, and push the checkpoint to origin.
5. Run `npm run release:check -- <full-last-published-source-sha>`. It checks the format, requires a clean committed tree, and rejects a changed build whose newest notes are unchanged from that publication. Re-publishing the identical source can reuse its existing notes; do not invent gameplay changes.
6. Follow the Sites skills: push the exact source to its bound repository, package that build, save the version and publish to the requested existing audience. Verify deployment success before saying it is live. On failure, preserve the prepared notes and retry the same release rather than creating a second entry.

The changelog starts with three retrospectively numbered entries (now v0.1.0–v0.1.2; originally v0.1.0–v0.3.0); these are game versions, separate from Sites snapshot numbers. Historical recap timestamps use the last checkpoint that day; v0.3.0 uses the verified September 7 publication time. September 5 and 6 are explicitly marked development recaps reconstructed from Git history, not claims of individual deployment dates. The September 7 release summarizes changes since the known version-14 baseline.

## Supported file format

- `## vX.Y.Z — YYYY-MM-DDTHH:mm:00Z` starts an entry. Use a unique version and UTC timestamp, newest first. No release title.
- `### New`, `### Tweaks`, `### Fixes` start nonempty sections.
- Each bullet is one line starting with `- `. `**Bold**` is supported; all other content is escaped as text.
- `> Notice` adds a short release note, such as a save warning or historical-recap label.
- Keep the introduction above the first release. No raw HTML, links, embedded media or arbitrary Markdown are interpreted.

`changelog.ts` owns strict content parsing; `changelog-panel.ts` owns display, focus trapping, scrolling and controller handling. The title screen suspends its focus trap while the reader is open and restores focus to What's new when it closes. Escape, B and native Back close the reader before any other menu action. Gameplay and character storage remain untouched.
