// 7.9.3 설정 › 테마 › 단추 아이콘 — 역할 목록과 아이콘 고르기 창 (panel.js 가 그리고 · 부른다).
// 고르기 창은 글꼴 고르기 창과 같은 짜임(찾기 칸 · 묶음 태그 · 목록 · 아래 「+ 추가」 줄, .salty-font* 클래스)을 그대로 쓴다.
// Font Awesome 목록(role-icons-fa.gen.js, 40KB)은 고르기 창을 처음 열 때만 불러온다.
import { ROLES, roleLabel, parseRoleIcon, faValue, textValue, imageFileValue, ROLE_ICON_MAX_BYTES } from './role-icons-core.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pick = { role: null, tag: 'used', query: '' };

// ───────── Font Awesome 목록 ─────────
let fa = null, faLoading = null;
const TAGS = [['all', '전체'], ['used', '테마에서 쓰는'], ['arrow', '화살표'], ['brands', '브랜드']];
const ARROW = /(^|-)(arrows?|angles?|chevron|caret|turn|share|reply|rotate|right-left|up-down)(-|$)/;
function unpack(text, fam, used) {
    return text.split(';').filter(Boolean).map((row) => {
        const [code, list] = row.split(':');
        const names = list.split(',');
        return { code, names, fam, used: used.has(`${fam}${code}`), arrow: fam === 's' && names.some(n => ARROW.test(n)), hay: names.join(' ') };
    });
}
export function ensureFa(onReady) {
    if (fa) return true;
    faLoading ||= import('./role-icons-fa.gen.js').then((m) => {
        const used = new Set(m.USED.split(','));
        fa = [...unpack(m.SOLID, 's', used), ...unpack(m.BRANDS, 'b', used)];
    }).catch((error) => { faLoading = null; console.warn('[Blue Lemonade] 아이콘 목록을 못 불러왔어요', error); });
    faLoading.then(() => { if (fa) onReady?.(); });
    return false;
}

// ───────── 그리기 ─────────
function describe(value) {
    const icon = parseRoleIcon(value);
    if (!icon) return '처음 값';
    if (icon.kind === 'fa') return icon.name;
    if (icon.kind === 'text') return `글자 ${icon.text}`;
    return '내 그림';
}
export const roleIconHistoryValue = value => typeof value === 'string' ? describe(value) : '처음 값';

// 미리보기 칸: 기본 선 그림은 줄마다 변수로 (css/49-role-icons.css) — 바꾼 역할이면 role-icons.js 의 규칙이 이 칸도 덮는다
const preview = role => `<span class="bl-roleicon-preview" data-bl-role="${esc(role.id)}" style="--bl-ri-glyph:${esc(role.glyph)}" aria-hidden="true"></span>`;

function tile(item, current) {
    const name = item.names[0];
    const value = faValue(item.fam === 'b' ? 'brands' : 'solid', name, item.code);
    const on = current === value;
    const shown = pick.tag === 'all' || (pick.tag === 'used' && item.used) || (pick.tag === 'arrow' && item.arrow) || (pick.tag === 'brands' && item.fam === 'b');
    return `<button type="button" class="bl-icontile${on ? ' on' : ''}"${shown && !pick.query ? '' : ' hidden'} data-act="role-icon-fa" data-v="${esc(value)}" data-t="${item.used ? 'u' : ''}${item.arrow ? 'a' : ''}${item.fam === 'b' ? 'b' : ''}" data-q="${esc(item.hay)}" title="${esc(item.names.join(' · '))}" aria-label="${esc(name)}" aria-pressed="${on}"><i class="${item.fam === 'b' ? 'fa-brands' : 'fa-solid'} fa-${esc(name)}" aria-hidden="true"></i></button>`;
}

function pickerMarkup(role, current) {
    const list = fa
        ? `<div class="bl-icongrid">${fa.map(item => tile(item, current)).join('')}</div><p class="salty-note bl-iconempty" hidden>그런 이름의 아이콘이 없어요</p>`
        : '<p class="salty-note bl-iconempty">아이콘 목록을 불러오는 중이에요</p>';
    const tags = TAGS.map(([id, label]) => `<button type="button" data-act="role-icon-tag" data-tag="${id}" class="${pick.tag === id ? 'on' : ''}">${label}<span></span></button>`).join('');
    return `<div class="salty-fontlist bl-iconlist" data-role="${esc(role.id)}">
        <div class="salty-fonthead">
            <div class="salty-fontsearch"><input type="search" placeholder="아이콘 이름 찾기 (영어 · 예: star)" data-search="role-icon" value="${esc(pick.query)}" autocomplete="off" aria-label="${esc(role.label)} 아이콘 이름 찾기"></div>
            <div class="salty-fonttags">${tags}</div>
        </div>
        <div class="salty-fontscroll">${list}</div>
        <div class="salty-fontadd bl-iconadd">
            <button type="button" class="salty-btn" data-act="role-icon-upload">+ 내 그림</button>
            <button type="button" class="salty-btn" data-act="role-icon-text">+ 글자 · 이모지</button>
            <input type="file" accept=".png,.svg,.webp,image/png,image/svg+xml,image/webp" hidden data-file="role-icon">
        </div></div>`;
}

/** 설정 › 테마 › 단추 아이콘 */
export function roleIconsMarkup(s, { cap, row }) {
    const map = s.roleIcons || {};
    const changed = ROLES.filter(r => typeof map[r.id] === 'string').length;
    const rows = ROLES.map((role) => {
        const value = map[role.id];
        const open = pick.role === role.id;
        // ↺ 는 다른 설정의 ↺ 와 같은 단추 · 같은 길(panel.js 'setting-reset' → resetSetting · 알림 · 되돌리기 기록 · 보일지 말지 syncSettingResets)
        const reset = `<button type="button" class="bl-setting-reset" data-act="setting-reset" data-setting="roleIcons.${role.id}" title="${esc(role.label)} · 기본값으로" aria-label="${esc(role.label)} · 기본값으로"${value ? '' : ' hidden'}>↺</button>`;
        const control = `<span class="bl-roleicon-control">${preview(role)}<button type="button" class="salty-btn bl-roleicon-change${open ? ' on' : ''}" data-act="role-icon-open" data-role="${role.id}" aria-expanded="${open}" aria-label="${esc(role.label)} 아이콘 바꾸기">바꾸기</button></span>`;
        // 줄 모양은 panel.js row() 와 같다 (이름 · ↺ · 설명 / 조작) — ↺ 는 다른 설정처럼 이름 바로 옆
        const line = `<div class="salty-row"><span>${esc(role.label)}${reset}${value ? `<small>${esc(describe(value))}</small>` : ''}</span>${control}</div>`;
        return `<div class="bl-roleicon-row${open ? ' open' : ''}" data-role="${role.id}">${line}${open ? pickerMarkup(role, value) : ''}</div>`;
    }).join('');
    return `<div class="salty-group bl-roleicons" data-search-anchor="단추 아이콘">${cap('단추 아이콘')}
        <p class="salty-note">역할마다 아이콘 하나예요. 바꾸면 테마 곳곳의 같은 단추가 함께 바뀌어요.</p>
        ${row(`바꾼 아이콘 ${changed}개`, `<button type="button" class="salty-btn" data-act="role-icon-reset-all"${changed ? '' : ' disabled'}>모두 처음 값으로</button>`)}
        ${rows}</div>`;
}

// ───────── 거르기 (다시 그리지 않고 목록만) ─────────
export function filterRoleIcons(root) {
    const list = root.querySelector('.bl-iconlist');
    if (!list) return;
    const q = pick.query.trim().toLowerCase();
    const counts = { all: 0, used: 0, arrow: 0, brands: 0 };
    let shown = 0;
    for (const el of list.querySelectorAll('.bl-icontile')) {
        const hit = !q || el.dataset.q.includes(q);
        const t = el.dataset.t;
        if (hit) { counts.all++; if (t.includes('u')) counts.used++; if (t.includes('a')) counts.arrow++; if (t.includes('b')) counts.brands++; }
        const inTag = pick.tag === 'all' || (pick.tag === 'used' && t.includes('u')) || (pick.tag === 'arrow' && t.includes('a')) || (pick.tag === 'brands' && t.includes('b'));
        el.hidden = !(hit && inTag);
        if (!el.hidden) shown++;
    }
    for (const tag of list.querySelectorAll('[data-act="role-icon-tag"]')) {
        tag.classList.toggle('on', tag.dataset.tag === pick.tag);
        tag.classList.toggle('none', !counts[tag.dataset.tag]);
        tag.lastElementChild.textContent = counts[tag.dataset.tag];
    }
    const empty = list.querySelector('.bl-iconempty');
    if (empty && fa) empty.hidden = shown > 0;
}

// ───────── 동작 ─────────
const setRole = (st, role, value) => { st.roleIcons = { ...(st.roleIcons || {}), [role]: value }; };

/**
 * 설정 창 클릭. 처리했으면 true. ctx = { root, update, refresh, ask, toast }
 */
export async function roleIconAction(act, el, ctx) {
    switch (act) {
        case 'role-icon-open': {
            const role = el.dataset.role;
            pick.role = pick.role === role ? null : role;
            pick.query = '';
            pick.tag = parseRoleIcon(ctx.settings().roleIcons?.[role])?.family === 'brands' ? 'brands' : 'used';
            if (pick.role && !ensureFa(ctx.refresh)) { /* 목록이 오면 다시 그린다 */ }
            ctx.refresh();
            return true;
        }
        case 'role-icon-tag':
            pick.tag = el.dataset.tag;
            filterRoleIcons(ctx.root);
            return true;
        case 'role-icon-fa': {
            const role = pick.role;
            if (!role || !parseRoleIcon(el.dataset.v)) return true;
            pick.role = null;
            ctx.update(st => setRole(st, role, el.dataset.v));
            ctx.toast(`${roleLabel(role)} 아이콘을 바꿨어요`);
            return true;
        }
        case 'role-icon-upload':
            ctx.root.querySelector('input[data-file="role-icon"]')?.click();
            return true;
        case 'role-icon-text': {
            const role = pick.role;
            if (!role) return true;
            const current = parseRoleIcon(ctx.settings().roleIcons?.[role]);
            const raw = await ctx.ask('글자나 이모지 한두 개를 넣어 주세요', current?.kind === 'text' ? current.text : '');
            if (raw == null) return true;
            const value = textValue(raw);
            if (!value) { ctx.toast('글자 · 이모지는 한두 개까지예요', 'warning'); return true; }
            pick.role = null;
            ctx.update(st => setRole(st, role, value));
            ctx.toast(`${roleLabel(role)} 아이콘을 바꿨어요`);
            return true;
        }
        case 'role-icon-reset-all':
            pick.role = null;
            ctx.update((st) => { st.roleIcons = {}; });
            ctx.toast('단추 아이콘을 모두 처음 값으로 돌렸어요');
            return true;
        default: return false;
    }
}

/** 내 그림 파일을 골랐을 때 */
export async function roleIconFile(file, ctx) {
    const role = pick.role;
    if (!role || !file) return;
    if (file.size > ROLE_ICON_MAX_BYTES) { ctx.toast(`그림은 ${ROLE_ICON_MAX_BYTES / 1024}KB 까지예요 (이 파일은 ${Math.ceil(file.size / 1024)}KB)`, 'warning'); return; }
    const result = imageFileValue(new Uint8Array(await file.arrayBuffer()));
    if (result.error) { ctx.toast(result.error, 'warning'); return; }
    pick.role = null;
    ctx.update(st => setRole(st, role, result.value));
    ctx.toast(`${roleLabel(role)} 아이콘을 내 그림으로 바꿨어요`);
}
