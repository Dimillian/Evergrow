# Character and equipment art

Local refinement pass, 2026-09-06. The angular, procedural illustration style remains the source of truth for equipped items, portraits, inventory and ground loot.

## Proportions and motion

`character-motion.ts` and `player-art.ts` give the figure a longer visible leg line, slimmer lower limbs and smaller gripping hands. The gait uses a grounded backstroke and a lifted, eased return, driven by the existing distance-based phase. This is a stance animation, not world-space foot locking. Breathing is restrained; the existing cape lag and torso anticipation remain continuous. Axes and maces have more shoulder commitment than daggers.

Bows rest upright beside the body and turn into the aiming pose while drawing. Their limbs flex with the same draw value that positions the string and support hand. Staves follow the user’s upright walking-staff reference: the shaft sits beside the lead shoulder, its base near the feet, with one palm midway up the wood and the free arm relaxed. The upper staff length is reduced to 82% of the profile art length; shapes, core light and the shared tip calculation use the same dimension. During casting, the staff turns toward the target and the free arm smoothly joins its support grip. Staves still reserve both equipment slots; the one-handed resting pose is presentation only. Staff depth follows character facing, keeping the shaft visible in front views. Swords use a raised guard: one-handed blades sit beside the lead shoulder with the free hand or shield guarding independently, while two-handed swords brace diagonally across the chest. Windup and recovery connect to that guard by the shorter rotation while preserving the active blade sweep exactly. One-handed sword palms sit 58% down the hilt toward the pommel; the articulated forearm follows that contact point in either hand. Weapon mounts remain separate from palm positions so the adjustment preserves blade placement, trails and portrait bounds. Sword depth follows the weapon mount rather than treating an upward blade as behind the body. Shields and dual wield continue through the common arm rig.

Attack speed, active windows, damage, movement and saves are unchanged by this art pass. The blade tip, ribbon and contact presentation still consume the shared motion functions. No hitstop or automatic combo was added.

## Shared materials and detail

`weapon-shapes.ts` owns all thirteen weapon silhouettes and three shield shapes. Axes and maces have more restrained head widths, and pommels are smaller. Elemental staves use tapered wood, metal collars and a dark cage around a smaller fire, frost or storm core. Their light and sparse moving motes are confined to the core.

`armor-shapes.ts` supplies both worn armor and matching helmet/cuirass icons. Leather has softer lit planes and stitched seams; metal retains sharper bevels. Fine rivets, engraving and wear marks are tagged as detail. `equipment-art.ts` includes those marks and broad pigment shading when the current Canvas scale reaches 2.4 physical pixels per local art unit. Smaller world silhouettes keep their clear color planes.

`item-art.ts` renders the same weapon and armor contours with local SVG pigment gradients. Small daggers occupy less of an inventory cell than long weapons. Leather accessories use the softer surface gradient. Icons at 96 pixels or larger include fine marks; normal 48-pixel cells emphasize silhouette and material. No external images, textures, fonts or rendering dependencies were added.

## Portrait framing

`character-framing.ts` combines conservative body/cloth bounds with actual weapon, grip, bow-limb and off-hand contours. `character-portrait.ts` fits that full envelope uniformly to either portrait aspect ratio. Neutral framing stays fixed while the character breathes, preventing size pumping. The same equipped player rig remains in the character hall and inventory portrait.

## Local review

Open [/atelier.html](http://127.0.0.1:5173/atelier.html). Select any weapon, leather or plate, eight facings, and shield/dual-wield options for one-handed weapons. Rest, walking and basic attack panels use the real procedural renderer and shared action phases. A presentation clock animates those poses without simulation ticks, gameplay input or save access. All three panels reserve their motion envelope and use one scale. The item gallery shows 48-pixel cells next to enlarged art; Save PNG exports the three current poses. Reduced motion follows the operating system.

The native art tests cover finite geometry and drawing-state restoration; arm-rig tests cover joint/grip continuity. Character-art tests cover walking-staff and upright bow resting poses, front-facing staff layering, portrait containment, stance continuity and SVG resource references. Gameplay feel and preferred proportions remain subject to player feedback.
