export const MOBILE_PRESENTATION_SCALE = 0.8;

export interface PresentationProfile {
  /** Scale of the complete logical presentation, independent of input mode. */
  readonly scale: number;
}

export interface PresentationEnvironment {
  readonly android: boolean;
  readonly coarsePointer: boolean;
}

export interface PresentationViewportInput {
  readonly width: number;
  readonly height: number;
  readonly visualHeight: number;
  readonly devicePixelRatio: number;
  readonly touchActive: boolean;
  readonly profile: PresentationProfile;
}

/** Captured once by the runtime: later touch/gamepad changes do not change density. */
export function presentationProfile(environment: PresentationEnvironment): PresentationProfile {
  return { scale: environment.android || environment.coarsePointer ? MOBILE_PRESENTATION_SCALE : 1 };
}

/**
 * Keeps the browser surfaces at native CSS/DPR sizes while expanding only the
 * renderer's logical field. This is deliberately separate from CameraZoom.
 */
export function presentationViewport(input: PresentationViewportInput) {
  const mobilePresentation = input.profile.scale < 1;
  const height = input.touchActive || mobilePresentation ? Math.round(input.visualHeight) : input.height;
  const worldPixelRatio = Math.min(1.6, input.devicePixelRatio || 1);
  const uiPixelRatio = input.devicePixelRatio || 1;
  const baseLogicalHeight = Math.min(680, Math.max(450, Math.round(height / 1.35)));
  const baseLogicalWidth = Math.max(input.touchActive || mobilePresentation ? 1 : 540,
    Math.round(baseLogicalHeight * input.width / height));
  const scale = input.profile.scale;
  return {
    width: input.width,
    height,
    worldBufferWidth: Math.round(input.width * worldPixelRatio),
    worldBufferHeight: Math.round(height * worldPixelRatio),
    uiBufferWidth: Math.round(input.width * uiPixelRatio),
    uiBufferHeight: Math.round(height * uiPixelRatio),
    logicalWidth: Math.round(baseLogicalWidth / scale),
    logicalHeight: Math.round(baseLogicalHeight / scale),
  };
}
