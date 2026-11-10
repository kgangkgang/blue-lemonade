// 11-10 글꾸 마트 목록 위 한 줄 「캐릭터: 없음 ▾」 — 펼쳐서 캐릭터를 고르면 그 자리에서 목록의 글꾸가 전부 그 대사색으로 다시 칠해져요(tone-state.js · 고른 것은 기억).
//   사용자 「가브리엘 글꾸 누르고 그안에서 글꾸 디자인고르는거지」 · 「그냥 장르별로 캐릭터고를수있게하돼 너무 캐릭터창이길어지지않게 꺽쇠라디오목록식으로하는게」
//   - 묶음(내 캐릭터 · 천지합동청 · D&H · 무협시뮬 · 센티넬버스 · 기타 · 캐릭터 없음 / 직접 색)마다 꺽쇠 머리(▸/▾) + 라디오 목록(색 점 · 이름 · 하나만).
//   - 처음엔 고른 캐릭터가 든 묶음만 펴요. 머리에는 그 묶음에서 고른 캐릭터의 색 점 · 이름이 보여서 접어도 알 수 있어요.
//   - 「채팅 붙여 넣어 대사색 찾기」: 실리태번 화면에서 복사한 채팅을 붙이면 대사 글자색(인라인 color)을 읽어 그 캐릭터를 골라요.
//   - 밤 · 낮: 틀 바탕.
import { toneState, setTone, savedCast, CAST_GROUPS, castList, rememberCast, forgetCast, PAPER_COLORS, TEXTURES, MIX_ENABLED } from './tone-state.js?v=20261111b';
/** 11-11 「바탕(종이 색 · 질감)」 칸은 화면에서 숨겨요 — 새 글꾸 틀에는 안 걸려 눌러도 바뀌는 게 없어서요(코드 · 자료는 그대로 · 나중에 격자 · 질감을 한꺼번에 되살릴 때 true) */
const PAPER_ENABLED = false;
import { dialogueColors } from './tone-geulkku.js?v=20261110v';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const namesIn = text => [...new Set(String(text || '').split(/\n/).map(l => (l.match(/^\s*([^\s:：]{1,20})\s*[:：]/) || [])[1]).filter(Boolean))];

/** 지금 보일 묶음들 */
function groups() {
    const saved = savedCast();
    return [
        ...(saved.length ? [{ id: 'mine', label: '내 캐릭터', sub: '이 브라우저에 기억', cast: saved.map(x => ({ ...x, saved: true })) }] : []),
        ...CAST_GROUPS,
        { id: 'none', label: '캐릭터 없음 · 직접 색', sub: '', cast: [], tail: true },
    ];
}
const isPicked = x => toneState.picks.some(p => same(p.color, x.color) && p.name === x.name);
const isOn = x => toneState.on && (toneState.mix ? isPicked(x) : same(toneState.k, x.color) && (!toneState.name || toneState.name === x.name));
const groupOfSelection = list => {
    if (!toneState.on || !toneState.k) return 'none';
    return (list.find(g => g.cast.some(isOn)) || list.find(g => g.cast.some(x => same(x.color, toneState.k))))?.id || 'none';
};

export function mountCast(box, { say = () => {} } = {}) {
    if (!box) return;
    const open = new Set();
    let first = true, panel = false, paperOpen = false;   // 11-10 처음엔 「캐릭터: 없음 ▾」 한 줄만 — 누르면 세계관 묶음이 펼쳐져요(사용자 「누구 로그예요?가먼저나오는게맞나...?」 → 목록이 먼저)
    const draw = () => {
        const list = groups();
        if (first) { open.add(groupOfSelection(list)); first = false; }
        const head = (g) => {
            const pick = g.tail ? (toneState.on ? (toneState.k ? null : { name: '캐릭터 없음' }) : { name: '원래 색' }) : g.cast.find(isOn);
            const showPick = g.tail ? pick && groupOfSelection(list) === 'none' : !!pick;
            return `<button type="button" class="mart-cast-g" data-group="${g.id}" aria-expanded="${open.has(g.id)}" aria-controls="mart-cast-${g.id}"><span class="mart-cast-caret" aria-hidden="true">${open.has(g.id) ? '▾' : '▸'}</span>${esc(g.label)}${showPick ? `<span class="mart-cast-pick">${pick.color ? `<i class="mart-ink-dot" style="background:${esc(pick.color)}"></i>` : ''}${esc(pick.name)}</span>` : ''}</button>`;
        };
        const radio = (g, x) => `<label class="mart-cast-r"><input type="${toneState.mix ? 'checkbox' : 'radio'}" name="bl-cast" value="${esc(x.color)}" data-name="${esc(x.name)}"${isOn(x) ? ' checked' : ''}><i class="mart-ink-dot" style="background:${esc(x.color)}" aria-hidden="true"></i><span>${esc(x.name)}</span>${x.saved ? `<button type="button" class="mart-cast-x" data-forget="${esc(x.name)}" aria-label="${esc(x.name)} 잊기" title="기억에서 빼요">×</button>` : ''}</label>`;
        const body = (g) => {
            if (!open.has(g.id)) return '';
            if (g.tail) {
                return `<div class="mart-cast-list" id="mart-cast-${g.id}" role="radiogroup" aria-label="${esc(g.label)}">
                    <label class="mart-cast-r"><input type="radio" name="bl-cast" value="off" data-name=""${!toneState.on ? ' checked' : ''}><i class="is-off" aria-hidden="true"></i><span>원래 색(틀마다 정해 둔 색)</span></label>
                    <label class="mart-cast-r"><input type="radio" name="bl-cast" value="" data-name=""${toneState.on && !toneState.k ? ' checked' : ''}><i class="is-none" aria-hidden="true"></i><span>캐릭터 없음(무채)</span></label>
                    <form class="mart-cast-form"><label class="field-wrap"><input type="text" class="field" name="name" maxlength="20" placeholder="이름" aria-label="캐릭터 이름" required></label><input type="color" name="color" value="${esc(toneState.k || '#3aa7ff')}" aria-label="대사색"><button type="submit" class="btn">기억하고 고르기</button></form>
                    <label class="mart-cast-paste"><span>채팅 붙여 넣어 대사색 찾기</span><textarea class="field" rows="1" placeholder="실리태번 화면에서 복사한 채팅을 붙여 넣어요" aria-label="채팅 붙여 넣기"></textarea></label></div>`;
            }
            return `<div class="mart-cast-list" id="mart-cast-${g.id}" role="radiogroup" aria-label="${esc(g.label)}">${g.cast.map(x => radio(g, x)).join('')}</div>`;
        };
        const opened = list.filter(g => open.has(g.id));
        const picks = toneState.mix ? toneState.picks : [];
        const now = !toneState.on ? { name: '원래 색' } : picks.length >= 2 ? { name: picks.map(p => p.name || p.color).join(' + '), dots: picks.map(p => p.color) } : toneState.k ? { name: toneState.name || toneState.k, dots: [toneState.k] } : { name: '없음', dots: [] };
        const dots = (now.dots || []).map(c => `<i class="mart-ink-dot" style="background:${esc(c)}" aria-hidden="true"></i>`).join('');
        const pc = PAPER_COLORS[toneState.paper] || PAPER_COLORS.white, tx = TEXTURES[toneState.texture] || TEXTURES.plain;
        const sw = id => { const p = PAPER_COLORS[id][toneState.mode === 'light' ? 'light' : 'dark']; return `background:${p[0]};box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)`; };
        const paperPanel = PAPER_ENABLED && paperOpen ? `<div class="mart-cast-panel" id="mart-paper-panel"><div class="mart-cast-sub2">종이 색</div><div class="mart-cast-list" role="radiogroup" aria-label="종이 색">${Object.entries(PAPER_COLORS).map(([id, p]) => `<label class="mart-cast-r"><input type="radio" name="bl-paper" value="${id}"${id === toneState.paper ? ' checked' : ''}><i class="mart-ink-dot" style="${sw(id)}" aria-hidden="true"></i><span>${esc(p.label)}</span></label>`).join('')}</div><div class="mart-cast-sub2">질감</div><div class="mart-cast-list" role="radiogroup" aria-label="질감">${Object.entries(TEXTURES).filter(([, t]) => !t.hidden).map(([id, t]) => `<label class="mart-cast-r"><input type="radio" name="bl-texture" value="${id}"${id === toneState.texture ? ' checked' : ''}><span>${esc(t.label)}</span></label>`).join('')}</div></div>` : '';
        box.innerHTML = `<div class="mart-cast-head"><button type="button" class="mart-cast-toggle" data-toggle aria-expanded="${panel}" aria-controls="mart-cast-panel"><span>캐릭터:</span>${dots}<b>${esc(now.name)}</b><span class="mart-cast-caret" aria-hidden="true">${panel ? '▴' : '▾'}</span></button>${MIX_ENABLED ? `<button type="button" class="chip mart-cast-mix" data-mix aria-pressed="${toneState.mix}" title="캐릭터를 2~3명 골라 포인트 색을 그라데이션으로 섞어요">혼합</button>` : ''}${PAPER_ENABLED ? `<button type="button" class="mart-cast-toggle" data-paper aria-expanded="${paperOpen}" aria-controls="mart-paper-panel"><span>바탕:</span><i class="mart-ink-dot" style="${sw(toneState.paper)}" aria-hidden="true"></i><b>${esc(pc.label)} · ${esc(tx.label)}</b><span class="mart-cast-caret" aria-hidden="true">${paperOpen ? '▴' : '▾'}</span></button>` : ''}<span class="mart-seg mart-cast-mode" role="group" aria-label="밤낮"><button type="button" class="chip" data-mode="dark" aria-pressed="${toneState.mode === 'dark'}">밤</button><button type="button" class="chip" data-mode="light" aria-pressed="${toneState.mode === 'light'}">낮</button></span></div>
            <div class="mart-cast-panel" id="mart-cast-panel"${panel ? '' : ' hidden'}><div class="mart-cast-groups">${list.map(head).join('')}</div>${opened.map(body).join('')}</div>${paperPanel}`;
    };
    box.addEventListener('click', (e) => {
        const x = e.target.closest('[data-forget]'); if (x) { e.preventDefault(); forgetCast(x.dataset.forget); draw(); return; }
        const m = e.target.closest('[data-mode]'); if (m) { setTone({ mode: m.dataset.mode }); draw(); return; }
        if (MIX_ENABLED && e.target.closest('[data-mix]')) { const on = !toneState.mix; setTone({ mix: on, picks: on ? (toneState.k ? [{ name: toneState.name, color: toneState.k }] : []) : toneState.picks }); if (on) { panel = true; say('캐릭터를 2~3명 골라요 · 포인트 색이 그라데이션으로 섞여요', 3000); } draw(); return; }
        if (e.target.closest('[data-paper]')) { paperOpen = !paperOpen; draw(); box.querySelector('[data-paper]')?.focus(); return; }
        if (e.target.closest('[data-toggle]')) { panel = !panel; draw(); box.querySelector('[data-toggle]')?.focus(); return; }
        const g = e.target.closest('[data-group]');
        if (g) { const id = g.dataset.group; if (open.has(id)) open.delete(id); else open.add(id); draw(); box.querySelector(`[data-group="${id}"]`)?.focus(); }
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
        setTone({ on: true, k: saved.color, name: saved.name });
        open.add('mine'); draw();
        say(`「${saved.name}」을 기억했어요 · 다음에도 「내 캐릭터」에 있어요`, 3000);
    });
    box.addEventListener('paste', (e) => {
        if (!e.target.closest('.mart-cast-paste')) return;
        const dt = e.clipboardData || globalThis.clipboardData;
        const html = dt?.getData('text/html') || '', text = dt?.getData('text/plain') || '';
        e.preventDefault();
        const found = useColors(html || text, text, say);
        if (!found) say('대사 색을 못 찾았어요 · 실리태번 화면에서 대사가 든 부분을 골라 복사해 주세요', 3600);
        else { open.clear(); open.add(groupOfSelection(groups())); }
        draw();
    });
    document.addEventListener('bl-tone-change', () => { if (!box.contains(document.activeElement)) draw(); });
    draw();
}

/** 붙여 넣은 HTML 의 대사색으로 캐릭터 고르기 — 아는 색이면 그 이름, 모르면 글 속 이름(첫 「이름:」)으로 기억. 고른 색 | null */
export function useColors(html, text = '', say = () => {}) {
    const colors = dialogueColors(html);
    if (!colors.length) return null;
    const top = colors[0].color;
    const known = castList().find(x => same(x.color, top));
    let name = known?.name;
    if (!name) {
        const names = namesIn(text || String(html).replace(/<[^>]+>/g, '\n'));
        name = names[0] || '붙여 넣은 색';
        rememberCast(name, top);
    }
    setTone({ on: true, k: top, name });
    say(`대사색 ${top} — 「${name}」로 칠했어요${colors.length > 1 ? ` · 다른 대사색 ${colors.length - 1}개도 있었어요` : ''}`, 3600);
    return top;
}
