/** Two staggered flow phases: a phase has zero weight when its displacement wraps.
 * Maximum travel remains 52 world units, regardless of session duration. */
export const WATER_FLOW_PERIOD = 4;
export const WATER_FLOW_SPEED = 13;
export function waterFlowPhases(time: number) {
  const a = ((time / WATER_FLOW_PERIOD) % 1 + 1) % 1, b = (a + .5) % 1;
  const triangle = 1 - Math.abs(a * 2 - 1);
  return { a: a * WATER_FLOW_PERIOD * WATER_FLOW_SPEED, b: b * WATER_FLOW_PERIOD * WATER_FLOW_SPEED,
    weight: triangle * triangle * (3 - 2 * triangle) };
}
export const WATER_FLOW_GLSL = `
vec3 flowPhases(float t){
  float a=fract(t/${WATER_FLOW_PERIOD.toFixed(1)}), b=fract(a+.5);
  return vec3(a*${(WATER_FLOW_PERIOD * WATER_FLOW_SPEED).toFixed(1)},b*${(WATER_FLOW_PERIOD * WATER_FLOW_SPEED).toFixed(1)},smoothstep(0.,1.,1.-abs(a*2.-1.)));
}
`;
