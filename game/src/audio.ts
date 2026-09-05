import type { CombatEvent } from './model.ts';

interface Voice {
  source: AudioScheduledSourceNode;
  nodes: AudioNode[];
  priority: number;
  end: number;
  finished: boolean;
}
interface NoiseShape {
  duration: number;
  frequency: number;
  endFrequency: number;
  volume: number;
  attack?: number;
  delay?: number;
  type?: BiquadFilterType;
  q?: number;
  body?: boolean;
}

const MASTER_VOLUME = .34;
const MAX_VOICES = 96;
const SILENCE = .0001;

/** Layered oscillators and filtered noise synthesize every sound; no audio assets. */
export class GameAudio {
  enabled = true;
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private peakGuard: WaveShaperNode | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private bodyNoise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private bursts = new Map<CombatEvent['type'], { time: number; count: number }>();
  private disposed = false;

  async unlock() {
    if (this.disposed) return;
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.bus = ctx.createGain();
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -13;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = .002;
      this.compressor.release.value = .085;
      // The compressor handles layered impacts; the soft guard catches dense transients.
      this.peakGuard = ctx.createWaveShaper();
      const curve = new Float32Array(2048);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / (curve.length - 1) * 2 - 1) * 1.3);
      this.peakGuard.curve = curve;
      this.peakGuard.oversample = '2x';
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? MASTER_VOLUME : 0;
      this.bus.connect(this.compressor);
      this.compressor.connect(this.peakGuard);
      this.peakGuard.connect(this.master);
      this.master.connect(ctx.destination);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      this.bodyNoise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const white = this.noise.getChannelData(0), body = this.bodyNoise.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < white.length; i++) {
        white[i] = Math.random() * 2 - 1;
        previous = (previous + white[i] * .045) / 1.045;
        body[i] = Math.max(-1, Math.min(1, previous * 4.5));
      }
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    if (this.master && this.ctx && !this.disposed) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(value ? MASTER_VOLUME : 0, this.ctx.currentTime, .015);
    }
  }

  private finish(voice: Voice, stop = false) {
    if (voice.finished) return;
    voice.finished = true;
    voice.source.onended = null;
    if (stop) {
      try { voice.source.stop(); } catch { /* Already stopped or closed during teardown. */ }
    }
    for (const node of voice.nodes) node.disconnect();
    this.voices.delete(voice);
  }

  private reserve(priority: number) {
    if (this.voices.size < MAX_VOICES) return true;
    // Preserve player damage and the freshest impact; never grow the graph unboundedly.
    let oldest: Voice | null = null;
    for (const voice of this.voices) {
      if (!oldest || voice.priority < oldest.priority
        || (voice.priority === oldest.priority && voice.end < oldest.end)) oldest = voice;
    }
    if (!oldest || oldest.priority > priority) return false;
    this.finish(oldest, true);
    return true;
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], priority: number, end: number) {
    const voice: Voice = { source, nodes, priority, end, finished: false };
    this.voices.add(voice);
    source.onended = () => this.finish(voice);
    source.stop(end);
  }

  private envelope(gain: GainNode, time: number, duration: number, volume: number, attack: number) {
    const peak = time + Math.min(attack, duration * .4);
    gain.gain.setValueAtTime(SILENCE, time);
    gain.gain.linearRampToValueAtTime(Math.max(SILENCE, volume), peak);
    gain.gain.exponentialRampToValueAtTime(SILENCE, time + duration);
  }

  private tone(start: number, end: number, duration: number, volume: number,
    priority: number, type: OscillatorType = 'triangle', delay = 0, attack = .003) {
    if (!this.ctx || !this.bus || !this.reserve(priority)) return;
    const time = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, start), time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), time + duration);
    this.envelope(gain, time, duration, volume, attack);
    osc.connect(gain); gain.connect(this.bus);
    osc.start(time); this.track(osc, [osc, gain], priority, time + duration + .012);
  }

  private hiss(shape: NoiseShape, priority: number) {
    if (!this.ctx || !this.bus || !this.noise || !this.bodyNoise || !this.reserve(priority)) return;
    const time = this.ctx.currentTime + (shape.delay ?? 0);
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    source.buffer = shape.body ? this.bodyNoise : this.noise;
    filter.type = shape.type ?? 'bandpass';
    filter.Q.value = shape.q ?? .8;
    filter.frequency.setValueAtTime(Math.max(25, shape.frequency), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(25, shape.endFrequency), time + shape.duration);
    this.envelope(gain, time, shape.duration, shape.volume, shape.attack ?? .002);
    source.connect(filter); filter.connect(gain); gain.connect(this.bus);
    // Different offsets avoid identical noise attacks without allocating new buffers.
    source.start(time, Math.random() * Math.max(0, source.buffer.duration - shape.duration - .025));
    this.track(source, [source, filter, gain], priority, time + shape.duration + .012);
  }

  private burstGain(type: CombatEvent['type']) {
    const time = this.ctx!.currentTime, previous = this.bursts.get(type);
    if (previous && time - previous.time < .012) {
      previous.count++;
      // Share gain within a rapid group of hits rather than muting their feedback.
      return Math.max(.2, 1 / Math.sqrt(previous.count));
    }
    this.bursts.set(type, { time, count: 1 });
    return 1;
  }

  play(event: CombatEvent) {
    if (!this.enabled || !this.ctx || !this.bus || this.disposed || this.ctx.state !== 'running') return;
    if (event.type === 'spawn') return;
    const gain = this.burstGain(event.type);
    const weight = event.heavy ? 1.2 : Math.min(1.15, Math.max(.9, Math.pow((event.value ?? 24) / 24, .14)));
    const pitch = (event.enemyKind === 'brute' ? .8 : event.enemyKind === 'caster' ? 1.09 : 1) * (.97 + Math.random() * .06);
    const noise = (shape: NoiseShape, priority = 2) => this.hiss({ ...shape, volume: shape.volume * gain }, priority);
    const tone = (a: number, b: number, duration: number, volume: number, priority = 2,
      type: OscillatorType = 'triangle', delay = 0, attack = .003) =>
      this.tone(a, b, duration, volume * gain, priority, type, delay, attack);
    switch (event.type) {
      case 'swing':
        // Air gathers into the moving blade, with no impact sound until an actual hit.
        noise({ duration: .115, frequency: 700, endFrequency: 3000, volume: .18, attack: .028, q: .55 }, 1);
        noise({ duration: .12, frequency: 2500, endFrequency: 650, volume: .25, attack: .011, delay: .04, q: .65 }, 1);
        tone(180, 76, .13, .065, 1, 'sine', .014, .02);
        break;
      case 'hit':
        // Clack, flesh/body, low weight, and an inharmonic metal tail are separate layers.
        noise({ duration: .047, frequency: 3400 * pitch, endFrequency: 900, volume: .38 * weight, q: 1.1 });
        noise({ duration: .125, frequency: 900 * pitch, endFrequency: 140, volume: .53 * weight, body: true, type: 'lowpass' });
        tone(165 * pitch, 43, .135, .28 * weight);
        tone(1320 * pitch, 920 * pitch, .11, .066, 2, 'sine', .007);
        tone(2137 * pitch, 1670 * pitch, .076, .029, 2, 'sine', .009);
        break;
      case 'kill':
        noise({ duration: .19, frequency: 1050 * pitch, endFrequency: 145, volume: .54, body: true, type: 'lowpass' });
        tone(102 * pitch, 31, .25, .31);
        noise({ duration: .075, frequency: 2300, endFrequency: 600, volume: .15, delay: .024 });
        noise({ duration: .24, frequency: 540, endFrequency: 125, volume: .17, delay: .035, attack: .018 });
        tone(280 * pitch, 73, .21, .055, 2, 'triangle', .02);
        break;
      case 'hurt':
        // An immediate low crunch and breath separates player damage from enemy hits.
        noise({ duration: .14, frequency: 650, endFrequency: 95, volume: .7 * weight, body: true, type: 'lowpass' }, 3);
        noise({ duration: .055, frequency: 1450, endFrequency: 360, volume: .28 }, 3);
        tone(91, 34, .21, .38 * weight, 3);
        noise({ duration: .22, frequency: 570, endFrequency: 850, volume: .15, attack: .025, delay: .025, q: 1.2 }, 3);
        // Two quiet chest-like pulses mark danger without a piercing alarm.
        tone(76, 61, .082, .12, 3, 'sine', .105, .008);
        tone(65, 47, .105, .085, 3, 'sine', .225, .01);
        break;
      case 'cast':
        tone(170, 720, .17, .14, 1, 'triangle', 0, .014);
        noise({ duration: .19, frequency: 1400, endFrequency: 3700, volume: .2, attack: .026 }, 1);
        noise({ duration: .09, frequency: 3900, endFrequency: 1100, volume: .18, delay: .036 }, 1);
        tone(430, 150, .13, .08, 1, 'sine', .05);
        break;
      case 'dodge':
        noise({ duration: .15, frequency: 850, endFrequency: 240, volume: .24, attack: .012 }, 1);
        noise({ duration: .095, frequency: 1900, endFrequency: 950, volume: .075, delay: .012 }, 1);
        break;
      case 'heal':
        tone(330, 440, .24, .14, 1, 'sine', 0, .012);
        tone(550, 660, .31, .105, 1, 'triangle', .07, .018);
        tone(880, 990, .22, .045, 1, 'sine', .13, .02);
        noise({ duration: .22, frequency: 1700, endFrequency: 2600, volume: .065, attack: .035 }, 1);
        break;
      case 'level':
      case 'loot':
      case 'pickup':
        tone(event.heavy ? 610 : 790, event.heavy ? 820 : 1050, .086, .08, 0, 'sine');
        tone(event.heavy ? 910 : 1180, event.heavy ? 1080 : 1360, .065, .03, 0, 'sine', .025);
        break;
    }
  }

  /** Stop scheduled sources and close the graph when the local app is torn down/HMR'd. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of [...this.voices]) this.finish(voice, true);
    for (const node of [this.bus, this.compressor, this.peakGuard, this.master]) node?.disconnect();
    const ctx = this.ctx;
    this.ctx = null; this.bus = null; this.compressor = null; this.peakGuard = null; this.master = null;
    this.noise = null; this.bodyNoise = null; this.bursts.clear();
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }
}
