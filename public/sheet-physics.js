export const clampOffset=(offset,full)=>Math.max(0,Math.min(full*.38,offset));
export function shouldExpand(offset,velocity,full){return Math.abs(velocity)>.35?velocity<0:offset<full*.19;}
