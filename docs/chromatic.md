# Native Chromatic port

Implemented locally on **2026-10-02**. The editable project is [`chromatic/project.gbsproj`](../chromatic/project.gbsproj), with its own cartridge state and project-local engine extension. This is a substantial native adaptation, not feature parity with the current browser game. No browser runtime, WebView, network save service or Sites deployment is involved.

## Current coverage

| System | Native implementation |
| --- | --- |
| Characters | Eight cartridge slots; six current starter loadouts; four attributes; five attribute points and one skill point per level; levels 1–999 |
| Equipment | All 17 current weapon profiles, six foci and three shield profiles; eleven equipment slots; four active charms; distinct held silhouettes; validated two-handed reservations and one-handed pairing |
| Skills | All 30 non-aura active skill names, requirements, base costs, cooldowns and damage multipliers exported from current TypeScript content; five empty assignable slots; twenty purchased ranks per action |
| Atlas | Six territories with a connected 16-node grid each: 30 action unlocks and 66 passive nodes; two entry nodes per territory; circular node lenses; complete paid node/rank refunds |
| Combat | Native movement, directional assistance and basic melee/bow/staff/wand attacks; alternating one-handed basics; telegraphed enemies; LOS and home tethers; crits, physical armor, shield block, four elemental resistances, burn/chill/stun, dodge, dual potion, mana regeneration |
| Action effects | Sweeps, thrusts, continuous lunges, fan/piercing/chain shots, volleys, rain, nova waves, meteor impacts and burning patches, Cataclysm impacts, drain, finite guard/ward, smoke, sidestep, vaulting shots, rally charges, bow echoes and a following storm |
| World | Seeded 16×16 connected surface areas; nine climate palettes; home climate selected from all nine; 16 towns, 16 ruin sites, seeded shrines/trials/lairs; fogged exploration chart |
| Settlements | Home always tents; blacksmith, jeweler, enchanter, gambler, hearth and 96-entry personal storage; other towns have settlement/village/city tiers; two family interiors in village/city tiers |
| Economy | Deterministic merchant stock, level-based stock refresh, paid refresh, buying/selling, six-entry buyback, enhancement to +10, rarity upgrades, affix rerolls and item releveling; reviewed prices shown before confirmation; bounded character wallet |
| Exploration | Persistent surface casualties, up to sixteen five-floor ruins, level-20 repeatable rifts, shrine points, boss/ruin/rift Journey completion, free three-second home/return portal |
| Presentation | Native 160×144 output, custom 2bpp scenery/sprites, climate/material palettes, visible held equipment and blade trail, HP/mana/gold/potions/skill HUD, XP rail, paged menus, short sound effects and a quiet town motif |
| Persistence | SRAM checkpoints after durable menu changes, at hearths and every 20 seconds of active ticks; eight CRC-validated records and a shared recovery journal; unsupported slots preserved |

Native execution families deliberately condense the richer browser recipes. The exporter fails if the source's non-aura action catalogue changes without an explicit native mapping. Exported metadata does not imply identical reach, animation, specialization behavior or tuning. Native effects use small fixed budgets and native distances. The source files for all content and art are reproducible; ordinary ROM builds need no Python dependencies.

## Hardware and ownership

The `.gbsproj` selects the `evergrow` scene type supplied by `chromatic/plugins/evergrow/engine/engine.json`. GB Studio compiles this scene through its standard project pipeline. The extension owns the native update loop rather than using GBVM actors for an action RPG. It does not eject or patch the shared upstream engine.

The owner selects CGB WRAM bank 2 for `EvGame`. Fixed HRAM holds its pointer (`FF94`), the SRAM window pointer (`FF96`), OAM counters (`FF98`) and 18 scanline budget bins (`FF99–FFAA`). It relocates the stack into fixed WRAM at `CFF0`, removes the GBVM LCD/VBL handlers and uses the default GBDK VBlank/OAM service. It never returns to GBVM's original stack. These details are essential when modifying boot or adding interrupts.

WRAM bank 3 holds a 2,162-byte display workspace: a composed tile/color screen and caches for both hardware tilemaps. `ev_tile` changes only this workspace. `ev_present` copies changed runs into the hidden tilemap, then switches maps during VBlank. Clearing a HUD or menu never clears the visible display. All workspace access restores WRAM bank 2 before returning to simulation. Transfers use raw `set_data` runs: GB Studio's `set_tiles` reads `__map_tile_offset` from bank-1 globals, which aliases unrelated bytes under the native bank and corrupts tile IDs. Do not put ordinary linker-allocated mutable globals in either switchable bank.

The packed runtime occupies **3,863 of 4,096 bytes**. Its save payload occupies **2,681 of 2,718 available record bytes**, plus a 12-byte header. Compile-time assertions enforce both limits with SDCC and the portable host compiler. Background VRAM bank 0 contains 224 tiles, including lettering; sprite VRAM bank 1 contains 152 tiles. Eight background and eight sprite palettes use four hardware indices, with three opaque sprite indices. Rendering limits itself to 40 OAM objects and ten overlapping objects per scanline, reserving player/held/projectile visibility before cosmetic effects. Dense overlaps can omit lower-priority sprites.

The current build is a GBC-only MBC5 battery cartridge with 32 KB SRAM. The official compiler currently emits the MBC5 rumble-capable cartridge type; the game never activates rumble. The declared SRAM capacity is the actual save allocation, not an expanded header claim.

## Save layout and guarantees

Banks 0–2 hold eight primary records, at 2,730-byte strides, three records per bank. Bank 3 holds one shared journal record. Before changing an existing character, its previous valid record is copied to the journal with a commit marker written last. The next primary payload is CRC-checked after writeback, then committed. For a first save the new character is staged in the journal first. A torn primary can load its journal copy. Before the journal is reused for another character, a recoverable torn primary is repaired.

This supplies write recovery across eight characters; it does not retain eight independent historical backup copies. CRC16 protects corruption, while validators check schema, bounds and item identities. Newer or differently sized records are shown as Other Version and cannot be treated as empty slots. Erasing a slot explicitly removes its matching primary and journal.

The payload retains 24 bag entries, 96 stash entries, eleven equipment slots, four charms, six buyback entries, 24 persistent ground-drop records, exploration and casualty bits for all 256 areas, sixteen ruin records, a separate rift record, and an eight-area wounded-encounter cache. Corpses stay dead; injured survivors outside that small cache can recover their health when revisited. Ground-drop exhaustion credits new coins directly and attempts to put new gear in the bag. If both drop storage and bag are full, the newly generated item cannot be retained; existing owned gear is never displaced. Gold caps at 999,999,999.

The current format has no browser-save import or migration. Native characters use cartridge/emulator SRAM, and each emulator origin/export may keep its own battery save. Preserve the save file when switching tools or updating a cartridge.

## Deliberate differences from the browser game

- The surface is a finite 256-area world with room transitions. Climate color changes occur across rooms; it does not reproduce the infinite smoothly blended landscape, water simulation, 29 prop families or day/night lighting.
- Live budgets are six enemies, eight projectiles and one persistent spell field. Spells reserve capacity before paying mana. Encounters are prepared during area transitions; there are no ambient births inside a displayed room. Rifts provide repeatable endgame content.
- The atlas is 96 nodes. The large planar atlas, Doctrine families, Techniques, auras/mana reservation, source Uniques and skill-changing item catalogue are not ported.
- Inventory is paged lists with 24 bag entries and four active charm entries. It does not reproduce the browser spatial pack, appearance editor, drag/drop, equipment comparison, cloud storage or Thor companion.
- Ruins use five procedural floors rather than the browser's branching room graph. Trials and lairs are compact combat encounters; native Journey entries summarize completion rather than reproducing the full quest/activity system.
- Gear has one compact affix and five rarities. Weapon profiles and action metadata come from the main game, while native loot weights, stat curves, passive bonuses, attack timings, rank effects, mana sustain and distances are adapted. Attack and cast speed share the compact native haste statistic.
- Visuals use native tile art and limited sprites. There is no CRT shader, dynamic terrain lighting, original articulated equipment rig, soundtrack recording or browser-scale particle engine. Text is rasterized from the locally bundled fonts into native tiles.

## Verification and acceptance

`npm run chromatic:build` exports current content, runs portable C checks with AddressSanitizer and UndefinedBehaviorSanitizer, compiles through the official GB Studio CLI, then verifies CGB mode, mapper, ROM size, SRAM size, header checksum and global checksum. `npm run chromatic:verify` rechecks an existing ROM and writes its SHA-256 manifest.

The menu/input regression checks compile the actual `ev_input.c`, `ev_menu.c`, `ev_render.c` and `ev_screen.c` owners. They cover Start pause/resume, held-button suppression, nested Back navigation and retained cursors, directional repeat, consumed interactions, unassigned skill feedback and atomic screen composition. Host display checks do not simulate hardware timing. Encounter checks generate and spawn all 256 surface areas across sixteen seeds (4,096 combinations), validating spawn footprints and termination under a test-process timeout. Save checks also compare the faster CRC against the original bitwise algorithm and preserve early v1 slots while normalizing empty wounded-cache entries.

The native rules checks cover all starter loadouts, every source weapon and active action, all atlas nodes/ranks, transactional hand conflicts, wallet bounds, independent gear rolls, resource rules, all 256 connected area approaches, nine climates, source-level enemy/loot snapshots, exactly-once kills, field snapshots after later actions, dodge isolation, damage-cancelled portals, quoted improvements, +10 limits, releveling, complete respec, enterable houses, independent rift records, eight-slot SRAM isolation, torn-write journal recovery and unsupported-version preservation.

The initial port ROM was observed booting into the title in the Codex in-app browser. [The unmodified native framebuffer capture](../chromatic/captures/title.png) has its [build identity and provenance](../chromatic/captures/title.json) alongside it. Automated emulator gameplay has not been driven. Combat feel, menu readability, progression pacing, sustained hardware frame rate, real cartridge power-loss behavior and installation on a physical Chromatic still require the user's acceptance. The emulator remains available for this testing. A build pass and host tests are not a claim of complete hardware certification.

Implementation owners:

- `ev_character.c`: items, stats, hands, points, wallet and commerce.
- `ev_world.c`: seeded rooms, encounter snapshots, interactions and remembered state.
- `ev_combat.c`: accepted actions, cast-owned effects, hits/statuses, rewards and pickups.
- `ev_input.c`: shared cartridge/host input routing, pause, button release guards, directional repeat and portal ticking.
- `ev_render.c` / `ev_menu.c`: native HUD, sprites, feedback and menu navigation history.
- `ev_screen.c`: WRAM-backed composition, hidden tilemap updates and VBlank presentation.
- `ev_save.c`: packed validation, primary records and journal recovery.
- `tools/export-content.mjs` / `tools/generate-art.py`: reproducible source-content and exact native artwork.

## Local quality pass — 2026-10-02

Fixed visible UI clear/redraw flicker, an unbounded blocked-spawn retry that froze ruins, attacks leaking through interactions, lost menu return selections, Back failing to resume the root pause menu, and empty-cache records colliding with surface area 255. Menus cache character-slot checks on entry and repeat held directional navigation after a delay. Save checks use an equivalent table-driven CRC. Surface transitions require an open road at the crossed edge; diagonal travel retains aim and uses seven movement steps per ten ticks. Failed or unavailable actions report their reason, wounded enemies show health meters, and enemy windups have ground markers. This pass retains version-1 cartridge characters and does not touch the browser game's saves. Human confirmation of menu response, flicker removal, combat feel and physical hardware performance remains pending.

The corrected quality-pass ROM was observed at its title screen in a separately served official `make:web` export. This caught and fixed a real hardware-path issue that host checks could not detect: the engine tile-map helper reads a bank-1 tile-offset global, so the private WRAM screen bank must use raw VRAM transfers. The readable title was verified after the fix; no gameplay inputs were sent. The plugin-managed preview listener remains in an unresolved close-acknowledgement state and was retained. The temporary direct local export has a separate browser origin and does not migrate the plugin preview's battery storage.
