# Expansion readiness review

Reviewed 2026-09-05 against local checkpoint `99b1c57`, with the skill-execution compiler guard added during this review.

The first three engineering recommendations (skill content, Simulation responsibilities, and event/character contracts) were subsequently implemented. See the [current architecture](architecture.md#adding-combat-behavior-after-the-expansion-refactor) for the resulting ownership and extension rules. The assessment below records the pre-refactor findings; performance instrumentation and interactive-world state remain future work.

## Assessment

The project has a sound modular prototype foundation. Existing biome, item, enemy and skill variants can be extended through established definitions and tested rules. A larger increase in combat complexity, interactive world systems or population should begin with the focused work below. Current checks establish rule correctness and dependency boundaries; they do not establish frame-time performance at larger scale or validate game balance.

No broad engine replacement is justified by this review. Keep the fixed simulation, generated blueprints, procedural art, native UI and current test tools. Extract responsibilities where new features would otherwise accumulate in shared coordinators.

## Verified baseline

- 400 code tests across 53 files pass, plus strict application TypeScript, the core compilation without DOM/Node globals, and the production build.
- Runtime import-cycle checks pass. Combat runtime dependencies must explicitly belong to the headless compiler boundary.
- 97 runtime TypeScript modules, zero runtime package dependencies, and 11 development review entrypoints.
- Production JavaScript is 406.38 kB / 141.60 kB gzip; CSS is 44.17 kB / 9.81 kB gzip (Vite report), with the font separate.
- The largest coordinators are `simulation.ts` (712 lines), `world-map.ts` (638), `renderer.ts` (574), and `inventory-panel.ts` (445). Line count is a maintenance indicator, not itself a defect.
- Tests cover equipment transactions, source-level damage/loot, skill behavior, graph connectivity, world determinism/boundaries, lifecycle teardown, camera transforms and hidden population streaming. Test count is not a code-coverage percentage.
- No browser gameplay was driven. Actual feel, balance, long-session frame time and GPU performance are outside this verification.

## System readiness

| System | Strong foundation | Expansion boundary |
| --- | --- | --- |
| Combat and encounters | Fixed 120 Hz rules, weapon snapshots, separate AI/projectile policies, six archetypes, source-stable rewards, offscreen roaming/camp streaming | Simulation still owns movement, damage/death, statuses, ground effects, pickups and group placement; actor queries scan arrays |
| Character, inventory and loot | One stat derivation path, transactional hand/bag swaps, 13 weapon and 3 shield profiles, 3 rank loot tables | Successful mutations still rely on callers to refresh combat projections; richer conditional modifiers need explicit evaluation order |
| Skill atlas and actions | 2,824 connected nodes, separate graph/routes/art, 17 working active skills | Skill behavior is a central switch; radii, chains, durations and status application are partly embedded in execution code |
| World and maps | Seven blended climates, 23 prop families, immutable seeded town/site geometry, shared collision/art anchors, bounded caches | Terrain rasterization is synchronous; the World wrapper also owns Canvas tiles; interactive POIs need separate mutable state |
| Procedural presentation and UI | Shared weapon/armor geometry, common pose, independent effects, native text, shared UI kit, static review tools | Renderer and map classes combine several presentation responsibilities; split these along the next feature boundary |
| Progression and persistence | Geographic threat, captured enemy source data, deterministic loot, separate chart saves | Character saving is absent; numeric progression and coordinates are bounded, not a completed infinite-endgame representation |

## Prioritized engineering work

### 1. Make new combat content safer to author

`skill-content.ts` already centralizes costs, requirements and potency, but `skill-combat.ts` still contains projectile speeds, blast sizes, chain falloff, guard durations and other tuning. Burns/slows are applied separately in skills, projectile hits and ground-effect updates.

Move those values into typed execution profiles and introduce small shared status operations with explicit duration, strength, refresh and stacking rules. Keep specialized behavior as ordinary functions. This does not require a general scripting language.

**Complete when:** tuning a fireball's radius or burn does not require editing its execution function; descriptions/telegraphs read shared values where they display them; every registered skill has a handler; duration, reapplication, death and source-damage rules have focused tests.

**Fixed in this review:** the skill switch now has an exhaustive `never` check. Adding a new skill ID without behavior must fail compilation instead of silently consuming resources and emitting only a cast event. All existing skills retain their behavior.

### 2. Reduce Simulation's change surface

`simulation.ts` owns the ordered clock correctly, but is also the implementation site for player movement/basic attacks, enemy status ticking, damage/death/rewards, timed areas, loot collection and encounter placement. Adding bosses, auras or interactions would concentrate changes here.

Extract damage/death/rewards and status/ground-effect ticking first, followed by population placement if it continues growing. Use narrow contexts like the existing `ProjectileContext` and `EnemyAIContext`; keep the clock, RNG ownership and tick ordering explicit in Simulation. Avoid passing the entire Simulation instance into every subsystem.

**Complete when:** a new status or reward rule can be added without modifying the main tick loop; existing source snapshots, exactly-once death rewards and deterministic scenario tests remain valid; runtime imports remain acyclic.

### 3. Strengthen events and character mutation boundaries

`model.ts` currently represents all combat events with one interface whose payload fields are optional. A chain event can therefore compile without its destination, or a hit event without target information. Consumers compensate with fallbacks. Replace this with a discriminated union whose required fields depend on the event type.

Equipment/tree mutations are validated, but `Game.characterAction` separately calls `refreshCharacter`. Before adding shops, crafting or saves, introduce headless character commands that own validation, mutation and projection refresh together. UI should submit an action and read its result.

**Complete when:** incomplete event payloads fail compilation; a successful character command immediately updates the same combat/render stats used by the UI; failures preserve inventory and resources; panels do not need to remember refresh sequencing.

### 4. Measure performance before increasing density

Enemy separation scans other enemies; projectile substeps scan targets and may perform visibility checks. This is bounded by today's 18 living actors and 128 projectiles, but those are configured design limits, not measured hardware capacity. Terrain tiles and map tiles also generate synchronously. Current runtime diagnostics expose smoothed FPS, not a per-system frame budget.

Add opt-in development timing for simulation, generation, rendering, post-processing and map work, plus counts/cache misses. Record p50/p95/p99 and memory trends during user-controlled sessions. Add reproducible headless stress cases for rule workloads. If measurements justify it, introduce a spatial query interface backed by a uniform grid and compare its results with brute-force queries. Move generation into workers only after identifying stalls and separating data generation from Canvas work.

**Complete when:** current and proposed population/effect budgets have recorded timings; prolonged travel has bounded retained state; changes can be compared against reproducible scenarios. Browser gameplay still belongs to the user.

### 5. Give future interactive world content a clear owner

Town and wilderness blueprints are already immutable and keyed. Camps separately retain run-local health/death records, while exploration persists chart discovery. Shops, opened chests, shrines, events and quests should follow that separation instead of mutating generated geometry or adding gameplay state to the map.

**Complete when, as those features are introduced:** a run-local world-state owner stores interaction state by stable IDs; unloading/reloading cannot duplicate rewards; discovery, generated geometry and gameplay state remain distinct. Design character persistence deliberately when requested; do not add compatibility layers or save migrations for this prototype.

## Recommended sequence

1. Strengthen typed events and character commands; retain the new exhaustive skill check.
2. Extract damage/rewards and shared status operations, then move skill tuning into execution profiles.
3. Add development measurements and stress baselines before raising population/effect budgets.
4. Expand content through those boundaries; introduce mutable world state alongside the first real interactive POIs.

World generation and exploration identity remain unchanged by this review. No gameplay tuning, save reset, runtime UI changes, dependency addition, deployment or remote push is part of it.
