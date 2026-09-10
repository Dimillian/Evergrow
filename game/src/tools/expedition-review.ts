import '../ui-kit.css';
import '../style.css';
import '../typography.css';
import { loadGameFont } from '../font.ts';
import { installUITheme } from '../ui-theme.ts';
import { ExpeditionPanel } from '../expedition-panel.ts';
import { freshExpeditions, createDungeonRun } from '../dungeon-state.ts';
import { newExpeditionRoute, expeditionChoices } from '../expedition-route.ts';
if(!import.meta.env.DEV)throw Error('Local review only');
installUITheme();await loadGameFont();
const params=new URLSearchParams(location.search),mount=document.querySelector<HTMLElement>('#app')!,state=freshExpeditions();
const level=Number(params.get('level')??24),stage=Math.max(0,Math.min(9,Number(params.get('stage')??3))),seed=Number(params.get('seed')??7319);
state.route={...newExpeditionRoute(seed,level,1),cleared:stage,status:params.get('failed')!==null?'failed':'active'};
for(let cleared=0;cleared<stage;cleared++){
  const entries=expeditionChoices({...state.route,cleared,status:'active'});
  const run=createDungeonRun(entries[cleared%entries.length]);run.states.warden.hp=0;run.chestMasks[2]=15;state.runs.push(run);
}
const panel=new ExpeditionPanel(mount,{close:()=>{panel.close();reopen.hidden=false;},enter:async()=>{const status=panel.element.querySelector('[role=status]');if(status)status.textContent='Preview only · Use a settlement table in the game to enter.';return true;}});
panel.element.style.bottom='48px';
panel.open(state,level,seed,'preview');
const reopen=document.createElement('button');reopen.className='ui-button';reopen.textContent='Open expedition preview';reopen.style.cssText='position:fixed;bottom:8px;right:20px';reopen.hidden=true;reopen.onclick=()=>{panel.open(state,level,seed,'preview');reopen.hidden=true;};mount.append(reopen);
if(import.meta.hot)import.meta.hot.dispose(()=>panel.dispose());
