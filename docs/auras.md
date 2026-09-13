# Auras

Local September 13, 2026. Seven optional aura leaves join existing atlas routes. No travel nodes were added. Existing node identifiers, purchases and character saves remain intact.

Assign an unlocked aura to any of the five skill slots to activate it automatically. It reserves a percentage of total maximum mana, even with an empty mana pool. Pressing its binding does nothing; removing it from the bar deactivates it. Auras occupy skill slots. Reassigning an existing aura moves it rather than stacking duplicate copies.

| Aura | Territory | Minimum origin points | Rank-one reservation | Rank-one effect |
|---|---|---:|---:|---|
| Ironroot | Bastion | 20 | 35% | +40% armor and 5% less physical hit damage after armor. |
| Stillwater | Wellspring | 20 | 30% | Standing still builds to 12% less mana cost over 1.2 seconds. Movement, dodge or dash clears focus. |
| Blood Oath | Forge | 25 | 45% | Repeated direct melee contacts against one target build five stacks of +4% melee damage. Stacks last three seconds; changing target resets them. The triggering contact uses the preceding stack count. |
| Elemental Resonance | Crucible | 25 | 45% | Direct elemental contacts expose that element for three seconds: subsequent matching damage gains 10%. Each element refreshes independently, never stacks. |
| Hawkeye | Hunt | 29 | 35% | Arrow speed and reach +20%; beyond 180 world units from release, arrows gain ten percentage points of critical chance. |
| Thornbound | Veil | 30 | 40% | Enemies within 90 units are slowed 20%, refreshed every 0.6 seconds. Bosses receive half strength. Requires line of sight. |
| Elemental Spikes | Forge | 30 | 40% | Within 70 units, pulses alternate fire → frost → lightning every 0.6 seconds for 30% melee weapon damage. Requires a held melee weapon and line of sight. |

The user requested Blood Oath and Elemental Resonance closer to the established tree: both now cost 25 points, without extending the trunks to force a 40-point unlock.

## Ranks and resources

Unlocking grants rank one. Each further rank costs one point, up to rank twenty. Every rank adds 3% of base effect power and reduces reservation by **0.25 percentage points**. Rank twenty has 57% more power and reserves 4.75 points less mana. Distances, stack limits and timing stay fixed. Aura ranks currently come from purchased ranks only; aura-rank affixes are excluded from generated equipment. Auras have no Techniques in this slice.

Reservations add. Assignments or downranking that would reserve 100% or more are rejected before mutation. The spendable pool is `floor(maximum mana × (1 − total reservation / 100))`, minimum one. Removal or ranking up increases capacity without refilling it. Regeneration, mana-on-kill, vials and potions stop at unreserved capacity; percentage restoration still uses total maximum mana. Ordinary cost reduction does not reduce reservation. Stillwater multiplies action costs after ordinary cost reduction, retaining existing minimum action costs.

The mana orb masks the reserved circular segment with dark etched glass. Its numeric readout shows current / spendable mana. Maximum mana in detailed stats remains the total and explains reserved/available capacity. Persistent aura icons show reservation; Blood Oath buildup and Stillwater focus reuse the shared buff bar and hover explanations. One segmented ground engraving shows all active aura colors with bounded drawing and reduced-motion support.

## Combat ownership

`aura-content.ts` owns metadata, ranks, reservation and consistent admission. `auras.ts` owns transient buildup and short-range pulses. Assignments/ranks persist using existing sheet fields; refresh/restoration derives active powers. Transient buildup does not persist. Death removes active effects.

Ironroot augments the shared armor derivation and physical hit mitigation. It uses physical protection instead of the brainstormed knockback protection: player knockback does not currently exist. Resonance uses matching damage exposure because enemies do not currently have elemental resistance stats. Hybrid melee contacts expose/amplify only their elemental portion. Spikes use the existing periodic damage path: no critical hits, life on hit, Spellweave, contact statuses or recursive Blood Oath triggers. Exposure may amplify matching pulses. Hawkeye snapshots launch position and critical bonus on arrows; removing the aura cannot rewrite released arrows. Measured Force continues to prevent critical hits.

## Local review and verification

- `/tools/skills.html?skill=elementalSpikes&scenario=showcase&level=25&weapon=longsword&targets=ring`: shared combat simulation and art, including aura/buildup icons. Other auras are in the same selector. Press Play; the study is disposable.
- `/character.html?panel=hud&auras`: frozen Ironroot/Blood Oath loadout, reserved orb and three-stack Blood Oath buff.
- `/character.html?panel=skills&auras&node=skill:bloodOath`: inspect rank controls and placement.

`auras.test.ts` covers routes/ranks, transactional reservation, capped recovery, actual damage/status changes, release snapshots, buff projection and save restoration. Existing tree geometry, progression and isolated skill studies include the new leaves. These are headless checks, not automated gameplay testing.
