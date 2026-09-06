# Living water — generation 6

Rivers and lakes are shared seeded geography, visible in the terrain and explored atlas. The runtime adds a cell-based surface simulation and a dedicated WebGL optics pass. Water is currently traversable: depth controls appearance and wave propagation, not swimming, damage, movement speed or enemy pathfinding. No water presentation state is saved.

## Drainage and placement

`hydrology.ts` owns deterministic jittered drainage anchors at 4,800-unit spacing. Climate moisture biases sparse rainfall sources. A coarse elevation potential assigns six terrain tiers; an anchor drains to its lowest suitable neighboring tier. Strict descent prevents cycles and bounds upstream accumulation to five edges. Rainfall accumulates at confluences and widens downstream channels. Springs start narrow; meandering polylines carve a descending river bed. Receiving sinks become irregular lakes. These are generated drainage basins, not a world-sized erosion or terrain-volume simulation. Different basins may terminate in separate lakes; there is no ocean layer yet.

The starting settlement has a protected dry island, and channels route around it. Other settlements compare their normal three candidates against water, trying up to eight only if the first three are wet. Paving/buildings remain dry, road crossings become shallow fords, and terrestrial props and wilderness-site centers avoid the new water. Shorelines, wet banks and submerged stones are baked into ground tiles. Physical bridges and swimming remain future work.

Hydrology retains at most 4,096 nodes, drainage links and runoff values, 1,024 features, and 512 local segment buckets per seed. The shared seed registry holds four hydrology instances; active worlds keep their own reference. Cache eviction changes cost only. Sampling and procedural placement never consume combat, gear or reward RNG.

Current directions interpolate shared endpoint tangents and blend overlapping segments within a compact shore-distance band. Lake mouths ease the current toward still water. Spatial buckets include the complete blend support, keeping flow continuous across segment and cache boundaries.

## Surface simulation

`water-simulation.ts` owns a rolling 144 × 112 grid with height and horizontal face fluxes. It integrates the linearized shallow-water equations at 60 Hz. Depth changes wave speed; closed dry faces reflect waves and the outer six cells absorb the artificial viewport boundary. Maximum wave speed stays below 106 world units/second at a minimum eight-unit cell size. Grid spacing coarsens by powers of two only when needed to cover a larger viewport. Integer-cell scrolling bulk-copies overlapping typed-array rows; teleports and resolution changes clear transient waves.

At most four substeps are caught up in one render. Footsteps from the player and up to 24 visible actors, active melee blade samples, actual combat impacts and area blasts inject bounded displacements. There are at most 32 accepted impulses per update and 96 ballistic droplets; droplets can create small secondary disturbances when landing. No fluid calculations drive damage, contacts, rewards or movement. Undisturbed grids skip solver ticks until an impulse wakes them; the ambient clock still advances. The generated current advects shader detail; the wave solver animates surface disturbances around the fixed bed. It does not model flooding, waterfalls, erosion or bulk river-volume transport.

`water-presentation.ts` owns event admission and movement history. Pauses stop the surface, reduced motion clears transient waves and freezes ambient detail, world changes discard old effects, and teleports never draw a connecting wake. Large waterways suppress the earlier biome footstep rings and particles so the same footfall is not drawn twice. Small pre-existing Mire puddles retain their lightweight biome treatment.

## Optics and art

`water-shader.ts` renders one viewport pass capped at 1,280 pixels wide. Shared byte textures contain coverage, depth, flow and 16-bit encoded wave displacement; no floating-point GPU extensions are required. The shader combines cell-derived normals with continuous wind/current waves, depth tint, refraction of the underlying terrain, Fresnel-style sky sheen, sun glints, eight colored scene lights, subtle shallow caustics and localized crest/shore foam.

Current-driven waves and foam crossfade between two staggered four-second advection phases, each travelling less than 52 world units. Each phase wraps while invisible. This bounds spatial distortion during long sessions instead of multiplying small changes in current direction by total elapsed time.

`water-art.ts` stages the actual player and at most ten nearby prop silhouettes into one bounded reflection canvas. The shader distorts that canvas with the same surface normals; it does not slice reflections into visible strips. Shaded droplets replace long velocity lines. Water is composed before actors and receives the existing illumination and CRT treatment. In environments without WebGL, a quieter Canvas surface preserves waves/reflections without decorative grid strokes. Bed and wave revisions avoid unchanged field uploads; texture storage and light arrays are reused. Resizing or restoring a context forces the required allocations/uploads. GPU resources are released on renderer reset; context loss falls back until restoration.

The shallow-water height-field approach is informed by [Chentanez and Müller, Real-time Simulation of Large Bodies of Water with Small Scale Details](https://matthias-research.github.io/pages/publications/hfFluid.pdf). This implementation uses a bounded linear surface solver rather than that paper's complete system.

## Review and verification

`/water.html?seed=7319&kind=river` and `kind=lake` stage real seeded banks with authored walking, melee poses and impact events through Renderer and PostFX. River/lake and seed controls, replay and pause are save-free. No simulation ticks or gameplay input run. The browser review is the source of truth for shader appearance. `scripts/render-water-animations.mjs` can export the same authored poses through native Canvas, explicitly exercising the fallback rather than WebGL/CRT.

Code coverage includes downhill connected drainage, sparse distribution over three seeds, shared contacts/prop clearance, cache eviction, wave propagation and damping, dry boundaries, camera continuity, fixed-step frame-rate independence, pause/reduced motion/teleport behavior, bounded effects and duplicate reaction suppression. Visual checks use the existing in-app browser; gameplay feel and long-session performance remain the user's playtest responsibility.

Append `&age=600` to the water review to inspect ten-minute-old shader optics immediately, without advancing gameplay or saves. Regression checks cover current continuity at river joins and bucket boundaries, bounded advection through 24 hours, and phase-wrap continuity. These flow/optics refinements do not require another generation change or save reset.

Generation 6 changes geography and prop identities. On the next game bootstrap, the existing generation-version policy removes older test-character slots and opens a new exploration namespace. This deliberately resets test progress; no migration is supplied.
