// 7.9.3 단추 아이콘 바꾸기 — 화면에 거는 부분 (apply.js applyAll 이 부른다).
// 바꾼 역할이 없으면 <style> 을 만들지 않는다 → 아무것도 안 바꾼 사용자는 화면 · 문서가 그대로. 규칙 만들기는 role-icons-core.js
import { buildRoleCss } from './role-icons-core.js';

const ID = 'bl-role-icons';
let last = null; // 지난번 값 (얕은 사본) — 슬라이더를 끌 때마다 applyAll 이 불려도 같은 값이면 아무 일도 안 한다

const sameMap = (a, b) => {
    if (!a || !b) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => a[k] === b[k]);
};

/** 설정 roleIcons 를 화면에 */
export function syncRoleIcons(map) {
    const now = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
    let el = document.getElementById(ID);
    if (sameMap(now, last) && (!Object.keys(now).length || el)) return;
    last = { ...now };
    const css = Object.keys(now).length ? buildRoleCss(now) : '';
    if (!css) { el?.remove(); return; }
    if (!el) {
        el = document.createElement('style');
        el.id = ID;
        document.head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
}
