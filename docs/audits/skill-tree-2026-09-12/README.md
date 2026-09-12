# Skill tree research evidence

These are static research artifacts for the [September 12 redesign proposal](../../skill-tree-redesign-proposal.md), not runtime content or a playable review.

- `current-tree.json`: runtime graph statistics, shortest routes, exact plotted coordinates/connections and shared-resolver rank comparisons.
- `sources.json`: the local source SHA and the exact GGG export revisions retrieved for the comparison. Full external exports are not copied into this repository.
- `current-tree.svg` / `.png`: plot of the actual runtime graph. It omits game rendering and is not a screenshot of the atlas UI.
- `proposed-atlas.svg` / `.png`: schematic territory relationships and possible cluster structures. This is not a validated allocation graph or final art mockup.
- `render-diagrams.mjs`: standalone figure generation, using the runtime audit data for the current-tree plot.

From the repository root:

```sh
node --experimental-strip-types game/scripts/skill-tree-audit.ts > docs/audits/skill-tree-2026-09-12/current-tree.json
node docs/audits/skill-tree-2026-09-12/render-diagrams.mjs
```

The SVGs have a square canvas for reliable macOS Quick Look rasterization, with the figure positioned inside it. The checked PNGs are the central 1400×1000 region of a 1400-pixel Quick Look raster. Regenerate PNGs after changing SVGs; inspect both outputs before replacing them.

The script performs no simulation and never reads or writes playable saves. Running it against a later source revision produces new measurements; it does not retrospectively update the source revision or historical conclusions of this report.

## Local implementation snapshots

- `rebuilt-tree.json`: initial six-recommendation implementation, 573 nodes / 602 connections / 74 groups.
- `polished-tree.json`: subsequent navigation and visual refinement, 791 nodes / 838 connections / 110 groups. Adds 36 hybrid gardens while retaining all active unlock distances. This is graph evidence; inspect the actual rendering at `/character.html?panel=skills&zoom=overview&map`.

Keep these dated measurements separate from the original `current-tree.json` research baseline.

- `balanced-tree.json`: preceding balance pass, 841 nodes / 894 connections / 114 groups, with 30 skills and 90 Techniques.
- `outer-route-tree.json`: outer-route geometry refinement, 875 nodes / 932 connections / 120 groups. Six optional late clusters add 34 nodes; active unlock distances remain unchanged. This is the current graph snapshot; the preceding balance measurements retain their original graph scope.
