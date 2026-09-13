# Effect explanations and status presentation audit

Local source audit, implemented September 13, 2026. The findings and proposed presentations below record the audit that guided this pass; they are not release notes. All audit groups are now implemented, including lower-priority summoned/maintained indicators. No playable saves or gameplay were inspected.

Implementation: retained equipment/stat/collection tooltips; shared glossary; concise eighteen-Unique and ninety-Technique summaries; resolved effect disclosures; corrected Living Stone and keystones; missing player budgets; shared target icons with Red Harvest, per-element Exposure and applied-duration fills. Heartwood charge and ordinary cooldowns remain on their action buttons. No balance, allocation or save changes.

Static reviews and code checks are documented in [Development tools](development-tools.md); shared interaction ownership is in [UI kit](ui-kit.md).

## Spellweave acquisition

Shortest paths from **Origin alone**, measured with `buildSkillRoutes` against the current graph:

| Source | Points | Ordinary Spellweave bonus | Constraint |
| --- | ---: | ---: | --- |
| Alternation | 12 | +28% | Casting Doctrine: mutually exclusive with Incantation and Impulse |
| Borrowed Flame | 17 | None | Independently enables priming; empowered actions ×1.4, all weapon/spell damage ×0.85 |
| Spellweave | 20 | +20% | Independent passive endpoint |
| Dancing Embers | 31 | +20% | Independent hybrid endpoint |
| Resonant Steel | 34 | +22% | Independent hybrid endpoint |

Any ordinary bonus enables the exchange, including equipment. There is no prerequisite relationship between Alternation and the standalone Spellweave endpoint. Both together provide +48%; all ordinary contributions share the 100% cap. Borrowed Flame's separate multiplier does not use that cap. Route costs shown in a player's inspector are **remaining** points and can be lower because of existing allocations.

## Presentation rule

A card should answer **what it does, how strong it is, and when it ends**. Use underlined terms for exceptions and interactions. A timed effect gets an expiry readout; an aura gets reservation/active state; a charging effect gets progress; a skill's cooldown stays on its action button. The target's debuffs belong on the target plate. Permanent stats and instantaneous rewards need explanation, not another status icon.

Example primary lines:

- Afterguard: “+24% armor after blocking · 3s.”
- Runic Ward: “Absorbs 42 damage · 2.8s.”
- Patient Bastion: “Next basic melee attack: +86 damage · 5.2s.”
- Stored Fireballs: “2 stored · next expires in 8.4s.”
- Red Harvest: “Next Backstab counts as a rear strike · 4s.”

Numbers above illustrate formatting, except where they match authored rules. Actual displays must use the current combat projection.

## Already covered, or being connected

The player projection covers Spellweave, Afterguard, Runic Ward, Brace, Rally of Iron, Ghost Hunt, temporary shelters and active shield guard. It exposes ward capacity, duration and available charges. The concurrent aura integration adds persistent aura icons with reserved mana, Blood Oath stacks and Stillwater focus progress.

The atlas and player buff cards use the new nested explanations. Enemy statuses still have their separate Canvas presentation. Existing item comparison cards and character-stat tooltips also retain their older interaction owners: they must adopt hover retention before receiving interactive underlined terms.

## Highest-value equipment follow-ups

| Equipment | Proposed presentation | Concise first explanation / deeper term |
| --- | --- | --- |
| Cinderheart Testament | Stored-fireball icon, count 1–3, **earliest** remaining expiry | “Store up to 3 Fireballs for 20s. Your next basic attack releases them.” Deeper: each cast keeps its own expiry; mana is paid when stored. |
| The Patient Bastion | Six-second empowerment icon with accumulated extra damage | “Blocked damage empowers your next basic melee attack.” Deeper: 200% weapon-damage cap, full-speed guard movement, once per basic attack. |
| Vessel of Borrowed Life | Four-second barrier icon with current absorption | “Unused Siphon healing becomes a barrier.” Deeper: 20% maximum-life cap shared with Runic Ward; cannot trigger The Broken Seal. |
| Duelist's Return | Return-ready icon during the actual two-second return window; retain the hotbar's Return label | “Reactivate Lunge within 2s to return for free.” Deeper: no damage, no cooldown reset, terrain still matters. |
| Red Harvest | Four-second **target** mark | “Rear Backstab marks the target. Your next Backstab counts as a rear strike.” Deeper: consuming the mark cannot refresh it. |
| The Broken Seal | Extend the existing ward's explanation with accumulated rupture damage | “When damage breaks your ward, it explodes.” Deeper: absorbed-damage scaling and cap; natural expiry does not explode. Avoid a duplicate ward badge. |
| Pale Huntsman's Signet | Extend Ghost Hunt's existing duration/echo-count card | “Your spectral archer fires Ghost Hunt's echoes.” Deeper: firing position, finite charges, shared echo restrictions. |
| Ashen Double | Optional summon-duration indicator, lower priority than offensive readiness | “Leave a fragile double for 2s.” Deeper: ordinary enemies only; committed attacks, elites and bosses are not redirected. |
| Stormglass Reliquary | Optional three-second conductor marker; primarily a world-anchor explanation | “Arc Lightning starts at a conductor placed at your aim.” Deeper: terrain/reach and no autonomous attacks. |
| Heartwood Draw | Keep the existing charge progress on Piercing Shot | “Hold 0.6s for double damage and 30% more reach.” Deeper: quick releases retain normal damage and mana cost. A second buff icon would repeat existing feedback. |

The remaining eight Uniques mainly change action/projectile behavior and are best served by concise text and nested terms:

- **Dervish's Grasp:** “Hold Whirlwind to spin at full movement speed.” Explain per-revolution mana and damage through the action's details.
- **Returning Verdict / Homeward Thorn:** lead with the returning shield/arrows; explain outbound/return hits and pierce under **Return flight**.
- **Winter's Reach:** “Cast Ice Nova at your aim.” Put range, terrain and Echoing Frost interaction behind **Targeted nova**.
- **Gravetide:** “Earthshatter sends a traveling fissure.” Explain terrain stopping it and one contact per enemy behind **Fissure**.
- **Rimeheart Spire:** “Frost Lance shatters after 0.6s.” Explain damage/slow and retained piercing behind **Shatter**. Keep the fuse attached to its world impact.
- **Briarfall Mantle:** “Rain of Arrows advances along your aim.” Explain travel and terrain in a secondary card.
- **Thread of Pursuit:** “Unused rebounds can strike previous targets again.” Explain loop time and the repeated-contact life-on-hit exclusion behind **Rebound**.

## Affixes and normal equipment

| Mechanic | Primary wording / nested detail | Status icon? |
| --- | --- | --- |
| Afterguard | “+X% armor after blocking · 3s.” Details: shield required, refreshes, armor applies to physical damage. | Already present |
| Spellweave | “+X% Spellweave damage.” Details: enables the melee/magic exchange, action consumption, equipment fit. | Already present |
| Kindling / Rime / Stormbound | “Adds X fire/frost/lightning damage to this weapon.” Link Burn / Slow / Interrupt and weapon-local ownership. | Affected enemy's status, not a permanent player badge |
| Expanse | “+X% area.” Details: area converts to radius through a square root; +20% area is about +9.5% radius. It does not extend projectile travel. | No |
| Piercing | “Pierces X extra targets.” Details: explosive projectiles still detonate on contact; distinguish Pierce from Rebound. | No |
| Wellsip | “Restore X mana on kill.” | No; immediate recovery |
| Deep Draught | “+X% potion recovery.” Details: affects the shared potion's life and mana restoration. | Keep charge/cooldown on Q |
| Skill-rank affixes | “+N Fireball ranks.” Secondary: skill must already be learned; gear ranks improve potency without raising casting costs. | No |
| Life on hit | “Restore X life per direct hit.” Secondary: periodic damage does not trigger it; chains/repeated contacts have specific exclusions. | No |
| Armor / resistance / block | Short current-value rows with linked damage types and mitigation order. | Only a temporary effect changing them |
| Attack / cast speed | State which attacks use the stat. Explain that staff/wand basics use cast speed. | No |

## Nodes and active skills

**Living Stone repeats the original Spellweave problem.** Its six small nodes grant only armor, but each inherits text claiming that blocking primes stronger armor. Only the endpoint grants Afterguard (+24%). Minor-node text should describe the actual reward; endpoint text should say that it enables Afterguard.

**Borrowed Flame:** shorten the primary text to “Spellweave actions deal 40% more damage. All damage is 15% lower.” Link Spellweave and More damage for its separate multiplier, ordinary cap, independent enabling and net effect. Keep the 15% downside visible, never buried in a child tooltip.

**Open Hand:** show current loadout eligibility prominently. Primary: “One melee weapon, empty offhand: +20% damage, +8% movement. Otherwise: −10% damage.” This is persistent conditional state, so prefer the build/skill details over adding a timed icon.

**Measured Force:** “Cannot crit. Critical chance becomes direct damage, up to 30%.” Explain the exact conversion and periodic-damage exclusion in a secondary card. No timer.

**Arcane Overload:** “Arcana damage +30%; mana cost +60%.” A persistent active icon is useful because it is a toggle with a meaningful ongoing cost. Secondary detail should clarify utility skills and Tempest upkeep. It is not a timed buff.

**Doctrines:** always keep “Choose one” visible. Hovering Doctrine can explain mutual exclusion and switching. Bonus-source nodes should say “Enables” for their mechanic; avoid implying the whole neighborhood grants its endpoint's mechanic.

**Runic Ward / Brace / Rally / Ghost Hunt / shelters:** keep current duration, absorption or charges in the already-added cards. Reuse Ward, Damage reduction and Echo explanations. Ghost Hunt's existing paragraph is a strong candidate for a short primary promise with echo inheritance and exclusions moved into the secondary card.

**Tempest:** an active-duration/upkeep card would make its maintained storm more legible. Its cooldown remains on the skill button. The existing `skillSustain` projection already exposes storm lifetime and upkeep.

**Techniques:** use one effect line and one cost/tradeoff line; secondary terms cover Pierce, Rebound, Echo, Burn, Slow and similar shared rules. Resolve all displayed potency/costs from the current selected rank and Technique. Ordinary attacks, one-shot novas and traveling projectiles do not need temporary player status badges.

## Enemy debuffs

Bring Burn, Slow, Frozen, Stunned and Stagger into the same readable icon/time/explanation pattern on the target plate. Then add **Red Harvest** and per-element **Exposure** from Elemental Resonance. Preserve target ownership and the actual remaining timers; do not show the player's unrelated marks globally.

The current slow projection labels every `slowTime` effect **Chill**, including non-frost slows. Thornbound makes this ambiguity more obvious. Use **Slowed** unless the combat data explicitly identifies a frost source. Avoid promising frozen/stunned behavior for an ordinary movement slow.

The initial elapsed-fill duration must come from the applied effect, especially for rank/Technique-modified statuses. Remaining time alone is insufficient to draw a truthful draining fill. Expired/dead targets and consumed marks must clear immediately.

## Audit implementation sequence (completed)

1. Fix Living Stone's misleading minor-node copy; give item/stat tooltip surfaces the same retained-hover behavior as the atlas.
2. Add shared definitions for Ward, Afterguard, Echo, Pierce, Rebound, direct hit and elemental statuses; trim the largest skill/Unique paragraphs.
3. Add stored fireballs, Patient Bastion, Borrowed Life and Return readiness to the player strip, merging details into existing ward/echo cards where appropriate.
4. Unify target status presentation and add Red Harvest / Exposure; distinguish generic Slow from frost.
5. Add the lower-priority maintained/summoned states and persistent Overload indicator after checking HUD density.

Sources: `active-buffs.ts`, `affix-combat.ts`, `unique-content.ts`, `unique-combat.ts`, `equipment-affix-content.ts`, `elemental-weapon.ts`, `skill-tree-content.ts`, `skill-tree.ts`, `skill-tree-routes.ts`, `skill-content.ts`, `skill-progression.ts`, `player-skill-effects.ts`, `skill-sustain.ts`, `aura-content.ts`, `auras.ts`, `enemy-debuffs.ts`, `item-tooltip.ts`, `character-stat-details.ts`.

## Verification of this local implementation

The 1,385-test headless suite passed all effect/content checks. Nine cloud-cadence failures in the concurrent run were worker timeouts; the unchanged 38-test cloud-cadence group passed in isolation. The final 29 focused effect/focus/execution checks, both TypeScript configurations, production build and whitespace checks passed. Static in-app inspection verified equipment → Spellweave → empowered-action cards, retained parent focus, target-icon placement and deepest-first Escape. Gameplay, saves and deployment were not exercised.
