# Physical versus caster balance — 13 September 2026

Audit of current local rules, including the new non-spell mana reductions. These costs are not yet published. No additional gameplay tuning was performed for this audit.

## Verdict

There is no universal spell-damage advantage. Casters have a smoother midgame resource economy and stronger ranged skill options. Bow builds are the clearest weak spot at levels 25–50 in these fixtures. Melee already delivers high damage when it stays in range, and high-level physical builds can overtake casters. A blanket physical buff or spell nerf would miss those differences.

## Matched build results

Median single-target DPS over 30 seconds, across twelve paired gear seeds at each level, all Epic with no enhancements, charms or Uniques:

| Build | Level 25 | Level 50 | Level 100 |
| --- | ---: | ---: | ---: |
| Greatblade / Crescent Cleave | 1,603 | 6,004 | 31,998 |
| Shortbow / Ricochet | 898 | 3,638 | 20,548 |
| Longbow / Ricochet | 999 | 3,948 | 22,669 |
| Staff / Arc Lightning | 1,438 | 4,711 | 17,090 |
| Wand + grimoire / Arc Lightning | 1,366 | 4,588 | 16,640 |
| Wand + orb / Arc Lightning | 1,381 | 4,866 | 17,682 |

At level 50, staff Arc Lightning beats shortbow Ricochet by 29% and longbow Ricochet by 19%. At level 100, the ordering reverses: those bows exceed the staff by 20% and 33%. This is a build/skill comparison, not a universal ranking of weapon families.

Against seven stationary targets at level 50, corresponding median DPS is 47,629 for Cleave, 8,805 for shortbow Ricochet, 13,134 for longbow Ricochet and 16,154 for staff Arc Lightning. The melee fan puts every enemy within reach and removes incoming pressure, so it deliberately exaggerates ideal melee uptime. It is not dungeon clear-speed evidence.

Rare gear produces the same broad midgame ordering. At level 50: Cleave 4,691, shortbow 2,520, longbow 2,837, staff 3,853. Legendary best-in-slot and combinations of Unique powers were not optimized or ranked.

## Attributes and sustain

- Strength and Intelligence each contribute 1.5 percentage points of their damage channel per point above ten. Both add to gear/tree damage bonuses; spells do not receive that multiplier twice.
- Intelligence also grants two maximum mana per point. Strength has no equivalent secondary resource benefit. Neither grants regeneration or cost reduction.
- Dexterity grants 0.25 percentage points of attack speed and 0.075 points of critical chance. Crit helps both channels, but its attack speed benefits physical weapons only. Cast speed comes from items/tree. This gives physical builds a useful late scaling route.
- Strength/Intelligence item rolls taper with level. Dexterity rolls currently use linear item-level growth; percentage speed/crit affixes taper. That inconsistency is a late-game balance risk, even though final speed/crit caps still apply.
- Both channels share critical caps, direct-hit life recovery, skill-rank damage growth and mana-cost reduction. Physical basics are free; caster basics cost mana.

At level 50 with Epic gear, the shortbow sample has median **189 mana / 2.7 regeneration per second**, compared with staff **643 / 5.4** and wand/grimoire **690 / 7.5**. Median Ricochet casts over 30 seconds are 30 versus 45 Arc Lightning casts for the staff and 72 for the grimoire fixture; different weapon cadences also contribute. Physical builds spend more of the test using free basics. At high levels those basics become very strong, so a lower skill-cast count does not necessarily mean lower total DPS.

The cheaper physical costs help, but they do not by themselves make skill-heavy archers as comfortable to sustain as casters.

## Items and charms

- The attack-damage affix budget is `4 + 0.35 × tapered level`; spell damage is `5 + 0.45 × tapered level`. Both receive the same weapon-slot potency multiplier. Thus equivalent spell rolls are about 25–29% larger before rounding.
- An Epic weapon with a midpoint roll gives attack/spell bonuses of **22% / 28% at level 25**, **26% / 33% at level 50**, and **29% / 37% at level 100**. These are individual affix values, not final DPS gains, because they add to the existing damage pool.
- Cloth combines spell damage, Intelligence, mana, recovery and efficiency. Leather combines attack damage, Dexterity, critical chance/damage and life on hit. This explains both the caster sustain advantage and physical late critical growth.
- Wands can add offensive or sustaining foci; bows reserve both hands and have no quiver slot. This is an option gap, but not proof that wand builds always outperform two-handed weapons: the matched staff often wins anyway.
- Attack/cast-speed affixes have matching budgets. Charm damage-affix weights are equal, as are attack/cast-speed weights. Intelligence has weight 0.5 versus Strength 0.3 on charms, and spell-damage charms inherit the larger spell-affix budget. Shared mana/regen/efficiency charms can help physical builds, at a cost to other charm choices.
- Skill-rank affix family weights, rank thresholds and purchased-rank formulas are shared. No channel-specific extra rank multiplier was found. Uniques change particular skills and should remain an additional layer, not a requirement that rescues a weak base skill.

## Whole-tree review

The current tree has 1,824 nodes. Direct attack-damage bonuses appear on 315 nodes versus 205 for spell damage; attack speed appears on 115 versus 63 for cast speed. These are catalog counts, not bonuses one build can afford. Physical skills cover more weapon families, so counts alone cannot establish fairness.

Dedicated damage minors/endpoints are symmetric at 8% / 24%. Doctrine damage differs slightly (28% physical / 30% spell), and route placement matters more than that two-point difference. Ricochet requires eight points from the root versus three for Arc Lightning; Volley and Fireball both require two. An early chain-shot archer spends five additional points reaching its skill. The matched heuristic includes the actual route costs and spends the same total level-earned points.

## Active skill checks

All 30 base skills were run through the existing atlas probes. The additional audit ran all four versions of each of the 23 damaging skills: 92 Original/Technique combinations, against single and fan targets using actual combat.

- Piercing Shot has 160% base damage and a 3.5-second cooldown; Frost Lance has 165%, a 1.8-second cooldown and a slow. Both pierce three additional targets. Cheaper physical mana does not compensate for every part of that comparison.
- Volley deals 80% per arrow. At rank three, one arrow is only 88% of a basic shot before other skill-specific bonuses. Its value depends on multiple contacts; Fireball provides stronger direct damage, an explosion and burning. Volley should not be expected to win a single-target test, but it needs enough pack payoff for its cost and aim demands.
- In isolated level-50 Common-weapon probes, the strongest single-target Volley Technique reaches 1,451 DPS versus 2,043 for Original Fireball. These use different weapons and finite pools; they isolate a problem to investigate, not an exact multiplier to apply.
- Ghost Hunt offers three 60% echoes across a 24-second base cooldown. Cataclysm has seven 280% meteor impacts plus burning ground. Those are very different role/payoff budgets. Bow burst and ultimate identity deserve a dedicated pass.
- Movement skills intentionally sacrifice stationary attacking uptime. Low stationary Vaulting Shot/Sidestep DPS is not proof those skills are useless; the harness does not value evasion or repositioning.
- Current enemy incoming-damage handling does not add physical armor mitigation versus player hits, so this discrepancy is not caused by enemies secretly resisting bows more. Melee contact can stagger interruptible enemies; elemental hits also have non-stacking burn/chill/interrupt utility.

## Recommended next slice

1. **Tune bows individually.** Start with Piercing Shot's cooldown/payoff, Volley pack coverage, and Ghost Hunt's burst value. Check shortbows and longbows separately. Keep normal full damage on every valid hit; do not restore repeated-hit damage penalties.
2. **Make damage affix budgets explicitly comparable.** Equalize attack/spell roll budgets, then repeat the same measurements. Prefer a small controlled gear-budget adjustment over a global physical multiplier, given strong melee and late bows.
3. **Offer targeted physical sustain.** Improve accessible mana-on-kill/efficiency choices near bow and melee paths or suitable equipment. Avoid forcing Intelligence investment for a physical build, but retain a real sustain-versus-damage choice.
4. **Normalize late attribute-roll growth.** Review Dexterity's linear item growth alongside tapered Strength/Intelligence before raising physical scaling further. Evaluate maximum levels and cap saturation separately.
5. **Validate under pressure.** Follow with player testing of spread-out enemies, movement, bosses and actual skill rotations. The current synthetic results cannot certify survivability or final endgame parity.

No additional live balance values were changed by this audit. The earlier mana reduction and Unique marker remain local changes.

## Reproduction and limits

Run `node --experimental-strip-types game/scripts/physical-caster-audit.ts /tmp/physical-caster-audit.json` from the repository root. [Frozen results](audits/physical-caster-2026-09-13/results.json) include all sample rows, variant results, tree counts and assumptions.

576 build samples: four levels (10/25/50/100), six setups, two rarities, twelve paired seeds. Each runs single/fan 30-second probes. Armor identities are intentionally physical leather versus caster linen; gear is random within those pools, not curated best-in-slot. Tree spending uses the disclosed existing atlas heuristic, not exhaustive optimization. No charms, enhancements, Uniques, potions, kills, pickups, AI pressure or saved characters. Both melee and ranged receive targets within their own reach. Dummies have one billion life and an exhaustion assertion to prevent high-level kills from contaminating results. Additional resource and atlas probes supplied the cross-checks described above.
