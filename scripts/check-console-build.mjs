import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Compile client variants only. This never invokes Sites staging, auth, hosting or deployment.
const game = fileURLToPath(new URL('../game/', import.meta.url));
const vite = join(game, 'node_modules/vite/bin/vite.js');
const output = await mkdtemp(join(tmpdir(), 'evergrow-console-build-'));
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
try {
  for (const site of [false, true]) {
    const destination = join(output, site ? 'online' : 'local');
    execFileSync(process.execPath, [vite, 'build', '--outDir', destination], {
      cwd: game, env: { ...process.env, VITE_SITE_CLOUD: site ? 'true' : '' }, stdio: 'pipe',
    });
    const artifacts = await files(destination);
    const text = (await Promise.all(artifacts.filter(path => /\.(js|css|html)$/.test(path)).map(path => readFile(path, 'utf8')))).join('\n');
    const markers = ['command-overlay', 'command-suggestions', 'Drop generated equipment at your feet'];
    if (site && (artifacts.some(path => /console-panel/.test(path)) || markers.some(marker => text.includes(marker))))
      throw new Error('Online client contains the local command console.');
    if (!site && (!artifacts.some(path => /console-panel.*\.js$/.test(path)) || !markers.every(marker => text.includes(marker))))
      throw new Error('Local client is missing the command console.');
    if (artifacts.filter(path => path.endsWith('.html')).length !== 1)
      throw new Error('A development review was included in the client output.');
    console.log(`${site ? 'Online' : 'Local'} client: console ${site ? 'excluded' : 'included'}; review pages excluded.`);
  }
} finally {
  await rm(output, { recursive: true, force: true });
}
