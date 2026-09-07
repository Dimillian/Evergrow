import { MusicDirector, type MusicCue, type MusicSelection, type MusicSituation } from './music-director.ts';
import { prepareMusicLoop } from './music-loop.ts';

export interface MusicTrack { readonly url: string; readonly frames48k: number; }

interface Envelope { from: number; to: number; start: number; end: number; }
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  envelope: Envelope;
  started: number;
  offset: number;
  duration: number;
}
const MUSIC_VOLUME = .49;
const flat = (value: number): Envelope => ({ from: value, to: value, start: 0, end: 0 });
function valueAt(e: Envelope, now: number): number {
  if (now >= e.end) return e.to;
  const t = Math.max(0, (now - e.start) / (e.end - e.start));
  return e.from + (e.to - e.from) * t;
}
function ramp(param: AudioParam, previous: Envelope, to: number, now: number, seconds: number): Envelope {
  const from = valueAt(previous, now);
  param.cancelScheduledValues(now);
  param.setValueAtTime(from, now);
  param.linearRampToValueAtTime(to, now + seconds);
  return { from, to, start: now, end: now + seconds };
}

/** Adaptive playback, not runtime note generation. Uses the four composed loops.
 * One shared AudioContext; a clean bus bypasses the combat distortion/compressor.
 * At most four voices, two cached buffers and one in-flight load/decode. */
export class MusicComposer {
  private readonly director = new MusicDirector();
  private ctx: AudioContext | null = null;
  private output: GainNode | null = null;
  private outputEnvelope = flat(0);
  private selection: MusicSelection = { cue: null, level: 0, fade: 3 };
  private voices = new Map<MusicCue, Voice>();
  private buffers = new Map<MusicCue, AudioBuffer>();
  private positions = new Map<MusicCue, number>();
  private loading: { cue: MusicCue; abort: AbortController } | null = null;
  private retryAt = new Map<MusicCue, number>();
  private enabled = true;
  private disposed = false;
  private cleanup: ReturnType<typeof setTimeout> | null = null;
  private fetchAudio: typeof fetch;
  private tracks: Readonly<Record<MusicCue, MusicTrack>>;

  constructor(tracks: Readonly<Record<MusicCue, MusicTrack>>, fetchAudio: typeof fetch = fetch) {
    this.tracks = tracks; this.fetchAudio = fetchAudio;
  }

  attach(ctx: AudioContext): void {
    if (this.disposed || this.ctx) return;
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = 0;
    this.output.connect(ctx.destination);
    this.sync();
  }

  update(situation: MusicSituation, dt: number): void {
    if (this.disposed) return;
    this.selection = this.director.update(situation, dt);
    this.sync();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.loading?.abort.abort();
    this.sync();
  }

  private sync(): void {
    const ctx = this.ctx;
    if (this.disposed || !ctx || !this.output) return;
    const now = ctx.currentTime;
    this.reap(now);
    const level = this.enabled && this.selection.cue ? MUSIC_VOLUME * this.selection.level : 0;
    if (this.outputEnvelope.to !== level) {
      this.outputEnvelope = ramp(this.output.gain, this.outputEnvelope, level, now,
        !this.enabled ? .08 : this.selection.cue ? .65 : 2);
    }
    if (!this.enabled || !this.selection.cue) {
      for (const voice of this.voices.values()) this.fade(voice, 0, now, this.enabled ? 2 : .1);
      this.scheduleCleanup();
      return;
    }
    if (ctx.state !== 'running') return;
    const cue = this.selection.cue;
    if (!this.voices.has(cue)) {
      const buffer = this.buffers.get(cue);
      if (buffer) {
        const source = ctx.createBufferSource(), gain = ctx.createGain();
        source.buffer = buffer; source.loop = true;
        source.loopStart = 0; source.loopEnd = buffer.duration;
        gain.gain.value = 0;
        source.connect(gain); gain.connect(this.output);
        const offset = (this.positions.get(cue) ?? 0) % buffer.duration;
        source.start(now, offset);
        this.voices.set(cue, { source, gain, envelope: flat(0), started: now, offset, duration: buffer.duration });
      } else {
        // Keep the audible cue until the incoming audio is ready. A stale load
        // may fill the small cache, but may never choose what is played.
        if (!this.loading && now >= (this.retryAt.get(cue) ?? 0)) void this.load(cue);
        return;
      }
    }
    for (const [id, voice] of this.voices) this.fade(voice, id === cue ? 1 : 0, now, this.selection.fade);
    this.scheduleCleanup();
  }

  private async load(cue: MusicCue): Promise<void> {
    const ctx = this.ctx!;
    const job = { cue, abort: new AbortController() };
    this.loading = job;
    try {
      // Call the platform function without binding its receiver to this composer.
      // Native Window.fetch rejects a MusicComposer receiver.
      const fetchAudio = this.fetchAudio;
      const response = await fetchAudio(this.tracks[cue].url, { signal: job.abort.signal });
      if (!response.ok) throw new Error(`Music request failed: ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (this.disposed || job.abort.signal.aborted) return;
      const decoded = await ctx.decodeAudioData(bytes);
      if (this.disposed || job.abort.signal.aborted) return;
      const buffer = prepareMusicLoop(ctx, decoded, this.tracks[cue].frames48k);
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 70)
        throw new Error('Invalid music duration');
      this.buffers.delete(cue); this.buffers.set(cue, buffer);
      while (this.buffers.size > 2) this.buffers.delete(this.buffers.keys().next().value!);
      this.retryAt.delete(cue);
    } catch {
      // Music failure must never prevent play or disable impact sounds. Retry
      // at most every thirty seconds while this cue is still wanted.
      if (!this.disposed && !job.abort.signal.aborted) this.retryAt.set(cue, ctx.currentTime + 30);
    } finally {
      if (this.loading === job) this.loading = null;
      if (!this.disposed) this.sync();
    }
  }

  private fade(voice: Voice, to: number, now: number, seconds: number): void {
    if (voice.envelope.to === to) return;
    voice.envelope = ramp(voice.gain.gain, voice.envelope, to, now, seconds);
  }

  private reap(now: number): void {
    for (const [cue, voice] of this.voices) {
      if (voice.envelope.to !== 0 || now < voice.envelope.end) continue;
      this.positions.set(cue, (voice.offset + now - voice.started) % voice.duration);
      voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect();
      this.voices.delete(cue);
    }
  }

  private scheduleCleanup(): void {
    if (this.cleanup !== null || ![...this.voices.values()].some(v => v.envelope.to === 0)) return;
    // The audio clock performs fades even if rendering is paused/throttled.
    // One bounded timer releases silent sources while a tab is in background.
    this.cleanup = setTimeout(() => {
      this.cleanup = null;
      if (!this.disposed && this.ctx) {
        this.reap(this.ctx.currentTime);
        // A newer fade or a suspended audio clock can outlast this timer.
        // Keep cleanup alive without relying on another animation frame.
        this.scheduleCleanup();
      }
    }, 3200);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.loading?.abort.abort();
    if (this.cleanup !== null) clearTimeout(this.cleanup);
    for (const voice of this.voices.values()) {
      voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect();
    }
    this.output?.disconnect(); this.output = null; this.ctx = null;
    this.voices.clear(); this.buffers.clear(); this.positions.clear(); this.retryAt.clear();
  }
}
