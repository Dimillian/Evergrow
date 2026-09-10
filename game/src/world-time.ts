/** One clock for the sky and map, derived from persisted simulation time.
 * Pausing, loading, travelling and entering a dungeon never reset the day. */
export const WORLD_TIME = Object.freeze({ daySeconds: 36 * 60, startHour: 9 });
export interface SkyState {
  hour: number;
  daylight: number;
  warmth: number;
  direction: readonly [number, number, number];
  tint: readonly [number, number, number];
  ambient: readonly [number, number, number];
  power: number;
  shadow: number;
}
const smooth = (a: number, b: number, x: number) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t); };
export function worldHour(seconds: number): number {
  return ((WORLD_TIME.startHour + (Number.isFinite(seconds) ? seconds : 0) / WORLD_TIME.daySeconds * 24) % 24 + 24) % 24;
}
export function worldTimeLabel(seconds: number): string {
  const minutes=Math.floor(worldHour(seconds)*60);
  return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}
export function skyAtTime(seconds: number): SkyState { return skyAtHour(worldHour(seconds)); }
export function skyAtHour(hour: number): SkyState {
  hour=((hour%24)+24)%24;
  const angle=(hour-6)/12*Math.PI, elevation=Math.sin(angle);
  const daylight=smooth(-.16,.35,elevation);
  const warmth=(1-smooth(.04,.65,Math.abs(elevation)))*daylight;
  const tint: [number,number,number]=[.56+.44*daylight,.70+.30*daylight-.25*warmth,1-.48*warmth];
  return {hour,daylight,warmth,direction:[-Math.cos(angle)*.8,-.48,.28+.68*elevation*elevation],tint,
    ambient:[.50+.56*daylight+.10*warmth,.62+.44*daylight-.08*warmth,.85+.21*daylight-.22*warmth],
    power:.25+.70*daylight,shadow:.36+.64*daylight};
}
