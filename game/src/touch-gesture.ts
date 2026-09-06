export interface GesturePoint { x: number; y: number; }
/** Incremental pan/pinch geometry. Changes in pointer count establish a new baseline. */
export class TouchGesture {
  private points = new Map<number, GesturePoint>();
  private start: GesturePoint | null = null;
  private moved = false;
  get size() { return this.points.size; }
  down(id: number, p: GesturePoint) {
    if(this.points.has(id) || this.points.size >= 2) return false;
    if(!this.points.size) { this.start = p; this.moved = false; }
    else this.moved = true;
    this.points.set(id,p); return true;
  }
  move(id: number, p: GesturePoint): { dx: number; dy: number; scale: number; at: GesturePoint } | null {
    const previous = this.points.get(id); if(!previous) return null;
    const before = [...this.points.values()]; this.points.set(id,p);
    if(before.length === 1) {
      if(!this.moved && this.start && Math.hypot(p.x-this.start.x,p.y-this.start.y) < 9) return null;
      const from = this.moved ? previous : this.start ?? previous; this.moved = true;
      return {dx:p.x-from.x,dy:p.y-from.y,scale:1,at:p};
    }
    const after = [...this.points.values()];
    const oldLength = Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y);
    const newLength = Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);
    return {dx:(after[0].x+after[1].x-before[0].x-before[1].x)/2,dy:(after[0].y+after[1].y-before[0].y-before[1].y)/2,
      scale:oldLength>8 ? Math.max(.5,Math.min(2,newLength/oldLength)) : 1,
      at:{x:(after[0].x+after[1].x)/2,y:(after[0].y+after[1].y)/2}};
  }
  up(id: number, cancel = false): GesturePoint | null {
    const p = this.points.get(id); if(!p) return null;
    const tap = !cancel && !this.moved && this.points.size === 1 ? p : null;
    this.points.delete(id); if(cancel) this.moved = true;
    if(!this.points.size) this.start = null;
    return tap;
  }
  clear() { this.points.clear(); this.start = null; this.moved = false; }
}
