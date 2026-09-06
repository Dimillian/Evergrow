import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { CloudClient } from '../src/cloud-client.ts';
import { Simulation } from '../src/simulation.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';
import type { CharacterSave } from '../src/character-save.ts';
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
  let record:CharacterSave={version:3,id:'cadence',name:'Rowan',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:WORLD_GENERATION_VERSION,checkpoint:sim.captureCheckpoint()};
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
