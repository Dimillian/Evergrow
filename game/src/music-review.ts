import { MUSIC_FILES } from './music-content.ts';
import { loadGameFont } from './font.ts';
import './typography.css';
import './music-review.css';

const definitions = [
  ['wilderness', 'Arid wilds', 'Sunscar · Steppe', 'Hand drums · oud · low reeds', '△'],
  ['wilderness-long', 'Arid wilds II', 'Sunscar · Steppe', 'Extended arrangement', '△'],
  ['dark-forest', 'Dark forest', 'Deadwood · Mire', 'Baritone guitar · hanging harmonics', '⌁'],
  ['dark-forest-long', 'Dark forest II', 'Deadwood · Mire', 'Extended arrangement', '⌁'],
  ['verdant-forest', 'Verdant forest', 'Verdant · Amberwood', 'Warm guitar · wooden flute', '♧'],
  ['verdant-forest-long', 'Verdant forest II', 'Verdant · Amberwood', 'Extended arrangement', '♧'],
  ['cold-wilds', 'Cold wilds', 'Frostpine · Highlands', 'Guitar harmonics · bowed psaltery', '◇'],
  ['cold-wilds-2', 'Northern stones', 'Frostpine · Highlands', 'Low strings · hollow wood', '◇'],
  ['ember-wilds', 'Emberfall', 'Emberfall', 'Prepared guitar · bowed bronze', '△'],
  ['ember-wilds-2', 'Ashen road', 'Emberfall', 'Clay drum · creaking strings', '△'],
  ['menu', 'Home', 'Character hall', 'Twelve-string duet', '◇'],
  ['menu-long', 'Home II', 'Character hall', 'Extended arrangement', '◇'],
  ['town', 'Hearth', 'Settlements', 'Warm nylon guitar · low bowed bass', '⌂'],
  ['dungeon', 'Dungeon', 'Crypts', 'Prepared piano · drones · scraping metal', '⌑'],
  ['dungeon-long', 'Dungeon II', 'Crypts', 'Extended arrangement', '⌑'],
  ['event', 'The gathering', 'Major events', 'Ritual drums · uneasy plucked strings', '⌁'],
  ['boss', 'Ancient hunger', 'Boss encounters', 'Deep ritual drums · prepared piano', '⌑'],
];
const tracks = definitions.filter(([id]) => MUSIC_FILES[id]).map(([id, title, subtitle, detail, glyph]) => ({
  id, title, subtitle, detail, glyph, url: MUSIC_FILES[id], duration: ['menu', 'wilderness', 'dungeon', 'dark-forest', 'verdant-forest'].includes(id) ? 60 : 120,
}));
await loadGameFont();
const root=document.querySelector<HTMLElement>('#music-review')!;
root.innerHTML=`<header><a href="/tools/" class="back">← Tools</a><span>EVERGROW</span><h1>Soundtrack studies</h1><p>Regional music · Towns · Dungeons · Encounters</p></header>
<section class="music-grid" aria-label="Music auditions">${tracks.map((track,i)=>`<article class="music-card ${track.id}"><div class="music-art" aria-hidden="true"><span>${track.glyph}</span></div><div class="music-copy"><span class="music-index">${String(i+1).padStart(2,'0')}</span><h2>${track.title}</h2><p class="music-subtitle">${track.subtitle}</p><p class="music-detail">${track.detail}</p></div><div class="music-controls"><button class="music-play" data-track="${i}" aria-label="Play ${track.title}">▶ <span>Listen</span></button><button class="music-restart" data-restart="${i}" aria-label="Replay ${track.title} from the beginning">↺</button><a class="music-download" href="${track.url}" download="evergrow-${track.id}.mp3" aria-label="Download ${track.title}">↓</a></div><div class="music-progress"><input type="range" min="0" max="${track.duration}" step="0.1" value="0" disabled data-seek="${i}" aria-label="Seek ${track.title}"><div><span data-time="${i}">0:00</span><span data-duration="${i}">${track.duration === 60 ? '1:00' : '2:00'}</span></div></div></article>`).join('')}</section>
<footer><label class="music-volume">Volume <input id="volume" type="range" min="0" max="1" step="0.01" value="0.7"></label><span>Original AI-generated soundtrack · Integrated locally</span></footer><p id="music-status" role="status" aria-live="polite"></p>`;

const audio=new Audio();audio.preload='metadata';audio.volume=.7;
let active=-1, request=0;
const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const status=root.querySelector<HTMLElement>('#music-status')!;
function update(){
  for(let i=0;i<tracks.length;i++){
    const playing=i===active&&!audio.paused;
    const button=root.querySelector<HTMLButtonElement>(`[data-track="${i}"]`)!;
    button.innerHTML=playing?'Ⅱ <span>Pause</span>':'▶ <span>Listen</span>';
    button.setAttribute('aria-label',`${playing?'Pause':'Play'} ${tracks[i].title}`);
    button.closest('article')!.classList.toggle('is-playing',playing);
    const seek=root.querySelector<HTMLInputElement>(`[data-seek="${i}"]`)!;
    seek.disabled=i!==active;
    if(i===active){
      seek.max=String(Number.isFinite(audio.duration)?audio.duration:tracks[i].duration);seek.value=String(audio.currentTime);
      root.querySelector(`[data-time="${i}"]`)!.textContent=time(audio.currentTime);
      root.querySelector(`[data-duration="${i}"]`)!.textContent=time(Number(seek.max));
    }
  }
}
async function play(index:number,restart=false){
  const ticket=++request;status.textContent='';
  if(active===index&&!audio.paused&&!restart){audio.pause();return;}
  if(active!==index||audio.error){audio.pause();active=index;audio.src=tracks[index].url+'?revision=2';}
  if(restart)audio.currentTime=0;
  try{await audio.play();}catch{if(ticket===request)status.textContent='Could not play this audition. Please try again.';}
  update();
}
root.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
  if(button.dataset.track!==undefined)void play(Number(button.dataset.track));
  if(button.dataset.restart!==undefined)void play(Number(button.dataset.restart),true);
});
root.addEventListener('input',event=>{
  const input=event.target as HTMLInputElement;
  if(input.id==='volume')audio.volume=Number(input.value);
  if(input.dataset.seek!==undefined&&Number(input.dataset.seek)===active&&Number.isFinite(audio.duration)){audio.currentTime=Number(input.value);update();}
});
for(const event of ['play','pause','timeupdate','loadedmetadata','ended'])audio.addEventListener(event,update);
audio.addEventListener('error',()=>{status.textContent='This audition is unavailable. Please try again.';update();});
window.addEventListener('pagehide',()=>audio.pause());
if(import.meta.hot)import.meta.hot.dispose(()=>{audio.pause();audio.removeAttribute('src');audio.load();});
