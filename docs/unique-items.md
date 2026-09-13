# Unique items

Local implementation · 2026-09-13 · first six items, awaiting gameplay feedback.

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

Skills must still be unlocked, assigned and supported by compatible equipment. Signature powers do not unlock skills or grant ranks. Existing Techniques, purchased ranks and equipment requirements remain authoritative. There is no repeated-hit damage penalty. Returning projectiles return to a static firing position, never home on the player or enemies; terrain can stop the return. Shield throwing does not remove the equipped shield's defensive stats.

Stored Fireballs snapshot damage, source level, status payload and offensive stats when paid for. A full storage rejects another cast before payment. Release waits for room for the entire group if projectile or ground-effect capacity is exhausted. Unequipping the item, losing Fireball/compatible gear, expiration, or death clears stored casts. Temporary combat effects are not saved across sessions/travel checkpoints. Keyboard/mouse and controller holding repeat Whirlwind; touch retains its normal tap-to-cast input.

## Generation, odds and improvements

- Every Unique drops at the player's level when its reward is generated (before kill XP is awarded for enemy drops). Its level is then fixed. Ordinary equipment remains tied to source level/rank. Claim-time dungeon/event reward generation uses the claiming player's level.
- All six designs have equal selection weight. There is no build-based bias, minimum level gate, duplicate protection or pity counter.
- Affix types and roll position are fixed at 0.75 within their normal level-scaled ranges. Displayed and actual affix values remain whole numbers. Base power uses the Legendary tier budget; signature powers are not included in the generic gear-power estimate.
- Unique chance equals the existing Legendary chance at every item-giving source. Legendary odds are preserved; the additional Unique share comes proportionally from Common/Magic/Rare/Epic. Loot quantities remain unchanged. A Unique result is always its authored equipment, never a charm.
- Enemy item rolls: Normal 0.05%, Veteran 0.15%, Elite 0.5% each for Unique and Legendary. These are per-item probabilities, before each rank's item quantity/first-kill rules.
- Regular dungeon final chest: 5% chance of at least one Unique; wilderness raid hoard: 10%. Legendary retains the same separate whole-chest chances.
- Expedition stage rewards: 5% per item; grand chest: 20% per item, equal to Legendary. Both rarities may occur in the same chest.
- Vendors and gambling do not generate Uniques. Existing item-giving events and side chests inherit their normal source tables; gold/resource-only containers remain unchanged.
- Blacksmith enhancement up to +10 is supported. Enchanting, rerolling affixes, rarity promotion and releveling are unavailable. Greater Affixes do not apply to Uniques.

`unique-content.ts` owns definitions, colors and signature constants. `items.ts` generates canonical recipes; save validation verifies the authored definition and derived values. Existing valid saves remain readable without a reset or a new payload version.

## Chronicles

The Uniques tab lists all six designs, including unfound items. All/Found/Unfound filters and search cover item names, skills and item types. Hover, focus or tap shows the signature power and fixed affix types. Discovered items also show first finder/date and highest level found; unfound art is dimmed.

Discovery occurs only on successful pickup, never when a drop is generated or rejected by a full inventory. Selling, dropping or later deleting the item does not erase discovery. Re-pickups preserve first discovery and do not inflate completion. Per-character source records merge through the existing Chronicle account/local ledgers; no separate cloud schema or save migration is required. Existing characters start with all six unfound.

## Local inspection and verification

- `/character.html?uniques`: six level-25 items in a disposable inventory; hover for signature powers.
- `/loot.html?uniques`: all six grounded with shared runtime labels and art.
- `/chronicle.html?uniques`: three found / three unfound, using the runtime collection panel.
- `/tools/skills.html?skill=whirlwind&unique=dervish-grasp&level=25`: the isolated skill study; select another skill/Unique to inspect each power and its Techniques. No playable saves are read or changed.

`game/tests/unique-items.test.ts` covers all recipes across levels 1–1,000,000, enhancement/forgery/save validation, odds and source-level separation, each signature with Original and all three Techniques, returning contacts/terrain, nova targeting/echo, paid Fireball capacity and basic release, ward damage/expiry, held Whirlwind/mana, and successful-pickup collection persistence. Gameplay balance and touch/controller feel remain player checks.
