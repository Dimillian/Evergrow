export interface TouchViewport {
  width: number; height: number;
  top: number; right: number; bottom: number; left: number;
}
export type TouchRect = { x: number; y: number; width: number; height: number };
export type TouchMenuLayout = { rect: TouchRect; pause: TouchRect; mode: 'portrait' | 'landscape' };

const MENU_BUTTON = 48;
const MENU_GAP = 4;
const LANDSCAPE_MENU_ART_INSET = 4;
// The compact landscape header scales the gold artwork to 80%; its glow ends
// roughly 48 CSS pixels below the safe top.
const LANDSCAPE_GOLD_PANEL_BOTTOM = 48;
// CSS-pixel landing just below the normal portrait target plate. This keeps the
// two side controls aligned without making their position depend on target focus.
const PORTRAIT_TARGET_PLATE_BOTTOM = 146;
const PORTRAIT_TARGET_GAP = 8;

/** Leaves a visible gap above the movement disc in the default portrait CSS. */
export function touchWorldActionsTop(view: TouchViewport) {
  const footerClearance = Math.max(96, view.height * .14) + view.bottom;
  return view.height - footerClearance - 156;
}

/** The compact navigation trigger stays at the edge while thumb controls own the bottom. */
export function touchMenuLayout(view: TouchViewport, controlsTop = view.height): TouchMenuLayout {
  // Portrait world actions start at 24px and use 40px buttons. Center the
  // 48px menu targets on their first button while preserving the safe inset.
  const side = Math.max(20, view.left);
  const groupHeight = MENU_BUTTON * 2 + MENU_GAP;
  const safeTop = view.top + 4;
  const targetTop = Math.max(view.top + 4, PORTRAIT_TARGET_PLATE_BOTTOM + PORTRAIT_TARGET_GAP);
  const stacked = controlsTop-safeTop >= groupHeight;
  const y = stacked ? Math.min(targetTop,controlsTop-groupHeight) : safeTop;
  return { mode:'portrait', rect:{x:side,y,width:MENU_BUTTON,height:MENU_BUTTON},
    pause:{x:stacked?side:side+MENU_BUTTON+MENU_GAP,y:stacked?y+MENU_BUTTON+MENU_GAP:y,width:MENU_BUTTON,height:MENU_BUTTON} };
}

/** The glanceable map shares the navigation trigger's top edge. */
export function touchMinimapTop(menu: TouchMenuLayout): number {
  return menu.rect.y;
}

/** CSS-pixel geometry, independent of world resolution and device pixel density. */
export function phoneLandscapeLayout(view: TouchViewport) {
  if (view.width < 600 || view.height > 500 || view.width <= view.height) return null;
  const left = Math.max(12, view.left), right = Math.max(12, view.right);
  const bottom = Math.max(12, view.bottom + 8);
  const move = {x:left,y:view.height-bottom-103,width:96,height:96};
  const actions = {x:view.width-right-202,y:view.height-bottom-148,width:202,height:148};
  const worldActions = {x:move.x + move.width / 2 - 42.5,y:actions.y-8,width:85,height:40};
  const gapLeft = move.x + move.width + 14, gapRight = actions.x - 14;
  // Touch resource artwork occupies local x=40..480, y=54..147.
  const centeredResourceWidth = Math.max(0, 2 * Math.min(view.width / 2 - gapLeft, gapRight - view.width / 2));
  const scale = Math.min(.72, centeredResourceWidth / 440);
  const footer = {x:view.width/2-260*scale,y:view.height-bottom-147*scale,scale};
  const resources = {x:footer.x+40*scale,y:footer.y+54*scale,width:440*scale,height:93*scale};
  const menuHeight = MENU_BUTTON * 2 + MENU_GAP;
  const goldBottom = Math.max(8, view.top + LANDSCAPE_GOLD_PANEL_BOTTOM);
  const menuY = (goldBottom + worldActions.y - menuHeight) / 2;
  const landscapeMenu = {mode:'landscape' as const,
    rect:{x:worldActions.x-LANDSCAPE_MENU_ART_INSET,y:menuY,width:MENU_BUTTON,height:MENU_BUTTON},
    pause:{x:worldActions.x-LANDSCAPE_MENU_ART_INSET,y:menuY+MENU_BUTTON+MENU_GAP,width:MENU_BUTTON,height:MENU_BUTTON}};
  const menuFits = menuY >= Math.max(4, view.top) && menuY + menuHeight + MENU_GAP <= worldActions.y;
  const menu = menuFits ? landscapeMenu : touchMenuLayout(view, worldActions.y);
  return {move,actions,worldActions,footer,resources,menu,bottom,left,right,top:Math.max(8,view.top+4)};
}
