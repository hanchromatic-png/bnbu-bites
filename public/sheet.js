// Mobile sheet: drag the handle or tap it; content retains native scrolling.
export function mobileSheet(host,handle,label){
 const media=matchMedia('(max-width:700px)');let expanded=false,start=null,moved=false;
 const paint=()=>{host.classList.toggle('sheet-expanded',expanded);handle.setAttribute('aria-expanded',String(expanded));handle.querySelector('span').textContent=label(expanded);};
 const set=value=>{expanded=value;host.style.removeProperty('--sheet-height');host.classList.remove('sheet-dragging');paint();};
 handle.onclick=()=>{if(!moved)set(!expanded);moved=false;};
 handle.onkeydown=e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();set(e.key==='ArrowUp');}};
 handle.onpointerdown=e=>{if(!media.matches)return;moved=false;start={y:e.clientY,height:host.getBoundingClientRect().height};handle.setPointerCapture(e.pointerId);};
 handle.onpointermove=e=>{if(!start)return;const delta=start.y-e.clientY;if(Math.abs(delta)>6)moved=true;if(!moved)return;host.classList.add('sheet-dragging');const full=host.parentElement.clientHeight;host.style.setProperty('--sheet-height',Math.max(full*.45,Math.min(full*.96,start.height+delta))+'px');};
 const end=e=>{if(!start)return;const delta=start.y-e.clientY;start=null;if(moved)set(delta>0);};
 handle.onpointerup=end;handle.onpointercancel=()=>{start=null;set(expanded);};
 media.addEventListener('change',()=>set(expanded));paint();return {refresh:paint,collapse:()=>set(false),expand:()=>{if(media.matches)set(true);}};
}
