# Skill ranks, specializations and ultimates

Implemented 2026-09-06. These are initial playtest rules, not a finished endgame balance curve.

## Spending points

An active skill costs one point once its path is connected. Its first purchase grants rank 1 and opens every connected route. Each further rank costs one additional skill point on that same node. Ranks are optional; traversal never requires upgrading a skill.

All 20 skills support ranks 1–5. The original 17 skills each have a deeper mastery node that opens ranks 6–7, which still cost one point each. Ultimates currently stop at rank 5. The player still earns one skill point and five attribute points per level.

Double-click an unowned node to allocate its affordable shortest path. Double-click an owned skill to buy one rank, or use **Upgrade** in its panel. The panel previews the next purchased rank. **Cast at rank** selects any purchased rank without spending points, healing, or resetting cooldowns. A deliberately chosen lower rank stays selected when buying another rank. No respec/refund is implemented.

## Costs and potency

| Rank | Damage relative to rank 1 | Mana relative to rank 1 | Cooldown relative to rank 1 |
| --- | ---: | ---: | ---: |
| 1 | 1.00× | 1.00× | 1.00× |
| 2 | 1.15× | 1.167× | 1.05× |
| 3 | 1.30× | 1.417× | 1.10× |
| 4 | 1.45× | 1.667× | 1.15× |
| 5 | 1.60× | 2.00× | 1.20× |
| 6 | 1.75× | 2.40× | 1.25× |
| 7 | 1.90× | 2.90× | 1.30× |

The nine basic skills always have **zero cooldown**, while respecting weapon attack/cast recovery. Advanced/ultimate cooldowns use the table. Bulwark improves guaranteed blocked-damage reduction from 75% to 90%, adding 2.5 percentage points per rank, instead of gaining damage.

Damage is compatible weapon damage × skill potency × rank factor × specialization factor × optional Overload. Weapon damage already includes the relevant physical/spell bonuses exactly once. Mana is base cost × rank factor × specialization cost × Overload cost × character mana-cost multiplier, rounded to tenths with a minimum of one. Cooldown reduction applies after rank/specialization factors; Bulwark has a four-second minimum and ultimates a twelve-second minimum. Original cost-reduction and cast/attack-speed stat limits remain in force.

Example: ordinary Fireball costs 12 mana at rank 1, 17 at rank 3, and 24 at rank 5 before reductions. Forked Flame at rank 5 costs 43.2 mana. Faster casting increases mana demand per second. This gives mana regeneration, maximum mana, reductions and potion management a purpose: supporting a stronger chosen loadout. It does not establish infinitely increasing skill ranks or promise indefinite player/monster balance.

## Deeper specializations

The atlas has 19 specialization nodes in nine school branches. Buy their connected paths, then choose one unlocked specialization per skill; **Original** remains available. Allocating another specialization does not automatically replace the current selection. The basic skills each offer two alternatives; Meteor offers Shattered Sky.

| Skill | Specialization | Effect | Mana factor |
| --- | --- | --- | ---: |
| Crescent Cleave | Reaching Crescent | +40% reach, −15% damage | 1.30× |
| Crescent Cleave | Crushing Crescent | +35% damage, −20% reach | 1.60× |
| Whirlwind | Gathering Steel | +45% reach, −20% damage | 1.35× |
| Whirlwind | Iron Cyclone | +40% damage, −15% reach | 1.70× |
| Shield Bash | Shield Wall | Wider arc, +30% reach, −15% damage | 1.35× |
| Shield Bash | Bellringer | +40% damage, 1.5-second stun | 1.75× |
| Thorn Volley | Thornburst | Five arrows, −25% damage per arrow | 1.50× |
| Thorn Volley | Barbed Volley | Each arrow pierces one additional enemy | 1.65× |
| Ricochet | Endless Pursuit | Six rebounds, −15% damage | 1.55× |
| Ricochet | Heavy Rebound | One rebound, +50% damage | 1.40× |
| Backstab | Long Shadow | +50% reach, −10% damage | 1.30× |
| Backstab | Executioner | Rear multiplier rises from 2× to 3×; all hits use 85% normal potency before that multiplier | 1.70× |
| Fireball | Forked Flame | Three fireballs at 65% damage each | 1.80× |
| Fireball | Living Ember | Three seconds of burning ground after impact; six pulses at 12% of the projectile's snapshotted damage | 1.65× |
| Arc Lightning | Storm Circuit | Eight jumps; may revisit another target; each jump retains 70% damage | 1.70× |
| Arc Lightning | Concentrated Current | Three targets, +60% damage | 1.45× |
| Ice Nova | Echoing Frost | Second, 20% wider nova after 0.6 seconds at 60% damage | 1.70× |
| Ice Nova | Deep Winter | +30% radius; 70% slow for four seconds; −15% damage | 1.40× |
| Meteor | Shattered Sky | Five staggered impacts at 45% damage each; +25% cooldown | 1.90× |

Specializations use the same projectile, sweep, chain, status and ground-effect executors as the original skills. Their values and damage are snapshotted on release. Later equipment, rank or specialization changes cannot rewrite an attack already in flight. Rank upgrades do not change ordinary LMB attacks.

## Deep Arcana

| Ultimate | Rank-1 cost / cooldown | Actual effect |
| --- | --- | --- |
| Cataclysm | 80 mana / 30 seconds | Seven staggered meteors around the aim point, each at 280% weapon damage with a 105-unit impact radius and a three-second burn. First impact after one second. Overlapping impacts can hit the same enemy. |
| Tempest | 35 mana + 18/second / 24 seconds | A 195-unit storm follows the caster for up to six seconds, striking visible enemies every half-second at 65% weapon damage. Upkeep uses the same rank, specialization, Overload and mana-reduction factors as casting. It ends before an unpaid pulse, on death, staff removal, relocation or reload. |
| Absolute Zero | 75 mana / 28 seconds | Two 240-unit frost waves at 240% weapon damage each, starting after 0.5 seconds and spaced 1.2 seconds apart. Four-second 75% slow, 1.5-second freeze; elites receive 20% of the freeze duration. The area stays at the casting position. |

All require a staff, normal assignment and a connected deep-tree path (20–35 points from the origin under the graph regression bound). Their cooldowns stay attached to their skill IDs through reassignment or rank changes. Multi-impact casts reserve enough room in the bounded ground-effect pool before spending mana; they cannot buy a partial Cataclysm. No active spell is permanent, and terrain visibility checks still apply.

**Arcane Overload** is a separate deep keystone. After allocation, its panel lets the player enable +30% Arcana skill damage for +60% casting/upkeep costs. It starts disabled. It does not alter physical skills, basic staff bolts or cooldowns.

## Layout and ownership

The atlas now has 2,185 nodes, 3,047 curved edges and 162 labeled groups: 150 passive constellations, nine specialization branches and three ultimate landmarks. Existing three-/four-point school paths, early mana/speed options and cross-domain bridges remain. New development stars are positioned with deterministic clearance and retain multiple routes through surrounding passive terraces.

`skill-progression.ts` resolves active rank, specialization, potency, execution recipe, mana and cooldown for combat, HUD and atlas. Character commands own validated purchases/configuration. Save format **3** persists purchased ranks, chosen casting ranks, selected specializations and Overload, and validates point conservation including extra ranks. Older slots remain stored but require a new character; no migration is provided.

Frozen local review: `/character.html?panel=skills&progression=1`. Add `&zoom=overview` or `&node=skill:cataclysm` to inspect outer content. This uses memory-only staged progression, never a saved character or gameplay ticks. Player playtesting is still needed for balance and combat feel.
