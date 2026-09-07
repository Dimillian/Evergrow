export const ARMOR_PARTS = [
  {id:'head',name:'Helmet'}, {id:'chest',name:'Chest'}, {id:'shoulders',name:'Shoulders'},
  {id:'hands',name:'Gloves'}, {id:'legs',name:'Legs'}, {id:'boots',name:'Boots'}, {id:'cloak',name:'Cloak'},
] as const;
export type ArmorPart = typeof ARMOR_PARTS[number]['id'];
export type ArmorTints = Partial<Record<ArmorPart,string>>;
export const ARMOR_TINTS = [
  {id:'crimson',name:'Crimson',color:'#a74749'}, {id:'wine',name:'Wine',color:'#6f3d59'},
  {id:'copper',name:'Copper',color:'#b17447'}, {id:'gold',name:'Antique gold',color:'#b6a168'},
  {id:'ivory',name:'Ivory',color:'#d6d0b7'}, {id:'moss',name:'Moss',color:'#748d55'},
  {id:'jade',name:'Jade',color:'#508875'}, {id:'teal',name:'Teal',color:'#42838c'},
  {id:'ocean',name:'Ocean',color:'#4b6c9c'}, {id:'indigo',name:'Indigo',color:'#625b95'},
  {id:'violet',name:'Violet',color:'#9770a8'}, {id:'rose',name:'Rose',color:'#b6828c'},
  {id:'silver',name:'Silver',color:'#a5b2b9'}, {id:'slate',name:'Slate',color:'#576e7a'},
  {id:'umber',name:'Umber',color:'#795942'}, {id:'obsidian',name:'Obsidian',color:'#343d49'},
] as const;
