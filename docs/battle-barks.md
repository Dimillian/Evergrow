# Humanoid battle barks — design proposal

2026-09-07. Proposed content and presentation, awaiting visual selection. No runtime behavior or saves changed. Text bubbles only; recorded voice is outside this proposal.

## Battlefield rules

- Roll once per humanoid when it first becomes aware of the player in an encounter: **15% chance**. Never roll per frame, attack, hit or alert propagation. A failed or suppressed attempt is consumed.
- At most **three bubbles on screen**, including fading bubbles. At most one per speaker. Use one shared limit across ambient enemies, camps and dungeon actors, including bosses.
- Start no more than one bubble every **0.8 seconds** globally. Simultaneous candidates are randomly ordered independently of gameplay RNG; skip surplus candidates rather than queueing delayed speech. Three is a ceiling, not a target.
- Display for **2 seconds total**, including a 0.12-second fade in and 0.25-second fade out. No typewriter effect, bounce, sound, screen shake or pauses. Freeze lifetime with gameplay pause; reduced motion has no translation animation.
- A speaker must be alive, visibly on screen, unobscured and actively engaged. An offscreen initial engagement does not leave a bark waiting for the camera. Remove speech immediately on death, loss of visibility, encounter end or location change. Menus hide speech.
- One attempt per encounter; rearm only after **30 continuous seconds disengaged**, with a **45-second minimum between attempts** for the same actor. Brief home-return, zooming and camera movement must not manufacture new opportunities. Persist nothing to character saves.
- Draw after world post-processing at native display resolution. Use the shared font stack after `loadGameFont()`: Pixelify Sans lettering, Evergrow Numerals/Barlow for numeric glyphs. Default text 16 CSS px, up to two lines, maximum 220 CSS px outer width. Short lines shrink to content; never shrink text to fit.
- Anchor the short tail 8–12 CSS px above the interpolated head/crown, accounting for antlers and helmets. Text size stays independent of world zoom. Tail and body stay together; no detached edge-clamped speech.
- Try a small bounded set of placements above the head. Reserve HUD, player silhouette, attack tells, damage numbers, enemy heads/weapons, loot labels and other bubble rectangles. If no safe placement fits, skip. Recheck moving placements; suppress instead of stacking or wandering far from the speaker. A partly offscreen bubble is suppressed.
- Select uniformly from the speaker's 20 lines, excluding that archetype's last three emitted lines. Separate presentation RNG from AI, loot, coins and combat; speech cannot change damage, decisions, seeds or saves.

Initial tuning deliberately favors quiet battles. Before spacing/visibility suppression, a group of four humanoids has a 48% chance of any bark and a group of six has a 62% chance. There are no mid-fight repeat barks in this first proposal. User playtesting should determine whether the encounter chance needs lowering further.

## Cast and voice direction

Seven humanoids are grounded in `EnemyKind`, `ENEMY_DEFINITIONS`, the actual bestiary and death-study live models. Briar Hounds and Lantern Wisps do not speak. The Warden is included even though it appears in the crypt rather than ordinary wilderness packs.

| Enemy | Model identity | Planned tone and writing style | Example |
| --- | --- | --- | --- |
| Scrap Goblin | Small green scavenger, wide ears, patched leather, little blade | Breathless greed and undeserved confidence; short exclamations, prizes before tactics | Your boots! My size! |
| Goblin War Chief | Larger goblin, trophy banner, war horn | Pompous little commander; barked orders, credit-taking, terrible leadership | Charge! I'll supervise! |
| Hollow Stalker | Split skull, torn burial shroud, hooked limbs | Sparse, rasped graveyard whispers; unsettling pursuit with dry undead complaints | I smell a pulse. Rude. |
| Gravebound Brute | Broad ossuary armor and grave hammer | Blunt, literal threats; few words, ponderous confidence, hammer-based problem solving | Hold still. Heavy hammer. |
| Mire Hexer | Antlered cowl, ceremonial stole, reliquary staff | Fussy swamp occultist; theatrical curses and petty inconveniences | May your socks stay wet! |
| Ashen Ranger | Hood, thorn mantle, bow and quiver | Cool professional sarcasm; precise threats, impatience with moving targets | Run. I enjoy the practice. |
| The Hollow Warden | Towering crowned tomb sentinel, ribbed plate, great axe | Formal, sepulchral authority; trespass decrees and restrained caretaker humor | Visiting hours are over. |

Humor comes from their role in the world. Avoid modern memes, fourth-wall jokes, slurs, extended gore or long dialogue. Keep one shared selected bubble treatment for readability; the words carry personality rather than seven unrelated UI skins.

## Scrap Goblin — 20 lines

1. Die! Leave the boots!
2. Your boots! My size!
3. I will gut you!
4. Shiny sword. Mine now!
5. Stop moving, pockets!
6. I'll bite your kneecaps!
7. Big pockets. Bad odds.
8. Fear me! A little!
9. That's my stabbing face!
10. You drop good things?
11. Chief said no witnesses!
12. Nobody step on my loot!
13. Your purse looks heavy!
14. I dibs the shiny bits!
15. Come back, walking loot!
16. This knife was a spoon!
17. You look easy. Probably!
18. I'll sell your hat!
19. Small goblin! Big plans!
20. Pay the goblin tax!

## Goblin War Chief — 20 lines

1. Charge! I'll supervise!
2. Leave the shiny bits!
3. Surround! Not each other!
4. My horn means trouble!
5. Kneel! I'm taller then!
6. I get first pick!
7. Form a scary shape!
8. Stop counting! Attack!
9. Get them! Keep my banner!
10. I planned this ambush!
11. No fleeing before me!
12. Less squealing! More steel!
13. Behold my best minions!
14. Nobody steal my victory!
15. Your skull gets a flag!
16. Forward, expendables!
17. That's an order! I think!
18. I'll gut you personally!
19. Bring me their fancy hat!
20. Chief gets the big half!

## Hollow Stalker — 20 lines

1. I smell a pulse. Rude.
2. Your shadow told me.
3. Still breathing? Greedy.
4. A fresh grave walks.
5. Let me borrow your warmth.
6. Don't look behind you.
7. The dirt misses you.
8. I was having a nice rot.
9. Hush. Your bones rattle.
10. Such noisy lungs.
11. Your pulse gives you away.
12. I'll keep your shadow.
13. You smell unfinished.
14. Your grave is ready.
15. All paths end below.
16. I know a quiet place.
17. I've been dying to meet you.
18. These claws need work.
19. Keep running. I don't tire.
20. So much fuss over dying.

## Gravebound Brute — 20 lines

1. Hold still. Heavy hammer.
2. You. Ground. Now.
3. I'll bury you standing.
4. Hammer says no.
5. Too tall. I'll fix it.
6. One swing. Less talking.
7. Armor makes nice noise.
8. I brought the big answer.
9. Small grave. You'll fit.
10. Bones break. Mine know.
11. Stop dodging my point.
12. You woke the wrong grave.
13. I flatten problems.
14. Dirt needs feeding.
15. Shield won't help much.
16. I'll knock twice.
17. This hammer digs too.
18. Quiet comes after smash.
19. I hate quick ones.
20. Lie down. Save time.

## Mire Hexer — 20 lines

1. May your socks stay wet!
2. A curse upon your knees!
3. You'll make excellent mulch.
4. Hold still, ingredient!
5. I've hexed nicer people.
6. The bog wants a word.
7. Your aura smells cheap.
8. I'll curdle your courage!
9. Mind the curse. It's fresh.
10. Your doom needs stirring.
11. May every boot leak!
12. I curse you with elbows!
13. Oh, good. Fresh mistakes.
14. Don't bleed in my herbs.
15. Your bones are overdue.
16. A pinch of you will do.
17. I'll sour your luck!
18. Kneel before the mildew!
19. You're interrupting a hex.
20. May your soup grow teeth!

## Ashen Ranger — 20 lines

1. Run. I enjoy the practice.
2. I only need one opening.
3. Keep the hat. Helps me aim.
4. You're in my good range.
5. That tree won't save you.
6. One arrow. No applause.
7. Try a less obvious dodge.
8. I'll pin that thought.
9. Your armor has gaps.
10. Stand proud. It's easier.
11. Wind's right. You're wrong.
12. I've shot smaller egos.
13. No charge for the arrow.
14. You rustle like a cart.
15. I'll need that arrow back.
16. Your next step is mine.
17. The thorns warned you.
18. Nice cloak. Hold it still.
19. Another walking target.
20. Stay there. Briefly.

## The Hollow Warden — 20 lines

1. Visiting hours are over.
2. None disturb my vigil.
3. Your grave awaits below.
4. Kneel before the stillness.
5. The dead require silence.
6. You tread on borrowed time.
7. I have kept worse things out.
8. This tomb has no vacancies.
9. Leave your breath at the door.
10. Even kings wait outside.
11. Your epitaph will be brief.
12. I shall file you under dust.
13. No loitering among the dead.
14. My patience outlived empires.
15. I did not invite the living.
16. Trespass ends here.
17. The stones know your weight.
18. You are early for burial.
19. Do not scuff the tombstones.
20. Your final audience begins.

## Four visual directions

The [mockup gallery](concepts/battle-barks/README.md) contains four independent generated images using captured runtime models as references. They are design concepts, not exact runtime captures or production assets. All four use the same three lines and enemy types to compare treatments. The authoring header/footer is outside the battlefield and would not ship.

1. **Ashglass:** charcoal fill, muted silver outline, small rounded corners and short tail. Closest to the existing Astral materials; recommended starting point for low obstruction.
2. **Bonepaper:** bone-ivory paper, charcoal text, clipped corners and folded tail. Strongest contrast and clearest storybook humor, but visually louder.
3. **Ironbite:** compact angular dark plaque, restrained ochre edge and sharp tail. More aggressive silhouette; avoid excessive spikes or a damage-number appearance.
4. **Mistwhisper:** small smoky oval bubble, soft edge and tapered tail. Lightest framing; test contrast over bright climates before selection.

## Implementation handoff after selection

Keep the library and policy immutable and separate from presentation. Feed awareness transitions to a bounded presentation controller without importing presentation into enemy AI. One renderer pass owns admission, screen collisions and the three-bubble cap. Resolve whether each transition is eligible at that time; never infer encounters from repeated visibility checks. Track only live actors plus bounded cooldown history; clear on reset/location changes and discard stale actors.

Required headless checks when implemented: all seven speakers have exactly 20 unique nonempty lines; nonhumanoids excluded; one roll per encounter; seeded injected presentation randomness does not consume simulation RNG; suppression never queues; fades count toward three; global spacing; cooldown/rearm rules; death/offscreen/menu/teleport cleanup; pause behavior; bounded placement rejection. Type checking and production build remain appropriate. Gameplay testing stays with the user; no automated browser gameplay is authorized by this proposal.
