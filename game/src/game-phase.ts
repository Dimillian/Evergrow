/** Application phase; combat advances only while playing, maps and menus suspend it. */
export type GamePhase = 'ready' | 'playing' | 'paused' | 'dead' | 'map';
