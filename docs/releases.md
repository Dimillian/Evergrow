# Player-facing release notes

`CHANGELOG.md` is the single source for both the repository changelog and **What's new** in the character hall. The reader bundles it into the game; no save, login, network request or external Markdown renderer is involved. Android includes the same reader when its next APK is built.

## Last verified publication

- Game v0.9.0 / Sites version 28, publicly deployed on 2026-09-08 at 19:19:56 UTC.
- Published source: `87d3172333451b9c3b8ed1aefd0b32bb462b0bf1`.
- Saved version: `appgprj_6a9c702e88608191a86a8a753f552b44~appgver_0bfdf63d6b9881919cf9e715ef473a61`.
- Deployment: `appgdep_6aa05fcf6e048191abbfbb80bb502469`; Sites returned `succeeded`.
- Three dungeon themes, compact 7–9-room floors with winding passages, two optional chamber events and automatically opening event treasure.
- Shared event approaches and body-sized navigation reduce distant or stranded reinforcements.
- Dungeon layout version 4 deliberately rejects older expedition payloads. Characters containing older saved expeditions require a fresh character; existing saves remain stored. Characters without an older expedition are unaffected. Client and Worker validators were published together; no database migration.
- Passed 1,032 code tests, three release-note checks, type checking, the cloud-enabled client/Worker build, archive validation and clean-source release validation. Dungeon workshop remains local-only and excluded from the production archive.

## Previous verified publication

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
