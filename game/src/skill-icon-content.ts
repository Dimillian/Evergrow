import type { SkillId } from './character-types.ts';

/** A 64-unit relief, composed from silhouettes, inset facets and sparse engraving. */
export type SkillIconMaterial = 'steel' | 'gold' | 'fire' | 'ice' | 'jade' | 'violet' | 'rose' | 'dark';
export interface IconMaterial {
  readonly light: string; readonly face: string; readonly shade: string; readonly edge: string;
}
export const ICON_MATERIALS: Readonly<Record<SkillIconMaterial, IconMaterial>> = Object.freeze({
  steel: { light: '#f1f3e4', face: '#9bafb5', shade: '#314654', edge: '#cddde0' },
  gold: { light: '#fff0bb', face: '#dbb46b', shade: '#78502d', edge: '#ffe0a0' },
  fire: { light: '#ffe9a7', face: '#fa963d', shade: '#a33123', edge: '#ffbc65' },
  ice: { light: '#e9fcff', face: '#7dd9f5', shade: '#286a9b', edge: '#b3f4ff' },
  jade: { light: '#e0f4c5', face: '#9dca9f', shade: '#326867', edge: '#c1e5bb' },
  violet: { light: '#f1eaff', face: '#b4a0ee', shade: '#54428f', edge: '#dcd1ff' },
  rose: { light: '#ffe4e8', face: '#da96b8', shade: '#743b72', edge: '#f6bfd5' },
  dark: { light: '#9babbc', face: '#415869', shade: '#142431', edge: '#748995' },
});
export interface IconPart {
  readonly path: string;
  readonly material: SkillIconMaterial;
  readonly kind: 'body' | 'facet' | 'cut';
  readonly transform?: readonly [number, number, number, number, number, number];
  readonly opacity?: number;
  /** Engraving is absent below 40 CSS pixels. Silhouettes and facets always survive. */
  readonly detail?: boolean;
}
const body = (path: string, material: SkillIconMaterial = 'steel'): IconPart => ({ path, material, kind: 'body' });
const facet = (path: string, material: SkillIconMaterial): IconPart => ({ path, material, kind: 'facet' });
const cut = (path: string, material: SkillIconMaterial = 'steel'): IconPart => ({ path, material, kind: 'cut', detail: true });
function place(parts: readonly IconPart[], x: number, y: number, angle = 0, scale = 1, opacity = 1): IconPart[] {
  const a = angle * Math.PI / 180, c = Math.cos(a) * scale, s = Math.sin(a) * scale;
  return parts.map(p => ({ ...p, transform: [c, s, -s, c, x, y], opacity }));
}
function blade(material: SkillIconMaterial = 'steel'): IconPart[] {
  return [body('M-4 9V-15L0-25 4-15V9Z', material), facet('M0-23 3-14V8H0Z', 'dark'),
    body('M-10 8-8 5-3 7H3L8 5 10 8 7 11H-7Z', 'gold'),
    body('M-2 11H2V21H-2Z', 'dark'), body('M0 20 4 23 0 26-4 23Z', 'gold'), cut('M-2-12V5', material)];
}
function shield(material: SkillIconMaterial = 'steel'): IconPart[] {
  return [body('M0-24 18-17 16 6Q12 17 0 25-12 17-16 6L-18-17Z', material),
    body('M0-18 12-13 10 5Q7 13 0 18-7 13-10 5L-12-13Z', 'dark'),
    facet('M0-17 4-10 3 8 0 16-3 8-4-10Z', material), cut('M-14-12-12 4Q-9 12-3 17', material)];
}
function arrow(material: SkillIconMaterial = 'jade'): IconPart[] {
  return [body('M-2 20V-8H-7L0-24 7-8H2V20Z', material),
    facet('M0-22 5-10H0Z', 'steel'), body('M-2 12-7 7V16L-2 21ZM2 12 7 7V16L2 21Z', 'gold')];
}
function crystal(material: SkillIconMaterial = 'ice'): IconPart[] {
  return [body('M0-23 9-5 5 12 0 23-6 10-9-5Z', material),
    facet('M0-21 0 21-5 8-7-5Z', material), facet('M0-21 7-5 2 1Z', 'steel'),
    facet('M2 1 7-5 4 11 0 21Z', 'dark')];
}
function bow(material: SkillIconMaterial = 'gold'): IconPart[] {
  return [body('M-9-25Q26 0-9 25L-5 18Q15 0-5-18Z', material),
    body('M-8-22-5-22 2 0-5 22-8 22-1 0Z', 'steel'), body('M4-5H10V5H4Z', 'dark')];
}
function boot(): IconPart[] {
  return [body('M-10-22 8-20 5-4 9 4 21 10 24 16 20 20H-16L-18 12-11 3Z'),
    facet('M-7-17 3-16 0-4-6 4-12 9-9-1Z', 'steel'),
    body('M-17 13-8 10 7 12 21 14 20 18H-15Z', 'dark'), cut('M-8-13 2-12M-8-8 1-7M-5 5 5 7')];
}
const ring = (material: SkillIconMaterial, path = 'M32 5A27 27 0 1 1 5 32L10 34A22 22 0 1 0 32 10Z') => body(path, material);
const lightning = (material: SkillIconMaterial = 'violet') => body('M38 3 12 35 29 31 23 61 52 24 35 29Z', material);
const flame = (): IconPart[] => [
  body('M55 5C39 6 39 22 27 23L29 13C20 19 17 25 17 29L13 24C1 40 9 57 25 58 43 59 46 44 45 33L38 39C39 23 48 21 55 5Z', 'fire'),
  facet('M43 17C31 28 39 31 29 40L28 30C14 39 15 51 26 53 38 54 39 44 37 37L32 43C32 31 40 27 43 17Z', 'gold'),
  facet('M26 39C18 47 23 53 29 49L31 43 27 46Z', 'steel'), cut('M12 38C8 48 17 57 28 55', 'fire')];

const recipes: Record<SkillId, readonly IconPart[]> = {
  fireball: flame(),
  shieldBash: [...place(shield(), 25, 30, -14, .88), body('M47 13 61 31 48 48 51 35 43 32 51 28Z', 'gold')],
  bulwark: [body('M8 12 18 8V35L13 44 7 34ZM56 12 46 8V35L51 44 57 34Z', 'steel'), ...place(shield(), 32, 31),
    facet('M32 14 37 22 35 40 32 48 29 40 27 22Z', 'ice')],
  repulse: [body('M7 13Q-2 32 7 51L11 46Q4 32 11 18ZM57 13Q66 32 57 51L53 46Q60 32 53 18Z', 'gold'),
    ...place(shield('gold'), 32, 31, 0, .83), body('M27 29H37V34H27Z', 'steel')],
  ironCitadel: [body('M6 54V20L12 11 19 20 25 14 32 5 39 14 45 20 52 11 58 20V54Z', 'steel'),
    body('M13 48V26H23V48ZM41 48V26H51V48Z', 'dark'), ...place(shield('gold'), 32, 37, 0, .64),
    facet('M8 21 12 16 16 22V49H10ZM48 22 52 16 56 21 54 49H48Z', 'steel')],
  brace: [body('M8 49 12 17 23 12 26 22 20 42 29 48 26 55 15 54ZM56 49 52 17 41 12 38 22 44 42 35 48 38 55 49 54Z'),
    body('M18 9Q32 0 46 9L44 15Q32 9 20 15Z', 'gold'), facet('M13 23 18 20 17 40 12 47ZM46 20 51 23 52 47 47 40Z', 'steel'),
    body('M27 29 32 24 37 29 32 35Z', 'gold')],
  rallyOfIron: [body('M15 5H20V57H15Z'), body('M21 7H56L45 20 53 33H21Z', 'gold'),
    facet('M23 10H48L38 19 45 27H23Z', 'fire'), body('M9 55 18 48 27 55 25 59H11Z'),
    body('M31 16 37 12 40 17 34 23Z', 'steel')],
  cleave: [body('M19 6C52 0 65 27 48 49L44 45C57 23 42 10 19 6Z', 'gold'),
    body('M33 8C49 13 55 27 48 39L46 34C49 21 42 15 33 8Z', 'fire'), ...place(blade(), 27, 34, 40, .94)],
  lunge: [body('M3 22 26 18 22 23 3 26ZM4 33 19 29 15 35 4 37ZM13 48 21 41 21 46 12 52Z', 'jade'), ...place(blade(), 35, 31, 43, 1.08)],
  whirlwind: [ring('gold'), body('M7 12 8 30 23 21Z', 'gold'), body('M57 52 56 34 41 43Z', 'gold'), ...place(blade(), 32, 32, 38, .76)],
  earthshatter: [body('M4 54 18 46 27 55 34 40 41 51 59 45 48 60 33 55 22 62Z', 'fire'),
    ...place([body('M-3-4H3V26H-3Z', 'gold'), body('M-17-21H15L18-15 14-2H-17L-20-8Z'),
      facet('M-16-18H12L13-11H-17Z', 'steel'), facet('M11-18 15-14 11-5 7-5Z', 'dark')], 31, 28, 35, .93)],
  backstab: [body('M43 10C57 15 60 29 54 44L48 48 49 36C52 24 48 18 40 16Z', 'rose'),
    ...place(blade(), 28, 32, 36, .95), body('M49 43 60 43 49 56 40 44Z', 'rose')],
  nightReaping: [body('M32 6C6 10-1 41 23 58L22 50C6 36 16 15 32 6Z', 'violet'),
    ...place(blade('jade'), 23, 30, -29, .77), ...place(blade('steel'), 41, 30, 29, .77),
    body('M32 40 39 49 32 61 25 49Z', 'rose')],
  sidestep: [...place(boot(), 40, 31, 8, .86, .3), body('M3 21 16 17 14 22 3 25ZM3 32 13 28 11 34 2 37Z', 'jade'),
    ...place(boot(), 27, 33, 8, .9)],
  smokeVeil: [body('M12 47C-1 42 0 27 13 24 7 8 29 2 36 14 49 4 60 18 53 29 67 37 54 54 43 49Z', 'dark'),
    facet('M7 31C5 19 20 20 24 30 12 22 10 35 18 38 6 39 4 34 7 31ZM32 17C45 9 53 23 43 29 48 21 40 15 32 22Z', 'steel'),
    body('M18 38Q32 23 48 38L43 47 22 47Z', 'jade'), facet('M24 39 30 38 28 41ZM36 38 42 39 38 41Z', 'dark'),
    cut('M12 54Q32 48 53 54', 'steel')],
  volley: [...place(arrow(), 17, 32, -27, .78), ...place(arrow(), 47, 32, 27, .78), ...place(arrow('steel'), 32, 31, 0, 1.02)],
  piercingShot: [body('M8 14 14 17 43 50 39 54ZM24 7 28 7 56 36 54 42Z', 'dark'),
    ...place(arrow('gold'), 32, 31, 44, 1.16), facet('M8 48 16 44 20 49 11 55Z', 'jade')],
  ricochet: [body('M5 51 19 15 39 38 48 15 53 17 41 49 21 27 10 54Z', 'jade'),
    body('M43 15 57 6 56 25 51 20Z', 'gold'), body('M16 20 21 14 26 20 21 26ZM34 42 39 36 44 42 39 48Z', 'steel')],
  rainOfArrows: [body('M4 54Q32 40 60 54L55 59Q32 49 9 59Z', 'jade'),
    ...place(arrow(), 13, 25, 180, .68), ...place(arrow('steel'), 32, 30, 180, .86), ...place(arrow(), 51, 24, 180, .68)],
  vaultingShot: [body('M26 48Q10 49 9 31L4 35 7 17 19 31 13 30Q14 42 29 42Z', 'jade'),
    ...place(bow(), 35, 29, 0, .92), ...place(arrow('steel'), 39, 29, 90, .67)],
  ghostHunt: [...place(bow('jade'), 45, 30, 0, .96, .32), ...place(bow('jade'), 22, 30, 0, .96),
    ...place(arrow('steel'), 33, 30, 90, 1.04), cut('M44 9 50 14M44 53 50 48', 'jade')],
  arcLightning: [lightning(), facet('M37 8 19 31 31 27 28 44 44 28 32 33Z', 'steel'),
    body('M8 11 19 18 14 21ZM49 43 59 50 48 48Z', 'gold')],
  tempest: [ring('violet'), body('M6 21 7 7 22 10ZM58 43 57 57 42 54Z', 'ice'),
    ...place([lightning(), facet('M38 6 18 32 31 28 28 47 43 30 32 34Z', 'steel')], 9, 8, 0, .74)],
  iceNova: Array.from({ length: 6 }, (_, i) => {
    const a = i * Math.PI / 3;
    return place(crystal(), 32 + Math.sin(a) * 18, 32 - Math.cos(a) * 18, i * 60, .49);
  }).flat(),
  frostLance: [body('M2 35 18 29 12 37ZM27 54 32 45 35 49 30 60Z', 'ice'), ...place(crystal(), 32, 31, 42, 1.19)],
  absoluteZero: [body('M6 34Q16 52 32 49 48 52 58 34L53 53 32 62 11 53Z', 'steel'),
    ...place(crystal(), 15, 35, -16, .56), ...place(crystal(), 49, 35, 16, .56), ...place(crystal(), 32, 28, 0, 1.06)],
  runicWard: [body('M32 3 56 16V45L32 61 8 45V16Z', 'jade'), body('M32 9 50 20V41L32 54 14 41V20Z', 'dark'),
    ...place(crystal('jade'), 32, 31, 0, .66), facet('M11 18 16 16 16 38 11 42ZM48 16 53 18V42L48 38Z', 'steel'),
    cut('M24 14 32 10 40 14M24 50 32 55 40 50', 'jade')],
  meteor: [body('M60 4 49 32 36 43 20 25Z', 'fire'), facet('M50 12 43 31 30 38 25 29Z', 'gold'),
    body('M21 24 36 28 42 42 34 55 20 58 8 49 6 35Z', 'dark'),
    facet('M21 27 31 31 28 39 14 41 10 35Z', 'fire'), facet('M30 41 37 35 38 44 30 52 21 54Z', 'gold'),
    body('M3 57 12 54 17 60 7 62ZM46 49 56 48 60 53 47 55Z', 'fire')],
  cataclysm: [body('M4 55 12 44 20 51 31 40 44 52 53 43 61 57 46 61 29 53 16 60Z', 'fire'),
    body('M37 2 36 22 28 38 18 29Z', 'fire'), body('M13 8 19 22 15 34 8 28Z', 'gold'), body('M61 9 53 34 45 40 39 29Z', 'gold'),
    body('M27 23 35 28 35 37 26 43 17 37 18 29Z', 'dark'), facet('M26 26 32 29 28 36 20 35Z', 'fire')],
  siphon: [body('M49 10C19-8-3 26 11 46 22 64 53 59 58 35 46 47 25 44 25 30 25 19 36 15 43 20L36 26 59 20 50 3Z', 'rose'),
    facet('M43 12C21 8 8 27 17 42 27 54 44 49 50 43 29 47 19 32 28 20Z', 'violet'),
    body('M36 36C29 26 21 35 27 42L36 50 45 42C51 35 43 26 36 36Z', 'gold')],
};

/** Freeze authored recipes once; renderers cannot accumulate or mutate presentation state. */
export const SKILL_ICON_RECIPES: Readonly<Record<SkillId, readonly IconPart[]>> = Object.freeze(
  Object.fromEntries(Object.entries(recipes).map(([id, parts]) => [id, Object.freeze(parts.map(p => Object.freeze({
    ...p, ...(p.transform ? { transform: Object.freeze(p.transform) } : {}),
  })))])) as Record<SkillId, readonly IconPart[]>,
);
