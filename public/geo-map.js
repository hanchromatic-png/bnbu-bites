import {CampusMap,t,name,lang} from './common.js';
import {hasGeo,coordinateFor} from './geo-domain.js';
const HOME={center:[113.514,22.3568],zoom:15.7,pitch:45,bearing:-25};
let protocolReady=false;
function style(){return {version:8,sources:{campus:{type:'vector',tiles:['campus://14/{x}/{y}'],minzoom:14,maxzoom:14,bounds:[113.5025239,22.3406022,113.5542409,22.388223],attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="/map-sources.html">Map sources</a>'}},layers:[
 {id:'ground',type:'background',paint:{'background-color':'#e9eddf'}},
 {id:'landcover',type:'fill',source:'campus','source-layer':'landcover',paint:{'fill-color':'#cbdcc0','fill-opacity':0.65}},
 {id:'landuse',type:'fill',source:'campus','source-layer':'landuse',paint:{'fill-color':['match',['get','class'],'residential','#e9e8de','grass','#c5d8b7','forest','#b6cfa9','#dce3ce']}},
 {id:'park',type:'fill',source:'campus','source-layer':'park',paint:{'fill-color':'#c0d5ae','fill-opacity':0.6}},
 {id:'water',type:'fill',source:'campus','source-layer':'water',paint:{'fill-color':'#9dcdd1'}},
 {id:'waterway',type:'line',source:'campus','source-layer':'waterway',paint:{'line-color':'#9dcdd1','line-width':3}},
 {id:'road-edge',type:'line',source:'campus','source-layer':'transportation',paint:{'line-color':'#c6cfc2','line-width':['interpolate',['linear'],['zoom'],14,1.5,18,15,20,40]}},
 {id:'road',type:'line',source:'campus','source-layer':'transportation',paint:{'line-color':'#faf9ef','line-width':['interpolate',['linear'],['zoom'],14,1,18,11,20,30]}},
 {id:'buildings',type:'fill-extrusion',source:'campus','source-layer':'building',paint:{'fill-extrusion-color':'#f1dfbd','fill-extrusion-height':['coalesce',['get','render_height'],12],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':0.96}}
 ],light:{anchor:'viewport',color:'#fff3dd',intensity:0.35,position:[1.5,180,45]}};}
export class GeoCampusMap {
 constructor(host,options={}){
  this.host=host;this.options=options;this.markers=[];this.labels=[];this.pois=[];this.placing=false;this.dead=false;this.mode='geo';
  host.classList.add('geo-campus');host.innerHTML='<div class="geo-surface"></div><button type="button" class="map-mode"></button><div class="geo-caption" role="status"></div>';
  this.surface=host.querySelector('.geo-surface');this.modeButton=host.querySelector('.map-mode');this.caption=host.querySelector('.geo-caption');this.modeButton.onclick=()=>this.switchMode(this.mode==='geo'?'legacy':'geo');this.refreshChrome();
  this.poiReady=fetch('/map-data/campus-poi.json').then(r=>{if(!r.ok)throw Error('POI unavailable');return r.json()}).then(p=>{this.pois=p;if(!this.dead)this.paint()}).catch(()=>{});this.init();
 }
 async init(){
  try{
   if(!globalThis.maplibregl?.Map)throw Error('Map renderer unavailable');
   if(!protocolReady){maplibregl.addProtocol('campus',(params,callback)=>{const controller=new AbortController();const parts=params.url.match(/^campus:\/\/14\/(\d+)\/(\d+)$/);if(!parts){callback(Error('Invalid campus tile'));return {cancel(){}};}const x=Number(parts[1]),y=Number(parts[2]);if(![13357,13358].includes(x)||![7147,7148].includes(y)){callback(null,new ArrayBuffer(0));return {cancel(){}};}fetch(`/map-data/14-${x}-${y}.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Map tile unavailable');return r.json()}).then(d=>callback(null,Uint8Array.from(atob(d.data),c=>c.charCodeAt(0)).buffer)).catch(e=>{if(e.name!=='AbortError')callback(e)});return {cancel:()=>controller.abort()};});protocolReady=true;}
   this.gl=new maplibregl.Map({container:this.surface,style:style(),...HOME,minZoom:14,maxZoom:20,maxBounds:[[113.502,22.340],[113.555,22.389]],attributionControl:{compact:true},renderWorldCopies:false});
   this.gl.on('error',()=>{if(!this.dead&&this.mode==='geo')this.caption.textContent=t('地图加载异常，可切换示意图。','Map could not fully load. Switch to the diagram.');});
   this.gl.on('click',e=>{if(this.placing&&this.options.place)this.options.place(50,50,{lng:e.lngLat.lng,lat:e.lngLat.lat});});
   this.gl.on('zoomend',()=>this.layoutLabels());this.gl.on('moveend',()=>this.layoutLabels());
   this.gl.on('load',()=>{if(!this.dead){this.refreshChrome();this.paint();}});
   this.resize=new ResizeObserver(()=>this.gl?.resize());this.resize.observe(this.surface);
   const res=await fetch('/map-data/building-labels.json');if(!res.ok)throw Error('Building labels unavailable');this.labels=await res.json();if(this.dead)return;this.paint();
  }catch(e){console.warn('Campus map fallback:',e.message);if(!this.dead){this.unavailable=true;this.switchMode('legacy');}}
 }
 refreshChrome(){this.modeButton.textContent=this.mode==='geo'?t('切换示意图','Campus diagram'):t('切换 3D 地图','3D campus map');this.modeButton.disabled=!!this.unavailable;this.caption.textContent=this.mode==='geo'?t('开源校园地图 · 滚轮/双指缩放 · 位置以现场为准','Open campus map · Scroll/pinch to zoom · Verify locations on site'):t('旧版示意图 · 原有标点保留','Campus diagram · Original pins retained');
  if(this.mode==='geo'&&this.gl&&!this.controls){this.controls=document.createElement('div');this.controls.className='map-controls geo-controls';this.host.append(this.controls);}
  if(this.controls){this.controls.hidden=this.mode!=='geo';this.controls.replaceChildren();for(const [label,title,action] of [
   ['＋',t('放大','Zoom in'),()=>this.gl.zoomIn()],['−',t('缩小','Zoom out'),()=>this.gl.zoomOut()],['⌖',t('整个校园','Whole campus'),()=>this.gl.easeTo({...HOME,duration:600})],['3D',t('切换平面 / 立体','Toggle 2D / 3D'),()=>this.gl.easeTo({pitch:this.gl.getPitch()>10?0:50,duration:500})],['↻',t('旋转地图','Rotate map'),()=>this.gl.easeTo({bearing:this.gl.getBearing()+45,duration:400})],[t('一期','I'),t('一期校区','Phase 1'),()=>this.gl.easeTo({center:[113.515,22.353],zoom:17,pitch:45,duration:600})],[t('二期','II'),t('二期校区','Phase 2'),()=>this.gl.easeTo({center:[113.511,22.3615],zoom:17,pitch:45,duration:600})]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onclick=action;this.controls.append(b);}}
 }
 switchMode(mode){this.mode=mode;this.surface.hidden=mode!=='geo';if(mode==='legacy'){
  if(!this.legacyHost){this.legacyHost=document.createElement('div');this.legacyHost.className='legacy-surface';this.host.append(this.legacyHost);this.legacy=new CampusMap(this.legacyHost,{...this.options,place:(x,y)=>this.options.place?.(x,y,null)});}this.legacyHost.hidden=false;this.legacy.placeAnywhere=this.placing;
 }else {if(this.legacyHost)this.legacyHost.hidden=true;this.gl?.resize();}this.refreshChrome();if(this.data)this.update(this.data,this.selected,this.editPoint);}
 set placeAnywhere(value){this.placing=value;if(this.legacy)this.legacy.placeAnywhere=value;this.host.classList.toggle('is-placing',value);if(this.gl)this.gl.getCanvas().style.cursor=value?'crosshair':'';}
 get placeAnywhere(){return this.placing;}
 update(data,selected='',editPoint=null){this.data=data;this.selected=selected;this.editPoint=editPoint;this.refreshChrome();if(this.mode==='legacy'){const clean={...data,stores:data.stores.filter(s=>!hasGeo(s.location))};this.legacy.update(clean,selected,hasGeo(editPoint)?null:editPoint);}else this.paint();}
 point(p){return coordinateFor(p,this.labels);}
 focus(p){const c=this.point(p);if(c&&this.gl&&!this.unavailable){this.switchMode('geo');this.gl.easeTo({center:c,zoom:18,pitch:45,duration:600});}else if(p){this.switchMode('legacy');this.legacy.focus(p);}}
 marker(coords,label,kind,action,short=label){const el=document.createElement(action?'button':'span');if(action)el.type='button';el.className='geo-label '+kind;el.textContent=short;el.title=label;el.setAttribute('aria-label',label);if(action)el.onclick=e=>{e.stopPropagation();if(this.placing)this.options.place?.(50,50,{lng:coords[0],lat:coords[1]});else action();};const marker=new maplibregl.Marker({element:el,anchor:kind==='restaurant'?'bottom':'center'}).setLngLat(coords).addTo(this.gl);this.markers.push({marker,el,kind,label,short});}
 paint(){if(!this.data||!this.gl||this.dead||this.mode!=='geo')return;for(const m of this.markers)m.marker.remove();this.markers=[];
  for(const b of this.data.buildings){const coords=this.point(b);if(coords)this.marker(coords,name(b),'building'+(b.id===this.selected?' active':''),()=>this.options.select?.(b.id),b.code);}
  for(const c of this.data.canteens){if(!c.verified)continue;const coords=this.point(c)||this.point(this.data.buildings.find(b=>b.id===c.buildingId));if(coords)this.marker(coords,name(c),'hall',()=>this.options.selectHall?.(c.id));}
  for(const s of this.data.stores){if(!s.location?.verified||!hasGeo(s.location))continue;this.marker([s.location.lng,s.location.lat],name(s),'restaurant',()=>this.options.selectStore?.(s.id));}
  for(const p of this.pois){if(p.kind==='building'||['food_court','restaurant','cafe','fast_food','ice_cream'].includes(p.kind))continue;this.marker([p.lng,p.lat],name(p),'poi',()=>this.showPoi(p));}
  if(hasGeo(this.editPoint))this.marker([this.editPoint.lng,this.editPoint.lat],t('选定位置','Selected position'),'edit');
  this.layoutLabels();
 }
 showPoi(p){if(!this.gl||this.unavailable)return;this.gl.easeTo({center:[p.lng,p.lat],zoom:18,duration:500});this.popup?.remove();const el=document.createElement('div');el.className='geo-popup';const title=document.createElement('h3');title.textContent=name(p);const text=document.createElement('p');text.textContent=t('原始点位来自 Campus Map / OpenStreetMap。','Original point from Campus Map / OpenStreetMap.');el.append(title,text);this.popup=new maplibregl.Popup({closeButton:true}).setLngLat([p.lng,p.lat]).setDOMContent(el).addTo(this.gl);}
 layoutLabels(){if(!this.gl)return;const zoom=this.gl.getZoom(),occupied=[];for(const m of this.markers){const p=this.gl.project(m.marker.getLngLat());const building=m.kind.startsWith('building'),poi=m.kind==='poi',restaurant=m.kind==='restaurant';if(m.kind==='edit')continue;const full=building?zoom>=18:poi?zoom>=18:zoom>=17;
 const text=full?m.label:(building?m.short:'');const w=full?Math.min(160,text.length*11+16):(building?35:14),h=full?28:18;const overlap=occupied.some(q=>Math.abs(q.x-p.x)<(q.w+w)/2&&Math.abs(q.y-p.y)<h);
 m.el.textContent=text;m.el.classList.toggle('compact',restaurant&&!full);m.el.classList.toggle('poi-named',poi&&full);m.el.style.visibility=overlap&&!m.kind.includes('active')?'hidden':'visible';if(!overlap)occupied.push({x:p.x,y:p.y,w});}}
 destroy(){this.dead=true;this.resize?.disconnect();this.gl?.remove();for(const m of this.markers)m.marker.remove();this.markers=[];}
}
