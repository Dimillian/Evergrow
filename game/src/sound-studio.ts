import './ui-kit.css';
import './typography.css';
import './sound-studio.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { SOUND_LIBRARY, SOUND_FAMILIES, SOUND_VARIATIONS, DEFAULT_SOUND_TUNING, type SoundFamily, type SoundTuning } from './sound-library.ts';
import { SoundPlayer, soundWav, type SoundRequest, type SoundSpace } from './sound-engine.ts';

if(!import.meta.env.DEV) throw new Error('Local review only');
installUITheme(); await loadGameFont();
const mount=document.querySelector<HTMLElement>('#sound-studio')!;
const player=new SoundPlayer(), abort=new AbortController(), motion=matchMedia('(prefers-reduced-motion: reduce)');
const colors:Record<SoundFamily,string>={weapons:'#d0b78b',magic:'#a1bcf0',creatures:'#a8bf96',rewards:'#e2c376',utility:'#b6a2d3'};
const params=new URLSearchParams(location.search);
let selected=SOUND_LIBRARY.find(s=>s.id===params.get('sound'))??SOUND_LIBRARY[0];
let variation=0, space:SoundSpace='dry', tuning:SoundTuning={...DEFAULT_SOUND_TUNING}, looping=false, timer=0, animation=0, requestId=0, disposed=false;
let lastBuffer:AudioBuffer|null=null, started=0, exportUrl:string|null=null;
const perSound=new Map<string,SoundTuning>();
mount.innerHTML=`<header class="sound-header"><h1>Sound studio</h1><small>Evergrow · ${SOUND_LIBRARY.length} sounds</small></header>
<div class="sound-layout"><section class="sound-library" aria-label="Sound library"><nav class="sound-tabs" aria-label="Sound categories">
<button data-filter="all" aria-pressed="true">All</button>${Object.entries(SOUND_FAMILIES).map(([id,name])=>`<button data-filter="${id}" aria-pressed="false">${name}</button>`).join('')}</nav>
${Object.entries(SOUND_FAMILIES).map(([family,name])=>`<section class="sound-group" data-family="${family}"><h2>${name}</h2><div class="sound-cards">${SOUND_LIBRARY.filter(s=>s.family===family).map((s,i)=>`<button class="sound-card" data-sound="${s.id}" aria-pressed="false" style="--sound-accent:${colors[s.family]}"><span class="sound-playmark" aria-hidden="true">▶</span><span>${s.name}<small>${String(i+1).padStart(2,'0')}</small></span></button>`).join('')}</div></section>`).join('')}</section>
<aside class="sound-deck" aria-label="Audition controls"><h2 data-title></h2><p class="sound-detail" data-detail></p>
<canvas class="sound-wave" aria-label="Rendered sound waveform" width="760" height="200"></canvas><div class="sound-readout"><span data-variant>Variation 1 / 6</span><span data-duration>—</span></div>
<div class="sound-transport"><button class="ui-button sound-primary" data-action="play">▶ Play</button><button class="ui-button" data-action="loop" aria-pressed="false">Loop</button><button class="ui-button" data-action="stop">Stop</button></div>
<div class="sound-variation"><button class="ui-button" data-action="variation">Next variation</button><button class="ui-button" data-action="reset">Reset sound</button></div>
<p class="sound-section-title">Listen in</p><div class="sound-space">${['dry','woods','crypt'].map(s=>`<button data-space="${s}" aria-pressed="${s==='dry'}">${s==='dry'?'Dry':s==='woods'?'Woodland':'Crypt'}</button>`).join('')}</div>
${[['weight','Weight',.65,1.5],['brightness','Brightness',.55,1.6],['tail','Tail',.5,1.6]].map(([key,label,min,max])=>`<label class="sound-knob"><span>${label}</span><input type="range" data-tune="${key}" min="${min}" max="${max}" step=".05" value="1"><output data-value="${key}">1.00</output></label>`).join('')}
<div class="sound-divider"></div><label class="sound-knob"><span>Volume</span><input aria-label="Playback volume" type="range" data-volume min="0" max="1" step=".05" value=".5"><output data-volume-value>50%</output></label>
<div class="sound-footer"><button class="ui-button" data-action="export">Export WAV</button><button class="ui-button" data-action="copy">Copy settings</button></div>
<p class="sound-status" data-status role="status">Choose a sound to listen.</p><p class="sound-note">Audition palette. No character or save is loaded.</p></aside></div>`;
const el=<T extends HTMLElement>(selector:string)=>mount.querySelector<T>(selector)!;
const status=(message:string,error=false)=>{el('[data-status]').textContent=message;el('[data-status]').dataset.error=String(error);};
const request=():SoundRequest=>({id:selected.id,variation,tuning:{...tuning},space});
function refresh(){
  el('[data-title]').textContent=selected.name;el('[data-detail]').textContent=selected.detail;
  el('[data-variant]').textContent=`Variation ${variation+1} / ${SOUND_VARIATIONS}`;
  for(const card of mount.querySelectorAll<HTMLElement>('[data-sound]'))card.setAttribute('aria-pressed',String(card.dataset.sound===selected.id));
  for(const input of mount.querySelectorAll<HTMLInputElement>('[data-tune]')){
    const key=input.dataset.tune as keyof SoundTuning; input.value=String(tuning[key]);el(`[data-value="${key}"]`).textContent=tuning[key].toFixed(2);
  }
  for(const button of mount.querySelectorAll<HTMLElement>('[data-space]'))button.setAttribute('aria-pressed',String(button.dataset.space===space));
  el('[data-action="loop"]').setAttribute('aria-pressed',String(looping));
  params.set('sound',selected.id);history.replaceState(null,'',`?${params}`);
}
function stop(){requestId++;clearTimeout(timer);cancelAnimationFrame(animation);looping=false;player.stop();refresh();status('Stopped');}
function drawWave(){
  const canvas=el<HTMLCanvasElement>('canvas'),c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);c.strokeStyle='#253840';c.lineWidth=1;c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
  if(!lastBuffer)return;
  const samples=lastBuffer.getChannelData(0),progress=motion.matches?0:Math.min(1,(performance.now()-started)/1000/lastBuffer.duration);
  for(let x=0;x<w;x+=3){
    const from=Math.floor(x/w*samples.length),end=Math.max(from+1,Math.floor((x+3)/w*samples.length));let peak=0;
    for(let i=from;i<end;i++)peak=Math.max(peak,Math.abs(samples[i]));
    c.fillStyle=x/w<progress?colors[selected.family]:'#4a666f';c.fillRect(x,h/2-Math.max(1,peak*h*.48),2,Math.max(2,peak*h*.96));
  }
  if(!motion.matches&&progress<1&&!disposed)animation=requestAnimationFrame(drawWave);
}
async function play(){
  const id=++requestId;clearTimeout(timer);cancelAnimationFrame(animation);
  status('Preparing sound…');
  try{
    const buffer=await player.play(request());
    if(disposed||id!==requestId||!buffer)return;
    lastBuffer=buffer;started=performance.now();el('[data-duration]').textContent=`${buffer.duration.toFixed(2)} s`;
    status(`${selected.name} · ${space==='woods'?'Woodland':space==='crypt'?'Crypt':'Dry'}`);drawWave();
    if(looping)timer=window.setTimeout(()=>void play(),(buffer.duration+.5)*1000);
  }catch(error){if(id===requestId&&!disposed){looping=false;refresh();status(error instanceof Error?error.message:'Audio is unavailable. Try Play again.',true);}}
}
mount.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button)return;
  if(button.dataset.sound){
    perSound.set(selected.id,{...tuning});selected=SOUND_LIBRARY.find(s=>s.id===button.dataset.sound)!;
    tuning={...(perSound.get(selected.id)??DEFAULT_SOUND_TUNING)};variation=0;refresh();void play();
  }else if(button.dataset.filter){
    for(const b of mount.querySelectorAll<HTMLElement>('[data-filter]'))b.setAttribute('aria-pressed',String(b===button));
    for(const group of mount.querySelectorAll<HTMLElement>('[data-family]'))group.hidden=button.dataset.filter!=='all'&&group.dataset.family!==button.dataset.filter;
  }else if(button.dataset.space){space=button.dataset.space as SoundSpace;refresh();void play();}
  else if(button.dataset.action==='play')void play();
  else if(button.dataset.action==='stop')stop();
  else if(button.dataset.action==='loop'){looping=!looping;refresh();if(looping)void play();else clearTimeout(timer);}
  else if(button.dataset.action==='variation'){variation=(variation+1)%SOUND_VARIATIONS;refresh();void play();}
  else if(button.dataset.action==='reset'){tuning={...DEFAULT_SOUND_TUNING};variation=0;refresh();void play();}
  else if(button.dataset.action==='copy')void navigator.clipboard.writeText(JSON.stringify({name:selected.name,...request()},null,2)).then(()=>status('Settings copied')).catch(()=>status('Clipboard unavailable',true));
  else if(button.dataset.action==='export')void (async()=>{
    const snapshot=request();
    try{
      const buffer=await player.buffer(snapshot);if(disposed)return;
      if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=URL.createObjectURL(soundWav(buffer));
      const link=document.createElement('a');link.href=exportUrl;link.download=`evergrow-${snapshot.id}-${snapshot.variation+1}-${snapshot.space}.wav`;link.click();status('WAV exported');
    }catch{if(!disposed)status('Unable to export this sound',true);}
  })();
},{signal:abort.signal});
mount.addEventListener('input',event=>{
  const input=event.target as HTMLInputElement;
  if(input.dataset.tune){const key=input.dataset.tune as keyof SoundTuning;tuning[key]=Number(input.value);el(`[data-value="${key}"]`).textContent=tuning[key].toFixed(2);}
  if(input.hasAttribute('data-volume')){player.setVolume(Number(input.value));el('[data-volume-value]').textContent=`${Math.round(Number(input.value)*100)}%`;}
},{signal:abort.signal});
mount.addEventListener('change',event=>{if((event.target as HTMLElement).hasAttribute('data-tune'))void play();},{signal:abort.signal});
window.addEventListener('keydown',event=>{if(event.key==='Escape')stop();},{signal:abort.signal});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},{signal:abort.signal});
function dispose(){if(disposed)return;disposed=true;clearTimeout(timer);cancelAnimationFrame(animation);abort.abort();player.dispose();if(exportUrl)URL.revokeObjectURL(exportUrl);}
window.addEventListener('pagehide',dispose,{signal:abort.signal});if(import.meta.hot)import.meta.hot.dispose(dispose);
refresh();drawWave();
