// A failed/empty ES module stays cached by browsers; retries must use a fresh URL.
const pending = new Map();
export function loadWeatherModule(url, names, importer = specifier => import(specifier)) {
    const key = String(url);
    if (!pending.has(key)) pending.set(key, (async () => {
        let error;
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt) await new Promise(resolve => setTimeout(resolve, attempt * 500));
            const target = new URL(key);
            if (attempt) target.searchParams.set('weather_retry', `${Date.now()}-${attempt}`);
            try {
                const module = await importer(target.href);
                if (!names.every(name => typeof module[name] === 'function')) throw Error('날씨 모듈 형식을 확인하지 못했어요.');
                return module;
            } catch (failure) { error = failure; }
        }
        // Retain the rejection briefly so repeated slider updates cannot churn workers/imports.
        setTimeout(() => pending.delete(key), 2500);
        throw error;
    })());
    return pending.get(key);
}
