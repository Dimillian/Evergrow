import { MUSIC_POOLS, MUSIC_RULES, musicGap } from './music-playlist.ts';
import { nextMusicTrack, type MusicIntent, type MusicMood } from './music-policy.ts';

interface Deck {
  media: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode;
  id?: string; stopAt: number; ticket: number; primed: boolean; priming: boolean;
}
/** Two streamed decks. No decoded full-track buffers, per-frame analysis, or inference at runtime. */
export class MusicPlayer {
  private decks: Deck[];
  private bus: GainNode;
  private active?: Deck;
  private pending?: { deck: Deck; mood: MusicMood; started: number };
  private mood?: MusicMood;
  private last = new Map<MusicMood, string>();
  private failed = new Set<string>();
  private retryAt = 0;
  private nextAt = 0;
  private stopped = true;
  private disposed = false;
  private blocked = false;
  activate() { if (this.blocked) { this.blocked = false; this.nextAt = 0; } }
  private level = -1;
  private ctx: AudioContext;
  private files: Readonly<Record<string, string>>;
  constructor(ctx: AudioContext, output: AudioNode, files: Readonly<Record<string, string>>) {
    this.ctx = ctx; this.files = files;
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(output);
    this.decks = [0, 1].map(() => {
      const media = new Audio(); media.preload = 'none';
      const source = ctx.createMediaElementSource(media), gain = ctx.createGain();
      gain.gain.value = 0; source.connect(gain); gain.connect(this.bus);
      return { media, source, gain, stopAt: Infinity, ticket: 0, primed: false, priming: false };
    });
  }
  /** WebKit grants media permission per element. Unlock both persistent decks during the gesture. */
  prime() {
    if (this.disposed) return;
    for (const deck of this.decks) {
      if (deck.primed || deck.priming || deck.id) continue;
      deck.priming = true;
      const ticket = ++deck.ticket;
      // Ten milliseconds of local silence, through an already-zero deck gain.
      deck.media.src = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      void deck.media.play().then(() => {
        if (deck.ticket !== ticket) return;
        deck.primed = true; this.clear(deck);
      }).catch(() => { if (deck.ticket === ticket) this.clear(deck); });
    }
  }
  private ramp(node: GainNode, value: number, seconds: number) {
    const now = this.ctx.currentTime;
    node.gain.cancelAndHoldAtTime(now);
    node.gain.linearRampToValueAtTime(value, now + seconds);
  }
  setRunning(running: boolean) {
    if (this.disposed || this.stopped === !running) return;
    this.stopped = !running;
    if (!running) {
      // Cancel a pending promise before it can bring music back after background/mute.
      if (this.pending) { this.clear(this.pending.deck); this.pending = undefined; }
      for (const deck of this.decks) deck.media.pause();
    } else {
      this.nextAt = this.ctx.currentTime;
      for (const deck of this.decks) if (deck.id && !deck.media.ended) {
        const ticket = deck.ticket;
        void deck.media.play().then(() => {
          if (ticket === deck.ticket && (this.disposed || this.stopped)) deck.media.pause();
        }).catch(error => { if (ticket === deck.ticket) { this.blocked = error?.name === 'NotAllowedError'; this.clear(deck); } });
      }
    }
  }
  update(intent: MusicIntent, volume: number, running: boolean) {
    if (this.disposed) return;
    this.setRunning(running && volume > 0);
    const level = volume * intent.duck * .85; // Leave room for simultaneous combat impacts.
    if (level !== this.level) { this.level = level; this.ramp(this.bus, level, .35); }
    if (this.stopped || this.blocked) return;
    const now = this.ctx.currentTime;
    for (const deck of this.decks) if (now >= deck.stopAt) this.clear(deck);
    if (this.active && (!this.active.id || this.active.media.ended || this.active.media.error)) {
      if (this.active.media.error && this.active.id) this.failed.add(this.active.id);
      this.clear(this.active); this.active = undefined;
      this.nextAt = now + musicGap(intent.mood, Math.random());
    }
    if (this.pending) {
      if (this.pending.mood !== intent.mood || now - this.pending.started > MUSIC_RULES.loadTimeout) {
        if (this.pending.deck.id && this.pending.mood === intent.mood) this.failed.add(this.pending.deck.id);
        this.clear(this.pending.deck); this.pending = undefined;
      } else return;
    }
    const battleLoop = (intent.mood === 'boss' || intent.mood === 'event') && this.active
      && this.mood === intent.mood && Number.isFinite(this.active.media.duration)
      && this.active.media.duration - this.active.media.currentTime <= 6;
    if (this.mood === intent.mood && (this.active && !battleLoop || now < this.nextAt)) return;
    // Finish the outgoing tail before loading a third cue after rapid realm changes.
    const deck = this.decks.find(d => !d.id && !d.priming);
    if (!deck) return;
    let pool = MUSIC_POOLS[intent.mood].filter(id => this.files[id] && !this.failed.has(id));
    if (!pool.length) {
      if (now < this.retryAt) return;
      this.retryAt = now + 60; this.failed.clear();
      pool = MUSIC_POOLS[intent.mood].filter(id => this.files[id]);
    }
    const id = nextMusicTrack(pool, this.last.get(intent.mood), Math.random());
    if (!id) return;
    deck.id = id; deck.media.src = this.files[id]; deck.stopAt = Infinity;
    const ticket = ++deck.ticket, mood = intent.mood;
    this.pending = { deck, mood, started: now };
    void deck.media.play().then(() => {
      if (this.disposed || this.stopped || deck.ticket !== ticket) return;
      this.pending = undefined;
      const fade = mood === 'boss' || mood === 'event' ? MUSIC_RULES.battleFade : MUSIC_RULES.crossfade;
      if (this.active) {
        this.ramp(this.active.gain, 0, fade);
        this.active.stopAt = this.ctx.currentTime + fade;
      }
      this.ramp(deck.gain, 1, fade); this.active = deck; this.mood = mood;
      this.last.set(mood, id);
    }).catch(error => {
      if (deck.ticket !== ticket) return;
      if (error?.name === 'NotAllowedError') this.blocked = true; else this.failed.add(id); this.clear(deck); this.pending = undefined;
    });
  }
  private clear(deck: Deck) {
    deck.ticket++; deck.media.pause(); deck.media.removeAttribute('src'); deck.media.load();
    deck.gain.gain.cancelScheduledValues(this.ctx.currentTime); deck.gain.gain.value = 0;
    deck.id = undefined; deck.stopAt = Infinity; deck.priming = false;
  }
  dispose() {
    this.disposed = true;
    for (const deck of this.decks) { this.clear(deck); deck.source.disconnect(); deck.gain.disconnect(); }
    this.bus.disconnect();
  }
}
