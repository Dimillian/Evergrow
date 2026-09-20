# Player-facing release notes

`CHANGELOG.md` is the single source for both the repository changelog and **What's new** in the character hall. The reader bundles it into the game; no save, login, network request or external Markdown renderer is involved. Android includes the same reader when its next APK is built.

## Prototype version policy

Player-facing versions stay within the latest explicitly approved prototype milestone. The current ceiling is **0.7.x**; do not advance to 0.8 or 1.0 without approval. The user approved **0.2.0** for the settlement and gambler milestone and **0.3.0** for the spatial inventory, charms and resistance milestone on 2026-09-09. Routine publications after 0.3.0 increment the patch number (**0.3.1**, **0.3.2**, and so on). Patch numbers have no single-digit limit. Minor versions (0.2, 0.3, 0.4) mark deliberate product milestones, not each feature pass. Do not advance beyond the approved milestone automatically.

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

The user approved **0.4.0** on 2026-09-13 for the rebuilt passive atlas and merchant overhaul. This remains a prototype milestone below 0.5.0.

The user approved the next major prototype milestone, **0.5.0**, on 2026-09-13 for the new HUD, stained-glass skill icons, inventory skill assignment and twelve Unique items. Routine updates after this milestone use 0.5.x.

The user approved the next major prototype milestone, **0.6.0**, on 2026-09-14 for Crimson Rifts, keys, ranked monsters and the accompanying interface and performance updates. Routine updates after this milestone use 0.6.x.

The user approved the next major prototype milestone, **0.7.0**, on 2026-09-20 for world difficulty, the skill-atlas planning and refund improvements, the Area journal and mobile/interface updates. Routine updates after this milestone use 0.7.x.

## Last verified publication

- Game v0.6.7 / Sites version 61, publicly deployed on 2026-09-17 at 11:44:00 UTC.
- Published source: `77263046a9cf7be8bf1a561644fb4fe9f79dd22e`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_a389400d657881919af6231eb9ae7ece`.
- Deployment: `appgdep_6aabd27177b48191aac6107d57ce9621`; Sites returned `succeeded`.
- Includes PR #63: refined pause-menu hierarchy, prominent Resume action, compact save controls and responsive panel/wordmark placement.
- All 16 release-note and character-hall regression checks passed, alongside application/core type checking, local and cloud-enabled builds, archive validation and clean-source release validation. No automated browser gameplay was run.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.6.6 / Sites version 60, publicly deployed on 2026-09-16 at 13:50:13 UTC.
- Published source: `12fdd74ba67dcb6be02a7ee03f8ed626b82511db`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_c8d0940808f08191876be527a1e53eba`.
- Deployment: `appgdep_6aaa9e81af688191bcd8ec1c15c8b176`; Sites returned `succeeded`.
- Includes PRs #56–62: cloud character-hall recovery/layout fixes, smoother obstacle movement, region announcements, pending boss reward objectives, elemental reactions and debuff presentation, completed-event aftermath, and stable local event previews.
- Full suite: 1,642 of 1,643 tests initially passed. Added the new movement module to the headless compiler boundary, then all 22 architecture/movement checks passed. Application/core type checking, local and cloud-enabled builds, archive validation and clean-source release validation passed. No automated browser gameplay was run.
- Local development tools remain excluded from the published archive; the local server remains available.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.6.5 / Sites version 59, publicly deployed on 2026-09-15 at 07:06:15 UTC.
- Published source: `ecb9a04f683881f12cce113ca414eec816dda4b4`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_e24f86b3c6988191810bb249f77ed453`.
- Deployment: `appgdep_6aa8ee58adf0819187abb443f5bad283`; Sites returned `succeeded`.
- Dedicated fire, frost, meteor and storm spell effects; resolved skill hover cards in the inventory bar and assignment picker.
- All 118 relevant code tests passed, plus application/core type checking, local and cloud-enabled builds, archive validation and clean-source release validation. No automated browser gameplay was run.
- The Prism Archmage fixture remains only in the user's local character slot; it is not part of this publication.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.6.4 / Sites version 58, publicly deployed on 2026-09-15 at 06:27:24 UTC.
- Published source: `76d5ad29a9a6d98559510a63129de5eb7604e912`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_d4cc73833a7881919a1fd8f1e12d8194`.
- Deployment: `appgdep_6aa8e53a794c81919085a44709644e99`; Sites returned `succeeded`.
- Traveling Arc Lightning, luminous chain effects, Storm Circuit tuning, two-card weapon comparisons and release-warning cleanup.
- All 134 relevant code tests passed, with application/core type checking, cloud-enabled client/Worker build, archive validation and clean-source release validation. No automated browser gameplay was run.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.6.3 / Sites version 57, publicly deployed on 2026-09-15 at 05:39:32 UTC.
- Published source: `32125e1e2eec31715a4ff92c59e0183253bba1f7`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_ce3b0d0058c08191a93d5a377a4a8453`.
- Deployment: `appgdep_6aa8da02ca6881919806b4ddb9618c0f`; Sites returned `succeeded`.
- Includes PRs #45, #48, #49, #51, #52, #53 and #54: redesigned character hall and appearance editing, directional character art, map legend and service pings, destination-aware portals, ground resource motion, rift completion feedback and F3 performance monitor.
- All 1,585 code tests passed, with application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation. No automated browser gameplay was run.
- Existing characters and progress remain intact; no save reset, skill refund or database migration. Reload existing clients.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.6.2 / Sites version 56, publicly deployed on 2026-09-14 at 16:19:33 UTC.
- Published source: `09e32e06ecb7f039be724ae26a7c191fba4d504d`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_645eb1c05f7c8191b66a4f73d2c5c3a3`.
- Deployment: `appgdep_6aa81e8295a88191a312d8dba260d029`; Sites returned `succeeded`.
- Rift fissures, floating fragments, biome corruption and progress-driven lightning; restored ground detail and sharper enlarged scenery.
- Focused physical weapon affixes, stronger damage rolls with smaller material premiums, reduced random glove speed bonuses and roll-aware gear power. Unique combat stats remain unchanged.
- Charms enter the normal bag for manual activation; buffered skill presses survive action recovery.
- Existing characters retain progress and active charms. Regular weapon/glove budgets update on read; obsolete melee caster affixes become suitable bonuses. No database migration or character reset.
- The loot checkpoint passed all 1,531 code tests and a 265,062-item audit. Final publication passed 41 focused checks, application/core type checking, cloud-enabled client/Worker build, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.6.1 / Sites version 55, publicly deployed on 2026-09-14 at 13:52:11 UTC.
- Published source: `c469820aa3b8cd2ea15bb55690fe61df6eecabd6`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_6727d96bb6f081919cccb493e37d2b02`.
- Deployment: `appgdep_6aa7fbf68ff08191be9b55cb6af50469`; Sites returned `succeeded`.
- New rifts use connected clearings, branching trails, biome ridges, four encounter formations, Ritual Ward support and staggered Stormbound/Cinder specials. Density keys add reinforcements to clearings. Timer, progress target and chest rewards remain unchanged.
- All 1,514 code tests passed. Application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation passed. No automated browser gameplay was run.
- Existing local/cloud characters and active rifts remain compatible; no save reset, skill refund or D1 migration. Reload and start a new rift for the new layout.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.6.0 / Sites version 54, publicly deployed on 2026-09-14 at 13:14:42 UTC.
- Published source: `b70a176e65fbfba4baa4e011a76f013e76c9523b`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_2f020f3af0c08191a8182e09d5900d92`.
- Deployment: `appgdep_6aa7f333135c8191b5874e3caa7e2ca5`; Sites returned `succeeded`.
- Crimson Rifts, optional inventory keys, guardian arrival and automatic rewards; ranked enemy outlines/traits, dense-pack performance, smooth rift maps, Chronicle records and eighteen achievement milestones.
- Includes merged PRs #32, #36, #37, #38, #41, #42 and #43: master volume, inventory drag performance, background rendering suspension, map tooltips, radiant wand identity, unarmed poses and inventory refinement. Also includes compact ground-loot comparisons and stable Alt inspection.
- All 1,508 code tests passed under Node 24 with four test workers. Application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation passed. No automated browser gameplay was run.
- Existing local/cloud characters remain compatible; no save reset, skill refund or D1 migration. Existing rift ledger records seed Chronicles; previously untracked details start with this update. Reload existing clients.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.5.3 / Sites version 53, publicly deployed on 2026-09-14 at 08:24:11 UTC.
- Published source: `dfb1f3d072351d08de43b33bf5a52acb230e89f7`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_c49e9f6173948191853fda8ba40a5aee`.
- Deployment: `appgdep_6aa7af1ad0288191b45df34212248a7c`; Sites returned `succeeded`.
- Vendor/item tooltips dismiss despite retained mouse-click focus; unrelated pointer exits cannot prolong the primary card's grace. Keyboard inspection and nested explanations remain available.
- Skill atlas cards wait 350 ms per node, retain immediate highlights/routes, allow 200 ms exit grace and dismiss on dragging/zooming. Reduced motion keeps the intent delay without animation.
- All 22 focused tooltip, comparison, keyboard, route and changelog checks passed, along with application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation. No automated browser gameplay was run.
- Existing local/cloud characters remain compatible; no save reset, skill refund or D1 migration. Reload existing clients.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.5.2 / Sites version 52, publicly deployed on 2026-09-14 at 06:10:53 UTC.
- Published source: `1843cf63efda3f643b170eaa3fb66088a92902d1`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_3377ce2ed1088191804f89d285a56062`.
- Deployment: `appgdep_6aa78fdd9e1c8191b1e78ba4b761ed50`; Sites returned `succeeded`.
- Covers merged PRs #13, #14, #15, #19, #21, #24, #25, #27, #18, #20, #26, #17, #30 and #28: sell values, stable drag previews, Fire Staff pose, Heartwood Draw switching, event progress, mana feedback, map symbols/recentering, remappable loot reveal, live Tab map, cursor settings, equipment comparisons and the frosted pause menu.
- Ran 1,450 code tests: 1,448 passed initially. Added the event-progress module to the explicit core compiler check and updated the old staff-grip assertion for Fire Staff's relaxed arm; all 17 architecture, rig and changelog checks then passed.
- Application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation passed. No automated browser gameplay was run.
- Existing local/cloud characters remain compatible; no save reset, skill refund or D1 migration. Reload existing clients.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.5.1 / Sites version 51, publicly deployed on 2026-09-13 at 17:02:41 UTC.
- Published source: `b0769a7f0dcc0a626db062ae220d0db700627bba`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_d6deee73817c81919f3cc0c17a759cfd`.
- Deployment: `appgdep_6aa6d71e9a388191a38bdd0009f59d61`; Sites returned `succeeded`.
- Seven reserving auras, rank investment, reserved mana orb, shared player/target effects and nested item/stat/skill/Unique explanations.
- Eighteen Uniques total, compact Unique markers, skill-led powers and lower weapon/support mana costs.
- Keyboard/mouse remapping with alternate bindings, conflict replacement, per-device persistence and live shortcut labels.
- Audit fixes for continuous boss slows, immediate ward/barrier limits after maximum-life changes and keyboard ownership while inspecting effects; includes the merged mobile pinch-zoom correction.
- All 1,403 combined code tests passed. After merging the CSS-only mobile fix and updating notes, all 19 affected touch, effect-keyboard and changelog checks passed.
- Application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation passed. No automated browser gameplay was run.
- Existing local/cloud characters remain compatible; no save reset, skill refund or D1 migration. Reload existing clients.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.5.0 / Sites version 50, publicly deployed on 2026-09-13 at 10:13:45 UTC.
- Published source: `ea9824504ab25d0711d917519d2782bf1d77b37b`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_c238f9fe20f88191824dd8f6bdbe0355`.
- Deployment: `appgdep_6aa6774d7150819180087279762cec02`; Sites returned `succeeded`.
- Compact square HUD, equipped-weapon art, stained-glass icons for all 30 skills, separate utility medallions and a focused navigation menu.
- Inventory footer integrates resources and skill slots, with right-click assignment/clearing and left-click atlas details through saved character commands.
- All twelve skill-changing Uniques, equal Unique/Legendary drop chances, level-scaled fixed affixes and the Chronicles collection.
- Ran 1,347 code tests: 1,344 passed initially. Updated the renderer fixture for opaque Path2D icons and the current Q/Space labels, and corrected the release timestamp format. All 21 affected renderer, HUD, assignment and changelog checks then passed.
- Application/core type checks, local and cloud-enabled client/Worker builds, archive contents and clean-source release validation passed. No automated browser gameplay was run.
- Existing local/cloud characters remain compatible; no new reset, tree refund or D1 migration. Reload existing clients.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.4.0 / Sites version 49, publicly deployed on 2026-09-13 at 06:19:47 UTC.
- Published source: `25f6c547196fbfc836bf3ffb8c1d8ee7b5664771`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_cdb5f10c8f908191a963306320000ea8`.
- Deployment: `appgdep_6aa640720c948191abfdf2cb3766ee09`; Sites returned `succeeded`.
- Connected 1,824-node atlas, 144 passive neighborhoods, stronger passive rewards, distinct cluster shapes and grouped stat search with visible match markers.
- Preserves 30 active skills, 90 Techniques and twenty ranks. Valid preceding trees receive a one-time node/rank refund and reopen the atlas for rebuilding; character and world progress remain.
- Item-sized vendor/buyback trays, category tabs, saved escalating restock fees, enhancement/enchanting workbenches and direct drag/double-click trading.
- Ran all 1,312 code tests: 1,308 passed initially. Added the new shape and preceding-tree data modules to the explicit core compiler list, then both architecture checks passed. Two cloud-worker timeout cases and their parent test passed in the isolated 38-check cloud suite.
- Application/core type checks, local and cloud-enabled client/Worker builds, archive contents and clean-source release validation passed. No automated browser gameplay or account-save edits were performed.
- Client and Worker share the save upgrade rules; no D1 migration required. Reload existing clients.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.17 / Sites version 48, publicly deployed on 2026-09-12 at 18:15:31 UTC.
- Published source: `45f5320ed55f82ff4397427a04090205c68c1cfc`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_289300146e888191aa505bb044d5caea`.
- Deployment: `appgdep_6aa596b1e8b48191812ad1609614563a`; Sites returned `succeeded`.
- All 30 active skills now support 20 purchased ranks with +5% base damage and +1.5% base mana per additional rank; 90 Techniques retain their choices.
- Smaller movement, ward, guard, stance and shelter gains remain useful through all ranks; defensive previews retain fractional improvements.
- Current-tree saves retain purchases, assignments and progress, with gentler early-rank tuning; no additional refund, reset or database migration. Matching game and cloud validators shipped together.
- Ran the 1,293-test code suite; corrected two obsolete combat expectations and passed all 49 focused retests. Cloud timeout failures passed all 38 checks when rerun separately. Three release-note checks, application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation passed. No automated browser gameplay was run.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.16 / Sites version 47, publicly deployed on 2026-09-12 at 16:38:50 UTC.
- Published source: `fca34cec89f92521699c1a5e07089bf1f7638152`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_0ff1f1e3ea308191a4107357d7cd9024`.
- Deployment: `appgdep_6aa58007d9e0819181bc876bb06a9014`; Sites returned `succeeded`.
- Six-territory atlas with 875 nodes, 90 passive specialties, 30 active skills, 90 Techniques, eight Doctrine families and four optional keystones.
- Movement/defensive/ultimate additions, gentler purchased ranks, utility-rank scaling, armor scaling, independent shelter expiry and corrected echo/Spellweave behavior.
- Smoother routes, spaced skill medallions and captions that avoid nodes, connectors, other text and navigation controls.
- Valid preceding-tree saves receive a free one-time node/rank refund. Continue opens the atlas at its root with details visible and gameplay paused; players unlock and reassign skills. Character/world progress is preserved; no database migration. Unsupported saves remain stored.
- Passed all 1,291 code tests, application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation. No automated browser gameplay was run.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.15 / Sites version 46, publicly deployed on 2026-09-12 at 09:40:10 UTC.
- Published source: `540b537389af0295f9ffdae0842e41568d473655`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_0c005ec067a88191ad80147217759b2b`.
- Deployment: `appgdep_6aa51de7a11c81919833484cbb82ce1b`; Sites returned `succeeded`.
- Cloud creation rejects unresolved slots; confirmed deletion retains recovery until server acknowledgement and can clear unreadable legacy checkpoints while preserving recoverable Chronicle history.
- Active-character save status, persistent failed-device-save warnings, and actionable deletion errors.
- Higher Legendary monster drops, 5% regular dungeon boss-chest and 10% wilderness boss-hoard Legendary chances, with a Rare-or-better first dungeon boss reward.
- No automatic character reset or database migration. Existing clients need a reload; no individual account was modified or authenticated gameplay tested during publication.
- Passed all 1,260 code tests in the implementation checkpoint, three release-note checks, application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.14 / Sites version 45, publicly deployed on 2026-09-11 at 16:19:43 UTC.
- Published source: `54b064943f8862a5a2dffcaf837d36964048dadc`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_205791b7c89881919272ce7d570388ff`.
- Deployment: `appgdep_6aa42a0dd7e4819188616ddffc283d9f`; Sites returned `succeeded`.
- Greater-affix stars, wider roll quality, bounded offensive attributes and one free attribute reset per character.
- Tapered equipment-rank damage, later elite durability, wider Shattered Sky coverage and corrected authored fire burns.
- The discarded same-target repeat penalty is excluded: every connecting projectile and impact deals full resolved damage.
- Existing characters retain progress; item bonuses reprice on validated load. Matching client/Worker rules shipped together; no save reset or database migration.
- Passed all 1,235 code tests, application/core type checking, cloud-enabled client/Worker build, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.13 / Sites version 44, publicly deployed on 2026-09-11 at 13:52:33 UTC.
- Published source: `97753ec961415fedf661ac883c2337ff9760017b`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_0aab0d5768ac81919036f987c919bf6d`.
- Deployment: `appgdep_6aa4078fed54819185dd19bb92dd296e`; Sites returned `succeeded`.
- Halved Intelligence mana, tapered equipment/charm mana budgets, whole per-five-second regeneration rolls, tapered cost reduction and source-level mana vials.
- Existing item resource bonuses update on validated load; characters and progress are preserved. Matching client/Worker rules shipped together; no save reset or database migration.
- Damage, enemy stats and potion fractions remain unchanged. Repeatable 28-build / 84-encounter benchmarks and recovery-source accounting support subsequent tuning.
- Passed the 1,211-test implementation suite, eight final resource/regression checks, three release-note tests, application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.12 / Sites version 43, publicly deployed on 2026-09-11 at 09:21:41 UTC.
- Published source: `950fe47730186739a40e14a93996132304280bb5`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_2bfde87903088191876beee66c9bff18`.
- Deployment: `appgdep_6aa3c81712cc8191879cf7cbc19d994d`; Sites returned `succeeded`.
- Lighter quick elite basics, faster ranged preparation, later melee aim commitment and shorter elite/boss recovery.
- Distance-aware boss choices and alternating jabs/bolts, varied attack rhythms, correct Warden aim-lock warnings and idle-rally fallback.
- Existing characters and progress are preserved; no save reset or database migration.
- Passed the 1,203-test implementation suite, 11 final pressure/audit regression checks, three release-note tests, application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

- Game v0.3.11 / Sites version 42, publicly deployed on 2026-09-11 at 09:00:10 UTC.
- Published source: `574e476af71778a8a0f791c6e778f19a481990e2`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_db80af23800c81918d8a9ecbfa927282`.
- Deployment: `appgdep_6aa3c306ae5481918c5bfd4efbc8f9df`; Sites returned `succeeded`.
- Level-scaled wilderness packs up to 14–20, varied elite escorts, stronger elite/boss damage and recovery, bounded repeated control and Arc Lightning healing.
- Normal kills drop one third fewer common equipment items; retained charms and higher-tier items keep their original rolls. First-kill and authored reward guarantees remain intact.
- Distinct charm nameplates, compact loot labels, Always/Hold Ctrl visibility options, and complete item rendering in inventory/vendor grids.
- Existing characters and progress are preserved; no save reset or database migration.
- Passed all 1,196 code tests, application/core type checking, local and cloud-enabled client/Worker builds, archive validation and clean-source release validation.
- This publication record is a documentation-only checkpoint after the deployed source above.

## Previous verified publication

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
3. Prepend a versioned, timestamped release entry in `CHANGELOG.md`. Use **New**, **Tweaks**, and **Fixes** (omit empty sections). Lead with exciting features and meaningful balance changes; describe bugs in terms of what players experienced. Reserve warning notices for save resets or required player actions such as rebuilding skills. Omit routine save-preservation and refresh reminders; keep informational changes in ordinary bullets. Historical development-recap labels remain neutral text. Explicitly call out save resets. Use short factual bullets, ideally one line each. No themed titles or promotional copy. Increment the patch version for each publication under the prototype policy above; record its UTC preparation time, displayed in Europe/Paris time in the reader.
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
