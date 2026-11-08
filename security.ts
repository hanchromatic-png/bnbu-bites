export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !!origin&&origin===new URL(request.url).origin;}
export async function equalSecret(a:string,b:string){const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
export function validateData(d:any){
 if(!d||!Array.isArray(d.stores)||!Array.isArray(d.dishes)||!Array.isArray(d.points)||typeof d.images!=='object'||!d.images||typeof d.assignments!=='object'||!d.assignments)throw Error('Invalid dataset');
 if(d.stores.length>500||d.dishes.length>10000||d.points.length>300)throw Error('Dataset too large');
 const string=(s:any,max=500)=>typeof s==='string'&&s.length<=max;
 const ids=new Set<string>(),pids=new Set<string>(),dids=new Set<number>();
 for(const s of d.stores){if(!string(s.id,100)||!/^[\w-]+$/.test(s.id)||ids.has(s.id)||!string(s.zh)||!s.zh.trim()||!string(s.en)||!['collection','phase2','laike','v24'].includes(s.area)||!Array.isArray(s.images)||!s.images.every((x:any)=>string(x,120))||!Array.isArray(s.notes)||!s.notes.every((x:any)=>string(x,3000)))throw Error('Invalid restaurant');ids.add(s.id)}
 for(const p of d.points){if(!string(p.id,100)||!/^[\w-]+$/.test(p.id)||pids.has(p.id)||!string(p.zh)||!p.zh.trim()||!string(p.en)||typeof p.verified!=='boolean'||![p.x,p.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100))throw Error('Invalid point');pids.add(p.id)}
 for(const dish of d.dishes){if(!ids.has(dish.store)||!Number.isSafeInteger(dish.id)||dids.has(dish.id)||!string(dish.zh)||!dish.zh.trim()||!string(dish.en)||!string(dish.price,100)||!string(dish.category)||!string(dish.note||'',3000)||!Array.isArray(dish.clues)||!dish.clues.every((c:any)=>['peanut','nuts','egg','milk','soy','wheat','sesame','fish','shellfish','mollusc','mustard'].includes(c))||!(dish.value===null||(typeof dish.value==='number'&&Number.isFinite(dish.value)&&dish.value>=0)))throw Error('Invalid menu item');dids.add(dish.id)}
 for(const [s,p]of Object.entries(d.assignments)){if(!ids.has(s)||!pids.has(p as string))throw Error('Invalid point assignment')}
 for(const [k,v]of Object.entries(d.images)){if(!/^[\w-]+$/.test(k)||typeof v!=='string'||!/^\/(images\/[\w-]+\.(jpg|png)|api\/images\/[\w-]+)$/.test(v))throw Error('Invalid image')}
 for(const s of d.stores)if(s.images.some((k:string)=>!d.images[k]))throw Error('Missing image');
 if(d.schemaVersion===2){
  if(!Array.isArray(d.buildings)||!Array.isArray(d.canteens)||d.buildings.length>300||d.canteens.length>300)throw Error('Invalid campus structure');
  const bids=new Set(),cids=new Set();
  const position=(x:any)=>[x.x,x.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100);
  for(const b of d.buildings){
   if(!string(b.id,100)||!/^[\w-]+$/.test(b.id)||bids.has(b.id)||!string(b.zh)||!b.zh.trim()||!string(b.en)||!string(b.code,40)||!position(b)||typeof b.verified!=='boolean')throw Error('Invalid building');
   if(b.polygon!==undefined&&(!Array.isArray(b.polygon)||b.polygon.length<3||b.polygon.length>40||!b.polygon.every((p:any)=>Array.isArray(p)&&p.length===2&&p.every((v:any)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<5000))))throw Error('Invalid building shape');
   bids.add(b.id);
  }
  for(const c of d.canteens){
   if(!string(c.id,100)||!/^[\w-]+$/.test(c.id)||cids.has(c.id)||!string(c.zh)||!c.zh.trim()||!string(c.en)||!string(c.buildingId,100)||(c.buildingId&&!bids.has(c.buildingId))||!position(c)||typeof c.verified!=='boolean'||!string(c.floor||'',200)||!string(c.floorEn||'',200))throw Error('Invalid canteen');
   cids.add(c.id);
  }
  for(const s of d.stores){if(s.location!=null&&(!position(s.location)||typeof s.location.verified!=='boolean'||!string(s.location.note||'',200)||!string(s.location.noteEn||'',200)))throw Error('Invalid restaurant location');if(!string(s.canteenId,100)||(s.canteenId&&!cids.has(s.canteenId))||!Array.isArray(s.notesEn)||!s.notesEn.every((x:any)=>string(x,3000)))throw Error('Invalid restaurant hierarchy');}
  for(const x of d.dishes)for(const key of ['categoryEn','noteEn','priceEn'])if(x[key]!==undefined&&!string(x[key],3000))throw Error('Invalid translation');
 }
 if(JSON.stringify(d).length>1700000)throw Error('Dataset too large');return d;
}
