// WGS84 coordinates are distinct from the legacy drawing's percentage coordinates.
export function hasGeo(p){return !!p&&Number.isFinite(p.lng)&&Number.isFinite(p.lat)&&p.lng>=-180&&p.lng<=180&&p.lat>=-85&&p.lat<=85;}
export function coordinateFor(p,labels=[]){
 if(hasGeo(p))return [p.lng,p.lat];
 const b=p?.code&&labels.find(b=>b.code.toUpperCase()===p.code.toUpperCase());
 return b?[b.lng,b.lat]:null;
}
// Approximate reference positions from the user's confirmed campus-map annotations.
// Kept separate from verified administrator coordinates; never written into the catalog.
export const hallReferences={
 'hall-phase2':{lng:113.51170,lat:22.36272},
 'hall-east-lake':{lng:113.51655,lat:22.35162}
};
