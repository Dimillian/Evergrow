import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FramePacer } from '../src/frame-pacer.ts';

test('Android presentation accepts 60 frames per second on 60, 90, 120 and 144 Hz displays',()=>{
  for(const hz of [60,90,120,144]){
    const pacer=new FramePacer(60);let count=0;
    for(let i=0;i<hz*10;i++)if(pacer.ready(i*1000/hz))count++;
    assert.equal(count,600,`${hz} Hz`);
  }
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
