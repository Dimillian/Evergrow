import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneLandscapeLayout, type TouchRect } from '../src/touch-layout.ts';

const overlaps=(a:TouchRect,b:TouchRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
test('phone landscape resources and thumb controls remain separate across Safari heights and safe areas',()=>{
  for(const width of [667,740,844,852,956]) for(const height of [280,320,390,440]) for(const inset of [0,44,62]) {
    const view={width,height,top:0,left:inset,right:inset,bottom:21};
    const layout=phoneLandscapeLayout(view)!;
    assert.ok(layout);
    const rects=[layout.move,layout.actions,layout.resources];
    for(const r of rects) {
      assert.ok(r.x>=inset&&r.x+r.width<=width-inset,`${width}×${height}: horizontal safe area`);
      assert.ok(r.y>=0&&r.y+r.height<=height-view.bottom,`${width}×${height}: visible vertical area`);
    }
    for(let a=0;a<rects.length;a++)for(let b=a+1;b<rects.length;b++)assert.equal(overlaps(rects[a],rects[b]),false);
    const player={x:width/2-35,y:height/2-35,width:70,height:70};
    for(const r of rects)assert.equal(overlaps(player,r),false,`${width}×${height}: player remains clear`);
  }
});
test('portrait and spacious tablet layouts do not use the compact landscape geometry',()=>{
  for(const [width,height] of [[390,844],[1024,768],[620,400]])
    assert.equal(phoneLandscapeLayout({width,height,top:0,right:0,bottom:0,left:0}),null);
});
