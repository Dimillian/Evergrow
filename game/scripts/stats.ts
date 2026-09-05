import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { SKILL_TREE } from '../src/skill-tree.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { EQUIPMENT_SLOTS, ITEM_KINDS, TIER_NAMES } from '../src/items.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { GROUND_EFFECT_RULES } from '../src/skill-execution-content.ts';
import { MAX_PROJECTILES } from '../src/projectile-combat.ts';
import { ENEMY_RANKS, MAX_CONTENT_LEVEL } from '../src/progression-content.ts';
import { ZONE_RULES } from '../src/zone-progression.ts';
import { ENEMY_LOOT_TABLES } from '../src/loot-content.ts';
import { BIOMES, BIOME_FIELD_RULES } from '../src/biomes.ts';
import { COMBAT_TIMING, ENEMY_DEFINITIONS, PLAYER_ABILITIES, PROJECTILE_DEFINITIONS } from '../src/combat-content.ts';
import { ENCOUNTER_RULES } from '../src/encounter-director.ts';
import { EXPLORATION_LIMITS } from '../src/exploration-save.ts';
import { POI_DEFINITIONS } from '../src/world-pois.ts';
import { WILDERNESS_RULES } from '../src/wilderness-sites.ts';
import { CAMP_POPULATION_RULES } from '../src/camp-population.ts';
import { PROP_KINDS } from '../src/biome-props.ts';
import { ENVIRONMENT_ART_RULES } from '../src/environment-art.ts';
import { MAP_TERRAIN_RULES, mapTerrainSize } from '../src/world-map.ts';
import { MAP_ZOOM } from '../src/map-view.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceFiles = readdirSync(resolve(root, 'src')).filter(file => file.endsWith('.ts'));
const reviewFiles = sourceFiles.filter(file => file.endsWith('-review.ts'));
const runtimeFiles = sourceFiles.filter(file => !file.includes('-review') && !file.startsWith('hud-concept-'));
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
  content: { worldGeneration: WORLD_GENERATION_VERSION, propKinds: PROP_KINDS.length, biomes: Object.keys(BIOMES).length, enemyArchetypes: Object.keys(ENEMY_DEFINITIONS).length,
    enemyRanks: Object.keys(ENEMY_RANKS).length, enemyLootTables: Object.keys(ENEMY_LOOT_TABLES).length,
    basicAndUtilityActions: Object.keys(PLAYER_ABILITIES).length, activeSkills: Object.keys(SKILL_DEFINITIONS).length,
    skillNodes: SKILL_TREE.nodes.length, skillEdges: SKILL_TREE.edges.length,
    equipmentSlots: EQUIPMENT_SLOTS.length, itemKinds: ITEM_KINDS.length, itemTiers: Object.keys(TIER_NAMES).length,
    generatedWeaponProfiles: WEAPON_PROFILES.length, shieldProfiles: SHIELD_PROFILES.length,
    enemyProjectileTemplates: Object.keys(PROJECTILE_DEFINITIONS).length,
    pointOfInterestKinds: Object.keys(POI_DEFINITIONS).length },
  limits: { simulationHz: Math.round(1 / COMBAT_TIMING.fixedStep),
    projectiles: MAX_PROJECTILES, groundEffects: GROUND_EFFECT_RULES.maximum,
    numericContentLevel: MAX_CONTENT_LEVEL, areaBandWidth: ZONE_RULES.bandWidth,
    targetRoamingEnemies: { base: ENCOUNTER_RULES.basePopulation, maximum: ENCOUNTER_RULES.targetPopulationCap },
    reservedRoamingSlots: ENCOUNTER_RULES.roamingReserve, hardEnemyCap: ENCOUNTER_RULES.hardPopulationCap,
    wildernessCells: WILDERNESS_RULES.cacheLimit, campLedger: CAMP_POPULATION_RULES.ledgerCapacity,
    climateRegions: BIOME_FIELD_RULES.cacheLimit,
    environmentSprites: ENVIRONMENT_ART_RULES.cacheLimit, environmentVariantsPerFamily: ENVIRONMENT_ART_RULES.variants,
    mapTerrainTiles: MAP_TERRAIN_RULES.cacheLimit, visibleMapTerrainTiles: MAP_TERRAIN_RULES.maximumVisibleTiles,
    mapZoom: MAP_ZOOM, nominalMapTerrainSizes: [.2, .1, .04].map(zoom => mapTerrainSize(zoom, 1280, 720)),
    exploration: EXPLORATION_LIMITS },
  lastBuild: bundle,
}, null, 2));
