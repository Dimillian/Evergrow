# Unique batch two — implemented locally

2026-09-13 · approved and implemented; awaiting player combat/visual feedback.

The first batch changed attack geometry and introduced paid-cast storage. This batch adds positioning, control and defensive build choices alongside two new offensive patterns. Retain fixed affixes, level-at-drop scaling, equal total Unique/Legendary probabilities and the existing collection presentation. Adding designs divides the existing Unique pool, rather than increasing total Unique frequency.

| Item | Slot | Skill | Signature |
| --- | --- | --- | --- |
| Ashen Double | Cloak | Smoke Veil | Leave a fragile smoke double at the cast position that briefly draws nearby ordinary enemies' attacks. The normal slow and personal protection still apply. |
| Duelist’s Return | Boots | Lunge | After lunging, reactivate within two seconds to dash back toward the original position. The return is movement only; the initial strike retains all its damage. |
| Gravetide | Two-handed mace | Earthshatter | Replace the player-centered impact with a moving fissure along the aim direction, carrying the normal damage and stun through a line of enemies. |
| Pale Huntsman’s Signet | Ring | Ghost Hunt | Leave a stationary spectral archer where Ghost Hunt was cast. It fires the skill's finite echoes from that position while you reposition. |
| Rimeheart Spire | Wand | Frost Lance | Each lance lodges at its terminal enemy/terrain contact and shatters after a short delay, damaging a small area. Normal piercing contacts remain intact. |
| Vessel of Borrowed Life | Amulet | Soul Siphon | Convert healing that would exceed full life into a temporary, finite barrier. Turn a healing spell into preparation for the next dangerous engagement. |

## Implemented behavior

- **Ashen Double:** one decoy at a time, two seconds and 20% maximum-life health. The decoy is a real attack target with collision/contact handling, not an invulnerability buff. Veterans, elites and bosses keep their committed targets; ordinary foes only redirect uncommitted attacks through normal sight/range rules. Smoke radius and personal protection still follow the selected Technique. Recasting replaces the decoy.
- **Duelist’s Return:** normal initial cooldown begins immediately and is never reset by returning. Return consumes no extra mana, deals no damage and adds no invulnerability. Recast after the initial dash ends; terrain can shorten/block the return. Technique distance uses the actual starting point; death, travel or unequip clears the return opportunity.
- **Gravetide:** roughly 350 base travel, with a readable moving ground seam. Each enemy takes the normal selected-Technique damage and stun once as the fissure crosses them. It is one traveling hit, not a stack of overlapping explosions. Width inherits area/Technique radius; solid terrain stops it. This enables midrange heavy-weapon play.
- **Pale Huntsman’s Signet:** preserve the existing Technique's echo count, lifetime, potency and piercing/rebound snapshot. Each echo aims from the archer toward the point aimed at when the triggering arrow action was committed. No autonomous firing, extra free charges, healing, status procs or recursive echoes. One stationary archer, cleared on expiration/unequip/death. The original Homeward Thorn volley still returns; spectral echoes retain their existing non-returning payload.
- **Rimeheart Spire:** values: a 0.6-second delay, 70-unit base radius, one explosion per lance at its terminal contact. The explosion uses that lance's normal resolved damage and slow; no re-hit penalty. All Glacial Trident lances can shatter. No explosion-on-explosion spawning; lifetime expiry in empty space does not create a shatter. Budget delayed explosions before charging mana and show a visible warning crystal. Tune mana/cooldown or authored explosion potency if the added burst is too strong.
- **Vessel of Borrowed Life:** only unused Soul Siphon healing, calculated from actual life removed, can contribute. Barrier: 20% maximum life, four seconds; refreshing cannot accumulate above that capacity. Piercing/Technique healing remains authoritative. The barrier shares a defensive capacity budget with Runic Ward; it must not multiply protection or trigger The Broken Seal. It does not turn life-on-hit, potion healing or passive regeneration into more barriers.

Each design has four fixed, level-scaled affixes in `unique-content.ts`, using the same roll position and item validation as batch one. All twelve designs share the existing Unique pool equally. No new mana regeneration is granted by these items.

Lunge's skill well shows RETURN and the remaining window, including on touch. Held RMB/controller input cannot accidentally consume the recast. The smoke double takes real melee/projectile damage; a swing or area impact can also hurt the player if both are in its footprint. A fissure processes every intersecting foe in a dense row once. Delayed Frost Lance crystals reserve ground-effect capacity before payment. Archer echoes retry temporary projectile-capacity failures without adding charges; expiry or unequip clears queued echoes.

All six powers retain Original and all three Techniques. Headless tests cover damage/contact semantics, range/terrain, source snapshots, finite healing/capacity, input, expiry, unequip, death and checkpoint restoration. The runtime skill playground exposes each item through its Unique selector; Lunge demonstrates the return and Ghost Hunt follows up with basic attacks. Use these disposable studies without changing playable saves.

This is a local checkpoint, not a Sites publication. Numerical balance, animation readability and touch/controller feel remain player playtest checks.
