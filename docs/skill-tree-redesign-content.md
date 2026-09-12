# Evergrow skill tree content dispositions

This appendix accompanies the [complete audit and replacement proposal](skill-tree-redesign-proposal.md). It covers every current passive family and all sixty active-skill specializations at local source `53f25e0486cb97ce01b14e780f87b95ff1d39a92`. **Keep**, **rework** and **move** are recommendations, not implemented changes. Preserve the twenty base skill identities unless a later design explicitly replaces one.

The mechanical facts below come from [skill-tree.ts](../game/src/skill-tree.ts), [skill-progression.ts](../game/src/skill-progression.ts) and [skill-execution-content.ts](../game/src/skill-execution-content.ts). Many historical execution defects were already fixed; this review evaluates the value of the resulting choices rather than reopening those old findings.

## 1. All twenty-one passive families

“Copies” counts ordinary constellations. Bonuses shown describe current content; proposed mechanics are in the last column. A family can contribute useful minors without deserving seven separate clusters.

| Current family | Copies | Current identity | Recommended disposition |
| --- | ---: | --- | --- |
| Tempered Edge | 7 | Attack damage; notable adds Strength | Keep a small amount of general attack investment; merge repeated locations into distinct weapon/positioning contexts. |
| Heart of Iron | 7 | Flat life; notable adds Vitality | Keep early flat reserves; replace deep copies with conditional survival or newly implemented bounded defense scaling. |
| Stonebound | 7 | Flat armor; notable adds Vitality | Keep early armor access and a distinct armor destination. Make deep investment relevant against current source levels. |
| Sanguine Vow | 7 | Flat life regeneration; notable adds life | Keep one clear regeneration specialty. Add a recovery-condition choice only when the condition improves play. |
| Titan Grip | 7 | Strength plus attack damage | Retain useful Strength crossings; do not imply altered handedness. A true grip/stance mechanic needs separate authored content. |
| Bloodletting | 7 | Attack damage; notable adds life on hit | Rename toward direct-hit recovery or implement real wounds later. Do not market damage bonuses as bleeding. |
| Battle Rhythm | 8 | Attack speed and mana efficiency | Reuse the useful stats, but author an actual action-sequence destination if keeping the name. |
| Perfect Opening | 7 | Critical chance and critical damage | Keep critical investment in a few locations. Create a separate conditional precision payoff instead of seven interchangeable crit wheels. |
| Ghost Step | 7 | Movement speed; notable adds Dexterity | Preserve bounded movement investment. Move the evocative identity to a repositioning/evade cluster. |
| Waking Steel | 7 | Attack speed; notable adds Dexterity | Merge generic speed supply; specialize the destination around a weapon pattern or recovery window. |
| Vital Strike | 7 | Critical damage; notable adds critical chance | Give critical damage its own limited identity. Prevent it becoming the obvious companion purchase to every crit-chance cluster. |
| Falcon Eye | 7 | Dexterity; notable adds critical chance | Use Dexterity as a route stat. If retained as a named cluster, give it a real projectile or target-selection promise. |
| Keen Pursuit | 7 | Attack damage and mana efficiency; notable adds movement | Rework around pursuit/target distance rather than a broadly efficient three-stat package. |
| Borrowed Time | 8 | Cooldown reduction; notable adds attack speed | Reduce broad repetition. Separate dodge recovery, active recovery and conditional cooldown ideas explicitly. |
| Inner Flame | 7 | Spell damage and cast speed; notable adds Intelligence | Its generic spell package is not fire-specific. Rename as caster foundation or attach a real fire destination. |
| Astral Reservoir | 7 | Flat mana; notable adds mana regeneration | Keep accessible reserves, then develop optional ward/mana interactions. Avoid making every caster cross the same reserve wheel. |
| Quiet Current | 8 | Mana regeneration and efficiency; notable adds mana | Keep sustain access in multiple useful areas, with different pack/boss/burst solutions rather than eight identical packages. |
| Continuum | 7 | Cooldown reduction; notable adds spell damage | Consolidate generic cooldown supply; develop specific timing/echo choices rather than duplicate Borrowed Time in another color. |
| Higher Thought | 7 | Intelligence; notable adds mana | Retain useful crossings. Replace repeated deep stat-only destinations with distinct spell or resource interactions. |
| Soul Stitch | 7 | Flat life regeneration; notable adds Intelligence | Distinguish from Sanguine Vow through an actual caster recovery contract, or merge the identity. |
| Spirit Ward | 7 | Flat life; notable adds mana | Rework into genuine ward support after Ward exists; keep basic life/mana minors under honest labels. |

The repeated families are not all bad bonuses. The issue is turning a limited foundation vocabulary into most of the map. Early life, speed and efficiency should remain easy to understand; distinctive destinations should carry the more complex promises.

## 2. All sixty specialization decisions

Each row names all three existing variants. “Move” usually means preserve the useful stat benefit in a shared minor or Doctrine while retiring the redundant selectable variant. “Reprice” means evaluate total damage, utility and resource demand with the redesigned ranks, not preserve the current mana penalty by default.

### Melee and shield

| Skill | Variant | Decision | Design reason / proposed treatment |
| --- | --- | --- | --- |
| Crescent Cleave | Reaching Crescent | **Keep; reprice** | Greater reach changes positioning and coverage. Preserve matching blade/sweep art; compare coverage gain against damage loss. |
| Crescent Cleave | Crushing Crescent | **Keep; sharpen role** | Short reach for a stronger hit can create a close-combat commitment. Ensure damage compensates for reduced safety, rather than competing solely on tooltip DPS. |
| Crescent Cleave | Measured Cut | **Move** | A cheaper, weaker sweep is useful sustain tuning but a weak major identity. Place efficiency in shared melee recovery; a replacement technique should change direction, follow-up or target priority. |
| Rift Lunge | Farstrike | **Keep** | Distance is an actual movement choice. Retain terrain constraints and the visible endpoint; price increased travel value separately from damage. |
| Rift Lunge | Impaling Rush | **Rework** | More damage and contact width mostly improve the same action. Make it a deliberate engage option with a clear endpoint payoff, rather than another mandatory force variant. |
| Rift Lunge | Fleeting Step | **Keep; distinguish from Sidestep** | Shorter, cheaper, more frequent Lunge can support repeated engagements. It should remain an attack with compatible-weapon commitment, not eclipse every new escape skill. |
| Whirlwind | Gathering Steel | **Keep** | Wider surrounding coverage has a recognizable job. Preserve one-hit-per-sweep rules and avoid interpreting added area as repeated damage. |
| Whirlwind | Iron Cyclone | **Rework** | Another reach-for-damage trade mirrors Crushing Crescent. Explore a committed control payoff or a distinct recovery pattern; do not simply duplicate Cleave's choice. |
| Whirlwind | Steady Revolutions | **Move** | Pure cost/damage tuning belongs in sustain. A later mobile or sustained Whirlwind would require a genuinely new action contract, not only this name. |
| Earthshatter | Faultline | **Keep; strengthen geometry** | Wider control is useful. Consider an authored line or forward fissure alternative to distinguish it from a bigger circular slam. New geometry needs new contact/telegraph work. |
| Earthshatter | Seismic Hammer | **Keep** | Concentrated damage and longer stun versus smaller radius is a real priority-target commitment. Check elite/boss control resistance and follow-up loops. |
| Earthshatter | Tremor | **Keep; rebudget** | More frequent, lighter control can support a different tempo. Check total stun uptime instead of treating reduced damage as sufficient compensation. |
| Shield Bash | Shield Wall | **Keep** | A broader defensive/control cone suits managing a crowd. It should read as shield contact, not a magical screen blast. |
| Shield Bash | Bellringer | **Merge or rework** | Damage plus longer stun overlaps Concussion. A new version could establish one counterattack opportunity after a successful bash, with explicit action consumption. |
| Shield Bash | Concussion | **Keep** | Trading damage for strong control is a clear utility choice. Boss-resistant behavior and repeated stun prevention must be visible. |
| Bulwark | Enduring Guard | **Keep** | A longer guard supports sustained exposure at higher cost/recovery. Audit actual duration versus cooldown with gear and ranks. |
| Bulwark | Iron Aegis | **Keep; revisit ceilings** | Stronger shorter protection has a distinct timing role. The old ineffective-rank plateau was fixed; the remaining design question is whether capped protection plus extra duration becomes too reliable. |
| Bulwark | Ready Guard | **Keep** | Frequent brief guards can reward timing. It must not become equivalent to permanent near-total protection when stacked with global cooldown bonuses. |

### Bows and daggers

| Skill | Variant | Decision | Design reason / proposed treatment |
| --- | --- | --- | --- |
| Thorn Volley | Thornburst | **Keep** | A larger fan is recognizable coverage. Test how many projectiles can actually hit one target and whether overlap produces unintended burst dominance. |
| Thorn Volley | Barbed Volley | **Keep** | Penetrating a front line is meaningfully different from spreading wider. Jointly budget the technique with existing gear/tree pierce. |
| Thorn Volley | Needle Fan | **Keep; clarify aim role** | Narrower geometry favors concentrated fire. Compare real hit count and distance rather than only its per-arrow damage increase. |
| Piercing Shot | Unbroken Flight | **Keep** | Long target lines are a distinct scenario. Do not price eight-target potential as if it is routinely achieved. |
| Piercing Shot | Siegebreaker | **Keep** | Fewer targets for concentrated damage suits elites/bosses. Clarify whether additional pierce can weaken the restriction; the chosen tradeoff should survive incidental gear. |
| Piercing Shot | Twin Needles | **Rework** | Two weaker arrows risk being a visual multiplication of the same action. Give them a deliberate pattern or interaction, or merge the choice with volley geometry. |
| Ricochet | Endless Pursuit | **Keep** | More rebounds serves dispersed packs. Distinguish its no-revisit target rules from Arc Lightning's circuit behavior. |
| Ricochet | Heavy Rebound | **Keep** | A short chain with stronger contacts is a useful focused alternative. Validate damage falloff and actual target counts. |
| Ricochet | Skipping Arrow | **Move** | Lower cost and one fewer rebound is an efficiency adjustment. Replace with a real positioning or prioritization pattern if a third technique is needed. |
| Rain of Arrows | Blanket of Thorns | **Keep** | A wider, weaker field supports area control. Any slowing field would be a new explicitly authored effect, not implied by the name. |
| Rain of Arrows | Relentless Rain | **Keep** | Longer repeated damage rewards holding an area. Compare moving targets and deliberate control combinations, not only total stationary damage. |
| Rain of Arrows | Hail of Barbs | **Keep** | A shorter burst is a clear contrast to a sustained field. Check whether its full payoff arrives before enemies can respond. |
| Backstab | Long Shadow | **Rework** | More reach helps usability but does little to create an opening. Retain some reach as an early improvement; develop a technique around approach or a limited rear-attack opportunity. |
| Backstab | Executioner | **Keep** | Rear positioning is the action's strongest identity. Preserve the corrected frontal/rear formula and make rear success readable. |
| Backstab | Quiet Blade | **Move or deepen** | Lower cost with weaker rear reward can become generic frontal spam. Move efficiency to sustain, or require a meaningful ambush resource/condition before keeping it as a major technique. |

### Regular magic

| Skill | Variant | Decision | Design reason / proposed treatment |
| --- | --- | --- | --- |
| Fireball | Forked Flame | **Keep** | Projectile geometry is a clear behavioral change. Preserve whole-fan resource admission and snapshot rules. |
| Fireball | Living Ember | **Keep** | Persistent ground creates a different action/movement loop. Preserve strongest-burn behavior and no repeated direct-hit procs. |
| Fireball | Flashfire | **Keep; compare with ground role** | Wider immediate explosions can be a useful instant-clear alternative. Its role should stay immediate coverage, not duplicate Living Ember. |
| Arc Lightning | Storm Circuit | **Keep; tightly bound revisits** | Revisiting targets is one of the strongest existing mechanical variants. Test one target, two targets and packs; prevent runaway single-target multiplication or proc recursion. |
| Arc Lightning | Concentrated Current | **Keep** | Stronger output with fewer targets is readable. Evaluate it against Circuit's actual low-target behavior. |
| Arc Lightning | Static Thread | **Keep; rename around continuity if needed** | Unlike a pure economy variant, its different falloff changes damage distribution along the chain. Make that role as prominent as reduced cost. |
| Ice Nova | Echoing Frost | **Keep** | A second timing window changes positioning and follow-up opportunities. Preserve the origin and offensive snapshot through the delay. |
| Ice Nova | Deep Winter | **Keep** | Broader, stronger, longer slowing can be a genuine control choice. Avoid requiring it as every caster's only survival answer. |
| Ice Nova | Snap Freeze | **Keep** | Brief freeze trades coverage/damage for interruption. Verify repeat-cast and boss behavior before lowering mana or recovery. |
| Frost Lance | Glacial Trident | **Keep** | A fan changes target coverage and aim. Distinguish it from Fireball's explosive fan through frost/penetration identity. |
| Frost Lance | Permafrost Spear | **Keep** | Stronger long-duration slow supports kiting and other delayed actions. Its value depends on encounter movement. |
| Frost Lance | Diamond Lance | **Keep; separate from Piercing Shot** | Focused piercing damage is useful, but should express frost interaction rather than simply copy the physical bow version. A chill-consumption payoff would be new work. |
| Meteor | Shattered Sky | **Keep** | Several smaller scattered impacts change coverage and reliability. The smaller-radius fix already exists; evaluate expected overlap honestly. |
| Meteor | Lasting Inferno | **Keep** | Stronger persistent fire is an actual field-control plan. Compare the time enemies remain on the ground and retain no-stack rules. |
| Meteor | Worldbreaker | **Keep** | Immediate impact emphasis with no ground fire is a clear alternative. Existing direct-hit ignition is distinct from ground fire and must remain accurately described. |
| Soul Siphon | Soul Feast | **Keep** | Stronger actual-damage healing in exchange for offense has a useful survival role. Compare healing on low-health targets, not theoretical overkill. |
| Soul Siphon | Hollow Passage | **Keep** | Hitting several targets changes how recovery is obtained. Add a per-action recovery budget if needed rather than rewarding unlimited target count. |
| Soul Siphon | Soul Rend | **Keep; reconsider its emphasis** | More damage with less recovery is coherent, but should not simply turn the only recovery spell into another optimal nuke. Make the lost survival visible. |

### Ultimates

| Skill | Variant | Decision | Design reason / proposed treatment |
| --- | --- | --- | --- |
| Cataclysm | Falling Stars | **Keep; emphasize area pattern** | Many lighter impacts support broad bombardment. Without a distinctive field pattern it can feel like a second Shattered Sky. |
| Cataclysm | Extinction | **Keep; emphasize deliberate placement** | Fewer large impacts can favor committed targeting. Verify overlap and danger-window timing; total nominal damage is not the entire value. |
| Cataclysm | Sea of Cinders | **Keep** | Extended ground transforms the encounter space. Preserve bounded effects, reserved admission and non-stacking burns. |
| Tempest | Stormfront | **Keep** | Wider following coverage changes positioning. Cost and upkeep must both participate in the same resource comparison. |
| Tempest | Thunderhead | **Keep; audit proc density** | Faster pulses change cadence. Compare direct-hit life on hit/crit behavior and mana demand per second, not only per-pulse damage. |
| Tempest | Storm Anchor | **Keep** | Fixed versus following is a strong specialization distinction. Preserve cancellation on death, gear incompatibility, relocation and unpaid upkeep. |
| Absolute Zero | Polar Horizon | **Keep** | Wider control has an intelligible crowd role. Avoid treating the area increase as free boss damage. |
| Absolute Zero | Frozen Eternity | **Keep; constrain lockdown** | Longer freeze is a distinct support/control role. Elite/boss control resistance and repeated-cast behavior are essential. |
| Absolute Zero | Shattering Winter | **Keep** | One decisive wave versus two is a genuine timing trade. Balance against the lost second opportunity to hit and control. |

The catalog is stronger than the repetitive graph makes it appear. Most elemental and ground-effect variants already have distinct spatial or temporal behaviors. The largest consolidation opportunities are generic economy variants and physical “more damage / less reach” duplicates. A full tree replacement should rescue the good content rather than erase it to manufacture novelty.

## 3. Minimum specifications for new effects

Every new conditional node or skill needs a short content contract before implementation:

| Field | Required decision |
| --- | --- |
| Trigger | Which actual event enables it: accepted action, direct hit, block, manual dodge, death, or elapsed time? |
| Scope | Which weapon hand, action family, damage channel, skill or target does it affect? |
| Consumption | Once per action, once per direct hit, once per cooldown, or while a timed state is active? |
| Stacking | Replace, refresh, strongest-only, add within a bounded family, or mutually exclusive? |
| Snapshot | Which offensive/defensive values are captured when the action begins? |
| Failure | What happens on a miss, invalid target, blocked landing, insufficient mana or effect-cap rejection? |
| Cleanup | What ends it on death, relocation, reload, equipment changes, respec or slot reassignment? |
| Forecast | What can the UI calculate exactly, and what must be labeled conditional? |
| Feedback | What tells the player it became ready, succeeded, expired or failed? |
| Abuse fixture | Which worst-case combination could multiply it: multiple projectiles, repeated pulses, crits, recovery or cooldown resets? |

This is especially relevant for Ghost Hunt, counterattacks and Spellblade effects. Their triggered payloads must not become sources of more copies of themselves. Effects should be bounded locally without reintroducing enemy population caps.

## 4. A concrete first design slice

Author three complete routes before producing the full atlas:

**Shield melee:** Cleave → a useful survival fork → Bulwark or Shield Bash → The Unbroken Line → a counterattack Doctrine. An adjacent route reaches Rift Lunge. The player can choose defense first without buying a damage skill they do not want.

**Bow:** Thorn Volley → a recovery/positioning choice → Sidestep or Vaulting Shot → Through the Needle → Piercing Shot. Brace is reachable on a common survival crossing. Ricochet remains an alternative coverage branch, not a compulsory transit node.

**Caster:** Fireball or Arc Lightning → a reserve/control choice → Runic Ward → a distinct technique → Meteor or Frost Lance. Ice Nova and Soul Siphon are accessible alternatives; the build does not have to buy all of them. An intentional Spellforge crossing connects melee/magic investment.

For each route, place a meaningful optional reward every few purchases and compute the combined cost from origin. Use the same final node grammar, save ownership and graph validation intended for the full tree. The initial slice can be small without being disposable.

Evaluate those routes at 10 and 25 points with ordinary gear. If their decisions are still interchangeable, redesign the content before expanding the map. If they feel distinct, extend the same principles into the six territories and later ultimate destinations.
