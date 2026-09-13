import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseChangelog } from '../game/src/changelog.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const baseline = process.argv[2];
try {
  if (!baseline || !/^[a-f0-9]{40}$/.test(baseline)) throw new Error('Pass the full source SHA of the last successful Sites publication.');
  git('cat-file', '-e', `${baseline}^{commit}`);
  if (git('status', '--porcelain')) throw new Error('Commit the changelog and all release changes first.');
  const current = parseChangelog(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'));
  const previous = spawnSync('git', ['show', `${baseline}:CHANGELOG.md`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  if(current.some(e=>{const [major,minor]=e.version.split('.').map(Number);return major!==0||minor>5;}))throw new Error('Prototype versions must stay within the approved 0.5 milestone until the next milestone is explicitly approved.');
  if (git('rev-parse', 'HEAD') !== baseline && previous.status === 0
    && current[0].date <= parseChangelog(previous.stdout)[0].date) {
    throw new Error('Add a new dated release entry since the last publication. Renumbering old entries is not new release notes.');
  }
  console.log(`Release notes ready: v${current[0].version} — ${current[0].date}`);
} catch (error) {
  console.error((error as Error).message); process.exitCode = 1;
}
