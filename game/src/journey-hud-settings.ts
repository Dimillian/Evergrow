export type JourneyHUDSort = 'accepted' | 'level' | 'distance';
export interface JourneyHUDSettings { visible:boolean; count:number; sort:JourneyHUDSort }
export const JOURNEY_HUD_LIMIT = Object.freeze({min:1,max:8});
export const DEFAULT_JOURNEY_HUD:Readonly<JourneyHUDSettings> = Object.freeze({visible:true,count:3,sort:'accepted'});
export const JOURNEY_HUD_STORAGE_KEY = 'evergrow-journey-hud-v1';
interface Storage { getItem(key:string):string|null; setItem(key:string,value:string):void }
export function validJourneyHUD(value:unknown):value is JourneyHUDSettings {
  if(!value||typeof value!=='object')return false;
  const v=value as JourneyHUDSettings;
  return typeof v.visible==='boolean'&&Number.isInteger(v.count)&&v.count>=JOURNEY_HUD_LIMIT.min&&v.count<=JOURNEY_HUD_LIMIT.max
    &&['accepted','level','distance'].includes(v.sort);
}
/** Device presentation only. Never writes a character or changes quest ownership. */
export class JourneyHUDPreferences {
  private value:Readonly<JourneyHUDSettings> = DEFAULT_JOURNEY_HUD;
  private readonly storage?:Storage;
  constructor(storage?:Storage){
    this.storage=storage;
    try {const raw=storage?.getItem(JOURNEY_HUD_STORAGE_KEY);const saved=raw?JSON.parse(raw):null;if(validJourneyHUD(saved))this.value=Object.freeze({visible:saved.visible,count:saved.count,sort:saved.sort});}
    catch { /* Malformed or unavailable preferences retain the default. */ }
  }
  get settings():Readonly<JourneyHUDSettings>{return this.value;}
  update(patch:Partial<JourneyHUDSettings>):'saved'|'session'|'invalid'{
    const next={...this.value,...patch};if(!validJourneyHUD(next))return 'invalid';
    this.value=Object.freeze(next);
    try {if(this.storage){this.storage.setItem(JOURNEY_HUD_STORAGE_KEY,JSON.stringify(next));return 'saved';}}
    catch { /* Keep the live setting when storage is blocked. */ }
    return 'session';
  }
}
