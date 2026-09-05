/** Shared DOM/Canvas materials. Keep world lighting and post-processing separate. */
export const UI_THEME = Object.freeze({
  palette: Object.freeze({
    ink: '#070d12',
    panel: '#111b22',
    panelRaised: '#1a2830',
    well: '#0a131a',
    line: '#354641',
    lineStrong: '#746d55',
    brass: '#b09a72',
    brassDim: '#77694f',
    silver: '#b5d0d7',
    silverDim: '#6d828a',
    steel: '#142129',
    steelDeep: '#080f16',
    jade: '#a7c0ae',
    jadeDark: '#2e4b41',
    ivory: '#e9e4d3',
    text: '#c7cec3',
    muted: '#9baa9e',
    faint: '#73857c',
    danger: '#d9948d',
    focus: '#c5d7b8',
  }),
  typography: Object.freeze({
    font: '"Pixelify Sans", ui-monospace, monospace',
    body: '16px', small: '14px', kicker: '12px', title: '20px',
  }),
  geometry: Object.freeze({ control: '44px', slot: '56px', radius: '3px' }),
  motion: Object.freeze({ quick: '140ms', gentle: '220ms' }),
});

const installed = new WeakSet<HTMLElement>();
const kebab = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/** Install once per DOM root; isolated previews can receive the same token set. */
export function installUITheme(root: HTMLElement = document.documentElement): void {
  if (installed.has(root)) return;
  for (const [name, value] of Object.entries(UI_THEME.palette)) root.style.setProperty(`--ui-${kebab(name)}`, value);
  root.style.setProperty('--ui-font', UI_THEME.typography.font);
  for (const [name, value] of Object.entries(UI_THEME.typography)) {
    if (name !== 'font') root.style.setProperty(`--ui-type-${name}`, value);
  }
  for (const [name, value] of Object.entries(UI_THEME.geometry)) root.style.setProperty(`--ui-${name}`, value);
  for (const [name, value] of Object.entries(UI_THEME.motion)) root.style.setProperty(`--ui-motion-${name}`, value);
  installed.add(root);
}
