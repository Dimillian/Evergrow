export interface TouchViewport {
  width: number; height: number;
  top: number; right: number; bottom: number; left: number;
}
export type TouchRect = { x: number; y: number; width: number; height: number };

/** CSS-pixel geometry, independent of world resolution and device pixel density. */
export function phoneLandscapeLayout(view: TouchViewport) {
  if (view.width < 650 || view.height > 500 || view.width <= view.height) return null;
  const left = Math.max(12, view.left), right = Math.max(12, view.right);
  const bottom = Math.max(12, view.bottom + 8);
  const move = {x:left,y:view.height-bottom-96,width:96,height:96};
  const actions = {x:view.width-right-202,y:view.height-bottom-148,width:202,height:148};
  const gapLeft = move.x + move.width + 14, gapRight = actions.x - 14;
  // Touch resource artwork occupies local x=40..480, y=78..171.
  const scale = Math.min(.72, Math.max(0, gapRight-gapLeft) / 440);
  const footer = {x:(gapLeft+gapRight)/2-260*scale,y:view.height-bottom-171*scale,scale};
  const resources = {x:footer.x+40*scale,y:footer.y+78*scale,width:440*scale,height:93*scale};
  return {move,actions,footer,resources,bottom,left,right,top:Math.max(8,view.top+4)};
}
