import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { randomBytes, createHash, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validateData } from './security.ts';
import { normalizeData } from './public/domain.js';
import { importCampusData } from './public/campus-import.js';
const campusPois=JSON.parse(readFileSync(new URL('./public/map-data/campus-poi.json',import.meta.url),'utf8'));
const defaultBuildings=JSON.parse(readFileSync(new URL('./public/building-defaults.json',import.meta.url),'utf8'));
const root=import.meta.dirname;
const sha=s=>createHash('sha256').update(s).digest('hex');
export const passwordHash=(password,salt=randomBytes(16).toString('hex'))=>`${salt}:${scryptSync(password,salt,64).toString('hex')}`;
export function createApp({resetCatalog=false,dataDir=process.env.DATA_DIR||resolve(root,'data'),origin=process.env.APP_ORIGIN,email=process.env.ADMIN_EMAIL,hash=process.env.ADMIN_PASSWORD_HASH}={}){
 if(!origin||!email||!hash)throw Error('APP_ORIGIN, ADMIN_EMAIL and ADMIN_PASSWORD_HASH are required');
 const url=new URL(origin);origin=url.origin;
 if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Production requires an HTTPS APP_ORIGIN');
 if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash))throw Error('Invalid ADMIN_PASSWORD_HASH');
 mkdirSync(dataDir,{recursive:true});mkdirSync(resolve(dataDir,'uploads'),{recursive:true});
 const db=new DatabaseSync(resolve(dataDir,'bites.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state(id TEXT PRIMARY KEY,body TEXT NOT NULL,revision INTEGER NOT NULL,updated TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL,credential TEXT NOT NULL); CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY CHECK(id=1),count INTEGER NOT NULL,until INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY,type TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,action TEXT NOT NULL,created TEXT NOT NULL);`);
 const seed=normalizeData(JSON.parse(readFileSync(resolve(root,'seed.json'),'utf8')),defaultBuildings);validateData(seed);
 const credential=sha(email.toLowerCase()+hash),secure=url.protocol==='https:';
 const cookie=(value,age)=>`bnbu_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`;
 const json=(x,status=200,headers={})=>Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 const snapshot=(id)=>{const row=db.prepare('SELECT * FROM state WHERE id=?').get(id);const fallback=row||(id==='draft'?db.prepare("SELECT * FROM state WHERE id='published'").get():null);return {data:normalizeData(fallback?JSON.parse(fallback.body):seed,defaultBuildings),revision:row?.revision||0}};
 // One-time, user-requested catalog reset. Keep recoverable snapshots outside public files.
 if(resetCatalog&&!db.prepare('SELECT id FROM audit WHERE id=?').get('catalog-reset-20261107')){
  const saved={published:snapshot('published'),draft:snapshot('draft')};
  mkdirSync(resolve(dataDir,'backups'),{recursive:true});
  writeFileSync(resolve(dataDir,'backups','catalog-before-reset-20261107.json'),JSON.stringify(saved),{mode:0o600});
  db.exec('BEGIN IMMEDIATE');try{
   for(const id of ['published','draft']){
    const old=saved[id],d=old.data;d.stores=[];d.dishes=[];d.assignments={};d.points=[];
    d.canteens=[{id:'hall-phase2',zh:'二期食堂（湖边，待定位）',en:'Phase 2 Dining Hall (lakeside, location pending)',buildingId:'',x:50,y:50,floor:'独立食堂，具体位置待核对',floorEn:'Standalone dining hall; exact location pending',verified:false}];
    d.updated=new Date().toISOString();validateData(d);
    db.prepare('INSERT INTO state VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,revision=excluded.revision,updated=excluded.updated').run(id,JSON.stringify(d),old.revision+1,d.updated);
   }
   db.prepare('INSERT INTO audit VALUES(?,?,?)').run('catalog-reset-20261107','Archive and clear unverified catalog at user request',new Date().toISOString());db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 // User-confirmed lakeside location on the supplied campus reference image.
 if(resetCatalog&&!db.prepare('SELECT id FROM audit WHERE id=?').get('phase2-location-20261107')){
  db.exec('BEGIN IMMEDIATE');try{
   for(const id of ['published','draft']){
    const old=snapshot(id),d=old.data,c=d.canteens.find(c=>c.id==='hall-phase2');
    if(c){Object.assign(c,{zh:'二期食堂',en:'Phase 2 Dining Hall',buildingId:'',x:12.5,y:8,verified:true,floor:'湖边独立建筑，D1–D6 宿舍区北侧',floorEn:'Standalone lakeside building, north of D1–D6'});
     d.updated=new Date().toISOString();validateData(d);db.prepare('INSERT INTO state VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,revision=excluded.revision,updated=excluded.updated').run(id,JSON.stringify(d),old.revision+1,d.updated);}
   }
   db.prepare('INSERT INTO audit VALUES(?,?,?)').run('phase2-location-20261107','Place standalone lakeside hall from user reference',new Date().toISOString());db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 // Add the independent hall identified by the user east of the main lake.
 // Coordinates are schematic, traced from the reference; the name is still pending.
 if(resetCatalog&&!db.prepare('SELECT id FROM audit WHERE id=?').get('east-lake-hall-20261108')){
  db.exec('BEGIN IMMEDIATE');try{
   for(const id of ['published','draft']){
    const old=snapshot(id),d=old.data;
    if(!d.canteens.some(c=>c.id==='hall-east-lake')){
     d.canteens.push({id:'hall-east-lake',zh:'食堂（名称待确认）',en:'Dining hall (name pending)',buildingId:'',x:88,y:54,verified:true,floor:'主湖东南侧，演艺厅旁；按参考图示意定位',floorEn:'Southeast of the main lake, beside the theatre; approximate reference-map location'});
     d.updated=new Date().toISOString();validateData(d);
     db.prepare('INSERT INTO state VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,revision=excluded.revision,updated=excluded.updated').run(id,JSON.stringify(d),old.revision+1,d.updated);
    }
   }
   db.prepare('INSERT INTO audit VALUES(?,?,?)').run('east-lake-hall-20261108','Add user-identified dining hall beside theatre; name pending',new Date().toISOString());db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 // One-time import requested by the user. Preserve both catalog snapshots and manual edits.
 if(resetCatalog&&!db.prepare('SELECT id FROM audit WHERE id=?').get('campus-poi-import-20261111')){
  const saved={published:snapshot('published'),draft:snapshot('draft')};
  mkdirSync(resolve(dataDir,'backups'),{recursive:true});
  writeFileSync(resolve(dataDir,'backups','before-campus-poi-import-20261111.json'),JSON.stringify(saved),{mode:0o600});
  db.exec('BEGIN IMMEDIATE');try{
   for(const id of ['published','draft']){const old=saved[id],d=importCampusData(old.data,campusPois);d.updated=new Date().toISOString();validateData(d);
    db.prepare('INSERT INTO state VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,revision=excluded.revision,updated=excluded.updated').run(id,JSON.stringify(d),old.revision+1,d.updated);
   }
   db.prepare('INSERT INTO audit VALUES(?,?,?)').run('campus-poi-import-20261111','Import original Campus Map points at user request',new Date().toISOString());db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 const token=r=>sha((r.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bnbu_session='))?.slice(13)||'');
 const logged=r=>!!db.prepare('SELECT token FROM sessions WHERE token=? AND expires>? AND credential=?').get(token(r),Date.now(),credential);
 async function bytes(r,max){if(Number(r.headers.get('content-length'))>max)fail('文件过大',413);if(!r.body)return Buffer.alloc(0);const reader=r.body.getReader(),chunks=[];let n=0;while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();fail('文件过大',413)}chunks.push(value)}return Buffer.concat(chunks)}
 const body=async r=>JSON.parse((await bytes(r,2000000)).toString());
 async function handle(r){try{
 const path=new URL(r.url).pathname,method=r.method;
 if(!['GET','HEAD','POST'].includes(method))return json({error:'Method not allowed'},405);
 if(method==='POST'&&r.headers.get('origin')!==origin)return json({error:'Invalid request origin'},403);
 if(path==='/health')return json({ok:true});
 if(path==='/api/admin/session'&&method==='GET')return json({signedIn:logged(r),admin:logged(r),email:logged(r)?email:null,canActivate:false});
 if(path==='/api/admin/login'&&method==='POST'){
 const now=Date.now(),attempt=db.prepare('SELECT * FROM attempts WHERE id=1').get();
 if(attempt&&attempt.until>now&&attempt.count>=10)return json({error:'尝试次数过多，请 15 分钟后重试'},429,{'Retry-After':'900'});
 const p=await body(r);if(typeof p.password!=='string'||p.password.length>256||typeof p.email!=='string')fail('邮箱或密码错误',401);
 db.prepare('INSERT INTO attempts VALUES(1,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=CASE WHEN until<? THEN excluded.until ELSE until END').run(now+900000,now,now);
 const candidate=passwordHash(p.password,hash.split(':')[0]);
 if(!timingSafeEqual(Buffer.from(candidate),Buffer.from(hash))||p.email.trim().toLowerCase()!==email.toLowerCase())fail('邮箱或密码错误',401);
 db.prepare('DELETE FROM attempts').run();db.prepare('DELETE FROM sessions WHERE expires<? OR credential<>?').run(now,credential);
 const raw=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(raw),now+8*3600000,credential);
 return json({ok:true},200,{'Set-Cookie':cookie(raw,8*3600)});
 }
 if(path.startsWith('/api/admin/')){
 if(!logged(r))fail('请先登录管理员账号',401);
 if(path==='/api/admin/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(token(r));return json({ok:true},200,{'Set-Cookie':cookie('',0)})}
 if(path==='/api/admin/draft'&&method==='GET')return json(snapshot('draft'));
 if(path==='/api/admin/draft'&&method==='POST'){
 const p=await body(r);validateData(p.data);if(p.data.schemaVersion!==2)fail('Please reload the updated editor',409);if(!Number.isSafeInteger(p.revision)||p.revision<0)fail('Invalid revision');
 const now=new Date().toISOString();const result=db.prepare(`INSERT INTO state SELECT 'draft',?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM state WHERE id='draft') ON CONFLICT(id) DO UPDATE SET body=excluded.body,revision=state.revision+1,updated=excluded.updated WHERE state.revision=?`).run(JSON.stringify(p.data),now,p.revision,p.revision);
 if(!result.changes)fail('草稿已变化，请重新加载',409);return json({ok:true,revision:p.revision+1});
 }
 if(path==='/api/admin/publish'&&method==='POST'){
 const p=await body(r);if(!Number.isSafeInteger(p.revision))fail('Invalid revision');const now=new Date().toISOString();
 db.exec('BEGIN IMMEDIATE');try{const result=db.prepare(`INSERT INTO state SELECT 'published',json_set(body,'$.updated',?),revision,? FROM state WHERE id='draft' AND revision=? ON CONFLICT(id) DO UPDATE SET body=excluded.body,revision=excluded.revision,updated=excluded.updated`).run(now,now,p.revision);if(!result.changes)fail('草稿已变化或尚未保存',409);db.prepare('INSERT INTO audit VALUES(?,?,?)').run(randomUUID(),'publish',now);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return json({ok:true,updated:now});
 }
 if(path==='/api/admin/upload'&&method==='POST'){
 const type=r.headers.get('content-type'),b=await bytes(r,3000000);
 const valid=type==='image/jpeg'?b[0]===255&&b[1]===216:type==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/webp'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';if(!valid)fail('仅支持 JPEG、PNG、WebP 图片');const key=randomUUID();writeFileSync(resolve(dataDir,'uploads',key),b,{flag:'wx',mode:0o600});db.prepare('INSERT INTO images VALUES(?,?)').run(key,type);return json({key,url:'/api/images/'+key});
 }
 return json({error:'Not found'},404);
 }
 if(path==='/api/data'&&method==='GET')return json(snapshot('published'));
 if(path.startsWith('/api/images/')&&method==='GET'){const id=path.slice(12);if(!/^[a-f0-9-]{36}$/.test(id))fail('Not found',404);const image=db.prepare('SELECT type FROM images WHERE id=?').get(id);if(!image)fail('Not found',404);return new Response(readFileSync(resolve(dataDir,'uploads',id)),{headers:{'Content-Type':image.type,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400'}})}
 if(method!=='GET'&&method!=='HEAD')return json({error:'Not found'},404);
 const aliases={'/':'/explore.html','/explore':'/explore.html','/admin':'/admin.html'};
 const base=resolve(root,'public'),file=resolve(base,'.'+decodeURIComponent(aliases[path]||path));
 if(!file.startsWith(base+sep))fail('Not found',404);
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
 try{return new Response(method==='HEAD'?null:readFileSync(file),{headers:{'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':['.html','.js','.css','.json'].includes(extname(file))?'no-cache':'public,max-age=3600'}})}catch{fail('Not found',404)}
 }catch(e){return json({error:e.status?e.message:'请求处理失败，请检查提交的数据'},e.status||400)}}
 return {handle,close:()=>db.close()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const app=createApp({resetCatalog:true});const server=createServer(async(req,res)=>{try{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>3100000){res.writeHead(413);res.end();return}chunks.push(c)}const r=new Request(new URL(req.url,process.env.APP_ORIGIN),{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const out=await app.handle(r);res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()))}catch{res.writeHead(500);res.end('Internal error')}});
 server.requestTimeout=30000;server.headersTimeout=15000;server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('BNBU Bites ready'));process.on('SIGTERM',()=>server.close(()=>{app.close();process.exit(0)}));
}
