import { ArtLibrary, drawHumanoid } from './art.ts';
import type { CharacterPose } from './art.ts';
import { World, TILE_SIZE } from './world.ts';
import { Simulation } from './simulation.ts';
import type { CombatEvent, Enemy } from './model.ts';
import { text } from './font.ts';
import type { VisualMode } from './postfx.ts';

interface Particle {x:number;y:number;vx:number;vy:number;z:number;vz:number;life:number;max:number;color:string;size:number;}
interface Popup {x:number;y:number;life:number;max:number;value:string;color:string;size:number;}
interface Corpse {x:number;y:number;angle:number;kind:Enemy['kind'];life:number;seed:number;}
interface Ghost {x:number;y:number;angle:number;life:number;}
export interface RenderSettings {mode:VisualMode;muted:boolean;reducedMotion:boolean;phase:'ready'|'playing'|'paused'|'dead';fps:number;debug:boolean;}

export class Renderer {
  canvas:HTMLCanvasElement;
  ctx:CanvasRenderingContext2D;
  art:ArtLibrary;
  width=960; height=600; hudHeight=88;
  cameraX=0;cameraY=0;pointerX=0;pointerY=0;
  shake=0;hurt=0;
  private particles:Particle[]=[];
  private popups:Popup[]=[];
  private corpses:Corpse[]=[];
  private ghosts:Ghost[]=[];
  private ghostTimer=0;
  private visualTime=0;
  private mapCanvas:HTMLCanvasElement=document.createElement('canvas');
  private mapTime=-1;private mapX=0;private mapY=0;
  private cachedProps:ReturnType<World['getProps']>=[];
  private queryX=Infinity;private queryY=Infinity;
  constructor(){this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d',{alpha:false})!;this.art=new ArtLibrary();this.resize(960,600);}
  resize(width:number,height:number){this.width=Math.round(width);this.height=Math.round(height);this.canvas.width=this.width;this.canvas.height=this.height;this.ctx.imageSmoothingEnabled=false;this.queryX=Infinity;}
  get worldHeight(){return this.height-this.hudHeight;}
  screenToWorld(x:number,y:number){return{x:x-this.width/2+this.cameraX,y:y-this.worldHeight/2+this.cameraY};}
  reset(){this.cameraX=0;this.cameraY=0;this.particles=[];this.popups=[];this.corpses=[];this.ghosts=[];this.hurt=0;this.shake=0;}
  handleEvents(events:CombatEvent[],reducedMotion:boolean){
    for(const e of events){
      const count=e.type==='hit'?12:e.type==='kill'?25:e.type==='hurt'?17:e.type==='cast'?7:e.type==='heal'?18:e.type==='pickup'?5:0;
      const color=e.type==='hurt'?'#b53f32':e.type==='heal'?'#a7cb83':e.type==='kill'?'#a9a485':e.type==='cast'?'#ffad55':'#f8cc82';
      for(let i=0;i<count;i++){
        const angle=(e.angle??0)+(Math.random()-.5)*2.4+(e.type==='kill'?Math.random()*6:0),speed=25+Math.random()*110,life=.22+Math.random()*.38;
        this.particles.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,z:10,vz:20+Math.random()*80,life,max:life,color,size:Math.random()<.7?1:2});
      }
      if(e.type==='hit'&&e.value){this.popups.push({x:e.x+(Math.random()-.5)*14,y:e.y-32,life:.7,max:.7,value:String(Math.round(e.value)),color:e.heavy?'#ffe4a0':'#e5d9b0',size:e.heavy?2:1.5});if(!reducedMotion)this.shake=Math.max(this.shake,e.heavy?3.3:1.7);}
      if(e.type==='hurt'){this.hurt=.8;if(!reducedMotion)this.shake=4;this.popups.push({x:e.x,y:e.y-42,life:.65,max:.65,value:'-'+Math.round(e.value??0),color:'#f1816c',size:2});}
      if(e.type==='heal')this.popups.push({x:e.x,y:e.y-40,life:.8,max:.8,value:'+'+Math.round(e.value??42),color:'#b9d693',size:2});
      if(e.type==='kill')this.corpses.push({x:e.x,y:e.y,angle:e.angle??0,kind:e.enemyKind??'stalker',life:18,seed:Math.random()*100});
    }
    if(this.particles.length>400)this.particles.splice(0,this.particles.length-400);
    if(this.corpses.length>45)this.corpses.splice(0,this.corpses.length-45);
    if(this.popups.length>35)this.popups.splice(0,this.popups.length-35);
  }
  private light(x:number,y:number,radius:number,color:string,power=.3){
    const c=this.ctx;const g=c.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');
    c.save();c.globalCompositeOperation='screen';c.globalAlpha=power;c.fillStyle=g;c.fillRect(x-radius,y-radius,radius*2,radius*2);c.restore();
  }
  render(sim:Simulation,world:World,dt:number,settings:RenderSettings){
    const c=this.ctx,p=sim.player;this.visualTime+=dt;
    this.shake*=Math.exp(-dt*15);this.hurt*=Math.exp(-dt*5);
    const active=settings.phase==='playing';
    if(active){
      const lookX=Math.cos(p.angle)*18,lookY=Math.sin(p.angle)*12;
      this.cameraX+=(p.x+lookX-this.cameraX)*(1-Math.exp(-dt*9));this.cameraY+=(p.y+lookY-18-this.cameraY)*(1-Math.exp(-dt*9));
    }
    for(const particle of this.particles){particle.life-=dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.z+=particle.vz*dt;particle.vz-=180*dt;particle.vx*=1-dt*2;particle.vy*=1-dt*2;}
    for(const popup of this.popups){popup.life-=dt;popup.y-=dt*26;}
    for(const corpse of this.corpses)corpse.life-=active?dt:0;
    for(const ghost of this.ghosts)ghost.life-=dt;
    this.particles=this.particles.filter(x=>x.life>0);this.popups=this.popups.filter(x=>x.life>0);this.corpses=this.corpses.filter(x=>x.life>0);this.ghosts=this.ghosts.filter(x=>x.life>0);
    this.ghostTimer-=dt;if(active&&p.dodgeTime>0&&this.ghostTimer<=0){this.ghostTimer=.025;this.ghosts.push({x:p.x,y:p.y,angle:p.angle,life:.17});}
    c.fillStyle='#10191c';c.fillRect(0,0,this.width,this.height);c.save();c.beginPath();c.rect(0,0,this.width,this.worldHeight);c.clip();
    const shake=settings.reducedMotion?0:this.shake;
    c.translate(Math.round(this.width/2-this.cameraX+(Math.random()-.5)*shake),Math.round(this.worldHeight/2-this.cameraY+(Math.random()-.5)*shake));
    const left=this.cameraX-this.width/2,top=this.cameraY-this.worldHeight/2;
    for(let ty=Math.floor(top/TILE_SIZE);ty<=Math.floor((top+this.worldHeight)/TILE_SIZE);ty++)for(let tx=Math.floor(left/TILE_SIZE);tx<=Math.floor((left+this.width)/TILE_SIZE);tx++)c.drawImage(world.getGroundTile(tx,ty),tx*TILE_SIZE,ty*TILE_SIZE);
    if(Math.abs(this.queryX-this.cameraX)>65||Math.abs(this.queryY-this.cameraY)>65){this.cachedProps=world.getProps(left-240,top-240,this.width+480,this.worldHeight+480);this.queryX=this.cameraX;this.queryY=this.cameraY;}
    // A quiet ash ring is both a compositional anchor and the starting clearing.
    c.strokeStyle='#4b4b3738';c.lineWidth=1;c.setLineDash([2,8]);c.beginPath();c.ellipse(0,0,147,103,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
    for(const corpse of this.corpses){c.save();c.translate(corpse.x,corpse.y);c.rotate(corpse.angle);c.globalAlpha=Math.min(.7,corpse.life/3);c.fillStyle='#201d1a';c.beginPath();c.ellipse(0,0,21,9,0,0,Math.PI*2);c.fill();c.strokeStyle='#77775c';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.moveTo(-8+i*3,Math.sin(i+corpse.seed)*5);c.lineTo(-4+i*3,Math.cos(i+corpse.seed)*6);c.stroke();}c.restore();}
    for(const prop of this.cachedProps){c.fillStyle=prop.kind==='rock'?'#060d0e80':'#060d0e70';c.beginPath();c.ellipse(prop.x+12,prop.y+6,prop.kind==='tree'?32:prop.kind==='deadTree'?21:16,prop.kind==='rock'?7:12,-.35,0,Math.PI*2);c.fill();}
    for(const enemy of sim.enemies)this.telegraph(enemy);
    for(const pickup of sim.pickups){const pulse=1+Math.sin(this.visualTime*4+pickup.id)*.15;this.light(pickup.x,pickup.y,20,pickup.kind==='health'?'#9e422f':'#538ca2',.32);c.save();c.translate(pickup.x,pickup.y-4-Math.sin(this.visualTime*3+pickup.id)*2);c.rotate(Math.PI/4);c.fillStyle=pickup.kind==='health'?'#d17c5c':'#85bdc6';c.fillRect(-2*pulse,-2*pulse,4*pulse,4*pulse);c.restore();}
    for(const ghost of this.ghosts){c.save();c.globalAlpha=ghost.life/.17*.22;c.translate(ghost.x,ghost.y);drawHumanoid(c,{kind:'player',angle:ghost.angle,time:this.visualTime,moving:1,attack:0,attackAngle:ghost.angle,combo:1,hitFlash:0,dodging:true});c.restore();}
    const entries:Array<{y:number;draw:()=>void}>=this.cachedProps.map(prop=>({y:prop.y,draw:()=>{
      const sprite=prop.kind==='tree'||prop.kind==='deadTree'?this.art.getTree(prop.seed,prop.kind==='deadTree'):prop.kind==='rock'?this.art.getRock(prop.seed):this.art.getShrine();
      const wind=settings.reducedMotion?0:Math.sin(this.visualTime*.8+prop.seed)*.7;
      const occludes=(prop.kind==='tree'||prop.kind==='deadTree')&&p.y<prop.y+8&&p.y>prop.y-sprite.height*prop.scale&&Math.abs(p.x-prop.x)<sprite.width*prop.scale*.38;
      c.save();if(occludes)c.globalAlpha=.38;
      c.drawImage(sprite.image,Math.round(prop.x-sprite.anchorX*prop.scale+wind),Math.round(prop.y-sprite.anchorY*prop.scale),sprite.width*prop.scale,sprite.height*prop.scale);c.restore();
    }}));
    for(const enemy of sim.enemies)if(enemy.hp>0)entries.push({y:enemy.y,draw:()=>this.actor(enemy.x,enemy.y,{kind:enemy.kind,angle:enemy.angle,time:sim.time+enemy.id,moving:Math.min(1,Math.hypot(enemy.vx,enemy.vy)/70),attack:enemy.state==='windup'?-.35:enemy.state==='attack'?Math.min(1,enemy.stateTime/enemy.stateDuration):0,attackAngle:enemy.attackAngle,combo:1,hitFlash:enemy.hitFlash,dodging:false})});
    entries.push({y:p.y,draw:()=>{c.save();if(p.dead)c.globalAlpha=.4;this.actor(p.x,p.y,{kind:'player',angle:p.castTime>0?p.castAngle:p.angle,time:p.walkTime??sim.time,moving:Math.min(1,Math.hypot(p.vx,p.vy)/130),attack:p.attack?p.attack.elapsed/p.attack.duration:0,attackAngle:p.attack?.angle??p.angle,combo:p.attack?.combo??1,hitFlash:p.invulnerable>0&&p.dodgeTime<=0?.025:0,dodging:p.dodgeTime>0});c.restore();}});
    entries.sort((a,b)=>a.y-b.y);for(const e of entries)e.draw();
    for(const prop of this.cachedProps)if(prop.kind==='shrine'){
      const flicker=1+Math.sin(this.visualTime*5+prop.seed)*.04;this.light(prop.x-8,prop.y-28,117*flicker,'#b07129',.5);
      c.fillStyle='#ffe4a0';c.fillRect(prop.x-10,prop.y-33,3,6);
    }
    this.light(p.x,p.y-14,92,'#8d703a',.17);
    if(p.healFlash>0)this.light(p.x,p.y-10,74,'#9dcc77',p.healFlash*.5);
    if(p.castTime>.145){const charge=Math.max(.15,(.22-p.castTime)/.075),x=p.x+Math.cos(p.castAngle)*15,y=p.y-15+Math.sin(p.castAngle)*9;this.light(x,y,45,'#ed9e4d',charge*.55);c.fillStyle='#ffe4a4';c.beginPath();c.arc(x,y,1+charge*3,0,Math.PI*2);c.fill();}
    if(p.attack){const a=p.attack,progress=Math.min(1,a.elapsed/a.activeEnd);if(a.elapsed>a.activeStart*.55&&a.elapsed<a.activeEnd+.11){
      const life=1-Math.max(0,a.elapsed-a.activeEnd)/.11,start=a.angle+(a.combo===2?.5:-.5)*a.arc,direction=a.combo===2?-1:1,end=start+a.arc*progress*direction;
      if(a.elapsed>=a.activeStart){c.save();c.globalAlpha=life*.3;c.strokeStyle='#f3bd6f';c.lineWidth=8;c.beginPath();c.arc(p.x,p.y,a.range,a.angle-a.arc/2,a.angle+a.arc/2);c.stroke();c.restore();}
      c.save();c.globalAlpha=life;c.lineCap='round';c.strokeStyle='#d88b4260';c.lineWidth=a.combo===3?13:8;c.beginPath();c.arc(p.x,p.y,a.range*.88,Math.min(start,end),Math.max(start,end));c.stroke();
      c.strokeStyle='#f8d790';c.lineWidth=a.combo===3?4:2.5;c.beginPath();c.arc(p.x,p.y,a.range,Math.min(start,end),Math.max(start,end));c.stroke();c.strokeStyle='#fff4c6';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,a.range+2,Math.min(start,end),Math.max(start,end));c.stroke();c.restore();this.light(p.x+Math.cos(a.angle)*30,p.y+Math.sin(a.angle)*30,72,'#d99a4a',.22);
    }}
    for(const shot of sim.projectiles){
      const friendly=shot.owner==='player',color=friendly?'#ffbc64':'#9cddb7';this.light(shot.x,shot.y,43,friendly?'#cd772d':'#4c8d79',.42);
      c.strokeStyle=friendly?'#cf663a88':'#548d7688';c.lineWidth=friendly?5:3;c.beginPath();c.moveTo(shot.x-Math.cos(shot.angle)*22,shot.y-Math.sin(shot.angle)*22);c.lineTo(shot.x,shot.y);c.stroke();c.fillStyle=color;c.beginPath();c.arc(shot.x,shot.y,shot.radius,0,Math.PI*2);c.fill();c.fillStyle='#fff1ba';c.fillRect(shot.x-1,shot.y-1,2,2);
    }
    for(const particle of this.particles){c.globalAlpha=Math.min(1,particle.life/particle.max*1.8);c.fillStyle=particle.color;c.fillRect(Math.round(particle.x),Math.round(particle.y-Math.max(0,particle.z)),particle.size,particle.size*1.4);}c.globalAlpha=1;
    // Ambient motes are derived from world coordinates; density remains bounded.
    for(let i=0;i<24;i++){const x=left+((i*137.3+Math.sin(this.visualTime*.15+i)*22+this.cameraX*.2)%this.width+this.width)%this.width;const y=top+((i*87.7+Math.cos(this.visualTime*.2+i)*17+this.cameraY*.2)%this.worldHeight+this.worldHeight)%this.worldHeight;c.globalAlpha=.08+Math.max(0,Math.sin(i*7+this.visualTime*.6))*.38;c.fillStyle=i%3?'#c1b67b':'#c3d4aa';c.fillRect(x,y,1,1);}c.globalAlpha=1;
    for(const enemy of sim.enemies)if(enemy.hp>0&&(enemy.hp<enemy.maxHp||enemy.state==='windup')){const width=enemy.kind==='brute'?34:25,y=enemy.y-(enemy.kind==='brute'?53:43);c.fillStyle='#080c0e';c.fillRect(enemy.x-width/2-1,y-1,width+2,4);c.fillStyle='#704639';c.fillRect(enemy.x-width/2,y,width,2);c.fillStyle=enemy.kind==='caster'?'#9baa7a':'#c19562';c.fillRect(enemy.x-width/2,y,width*enemy.hp/enemy.maxHp,2);}
    for(const popup of this.popups){c.globalAlpha=Math.min(1,popup.life/.18);text(c,popup.value,popup.x+1,popup.y+1,popup.size,'#101516','center');text(c,popup.value,popup.x,popup.y,popup.size,popup.color,'center');}c.globalAlpha=1;
    c.restore();
    const vignette=c.createRadialGradient(this.width/2,this.worldHeight*.46,this.worldHeight*.12,this.width/2,this.worldHeight*.46,this.width*.65);vignette.addColorStop(0,'#030a1000');vignette.addColorStop(1,'#03081083');c.fillStyle=vignette;c.fillRect(0,0,this.width,this.worldHeight);
    this.hud(sim,world,settings);
    if(settings.phase==='playing')this.cursor();
  }
  private actor(x:number,y:number,pose:CharacterPose){const c=this.ctx;c.fillStyle='#050c0e80';c.beginPath();c.ellipse(x,y+2,pose.kind==='brute'?17:11,pose.kind==='brute'?8:5,0,0,Math.PI*2);c.fill();c.save();c.translate(x,y);drawHumanoid(c,pose);c.restore();}
  private telegraph(e:Enemy){
    if(e.state!=='windup'&&e.state!=='attack')return;const c=this.ctx,t=e.state==='attack'?1:Math.min(1,e.stateTime/Math.max(.01,e.stateDuration));c.save();
    if(e.kind==='caster'){const range=290;c.strokeStyle=`rgba(149,188,143,${.12+t*.35})`;c.lineWidth=1;c.setLineDash([3,5]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+Math.cos(e.attackAngle)*range,e.y+Math.sin(e.attackAngle)*range);c.stroke();c.setLineDash([]);this.light(e.x,e.y-26,40,'#80b398',t*.35);}
    else{const range=e.kind==='brute'?48:28,arc=e.kind==='brute'?Math.PI*1.25:Math.PI*.7;c.fillStyle=`rgba(221,127,62,${.035+t*.13})`;c.strokeStyle=`rgba(230,170,87,${.22+t*.6})`;c.lineWidth=e.kind==='brute'?1.5:1;c.beginPath();c.moveTo(e.x,e.y);c.arc(e.x,e.y,range,e.attackAngle-arc/2,e.attackAngle+arc/2);c.closePath();c.fill();c.stroke();if(e.kind==='brute'){c.strokeStyle='#f0b55c';c.beginPath();c.arc(e.x,e.y,range*(.4+t*.6),e.attackAngle-arc/2,e.attackAngle+arc/2);c.stroke();}}
    c.restore();
  }
  private hud(sim:Simulation,world:World,settings:RenderSettings){
    const c=this.ctx,p=sim.player,w=this.width,y=this.worldHeight;
    text(c,'EVERGROWING',24,22,2,'#dad0aa');text(c,'DEADWOOD',24,45,1.1,'#849081');c.fillStyle='#8d744b';c.fillRect(24,61,36,1);
    text(c,'THE FIRST CLEARING',24,72,1,'#707e75');
    text(c,String(sim.kills).padStart(2,'0')+' SLAIN',w/2,23,1.2,'#c3ad7b','center');
    if(sim.kills===0&&sim.time<14&&settings.phase==='playing')text(c,'FOLLOW THE LANTERN. HOLD YOUR GROUND.',w/2,this.worldHeight-33,1,'#a6a38b','center');
    const mw=104,mh=79,mx=w-mw-22,my=21;
    c.fillStyle='#080e10db';c.fillRect(mx,my,mw,mh);c.strokeStyle='#76623c';c.lineWidth=1;c.strokeRect(mx+.5,my+.5,mw,mh);
    c.save();c.beginPath();c.rect(mx+3,my+3,mw-6,mh-6);c.clip();
    const zoom=.085;
    if(this.visualTime-this.mapTime>.5){this.mapTime=this.visualTime;this.mapX=p.x;this.mapY=p.y;this.mapCanvas.width=mw;this.mapCanvas.height=mh;const map=this.mapCanvas.getContext('2d')!;for(let ix=0;ix<mw;ix+=4)for(let iy=0;iy<mh;iy+=4){const wx=p.x+(ix-mw/2)/zoom,wy=p.y+(iy-mh/2)/zoom;map.fillStyle=world.blocked(wx,wy,1)?'#344030':'#1b2523';map.fillRect(ix,iy,4,4);}}
    c.drawImage(this.mapCanvas,mx,my);
    c.fillStyle='#947849';c.fillRect(mx+mw/2+(-85-this.mapX)*zoom-2,my+mh/2+(-95-this.mapY)*zoom-2,4,4);
    for(const enemy of sim.enemies)if(enemy.hp>0){c.fillStyle=enemy.kind==='brute'?'#d39365':'#976452';c.fillRect(mx+mw/2+(enemy.x-this.mapX)*zoom-1,my+mh/2+(enemy.y-this.mapY)*zoom-1,2,2);}
    c.fillStyle='#eadb9d';c.fillRect(mx+mw/2+(p.x-this.mapX)*zoom-1,my+mh/2+(p.y-this.mapY)*zoom-1,3,3);c.restore();text(c,'N',mx+mw/2,my-11,1,'#b8a47b','center');
    const fill=c.createLinearGradient(0,y,0,this.height);fill.addColorStop(0,'#10181b');fill.addColorStop(1,'#080d10');c.fillStyle=fill;c.fillRect(0,y,w,this.hudHeight);c.fillStyle='#80643c';c.fillRect(0,y,w,1);c.fillStyle='#2d3025';c.fillRect(0,y+2,w,1);
    const compact=w<760,orbX=compact?48:76,orbR=compact?23:27;
    this.orb(orbX,y+40,orbR,p.hp/p.maxHp,'#ab3e38','#541f27');this.orb(w-orbX,y+40,orbR,p.mana/p.maxMana,'#4e8498','#243e5d');
    text(c,Math.ceil(p.hp)+' / '+p.maxHp,orbX,y+74,1,'#c8927f','center');text(c,Math.floor(p.mana)+' / '+p.maxMana,w-orbX,y+74,1,'#84a4b2','center');
    if(!compact){text(c,'VITALITY',orbX+41,y+30,1,'#a58a76');text(c,'FOCUS',w-orbX-41,y+30,1,'#8a9a9d','right');}
    const sw=56,gap=9,left=w/2-(sw*4+gap*3)/2;
    const slots=[{key:'LMB',name:'CLEAVE',cool:p.attack?p.attack.elapsed/p.attack.duration:1,enabled:true},{key:'RMB',name:'EMBER',cool:1-p.castCooldown/.45,enabled:p.mana>=20},{key:'SPACE',name:'DODGE',cool:p.dodgeCharges>0?1:p.dodgeRecharge/1.8,enabled:p.dodgeCharges>0},{key:'Q',name:'MEND',cool:1-p.healCooldown/.8,enabled:p.flasks>0}];
    slots.forEach((slot,index)=>{const x=left+index*(sw+gap);c.fillStyle='#0b1114';c.fillRect(x,y+10,sw,53);c.strokeStyle=slot.enabled?'#7b6543':'#37403a';c.strokeRect(x+.5,y+10.5,sw,53);c.save();c.globalAlpha=slot.enabled?1:.3;this.icon(index,x+sw/2,y+31);c.restore();if(slot.cool<1){c.fillStyle='#060b11ba';c.fillRect(x+1,y+11,sw-1,Math.max(0,1-slot.cool)*34);}text(c,slot.key,x+sw/2,y+51,1,'#b9b493','center');text(c,slot.name,x+sw/2,y+72,.9,slot.enabled?'#9d9b82':'#535f58','center');if(index===2||index===3){const charges=index===2?p.dodgeCharges:p.flasks;for(let j=0;j<2;j++){c.fillStyle=j<charges?'#cabb80':'#343a31';c.fillRect(x+sw-9,y+16+j*6,3,3);}}});
    if(settings.debug)text(c,`${Math.round(settings.fps)} FPS / ${sim.enemies.length} MOBS / ${Math.round(p.x)},${Math.round(p.y)}`,24,this.worldHeight-15,1,'#91ae92');
  }
  private orb(x:number,y:number,r:number,ratio:number,bright:string,dark:string){const c=this.ctx;c.save();c.fillStyle='#080e12';c.beginPath();c.arc(x,y,r+4,0,Math.PI*2);c.fill();c.strokeStyle='#8f7547';c.lineWidth=1;c.stroke();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();c.fillStyle='#192022';c.fillRect(x-r,y-r,r*2,r*2);const top=y+r-r*2*Math.max(0,ratio);const g=c.createRadialGradient(x-r*.3,y-r*.4,2,x,y,r*1.6);g.addColorStop(0,bright);g.addColorStop(1,dark);c.fillStyle=g;c.fillRect(x-r,top,r*2,r*2);c.strokeStyle=bright;c.lineWidth=1;c.beginPath();c.moveTo(x-r,top);for(let i=0;i<=r*2;i+=2)c.lineTo(x-r+i,top+Math.sin(i*.12+this.visualTime*1.3)*1.2);c.stroke();c.fillStyle='#f1f4da28';c.fillRect(x-r*.38,y-r*.56,5,4);c.restore();c.strokeStyle='#3e4337';c.beginPath();c.arc(x,y,r+1,0,Math.PI*2);c.stroke();}
  private icon(index:number,x:number,y:number){const c=this.ctx;c.save();c.translate(x,y);c.strokeStyle='#d3c393';c.fillStyle='#d3c393';c.lineWidth=2;
    if(index===0){c.rotate(.7);c.beginPath();c.moveTo(-2,9);c.lineTo(-2,-9);c.lineTo(0,-14);c.lineTo(3,-9);c.lineTo(2,9);c.closePath();c.fill();c.fillRect(-7,6,14,2);c.fillRect(-1,8,3,7);}
    if(index===1){c.beginPath();c.moveTo(0,-13);c.lineTo(6,-2);c.lineTo(5,6);c.lineTo(0,10);c.lineTo(-6,5);c.lineTo(-6,-1);c.closePath();c.stroke();c.fillStyle='#e3a85c';c.beginPath();c.moveTo(1,-5);c.lineTo(3,5);c.lineTo(-2,6);c.closePath();c.fill();}
    if(index===2){c.beginPath();c.arc(0,0,10,-2,2.4);c.stroke();c.beginPath();c.moveTo(-10,3);c.lineTo(-6,8);c.lineTo(-3,2);c.stroke();c.strokeStyle='#938565';c.beginPath();c.arc(0,0,5,1,5.4);c.stroke();}
    if(index===3){c.strokeRect(-3,-11,6,5);c.beginPath();c.moveTo(-3,-6);c.lineTo(-7,2);c.lineTo(-5,10);c.lineTo(5,10);c.lineTo(7,2);c.lineTo(3,-6);c.stroke();c.fillStyle='#a56d51';c.fillRect(-4,2,8,6);}
    c.restore();
  }
  private cursor(){const c=this.ctx,x=this.pointerX,y=this.pointerY;if(y>this.worldHeight)return;c.strokeStyle='#ded5a9bb';c.lineWidth=1;c.beginPath();c.moveTo(x-6,y);c.lineTo(x-3,y);c.moveTo(x+3,y);c.lineTo(x+6,y);c.moveTo(x,y-6);c.lineTo(x,y-3);c.moveTo(x,y+3);c.lineTo(x,y+6);c.stroke();c.fillStyle='#f1dfac';c.fillRect(x,y,1,1);}
}
