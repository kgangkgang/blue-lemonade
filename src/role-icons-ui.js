// 7.9.3 설정 › 테마 › 단추 아이콘 — 역할 목록과 아이콘 고르기 창 (panel.js 가 그리고 · 부른다).
// 고르기 창은 글꼴 고르기 창과 같은 짜임(찾기 칸 · 묶음 태그 · 목록 · 아래 「+ 추가」 줄, .salty-font* 클래스)을 그대로 쓴다.
// Font Awesome 목록(role-icons-fa.gen.js, 40KB)은 고르기 창을 처음 열 때만 불러온다.
// 역할이 많아져 묶음(창 도구 · 상단 서랍 · 입력줄 · 애드온 단추 · 내 단추)으로 접는다. 「내 단추」 는 화면에서 고른 단추(role-icons-pick.js):
//   「화면에서 고르기」 → 설정 창을 닫고 화면의 단추를 누르면 → 내 단추에 들어가고 설정 창이 다시 열리며 그 단추의 고르기 창이 펼쳐진다.
import { ROLES, ROLE_GROUPS, rolesIn, roleLabel, parseRoleIcon, faValue, textValue, imageFileValue, ROLE_ICON_MAX_BYTES, pickedRoles, pickSlug, PICK_MAX } from './role-icons-core.js';
import { startPicking, stopPicking, isPicking } from './role-icons-pick.js';

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
/** 되돌리기 기록의 값 글 — roleIcons 는 값 문자열, pickedIcons 는 { label, value } 칸 */
export const roleIconHistoryValue = value => typeof value === 'string' ? describe(value) : value && typeof value === 'object' ? `${value.label || '단추'} · ${describe(value.value)}` : '처음 값';
/** 설정 pickedIcons 의 칸 하나 → 설정 창 줄에 쓰는 역할 모양 (없으면 null) */
export const pickedRole = (s, id) => (id?.startsWith('@') ? pickedRoles(s.pickedIcons).find(r => r.id === id) || null : null);
const roleOf = (s, id) => ROLES.find(r => r.id === id) || pickedRole(s, id);
const labelOf = (s, id) => roleOf(s, id)?.label || roleLabel(id);
const valueOf = (s, id) => (id?.startsWith('@') ? pickedRole(s, id)?.value : s.roleIcons?.[id]) || '';

// 미리보기 칸: 기본 선 그림은 줄마다 변수로 (css/49-role-icons.css) — 바꾼 역할이면 role-icons.js 의 규칙이 이 칸도 덮는다.
// 고른 단추는 고를 때 본 Font Awesome 아이콘(icon) 을 보여 주고, 모르면 빈 단추 모양
const PICK_GLYPH = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='14' height='14' rx='3'/%3E%3C/svg%3E")`;
const preview = role => (role.icon
    ? `<span class="bl-roleicon-preview" data-bl-role="${esc(role.id)}" aria-hidden="true"><i class="${esc(role.icon)}" aria-hidden="true"></i></span>`
    : `<span class="bl-roleicon-preview" data-bl-role="${esc(role.id)}" style="--bl-ri-glyph:${esc(role.glyph || PICK_GLYPH)}" aria-hidden="true"></span>`);

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

// 역할 한 줄 (이름 · ↺ · 설명 / 미리보기 · 바꾸기) — 줄 모양은 panel.js row() 와 같다. ↺ 는 다른 설정의 ↺ 와 같은 단추 · 같은 길(panel.js 'setting-reset')
function roleRow(role, value, path, resetShown) {
    const open = pick.role === role.id;
    const reset = `<button type="button" class="bl-setting-reset" data-act="setting-reset" data-setting="${esc(path)}" title="${esc(role.label)} · ${role.group === 'picked' ? '내 단추에서 빼기' : '기본값으로'}" aria-label="${esc(role.label)} · ${role.group === 'picked' ? '내 단추에서 빼기' : '기본값으로'}"${resetShown ? '' : ' hidden'}>↺</button>`;
    const control = `<span class="bl-roleicon-control">${preview(role)}<button type="button" class="salty-btn bl-roleicon-change${open ? ' on' : ''}" data-act="role-icon-open" data-role="${esc(role.id)}" aria-expanded="${open}" aria-label="${esc(role.label)} 아이콘 바꾸기">바꾸기</button></span>`;
    const line = `<div class="salty-row bl-roleicon-row${open ? ' open' : ''}" data-role="${esc(role.id)}"><span>${esc(role.label)}${reset}${value ? `<small>${esc(describe(value))}</small>` : ''}</span>${control}</div>`;
    return `${line}${open ? pickerMarkup(role, value) : ''}`;   // 줄은 묶음(.salty-group) 바로 아래 — 다른 설정 줄과 같은 규칙을 받는다
}

/** 설정 › 테마 › 단추 아이콘 */
export function roleIconsMarkup(s, { cap, row }) {
    const map = s.roleIcons || {};
    const picked = pickedRoles(s.pickedIcons);
    const changed = ROLES.filter(r => typeof map[r.id] === 'string').length + picked.filter(r => r.value).length;
    const groups = ROLE_GROUPS.map(([group, name]) => {
        const roles = group === 'picked' ? picked : rolesIn(group);
        const rows = roles.map(role => (group === 'picked'
            ? roleRow(role, role.value, `pickedIcons.${role.slug}`, true)
            : roleRow(role, map[role.id], `roleIcons.${role.id}`, !!map[role.id]))).join('');
        const done = roles.filter(r => (group === 'picked' ? r.value : map[r.id])).length;
        // 처음 그릴 때 열어 두는 묶음: 바꾼 게 있거나 고르기 창이 그 안에 있는 것 · 내 단추는 고른 게 있으면. 그 뒤 여닫은 것은 panel.js 가 data-md-fold 로 기억한다
        const open = done > 0 || roles.some(r => r.id === pick.role) || (group === 'picked' && roles.length > 0);
        const empty = group === 'picked' && !roles.length ? '<p class="salty-note bl-roleicon-empty">아직 고른 단추가 없어요. 위의 「화면에서 고르기」로 요술봉 메뉴 · 입력줄 · 메시지의 단추를 눌러 넣어요.</p>' : '';
        return `<details class="bl-md-group bl-roleicon-group" data-md-fold="icons:${group}"${open ? ' open' : ''}><summary><span>${esc(name)}</span><small>${done ? `바꿈 ${done} · ` : ''}${roles.length}개</small></summary><div class="salty-group bl-roleicon-rows">${rows}${empty}</div></details>`;
    }).join('');
    const pickBtn = `<button type="button" class="salty-btn" data-act="role-icon-pick"${picked.length >= PICK_MAX ? ' disabled' : ''}>고르기</button>`;
    return `<div class="salty-group bl-roleicons" data-search-anchor="단추 아이콘">${cap('단추 아이콘')}
        <p class="salty-note">역할마다 아이콘 하나예요. 바꾸면 같은 단추가 함께 바뀌어요. 확장이 더한 단추는 「화면에서 고르기」로 넣어요.</p>
        ${row(`바꾼 아이콘 ${changed}개`, `<button type="button" class="salty-btn" data-act="role-icon-reset-all"${changed || picked.length ? '' : ' disabled'}>모두 처음 값으로</button>`)}
        ${row('화면에서 고르기', pickBtn, '설정 창을 닫고 화면의 단추를 눌러요')}</div>${groups}`;
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
// 역할 값 넣기 — '@<해시>' 는 화면에서 고른 단추(pickedIcons 의 그 칸에 value), 그 밖은 roleIcons
const setRole = (st, role, value) => {
    if (role.startsWith('@')) { const slug = role.slice(1); const entry = st.pickedIcons?.[slug]; if (entry) st.pickedIcons = { ...st.pickedIcons, [slug]: { ...entry, value } }; return; }
    st.roleIcons = { ...(st.roleIcons || {}), [role]: value };
};
const addPick = (st, { key, label, icon }) => {
    const slug = pickSlug(key);
    const old = st.pickedIcons?.[slug];
    st.pickedIcons = { ...(st.pickedIcons || {}), [slug]: { ...(old || {}), key, label: old?.label || label, ...(icon ? { icon } : {}) } };
    return slug;
};
// 고르는 동안 설정 창을 치운다: 팝업이면 닫고(다시 열면 같은 자리), 확장 서랍 안이면 서랍을 닫는다. 끝나면 설정 창 팝업을 다시 연다
function hideSettings(root) {
    const dialog = root.closest('dialog');
    if (dialog) {
        // 설정 팝업은 settings-dialog.js 가 건 _onClose 로 닫아야 실리태번 Popup 의 약속이 끝나고(openPopup 의 finally) 창이 치워진다 — dialog.close() 만으로는 안 끝난다
        if (typeof root._onClose === 'function') root._onClose(); else try { dialog.close(); } catch { /* 이미 닫힘 */ }
        return;
    }
    const icon = root.closest('.drawer')?.querySelector(':scope > .drawer-toggle .drawer-icon.openIcon') || document.querySelector('#extensions-settings-button .drawer-icon.openIcon');
    icon?.closest('.drawer-toggle')?.click();
}
const reopenSettings = () => window.Salty?.openPopup?.();

/**
 * 설정 창 클릭. 처리했으면 true. ctx = { root, settings, update, refresh, ask, toast }
 */
export async function roleIconAction(act, el, ctx) {
    switch (act) {
        case 'role-icon-open': {
            const role = el.dataset.role;
            pick.role = pick.role === role ? null : role;
            pick.query = '';
            pick.tag = parseRoleIcon(valueOf(ctx.settings(), role))?.family === 'brands' ? 'brands' : 'used';
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
            const label = labelOf(ctx.settings(), role);
            pick.role = null;
            ctx.update(st => setRole(st, role, el.dataset.v));
            ctx.toast(`${label} 아이콘을 바꿨어요`);
            return true;
        }
        case 'role-icon-upload':
            ctx.root.querySelector('input[data-file="role-icon"]')?.click();
            return true;
        case 'role-icon-text': {
            const role = pick.role;
            if (!role) return true;
            const current = parseRoleIcon(valueOf(ctx.settings(), role));
            const raw = await ctx.ask('글자나 이모지 한두 개를 넣어 주세요', current?.kind === 'text' ? current.text : '');
            if (raw == null) return true;
            const value = textValue(raw);
            if (!value) { ctx.toast('글자 · 이모지는 한두 개까지예요', 'warning'); return true; }
            const label = labelOf(ctx.settings(), role);
            pick.role = null;
            ctx.update(st => setRole(st, role, value));
            ctx.toast(`${label} 아이콘을 바꿨어요`);
            return true;
        }
        case 'role-icon-reset-all':
            pick.role = null;
            ctx.update((st) => { st.roleIcons = {}; st.pickedIcons = {}; });
            ctx.toast('단추 아이콘을 모두 처음 값으로 돌렸어요');
            return true;
        case 'role-icon-pick': {   // 화면에서 고르기
            if (isPicking()) { stopPicking(); return true; }
            const root = ctx.root;
            startPicking({
                onPick: (picked) => {
                    let slug = '';
                    ctx.update((st) => { slug = addPick(st, picked); });
                    pick.role = `@${slug}`; pick.query = ''; pick.tag = 'used';
                    ensureFa(ctx.refresh);
                    ctx.toast(`「${picked.label}」 단추를 내 단추에 넣었어요`);
                    reopenSettings();
                },
                onCancel: reopenSettings,
            });
            hideSettings(root);
            return true;
        }
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
    const label = labelOf(ctx.settings(), role);
    pick.role = null;
    ctx.update(st => setRole(st, role, result.value));
    ctx.toast(`${label} 아이콘을 내 그림으로 바꿨어요`);
}
