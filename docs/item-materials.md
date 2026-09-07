# Equipment materials

Implemented for v0.3.3 · 2026-09-07.

Material is the item's base construction, separate from Common/Magic/Rare/Epic/Legendary affix rarity. A Common silver sword is possible: silver improves its base damage, but it still has zero affixes. Gold-colored metal does not imply Rare affix quality. Material is included in the base name; rarity retains its own UI badge and color.

## Drop pools

Each entry is **chance within that equipment pool / base-stat multiplier**. These are level-one normal-source weights. All materials can appear at any item level; harder source levels and encounters shift the weights as described below. Affix rarity tables and stat-growth curves remain unchanged.

| Equipment | Material choices |
| --- | --- |
| Every melee weapon | Iron 58% / 1×; steel 36% / 1.10×; silver 4.5% / 1.25×; gold 1.2% / 1.40×; crystal 0.3% / 1.55× |
| Head, chest, gloves, legs, boots | Linen 21% / 0.70×; silk 6% / 0.90×; velvet 2.5% / 1.05×; starweave 0.5% / 1.30×; leather 35% / 1×; iron 19% / 1.10×; steel 12% / 1.20×; silver 3.2% / 1.40×; gold 0.8% / 1.60× |
| Shields, rings, amulets | Iron 60% / 1×; steel 35% / 1.10×; silver 4% / 1.25×; gold 1% / 1.40× |
| Staves and wands | Ashwood 70% / 1×; runewood 24% / 1.10×; silver 4% / 1.25×; gold 1.5% / 1.40×; crystal 0.5% / 1.55× |
| Bows | Ashwood 80% / 1×; runewood 19% / 1.10×; crystal 1% / 1.35× |
| Grimoire bindings | Leather 70% / 1×; runewood 24% / 1.10×; silver 4% / 1.20×; gold 1.5% / 1.30×; crystal 0.5% / 1.40× |
| Orbs | Glass 65% / 1×; quartz 29% / 1.10×; astralite 5% / 1.25×; crystal 1% / 1.40× |
| Cloaks | Linen 100% / 1× |

Base multipliers affect weapon damage, armor, or the existing focus/jewelry implicit stats. Material base multipliers do **not** change attack/cast speed, reach, affix values/count, shield block chance/reduction, or elemental effects. Final values round once after level, affix rarity, material and enhancement factors. Small level-one armor values can round to the same integer.

Material rolls use a separately salted item seed. Enemy type and biome still choose kinds/profiles; rank still chooses affix rarity. Every source using `generateItem`, including enemy drops, POI rewards and newly generated vendor stock, receives the same material rules. Existing generated items are not rerolled. Starting loadouts explicitly use ordinary iron, leather, ashwood and cloth with their original authored stats.

## Services and persistence

`recipe.materialId` persists the construction through trades, buyback, enhancement, affix changes and releveling. An omitted override is an ordinary unmodified base; existing saved items remain usable without a reset. Shared item validation rejects unknown or incompatible materials and invalid render-surface IDs. No storage backend or autosave cadence changes.

Buy/sell prices include material value: silk 1.75×; velvet 2.5×; starweave 4×; steel 1.15×; runewood/quartz 1.2×; silver 2×; astralite 3×; gold 3.5×; crystal 6×; ordinary bases 1×. Services use `1 + (materialValue − 1) × 0.2`: silk 1.15×, velvet 1.3×, starweave 1.6×, silver 1.2×, gold 1.5× and crystal 2×. This smaller premium applies to all five improvement operations. Enhancement remains capped at +10; materials cannot be upgraded at a vendor. Better bases must be found or bought.

## Art and review

`item-materials.ts` owns weighted construction and base-stat rules. `gear-material-content.ts` owns shared roughness and metalness independently of palette colors. Iron is rougher, steel polished, silver bright and reflective, gold warm and metallic; wood/leather/cloth remain diffuse and glass/crystal use tight highlights. Caster elements still supply their own colored cores and lights.

`/equipment.html` lists **196 real profile/material combinations**, with equipment/material filters, item/equipped views, light controls, pool probability, base stats, area level and encounter difficulty controls. No gameplay or saves run in the gallery. The same geometry/material identities flow through icons, ground loot and equipped drawing.

## Armor identities and jewelry

Linen, silk, velvet and starweave cover cowl, robe, handwraps, leggings and slippers in the same five armor slots. Linen provides 70% of baseline armor, silk 90%, velvet 105%, and starweave 130%. Linen is matte olive cloth; silk has a violet-pearl sheen; velvet has a deep wine-colored diffuse finish; starweave is a blue luminous-looking weave with fine silver-colored embroidery. All remain nonmetallic fabrics, share the robe silhouette and favor Intelligence, mana, mana regeneration, spell damage and mana efficiency. Leather favors Dexterity, physical damage, critical chance/damage and life on hit. Both retain life and armor rolls. Favored ordinary affixes multiply their normal weights by 2.2; fallback rolls multiply by 0.75. Existing rarer-affix weights apply before that bias. These are relative weights, not guaranteed affixes.

Only gloves add their construction's attack speed (leather) or cast speed (cloth); only boots add movement speed. Cloth cowls can roll cooldown reduction. Skill ranks on leather headgear favor bow/dagger/blade skills; fabric headgear favors magic skills. Metal armor retains its existing slot pools. Amulets remain the existing exception to movement/speed slot restrictions. New drops, rarity upgrades and rerolls all use the same construction pool; existing affixes are retained until explicitly rerolled.

Eight equally weighted jewelry profiles have persistent identities. Each kind chooses one of four bases independently of material:

| Base | Level-one ordinary Common implicit |
| --- | --- |
| Garnet Band | +2% attack damage |
| Sapphire Ring | +2% spell damage |
| Moonstone Ring | +0.3 mana/sec |
| Jade Signet | +8 maximum life |
| Lion Pendant | +2 Strength |
| Hawk Talisman | +2 Dexterity |
| Sage Pendant | +2 Intelligence |
| Warden Amulet | +2 Vitality |

Each profile favors related affixes by the same 2.2/0.75 weighting, while keeping the slot's full pool available. Rings now also allow life, Vitality and life regeneration. Amulets still allow all general affixes. Implicits scale from the authored base, level, material, rarity and enhancement; profiles and material survive every service. Gems have profile-specific colors independent of affix rarity. Saved jewelry without a profile retains its original implicit recipe.

## Geographic and encounter material odds

`sourceMaterialPool` uses the original source level, never player level. Zone advantage is `1 + 2.5 × (1 − exp(−(level−1)/35))`. Veteran/elite sources multiply by 1.25/1.75. Goblin chiefs/boss sources multiply by 2.25; guarded dungeon chests by 1.5, final boss chests by 2.5, cleared camp/graveyard event rewards by 1.3. Multipliers combine and cap at 7.

Silver/gold/crystal/astralite/velvet/starweave weights multiply by that advantage. Steel/runewood/quartz/silk weights multiply by its square root. Ordinary weights remain unchanged, then the pool renormalizes to 100%. Every material remains possible. Material selection has its own RNG, so source bonuses cannot change item count, affix rarity or profile selection. Higher-level vendor stock benefits from geographic level but has no encounter bonus. Releveling an existing item never rerolls its material.

For example, precious melee bases total 6% in a level-one normal source, 10.74% in a level-25 normal source, and 19.01% in a level-25 boss-chest roll before any rank bonus. The final dungeon chest contains separate normal/veteran/elite rolls, each also receiving the chest advantage. The gallery's encounter selector shows a single source pool, not the chance that an entire chest contains at least one precious item.
