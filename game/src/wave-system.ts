/** Shared deterministic wave clock. Admission, combat and rewards remain caller-owned. */
export interface WaveRules {
    count: number;
    duration: number;
    interval: number;
    hold: number;
}
export interface WaveProgress {
    wave: number;
    cleared: number;
    elapsed: number;
    rest: number;
    held: number;
    started: boolean;
    finished: boolean;
}
export const freshWaves = (): WaveProgress => ({ wave: 0, cleared: 0, elapsed: 0, rest: 0, held: 0, started: false, finished: false });
export function advanceWaves(state: WaveProgress, rules: WaveRules, dt: number, facts: {
    admitted: boolean;
    defeated: boolean;
    inObjective: boolean;
}): void {
    if (state.finished || !Number.isFinite(dt) || dt <= 0)
        return;
    if (facts.admitted)
        state.started = true;
    if (!state.started)
        return;
    state.elapsed += dt;
    if (rules.duration && state.elapsed >= rules.duration) {
        state.elapsed = rules.duration;
        state.finished = true;
        return;
    }
    if (state.rest > 0) {
        state.rest = Math.max(0, state.rest - dt);
        return;
    }
    if (facts.inObjective)
        state.held = Math.min(rules.hold, state.held + dt);
    if (!facts.defeated || state.held < rules.hold)
        return;
    state.cleared++;
    state.wave++;
    state.held = 0;
    if (state.wave >= rules.count)
        state.finished = true;
    else
        state.rest = rules.interval;
}
