/** Never automatically send the legacy household snapshot, names or free-text notes. */
export function minimalAiContext(input={}) {
 const result={};
 for(const key of ['screen','today','localDate','timezone','timeZone'])if(typeof input[key]==='string')result[key]=input[key].slice(0,100);
 if(input.enabledFeatures && typeof input.enabledFeatures==='object')result.enabledFeatures=Object.fromEntries(Object.entries(input.enabledFeatures).filter(([key,value])=>/^[a-z_]{1,40}$/.test(key)&&typeof value==='boolean').slice(0,40));
 return result;
}

export function minimalAiMessages(input) {
 if(!Array.isArray(input))return [];
 return input.filter(message=>message && ['user','assistant'].includes(message.role) && typeof message.content==='string' && message.content.trim()).slice(-8).map(({role,content})=>({role,content:content.slice(0,4000)}));
}
