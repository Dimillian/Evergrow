# Combat power audit — 2026-09-11

The initial audit below describes the last recorded published source, `b12ee24d269730964f27d3b45cb115077735384e`. The following local tuning pass implements its recommendations. Historical measurements remain labeled below; the tool and CLI now use the current rules.

## Local tuning — 2026-09-11

Ordinary health, damage, attack timing, pack size, rank odds and rewards stay unchanged. Elites deal 25% more raw damage before rounding and recover 15% faster after attacks; all four dungeon/wilderness boss kinds deal 25% more and recover 20% faster. Windups, aim locks, action geometry, active durations and boss phase warnings are preserved. This increases elite Stalker/Brute/Hexer theoretical attack frequency by roughly 7–8%, rather than 15%, because their warnings remain the same length.

Veterans accept 80% control duration (maximum 1 second), followed by 3.5 seconds protected from another stun, freeze or stagger. Elites accept 50% (maximum 0.6 seconds), followed by 4 seconds protected. Bosses retain their 25% duration / 0.35-second maximum, with 2.5 seconds protected after control ends. Melee and elemental interruptions share the same policy. Knockback is 65% on veterans, 35% on elites and 15% on bosses, relative to each archetype's existing shove. Ordinary foes remain fully controllable. Slow effects retain their existing separate behavior.

Interrupting an attack now retains its unfinished action time and normal recovery, and recovery pauses while staggered. Weak pulses cannot accelerate attacks by swapping in a shorter recovery. Boss AI no longer overwrites the shared interrupted recovery a second time. Ground freezes use the shared rank policy once, removing their separate elite reduction.

### Measured control result

Actual status/AI simulation, level 32, two lightning pulses/second, 30 seconds, stationary 20-unit melee contact, three pulse phases. Status only: no weapon damage or knockback. These are controlled regression measurements, not a reconstruction of a cloud build.

| Foe | Before: hits landed | After: hits landed |
| --- | ---: | ---: |
| Normal Stalker | 0 | 0 |
| Normal Brute | 0 | 0 |
| Veteran Stalker | 0 | 20 |
| Veteran Brute | 0 | 10 |
| Elite Stalker | 0 | 23 |
| Elite Brute | 0 | 11 |

The previous level-one control result applies across those ranks/levels because the old control and attack timings were identical. Current sweeps cover 1–3 pulses/second and three phases; veterans/elites can land attacks throughout. All four boss kinds also land hits under the two-pulse test. Positioning, mana, killing speed, dodging and other attacks remain gameplay variables.

### Chain sustain and encounter content

The first Arc Lightning contact heals the full life-on-hit amount. Each additional distinct target heals 25%; revisiting an already hit target heals zero. Damage, chain targeting, critical chance, casting speed and mana cost stay unchanged. The healing ledger resets each cast. With +8 life on hit, five distinct contacts now restore 16 instead of 40 life; eight Storm Circuit contacts bouncing between two survivors restore 10 instead of 64. A lone target still restores 8. Tests execute the real skill and damage owners and check resource spending and repeated casts. Mana-on-kill, resource drops and potions are unchanged pending exact-build sustain measurement.

Elite-led roaming packs now replace two existing escort slots with complementary roles: a ranged leader gets a heavy screen; a melee leader gets ranged support; either gets a flanker. Choices stay inside the current biome's weighted pool. Four-to-six-member size, admission/collision rules, travel cooldowns and authored dungeon/camp rosters are preserved. Existing regional onward guidance already marks easier/harder content and suggests travel at the regional ceiling. Expedition choice hovers now identify bosses' resistance to stuns and knockback alongside their level and modifier.

The local audit reports rank-adjusted recovery and can compare additional hypothetical multipliers. Its CLI measures all three ordinary ranks; exact-build chain estimates include maximum life-on-hit per cast. Full cloud gear/tree import is still needed before claiming current player DPS or optimal balance.

Existing characters, items, levels, wounds, explored regions and completed encounters remain compatible. There is no reset or migration. Source level/rank stay fixed; existing save reconstruction derives the new damage tuning from those original values on reload. Live actors never rescale when the player levels up.

Verification: 1,192 code tests pass, including repeated-control phase sweeps, all four bosses, real chain-healing transactions, biome-valid escort selection and pre-tuning actor reloads. Combat feel and exact cloud-build difficulty remain player playtesting.

## Historical baseline findings

## Reproduce

Open `/progression.html?view=power` through the local tools workspace. Import a character export or cloud observation into disposable memory. The tool uses shared enemy scaling, attack derivation, skill resolution and character projection; it never reads or writes playable slots. Health, damage and recovery multipliers compare hypothetical enemy tuning while preserving windups.

Run `node --experimental-strip-types game/scripts/power-audit.ts [snapshot.json] [report.json]` from the repository root. Omit input for a generic report. Keep personal inputs and reports outside the repository. Full exports, `{character: export}` bundles and `{bundle: {character: export}}` responses are accepted. A summary cannot reconstruct the current gear, charms, tree, DPS, resistances or mana sustainability.

## Scaling findings

| Quantity | Level 32 / level 1 | Level dependence |
| --- | ---: | --- |
| Same-quality weapon flat power | 5.03× | Linear |
| Ordinary monster life | 13.61× | Quadratic |
| Monster raw damage per hit | 4.41× | Linear |
| Enemy attack cadence | 1× | Archetype timing stays constant |
| Illustrative caster hit | 19.06× | Weapon × three Intelligence per level |

The caster example excludes affixes, tree, charms, criticals and skill ranks. It is a sensitivity curve, not a measured player build. Intelligence grants 3% spell damage per point above the starting value; each gained level awards five attribute points. Weapon power and spell bonuses multiply. Skill ranks add another multiplier. Spell damage is applied once in weapon derivation, not duplicated in skill activation.

Monster life already grows faster than its flat damage and faster than flat weapon power. Raising all life would lengthen trash fights without necessarily increasing threat. Enemy timing remains unchanged as player action speed rises. Ambient groups remain four to six; veteran chance reaches its 20% ceiling at level 10 and elite chance its 8% ceiling at level 11. There is no total actor cap. Regional encounter snapshots also matter: home ordinary levels stop at 12; old encounters retain their levels. Rank offsets can exceed the ordinary regional ceiling.

## Repeated lightning can deny attacks

`combat-status.ts` applies 0.12 seconds of stagger on positive lightning contacts. Stagger interrupts windup/attack and replaces it with 0.3 seconds of interrupted recovery. Ordinary, veteran and elite melee foes lack the boss control-immunity window. A brute's melee-interruptibility flag does not protect it from elemental stagger.

The CLI runs the actual 120 Hz status and AI loop for 30 seconds against one stationary foe at 20 units. It removes movement, damage and knockback and applies lightning status at a fixed frequency. Three phase offsets (0, 0.17, 0.41 seconds) test timing sensitivity. The default spawned foe is level one; these status and attack timings do not scale with level. The report separately records attack entries and actual landed `hurt` events.

| Status pulses / second | Stalker landed hits / 30 s | Brute landed hits / 30 s |
| ---: | ---: | ---: |
| 0 | 24 | 14 |
| 0.5 | 29–30 | 15 |
| 1 | 29–30 | 0 |
| 1.25 | 37 | 0 |
| 1.5 | 0 | 0 |
| 2 | 0 | 0 |

This demonstrates a control-lock mechanism, not measured play with a particular character. Low pulse frequencies can also accelerate attacks by substituting a shorter recovery; the relationship is not monotonic. Movement, target selection, mana availability, alternate attacks and bosses change practical outcomes.

Arc Lightning has no cooldown, chains through five contacts at 0.78 damage retention, and uses weapon-derived casting cadence. Storm Circuit permits revisits. Each successful direct contact receives flat life-on-hit separately; revisits also qualify. This can make crowds both damage amplification and healing opportunities. Other build configurations require their own tests.

## Why more enemies alone may disappoint

The player has a 0.3-second damage guard after receiving a hit. Contacts during that window are ignored. The pressure chart estimates independent attack arrivals with a non-extending guard, before mitigation or sustain. It is an analytical sensitivity model, not simulated crowd positioning, an upper bound or a prediction of real DPS. Synchronization and telegraphs change the result substantially.

Kills also restore mana-on-kill, recharge potions every eight kills, and attempt a resource drop: every third kill health (12% maximum life), otherwise mana (16% maximum mana). Pickups have capacity, lifetime and collection constraints. More weak foes can strengthen sustain instead of adding danger.

## Original recommendations

1. Give dangerous ranks bounded repeat-control protection, reusing the boss policy where appropriate. Preserve strong reactions and interrupt opportunities on ordinary trash. Also resolve shortened interrupted recovery so weak pulses cannot accidentally accelerate attacks.
2. Test stronger elite and boss damage and shorter post-attack recovery before global life increases. Preserve readable windups. Initial comparison knobs such as +20–30% damage and 15–20% shorter recovery are hypotheses, not validated targets.
3. Measure per-cast healing and mana sustain for chained/repeated contacts. Consider diminishing sustain on subsequent contacts if the measured build warrants it; do not blindly nerf single-target recovery.
4. Add complementary dangerous roles and clearer regional/expedition threat. Measure attacks landed, damage taken, control uptime and resource balance at equal level. Increasing all pack sizes or all health is lower priority.

Before committing tuning, obtain a full current character snapshot and compare the exact build against same-level ordinary packs, mixed elite packs, bosses and expedition modifiers. The current audit cannot establish its real time to kill or optimal numeric balance.
