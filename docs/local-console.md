# Local command console

The local game includes a centered command box matching Evergrow's metal/glass interface. Press **Cmd+K** on macOS or **Ctrl+K** on other keyboards while playing or paused. The box pauses combat and clears held/buffered actions. Escape closes it and restores the previous play/pause state. It cannot open from the character hall, defeat screen or another panel.

Type to filter suggestions, use Up/Down to select, and Tab or a click to complete the selected token. Enter runs the typed command. Up/Down on empty input, or Alt+Up/Down, recalls the latest thirty successful commands in memory; history is discarded with the app. Results and validation errors appear below the suggestions. The box stays open after running a command. Close it to see drop animations or continue playing.

## Commands

| Command | Effect |
| --- | --- |
| `help` / `help drop` | List commands or show syntax for one command. |
| `drop helmet --level 25 --material steel --rarity rare` | Drop one steel helmet with normal Rare affix generation at item level 25. |
| `drop weapon --profile longsword --level 40 --count 3` | Drop three Longswords with independently rolled properties. |
| `spawn brute --level 20 --rank elite --count 3` | Spawn three level-20 Elite Gravebound Brutes on clear ground outside camera coverage. |
| `hp` | Refill current health to maximum. |
| `mana` | Refill available mana, respecting active aura reservations. |
| `refill` | Refill both current health and available mana. |

`drop` supports helmet/head, chest, gloves, legs, boots, cloak, weapon, shield, grimoire, orb, ring, amulet and charm. Profiles come from the current weapon, shield, focus, jewelry and charm catalogs. Materials must match the selected kind/profile; choose a weapon profile before overriding its material. Exact helmet silhouette profiles are not implemented. Unique items and rift keys are outside this first command set.

Drop level defaults to character level. Unspecified rarity, material and properties use `generateItem` and its normal general-item distribution; this is a targeted equipment drop, not a monster's full reward table. Allowed rarity overrides are common, magic, rare, epic and legendary. `--seed N` repeats the generated recipe; each created physical item still receives a distinct identity. Items fly onto normal clear landing positions, then use the ordinary ground display, pickup, inventory and saving paths. At the ground-item retention limit, the oldest ground gear is removed under the normal shared rule.

`spawn` supports ordinary monsters from the runtime catalog, with normal/veteran/elite ranks. Without `--level`, the spawn location uses ordinary regional scaling; an explicit level is exact, with no additional rank level offset. Source-level stats, rank, biome, loot seeds and independent loot identities are retained through save/load and subsequent movement/level-ups. Killing a spawned monster uses normal combat rewards. Spawned monsters are ordinary roamers and can retire under the usual offscreen retirement rules. The command requires surface wilderness outside towns; dungeon monsters and bosses with encounter-owned progression are excluded. Placement prefers the direction the player faces, validates the full group, and reports its compass direction. Failure creates no partial group.

Both commands accept `--count` from 1 to 32 and `--seed` from 0 to 4294967295. Levels range from 1 to 1000000. This is a per-command work bound, not a population cap; repeated commands are allowed. Unknown, repeated, incompatible or incomplete arguments fail without changing state. Resource commands do not revive, cure statuses, reset cooldowns or refill potion/dodge charges.

## Local-only boundary

The normal Vite config enables `VITE_LOCAL_COMMANDS`; `VITE_SITE_CLOUD=true` forces it off. The Site worker config also forces it off. Game loads `console-panel.ts` and its command implementation through a conditional dynamic import, so the online client emits neither console code nor its styles. Runtime access additionally requires local-save mode and a loopback host or the local Android bridge. Disconnecting an online/cloud session does not enable commands. Android's local build includes the keyboard shortcut; no new controller or touch activation is added.

No cloud routes, file-transfer rules or online account data change. A validated optional actor loot identity preserves distinct physical drops when a seeded monster is spawned more than once; the save version is unchanged. Local and cloud saves remain separate. There is no save reset. This controls the supported feature's availability, not arbitrary client tampering.

## Ownership and validation

- `console-content.ts`: typed command registry, strict parser, contextual completion and runtime catalogs.
- `console-panel.ts` / `.css`: DOM input, focus, bounded command history, suggestions and results. Mutations are supplied by its owner.
- `console-command.ts`: stage whole checkpoints, save, then commit only the proposed resources/items/actors. The Game durable boundary holds simulation, awaits earlier autosaves and rejects overlapping mutations.
- `enemy-factory.ts`: shared actor construction from explicit spawn snapshots. Normal Simulation spawns and console staging use the same stats/modifiers and initial actor state. Admission and random streams remain caller-owned.
- `console-access.ts`: local ownership/host checks and exact shortcut recognition.

Command RNG is independent of combat and normal encounter random streams. No command adjusts kill counters, XP, encounter receipts or world generation. Spawned actors naturally participate in those systems during subsequent gameplay.

The `/tools/console.html` study uses the actual console panel with a demonstration-only executor and a frozen runtime-rendered backdrop. It never loads saves or runs commands against gameplay. Its presets include utility commands.

Regression checks cover parser/content constraints, completion, local/cloud gates, modifier key ownership, pause restoration, pending/failed saves, item recipe identity, source-level monster restoration and resource behavior. `npm run check` runs code tests, both TypeScript compilations and the local production build. `npm run check:console-build` compiles local and online clients into disposable temporary folders and verifies console inclusion/exclusion and development-page exclusion without invoking Sites. User gameplay testing remains the acceptance check for feel and placement.
