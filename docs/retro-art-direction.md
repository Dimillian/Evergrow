# Evergrow — retro art exploration

Status: concept exploration, September 4, 2026; these are experiments, not approved final assets. Generated raster concepts are visual targets. Geometry, palettes, animation, and rendering recipes still need to be authored in code.

## The visual promise

An overhead gothic world made from intentional shapes, fluid motion, and restrained luminous effects. Recall an old computer game without depending on hand-drawn sprite sheets or imitating a physical monitor. Pixel typography, stepped shading, dark silhouettes, and soft phosphor-like light carry the retro identity.

Use a genuinely top-down camera: roofs read as footprints, paths retain consistent width, and the ground has no vanishing point. Avoid tall isometric façades. Small rim shadows and material highlights can describe depth. This explores a stricter overhead interpretation than the earlier slightly elevated camera proposal in `world-and-art.md`.

## A vocabulary we can generate

Terrain starts with connected ground regions and paths, then adds sparse clusters of pebbles, grass strokes, cracks, or damp patches. Choose detail density by function: quiet traversable ground, denser boundaries, and distinctive landmark surroundings. Randomness varies a coherent recipe rather than distributing noise everywhere.

Trees combine a branching skeleton, irregular canopy lobes, roots, and a few highlight clusters. Dead forest trees expose angular limbs; living forest trees use overlapping dark masses; swamp trees gain sparse crowns and reed neighbors. Wind moves canopy groups around stable anchors. Buildings combine footprint polygons, roof planes, repeated roof marks, doorway recesses, and service-specific props. A forge is identifiable through its anvil silhouette and concentrated warm light.

Use a small material palette shared across biomes: earth, stone, timber, foliage, water, iron, cloth, and emissive surfaces. Give each material a few shade steps and one texture rule. Biomes change proportions, silhouettes, and accent colors together.

## Retro resolution, fluid movement

Treat the world as logically low-resolution art: broad clusters, stepped edges, and limited interior detail. Test a low-resolution world surface enlarged cleanly, alongside selectively quantized geometry at a higher resolution. Neither approach is accepted until walking and camera movement remain comfortable. Animation curves can be continuous even when the rendered shapes have a coarse visual vocabulary.

Build the avatar from layered head, torso, arms, legs, cloak, armor panels, and weapon shapes. Equipment changes silhouette, reach, and visible material. Shared attachment points and facing rules keep items aligned through walking, swings, and casting. Favor readable shoulders, weapon arcs, and cloak movement over miniature anatomical detail.

Quantize shading selectively. Dither may soften a fog boundary or shadow transition; it should not cover every surface. Avoid tiny crawling noise during camera motion. Draw pixel-font interface text at stable readable sizes, with deliberate spacing and sharp numerals.

## Light and interface

Offer clean, CRT, and phosphor presentation presets as experiments. CRT adds faint scanlines and restrained edge softness; phosphor adds a short luminous falloff around bright emitters. Avoid screen curvature, monitor casing, persistent trails, strong color separation, or flicker. Keep text outside distortion and bloom. The clean mode must preserve the same mood and all gameplay information.

Use dark HUD plates, modest gothic geometry, red and blue resource orbs, and a compact skill bar. Floating damage numbers, attack warnings, and the equipped character remain readable over spell effects. Skill-tree connections use thin paths and explicit node states; only a local selection of labels needs to appear at once.

## Four concept states

- **Forest at dusk:** establish traversal, canopy silhouettes, biome mixing, and a warm player light.
- **Swamp combat at night:** test enemy separation, a clear attack arc, floating numbers, and luminous water accents.
- **Village blacksmith:** show a roof cutaway, a reachable threshold, modular interior props, and warm forge light spilling outside.
- **Skill tree:** show the scale through branching clusters while keeping the selected node and nearby choices readable.

## Next small art prototype

Build one fixed clearing with a path, six varied trees, a shallow pool, one small blacksmith building, and an equipped avatar. Add walking, one sword swing, one target dummy, a dusk slider, a roof fade, and shader toggles. Compare still frames and motion with effects enabled and disabled. Expand only after silhouettes, text, doorways, equipment changes, and combat cues remain clear in both modes.
