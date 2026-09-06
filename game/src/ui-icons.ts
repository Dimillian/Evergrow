const ICONS = {
  potion: '<path d="M9 3h6v5l4 6v5c0 2-14 2-14 0v-5l4-6ZM8 3h8M8 14h8M9 17h6"/>',
  dodge: '<path d="m13 4 6 5-5 5 4 6M13 9l-5 5-5 1M10 17l-4 4M2 6h7M1 10h5"/><circle cx="18" cy="3" r="2"/>',
  portal: '<path d="M6 20V10a6 6 0 0 1 12 0v10M3 20h18M9 17v-7a3 3 0 0 1 6 0v7"/><path d="m12 11 1 2-1 2-1-2Z"/>',
  star: '<path d="M12 3c1.2 5.1 3.9 7.8 9 9-5.1 1.2-7.8 3.9-9 9-1.2-5.1-3.9-7.8-9-9 5.1-1.2 7.8-3.9 9-9Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  center: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  leaf: '<path d="M19 4c-8-1-14 3-14 8a6 6 0 0 0 6 6c5 0 8-6 8-14Z"/><path d="M5 21 16 8m-7 8-1-5m4 2 5-1"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15"/>',
  sword: '<path d="m6 18 2-2m1-3L17 4l3-1-1 4-8 8M6 11l7 7M4 17l3 3-2 2-3-3Z"/>',
  skull: '<path d="M7 16c-3-2-4-4-3-7a8 8 0 0 1 16 0c1 3 0 5-3 7v4H7Z"/><path d="M10 17v3m4-3v3m-3-5 1-2 1 2"/><path d="M7 10h3v2H7Zm7 0h3v2h-3Z"/>',
  diamond: '<path d="m12 3 8 9-8 9-8-9Z"/><path d="m12 7 4 5-4 5-4-5Z"/>',
  shield: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Zm0 4v10"/>',
  inventory: '<path d="M4 8h16v13H4Zm4 0V5a4 4 0 0 1 8 0v3M4 13h16m-9-2v4h2v-4"/>',
  journal: '<path d="M5 3h14v18H5ZM5 7H3m2 5H3m2 5H3m6-9h6m-6 4h6m-6 4h4"/>',
  character: '<path d="M8 7a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm-4 14v-4l5-3 3 2 3-2 5 3v4Z"/>',
  skilltree: '<path d="M12 21v-7m0 1-6-5m6 1 6-5M6 10V5m12 1h3M12 9V3"/><circle cx="6" cy="3" r="2"/><circle cx="12" cy="11" r="2"/><circle cx="19" cy="4" r="2"/>',
  lantern: '<path d="M8 6h8l3 5-2 9H7l-2-9Zm0-1a4 4 0 0 1 8 0M5 11h14M8 20h8M9 11l1 9m5-9-1 9"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  sortFilter: '<path d="M4 5h16l-6 7v6l-4 3v-9ZM3 15v6m-2-2 2 2 2-2"/>',
  equipBest: '<path d="m5 19 2-2m1-4 7-8 3-1-1 3-7 8M5 11l7 7M3 18l3 3m13-9v6m-3-3h6"/>',
} as const;

export type UIIconName = keyof typeof ICONS;

/** Only fixed paths enter this markup; caller labels belong in escaped DOM text. */
export function uiIcon(name: UIIconName): string {
  if (!Object.hasOwn(ICONS, name)) return '';
  return `<svg class="ui-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}
