# Passive rewards — 13 September 2026

Local tuning for the more connected atlas. These values are not a verified Site release. The twenty-rank skill curve remains +5% of base damage and +1.5% of base mana per purchased rank after the unlock. This pass changes authored passive rewards in `skill-tree-content.ts`; geography, route rewards and allocation rules are owned by the accompanying atlas rebuild.

## Why the previous rewards felt small

Damage percentages from equipment, attributes and ordinary passives add to the same multiplier. At an existing +200% damage bonus, a +4% node changes damage from 3.00× to 3.04×: only **1.33% more final damage**. Dedicated skill ranks multiply this shared result, so a rank could offer several times the benefit for a heavily used action.

A critical-damage node had a second problem: it did nothing before the character acquired critical chance. Starting critical chance is zero; Dexterity and gear or passives must supply it. Adding critical chance beside critical damage makes those purchases function independently while retaining their synergy with an established critical build. Attacks and direct spell hits continue to share critical chance and multiplier; burns still cannot crit.

## New reward budgets

| Investment | Previous | Current |
| --- | --- | --- |
| Dedicated weapon/spell damage minor | +4% | +8% |
| Dedicated weapon/spell damage endpoint | +12% | +24% |
| Hybrid weapon damage minor | +2–3% | Usually +5–6%, with some mixed attribute/damage alternatives |
| Attack/cast speed minor | +1–2% | Usually +3%; Sparkstep pairs +2% casting with mana |
| Quick Steel / Live Wire endpoint | +7% speed | +11% speed |
| Dedicated movement minor / endpoint | +1% / +4% | +2% / +6% |
| Critical-damage-focused minor | +3–4% critical damage alone | +8% critical damage and +0.75–1% chance |
| Knife Edge endpoint | +12% critical damage, +2% chance | +28% critical damage, +4% chance |
| Casting Doctrine → Incantation / Impact Doctrine → Weight | +18% spell / +16% weapon damage | +30% spell / +28% weapon damage |

Doctrine speed and precision choices also grow: +12% attack/cast speed, or +5% critical chance with +24% critical damage. Movement Doctrine → Stride provides +8% movement.

Area endpoints now commonly provide +16–22% area, with wider mixed rewards on Furnace Mouth, Molten Reach and Wide Arc. Area continues to convert through a square root into radius; +20% area does not mean +20% radius. Hybrid endpoints pair offense with their existing sustain, resistance, mana or Spellweave role. Selected attribute nodes gain larger node-local rewards, including direct damage; the 1.5% Strength/Intelligence conversion remains unchanged for assigned points and equipment.

## Equal-point marginal comparison

These calculations compare **three purchased minor rewards and one endpoint against four purchased skill ranks**, after already reaching the cluster. They isolate the reward budget; they do not claim every actual cluster has this access shape or exclude travel from the complete build's point cost. Atlas route tests separately verify connectivity and active unlock costs; these reward comparisons do not establish equal power for complete builds.

| Four-point investment | Previous final gain | Current final gain |
| --- | ---: | ---: |
| Dedicated broad damage, existing +200% damage bonus | +8.00% | +16.00% |
| Dedicated broad damage, existing +400% damage bonus | +4.80% | +9.60% |
| Knife Edge, no existing critical chance and 150% critical damage | +1.48% expected direct-hit damage | +7.14% |
| Knife Edge, 10% existing chance and 150% critical damage | +3.70% expected direct-hit damage | +11.75% |
| Knife Edge, 30% existing chance and 250% critical damage | +7.37% expected direct-hit damage | +20.51% |
| Light Foot, no existing movement bonus | +7.00% speed | +12.00% |
| Live Wire, no existing cast-speed bonus | +13.00% casting cadence | +20.00% |
| Skill ranks 1 → 5 | +20.00% damage to that skill | Unchanged |
| Skill ranks 10 → 14 | +13.79% damage to that skill | Unchanged |

At a 3× preexisting damage multiplier, the dedicated broad-damage purchase now sits between four early ranks and four later ranks. It improves basic attacks and every action in its damage channel, and adds no per-cast mana premium. Rank investment still offers concentrated growth and remains valuable for a main action, especially when an existing damage bonus is already large.

Critical investment becomes more attractive as the build develops chance and multiplier together. It is intentionally not equivalent to a guaranteed damage increase at every starting build. Measured Force still disables critical hits; critical-damage rewards are ineffective with that keystone. Speed improves recovery and handling but does not bypass skill cooldowns or mana sustainability. Movement is a positioning benefit; the table makes no claim about damage or survival gained from player movement.

## Bounds and verification

Existing resistance, block, life, recovery and mana-efficiency budgets are retained. No item affix, attribute conversion, purchased skill-rank value, enemy rule or global cap was changed by this content tuning. Critical chance remains capped at 75%, critical damage at 500%, and movement at 175% of base speed. Mana-cost reduction retains its taper toward 40%; area, pierce, cooldown and action-speed caps still apply. Making routes more accessible can bring a character to these caps earlier, so adding more sources does not grant unlimited stacking.

`game/tests/passive-balance.test.ts` checks equal-point broad-versus-focused rewards through shared character/skill calculations, useful critical-damage purchases from zero chance, established critical-build value, movement/casting gains and all relevant shared caps under repeated content investment. It does not automate gameplay or read character saves. Player feedback remains necessary for encounter difficulty, sustain and the feel of the rebuilt routes.

Reproduce the focused checks from the repository root:

```sh
node --experimental-strip-types --test game/tests/passive-balance.test.ts
```
