import {clampOffset,shouldExpand} from './sheet-physics.js';
// Fixed-height sheet: animate only its transform; let the content keep native scrolling.
export function mobileSheet(host,handle,label){
 const media=matchMedia('(max-width:700px)');let expanded=false,start=null,suppressClick=false,frame=0,offset=0;
 const full=()=>host.parentElement.clientHeight;
 const paint=()=>{host.classList.toggle('sheet-expanded',expanded);handle.setAttribute('aria-expanded',String(expanded));handle.querySelector('span').textContent=label(expanded);};
 const set=value=>{expanded=value;start=null;cancelAnimationFrame(frame);host.style.removeProperty('--sheet-offset');host.classList.remove('sheet-dragging');paint();};
 handle.onclick=()=>{if(!suppressClick)set(!expanded);suppressClick=false;};
 handle.onkeydown=e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();set(e.key==='ArrowUp');}};
 host.addEventListener('pointerdown',e=>{
  if(!media.matches||!e.isPrimary||e.button!==0)return;
  const onHandle=handle.contains(e.target),onTitle=e.target.closest('.sidebar-head h1,.sidebar-head .eyebrow,.count-line');
  if(!onHandle&&!onTitle)return;
  suppressClick=false;offset=expanded?0:full()*.38;
  start={y:e.clientY,offset,lastY:e.clientY,time:e.timeStamp,velocity:0,moved:false,pointer:e.pointerId,target:e.target};
 });
 host.addEventListener('pointermove',e=>{
  if(!start||e.pointerId!==start.pointer)return;const delta=e.clientY-start.y;
  if(!start.moved&&Math.abs(delta)<5)return;
  if(!start.moved){start.moved=true;host.setPointerCapture(e.pointerId);host.classList.add('sheet-dragging');}
  const elapsed=e.timeStamp-start.time;if(elapsed>0)start.velocity=(e.clientY-start.lastY)/elapsed;
  start.lastY=e.clientY;start.time=e.timeStamp;offset=clampOffset(start.offset+delta,full());
  cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>host.style.setProperty('--sheet-offset',offset+'px'));
 });
 host.addEventListener('pointerup',e=>{if(!start||e.pointerId!==start.pointer)return;const s=start;start=null;if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);if(!s.moved)return;suppressClick=true;const velocity=e.timeStamp-s.time>100?0:s.velocity;set(shouldExpand(offset,velocity,full()));});
 host.addEventListener('pointercancel',()=>set(expanded));host.addEventListener('lostpointercapture',()=>{if(start)set(expanded)});
 media.addEventListener('change',()=>set(expanded));window.addEventListener('resize',()=>{if(!start)set(expanded)});
 paint();return {refresh:paint,collapse:()=>set(false),expand:()=>{if(media.matches)set(true);}};
}
