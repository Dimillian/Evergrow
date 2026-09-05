/** A broad gust front travels across world coordinates; nearby materials share its phase. */
export function forestWind(x: number, y: number, time: number, reducedMotion = false) {
  if (reducedMotion) return { x: 0, y: 0, gust: 0 };
  const front = time * .82 - x * .011 - y * .004;
  const gust = Math.pow(Math.max(0, Math.sin(front)), 3);
  const breath = Math.sin(time * .37 - x * .003 + y * .002);
  return { x: .22 + gust * 1.65 + breath * .16,
    y: .12 + Math.sin(time * .24 + x * .002) * .09, gust };
}
