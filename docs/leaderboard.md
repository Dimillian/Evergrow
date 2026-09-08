# Home and cloud character leaderboard

Published in v0.6.0, with automatic gear backfill in v0.6.1 on 2026-09-08. Public verification confirmed all 89 existing Cloud characters have gear scores after backfill.

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

`GET /api/cloud/leaderboard?order=level|gear` queries the compact D1 projections only. It returns at most 100 leaders plus eight owned entries, including positions and total character count. Only missing gear scores trigger bounded reads of existing R2 saves: up to eight records per request, with two reads in flight. Completed scores use D1 only. Requests carry no-store headers and account matching applies to authenticated readers. The UI caches each sort for 30 seconds and loads on opening/switching; while a backfill is pending, the open board refreshes every two seconds until it finishes. Closing the board cancels refreshes. It never flushes the save queue or requests rankings during gameplay.

Additive migration `0002_amazing_old_lace.sql` seeds existing names and levels from stored summaries. Migration `0003_blue_mercury.sql` adds a retry timestamp for the server-side gear backfill. Older scores are calculated from stored equipment recipes without requiring the character to return. Claims prevent duplicate reads; updates check both revision and object identity so a concurrent save or deletion wins. Missing or malformed objects retain an unknown score and retry after five minutes, without blocking other rows. Scoring validates equipment independently of historical world/chart versions. Save payloads, revisions, timestamps, history and local databases are unchanged. Unknown scores sort last.

The server validates save structure and derives the displayed score, but progression is still client-simulated. Removing cloud file transfers does not make this an authoritative or cheat-proof competitive system. See the [save integrity review](cloud-save-integrity.md) for confirmed gaps and the proposed hardening order.

## Review and verification

`/title.html?cloud&full&home=leaderboard` uses clearly labelled sample characters with multiple owned rows. `home=chronicle` and `home=changelog` stage the other destinations. These previews use memory-only fixtures and no live leaderboard, gameplay input or save requests.

Tests cover public field isolation, multiple characters from one account, ranking sorts/top-100/own positions, deletion, stale/failed saves, additive backfill and recipe-based gear scoring. Production client and Sites worker builds must pass before publication. Publishing requires the matching migration and server/client together; v0.6.0 deployed the matching migration, server and client together.
