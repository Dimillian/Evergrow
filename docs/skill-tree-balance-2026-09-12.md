# Skill tree balance and readability follow-up

Local September 12, 2026. No push or publication. This follows the 791-node visual refinement and addresses its implementation, progression and testability gaps. Current graph: **841 nodes, 894 connections, 114 groups, 30 skills and 90 Techniques**. Existing version-2 investments remain valid; no additional reset.

## Resolved gaps

| Finding | Change |
| --- | --- |
| Ten skills offered only two Techniques | Every active now has three. Added cheaper sustained options, reverse/forward movement choices, concentrated buff charges and target/control alternatives. |
| Bastion and Veil each had only three active unlocks and no ultimate | Repulse and Iron Citadel complete Bastion; Smoke Veil and Night Reaping complete Veil. Each territory now has five active skills. |
| No active discoveries beyond 26 origin points | The new shield and dagger ultimates cost 33 origin points, plus optional ranks/Techniques. They do not require buying another active. |
| All 36 hybrid gardens were dead ends | Six mid-depth gardens now join both neighboring roads, preserving every original active's shortest unlock cost. The other thirty remain optional specialty investments. |
| Sidestep was a weak use of one of five slots | Rank-1 travel rises from 105.6 to 158.4 units; mana falls 12 → 8, cooldown 4.5 → 3.5 seconds. Dodge still has its distinct invulnerable window and two free charges. |
| Utility ranks mostly extended expiry | Brace gains actual mitigation; Rally/Ghost gain charge strength; movement gains more distance; ward capacity still scales. Utility stances and wards commit in 0.18 seconds without cancelling another action. |
| Borrowed Flame became a penalty at high Spellweave investment | Its 40% empowered multiplier is separate from the ordinary 100% cap. Alternation yields a consistent 19% net benefit; unempowered actions retain the 15% downside. It enables priming without other Spellweave. |
| Flat tree armor lost its value against higher-level attackers | Tree armor scales with the character using the same linear power scale as the source-level armor denominator. The inspector, tooltip and character-source breakdown show the scaled contribution. |
| Ghost Hunt lost most projectile build interactions | Echoes now deal 60% instead of 45%, retain critical snapshots, pierce and chain, and gain strength from utility ranks. Healing, statuses, repeated echo generation and whole-volley duplication remain excluded. |
| Vaulting Shot missed shared skill-projectile pierce | Its arrow now consumes the same global piercing investment as other non-explosive skill projectiles. |
| Playground concealed resources and could not exercise buffs/defenses | Added finite-mana follow-up attacks, repeatable incoming hits, 30-second rotation, front/rear target facing, level selection and a no-active baseline. Actual mana spending, life loss, absorbed damage and cast counts are visible/exported. |
| Close-zoom labels competed with the graph | At 72%+ zoom, at most four surrounding landmarks and two passive group names accompany the selected/hovered nodes. Only the focused skill shows Technique captions and rank badges. Narrow windows reduce the landmark budget further. |

Late roads curl around the outside of the territories to avoid long empty tails. Node shapes remain circular; the shared square window frame, tint, missing top filters and absence of the inner focus border are preserved.

## What the numbers establish

A 32-armor tree notable alone previously reduced same-level physical damage by 21.05% at level 1, 6.08% at 25, 3.49% at 50 and 1.89% at 100. It now retains 21.05% at each of those levels before other armor, block and stance effects. This preserves that investment's defensive relevance; it does not guarantee 21 percentage points of marginal reduction on a heavily armored build.

Rank 3 gives Rally 45.5% more damage per charged action versus rank 1's 35%, and Ghost 78% echoes versus 60%. Both improve charge strength by 30% for 10% more mana. Brace grows from 20% to 25% hit reduction. Rank 3 Sidestep travels 190.08 units before Techniques, versus a 79.2-unit free dodge. Neither step variant grants invulnerability.

At 78% ordinary Spellweave, the previous keystone reduced perfectly alternating damage by about 4.5%; at the cap it reduced damage by 15%. It now yields the same 19% alternating payoff at 0%, 78% and 100%. Repeating an unempowered action pays the 15% damage loss.

## Matched-budget measurements

The comparison below uses all available skill points, identical level/rarity/enhancement budgets and seeded equipment, three offensive attribute points and two Vitality per level. Primary skills receive up to rank 3; remaining points use a disclosed connected-route scoring heuristic. The level-10 bow can afford only rank 2 after its eight-point route. A one-handed fixture uses a shield, while two-handed fixtures reserve both hands. No charms, potions, kills or pickup recovery are supplied.

These are measured 30-second single-target DPS values, including finite mana, cooldowns, recovery and fallback basic attacks. Dummies are stationary, face the attacker and use their actual hit geometry. They do not attack. This deliberately measures front-facing dagger damage; the playground's rear-facing setting exercises its positional payoff.

| Level | Greatblade / Cleave | Bow / Ricochet | Staff / Arc Lightning | Shield / Bash | Dagger / Backstab |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 342 | 152 | 284 | 214 | 246 |
| 25 | 1,225 | 629 | 1,094 | 770 | 874 |
| 50 | 4,106 | 2,175 | 3,451 | 2,615 | 2,855 |
| 100 | 14,799 | 8,591 | 10,524 | 9,777 | 11,088 |

Seven-target frontal packs produce much higher damage for full melee sweeps than single-projectile builds. That is an expected advantage of a close-range area action, but the safe dummy setup omits the danger of standing in the pack. It cannot decide the correct melee/ranged tradeoff. The source JSON retains single-target, pack and no-active baseline runs, exact purchased nodes, resources and defensive stats for all twenty builds.

A separate level-50 common-weapon probe isolates all thirty active skills from passive-tree choices. At rank 3, twelve-second follow-up attacks give these results:

| Buff | Damage with buff | Same attacks without buff | Change |
| --- | ---: | ---: | ---: |
| Rally of Iron | 13,418 | 12,560 | 6.8% |
| Ghost Hunt | 12,824 | 11,480 | 11.7% |

These are single seeded observations, including actual critical rolls and the activation recovery; they are not population averages. The incoming-hit probes verify that wards, Brace, Smoke Veil and Iron Citadel reduce actual health loss. They use ten physical hits of 10% maximum life, starting at 0.9 seconds and repeating every 1.2 seconds, with random block disabled. Independent shelters expire separately and only the strongest stance reduction applies.

Tempest remains a resource commitment: its base six-second storm costs 35 + 6 × 18 = 143 mana before reductions, rank/Technique multipliers and recovery. Finite-resource mode now exposes premature exhaustion and high-cost variants. The ultimate is available at a point budget that supports Intelligence and recovery investment; unlimited showcase mana is explicitly labeled and confined to visual mode.

## Verification and remaining player feedback

The code checks cover all thirty base actions and all ninety Techniques, rank/point conservation, all six territory lineups, old unlock costs, connectivity, optional tradeoff leaves, non-overlapping node faces, label budgets, same-level armor scaling, Borrowed Flame at and beyond the cap, follow-up buffs, finite resources, independent defensive expiry and benchmark budgets. The complete code suite passed 1,282 tests. The final targeted checks also passed; application/headless compilation and the production build pass, with the existing large-bundle advisory. Static in-app review checks the overview and close-zoom presentation; no browser gameplay or automated browser playtest was run.

This pass resolves concrete missing behavior and provable balance traps. Final difficulty still needs player feedback on incoming pressure, positional execution, resource pickups, sustained rotations, utility-slot opportunity cost, and the new 33-point ultimate timing. The benchmark is not an exhaustive search of all gear, Techniques, Doctrines and keystones; it cannot justify declaring every build equally strong. Ordinary flat health/recovery bonuses still have diminishing relative impact as a character grows, and that broader progression question remains visible rather than being hidden by blanket stat inflation.

Reproduce from the repository root:

```sh
node --experimental-strip-types game/scripts/atlas-balance.ts /tmp/atlas-balance.json
node --experimental-strip-types game/scripts/skill-tree-audit.ts > /tmp/atlas-tree.json
cd game
node --experimental-strip-types --test --test-concurrency=4 tests/*.test.ts
npm run build
```

[Machine-readable balance probes](audits/skill-tree-2026-09-12/balance.json) · [Current graph audit](audits/skill-tree-2026-09-12/balanced-tree.json) · [Runtime rules](skill-progression.md)
