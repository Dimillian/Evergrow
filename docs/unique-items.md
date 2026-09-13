# Unique items

Published in v0.5.0 · 2026-09-13 · twelve items; further balance follows gameplay feedback.

Uniques are a separate rarity beside Legendary. Each has a fixed name, base/profile, four fixed affix types, and an equipped signature power. They use red/rose light with violet edges and the ✧ mark in item names, ground labels and tooltips. Legendary items keep their random affixes and Greater Affix rolls.

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

Skills must still be unlocked, assigned and supported by compatible equipment. Signature powers do not unlock skills or grant ranks. Existing Techniques, purchased ranks and equipment requirements remain authoritative. There is no repeated-hit damage penalty. Returning projectiles return to a static firing position, never home on the player or enemies; terrain can stop the return. Shield throwing does not remove the equipped shield's defensive stats.

Stored Fireballs snapshot damage, source level, status payload and offensive stats when paid for. A full storage rejects another cast before payment. Release waits for room for the entire group if projectile or ground-effect capacity is exhausted. Unequipping the item, losing Fireball/compatible gear, expiration, or death clears stored casts. Temporary combat effects are not saved across sessions/travel checkpoints. Keyboard/mouse and controller holding repeat Whirlwind; touch retains its normal tap-to-cast input.

## Generation, odds and improvements

- Every Unique drops at the player's level when its reward is generated (before kill XP is awarded for enemy drops). Its level is then fixed. Ordinary equipment remains tied to source level/rank. Claim-time dungeon/event reward generation uses the claiming player's level.
- All twelve designs have equal selection weight. There is no build-based bias, minimum level gate, duplicate protection or pity counter.
- Affix types and roll position are fixed at 0.75 within their normal level-scaled ranges. Displayed and actual affix values remain whole numbers. Base power uses the Legendary tier budget; signature powers are not included in the generic gear-power estimate.
- Unique chance equals the existing Legendary chance at every item-giving source. Legendary odds are preserved; the additional Unique share comes proportionally from Common/Magic/Rare/Epic. Loot quantities remain unchanged. A Unique result is always its authored equipment, never a charm.
- Enemy item rolls: Normal 0.05%, Veteran 0.15%, Elite 0.5% each for Unique and Legendary. These are per-item probabilities, before each rank's item quantity/first-kill rules.
- Regular dungeon final chest: 5% chance of at least one Unique; wilderness raid hoard: 10%. Legendary retains the same separate whole-chest chances.
- Expedition stage rewards: 5% per item; grand chest: 20% per item, equal to Legendary. Both rarities may occur in the same chest.
- Vendors and gambling do not generate Uniques. Existing item-giving events and side chests inherit their normal source tables; gold/resource-only containers remain unchanged.
- Blacksmith enhancement up to +10 is supported. Enchanting, rerolling affixes, rarity promotion and releveling are unavailable. Greater Affixes do not apply to Uniques.

`unique-content.ts` owns definitions, colors and signature constants. `items.ts` generates canonical recipes; save validation verifies the authored definition and derived values. Existing valid saves remain readable without a reset or a new payload version.

## Chronicles

The Uniques tab lists all twelve designs, including unfound items. All/Found/Unfound filters and search cover item names, skills and item types. Hover, focus or tap shows the signature power and fixed affix types. Discovered items also show first finder/date and highest level found; unfound art is dimmed.

Discovery occurs only on successful pickup, never when a drop is generated or rejected by a full inventory. Selling, dropping or later deleting the item does not erase discovery. Re-pickups preserve first discovery and do not inflate completion. Per-character source records merge through the existing Chronicle account/local ledgers; no separate cloud schema or save migration is required. Existing characters start with all twelve unfound.

## Local inspection and verification

- `/character.html?uniques`: twelve level-25 items in a disposable inventory; hover for signature powers.
- `/loot.html?uniques`: all twelve grounded with shared runtime labels and art.
- `/chronicle.html?uniques`: three found / nine unfound, using the runtime collection panel.
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
