# Local development tools

Open **http://127.0.0.1:5173/tools/** (`/tools` also resolves) while `npm run dev` is running. This is the canonical entry point for development reviews. It groups existing reviews into Equipment, Characters, Skills & Combat, World, Interface and Data & Audits, with historical concepts in Archive. Search finds tools by purpose. A workspace mounts only one review at a time; moving between tabs unloads its renderer and memory state. Standalone reviews have Tools home / Open in workspace navigation.

The hub and review HTML are outside the production build entry graph and outside `public/`. Do not add them to Sites or Android builds. No publication is required for local tools. Review changes use staged, memory-only characters; they never load or edit playable saves. The game itself remains `/`.

## Adding a tool

1. Prefer extending the appropriate workspace and existing shared review over another disconnected page.
2. Put new tool implementation in `game/src/tools/` and HTML under `game/tools/`. Keep runtime content/formulas authoritative; do not copy balance tables.
3. Register the view in `game/src/tools/catalog.ts`, with a clear task name, workspace, route and searchable description.
4. Import `review-nav.ts` from its HTML for standalone navigation. A review can use query parameters for secondary states; use a distinct registry entry only for a useful primary task.
5. Own/dispose renderers, worlds, event listeners and animation frames on teardown. Pause hidden animated reviews, bound simulation work and never connect tools to character persistence.
6. Verify type checking, relevant headless tests and production exclusion. Gameplay testing stays with the player.

Existing HTML URLs remain useful direct entries to the same implementations, not duplicate tools. The hub embeds those implementations instead of copying them. Narrow services, editor phone mockups, speech and skill atlas are named modes of their owning workspaces. Historical HUD alternatives stay in Archive.
