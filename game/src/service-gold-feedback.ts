import { RewardFeedback } from './reward-feedback.ts';
import { drawRewardFlights } from './reward-art.ts';

/** Shop presentation only: reuse pickup coins and counter after the trade is durable. */
export class ServiceGoldFeedback {
  private frame = 0;
  private canvas: HTMLCanvasElement | null = null;
  private gain: HTMLElement | null = null;
  private counter: HTMLElement | null = null;
  private balance = 0;
  private readonly panel: HTMLElement;
  constructor(panel: HTMLElement) { this.panel=panel; }
  stop(): void {
    cancelAnimationFrame(this.frame); this.frame = 0;
    if(this.counter?.isConnected)this.counter.textContent=this.balance.toLocaleString();
    this.canvas?.remove(); this.gain?.remove();
    this.canvas=null;this.gain=null;this.counter=null;
  }
  play(amount:number,balance:number,origins:readonly {x:number;y:number}[]):void {
    this.stop(); this.balance=balance;
    const wallet=this.panel.querySelector<HTMLElement>('.service-wallet');
    this.counter=this.panel.querySelector<HTMLElement>('[data-wallet-total]');
    if(!wallet||!this.counter||!(amount>0))return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bounds=this.panel.getBoundingClientRect(), target=wallet.getBoundingClientRect();
    const feedback=new RewardFeedback();feedback.update(balance-amount,0,false);
    feedback.handleEvents([{type:'gold',x:target.x-bounds.x,y:target.y-bounds.y,amount,balance}],reduced);
    if(!reduced){
      const visible=origins.filter(p=>p.x>=bounds.left&&p.x<=bounds.right&&p.y>=bounds.top&&p.y<=bounds.bottom).slice(0,10);
      if(!visible.length)visible.push({x:bounds.x+bounds.width*.5,y:bounds.y+bounds.height*.75});
      feedback.motes.length=0;
      for(let i=0;i<visible.length*3;i++){
        const origin=visible[Math.floor(i/3)];
        feedback.motes.push({x:origin.x-bounds.x,y:origin.y-bounds.y,age:-i*.016,kind:'gold',phase:i*2.4});
      }
      this.canvas=document.createElement('canvas');this.canvas.className='service-gold-flights';this.canvas.setAttribute('aria-hidden','true');
      const dpr=Math.min(2,devicePixelRatio||1);this.canvas.width=Math.ceil(bounds.width*dpr);this.canvas.height=Math.ceil(bounds.height*dpr);
      this.panel.append(this.canvas);
    }
    this.gain=document.createElement('span');this.gain.className='service-gold-gain';this.gain.textContent=`+${amount.toLocaleString()}`;this.gain.setAttribute('aria-hidden','true');wallet.append(this.gain);
    const context=this.canvas?.getContext('2d');const began=performance.now();let last=began;
    const draw=(now:number)=>{
      if(this.panel.hidden||!wallet.isConnected){this.stop();return;}
      feedback.update(balance,Math.min(.1,(now-last)/1000),reduced);last=now;
      this.counter!.textContent=Math.round(feedback.balance).toLocaleString();
      if(context&&this.canvas){
        context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,this.canvas.width,this.canvas.height);
        context.scale(this.canvas.width/bounds.width,this.canvas.height/bounds.height);
        drawRewardFlights(context,feedback,(x,y)=>({x,y}),bounds.width,bounds.height,{hud:{x:0,y:0,scale:1},gold:{x:target.x-bounds.x+target.width*.5,y:target.y-bounds.y+target.height*.5}});
      }
      if(now-began<3200)this.frame=requestAnimationFrame(draw);else this.stop();
    };
    draw(began);
  }
}
