import type { EnemyKind } from './model.ts';

export type DeathVariant = 0 | 1 | 2 | 3;
export type DeathFamily = 'kneel' | 'back' | 'front' | 'sit' | 'chest' | 'roll' | 'haunch' | 'curl' | 'drop' | 'tumble' | 'spiral' | 'snuff';
export interface DeathAnimation {
  readonly title: string; readonly sequence: string; readonly family: DeathFamily;
  readonly contact: number; readonly settle: number; readonly travel: number;
  readonly twist: number; readonly delay: number;
}
type Four = readonly [DeathAnimation, DeathAnimation, DeathAnimation, DeathAnimation];
const a = (title: string, sequence: string, family: DeathFamily, contact: number, settle: number,
  travel: number, twist = 0, delay = 0): DeathAnimation => Object.freeze({ title, sequence, family, contact, settle, travel, twist, delay });
/** Exhaustive, immutable recipes. Durations are shared by drawing, sorting and review. */
export const ENEMY_DEATHS: Readonly<Record<EnemyKind, Four>> = Object.freeze({
  stalker: Object.freeze([
    a('Knees give way', 'Buckle → knees → shoulder', 'kneel', .58, .96, 5, .18),
    a('Backwards impact', 'Recoil → hips → back', 'back', .47, .85, 10, -.12),
    a('Forward crumple', 'Reach → elbows → chest', 'front', .5, .9, 12, .12),
    a('Seated slump', 'Hips drop → knees fold → head bows', 'sit', .48, 1.12, -3, .1, .12),
  ] as const),
  brute: Object.freeze([
    a('Heavy genuflection', 'One knee → club dips → shoulder lands', 'kneel', .8, 1.3, 4, -.25, .12),
    a('Backbreaker fall', 'Chest recoils → heels slide → back thuds', 'back', .63, 1.18, 8, .16, .08),
    a('Failed brace', 'Both fists reach → elbows buckle → chest drops', 'front', .72, 1.24, 6, -.1, .15),
    a('Dead weight', 'Hips sit → shoulders sag → club settles', 'sit', .66, 1.45, -4, -.18, .2),
  ] as const),
  caster: Object.freeze([
    a('Staff gives way', 'Staff braces → knees fold → hood drops', 'kneel', .69, 1.18, 3, .3, .13),
    a('Broken channel', 'Casting arm recoils → back lands → staff follows', 'back', .56, 1.06, 7, -.25, .14),
    a('Robe crumple', 'Reach → elbows fold → cloth settles', 'front', .6, 1.14, 8, .2, .17),
    a('Last supplication', 'Sink to knees → hands sag → hood bows', 'sit', .52, 1.3, -1, -.12, .23),
  ] as const),
  archer: Object.freeze([
    a('Broken stance', 'Bow lowers → one knee drops → shoulder lands', 'kneel', .56, 1.02, 6, -.28, .05),
    a('Reeling fall', 'Bow arm opens → heels slip → back lands', 'back', .48, .99, 11, .28, .08),
    a('Stumbling dive', 'Last step → free hand catches → chest drops', 'front', .47, .91, 15, -.16, .06),
    a('Bowman’s slump', 'Squat → sit → chin sinks to chest', 'sit', .45, 1.1, -5, .22, .15),
  ] as const),
  goblin: Object.freeze([
    a('Scrabbling collapse', 'Knees knock → hands scramble → side settles', 'kneel', .43, .78, 7, .4),
    a('Heel-over fall', 'Arms fling → feet slip → back bounces', 'back', .36, .73, 13, -.35),
    a('Face-first stumble', 'Lurch → hands miss → chest lands', 'front', .34, .72, 16, .32),
    a('Scrap heap', 'Bottom drops → knees tuck → ears droop', 'sit', .33, .89, -7, -.3, .08),
  ] as const),
  goblinChief: Object.freeze([
    a('Fallen standard', 'One knee → banner sways → shoulder lands', 'kneel', .72, 1.21, 5, .28, .12),
    a('Dethroned', 'Chest recoils → back lands → horn arm falls', 'back', .58, 1.14, 10, -.2, .1),
    a('Last command', 'Blade reaches → elbows buckle → banner drapes', 'front', .63, 1.19, 9, .25, .17),
    a('Hollow throne', 'Sit heavily → arms hang → crowned head bows', 'sit', .55, 1.38, -5, -.18, .24),
  ] as const),
  warden: Object.freeze([
    a('The sentinel kneels', 'Knees strike → axe lowers → shoulder settles', 'kneel', 1.04, 1.8, 2, -.15, .24),
    a('Falling monument', 'Long recoil → heels slide → armor lands', 'back', .94, 1.68, 7, .12, .2),
    a('Broken oath', 'Axe braces → arms yield → breastplate lands', 'front', 1.12, 1.9, 5, -.22, .28),
    a('Silent vigil', 'Sink to knees → axe rests → helm bows', 'sit', .87, 2.05, -2, .1, .4),
  ] as const),
  hound: Object.freeze([
    a('Forelegs buckle', 'Front knees fold → chest drops → jaw settles', 'chest', .38, .82, 6),
    a('Flank roll', 'Shoulder dips → ribcage rolls → paws fall', 'roll', .43, .94, 9, .2),
    a('Haunch collapse', 'Hind legs give → hips sit → head sinks', 'haunch', .45, .99, -4),
    a('Curl into the ground', 'Legs tuck → spine curves → muzzle rests', 'curl', .5, 1.05, 1, -.35),
  ] as const),
  wisp: Object.freeze([
    a('Lantern extinguished', 'Flame shrinks → cage drops → base settles', 'drop', .56, .94, 1),
    a('Iron tumble', 'Cage tilts → corner lands → frame rocks', 'tumble', .59, 1.16, 9),
    a('Unwinding spirit', 'Flame unwinds → cage spirals down → settles', 'spiral', .78, 1.32, 5),
    a('Core escapes', 'Flame lifts free → shell sinks → light fades', 'snuff', .66, 1.2, -2),
  ] as const),
});

export const DEATH_KINDS = Object.freeze(Object.keys(ENEMY_DEATHS) as EnemyKind[]);
export const DEATH_VARIANTS: readonly DeathVariant[] = Object.freeze([0, 1, 2, 3]);
export const enemyDeathAnimation = (kind: EnemyKind, variant: DeathVariant) => ENEMY_DEATHS[kind][variant];
