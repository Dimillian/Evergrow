# Regional monsters

Follow-up: wilderness groups now grow from 4–6 to 14–20 by encounter level, using two loose rings. Extra members repeat biome-compatible companion recipes and favor ordinary ranks. See [pack size bands](progression-and-loot.md#larger-wilderness-packs--local-2026-09-11); dungeon/camp/event rosters are unchanged. The four-to-six-member descriptions below record the original content checkpoint.

Local 2026-09-11 refinement: elite-led roaming groups replace their first two escort slots with a complementary screen/ranged attacker and a flanker, using only biome-eligible weighted choices. Group size and spawning frequency are unchanged. Elite regional basics and signatures retain their warning geometry but have 25% stronger source hits and 15% shorter recovery. Shared control protection also applies to signature attacks; see [combat power audit](combat-power-audit.md).

Implemented locally on 2026-09-07. Six regional archetypes expand the roster to eighteen enemy kinds: twelve ordinary roaming creatures, two goblins and four bosses. The save format and generation version are unchanged; existing characters encounter the new packs as they explore.

## Creatures and combat

| Creature | Main habitats | Basic action | Every third action | Base HP / damage / XP |
| --- | --- | --- | --- | --- |
| Thorn Reaver | Verdant Forest, Deadwood, Amberwood | Hooked claw sweep | Wider 70-radius sweep, 19 damage; 0.95-second windup | 76 / 12 / 32 |
| Mire Spitter | Mire; smaller woodland populations | Single visible green spit | Locked 60-radius burst, 19 damage; 1.25-second windup | 61 / 12 / 31 |
| Rime Revenant | Frostpine; some Highlands and Deadwood | Frost-cleaver strike | Locked 65-radius frost eruption, 25 damage; 1.25-second windup | 115 / 17 / 43 |
| Ember Acolyte | Emberfall, Sunscar | Single firebolt | Locked 76-radius flare, 23 damage; 1.4-second windup | 54 / 14 / 34 |
| Dune Scuttler | Sunscar, Steppe; some Amberwood, Emberfall and Highlands | Pincer strike | Committed rushing sting, 16 damage; 0.85-second windup | 43 / 9 / 25 |
| Storm Sentinel | Highlands; some Frostpine | Single lightning bolt | Five-bolt fan, 11 damage per bolt; 1.25-second windup | 82 / 15 / 39 |

Each creature commits two basics, then a signature action. The counter advances at windup, including interrupted attempts; it is bounded to three states. The chosen action retains its timing, aim lock and damage throughout windup, contact and recovery. Damage uses a ratio of the original source-level/rank damage; player level never changes it. Ground attacks allow at least 0.8 seconds after aim lock to escape. No added poison, burn or chill debuffs on the player are implied by these visual elements.

Ordinary bolts have no ground warnings. Signature ground strikes, the rushing sting and the sentinel's five firing lanes use the shared animated red warnings. Sight, sanctuary, home tethers, source-level armor and exactly-once contacts remain shared AI rules. Attacks do not home after release.

## Biome population

These are **leader selection percentages**, not a promise that every member has the same distribution. A selected leader supplies a mixed four-to-six-member pack; any follower excluded from the current biome is replaced through that biome's weighted pool.

| Biome | Regional leader weights | Remaining original creatures |
| --- | --- | --- |
| Steppe | Scuttler 30%, Reaver 5% | 65% |
| Sunscar | Scuttler 42%, Acolyte 18% | 40% |
| Deadwood | Reaver 32%, Spitter 8%, Revenant 6% | 54% |
| Verdant Forest | Reaver 40%, Spitter 8% | 52% |
| Mire | Spitter 45%, Reaver 10% | 45% |
| Frostpine | Revenant 45%, Sentinel 10% | 45% |
| Emberfall | Acolyte 45%, Scuttler 12% | 43% |
| Amberwood | Reaver 32%, Scuttler 12% | 56% |
| Highlands | Sentinel 40%, Revenant 12%, Scuttler 8% | 40% |

Reaver packs mix claws and hounds; spitters have melee screens; revenants hunt beside hounds and wisps; acolytes have brutes and scuttlers; scuttler packs are insect-heavy; sentinels travel with armored escorts. Existing camp, event, boss-retinue and dungeon blueprints are unchanged, preserving their persisted roster identities. Automatic births still require offscreen coverage and travel credit; this pass changes composition, not spawning frequency or density.

## Loot and materials

Normal, Veteran and Elite quantities/rarity odds are unchanged. New creatures use the same geographic level/rank rules. Reavers and scuttlers favor boots/gloves, revenants favor armor/shields, and the three magical creatures favor weapons/foci/cloaks. All twelve item kinds remain eligible. Biome weapon/material weighting still applies separately. XP and gold follow the existing reward owners.

## Procedural art and ownership

`regional-enemy-art.ts` draws facing-relative, depth-sorted anatomy: bark roots/antlers, a plated amphibian body, articulated scorpion legs/pincers/tail, broken frost armor, a charred robe/censer, and floating crystal shards. Independent joints fold during death; the same material facets remain visible in the settled remains. Caster bodies contribute bounded shared scene lights. Actual geometry bounds feed aiming, hovering and preview framing.

`combat-content.ts` owns immutable basic/signature recipes and the selected-action lookup. `enemy-ai.ts` consumes that lookup for windup, release and recovery; `enemy-warning-art.ts` consumes it for exact warning geometry. No presentation callback applies damage.

Review: [regional bestiary](http://127.0.0.1:5173/bestiary.html?regional) shows all six in frozen idle/attack poses. `/deaths.html` uses the shared death roster. No gameplay or saves are driven by the bestiary.

Code checks cover source-scaled attack cycling, aim locks and escape windows, sanctuary/wall rejection, one-time ground contacts, basic/special warnings, exact biome weights and art bounds across sixteen facings. Combat feel and device performance remain player checks.
