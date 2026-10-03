# Town portals and map travel

Updated 2026-10-03. **Town portals and visited-location map travel are implemented.** Initial timings remain playtest defaults. [Static captures](captures/2026-09-05/town-portal/README.md) use the real renderer without gameplay.

## Current delivery

P or the minimap-adjacent portal button channels for three seconds outside sanctuary, then travels to the home town (initially Briarwatch). E/click the town return portal to go back once. Empty town anchors can be set as home with E/click. P in sanctuary locates the existing return portal. Casting, return endpoints, native progress/hints, map markers, brief arrival fade/protection and cancellation visuals are implemented. Existing v2 saves remain compatible; absent travel state means Briarwatch home and no return link.

Home/return markers are explicit known positions and reveal no terrain. State and position persist together before relocation; failures preserve the previous link and position. Simulation relocation preserves live actors, ground loot, resources and camp memory, clears action buffers, resets encounter travel credit and waits for destination camera coverage. No portal trip refreshes the initial roaming population. Death removes the return link. Camp casualties remain persistent; surviving wounds retain the existing run-local behavior rather than gaining a new save format here.

The original portal checkpoint was verified with 519 code tests; this is a historical count. Gameplay acceptance remains with the player.

## Player loop

Explore, fill the bag, return to town, sell or improve gear, then return to the same expedition. Travel should remove repeated empty walks while keeping first-time exploration meaningful.

### Town portal

- **P** starts a free, three-second channel outside a sanctuary. A small portal control beside the minimap provides mouse access; it uses neither a skill slot nor a consumable.
- Movement, attack, dodge, taking damage or pressing Escape cancels the channel. Opening a modal also cancels it. World combat continues during the channel. A blocked or invalid departure point prevents starting it.
- Completion automatically takes the character to the last activated **town** waypoint. A wilderness waypoint never changes the home town. Briarwatch's plaza anchor is unlocked as the initial home for every new character; this reveals its destination marker, not its surrounding terrain or route.
- The character arrives at a clear plaza position near the vendors. A visible return portal remains beside the anchor. **E / click** returns to the saved departure point, consuming the portal. It is a deliberate interaction, not a walk-over trigger.
- The portal action is contextual in town: when the return portal is in reach it uses the same persisted return command as E/click; otherwise it briefly locates the portal. Keyboard, controller, touch and the HUD button share this behavior.
- One return portal per character, with no real-time expiry. Creating another replaces the old pair. In town, the portal action highlights an out-of-reach return portal rather than teleporting blindly or opening another.
- The town portal is free and has no additional cooldown. It restores no life, mana or potion charges, and never refreshes vendors or enemies. Its cast time prevents it from being an instant dodge; no extra “out of combat for ten seconds” requirement.
- Arrival cancels movement/attack buffers and grants one second of protection, ending immediately on an offensive action. It does not push enemies away, clear encounters or reveal more than the ordinary discovery radius.

The return destination remains the actual wilderness position, even after equipment changes. Enchanting still uses the town NPC's geographic level: returning from a level-20 area to a level-1 town does not turn that town into a level-20 service.

### Visited-location map travel

Open the full map with M, click or tap a visited marker, then choose **Teleport** in its compact destination card. All discovered location types qualify: settlements, services, camps, shrines, landmarks and outdoor dungeon entrances. Ordinary local discovery within the existing 600-unit reveal radius counts as visiting; locations only sighted through a beacon do not unlock travel until locally discovered. Unknown Journey search areas and synthetic home/return hints cannot grant travel permission. No additional waypoint activation or save schema is required.

Travel is free and immediate after the destination is saved, from either town or wilderness. Full-map combat remains paused. Dragging/pinching never selects a destination; held-Tab overlay remains passive. Leave a dungeon or rift through its existing travel flow before using surface map travel, so it cannot bypass run ownership or abandonment rules. Teleporting to a dungeon marker lands outside its entrance, without entering or completing it.

The command resolves the selected ID against the active character's stored chart, rejects merely sighted/missing/invalid destinations and searches for clear nearby ground with the existing bounded landing rules. Persistence finishes before relocation; failed writes or blocked landings leave the live run untouched. A trip interrupts active timed trials as town travel does, but preserves enemies, loot, progression, resources, home town and existing return portal. Arrival shares the fade, camera snap, input cleanup, brief protection and spawn-coverage barrier. No connecting route is revealed.

`travel-command.ts` owns permission, landing and persistence; `LocationController` establishes arrival only after success. `WorldMap` owns the selectable destination card, and `Game` supplies the durable-action barrier. The preceding proposed activated-waypoint network is superseded by this visited-location rule.

## Visuals and UX

Portal: an upright oval of thin silver-violet strands above a ground rune, with inward-traveling motes and restrained dynamic light. A translucent inner membrane, selected strands and the ground-rune core carry a brighter destination color. Mote silhouettes distinguish ash, leaves, mist, snow, embers, petals, shards, grass and sand across the nine biomes. Hazardous surface destinations add a warm warning chevron; dungeons add a sealed inner compass. The structural silver-violet identity remains fixed. A small progress ring grows during channeling; interruption unravels it. Avoid a solid neon disk or a large screen banner.

Channeling names the actual Home town. The compact world label uses only the destination name; the HUD tooltip and accessible label provide the preserved surface region and its ordinary level range, or the retained dungeon and its level. This presentation is derived from already-saved destination facts and never reveals terrain, routes, actors or rewards.

Map travel reuses existing POI symbols and the shared frosted-glass card/buttons. Eligible hover cards include **Click to travel**; unvisited selections explain why teleporting is unavailable.

Use existing tooltip, notification and reduced-motion behavior. Notify activation once; routine travel needs only the transition and destination readout. A brief 180–250ms fade masks relocation. Camera current/previous positions snap together; it must not fly across the world. World rendering must have valid destination coverage before spawning resumes.

## World, encounters and saves

Travel is a complete command: resolve authorized destination, find clear ground, stage player position/link/home state, save, then publish the transition. Revalidate the departure at channel completion. Failed storage, stale session, invalid anchor or no safe landing leaves the character and previous portal unchanged. There is no charge to refund.

- Persist home town ID and the optional return link, scoped to character and world generation. Map travel reuses visited POIs in the character's existing exploration chart.
- Never land inside walls, props or water collision. Search deterministically within 80 units of an obstructed return position; if no valid point exists, retain the link and show **Return point blocked**. Never silently send the player to another zone.
- Preserve source-level/rank/reward identities and existing camp casualties. Ambient retirement grants no rewards. New actors obey the existing offscreen visual margin at the destination, including on zoomed-out arrival.
- Active POI encounters pause while unloaded and persist their exact progress; travel cannot reset their defenders or generate a second reward. Ordinary live ambient enemies continue following existing save/streaming rules.
- Save remaining durations for any POI blessing in simulation seconds; time in town, menus or unloaded event space follows the POI rules. Wall-clock time on a closed browser is never a reward or refill mechanic.
- Reuse exploration's existing 4,096-POI bound without a second unlocked-anchor collection. Never evict visited destinations to make room for new ones.

Keep immutable anchor definitions separate from character travel state. `travel.ts` owns portal/channel and landing rules, `travel-command.ts` owns persistence and relocation, and `travel-art.ts` owns portal drawing. Map travel extends the existing chart; there is no second travel map.

## Delivery and acceptance

1. Town anchor, P channel, return endpoint and clear landing; cancel/no-heal behavior, focus clearing, exactly-once save-backed travel.
2. Shared-map visited-destination selection; existing per-character discovery and preserved return ownership.
3. Procedural visuals and frozen in-app captures of channel, arrival, map and return states. Player tests actual pacing and readability.

Code checks cover damage/movement interruption, duplicate input, zero/full resources, boundary/collision destinations, death during channel, stale save writes, save/continue, character isolation, source-level preservation and no on-screen enemy births. These are required correctness checks; affordability and gameplay feel remain with the player.
