import { TouchGesture, type GesturePoint } from './touch-gesture.ts';

/** Touch-only adapter leaves existing wheel, hover and mouse handlers intact. */
export function bindTouchCanvas(canvas: HTMLCanvasElement, signal: AbortSignal, actions: {
  pan(dx: number,dy: number): void; zoom(scale: number,point: GesturePoint): void;
  tap(point: GesturePoint): void; start?(): void; enabled?(): boolean;
}) {
  const gesture = new TouchGesture(), captured = new Set<number>();
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; };
  const consume = (e: PointerEvent) => { if(e.pointerType !== 'touch') return false; e.preventDefault(); e.stopImmediatePropagation(); return true; };
  const opts = {signal,capture:true};
  canvas.addEventListener('pointerdown',e=>{
    if(!consume(e) || actions.enabled?.() === false) return;
    if(gesture.down(e.pointerId,local(e))) { captured.add(e.pointerId); canvas.setPointerCapture(e.pointerId); actions.start?.(); }
  },opts);
  canvas.addEventListener('pointermove',e=>{
    if(!consume(e)) return;
    const delta = gesture.move(e.pointerId,local(e)); if(!delta) return;
    actions.pan(delta.dx,delta.dy); if(delta.scale!==1) actions.zoom(delta.scale,delta.at);
  },opts);
  const end = (e: PointerEvent,cancel: boolean) => {
    if(!consume(e)) return;
    if(!cancel) {
      const delta=gesture.move(e.pointerId,local(e));
      if(delta) { actions.pan(delta.dx,delta.dy); if(delta.scale!==1) actions.zoom(delta.scale,delta.at); }
    }
    const tap = gesture.up(e.pointerId,cancel); captured.delete(e.pointerId);
    if(canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if(tap) actions.tap(tap);
  };
  canvas.addEventListener('pointerup',e=>end(e,false),opts);
  canvas.addEventListener('pointercancel',e=>end(e,true),opts);
  canvas.addEventListener('lostpointercapture',e=>end(e,true),opts);
  canvas.addEventListener('pointerleave',e=>{ if(e.pointerType==='touch') e.stopImmediatePropagation(); },opts);
  const clear = () => { gesture.clear(); for(const id of captured) if(canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); captured.clear(); };
  window.addEventListener('blur',clear,{signal}); window.addEventListener('resize',clear,{signal});
  signal.addEventListener('abort',clear,{once:true});
  return clear;
}
