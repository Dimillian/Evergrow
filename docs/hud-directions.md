# Bottom HUD art directions

2026-09-05. The user selected **The Astral Instrument**. Its procedural frame is now the live bottom HUD.

Open the local [HUD directions](http://127.0.0.1:5173/hud-directions.html) in the in-app browser. The page uses three procedural Canvas chassis, the existing game font/skill icons/resource glass, and one frozen world backdrop. It never advances gameplay or accesses saves. Ready/under-pressure examples and detail/game-size views keep the comparison consistent. Each study can be saved as a PNG.

| Direction | Identity | Material and silhouette | Tradeoff |
| --- | --- | --- | --- |
| The Reliquary | A gothic heirloom | Stone arcade, aged brass, pointed tracery, heraldic detail | Strong classical ARPG character; the most architectural ornament |
| Thornbound | A living relic of the wilderness | Carved rootwood, antler shoulders, bronze bindings, jade patina | The strongest Evergrowing identity; organic detail must stay controlled at small sizes |
| The Astral Instrument | An occult measuring instrument | Calibrated silver rings, blackened steel, celestial engraving, suspended plates | The clearest and most precise direction; colder and more ceremonial |

Selected direction: The Astral Instrument. Calibrated silver rings, celestial engraving, and suspended black-steel action plates provide its identity. The shared UI kit now includes silver and steel tokens for carrying these materials into future inventory work.

All three studies have identical information placement. Their logical art field is 520×156; the game-size preview and live HUD use 0.82× (about 426 logical pixels wide) on sufficiently wide screens. The detail view enlarges ornament for inspection. No new gameplay controls, filter settings, or live theme selection are introduced.

`hud-frame.ts` owns the selected procedural metalwork. `hud-layout.ts` owns shared artwork/control coordinates and responsive pointer bounds. `hud.ts` connects those to existing resource glass, current player stats, ability cooldowns, charges, damage trails, and reduced motion. Text remains at native display resolution above the world shader. The concept route reuses the live Astral frame; the other drawings remain historical proposals.

The [live HUD state review](http://127.0.0.1:5173/hud.html) exports healthy, damaged, and depleted examples. Add `?size=narrow` for a 390px preview. Both routes are frozen presentation fixtures with no gameplay or save access.
