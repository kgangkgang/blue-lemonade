export const RETIRED_WEATHER = ['feather','butterfly','glass','water'];
export const activeWeather = mode => !RETIRED_WEATHER.includes(mode);

// Keep old three-step settings visually stable when moving to a numeric amount.
export function weatherAmount(value, level = 2) {
    const n = value == null || value === '' ? NaN : Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(200, n)) : ({1:55,2:100,3:170}[level] ?? 100);
}

// Native detail on high-density phones, bounded backing buffers on large screens.
export function weatherPixelRatio(deviceRatio, width, height) {
    const native = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
    const area = Math.max(1, width * height || 1);
    return Math.max(1, Math.min(native, 3, Math.sqrt(4_000_000 / area)));
}
