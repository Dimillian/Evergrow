# Home and cloud character leaderboard

Published in v0.6.0, 2026-09-08. A public endpoint check confirmed 89 existing Cloud characters after the migration.

## Player experience

The home has four destinations: **Characters**, **Chronicle**, **Leaderboard** and **What’s new**. Characters remains the default, with the roster and Continue/Create action together. Chronicle and release notes open inside the shared home frame; in-game Chronicle retains its modal presentation. The latest unread release has a small dot. Home, Chronicle, ranking rows and release tabs use square corners, matching the vendor selling controls.

Every non-deleted Cloud character automatically appears in the rankings. Multiple characters belonging to the same account can rank independently. Public rows show only character name, level, equipped gear power and rank—never the account name, identifier, slot, save object, inventory or character payload. Your own rows receive a quiet highlight; your characters outside the top 100 appear below the list. Duplicate character names are allowed.

Choose **Level** or **Gear power**. The other metric breaks ties, then internal owner/slot keys ensure stable ordering without being exposed. The count is characters, not accounts. Local and Android saves do not participate; their home omits Leaderboard. A Sites visitor can view rankings without signing in. Cloud import/download remains disabled; local browser file transfers remain available.

Keyboard arrows switch home destinations when a navigation button is focused. Controller LB/RB switch destinations; B returns to Characters, A activates controls, and the right stick scrolls library content. On the roster, selecting a character and pressing A still continues it.

## Gear power

`leaderboard.ts:equippedGearPower` re-derives each equipped item's existing power from its recipe, sums eleven slot equivalents and rounds their average to a whole number. Empty slots contribute zero; a two-handed weapon contributes twice because it occupies both hands. Bag contents, allocated attributes and skill points do not inflate the score. Item level, rarity, material, affixes and enhancement contribute through the shared item derivation. This is an equipment-quality measure, not a promise that two builds deal equal damage.

The character hall uses this same **Gear power** label and calculation. The older combat/build estimate remains separate where it is still used.

## Persistence and cost

The accepted cloud save transaction updates `rank_name`, `rank_level` and `rank_gear` alongside the revision-checked R2 pointer and Chronicle summary. No additional save requests are introduced. Failed uploads, stale writers and deleted characters cannot publish a new ranking. Deletion clears the public projection in the same transaction.

`GET /api/cloud/leaderboard?order=level|gear` queries the compact D1 projections only. It returns at most 100 leaders plus eight owned entries, including positions and total character count. It never loads R2 save files to render the board. Requests carry no-store headers and account matching applies to authenticated readers. The UI caches each sort for 30 seconds and loads on opening/switching; it does not poll, flush the save queue, or request data during gameplay.

Additive migration `0002_amazing_old_lace.sql` seeds existing names and levels from stored summaries. Old summaries lack equipped gear power: these rows show **—** until the character next saves, at which point the shared score is computed. They still participate immediately by level; unknown gear scores sort last. Existing save payloads and local databases are unchanged.

The server validates save structure and derives the displayed score, but progression is still client-simulated. Removing cloud file transfers does not make this an authoritative or cheat-proof competitive system. See the [save integrity review](cloud-save-integrity.md) for confirmed gaps and the proposed hardening order.

## Review and verification

`/title.html?cloud&full&home=leaderboard` uses clearly labelled sample characters with multiple owned rows. `home=chronicle` and `home=changelog` stage the other destinations. These previews use memory-only fixtures and no live leaderboard, gameplay input or save requests.

Tests cover public field isolation, multiple characters from one account, ranking sorts/top-100/own positions, deletion, stale/failed saves, additive backfill and recipe-based gear scoring. Production client and Sites worker builds must pass before publication. Publishing requires the matching migration and server/client together; v0.6.0 deployed the matching migration, server and client together.
