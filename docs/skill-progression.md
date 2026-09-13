# Atlas of Becoming: skill progression

The atlas was published in v0.3.16 on 2026-09-12. The twenty-rank progression below was published in v0.3.17 on 2026-09-12. The pre-redesign measurements and proposals remain historical in [the audit](skill-tree-redesign-proposal.md); this document describes current runtime rules.

## Open passive network — local September 13 follow-up

The local atlas now has **1,824 nodes, 2,118 undirected connections and 174 groups**: 144 passive neighborhoods and 30 active-skill groups. It retains Bastion, Forge, Hunt, Veil, Crucible and Wellspring, all 30 active skills, all 90 Techniques, eight Doctrine families, four keystones and twenty purchased skill ranks. The root is free; every other node costs one point. Each level still grants one skill point and five attribute points.

The six main active-skill trunks retain every minimum unlock cost in the table below. The network between them is rebuilt. Six compact silhouettes connect through short neighboring routes: 42 rings, 22 crescents, 25 pointed leaves, 25 kites, 26 twin loops and four forks. All 144 passive neighborhoods have at least two distinct entry nodes (105 have four, 35 have three, four have two). The graph has 295 independent cycles. No connector crosses another or passes through an unrelated node. Ordinary route segments are at most 155 units; the six Origin links are the longest at 240. There are no sweeping cross-country curves or disconnected-looking bridges. Unused outer road tails are trimmed.

The 90 preceding named specialties remain, joined by 54 additional locations for spell damage, critical chance/damage, movement, weapon damage, life and casting sustain. Repeated access to common build needs is deliberate. Current totals include 205 nodes with spell damage, 237 with critical damage and 190 with movement speed; these count mixed bonuses and useful travel nodes, not distinct mechanics. Passives now serve as onward routes as well as purchases beside the main trunks.

Dedicated damage minors grant 8 percentage points and endpoints 24; crit-damage minors include crit chance, movement minors generally grant 2%, and attack/cast-speed minors generally grant 3%. Route rewards rotate through domain-appropriate damage and speed, paired crit, movement, life/mana and sustain. Attribute conversion, equipment budgets, skill-rank growth and global caps are unchanged. See [passive balance](passive-balance-2026-09-13.md) for equal-point comparisons and their limits. More available nodes expand choices; they do not grant extra points.

This topology follows the short connections and repeated compact cluster forms in GGG's [PoE 1](https://github.com/grindinggear/skilltree-export) and [PoE 2](https://github.com/grindinggear/poe2-skilltree-export) exports, while preserving Evergrow's unlockable active branches. Those exports are linked from the [official developer data reference](https://www.pathofexile.com/developer/docs/data). Their layouts informed structure, not copied game content or balance values.

The shape recipes live in `skill-tree-shapes.ts`. Shape families loosely follow rewards: critical and Spellweave clusters use twin loops, movement/recovery uses crescents, casting uses leaves, weapon offense uses kites, and defensive/resource groups often use rings. Four utility clusters use forks. Hybrids inherit the first matching family; shape is a navigation cue, not an exhaustive stat legend. Twin loops meet at a real minor junction, never an unmarked crossing. Individual node lenses remain circular. This refinement replaces the initial local 1,843-node all-ring/arc layout; it does not change the authored per-node bonuses or twenty-rank curve.

The shared square-edged window, blue glass, circular node lenses, glyphs and bounded path light remain. Search, Origin/All fitting, the mini-atlas, keyboard/controller traversal and the inspector remain available; top territory filters stay removed. Close-zoom captions avoid nodes, paths, other text and navigation controls. Overview fitting reserves more room for peripheral territory labels, and labels can move sideways into a clear pocket. The production game still excludes development tools.

Search now indexes actual node bonuses through shared item labels, stat keys and common aliases, with case/punctuation normalization and order-independent words. Examples include `projectile pierce`, `crit damage`, `mana regen`, `mp5` and `run speed`. A recognized affix query requires a real bonus or an explicitly related mechanic; minor nodes do not inherit their notable's effects from shared cluster prose. Specific resistance searches also include all-element resistance. Skill names include their Techniques. Affixes with no tree source return no bonus nodes rather than inventing one.

All matches receive a pink screen-sized marker on the atlas and appear on the mini-atlas; allocated nonmatches dim too. Search presents compact groups by canonical bonus, such as `Projectile pierce · 9`, instead of individual-node results. All matches highlight immediately and the camera fits them after a 220 ms typing pause. Broad queries offer bonus groups plus a deduplicated All matches group; choosing a group highlights and frames every node in it. Skill-name searches remain one related-skill group. Enter or Recenter repeats the fit, and Clear removes the filter. Manual navigation and closing the atlas cancel a pending automatic fit; character refreshes do not schedule one. Empty searches and zero matches preserve the camera. Reachable remains an explicit optional filter. Search is presentation-only and changes no allocations or saves. `skill-tree-search.ts` owns the index; `skill-tree-search-art.ts` owns cached match markers.

The current `projectile pierce` query finds nine related nodes: three global-bonus sources (Flight Path, Far Horizon and Flight Doctrine: Thread), two naturally piercing actions (Piercing Shot and Frost Lance), and four Techniques that increase piercing (Barbed Volley, Through the Pack, Unbroken Flight and Hollow Passage). Technique tags compare recipes resolved by the same runtime formulas against their base action; variants that merely retain their parent's piercing are not additional pierce sources.

The previous published v0.3.17 atlas had **875 nodes, 932 connections and 120 groups**, including 90 passive specialties. Its successive 573-node foundation, 36 border gardens and six outer clusters remain historical checkpoints. This local rebuild replaces their long one-entry attachments rather than preserving them as hidden connectivity.

## Inventory hotkeys — local September 13 follow-up

Character & inventory docks the shared HUD inside a compact framed footer, reclaiming the outside gap and replacing the duplicate inventory XP display. Health/mana orbs, current/maximum numbers and XP remain visible; increasing attributes or changing equipment immediately updates these same instruments without healing the character. The inventory version hides the menu/utility shortcut strip and compass; gameplay keeps them. Both versions use square skill tiles with small corner bindings for unobstructed skill artwork. The shared gameplay HUD is 150 logical units tall, down from 174; the inventory footer is 106–116 CSS pixels tall.

Left-click RMB or 1–4 on the HUD to open the full atlas with that skill's details selected (an empty slot opens the Origin). Right-click a slot for a compact assignment picker directly above it. The picker lists unlocked skills with their icons, effective mana costs, missing weapon requirements and existing bindings. Selecting a skill already assigned elsewhere moves it to the chosen slot; Clear removes the assignment. LMB remains the equipped weapon's basic attack. Escape or clicking outside closes the quick picker. Keyboard users can focus a slot and press Shift+F10 for the picker or Enter for details.

Assignments use the same validated character command and save flow as the atlas, preserving skill cooldowns, resources and progress. No save reset is required. The disposable `/character.html` study includes the same HUD and interaction targets.

## Unlock pacing and assignments

Active skills remain tree unlocks. They are optional side branches, never mandatory roads. Techniques and keystones are also dead ends. Every passive territory remains traversable without buying an unwanted skill or accepting a tradeoff. Shortest paths are previews; allocation atomically spends the missing nodes or changes nothing.

The table is a **minimum point distance from a fresh root**, not a mandatory character level. Buying other nodes or ranks delays an unlock; existing shared roads can reduce its remaining cost. Early actions arrive at 2–6 points, advanced attacks at 8–15, and ultimates at 23–33. The five assignable bindings remain RMB / 1–4. LMB basic attack, Q potion and Space dodge remain separate. Equipment incompatibility retains assignments but prevents activation.

| Skill | Territory | Minimum tree points | Requirement | Base mana | Base cooldown (s) |
| --- | --- | ---: | --- | ---: | ---: |
| Repulse | bastion | 15 | shield | 24 | 5 |
| Iron Citadel | bastion | 33 | shield | 45 | 28 |
| Smoke Veil | veil | 14 | any | 20 | 9 |
| Night Reaping | veil | 33 | dagger | 48 | 28 |
| Sidestep | veil | 3 | any | 8 | 3.5 |
| Brace | bastion | 2 | any | 14 | 8 |
| Runic Ward | wellspring | 5 | magic | 22 | 10 |
| Vaulting Shot | veil | 8 | bow | 22 | 6 |
| Rally of Iron | forge | 23 | melee | 42 | 24 |
| Ghost Hunt | hunt | 23 | bow | 40 | 24 |
| Cataclysm | crucible | 24 | magic | 80 | 30 |
| Tempest | crucible | 26 | magic | 35 | 24 |
| Absolute Zero | wellspring | 24 | magic | 75 | 28 |
| Crescent Cleave | forge | 2 | melee | 12 | None |
| Rift Lunge | forge | 5 | blade | 24 | 4 |
| Whirlwind | forge | 9 | melee | 12 | None |
| Earthshatter | forge | 13 | heavy | 36 | 6 |
| Shield Bash | bastion | 4 | shield | 10 | None |
| Bulwark | bastion | 6 | shield | 32 | 8 |
| Thorn Volley | hunt | 2 | bow | 10 | None |
| Piercing Shot | hunt | 10 | bow | 28 | 3.5 |
| Ricochet | hunt | 8 | bow | 12 | None |
| Rain of Arrows | hunt | 13 | bow | 36 | 6 |
| Backstab | veil | 2 | dagger | 10 | None |
| Fireball | crucible | 2 | magic | 12 | None |
| Arc Lightning | crucible | 3 | magic | 12 | None |
| Ice Nova | wellspring | 3 | magic | 14 | None |
| Frost Lance | wellspring | 11 | magic | 28 | 1.8 |
| Meteor | crucible | 14 | magic | 40 | 7 |
| Soul Siphon | wellspring | 8 | magic | 30 | 4.5 |

## Ranks and Techniques

All 30 skills support **twenty purchased ranks**. The unlock gives rank 1. Each additional rank costs one point, for 19 points to reach rank 20; no mastery node is required. Optional lower casting ranks remain available. Buying a rank selects it; changing rank or Technique never resets cooldowns or restores resources. Specialization remains a choice among three Techniques, separate from rank investment.

Damage adds 5% of rank-1 damage per purchased rank above 1; mana adds 1.5% of rank-1 cost. These are additive increments, not compounding multipliers. The relative return gently declines as the skill grows, with no milestone jumps.

| Purchased rank | Damage factor | Mana factor | Cooldown factor |
| --- | ---: | ---: | ---: |
| 1 | 1.00 | 1.00 | 1.00 |
| 5 | 1.20 | 1.06 | 1.00 |
| 10 | 1.45 | 1.135 | 1.00 |
| 15 | 1.70 | 1.21 | 1.00 |
| 20 | 1.95 | 1.285 | 1.00 |

Equipment ranks do not buy traversal or increase mana cost. Their damage contribution remains +0.12 per bonus rank for the first three, then +0.05 for each further rank, up to ten bonus ranks. These contributions add to the purchased-rank damage factor. Equipment ranks also contribute to effective utility rank.

Each effective rank above 1 adds 0.05 seconds to guard, ward, stance and shelter duration. Bulwark adds 0.35 percentage points of block reduction, capped at 90%. Sidestep and Vaulting Shot add 2% of base speed per rank (+38% travel at purchased rank 20); their travel duration and collision rules stay unchanged. Runic Ward adds 0.35 percentage points of maximum-life barrier capacity, capped at 35%. Stance mitigation adds 0.35 percentage points, capped at 50%; empowered-action/echo strength adds 5% of its base value. Charges do not increase. Smoke Veil and Iron Citadel shelter mitigation adds 0.35 percentage points, capped at 75%. Duration continues improving when mitigation reaches a cap, so late ranks still benefit every utility Technique. Stances and Runic Ward commit in 0.18 seconds, still requiring a free action window. Lunge ranks improve hit damage, retaining the selected Technique's dash distance.

Cooldown floors remain four seconds for Bulwark and twelve for ultimates. Basic repeatable skills retain zero cooldown but respect recovery. Global mana reduction tapers after 20% toward 40%; reductions and all displayed costs resolve through the shared rules. Fireball costs 12 mana at rank 1 and 15.4 at rank 20 before modifiers (costs round to one decimal). Technique-specific tradeoffs still apply. Tempest upkeep uses the same gradual mana curve.

The published twenty-rank update retained current-tree purchased ranks, casting ranks, Techniques, assignments and unspent points. The new local topology requires the separate one-time tree refund described below. Existing ranks 2 and 3 receive the new gentler tuning: rank 3 now grants +10% damage / +3% mana instead of the published +20% / +10%. This is initial tuning; code checks cover all ranks and Techniques, while the value of deep investment versus more tree routes still needs player combat feedback. Historical rank-three benchmark reports retain their original measured results.

Every Technique is **one optional point directly beside its skill**. Potency/efficiency precursors and the 17 rank-masteries are removed. Measured Cut, Steady Revolutions, Skipping Arrow and Quiet Blade are retired. Other useful spatial, timing, target-count and sustain variants remain, and every active now has three distinct Techniques, including new economy, control and tactical choices for the ten skills that previously had only two. Multiple Techniques can be purchased; only one or Original is active. Buying a Technique selects it. Previewing one does not mutate the build or include fictional prerequisite bonuses.

| Skill | Technique | Rank-1 change |
| --- | --- | --- |
| Repulse | Open the Line | A full circular shockwave with 20% more radius, but 25% less damage. |
| Repulse | Pinning Wall | 2-second stun, but the arc narrows to 120 degrees. Costs 30% more mana. |
| Repulse | Rolling Front | 30% less mana and cooldown; 20% less damage and a 0.5-second stun. |
| Iron Citadel | Living Rampart | Protection lasts 8 seconds at 30% hit reduction; impact deals 20% less damage. |
| Iron Citadel | Unbroken Seal | Protection rises to 65% hit reduction for only 2 seconds; 20% longer cooldown. |
| Iron Citadel | Breaking Siege | 50% more impact damage and a 1-second stun; protection falls to 25%. |
| Smoke Veil | Spreading Haze | 50% larger smoke radius; only 10% hit reduction. |
| Smoke Veil | Choking Mist | Enemies are 70% slower for 2 seconds; 25% smaller radius and 20% longer cooldown. |
| Smoke Veil | Fading Shroud | 35% less mana and cooldown; only 1 second of protection and 1.5 seconds of slow. |
| Night Reaping | Harvest Circle | Strikes up to eight enemies with 25% more reach, but 25% less damage. |
| Night Reaping | Marked for Death | One target takes 100% more damage; front-facing damage remains lower than a rear strike. |
| Night Reaping | Midnight Execution | Rear strikes deal 3 times damage; 15% less base damage and a 20% longer cooldown. |
| Sidestep | Long Stride | 35% farther; 30% longer cooldown. |
| Sidestep | Quick Footing | 25% shorter step; 25% shorter cooldown. |
| Brace | Hold Fast | Brace lasts 3 seconds; reduction falls to 15%. |
| Brace | Set Like Stone | Brace reduces damage by 30% for 1 second. |
| Runic Ward | Deep Inscription | Barrier holds 26% of maximum life, but expires after 2 seconds. |
| Runic Ward | Patient Rune | Barrier lasts 7 seconds, but holds only 12% of maximum life. |
| Vaulting Shot | Parting Arrow | Retreat 30% farther; arrow deals 20% less damage. |
| Vaulting Shot | Snap Shot | Retreat half as far; arrow deals 30% more damage. |
| Rally of Iron | Last Stand | 8 seconds and 35% hit reduction; only one empowered melee action. |
| Rally of Iron | Iron March | Five empowered actions; hit reduction falls to 10%. |
| Ghost Hunt | Patient Hunt | 10-second window, two echoes at 90% damage. |
| Ghost Hunt | Pale Flurry | Five echoes at 40% damage; window lasts 4 seconds. |
| Sidestep | Yielding Ground | Step backward while keeping your aim. Costs half as much mana; 15% shorter travel. |
| Brace | Measured Breath | Half the mana and 30% shorter cooldown; only 12% hit reduction. |
| Runic Ward | Renewing Script | 40% shorter cooldown and 30% less mana; barrier holds 10% of maximum life for 3 seconds. |
| Vaulting Shot | Pursuing Arrow | Vault forward through the opening; 20% less arrow damage and 20% shorter cooldown. |
| Rally of Iron | Decisive Banner | One melee action deals 140% more damage; window lasts 3 seconds, with no hit reduction. |
| Ghost Hunt | One Perfect Shot | One echo at 200% damage within 4 seconds; 20% longer cooldown. |
| Crescent Cleave | Steady Crescent | 45% less mana and 20% less damage; a narrower 180-degree sweep. |
| Whirlwind | Patient Orbit | 40% less mana and 25% less damage; preserves the full circular sweep. |
| Ricochet | Through the Pack | Pierces two enemies before its first rebound; only two rebounds. Costs 25% more mana. |
| Backstab | Opportunist | 40% less mana, 10% less hit damage; rear strikes use a wider 90-degree threshold. |
| Crescent Cleave | Reaching Crescent | 40% more reach, 15% less hit damage. Costs 30% more mana. |
| Crescent Cleave | Crushing Crescent | 35% more damage, 20% less reach. Costs 60% more mana. |
| Whirlwind | Gathering Steel | 45% more reach, 20% less damage. Costs 35% more mana. |
| Whirlwind | Iron Cyclone | 40% more damage, 15% less reach. Costs 70% more mana. |
| Shield Bash | Shield Wall | A wider, longer shield strike; 15% less damage. Costs 35% more mana. |
| Shield Bash | Bellringer | 40% more damage and a longer stun. Costs 75% more mana. |
| Thorn Volley | Thornburst | Five arrows instead of three, each dealing 25% less damage. Costs 50% more mana. |
| Thorn Volley | Barbed Volley | Each arrow pierces one additional enemy. Costs 65% more mana. |
| Ricochet | Endless Pursuit | Three extra rebounds, 15% less damage. Costs 55% more mana. |
| Ricochet | Heavy Rebound | 50% more damage, only one rebound. Costs 40% more mana. |
| Backstab | Long Shadow | 50% more reach, 10% less damage. Costs 30% more mana. |
| Backstab | Executioner | Rear strikes deal 3× instead of 2× damage; other hits deal 15% less. Costs 70% more mana. |
| Fireball | Forked Flame | Three fireballs, each dealing 35% less damage. Costs 80% more mana. |
| Fireball | Living Ember | Explosions leave burning ground for three seconds. Costs 65% more mana. |
| Arc Lightning | Storm Circuit | Three extra jumps may revisit targets at reduced damage. Costs 70% more mana. |
| Arc Lightning | Concentrated Current | 60% more damage, but only three targets. Costs 45% more mana. |
| Ice Nova | Echoing Frost | A second nova expands after 0.6 seconds at 60% damage. Costs 70% more mana. |
| Ice Nova | Deep Winter | 30% more radius and a stronger, longer slow; 15% less damage. Costs 40% more mana. |
| Meteor | Shattered Sky | Five impacts with 35% smaller radius spread across a wider target area at 45% damage each. Costs 90% more mana; 25% longer cooldown. |
| Shield Bash | Concussion | 2-second stun, 30% less damage. Costs 20% more mana. |
| Thorn Volley | Needle Fan | A tight three-arrow fan; 20% more damage. Costs 35% more mana. |
| Fireball | Flashfire | 40% wider explosion, 20% less damage. Costs 40% more mana. |
| Arc Lightning | Static Thread | 30% less mana, 20% less damage; jumps retain 85% damage. |
| Ice Nova | Snap Freeze | Freezes for 0.6 seconds; 20% smaller radius, 20% less damage. Costs 35% more mana. |
| Meteor | Lasting Inferno | Ground fire lasts 8 seconds at 18% impact damage per second. Costs 45% more mana. |
| Meteor | Worldbreaker | 60% more impact damage, 25% larger radius; no ground fire. Costs 50% more mana; 20% longer cooldown. |
| Rift Lunge | Farstrike | 50% longer dash, 15% less damage. Costs 20% more mana. |
| Rift Lunge | Impaling Rush | 50% more damage, 30% wider contact. Costs 50% more mana; 25% longer cooldown. |
| Rift Lunge | Fleeting Step | 30% shorter cooldown and 20% less mana; 25% less damage, shorter dash. |
| Earthshatter | Faultline | 40% wider shockwave, 20% less damage. Costs 30% more mana. |
| Earthshatter | Seismic Hammer | 60% more damage and 2-second stun; 20% smaller radius. Costs 60% more mana; 25% longer cooldown. |
| Earthshatter | Tremor | 35% shorter cooldown, 25% less damage; stun lasts 0.6 seconds. |
| Bulwark | Enduring Guard | Guard lasts 5 seconds. Costs 50% more mana; 25% longer cooldown. |
| Bulwark | Iron Aegis | Base block reduction rises to 85%, guard lasts 2 seconds. Every additional rank extends the guard; block reduction caps at 90%. Costs 35% more mana. |
| Bulwark | Ready Guard | 25% less mana and 25% shorter cooldown; guard lasts 2 seconds. |
| Piercing Shot | Unbroken Flight | Hits up to 8 enemies; 15% less damage. Costs 40% more mana. |
| Piercing Shot | Siegebreaker | 60% more damage, hits up to 2 enemies. Costs 40% more mana; 20% longer cooldown. |
| Piercing Shot | Twin Needles | Two piercing arrows at 65% damage each. Costs 50% more mana. |
| Rain of Arrows | Blanket of Thorns | 50% larger radius; 25% less damage per wave. Costs 35% more mana. |
| Rain of Arrows | Relentless Rain | Eight waves over 2.4 seconds, each at 75% damage. Costs 65% more mana; 25% longer cooldown. |
| Rain of Arrows | Hail of Barbs | Three rapid waves at 45% more damage. Costs 40% more mana. |
| Frost Lance | Glacial Trident | Three lances at 55% damage each. Costs 70% more mana. |
| Frost Lance | Permafrost Spear | 70% slow for 5 seconds, 20% less damage. Costs 30% more mana. |
| Frost Lance | Diamond Lance | 60% more damage, hits up to 2 enemies. Costs 45% more mana; 20% longer cooldown. |
| Soul Siphon | Soul Feast | Heals 60% of actual damage dealt, but deals 20% less damage. Costs 35% more mana. |
| Soul Siphon | Hollow Passage | Hits up to 3 enemies, 15% less damage. Costs 50% more mana. |
| Soul Siphon | Soul Rend | 60% more damage, healing reduced to 15%. Costs 40% more mana; 20% longer cooldown. |
| Cataclysm | Falling Stars | Eleven impacts at 65% damage each. Costs 60% more mana; 20% longer cooldown. |
| Cataclysm | Extinction | Three impacts with 100% more damage and 40% more radius. Costs 40% more mana; 25% longer cooldown. |
| Cataclysm | Sea of Cinders | Ground fire lasts 9 seconds at 20% impact damage per second; 15% less impact damage. Costs 50% more mana. |
| Tempest | Stormfront | 40% larger storm, 25% less damage. Casting and upkeep cost 30% more mana. |
| Tempest | Thunderhead | Strikes every 0.3 seconds at 80% damage. Casting and upkeep cost 70% more mana. |
| Tempest | Storm Anchor | Stationary storm lasts 9 seconds, deals 20% more damage. Casting and upkeep cost 35% more mana; 25% longer cooldown. |
| Absolute Zero | Polar Horizon | 40% larger waves, 25% less damage. Costs 35% more mana. |
| Absolute Zero | Frozen Eternity | Freeze lasts 2.5 seconds; 80% slow for 6 seconds. Costs 50% more mana; 25% longer cooldown. |
| Absolute Zero | Shattering Winter | One wave deals 140% more damage, 25% smaller radius. Costs 25% more mana. |

## Doctrines

A Doctrine family has three mutually exclusive nodes, connected to the same road. Buy one for one point. Once purchased, its detail panel offers free switching within that family; it replaces the owned choice, preserving node count, connectivity and the point ledger. Switching clears temporary affix/skill buffs, retains cooldowns and does not heal. This prevents keeping a temporary benefit from the previous choice. The full enchanter skill respec remains available at 25 gold per refunded node/rank point; attributes are separate.

- **Guard Doctrine** (bastion): Deflect — Shield block chance +5%. / Absorb — Shield block reduction +10%. / Recover — Life regeneration +1 per second.
- **Impact Doctrine** (forge): Weight — Weapon damage +28%. / Reach — Area of effect +24%. / Rhythm — Attack speed +12%.
- **Flight Doctrine** (hunt): Thread — One additional pierce for non-explosive skill projectiles. / Precision — Critical chance +5%, critical damage +24%. / Coverage — Area of effect +24%.
- **Motion Doctrine** (veil): Stride — Movement speed +8%. / Return — Skill cooldowns and dodge recharge 6% shorter. / Economy — Reduced mana costs +8%.
- **Casting Doctrine** (crucible): Incantation — Spell damage +30%. / Impulse — Cast speed +12%. / Alternation — Spellweave damage +28%; alternate direct melee and spell hits.
- **Reserve Doctrine** (wellspring): Depth — Maximum mana +35. / Flow — Mana regeneration +5 per five seconds. / Shelter — Maximum life +28 and all elemental resistances +3%.
- **Recovery Doctrine** (bastion): Contact — Direct hits restore +2 life. / Draught — Potion restoration +25%. / Patience — Life regeneration +1.2 per second.
- **Insulation Doctrine** (wellspring): Emberproof — Fire and lightning resistances +12%. / Rimeproof — Frost and arcane resistances +12%. / Balanced — All elemental resistances +7%.

## Four optional keystones

- **Measured Force:** no critical hits. Each percentage point of otherwise available critical chance becomes 1% more direct damage, capped at 30%. Damage snapshots retain that factor. Periodic damage is unaffected; critical-damage investment becomes ineffective while this keystone is owned.
- **Open Hand:** one one-handed melee weapon with an empty offhand grants 20% more weapon damage and +8% movement speed. Other loadouts incur 10% less weapon damage. A shield, focus or second weapon sacrifices the bonus; a two-handed weapon cannot qualify.
- **Borrowed Flame:** 40% more damage on Spellweave-empowered actions as a separate multiplier, but 15% less weapon and spell damage on every action. Alternate direct melee/spell hits within the existing four-second window. The keystone enables priming even with no ordinary Spellweave bonus. Bows do not prime it. Ordinary contributions retain their 100% cap; the keystone does not consume that cap. Successful alternation is always 1.4 × 0.85 = 1.19 times the same build without the keystone, including at full Spellweave investment. Repeating the same action still pays the downside.
- **Arcane Overload:** an explicit toggle available only after its node is purchased. Arcana skills deal 30% more damage but cost 60% more mana, including Tempest upkeep. It supplies no damage benefit to Runic Ward. Other keystones apply while owned; they do not show an Overload toggle.

## New combat actions

**Sidestep:** any weapon, 8 mana, 3.5-second base cooldown. Move toward manual aim for 0.22 seconds at 720 units/s (158.4 units before rank/Technique modifiers, twice the free dodge’s 79.2). No hit payload, invulnerability or dodge-charge consumption. It cannot break containers by passing through them. Collision uses the same substepped world movement as Lunge.

**Brace:** any weapon, 14 mana, eight-second cooldown. Take 20% less hit damage for two seconds. It does not generate a shield block or require a shield. With Rally, only the stronger stance reduction applies.

**Runic Ward:** staff/wand, 22 mana, ten-second cooldown. A barrier equal to 18% of maximum life lasts four seconds. Armor/resistance and shield block apply first, then the strongest stance reduction, then the ward absorbs the remainder. Full absorption can reduce health damage to zero. Each hit consumes its finite capacity; recasting replaces capacity rather than stacking it. Capacity and duration are snapshotted, expire normally and clear with incompatible gear or loss of the skill.

**Vaulting Shot:** bow, 22 mana, six-second cooldown. Fire a 120% arrow toward aim while retreating for 0.24 seconds at 440 units/s. The retreat itself cannot damage, break containers or grant invulnerability. One projectile slot is reserved before mana is spent. Techniques choose a longer escape, stronger close shot or forward pursuit. Global non-explosive skill pierce applies to its arrow.

**Rally of Iron:** melee, 42 mana, 24-second cooldown. Six seconds of 25% less hit damage. The next three committed melee actions each get 35% more damage, consumed once per action rather than per enemy. It also benefits melee basics. Bows and spells do not consume/receive charges. Techniques choose a stronger defensive window, five actions with weaker defense, or one concentrated offensive charge without protection.

**Ghost Hunt:** bow, 40 mana, 24-second cooldown. During six seconds, the next three projectile arrow actions each queue one echo of the action's first arrow. Basic bow shots, projectile skills and Vaulting Shot qualify; Rain of Arrows is a ground effect and does not. Each echo fires after 0.32 seconds from the captured launch position, along the captured angle, at 60% of that arrow's snapshotted base damage. Echoes retain the arrow’s critical snapshot, piercing and chain topology. They cannot leech, restore life, apply statuses or create more echoes. The queue holds at most five entries (for its five-charge Technique); geometry and projectile capacity can block an echo, without retrying indefinitely. This is a bounded additional shot budget, not a second trigger for an entire volley.

**Repulse:** an advanced shield cone with a wide arc and stun; 15 origin points. **Iron Citadel:** a surrounding shield strike followed by temporary hit reduction; 33 points. **Smoke Veil:** a zero-damage surrounding slow and brief personal mitigation; 14 points. **Night Reaping:** a dagger attack against up to five enemies around the player, with rear-strike damage; 33 points. Each has three Techniques. Bastion and Veil now each have five active unlocks and an ultimate.

Shelters from different skills retain independent durations. Armor/resistance, shield block, the strongest stance/shelter, then the finite ward resolve in that order. A weaker shelter cannot overwrite a stronger one. Tree armor scales by `1 + 0.13 × (character level − 1)` before aggregation, retaining its value against same-level physical attackers. Item armor keeps its existing item-level scaling. Both tooltip and inspector show the current scaled tree contribution and label that growth; the character-sheet source breakdown uses the same helper.

Temporary effects are read by sustain indicators and bounded actor engravings. They clear on death, relocation, incompatible equipment or removal of their owning skill. They are not restored from checkpoints; skill cooldowns still are. Combat recovery and movement remain continuous without hitstop.

## Existing characters

Fresh characters use treeVersion 3 inside the current version-4 save. Version-2 saves are validated against the exact preceding 875-node atlas, including its twenty-rank cap. Unversioned legacy-tree saves retain their own exact preceding-graph validation. Both checks cover IDs, connectivity, rank caps, owned variants, Doctrine exclusivity, assignments, cooldowns and the point ledger. A valid old allocation receives a **one-time refund of all tree nodes and purchased ranks**, returns to the free root, and clears skill assignments/variants/ranks/cooldowns. Continue opens the new tree at its root with details visible and gameplay paused. The panel explains the refund and asks the player to unlock and assign skills again; the notice remains until the next allocation.

Character level, XP, attributes, appearance, wallet, gear, inventory, storage, location, exploration and world progress remain. Conversion happens on a parsed copy through the normal validated save path; it does not enumerate or delete stored characters. Unknown versions, corrupt trees and unsupported older graphs are rejected and remain stored. The small previous-graph data module exists solely to validate this concrete refund, with no old renderer or gameplay implementation retained.

## Local verification and playtest boundary

Code checks cover all 30 actions/90 Techniques, exact allocation and rank ledgers, exclusive choices, collision movement, finite barriers, charge consumption, echo snapshots/expiry, tradeoff stats, gear changes and old-tree refunds. The save-free local review is [the atlas](http://127.0.0.1:5173/character.html?panel=skills&zoom=overview&map). Its state is disposable. Combat feel and numerical balance still need the player's playtest: especially Brace uptime, ward value against bosses, travel cost to ultimates and the opportunity cost of a five-slot loadout. No automated browser gameplay was run.

The follow-up adds matched-point, matched-rarity probes at levels 10/25/50/100, and finite-resource/follow-up/defensive playground modes. Read [balance follow-up](skill-tree-balance-2026-09-12.md) for measurements, reproducible commands and remaining player-test questions. Current version-2 allocations and paid points remain valid; no additional save reset or refund.
