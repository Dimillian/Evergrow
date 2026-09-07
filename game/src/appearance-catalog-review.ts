import './typography.css';
import {loadGameFont} from './font.ts';
import {installUITheme} from './ui-theme.ts';
import {headArmor} from './equipment-art.ts';
import {HAIR_STYLES,FACIAL_HAIR,ACCESSORIES,DEFAULT_APPEARANCE,type CharacterAppearance} from './appearance-content.ts';
if(!import.meta.env.DEV)throw new Error('Local appearance art review only.');
installUITheme();await loadGameFont();
const params=new URLSearchParams(location.search), kind=params.get('kind')??'accessories';
const page=Math.max(0,Math.min(2,Number(params.get('page')??0)||0));
const catalog=kind==='hair'?HAIR_STYLES.slice(page*8,page*8+8):kind==='beards'?FACIAL_HAIR:ACCESSORIES;
const root=document.querySelector<HTMLElement>('#catalog')!;
root.innerHTML=`<style>body{margin:0;background:#0a141b;color:#d2dbd4;font:16px var(--ui-font)}main{padding:20px;max-width:1200px;margin:auto}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}h1{margin:0;font-size:22px}nav{display:flex;gap:16px}a{color:#a8c3b3}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}article{padding:10px;background:#14232b;border:1px solid #52675e}h2{font-size:15px;margin:0 0 6px;font-weight:400}canvas{width:100%;height:150px;display:block}</style><header><h1>${kind==='hair'?'Hairstyles '+(page+1)+'/3':kind==='beards'?'Facial hair':'Accessories'} · front / right / left / back</h1><nav><a href="?kind=accessories">Accessories</a><a href="?kind=beards">Beards</a><a href="?kind=hair&page=0">Hair 1</a><a href="?kind=hair&page=1">Hair 2</a><a href="?kind=hair&page=2">Hair 3</a></nav></header><section>${catalog.map(p=>`<article><h2>${p.name}</h2><canvas data-id="${p.id}" aria-label="${p.name}, four facings"></canvas></article>`).join('')}</section>`;
function draw(){for(const canvas of root.querySelectorAll<HTMLCanvasElement>('canvas')){
  const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  const ctx=canvas.getContext('2d')!;ctx.scale(dpr,dpr);
  const a:CharacterAppearance={...DEFAULT_APPEARANCE,hair:kind==='hair'?canvas.dataset.id as CharacterAppearance['hair']:'crop',hairColor:'walnut',skin:'sand',accessory:kind==='accessories'?canvas.dataset.id as CharacterAppearance['accessory']:'none',facialHair:kind==='beards'?canvas.dataset.id as CharacterAppearance['facialHair']:'none'};
  for(const [i,angle]of [Math.PI/2,0,Math.PI,-Math.PI/2].entries()){
    const scale=Math.min(rect.width/4/17,rect.height/24);ctx.save();ctx.translate(rect.width/4*(i+.5),rect.height*.5);ctx.scale(scale,scale);ctx.translate(0,33);headArmor(ctx,null,c=>c,angle,a);ctx.restore();
  }
}}
draw();const abort=new AbortController();window.addEventListener('resize',draw,{signal:abort.signal});if(import.meta.hot)import.meta.hot.dispose(()=>abort.abort());
