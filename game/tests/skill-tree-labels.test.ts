import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILL_TREE, SKILL_NODES } from '../src/skill-tree.ts';
import { layoutAtlasCaptions, skillNodeScreenRadius, placeAtlasLabel } from '../src/skill-tree-labels.ts';
import { fitAtlasBounds } from '../src/skill-tree-view.ts';
import { buildAtlasLightPlan } from '../src/skill-tree-light.ts';

const measure=(text:string,size:number)=>[...text].reduce((sum,c)=>sum+(c==='i'||c==='l'? .3:c==='W'||c==='M'?.9:.6)*size,0);

test('caption plates avoid every lens, other caption and actual curved connector across skill views',()=>{
  for(const skill of SKILL_TREE.nodes.filter(n=>n.skill))for(const zoom of [.3,.85,1.65])for(const [width,height] of [[520,620],[1280,720]]){
    const view={width,height,zoom,centerX:skill.x,centerY:skill.y,selected:skill.id,hovered:null,matches:()=>true};
    const labels=layoutAtlasCaptions(view,measure);
    const screen=(p:{x:number;y:number})=>({x:(p.x-skill.x)*zoom+width/2,y:(p.y-skill.y)*zoom+height/2});
    const tag=`${skill.id} at ${zoom}, ${width}`;
    for(let i=0;i<labels.length;i++){
      const box=labels[i];
      assert.ok(box.x>=8&&box.y>=8&&box.x+box.width<=width-8&&box.y+box.height<=height-65,tag);
      for(const other of labels.slice(0,i))assert.ok(box.x>=other.x+other.width||box.x+box.width<=other.x||box.y>=other.y+other.height||box.y+box.height<=other.y,`${tag}: text overlaps text`);
      for(const node of SKILL_TREE.nodes){
        const p=screen(node),dx=Math.max(box.x-p.x,0,p.x-box.x-box.width),dy=Math.max(box.y-p.y,0,p.y-box.y-box.height);
        assert.ok(Math.hypot(dx,dy)>=skillNodeScreenRadius(node,zoom)+5,`${tag}: ${box.text} covers ${node.id}`);
      }
      for(const edge of SKILL_TREE.edges){
        const a=screen(SKILL_NODES.get(edge.from)!),b=screen(SKILL_NODES.get(edge.to)!);
        const c=edge.control?screen(edge.control):{x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        if(Math.max(a.x,b.x,c.x)<box.x||Math.min(a.x,b.x,c.x)>box.x+box.width||Math.max(a.y,b.y,c.y)<box.y||Math.min(a.y,b.y,c.y)>box.y+box.height)continue;
        // Independently sample the render curve every two pixels, not the packer's flattened obstacles.
        const steps=Math.ceil((Math.hypot(a.x-c.x,a.y-c.y)+Math.hypot(b.x-c.x,b.y-c.y))/2);
        for(let k=0;k<=steps;k++){
          const t=k/steps,u=1-t,x=u*u*a.x+2*u*t*c.x+t*t*b.x,y=u*u*a.y+2*u*t*c.y+t*t*b.y;
          assert.ok(x<box.x||x>box.x+box.width||y<box.y||y>box.y+box.height,`${tag}: line crosses ${box.text}`);
        }
      }
    }
    if(zoom===1.65)assert.ok(labels.some(l=>l.owner===skill.id),`${tag}: focused skill should remain named at detail scale`);
  }
});

test('the crowded Fireball/Backstab view names both skills without sharing their lens space',()=>{
  const node=SKILL_NODES.get('skill:fireball')!;
  const labels=layoutAtlasCaptions({width:1280,height:720,zoom:.85,centerX:node.x,centerY:node.y,selected:node.id,matches:()=>true},measure);
  assert.ok(labels.some(l=>l.text==='Fireball'));
  assert.ok(labels.some(l=>l.text==='Backstab'));
  assert.equal(labels.filter(l=>l.owner.startsWith('specialization:fireball')).length,3);
});

test('a completely occupied pocket drops its optional caption instead of painting over the graph',()=>{
  assert.equal(placeAtlasLabel({x:250,y:250,radius:20},120,22,{width:500,height:500},
    {nodes:[{x:250,y:250,radius:1000}],lines:[]},[]),undefined);
});

test('animated light receives the exact screen-space caption exclusion areas',()=>{
  const node=SKILL_NODES.get('skill:fireball')!;
  const view={width:1280,height:720,zoom:.85,centerX:node.x,centerY:node.y,selected:node.id,hovered:null,matches:()=>true,allocated:new Set(['origin']),reachable:new Set<string>(),route:[]};
  const labels=layoutAtlasCaptions(view,measure);
  assert.deepEqual(buildAtlasLightPlan(view,labels).captions,labels);
});


test('captions also avoid the measured navigator and toolbar rectangles',()=>{
  const node=SKILL_NODES.get('skill:backstab')!,exclusion={x:260,y:250,width:230,height:160};
  const labels=layoutAtlasCaptions({width:520,height:620,zoom:.85,centerX:node.x,centerY:node.y,selected:node.id,matches:()=>true,labelExclusions:[exclusion]},measure);
  for(const box of labels)assert.ok(box.x>=exclusion.x+exclusion.width||box.x+box.width<=exclusion.x||box.y>=exclusion.y+exclusion.height||box.y+box.height<=exclusion.y);
});


test('a fitted overview keeps all six territory names outside the dense map on wide and narrow panels',()=>{
  for(const [width,height] of [[520,720],[1280,500],[900,320]]){
    const fit=fitAtlasBounds(SKILL_TREE.bounds,width,height);
    const captions=layoutAtlasCaptions({...fit,width,height,selected:'origin',matches:()=>true},measure);
    for(const text of ['BASTION','FORGE','HUNT','VEIL','CRUCIBLE','WELLSPRING'])assert.ok(captions.some(c=>c.text===text),`${width}×${height}: ${text}`);
  }
});
