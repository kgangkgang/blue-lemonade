// 1.0.0 극한 최적화: safeOrigin 만 따로 — state.js(성능 보조 시작 경로)가 pricing.js 를 끌어오며 가격표 235KB 를 부팅 때 받던 것을 끊어요
export function safeOrigin(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.origin : ''; }
    catch { return ''; }
}
