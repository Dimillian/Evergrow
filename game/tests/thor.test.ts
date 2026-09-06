import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseThorCommand, parseNativePad } from '../src/thor-protocol.ts';
import { ThorCommands, type ThorCommandHost } from '../src/thor-commands.ts';
import { initialPlayer } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { GamepadInput, PAD } from '../src/gamepad-input.ts';
import { thorSnapshot } from '../src/thor-state.ts';
import { freshJourneys } from '../src/journey-state.ts';

test('Thor bridge rejects malformed commands and invalid controller values',()=>{
  for(const raw of [null,'{','[]','{}',JSON.stringify({type:'equip',session:'x',id:''}),JSON.stringify({type:'panel',session:'x',panel:'delete'}),JSON.stringify({type:'zoom',session:'x',factor:99})])assert.equal(parseThorCommand(raw),null);
  assert.deepEqual(parseThorCommand('{"type":"equip","id":"item-1","session":"one"}'),{type:'equip',id:'item-1',session:'one'});
  for(const raw of ['null','{}','{','x'.repeat(4001)])assert.equal(parseNativePad(raw),null);
  const pad={id:'thor',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
  assert.ok(parseNativePad(JSON.stringify(pad)));
  pad.axes[0]=2;assert.equal(parseNativePad(JSON.stringify(pad)),null);
  pad.axes[0]=0;pad.buttons[0].value=-1;assert.equal(parseNativePad(JSON.stringify(pad)),null);
});

test('Native standard snapshots retain controller neutral rearm and action mapping',()=>{
  const source={id:'android:1:Thor',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
  const input=new GamepadInput(),poll=()=>input.poll([parseNativePad(JSON.stringify(source))],true);
  source.buttons[PAD.attack]={pressed:true,value:1};poll();assert.equal(input.gameplay({x:0,y:0}).attack,false);
  source.buttons[PAD.attack]={pressed:false,value:0};poll();
  source.buttons[PAD.attack]={pressed:true,value:1};poll();assert.equal(input.gameplay({x:0,y:0}).attack,true);
  input.clear();poll();assert.equal(input.gameplay({x:0,y:0}).attack,false);
  input.poll([],true);assert.equal(input.disconnected,true);
});

function fixture(){
  const player=initialPlayer(0,0),calls:string[]=[];
  const host:ThorCommandHost={sim:{player},session:{id:'current'},busy:false,phase:'playing',
    resume(){(this as {phase:string}).phase='playing';calls.push('resume');},
    equip(i){calls.push(`equip:${i}`);},panel(p){calls.push(`panel:${p}`);},track(id){calls.push(`track:${id}`);},portal(){calls.push('portal');}};
  player.character.inventory[5]=generateItem(42,1,'weapon');
  const commands=new ThorCommands(host),id=player.character.inventory[5]!.id;
  return {host,commands,calls,id,player};
}
test('Companion rejects stale characters and busy/dead phases without changing state',()=>{
  const {host,commands,calls,id}=fixture();
  commands.command({type:'inspect',id,session:'old'});assert.equal(commands.selection.selected,null);
  for(const phase of ['ready','dead'] as const){(host as {phase:string}).phase=phase;commands.command({type:'panel',panel:'skills',session:'current'});}
  (host as {phase:string}).phase='playing';(host as {busy:boolean}).busy=true;commands.command({type:'inspect',id,session:'current'});
  assert.deepEqual(calls,[]);
});
test('Inspect stays live; equip resolves current identity and never uses stale bag positions',()=>{
  const {commands,calls,id,player,host}=fixture();
  commands.command({type:'equip',id,session:'current'});assert.deepEqual(calls,[]);
  commands.command({type:'inspect',id,session:'current'});assert.equal(host.phase,'playing');
  player.character.inventory[11]=player.character.inventory[5];player.character.inventory[5]=null;
  commands.command({type:'equip',id,session:'current'});assert.deepEqual(calls,['equip:11']);
  player.character.inventory[11]=null;commands.command({type:'equip',id,session:'current'});assert.equal(calls.length,1);
  commands.command({type:'resume',session:'current'});assert.equal(commands.selection.selected,null);
});
test('Companion zoom is bounded and panel changes use the existing phase owner',()=>{
  const {commands,calls}=fixture();
  for(let i=0;i<20;i++)commands.command({type:'zoom',factor:2,session:'current'});
  assert.equal(commands.selection.zoom,.25);
  for(let i=0;i<20;i++)commands.command({type:'zoom',factor:.5,session:'current'});
  assert.equal(commands.selection.zoom,.035);
  commands.command({type:'panel',panel:'skills',session:'current'});assert.deepEqual(calls,['resume','panel:skills']);
});
test('A full companion inventory fits the bounded bridge payload without mutating the character',()=>{
  const player=initialPlayer(0,0);
  player.character.inventory=Array.from({length:64},(_,i)=>generateItem(920+i,30));
  const before=JSON.stringify(player.character);
  const snapshot=thorSnapshot({player,journeys:freshJourneys()},'current','Aster','paused','Deadwood',30,player.character.inventory[0]!.id);
  assert.equal(snapshot.bag.length,64);assert.ok(snapshot.detail?.html);
  assert.ok(JSON.stringify(snapshot).length<250000,'Leave room for the terrain image inside the 400 KB bridge budget');
  assert.equal(JSON.stringify(player.character),before);
});

test('Closing companion inspection clears the primary selection without spending or resuming',()=>{
  const {commands,id,calls,host}=fixture();
  commands.command({type:'inspect',id,session:'current'});
  commands.command({type:'closeInspect',session:'current'});
  assert.equal(commands.selection.selected,null);assert.equal(host.phase,'playing');
  commands.command({type:'equip',id,session:'current'});assert.deepEqual(calls,[]);
});
test('Items inspected while the character window is open can use its equip command',()=>{
  const {commands,id,calls,host}=fixture();
  commands.command({type:'inspect',id,session:'current'});(host as {phase:string}).phase='character';
  commands.command({type:'equip',id,session:'current'});assert.deepEqual(calls,['equip:5']);
});


test('Browsing and inspecting never changes a manually chosen pause state', () => {
  for (const phase of ['playing', 'paused', 'character'] as const) {
    const { host, commands, calls, id } = fixture();
    (host as { phase: string }).phase = phase;
    commands.command({ type: 'inspect', id, session: 'current' });
    commands.command({ type: 'zoom', factor: 1.1, session: 'current' });
    commands.command({ type: 'closeInspect', session: 'current' });
    assert.equal(host.phase, phase); assert.deepEqual(calls, []);
  }
});
test('Live inspection projects details without pausing and disappears when ownership is lost', () => {
  const { player, commands, id } = fixture();
  commands.command({ type: 'inspect', id, session: 'current' });
  const sim = { player, journeys: freshJourneys() };
  assert.equal(thorSnapshot(sim, 'current', 'Test', 'playing', 'Deadwood', 1, commands.selection.selected).detail?.id, id);
  player.character.inventory[5] = null;
  assert.equal(thorSnapshot(sim, 'current', 'Test', 'playing', 'Deadwood', 1, commands.selection.selected).detail, undefined);
});

test('Companion tab visibility is session checked and does not pause gameplay',()=>{
  const {commands,host,calls}=fixture();
  commands.command({type:'tab',tab:'pack',session:'old'});assert.equal(commands.selection.tab,'map');
  commands.command({type:'tab',tab:'pack',session:'current'});assert.equal(commands.selection.tab,'pack');
  (host as {busy:boolean}).busy=true;
  commands.command({type:'tab',tab:'map',session:'current'});assert.equal(commands.selection.tab,'map');
  assert.equal(host.phase,'playing');assert.deepEqual(calls,[]);
  assert.equal(parseThorCommand(JSON.stringify({type:'tab',tab:'pack',session:'current'}))?.type,'tab');
  assert.equal(parseThorCommand(JSON.stringify({type:'tab',tab:'unknown',session:'current'})),null);
});
