import './style.css';
import './typography.css';
import './world-map.css';
import { loadGameFont } from './font.ts';
import { Game } from './game.ts';

const app = document.querySelector<HTMLElement>('#app')!;

let game: Game | undefined;
let moduleDisposed = false;
if (import.meta.hot) import.meta.hot.dispose(() => {
  moduleDisposed = true;
  Reflect.deleteProperty(window, '__evergrowing');
  try { game?.dispose(); } catch (error) { console.error('Game cleanup failed.', error); }
});

// Wait for local font metrics before the first frame; a missing font has a readable fallback.
void loadGameFont().catch(error => console.warn('Local UI font unavailable; using fallback.', error)).then(() => {
  if (moduleDisposed) return;
  try {
    game = new Game(app);
    if (import.meta.env.DEV) Object.assign(window, { __evergrowing: game });
  } catch (error) {
    console.error(error);
    app.innerHTML = '<div class="error"><h1>The woods could not be drawn.</h1><p>This browser could not initialize the game display.</p></div>';
  }
});
