import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { TOOLS, WORKSPACES, safeToolPath, toolForPath } from '../src/tools/catalog.ts';
import { forgeItem, forgeProfiles, forgeMaterials } from '../src/tools/forge-model.ts';
import { ITEM_KINDS, deriveItem } from '../src/items.ts';
import { SkillStudy, studyWeapons } from '../src/tools/skill-scene.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_SPECIALIZATIONS } from '../src/skill-progression.ts';
import { DATASETS } from '../src/tools/datasets.ts';
import { surveyPlaces } from '../src/tools/placements-model.ts';
import { World } from '../src/world.ts';
import type { WorldQuery } from '../src/model.ts';
const root=new URL('../',import.meta.url);
const emptyWorld:WorldQuery={seed:7319,blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})};
test('every local review belongs to a discoverable workspace and imports shared navigation',()=>{
  assert.equal(new Set(TOOLS.map(t=>t.id)).size,TOOLS.length);
  for(const tool of TOOLS){assert.ok(WORKSPACES.some(w=>w.id===tool.group));assert.ok(existsSync(new URL('.'+new URL(tool.path,'http://local').pathname,root)),tool.path);}
  for(const directory of ['', 'tools/'])for(const file of readdirSync(new URL(directory,root)).filter(f=>f.endsWith('.html')&&f!=='index.html')){
    const path=`/${directory}${file}`;assert.ok(toolForPath(path),`${path} missing from Tools`);
    assert.match(readFileSync(new URL(directory+file,root),'utf8'),/src\/tools\/review-nav.ts/);
  }
  assert.doesNotMatch(readFileSync(new URL('index.html',root),'utf8'),/tools\//,'runtime HTML must not import developer tools');
});
test('workspace navigation preserves review variants and rejects external or unrelated pages',()=>{
  const item=TOOLS.find(t=>t.id==='equipment')!;
  assert.equal(safeToolPath(item,'https://outside.example/equipment.html'),item.path);
  assert.equal(safeToolPath(item,'//outside.example/equipment.html'),item.path);
  assert.equal(safeToolPath(item,'/'),item.path);
  assert.equal(safeToolPath(item,'/equipment.html?item=7&portrait'),'/equipment.html?item=7&portrait');
  assert.equal(toolForPath('/character.html?panel=skills&node=skill:meteor')?.id,'skills');
  assert.equal(toolForPath('/bestiary.html?barks=1')?.id,'barks');
  assert.equal(toolForPath('/tools/forge.html?level=50')?.id,'forge');
});
test('forge produces deterministic, internally derived items for every kind and allowed material',()=>{
  for(const kind of ITEM_KINDS){const profile=forgeProfiles(kind)[0]?.id??'';
    for(const material of forgeMaterials(kind,profile)){
      const recipe={seed:7319,level:25,kind,profile,tier:'legendary' as const,material:material.id,enhancement:10};
      const item=forgeItem(recipe);assert.deepEqual(item,forgeItem(recipe));assert.deepEqual(item,deriveItem(structuredClone(item)));assert.equal(item.kind,kind);assert.equal(item.recipe.enhancement,10);
    }
  }
  assert.throws(()=>forgeItem({seed:1,level:0,kind:'weapon',profile:'',tier:'common',material:'',enhancement:0}));
  assert.throws(()=>forgeItem({seed:1,level:1,kind:'shield',profile:'ember-staff',tier:'common',material:'',enhancement:0}));
});
test('all active skills and specialization recipes activate in the isolated study',()=>{
  for(const skill of Object.values(SKILL_DEFINITIONS))for(const specialization of ['',...SKILL_SPECIALIZATIONS.filter(s=>s.skill===skill.id).map(s=>s.id)]){
    const study=new SkillStudy(emptyWorld,{skill:skill.id,rank:specialization?7:1,specialization,weapon:studyWeapons(skill.id)[0].id,facing:0,targets:'fan',enemy:'brute',x:0,y:0});
    const seen=new Set<string>();for(let i=0;i<240;i++)for(const event of study.step())seen.add(event.type);
    assert.equal(study.didCast,true,`${skill.id}/${specialization}`);assert.ok(seen.has('cast')||seen.has('swing'));
    assert.equal(study.simulation.kills,0);assert.equal(study.simulation.groundItems.length,0);assert.equal(study.simulation.enemies.length,7);
    assert.equal(study.simulation.player.character.skillSlots[0],skill.id);
  }
});
test('playground advances delayed effects to completion and stops after its bounded timeline',()=>{
  const study=new SkillStudy(emptyWorld,{skill:'meteor',rank:1,specialization:'',weapon:studyWeapons('meteor')[0].id,facing:0,targets:'fan',enemy:'brute',x:0,y:0});
  for(let i=0;i<1600;i++)study.step();const elapsed=study.elapsed;assert.ok(study.damage>0);assert.equal(study.simulation.groundEffects.length,0);assert.equal(study.simulation.kills,0);study.step();assert.equal(study.elapsed,elapsed);
});
test('catalogs track the live skill and enemy registries and contain exportable records',()=>{
  assert.equal(DATASETS.find(d=>d.id==='skills')!.records.length,Object.keys(SKILL_DEFINITIONS).length);
  assert.equal(DATASETS.find(d=>d.id==='specializations')!.records.length,SKILL_SPECIALIZATIONS.length);
  for(const dataset of DATASETS){assert.ok(dataset.records.length>0);assert.doesNotThrow(()=>JSON.stringify(dataset));}
});
test('world survey returns deterministic bounded geography without player exploration',()=>{
  const query={seed:7319,x:0,y:0,size:3000},world=new World(query.seed);
  try{const first=surveyPlaces(world,query);assert.deepEqual(first,surveyPlaces(world,query));for(const p of first){assert.ok(Math.abs(p.x)<=1500&&Math.abs(p.y)<=1500);assert.ok(p.zone.level>=1);}
    assert.throws(()=>surveyPlaces(world,{...query,size:1000000}));
  }finally{world.dispose();}
});
