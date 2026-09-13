export interface TooltipBox { left: number; top: number; right: number; bottom: number; }
/** Prefer adjacent cards; narrow screens stack vertically without covering the parent's terms. */
export function placeExplanation(parent: TooltipBox, width: number, height: number, viewport: { width: number; height: number }, occupied: readonly TooltipBox[]) {
  const gap = 12, margin = 8;
  const clamp = (value: number, max: number) => Math.max(margin, Math.min(max - margin, value));
  const overlap = (a: TooltipBox, b: TooltipBox) => Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left)) * Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  const choices = [
    [parent.right + gap, parent.bottom - height], [parent.left - width - gap, parent.bottom - height],
    [parent.left, parent.top - height - gap], [parent.left, parent.bottom + gap],
  ].map(([x,y], index) => {
    const left = clamp(x, viewport.width-width), top = clamp(y, viewport.height-height);
    const box = {left,top,right:left+width,bottom:top+height};
    return {left,top,score:overlap(box,parent)*10+occupied.reduce((sum,b)=>sum+overlap(box,b),0)+index};
  });
  return choices.sort((a,b)=>a.score-b.score)[0];
}
