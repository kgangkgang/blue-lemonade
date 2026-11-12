// 리그 프로필의 사용자 조건 칸(10-28 멈춤 18) — rig.mjs(프로필 만들 때) · shot-diff.mjs(사진 전 확인 · 기준 캐시 열쇠)가 같이 써요.
//   8.1.3 int-813b: 한글화 패널이 처음 열릴 때 cfg().blIntroSeen110 이 거짓이면 사용방법 창(dialog.pt-help-dialog)을 띄워요(src/addons/prompt/guide.js).
//   기준 사진은 캐시(본 상태)에서, 후보는 새 사진 리그(안 봤음)에서 찍혀 후보만 「다른 창이 촬영 대상을 가려요」 4장이 나왔어요.
//   칸 목록은 lib/account-reset.mjs SEED_VALUES 하나만 써요(검사 · 풀 리그와 같은 값).
import crypto from 'node:crypto';
import { SEED_VALUES } from './account-reset.mjs';

const getIn = (o, p) => p.reduce((x, k) => (x == null ? undefined : x[k]), o);
/** 없는 칸만 채워요(있는 값은 안 건드림). 돌려줌 채운 칸 수 */
export function seedSettings(settings, seeds = SEED_VALUES) {
    let n = 0;
    for (const s of seeds) {
        let x = settings; for (const k of s.path.slice(0, -1)) { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; }
        const last = s.path.at(-1); if (x[last] === undefined) { x[last] = s.value; n++; }
    }
    return n;
}
/** 지금 프로필 상태: { state: { 'prompt-panel.blIntroSeen110': true … }, missing: [칸], sig } — sig 는 기준 사진 캐시 열쇠에 넣어요(기준 · 후보 프로필이 같아야 같은 열쇠) */
export function profileState(settings, seeds = SEED_VALUES) {
    const state = {}; const missing = [];
    for (const s of seeds) { const k = s.path.slice(1).join('.'); const v = getIn(settings, s.path); state[k] = v === undefined ? null : v; if (JSON.stringify(v) !== JSON.stringify(s.value)) missing.push(k); }
    const sig = crypto.createHash('sha1').update(JSON.stringify(Object.keys(state).sort().map(k => [k, state[k]]))).digest('hex').slice(0, 12);
    return { state, missing, sig };
}
