export type GearMaterial = 'iron' | 'silver' | 'gold' | 'glass' | 'steel' | 'brass' | 'leather' | 'wood' | 'cloth' | 'silk' | 'velvet' | 'starweave' | 'gem';
export const GEAR_MATERIALS = Object.freeze({
  iron: Object.freeze({ roughness: .46, metalness: .88, light: '#d4dce0', shade: '#202b34' }),
  silver: Object.freeze({ roughness: .18, metalness: .98, light: '#f4fcff', shade: '#30415a' }),
  gold: Object.freeze({ roughness: .23, metalness: .98, light: '#ffe6a0', shade: '#5b381d' }),
  glass: Object.freeze({ roughness: .08, metalness: 0, light: '#e2faff', shade: '#223f4c' }),
  steel: Object.freeze({ roughness: .27, metalness: .92, light: '#e5eef0', shade: '#101d2b' }),
  brass: Object.freeze({ roughness: .34, metalness: .85, light: '#fff1c0', shade: '#33231c' }),
  leather: Object.freeze({ roughness: .72, metalness: 0, light: '#dabd94', shade: '#18191d' }),
  wood: Object.freeze({ roughness: .8, metalness: 0, light: '#e4c295', shade: '#192023' }),
  velvet: Object.freeze({ roughness: .88, metalness: 0, light: '#e4bdcf', shade: '#291627' }),
  starweave: Object.freeze({ roughness: .36, metalness: 0, light: '#e0edff', shade: '#202f50' }),
  silk: Object.freeze({ roughness: .48, metalness: 0, light: '#eee5ff', shade: '#302f46' }),
  cloth: Object.freeze({ roughness: .96, metalness: 0, light: '#d5d3bd', shade: '#101923' }),
  gem: Object.freeze({ roughness: .13, metalness: 0, light: '#f1ffff', shade: '#152239' }),
});
export const GEAR_MATERIAL_IDS: readonly GearMaterial[] = ['steel','brass','leather','wood','cloth','gem','iron','silver','gold','glass','silk','velvet','starweave'];
