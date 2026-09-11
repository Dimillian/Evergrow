# Wilderness boss lairs

Implemented locally on 2026-09-07; gameplay difficulty awaits player testing. Lairs are additional seeded landmarks, not activated wave events. Existing landmark identities and recipes remain unchanged. No save format or world-version reset is required.

## Encounters

Every lair contains one boss, two Elite lieutenants and eight Veterans. Guards occupy an outer ring and can be approached separately. Seeing or damaging the boss alerts its surviving retinue. There is no E prompt, entrance channel, wave timer, resurrection or recurring summon. Town sanctuary and normal collision rules apply.

| Boss | Climates | Attacks |
| --- | --- | --- |
| Briar Matriarch | Verdant, Mire, Amberwood, Steppe | Claw sweep, committed hunting lunge, three staggered root fractures |
| Ashbound Colossus | Emberfall, Sunscar, Hollow Highlands | Heavy sweep, locked ground eruption, staggered molten fractures |
| Grave Marshal | Deadwood, Frostpine | Sword sweep, committed charge, rally that grants nearby surviving guards +25% attack damage for six seconds |

The silhouettes use procedural bark/antlers/claws, furnace masonry and crowned iron armor respectively. Shared world lighting illuminates their cores, eyes and warning surfaces. Damage warnings stay red. Impact roots, cracks and sparks share the collision origins and dimensions. Corpses use the articulated death system with boss-sized bounds.

Base health is 1,450 / 1,900 / 1,650; base damage is 21 / 26 / 23 before snapshotted regional scaling and the shared damage multiplier. Each boss awards 160 base XP through normal level-gap adjustment. They have normal rank internally; their authored boss stats are not multiplied by Elite rank. New lairs snapshot one regional baseline: Veterans +1, Elites +2, boss +3. Existing actors retain their source levels. Ambient archetype weights for these bosses are zero.

Local pressure pass: major attacks alternate with a compact jab (55% sweep damage, 0.50-second warning) in melee range or one elemental bolt (45%, 0.65-second warning) at distance. Aim tracks until 0.28 / 0.30 seconds respectively, then locks; every warning receives 0–0.12 seconds of deterministic actor rhythm. Out-of-range queued sweeps choose a charge, eruption or fracture instead. A Marshal without a living nearby retinue uses fracture instead of rally.

Below 50% health, authored major recovery falls from 1.2 to 0.75 seconds. The shared boss recovery multiplier is 0.65, yielding 0.78 / 0.4875 seconds. Warning windows stay unchanged: 0.85 seconds for a sweep, one second for a charge, 1.15 seconds for roots/eruption/rally. Rally recovery remains 1.5 seconds. Sweeps reach 150 units; charges travel 330 with 32-unit half-width; fractures reach 410 with 24-unit half-width; eruptions cover a 105-unit radius. A damaging action hits each player at most once, including staggered fractures. Bosses use the Warden's reduced hard-control durations and slow resistance; burn damage remains effective.

Leaving the 670-unit home tether, dying or entering sanctuary sends the boss home. Its health resets only when it reaches home; phase/cadence reset then too. Guard wounds and deaths remain intact. A killed boss never respawns for that character. Closing/loading preserves source health and death state; live attack windups restart safely through existing actor restoration.

## Placement and guidance

A separate lair layer considers one cell per 3×3 block of the existing 1,400-unit wilderness lattice, with a 65% eligibility roll. Up to 24 bounded position attempts fit its 370-unit clearing around existing landmarks, roads, water and settlements. This yields a minimum 3,000-unit center spacing before terrain rejection; it is not a guaranteed encounter every travel interval. All ordinary regional ranges are eligible, including 1–12. Existing anchors are preserved; new low-region lairs fill formerly ineligible cells. The starting corridor and initial camp remain protected.

Lairs are frozen, bounded-cache blueprints with their own `site:<seed>:lair:<cell>` identity. Ordinary sites are generated first and retain priority. Prop and crown generation respects the larger clearing. The south approach and guard placements are collision checked in code tests. Normal camera exclusion prevents visible births, including on reload.

Discovery adds a red crown marker and a pinnable Journeys entry with its resolved or previewed boss level and the Wilderness boss category. Nearby lists can include difficult lairs; automatic recommendations allow the intentional +3 boss challenge. Player equipment strength is not inspected or used to rescale enemies.

## Victory and rewards

Boss death stages a completed hoard in the existing event ledger. The normal automatic reward command saves before publishing chest opening and physical item/gold flights. Remaining guards keep fighting and retain their own rewards. The boss itself awards XP and normal potion/pickup credit, but no extra generic item or gold roll.

The hoard contains:

- Three items at lair level +1, clamped to the shared level limit.
- One guaranteed Rare-or-better roll: 94% Rare, 5.7% Epic, 0.3% Legendary.
- Two ordinary Veteran-weight rarity rolls.
- Boss-chest material weighting on all three items.
- 65–100 gold, multiplied by `1 + 0.1 × (level − 1)` and rounded once.
- The existing Journey completion XP, once when the entire hoard is delivered.

Equipment always delivers, replacing the oldest ground drops when the 1,024-item queue is full. Gold capacity can still delay the coin component. Delivery bits, stable seeds and the boss casualty are saved together; failed saves and reloads do not reroll or duplicate a component. No second interaction is required. Pending automatic rewards use the existing nearby/dead/location checks and retry cadence.

Chronicle counts wilderness bosses toward Kingslayer and adds three boss-specific achievement families, each at 1 / 5 / 20 defeats across distinct lairs. There are now 35 achievement families and 100 tiers.

## Owners and review

`wilderness-boss-content.ts` owns identity, shared bounds and palettes. `wilderness-sites.ts` and `World` own the additive placement layer. `CampPopulation` owns admission and casualty persistence. `wilderness-boss.ts` owns action decisions; `boss-pressure.ts` shares light jab/bolt recipes and execution with dungeon bosses; existing contact/status/reward owners remain authoritative. `wilderness-boss-rewards.ts` stages a hoard on the exactly-once death boundary. `poi-command.ts` delivers it atomically.

`/bosses.html` stages all three real generated lairs, warning shapes and hoard opening. It uses the actual renderer with presentation time only: no gameplay ticks, inputs or saves. `/bestiary.html?bosses` shows the boss silhouettes. Gameplay feel, camera-scale readability and reward pacing remain player acceptance checks.

Verification: all 974 code tests, strict/core type checking and the production build passed for this checkpoint. No automated browser gameplay tests were run.
