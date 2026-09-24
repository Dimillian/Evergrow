# World difficulty

Per-character difficulty is available from the crest in the minimap and **Escape → Adventure → World difficulty**. Players can inspect the tiers anywhere and change them while alive in an overworld sanctuary. The game pauses in the selector; changing the tier persists before modifying live state. Defaults to Normal for new and existing characters. No progress reset.

Escape, controller Back and the close button return to the entry point: opening from the minimap resumes gameplay, while opening from the pause menu returns to Adventure with World difficulty focused. The footer names that destination. Closing is held while a difficulty change is saving.

| Tier | Monster life | Monster damage | Kill/trial XP | Combat treasure gold | Epic/Legendary/Unique loot weight |
| --- | --- | --- | --- | --- | --- |
| Normal | ×1 | ×1 | ×1 | ×1 | ×1 |
| Veteran | ×1.6 | ×1.25 | ×1.2 | ×1.25 | ×1.2 |
| Nightmare | ×2.6 | ×1.55 | ×1.45 | ×1.6 | ×1.45 |
| Cataclysm | ×4 | ×1.9 | ×1.75 | ×2 | ×1.75 |

`world-difficulty.ts` owns these initial playtest values. Health grows faster than damage to give strong builds more resistance without multiplying incoming burst as aggressively. Attack timing, AI, population, monster/source levels, equipment power, potion rules and item-roll counts are unchanged. Quality multiplies Epic+ rarity weights before normalization, not drop chance by percentage points. A table consisting entirely of Epic+ remains unchanged. Legendary/Unique parity and authored minimum rarities remain intact. Existing common-item suppression still applies. Vendors, fixed Journey bonuses and breakable-container gold are unchanged.

All runtime monsters, including bosses, camp members, trial guardians, dungeon waves and rift packs, use `applyEnemyModifiers`; difficulty composes with rank, rift/expedition affixes and rank traits. Monster XP and reward difficulty snapshot with each actor. Combat drops, trial/camp/boss treasure, ordinary dungeon chests and expedition/rift rewards use their encounter's reward tier. Rift keys still follow their own tier distribution.

## Changing tiers and saving

- A change never respawns dead enemies, rerolls levels, clears treasure receipts or heals the player.
- Stored actor, dungeon-member and trial-guardian HP is in Normal-equivalent units. Restore multiplies by the current health factor, preserving the same wounded fraction across tier changes.
- Already-started encounters retain the lowest tier used. Raising difficulty cannot improve their rewards retroactively. Lowering it caps future rewards from surviving actors, camp baselines, active/paused trials and unfinished dungeon runs.
- Each chest freezes its own reward tier when delivery begins, so partial claims remain deterministic even if another chamber is unfinished and the player changes difficulty in town.
- Reward caps persist in actors, encounter scales, event records and dungeon runs. Optional missing fields mean Normal. Existing version-4 saves remain readable; validation rejects unrecognized tiers.
- Rebuilding the simulation after the durable change clears transient combat actions and refreshes hidden encounter caches; the world, player resources, exploration and completed content remain intact.

## Presentation and review

`world-difficulty-art.ts` builds four distinct forged crests from shared `GearShape` polygons and the equipment metal renderer. The same SVG is used for selection cards and the minimap shortcut. The minimap crest sits opposite Home inside the chart, above the clock footer. Touch layouts that hide desktop minimap targets retain the pause-menu route.

`world-difficulty-panel.ts` owns selection, saving/failure feedback and keyboard/controller-compatible buttons. Runtime actions stay in `world-difficulty-command.ts`. The local **World difficulty** view in the Progression workspace (`/progression.html?view=difficulty`) uses this same panel with disposable state and level-50 reference values; it never accesses playable saves.

Headless coverage: default equivalence, all ranks and bosses, save-before-commit failure, health persistence, reward caps, partial chest receipts, rift stacking, rarity distributions, trial rewards, badge geometry and minimap placement. Gameplay balance remains for user playtesting.
