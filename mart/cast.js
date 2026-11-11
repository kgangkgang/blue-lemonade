// 11-10 글꾸 마트 목록 위 한 줄 「깡통: 원래 색 ▾ · 깡캐: 원래 색 ▾」(11-11 칸 둘 — 깡통 = 첫째 화자 · 깡캐 = 둘째 화자) — 펼쳐서 캐릭터를 고르면 그 자리에서 목록의 글꾸가 전부 그 대사색으로 다시 칠해져요(tone-state.js · 고른 것은 기억).
//   사용자 「가브리엘 글꾸 누르고 그안에서 글꾸 디자인고르는거지」 · 「그냥 장르별로 캐릭터고를수있게하돼 너무 캐릭터창이길어지지않게 꺽쇠라디오목록식으로하는게」
//   - 묶음(내 캐릭터 · 천지합동청 · D&H · 무협시뮬 · 센티넬버스 · 캐릭터 없음 / 직접 색)마다 꺽쇠 머리(▸/▾) + 라디오 목록(색 점 · 이름 · 하나만).
//   - 처음엔 고른 캐릭터가 든 묶음만 펴요. 머리에는 그 묶음에서 고른 캐릭터의 색 점 · 이름이 보여서 접어도 알 수 있어요.
//   - 「채팅 붙여 넣어 대사색 찾기」: 실리태번 화면에서 복사한 채팅을 붙이면 대사 글자색(인라인 color)을 읽어 그 캐릭터를 골라요.
//   - 밤 · 낮: 틀 바탕.
import { toneState, setTone, savedCast, CAST_GROUPS, castList, rememberCast, forgetCast, PAPER_COLORS, TEXTURES, MIX_ENABLED } from './tone-state.js?v=20261111p';
/** 11-11 「바탕(종이 색 · 질감)」 칸은 화면에서 숨겨요 — 새 글꾸 틀에는 안 걸려 눌러도 바뀌는 게 없어서요(코드 · 자료는 그대로 · 나중에 격자 · 질감을 한꺼번에 되살릴 때 true) */
const PAPER_ENABLED = false;
import { dialogueColors } from './tone-geulkku.js?v=20261110v';
import { mineOn, mineText, mineInfo, setMine } from './mine-text.js?v=20261111p';   // 11-11 「내 글 넣기」 — 붙여 넣은 내 글로 모든 카드를 그려요

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
const colorField = value => `<label class="mart-cast-color" title="색 고르기"><input type="color" name="color" value="${esc(value)}" aria-label="대사색"><i class="mart-ink-dot mart-cast-swatch" style="background:${esc(value)}" aria-hidden="true"></i><span class="mart-cast-hex">${esc(value)}</span></label>`;

export function mountCast(box, { say = () => {} } = {}) {
    if (!box) return;
    // 11-11 칸이 둘이에요 — 「깡통: ● 이름」(첫째 화자 색) · 「깡캐: ● 이름」(둘째 화자 색). 칸을 누르면 그 칸의 목록이 펼쳐져요(한 번에 하나)
    const open = { main: new Set(), other: new Set() }, first = { main: true, other: true };
    let who = null, paperOpen = false;   // 11-10 처음엔 한 줄만 — 누르면 세계관 묶음이 펼쳐져요(사용자 「누구 로그예요?가먼저나오는게맞나...?」 → 목록이 먼저)
    /** 11-11 「내 글」 칸: 붙여 넣으면 모든 카드가 내 글로(테마 · 예전 마트 「📝 내 로그로 보기」처럼) · 「견본 글로」 되돌리기 · 「지우기」 · 이 브라우저에 기억 */
    const textPanel = () => {
        const info = mineInfo(), on = mineOn();
        const status = on ? `내 글로 보는 중 · 화자 ${esc(info.names.slice(0, 3).join(' · '))}${info.names.length > 3 ? ` 외 ${info.names.length - 3}` : ''} · 대사 ${info.dialogue}줄${info.cut ? ' · 길어서 앞부분만 넣었어요' : ''}` : mineText().trim() ? '넣어 둔 글이 있어요 · 「내 글로 보기」를 누르면 카드가 바뀌어요' : '견본 글로 보는 중';
        return `<div class="mart-cast-panel" id="mart-cast-panel" data-who="text"><p class="mart-cast-who"><b>내 글</b>을 붙여 넣으면 모든 카드가 내 글로 바뀌어요 · 「이름: 대사」 줄 · 실리태번 화면에서 복사한 채팅 · 그냥 글 모두 돼요 · 대사색이 있으면 깡통 · 깡캐 색도 찾아요</p>
            <textarea class="field mart-mine-text" rows="4" maxlength="200000" placeholder="여기에 붙여 넣어요" aria-label="내 글">${esc(mineText())}</textarea>
            <div class="mart-tune-line mart-hscroll mart-mine-btns"><button type="button" class="btn" data-mine="apply">내 글로 보기</button><button type="button" class="chip" data-mine="sample" aria-pressed="${!on}">견본 글로</button><button type="button" class="chip" data-mine="clear">지우기</button></div>
            <p class="mart-mine-info" role="status">${status}</p></div>`;
    };
    const draw = () => {
        const panel = !!who, w = who === 'text' ? 'main' : who || 'main', other = w === 'other', on = onOf(w), radioName = other ? 'bl-cast2' : 'bl-cast';
        const list = groups(w), opened0 = open[w];
        if (panel && who !== 'text' && first[w]) { opened0.add(groupOfSelection(list, w)); first[w] = false; }
        const head = (g) => {
            const pick = g.tail ? (other ? (toneState.k2 ? null : { name: '원래 색' }) : toneState.on ? (toneState.k ? null : { name: '캐릭터 없음' }) : { name: '원래 색' }) : g.cast.find(on);
            const showPick = g.tail ? pick && groupOfSelection(list, w) === 'none' : !!pick;
            return `<button type="button" class="mart-cast-g" data-group="${g.id}" aria-expanded="${opened0.has(g.id)}" aria-controls="mart-cast-${g.id}"><span class="mart-cast-caret" aria-hidden="true">${opened0.has(g.id) ? '▾' : '▸'}</span>${esc(g.label)}${showPick ? `<span class="mart-cast-pick">${pick.color ? `<i class="mart-ink-dot" style="background:${esc(pick.color)}"></i>` : ''}${esc(pick.name)}</span>` : ''}</button>`;
        };
        const radio = (g, x) => `<label class="mart-cast-r"><input type="${toneState.mix && !other ? 'checkbox' : 'radio'}" name="${radioName}" value="${esc(x.color)}" data-name="${esc(x.name)}"${on(x) ? ' checked' : ''}><i class="mart-ink-dot" style="background:${esc(x.color)}" aria-hidden="true"></i><span>${esc(x.name)}</span>${x.saved ? `<button type="button" class="mart-cast-x" data-forget="${esc(x.name)}" aria-label="${esc(x.name)} 잊기" title="기억에서 빼요">×</button>` : ''}</label>`;
        const form = value => `<form class="mart-cast-form"><label class="field-wrap"><input type="text" class="field" name="name" maxlength="20" placeholder="이름" aria-label="캐릭터 이름" required></label>${colorField(value)}<button type="submit" class="btn">기억하고 고르기</button></form>`;
        const body = (g) => {
            if (!opened0.has(g.id)) return '';
            if (g.tail && other) {
                return `<div class="mart-cast-list" id="mart-cast-${g.id}" role="radiogroup" aria-label="${esc(g.label)}">
                    <label class="mart-cast-r is-wide"><input type="radio" name="bl-cast2" value="off" data-name=""${!toneState.k2 ? ' checked' : ''}><i class="is-off" aria-hidden="true"></i><span>원래 색(틀마다 정해 둔 색)</span></label>
                    ${form(toneState.k2 || '#ff5fa2')}</div>`;
            }
            if (g.tail) {
                return `<div class="mart-cast-list" id="mart-cast-${g.id}" role="radiogroup" aria-label="${esc(g.label)}">
                    <label class="mart-cast-r is-wide"><input type="radio" name="bl-cast" value="off" data-name=""${!toneState.on ? ' checked' : ''}><i class="is-off" aria-hidden="true"></i><span>원래 색(틀마다 정해 둔 색)</span></label>
                    <label class="mart-cast-r is-wide"><input type="radio" name="bl-cast" value="" data-name=""${toneState.on && !toneState.k ? ' checked' : ''}><i class="is-none" aria-hidden="true"></i><span>캐릭터 없음(무채)</span></label>
                    ${form(toneState.k || '#3aa7ff')}
                    <label class="mart-cast-paste"><span>채팅 붙여 넣어 대사색 찾기 · 대사색이 둘이면 둘째는 깡캐로</span><textarea class="field" rows="1" placeholder="실리태번 화면에서 복사한 채팅을 붙여 넣어요" aria-label="채팅 붙여 넣기"></textarea></label></div>`;
            }
            return `<div class="mart-cast-list" id="mart-cast-${g.id}" role="radiogroup" aria-label="${esc(g.label)}">${g.cast.map(x => radio(g, x)).join('')}</div>`;
        };
        const opened = list.filter(g => opened0.has(g.id));
        const picks = toneState.mix ? toneState.picks : [];
        const now = !toneState.on ? { name: '원래 색' } : picks.length >= 2 ? { name: picks.map(p => p.name || p.color).join(' + '), dots: picks.map(p => p.color) } : toneState.k ? { name: toneState.name || toneState.k, dots: [toneState.k] } : { name: '없음', dots: [] };
        const now2 = toneState.k2 ? { name: toneState.name2 || toneState.k2, dots: [toneState.k2] } : { name: '원래 색', dots: [] };
        const dotsOf = n => (n.dots || []).map(c => `<i class="mart-ink-dot" style="background:${esc(c)}" aria-hidden="true"></i>`).join('');
        const toggle = (id, label, n) => `<button type="button" class="mart-cast-toggle" data-toggle="${id}" aria-expanded="${who === id}" aria-controls="mart-cast-panel"><span>${label}:</span>${dotsOf(n)}<b>${esc(n.name)}</b><span class="mart-cast-caret" aria-hidden="true">${who === id ? '▴' : '▾'}</span></button>`;
        const pc = PAPER_COLORS[toneState.paper] || PAPER_COLORS.white, tx = TEXTURES[toneState.texture] || TEXTURES.plain;
        const sw = id => { const p = PAPER_COLORS[id][toneState.mode === 'light' ? 'light' : 'dark']; return `background:${p[0]};box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)`; };
        const paperPanel = PAPER_ENABLED && paperOpen ? `<div class="mart-cast-panel" id="mart-paper-panel"><div class="mart-cast-sub2">종이 색</div><div class="mart-cast-list" role="radiogroup" aria-label="종이 색">${Object.entries(PAPER_COLORS).map(([id, p]) => `<label class="mart-cast-r"><input type="radio" name="bl-paper" value="${id}"${id === toneState.paper ? ' checked' : ''}><i class="mart-ink-dot" style="${sw(id)}" aria-hidden="true"></i><span>${esc(p.label)}</span></label>`).join('')}</div><div class="mart-cast-sub2">질감</div><div class="mart-cast-list" role="radiogroup" aria-label="질감">${Object.entries(TEXTURES).filter(([, t]) => !t.hidden).map(([id, t]) => `<label class="mart-cast-r"><input type="radio" name="bl-texture" value="${id}"${id === toneState.texture ? ' checked' : ''}><span>${esc(t.label)}</span></label>`).join('')}</div></div>` : '';
        box.innerHTML = `<div class="mart-cast-head"><span class="mart-cast-slots">${toggle('main', '깡통', now)}${toggle('other', '깡캐', now2)}${toggle('text', '내 글', { name: mineOn() ? '넣음' : '견본', dots: [] })}</span>${MIX_ENABLED ? `<button type="button" class="chip mart-cast-mix" data-mix aria-pressed="${toneState.mix}" title="캐릭터를 2~3명 골라 포인트 색을 그라데이션으로 섞어요">혼합</button>` : ''}${PAPER_ENABLED ? `<button type="button" class="mart-cast-toggle" data-paper aria-expanded="${paperOpen}" aria-controls="mart-paper-panel"><span>바탕:</span><i class="mart-ink-dot" style="${sw(toneState.paper)}" aria-hidden="true"></i><b>${esc(pc.label)} · ${esc(tx.label)}</b><span class="mart-cast-caret" aria-hidden="true">${paperOpen ? '▴' : '▾'}</span></button>` : ''}<span class="mart-seg mart-cast-mode" role="group" aria-label="밤낮"><button type="button" class="chip" data-mode="dark" aria-pressed="${toneState.mode === 'dark'}">밤</button><button type="button" class="chip" data-mode="light" aria-pressed="${toneState.mode === 'light'}">낮</button></span></div>
            ${who === 'text' ? textPanel() : `<div class="mart-cast-panel" id="mart-cast-panel" data-who="${w}"${panel ? '' : ' hidden'}><p class="mart-cast-who">${other ? '<b>깡캐</b>(둘째 화자) 색을 골라요 · 안 고르면 틀마다 정해 둔 색 그대로예요' : '<b>깡통</b>(첫째 화자) 색을 골라요 · 소품 색도 이 색을 따라가요'}</p><div class="mart-cast-groups">${list.map(head).join('')}</div>${opened.map(body).join('')}</div>${paperPanel}`}`;
    };
    box.addEventListener('click', (e) => {
        const x = e.target.closest('[data-forget]'); if (x) { e.preventDefault(); forgetCast(x.dataset.forget); draw(); return; }
        const m = e.target.closest('[data-mode]'); if (m) { setTone({ mode: m.dataset.mode }); draw(); return; }
        if (MIX_ENABLED && e.target.closest('[data-mix]')) { const on = !toneState.mix; setTone({ mix: on, picks: on ? (toneState.k ? [{ name: toneState.name, color: toneState.k }] : []) : toneState.picks }); if (on) { who = 'main'; say('캐릭터를 2~3명 골라요 · 포인트 색이 그라데이션으로 섞여요', 3000); } draw(); return; }
        if (e.target.closest('[data-paper]')) { paperOpen = !paperOpen; draw(); box.querySelector('[data-paper]')?.focus(); return; }
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
        const g = e.target.closest('[data-group]');
        if (g && who) { const id = g.dataset.group, set = open[who]; if (set.has(id)) set.delete(id); else set.add(id); draw(); box.querySelector(`[data-group="${id}"]`)?.focus(); }
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
        const cb = e.target.closest('input[type=checkbox][name=bl-cast]');
        if (cb) {   // 혼합: 최대 3명 · 넷째를 고르면 가장 먼저 고른 사람이 빠져요
            let picks = toneState.picks.filter(p => !(same(p.color, cb.value) && p.name === cb.dataset.name));
            if (cb.checked) picks = [...picks, { name: cb.dataset.name, color: cb.value }].slice(-3);
            setTone({ on: true, picks, k: picks[0]?.color || null, name: picks[0]?.name || '' });
            draw(); return;
        }
        const r2 = e.target.closest('input[type=radio][name=bl-cast2]');
        if (r2) {   // 깡캐(둘째 화자): 원래 색이면 틀이 정해 둔 색 그대로
            setTone(r2.value === 'off' ? { k2: null } : { k2: r2.value, name2: r2.dataset.name || '' });
            draw(); box.querySelector('input[name=bl-cast2]:checked')?.focus(); return;
        }
        const r = e.target.closest('input[type=radio][name=bl-cast]'); if (!r) return;
        if (r.value === 'off') setTone({ on: false });
        else setTone({ on: true, k: r.value || null, name: r.dataset.name || '' });
        draw();
        box.querySelector('input[name=bl-cast]:checked')?.focus();
    });
    box.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target, saved = rememberCast(f.name.value, f.color.value);
        if (!saved) { say('이름과 색을 넣어 주세요', 2400); return; }
        const other = who === 'other';
        setTone(other ? { k2: saved.color, name2: saved.name } : { on: true, k: saved.color, name: saved.name });
        open[other ? 'other' : 'main'].add('mine'); draw();
        say(`「${saved.name}」을 기억하고 ${other ? '깡캐' : '깡통'}로 골랐어요 · 다음에도 「내 캐릭터」에 있어요`, 3000);
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
        else { open.main.clear(); open.main.add(groupOfSelection(groups('main'), 'main')); open.other.clear(); first.other = true; }
        draw();
    });
    document.addEventListener('bl-tone-change', () => { if (!box.contains(document.activeElement)) draw(); });
    draw();
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
