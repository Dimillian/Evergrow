# Progression, threat, and loot

## Later elite durability — local September 11 follow-up

Non-boss elites retain their original health through monster level 14, covering the home region's normal 1–12 range and +2 elite offset. Above that, an extra health multiplier ramps linearly to +50% at level 37, then stays capped. A level-37 elite Stalker now has 4,875 life instead of 3,250. Ordinary/veteran health, every boss's health, outgoing damage, attack cadence, loot and XP are unchanged by this pass. This is source-level scaling, never scaling to the player's current gear or DPS.

Already active actors are not mutated. Restored actors reconstruct maxima from current source-level rules while retaining saved current HP, and camp wounds retain their saved HP; loading does not heal old encounters to the higher maximum. Fresh enemies receive the complete new health budget. Existing character progress and encounter levels remain compatible. See [loot/tuning measurements](loot-quality-and-combat-2026-09-11.md).


## Attack pressure — local 2026-09-11

Ordinary ranged basics now prepare in 0.70–0.75 seconds; the Thorn Reaver's basic slash takes 0.45 seconds. Melee preparation tracks longer before committing: normal Brute locks at 0.60 of its 0.95-second windup; quick elite melee leaves at least 0.22 seconds locked. Ground marks, long pounces and regional signature warnings retain their escape windows. Each action adds a deterministic 0–0.12-second variation to its warning, without drawing from combat or loot RNG or imposing shared attack slots.

Eligible elites use two quick basics followed by their full basic/signature action. Quick melee prepares in at most 0.50 seconds and ranged fire in 0.60 seconds, before rhythm variation. These attacks deal 75% of the original basic hit; quick ranged fire is a single projectile. Wisps and pouncing Hounds retain their ground/lane commitment instead of receiving faster blasts. Normal health, source damage, rewards and player defenses are unchanged. Elites and bosses recover at 65% of authored recovery (previously 85% / 80%); normal and veteran recovery multipliers remain 100%.

All four bosses alternate major attacks with a short jab in melee range or a single bolt farther away. Jabs warn for 0.50 seconds and deal 55% of a sweep; bolts warn for 0.65 seconds and deal 45%, plus rhythm variation. Both commit aim before release and share their warning geometry with contact. Bosses select an in-range major instead of endlessly chasing for a queued sweep; the Marshal switches to fractures when no living retinue can benefit from its rally. Heavy damage and minimum warning lengths stay unchanged. Sanctuary, obstacles, leashes, once-per-action contact and source-level projectile rules remain authoritative.

This is local tuning awaiting player feedback. Existing saves need no reset; restored actors safely restart their transient action state. See [combat power audit](combat-power-audit.md) for measured attack frequency and half-second burst checks.

## Larger wilderness packs — local 2026-09-11

Roaming pack size now follows the captured encounter baseline at its spawn anchor:

| Encounter level | Pack size |
| --- | --- |
| 1–12 | 4–6 |
| 13–25 | 6–9 |
| 26–40 | 8–12 |
| 41–60 | 11–16 |
| 61+ | 14–20 |

The first six slots retain normal rank odds. Additional slots use one quarter of the regional elite chance and half the veteran chance, leaving 88% ordinary / 10% veteran / 2% elite at high levels. Every rank remains possible; there is no concurrent population cap. Companion recipes repeat within the biome, and elite leaders retain their complementary escort roles. Larger packs use two loose rings with local obstacle adjustments. Admission reserves the full footprint outside the camera and validates the complete group; failed placement creates no partial group. Each planning pass has at most 256 member candidates, followed by spawn revalidation.

The initial population remains sixteen, so its final group can be smaller. Travel requirements and cooldowns are unchanged. Pack size derives from the encounter's regional baseline, not directly from the player: returning home still produces 4–6-member groups. Dungeon room populations, camps and event waves are unchanged. Existing actors, saves and progress require no reset. The progression power-audit tool now displays pack ranges and crowd pressure through twenty attackers.

Verification: 72 focused spawn, region, camp, control and tooling tests pass, along with type checking and the production build. Headless samples on real terrain generated 18, 16 and 15-member packs for seeds 7319, 18427 and 90210 respectively. This verifies placement, not crowded-combat frame rate; gameplay density and performance remain player testing.

## Earlier challenge tuning

2026-09-11 local challenge tuning: elites have 25% stronger raw hits and 15% shorter post-attack recovery; dungeon and wilderness bosses have 25% stronger hits and 20% shorter recovery. Normal health/damage/timing and all warning lengths remain unchanged. Veterans, elites and bosses resist repeated control and knockback; elite-led roaming packs combine ranged, heavy and flanking roles within their biome, without adding actors. See [combat power audit](combat-power-audit.md) for rules, tests and before/after measurements. Existing progress and wounds remain compatible; loading reconstructs damage with the new tuning at each enemy's saved level/rank.

Local regional monster expansion adds six biome-weighted archetypes, mixed packs, two-basic/one-signature attack cycles, procedural anatomy and matching remains. See [regional monsters](regional-monsters.md) for combat and spawn weights. Existing characters remain compatible.

Local addition: [wilderness boss lairs](wilderness-bosses.md) add three bosses, Elite/Veteran retinues and automatic Rare-or-better hoards through a separate placement layer. Existing landmark identities and save formats remain unchanged.

Equipment construction now has independent weighted material pools and stronger rare bases. See [equipment materials](item-materials.md) for exact rates and multipliers. Material affects base stats and armor affix affinity, independently of affix rarity. Higher source levels and difficult encounters improve material weights.


2026-09-05 · first connected balance model for the local prototype.

The world supplies regional level bounds; the character chooses how far to venture. An enemy keeps the level, rank, combat stats, biome, and reward context it received when it spawned. Leveling up does not strengthen existing enemies or improve their items. Better areas offer higher-level equipment and more XP, while returning to an earlier area makes the character's growth tangible.

These are authored starting curves for playtesting. They establish consistent rules and expose their numbers; they do not establish a balanced endgame. Character progress, equipment, gold, uncollected loot and camp casualties persist in eight browser-local slots; each character also has its own explored chart.

## Ground equipment retention

Each active location retains its newest 1,024 uncollected equipment drops in insertion order. New enemy, event and dungeon-chest items always enter the queue; at capacity, each new item removes the oldest ground item. Old drops never suppress fresh equipment rewards. Picking up items preserves the remaining order, and saving/loading retains that order. No expiry rewards, gold or XP are granted. Inventory and equipped items are unaffected.

Chest delivery bits and any old-item eviction are saved atomically before changing live state. Previously pending equipment is eligible for delivery even when the queue is full. Gold piles keep their separate existing capacity and pending-delivery rules. Existing saves load without a reset; client/server validators share the new equipment limit.

## The progression loop

1. Explore a region with a bounded ordinary level range.
2. Fight normal, veteran, or elite enemies whose levels snapshot the player within that range, with rank offsets.
3. A real death awards source-level XP, adjusted for the character's current level, and rolls the enemy's loot table.
4. Pick up gear, compare its rolls, equip eligible upgrades, and allocate level-up points.
5. Use the stronger build to push farther, or revisit lower-level areas with less danger and lower XP efficiency.

Each gained level still grants **one skill point and five attribute points**. Points are never spent automatically, and leveling does not refill life or mana. A kill that advances the character's level still drops gear for that enemy's original level.

## Geographic threat

Current local rules use overlapping regional ranges: home 1–12, then 4–18, 7–22, 12–28, 18–35 and higher road-linked districts. Normal members vary −1/+1; veterans, elites and bosses add +1/+2/+3 to the captured ordinary baseline. Rank multipliers remain separate. New encounters snapshot once; saved actors and existing activities keep their source identities. All event types and boss lairs are eligible from level one outside protected arrival areas. See [regional scaling](region-scaling.md).

Towns remain protected. Their safe interiors and streets do not create leveled combat encounters. Entering a sanctuary does not convert existing enemies into rewards; withdrawing or despawning a living enemy gives neither XP nor loot.

Level and rank are captured at spawn. Crossing a boundary or pulling an enemy across one never changes that enemy's stats or loot level. Enemy projectiles retain their attacker's source level after launch, including after the caster dies.

There is no living-actor cap, ambient target, camp reserve or concurrent rank/archetype ceiling. Resolved encounter levels determine source stats and ambient rank odds; area boundaries can contain encounters with different snapshots.

Automatic populations wait for valid camera bounds after construction or reset. Sixteen initial roaming enemies settle into the offscreen surroundings in small batches; later groups require both travel and a cooldown. Placement uses the actual camera rectangle, shared visual margins and a forward lead, so a wide zoom does not leave the old fixed-distance spawn ring entirely visible. Packs of four to six enemies use loose formations, with travel-direction-biased placement and biome-appropriate companions. Blocked ground, sanctuaries and every camp footprint remain excluded.

After the initial population has been placed, standing still does not refill cleared ground from elapsed time or camera zoom alone. Further groups require 180–280 units of travel and 2.2–3.8 seconds between placements. Stored travel is capped at 280 units, failed placement retries after 0.45 seconds, preventing an unlimited banked spawn burst. Distant inactive ambient actors may retire only while wholly offscreen; forward travel can also retire hidden trailing actors to free room ahead. Visible or engaged foes remain. Retirement is not death and grants no rewards. These travel and density values are starting playtest parameters.

| Biome | Stalker | Brute | Hexer | Hound | Archer | Wisp |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Deadwood | 34 | 20 | 10 | 14 | 16 | 6 |
| Verdant Forest | 22 | 8 | 8 | 30 | 24 | 8 |
| Swamp | 22 | 10 | 24 | 8 | 10 | 26 |
| Frostpine Reach | 16 | 16 | 8 | 24 | 14 | 22 |
| Emberfall | 18 | 26 | 26 | 10 | 12 | 8 |
| Amberwood | 24 | 10 | 8 | 24 | 28 | 6 |
| Hollow Highlands | 18 | 28 | 10 | 10 | 26 | 8 |

Ambient selection uses each biome's authored weights without per-kind count caps. Camps and event recipes supply their own compositions. Attacks remain independent: sight, range, windup and personal recovery govern each enemy.

### Camps and awareness

Ashen Watch at `(740, 180)` introduces a four-member garrison: a veteran Stalker, an Archer, a Hound, and another Stalker. Ordinary generated camps have eight members with biome-specific support; one third instead hold 10–15 goblins plus a ranked War Chief. Frostpine camps follow a Wisp leader with hounds and a Hexer; Emberfall favors a Brute leader and a second Brute; Amberwood and Verdant camps feature an Archer leader and hounds; Highlands camps place archers behind their Brute leader. The Mire keeps its Hexer leader and Wisp support. Cloth, banners, and soil materials also follow the climate. Shared camp footprints and member slots stay unchanged. Camp leaders are an authored exception to ambient rank rolls: a veteran can appear in a level-one camp; elite leaders require at least area level three. These enemies still use the ordinary rank XP and loot tables.

Camps preload within 1,000–2,000 units according to camera coverage. They coexist without capacity eviction. Distant hidden garrisons sleep only after their fighters disengage; exact wounds, source stats and casualties persist. Clearing all members unlocks the strongbox.

Every camp member must be wholly offscreen and collision-safe before fresh/waking admission. Teleports and wide views have no visible-spawn exception. Trials admit independently along reachable offscreen lanes; no actor-count budget blocks them.

The exact run ledger holds up to 1,024 camp records. At that ceiling new camps remain dormant; existing records are never evicted or falsely marked cleared. Character checkpoints retain cleared camps and dead members; continuing rebuilds surviving encounters. Exploration persists separately per character.

All eight archetypes patrol close to a home position until they notice the player with line of sight. Direct damage alerts the victim and nearby visible members of its own camp. Losing sight for 3.4 seconds or moving more than 470 units from home ends pursuit. Returning enemies use collision-safe steering, retain their current life, and do not grant rewards. Sanctuary entry cancels attacks and sends pursuers away from its entrance.

| Archetype | Pattern | Anticipation / recovery |
| --- | --- | --- |
| Hollow Stalker | Spreads around the target and attacks independently when in range | 0.42s / 0.78s |
| Gravebound Brute | Commits a wide heavy swing early, with a long opening after it misses | 0.95s / 1.20s |
| Mire Hexer | Maintains distance and releases three slow green bolts in a fixed fan | 0.90s / 1.15s |
| Briar Hound | Approaches a flanking lane, crouches, then pounces 89.6 units along a committed direction | 0.68s / 0.95s |
| Ashen Ranger | Retreats under pressure, locks a single arrow, and sidesteps during recovery | 0.95s / 0.95s |
| Lantern Wisp | Locks a ground circle early; its 52-unit blast can be escaped before impact | 1.30s / 1.40s |

Ranged roles make space before starting another attack when the player enters their retreat distance. Aim stops following the player before release: the Archer leaves 0.63 seconds after lock; the Wisp leaves 1.08 seconds. Collision and line of sight remain authoritative for the committed attack. These are the first behavior patterns, not boss phases, full navigation meshes, or squad command logic.

## Shared level curves

For source or item level `L`, let `n = L − 1`:

| Quantity | Level multiplier |
| --- | --- |
| Weapon damage, base armor, flat implicit gear values | `G = 1 + 0.13n` |
| Enemy maximum life | `G × (1 + 0.055n)` |
| Enemy damage | `1.2 × (1 + 0.11n)` |
| Enemy base XP | `1 + 0.18n` |

Archetype definitions retain their level-one values:

| Archetype | Life | Damage per contact | XP |
| --- | ---: | ---: | ---: |
| Stalker | 48 | 8 | 20 |
| Brute | 138 | 22 | 50 |
| Hexer | 56 | 13 | 30 |
| Hound | 37 | 10 | 22 |
| Archer | 45 | 11 | 28 |
| Wisp | 39 | 17 | 32 |

 Level and rank multiply those authored values, including the shared 1.2 damage multiplier, then the result is rounded. Movement speed, windup, attack cadence, and collision size do not accelerate just because an enemy has a higher level.

| Matching level | Normal Stalker life | Hit before defenses | XP | Next-level XP | Stalker equivalents | Common Longsword damage |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 48 | 10 | 20 | 100 | 5.0 | 19 |
| 5 | 89 | 14 | 34 | 565 | 16.6 | 29 |
| 10 | 156 | 19 | 52 | 2,015 | 38.8 | 41 |
| 20 | 341 | 30 | 88 | 6,160 | 70.0 | 66 |
| 50 | 1,307 | 61 | 196 | 28,200 | 143.9 | 140 |

The equivalents column divides the next-level cost by a same-level normal Stalker's XP. It is not an encounter-count or time promise: packs, archetypes, ranks, damage skills, travel, and player decisions all change actual progression speed.

As a narrow calibration example, allocating three Strength and two Vitality per gained level gives 100 / 148 / 208 / 328 / 688 life at the listed levels. A same-level common Longsword hits for about 19 / 36 / 63 / 141 / 552 before tree or other gear bonuses, keeping these Stalkers around three basic hits. This example is neither an optimal build nor a rule that auto-allocates attributes. Staff, bow, critical, defensive, and skill-focused builds need their own playtest comparisons.

## Enemy ranks

Rank is a separate modifier on an archetype, not another enemy behavior implementation:

| Rank | Life | Damage | XP | Equipment item level |
| --- | ---: | ---: | ---: | --- |
| Normal | ×1 | ×1 | ×1 | Enemy level |
| Veteran | ×1.8 | ×1.2 | ×2 | Enemy level + 1 |
| Elite | ×4 | ×1.5 | ×5 | Enemy level + 2 |

Veterans and elites retain the existing readable attack timings. Their additional life, damage, XP, and better loot distinguish the threat. Unique elite affixes, champion pack mechanics, boss behavior, and boss-specific tables are future content.

Veterans start at a 12% rank chance in level-two areas, increasing by one percentage point per area level to a 20% cap. Elites start at 4% in level-three areas, increasing by half a percentage point per area level to an 8% cap. Level-one ambient rolls are normal; authored camp leaders may be veterans. Rank rolls are independent of already living veterans/elites.

## XP costs and level differences

For a character at level `L`, first calculate a same-level normal Stalker's source reward:

`S = round(20 × (1 + 0.18 × (L − 1)))`

Then:

`d = max(0, L − 4)`

`nextLevelXP = roundToNearest5(S × (5 + 2 × (L − 1)^0.8) × (1 + 2d / (d + 3)))`

Thresholds through level 4 stay at 100 / 170 / 230 / 305 XP. After that the pacing premium grows smoothly toward 3×, counterbalancing denser packs. Level 5 requires about 1.5× the previous XP; level 10 about 2.33×. Existing levels and earned XP remain intact. Actual time to level depends on clear speed and activity selection; first-skill thresholds are preserved, not guaranteed elapsed time.

XP within the current level carries through every threshold crossed. Source XP is rounded when the monster's stats are built. At death, the player's **pre-award** level supplies an XP factor:

- At the same level, the factor is 1.
- For a higher-level enemy, add 5% per level difference, capped at +25%.
- Lower-level enemies receive full XP within `3 + floor(playerLevel / 10)` levels of the player.
- Beyond that allowance, multiply by `0.8` for every additional level of difference, with a 1% floor.
- Round the adjusted reward and retain at least one XP for a positive source reward.

A level-ten character therefore gets full source XP from a level-six enemy, 80% from level five, and a maximum 25% risk bonus against enemies five or more levels above them. The high-level enemy also has its intrinsically larger source reward. This factor affects XP only: it does not alter the enemy's stats, gear level, or loot table.

## Loot yield and rarity

Each real death makes one rank-based gear-count roll, using an RNG isolated from combat randomness. The first kill guarantees at least one item if the table otherwise rolled zero. It does not add a bonus item on top of a successful roll.

| Rank | Guaranteed items | Initial extra-item chance | Expected items after thinning |
| --- | ---: | ---: | ---: |
| Normal | 0 | 28% | ≈0.21353 |
| Veteran | 0 | 70% | 0.70 |
| Elite | 1 | 25% | 1.25 |

Each candidate item rolls its tier independently from that rank's table, before common-equipment thinning:

| Rank | Common | Magic | Rare | Epic | Legendary |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal | 74.97% | 22% | 2.7% | 0.28% | 0.05% |
| Veteran | 59.9% | 32% | 7% | 0.95% | 0.15% |
| Elite | 39.6% | 45% | 13% | 1.9% | 0.5% |

These are **conditional tier probabilities per candidate item before thinning**, not per-kill drop chances. For example, an ordinary normal kill has a 0.28 × 0.0005 = **0.014%** chance of a legendary item. Elites guarantee an item, not a minimum rarity. Common drops outnumber gold rares at every rank; these tables apply at all source levels. Legendary currently means four stronger generated affixes; unique legendary powers are not implemented. There is no tier unlock gate, pity counter, smart-loot bias toward the equipped weapon, or magic-find stat in this foundation.

Normal kills discard one third of common equipment candidates using an independent deterministic roll. Charms of every rarity, Magic-or-better equipment, first-kill guarantees and authored boss/chest/event rewards bypass this reduction. Per 100 ordinary non-goblin kills, expected common equipment falls from 19.94 to 13.29; Magic-or-better equipment is 6.66 and charms remain 1.40, for approximately 21.35 items total (23.74% less clutter). Veteran and elite yields are unchanged. The separate thinning stream preserves retained item identities, profiles, stats and rarity, and does not affect gold or XP. Existing ground drops remain untouched.

Default generation for content tools keeps its general-purpose tier distribution of 45 / 32 / 17 / 5 / 1. Enemy rewards explicitly pass the rolled tier into the generator and always use the rank tables above.

## What can drop

An archetype biases item kind without excluding any equipment slot:

| Kind | Stalker | Brute | Hexer | Hound | Archer | Wisp |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Weapon | 32% | 27% | 28% | 18% | 38% | 20% |
| Shield | 6% | 18% | 3% | 5% | 3% | 3% |
| Head | 8% | 10% | 6% | 5% | 7% | 8% |
| Chest | 8% | 15% | 6% | 7% | 6% | 4% |
| Gloves | 10% | 7% | 5% | 13% | 11% | 4% |
| Legs | 8% | 10% | 5% | 10% | 7% | 4% |
| Boots | 12% | 5% | 5% | 22% | 10% | 6% |
| Cloak | 8% | 3% | 14% | 10% | 8% | 15% |
| Amulet | 3% | 2% | 14% | 5% | 4% | 18% |
| Ring | 5% | 3% | 14% | 5% | 6% | 18% |

For weapons, shields, grimoires and orbs, the source biome then weights the profile. Every profile remains possible everywhere. Wands and foci follow their corresponding elemental staff weights; star wands have weight 2 in all climates. Casters and wisps each allocate 10% kind weight to grimoires and 10% to orbs; other archetypes allocate 2% each, keeping each kind table at 100%.

- **Deadwood** favors heavy melee gear and tower shields.
- **Verdant Forest** favors daggers, bows, and lighter shields.
- **Swamp** favors elemental staves, especially frost and lightning.
- **Frostpine Reach** favors frost staves, longbows, and kite shields.
- **Emberfall** favors fire staves, greataxes, maces, and tower shields.
- **Amberwood** favors daggers, hand axes, bows, and bucklers.
- **Hollow Highlands** favors longbows, lightning staves, heavy melee gear, and larger shields.

All seven climates keep the same XP, rank, item-level, rarity, and drop-count formulas. These are relative profile weights within that item kind, not extra drop chances. The exact immutable weights live in `game/src/loot-content.ts`; the [weapon catalog](weapons-and-skills.md) lists the available profiles. Player level, equipped weapon, combat RNG history, and XP-award order are not inputs to the item roll.

## Item growth and defenses

Item level controls the flat stat budget; tier controls quality and affix count:

| Tier | Affixes | Quality multiplier |
| --- | ---: | ---: |
| Common | 0 | ×1.00 |
| Magic | 1 | ×1.09 |
| Rare | 2 | ×1.20 |
| Epic | 3 | ×1.34 |
| Legendary | 4 | ×1.50 |

Weapon damage and flat implicit values use `G × quality`. Flat affixes retain their authored per-level slopes and a seeded 0.85–1.15 roll. Percentage affix slopes instead use `effectiveGrowth = 25n / (25 + n)`: their item-level growth approaches a ceiling, so raw item level does not indefinitely inflate haste, critical chance, movement, or cooldown reduction. Ring damage implicits use `2 × (1 + 0.65 × effectiveGrowth / 25) × quality`. The existing derived-stat caps still apply after item, attribute, and tree bonuses combine.

Required character level remains `max(1, itemLevel − 2)`. A same-level elite's +2 item-level reward can therefore be equipped immediately. Pushing farther can produce gear worth keeping until its requirement is met. Base weapon cadence, reach, arc, family, element, and handedness do not scale with item level. Item power is an informational score, never another damage multiplier.

Armor is now relative to the source of the incoming attack:

`reduction = min(0.8, armor / (armor + 120 × G(attackerLevel)))`

The character sheet estimates this against an attacker matching the character's level. Actual combat uses the enemy/projectile's captured level. A full set of common base armor totals about `30 × G`, so its armor-only reduction remains around 20% against an equal-level enemy instead of climbing toward 80% solely because item levels increased. Shields, affixes, tree investment, and older or newer gear change that ratio. Armor reduces **physical damage only**, including physical melee hits and arrows. Fire, Frost, Lightning and Arcane hits instead use their matching resistance; armor is not applied a second time. Spirit-styled magic counts as Arcane. Enemy ground blasts use their authored element, and the Ash Colossus’s eruptions/fractures deal Fire damage. Other physical boss strikes retain armor mitigation.

Elemental damage is `max(1, round(raw damage × (1 − resistance)))`, with resistance capped at 75%. Resistance has no attacker-level penalty. Shield block applies after either armor or resistance, retaining its existing rounding and minimum-one-damage behavior. Resistance reduces damage, not status duration. Projectile style and source level remain captured after the caster dies.

This changes early balance: a character with no resistance takes unreduced elemental damage before block, even while wearing armor. There is no automatic resistance from levels or starter gear. Rings, amulets and shields may roll a strong single-element or weaker all-element bonus; see [equipment affixes](equipment-affixes.md#elemental-resistance--2026-09-09). Enemy defenses and outgoing player damage are unchanged.

Recovery also follows the growing resource pool. The dual potion restores 42% of maximum life and 40% of maximum mana; every third kill supplies a pickup restoring 12% of maximum life, while the other kills supply 16% of maximum mana. These preserve the starting 42 / 12 / 16 amounts at 100 maximum resources. The two-charge potion still gains one charge per eight kills. Recovery is capped by the missing resource, so it remains useful at later levels without overhealing.

## Bounds and extension points

The content functions normalize levels to **1–1,000,000**, an engineering bound on the current numeric representation. This is not a claim of a tested million-level endgame or mathematically unlimited values. XP rewards are finite nonnegative integer amounts, accepted up to the safe-integer bound; threshold crossing work is bounded by the content ceiling. At that numeric ceiling additional XP is discarded. Ordinary rewards preserve exact overflow and their grouping does not affect progression.

Ground equipment retains the newest 1,024 items, removing the oldest when new drops exceed that limit. Equipment never collects automatically: hover a landed item for its highlight, then click within 360 world-space distance to approach and collect that item only. Pickup requires arrival within 30 and clear line of sight; full bags leave items untouched. Direct movement, attacks, skills, dodge, damage, menus and travel cancel the approach. Unreachable approaches time out. E/controller interaction selects the nearest item within 80; touch can tap its label. Resting labels show only a short material/type name and level. Mouse hover adds a highlight, pointer cursor and a fixed bottom-right tooltip with the full name, rarity, level and item stats. The tooltip does not intercept clicks or alter pickup rules. Gold and resource pickups remain automatic. Selling and buyback are available through town vendors.

Shared ownership keeps the model inspectable:

| Module | Owns |
| --- | --- |
| `progression-content.ts` | Numeric level normalization, raw scaling functions, rank multipliers, source-level armor |
| `progression.ts` | XP thresholds, exact overflow, level-difference factors, reward calculation |
| `zone-progression.ts` | Geographic bands, enemy-stat snapshots, isolated enemy loot seeds |
| `encounter-director.ts` | Geographic ambient mix, population policy, and rank selection |
| `roaming-encounters.ts` | Bounded offscreen placement, travelling groups and inactive retirement policy |
| `spawn-visibility.ts` | Shared camera rectangle and body/effect margins for births, sleeping and removal |
| `enemy-ai.ts` | Patrol, awareness, pursuit, commitment, role spacing, and return behavior |
| `camp-population.ts` | Exact camp membership, bounded sleep/restore ledger, clear state and population priority |
| `wilderness-sites.ts` | Immutable procedural camp/landmark layouts and authored garrison templates |
| `loot-content.ts` | Rank yield/tier tables, archetype kind weights, biome profile weights |
| `loot.ts` | Deterministic bounded reward rolls and source-based item level |
| `items.ts` | Tier-aware item construction, affix budgets, names, appearance, and stat recipes |
| `simulation.ts` | Spawn snapshots, actual death rewards, attack-source metadata, and pickup mutations |

Future additions should extend these registries and shared formulas: further biome-specific enemies, landmark interactions, bosses, affix pools, unique items, and reward sources such as chests or quests. Difficulty, clear time, XP pace, loot usefulness, and inventory pressure remain questions for the user's gameplay feedback.

Base mana regeneration is 1/second (down from 9), with gear and passive mana regeneration added normally. Q uses one shared charge to restore both resources and works when only mana is missing. It does nothing when both are full, during its 0.8-second cooldown, without charges or after death. Potion feedback carries actual restored life/mana separately, with red/blue numbers and a dual-colored HUD vial. The save shape and kill-based charge recovery are unchanged.


## Gold and reward feedback

Gold rolls independently of equipment using a salted enemy loot seed. Player level, pickup order and equipment-table changes do not affect the roll.

| Enemy rank | Gold chance | Level-one amount |
| --- | ---: | ---: |
| Normal | 55% | 4–10 |
| Veteran | 85% | 12–25 |
| Elite | 100% | 35–65 |

Multiply the rolled amount by `1 + 0.1 × (sourceLevel - 1)`, then round to whole gold. These are starting playtest values; NPC shops and improvement costs are implemented with initial tuning in [town services](npcs-and-vendors.md#initial-economy). Stock rarity weights are separate from enemy loot tables.

Coins settle for 0.3 seconds, attract within 100 world units with clear line of sight, and collect within 15 units. The wallet is credited only on pickup, even with a full inventory. Death prevents collection. Piles do not expire; at the 128-pile budget new value merges into the nearest pile. The balance and remaining piles are saved together, preventing a collected pile from reappearing after a successful save/reload.

`wallet.ts` provides `goldBalance`, `creditGold`, `canAfford` and `spendGold` over the character wallet. All amounts must be non-negative safe integers; failed debits and overflowing credits leave the balance unchanged. NPC commands validate and stage the full transaction through this API, persist the proposed checkpoint, then commit it; rendering must never mutate currency. New characters start at zero gold.

The HUD shows a smoothly counting gold balance; inventory shows the exact full balance. Gold and XP gains share one compact notification with separate accumulating totals, leaving the second feed slot available for individual item pickups. Each gain resets its 2.8-second lifetime; gains during the 0.22-second fade revive the same total. Once removed, the next gain starts a fresh total. Queued gains also combine without creating a backlog of reward cards.

XP is still awarded immediately on death, with violet attraction trails and a soft chime. Presentation never delays rewards or changes XP curves. Reduced motion disables trails and counter motion. Reward particles are bounded to 96, and gold/XP audio shares burst attenuation and the existing voice budget. `/rewards.html` reviews world reward art; `/notifications.html?view=rewards` reviews the stacked totals beside individual loot. Both are frozen and save-free.

## Goblin warbands

Nonstarter camp seeds divisible by three select a veteran/elite War Chief and 10–15 normal Scrap Goblins. Elite chiefs follow the existing area-level gate; the chief is not a new boss rank. Goblins have 22 base life, 5 damage and 6 XP; chiefs have 170 life, 17 damage and 65 XP before geographic/rank scaling. Goblins attack with 0.38-second windup and 0.6-second recovery; chiefs use 0.78/0.9 seconds.

The chief alternates six-second rush and surround phases, each with a 0.8-second horn warning. Rush grants nearby visible followers +20% speed and attack damage; surround widens their flanking approach. Orders reach 360 units and expire shortly after losing contact. Damage is captured at windup; killing the chief never changes an already committed hit. Surviving followers flee for 2.2 seconds once their current committed action finishes, then resume ordinary AI. Chief death does not itself clear the strongbox.

Normal goblin initial item chance is 30% of the ordinary normal-enemy yield (8.4% instead of 28%). The same common-equipment thinning then gives 6.405 items per 100 normal goblins; their charm chance stays 0.42% per kill. Candidate equipment uses the same common-heavy rarity and source-level tables. Gold amount is also multiplied by 0.3 and rounded; its independent drop chance is unchanged. First-kill equipment guarantee and ordinary potion kill credit still apply. Chiefs use ordinary rank rewards. This keeps dense packs from multiplying equipment/gold income as much as an equal number of full enemies.

## Dungeon rewards

Rootbound Crypt fixes its level to entrance geography + 1. Floor coordinates never affect source levels. Ordinary enemies use the existing tables. The Hollow Warden awards 120 baseline XP (six normal Stalkers), adjusted by the usual level gap, and no generic equipment/gold roll. Guarded and final chests use normal/veteran/elite source-level recipes and exactly-once physical delivery; see [Dungeons](dungeons.md) for the item/gold budgets.

## Journey completion bonuses

Completed POIs and crypts now grant modest additional source-level XP even without journal tracking. Bonuses range from 0.25 to 3 normal Stalker kill equivalents; town/frontier arrival uses 0.5. The pre-award level-gap factor applies. Completion receipts prevent repeated payouts and share their owning claim/checkpoint with XP. Existing encounter rewards remain intact; see [Journeys](journeys.md) for the table, save behavior and bounds.

## Breakable containers

Camp, watchtower and caravan crates/barrels, plus indoor barrels, shatter on a successful player attack. Sword sweeps, arrows/bolts, area damage and damaging dashes use real contact/line-of-sight checks; windup and enemy attacks do not break them. Chain spells can discharge into an aimed container when no valid enemy is available. Breaking removes collision immediately, with wood shards, barrel hoops and a short cracking sound. Debris settles and fades over 6.5 seconds; it has no collision or reward state.

Each container independently has a **35% gold chance**, yielding **2–7 gold at zone level 1**, scaled by `1 + 0.1 × (zone level − 1)`. Its stable seed is separate from enemy, equipment and combat RNG. Gold uses the existing physical piles, attraction, wallet and reward counter; containers grant no XP, kill count or potion recharge. Destruction IDs and loose coins persist in the same checkpoint, including across dungeon trips. Existing characters continue without a reset. Opening a saved game or revisiting a camp cannot refill containers. Chests and POI rewards retain their existing interactions.

`breakable-containers.ts` owns stable container identities, contact queries and exactly-once currency rolls. `World` projects those receipts onto immutable decor and furniture collision. `material-response.ts` / `material-response-art.ts` own the shared material debris, bounded across containers and combat to 48 bursts / 384 fragments. `/loot.html?containers` stages intact, impact, airborne, settled and fading art without gameplay or saves.

## Slot-specific affix budgets

The September 7 affix pass keeps the above drop counts, tier tables, item-level curves and affix counts. Explicit rolls now use weighted slot/family pools and stronger specialist multipliers; see [equipment affixes and hybrids](equipment-affixes.md) for the current tables and hybrid damage formula.

## Charm rewards (2026-09-09)

[Charms](charms.md) occupy 5% of enemy item rolls and item-giving chest/event rewards, sharing their source rarity and level. The charm roll also applies before themed equipment rewards; it replaces an item rather than adding loot. Active charms may increase gold found (up to +100%) and XP gained (up to +50%). Bonuses apply once to kill/event/Journey XP and created enemy/chest/container gold piles. Sales and already-created piles are not multiplied. Item quantity, rarity and equipment RNG are unaffected by these modifiers.

## Legendary reward tuning — v0.3.15, September 12

Legendary weight replaces Common weight; Magic/Rare/Epic probabilities, candidate quantities, charm eligibility, affix quality and gold are unchanged. Standard non-goblin kills now give a 0.014% chance of at least one Legendary for normals, 0.105% for veterans and 0.624375% for elites (approximately 1 in 7,143 / 952 / 160). The elite figure includes its independent 25% second-item chance. First-kill guarantees and goblin yield retain their existing exceptions.

Regular dungeon final chests retain three rewards and now guarantee Rare-or-better on the first. Their total Legendary chance is 5%. Raid hoards likewise retain three rewards with a Rare-or-better first item and a total 10% Legendary chance. The shared boss-chest tables solve the first reward's Legendary weight after accounting for both supporting rolls, instead of giving every item the advertised whole-chest chance. The first item retains a 5.7% Epic chance; Rare fills the remainder. Supporting dungeon rolls use Veteran/Elite weights; raid rolls use Veteran/Veteran weights.

Other event rewards and side chests that already consume normal/veteran tables inherit their higher Legendary weights. Expedition rewards remain 5% per item for three stage rewards and 20% per item for six grand-chest rewards; no expedition change is part of this pass.

Existing ground/owned items and delivered chest rewards are untouched. Unclaimed reward components use the current deterministic tables; existing delivery receipts still prevent duplicate claims. No character reset is required. Published in v0.3.15 on September 12, 2026.
