import './typography.css';
import {loadGameFont} from './font.ts';
import {installUITheme} from './ui-theme.ts';
import {drawHumanoid} from './art.ts';
import {UNARMED_WEAPON} from './equipment.ts';
import {headArmor,STARTER_OUTFIT} from './equipment-art.ts';
import {HAIR_STYLES,HAIR_PALETTES,FACIAL_HAIR,ACCESSORIES,DEFAULT_APPEARANCE,type CharacterAppearance} from './appearance-content.ts';
if(!import.meta.env.DEV)throw new Error('Local appearance art review only.');
installUITheme();await loadGameFont();
const params=new URLSearchParams(location.search), kind=params.get('kind')??'accessories';
const page=Math.max(0,Math.min(2,Number(params.get('page')??0)||0));
const catalog=kind==='hair'?HAIR_STYLES.slice(page*8,page*8+8):kind==='beards'?FACIAL_HAIR:ACCESSORIES;
const root=document.querySelector<HTMLElement>('#catalog')!;
root.innerHTML=`<style>body{margin:0;background:#0a141b;color:#d2dbd4;font:16px var(--ui-font)}main{padding:20px;max-width:1200px;margin:auto}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}h1{margin:0;font-size:22px}nav{display:flex;gap:16px}a{color:#a8c3b3}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}article{padding:10px;background:#14232b;border:1px solid #52675e}h2{font-size:15px;margin:0 0 6px;font-weight:400}canvas{width:100%;height:150px;display:block}.controls{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px}.controls label{display:flex;align-items:center;gap:5px}header{flex-wrap:wrap;gap:12px}nav{flex-wrap:wrap;gap:10px}body.eight canvas{height:240px}body.figure canvas{height:220px}body.figure.eight canvas{height:400px}</style><header><h1>${kind==='hair'?'Hairstyles '+(page+1)+'/3':kind==='beards'?'Facial hair':'Accessories'} · front / right / left / back</h1><nav><a href="?kind=accessories">Accessories</a><a href="?kind=beards">Beards</a><a href="?kind=hair&page=0">Hair 1</a><a href="?kind=hair&page=1">Hair 2</a><a href="?kind=hair&page=2">Hair 3</a></nav></header><div class="controls"><label>Directions <select id="directions"><option value="4">Four cardinal</option><option value="8">All eight</option></select></label><label>Hair color <select id="hair-color">${HAIR_PALETTES.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></label><label><input id="helmet" type="checkbox">Helmet</label><label><input id="figure" type="checkbox">Full figure</label></div><section>${catalog.map(p=>`<article><h2>${p.name}</h2><canvas data-id="${p.id}" aria-label="${p.name}, four facings"></canvas></article>`).join('')}</section>`;
const directions=root.querySelector<HTMLSelectElement>('#directions')!;
const hairColor=root.querySelector<HTMLSelectElement>('#hair-color')!;
const helmet=root.querySelector<HTMLInputElement>('#helmet')!;
const figure=root.querySelector<HTMLInputElement>('#figure')!;
directions.value=params.get('directions')==='8'?'8':'4';
hairColor.value=HAIR_PALETTES.some(p=>p.id===params.get('color'))?params.get('color')!:'walnut';
helmet.checked=params.get('helmet')==='1';
figure.checked=params.get('figure')==='1';
function draw(){
  const eight=directions.value==='8';document.body.classList.toggle('eight',eight);document.body.classList.toggle('figure',figure.checked);
  root.querySelector('h1')!.textContent=`${kind==='hair'?'Hairstyles '+(page+1)+'/3':kind==='beards'?'Facial hair':'Accessories'} · ${eight?'all eight directions':'front / right / left / back'}`;
  const angles=eight?[Math.PI/2,0,Math.PI,-Math.PI/2,Math.PI/4,Math.PI*3/4,-Math.PI*3/4,-Math.PI/4]:[Math.PI/2,0,Math.PI,-Math.PI/2];
  const labels=['Front','Right','Left','Back','SE','SW','NW','NE'];
  for(const link of root.querySelectorAll<HTMLAnchorElement>('nav a')) {
    const url=new URL(link.href);url.searchParams.set('directions',directions.value);url.searchParams.set('color',hairColor.value);url.searchParams.set('helmet',helmet.checked?'1':'0');url.searchParams.set('figure',figure.checked?'1':'0');link.href=url.href;
  }
for(const canvas of root.querySelectorAll<HTMLCanvasElement>('canvas')){
  const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  const ctx=canvas.getContext('2d')!;ctx.scale(dpr,dpr);
  const a:CharacterAppearance={...DEFAULT_APPEARANCE,hair:kind==='hair'?canvas.dataset.id as CharacterAppearance['hair']:'crop',hairColor:hairColor.value as CharacterAppearance['hairColor'],skin:'sand',accessory:kind==='accessories'?canvas.dataset.id as CharacterAppearance['accessory']:'none',facialHair:kind==='beards'?canvas.dataset.id as CharacterAppearance['facialHair']:'none'};
  canvas.setAttribute('aria-label',`${catalog.find(p=>p.id===canvas.dataset.id)?.name}, ${eight?'eight':'four'} facings${figure.checked?', full figure':''}${helmet.checked?', helmet':''}`);
  for(const [i,angle]of angles.entries()){
    const rowHeight=rect.height/(eight?2:1),row=Math.floor(i/4),col=i%4;
    ctx.save();
    if(figure.checked){
      const scale=Math.min(rect.width/4/28,(rowHeight-35)/65);
      ctx.translate(rect.width/4*(col+.5),rowHeight*(row+1)-28);ctx.scale(scale,scale);
      drawHumanoid(ctx,{kind:'player',angle,attackAngle:angle,time:0,moving:0,attack:0,hitFlash:0,dodging:false,
        weapon:UNARMED_WEAPON.visual,grip:'one-handed',appearance:a,
        outfit:{head:helmet.checked?STARTER_OUTFIT.head:null,chest:null,shoulders:null,hands:null,legs:null,boots:null,cloak:null}});
    }else{
      const scale=Math.min(rect.width/4/17,(rowHeight-20)/24);
      ctx.translate(rect.width/4*(col+.5),rowHeight*(row+.45));ctx.scale(scale,scale);ctx.translate(0,33);
      headArmor(ctx,helmet.checked?STARTER_OUTFIT.head:null,c=>c,angle,a);
    }
    ctx.restore();
    ctx.fillStyle='#90a69b';ctx.font='11px "Evergrow Numerals", "Pixelify Sans"';ctx.textAlign='center';ctx.fillText(labels[i],rect.width/4*(col+.5),rowHeight*(row+1)-6);
  }
}}
draw();const abort=new AbortController();
for(const control of [directions,hairColor,helmet,figure])control.addEventListener('change',()=>{
  const url=new URL(location.href);url.searchParams.set('directions',directions.value);url.searchParams.set('color',hairColor.value);url.searchParams.set('helmet',helmet.checked?'1':'0');url.searchParams.set('figure',figure.checked?'1':'0');history.replaceState(null,'',url);draw();
},{signal:abort.signal});window.addEventListener('resize',draw,{signal:abort.signal});if(import.meta.hot)import.meta.hot.dispose(()=>abort.abort());
