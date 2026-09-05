# Town portals and waypoints

Updated 2026-09-05. **Town portal implemented; permanent waypoint travel remains specified.** Initial timings remain playtest defaults. [Static captures](captures/2026-09-05/town-portal/README.md) use the real renderer without gameplay.

## Current delivery

P or the minimap-adjacent portal button channels for three seconds outside sanctuary, then travels to the home town (initially Briarwatch). E/click the town return portal to go back once. Empty town anchors can be set as home with E/click. P in sanctuary locates the existing return portal. Casting, return endpoints, native progress/hints, map markers, brief arrival fade/protection and cancellation visuals are implemented. Existing v2 saves remain compatible; absent travel state means Briarwatch home and no return link.

Home/return markers are explicit known positions and reveal no terrain. State and position persist together before relocation; failures preserve the previous link and position. Simulation relocation preserves live actors, ground loot, resources and camp memory, clears action buffers, resets encounter travel credit and waits for destination camera coverage. No portal trip refreshes the initial roaming population. Death removes the return link. Camp casualties remain persistent; surviving wounds retain the existing run-local behavior rather than gaining a new save format here.

Deferred portions below: permanent waypoint network/map travel, biome-specific portal tint and future POI encounter integration. Town anchors currently set the home destination only. Verified with 519 code tests, strict application/core compilation and production build; gameplay remains for the player.

## Player loop

Explore, fill the bag, return to town, sell or improve gear, then return to the same expedition. Travel should remove repeated empty walks while keeping first-time exploration meaningful.

### Town portal

- **P** starts a free, three-second channel outside a sanctuary. A small portal control beside the minimap provides mouse access; it uses neither a skill slot nor a consumable.
- Movement, attack, dodge, taking damage or pressing Escape cancels the channel. Opening a modal also cancels it. World combat continues during the channel. A blocked or invalid departure point prevents starting it.
- Completion automatically takes the character to the last activated **town** waypoint. A wilderness waypoint never changes the home town. Briarwatch's plaza anchor is unlocked as the initial home for every new character; this reveals its destination marker, not its surrounding terrain or route.
- The character arrives at a clear plaza position near the vendors. A visible return portal remains beside the anchor. **E / click** returns to the saved departure point, consuming the portal. It is a deliberate interaction, not a walk-over trigger.
- One return portal per character, with no real-time expiry. Creating another replaces the old pair. In town, P highlights the existing return portal rather than teleporting blindly or opening another.
- The town portal is free and has no additional cooldown. It restores no life, mana or potion charges, and never refreshes vendors or enemies. Its cast time prevents it from being an instant dodge; no extra “out of combat for ten seconds” requirement.
- Arrival cancels movement/attack buffers and grants one second of protection, ending immediately on an offensive action. It does not push enemies away, clear encounters or reveal more than the ordinary discovery radius.

The return destination remains the actual wilderness position, even after equipment changes. Enchanting still uses the town NPC's geographic level: returning from a level-20 area to a level-1 town does not turn that town into a level-20 service.

### Permanent waypoints — specified, not implemented

Each town plaza and a sparse subset of existing roadside shrines contain an anchor. The origin shrine is unlocked initially too. Other anchors require approaching and activating with E/click. Seeing one on the map is discovery, not activation. Initial wilderness density: roughly one anchor per 3,200–4,800 units of road travel; do not duplicate nearby town anchors within 1,200 units.

At an activated anchor, open the existing world map in Travel mode. Click an unlocked destination, see its name and area level, and choose **Travel**. Unknown destinations are absent; discovered but inactive anchors show **Activate in person**. The ordinary map remains useful anywhere but cannot teleport from arbitrary wilderness ground.

Travel is free. Departing from a wilderness anchor requires the same interruptible three-second channel; town-to-anchor travel is immediate after confirmation. Arrival rules match the portal. Visiting/activating a town changes the home town; merely hovering or selecting a destination does not.

Waypoint travel closes an outstanding return portal, preventing multiple expedition anchors. The existing destination confirmation displays **Closes your return portal** when relevant; no additional confirmation dialog. Walking out of town does not close it. Death closes it. Character switching preserves each character's own link, and normal save/continue restores it.

## Visuals and UX

Portal: an upright oval of thin silver-violet strands above a ground rune, with inward-traveling motes and restrained dynamic light. A small progress ring grows during channeling; interruption unravels it. Departure-biome tint remains a later visual refinement; current portals use silver-violet. Avoid a solid neon disk or a large screen banner.

Waypoints use a low stone plinth and engraved rings: dark when discovered, illuminated after activation. Their silhouette differs from temporary buff shrines. Native-resolution labels only appear on focus. The atlas distinguishes inactive, activated, home-town and return-portal markers, with concise hover information and area level.

Use existing tooltip, notification and reduced-motion behavior. Notify activation once; routine travel needs only the transition and destination readout. A brief 180–250ms fade masks relocation. Camera current/previous positions snap together; it must not fly across the world. World rendering must have valid destination coverage before spawning resumes.

## World, encounters and saves

Travel is a complete command: resolve authorized destination, find clear ground, stage player position/link/home state, save, then publish the transition. Revalidate the departure at channel completion. Failed storage, stale session, invalid anchor or no safe landing leaves the character and previous portal unchanged. There is no charge to refund.

- Persist home town ID, unlocked anchor IDs and the optional return link, scoped to character and world generation. Store anchor identities and reconstruct positions from generated geometry; only the temporary departure requires explicit coordinates.
- Never land inside walls, props or water collision. Search deterministically within 80 units of an obstructed return position; if no valid point exists, retain the link and show **Return point blocked**. Never silently send the player to another zone.
- Preserve source-level/rank/reward identities and existing camp casualties. Ambient retirement grants no rewards. New actors obey the existing offscreen visual margin at the destination, including on zoomed-out arrival.
- Active POI encounters pause while unloaded and persist their exact progress; travel cannot reset their defenders or generate a second reward. Ordinary live ambient enemies continue following existing save/streaming rules.
- Save remaining durations for any POI blessing in simulation seconds; time in town, menus or unloaded event space follows the POI rules. Wall-clock time on a closed browser is never a reward or refill mechanic.
- Begin with a bound of 1,024 unlocked anchors plus one return link. Never evict an unlocked anchor silently. At the limit, discovery still works and existing travel remains available; further activation is unavailable. Validate the combined save size with POI/commerce state before settling the schema.

Keep immutable anchor definitions separate from character travel state. Proposed owners: `travel.ts` for plans/channel rules, a narrow runtime command for persistence and relocation, and `travel-art.ts` for portal/anchor drawing. Extend the existing map and E-interaction dispatch; do not build a second travel map or a general entity framework.

## Delivery and acceptance

1. Town anchor, P channel, return endpoint and clear landing; cancel/no-heal behavior, focus clearing, exactly-once save-backed travel.
2. Activated waypoint network and shared-map destination selection; per-character persistence and portal invalidation on travel/death.
3. Procedural visuals and frozen in-app captures of channel, arrival, map and return states. Player tests actual pacing and readability.

Code checks cover damage/movement interruption, duplicate input, zero/full resources, boundary/collision destinations, death during channel, stale save writes, save/continue, character isolation, source-level preservation and no on-screen enemy births. These are required correctness checks; affordability and gameplay feel remain with the player.
