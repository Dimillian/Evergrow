/** Local portal influence, independent of camera zoom and number of nearby portals. */
export const RIFT_AUDIO_RADIUS = 260;
export function riftAudioStrength(distance: number): number {
  const t = Math.max(0, Math.min(1, (RIFT_AUDIO_RADIUS - distance) / (RIFT_AUDIO_RADIUS - 45)));
  return Number.isFinite(t) ? t * t * (3 - 2 * t) : 0;
}

/** One reusable, quietly breathing bed; separate from the combat voice pool. */
export class RiftHum {
  private sources: AudioScheduledSourceNode[] = [];
  private nodes: AudioNode[] = [];
  private output?: GainNode;
  private quietAt = Infinity;
  private ctx: AudioContext;
  private destination: AudioNode;
  private noise: AudioBuffer;
  private level = -1;
  constructor(ctx: AudioContext, destination: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx; this.destination = destination; this.noise = noise;
  }

  update(strength: number) {
    const now = this.ctx.currentTime;
    if (strength > 0 && !this.output) this.start();
    if (!this.output) return;
    if (strength !== this.level) { this.output.gain.setTargetAtTime(strength, now, .3); this.level = strength; }
    if (strength > 0) this.quietAt = Infinity;
    else if (this.quietAt === Infinity) this.quietAt = now;
    else if (now - this.quietAt > 2) this.dispose();
  }

  private start() {
    const ctx = this.ctx, now = ctx.currentTime;
    const output = ctx.createGain(), breath = ctx.createGain();
    output.gain.value = 0; breath.gain.value = .22;
    breath.connect(output); output.connect(this.destination); this.output = output;
    this.nodes.push(output, breath);
    // Quiet beating harmonics, rather than a high-pitched ringing notification.
    for (const [frequency, volume] of [[66, .25], [99.4, .085], [198.6, .035]]) {
      const source = ctx.createOscillator(), gain = ctx.createGain();
      source.type = 'sine'; source.frequency.value = frequency; gain.gain.value = volume;
      source.connect(gain); gain.connect(breath); source.start(now);
      this.sources.push(source); this.nodes.push(source, gain);
    }
    const air = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), airGain = ctx.createGain();
    air.buffer = this.noise; air.loop = true; filter.type = 'bandpass';
    filter.frequency.value = 680; filter.Q.value = .65; airGain.gain.value = .16;
    air.connect(filter); filter.connect(airGain); airGain.connect(breath); air.start(now);
    this.sources.push(air); this.nodes.push(air, filter, airGain);
    const pulse = ctx.createOscillator(), depth = ctx.createGain();
    pulse.frequency.value = 1.65 / (Math.PI * 2); depth.gain.value = .065;
    pulse.connect(depth); depth.connect(breath.gain); pulse.start(now);
    this.sources.push(pulse); this.nodes.push(pulse, depth);
  }

  dispose() {
    for (const source of this.sources) source.stop();
    for (const node of this.nodes) node.disconnect();
    this.sources.length = 0; this.nodes.length = 0; this.output = undefined; this.quietAt = Infinity; this.level = -1;
  }
}
