import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { CloudClient } from '../src/cloud-client.ts';
import { Simulation } from '../src/simulation.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';
import type { CharacterSave } from '../src/character-save.ts';
import { makeSaveBundle } from '../src/save-bundle.ts';
class BrowserWorker {
  onmessage: ((event: {data:unknown})=>void)|null=null;
  onerror: (()=>void)|null=null;
  private worker=new NodeWorker(new URL('./fixtures/cloud-worker.ts',import.meta.url));
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

test('confirmed conflict deletion removes both branches without requiring a download and preserves recovery on failure',async t=>{
  for (const scenario of ['delete', 'download-first', 'offline', 'signed-out', 'server-race', 'stale-token', 'edit-during-read', 'edit-during-delete', 'lost-response'] as const) {
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
      if(scenario==='download-first')assert.equal(JSON.parse(await client.export(0)).character.id,record.id);
      const result=await client.remove(0,scenario==='stale-token'?'stale':token);
      const success=scenario==='delete'||scenario==='download-first';
      assert.equal(result.ok,success);
      if(success){
        assert.equal(remote,null);assert.equal(client.status,'Synced');
        const empty=await client.read(0);assert.equal(empty.state,'empty');assert.equal(empty.conflict,false);assert.equal(empty.pending,false);
        await assert.rejects(client.export(0),/Select a character/);
        assert.equal(deletes,1);
      }else{
        assert.ok(!result.ok&&result.message);
        const recovery=await client.read(0);assert.equal(recovery.conflict,true);assert.ok(recovery.record);
        if(scenario.startsWith('edit-during'))assert.equal(recovery.record.updatedAt,3);
        else assert.deepEqual(JSON.parse(await client.export(0)).character,before.record);
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
