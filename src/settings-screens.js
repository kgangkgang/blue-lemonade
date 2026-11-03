import { PRIVATE_ADDONS } from './private-addons.js';   // 테마 안으로 들인 단독 확장 화면의 아이콘(확장 카드와 같은 것 · 1.0.0 은 빈 표)

// 1.0.0 설정창 화면 합치기 · 「설정 선택」 목록 — 화면 id(salty_subs · 즐겨찾기 · 검색 이동 · 변경한 설정 바로 가기)는 그대로예요.
//   같은 틀이 반복되던 화면은 한 화면 + 칩 한 줄로 보여요. 칩은 옛 화면 id 로 가니 옛 id 로 오면 그 칩이 고른 상태예요.
//   목록에는 합친 화면을 한 줄로만 보이고, 나머지 옛 id 단추는 숨겨 둬요(자동 검사 · 즐겨찾기가 옛 id 로 화면을 돌 수 있게).

/** 합친 화면: 탭 → [{ label, subs, chips }] — subs 첫 칸이 목록에서 누르는 화면 */
export const MERGED = {
    text: [{ label: '글자 모양', subs: ['text', 'dialogue', 'ui', 'em', 'strike', 'strong', 'code'] }],
    chat: [{ label: '프로필', subs: ['profile', 'user-profile'], chips: { profile: '캐릭터', 'user-profile': '나' } }, { label: '이름 · 시간', subs: ['name', 'user-name'], chips: { name: '캐릭터', 'user-name': '나' } }],
};
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 그 화면이 든 합친 화면 (없으면 null) */
export function mergedOf(tab, sub) {
    return (MERGED[tab] || []).find(m => m.subs.includes(sub)) || null;
}
/** 머리줄 · 즐겨찾기에 쓰는 화면 이름 */
export function screenTitle(tab, sub, subs) {
    return mergedOf(tab, sub)?.label || subs[tab]?.find(([id]) => id === sub)?.[1] || '';
}

/** 화면(tab/sub)마다 바꾼 설정 수 — changes: changedSettings() 결과, route: settingRoute */
export function changedByScreen(changes, route) {
    const out = {};
    for (const { path } of changes) {
        const r = route(path); if (!r) continue;
        const m = mergedOf(r.tab, r.sub), key = `${r.tab}/${m ? m.subs[0] : r.sub}`;
        out[key] = (out[key] || 0) + 1;
    }
    return out;
}

/** 목록 2열 칸에서 꺾이는 긴 이름만 목록에서 줄여 불러요(머리줄 · 검색 · 즐겨찾기는 원래 이름) */
const CATALOG_SHORT = { 'prompt/deus': '데우스' };

/** 「설정 선택」 목록 — 탭 이름 줄 + 화면 이름 2열(바꾼 설정 수는 data-count 로, 글자에는 안 섞어요) */
export function catalogMarkup(tabs, subs, current, counts = {}) {
    return tabs.map(([tab, title]) => {
        const rows = [];
        for (const [id, label] of subs[tab] || []) {
            const m = mergedOf(tab, id);
            if (m && m.subs[0] !== id) { rows.push(`<button type="button" hidden data-act="editor-route" data-tab="${tab}" data-sub="${id}" data-merged>${esc(label)}</button>`); continue; }
            const name = m ? m.label : CATALOG_SHORT[`${tab}/${id}`] || label, here = current.tab === tab && (m ? m.subs.includes(current.sub) : current.sub === id);
            const n = counts[`${tab}/${id}`] || 0;
            const icon = SCREEN_ICONS[`${tab}/${id}`] || (tab === 'extensions' && PRIVATE_ADDONS[id]?.icon);   // 10-31 사용자: 아이콘 있는 목록(글자에는 안 섞여 자동 검사 · 즐겨찾기의 이름 대조는 그대로)
            rows.push(`<button type="button" data-act="editor-route" data-tab="${tab}" data-sub="${id}" aria-current="${here ? 'page' : 'false'}"${n ? ` data-count="${n}" aria-label="${esc(name)}, 바꾼 설정 ${n}개"` : ''}>${icon ? `<i class="fa-solid ${icon}" aria-hidden="true"></i>` : ''}${esc(name)}</button>`);
        }
        return `<div class="bl-editor-category"><h4>${title}</h4>${rows.join('')}</div>`;
    }).join('');
}

/** 합친 화면 맨 위 칩 한 줄 (한 줄 가로 밀기 · 넘치는 쪽 흐림은 tab-scroll) */
export function chipsMarkup(tab, sub, subs) {
    const m = mergedOf(tab, sub);
    if (!m) return '';
    const names = Object.fromEntries(subs[tab] || []);
    return `<div class="salty-seg bl-screen-chips" role="group" aria-label="${esc(m.label)}">${m.subs.map(id => `<button type="button" data-act="editor-route" data-tab="${tab}" data-sub="${id}" data-keep-scroll aria-pressed="${id === sub}" class="${id === sub ? 'on' : ''}">${esc(m.chips?.[id] || names[id] || id)}</button>`).join('')}</div>`;
}

/** 목록 화면 아이콘 — 화면 id → Font Awesome 이름(무료 solid) */
export const SCREEN_ICONS = {
    'theme/palette': 'fa-palette', 'theme/colors': 'fa-eye-dropper', 'theme/icons': 'fa-icons', 'theme/styles': 'fa-shirt', 'theme/changes': 'fa-list-check', 'theme/backup': 'fa-box-archive', 'theme/etc': 'fa-ellipsis',
    'text/text': 'fa-font', 'text/para': 'fa-paragraph', 'text/markdown': 'fa-hashtag', 'text/shadow': 'fa-clone',
    'chat/message': 'fa-message', 'chat/profile': 'fa-id-badge', 'chat/name': 'fa-signature', 'chat/screen': 'fa-display', 'chat/etc': 'fa-ellipsis',
    'image/layout': 'fa-table-cells-large', 'image/shape': 'fa-shapes', 'image/frame': 'fa-vector-square', 'image/size': 'fa-maximize', 'image/cutedge': 'fa-scissors',
    'prompt/deus': 'fa-masks-theater', 'prompt/fruit': 'fa-apple-whole', 'prompt/sola': 'fa-sun',
    'extensions/tts': 'fa-volume-high', 'extensions/assets': 'fa-images', 'extensions/capture': 'fa-camera', 'extensions/order': 'fa-arrow-down-short-wide', 'extensions/perf': 'fa-gauge-high', 'extensions/models': 'fa-circle-plus', 'extensions/bookmarks': 'fa-bookmark', 'extensions/zipinstall': 'fa-file-zipper', 'extensions/translator': 'fa-language', 'extensions/prompt': 'fa-table-list', 'extensions/mermaid': 'fa-diagram-project', 'extensions/rewrite': 'fa-glasses', 'extensions/direction': 'fa-feather-pointed',
    // 11-03(사용자 제보): 1.0.0 에서 되살린 화면 · 확장도 아이콘 — 설치 점검 · 단어 치환 · 메모 · 커스텀 CSS 조절 · 프롬프트 템플릿 · 모델 전환 · 정규식 연결(addons.js icons 와 같은 이름)
    'theme/update': 'fa-stethoscope', 'extensions/words': 'fa-arrow-right-arrow-left', 'extensions/notes': 'fa-note-sticky', 'extensions/customstyle': 'fa-sliders', 'extensions/prompt-template': 'fa-code', 'extensions/modelswitch': 'fa-shuffle', 'extensions/regexlink': 'fa-link',
};
