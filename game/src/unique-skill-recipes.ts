import { auraSummary } from './aura-content.ts';
import type { CharacterSheet, SkillId } from './character-types.ts';
import type { SkillExecution } from './skill-execution-content.ts';
import { hasUnique } from './unique-content.ts';

/** Apply after ranks/Techniques. Only the fresh resolved recipe may be changed. */
export function applyUniqueSkillRecipe(id: SkillId, recipe: SkillExecution, sheet: CharacterSheet): void {
  if(recipe.kind==='aura')recipe.summary=auraSummary(recipe.aura,recipe.rank,sheet);
  if(id==='cleave'&&recipe.kind==='sweep'&&hasUnique(sheet,'horizon-edge'))recipe.traveling=true;
  if(id==='repulse'&&recipe.kind==='cone'&&hasUnique(sheet,'undertow-grasp'))recipe.pull=70;
  if(id==='brace'&&recipe.kind==='stance'&&hasUnique(sheet,'oathplate')){recipe.barrier=Math.min(.35,recipe.reduction);recipe.reduction=0;}
  if(id==='rallyOfIron'&&recipe.kind==='stance'&&hasUnique(sheet,'war-drummers-crown')){recipe.unlimited=true;recipe.duration*=.5;}
  if(id==='ironCitadel'&&recipe.kind==='radial'&&recipe.shelter&&hasUnique(sheet,'foundation-of-kings'))recipe.shelter={...recipe.shelter,duration:recipe.shelter.duration*2,anchored:true};
  if(id==='sidestep'&&recipe.kind==='step'&&hasUnique(sheet,'frostwake-soles'))recipe.frostPatch=true;
  if(id==='vaultingShot'&&recipe.kind==='step'&&hasUnique(sheet,'skystrider-greaves')){recipe.retreat=false;recipe.offsets=[0,-.24,.24];}
  if(id==='nightReaping'&&recipe.kind==='backstab'&&hasUnique(sheet,'reapers-veil'))recipe.controlledRear=true;
  if(id==='meteor'&&recipe.kind==='ground'&&hasUnique(sheet,'second-sun'))recipe.repeatDelay=.65;
  if(id==='cataclysm'&&recipe.kind==='ground'&&hasUnique(sheet,'faultline-regalia'))recipe.line=true;
  if(id==='tempest'&&recipe.kind==='ground'&&hasUnique(sheet,'stormwalkers-mantle')){recipe.follow=false;recipe.travelDistance=300;}
  if(id==='absoluteZero'&&recipe.kind==='ground'&&hasUnique(sheet,'winter-prison'))recipe.lingeringFrost=6;
}
