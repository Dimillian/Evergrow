import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneLandscapeLayout, touchMenuLayout, touchMinimapTop, touchWorldActionsTop, type TouchRect } from '../src/touch-layout.ts';

const overlaps=(a:TouchRect,b:TouchRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
test('phone landscape resources and thumb controls remain separate across Safari heights and safe areas',()=>{
  for(const width of [620,667,740,844,852,956]) for(const height of [280,320,390,440]) for(const inset of [0,44,62]) {
    const view={width,height,top:0,left:inset,right:inset,bottom:21};
    const layout=phoneLandscapeLayout(view)!;
    assert.ok(layout);
    const rects=[layout.move,layout.actions,layout.resources,layout.menu.rect,layout.menu.pause,layout.worldActions];
    for(const r of rects) {
      assert.ok(r.x>=inset&&r.x+r.width<=width-inset,`${width}×${height}: horizontal safe area`);
      assert.ok(r.y>=0&&r.y+r.height<=height-view.bottom,`${width}×${height}: visible vertical area`);
    }
    for(let a=0;a<rects.length;a++)for(let b=a+1;b<rects.length;b++)assert.equal(overlaps(rects[a],rects[b]),false);
    assert.ok(layout.menu.rect.x>=inset&&layout.menu.rect.x+layout.menu.rect.width<=width-inset);
    if(layout.menu.mode==='landscape') {
      assert.equal(layout.menu.pause.x,layout.menu.rect.x);
      assert.equal(layout.menu.pause.y,layout.menu.rect.y+52);
      assert.equal(layout.menu.rect.x+4,layout.worldActions.x);
      assert.equal(layout.menu.pause.x+4,layout.worldActions.x);
      const goldBottom=Math.max(8,view.top+48);
      const menuGroupCenter=(layout.menu.rect.y+layout.menu.pause.y+layout.menu.pause.height)/2;
      assert.equal(menuGroupCenter,(goldBottom+layout.worldActions.y)/2);
    }
    assert.ok(Math.abs(layout.resources.x+layout.resources.width/2-width/2)<1e-9);
    assert.ok(Math.abs(layout.worldActions.x+layout.worldActions.width/2-layout.move.x-layout.move.width/2)<1e-9);
    const moveCenter=layout.move.y+layout.move.height/2;
    const attackCenter=layout.actions.y+57+72/2;
    assert.equal(moveCenter,attackCenter,'movement and attack circles share their horizontal axis');
    assert.ok(layout.worldActions.y+layout.worldActions.height+8<=layout.move.y,'world actions retain a visible gap above the movement disc');
    assert.equal(overlaps(layout.menu.rect,layout.actions),false);
    const player={x:width/2-35,y:height/2-35,width:70,height:70};
    for(const r of [layout.move,layout.actions,layout.resources])assert.equal(overlaps(player,r),false,`${width}×${height}: player remains clear`);
  }
});
test('portrait and spacious tablet layouts do not use the compact landscape geometry',()=>{
  for(const [width,height] of [[390,844],[1024,768]])
    assert.equal(phoneLandscapeLayout({width,height,top:0,right:0,bottom:0,left:0}),null);
  assert.ok(phoneLandscapeLayout({width:620,height:400,top:0,right:0,bottom:0,left:0}));
});
test('portrait menu trigger and minimap align just below the target plate',()=>{
  const portrait={width:390,height:844,top:47,right:0,bottom:34,left:0};
  const controlsTop=touchWorldActionsTop(portrait);
  const menu=touchMenuLayout(portrait,controlsTop);
  assert.equal(menu.mode,'portrait'); assert.deepEqual([menu.rect.width,menu.rect.height],[48,48]);
  assert.equal(menu.rect.x,20); assert.equal(menu.pause.x,menu.rect.x);
  assert.equal(menu.rect.x+menu.rect.width/2,24+40/2);
  assert.equal(menu.rect.y,154);
  assert.equal(menu.pause.y,menu.rect.y+52);
  assert.equal(touchMinimapTop(menu),menu.rect.y);
  assert.ok(menu.pause.y+menu.pause.height<controlsTop);
});
test('portrait world actions leave space above the aligned movement and attack circles',()=>{
  for(const view of [
    {width:390,height:844,top:47,right:0,bottom:34,left:0},
    {width:430,height:932,top:59,right:0,bottom:34,left:0},
  ]) {
    const footerClearance=Math.max(96,view.height*.14)+view.bottom;
    const actionTop=view.height-footerClearance-148;
    const moveTop=view.height-footerClearance-108;
    assert.equal(touchWorldActionsTop(view),actionTop-8);
    assert.equal(touchWorldActionsTop(view)+40+8,moveTop);
  }
});
