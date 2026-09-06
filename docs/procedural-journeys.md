# Journeys and local leads

Design proposal · 2026-09-06. Single-site guidance, the journal and markers are now implemented locally; see [current Journeys guide](journeys.md) for the exact scope. Regional chains and personal milestone memory remain proposed. Design target: give the player a good next adventure while preserving free exploration. This guide proposes rules for a first implementation, not a change to current progression, rewards, spawning or saves.

> Current implementation has since adopted natural completion XP and separate Recommended/Nearby lists at the player’s request. The [current guide](journeys.md) supersedes the reward and refresh policies below; remaining sections preserve the original proposal.

## Player experience

A compact quest list beneath the minimap answers **“What could I do next?”** It shows a tracked activity and a few quiet alternatives. A recommendation remains a suggestion until explicitly pinned, not an automatically accepted quest. Players can ignore it and progress entirely through ordinary combat. Existing geographic danger and level-gap XP rules still apply; ignoring guidance adds no penalty.

Use short titles and concrete actions. A typical mini log has one emphasized activity and two muted rows:

> ◆ Watchtower · Level 5
> Light the beacon
> ◇ Caravan · Level 5
> ◇ Graveyard vigil · Level 6

Click any row to open Journeys with that activity selected. Only the tracked row shows its current objective on the HUD; the other rows remain one line each.

The journal provides the region, difficulty, reward and any steps needed. Avoid mandatory errands, repeated kill counts, daily tasks, deadlines, automatic point spending and tutorials that block play. A quest should make an existing place more meaningful, not require every place to become a quest.

## Three connected layers

| Layer | Purpose | Presentation |
| --- | --- | --- |
| Journey | A short regional adventure linking two or three compatible activities, usually ending with a notable encounter or treasure | Optional pinned step; longer chains stay in the journal |
| Local leads | Optional nearby opportunities: an unopened strongbox, a caravan, a beacon, a trial or a crypt | A few muted rows in the mini log; more detail in the journal/map |
| Personal milestones | Introduce character building, maps, town services and travel once per character | Internal once-per-character teaching state; relevant hints inside existing panels only |

A local lead can become the tracked adventure. Maintain at most three explicitly accepted adventures and at most one pinned. The HUD mini log shows at most three distinct rows: the pinned activity first, then other accepted activities, then one recommended lead if space remains. Unpinned rows are muted and never gain competing directional markers. The journal holds further alternatives. Personal milestones are internal memory, not a visible completion checklist or prerequisites for regional adventures.

Town services can provide plausible leads: the blacksmith mentions a caravan or garrison cache; the enchanter points toward standing stones or burial sites. Their existence never requires talking to every NPC. Independently discovering the target starts the same opportunity. No new quest-giver NPC, dialogue tree or quest-item inventory is required for the first pass.

## First hour: guided by opportunities

These are contextual introductions, not a fixed chain that every character must follow in order:

| Situation | Suggested goal | Completion |
| --- | --- | --- |
| New character, no recovered gear | Recover supplies at an eligible nearby camp or caravan | Claim that site's actual reward; normal encounters remain available on the way |
| Gear has been recovered | Inspect your equipment | Open character/inventory with a real item available; equipping is optional because the drop may be worse |
| Unspent points become available | Shape your build | Open the relevant panel and inspect an attribute/node; choosing where or whether to spend remains the player's decision |
| First nearby beacon | Survey the road ahead | Activate the beacon and use its actual reveal result to offer the next lead |
| First town/service visit | Meet the blacksmith | Open the service; show selling when spare gear exists, and enhancement when affordable |
| First appropriate expedition | Explore the crypt | Enter an eligible crypt, defeat its Warden and claim the final chest; explicitly optional and marked Boss |
| Loot obtained far from town | Return and prepare | Use town portal and reach a service, then optionally follow the return portal |
| Current region is falling behind | Seek a stronger region | Reach a suitable fixed-level district or a known entrance into it |

Do not require a purchase, sale, enhancement or reroll to progress the main journey. Expensive services are introduced through their preview, not subsidized with mandatory gold sinks. A full bag, a build saving points or an unlucky loot roll must never block the next adventure. Introductions can be dismissed; opening panels does not award repeatable XP or gold.

Starting weapons tailor wording and relevant suggestions without choosing a build. A bow character might see compatible skill choices highlighted in the atlas; nothing is auto-allocated, unlocked or assigned. Show an introduction only inside a relevant panel the player opens. Reuse existing unspent-point badges; do not add another level-up toast, force a panel open or queue tutorials while fighting.

## Procedural composition

Generate from authored templates and real seeded world facts; no generated prose service is needed. A template supplies a concise title, suitable site kinds, prerequisites, completion predicates and reward class. A world query supplies stable site/region IDs, coordinates, level, biome and current availability.

Example forms:

- **The Broken Road:** clear a garrison → claim its strongbox → optionally visit the nearby blacksmith. The chest is the adventure's completion; the town visit is a separate contextual lead.
- **Light the Frontier:** activate a watchtower → investigate the landmark that it actually reveals. If the reveal finds nothing, the beacon still completes its own lead and the journey offers another valid frontier route.
- **The Restless Dead:** resolve a graveyard vigil → enter a nearby eligible crypt → defeat the Warden and claim its chest. Offer this chain only when its compatible sites really exist; never promise a crypt beside every graveyard.
- **A Road Through the Mire:** reach a newly discovered district → recover a caravan's goods OR coins. Both choices satisfy the objective and keep the caravan's existing mutually exclusive reward contract.
- **Under the Chief's Banner:** find a known goblin warband → defeat the garrison and open its strongbox. Killing the chief alone is insufficient while followers remain.

The procedural variation comes from geography, biome, encounter composition, route and player choice—not merely a randomized quest title. Avoid the same terminal activity twice in a row when alternatives exist. Never attach two accepted quests to the same terminal site, or manufacture duplicate chests/guardians for quest use.

A first journey should target roughly 5–10 minutes including detours; local leads 1–3 minutes. These are playtest targets, not promises from straight-line distance. Regions and towns are currently widely spaced: prefer nearby meaningful activities over a forced town return after every objective. Show estimated distance; do not invent a precise walking ETA without a measured route.

## Level and route selection

The quest director recommends geography; it never changes it. Use the existing seeded district level, dungeon entrance level (+1 for the floor), enemy ranks and POI rules.

Initial proposal:

- Standard exploration and normal encounters: prefer source levels **player level −1 through +1**, clamped to world bounds.
- Optional challenges: prefer **+2 to +3**, with an explicit danger label. A boss, elite chief or multi-wave vigil can be challenging even at equal level: show its encounter category separately from numeric level.
- Regions two or more levels below the player can prompt a new frontier suggestion. Keep the old route available for safe exploration and unfinished rewards.
- Gear power may inform a gentle preparation hint; it is not a reliable enough difficulty measure to lock access or certify a boss as easy. Repeated deaths can offer a safer alternative, never silently weaken encounters.

Rank eligible candidates by availability, level fit, known road approach, route distance, activity variety and whether they introduce something new. Prefer already discovered unfinished sites, then opportunities adjacent to the explored frontier. Do not send players across a known high-danger pocket just because a target on its far side has a suitable level.

Search on explicit triggers: character entry, journey completion/dismissal, district entry or meaningful level changes. Do not scan the world every frame. Begin with known nearby candidates and expand a bounded number of geographic cells. Initial budgets: 64 distinct candidate sites per refresh, processed incrementally; 12 cached offers and three visible leads. Use existing bounded world query APIs. A coarse road approach is guidance, not guaranteed obstacle-free navigation.

If no suitable site is found within the bounded search, offer **Explore the northern road** or another verified local frontier direction, with the level information currently known. Do not invent an exact-level zone, create a dungeon, force a distant expedition or generate actors to satisfy the quest. Expand the search after actual travel.

Once accepted, the target, source level, reward seed and displayed reward are fixed. Reassess unaccepted suggestions after meaningful context changes, rather than shuffling them whenever the journal opens.

### Leveling through ordinary combat

Combat-only progression is fully supported. XP, level-ups, stat points and skill points work exactly as they do now, with no journey gate or catch-up checklist. Kills do not complete unrelated site objectives, and the director never tells a player to stop a profitable activity just because it lacks a quest label.

A level change marks recommendations for reassessment; it does not publish a new message. On the next safe opportunity, evaluate whether the current suggestion still fits. Keep it when suitable. When clearly outgrown (initially at least two levels below the player), silently replace an unaccepted recommendation row with a suitable available activity. Explicitly accepted activities stay in the list until completed or dismissed, even when not currently pinned. Several rapid level-ups coalesce into one reassessment. Never swap the HUD recommendation during combat, a channel, a dungeon expedition or an open interaction.

Pinned activities stay pinned regardless of level gain. They can be completed at their original fixed level and reward terms. A newer recommendation may quietly occupy a free secondary row or remain in the journal. It never replaces the pinned row, gets a second directional marker or produces a warning.

Example: at level 4, a level-4 camp is suggested. The player roams and reaches level 7. If unpinned, the director quietly prefers a real level-6–8 activity at a safe opportunity. If pinned, the camp remains the destination and stays level 4. If no suitable nearby activity exists, offer a verified frontier direction rather than inventing content or forcing a long exact-level detour.

Initial anti-churn rule: keep an unpinned recommendation for at least 90 active-play seconds unless its target becomes unavailable; only replace an unaccepted recommendation when substantially outgrown, left well behind or completed. Pinning and journal inspection never reshuffle the remaining list. Ignoring it does not make it pulse, repeat, escalate or enter a notification queue. Dismissing a recommendation suppresses that offer; it is not immediately backfilled by another nag. Collapsing the mini log persists until expanded, and hiding recommendations persists until restored from the journal; no periodic resurrection on each level-up.

## Guidance and UI

Use the existing Astral UI kit. Enable the journal shortcut J and its existing HUD button as the **Journeys** window, registered with `PanelCoordinator`; keyboard/controller focus, pause and input clearing follow other windows.

### Mini log under the minimap

- One small block aligned to the minimap's width, with a restrained **Journeys** header and collapse chevron. Thin separators and a faint dark backing; no large card borders or explanatory subtitle.
- At most three rows. The pinned activity comes first, with a warm ivory title, a small filled diamond, its fixed level and one short objective line. Meaningful progress such as `1 / 2 beacons` can sit on that line; avoid arbitrary percentage bars.
- Other accepted activities and the recommended alternative use muted titles, a hollow icon and level only. Mark the single recommendation with a small compass glyph rather than adding a subtitle to every row. No pulsing exclamation marks or unread badges.
- One row is perfectly valid; do not fill the list with poor recommendations merely to reach three. If nothing is available, retain only the collapsed journal access rather than a persistent empty-state instruction.
- Clicking the header opens the journal. Clicking a row opens it with that activity selected; this does not silently accept it, change the tracked destination or start an encounter. The panel's explicit **Track** action accepts/pins the selection.
- Collapsing preserves a compact header and optional tracked icon; it does not abandon progress. On narrow screens, begin collapsed if necessary to protect gameplay space. Retain the player's choice across sessions.
- Progress/completion updates in place. A quiet completed check precedes removal at a safe list-update point; no sound, notification, expanding animation or forced next selection. Longer accepted journeys advance their pinned step normally.

### Click-through journal

One shared window with the title **Journeys**, a compact activity list on the left and the selected activity on the right. The detail area shows the title, current objective, fixed level, encounter category, location and actual reward. Longer chains may show their few steps here; do not expand them in the mini log.

The only primary action is **Track** (or **Untrack** for the pinned activity); **Show on map** focuses its discovered target or broad search area. Dismissal is secondary. Closing the window restores gameplay focus through the normal coordinator. Opening this panel pauses combat, clears buffered actions and joins the shared UI hit boundary so a click cannot also fire an attack.

Accepted activities and recommendations are visually distinguishable. No milestone checklist, quest text wall or auto-opened completion window. Existing contextual teaching hints remain inside their relevant character/service panels.

### Activity markers

Use one shared quest-marker identity across the mini log, journal and maps: a filled pale-gold diamond for the tracked activity, with a small activity glyph inside. Shape and fill distinguish it from ordinary POIs without relying only on color. Preserve existing danger/rank symbols; a quest marker never implies that a boss is safe.

- **World map:** emphasize the tracked discovered activity with a thin ring and its normal place label. Existing nearby POIs remain ordinary icons; untracked quests do not add a field of extra markers.
- **Minimap:** show the same tracked symbol at its actual location. When outside the minimap, clamp one directional indicator to its edge. This is a bearing, not an obstacle-free walking path. Hide the edge indicator once the actual marker enters the minimap.
- **In the world:** when the relevant entrance, chest, beacon or NPC is discovered and visibly on screen, place a small marker above its existing interaction anchor. Use a stable offset and the existing visibility/occlusion rules. No permanent light pillar, world-screen edge arrow or breadcrumb trail. The marker does not bypass interaction reach or line of sight.
- **Undiscovered activity:** show a broad search area or frontier bearing, never the precise hidden POI or unrevealed terrain. Once normal exploration reveals it, replace the search-area marker with the precise activity marker.
- **Dungeon and town transitions:** markers are location-aware. An outdoor crypt goal points at its entrance; inside, point only at a discovered local objective or a broad unexplored direction. An undiscovered boss room stays hidden. A surface objective while underground directs toward a discovered exit, not the surface coordinates projected onto the floor. In town, follow the saved return portal only when its destination actually serves the tracked activity; otherwise use the town exit/known route.
- **Completion/untracking:** remove all marker projections from the same quest state update. A cleared objective cannot leave a stale arrow on one map. Tracking a new activity replaces the previous marker, rather than accumulating markers.

Hovering a mini-log row or marker uses the shared tooltip motion and displays only objective, level/category and distance where meaningful. Native-resolution text/numerals and icons remain readable independently of camera zoom. Reduced motion uses static markers; no idle pulsing in the default design either.

Keep the mini log outside the enemy plate, loot-label and combat-warning areas, with consistent input hit bounds. No quest-step or recommendation toasts: actual XP/gold use the shared rewards feed, named item pickups remain unchanged, and existing area/level notifications are not duplicated.

## Objectives and persistence

First implementation needs a small typed set:

- discover district/site;
- activate beacon;
- resolve caravan choice or trial;
- clear named garrison and claim its strongbox;
- enter a specific dungeon, defeat its boss, claim its final chest;
- visit a service or inspect a character system;
- complete a town portal trip.

Avoid arbitrary “kill 20 enemies” objectives. A garrison uses its real casualty ledger; a boss uses its expedition's boss state. Never infer these from nearby actor absence, VFX, notification text or transient rendering events.

Recognize completed durable world facts when binding a step. If the player already killed a boss before accepting a linked step, do not require the boss to respawn. If the whole activity is already resolved, do not offer it as a fresh rewarded quest. Previously learned milestones can be marked understood from durable character state; do not fabricate historical visits or award retroactive reward chains.

Player progress is committed in the owning domain command: POI reward, commerce action, dungeon transition/treasure, travel or character command. Queued presentation events may notify the UI, but cannot be the only evidence of completion. Quest state and any quest reward must persist with the underlying transaction, preventing missed rewards or duplicate awards after a crash/reload.

Suggested owners:

- `quest-content.ts`: immutable templates, objective types, milestone rules and initial reward budgets.
- `quest-director.ts`: deterministic bounded candidate filtering/ranking and offer binding, with its own RNG seed stream.
- `quest-state.ts`: accepted instances, typed step progress, completion and source/reward identity.
- `quest-command.ts`: accept, track, dismiss and completion/reward transaction plans.
- `quest-journal.ts` / tracker: shared UI projections only; map adapters respect each location's discovery state.

No quest module owns enemy AI, item generation, wallet math, XP thresholds, NPC stock or dungeon construction. Existing source owners remain authoritative. This is not a second scripting engine for combat or a generic event bus for all systems.

Persist stable template version/ID, quest serial, source IDs, source level, reward seed, objective progress and reward-claim state per character. Initial bounds: three accepted adventures, 12 saved offers, 32 milestone flags and 64 recent history entries. Claimed/retired quest serials use a monotonic frontier plus the bounded unresolved set so trimming presentation history never allows an old reward to be claimed again. Durable POI/expedition ledgers remain authoritative when refusing completed sites; do not bypass their existing finite save capacities.

Dismissal removes guidance without resetting the world. An accepted source can be reattached without changing its reward seed or eligibility. No free offer-reroll button. Menu opening, loading, deaths, portaling and switching tracked goals never reroll rewards or regenerate content.

## Rewards and economy

The primary reward remains the actual encounter, exploration reveal and site treasure. Quests should not become a second, stronger item faucet.

- Personal introductions: no combat power rewards; they teach existing choices. Level-up remains the only ordinary source of its one skill point/five attribute points.
- Single-site local leads: normally only that site's existing reward, previewed once—not duplicated by the journal.
- Multi-site journeys: one modest completion bonus, not a payout at every step. Start at **one to three normal same-source-level Stalker kills' XP**, depending on effort, with the normal level-gap adjustment evaluated at award time. Source level is fixed when bound; no percentage-of-current-XP-bar rewards.
- Initially no additional random gear or guaranteed Rare rewards. Quest completion gold is also deferred until the existing encounter/vendor economy has been measured; ordinary chests, coin piles and sales already support it.

If a chapter completes when opening a chest, snapshot the pre-award player level and compute ordinary and quest XP from that same snapshot before committing, so payout order cannot change the result. Keep bonus XP subordinate to combat income: first tuning target under roughly 10% of earned XP over representative journeys. The suggested one-to-three-kill bonus is reduced or removed if it exceeds that target.

Quest completions may later support titles, regional story fragments or cosmetic journal seals. Reputation, currencies, repeatable bounties and extra passive points are deliberately outside the first implementation.

## Delivery and acceptance

1. **Useful next step:** compact clickable mini log, journal, one tracked activity with shared map/world markers, single existing-site leads and level-aware frontier suggestions; milestone memory only provides hints inside relevant existing panels. Preserve current characters when valid defaults suffice; no historical event replay or migration framework.
2. **Regional journeys:** compose two or three existing compatible activities, branch on real reveal/choice outcomes, add conservative completion XP and safe offer/history persistence.
3. **Richer authorship after playtests:** NPC-specific lead presentation, biome-specific chapter writing and additional objective templates grounded in new content.

Before playtesting, verify combat-only leveling, coalesced safe-time recommendation updates, pinned-target stability, persistent collapse/dismissal, click-through selection without accidental acceptance or attack, one-marker ownership across locations, no duplicate notifications, deterministic candidate selection, bounded search, level/route fallbacks, unchanged monster/world scaling, fog-safe markers, blocked/ineligible/full expedition handling, independent RNG, no rerolls on load/dismissal, retroactive durable-step recognition, no duplicate site claims, exactly-once quest reward delivery, storage failure atomicity, and complete pause/focus cleanup.

The player validates the important questions: Is the next adventure inviting? Does a lead arrive when needed? Are walks too long? Does guidance teach systems without interrupting combat? Do repeated journeys feel different? Are suggested challenges actually appropriate for weak and strong builds? Code tests cannot establish those outcomes.
