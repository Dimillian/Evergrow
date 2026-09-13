# Unique items

Published in v0.5.0 · 2026-09-13 · twelve items. Local batch three adds six more (eighteen total); further balance follows gameplay feedback.

Uniques are a separate rarity beside Legendary. Each has a fixed name, base/profile, four fixed affix types, and an equipped signature power. The signature description leads with the affected skill’s shared icon and full name, in both item tooltips and Chronicles. They use red/rose light with violet edges and the ✧ mark in item names, ground labels and tooltips. Legendary items keep their random affixes and Greater Affix rolls.

## Catalog

| Unique | Slot | Skill | Equipped power |
| --- | --- | --- | --- |
| Dervish’s Grasp | Gloves | Whirlwind | Hold the assigned keyboard/mouse or controller button to repeat revolutions at full movement speed. Each revolution retains normal damage, action cadence and mana cost. Release stops queuing another revolution; the current one finishes. |
| Returning Verdict | Shield | Shield Bash | Throw the shield outward and back to its firing position. Damage and selected Technique stun apply once per enemy on each leg. Technique reach and width affect flight reach and collision width. |
| Homeward Thorn | Bow | Thorn Volley | Arrows return to their firing positions. Each leg resets its contact set and pierce allowance; normal arrow damage and selected Technique remain intact. |
| Cinderheart Testament | Grimoire | Fireball | Each paid Fireball action stores its entire cast, including Forked Flame projectiles or ground/burn payloads. Store at most three casts for 20 seconds. The next basic attack releases them along its aim without paying again. |
| Winter’s Reach | Orb | Ice Nova | Place the nova at the aim point within 420 world units, stopped by solid terrain. The selected Technique remains active, including an echo at the same location. |
| The Broken Seal | Grimoire | Runic Ward | A ward depleted by enemy damage while the player survives explodes in a 140-unit base radius. Damage equals absorbed damage, capped at three times the compatible weapon’s derived spell hit at ward creation. Area bonuses apply; explosion damage cannot critically strike or heal through life on hit. Expiry/replacement do not explode. |
| Ashen Double | Cloak | Smoke Veil | Leave a two-second double with 20% maximum-life health. Nearby normal enemies can redirect uncommitted attacks toward it through line of sight. Other ranks retain their target. The normal slow/protection still apply. |
| Duelist’s Return | Boots | Lunge | A fresh activation within two seconds after the outward dash returns toward its origin. Free movement only, with no added damage, invulnerability or cooldown reset; terrain can stop it. |
| Gravetide | Two-handed mace | Earthshatter | Replace the radial hit with a 350-unit traveling fissure. Full Technique damage/stun once per enemy; width inherits area/Technique radius and terrain blocks travel. |
| Pale Huntsman’s Signet | Ring | Ghost Hunt | A stationary spectral archer releases the existing finite echoes from its cast position toward each triggering action's aim. Preserves potency, count, duration, piercing and chain; no autonomous shots or healing/status/return procs. |
| Rimeheart Spire | Wand | Frost Lance | Each lance lodges at its terminal enemy/terrain contact, then shatters after 0.6 seconds in a 70-unit base radius for that lance's full damage and slow. Piercing remains intact; empty-space expiry does not shatter. |
| Vessel of Borrowed Life | Amulet | Soul Siphon | Unused actual Siphon healing becomes a four-second barrier capped at 20% maximum life, sharing capacity with Runic Ward. Does not convert other healing or trigger Broken Seal. |
| Heartwood Draw | Longbow | Piercing Shot | Hold up to 0.6 seconds for linearly increasing damage (up to 2×) and reach (up to +30%). Release commits one paid shot; holding never autofires. Dodge, changing actions, equipment removal and pause cancel the draw. |
| Briarfall Mantle | Cloak | Rain of Arrows | The existing pulses advance a total 240 units from the aimed point along the release direction. Each Technique keeps its pulse count, damage and statuses. Walls stop travel without deleting the remaining pulses. |
| Thread of Pursuit | Amulet | Ricochet | Prefer fresh targets, then spend the remaining rebound count on 0.3-second loops to previous victims. Each loop has a fixed endpoint, collides with walls and retains full damage. Repeat contacts cannot restore life. |
| The Patient Bastion | Shield | Bulwark | Full movement while raising guard. Actual blocked damage charges the next basic melee action for six seconds, up to +200% of derived weapon damage. Consumed once at windup; skills do not spend it. |
| Red Harvest | Dagger | Backstab | A natural rear strike marks its victim for four seconds. The next Backstab consumes the mark and receives its Technique’s rear multiplier from any angle. Consuming a mark never renews it. At most sixteen live marks. |
| Stormglass Reliquary | Orb | Arc Lightning | Place a three-second conductor at the aimed, terrain-clamped point within weapon reach. The first jump uses the Technique’s chain range and line of sight from the conductor; later jumps retain normal rules. Each cast replaces it; it never attacks automatically. |

Skills must still be unlocked, assigned and supported by compatible equipment. Signature powers do not unlock skills or grant ranks. Existing Techniques, purchased ranks and equipment requirements remain authoritative. There is no repeated-hit damage penalty. Returning projectiles return to a static firing position, never home on the player or enemies; terrain can stop the return. Shield throwing does not remove the equipped shield's defensive stats.

Stored Fireballs snapshot damage, source level, status payload and offensive stats when paid for. A full storage rejects another cast before payment. Release waits for room for the entire group if projectile or ground-effect capacity is exhausted. Unequipping the item, losing Fireball/compatible gear, expiration, or death clears stored casts. Temporary combat effects are not saved across sessions/travel checkpoints. Keyboard/mouse and controller holding repeat Whirlwind; touch retains its normal tap-to-cast input.


## Generation, odds and improvements

- Every Unique drops at the player's level when its reward is generated (before kill XP is awarded for enemy drops). Its level is then fixed. Ordinary equipment remains tied to source level/rank. Claim-time dungeon/event reward generation uses the claiming player's level.
- All eighteen current designs have equal selection weight. There is no build-based bias, minimum level gate, duplicate protection or pity counter.
- Affix types and roll position are fixed at 0.75 within their normal level-scaled ranges. Displayed and actual affix values remain whole numbers. Base power uses the Legendary tier budget; signature powers are not included in the generic gear-power estimate.
- Unique chance equals the existing Legendary chance at every item-giving source. Legendary odds are preserved; the additional Unique share comes proportionally from Common/Magic/Rare/Epic. Loot quantities remain unchanged. A Unique result is always its authored equipment, never a charm.
- Enemy item rolls: Normal 0.05%, Veteran 0.15%, Elite 0.5% each for Unique and Legendary. These are per-item probabilities, before each rank's item quantity/first-kill rules.
- Regular dungeon final chest: 5% chance of at least one Unique; wilderness raid hoard: 10%. Legendary retains the same separate whole-chest chances.
- Expedition stage rewards: 5% per item; grand chest: 20% per item, equal to Legendary. Both rarities may occur in the same chest.
- Vendors and gambling do not generate Uniques. Existing item-giving events and side chests inherit their normal source tables; gold/resource-only containers remain unchanged.
- Blacksmith enhancement up to +10 is supported. Enchanting, rerolling affixes, rarity promotion and releveling are unavailable. Greater Affixes do not apply to Uniques.

`unique-content.ts` owns definitions, colors and signature constants. `items.ts` generates canonical recipes; save validation verifies the authored definition and derived values. Existing valid saves remain readable without a reset or a new payload version.

## Chronicles

The Uniques tab lists all eighteen designs, including unfound items. All/Found/Unfound filters and search cover item names, skills and item types. Hover, focus or tap shows the signature power and fixed affix types. Discovered items also show first finder/date and highest level found; unfound art is dimmed.

Discovery occurs only on successful pickup, never when a drop is generated or rejected by a full inventory. Selling, dropping or later deleting the item does not erase discovery. Re-pickups preserve first discovery and do not inflate completion. Per-character source records merge through the existing Chronicle account/local ledgers; no separate cloud schema or save migration is required. Existing discovery records are retained; new designs start unfound.

## Local inspection and verification

- `/character.html?uniques`: eighteen level-25 items in a disposable inventory (the overflow tray retains any that do not fit); hover for signature powers.
- `/loot.html?uniques`: all eighteen grounded with shared runtime labels and art.
- `/chronicle.html?uniques`: three found / fifteen unfound, using the runtime collection panel.
- `/tools/skills.html?skill=whirlwind&unique=dervish-grasp&level=25`: the isolated skill study; select another skill/Unique to inspect each power and its Techniques. No playable saves are read or changed.

`game/tests/unique-items.test.ts` covers all recipes across levels 1–1,000,000, enhancement/forgery/save validation, odds and source-level separation, each signature with Original and all three Techniques, returning contacts/terrain, nova targeting/echo, paid Fireball capacity and basic release, ward damage/expiry, held Whirlwind/mana, and successful-pickup collection persistence. Gameplay balance and touch/controller feel remain player checks.

## Validation checkpoint · 2026-09-13

The player approved Homeward Thorn after trying the level-25 local Homeward Test character. That character occupies an unused local slot; it is not a production asset or a modified cloud save.

A fresh full run passed 1,325 headless tests. Two additional targeted tests then verified both returning legs across Original/all three Techniques (damage, pierce and shield stun), and paid Living Ember payload retention when ground-effect capacity is full. All 15 Unique tests pass, along with TypeScript checking and the production build. No additional runtime defect was found in this review. Visual/combat feel for the other five powers and cross-device input behavior still need player validation. Touch retains tap-to-cast Whirlwind, as documented above.

Batch two was subsequently approved and implemented. See [Unique batch two](unique-items-next-batch.md) for the full behavior and verification scope. The counts above describe the first-batch validation checkpoint, not the current total.

## Second-batch safeguards · 2026-09-13

The Unique suite now contains 27 tests. Added coverage verifies all twelve canonical recipes and all four versions of each skill, decoy target commitment/contact, Lunge recast input at zero mana, dense fissure contacts, stationary echo launches, delayed crystal capacity/snapshots, Siphon overheal and shared barrier capacity, and transient-state cleanup. Existing saves can drop/find all twelve without a reset. Overall Unique/Legendary odds and loot quantities are unchanged.

Local previews: `/character.html?uniques`, `/loot.html?uniques`, `/chronicle.html?uniques` and the Unique selector in `/tools/skills.html`. The studies use shared runtime content and disposable state.

Final second-batch verification: all 1,346 headless tests pass with four test workers, including the 27 Unique tests. The seven development-tool tests also pass after the showcase adjustments. The earlier parallel-run cloud timeouts and concurrent HUD layout failures were rerun successfully.

## Local batch three · 2026-09-13

The six catalog additions above use the same fixed-affix recipes, player-level-on-drop rule, Unique/Legendary odds and Chronicles discovery path. No save reset. Charges, marks, conductors and counterattacks are transient and disappear on death/restoration; unequipping their owner or removing the skill clears them. Released projectiles and rain keep their paid offensive snapshots.

`unique-items.test.ts` adds hold/release/cancellation tests, all-Technique damage and reach checks, complete moving rain/pulse budgets, fresh-target priority and non-healing ricochet loops, wall and target-motion checks, actual block capture and one-shot counterattack consumption, rear/front mark sequences, conductor origins/range/expiry and state cleanup.

Preview links:
- `/tools/skills.html?skill=piercingShot&unique=heartwood-draw&level=25&targets=line`: holds then releases one charged shot.
- `/tools/skills.html?skill=rainOfArrows&unique=briarfall-mantle&level=25&targets=line`: moving curtain.
- `/tools/skills.html?skill=ricochet&unique=thread-of-pursuit&level=25&targets=single`: lone-target loops.
- `/tools/skills.html?skill=bulwark&unique=patient-bastion&level=25&scenario=defense`: controlled incoming hits and a basic follow-up.
- `/tools/skills.html?skill=backstab&unique=red-harvest&level=25&rear=rear&targets=single`: natural rear hit followed by a marked frontal strike.
- `/tools/skills.html?skill=arcLightning&unique=stormglass-reliquary&level=25`: conductor and chain.

The showcase uses disposable targets and the runtime renderer. These checks validate mechanics; player testing still decides balance and input feel.

Verification: the full 1,356-test suite passed; the final targeted run passed all 45 Unique/tool tests after the added range and staged-input checks.

### Shared effect UI · September 13

All eighteen signatures now separate a concise primary power from nested rules in item comparisons and Chronicles. Stored Fireballs show count and earliest expiry; Patient Bastion shows stored damage; Borrowed Life shows absorption; Lunge shows only its usable return window. Ashen Double and conductor presence show remaining lifetimes. Broken Seal and Pale Huntsman extend the existing Ward/Ghost Hunt cards. Red Harvest belongs to its marked target. Ordinary projectile travel and Piercing Shot's existing charge display do not gain redundant player badges. No signature or drop rule changes.
