# Ashglass battle barks — visual verification

2026-09-07. Scope: implement the user's selected overhead bubble component inside the existing procedural game. No new raster assets, page redesign, deployment or gameplay automation.

## Visual truth and evidence

- Source: `docs/concepts/battle-barks/01-ashglass.png`, the first displayed image selected by the user; 1536 × 1024 generated concept.
- Implementation: `docs/captures/2026-09-07/battle-barks/ashglass.jpg`, captured from the Codex in-app browser at `/bestiary.html?barks=1`.
- Browser viewport: 1293 × 1272 CSS pixels; devicePixelRatio 1.5. Screenshot API supplies a CSS-size viewport image. The review canvases themselves use native density.
- State: three stationary actual procedural models (Scrap Goblin, Gravebound Brute, Mire Hexer), opaque middle-of-lifetime Ashglass bubbles. No simulation ticks, saved characters or gameplay interaction.
- Full-view evidence: source and implementation were opened together in one image-view tool call. The existing bestiary cards deliberately replace the generated forest staging; the selected component, not the generated terrain or review header, is the implementation target.
- Focused evidence: the three bubbles were legible at their original pixel scale in the paired views. Compared the rounded outline, tail joint, head gap, text placement and model/weapon clearance. No enlargement or resampling was needed to inspect those features.

## Fidelity checks

| Surface | Result |
| --- | --- |
| Typography | Bundled Pixelify Sans with Evergrow Numerals first; 16 logical UI px, sentence case, natural glyph metrics, 19 px line spacing. No raster text or world-zoom scaling. Exact three sample lines retained. Hexer's longer line wraps to two lines under the measured 220 px maximum; accepted constraint from the approved proposal. |
| Spacing and shape | Content-sized widths, 12 px horizontal/9 px vertical padding, 7 px corners, short joined 8 px tail with a 10 px head gap. Runtime placements can shift locally or suppress, never detach/clamp the tail. |
| Color and materials | Charcoal `#202a2bee`, muted silver `#8e9890` at 1 px, ivory `#eeeede`. The continuous outline and restrained translucent material match the selected direction. No ornamental icons, glows or heavy shadows. |
| Assets | Actual source-code enemy renderer preserves the existing goblin/hammer/antler silhouettes. Generated reference model differences are intentionally not copied over the game's authoritative geometry. No new bitmap runtime assets. |
| Copy | Correctly spelled sample remarks, all seven voice pools populated with 20 unique lines. Review labels and instructions remain outside gameplay. |

## Findings and corrections

- Resolved P2: the initial brute bubble used conservative aim bounds and floated too high. Added authored speech-head bounds, kept collision/aim bounds unchanged, and recaptured. The final image shows a short clear head attachment.
- Resolved P2 in the review staging: the brute hammer extended beyond the canvas floor. Raised frozen study figures by 24 px; the final capture includes the full weapon. Runtime drawing was unaffected.
- No remaining actionable P0/P1/P2 visual findings in this static component review.

## Behavior and limits

15 dedicated code tests cover probability, encounter edges, all seven speakers, spacing/cap including fade-out, no deferred queue, cooldowns, recent-line exclusion, measured placement, wall/roof/foliage and UI exclusions, pause/reset/death/camera cleanup, zoom independence and identical simulation checkpoints with different bark RNG streams. Full `npm run check`: 747 tests passed, application and headless compilation passed, production build passed. Existing nonblocking bundle-size advisory remains.

The preview reached its ready state and the in-app browser reported no warning/error logs. Combat frequency, moving crowds and readability during actual play remain user-tested, as required by AGENTS.md. This review does not claim automated gameplay validation or pixel identity with an ImageGen forest scene.

final result: passed
