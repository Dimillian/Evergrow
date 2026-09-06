import { SOUND_SAMPLES, type SoundSampleId } from './sound-samples.ts';
/** Sample-led audition recipes, independent of Web Audio and gameplay state. */
export type SoundFamily = 'weapons' | 'magic' | 'creatures' | 'rewards' | 'utility';
interface LayerBase { duration: number; gain: number; delay: number; attack: number }
export interface SampleLayer extends LayerBase { kind: 'sample'; sample: SoundSampleId; rate: number; cutoff: number; reverse: boolean }
export interface ToneLayer extends LayerBase { kind: 'tone'; frequency: number; end: number }
export interface NoiseLayer extends LayerBase { kind: 'noise'; frequency: number; end: number; texture: 'air' | 'body' | 'grit'; q: number }
export type SoundLayer = SampleLayer | ToneLayer | NoiseLayer;
export interface SoundTuning { weight: number; brightness: number; tail: number }
export const DEFAULT_SOUND_TUNING: Readonly<SoundTuning> = Object.freeze({ weight: 1, brightness: 1, tail: 1 });
export const SOUND_VARIATIONS = 6;
export interface SoundRecipe { readonly seed: number; readonly layers: readonly Readonly<SoundLayer>[]; readonly duration: number }
const sample = (id: SoundSampleId, gain = .5, rate = 1, delay = 0, cutoff = 10000, reverse = false): SampleLayer =>
  ({ kind: 'sample', sample: id, rate, gain, delay, cutoff, reverse, duration: SOUND_SAMPLES[id] / rate, attack: .003 });
// Sub pressure supports a few large magical events; physical sounds and voices use recordings only.
const pressure = (gain = .045, delay = 0): ToneLayer => ({ kind: 'tone', frequency: 68, end: 31, duration: .28, gain, delay, attack: .009 });
const pair = (variation: number, a: SoundSampleId, b: SoundSampleId) => variation % 2 ? b : a;
// Original studio reward cues, restored after the recorded reward candidates were rejected.
const tone=(frequency:number,end:number,duration:number,gain:number,delay=0,attack=.003):ToneLayer=>
  ({kind:'tone',frequency,end,duration,gain,delay,attack});
const noise=(frequency:number,end:number,duration:number,gain:number,delay=0,texture:NoiseLayer['texture']='air',attack=.003):NoiseLayer=>
  ({kind:'noise',frequency,end,duration,gain,delay,texture,attack,q:.7});
const metal=(fundamental:number,gain:number,delay=0,decay=.32):ToneLayer[]=>
  [1,1.47,2.13,3.71,5.19].map((ratio,i)=>tone(fundamental*ratio,fundamental*ratio*.992,decay/(1+i*.42),gain/(1+i*1.7),delay+i*.001));
const definitions = [
  { id:'sword-sweep', name:'Sword sweep', family:'weapons', detail:'A recorded blade pass, leather movement and a quiet steel edge.', layers:(v:number)=>[sample(pair(v,'blade-1','blade-2'),.7),sample('leather',.12,1.1),sample('steel-draw',.075,1.08,.025,5400)] },
  { id:'heavy-sweep', name:'Heavy swing', family:'weapons', detail:'A weighted blade pass with cloth and equipment movement.', layers:(v:number)=>[sample(pair(v,'blade-2','blade-1'),.75,.73),sample('cloth',.22,.86,0,3700)] },
  { id:'flesh-hit', name:'Flesh impact', family:'weapons', detail:'A dense physical punch with a short leather contact.', layers:(v:number)=>[sample(pair(v,'punch-1','punch-2'),.82,.9),sample('leather',.17,1.3,.018)] },
  { id:'bone-hit', name:'Bone impact', family:'weapons', detail:'Dry wooden fracture, small fragments and a muted body strike.', layers:(v:number)=>[sample(pair(v,'wood-1','wood-2'),.65,1.16),sample('glass-1',.2,.8,.012,4000),sample('punch-1',.18,.9)] },
  { id:'armor-hit', name:'Armor impact', family:'weapons', detail:'Struck metal with its uneven natural resonance and body underneath.', layers:(v:number)=>[sample(pair(v,'metal-1','metal-2'),.6,.93,0,6400),sample('punch-2',.25,.87)] },
  { id:'shield-block', name:'Shield block', family:'weapons', detail:'A broad plate contact reinforced by a wooden knock.', layers:(v:number)=>[sample(pair(v,'plate-1','plate-2'),.68,.84,0,6500),sample('wood-2',.38,.8,.006)] },
  { id:'bow-release', name:'Bow release', family:'weapons', detail:'Wood flex and a short mechanical snap beneath the arrow pass.', layers:()=>[sample('wood-flex',.24,1.2,0,4800),sample('latch',.25,1.3,.09),sample('blade-2',.29,1.4,.09)] },
  { id:'arrow-hit', name:'Arrow impact', family:'weapons', detail:'A sharp wood contact with a restrained body thump.', layers:(v:number)=>[sample(pair(v,'wood-1','wood-2'),.58,1.28),sample('punch-1',.25,1.12)] },
  { id:'fire-cast', name:'Fireball release', family:'magic', detail:'Flame ignition pushed through a fast rush of air.', layers:()=>[sample('flame',.75,.95),sample('blade-1',.27,.78),pressure(.03)] },
  { id:'fire-impact', name:'Fire explosion', family:'magic', detail:'A blast, rolling flame and a low pressure tail.', layers:()=>[sample('blast',.7,.75),sample('flame',.65,.68,.05,5700),pressure(.08)] },
  { id:'arc-lightning', name:'Arc lightning', family:'magic', detail:'Fractured glass and sharp metallic contacts form an irregular discharge.', layers:(v:number)=>[sample(pair(v,'glass-1','glass-2'),.66,1.45),sample('latch',.3,1.6,.065),sample('glass-2',.38,1.8,.15),pressure(.035)] },
  { id:'ice-nova', name:'Ice nova', family:'magic', detail:'Strained material opens into a brittle glass fracture and falling shards.', layers:()=>[sample('wood-flex',.22,.76,0,5200),sample('glass-2',.7,.78,.12),sample('glass-1',.35,1.35,.24),sample('bell',.1,1.55,.16,6500)] },
  { id:'arcane-cast', name:'Arcane missile', family:'magic', detail:'A reversed struck bell draws inward before a soft physical release.', layers:()=>[sample('bell',.22,1.65,0,6700,true),sample('blade-1',.35,1.2,.35),sample('glass-1',.12,.8,.42)] },
  { id:'hound-alert', name:'Hound snarl', family:'creatures', detail:'A performed throat growl, lowered slightly into a feral warning.', layers:(v:number)=>[sample(pair(v,'growl-6','growl-8'),.65,.85,0,6900)] },
  { id:'goblin-alert', name:'Goblin command', family:'creatures', detail:'A short, raspy performed grunt with a smaller throat.', layers:(v:number)=>[sample(pair(v,'growl-1','growl-2'),.55,1.25,0,8200)] },
  { id:'skeleton-idle', name:'Bone rattle', family:'creatures', detail:'Loose dry contacts with uneven timing and small joint clicks.', layers:(v:number)=>[sample(pair(v,'wood-1','wood-2'),.28,1.25),sample('latch',.12,1.3,.08),sample('wood-2',.22,1.45,.21),sample('wood-1',.13,1.1,.36)] },
  { id:'brute-attack', name:'Brute exertion', family:'creatures', detail:'A chesty performed attack grunt with breath and vocal roughness intact.', layers:(v:number)=>[sample(pair(v,'growl-4','growl-12'),.72,.75,0,5900)] },
  { id:'warden-warning', name:'Warden warning', family:'creatures', detail:'A long performed growl with a faint, low struck-metal resonance.', layers:(v:number)=>[sample(pair(v,'growl-10','growl-14'),.7,.65,0,5100),sample('gong',.13,.68,.06,1700)] },
  { id:'coin-pickup', name:'Coin pickup', family:'rewards', detail:'Real coins handled together; a short, clear metallic pickup.', layers:()=>[sample('coins-2',.47,1.08)] },
  { id:'coin-spill', name:'Coin handful', family:'rewards', detail:'A handful of coins with uneven contacts and natural settling.', layers:()=>[sample('coins-1',.55,1)] },
  { id:'xp-pickup', name:'XP absorption', family:'rewards', detail:'A quiet reversed bell fragment and a soft, airy material pass.', layers:()=>[sample('bell',.09,1.8,0,5500,true),sample('cloth',.08,1.35)] },
  { id:'item-common', name:'Common item', family:'rewards', detail:'Leather handling and a small equipment buckle.', layers:()=>[sample('leather',.43),sample('latch',.12,1.12,.04)] },
  { id:'item-rare', name:'Rare item', family:'rewards', detail:'The original soft pickup and golden ascending resonance.', layers:()=>[
    noise(1600,650,.085,.14,0,'grit'),tone(160,85,.08,.07),...metal(760,.04,.025,.23),
    ...[440,660,880].map((f,i)=>tone(f,f,.55-i*.08,.047,.06+i*.045,.008)),
  ] },
  { id:'level-up', name:'Level up', family:'rewards', detail:'The original warm arrival and resolving ascending phrase.', layers:()=>[
    tone(132,42,.16,.2),noise(480,90,.14,.26,0,'body'),noise(600,3300,.7,.1,.03,'air',.12),
    ...[220,330,440,550,660].flatMap((f,i)=>[tone(f,f,1.3-i*.12,.075,.07+i*.09,.015),...metal(f*2,.018,.08+i*.09,.65)]),
  ] },
  { id:'potion-drink', name:'Dual potion', family:'utility', detail:'A stopper click and real liquid movement with a soft handling tail.', layers:()=>[sample('latch',.14,1.3),sample('water',.43,1.18,.06,5900),sample('leather',.12,.95,.19)] },
  { id:'portal-open', name:'Town portal', family:'utility', detail:'Reversed gong resonance gathers into a low, breathing flame release.', layers:()=>[sample('gong',.35,.9,0,4700,true),sample('flame',.35,.7,.62,4000),sample('bell',.15,.72,.7,4600),pressure(.055,.68)] },
] as const satisfies readonly {id:string;name:string;family:SoundFamily;detail:string;layers:(variation:number)=>SoundLayer[]}[];
export type SoundId = typeof definitions[number]['id'];
export const SOUND_LIBRARY = Object.freeze(definitions.map(d => Object.freeze(d)));
export const SOUND_FAMILIES: Readonly<Record<SoundFamily,string>> = Object.freeze({weapons:'Weapons & impacts',magic:'Magic',creatures:'Creatures',rewards:'Rewards',utility:'Utility'});
export function soundRandom(seed:number):()=>number {let state=seed>>>0;return()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);}
const bounded=(value:number,min:number,max:number)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):1;
export function createSoundRecipe(id:string,variation=0,tuning:Readonly<SoundTuning>=DEFAULT_SOUND_TUNING):SoundRecipe {
  const index=SOUND_LIBRARY.findIndex(d=>d.id===id);
  if(index<0)throw new Error(`Unknown sound: ${id}`);
  const variant=Math.abs(Math.trunc(variation))%SOUND_VARIATIONS||0;
  const seed=(index+1)*7919+variant*104729,random=soundRandom(seed);
  const pitch=.975+random()*.05,weight=bounded(tuning.weight,.65,1.5),brightness=bounded(tuning.brightness,.55,1.6),tail=bounded(tuning.tail,.5,1.6);
  const layers=SOUND_LIBRARY[index].layers(variant).map((layer):Readonly<SoundLayer>=>{
    const gain=layer.gain*(.96+random()*.08),delay=layer.delay*(.98+random()*.04);
    if(layer.kind==='sample'){
      const rate=layer.rate*pitch/Math.pow(weight,.32);
      return Object.freeze({...layer,rate,gain,delay,cutoff:Math.min(16000,layer.cutoff*brightness),duration:SOUND_SAMPLES[layer.sample]/rate*Math.min(1,tail)});
    }
    const low=layer.frequency<400, shift=pitch*(low?1/Math.sqrt(weight):1);
    return Object.freeze({...layer,gain:gain*(low?Math.sqrt(weight):1),delay,
      duration:layer.duration*(layer.duration>.17?tail:1),
      frequency:layer.frequency*shift*(layer.kind==='noise'?brightness:1),
      end:layer.end*shift*(layer.kind==='noise'?brightness:1)});
  });
  return Object.freeze({seed,layers:Object.freeze(layers),duration:Math.max(...layers.map(l=>l.delay+l.duration))+.04});
}
