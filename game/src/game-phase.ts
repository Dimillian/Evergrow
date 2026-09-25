/** Application phase; only playing and the held exploration map advance the world. */
export type GamePhase = 'ready' | 'playing' | 'paused' | 'dead' | 'map' | 'character' | 'inventory' | 'skills' | 'service' | 'event' | 'journeys' | 'chronicle';
