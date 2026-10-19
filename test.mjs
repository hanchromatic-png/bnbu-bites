import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp,passwordHash } from './server.mjs';
test('public browsing, authentication, CSRF, publishing, images, persistence and logout',async()=>{
 const dataDir=mkdtempSync(join(tmpdir(),'bites-test-')),origin='https://bites.example',email='admin@example.com',password='test-only-strong-password',hash=passwordHash(password);
 let app=createApp({dataDir,origin,email,hash});
 const call=(path,method='GET',data,headers={})=>app.handle(new Request(origin+path,{method,headers:{...(method==='POST'?{origin,'content-type':'application/json'}:{}),...headers},...(data===undefined?{}:{body:typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data)})}));
 try{
 assert.equal((await call('/')).status,200);assert.equal((await call('/api/admin/draft')).status,401);
 assert.equal((await call('/api/admin/draft','GET',undefined,{'oai-authenticated-user-email':email})).status,401);
 assert.equal((await call('/api/admin/login','POST',{email,password},{origin:'https://attacker.example'})).status,403);
 assert.equal((await call('/api/admin/login','POST',{email,password:'incorrect'})).status,401);
 const login=await call('/api/admin/login','POST',{email,password});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict.*Secure/);
 const h={cookie};assert.equal((await (await call('/api/admin/session','GET',undefined,h)).json()).admin,true);
 const original=await (await call('/api/data')).json();assert.equal(original.data.stores.length,48);assert.equal(original.data.dishes.length,1550);
 const draft=await (await call('/api/admin/draft','GET',undefined,h)).json();draft.data.stores[0].zh='测试餐厅';
 assert.equal((await call('/api/admin/draft','POST',draft,h)).status,200);
 assert.equal((await call('/api/admin/draft','POST',draft,h)).status,409);
 assert.notEqual((await (await call('/api/data')).json()).data.stores[0].zh,'测试餐厅');
 assert.equal((await call('/api/admin/publish','POST',{revision:0},h)).status,409);
 assert.equal((await call('/api/admin/publish','POST',{revision:1},h)).status,200);
 assert.equal((await (await call('/api/data')).json()).data.stores[0].zh,'测试餐厅');
 assert.equal((await call('/api/admin/upload','POST','not an image',{...h,'content-type':'image/png'})).status,400);
 const png=readFileSync(new URL('./public/campus-base.png',import.meta.url));
 const upload=await (await call('/api/admin/upload','POST',png,{...h,'content-type':'image/png'})).json();assert.ok(upload.key);
 assert.equal((await call(upload.url)).headers.get('content-type'),'image/png');
 app.close();app=createApp({dataDir,origin,email,hash});
 assert.equal((await (await call('/api/data')).json()).data.stores[0].zh,'测试餐厅');assert.equal((await call(upload.url)).status,200);
 assert.equal((await call('/api/admin/logout','POST',{},h)).status,200);assert.equal((await call('/api/admin/draft','GET',undefined,h)).status,401);
 for(let i=0;i<10;i++)assert.equal((await call('/api/admin/login','POST',{email,password:'wrong'})).status,401);
 assert.equal((await call('/api/admin/login','POST',{email,password})).status,429);
 assert.equal((await call('/server.mjs')).status,404);
 }finally{app.close();rmSync(dataDir,{recursive:true,force:true})}
});
