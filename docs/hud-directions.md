# Bottom HUD art directions

2026-09-05. These are visual propositions awaiting the user's choice. The playable HUD is unchanged.

Open the local [HUD directions](http://127.0.0.1:5173/hud-directions.html) in the in-app browser. The page uses three procedural Canvas chassis, the existing game font/skill icons/resource glass, and one frozen world backdrop. It never advances gameplay or accesses saves. Ready/under-pressure examples and detail/game-size views keep the comparison consistent. Each study can be saved as a PNG.

| Direction | Identity | Material and silhouette | Tradeoff |
| --- | --- | --- | --- |
| The Reliquary | A gothic heirloom | Stone arcade, aged brass, pointed tracery, heraldic detail | Strong classical ARPG character; the most architectural ornament |
| Thornbound | A living relic of the wilderness | Carved rootwood, antler shoulders, bronze bindings, jade patina | The strongest Evergrowing identity; organic detail must stay controlled at small sizes |
| The Astral Instrument | An occult measuring instrument | Calibrated silver rings, blackened steel, celestial engraving, suspended plates | The clearest and most precise direction; colder and more ceremonial |

Recommendation: Thornbound, with selective metal highlights and clear resource windows. Its rootwork can become a recognizable motif for item frames and inventory equipment slots while the shared UI kit continues to supply typography, spacing, buttons, and focus states.

All three studies have identical information placement. Their logical art field is 520×156; the game-size preview uses 0.82× (about 426px wide) on sufficiently wide screens. This is a proposed footprint, slightly wider than the current 388px HUD. The detail view enlarges ornament for inspection. No new gameplay controls, filter settings, or live theme selection are introduced.

After a choice: integrate the selected drawing with the runtime layout/hit-test geometry, verify narrow scaling, and carry its material vocabulary into the existing kit. The review fixtures are not a second gameplay implementation.
