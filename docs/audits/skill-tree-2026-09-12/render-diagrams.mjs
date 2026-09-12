// Static research figures; no game, browser, renderer or character-save access.
// Run after game/scripts/skill-tree-audit.ts has produced current-tree.json.
import { readFileSync, writeFileSync } from 'node:fs';
const base = new URL('./', import.meta.url);
const data = JSON.parse(readFileSync(new URL('current-tree.json', base)));
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const text = (x, y, value, size = 18, fill = '#252b30', extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(value)}</text>`;
const line = (x1,y1,x2,y2,color='#b2b9bd',width=2) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
const dot = (x,y,r,fill='#fff',stroke='#63727a',width=2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const start = (title, description) => `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="0 0 1400 1400" role="img"><title>${esc(title)}</title><desc>${esc(description)}</desc><rect width="1400" height="1400" fill="#fafbf9"/><g font-family="Arial, sans-serif" transform="translate(0 180)">${text(48,52,title,28)}${text(48,85,description,16,'#5c656b')}`;
const nodes = new Map(data.graph.map(n=>[n.id,n]));
const xs=data.graph.map(n=>n.x),ys=data.graph.map(n=>n.y);
const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
const scale=Math.min(1240/(maxX-minX),735/(maxY-minY));
const sx=x=>700+(x-(minX+maxX)/2)*scale,sy=y=>510+(y-(minY+maxY)/2)*scale;
let svg=start('Current Evergrow tree: measured topology','Exact runtime coordinates and connections. Analytical plot; game lighting, glyphs and labels are omitted.');
for(const e of data.graphEdges){const a=nodes.get(e.from),b=nodes.get(e.to);svg+=`<path d="M${sx(a.x)} ${sy(a.y)} ${e.control?`Q${sx(e.control.x)} ${sy(e.control.y)}`:'L'} ${sx(b.x)} ${sy(b.y)}" fill="none" stroke="#b5bdc2" stroke-width=".75"/>`;}
for(const n of data.graph){const active=!!n.skill,key=!!n.keystone;svg+=dot(sx(n.x),sy(n.y),n.kind==='origin'?7:active?6:key?5:1.5,active?'#11675f':key?'#ad6436':'#89959b',active?'#11675f':'none',0);}
svg+=text(690,160,'ARCANA',20,'#3b474f')+text(125,800,'MIGHT',20,'#3b474f')+text(1070,780,'CUNNING',20,'#3b474f');
svg+=line(740,420,1080,300,'#11675f',1.5)+text(1010,260,'17 regular actives',20,'#11675f')+text(1010,285,'3–4 points from origin',17);
svg+=text(48,930,'2,182 nodes  ·  150 passive clusters  ·  21 repeated families  ·  1 keystone',20);
svg+=dot(52,965,5,'#11675f','#11675f')+text(67,971,'Active skill',16)+dot(240,965,5,'#ad6436','#ad6436')+text(255,971,'Keystone',16)+text(1030,971,'Source: current-tree.json',15);
writeFileSync(new URL('current-tree.svg',base),svg+'</g></svg>');

svg=start('Proposal: the Living Atlas','Schematic territory map and node grammar. Connections are conceptual; point costs require an authored graph.');
// Asymmetric routes connect six territories; hubs are landmarks, not single allocation nodes.
const territories=[
 {name:'THE BASTION',sub:'Guard • armor • recovery',x:270,y:390,shape:'fork'},
 {name:'THE FORGE',sub:'Impact • exertion • heavy arms',x:245,y:690,shape:'ladder'},
 {name:'THE HUNT',sub:'Distance • projectiles • marks',x:1050,y:720,shape:'arc'},
 {name:'THE VEIL',sub:'Footwork • precision • ambush',x:1110,y:380,shape:'diamond'},
 {name:'THE CRUCIBLE',sub:'Fire • storm • elemental interplay',x:835,y:205,shape:'spiral'},
 {name:'THE WELLSPRING',sub:'Frost • mana • wards',x:455,y:185,shape:'bridge'},
];
const roads=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,4],[1,3]];
for(const [a,b] of roads){const p=territories[a],q=territories[b];const cx=(p.x+q.x)/2,cy=(p.y+q.y)/2+((a+b)%2?50:-50);svg+=`<path d="M${p.x} ${p.y}Q${cx} ${cy} ${q.x} ${q.y}" fill="none" stroke="#c3cbca" stroke-width="3"/>`;}
const origin={x:680,y:495};
for(const p of territories)svg+=line(origin.x,origin.y,p.x,p.y,'#9eafab',3);
svg+=dot(origin.x,origin.y,32,'#11675f','#11675f')+text(origin.x,origin.y+6,'ROOT',16,'#fff','text-anchor="middle"')+text(680,552,'First skills + accessible survival',16,'#3d504c','text-anchor="middle"');
function cluster(p,index){
 let points,edges;
 if(p.shape==='fork'){points=[[-70,25],[-30,0],[15,-35],[55,-65],[60,-5],[20,40]];edges=[[0,1],[1,2],[2,3],[2,4],[1,5]];}
 if(p.shape==='ladder'){points=[[-70,-35],[-10,-35],[55,-35],[-55,30],[10,30],[70,30]];edges=[[0,1],[1,2],[0,3],[3,4],[4,5],[1,4]];}
 if(p.shape==='arc'){points=[[-80,30],[-55,-20],[-10,-45],[40,-25],[65,20],[0,35]];edges=[[0,1],[1,2],[2,3],[3,4],[2,5]];}
 if(p.shape==='diamond'){points=[[-75,0],[-15,-45],[45,0],[-15,40],[90,30]];edges=[[0,1],[1,2],[2,3],[3,0],[2,4]];}
 if(p.shape==='spiral'){points=[[-70,25],[-55,-30],[0,-50],[50,-20],[30,25],[-10,10]];edges=[[0,1],[1,2],[2,3],[3,4],[4,5]];}
 if(p.shape==='bridge'){points=[[-85,0],[-40,-30],[5,0],[50,-30],[85,0],[0,45]];edges=[[0,1],[1,2],[2,3],[3,4],[2,5]];}
 svg+=`<ellipse cx="${p.x}" cy="${p.y}" rx="132" ry="90" fill="#fafbf9"/>`;
 for(const [a,b] of edges)svg+=line(p.x+points[a][0],p.y+points[a][1],p.x+points[b][0],p.y+points[b][1],'#697d78',2.5);
 points.forEach(([x,y],i)=>{x+=p.x;y+=p.y;if(i===2)svg+=`<rect x="${x-10}" y="${y-10}" width="20" height="20" fill="#11675f" transform="rotate(45 ${x} ${y})"/>`;else if(i===points.length-1)svg+=dot(x,y,12,'#fff','#11675f',3);else svg+=dot(x,y,6,'#fafbf9','#697d78');});
 svg+=text(p.x,p.y+103,p.name,19,'#1d3731','text-anchor="middle"')+text(p.x,p.y+126,p.sub,15,'#5c656b','text-anchor="middle"');
}
territories.forEach(cluster);
svg+=text(625,345,'SPELLBLADE',15,'#64746e')+text(685,725,'SKIRMISHER',15,'#64746e')+text(350,574,'SENTINEL',15,'#64746e');
svg+=text(48,909,'Destinations are spread through the map; shortcuts connect playstyles.',21)+text(48,939,'Each territory contains several authored clusters. These six examples illustrate different route shapes.',17,'#5c656b');
svg+=dot(55,976,6,'#fafbf9','#697d78')+text(69,982,'Minor',16)+`<rect x="170" y="970" width="12" height="12" fill="#11675f" transform="rotate(45 176 976)"/>`+text(192,982,'Active skill',16)+dot(340,976,9,'#fff','#11675f',3)+text(355,982,'Doctrine / defining reward',16);
writeFileSync(new URL('proposed-atlas.svg',base),svg+'</g></svg>');
