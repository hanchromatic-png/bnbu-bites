import {cleanPlaceName} from './domain.js';
import {hasGeo} from './geo-domain.js';
export const diningTypes=new Set(['restaurant','cafe','fast_food','ice_cream']);
const categoryNames={restaurant:['餐厅','Restaurant'],cafe:['咖啡店','Cafe'],fast_food:['快餐店','Fast food'],food_court:['食堂','Dining hall'],building:['建筑','Building'],other:['校园地点','Campus place']};
export function campusRows(raw){return raw.elements.map(e=>{const tags=e.tags||{},lng=e.lon??e.center?.lon,lat=e.lat??e.center?.lat;const kind=tags.building?'building':tags.amenity||tags.shop||'other';const generic=categoryNames[kind]||categoryNames.other;const id=`osm-${e.type}-${e.id}`;const en=tags['name:en']||(/^[\x20-\x7e]+$/.test(tags.name||'')?tags.name:'')||generic[1];return {id,sourceId:id,sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,kind,lng,lat,zh:cleanPlaceName(tags['name:zh']||tags.name||generic[0]),en:cleanPlaceName(en),originalName:tags.name||'',tags};}).filter(hasGeo);}
export function importCampusData(input,rows){const d=structuredClone(input);for(const p of rows){
 const common={source:'Campus Map / OpenStreetMap',sourceId:p.id,sourceUrl:p.sourceUrl};
 if(p.kind==='building'){
  const matched=p.originalName.match(/^(T\d+|V\d+|D\d+)\b/i);const alias={'osm-way-664082911':'THEATRE','osm-way-664082912':'ADMIN','osm-way-664082913':'HALL','osm-way-664082915':'SPORTS','osm-way-1215983507':'LRC'};const code=matched?.[1]||alias[p.id]||p.tags.short_name||p.zh;
  let b=d.buildings.find(b=>b.sourceId===p.id)||((matched||alias[p.id]||p.tags.short_name)?d.buildings.find(b=>b.code.toUpperCase()===code.toUpperCase()):null);
  if(!b){b={id:p.id,code,zh:p.zh,en:p.en,x:50,y:50,verified:true};d.buildings.push(b);}
  if(!b.sourceId){if(b.zh===`${code} 楼`){b.zh=p.zh;b.en=p.en;}if(!hasGeo(b)){b.lng=p.lng;b.lat=p.lat;}Object.assign(b,common);}
 }else if(p.kind==='food_court'){
  if(!d.canteens.some(c=>c.sourceId===p.id||c.id===p.id))d.canteens.push({id:p.id,zh:p.zh,en:p.en,buildingId:'',x:50,y:50,lng:p.lng,lat:p.lat,verified:true,floor:'',floorEn:'',...common});
 }else if(diningTypes.has(p.kind)){
  if(!d.stores.some(s=>s.sourceId===p.id||s.id===p.id))d.stores.push({id:p.id,zh:p.zh,en:p.en,canteenId:'',area:'collection',images:[],notes:['位置和名称来自 Campus Map / OpenStreetMap，菜单待补充。'],notesEn:['Name and location from Campus Map / OpenStreetMap; menu not yet added.'],location:{x:50,y:50,lng:p.lng,lat:p.lat,verified:true,note:'',noteEn:''},...common});
 }
 }return d;}
