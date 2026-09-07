# Character editor feasibility

2026-09-07 · Analysis and proposed design, not implemented. Based on source checkpoint `1978bf9`; work branch: `character-editor`.

Follow-up: a [save-free MVP mockup](character-editor-mockup.md) now explores the appearance controls with the real rig. The user excluded height and body-proportion changes from that mockup. Live creation and save integration remain proposed.

## Assessment

A creation-time character editor is highly feasible within the existing procedural Canvas engine. The hall, inventory portrait and world already share one articulated character renderer. A selected hairstyle can follow existing movement, attacks, casting, dodging and defeat transforms without a separate set of animation sprites. No engine replacement, external art dependency or gameplay-system rewrite is needed for the initial appearance controls.

The missing foundation is a persistent character appearance recipe and separate body/head/cosmetic drawing layers. Current appearance is largely hard-coded inside equipment rendering. Colors are inexpensive to add; new silhouettes require authored geometry, facing rules and equipment overlap checks. Substantially different body proportions are a larger undertaking because equipment and hand placement assume one rig.

This is a source-based assessment. No new visuals, performance measurements or gameplay acceptance are claimed.

## What exists today

- `CharacterSheet` in `game/src/character-types.ts` stores gear and progression but has no personal appearance. `Item.appearance` describes equipment materials; it must remain separate from skin, hair and facial features.
- `game/src/equipment-art.ts:headArmor` draws the neck, face, eyes, one brown hairstyle and the helmet together. Skin uses several literal colors. Hair draws only when the head equipment piece is null. Front/rear behavior and lateral facial offsets exist, but there is no catalog of faces or hairstyles.
- `game/src/player-art.ts` assembles legs, cloak, torso, arms, head and held equipment. Clothing colors and widths are partly literal. `gauntlet` still uses a leather fallback when gloves are absent, so removing equipment does not currently expose a customizable bare body.
- `game/src/character-motion.ts:PLAYER_ATTACHMENTS` defines a single set of head, chest, shoulder and hip anchors. `player-arm-rig.ts` solves the arms; armor follows those joints. This is useful infrastructure for modular appearance, but does not yet provide body presets.
- `game/src/character-pose.ts:playerPose` supplies gameplay appearance. `character-portrait.ts:drawCharacterPortrait` uses that same pose and renderer for hall and inventory. `character-framing.ts` already fits the full equipped figure; its body envelope is fixed and must include larger hair/accessories.
- `game/src/title-screen.ts` creates characters from name, starter loadout and world seed. Changing gear or rerendering selection recreates the preview player. A new appearance draft must survive those operations. Its current preview has a fixed facing.
- `game/src/items.ts:createCharacterSheet` equips a Worn Leather Hood on every new character. The hall hides `.title-hero` at widths of 1,050 pixels or less, or heights of 600 pixels or less. Merely adding controls to that form would leave many players editing an invisible, hood-covered head.
- `game/src/game.ts:createCharacter` creates a fresh sheet, captures it and awaits `CharacterSession.create` before entering play. The checkpoint contains the full sheet, and save validation is centralized in `character-save.ts`.

## Options and relative effort

These are engineering estimates relative to this code, not delivery promises. Initial infrastructure is shared across the options.

| Option | Feasibility / effort | What needs authoring or adjustment |
| --- | --- | --- |
| Skin colors | High / low | Curated base, shadow, highlight and feature palettes; apply to neck/face and any exposed hands, keeping fabric separate. Check all tones under world lighting. |
| Hair and facial-hair colors | High / low | Separate hair palettes with stable IDs. Recolor shared geometry without duplicating each hairstyle. |
| Short hair, shaved head, bob, bun | High / medium | Head-local shapes with front/side/rear treatment, scalp coverage and helmet rules. Bald heads need real rear scalp shading; the current dark head base cannot simply remain. |
| Long hair, braids, ponytails | High / medium–high | Rear and foreground sections, cloak/shoulder overlap, bounded movement and expanded bounds. Start with simple anchored motion rather than hair physics. |
| Beards and moustaches | High / medium | Face-local silhouettes, side/rear suppression and clipping/visibility rules for cheek armor. |
| Eye colors, scars, freckles | High technically / low–medium | Small facial details, primarily valuable in the enlarged editor. Their readability in the world is limited by the tiny face and display treatment. |
| Earrings, hair ornaments, eyepatches | High / medium | Named attachment points, facing-aware depth and rules for helmets/hair. Small jewelry may only read clearly in portraits. |
| Base clothing colors | High / low–medium | Separate cloth palette from skin and equipped item materials. Equipped armor continues to cover the base outfit. |
| Masculine/feminine presentation or other body presets | High / medium–high for restrained presets | Authored faces and torso/hip contours, then fit cuirass, shoulders and clothing to them. Share joint positions and limb lengths initially. A gender label alone cannot produce a different silhouette. |
| Height, weight and limb-length sliders | Possible / high | Parameterized rig and armor, grip constraints, framing and comprehensive pose validation. Visual changes must preserve gameplay reach and collision unless separately designed. |
| Capes, large hats and backpacks as cosmetics | Possible / medium–high | More substantial equipment conflicts, back/front layers and conservative world/portrait bounds. A cape equipment layer already exists. |

Allow hair, face and accessories to combine independently of a body preset. This supports different looks without multiplying separate character implementations. Prioritize silhouette, skin and hair over fine facial sliders: the head is only roughly eight local art units wide before renderer scaling.

## Proposed ownership and integration

| Owner | Proposed change |
| --- | --- |
| New `character-appearance.ts` | Headless appearance contract, stable part IDs, defaults and validation. Store one recipe on `CharacterSheet`; avoid free-form geometry or arbitrary unbounded accessory lists in saves. |
| New appearance content registry | Palette definitions, selectable parts, named anchors, conservative bounds and compatibility metadata. Keep Canvas dependencies out of headless contracts/validation. |
| New `character-head-art.ts` and cosmetic shape helpers | Extract skin/head/hair/face rendering from `headArmor`. Compose selectable shapes using the same facing and head transform. Retain armor geometry ownership in `armor-shapes.ts`. |
| `player-art.ts`, `equipment-art.ts`, `art-types.ts`, `character-pose.ts` | Carry appearance through the shared pose, resolve skin/cloth materials, and insert head/back/body cosmetics at the correct depth. Route colors through the existing hit-flash color function. |
| `character-framing.ts`, `character-portrait.ts` | Include cosmetic bounds without breathing-dependent scale changes; add head-focused and full-body preview framing. |
| `title-screen.ts` / `.css`, a focused editor component | Maintain a creation draft, appearance categories, color swatches, facing controls and a visible preview at desktop and handheld sizes. Reuse the shared UI kit and focus/navigation infrastructure. |
| `character-summary.ts`, `items.ts`, `game.ts` | Supply the same draft to preview and fresh-sheet creation. Copy/validate it before the first checkpoint; changing starter gear must preserve it. |
| `character-save.ts`, checkpoint/session and portable-save tests | Validate all part IDs and bounded combinations; verify appearance survives capture, restore, backup, slot switching and bundle import/export. Use the existing repository transaction. |
| Static review entries and relevant guides | Add appearance fixtures to the title/atelier/rig studies, update character art/save guides and document the implemented catalog. |

The data path should be: **creation draft → validated character sheet → saved checkpoint → shared pose → world and portraits**. Appearance must not modify attributes, gear stats, combat RNG, loot, hitboxes or attack timing. Cosmetic randomization should use an independent source, never the simulation or equipment random stream.

For creation-only editing, the existing session creation boundary is sufficient; no gameplay appearance command is needed. If later adding a barber or editing saved characters, add a validated, durable command through the existing character/application boundaries.

The Thor companion currently presents equipment/items/stats and tells players to select a character on the upper screen; it does not render a second character doll. The initial editor can live on the primary screen without extending the native bridge or giving the companion ownership of saves. Controller, touch and narrow-screen navigation still need deliberate UI work.

## Layering and headgear decisions

Separate the head into rear hair, skin/head, face details, front hair and head equipment, with explicit visibility/coverage rules. Long hair also needs a body-depth attachment pass so a ponytail cannot indiscriminately cover the near arm or disappear behind the torso. Check continuity between facing sectors, not just eight isolated poses.

For the first catalog, use per-part compatibility rules such as full hair when uncovered, restricted sections under open headgear, and covered hair under a hood. Accessories should identify their anchor and coverage category. Cosmetics do not occupy statistical equipment slots. Existing amulets/rings have no worn jewelry layer; making equipped jewelry visible would be a separate extension.

Recommended editor behavior: show the uncovered head by default while editing, with an equipped preview available. To make hair visible after creation, offer a persisted **Show headgear** appearance choice that changes drawing only. This is an editor/character control, not a restored global settings panel. Otherwise the equipped starter hood will intentionally conceal the selected style in play. This choice is proposed, not applied by this analysis.

## Saves and extensibility

Store palette/style IDs and a few bounded selections, not images or generated paths. The recipe should be only a small addition to existing checkpoints. Current cloning/storage already carries the whole sheet, but that does not replace explicit validation or round-trip tests. Adding catalog entries with the same recipe structure should not require a save-version change; retained IDs must keep their meaning.

For a clean implementation in this prototype, prefer a required appearance field and a deliberate save-version bump from v3 when the editor ships, updating callers and fixtures together. Under the current no-migration policy, that would make older v3 test characters incompatible and require new characters; preserve their stored records. This is a proposed schema policy, not a technical necessity for all possible designs. **This analysis changes no save format and resets no progress.**

Portable bundles and the Site server use shared save validation. A future schema change needs coordinated validation in those builds before cross-client use. There is no apparent need for a new database table or cosmetic upload service: the recipe fits inside existing character bundles. Publishing any updated Site remains a separate user-requested action.

After the shared foundation, a new color is a palette entry; a new hairstyle is a registered geometry recipe, bounds/coverage metadata and review fixtures. A genuinely new attachment or motion behavior can still require renderer code. Procedural generation offers many combinations, but a random seed alone does not create convincing new haircuts.

Keep shapes and motion bounded, build preview thumbnails only when needed, and avoid caching every combination. Additional geometry for one player is likely modest; actual desktop/Thor cost still needs measurement. Reuse the existing reduced-motion policy and Android title frame pacing.

## Suggested delivery sequence

1. Extract appearance/head rendering and introduce the validated recipe while preserving the current default look. Prove that gameplay and portraits consume the same choices.
2. Add the creation editor with skin/hair palettes, several visibly distinct hairstyles, facial hair and a small accessory catalog. A reasonable proposed starting target is 8 skin palettes, 8 hair colors, 6–8 hairstyles, 4 facial-hair choices including none, and 3–4 accessories. Final counts should follow visual quality.
3. Add two restrained body/face presets using common animation anchors, with masculine and feminine presentation available and all hair/accessory choices shared. Validate fitted armor across both before expanding proportions. If these presets are required for the first release, include this step in that release rather than shipping a label-only choice.
4. Expand long hair, additional accessories and clothing choices after the foundational overlap rules are proven. Treat free-form body sliders and large cosmetics as later scope.

Validation should cover malformed/unknown appearance IDs, independent drafts, gear changes preserving appearance, failed creation preserving the draft, save round trips and appearance-independent combat stats. Reuse the rig/character-art tests for finite geometry, attachment continuity and containment. Review representative combinations across eight facings plus transition angles, rest/walk/attack/cast/dodge/defeat, uncovered/leather/plate heads, cloaks and all supported hand configurations. Check world scale with the actual lighting/CRT as well as enlarged portraits.

Run the ordinary code/type/build checks for implementation. Visual review and player feedback establish whether the looks read well; automated gameplay/browser playtests remain outside the authorized scope. The present documentation-only checkpoint requires no runtime tests.
