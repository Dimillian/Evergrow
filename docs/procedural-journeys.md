# Journeys and local leads

Proposal · 2026-09-06 · not implemented. Design target: give the player a good next adventure while preserving free exploration. This guide proposes rules for a first implementation, not a change to current progression, rewards, spawning or saves.

## Player experience

One small tracked objective answers **“What could I do next?”** It points toward an appropriate region, an interesting encounter or a useful character system. Players can ignore it, pursue another lead or explore independently without penalties.

Use short titles and concrete actions. A typical tracker is just:

> The Broken Road · Level 5
> Open the garrison strongbox

The journal provides the region, difficulty, reward and any steps needed. Avoid mandatory errands, repeated kill counts, daily tasks, deadlines, automatic point spending and tutorials that block play. A quest should make an existing place more meaningful, not require every place to become a quest.

## Three connected layers

| Layer | Purpose | Presentation |
| --- | --- | --- |
| Journey | A short regional adventure linking two or three compatible activities, usually ending with a notable encounter or treasure | One tracked step; the player chooses the next journey when the current one ends |
| Local leads | Optional nearby opportunities: an unopened strongbox, a caravan, a beacon, a trial or a crypt | At most three offered leads in the journal/map; only pinned leads use the tracker |
| Personal milestones | Introduce character building, maps, town services and travel once per character | Small contextual suggestions, not another permanent checklist |

A local lead can become the tracked adventure. Maintain at most three accepted adventures, with exactly one tracked; do not put three trackers on the screen. Personal milestones occupy their own compact journal section. They are not prerequisites for regional adventures.

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

Starting weapons tailor wording and relevant suggestions without choosing a build. A bow character might see compatible skill choices highlighted in the atlas; nothing is auto-allocated, unlocked or assigned. Show one introduction at a time, after combat or during an appropriate panel interaction.

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

Once accepted, the target, source level, reward seed and displayed reward are fixed. Leveling up may produce a separate suggestion; it never moves an accepted destination. Reassess unaccepted suggestions after meaningful context changes, rather than shuffling them whenever the journal opens.

## Guidance and UI

Use the existing Astral UI kit. Enable the journal shortcut J and its existing HUD button as the **Journeys** window, registered with `PanelCoordinator`; keyboard/controller focus, pause and input clearing follow other windows.

- One compact tracker tucked below the minimap; two lines normally. Hide it while a full-screen panel is open. It can be unpinned entirely from the journal.
- Journal: active adventure, up to three available leads, personal milestones and a short completed history. Titles only in headers; descriptions are one useful sentence.
- World map: one highlighted known target or a soft frontier direction. Exact coordinates/POI icons remain hidden until normal discovery. An undiscovered rumor gets a broad search area with no hidden room or terrain reveal.
- Minimap: a small edge bearing for the tracked target when appropriate; no permanent world-space arrow or glowing breadcrumb trail through the forest.
- Inside a dungeon, guidance points to the next known local objective. An unexplored boss room stays hidden. A surface objective directs the player toward a discovered exit, not toward meaningless surface coordinates on the floor.
- Hover shows objective, fixed level, encounter category, distance and reward. Use text as well as color for difficulty.
- Progress counters update quietly in place. Completion uses the existing compact notification feed once, combining any awarded XP/gold through the shared rewards notification. Do not announce every footstep, ordinary kill or intermediate state change.

A quest indication never hides loot labels, combat warnings or the enemy nameplate. Reduced motion uses static markers and normal shared tooltip behavior.

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

1. **Useful next step:** typed state/commands and journal/tracker; single existing-site leads, level-aware frontier suggestions and first-time system milestones. Preserve current characters when valid defaults suffice; no historical event replay or migration framework.
2. **Regional journeys:** compose two or three existing compatible activities, branch on real reveal/choice outcomes, add conservative completion XP and safe offer/history persistence.
3. **Richer authorship after playtests:** NPC-specific lead presentation, biome-specific chapter writing and additional objective templates grounded in new content.

Before playtesting, verify deterministic candidate selection, bounded search, level/route fallbacks, unchanged monster/world scaling, fog-safe markers, blocked/ineligible/full expedition handling, independent RNG, no rerolls on load/dismissal, retroactive durable-step recognition, no duplicate site claims, exactly-once quest reward delivery, storage failure atomicity, and complete pause/focus cleanup.

The player validates the important questions: Is the next adventure inviting? Does a lead arrive when needed? Are walks too long? Does guidance teach systems without interrupting combat? Do repeated journeys feel different? Are suggested challenges actually appropriate for weak and strong builds? Code tests cannot establish those outcomes.
