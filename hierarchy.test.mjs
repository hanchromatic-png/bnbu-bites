import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeData,removeEntity,locationOf,localized,matchesDiet} from './public/domain.js';
import {validateData} from './security.ts';
import {createApp,passwordHash} from './server.mjs';
const seed=JSON.parse(readFileSync(new URL('./seed.json',import.meta.url))),buildings=JSON.parse(readFileSync(new URL('./public/building-defaults.json',import.meta.url)));
test('legacy migration preserves every restaurant and dish, is idempotent, and does not guess unknown building assignments',()=>{
 const d=normalizeData(seed,buildings);assert.equal(d.stores.length,seed.stores.length);assert.deepEqual(d.dishes,seed.dishes);assert.deepEqual(normalizeData(d,buildings),d);validateData(d);
 assert.equal(locationOf(d,d.stores.find(s=>s.id==='v24_0')).building.code,'V24');assert.equal(d.stores.find(s=>s.id==='x2').canteenId,'');assert.equal(d.canteens.find(c=>c.id==='hall-phase2').buildingId,'');
 const legacy=structuredClone(seed);legacy.assignments.x2='ref-a';assert.equal(normalizeData(legacy,buildings).stores.find(s=>s.id==='x2').canteenId,'legacy-ref-a');
});
test('deletion detaches children safely, restaurant deletion removes only its menu, and validation rejects dangling references',()=>{
 const d=normalizeData(seed,buildings),original=d.dishes.length;removeEntity(d,'buildings','building-v24');assert.equal(d.canteens.find(c=>c.id==='hall-v24').buildingId,'');assert.equal(d.dishes.length,original);validateData(d);
 removeEntity(d,'canteens','hall-v24');assert.equal(d.stores.find(s=>s.id==='v24_0').canteenId,'');validateData(d);
 const count=d.dishes.filter(x=>x.store==='x0').length;removeEntity(d,'stores','x0');assert.equal(d.dishes.length,original-count);assert.ok(!d.dishes.some(x=>x.store==='x0'));validateData(d);
 d.stores[0].canteenId='missing';assert.throws(()=>validateData(d),/hierarchy/);
});
test('English display never falls back to untranslated Chinese content',()=>{
 assert.equal(localized({zh:'鸡肉',en:''},'en'),'');assert.equal(localized({zh:'鸡肉',en:'Chicken 鸡肉'},'en'),'');assert.equal(localized({price:'¥12 / 份',priceEn:'¥12 / portion'},'en','price'),'¥12 / portion');
});
test('hierarchy edits, restaurant movement and deletion survive draft/publish/restart without modifying published data early',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'bites-hierarchy-')),origin='https://bites.example',email='test@example.com',password='test-only-password',hash=passwordHash(password);let app=createApp({dataDir:dir,origin,email,hash});let cookie='';
 const call=async(path,payload)=>app.handle(new Request(origin+path,{method:payload?'POST':'GET',headers:{origin,'content-type':'application/json',cookie},...(payload?{body:JSON.stringify(payload)}:{})}));
 try{const login=await call('/api/admin/login',{email,password});cookie=login.headers.get('set-cookie').split(';')[0];let {data,revision}=await (await call('/api/admin/draft')).json();
 data.buildings.push({id:'b-test',code:'TEST',zh:'测试楼',en:'Test building',x:20,y:30,verified:true});data.canteens.push({id:'c-test',buildingId:'b-test',zh:'测试食堂',en:'Test hall',x:20,y:30,floor:'二楼',floorEn:'Level 2',verified:true});data.stores[0].canteenId='c-test';
 assert.equal((await call('/api/admin/draft',{data,revision})).status,200);assert.ok(!(await (await call('/api/data')).json()).data.canteens.some(c=>c.id==='c-test'));
 assert.equal((await call('/api/admin/publish',{revision:1})).status,200);assert.equal(locationOf((await (await call('/api/data')).json()).data,data.stores[0]).building.id,'b-test');
 removeEntity(data,'stores',data.stores[0].id);assert.equal((await call('/api/admin/draft',{data,revision:1})).status,200);assert.equal((await call('/api/admin/publish',{revision:2})).status,200);
 app.close();app=createApp({dataDir:dir,origin,email,hash});const saved=(await (await call('/api/data')).json()).data;assert.ok(!saved.stores.some(s=>s.id==='x0'));assert.ok(!saved.dishes.some(d=>d.store==='x0'));assert.ok(saved.canteens.some(c=>c.id==='c-test'));
 }finally{app.close();rmSync(dir,{recursive:true,force:true})}
});

test('meal style and dietary filters combine without weakening allergen restrictions',()=>{
 const p={base:'noodles',diet:'any',allergens:[],strict:false,spice:false};
 const noodle={zh:'番茄面',base:'noodles',clues:['wheat']};
 assert.equal(matchesDiet(noodle,p),true);
 assert.equal(matchesDiet({...noodle,base:'rice'},p),false);
 assert.equal(matchesDiet(noodle,{...p,allergens:['wheat']}),false);
 assert.equal(matchesDiet(noodle,{...p,allergens:['milk'],strict:true}),false);
 assert.equal(matchesDiet({...noodle,zh:'牛肉面'},{...p,diet:'noBeef'}),false);
 assert.equal(matchesDiet({...noodle,zh:'猪肉面'},{...p,diet:'noPork'}),false);
 assert.equal(matchesDiet({...noodle,zh:'麻辣面'},{...p,spice:true}),false);
 assert.equal(matchesDiet(noodle,{...p,diet:'halal'}),false);
});
