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

Example: ordinary Fireball costs 12 mana at rank 1, 17 at rank 3, and 24 at rank 5 before reductions. Forked Flame at rank 5 costs 41.5 mana with its one required efficiency star, before global reductions. Faster casting increases mana demand per second. This gives mana regeneration, maximum mana, reductions and potion management a purpose: supporting a stronger chosen loadout. It does not establish infinitely increasing skill ranks or promise indefinite player/monster balance.

## Deeper specializations

Every one of the 20 skills has **three specializations (60 total)**. Each skill grows three independent leaves: **skill → potency → efficiency → specialization**. A leaf costs three points after unlocking its parent skill, and has no entrance from another school. All three may be unlocked; choose one or Original in the owning skill's details. Purchases never switch the selected variant, and switching spends no points or resets no cooldowns.

Each potency star grants **+6% damage to that skill** (Bulwark instead gets +6% guard duration); each efficiency star grants **4% reduced mana cost to that skill**, including Tempest upkeep. These skill-specific passives apply across all variants and stack additively within their family: owning all leaves gives +18% potency and 12% cost reduction. They do not modify LMB or other skills. The damage and cost factors multiply the existing rank/equipment/global-stat calculation.

Tooltips and details explicitly identify the affected skill, distinguish passive improvements from selectable variants, and separate effects, cast costs and allocation state. Hovering a skill or its leaf emphasizes its three branches; specialization tips reuse the owning skill's icon. Specialization leaves preview resolved mana, cooldown, potency and upkeep before/after the variant and its required passives, without allocating or selecting anything. Selected variants retain the base mechanic description beside their tradeoff. Ordinary notable passives are no longer mislabeled as specializations.

| Skill | Specialization | Effect / tradeoff |
| --- | --- | --- |
| Absolute Zero | Polar Horizon | 40% larger waves, 25% less damage. Costs 35% more mana. |
| Absolute Zero | Frozen Eternity | Freeze lasts 2.5 seconds; 80% slow for 6 seconds. Costs 50% more mana; 25% longer cooldown. |
| Absolute Zero | Shattering Winter | One wave deals 140% more damage, 25% smaller radius. Costs 25% more mana. |
| Arc Lightning | Storm Circuit | Three extra jumps may revisit targets at reduced damage. Costs 70% more mana. |
| Arc Lightning | Concentrated Current | 60% more damage, but only three targets. Costs 45% more mana. |
| Arc Lightning | Static Thread | 30% less mana, 20% less damage; jumps retain 85% damage. |
| Backstab | Long Shadow | 50% more reach, 10% less damage. Costs 30% more mana. |
| Backstab | Executioner | Rear strikes deal 3× instead of 2× damage; other hits deal 15% less. Costs 70% more mana. |
| Backstab | Quiet Blade | 35% less mana; rear strikes deal 1.6× instead of 2× damage. |
| Bulwark | Enduring Guard | Guard lasts 5 seconds. Costs 50% more mana; 25% longer cooldown. |
| Bulwark | Iron Aegis | Base block reduction rises to 85%, guard lasts 2 seconds. Each effective rank above the 90% reduction cap adds 0.25 seconds before passive duration bonuses. Costs 35% more mana. |
| Bulwark | Ready Guard | 25% less mana and 25% shorter cooldown; guard lasts 2 seconds. |
| Cataclysm | Falling Stars | Eleven impacts at 65% damage each. Costs 60% more mana; 20% longer cooldown. |
| Cataclysm | Extinction | Three impacts with 100% more damage and 40% more radius. Costs 40% more mana; 25% longer cooldown. |
| Cataclysm | Sea of Cinders | Ground fire lasts 9 seconds at 20% impact damage per second; 15% less impact damage. Costs 50% more mana. |
| Crescent Cleave | Reaching Crescent | 40% more reach, 15% less hit damage. Costs 30% more mana. |
| Crescent Cleave | Crushing Crescent | 35% more damage, 20% less reach. Costs 60% more mana. |
| Crescent Cleave | Measured Cut | 25% less mana, 15% less damage. |
| Earthshatter | Faultline | 40% wider shockwave, 20% less damage. Costs 30% more mana. |
| Earthshatter | Seismic Hammer | 60% more damage and 2-second stun; 20% smaller radius. Costs 60% more mana; 25% longer cooldown. |
| Earthshatter | Tremor | 35% shorter cooldown, 25% less damage; stun lasts 0.6 seconds. |
| Fireball | Forked Flame | Three fireballs, each dealing 35% less damage. Costs 80% more mana. |
| Fireball | Living Ember | Explosions leave non-stacking burning ground for three seconds at 24% impact damage per second. Costs 65% more mana. |
| Fireball | Flashfire | 40% wider explosion, 20% less damage. Costs 40% more mana. |
| Frost Lance | Glacial Trident | Three lances at 55% damage each. Costs 70% more mana. |
| Frost Lance | Permafrost Spear | 70% slow for 5 seconds, 20% less damage. Costs 30% more mana. |
| Frost Lance | Diamond Lance | 60% more damage, hits up to 2 enemies. Costs 45% more mana; 20% longer cooldown. |
| Ice Nova | Echoing Frost | A second nova expands after 0.6 seconds at 60% damage. Costs 70% more mana. |
| Ice Nova | Deep Winter | 30% more radius and a stronger, longer slow; 15% less damage. Costs 40% more mana. |
| Ice Nova | Snap Freeze | Freezes for 0.6 seconds; 20% smaller radius, 20% less damage. Costs 35% more mana. |
| Meteor | Shattered Sky | Five impacts with 35% smaller radius spread across the target area at 45% damage each. Costs 90% more mana; 25% longer cooldown. |
| Meteor | Lasting Inferno | Ground fire lasts 8 seconds at 18% impact damage per second. Costs 45% more mana. |
| Meteor | Worldbreaker | 60% more impact damage, 25% larger radius; no ground fire. Costs 50% more mana; 20% longer cooldown. |
| Piercing Shot | Unbroken Flight | Hits up to 8 enemies; 15% less damage. Costs 40% more mana. |
| Piercing Shot | Siegebreaker | 60% more damage, hits up to 2 enemies. Costs 40% more mana; 20% longer cooldown. |
| Piercing Shot | Twin Needles | Two piercing arrows at 65% damage each. Costs 50% more mana. |
| Rain of Arrows | Blanket of Thorns | 50% larger radius; 25% less damage per wave. Costs 35% more mana. |
| Rain of Arrows | Relentless Rain | Eight waves over 2.4 seconds, each at 75% damage. Costs 65% more mana; 25% longer cooldown. |
| Rain of Arrows | Hail of Barbs | Three rapid waves at 45% more damage. Costs 40% more mana. |
| Ricochet | Endless Pursuit | Three extra rebounds, 15% less damage. Costs 55% more mana. |
| Ricochet | Heavy Rebound | 50% more damage, only one rebound. Costs 40% more mana. |
| Ricochet | Skipping Arrow | 30% less mana; two rebounds instead of three. |
| Rift Lunge | Farstrike | 50% longer dash, 15% less damage. Costs 20% more mana. |
| Rift Lunge | Impaling Rush | 50% more damage, 30% wider contact. Costs 50% more mana; 25% longer cooldown. |
| Rift Lunge | Fleeting Step | 30% shorter cooldown and 20% less mana; 25% less damage, shorter dash. |
| Shield Bash | Shield Wall | A wider, longer shield strike; 15% less damage. Costs 35% more mana. |
| Shield Bash | Bellringer | 40% more damage and a longer stun. Costs 75% more mana. |
| Shield Bash | Concussion | 2-second stun, 30% less damage. Costs 20% more mana. |
| Soul Siphon | Soul Feast | Heals 60% of actual damage dealt, but deals 20% less damage. Costs 35% more mana. |
| Soul Siphon | Hollow Passage | Hits up to 3 enemies, 15% less damage. Costs 50% more mana. |
| Soul Siphon | Soul Rend | 60% more damage, healing reduced to 15%. Costs 40% more mana; 20% longer cooldown. |
| Tempest | Stormfront | 40% larger storm, 25% less damage. Casting and upkeep cost 30% more mana. |
| Tempest | Thunderhead | Strikes every 0.3 seconds at 80% damage. Casting and upkeep cost 70% more mana. |
| Tempest | Storm Anchor | Stationary storm lasts 9 seconds, deals 20% more damage. Casting and upkeep cost 35% more mana; 25% longer cooldown. |
| Thorn Volley | Thornburst | Five arrows instead of three, each dealing 25% less damage. Costs 50% more mana. |
| Thorn Volley | Barbed Volley | Each arrow pierces one additional enemy. Costs 65% more mana. |
| Thorn Volley | Needle Fan | A tight three-arrow fan; 20% more damage. Costs 35% more mana. |
| Whirlwind | Gathering Steel | 45% more reach, 20% less damage. Costs 35% more mana. |
| Whirlwind | Iron Cyclone | 40% more damage, 15% less reach. Costs 70% more mana. |
| Whirlwind | Steady Revolutions | 30% less mana, 20% less damage. |

Specializations use the same projectile, sweep, chain, status and ground-effect executors as the original skills. Their values, damage, critical chance/multiplier and life on hit are snapshotted when the action is accepted; scheduled pulses and released projectiles keep these values. Later equipment, rank or specialization changes cannot rewrite an attack already in flight. Rank upgrades do not change ordinary LMB attacks.

## Deep Arcana

| Ultimate | Rank-1 cost / cooldown | Actual effect |
| --- | --- | --- |
| Cataclysm | 80 mana / 30 seconds | Seven staggered meteors around the aim point, each at 280% weapon damage with a 105-unit impact radius and a three-second burn. First impact after one second. Overlapping impacts can hit the same enemy. |
| Tempest | 35 mana + 18/second / 24 seconds | A 195-unit storm follows the caster for up to six seconds, striking visible enemies every half-second at 65% weapon damage. Upkeep uses the same rank, specialization, Overload and mana-reduction factors as casting. It ends before an unpaid pulse, on death, staff removal, relocation or reload. |
| Absolute Zero | 75 mana / 28 seconds | Two 240-unit frost waves at 240% weapon damage each, starting after 0.5 seconds and spaced 1.2 seconds apart. Four-second 75% slow, 1.5-second freeze; elites receive 20% of the freeze duration. The area stays at the casting position. |

All require a staff, normal assignment and a connected deep-tree path (20–35 points from the origin under the graph regression bound). Their cooldowns stay attached to their skill IDs through reassignment or rank changes. Multi-impact casts reserve enough room in the bounded ground-effect pool before spending mana; they cannot buy a partial Cataclysm. No active spell is permanent, and terrain visibility checks still apply.

**Arcane Overload** is a separate deep keystone. After allocation, its panel lets the player enable +30% Arcana skill damage for +60% casting/upkeep costs. It starts disabled. It does not alter physical skills, basic staff bolts or cooldowns.

## Layout and ownership

The atlas now has 2,182 nodes, 2,923 edges and 173 groups: 150 passive constellations, 20 skill-owned leaf groups and three ultimate landmarks. Development groups do not repeat their parent name as a floating map label. Existing three-/four-point school paths, early mana/speed options and cross-domain bridges remain. Specializations remain beside their parent skill, with fixed curved leaves and at least 22 units of node clearance. Masteries retain their deeper routes through the passive terraces.

`skill-progression.ts` resolves active rank, specialization, potency, execution recipe, mana and cooldown for combat, HUD and atlas. Character commands own validated purchases/configuration. Save format **4** persists purchased ranks, chosen casting ranks, selected specializations and Overload, and validates point conservation including extra ranks. The leaf redesign removes old school-specialization connector nodes. Characters invested in those old routes may fail current graph validation and require a new test character; no path migration is provided. Unaffected builds remain valid.

Frozen local review: `/character.html?panel=skills&progression=1`. Add `&zoom=overview` or `&node=skill:cataclysm` to inspect outer content. This uses memory-only staged progression, never a saved character or gameplay ticks. Player playtesting is still needed for balance and combat feel.

### Meteor ground fire

Meteor, Shattered Sky and Cataclysm leave four-second burning patches after each impact. The base non-stacking burn uses 12% of the resolved impact damage per second; Lasting Inferno uses 18% for eight seconds and Sea of Cinders uses 20% for nine seconds; rank and specialization damage multipliers therefore also affect the ground fire. Duration and refresh interval are authored in `SkillExecution.scorch` and snapshotted on release; specialization changes use that same recipe. See [weapons and skills](weapons-and-skills.md#spell-anticipation-and-meteor-aftermath--2026-09-07).

### Equipment bonus ranks · 2026-09-07

Named +1–5 skill affixes can raise effective potency beyond purchased ranks, up to +10 total equipment ranks per skill. They require the skill unlocked and compatible gear, do not grant specializations, and do not raise mana/cooldown costs. The chosen casting rank and point ledger remain unchanged. Tooltips and upgrade previews use the same resolver as combat. See [equipment affixes](equipment-affixes.md#equipment-skill-ranks) for weighted pools, level gates and precise odds.


## Skill atlas layout · 2026-09-07

The starter network has nine repeated school layouts. Each has a passive backbone with a basic and advanced skill branching off it; active skills are no longer transit junctions. Each skill has exactly one incoming backbone link and three separate potency → efficiency → specialization branches. Short, mostly straight connections replace the previous bypass loops. School crosslinks meet at inner gates and outer junctions, away from the skill branches. The 150 outer passive constellations remain interconnected.

Basic/advanced unlock costs stay at three/four points. Mana, cast speed and efficiency are still available within two points. Three backbone choices per school are reachable within five points. Opening paths uses more space, not additional travel taxes. Specializations retain their own three-point cost and existing effects.

The Details toggle expands the canvas; controller Node/Skills navigation restores the sidebar. Choosing a domain centers its starter skills. Overview keeps skill icons/names and stronger backbone lines, with finer passive detail appearing as you zoom.

This redesign changes early connections and some route IDs. Existing characters invested in removed routes may require a fresh character; original saves stay preserved. Frozen review URLs use memory-only characters: `/character.html?panel=skills&node=origin&zoom=starter&map`, `&node=skill:fireball&zoom=arcana&map`, or `&node=skill:fireball&zoom=school`.

The outer atlas uses five balanced constellation silhouettes (diamond, hexagon, rays, wings and compass). Clusters retain their proportions when the atlas spreads outward; their internal stars stay at least 50 world units apart. Allocated routes carry flowing gold light, while the selected/hovered route uses pale blue light. A cached atlas surface keeps geometry and text out of the 30 Hz animation pass; visible light threads are capped at 160 and batched into at most 64 strokes. Reduced motion freezes the light and dust, and closing the atlas releases its cached surface. Domain-colored background haze stays faint beneath the graph.


## Audit corrections — 2026-09-07

Ordinary melee reactions preserve longer stuns/freezes. The runtime keeps separate freeze/stun presentation timers while the shared stagger timer owns AI suppression. Frozen shells, stun markers and target labels now distinguish these conditions.

Every Tempest variant ends on death, incompatible casting gear, relocation or exhausted upkeep, including stationary Storm Anchor. Following storms and Absolute Zero are self-targeted in touch/controller previews; Storm Anchor retains ground placement. Bulwark and Tempest show active duration independently of cooldown in desktop/touch skill slots, with storm upkeep and a notice when mana or casting gear ends it.

Projectile fans require all their projectile slots before paying mana or consuming Spellweave. Living Ember reserves its future ground slot while the projectile is in flight; other ground casts count those reservations. The existing 128-projectile and 16-ground-effect bounds remain. Rejected casts spend nothing. Living Ember now uses the same strongest-burn refresh rules as meteor aftermath, with no repeated explosion or direct-hit procs. Its nominal damage rate remains 24% of resolved impact damage per second, but overlapping patches no longer stack. Each patch lasts three seconds and refreshes a half-second burn every quarter-second.

Executioner's rear strike now deals 3× the equivalent Original frontal potency; only non-rear hits receive its 15% penalty. Shattered Sky has five impacts at 65% Original radius, and its falling stones scale with that radius. Iron Aegis gains duration after capping reduction, including effective ranks from equipment. These are deliberate corrections to the published tradeoffs and rank plateau; no save-format change or progress reset is introduced.

See [weapons and skills](weapons-and-skills.md#skill-contact-and-feedback--2026-09-07) for the contact/GFX pass and [the audit](skill-audit-2026-09-07.md#implementation-follow-up--2026-09-07) for its resolution matrix. Combat feel, sound balance and visual composition still need player acceptance.
