import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { BIOMES } from '../src/biomes.ts';
import { COMBAT_TIMING, ENEMY_DEFINITIONS, PLAYER_ABILITIES, PROJECTILE_DEFINITIONS } from '../src/combat-content.ts';
import { ENCOUNTER_RULES } from '../src/encounter-director.ts';
import { EXPLORATION_LIMITS } from '../src/exploration-save.ts';
import { POI_DEFINITIONS } from '../src/world-pois.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceFiles = readdirSync(resolve(root, 'src')).filter(file => file.endsWith('.ts'));
const reviewFiles = sourceFiles.filter(file => file.endsWith('-review.ts'));
const runtimeFiles = sourceFiles.filter(file => !reviewFiles.includes(file) && !file.startsWith('hud-concept-'));
const countLines = (files: string[]) => files.reduce((sum, file) =>
  sum + readFileSync(resolve(root, 'src', file), 'utf8').trimEnd().split('\n').length, 0);
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const assets = resolve(root, 'dist/assets');
const bundle = existsSync(assets) ? readdirSync(assets).filter(file => /\.(js|css)$/.test(file)).map(file => ({
  file, bytes: statSync(resolve(assets, file)).size, gzipBytes: gzipSync(readFileSync(resolve(assets, file))).length,
})) : null;

console.log(JSON.stringify({
  source: { typescriptModules: sourceFiles.length, lines: countLines(sourceFiles),
    runtimeModules: runtimeFiles.length,
    runtimeLines: countLines(runtimeFiles),
    reviewEntrypoints: reviewFiles.length },
  tests: { unitFiles: readdirSync(resolve(root, 'tests')).filter(file => file.endsWith('.test.ts')).length,
    browserFiles: readdirSync(resolve(root, 'tests/browser')).filter(file => file.endsWith('.spec.ts')).length },
  dependencies: { runtime: Object.keys(manifest.dependencies ?? {}).length,
    development: Object.keys(manifest.devDependencies ?? {}).length },
  content: { biomes: Object.keys(BIOMES).length, enemyArchetypes: Object.keys(ENEMY_DEFINITIONS).length,
    playerActionDefinitions: Object.keys(PLAYER_ABILITIES).length, projectileTypes: Object.keys(PROJECTILE_DEFINITIONS).length,
    pointOfInterestKinds: Object.keys(POI_DEFINITIONS).length },
  limits: { simulationHz: Math.round(1 / COMBAT_TIMING.fixedStep),
    targetEnemies: ENCOUNTER_RULES.targetPopulationCap, hardEnemyCap: ENCOUNTER_RULES.hardPopulationCap,
    exploration: EXPLORATION_LIMITS },
  lastBuild: bundle,
}, null, 2));
