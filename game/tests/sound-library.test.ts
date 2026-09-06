import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_LIBRARY, SOUND_VARIATIONS, createSoundRecipe } from '../src/sound-library.ts';
import { SoundPlayer, soundWav, type SoundRequest } from '../src/sound-engine.ts';

const request:SoundRequest={id:'sword-sweep',variation:0,tuning:{weight:1,brightness:1,tail:1},space:'dry'};
test('every sound variation is repeatable, finite and bounded at tuning extremes',()=>{
  assert.equal(new Set(SOUND_LIBRARY.map(s=>s.id)).size,SOUND_LIBRARY.length);
  for(const sound of SOUND_LIBRARY) {
    assert.notDeepEqual(createSoundRecipe(sound.id,0),createSoundRecipe(sound.id,1));
    for(let variation=0;variation<SOUND_VARIATIONS;variation++)for(const value of [.5,1,1.6]) {
      const tuning={weight:value,brightness:value,tail:value};
      const recipe=createSoundRecipe(sound.id,variation,tuning);
      assert.deepEqual(recipe,createSoundRecipe(sound.id,variation,tuning));
      assert.ok(Object.isFrozen(recipe.layers));assert.ok(recipe.layers.length<=40);
      assert.ok(recipe.duration>0&&recipe.duration<6);
      for(const layer of recipe.layers){
        for(const value of [layer.duration,layer.gain,layer.delay,layer.attack])assert.ok(Number.isFinite(value));
        if(layer.kind==='sample'){assert.ok(layer.rate>.4&&layer.rate<3);assert.ok(layer.cutoff>0&&layer.cutoff<=16000);}
        else {assert.ok(layer.frequency>=20&&layer.frequency<16000);assert.ok(layer.end>=20&&layer.end<16000);}
        assert.ok(layer.duration>0&&layer.gain>0&&layer.gain<1);assert.ok(layer.delay>=0);
        assert.ok(layer.delay+layer.duration<recipe.duration);
      }
    }
  }
  assert.throws(()=>createSoundRecipe('missing'));
  assert.deepEqual(createSoundRecipe('sword-sweep',Infinity,{weight:NaN,brightness:Infinity,tail:NaN}),createSoundRecipe('sword-sweep'));
});

class Parameter { value=0; setTargetAtTime(){} }
class Node { gain=new Parameter(); threshold=new Parameter();ratio=new Parameter();connect(){}disconnect(){} }
class Source extends Node { onended:(()=>void)|null=null; buffer:AudioBuffer|null=null; started=false;stopped=false;start(){this.started=true;}stop(){this.stopped=true;} }
class Context {
  currentTime=1;state='running';destination=new Node();sources:Source[]=[];
  createGain(){return new Node();} createDynamicsCompressor(){return new Node();}
  createBufferSource(){const source=new Source();this.sources.push(source);return source;}
  async resume(){} async close(){this.state='closed';}
}
const buffer={length:2,numberOfChannels:2,sampleRate:44100,duration:2/44100,getChannelData:(channel:number)=>new Float32Array(channel?[.25,-.25]:[1,-1])} as AudioBuffer;
test('stopping or closing the studio prevents a pending render from becoming audible',async()=>{
  for(const close of [false,true]){
    const ctx=new Context();let resolve!:(value:AudioBuffer)=>void;
    const player=new SoundPlayer(()=>new Promise(r=>resolve=r),()=>ctx as unknown as AudioContext);
    const task=player.play(request);await Promise.resolve();await Promise.resolve();
    if(close)player.dispose();else player.stop();
    resolve(buffer);assert.equal(await task,null);assert.equal(ctx.sources.length,0);player.dispose();
  }
});
test('switching sounds suppresses stale completion and repeat playback reuses the compiled buffer',async()=>{
  const ctx=new Context(),pending:Array<(b:AudioBuffer)=>void>=[];
  const player=new SoundPlayer(()=>new Promise(r=>pending.push(r)),()=>ctx as unknown as AudioContext);
  const first=player.play(request);await Promise.resolve();await Promise.resolve();
  const second=player.play({...request,id:'bone-hit'});await Promise.resolve();await Promise.resolve();
  pending[1](buffer);assert.equal(await second,buffer);pending[0](buffer);assert.equal(await first,null);
  assert.equal(ctx.sources.filter(s=>s.started).length,1);
  for(let i=0;i<20;i++)await player.play({...request,id:'bone-hit'});
  assert.equal(pending.length,2,'repeats reuse the sample');
  const internals=player as unknown as {voices:Set<unknown>};assert.ok(internals.voices.size<=8);
  player.stop();assert.ok(ctx.sources.every(s=>s.stopped));player.dispose();assert.equal(ctx.state,'closed');
});
test('export contains correctly sized interleaved stereo PCM matching the rendered sound',async()=>{
  const wav=soundWav(buffer),data=new DataView(await wav.arrayBuffer());
  assert.equal(wav.type,'audio/wav');assert.equal(wav.size,52);
  assert.equal(data.getUint16(22,true),2);assert.equal(data.getUint32(24,true),44100);assert.equal(data.getUint32(40,true),8);
  assert.deepEqual([44,46,48,50].map(offset=>data.getInt16(offset,true)),[32767,8192,-32768,-8192]);
});

// Source files must remain local PCM WAVs, including on Safari; no Ogg decoding dependency.
test('every sampled layer has a valid local PCM source with matching duration',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {SOUND_SAMPLES}=await import('../src/sound-samples.ts');
  for(const [id,duration] of Object.entries(SOUND_SAMPLES)){
    const bytes=await readFile(new URL(`../src/assets/audio/${id}.wav`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
    assert.equal(bytes.readUInt16LE(20),1);assert.equal(bytes.readUInt16LE(34),16);
    assert.ok(Math.abs(bytes.readUInt32LE(40)/bytes.readUInt32LE(28)-duration)<.00001);
  }
  for(const sound of SOUND_LIBRARY)for(let v=0;v<SOUND_VARIATIONS;v++){
    const recipe=createSoundRecipe(sound.id,v);
    const originalReward=sound.id==='level-up'||sound.id==='item-rare';
    assert.ok(recipe.layers.some(l=>l.kind==='sample')!==originalReward);
    if(sound.family!=='magic'&&sound.id!=='portal-open'&&!originalReward)assert.ok(recipe.layers.every(l=>l.kind==='sample'));
    for(const l of recipe.layers)if(l.kind==='sample')assert.ok(l.sample in SOUND_SAMPLES);
  }
});
