import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILL_TREE, SKILL_NODES, SKILL_TERRITORIES } from '../src/skill-tree.ts';
import { atlasNavigatorProjection, boundsForNodes, fitAtlasBounds } from '../src/skill-tree-view.ts';

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


test('unrelated skill medallions retain room for their engraving and a nearby caption',()=>{
  const skills=SKILL_TREE.nodes.filter(n=>n.kind==='major');
  for(let i=0;i<skills.length;i++)for(const other of skills.slice(0,i)){
    assert.ok(Math.hypot(skills[i].x-other.x,skills[i].y-other.y)>=140,`${skills[i].id} crowds ${other.id}`);
  }
});
