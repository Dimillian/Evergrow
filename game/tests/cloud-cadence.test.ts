import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { CloudClient } from '../src/cloud-client.ts';
import { SaveHub } from '../src/save-hub.ts';
import { Simulation } from '../src/simulation.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';
import type { CharacterSave } from '../src/character-save.ts';
import { makeSaveBundle } from '../src/save-bundle.ts';
class BrowserWorker {
  static seedRows: unknown[] = [];
  onmessage: ((event: {data:unknown})=>void)|null=null;
  onerror: (()=>void)|null=null;
  private worker=new NodeWorker(new URL('./fixtures/cloud-worker.ts',import.meta.url), { workerData: { seedRows: BrowserWorker.seedRows } });
  constructor(){this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',()=>this.onerror?.());}
  postMessage(data:unknown){this.worker.postMessage(data);}
  terminate(){void this.worker.terminate();}
}
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function until(check:()=>boolean){const end=Date.now()+3000;while(!check()){if(Date.now()>end)throw new Error('Timed out waiting for cloud worker');await turn();}}
test('durable save bursts upload only the latest checkpoint each window; flush and retries preserve progress',async t=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'Worker');
  Object.defineProperty(globalThis,'Worker',{value:BrowserWorker,configurable:true});
  t.after(()=>{if(old)Object.defineProperty(globalThis,'Worker',old);else Reflect.deleteProperty(globalThis,'Worker');});
  t.mock.timers.enable({apis:['setInterval']});
  const uploads: CharacterSave[]=[];
  let fail=false,requests=0;
  t.mock.method(globalThis,'fetch',async (_url:unknown,options:RequestInit)=>{
    requests++;if(fail)throw new Error('Offline');
    const data=JSON.parse(options.body as string);uploads.push(data.bundle.character);
    return new Response(JSON.stringify({revision:uploads.length}),{status:200});
  });
  const client=new CloudClient('cadence-test');t.after(()=>client.dispose());
  const world={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
  const sim=new Simulation(world,{spawn:false});
  let record:CharacterSave={version:4,id:'cadence',name:'Rowan',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:WORLD_GENERATION_VERSION,checkpoint:sim.captureCheckpoint()};
  let token:string|null=null;
  for(let i=1;i<=12;i++){
    record={...record,updatedAt:i};const saved=await client.write(0,record,token);
    assert.ok(saved.ok);token=saved.token!;
  }
  t.mock.timers.tick(29_999);await turn();assert.equal(requests,0);
  t.mock.timers.tick(1);await until(()=>client.status==='Synced');
  assert.equal(uploads.length,1);assert.equal(uploads[0].updatedAt,12);
  t.mock.timers.tick(30_000);await client.flush();assert.equal(requests,1,'clean slots do not generate server traffic');
  record={...record,updatedAt:13};const saved=await client.write(0,record,token);assert.ok(saved.ok);token=saved.token!;
  await client.flush();assert.equal(uploads.at(-1)?.updatedAt,13,'return to title can flush immediately');
  fail=true;record={...record,updatedAt:14};assert.ok((await client.write(0,record,token)).ok);
  t.mock.timers.tick(30_000);await until(()=>client.status==='Offline');
  fail=false;t.mock.timers.tick(30_000);await until(()=>client.status==='Synced');
  assert.equal(uploads.at(-1)?.updatedAt,14,'failed uploads remain durable until retried');
});

test('confirmed conflict deletion removes both branches preserves recovery on failure',async t=>{
  for (const scenario of ['delete', 'offline', 'signed-out', 'server-race', 'stale-token', 'edit-during-read', 'edit-during-delete', 'lost-response'] as const) {
    await t.test(scenario,async t=>{
      const old=Object.getOwnPropertyDescriptor(globalThis,'Worker');
      Object.defineProperty(globalThis,'Worker',{value:BrowserWorker,configurable:true});
      t.after(()=>{if(old)Object.defineProperty(globalThis,'Worker',old);else Reflect.deleteProperty(globalThis,'Worker');});
      const world={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
      const sim=new Simulation(world,{spawn:false});
      const record:CharacterSave={version:4,id:'delete-conflict',name:'Rowan',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:WORLD_GENERATION_VERSION,checkpoint:sim.captureCheckpoint()};
      const client=new CloudClient('delete-'+scenario);t.after(()=>client.dispose());
      const saved=await client.write(0,record,null);assert.ok(saved.ok);
      let token=saved.token!,remote=makeSaveBundle({...record,updatedAt:2}) as ReturnType<typeof makeSaveBundle>|null;
      let revision=7,reads=0,deletes=0,uploads=0;
      const changeRecovery=async()=>{
        const changed=await client.write(0,{...record,updatedAt:3},token);assert.ok(changed.ok);token=changed.token!;
      };
      t.mock.method(globalThis,'fetch',async (_url:unknown,options:RequestInit)=>{
        if(options.method==='GET'){
          reads++;
          if(scenario==='offline')throw new Error('Offline');
          if(scenario==='signed-out')return Response.json({error:'Sign in again.'},{status:401});
          if(scenario==='edit-during-read')await changeRecovery();
          return Response.json({revision,bundle:remote});
        }
        const data=JSON.parse(options.body as string);
        if(data.bundle!==null){uploads++;return Response.json({error:'Save changed.'},{status:409});}
        deletes++;assert.equal(data.expected,revision,'delete uses the latest cloud revision, not the stale recovery base');
        assert.equal(typeof data.operation,'string');
        assert.ok((await client.read(0)).record,'recovery remains intact while delete is pending');
        if(scenario==='server-race')return Response.json({error:'Save changed.'},{status:409});
        if(scenario==='edit-during-delete')await changeRecovery();
        remote=null;revision++;
        if(scenario==='lost-response'&&deletes===1)throw new Error('Response lost');
        return Response.json({revision});
      });
      await client.flush();assert.equal(client.status,'Conflict');
      const before=await client.read(0);
      const result=await client.remove(0,scenario==='stale-token'?'stale':token);
      const success=scenario==='delete';
      assert.equal(result.ok,success);
      if(success){
        assert.equal(remote,null);assert.equal(client.status,'Synced');
        const empty=await client.read(0);assert.equal(empty.state,'empty');assert.equal(empty.conflict,false);assert.equal(empty.pending,false);
        assert.equal(deletes,1);
      }else{
        assert.ok(!result.ok&&result.message);
        const recovery=await client.read(0);assert.equal(recovery.conflict,true);assert.ok(recovery.record);
        if(scenario.startsWith('edit-during'))assert.equal(recovery.record.updatedAt,3);
        else assert.deepEqual(recovery.record,before.record);
        if(scenario==='stale-token')assert.equal(reads,0);
        if(['offline','signed-out','stale-token','edit-during-read'].includes(scenario))assert.equal(deletes,0);
        if(scenario==='lost-response'){
          assert.equal(remote,null,'server may have committed an unacknowledged delete');
          assert.ok((await client.remove(0,token)).ok,'retry reconciles the deleted cloud slot');
          assert.equal((await client.read(0)).state,'empty');
        }
      }
      await client.flush();assert.equal(uploads,1,'neither deleted nor conflicting recovery is uploaded again');
    });
  }
});

test('Chronicle displays local progress before the network responds without flushing saves',async t=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'Worker');
  Object.defineProperty(globalThis,'Worker',{value:BrowserWorker,configurable:true});
  t.after(()=>{if(old)Object.defineProperty(globalThis,'Worker',old);else Reflect.deleteProperty(globalThis,'Worker');});
  t.mock.timers.enable({apis:['setInterval']});
  const {emptyChronicle,recordChronicle,chronicleValues}=await import('../src/chronicle.ts');
  let respond!:(response:Response)=>void, requests=0;
  t.mock.method(globalThis,'fetch',async (url:unknown,options:RequestInit)=>{
    requests++;assert.equal(options.method,'GET','opening history never uploads a checkpoint');
    assert.equal(url,'/api/cloud/chronicle');
    return await new Promise<Response>(resolve=>{respond=resolve;});
  });
  const client=new CloudClient('chronicle-speed');t.after(()=>client.dispose());
  const world={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
  const sim=new Simulation(world,{spawn:false});
  const record:CharacterSave={version:4,id:'quick-history',name:'Rowan',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:WORLD_GENERATION_VERSION,checkpoint:sim.captureCheckpoint()};
  record.checkpoint.chronicle!.sources[0].values.kills=42;
  assert.ok((await client.write(0,record,null)).ok);
  let shown=false,finished=false;
  const loading=client.chronicle(cached=>{
    assert.equal(chronicleValues(Object.values(cached.sources)).kills,42);
    assert.equal(finished,false);shown=true;
  }).then(ledger=>{finished=true;return ledger;});
  await until(()=>shown&&!!respond);
  assert.equal(finished,false,'cached content is usable while the server is pending');
  respond(Response.json(recordChronicle(emptyChronicle(),record)));
  assert.equal(chronicleValues(Object.values((await loading).sources)).kills,42);
  assert.equal(requests,1);
  assert.equal(client.status,'Saving…','history reads do not claim pending saves are synced');
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('Offline');});
  assert.equal(chronicleValues(Object.values((await client.chronicle()).sources)).kills,42);
});


test('cloud file transfers fail before touching storage or the network',async t=>{
  const hub=new SaveHub();t.after(()=>hub.dispose());
  hub.mode='cloud';
  t.mock.method(globalThis,'fetch',()=>{throw new Error('Unexpected network access');});
  await assert.rejects(hub.export(0),/only available for local saves/);
  const rejected=await hub.import(0,'invalid file must not reach decoding');
  assert.equal(rejected.ok,false);
  if(!rejected.ok)assert.match(rejected.message,/only available for local saves/);
  assert.equal('import' in CloudClient.prototype,false);
  assert.equal('export' in CloudClient.prototype,false);
});

function installWorker(t: import('node:test').TestContext, worker: unknown = BrowserWorker) {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { value: worker, configurable: true });
  t.after(() => { BrowserWorker.seedRows = []; if (old) Object.defineProperty(globalThis, 'Worker', old); else Reflect.deleteProperty(globalThis, 'Worker'); });
}
function recoveryRecord(): CharacterSave {
  const world = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
  return { version: 4, id: 'recovery-check', name: 'Rowan', createdAt: 1, updatedAt: 1, worldSeed: 7319,
    worldVersion: WORLD_GENERATION_VERSION, checkpoint: new Simulation(world, { spawn: false }).captureCheckpoint() };
}
test('a missing save worker returns unavailable slots and offers reload, with no false Synced or unhandled startup rejection', async t => {
  class MissingWorker {
    onerror?: () => void;
    postMessage() { queueMicrotask(() => this.onerror?.()); }
    terminate() {}
  }
  installWorker(t, MissingWorker);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Worker failure must stop requests'); });
  const client = new CloudClient('missing-worker'); t.after(() => client.dispose());
  assert.ok((await client.list()).every(r => r.state === 'unavailable'));
  assert.equal(client.status, 'Reload required');
  assert.match(client.message, /Reload/);
  assert.equal((await client.write(0, recoveryRecord(), null)).ok, false);
  await client.flush(); assert.equal(client.status, 'Reload required');
  // A transient worker failure can be retried without resetting browser storage.
  Object.defineProperty(globalThis, 'Worker', { value: BrowserWorker, configurable: true });
  await client.retryStorage();
  assert.equal((await client.write(0, recoveryRecord(), null)).ok, true);
});
test('blocked browser storage is distinguished from a missing worker and from being offline', async t => {
  class BlockedWorker {
    onmessage?: (e: { data: unknown }) => void;
    postMessage(data: { id: number }) { queueMicrotask(() => this.onmessage?.({ data: { id: data.id, error: 'Enable browser storage.', errorKind: 'storage' } })); }
    terminate() {}
  }
  installWorker(t, BlockedWorker);
  const client = new CloudClient('blocked-storage'); t.after(() => client.dispose());
  assert.ok((await client.list()).every(r => r.state === 'unavailable'));
  assert.equal(client.status, 'Storage unavailable');
  assert.match(client.message, /Enable browser storage/);
});
test('one rejected save never prevents another slot from being created and uploaded; roster reads never flush', async t => {
  installWorker(t);
  const uploads: number[] = [];
  let failure = 422;
  t.mock.method(globalThis, 'fetch', async (url: unknown, options: RequestInit) => {
    if (url === '/api/cloud/characters') return Response.json({ slots: Array.from({ length: 8 }, (_, index) => ({ index, revision: 0, summary: null })) });
    if (options.method === 'GET') return Response.json({ revision: 0, bundle: null });
    const index = Number(String(url).split('/').at(-1)); uploads.push(index);
    if (index === 0) return new Response('<html>Server rejected this checkpoint</html>', { status: failure });
    return Response.json({ revision: 1 });
  });
  const client = new CloudClient('isolated-upload'); t.after(() => client.dispose());
  assert.ok((await client.write(0, recoveryRecord(), null)).ok);
  assert.equal((await client.list())[1].state, 'empty'); assert.deepEqual(uploads, []);
  const empty = await client.read(1);
  assert.ok((await client.write(1, { ...recoveryRecord(), id: 'new-character' }, empty.token)).ok);
  await client.flush(); assert.deepEqual(uploads, [0, 1]);
  assert.equal(client.status, 'Save needs attention');
  assert.equal((await client.list())[1].pending, undefined);
  assert.equal(client.statusForSlot(1).status, 'Synced', 'another slot’s failure must not label the active character unsaved');
  assert.equal(client.statusForSlot(0).status, 'Save needs attention');
  assert.match(client.message, /Slot 1:/);
  assert.equal(client.status, 'Save needs attention', 'a successful roster read cannot hide a rejected upload');
  failure = 503; await client.flush(); assert.equal(client.status, 'Cloud unavailable');
  assert.deepEqual(uploads, [0, 1, 0], 'the acknowledged new character is not uploaded again');
});
test('an incompatible cached character does not hide the roster or block new saves in another slot', async t => {
  const bundle = makeSaveBundle(recoveryRecord());
  (bundle.character as unknown as { version: number }).version = 3;
  bundle.character.checkpoint.character.skillPoints = 999;
  BrowserWorker.seedRows = [{ index: 0, token: '1', base: 4, dirty: true, conflict: false, operation: 'invalid-old-save', bundle }];
  installWorker(t);
  const uploads: number[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, options: RequestInit) => {
    if (url === '/api/cloud/characters') return Response.json({ slots: Array.from({ length: 8 }, (_, index) => ({ index, revision: index ? 0 : 4, summary: null })) });
    if (options.method === 'GET') return Response.json({ revision: 0, bundle: null });
    uploads.push(Number(String(url).split('/').at(-1))); return Response.json({ revision: 1 });
  });
  const client = new CloudClient('invalid-cache'); t.after(() => client.dispose());
  const roster = await client.list(); assert.equal(roster[0].state, 'invalid'); assert.equal(roster[1].state, 'empty');
  const invalid = await client.read(0); assert.equal(invalid.state, 'invalid'); assert.equal(invalid.token, '1');
  const empty = await client.read(1);
  assert.ok((await client.write(1, recoveryRecord(), empty.token)).ok);
  await client.flush(); assert.deepEqual(uploads, [1]);
  assert.equal((await client.read(0)).state, 'invalid', 'the incompatible recovery remains preserved');
});

test('an idle upload timer cannot claim Synced after roster access failed', async t => {
  installWorker(t);
  let fail = true;
  t.mock.method(globalThis, 'fetch', async () => fail ? new Response('Unavailable', { status: 503 })
    : Response.json({ slots: Array.from({ length: 8 }, (_, index) => ({ index, revision: 0, summary: null })) }));
  const client = new CloudClient('roster-outage'); t.after(() => client.dispose());
  await client.list(); assert.equal(client.status, 'Cloud unavailable');
  await client.flush(); assert.equal(client.status, 'Cloud unavailable');
  fail = false; await client.list(); assert.equal(client.status, 'Synced');
});

test('cloud-first inspection preserves a divergent recovery and requires an explicit branch choice to play', async t => {
  installWorker(t);
  const local = recoveryRecord(), remote = {...local, name:'Remote Rowan', updatedAt:200, checkpoint:{...local.checkpoint, time:7200}};
  BrowserWorker.seedRows=[{index:0, token:'4', base:3, dirty:true, conflict:false, operation:'pending-old-progress', bundle:makeSaveBundle(local)}];
  let puts=0;
  t.mock.method(globalThis,'fetch',async (url:unknown,options:RequestInit)=>{
    if(options.method==='PUT'){puts++;throw new Error('Inspection must never upload');}
    if(String(url).endsWith('/characters'))return Response.json({slots:[{index:0,revision:7,summary:{name:remote.name,level:remote.checkpoint.level,power:1,updatedAt:remote.updatedAt}}]});
    return Response.json({revision:7,bundle:makeSaveBundle(remote)});
  });
  const client=new CloudClient('cloud-first-choice');t.after(()=>client.dispose());
  assert.equal((await client.list())[0].summary?.name,remote.name);
  const view=await client.inspect(0);
  assert.equal(view.record?.name,remote.name);assert.equal(view.recovery?.record?.name,local.name);
  assert.equal(view.conflict,true);assert.equal(view.cloudState,'cloud');assert.equal(puts,0);
  const {CharacterSession}=await import('../src/character-session.ts');
  const session=new CharacterSession(client,WORLD_GENERATION_VERSION);
  assert.equal(await session.load(0),null,'ordinary Continue cannot launch a hidden recovery');
  assert.equal(session.active,null);
  assert.equal(await session.load(0,'stale-token'),null);
  assert.equal((await session.load(0,view.token!))?.name,local.name,'only an explicit matching recovery choice can play that branch');
  session.active = null;
  await client.useCloud(0,view.token);
  const resolved=await client.inspect(0);
  assert.equal(resolved.record?.name,remote.name);assert.equal(resolved.pending,false);assert.equal(resolved.conflict,false);
  assert.equal((await session.load(0))?.name,remote.name);assert.equal(puts,0);
});

test('Continue checks the server even when a previously displayed device save is pending',async t=>{
  installWorker(t);const local=recoveryRecord();
  BrowserWorker.seedRows=[{index:0,token:'2',base:3,dirty:true,conflict:false,operation:'pending-operation',bundle:makeSaveBundle(local)}];
  let revision=3;
  t.mock.method(globalThis,'fetch',async()=>Response.json({revision,bundle:makeSaveBundle({...local,name:'Cloud',updatedAt:9})}));
  const client=new CloudClient('continue-check');t.after(()=>client.dispose());
  const before=await client.inspect(0);assert.equal(before.cloudState,'pending');assert.equal(before.record?.name,local.name);
  revision=4;
  const {CharacterSession}=await import('../src/character-session.ts');
  const session=new CharacterSession(client,WORLD_GENERATION_VERSION);
  assert.equal(await session.load(0),null);assert.equal(session.active,null);assert.match(session.error,/cloud save/);
  const view=await client.inspect(0);assert.equal(view.record?.name,'Cloud');assert.equal(view.recovery?.record?.name,local.name);
});

test('clean cached saves refresh from cloud and failed reads are explicitly marked as device copies',async t=>{
  installWorker(t);const local=recoveryRecord();
  BrowserWorker.seedRows=[{index:0,token:'2',base:3,dirty:false,conflict:false,operation:'',bundle:makeSaveBundle(local)}];
  let offline=false;
  t.mock.method(globalThis,'fetch',async()=>{if(offline)throw new Error('Offline');return Response.json({revision:4,bundle:makeSaveBundle({...local,name:'Fresh Cloud',updatedAt:9})});});
  const client=new CloudClient('clean-refresh');t.after(()=>client.dispose());
  const view=await client.inspect(0);assert.equal(view.record?.name,'Fresh Cloud');assert.equal(view.cloudState,'cloud');
  offline=true;const fallback=await client.inspect(0);assert.equal(fallback.record?.name,'Fresh Cloud');assert.equal(fallback.cloudState,'offline');assert.equal(client.status,'Offline');
});

test('a cloud deletion remains visibly empty while this machine retains its unsent character',async t=>{
  installWorker(t);const local=recoveryRecord();
  BrowserWorker.seedRows=[{index:0,token:'2',base:3,dirty:true,conflict:false,operation:'pending-operation',bundle:makeSaveBundle(local)}];
  t.mock.method(globalThis,'fetch',async()=>Response.json({revision:4,bundle:null}));
  const client=new CloudClient('deleted-cloud');t.after(()=>client.dispose());
  const view=await client.inspect(0);assert.equal(view.state,'empty');assert.equal(view.record,null);assert.equal(view.recovery?.record?.id,local.id);assert.equal(view.conflict,true);
  await client.useCloud(0,view.token);assert.equal((await client.read(0)).state,'empty');
});

test('an incompatible recovery cannot hide or prevent choosing a valid newer cloud save',async t=>{
  installWorker(t);const local=recoveryRecord(),broken=makeSaveBundle(structuredClone(local));broken.character.checkpoint.character.skillPoints=999;
  BrowserWorker.seedRows=[{index:0,token:'2',base:3,dirty:true,conflict:false,operation:'pending-operation',bundle:broken}];
  t.mock.method(globalThis,'fetch',async()=>Response.json({revision:4,bundle:makeSaveBundle({...local,name:'Valid Cloud'})}));
  const client=new CloudClient('invalid-recovery-choice');t.after(()=>client.dispose());
  const view=await client.inspect(0);assert.equal(view.record?.name,'Valid Cloud');assert.equal(view.recovery?.invalid,true);assert.equal(view.recovery?.record,null);
  await client.useCloud(0,view.token);assert.equal((await client.read(0)).record?.name,'Valid Cloud');
});

test('lost upload receipts reconcile on a read without false conflicts or losing subsequent local progress',async t=>{
  installWorker(t);const old=recoveryRecord(),current={...old,updatedAt:3};
  BrowserWorker.seedRows=[{index:0,token:'3',base:3,dirty:true,conflict:false,operation:'newer-operation',bundle:makeSaveBundle(current),upload:{base:3,operation:'accepted-operation',bundle:makeSaveBundle(old)}}];
  t.mock.method(globalThis,'fetch',async()=>Response.json({revision:4,operation:'accepted-operation',bundle:makeSaveBundle(old)}));
  const client=new CloudClient('lost-receipt');t.after(()=>client.dispose());
  const view=await client.inspect(0);assert.equal(view.record?.updatedAt,3);assert.equal(view.conflict,false);assert.equal(view.pending,true);assert.equal(view.cloudState,'pending');
});


test('an acknowledged upload with a lost response becomes synced when its receipt is read',async t=>{
  installWorker(t);const local=recoveryRecord();
  BrowserWorker.seedRows=[{index:0,token:'2',base:3,dirty:true,conflict:false,operation:'accepted-operation',bundle:makeSaveBundle(local),upload:{base:3,operation:'accepted-operation',bundle:makeSaveBundle(local)}}];
  t.mock.method(globalThis,'fetch',async()=>Response.json({revision:4,operation:'accepted-operation',bundle:makeSaveBundle(local)}));
  const client=new CloudClient('lost-final-receipt');t.after(()=>client.dispose());
  const view=await client.inspect(0);assert.equal(view.pending,false);assert.equal(view.conflict,false);assert.equal(view.cloudState,'cloud');assert.equal(client.status,'Synced');
});

test('a delayed GET cannot roll back an upload acknowledged while the request was in flight',async t=>{
  installWorker(t);const local=recoveryRecord();
  BrowserWorker.seedRows=[{index:0,token:'2',base:3,dirty:true,conflict:false,operation:'pending-operation',bundle:makeSaveBundle(local)}];
  let release!:()=>void,started!:()=>void;
  const entered=new Promise<void>(resolve=>{started=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
  t.mock.method(globalThis,'fetch',async(_url:unknown,options:RequestInit)=>{
    if(options.method==='PUT')return Response.json({revision:4});
    started();await gate;return Response.json({revision:3,bundle:makeSaveBundle({...local,name:'Old Cloud'})});
  });
  const client=new CloudClient('read-upload-race');t.after(()=>client.dispose());
  const reading=client.inspect(0);await entered;await client.flush();release();
  const view=await reading;assert.equal(view.record?.name,local.name);assert.equal(view.pending,false);assert.equal(view.conflict,false);assert.equal(view.cloudState,'cloud');
});

test('creation refuses conflicted or pending empty slots without replacing recovery state', async t => {
  const { CharacterSession } = await import('../src/character-session.ts');
  for (const conflict of [false, true]) await t.test(conflict ? 'conflict' : 'pending deletion', async t => {
    BrowserWorker.seedRows = [{ index: 0, token: '3', base: 7, dirty: true, conflict, operation: 'pending-deletion', bundle: null }];
    installWorker(t);
    t.mock.method(globalThis, 'fetch', async () => Response.json({ revision: 7, bundle: null }));
    const client = new CloudClient('create-pending-' + conflict); t.after(() => client.dispose());
    const session = new CharacterSession(client, WORLD_GENERATION_VERSION), record = recoveryRecord();
    assert.equal(await session.create(0, 'New', record.worldSeed, record.checkpoint, 'new-character', 2), false);
    assert.match(session.error, /unresolved/);
    assert.equal(session.active, null);
    const after = await client.read(0);
    assert.equal(after.token, '3'); assert.equal(after.record, null); assert.equal(after.conflict, conflict);
    assert.equal((await client.write(0, record, '3')).ok, false, 'storage also rejects a caller bypassing the session guard');
    assert.equal((await client.read(0)).token, '3');
  });
});

test('ordinary and unreadable deletions wait for cloud acknowledgement and keep recovery on failure', async t => {
  for (const scenario of ['success', 'rejected', 'offline', 'lost-response', 'unreadable', 'no-cache', 'concurrent-edit'] as const) await t.test(scenario, async t => {
    const record = recoveryRecord(), bundle = makeSaveBundle(record);
    if (scenario === 'unreadable') bundle.character.checkpoint.character.skillPoints = 999;
    BrowserWorker.seedRows = scenario === 'no-cache' ? [] : [{ index: 0, token: '3', base: 7, dirty: false, conflict: false, operation: '', bundle }];
    installWorker(t);
    const client = new CloudClient('ordinary-delete-' + scenario); t.after(() => client.dispose());
    let revision = 7, remote = true, puts = 0, release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    t.mock.method(globalThis, 'fetch', async (url: unknown, options: RequestInit) => {
      if (options.method === 'GET') {
        assert.match(String(url), /metadata=1/, 'deletion reads revision without decoding the broken checkpoint');
        if (scenario === 'offline') throw new Error('Offline');
        return Response.json({ revision });
      }
      const data = JSON.parse(options.body as string);
      assert.equal(data.bundle, null); assert.equal(data.expected, revision);
      puts++;
      if (puts === 1) await pending;
      if (scenario === 'rejected') return Response.json({ error: 'Previous checkpoint needs recovery.' }, { status: 422 });
      remote = false; revision++;
      if (scenario === 'lost-response' && puts === 1) throw new Error('Response lost');
      return Response.json({ revision });
    });
    const rawRow = () => (client as unknown as { cache(c: object): Promise<import('../src/cloud-cache.ts').CloudRow | null> }).cache({ kind: 'inspect', index: 0 });
    const token = scenario === 'no-cache' ? null : '3';
    const deleting = client.remove(0, token);
    if (scenario !== 'offline') {
      await until(() => puts === 1);
      assert.deepEqual((await rawRow())?.bundle ?? null, scenario === 'no-cache' ? null : bundle);
      if (scenario === 'concurrent-edit') {
        const changed = await client.write(0, { ...record, updatedAt: 3 }, '3'); assert.ok(changed.ok);
      }
      release();
    }
    const result = await deleting;
    assert.equal(result.ok, ['success', 'unreadable', 'no-cache'].includes(scenario));
    const row = (await rawRow())!;
    if (result.ok) { assert.equal(remote, false); assert.equal(row.bundle, null); assert.equal(row.dirty, false); assert.equal(row.conflict, false); assert.equal(row.base, 8); }
    else {
      assert.ok(row.bundle, 'a failed or uncertain deletion preserves the original device recovery');
      if (scenario === 'rejected') assert.match(result.message, /Previous checkpoint needs recovery/);
      if (scenario === 'lost-response') { assert.equal(remote, false); assert.ok((await client.remove(0, '3')).ok); }
      if (scenario === 'concurrent-edit') assert.equal(row.bundle.character.updatedAt, 3);
    }
  });
});

test('an unreadable cloud checkpoint remains selectable for confirmed deletion on a fresh browser', async t => {
  installWorker(t);
  let deleted = false;
  t.mock.method(globalThis, 'fetch', async (url: unknown, options: RequestInit) => {
    if (options.method === 'PUT') { deleted = true; return Response.json({ revision: 8 }); }
    return String(url).includes('metadata=1') ? Response.json({ revision: 7 })
      : Response.json({ error: 'The cloud checkpoint is unreadable. Its original data is preserved.' }, { status: 422 });
  });
  const client = new CloudClient('unreadable-fresh-browser'); t.after(() => client.dispose());
  const slot = await client.inspect(0);
  assert.equal(slot.state, 'invalid'); assert.equal(slot.token, null);
  assert.ok((await client.remove(0, slot.token)).ok);
  assert.equal(deleted, true);
});

test('a failed live checkpoint cannot be reported as synced by an idle upload pass', async t => {
  installWorker(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ revision: 1 }));
  const client = new CloudClient('failed-live-checkpoint'); t.after(() => client.dispose());
  const record = recoveryRecord(), first = await client.write(0, record, null); assert.ok(first.ok);
  await client.flush(); assert.equal(client.statusForSlot(0).status, 'Synced');
  const invalid = structuredClone(record); invalid.checkpoint.character.skillPoints = 999;
  assert.equal((await client.write(0, invalid, first.token)).ok, false);
  await client.flush();
  assert.equal(client.statusForSlot(0).status, 'Save needs attention');
  assert.match(client.statusForSlot(0).message, /could not be saved on this device/);
  assert.ok((await client.write(0, record, first.token)).ok);
  assert.equal(client.statusForSlot(0).status, 'Saving…');
});
