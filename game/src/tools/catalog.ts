/** One registry owns local tool discovery, workspace tabs, and review navigation. */
export const WORKSPACES = [
  { id: 'equipment', name: 'Equipment', description: 'Generate gear, inspect materials, compare equipped items and review trading.', icon: '◇' },
  { id: 'characters', name: 'Characters', description: 'Build a look and inspect the shared character rig, motion and portraits.', icon: '♙' },
  { id: 'combat', name: 'Skills & combat', description: 'Play every skill, study creatures and inspect deaths and combat effects.', icon: '✦' },
  { id: 'world', name: 'World', description: 'Inspect seeds, settlements, climates, event placements and living terrain.', icon: '⌘' },
  { id: 'interface', name: 'Interface', description: 'Review real panels and feedback across desktop, touch and Thor.', icon: '▣' },
  { id: 'data', name: 'Data & audits', description: 'Search current content definitions, inspect progression and run code audits.', icon: '≡' },
  { id: 'archive', name: 'Archive', description: 'Historical design alternatives, separate from current game tools.', icon: '◷' },
] as const;
export type Workspace = typeof WORKSPACES[number]['id'];
export interface Tool { id: string; group: Workspace; name: string; path: string; description: string; tags?: string; }
export const TOOLS: readonly Tool[] = [
  {id:'forge',group:'equipment',name:'Item forge',path:'/tools/forge.html',description:'Generate items by seed, kind, profile, rarity and material; equip previews and JSON export.',tags:'generator random roll affixes'},
  {id:'playground',group:'combat',name:'Skill playground',path:'/tools/skills.html',description:'Replay every active skill and specialization using actual combat and animation rules.',tags:'animations spells effects cast'},
  {id:'placements',group:'world',name:'Seed & placement inspector',path:'/tools/placements.html',description:'Survey generated events, towns and dungeon entrances by seed and coordinates.',tags:'generation map positions'},
  {id:'data',group:'data',name:'Game data browser',path:'/tools/data.html',description:'Search current definitions for items, skills, enemies, affixes, biomes and world content.',tags:'catalog recipes stats export'},
  {id:'audits',group:'data',name:'Code & performance audits',path:'/tools/audits.html',description:'Commands and access instructions for code checks, profiling and capture scripts.'},
  {id:'equipment',group:'equipment',name:'Equipment gallery',path:'/equipment.html',description:'Browse all equipment silhouettes and materials under movable light.'},
  {id:'charms',group:'equipment',name:'Charms',path:'/character.html?charms',description:'Arrange six sizes of magic stones and inspect their active bonuses.'},
  {id:'inventory',group:'equipment',name:'Inventory & comparisons',path:'/character.html',description:'Equip staged gear, compare stats and organize a character’s bag.'},
  {id:'services',group:'equipment',name:'Town services',path:'/services.html',description:'Inspect vendor stock, buyback and item improvements.'},
  {id:'services-phone',group:'equipment',name:'Services · phone',path:'/services-narrow.html',description:'The same enchanting interface at 390 pixels.'},
  {id:'loot',group:'equipment',name:'Ground loot',path:'/loot.html',description:'Dropped item art, rarity labels, coins and resource vials.'},
  {id:'editor',group:'characters',name:'Appearance editor',path:'/character-editor.html',description:'Edit a staged character and armor colors.'},
  {id:'atelier',group:'characters',name:'Motion & equipment',path:'/atelier.html',description:'Weapon carrying, character proportions and animated poses.'},
  {id:'rig',group:'characters',name:'Rig directions',path:'/rig.html',description:'Inspect frozen poses across eight facings.'},
  {id:'looks',group:'characters',name:'Looks in the world',path:'/appearance-world.html',description:'Shared portraits and world art with actual lighting and CRT.'},
  {id:'appearance',group:'characters',name:'Hair & accessories',path:'/appearance-catalog.html',description:'Catalog of hair, facial hair and accessory silhouettes.'},
  {id:'editor-phone',group:'characters',name:'Editor · phone',path:'/character-editor-phone.html',description:'Character, armor and inventory views at smartphone sizes.'},
  {id:'hall',group:'characters',name:'Character hall',path:'/title.html',description:'Memory-only title screen and staged character slots.'},
  {id:'skills',group:'combat',name:'Skill atlas',path:'/character.html?panel=skills',description:'Inspect the real tree, routes, allocations and specialization panels.'},
  {id:'bestiary',group:'combat',name:'Bestiary',path:'/bestiary.html',description:'Actual enemy models, player loadouts and procedural art.',tags:'enemy monster creatures'},
  {id:'regional-monsters',group:'combat',name:'Regional creatures',path:'/bestiary.html?regional',description:'Six biome-native creatures and their signature attacks.',tags:'enemy biome monster'},
  {id:'barks',group:'combat',name:'Battle speech',path:'/bestiary.html?barks=1',description:'Bestiary with staged encounter speech bubbles.'},
  {id:'deaths',group:'combat',name:'Death animations',path:'/deaths.html',description:'Play creature death recipes with variant and facing controls.'},
  {id:'lights',group:'combat',name:'Weapon enchantments',path:'/weapon-lights.html',description:'Caster emission, melee enchantments and basic cast poses.'},
  {id:'layouts',group:'world',name:'Settlements',path:'/layouts.html',description:'Seeded refuges, villages, fortified cities, market stalls and family interiors with PNG export.'},
  {id:'atlas',group:'world',name:'World atlas',path:'/atlas.html',description:'Local, wide and vast world surveys with region levels, custom seeds and PNG export.'},
  {id:'biomes',group:'world',name:'Climates',path:'/biomes.html',description:'All seven biomes and blended transitions using the game renderer.'},
  {id:'encounters',group:'world',name:'Camps & landmarks',path:'/encounters.html',description:'Frozen wilderness placements, camps and encounter warnings.'},
  {id:'bosses',group:'world',name:'Wilderness bosses',path:'/bosses.html',description:'Three guarded lairs, committed attack warnings and automatic hoards.',tags:'boss elite arena'},
  {id:'events',group:'world',name:'Events',path:'/events.html',description:'Interactive landmark and reward presentation.'},
  {id:'settlement-lighting',group:'world',name:'Settlement nights',path:'/layouts.html?lighting',description:'Warm settlement lanterns, windows and hearths through a live day cycle, with render timings.',tags:'town village city night windows performance'},
  {id:'outdoor-lighting',group:'world',name:'Outdoor lighting',path:'/biomes.html?lighting',description:'Nine biome atmospheres, moving cloud shadows and a live day–night lighting study.',tags:'shader sunlight moonlight time day night cloud forest fog wet reflections'},
  {id:'dungeon-lighting',group:'world',name:'Dungeon lighting',path:'/dungeon.html?view=lighting&seed=7319&room=4',description:'Live illuminated mist, damp stone reflections and selective fixture glow; export a rendered chamber.',tags:'shader atmosphere fog bloom'},
  {id:'dungeon',group:'world',name:'Dungeons',path:'/dungeon.html?view=gallery',description:'Compare three dungeon themes, generate seeded layouts, inspect rooms and encounters, and export maps.'},
  {id:'forest',group:'world',name:'Forest motion',path:'/forest.html',description:'Wind, foliage, wildlife and canopy light; recording support.'},
  {id:'water',group:'world',name:'Water motion',path:'/water.html',description:'Seeded river and lake surfaces, waves and reflections.'},
  {id:'portal',group:'world',name:'Portals',path:'/portal.html',description:'Town travel effects and portal artwork.'},
  {id:'chronicle',group:'interface',name:'Chronicle',path:'/chronicle.html',description:'Account and character milestones, achievements and detailed statistics with sample history.'},
  {id:'ui',group:'interface',name:'Windows & components',path:'/ui.html',description:'Start, pause, defeat, map and shared controls at desktop or narrow widths.'},
  {id:'hud',group:'interface',name:'HUD states',path:'/hud.html',description:'Healthy, damaged and depleted resources and enemy plates.'},
  {id:'rewards',group:'interface',name:'Reward animations',path:'/rewards.html',description:'Replay gold, XP and level-up feedback with optional sound.'},
  {id:'music',group:'interface',name:'Soundtrack studies',path:'/music.html',description:'Listen to local menu, wilderness and dungeon music auditions.'},
  {id:'notifications',group:'interface',name:'Notifications',path:'/notifications.html',description:'Item pickups and discovery messages.'},
  {id:'journeys',group:'interface',name:'Journeys',path:'/journeys.html',description:'Activity guidance, tracked goals and journal presentation.'},
  {id:'touch',group:'interface',name:'Touch controls',path:'/touch.html',description:'Touch layout and mobile controls.'},
  {id:'thor',group:'interface',name:'Thor companion',path:'/thor.html?preview=1',description:'Preview lower-screen map, inventory and character controls.'},
  {id:'progression',group:'data',name:'Progression & loot',path:'/progression.html',description:'Compare current enemy stats, XP, item curves and drop distributions.'},
  {id:'hud-history',group:'archive',name:'HUD concepts',path:'/hud-directions.html',description:'Historical alternatives; Astral is the selected runtime design.'},
];
export function toolForPath(path: string): Tool | undefined {
  const url = new URL(path, 'http://local');
  const matches = TOOLS.filter(t => new URL(t.path, url.origin).pathname === url.pathname);
  return matches.find(t => { const q = new URL(t.path, url.origin).searchParams; return q.size > 0 && [...q].every(([k,v]) => url.searchParams.get(k) === v); }) ?? matches[0];
}
export const toolURL = (tool: Tool, path = tool.path) => `/tools/?tool=${encodeURIComponent(tool.id)}&view=${encodeURIComponent(path)}`;
export function safeToolPath(tool: Tool, path: string | null): string {
  if (!path) return tool.path;
  try { const u = new URL(path, 'http://local'); return u.origin === 'http://local' && u.pathname === new URL(tool.path, u.origin).pathname ? u.pathname + u.search + u.hash : tool.path; } catch { return tool.path; }
}
