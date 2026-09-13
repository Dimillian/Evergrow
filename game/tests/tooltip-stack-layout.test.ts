import test from 'node:test';
import assert from 'node:assert/strict';

test('stacked explanations avoid their parent and viewport edges on desktop and narrow screens', async () => {
  const { placeExplanation } = await import('../src/tooltip-stack-layout.ts');
  for (const width of [390, 1280]) {
    const parent = { left: width/2-124, right: width/2+124, top: 420, bottom: 540 };
    const first = placeExplanation(parent, 248, 190, {width,height:700}, [parent]);
    assert.ok(first.left >= 8 && first.left+248 <= width-8);
    assert.ok(first.top >= 8 && first.top+190 <= 692);
    assert.ok(first.left+248<=parent.left || first.left>=parent.right || first.top+190<=parent.top || first.top>=parent.bottom);
    const child = {left:first.left,right:first.left+248,top:first.top,bottom:first.top+190};
    const next = placeExplanation(child,248,150,{width,height:700},[parent,child]);
    assert.ok(next.left+248<=child.left || next.left>=child.right || next.top+150<=child.top || next.top>=child.bottom);
  }
});
