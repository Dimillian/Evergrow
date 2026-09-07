import { Simulation } from '../simulation.ts';
import { generateItem } from '../items.ts';
import { refreshCharacter } from '../character.ts';
import { SKILL_DEFINITIONS, canUseSkill } from '../skill-content.ts';
import { SKILL_SPECIALIZATIONS, specializationNode, masteryNode, resolveSkill } from '../skill-progression.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../weapon-content.ts';
import type { SkillId } from '../character-types.ts';
import type { CombatEvent, Input, WorldQuery, EnemyKind } from '../model.ts';
export interface SkillStudyOptions {skill:SkillId;rank:number;specialization:string;weapon:string;facing:number;targets:'fan'|'line'|'ring'|'none';enemy:EnemyKind;x:number;y:number;}
export function studyWeapons(id:SkillId){return WEAPON_PROFILES.filter(mainHand=>canUseSkill(id,{mainHand,offHand:{kind:'shield',shield:SHIELD_PROFILES[0]}}));}
/** A disposable simulation with only authored training targets; no Game, session or repository. */
export class SkillStudy {
  readonly simulation:Simulation;
  readonly options:SkillStudyOptions;
  readonly input:Input;
  readonly resolved:ReturnType<typeof resolveSkill>;
  elapsed=0;
  didCast=false;
  readonly initialTargetLife=1000000;
  constructor(world:WorldQuery,options:SkillStudyOptions){
    if(!SKILL_DEFINITIONS[options.skill]||!Number.isInteger(options.rank)||options.rank<1||options.rank>7||!Number.isFinite(options.facing))throw new Error('Invalid skill study configuration.');
    if(!studyWeapons(options.skill).some(w=>w.id===options.weapon))throw new Error('Choose a compatible weapon.');
    if(options.specialization&&!SKILL_SPECIALIZATIONS.some(s=>s.id===options.specialization&&s.skill===options.skill))throw new Error('Choose a specialization belonging to this skill.');
    this.options=options;
    // Supply collision/biome only: this study cannot discover camps, containers or event sites.
    const query:WorldQuery={seed:world.seed,blocked:(x,y,r)=>world.blocked(x,y,r),move:(x,y,dx,dy,r)=>world.move(x,y,dx,dy,r),...(world.sampleBiome?{sampleBiome:(x:number,y:number)=>world.sampleBiome!(x,y)}:{})};
    const sim=this.simulation=new Simulation(query,{spawn:false,seed:7319,startX:options.x,startY:options.y});
    const p=sim.player,sheet=p.character;
    sheet.allocatedNodes=['origin',`skill:${options.skill}`,masteryNode(options.skill)];
    sheet.skillRanks[options.skill]=options.rank;sheet.skillSlots[0]=options.skill;
    if(options.specialization){sheet.allocatedNodes.push(specializationNode(options.specialization));sheet.skillSpecializations[options.skill]=options.specialization;}
    sheet.equipped.weapon=generateItem(1024,1,'weapon',options.weapon,'common');sheet.equipped.offhand=SKILL_DEFINITIONS[options.skill].requirement==='shield'?generateItem(2048,1,'shield',SHIELD_PROFILES[0].id,'common'):null;
    refreshCharacter(p);p.angle=options.facing;p.hp=p.maxHp;p.mana=p.maxMana=100000;
    this.resolved=resolveSkill(options.skill,p.derived,sheet);
    const near=['melee','blade','dagger','heavy','shield'].includes(SKILL_DEFINITIONS[options.skill].requirement),distance=near?38:140;
    this.input={moveX:0,moveY:0,aimX:p.x+Math.cos(options.facing)*distance,aimY:p.y+Math.sin(options.facing)*distance,attack:false,dodge:false,heal:false,skillSlot:null};
    if(options.targets!=='none')for(let i=0;i<7;i++){
      const angle=options.facing+(options.targets==='ring'?i*Math.PI*2/7:options.targets==='fan'?(i-3)*.13:0),r=options.targets==='ring'?(near?45:85):options.targets==='line'?distance+i*27:distance+Math.abs(i-3)*8;
      const enemy=sim.spawnEnemy(options.enemy,p.x+Math.cos(angle)*r,p.y+Math.sin(angle)*r);
      if(enemy){enemy.hp=enemy.maxHp=this.initialTargetLife;enemy.angle=options.facing+Math.PI;enemy.stagger=60;}
    }
    sim.setCombatViewport({x:p.x-450,y:p.y-330,width:900,height:660});sim.drainEvents();
  }
  step():CombatEvent[]{
    if(this.elapsed>=12)return [];
    const sim=this.simulation;
    // Targets remain stationary and cannot fight; damage, knockback and status effects still resolve normally.
    for(const enemy of sim.enemies){enemy.stagger=60;enemy.hp=Math.max(10000,enemy.hp);}
    const cast=!this.didCast&&this.elapsed>=.3;
    sim.update(1/120,{...this.input,skillSlot:cast?0:null});this.elapsed+=1/120;
    const events=sim.drainEvents();if(cast)this.didCast=events.some(e=>e.type==='cast'||e.type==='swing');return events;
  }
  get damage(){return this.simulation.enemies.reduce((sum,enemy)=>sum+this.initialTargetLife-enemy.hp,0);}
}
