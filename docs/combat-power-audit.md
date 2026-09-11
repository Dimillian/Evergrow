# Combat power audit — 2026-09-11

This is a diagnostic checkpoint, not a balance patch. The inspected combat formulas match the last recorded published source, `b12ee24d269730964f27d3b45cb115077735384e`. No enemy, item, skill or save rules changed.

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

## Recommended next playtest

1. Give dangerous ranks bounded repeat-control protection, reusing the boss policy where appropriate. Preserve strong reactions and interrupt opportunities on ordinary trash. Also resolve shortened interrupted recovery so weak pulses cannot accidentally accelerate attacks.
2. Test stronger elite and boss damage and shorter post-attack recovery before global life increases. Preserve readable windups. Initial comparison knobs such as +20–30% damage and 15–20% shorter recovery are hypotheses, not validated targets.
3. Measure per-cast healing and mana sustain for chained/repeated contacts. Consider diminishing sustain on subsequent contacts if the measured build warrants it; do not blindly nerf single-target recovery.
4. Add complementary dangerous roles and clearer regional/expedition threat. Measure attacks landed, damage taken, control uptime and resource balance at equal level. Increasing all pack sizes or all health is lower priority.

Before committing tuning, obtain a full current character snapshot and compare the exact build against same-level ordinary packs, mixed elite packs, bosses and expedition modifiers. The current audit cannot establish its real time to kill or optimal numeric balance.
