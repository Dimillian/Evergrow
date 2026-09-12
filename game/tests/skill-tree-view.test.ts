import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILL_TREE, SKILL_NODES, SKILL_TERRITORIES } from '../src/skill-tree.ts';
import { atlasNavigatorProjection, boundsForNodes, fitAtlasBounds } from '../src/skill-tree-view.ts';
import { buildSkillRoutes } from '../src/skill-tree-routes.ts';

test('overview and territory fits contain their complete content on wide and narrow panels',()=>{
  for(const [width,height] of [[1350,640],[520,620],[900,320]]){
    for(const nodes of [SKILL_TREE.nodes,...SKILL_TERRITORIES.map(t=>SKILL_TREE.nodes.filter(n=>n.territory===t.id))]){
      const fit=fitAtlasBounds(boundsForNodes(nodes),width,height);
      for(const n of nodes){
        const x=(n.x-fit.centerX)*fit.zoom+width/2,y=(n.y-fit.centerY)*fit.zoom+height/2;
        assert.ok(x>=40&&x<=width-40&&y>=50&&y<=height-50,`${n.id} falls outside the fitted viewport`);
      }
    }
  }
});

test('navigator preserves aspect ratio and inverts clicks through letterboxing',()=>{
  for(const [width,height] of [[170,94],[110,64],[300,70]]){
    const p=atlasNavigatorProjection(width,height);
    for(const node of SKILL_TREE.nodes){
      const x=node.x*p.scale+p.offsetX,y=node.y*p.scale+p.offsetY;
      assert.ok(x>=0&&x<=width&&y>=0&&y<=height);
      const world=p.toWorld(x,y);
      assert.ok(Math.abs(world.x-node.x)<1e-8&&Math.abs(world.y-node.y)<1e-8);
    }
  }
});

test('border gardens are optional investments and leave all active unlock distances intact',()=>{
  const gardens=SKILL_TREE.clusters.filter(c=>c.id.startsWith('garden:'));
  assert.equal(gardens.length,36);
  for(const c of gardens){
    const members=SKILL_TREE.nodes.filter(n=>n.cluster===c.id);
    const exits=members.flatMap(n=>n.neighbors.filter(id=>SKILL_NODES.get(id)!.cluster!==c.id));
    assert.equal(exits.length,c.id.endsWith(':3')?2:1);assert.ok(exits[0].startsWith('road:'));
    assert.ok(members.every(n=>Object.keys(n.bonuses).length>0));
  }
  const distances=buildSkillRoutes(new Set(['origin']));
  const expected={repulse:15,ironCitadel:33,smokeVeil:14,nightReaping:33,brace:2,shieldBash:4,bulwark:6,cleave:2,lunge:5,whirlwind:9,earthshatter:13,rallyOfIron:23,
    volley:2,ricochet:8,piercingShot:10,rainOfArrows:13,ghostHunt:23,backstab:2,sidestep:3,vaultingShot:8,
    fireball:2,arcLightning:3,meteor:14,cataclysm:24,tempest:26,iceNova:3,runicWard:5,siphon:8,frostLance:11,absoluteZero:24};
  for(const [skill,cost] of Object.entries(expected))assert.equal(distances.get(`skill:${skill}`)!.cost,cost,skill);
});

test('connectors do not run through unrelated node faces',()=>{
  for(const edge of SKILL_TREE.edges){
    const a=SKILL_NODES.get(edge.from)!,b=SKILL_NODES.get(edge.to)!;
    const c=edge.control??{x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const nearby=SKILL_TREE.nodes.filter(n=>n!==a&&n!==b
      &&n.x>Math.min(a.x,b.x,c.x)-25&&n.x<Math.max(a.x,b.x,c.x)+25
      &&n.y>Math.min(a.y,b.y,c.y)-25&&n.y<Math.max(a.y,b.y,c.y)+25);
    const steps=Math.ceil((Math.hypot(a.x-c.x,a.y-c.y)+Math.hypot(b.x-c.x,b.y-c.y))/5);
    for(const n of nearby){
      let distance=Infinity;
      for(let i=1;i<steps;i++){
        const t=i/steps,u=1-t;
        distance=Math.min(distance,Math.hypot(n.x-(u*u*a.x+2*u*t*c.x+t*t*b.x),n.y-(u*u*a.y+2*u*t*c.y+t*t*b.y)));
      }
      const radius=n.kind==='major'?22:n.kind==='notable'?15:8;
      assert.ok(distance>=radius,`${edge.from} → ${edge.to} crosses ${n.id}`);
    }
  }
});


test('outer roads have short smooth segments and forward-facing ultimate endpoints',()=>{
  for(const territory of SKILL_TERRITORIES){
    const road=SKILL_TREE.nodes.filter(n=>n.id.startsWith(`road:${territory.id}:`));
    for(let i=14;i<road.length;i++){
      const a=road[i-1],b=road[i],edge=SKILL_TREE.edges.find(e=>e.from===a.id&&e.to===b.id)!;
      assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<=180,`${b.id} stretches the outer road`);
      const previous=SKILL_TREE.edges.find(e=>e.from===road[i-2].id&&e.to===a.id)!;
      const incoming=previous.control??road[i-2],outgoing=edge.control??b;
      const turn=Math.atan2(outgoing.y-a.y,outgoing.x-a.x)-Math.atan2(a.y-incoming.y,a.x-incoming.x);
      assert.ok(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<.025,`${a.id} has a visible corner`);
    }
    const end=road.at(-1)!,before=road.at(-2)!,skill=end.neighbors.map(id=>SKILL_NODES.get(id)!).find(n=>n.skill)!;
    assert.ok((skill.x-end.x)*(end.x-before.x)+(skill.y-end.y)*(end.y-before.y)>0,`${skill.id} doubles back from its road`);
  }
});

test('six outer clusters are useful optional detours distributed along the sparse late roads',()=>{
  const clusters=SKILL_TREE.clusters.filter(c=>c.id.startsWith('outer:'));
  assert.equal(clusters.length,6);
  for(const territory of ['bastion','veil']){
    const entries=clusters.filter(c=>c.territory===territory).map(c=>{
      const members=SKILL_TREE.nodes.filter(n=>n.cluster===c.id);
      assert.ok(members.every(n=>Object.keys(n.bonuses).length>0));
      const exits=members.flatMap(n=>n.neighbors.filter(id=>SKILL_NODES.get(id)!.cluster!==c.id));
      assert.equal(exits.length,1);return exits[0];
    });
    assert.deepEqual(entries,[23,26,29].map(i=>`road:${territory}:${i}`));
  }
});


test('unrelated skill medallions retain room for their engraving and a nearby caption',()=>{
  const skills=SKILL_TREE.nodes.filter(n=>n.kind==='major');
  for(let i=0;i<skills.length;i++)for(const other of skills.slice(0,i)){
    assert.ok(Math.hypot(skills[i].x-other.x,skills[i].y-other.y)>=140,`${skills[i].id} crowds ${other.id}`);
  }
});
