import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FramePacer } from '../src/frame-pacer.ts';
import { parseFrameLimit, presentationFps } from '../src/frame-limit.ts';

test('Android presentation accepts 60 frames per second on 60, 90, 120 and 144 Hz displays',()=>{
  for(const hz of [60,90,120,144]){
    const pacer=new FramePacer(60);let count=0;
    for(let i=0;i<hz*10;i++)if(pacer.ready(i*1000/hz))count++;
    assert.equal(count,600,`${hz} Hz`);
  }
});
test('30 FPS presentation accepts the target count on common display refresh rates',()=>{
  for(const hz of [60,90,120,144]){
    const pacer=new FramePacer(30);let count=0;
    for(let i=0;i<hz*10;i++)if(pacer.ready(i*1000/hz))count++;
    assert.equal(count,300,`${hz} Hz`);
  }
});
test('30 FPS stays evenly paced when 60 Hz callbacks jitter around its deadlines',()=>{
  const pacer=new FramePacer(30),accepted:number[]=[];
  const jitter=[0,.4,-.4,.5,-.3,.2];
  for(let i=0;i<120;i++){
    const now=i*1000/60+jitter[i%jitter.length];
    if(pacer.ready(now))accepted.push(now);
  }
  const intervals=accepted.slice(1).map((now,index)=>now-accepted[index]);
  assert.equal(accepted.length,60);
  assert.ok(Math.min(...intervals)>32);
  assert.ok(Math.max(...intervals)<35);
});
test('frame-limit preferences are narrow and Android retains its fixed 60 FPS policy',()=>{
  for(const value of [undefined,null,'display','45','120',60,{},[]]) assert.equal(parseFrameLimit(value),'display');
  assert.equal(parseFrameLimit('60'),'60'); assert.equal(parseFrameLimit('30'),'30');
  assert.equal(presentationFps('display'),null); assert.equal(presentationFps('60'),60); assert.equal(presentationFps('30'),30);
  for(const limit of ['display','60','30'] as const) assert.equal(presentationFps(limit,true),60);
});
test('the 50 ms delta-ceiling rule can discard elapsed time after a delayed 30 FPS frame',()=>{
  const accepted=[0,1000/30,100];
  const elapsed=accepted.slice(1).reduce((total,now,index)=>total+Math.min(.05,(now-accepted[index])/1000),0);
  assert.ok(Math.abs(elapsed-1/12)<1e-9);
  assert.ok(elapsed<(accepted.at(-1)!-accepted[0])/1000);
});
test('60 Hz timestamp jitter does not accidentally halve frame rate',()=>{
  const pacer=new FramePacer();let count=0;
  for(let i=0;i<600;i++)if(pacer.ready(i*1000/60+(i%2 ? -.1 : .1)))count++;
  assert.equal(count,600);
});
test('Frame skipping preserves elapsed time for a fixed 120 Hz simulation clock',()=>{
  const pacer=new FramePacer();let previous=0,accumulator=0,ticks=0;
  for(let i=0;i<=1200;i++){
    const now=i*1000/120;if(!pacer.ready(now))continue;
    accumulator+=(now-previous)/1000;previous=now;
    while(accumulator+1e-9>=1/120){accumulator-=1/120;ticks++;}
  }
  assert.equal(ticks,1200);
});
test('Long suspension resumes once without rendering a catch-up burst',()=>{
  const pacer=new FramePacer();assert.equal(pacer.ready(0),true);
  assert.equal(pacer.ready(60000),true);
  assert.equal(pacer.ready(60001),false);
  assert.equal(pacer.ready(60008),false);
  assert.equal(pacer.ready(60000+1000/60),true);
  assert.equal(pacer.ready(NaN),false);
});
