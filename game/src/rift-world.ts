import { DungeonWorld } from './dungeon-world.ts';
import { TILE_SIZE, type Prop } from './world.ts';
import { BIOMES, BIOME_IDS, type BiomeWeights } from './biomes.ts';
import { chooseBiomeProp } from './biome-props.ts';
import { drawGroundSurface } from './ground-surface.ts';
import { drawGroundPatches } from './ground-art.ts';
import { cryptFloorContains } from './dungeon-contours.ts';
import { riftRandom } from './rift-content.ts';
/** Outdoor art shares the game's biome vocabulary; only the finite rift geometry differs. */
export class RiftWorld extends DungeonWorld {
  private riftTiles=new Map<string,HTMLCanvasElement>();
  private scenery:Prop[]|null=null;
  override get dungeonTheme(){return undefined;}
  override sampleBiome(_x:number,_y:number){return {...BIOMES[this.dungeonBiome],weights:Object.fromEntries(BIOME_IDS.map(id=>[id,id===this.dungeonBiome?1:0])) as BiomeWeights};}
  override sampleGroundContact(x:number,y:number){return {weights:this.sampleBiome(x,y).weights,water:0,natural:1,indoors:false};}
  override mapColor(x:number,y:number){return this.blocked(x,y,0)?'#160d22':BIOMES[this.dungeonBiome].color;}
  override getProps(x:number,y:number,width:number,height:number):Prop[]{
    if(!this.scenery){this.scenery=[];const random=riftRandom(this.seed^0x63ea2731),weights=this.sampleBiome(0,0).weights;
      for(const room of this.floor.rooms)for(let i=0;i<42;i++){
        const a=i*Math.PI*2/42,px=room.x+room.width/2+Math.cos(a)*(room.width/2+55),py=room.y+room.height/2+Math.sin(a)*(room.height/2+55);
        if(!this.blocked(px,py,30))continue;
        const choice=chooseBiomeProp(weights,random(),random());this.scenery.push({id:`rift-prop:${room.id}:${i}`,x:px,y:py,kind:choice.kind,biome:this.dungeonBiome,seed:Math.floor(random()*4294967296),scale:.8+random()*.65,radius:12});
      }
    }
    return this.scenery.filter(p=>p.x>x-180&&p.y>y-180&&p.x<x+width+180&&p.y<y+height+180);
  }
  override getGroundTile(tx:number,ty:number,create?:()=>HTMLCanvasElement){
    const key=`${tx}:${ty}`,cached=this.riftTiles.get(key);if(cached)return cached;
    const tile=create?create():document.createElement('canvas');tile.width=tile.height=TILE_SIZE;const c=tile.getContext('2d')!,ox=tx*TILE_SIZE,oy=ty*TILE_SIZE,biome=BIOMES[this.dungeonBiome];
    drawGroundSurface(c,ox,oy,TILE_SIZE,(x,y)=>{
      const open=cryptFloorContains(this.floor,x,y),wave=Math.sin(x*.009+Math.sin(y*.007)*2)*Math.cos(y*.011+this.seed)*.5+.5;
      const tear=Math.max(0,1-Math.abs(Math.sin(x*.0017+Math.sin(y*.003)*.7+this.seed))*18);
      return biome.ground.map((n,i)=>open?n*(.78+wave*.28)+tear*[27,0,14][i]:n*.32+[9,2,10][i]);
    });
    drawGroundPatches(c,ox,oy,TILE_SIZE,this.seed,()=>this.dungeonBiome,(x,y)=>cryptFloorContains(this.floor,x,y));
    if(this.riftTiles.size>=64)this.riftTiles.delete(this.riftTiles.keys().next().value!);this.riftTiles.set(key,tile);return tile;
  }
  override dispose(){this.riftTiles.clear();this.scenery=null;super.dispose();}
}
