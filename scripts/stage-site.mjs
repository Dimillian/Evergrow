import { cp, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
function run(args, env = process.env) {
  const result = spawnSync('npx', args, { cwd: root + 'game', env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(['vite', 'build'], { ...process.env, VITE_SITE_CLOUD: 'true' });
run(['vite', 'build', '--config', 'vite.site.config.ts']);
await access(new URL('../dist/server/index.js', import.meta.url));
await cp(new URL('../game/dist/', import.meta.url), new URL('../dist/client/', import.meta.url), { recursive: true });
