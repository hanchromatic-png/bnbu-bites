// Shared, dependency-free data rules used by the browser and Node server.
export function normalizeData(input, defaults = []) {
  const d = structuredClone(input);
  if (d.schemaVersion === 2) return d;
  d.schemaVersion = 2;
  d.buildings = structuredClone(defaults);
  d.canteens = [];
  const add = (id, zh, en, buildingId = '', extra = {}) => {
    if (!d.canteens.some(c => c.id === id)) d.canteens.push({id, zh, en, buildingId, x:50, y:50, floor:'', floorEn:'', verified:false, ...extra});
    return id;
  };
  // Preserve explicit legacy point assignments; never guess a building from proximity.
  for (const p of d.points || []) add('legacy-'+p.id,p.zh,p.en,'',{x:p.x,y:p.y,verified:p.verified});
  for (const s of d.stores) {
    s.canteenId = '';
    if (d.assignments?.[s.id]) s.canteenId = 'legacy-'+d.assignments[s.id];
    else if (s.area === 'v24') s.canteenId = add('hall-v24','啄乐汇','Zhuolehui','building-v24');
    else if (s.area === 'phase2') s.canteenId = add('hall-phase2','二期食堂','Phase 2 Dining Hall');
    else if (s.area === 'laike') s.canteenId = add('hall-laike','来客餐饮区','Laike Dining Area');
    else if (s.zh.startsWith('鑫梦园')) s.canteenId=add('hall-xinmengyuan','鑫梦园','Xinmengyuan');
    else if (s.zh.startsWith('蜀香园')) s.canteenId=add('hall-shuxiangyuan','蜀香园','Shuxiangyuan');
    else if (s.zh.startsWith('味旋律')) s.canteenId=add('hall-weixuanlv','味旋律','Weixuanlv');
    s.notesEn = s.notesEn || [];
  }
  return d;
}
export function locationOf(d, store) {
  const canteen=d.canteens.find(c=>c.id===store.canteenId);
  const building=d.buildings.find(b=>b.id===canteen?.buildingId);
  return {canteen,building};
}
export function removeEntity(d, type, id) {
  if(type==='buildings') {d.buildings=d.buildings.filter(b=>b.id!==id);d.canteens.forEach(c=>{if(c.buildingId===id){c.buildingId='';c.verified=false;}});}
  if(type==='canteens') {d.canteens=d.canteens.filter(c=>c.id!==id);d.stores.forEach(s=>{if(s.canteenId===id)s.canteenId='';});}
  if(type==='stores') {d.stores=d.stores.filter(s=>s.id!==id);d.dishes=d.dishes.filter(x=>x.store!==id);delete d.assignments[id];}
  if(type==='dishes') d.dishes=d.dishes.filter(x=>String(x.id)!==String(id));
  return d;
}
export function localized(obj, lang, field='name') {
  const key=field==='name'?(lang==='en'?'en':'zh'):field+(lang==='en'?'En':'');
  const value=obj?.[key];
  if(lang==='en'&&typeof value==='string'&&/[\u3400-\u9fff]/.test(value)) return '';
  return value || '';
}
export function matchesDiet(d,p) {
  if(p.allergens?.length && (p.strict || (d.clues||[]).some(c=>p.allergens.includes(c)))) return false;
  if(p.diet==='halal') return false;
  if(p.diet==='plant'&&!d.plant) return false;
  if(p.diet==='noPork'&&(d.pork||/猪|排骨|培根|火腿|肉肠|五花|里脊/.test(d.zh)))return false;
  if(p.diet==='noBeef'&&(d.beef||/牛/.test(d.zh)))return false;
  return !(p.spice&&/辣|麻婆|水煮|剁椒/.test(d.zh));
}
