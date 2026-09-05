# Progression, threat, and loot

2026-09-05 · first connected balance model for the local prototype.

The world supplies the danger; the character chooses how far to venture. An enemy keeps the level, rank, combat stats, biome, and reward context it received when it spawned. Leveling up does not strengthen existing enemies or improve their items. Better areas offer higher-level equipment and more XP, while returning to an earlier area makes the character's growth tangible.

These are authored starting curves for playtesting. They establish consistent rules and expose their numbers; they do not establish a balanced endgame. Character progress, equipment, and ground loot remain run-local. Reloading starts a fresh character; exploration persistence remains separate.

## The progression loop

1. Explore into a geographic area with a fixed threat level.
2. Fight normal, veteran, or elite enemies whose level comes from their spawn location.
3. A real death awards source-level XP, adjusted for the character's current level, and rolls the enemy's loot table.
4. Pick up gear, compare its rolls, equip eligible upgrades, and allocate level-up points.
5. Use the stronger build to push farther, or revisit lower-level areas with less danger and lower XP efficiency.

Each gained level still grants **one skill point and five attribute points**. Points are never spent automatically, and leveling does not refill life or mana. A kill that advances the character's level still drops gear for that enemy's original level.

## Geographic threat

Area level is based on world-space distance from the fixed origin, independent of character level, kill count, or the current biome:

`areaLevel = 1 + floor(distanceFromOrigin / 3200)`

The level-one region extends 3,200 world units from the origin. The next ring is level two, and so on. Walking directly outward at the base movement speed crosses a ring in about 19.4 seconds, so travel can outpace character progression. These are danger bands, not travel gates. The biome transition remains smooth and may cross a threat boundary independently.

Towns remain protected. Their safe interiors and streets do not create leveled combat encounters. Entering a sanctuary does not convert existing enemies into rewards; withdrawing or despawning a living enemy gives neither XP nor loot.

Level and rank are captured at spawn. Crossing a boundary or pulling an enemy across one never changes that enemy's stats or loot level. Enemy projectiles retain their attacker's source level after launch, including after the caster dies.

The target living population is `min(10, 5 + floor((areaLevel − 1) / 3))`, with a hard limit of 12. Each candidate spawn uses its own geographic level, so a boundary can contain a mixture of adjacent levels. The director attempts a replacement every two seconds when population and placement allow it. The initial three enemies remain normal Stalkers.

| Biome | Stalker weight | Brute weight | Hexer weight |
| --- | ---: | ---: | ---: |
| Deadwood | 70 | 22 | 8 |
| Verdant Forest | 72 | 12 | 16 |
| Swamp | 55 | 15 | 30 |

At most two Brutes and two Hexers can be alive at a time; the eligible archetype weights are renormalized when a cap is occupied. Existing attack slots still limit simultaneous pressure to two pack attackers and one special attacker. Killing more enemies no longer makes an unchanged area harder.

## Shared level curves

For source or item level `L`, let `n = L − 1`:

| Quantity | Level multiplier |
| --- | --- |
| Weapon damage, base armor, flat implicit gear values | `G = 1 + 0.13n` |
| Enemy maximum life | `G × (1 + 0.055n)` |
| Enemy damage | `1 + 0.11n` |
| Enemy base XP | `1 + 0.18n` |

Archetype definitions retain their level-one values: Stalker 48 life / 8 damage / 20 XP; Hexer 56 / 13 / 30; Brute 138 / 22 / 50. Level and rank multiply those authored values, then the result is rounded. Movement speed, windup, attack cadence, and collision size do not accelerate just because an enemy has a higher level.

| Matching level | Normal Stalker life | Hit before defenses | XP | Next-level XP | Stalker equivalents | Common Longsword damage |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 48 | 8 | 20 | 100 | 5.0 | 19 |
| 5 | 89 | 12 | 34 | 375 | 11.0 | 29 |
| 10 | 156 | 16 | 52 | 865 | 16.6 | 41 |
| 20 | 341 | 25 | 88 | 2,295 | 26.1 | 66 |
| 50 | 1,307 | 51 | 196 | 9,800 | 50.0 | 140 |

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

Veterans start at a 12% rank chance in level-two areas, increasing by one percentage point per area level to a 20% cap. Elites start at 4% in level-three areas, increasing by half a percentage point per area level to an 8% cap. Level-one areas spawn only normal ranks. At most two veterans and one elite are alive concurrently; a roll for a capped rank becomes normal rather than upgrading another rank.

## XP costs and level differences

For a character at level `L`, first calculate a same-level normal Stalker's source reward:

`S = round(20 × (1 + 0.18 × (L − 1)))`

Then:

`nextLevelXP = roundToNearest5(S × (5 + 2 × (L − 1)^0.8))`

XP within the current level carries through every threshold crossed. Source XP is rounded when the monster's stats are built. At death, the player's **pre-award** level supplies an XP factor:

- At the same level, the factor is 1.
- For a higher-level enemy, add 5% per level difference, capped at +25%.
- Lower-level enemies receive full XP within `3 + floor(playerLevel / 10)` levels of the player.
- Beyond that allowance, multiply by `0.8` for every additional level of difference, with a 1% floor.
- Round the adjusted reward and retain at least one XP for a positive source reward.

A level-ten character therefore gets full source XP from a level-six enemy, 80% from level five, and a maximum 25% risk bonus against enemies five or more levels above them. The high-level enemy also has its intrinsically larger source reward. This factor affects XP only: it does not alter the enemy's stats, gear level, or loot table.

## Loot yield and rarity

Each real death makes one rank-based gear-count roll, using an RNG isolated from combat randomness. The first kill guarantees at least one item if the table otherwise rolled zero. It does not add a bonus item on top of a successful roll.

| Rank | Guaranteed items | Extra-item chance | Expected items per ordinary kill |
| --- | ---: | ---: | ---: |
| Normal | 0 | 28% | 0.28 |
| Veteran | 0 | 70% | 0.70 |
| Elite | 1 | 25% | 1.25 |

Every dropped item then rolls its tier independently from that rank's table:

| Rank | Common | Magic | Rare | Epic | Legendary |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal | 55% | 32% | 11% | 1.8% | 0.2% |
| Veteran | 15% | 45% | 32% | 7.5% | 0.5% |
| Elite | 0% | 40% | 45% | 13% | 2% |

These are **conditional tier probabilities per dropped item**, not per-kill drop chances. For example, an ordinary normal kill has a 0.28 × 0.002 = **0.056%** chance of a legendary item. An elite guarantees at least Magic quality but does not guarantee a Rare. Legendary currently means four stronger generated affixes; unique legendary powers are not implemented. There is no tier unlock gate, pity counter, smart-loot bias toward the equipped weapon, or magic-find stat in this foundation.

Default generation for starter packs and content tools keeps its general-purpose tier distribution of 45 / 32 / 17 / 5 / 1. Enemy rewards explicitly pass the rolled tier into the generator and always use the rank tables above.

## What can drop

An archetype biases item kind without excluding any equipment slot:

| Kind | Stalker | Brute | Hexer |
| --- | ---: | ---: | ---: |
| Weapon | 32% | 27% | 28% |
| Shield | 6% | 18% | 3% |
| Head | 8% | 10% | 6% |
| Chest | 8% | 15% | 6% |
| Gloves | 10% | 7% | 5% |
| Legs | 8% | 10% | 5% |
| Boots | 12% | 5% | 5% |
| Cloak | 8% | 3% | 14% |
| Amulet | 3% | 2% | 14% |
| Ring | 5% | 3% | 14% |

For weapons and shields, the source biome then weights the profile. Every weapon and shield remains possible everywhere:

- **Deadwood** favors heavy melee gear and tower shields.
- **Verdant Forest** favors daggers, bows, and lighter shields.
- **Swamp** favors elemental staves, especially frost and lightning.

These are relative profile weights within that item kind, not extra drop chances. The exact immutable weights live in `game/src/loot-content.ts`; the [weapon catalog](weapons-and-skills.md) lists the available profiles. Player level, equipped weapon, combat RNG history, and XP-award order are not inputs to the item roll.

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

The character sheet estimates this against an attacker matching the character's level. Actual combat uses the enemy/projectile's captured level. A full set of common base armor totals about `30 × G`, so its armor-only reduction remains around 20% against an equal-level enemy instead of climbing toward 80% solely because item levels increased. Shields, affixes, tree investment, and older or newer gear change that ratio. Armor currently reduces incoming damage without a separate elemental resistance calculation. Shield block applies afterward.

Recovery also follows the growing resource pool. A potion restores 42% of maximum life; every third kill supplies a pickup restoring 12% of maximum life, while the other kills supply 16% of maximum mana. These preserve the starting 42 / 12 / 16 amounts at 100 maximum resources. The two-charge potion still gains one charge per eight kills. Recovery is capped by the missing resource, so it remains useful at later levels without overhealing.

## Bounds and extension points

The content functions normalize levels to **1–1,000,000**, an engineering bound on the current numeric representation. This is not a claim of a tested million-level endgame or mathematically unlimited values. XP rewards are finite nonnegative integer amounts, accepted up to the safe-integer bound; threshold crossing work is bounded by the content ceiling. At that numeric ceiling additional XP is discarded. Ordinary rewards preserve exact overflow and their grouping does not affect progression.

Ground equipment is capped at 96 items; each enemy can roll at most two. Proximity pickup, line of sight, and full-bag conservation continue to apply. A full bag leaves loot on the ground. These bounds protect the current simulation; stash, selling, loot filters, manual pickup, and an item-disposal loop remain needed before sustained loot farming.

Shared ownership keeps the model inspectable:

| Module | Owns |
| --- | --- |
| `progression-content.ts` | Numeric level normalization, raw scaling functions, rank multipliers, source-level armor |
| `progression.ts` | XP thresholds, exact overflow, level-difference factors, reward calculation |
| `zone-progression.ts` | Geographic bands, enemy-stat snapshots, isolated enemy loot seeds |
| `encounter-director.ts` | Geographic encounter mix, population policy, and rank selection |
| `loot-content.ts` | Rank yield/tier tables, archetype kind weights, biome profile weights |
| `loot.ts` | Deterministic bounded reward rolls and source-based item level |
| `items.ts` | Tier-aware item construction, affix budgets, names, appearance, and stat recipes |
| `simulation.ts` | Spawn snapshots, actual death rewards, attack-source metadata, and pickup mutations |

Future additions should extend these registries and shared formulas: biome-specific enemies, encounter landmarks, bosses, affix pools, unique items, and reward sources such as chests or quests. Difficulty, clear time, XP pace, loot usefulness, and inventory pressure remain questions for the user's gameplay feedback.
