/** Native CSS-pixel anchor shared by pickup presentation and world input exclusion. */
export function notificationAnchor(width: number, height: number, phoneLandscape = false, safeTop = 0) {
  if (phoneLandscape) {
    const size = Math.min(230, width * .32);
    return { x: (width - size) / 2, y: Math.max(8, safeTop) + 58, width: size, height: 44 };
  }
  const left = width <= 1000 ? 12 : 18;
  const bottom = height <= 560 ? 160 : width <= 1000 ? 210 : 26;
  return { x: left, y: Math.max(0, height - bottom - 44), width: Math.min(width <= 1000 ? 220 : 244, Math.max(0, width - 36)), height: 44 };
}
