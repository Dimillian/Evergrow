# Player-facing release notes

`CHANGELOG.md` is the single source for both the repository changelog and **What's new** in the character hall. The reader bundles it into the game; no save, login, network request or external Markdown renderer is involved. Android includes the same reader when its next APK is built.

## Before each requested Sites publication

1. Resolve the source of the last **successful publication** from the Sites history/current release record. A saved version alone is not proof of publication. For the initial changelog release the known published baseline is `1978bf9d210533cb83b11c8c9863e766f7c13562` (Sites version 14).
2. Read the commits and relevant implementation since that source. Summarize what players can actually experience; omit internal refactors, unpublished experiments and changes later reverted.
3. Prepend a dated release entry in `CHANGELOG.md`. Use **New**, **Tweaks**, and **Fixes** (omit empty sections). Lead with exciting features and meaningful balance changes; describe bugs in terms of what players experienced. Explicitly call out save resets. Keep bullets concise, with bold phrases only for useful scanning.
4. Validate the reader, run appropriate code tests and the production Site build. Commit the notes alongside the exact release source, and push the checkpoint to origin.
5. Run `npm run release:check -- <full-last-published-source-sha>`. It checks the format, requires a clean committed tree, and rejects a changed build whose newest notes are unchanged from that publication. Re-publishing the identical source can reuse its existing notes; do not invent gameplay changes.
6. Follow the Sites skills: push the exact source to its bound repository, package that build, save the version and publish to the requested existing audience. Verify deployment success before saying it is live. On failure, preserve the prepared notes and retry the same release rather than creating a second entry.

The changelog starts with three daily entries. September 5 and 6 are explicitly marked development recaps reconstructed from Git history, not claims of individual deployment dates. The September 7 release summarizes changes since the known version-14 baseline.

## Supported file format

- `## YYYY-MM-DD — Short release title` starts an entry. Newest entries go first; multiple releases on the same date need different titles.
- `### New`, `### Tweaks`, `### Fixes` start nonempty sections.
- Each bullet is one line starting with `- `. `**Bold**` is supported; all other content is escaped as text.
- `> Notice` adds a short release note, such as a save warning or historical-recap label.
- Keep the introduction above the first release. No raw HTML, links, embedded media or arbitrary Markdown are interpreted.

`changelog.ts` owns strict content parsing; `changelog-panel.ts` owns display, focus trapping, scrolling and controller handling. The title screen suspends its focus trap while the reader is open and restores focus to What's new when it closes. Escape, B and native Back close the reader before any other menu action. Gameplay and character storage remain untouched.
