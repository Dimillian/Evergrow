# Stats, affixes and progression audit

September 9, 2026 · Local source audit and headless formula checks. No gameplay automation or deployment.

## Verdict

The core system fits together: attributes, passive nodes, equipped gear and eligible charms converge on one character derivation, and combat consumes that projection. I found no broadly disconnected affix family or duplicate application of physical/spell damage. Four concrete issues were fixed below.

The scaling is numerically bounded and internally consistent, but **it is not a finished long-term balance model**. Builds gain relative power against ordinary enemies as gear, attributes and passives compound. Dexterity eventually exhausts its two capped benefits. A full charm grid is a substantial additional source of power. These are tuning concerns rather than evidence that the bonuses are being ignored.

## Fixed in this audit

| Issue | Result |
| --- | --- |
| Worn starter clothes kept their special zero-base-stat flag through improvements. Enhancement/releveling could charge gold without improving their base protection. | A successful improvement converts the piece to its normal functional recipe. Starting clothes remain unchanged until improved. |
| Spirit damage was classified as physical in Chronicle. | Spirit uses the shared Arcane mapping for damage accounting and hybrid-hit tracking. Actual damage dealt is unchanged. |
| Tempest's continuing mana payments were missing from mana-spent statistics. | Each successful upkeep payment is counted; cancelled pulses spend and record nothing. |
| XP from a kill could activate a higher-level charm before that same kill's gold was calculated. | Kill gold uses the pre-award bonus, consistent with XP and mana-on-kill. Newly eligible charms affect subsequent kills. |

Also clarified detailed-stat explanations: attribute sources include charms; burns cannot crit, while direct Rain/Tempest pulses can; area bonuses affect skill sweeps rather than basic weapon reach; Stonebound protects against physical damage.

No save reset, item reroll on load or schema change. Historical Chronicle misclassification cannot be reconstructed from stored aggregate totals; corrected accounting applies to future actions.

## What level-ups and nodes actually do

Each level awards **five attribute points and one skill point**. Leveling does not automatically distribute attributes, heal life or refill mana. The same refresh activates newly eligible charms and updates the sheet's same-level armor estimate.

| Added attribute point | Effect |
| --- | --- |
| Strength | +2 percentage points physical attack damage, including bows |
| Dexterity | +0.5 percentage points attack speed; +0.15 percentage points critical chance |
| Intelligence | +3 percentage points spell/elemental damage; +4 maximum mana |
| Vitality | +6 maximum life |

Allocated attributes and attribute bonuses on gear, charms and nodes use these same conversions. Percentage bonuses add within their category; +20% physical damage from a node and +20% from gear make +40%, not two separate ×1.2 multipliers. Weapon damage, the resulting damage multiplier, skill potency and critical damage then multiply at their respective stages.

Passive nodes contribute once even if an ID is duplicated. Skill unlocks, purchased ranks and specializations are resolved separately. Equipment skill ranks require an already unlocked, compatible skill, add potency up to the shared +10 bonus-rank cap, and do not charge the mana cost of a higher purchased rank.

## Affix generation and scaling

Equipment has 0/1/2/3/4 explicit rolls from Common through Legendary. Tier power is ×1/1.09/1.20/1.34/1.50; individual roll quality ranges from ×0.85 to ×1.15. Enhancement adds 5% per step, through +10. Materials improve base stats; construction and jewelry identity also bias the available affixes. Material quality does not multiply every explicit affix.

Generation, enchanting, rarity upgrades and releveling share the same pools, exclusions and recipe reconstruction. Tested all gear profiles/materials and all 36 charm profiles at every rarity across levels 1, 12, 30, 60, 100, 300, 1,000 and 1,000,000. Gear was also rebuilt at maximum enhancement. Values stayed finite, valid and nondecreasing for the same recipe. This checks correctness, not whether every roll is desirable.

For `n = level − 1`:

- Weapon/base armor growth: `1 + 0.13n`.
- Flat affix growth uses `n`.
- Percentage affix growth uses `25n / (25 + n)`, approaching 25 rather than growing forever.
- Ordinary monster health: `(1 + 0.13n) × (1 + 0.055n)` times its archetype base.
- Ordinary monster damage: `1.2 × (1 + 0.11n)` times its archetype base.

Flat Strength/Intelligence rolls still become percentage damage through attribute conversion. They therefore continue increasing offensive multipliers even after explicit percentage-affix growth tapers. That is why flat and percentage rolls are not interchangeable late in progression.

Slots retain their specialties: boots have stronger movement, gloves stronger attack/cast speed, chest stronger life/armor, and foci sustain or amplify casting. Duplicate stats and conflicting families are excluded: one resistance choice, one elemental enchantment, one named skill-rank roll, and either attack speed or cast speed per piece. Charms use their own utility pool and size potency, without equipment-slot potency multipliers.

## Applied in combat and rewards

| System | Verified behavior |
| --- | --- |
| Weapon attacks | Physical melee/arrows use physical damage and attack speed. Staff/wand bolts use spell damage once and cast speed. Each dual-wield action uses its own weapon. |
| Elemental melee | The enchantment belongs to that weapon. Intelligence scales its elemental portion; Strength scales the physical portion. It does not leak into the other hand or a separate spell. |
| Skills | Shared resolution supplies rank potency, mana cost, cooldown, area and specializations. Critical/life-on-hit bonuses travel with released attacks and delayed effects. |
| Critical hits and recovery | Direct hits can crit and restore life on hit. Burns cannot. Siphon heals from actual life removed, not overkill. Mana on kill restores once per committed death. |
| Defenses | Physical hits use armor relative to the attacker's snapshotted level. Elemental hits use matching resistance. Block applies afterward; damage retains a one-point minimum. |
| Utility | Movement changes actual movement; regeneration ticks in simulation; potion bonuses affect both resources; cost/cooldown bonuses reach the shared action formulas. |
| Specialist affixes | Area, pierce, Spellweave, Afterguard and named skill ranks have runtime consumers and regression coverage. Their weapon/skill conditions matter. |
| Rewards | Gold/XP bonuses apply once when rewards are created or committed. Picking up gold does not multiply it again, and trading is not gold-found income. Equipment drop RNG remains independent. |

An inactive contextual bonus is not necessarily broken: block needs a shield, a skill rank needs that skill unlocked, area does not increase basic attack reach, and explosive projectiles detonate rather than using extra pierce.

Burn damage contributes to total, fire and burn metrics, but its originating skill is not retained through the shared non-stacking burn status. Per-skill Chronicle totals therefore describe attributed hits, not complete damage including subsequent burns. The character power summary is likewise an estimate, not a simulation of resistances, active skills or every encounter.

## Numeric progression comparison

Reproduce with `node --experimental-strip-types game/scripts/stats-audit.ts`.

The study equips same-seed Rare items at each level, uses normal level-dependent material selection, spends three points in the build's main attribute and two in Vitality per level, and selects connected passive routes within its domain. It excludes charms, enhancement, active skills, mana downtime, movement, misses and burn damage. It is deliberately a controlled formula comparison, **not a measured time-to-kill playtest or optimized build ranking**.

The table shows expected basic-attack DPS divided by same-level ordinary Stalker health: higher means more theoretical damage relative to the target's life.

| Level | Strength melee | Dexterity bow | Intelligence caster |
| --- | ---: | ---: | ---: |
| 1 | 1.23 | 1.04 | 1.08 |
| 12 | 1.78 | 1.18 | 2.03 |
| 30 | 2.50 | 1.69 | 3.03 |
| 60 | 3.20 | 3.11 | 3.99 |
| 100 | 4.10 | 4.85 | 5.14 |

Ordinary enemies become relatively easier for these advancing builds. That supports a power fantasy, but harder ranks, encounter composition and regional travel need to supply the challenge. The table alone is insufficient justification for a universal monster-health increase.

Armor behaves more steadily: this study's same-level physical mitigation moves from roughly 29–32% at level 1 to 35–39% at level 100. Better gear matters because armor requirements rise with enemy level.

## Balance concerns and recommended next pass

1. **Dexterity has a finite useful range.** Critical chance caps at 75%; total attack speed at ×6. With no other bonuses, the critical cap requires 500 extra Dexterity and the speed cap 1,000. Gear/nodes reach them earlier. The study's bow reaches critical cap by level 100 and speed cap by 300. Beyond both caps, another Dexterity point does nothing. Keep the caps, but make capped investment obvious and establish a long-term attribute plan before treating hundreds of levels as finished content.

2. **Small high-rarity charms favor affix density.** Legendary Pebbles have five rolls on one cell; Monoliths have eight across eight cells. A simple `roll count × size potency ÷ cells` budget is 1.40 for Pebbles versus 1.20 for Monoliths, while Common values are 0.28 versus 0.60. This is a rarity-driven reversal, not strict dominance: larger stones give stronger individual rolls, while small stones spread power across more affixes. Normalize budgets by cells and rarity in the next charm tuning pass if that tradeoff does not feel satisfying.

3. **A full charm grid is a major power source.** A deliberately generous sample of 48 random level-30 Legendary Pebbles supplies +100% gold (capped), about +40% XP, 38–75% elemental resistance and substantial life/mana without other improved equipment. This is not a realistic level-30 drop timeline, but it demonstrates why acquisition rate and total active-grid budget matter. Test mixed, realistically acquired grids before raising enemy damage around this ceiling.

4. **Flat defensive nodes and sustain need longer-term tuning.** Fixed +8 life or +6 armor nodes become small beside later gear. Conversely, flat mana regeneration continues growing while many action costs are largely rank-based, so resource pressure can fall sharply. Review their marginal value around levels 12, 30, 60 and 100 rather than multiplying every node by character level.

5. **Caps should remain explicit.** Current key limits are 75% resistance, 80% armor reduction, 75% critical chance, ×5 critical damage, +75% movement, 75% cost/cooldown reduction, +100% gold and +50% XP. Bulwark and ultimate cooldown floors still apply. Reaching a cap is useful; further rolls into it give no additional effective stat. Numeric support through level 1,000,000 is a technical bound, not evidence of balanced infinite progression.

No global balance curves, charm budgets or attribute identities were silently retuned in this audit. The fixes correct identifiable behavior; the measurements give us a reproducible basis for the next balance pass.

## Verification

- Full headless suite: **1,100 tests passed** after the runtime fixes.
- Expanded audit: **seven tests passed**, including the subsequently added complete gear/material scaling sweep.
- TypeScript application and headless-core checks, plus production build: passed.
- Local deterministic formula study completed; no browser gameplay or player saves were used.

Primary owners: `character-stats.ts`, `character.ts`, `items.ts`, `item-improvement.ts`, `charm-content.ts`, `skill-tree.ts`, `skill-progression.ts`, `equipment.ts`, `combat-damage.ts`, `combat-rewards.ts`, `ground-effects.ts` and `progression-content.ts`. Regression coverage lives in `game/tests/stats-audit.test.ts` alongside the existing resistance, charm, affix and skill suites.
