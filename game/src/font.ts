export const GAME_FONT_FAMILY = 'Pixelify Sans';
export const NUMERIC_FONT_FAMILY = 'Evergrow Numerals';
export const GAME_FONT_STACK = `"${NUMERIC_FONT_FAMILY}", "${GAME_FONT_FAMILY}", ui-monospace, monospace`;
export const INTERFACE_FONT_STACK = `"${NUMERIC_FONT_FAMILY}", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
// Restrict this face to figures and numeric punctuation, including mixed labels.
const NUMERIC_RANGE = 'U+0025, U+002B-003A, U+00B1, U+00D7, U+00F7, U+2030, U+2212';
/** 11px em gives 7.7px capitals and a typical 6.45px advance at the legacy size=1. */
export const GAME_FONT_EM = 11;
const FONT_WEIGHT = 400;
const FONT_URL = new URL('./assets/fonts/PixelifySans-Variable.ttf', import.meta.url).href;
const NUMERIC_FONT_URL = new URL('./assets/fonts/Barlow-Medium.ttf', import.meta.url).href;
let loading: Promise<void> | null = null;
let measuring: CanvasRenderingContext2D | null = null;

/** Both DOM and Canvas resolve numeric glyphs through the same bundled face. */
export function loadGameFont(): Promise<void> {
  if (loading) return loading;
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
    return Promise.reject(new Error('The game font requires the browser FontFace API'));
  }
  const register = (family: string, url: string, unicodeRange?: string) => {
    // Reuse registered faces after hot replacement without accumulating fonts.
    const existing = [...document.fonts].find(face => face.family.replace(/["']/g, '') === family);
    const face = existing ?? new FontFace(family, `url("${url}")`, {
      style: 'normal', weight: '400 700', display: 'block',
      ...(unicodeRange ? { unicodeRange } : {}),
    });
    if (!existing) document.fonts.add(face);
    return face.load().catch(error => {
      if (!existing) document.fonts.delete(face);
      throw error;
    });
  };
  loading = Promise.all([
    register(GAME_FONT_FAMILY, FONT_URL),
    register(NUMERIC_FONT_FAMILY, NUMERIC_FONT_URL, NUMERIC_RANGE),
  ]).then(() => { measuring = null; }).catch(error => {
    loading = null;
    throw error;
  });
  return loading;
}

type TextFace = 'display' | 'interface';

function font(pixelSize: number, face: TextFace = 'display') {
  if (face === 'interface') return `600 ${pixelSize}px ${INTERFACE_FONT_STACK}`;
  return `${FONT_WEIGHT} ${pixelSize}px ${GAME_FONT_STACK}`;
}

/** Natural font metrics replace the previous six-pixel character-count estimate. */
export function textWidth(value: string, size = 1, face: TextFace = 'display') {
  if (!value || size <= 0 || !Number.isFinite(size)) return 0;
  measuring ??= document.createElement('canvas').getContext('2d');
  if (!measuring) return 0;
  measuring.font = font(GAME_FONT_EM * size, face);
  measuring.fontKerning = 'normal';
  return measuring.measureText(value.toUpperCase()).width;
}

/**
 * y remains the cap-top position used by existing HUD and damage-number layouts.
 * Resolve the current transform into a physical font size, then rasterize the whole
 * glyph run directly into the backing canvas. Only the final baseline origin snaps;
 * glyph stems and animated font scales keep their natural typeface geometry.
 */
export function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
  size = 1, color = '#d4c8a4', align: 'left' | 'center' | 'right' = 'left', face: TextFace = 'display') {
  if (!value || size <= 0 || ![x, y, size].every(Number.isFinite)) return;
  const transform = ctx.getTransform();
  const physicalScale = Math.hypot(transform.c, transform.d);
  if (!Number.isFinite(physicalScale) || physicalScale < .00001) return;
  const pixels = GAME_FONT_EM * size * physicalScale;
  const valueToDraw = value.toUpperCase();
  ctx.save();
  ctx.font = font(pixels, face);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'ltr';
  ctx.fontKerning = 'normal';
  const width = ctx.measureText(valueToDraw).width;
  const caps = ctx.measureText('H');
  const ascent = caps.actualBoundingBoxAscent || pixels * .7;
  const offset = align === 'center' ? -width / 2 : align === 'right' ? -width : 0;
  const a = transform.a / physicalScale, b = transform.b / physicalScale;
  const c = transform.c / physicalScale, d = transform.d / physicalScale;
  const physicalX = transform.a * x + transform.c * y + transform.e + a * offset + c * ascent;
  const physicalY = transform.b * x + transform.d * y + transform.f + b * offset + d * ascent;
  ctx.setTransform(a, b, c, d, Math.round(physicalX), Math.round(physicalY));
  ctx.fillStyle = color;
  ctx.fillText(valueToDraw, 0, 0);
  ctx.restore();
}
