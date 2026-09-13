import { deriveAttackStats } from '../equipment.ts';
import { UNIQUES, uniqueSlot } from '../unique-content.ts';
import { chronicleValues } from '../chronicle.ts';
import { cloneData } from '../data-clone.ts';
import type { CharacterSheet } from '../character-types.ts';
import { Simulation } from '../simulation.ts';
import { generateItem, generateUnique } from '../items.ts';
import { refreshCharacter } from '../character.ts';
import { SKILL_DEFINITIONS, canUseSkill } from '../skill-content.ts';
import { SKILL_RANK_RULES, SKILL_SPECIALIZATIONS, specializationNode, resolveSkill } from '../skill-progression.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../weapon-content.ts';
import type { SkillId } from '../character-types.ts';
import type { CombatEvent, Input, WorldQuery, EnemyKind } from '../model.ts';
export type SkillStudyScenario = 'showcase' | 'followup' | 'defense' | 'sustain';
export interface SkillStudyOptions {unique?:string;scenario?:SkillStudyScenario;level?:number;baseline?:boolean;rear?:boolean;skill:SkillId;rank:number;specialization:string;weapon:string;facing:number;targets:'fan'|'line'|'ring'|'single'|'none';enemy:EnemyKind;x:number;y:number;}
export function studyWeapons(id:SkillId){return WEAPON_PROFILES.filter(mainHand=>canUseSkill(id,{mainHand,offHand:{kind:'shield',shield:SHIELD_PROFILES[0]}}));}
/** A disposable simulation with only authored training targets; no Game, session or repository. */
export class SkillStudy {
  readonly simulation:Simulation;
  readonly options:SkillStudyOptions;
  readonly input:Input;
  readonly resolved:ReturnType<typeof resolveSkill>;
  elapsed=0;
  incomingDamage=0;
  damageTaken=0;
  absorbed=0;
  private nextHit=.9;
  private targetPositions=new Map<number,{x:number;y:number}>();
  get duration(){return this.options.scenario==='sustain'?30:12;}
  get casts(){return chronicleValues(this.simulation.player.chronicle?.sources??[])[`skillUses:${this.options.skill}`]??0;}
  get manaSpent(){return chronicleValues(this.simulation.player.chronicle?.sources??[]).manaSpent??0;}
  didCast=false;
  readonly initialTargetLife=1000000;
  constructor(world:WorldQuery,options:SkillStudyOptions,loadout?:CharacterSheet){
    if(options.scenario&&!['showcase','followup','defense','sustain'].includes(options.scenario)||options.level!==undefined&&(!Number.isInteger(options.level)||options.level<1||options.level>100))throw new Error('Invalid study scenario or level.');
    if(!SKILL_DEFINITIONS[options.skill]||!Number.isInteger(options.rank)||options.rank<1||options.rank>SKILL_RANK_RULES.maximum||!Number.isFinite(options.facing))throw new Error('Invalid skill study configuration.');
    if(!studyWeapons(options.skill).some(w=>w.id===options.weapon))throw new Error('Choose a compatible weapon.');
    if(options.specialization&&!SKILL_SPECIALIZATIONS.some(s=>s.id===options.specialization&&s.skill===options.skill))throw new Error('Choose a specialization belonging to this skill.');
    this.options={...options};
    // Supply collision/biome only: this study cannot discover camps, containers or event sites.
    const query:WorldQuery={seed:world.seed,blocked:(x,y,r)=>world.blocked(x,y,r),move:(x,y,dx,dy,r)=>world.move(x,y,dx,dy,r),...(world.sampleBiome?{sampleBiome:(x:number,y:number)=>world.sampleBiome!(x,y)}:{})};
    const sim=this.simulation=new Simulation(query,{spawn:false,seed:7319,startX:options.x,startY:options.y});
    const p=sim.player; p.level=options.level??1;
    if(loadout)p.character=cloneData(loadout);
    const sheet=p.character;
    if(!loadout){
    sheet.attributes[SKILL_DEFINITIONS[options.skill].requirement==='magic'?'intelligence':'strength']+=3*(p.level-1);
    sheet.attributes.vitality+=2*(p.level-1);
    sheet.allocatedNodes=['origin',`skill:${options.skill}`];
    sheet.skillRanks[options.skill]=options.rank;sheet.skillSlots[0]=options.skill;
    if(options.specialization){sheet.allocatedNodes.push(specializationNode(options.specialization));sheet.skillSpecializations[options.skill]=options.specialization;}
    sheet.equipped.weapon=generateItem(1024,p.level,'weapon',options.weapon,'common');sheet.equipped.offhand=SKILL_DEFINITIONS[options.skill].requirement==='shield'?generateItem(2048,p.level,'shield',SHIELD_PROFILES[0].id,'common'):null;
    }
    const unique=UNIQUES.find(u=>u.id===options.unique);
    if(options.unique&&!unique)throw new Error('Unknown unique');
    if(unique){
      if(unique.skill!==options.skill)throw new Error('Choose a unique for this skill');
      if((unique.kind==='grimoire'||unique.kind==='orb')&&sheet.equipped.weapon?.weapon?.hands===2)sheet.equipped.weapon=generateItem(1024,p.level,'weapon','cinder-wand','common');
      sheet.equipped[uniqueSlot(unique)]=generateUnique(7319,p.level,unique.id);
    }
    refreshCharacter(p);p.angle=options.facing;p.hp=p.maxHp;p.mana=p.maxMana;
    if(!options.scenario||options.scenario==='showcase')p.mana=p.maxMana=100000;
    this.resolved=resolveSkill(options.skill,p.derived,sheet);
    const near=p.equipment.mainHand.attackKind==='melee',range=near?Math.min(38,deriveAttackStats(p.stats,p.equipment.mainHand).range*.65):140;
    const distance=this.resolved.recipe.kind==='radial'?(this.resolved.recipe.targetRange?220:Math.min(range,this.resolved.recipe.radius*.6)):range;
    this.options.weapon=sheet.equipped.weapon?.recipe.profileId??options.weapon;
    this.input={moveX:0,moveY:0,aimX:p.x+Math.cos(options.facing)*distance,aimY:p.y+Math.sin(options.facing)*distance,attack:false,dodge:false,heal:false,skillSlot:null};
    if(options.targets!=='none')for(let i=0;i<(options.targets==='single'?1:7);i++){
      const angle=options.facing+(options.targets==='ring'?i*Math.PI*2/7:options.targets==='fan'?(i-3)*.13:0),r=options.targets==='ring'?(near?45:85):options.targets==='line'?distance+i*27:distance+Math.abs(i-3)*8;
      const enemy=sim.spawnEnemy(options.enemy,p.x+Math.cos(angle)*r,p.y+Math.sin(angle)*r);
      if(enemy){enemy.hp=enemy.maxHp=this.initialTargetLife;enemy.angle=options.facing+(options.rear?0:Math.PI);enemy.stagger=60;this.targetPositions.set(enemy.id,{x:enemy.x,y:enemy.y});}
    }
    sim.setCombatViewport({x:p.x-450,y:p.y-330,width:900,height:660});sim.drainEvents();
  }
  step():CombatEvent[]{
    if(this.elapsed>=this.duration||this.simulation.player.dead)return [];
    const sim=this.simulation,p=sim.player,scenario=this.options.scenario??'showcase';
    // Dummy AI is held still. Damage, statuses, recovery, projectiles and mana use runtime rules.
    for(const enemy of sim.enemies){enemy.stagger=60;if(scenario!=='showcase'){const point=this.targetPositions.get(enemy.id)!;enemy.x=point.x;enemy.y=point.y;enemy.knockbackX=enemy.knockbackY=0;}}
    const ready=this.elapsed>=.3&&!this.options.baseline;
    const returning=!!p.skillEffects?.returnStep&&this.elapsed>=1.2;
    const cast=ready&&(!this.didCast||returning||scenario==='sustain'||!!this.options.unique&&this.options.skill==='whirlwind'&&this.elapsed<4);
    const attack=(scenario==='followup'||scenario==='sustain'||!!this.options.unique&&['fireball','ghostHunt'].includes(this.options.skill))&&this.elapsed>=.55&&(this.didCast||!!this.options.baseline);
    const showSpirit=scenario==='showcase'&&['ashen-double','pale-huntsman'].includes(this.options.unique??'')&&this.elapsed>=.55&&this.elapsed<1.25;
    sim.update(1/120,{...this.input,moveY:showSpirit?1:this.input.moveY,attack,skillSlot:cast?0:null});this.elapsed+=1/120;
    const events=sim.drainEvents();
    if(events.some(e=>(e.type==='cast'||e.type==='swing')&&e.skill===this.options.skill))this.didCast=true;
    if(scenario==='defense'&&this.elapsed>=this.nextHit){
      this.nextHit+=1.2;
      const amount=p.maxHp*.1;this.incomingDamage+=amount;
      // A reproducible pressure probe: physical hits of 10% max life, bypassing dummy AI only.
      p.derived.blockChance=0;sim.takeDamage(amount,0,p.level,'physical');events.push(...sim.drainEvents());
    }
    for(const e of events){if(e.type==='hurt')this.damageTaken+=e.actualValue??0;if(e.type==='block')this.absorbed+=e.value;}
    return events;
  }
  get damage(){return this.simulation.enemies.reduce((sum,enemy)=>sum+this.initialTargetLife-enemy.hp,0);}
}
