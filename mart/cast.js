// 11-10 글꾸 마트 목록 위 한 줄 「깡통: 원래 색 ▾ · 깡캐: 원래 색 ▾」(11-11 칸 둘 — 깡통 = 첫째 화자 · 깡캐 = 둘째 화자) — 펼쳐서 캐릭터를 고르면 그 자리에서 목록의 글꾸가 전부 그 대사색으로 다시 칠해져요(tone-state.js · 고른 것은 기억).
//   사용자 「가브리엘 글꾸 누르고 그안에서 글꾸 디자인고르는거지」 · 「그냥 장르별로 캐릭터고를수있게하돼 너무 캐릭터창이길어지지않게 꺽쇠라디오목록식으로하는게」
//   - 11-12 밤 「한 번에 한 묶음」(사용자 「지금 UI UX 너무 숨막히지 않냐?」 → 시안 안 A): 묶음 탭 한 줄(천지합동청 · D&H · 아드리안 · 무협시뮬 · 센티넬버스 · 직접) 중 하나만 보여요.
//     인물은 색 점 칩 · 묶음 머리에 「원작 N ⌄」(누르면 그 묶음 원작 글 전부) + 「이 세계관 틀 N 보기 →」 · 이름 / 색 / 기억하고 고르기 / 채팅 붙여 넣기는 「직접」 탭 · 「원래 색 · 캐릭터 없음 · 소품까지 캐릭터 색」은 맨 아래 한 줄.
//   - 「채팅 붙여 넣어 대사색 찾기」: 실리태번 화면에서 복사한 채팅을 붙이면 대사 글자색(인라인 color)을 읽어 그 캐릭터를 골라요.
//   - 밤 · 낮: 틀 바탕.
import { toneState, setTone, castPicked, savedCast, CAST_GROUPS, castList, rememberCast, forgetCast, PAPER_COLORS, TEXTURES } from './tone-state.js?v=20261113a';
/** 11-11 「바탕(종이 색 · 질감)」 칸은 화면에서 숨겨요 — 새 글꾸 틀에는 안 걸려 눌러도 바뀌는 게 없어서요(코드 · 자료는 그대로 · 나중에 격자 · 질감을 한꺼번에 되살릴 때 true) */
const PAPER_ENABLED = false;
import { dialogueColors } from './tone-geulkku.js?v=20261110v';
import { castSources, groupSources, sourceHtml } from './sources.js?v=20261113u';   // 11-12 밤 원작(출처) — 캐릭터 묶음 · 고른 캐릭터 줄
import { mineOn, mineText, mineInfo, setMine as setMineRaw } from './mine-text.js?v=20261112f';
import { dropMineEdits } from './tune.js?v=20261112f';
/** 11-11 독립 점검 1 — 내 글이 바뀌면 옛 글에서 고친 줄 · 숨긴 줄을 먼저 비우고(칸 번호가 옛 글 것) 바꿔요 */
const setMine = (next = {}) => { if ('text' in next && String(next.text ?? '') !== mineText()) dropMineEdits(); return setMineRaw(next); };   // 11-11 「내 글 넣기」 — 붙여 넣은 내 글로 모든 카드를 그려요

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const namesIn = text => [...new Set(String(text || '').split(/\n/).map(l => (l.match(/^\s*([^\s:：]{1,20})\s*[:：]/) || [])[1]).filter(Boolean))];

/** 지금 보일 묶음들 — who: 'main' 깡통(첫째 화자) · 'other' 깡캐(둘째 화자). 묶음 · 기억한 캐릭터는 두 칸이 같이 써요 */
function groups(who = 'main') {
    const saved = savedCast();
    return [
        ...(saved.length ? [{ id: 'mine', label: '내 캐릭터', sub: '이 브라우저에 기억', cast: saved.map(x => ({ ...x, saved: true })) }] : []),
        ...CAST_GROUPS,
        { id: 'none', label: who === 'other' ? '원래 색 · 직접 색' : '캐릭터 없음 · 직접 색', sub: '', cast: [], tail: true },
    ];
}
const isPicked = x => toneState.picks.some(p => same(p.color, x.color) && p.name === x.name);
const isOn = x => toneState.on && (toneState.mix ? isPicked(x) : same(toneState.k, x.color) && (!toneState.name || toneState.name === x.name));
const isOn2 = x => !!toneState.k2 && same(toneState.k2, x.color) && (!toneState.name2 || toneState.name2 === x.name);
const onOf = who => (who === 'other' ? isOn2 : isOn);
const groupOfSelection = (list, who = 'main') => {
    if (who === 'other') return toneState.k2 ? (list.find(g => g.cast.some(isOn2)) || list.find(g => g.cast.some(x => same(x.color, toneState.k2))))?.id || 'none' : 'none';
    if (!toneState.on || !toneState.k) return 'none';
    return (list.find(g => g.cast.some(isOn)) || list.find(g => g.cast.some(x => same(x.color, toneState.k))))?.id || 'none';
};
/** 색 고르기 단추 — 브라우저 기본 색 칸은 단추 전체를 덮는 투명 칸으로 두고(누르면 colorpop.js 가 마트 색 고르기를 띄워요) 색 원 + 색 값만 보여요 */
/** 11-12 밤 고른 캐릭터의 원작 줄(깡통 · 깡캐) — 묶음에 든 캐릭터일 때만(직접 고른 색 · 내 캐릭터는 원작이 없어요). 목록 위 줄과 크게 보기 머리가 같이 써요 */
export function pickedCreditHtml() {
    const row = (label, name, color) => {
        if (!name) return '';
        const x = castList().find(c => c.name === name && c.group && (!color || same(c.color, color))); if (!x) return '';
        const src = castSources(x.name, x.group); if (!src.length) return '';
        return `<span class="mart-cast-credit-row"><span class="mart-cast-credit-who">${label} <i class="mart-ink-dot" style="background:${esc(x.color)}" aria-hidden="true"></i><b>${esc(x.name)}</b></span>${src.map(s => sourceHtml(s)).join('')}</span>`;
    };
    return (toneState.on && toneState.k ? row('깡통', toneState.name, toneState.k) : '') + (toneState.k2 ? row('깡캐', toneState.name2, toneState.k2) : '');
}
const colorField = value => `<label class="mart-cast-color" title="색 고르기"><input type="color" name="color" value="${esc(value)}" aria-label="대사색"><i class="mart-ink-dot mart-cast-swatch" style="background:${esc(value)}" aria-hidden="true"></i><span class="mart-cast-hex">${esc(value)}</span></label>`;

/** 11-12 밤 밝기 단추 — 글자 「밤 | 낮」 대신 해 · 달 아이콘 두 칸(해 먼저 · 띠 하나 · 고른 칸만 켜짐: 해 = 레몬 + 짙은 그림 · 달 = 파랑 + 흰 그림). 사용자 「밤 낮 위치 바꿔주고 낮 기본으로」 · 「밤 낮이라고 하지 말고 저기도 걍 아이콘 넣어」
 *  attr: 단추에 달 속성 이름(data-mode · data-tune-mode) · mode: 지금 고른 값('light' | 'dark' | 그 밖 = 둘 다 꺼짐) · 글자가 없어도 읽히게 aria-label · title 에 낮 · 밤 */
export const dayNightHtml = (attr, mode) => `<span class="mart-dn" role="group" aria-label="밝기">${[['light', '낮', 'is-day'], ['dark', '밤', 'is-night']].map(([v, l, c]) => `<button type="button" class="mart-dn-b ${c}" ${attr}="${v}" aria-pressed="${mode === v}" aria-label="${l}" title="${l}"><i aria-hidden="true"></i></button>`).join('')}</span>`;
export function mountCast(box, { say = () => {}, worlds = () => [], openWorld = null } = {}) {
    if (!box) return;
    // 11-11 칸이 둘이에요 — 「깡통 ● 이름」(첫째 화자 색) · 「깡캐 ● 이름」(둘째 화자 색). 칸을 누르면 그 칸의 목록이 펼쳐져요(한 번에 하나)
    // 11-12 밤 묶음은 탭 하나만 보여요: tab[칸] = 묶음 id | 'direct' · srcOpen[칸] = 묶음 머리 「원작 N」을 펼쳤는지
    const tab = { main: null, other: null }, srcOpen = { main: false, other: false };
    let who = null, paperOpen = false;   // 11-10 처음엔 한 줄만 — 누르면 세계관 묶음이 펼쳐져요(사용자 「누구 로그예요?가먼저나오는게맞나...?」 → 목록이 먼저)
    /** 처음 펼칠 때 보일 탭: 고른 캐릭터가 든 묶음 · 기억한 캐릭터나 직접 고른 색이면 「직접」 · 아무것도 안 골랐으면 첫 묶음 */
    const startTab = (w) => {
        const g = groupOfSelection(groups(w), w);
        if (g === 'mine') return 'direct';
        if (g === 'none') return (w === 'other' ? toneState.k2 : toneState.on && toneState.k) ? 'direct' : CAST_GROUPS[0].id;
        return g;
    };
    /** 11-11 「내 글」 칸: 붙여 넣으면 모든 카드가 내 글로(테마 · 예전 마트 「📝 내 로그로 보기」처럼) · 「견본 글로」 되돌리기 · 「지우기」 · 이 브라우저에 기억 */
    const textPanel = () => {
        const info = mineInfo(), on = mineOn();
        const status = on ? `내 글로 보는 중 · 화자 ${esc(info.names.slice(0, 3).join(' · '))}${info.names.length > 3 ? ` 외 ${info.names.length - 3}` : ''} · 대사 ${info.dialogue}줄${info.cut ? ' · 길어서 앞부분만 넣었어요' : ''}${!info.generic && info.names.length >= 3 ? ' · 셋째 화자 색은 크게 보기 「색」의 「셋째」에서 골라요' : ''}` : mineText().trim() ? '넣어 둔 글이 있어요 · 「내 글로 보기」를 누르면 카드가 바뀌어요' : '견본 글로 보는 중';
        return `<div class="mart-cast-panel" id="mart-cast-panel" data-who="text"><p class="mart-cast-who"><b>내 글</b>을 붙여 넣으면 모든 카드가 내 글로 바뀌어요 · 「이름: 대사」 줄 · 이름만 한 줄 쓰고 다음 줄에 "대사" · 실리태번 화면에서 복사한 채팅 · 그냥 글 모두 돼요 · 대사색이 있으면 깡통 · 깡캐 색도 찾아요</p>
            <textarea class="field mart-mine-text" rows="4" maxlength="200000" placeholder="여기에 붙여 넣어요" aria-label="내 글">${esc(mineText())}</textarea>
            <div class="mart-tune-line mart-hscroll mart-mine-btns"><button type="button" class="btn" data-mine="apply">내 글로 보기</button><button type="button" class="chip" data-mine="sample" aria-pressed="${!on}">견본 글로</button><button type="button" class="chip" data-mine="clear">지우기</button></div>
            <p class="mart-mine-info" role="status">${status}</p></div>`;
    };
    const dot = (color, cls = '') => `<i class="mart-ink-dot mart-cast-dot${cls ? ` ${cls}` : ''}"${color ? ` style="background:${esc(color)}"` : ''} aria-hidden="true"></i>`;
    const draw = () => {
        const panel = !!who, w = who === 'text' ? 'main' : who || 'main', other = w === 'other', on = onOf(w);
        if (panel && who !== 'text' && !tab[w]) tab[w] = startTab(w);
        const saved = savedCast().map(x => ({ ...x, saved: true }));
        /** 인물 칩 — 색 점 + 이름 · 고른 칩은 옅은 파랑 면 + 체크(마트 칩 그대로) */
        const person = x => `<button type="button" class="chip mart-cast-p" data-color="${esc(x.color)}" data-name="${esc(x.name)}" aria-pressed="${!!on(x)}">${dot(x.color)}<span>${esc(x.name)}</span></button>`;
        const form = value => `<form class="mart-cast-form"><label class="field-wrap"><input type="text" class="field" name="name" maxlength="20" placeholder="이름" aria-label="캐릭터 이름" required></label>${colorField(value)}<button type="submit" class="btn">기억하고 고르기</button></form>`;
        const pane = (id) => {
            if (id === 'direct') {
                return `<div class="mart-cast-pane mart-cast-direct" id="mart-cast-direct">
                    ${saved.length ? `<div class="mart-cast-people" role="group" aria-label="기억한 캐릭터">${saved.map(x => `<span class="mart-cast-mine">${person(x)}<button type="button" class="mart-cast-x" data-forget="${esc(x.name)}" aria-label="${esc(x.name)} 잊기" title="기억에서 빼요">×</button></span>`).join('')}</div>` : ''}
                    <div class="mart-cast-direct-in"><div>${form((other ? toneState.k2 : toneState.k) || (other ? '#ff5fa2' : '#3aa7ff'))}<p class="mart-cast-hint">기억한 캐릭터는 이 탭 맨 위에 칩으로 모여요 · 이 브라우저에만 남아요</p></div>
                    ${other ? '' : '<label class="mart-cast-paste"><textarea class="field" rows="2" placeholder="채팅을 붙여 넣으면 대사색을 찾아요 · 둘이면 둘째는 깡캐로" aria-label="채팅 붙여 넣기"></textarea></label>'}</div></div>`;
            }
            const g = CAST_GROUPS.find(x => x.id === id); if (!g) return '';
            const src = groupSources(g.id, g.cast.map(x => x.name));   // 11-12 밤 묶음마다 원작 글 전부(주소 있으면 링크) — 「원작 N ⌄」을 누르면 펼쳐져요
            const ws = worlds().filter(x => x.group === g.id);
            const go = ws.map(x => `<a class="mart-cast-go" href="#mart-band" data-world="${esc(x.id)}">${ws.length > 1 ? `${esc(x.label)} ` : '이 세계관 '}틀 ${x.n} 보기 →</a>`).join('');
            return `<div class="mart-cast-pane" id="mart-cast-${g.id}">
                <div class="mart-cast-wh"><b>${esc(g.label)}</b>${src.length ? `<button type="button" class="mart-cast-more chev" data-src-toggle aria-expanded="${srcOpen[w]}" aria-controls="mart-cast-src-${g.id}">원작 ${src.length}</button>` : ''}${go ? `<span class="mart-cast-gos">${go}</span>` : ''}</div>
                ${src.length ? `<p class="mart-cast-src" id="mart-cast-src-${g.id}" data-src-group="${g.id}"${srcOpen[w] ? '' : ' hidden'}>${src.map(s => sourceHtml(s)).join('')}</p>` : ''}
                <div class="mart-cast-people" role="group" aria-label="${esc(g.label)} 인물">${g.cast.map(person).join('')}</div></div>`;
        };
        const tabs = () => [...CAST_GROUPS.map(g => [g.id, g.label, g.cast.length]), ['direct', '직접', saved.length || '']].map(([id, label, n]) => `<button type="button" class="tab" data-tab="${id}" aria-pressed="${tab[w] === id}" aria-controls="mart-cast-${id}"><span class="tab-t">${esc(label)}</span>${n === '' ? '' : `<span class="mart-n n">${n}</span>`}</button>`).join('');
        /** 맨 아래 한 줄: 원래 색 · (깡통만) 캐릭터 없음 · 소품까지 캐릭터 색 */
        const foot = () => `<div class="mart-cast-foot"><button type="button" class="chip mart-cast-p" data-pick="off" aria-pressed="${other ? !toneState.k2 : !toneState.on}" title="틀마다 정해 둔 색 그대로">${dot('', 'is-off')}<span>원래 색</span></button>${other ? '' : `<button type="button" class="chip mart-cast-p" data-pick="none" aria-pressed="${toneState.on && !toneState.k}" title="무채 — 캐릭터 색 없이">${dot('', 'is-none')}<span>캐릭터 없음</span></button>`}${castPicked() ? `<label class="check mart-cast-cover" title="켜면 기본 색 틀의 소품(그림)까지 고른 캐릭터 색으로 덮어요 · 끄면 소품은 기본 색 그대로 글 쪽만 캐릭터 색"><input type="checkbox" data-cover${toneState.cover ? ' checked' : ''}><span>소품까지 캐릭터 색</span></label>` : ''}</div>`;   // 「소품까지 캐릭터 색」은 캐릭터를 골랐을 때만(원래 색이면 덮을 색이 없어요 — 예전 머리 줄 칩과 같아요)
        const picks = toneState.mix ? toneState.picks : [];
        const now = !toneState.on ? { name: '원래 색' } : picks.length >= 2 ? { name: picks.map(p => p.name || p.color).join(' + '), dots: picks.map(p => p.color) } : toneState.k ? { name: toneState.name || toneState.k, dots: [toneState.k] } : { name: '없음', dots: [] };
        const now2 = toneState.k2 ? { name: toneState.name2 || toneState.k2, dots: [toneState.k2] } : { name: '원래 색' };
        const dotsOf = n => (n.dots ? (n.dots.length ? n.dots.map(c => dot(c)).join('') : dot('', 'is-none')) : dot('', 'is-off'));
        // 머리 줄 칸: 「깡통 ● 이름 ⌄」 — 꺾쇠는 마트 기준 모양(.chev) · 펼친 칸은 옅은 파랑 면
        const toggle = (id, label, n) => `<button type="button" class="mart-cast-toggle chev" data-toggle="${id}" aria-expanded="${who === id}" aria-controls="mart-cast-panel"><small>${label}</small>${id === 'text' ? '' : dotsOf(n)}<b>${esc(n.name)}</b></button>`;
        const pc = PAPER_COLORS[toneState.paper] || PAPER_COLORS.white, tx = TEXTURES[toneState.texture] || TEXTURES.plain;
        const sw = id => { const p = PAPER_COLORS[id][toneState.mode === 'light' ? 'light' : 'dark']; return `background:${p[0]};box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)`; };
        const paperPanel = PAPER_ENABLED && paperOpen ? `<div class="mart-cast-panel" id="mart-paper-panel"><div class="mart-cast-sub2">종이 색</div><div class="mart-cast-list" role="radiogroup" aria-label="종이 색">${Object.entries(PAPER_COLORS).map(([id, p]) => `<label class="mart-cast-r"><input type="radio" name="bl-paper" value="${id}"${id === toneState.paper ? ' checked' : ''}><i class="mart-ink-dot" style="${sw(id)}" aria-hidden="true"></i><span>${esc(p.label)}</span></label>`).join('')}</div><div class="mart-cast-sub2">질감</div><div class="mart-cast-list" role="radiogroup" aria-label="질감">${Object.entries(TEXTURES).filter(([, t]) => !t.hidden).map(([id, t]) => `<label class="mart-cast-r"><input type="radio" name="bl-texture" value="${id}"${id === toneState.texture ? ' checked' : ''}><span>${esc(t.label)}</span></label>`).join('')}</div></div>` : '';
        box.innerHTML = `<div class="mart-cast-head"><span class="mart-cast-slots">${toggle('main', '깡통', now)}<button type="button" class="ibtn mart-cast-swap" data-swap aria-label="깡통 · 깡캐 바꾸기" title="깡통 · 깡캐 바꾸기 — 두 칸의 캐릭터 · 색을 맞바꿔요"></button>${toggle('other', '깡캐', now2)}${toggle('text', '내 글', { name: mineOn() ? '넣음' : '견본' })}</span>${PAPER_ENABLED ? `<button type="button" class="mart-cast-toggle" data-paper aria-expanded="${paperOpen}" aria-controls="mart-paper-panel"><span>바탕:</span><i class="mart-ink-dot" style="${sw(toneState.paper)}" aria-hidden="true"></i><b>${esc(pc.label)} · ${esc(tx.label)}</b></button>` : ''}<span class="mart-cast-mode">${dayNightHtml('data-mode', toneState.mode)}</span></div>
            ${(c => (c ? `<p class="mart-cast-credit">${c}</p>` : ''))(pickedCreditHtml())}
            ${who === 'text' ? textPanel() : `<div class="mart-cast-panel" id="mart-cast-panel" data-who="${w}"${panel ? '' : ' hidden'}>${panel ? `<p class="mart-cast-who">${other ? '<b>깡캐 색</b> 둘째 화자의 대사색이에요 · 안 고르면 틀마다 정해 둔 색 그대로예요' : '<b>깡통 색</b> 첫째 화자의 대사색이에요 · 소품 색도 따라가요'}</p><div class="mart-cast-tabs mart-hscroll" role="group" aria-label="캐릭터 묶음">${tabs()}</div>${pane(tab[w])}${foot()}` : ''}</div>${paperPanel}`}`;
    };
    /** 그 칸(깡통 · 깡캐)에 색을 입혀요 — color: 색 | 'off' 원래 색 | 'none' 캐릭터 없음(깡통만) */
    const pick = (w, color, name = '') => {
        if (w === 'other') setTone(color === 'off' ? { k2: null } : { k2: color, name2: name });
        else if (color === 'off') setTone({ on: false });
        else setTone({ on: true, k: color === 'none' ? null : color, name: color === 'none' ? '' : name });
    };
    box.addEventListener('click', (e) => {
        const x = e.target.closest('[data-forget]'); if (x) { e.preventDefault(); forgetCast(x.dataset.forget); draw(); return; }
        const m = e.target.closest('[data-mode]'); if (m) { setTone({ mode: m.dataset.mode }); draw(); return; }
        if (e.target.closest('[data-paper]')) { paperOpen = !paperOpen; draw(); box.querySelector('[data-paper]')?.focus(); return; }
        if (e.target.closest('[data-swap]')) { swapSpeakers(say); tab.main = tab.other = null; draw(); box.querySelector('[data-swap]')?.focus(); return; }
        const t = e.target.closest('[data-toggle]');
        if (t) { const id = ['other', 'text'].includes(t.dataset.toggle) ? t.dataset.toggle : 'main'; who = who === id ? null : id; draw(); box.querySelector(`[data-toggle="${id}"]`)?.focus(); return; }
        const mb = e.target.closest('[data-mine]');
        if (mb) {
            const ta = box.querySelector('.mart-mine-text'), act = mb.dataset.mine;
            if (act === 'apply') { if (!ta.value.trim()) { say('글을 붙여 넣어 주세요', 2400); ta.focus(); return; } const info = setMine({ text: ta.value, on: true }); say(info?.lines ? `내 글로 바꿨어요 · 대사 ${info.dialogue}줄` : '글에서 넣을 줄을 못 찾았어요', 2800); }
            else if (act === 'sample') { setMine({ on: false }); say('견본 글로 돌렸어요 · 넣은 글은 남아 있어요', 2400); }
            else if (act === 'clear') { setMine({ text: '', on: false }); say('넣은 글을 지웠어요', 2400); }
            draw(); box.querySelector(`[data-mine="${act}"]`)?.focus(); return;
        }
        if (!who || who === 'text') return;
        const tb = e.target.closest('[data-tab]');
        if (tb) { tab[who] = tb.dataset.tab; srcOpen[who] = false; draw(); const el = box.querySelector(`[data-tab="${tb.dataset.tab}"]`); el?.focus({ preventScroll: true }); el?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); return; }
        if (e.target.closest('[data-src-toggle]')) { srcOpen[who] = !srcOpen[who]; draw(); box.querySelector('[data-src-toggle]')?.focus(); return; }
        const go = e.target.closest('[data-world]'); if (go) { e.preventDefault(); openWorld?.(go.dataset.world); return; }
        const off = e.target.closest('[data-pick]');
        if (off) { pick(who, off.dataset.pick); draw(); box.querySelector(`[data-pick="${off.dataset.pick}"]`)?.focus(); return; }
        const p = e.target.closest('[data-color]');
        if (p) { pick(who, p.dataset.color, p.dataset.name || ''); draw(); box.querySelector('.mart-cast-pane [data-color][aria-pressed="true"]')?.focus({ preventScroll: true }); }
    });
    // 색 단추: 고르는 동안 색 원 · 색 값 글자를 따라 바꿔요
    box.addEventListener('input', (e) => {
        const c = e.target.closest?.('.mart-cast-color input[type=color]'); if (!c) return;
        const wrap = c.closest('.mart-cast-color');
        wrap.querySelector('.mart-cast-swatch').style.background = c.value;
        wrap.querySelector('.mart-cast-hex').textContent = c.value;
    });
    box.addEventListener('change', (e) => {
        const pr = e.target.closest('input[name=bl-paper]'); if (pr) { setTone({ paper: pr.value }); draw(); box.querySelector('input[name=bl-paper]:checked')?.focus(); return; }
        const tr = e.target.closest('input[name=bl-texture]'); if (tr) { setTone({ texture: tr.value }); draw(); box.querySelector('input[name=bl-texture]:checked')?.focus(); return; }
        const cv = e.target.closest('input[data-cover]');   // 11-12 밤 맨 아래 「소품까지 캐릭터 색」(예전 머리 줄 「캐릭터 색 덮어쓰기」 칩)
        if (cv) { setTone({ cover: cv.checked }); say(toneState.cover ? '캐릭터 색으로 소품까지 덮어써요' : '소품은 기본 색 그대로 · 글 쪽만 캐릭터 색이에요', 2400); draw(); box.querySelector('input[data-cover]')?.focus(); }
    });
    box.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target, saved = rememberCast(f.name.value, f.color.value);
        if (!saved) { say('이름과 색을 넣어 주세요', 2400); return; }
        const other = who === 'other';
        setTone(other ? { k2: saved.color, name2: saved.name } : { on: true, k: saved.color, name: saved.name });
        tab[other ? 'other' : 'main'] = 'direct'; draw();
        say(`「${saved.name}」을 기억하고 ${other ? '깡캐' : '깡통'}로 골랐어요 · 다음에도 「직접」 탭 맨 위에 있어요`, 3000);
    });
    box.addEventListener('paste', (e) => {
        if (e.target.closest('.mart-mine-text')) {   // 내 글: 글은 그대로 칸에 들어가고(기본 붙여 넣기) · 대사색이 든 서식이면 깡통 · 깡캐 색도 · 바로 내 글로
            const dt = e.clipboardData || globalThis.clipboardData, html = dt?.getData('text/html') || '', plain = dt?.getData('text/plain') || '';
            if (html) useColors(html, plain, () => {});
            setTimeout(() => { const ta = box.querySelector('.mart-mine-text'); if (ta?.value.trim()) { const info = setMine({ text: ta.value, on: true }); draw(); say(info?.lines ? `내 글로 바꿨어요 · 대사 ${info.dialogue}줄` : '글에서 넣을 줄을 못 찾았어요', 2800); box.querySelector('.mart-mine-text')?.focus(); } }, 0);
            return;
        }
        if (!e.target.closest('.mart-cast-paste')) return;
        const dt = e.clipboardData || globalThis.clipboardData;
        const html = dt?.getData('text/html') || '', text = dt?.getData('text/plain') || '';
        e.preventDefault();
        const found = useColors(html || text, text, say);
        if (!found) say('대사 색을 못 찾았어요 · 실리태번 화면에서 대사가 든 부분을 골라 복사해 주세요', 3600);
        else { tab.main = startTab('main'); tab.other = null; }
        draw();
    });
    document.addEventListener('bl-tone-change', () => { if (!box.contains(document.activeElement)) draw(); });
    draw();
}

/**
 * 11-11 화자 배정 바꾸기(테마 시식 「화자 바꾸기」 꼴) — 깡통(첫째 화자) ↔ 깡캐(둘째 화자)의 캐릭터 · 색을 맞바꿔요.
 *   한쪽이 「원래 색」이면 그대로 자리만 바뀌어요(깡통이 원래 색이 되면 틀이 정해 둔 색). 둘 다 원래 색이면 알려만 줘요.
 */
export function swapSpeakers(say = () => {}) {
    const a = toneState.on && toneState.k ? { k: toneState.k, name: toneState.name } : null;
    const b = toneState.k2 ? { k: toneState.k2, name: toneState.name2 } : null;
    if (!a && !b) { say('깡통 · 깡캐 색을 먼저 골라요 · 둘 다 원래 색이면 바꿀 게 없어요', 2600); return false; }
    setTone({ on: !!b, k: b?.k || null, name: b?.name || '', k2: a?.k || null, name2: a?.name || '' });
    say(`깡통 「${b?.name || '원래 색'}」 · 깡캐 「${a?.name || '원래 색'}」로 바꿨어요`, 2400);
    return true;
}
/** 붙여 넣은 HTML 의 대사색으로 캐릭터 고르기 — 아는 색이면 그 이름, 모르면 글 속 이름(첫 「이름:」)으로 기억 · 대사색이 둘 이상이면 둘째 색은 깡캐로. 고른 색 | null */
export function useColors(html, text = '', say = () => {}) {
    const colors = dialogueColors(html);
    if (!colors.length) return null;
    const top = colors[0].color;
    const known = castList().find(x => same(x.color, top));
    const names = namesIn(text || String(html).replace(/<[^>]+>/g, '\n'));
    let name = known?.name;
    if (!name) {
        name = names[0] || '붙여 넣은 색';
        rememberCast(name, top);
    }
    const next = { on: true, k: top, name };
    // 둘째 대사색 → 깡캐(둘째 화자): 아는 색이면 그 이름, 모르면 글 속 다른 이름(있을 때만 기억)
    const second = colors[1]?.color;
    let name2 = '';
    if (second) {
        const known2 = castList().find(x => same(x.color, second));
        name2 = known2?.name || names.find(n => n !== name) || '';
        if (!known2 && name2) rememberCast(name2, second);
        Object.assign(next, { k2: second, name2 });
    }
    setTone(next);
    say(`대사색 ${top} — 깡통 「${name}」${second ? ` · ${second} — 깡캐${name2 ? ` 「${name2}」` : ''}` : ''}로 칠했어요${colors.length > 2 ? ` · 다른 대사색 ${colors.length - 2}개도 있었어요` : ''}`, 3600);
    return top;
}
