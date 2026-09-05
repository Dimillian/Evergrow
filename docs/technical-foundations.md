# Evergrowing — Technical Foundations

Status: architecture proposal, not an implementation commitment. Updated: 2026-09-04.

## What the technology must preserve

Evergrowing should feel like one continuous, responsive world: the player crosses biome borders, enters a blacksmith's house, changes visible equipment, and fights without a scene-loading interruption. Procedural generation is the source of the world and its visual assets. It must also produce navigable, readable spaces and a deliberate gothic visual language.

The proposed first target is single-player desktop browser play with keyboard and mouse. Multiplayer, mobile controls, cloud accounts, and arbitrary player construction remain outside the first architecture. “Infinite” means effectively inexhaustible exploration and progression, with finite active simulation, finite storage, and explicit technical limits.

## Renderer decision: prove the difficult scene first

Propose TypeScript for gameplay and content definitions, with a renderer isolated behind a small adapter. Compare two candidates in one representative prototype:

| Candidate | Reason to investigate | Question the prototype must answer |
| --- | --- | --- |
| PixiJS with WebGL | A focused rendering layer leaves world simulation and procedural art under direct control. | Can we build the required lighting, animation, input, and tooling economically? |
| Phaser with its WebGL renderer | A broader game framework may reduce integration work. | Do its scene and rendering conventions fit continuous streaming and our art pipeline? |

PixiJS currently documents WebGL/WebGL2 and WebGPU renderers, recommends WebGL for production, and exposes generated textures. Use WebGL as the initial candidate; WebGPU is an optional later experiment. [PixiJS renderer documentation](https://pixijs.com/8.x/guides/components/renderers)

Phaser documents both WebGL and Canvas rendering. That makes it a candidate, but does not demonstrate that our intended lighting and effects will work equally on both paths. [Phaser official documentation](https://docs.phaser.io/)

Build the same test scene: moving equipped character, dense forest, twenty fighting enemies, torchlight, an entering/exiting interior, and chunk streaming. Choose on measured frame time, visual quality, implementation effort, and debugging clarity. Pin versions after that decision. An unsupported renderer should produce a clear launch message; a reduced-effects mode is a separately verified feature.

## Runtime boundaries and streaming

Keep independent modules for content definitions, generation, simulation, rendering/audio, interface, and persistence. Rendering consumes state and combat events; particles and floating numbers never decide damage. Interface commands pass through the same validated action layer as gameplay input.

Start with a fixed 60 Hz movement/combat simulation and interpolated rendering. Evaluate input every simulation step, cap catch-up work after a stall, and stagger noncritical AI decisions. Pause single-player simulation on lost focus and reset accumulated time on return. Browser animation callbacks generally follow display refresh and are commonly paused in background tabs, so elapsed wall time must not become an enormous combat update. [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

Move pure terrain, placement, and navigation generation into a small bounded worker queue; publish completed data at simulation boundaries. Web Workers support background computation and message exchange, while direct DOM access remains on the main thread. [MDN: Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)

Define chunk width from ordinary walking speed multiplied by 20–30 seconds. Speed bonuses and traversal skills require greater look-ahead. Chunk size, viewport size, and streaming distance are separate settings: the camera may see multiple chunks at once.

Each chunk moves through requested, generating, validated, ready, resident, and evictable states. Prioritize the camera footprint and likely movement direction. Cancellation tokens discard stale jobs after a waypoint jump. Share boundary samples and road entrances with neighbors; never generate border decisions independently.

Maintain a fully traversable ring beyond view. Prototype a camera-covering resident set plus one neighbor ring, then calibrate its size. If required terrain misses its deadline, safely pause and show a brief recovery message before allowing entry into incomplete collision. This is a failure condition to measure, not a planned transition effect.

## Deterministic world, persistent consequences

Use a saved world seed plus a pinned generator version. Derive independent random streams for terrain, settlements, props, encounters, and loot. Adding a decorative shrub must not shift every chest's reward or relocate buildings.

Persistent IDs derive from generator version, region/chunk coordinates, feature type, and a stable feature key. Avoid generation-array indexes. Buildings crossing chunk borders belong to one region feature and have one identity; neighboring chunks reference its footprint.

Store enormous world coordinates as signed chunk integers serialized to strings, with bounded local positions. Render and simulate relative to a nearby origin. Validate negative coordinates and boundary crossings. Changing danger tier at a sanctuary changes encounter/reward configuration, not the identity or geography of that sanctuary; tier-sensitive encounter state needs its own key.

Regenerate unchanged terrain and props. Save consequences such as opened unique chests, unlocked waypoints, completed objectives, and persistent NPC state as deltas. Ordinary defeated enemies and disposable debris follow documented reset rules; they do not become permanent records forever. Never infer persistence merely from what happened to remain in memory.

A seed alone cannot preserve an older world after generation algorithms change. Before public saves, choose supported generator versions and explicit migration rules. Keep the old generator until a migration validates its affected locations and IDs; preserve a backup and offer a safe sanctuary relocation when necessary. Never silently reinterpret existing deltas against incompatible geometry.

## Towns, interiors, collision, and navigation

Generate the settlement plan before decoration: roads, public space, buildable plots, essential services, house footprints, entrances, and furniture. Establish routes from every required service to the settlement entry, then reserve doorway and player-clearance zones. Decorate only after these constraints pass.

Ordinary interiors occupy their actual outdoor footprint in the same coordinate space. Crossing the threshold fades the roof and foreground walls, blends lighting and ambience, and reveals the interior. Collision, line of sight, sound zones, and render occlusion remain separate representations. A hidden roof must not remove a solid wall.

Validate walkable connectivity, minimum clearances, doorway access, spawn safety, and a return path across chunk boundaries. Use bounded generation retries followed by a known-valid fallback layout. Store failing seeds for inspection. The initial scope should favor one-story houses; overlapping floors require a later elevation/space model.

Use a spatial partition for local collision queries, swept tests for fast movement/projectiles, and a coarse navigation graph connecting chunk exits and doors. Reserve detailed path searches for nearby agents; stagger replanning and invalidate paths when relevant doors change. Sleeping distant actors require explicit resume rules, not continuous world-sized AI.

## Art entirely defined in code

Treat every visual as a versioned recipe: silhouette geometry, palette, material/noise parameters, attachment points, animation curves, lighting response, and variation seed. A tree recipe can share its trunk silhouette family while changing branches, bark detail, moss, and wind phase. Artistically authored code is essential; unconstrained randomness will not establish the desired style.

Generate and cache reusable meshes, textures, and atlases from these definitions. Rasterization in memory remains compatible with code-defined source assets. Do not rebuild detailed geometry for every object every frame. PixiJS specifically supports shared graphics contexts and recommends reusing them for changing visuals. [PixiJS Graphics documentation](https://pixijs.com/8.x/guides/components/scene-objects/graphics)

Build characters from a layered body rig with equipment sockets and explicit front/back ordering. Start with a small set of facing directions and interpolated motion; test weapon arcs, shields, capes, and helmets before expanding silhouettes. Define visual compatibility rules per equipment slot. Cache shared components instead of generating a complete atlas for every possible outfit.

Layer ambient darkness, player readability light, local emitters, selective shadows, and restrained bloom. Wind, embers, water, breathing, and cloth should have distinct motion rules. Prioritize enemy telegraphs over decorative particles; cap emitters, lights, trails, decals, and damage-number density. Lighting quality and particle density are adjustable independently of gameplay.

## Thousands of nodes and endless numbers

Define skills, modifiers, items, enemies, and tree nodes as data with stable IDs and typed effects. Validate referenced IDs, reachable unlocks, prerequisite logic, point costs, rank limits, incompatible combinations, and refund behavior. The navigation graph may contain loops; prerequisite rules must still be satisfiable.

Compile allocated nodes into a derived stat snapshot on build changes. Combat reads that snapshot instead of traversing thousands of nodes per hit. The tree interface needs spatial indexing, zoom-level detail, search, and keyboard navigation; render only visible labels and connections.

Represent power with an explicit scale/tier and bounded coefficients, or a tested logarithmic representation. Resolve meaningful damage relative to the target's health scale, then format large values separately. Define saturation, negligible-damage, rounding, and invalid-number behavior; exercise tier differences far beyond expected play. Endless progression must not depend on eventually overflowing ordinary health numbers.

Speed, cooldown reduction, projectile counts, proc recursion, and simultaneous summons need caps or diminishing returns. Increasing danger should increase tactical demands and rewards without increasing simulated entities without bound. The exact formulas belong to combat balancing; the engine must support their limits explicitly.

## Saves and finite browser storage

Propose IndexedDB for structured saves because it supports asynchronous, transactional operations. [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

| Save area | Required contents |
| --- | --- |
| Manifest | Schema, build/content/generator versions, world seed, save revision, integrity metadata |
| Character | Position, sanctuary, allocated nodes, inventory/equipment, progression, selected danger tier |
| World | Time of day, waypoints, durable feature deltas, objective state, encounter reset state |
| Recovery | Last committed checkpoint, compact journal, previous valid checkpoint |
| Preferences | Controls, audio, accessibility, graphics settings |

Commit related reward, inventory, and world changes together. Advance the committed revision only after success. Autosave periodically and at meaningful milestones; do not depend on tab closing. Recover interrupted saves from the last complete revision. Validate imported files before replacing anything and provide export/import from the first persistence milestone.

Maintain separate byte budgets for resident chunks, generated textures, worker jobs, particles, and disposable disk caches. Evict least-recently-used, unreferenced assets; never evict dirty persistent state before a successful save. Reconstruct visual resources from recipes after renderer recovery.

Browser storage is quota-controlled and best-effort by default; estimates are approximate, writes can fail, and persistence requests do not replace backups. Use storage estimates, attempt persistent storage when appropriate, and handle quota errors. [MDN: Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

On failure, retain the last valid save, free disposable caches, retry once, and expose an export of current progress with a clear unsaved-state message. Never silently delete permanent discoveries. Compact journals and transient records, but acknowledge that infinitely many permanent changes cannot fit finite storage: expose capacity management before that boundary, and pause further durable mutations if recovery fails.

## Prototype budgets and acceptance evidence

These are initial targets, not measured promises. Record a specific reference laptop, OS, browser version, resolution, and power mode before judging them; test representative Chrome, Firefox, and Safari versions.

| Area | Initial target |
| --- | --- |
| Rendering | 60 fps target at 1920×1080; report median, p95, and p99 frame time |
| CPU work | Approximately 4 ms simulation, 3 ms render preparation, 1 ms streaming integration per normal frame |
| Streaming | No visible missing geometry or collision during a 10-minute rapid traversal |
| Responsiveness | Input accepted by the next simulation tick; visible acknowledgement target under 50 ms |
| Memory | Prototype ceilings of 256 MB tracked CPU allocations and 256 MB estimated textures; revise from measurements |
| Endurance | Stable memory after repeated out-and-back traversal, equipment swaps, and tree opening |

CPU and GPU work overlap; these are diagnostic budgets, not additive guarantees. Compare equal scenes and record generation latency, texture uploads, missed streaming deadlines, and long-frame causes. Test a dense fight at dusk while entering a house, a long-distance waypoint jump, a restored save, forced quota failure, and high-tier arithmetic. Only then choose the stack and expand content volume.
