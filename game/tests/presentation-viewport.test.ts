import assert from 'node:assert/strict';
import test from 'node:test';
import { presentationProfile, presentationViewport } from '../src/presentation-viewport.ts';

const desktop = presentationProfile({android:false,coarsePointer:false});
const coarse = presentationProfile({android:false,coarsePointer:true});
const android = presentationProfile({android:true,coarsePointer:false});
const input = {width:844,height:390,visualHeight:372,devicePixelRatio:3,touchActive:true};

test('scale 1 preserves the existing viewport calculation', () => {
  assert.deepEqual(presentationViewport({...input,profile:desktop}), {
    width:844,height:372,
    worldBufferWidth:1350,worldBufferHeight:595,
    uiBufferWidth:2532,uiBufferHeight:1116,
    logicalWidth:1021,logicalHeight:450,
  });
});

test('mobile density expands the logical field by 1.25 without changing physical buffers', () => {
  const baseline=presentationViewport({...input,profile:desktop});
  const mobile=presentationViewport({...input,profile:coarse});
  assert.equal(mobile.logicalWidth,Math.round(baseline.logicalWidth/0.8));
  assert.equal(mobile.logicalHeight,Math.round(baseline.logicalHeight/0.8));
  assert.deepEqual(
    [mobile.width,mobile.height,mobile.worldBufferWidth,mobile.worldBufferHeight,mobile.uiBufferWidth,mobile.uiBufferHeight],
    [baseline.width,baseline.height,baseline.worldBufferWidth,baseline.worldBufferHeight,baseline.uiBufferWidth,baseline.uiBufferHeight],
  );
});

test('Android and coarse-pointer environments select the mobile profile', () => {
  assert.deepEqual(android,coarse);
  assert.equal(android.scale,0.8);
  assert.equal(desktop.scale,1);
});

test('captured presentation density stays stable across input-mode changes', () => {
  const touch=presentationViewport({...input,profile:android,touchActive:true});
  const gamepad=presentationViewport({...input,profile:android,touchActive:false});
  assert.equal(touch.logicalHeight,Math.round(450/0.8));
  assert.deepEqual(gamepad,touch);
  assert.equal(android.scale,0.8);
});
