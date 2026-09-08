# Player-facing release notes

`CHANGELOG.md` is the single source for both the repository changelog and **What's new** in the character hall. The reader bundles it into the game; no save, login, network request or external Markdown renderer is involved. Android includes the same reader when its next APK is built.

## Last verified publication

- Game v0.6.2 / Sites version 24, publicly deployed on 2026-09-08 at 06:16:57 UTC.
- Published source: `0035eca3521bbd0684524377429de8497f2d0e1c`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_b4e3d63c272c819183a56e1d32658633`.
- Deployment: `appgdep_6a9fa84be47c81919cbb66e27fce92e4`; Sites returned `succeeded`.
- Removed the leaderboard eyebrow, subtitle and promotional footer copy, with a more compact heading.
- Passed three changelog checks, type checking, the cloud-enabled client/server build and release validation.
- No persistence or schema changes. The preceding v0.6.1 publication verified gear scores for all 89 existing Cloud characters.
- Authenticated cross-device save/Chronicle acceptance remains a player check.

## Before each requested Sites publication

1. Resolve the source of the last **successful publication** from the Sites history/current release record. A saved version alone is not proof of publication. For the initial changelog release the known published baseline is `1978bf9d210533cb83b11c8c9863e766f7c13562` (Sites version 14).
2. Read the commits and relevant implementation since that source. Summarize what players can actually experience; omit internal refactors, unpublished experiments and changes later reverted.
3. Prepend a versioned, timestamped release entry in `CHANGELOG.md`. Use **New**, **Tweaks**, and **Fixes** (omit empty sections). Lead with exciting features and meaningful balance changes; describe bugs in terms of what players experienced. Explicitly call out save resets. Use short factual bullets, ideally one line each. No themed titles or promotional copy. Increment the version for each publication; record its UTC preparation time, displayed in Europe/Paris time in the reader.
4. Validate the reader, run appropriate code tests and the production Site build. Commit the notes alongside the exact release source, and push the checkpoint to origin.
5. Run `npm run release:check -- <full-last-published-source-sha>`. It checks the format, requires a clean committed tree, and rejects a changed build whose newest notes are unchanged from that publication. Re-publishing the identical source can reuse its existing notes; do not invent gameplay changes.
6. Follow the Sites skills: push the exact source to its bound repository, package that build, save the version and publish to the requested existing audience. Verify deployment success before saying it is live. On failure, preserve the prepared notes and retry the same release rather than creating a second entry.

The changelog starts with three retrospectively numbered entries (v0.1.0–v0.3.0); these are game versions, separate from Sites snapshot numbers. Historical recap timestamps use the last checkpoint that day; v0.3.0 uses the verified September 7 publication time. September 5 and 6 are explicitly marked development recaps reconstructed from Git history, not claims of individual deployment dates. The September 7 release summarizes changes since the known version-14 baseline.

## Supported file format

- `## vX.Y.Z — YYYY-MM-DDTHH:mm:00Z` starts an entry. Use a unique version and UTC timestamp, newest first. No release title.
- `### New`, `### Tweaks`, `### Fixes` start nonempty sections.
- Each bullet is one line starting with `- `. `**Bold**` is supported; all other content is escaped as text.
- `> Notice` adds a short release note, such as a save warning or historical-recap label.
- Keep the introduction above the first release. No raw HTML, links, embedded media or arbitrary Markdown are interpreted.

`changelog.ts` owns strict content parsing; `changelog-panel.ts` owns display, focus trapping, scrolling and controller handling. The title screen suspends its focus trap while the reader is open and restores focus to What's new when it closes. Escape, B and native Back close the reader before any other menu action. Gameplay and character storage remain untouched.
