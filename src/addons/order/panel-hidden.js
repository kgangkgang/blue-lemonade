export function panelVisible(settings,key){return !Array.isArray(settings.panelHidden)||!settings.panelHidden.includes(key);}
export function setPanelVisible(settings,key,visible){const keys=Array.isArray(settings.panelHidden)?settings.panelHidden.filter(x=>typeof x==='string'&&x!==key):[];if(!visible)keys.push(key);settings.panelHidden=[...new Set(keys)];return visible;}
