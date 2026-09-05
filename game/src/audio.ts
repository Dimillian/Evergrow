import type { CombatEvent } from './model.ts';

// Oscillators and filtered noise synthesize every sound; no audio assets.
export class GameAudio {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  async unlock(){
    if(!this.ctx){
      this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=.28;this.master.connect(this.ctx.destination);
      this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);
      const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    }
    if(this.ctx.state==='suspended')await this.ctx.resume();
  }
  setEnabled(value:boolean){this.enabled=value;if(this.master&&this.ctx)this.master.gain.setTargetAtTime(value?.28:0,this.ctx.currentTime,.04);}
  private tone(start:number,end:number,duration:number,volume:number,type:OscillatorType='triangle',delay=0){
    if(!this.ctx||!this.master||!this.enabled)return;
    const time=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(start,time);osc.frequency.exponentialRampToValueAtTime(Math.max(15,end),time+duration);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.006);gain.gain.exponentialRampToValueAtTime(.001,time+duration);
    osc.connect(gain);gain.connect(this.master);osc.start(time);osc.stop(time+duration+.02);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  private hiss(duration:number,frequency:number,volume:number){
    if(!this.ctx||!this.master||!this.noise||!this.enabled)return;
    const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();source.buffer=this.noise;
    filter.type='bandpass';filter.frequency.setValueAtTime(frequency,this.ctx.currentTime);filter.frequency.exponentialRampToValueAtTime(frequency*.35,this.ctx.currentTime+duration);
    gain.gain.setValueAtTime(volume,this.ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start();source.stop(this.ctx.currentTime+duration);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  play(event:CombatEvent){
    switch(event.type){
      case 'swing':this.hiss(event.heavy?.19:.12,1800,event.heavy?.35:.23);this.tone(event.heavy?120:210,55,.12,.12);break;
      case 'hit':this.hiss(.09,1300,.4);this.tone(event.heavy?150:250,45,.12,.25);break;
      case 'kill':this.tone(95,30,.2,.28,'sawtooth');this.hiss(.15,750,.18);break;
      case 'cast':this.tone(180,650,.16,.17,'sawtooth');this.hiss(.25,2500,.2);break;
      case 'hurt':this.tone(120,37,.18,.4,'sawtooth');break;
      case 'dodge':this.hiss(.16,700,.17);break;
      case 'heal':this.tone(330,440,.24,.15);this.tone(550,660,.3,.12,'triangle',.08);break;
      case 'pickup':this.tone(750,950,.075,.07,'sine');break;
    }
  }
}
