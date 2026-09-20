export const WEATHER_MODES=['rain','snow','lemon','petal','meteor','custom','tracker'];
export const WEATHER_FIELDS=['weatherLevel','weatherOpacity','weatherSize','weatherSpeed','weatherAngle','weatherMotion','weatherSway','weatherSpin','weatherCurvature','weatherOrbitSize','weatherOrbitDirection'];
const take=chat=>Object.fromEntries(WEATHER_FIELDS.map(key=>[key,chat[key]]));
export function syncWeatherProfile(chat){
    if(!chat.weatherProfiles||typeof chat.weatherProfiles!=='object'||Array.isArray(chat.weatherProfiles))chat.weatherProfiles={};
    if(!WEATHER_MODES.includes(chat.weatherProfileMode)){
        // Migrate shared values once; switching effects afterwards is independent.
        for(const mode of WEATHER_MODES)if(!chat.weatherProfiles[mode])chat.weatherProfiles[mode]=take(chat);
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
