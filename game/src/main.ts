import './ui-kit.css';
import './style.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import './world-map.css';
import { loadGameFont } from './font.ts';
import { Game } from './game.ts';

installUITheme();

const app = document.querySelector<HTMLElement>('#app')!;

let game: Game | undefined;
let moduleDisposed = false;
if (import.meta.hot) import.meta.hot.dispose(() => {
  moduleDisposed = true;
  Reflect.deleteProperty(window, '__evergrow');
  Reflect.deleteProperty(window, '__evergrowPerformance');
  try { game?.dispose(); } catch (error) { console.error('Game cleanup failed.', error); }
});

// Wait for local font metrics before the first frame; a missing font has a readable fallback.
void loadGameFont().catch(error => console.warn('Local UI font unavailable; using fallback.', error)).then(() => {
  if (moduleDisposed) return;
  try {
    game = new Game(app);
    if (game.performance.enabled) Object.assign(window, { __evergrowPerformance: { snapshot: () => game?.performance.snapshot(), reset: () => game?.performance.reset() } });
    if (import.meta.env.DEV) Object.assign(window, { __evergrow: game });
  } catch (error) {
    console.error(error);
    app.innerHTML = '<div class="error"><h1>The woods could not be drawn.</h1><p>This browser could not initialize the game display.</p></div>';
  }
});
