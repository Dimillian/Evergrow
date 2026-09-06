import { createSoundRecipe, soundRandom, type SoundTuning } from './sound-library.ts';
export type SoundSpace = 'dry' | 'woods' | 'crypt';
export interface SoundRequest { id: string; variation: number; tuning: SoundTuning; space: SoundSpace }
const SAMPLE_RATE = 44100;
const EPSILON = .0001;

// The finite catalog is decoded lazily. Concurrent variations share each source request.
const recordings = new Map<string, Promise<AudioBuffer>>();
async function recording(ctx: BaseAudioContext, id: string): Promise<AudioBuffer> {
  let pending = recordings.get(id);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(new URL(`./assets/audio/${id}.wav`, import.meta.url), { signal: controller.signal });
        if (!response.ok) throw new Error(`Unable to load recording: ${id}`);
        return await ctx.decodeAudioData(await response.arrayBuffer());
      } finally { clearTimeout(timeout); }
    })();
    recordings.set(id, pending);
    void pending.catch(() => recordings.delete(id));
  }
  return pending;
}
function impulse(ctx: BaseAudioContext, space: SoundSpace, tail: number): AudioBuffer {
  const duration = (space === 'crypt' ? 1.25 : .23) * tail, random = soundRandom(7219);
  const buffer = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel); let low = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      low = low * .65 + (random()*2-1)*.35;
      data[i] = t < .018 ? 0 : low * Math.pow(1-t/duration,3.4) * .3;
    }
    for (const [i,delay] of [.025,.047,.083,.127].entries()) {
      const position = Math.floor((delay + channel*.003) * ctx.sampleRate);
      if (position < data.length) data[position] += .6 / (1+i);
    }
  }
  return buffer;
}
/** Compile deterministic material/creature layers into a reusable stereo sample. */
export async function renderSound(request: SoundRequest): Promise<AudioBuffer> {
  const recipe = createSoundRecipe(request.id,request.variation,request.tuning);
  const decay = Number.isFinite(request.tuning.tail) ? Math.max(.5,Math.min(1.6,request.tuning.tail)) : 1;
  const tail = (request.space === 'crypt' ? 1.3 : request.space === 'woods' ? .28 : .04) * decay;
  const ctx = new OfflineAudioContext(2, Math.ceil((recipe.duration+tail)*SAMPLE_RATE), SAMPLE_RATE);
  const sources = new Map<string,AudioBuffer>();
  await Promise.all(recipe.layers.map(async layer => {
    if (layer.kind === 'sample') sources.set(layer.sample, await recording(ctx, layer.sample));
  }));
  const bus = ctx.createGain(); bus.connect(ctx.destination);
  const color = ctx.createBiquadFilter(); color.type='lowpass'; color.frequency.value=request.id==='level-up'||request.id==='item-rare'?7600:14000; color.Q.value=.4; color.connect(bus);
  if (request.space !== 'dry') {
    const reverb = ctx.createConvolver(), wet = ctx.createGain();
    reverb.buffer = impulse(ctx,request.space,decay); wet.gain.value=request.space==='crypt'?.24:.1;
    color.connect(reverb); reverb.connect(wet); wet.connect(bus);
  }
  recipe.layers.forEach(layer => {
    const gain = ctx.createGain(), start = layer.delay, end = start + layer.duration;
    gain.gain.setValueAtTime(EPSILON,start);
    gain.gain.linearRampToValueAtTime(layer.gain,start+Math.min(layer.attack,layer.duration*.2));
    gain.connect(color);
    if (layer.kind === 'sample') {
      // Preserve recorded contact and decay, fading only the crop boundary, not the whole performance.
      gain.gain.setValueAtTime(layer.gain,Math.max(start+layer.attack,end-Math.min(.045,layer.duration*.2)));
      gain.gain.linearRampToValueAtTime(0,end);
      const source=ctx.createBufferSource(), original=sources.get(layer.sample)!;
      if(layer.reverse) {
        const reversed=ctx.createBuffer(original.numberOfChannels,original.length,original.sampleRate);
        for(let channel=0;channel<original.numberOfChannels;channel++) reversed.getChannelData(channel).set(original.getChannelData(channel).slice().reverse());
        source.buffer=reversed;
      } else source.buffer=original;
      source.playbackRate.value=layer.rate;
      const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=layer.cutoff;filter.Q.value=.45;
      source.connect(filter);filter.connect(gain);source.start(start);source.stop(end+.005);
    } else if (layer.kind === 'noise') {
      gain.gain.exponentialRampToValueAtTime(EPSILON,end);
      const source=ctx.createBufferSource(), random=soundRandom(recipe.seed+recipe.layers.indexOf(layer)*953);
      const buffer=ctx.createBuffer(1,Math.ceil((layer.duration+.04)*ctx.sampleRate),ctx.sampleRate),data=buffer.getChannelData(0);
      let brown=0,grain=1;
      for(let i=0;i<data.length;i++){
        const white=random()*2-1,t=i/ctx.sampleRate;
        brown=(brown+white*.045)/1.045;
        if(i%220===0)grain=.2+random()*.8;
        data[i]=layer.texture==='body'?brown*5:layer.texture==='grit'?white*grain*(.6+Math.sin(t*130)*.4):white;
      }
      source.buffer=buffer;
      const filter=ctx.createBiquadFilter();filter.type=layer.texture==='body'?'lowpass':'bandpass';filter.Q.value=layer.q;
      filter.frequency.setValueAtTime(layer.frequency,start);filter.frequency.exponentialRampToValueAtTime(layer.end,end);
      source.connect(filter);filter.connect(gain);source.start(start);source.stop(end+.012);
    } else {
      gain.gain.exponentialRampToValueAtTime(EPSILON,end);
      const source=ctx.createOscillator();source.type='sine';
      source.frequency.setValueAtTime(layer.frequency,start);source.frequency.exponentialRampToValueAtTime(layer.end,end);
      source.connect(gain);source.start(start);source.stop(end+.005);
    }
  });
  const buffer = await ctx.startRendering();
  // Only attenuate peaks: quiet rewards retain their intentional place in the mix.
  let peak=0;
  for(let channel=0;channel<buffer.numberOfChannels;channel++) for(const sample of buffer.getChannelData(channel)) peak=Math.max(peak,Math.abs(sample));
  const level=peak>.85?.85/peak:1;
  for(let channel=0;channel<buffer.numberOfChannels;channel++) {
    const data=buffer.getChannelData(channel);
    for(let i=0;i<data.length;i++) data[i]*=level;
  }
  return buffer;
}
interface PlaybackVoice { source: AudioBufferSourceNode; gain: GainNode }
/** Audition transport; buffering, stop/dispose and cache lifetime are independent of the UI. */
export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Set<PlaybackVoice>();
  private buffers = new Map<string,AudioBuffer>();
  private revision=0;
  private disposed=false;
  private volume=.5;
  private compile: typeof renderSound;
  private createContext: () => AudioContext;
  constructor(compile = renderSound, createContext = () => new AudioContext()) { this.compile=compile; this.createContext=createContext; }
  async unlock() {
    if(this.disposed) throw new Error('Sound studio closed');
    if(!this.ctx) {
      this.ctx=this.createContext(); this.master=this.ctx.createGain(); this.master.gain.value=this.volume;
      const compressor=this.ctx.createDynamicsCompressor(); compressor.threshold.value=-10; compressor.ratio.value=4;
      this.master.connect(compressor); compressor.connect(this.ctx.destination);
    }
    if(this.ctx.state==='suspended') await this.ctx.resume();
  }
  setVolume(value:number) { this.volume=Number.isFinite(value)?Math.max(0,Math.min(1,value)):.5; this.master?.gain.setTargetAtTime(this.volume,this.ctx!.currentTime,.015); }
  async buffer(request:SoundRequest) {
    const key=JSON.stringify(request), cached=this.buffers.get(key);
    if(cached) { this.buffers.delete(key); this.buffers.set(key,cached); return cached; }
    const buffer=await this.compile(request);
    if(!this.disposed) {
      if(this.buffers.size>=24) this.buffers.delete(this.buffers.keys().next().value!);
      this.buffers.set(key,buffer);
    }
    return buffer;
  }
  async play(request:SoundRequest): Promise<AudioBuffer|null> {
    const revision=++this.revision;
    await this.unlock();
    if(this.disposed||revision!==this.revision) return null;
    const buffer=await this.buffer(request);
    if(this.disposed||revision!==this.revision) return null;
    this.silence();
    if(this.voices.size>=8) {
      const oldest=this.voices.values().next().value!;
      oldest.source.onended=null; try{oldest.source.stop();}catch{/* Already stopped. */}
      oldest.source.disconnect(); oldest.gain.disconnect(); this.voices.delete(oldest);
    }
    const source=this.ctx!.createBufferSource(), gain=this.ctx!.createGain();
    source.buffer=buffer; source.connect(gain); gain.connect(this.master!);
    const voice={source,gain}; this.voices.add(voice);
    source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};
    source.start(); return buffer;
  }
  private silence() {
    if(!this.ctx) return;
    for(const voice of this.voices) {
      voice.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.006);
      try{voice.source.stop(this.ctx.currentTime+.035);}catch{/* Already finished. */}
    }
  }
  stop() { this.revision++; this.silence(); }
  dispose() {
    if(this.disposed) return;
    this.stop(); this.disposed=true; this.buffers.clear();
    for(const voice of this.voices) { voice.source.onended=null; voice.source.disconnect();voice.gain.disconnect(); }
    this.voices.clear(); this.master?.disconnect();
    if(this.ctx&&this.ctx.state!=='closed') void this.ctx.close().catch(()=>{});
  }
}
/** Interleaved 16-bit PCM WAV, generated from exactly the auditioned stereo buffer. */
export function soundWav(buffer:AudioBuffer): Blob {
  const channels=buffer.numberOfChannels, size=buffer.length*channels*2;
  const bytes=new ArrayBuffer(44+size), view=new DataView(bytes);
  const tag=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  tag(0,'RIFF');view.setUint32(4,36+size,true);tag(8,'WAVE');tag(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);
  view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,size,true);
  const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
  for(let i=0;i<buffer.length;i++)for(let ch=0;ch<channels;ch++){
    const sample=Math.max(-1,Math.min(1,data[ch][i]));view.setInt16(44+(i*channels+ch)*2,Math.round(sample*(sample<0?32768:32767)),true);
  }
  return new Blob([bytes],{type:'audio/wav'});
}
