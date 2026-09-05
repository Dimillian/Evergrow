# Bottom HUD art directions

2026-09-05. The user selected **The Astral Instrument**. Its procedural frame is now the live bottom HUD.

Open the local [HUD directions](http://127.0.0.1:5173/hud-directions.html) in the in-app browser. The page uses three procedural Canvas chassis, the existing game font/skill icons/resource glass, and one frozen world backdrop. It never advances gameplay or accesses saves. Ready/under-pressure examples and detail/game-size views keep the comparison consistent. Each study can be saved as a PNG.

| Direction | Identity | Material and silhouette | Tradeoff |
| --- | --- | --- | --- |
| The Reliquary | A gothic heirloom | Stone arcade, aged brass, pointed tracery, heraldic detail | Strong classical ARPG character; the most architectural ornament |
| Thornbound | A living relic of the wilderness | Carved rootwood, antler shoulders, bronze bindings, jade patina | The strongest Evergrow identity; organic detail must stay controlled at small sizes |
| The Astral Instrument | An occult measuring instrument | Calibrated silver rings, blackened steel, celestial engraving, suspended plates | The clearest and most precise direction; colder and more ceremonial |

Selected direction: The Astral Instrument. Calibrated silver rings, celestial engraving, and suspended black-steel action plates provide its identity. The shared UI kit now includes silver and steel tokens for carrying these materials into future inventory work.

The original studies used identical information placement; the selected Astral preview now follows the live skill-bar arrangement. The original art field is 520×156; the live Astral HUD is now 520×174 to accommodate its XP rail; the game-size preview and live HUD use 0.82× (about 426 logical pixels wide) on sufficiently wide screens. The detail view enlarges ornament for inspection. No new gameplay controls, filter settings, or live theme selection are introduced.

`hud-frame.ts` owns the selected procedural metalwork. `hud-layout.ts` owns shared artwork/control coordinates and responsive pointer bounds. `hud.ts` connects those to existing resource glass, current player stats, ability cooldowns, charges, damage trails, and reduced motion. Text remains at native display resolution above the world shader. The concept route reuses the live Astral frame; the other drawings remain historical proposals.

The [live HUD state review](http://127.0.0.1:5173/hud.html) exports healthy, damaged, and depleted examples. Add `?size=narrow` for a 390px preview. Both routes are frozen presentation fixtures with no gameplay or save access.

The current Astral bar has six main wells: basic attack (LMB) plus five empty skills (RMB and 1–4). Separate Q potion and Space dodge shortcuts flank the menu rail, showing their charges and recovery state. The outer footprint and orbital frames remain unchanged. Unassigned wells contain no skill icon, resource cost, or cooldown, and their controls are inert.

A thin violet enamel rail sits below the six skills with engraved level and current/required XP readouts. `hud-experience.ts` draws it at native resolution and smooths increases within the current level; crossing a level starts a fresh fill and a brief pulse. Reduced motion snaps to the exact fill with no pulse. `progression.ts` supplies the same next-level requirement to the simulation and HUD.
