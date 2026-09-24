/** Bright halves are ready; only the next empty half accumulates muted recharge. */
export function drawUtilityCharges(c: CanvasRenderingContext2D, x: number, y: number, size: number, charges: number, capacity: number, color: string, recharge = 0): void {
  c.save(); c.lineCap = 'round';
  const progress = Number.isFinite(recharge) ? Math.max(0, Math.min(1, recharge)) : 0;
  const gap = .14, step = Math.PI * 2 / capacity, radius = size / 2 - .6;
  for (let i = 0; i < capacity; i++) {
    const start = Math.PI / 2 + step * i + gap, end = Math.PI / 2 + step * (i + 1) - gap;
    c.beginPath(); c.arc(x, y, radius, start, end);
    c.lineWidth = 3.6; c.strokeStyle = '#071018'; c.stroke();
    c.lineWidth = 2.3; c.strokeStyle = i < charges ? color : '#354852'; c.stroke();
    if (i < charges) {
      c.beginPath(); c.arc(x, y, radius - .6, start + .08, end - .08);
      c.lineWidth = .55; c.strokeStyle = '#e1ebe08c'; c.stroke();
    } else if (i === charges && progress > 0) {
      c.beginPath(); c.arc(x, y, radius, start, start + (end - start) * progress);
      c.lineWidth = 2.3; c.strokeStyle = color;
      c.save(); c.globalAlpha *= .42; c.stroke(); c.restore();
    }
  }
  c.restore();
}
