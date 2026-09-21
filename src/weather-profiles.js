export const WEATHER_MODES=['rain','snow','fog','sun','star','firefly','rainbow','shadow','breeze','glass','water','lemon','petal','meteor','custom','tracker'];
export const WEATHER_FIELDS=['weatherLevel','weatherOpacity','weatherSize','weatherSpeed','weatherAngle','weatherMotion','weatherSway','weatherSpin','weatherCurvature','weatherOrbitSize','weatherOrbitDirection','weatherColorMode','weatherColor','weatherColor2','weatherShadowStyle','weatherShadowBlur','weatherWaterStyle','weatherWaterArea','weatherSunStyle','weatherStarStyle','weatherFogStyle','weatherFogArea','weatherFogStretch','weatherFogEdge','weatherFogSwell','weatherFogDepth'];
const take=chat=>Object.fromEntries(WEATHER_FIELDS.map(key=>[key,chat[key]]));
export function syncWeatherProfile(chat){
    if(!chat.weatherProfiles||typeof chat.weatherProfiles!=='object'||Array.isArray(chat.weatherProfiles))chat.weatherProfiles={};
    // Older per-effect profiles have no color fields. Never inherit another effect's tint.
    for(const profile of Object.values(chat.weatherProfiles))if(profile&&typeof profile==='object'){
        profile.weatherColorMode??='auto';profile.weatherColor??='#91cfff';
    }
    if(!WEATHER_MODES.includes(chat.weatherProfileMode)){
        // Migrate shared values once; switching effects afterwards is independent.
        for(const mode of WEATHER_MODES)if(!chat.weatherProfiles[mode])chat.weatherProfiles[mode]={...take(chat),...(mode!==chat.weather?{weatherColorMode:'auto',weatherColor:'#91cfff'}:{})};
        chat.weatherProfileMode=WEATHER_MODES.includes(chat.weather)?chat.weather:'rain';
    }
    const previous=chat.weatherProfileMode;
    chat.weatherProfiles[previous]=take(chat);
    if(WEATHER_MODES.includes(chat.weather)&&chat.weather!==previous){
        const next=chat.weatherProfiles[chat.weather];
        if(next&&typeof next==='object')for(const key of WEATHER_FIELDS)if(next[key]!==undefined)chat[key]=next[key];
        chat.weatherProfileMode=chat.weather;
    }
}
