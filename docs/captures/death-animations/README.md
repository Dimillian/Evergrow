# Death animation comparisons

Captured from the local `/deaths.html` atlas on 2026-09-06 after the detail-preservation pass. Each card compares the live renderer (left) with one of four runtime death designs (right), at equal scale and brightness. The filmstrips show impact, fall, landing and rest. These JPEGs are review evidence only and are not game assets or production build inputs.

| Creature | Captured time | Facing | Image |
| --- | --- | --- | --- |
| Hollow Stalker | 0.335 s | South | [Comparison](stalker.jpg) |
| Gravebound Brute | 2.200 s | South | [Comparison](brute.jpg) |
| Mire Hexer | 2.200 s | South | [Comparison](caster.jpg) |
| Ashen Ranger | 2.200 s | South | [Comparison](archer.jpg) |
| Scrap Goblin | 2.200 s | South | [Comparison](goblin.jpg) |
| Goblin War Chief | 2.200 s | South | [Comparison](goblin-chief.jpg) |
| Hollow Warden | 2.200 s | South | [Comparison](warden.jpg) |
| Briar Hound | 0.220 s | Southeast | [Comparison](hound.jpg) |
| Lantern Wisp | 0.325 s | South | [Comparison](wisp.jpg) |

The repair review also compared each creature at 0.18 s and at rest (1.6 s; 2.2 s for the warden), and inspected Northwest views at 0.65 s. Front markings may be hidden by actual body orientation; eye and flame light intentionally fades. See [implementation notes](../../creature-death-animations.md) for ownership, limits and local playback controls.

Armed humanoid captures show weapons retained in designs 1 and 4 and released in designs 2 and 3. Release fixes were checked again in flight and at rest; the ranger's single-string correction was compared from South and Northwest.
