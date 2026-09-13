/** Physical keyboard codes and mouse buttons; independent of characters and simulation. */
export const CONTROL_ACTIONS = [
  { id: 'up', label: 'Move up', group: 'Movement', defaults: ['KeyW', 'ArrowUp'], pad: 'Left stick' },
  { id: 'left', label: 'Move left', group: 'Movement', defaults: ['KeyA', 'ArrowLeft'], pad: 'Left stick' },
  { id: 'down', label: 'Move down', group: 'Movement', defaults: ['KeyS', 'ArrowDown'], pad: 'Left stick' },
  { id: 'right', label: 'Move right', group: 'Movement', defaults: ['KeyD', 'ArrowRight'], pad: 'Left stick' },
  { id: 'attack', label: 'Basic attack', group: 'Combat', defaults: ['Mouse0', null], pad: 'RT' },
  { id: 'skill0', label: 'Skill slot 1', group: 'Combat', defaults: ['Mouse2', null], pad: 'LT' },
  { id: 'skill1', label: 'Skill slot 2', group: 'Combat', defaults: ['Digit1', null], pad: 'RB' },
  { id: 'skill2', label: 'Skill slot 3', group: 'Combat', defaults: ['Digit2', null], pad: 'X' },
  { id: 'skill3', label: 'Skill slot 4', group: 'Combat', defaults: ['Digit3', null], pad: 'Y' },
  { id: 'skill4', label: 'Skill slot 5', group: 'Combat', defaults: ['Digit4', null], pad: 'RS' },
  { id: 'dodge', label: 'Dodge', group: 'Combat', defaults: ['Space', null], pad: 'B' },
  { id: 'heal', label: 'Potion', group: 'Combat', defaults: ['KeyQ', null], pad: 'LB' },
  { id: 'interact', label: 'Interact', group: 'World & menus', defaults: ['KeyE', null], pad: 'A' },
  { id: 'portal', label: 'Town portal', group: 'World & menus', defaults: ['KeyP', null], pad: 'D-pad ↓' },
  { id: 'character', label: 'Character / inventory', group: 'World & menus', defaults: ['KeyC', 'KeyI'], pad: 'D-pad ← / →' },
  { id: 'skills', label: 'Skill atlas', group: 'World & menus', defaults: ['KeyT', null], pad: 'D-pad ↑' },
  { id: 'journeys', label: 'Journeys', group: 'World & menus', defaults: ['KeyJ', null], pad: 'Menu drawer' },
  { id: 'map', label: 'World map', group: 'World & menus', defaults: ['KeyM', 'Tab'], pad: 'View' },
  { id: 'sound', label: 'Toggle sound', group: 'World & menus', defaults: ['KeyN', null], pad: 'Options' },
  { id: 'debug', label: 'Performance overlay', group: 'World & menus', defaults: ['F3', null], pad: '—' },
] as const;
export type ControlAction = typeof CONTROL_ACTIONS[number]['id'];
export function isMovementAction(action: ControlAction | undefined): boolean {
  return action === 'up' || action === 'down' || action === 'left' || action === 'right';
}
export type ControlMap = Record<ControlAction, readonly [string | null, string | null]>;
export const SKILL_ACTIONS = ['skill0', 'skill1', 'skill2', 'skill3', 'skill4'] as const;
export const CONTROL_STORAGE_KEY = 'evergrow-controls-v1';
export interface ControlStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export function defaultControls(): ControlMap {
  return Object.fromEntries(CONTROL_ACTIONS.map(a => [a.id, [...a.defaults]])) as unknown as ControlMap;
}
export function validControl(code: unknown): code is string {
  return typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Shift(Left|Right)|F[1-9]|F10|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|Mouse[0-4])$/.test(code)
    && code !== 'F5';
}
const CONTROL_LABELS: Record<string, string> = { Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'M4', Mouse4: 'M5', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', Backspace: 'Bksp', Delete: 'Del', Insert: 'Ins', PageUp: 'PgUp', PageDown: 'PgDn', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/' };
export function controlLabel(code: string | null | undefined): string {
  if (!code) return '—';

  return CONTROL_LABELS[code] ?? code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ');
}
export function parseControls(raw: string | null): ControlMap {
  try {
    const saved: unknown = JSON.parse(raw ?? 'null');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaultControls();
    const map = saved as Record<string, unknown>, seen = new Set<string>();
    for (const { id } of CONTROL_ACTIONS) {
      const pair = map[id];
      if (!Array.isArray(pair) || pair.length !== 2) return defaultControls();
      for (const code of pair) {
        if (code === null) continue;
        if (!validControl(code) || seen.has(code)) return defaultControls();
        seen.add(code);
      }
    }
    return Object.fromEntries(CONTROL_ACTIONS.map(({ id }) => [id, [...map[id] as (string | null)[]]])) as unknown as ControlMap;
  } catch { return defaultControls(); }
}
export class ControlBindings {
  private map: ControlMap;
  private readonly storage?: ControlStorage;
  private listeners = new Set<() => void>();
  constructor(storage?: ControlStorage) {
    this.storage = storage;
    try { this.map = parseControls(storage?.getItem(CONTROL_STORAGE_KEY) ?? null); }
    catch { this.map = defaultControls(); }
  }
  get(action: ControlAction): readonly [string | null, string | null] { return [...this.map[action]]; }
  label(action: ControlAction): string { return controlLabel(this.map[action].find(Boolean)); }
  action(code: string): ControlAction | undefined { return CONTROL_ACTIONS.find(a => this.map[a.id].includes(code))?.id; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  /** Explicit replacement removes the conflicting assignment before installing this binding. */
  bind(action: ControlAction, index: 0 | 1, code: string | null, replace = false): 'saved' | 'session' | 'conflict' | 'invalid' {
    if (code !== null && !validControl(code)) return 'invalid';
    const owner = code === null ? undefined : this.action(code);
    if (owner && owner !== action && !replace) return 'conflict';
    if (code) for (const { id } of CONTROL_ACTIONS) { const [first, second] = this.map[id]; this.map[id] = [first === code ? null : first, second === code ? null : second]; }
    const pair = [...this.map[action]] as [string | null, string | null]; pair[index] = code; this.map[action] = pair;
    return this.commit();
  }
  reset(): 'saved' | 'session' { this.map = defaultControls(); return this.commit(); }
  private commit(): 'saved' | 'session' {
    let result: 'saved' | 'session' = 'session';
    try { if (this.storage) { this.storage.setItem(CONTROL_STORAGE_KEY, JSON.stringify(this.map)); result = 'saved'; } } catch { /* Session controls remain usable. */ }
    this.listeners.forEach(listener => listener()); return result;
  }
}
