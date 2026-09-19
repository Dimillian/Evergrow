export type FrameLimit = 'display' | '60' | '30';
export type PresentationFps = 60 | 30 | null;

export function parseFrameLimit(value: unknown): FrameLimit {
  return value === '60' || value === '30' ? value : 'display';
}

export function presentationFps(limit: FrameLimit, android = false): PresentationFps {
  if (android) return 60;
  if (limit === '60') return 60;
  if (limit === '30') return 30;
  return null;
}
