/** A cursor-held light, owned by the title view. No work is scheduled while idle. */
export function bindTitleLight(root: HTMLElement, signal: AbortSignal): () => void {
  const name = root.querySelector<HTMLElement>('.game-name')!;
  const emblem = root.querySelector<SVGSVGElement>('.game-emblem svg')!;
  const light = root.querySelector<SVGRadialGradientElement>('[data-emblem-light]')!;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, x = 0, y = 0;
  const paint = () => {
    frame = 0;
    if (signal.aborted || !root.isConnected) return;
    const box = root.getBoundingClientRect(), text = name.getBoundingClientRect(), glass = emblem.getBoundingClientRect();
    const px = motion.matches ? box.left + box.width / 2 : x;
    const py = motion.matches ? box.top + box.height / 2 : y;
    root.style.setProperty('--brand-light-x', `${px - box.left}px`);
    root.style.setProperty('--brand-light-y', `${py - box.top}px`);
    root.style.setProperty('--text-light-x', `${px - text.left}px`);
    root.style.setProperty('--text-light-y', `${py - text.top}px`);
    // The SVG uses a square 64-unit drawing, centered in its portrait-shaped box.
    const size = Math.min(glass.width, glass.height);
    if (size > 0) {
      light.setAttribute('cx', String(motion.matches ? 32 : (px - glass.left - (glass.width - size) / 2) * 64 / size));
      light.setAttribute('cy', String(motion.matches ? 32 : (py - glass.top - (glass.height - size) / 2) * 64 / size));
    }
    root.classList.add('is-lit');
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    x = event.clientX; y = event.clientY;
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const reset = () => { cancelAnimationFrame(frame); frame = 0; root.classList.remove('is-lit'); };
  root.addEventListener('pointerenter', move, { signal });
  root.addEventListener('pointermove', move, { signal });
  root.addEventListener('pointerleave', reset, { signal });
  root.addEventListener('pointercancel', reset, { signal });
  window.addEventListener('blur', reset, { signal });
  document.addEventListener('visibilitychange', reset, { signal });
  motion.addEventListener('change', reset, { signal });
  signal.addEventListener('abort', reset, { once: true });
  return reset;
}
