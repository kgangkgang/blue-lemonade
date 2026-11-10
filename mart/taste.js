// 글꾸 마트 「🍽️ 시식하기」 창 — 글꾸 상세 창(크게 보기 시트)에서 열어요. 큰 글칸에 채팅 로그를 붙여 넣으면 해석(taste-parse.js)해서 고른 글꾸 틀에 끼워 미리보기(taste-render.js · 테마 모듈 사본)로 보여 주고,
//   「📋 HTML 복사」(깡싸 글쓰기 HTML 칸에 붙이는 완성 HTML) · 「⬇ 내려받기」(.html)로 가져가요. 창 위 칩: 깡통 · 나로 추정한 이름(고칠 수 있어요) · 「🔁 바꾸기」 하나로 뒤집어요.
//   틀 머리 칸은 제목 · 날짜 · 알약(깡통 · 모델 · 프롬프트 — 비우면 표본 값)이에요 · 11-07 「보일 것」 칩(제목 · 알약 · 위 글 · 아래 글 빼기 — 위 · 아래 글은 틀에 박힌 머리 표 · 꼬리말)(머리 칸은 localStorage 에 오래 남아요). 그 밖의 글씨(틀에 박힌 머리 · 꼬리 · 장식 글 · 로그의 이름 · 문장)는 미리보기에서 눌러 그 자리에서 고쳐요(글이 든 요소에만 contenteditable · 붙여 넣기는 글만 · Enter 는 <br>) —
//   고친 것은 HTML 복사 · 내려받기에 그대로 들어가요. 「↶ 되돌리기 · ↷ 다시하기」는 미리보기 HTML 스냅샷(연속 타자는 0.5초 묶음 · 50개까지 · 새로 그리기 · 바꾸기도 한 칸)으로 블록 통째 삭제도 되살려요.
//   붙여 넣은 글 · 바꾸기 · 제목 · 날짜 · 마지막 미리보기 상태는 이 탭 안(sessionStorage)에 남아요. 스크립트 없는 결과 · 외부 의존 없음. 마트 공용 시트 · 단추 규격(mart.css .mart-sheet · .mart-actions)을 써요.
import { parseLog, buildModel, DEFAULT_NAMES } from './taste-parse.js';
import { tasteHtml, tasteDocument, canTaste, isConcept, conceptReady, loadConcept, shutPeek } from './taste-render.js?v=20261110w';
import { withInks, setInk, resetInks, paintDot, syncInks } from './inks.js?v=20261108a';
import { kkangtongReady } from './tone-geulkku.js?v=20261110v';   // 11-10 깡통에 붙일 꼴(인라인 url( → <style> · 글자색 fill)
import { toneOut } from './tone-state.js?v=20261111b';
import { useColors } from './cast.js?v=20261111b';                 // 11-10 붙여 넣은 채팅 HTML 의 대사색으로 캐릭터 고르기             // 11-10 고른 대사색으로 다시 칠하기   // 11-08 글자색 팔레트   // 11-07 판 꼬리표: 옛 캐시와 섞이지 않게

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** 그릴 수 있는 틀인지 — 받은 글꾸(틈 템플릿 template) · 테마 로그 복사 기본 틀(shape · 내장) · 11-07 받아 둔 일러스트 컨셉(concept-*) */
const drawable = canTaste;
/** 일러스트 컨셉 그리기 모듈을 받고 나면 시식 창 · 카드 미리보기를 다시 그려요 */
function needConcept(item, after) {
    if (!isConcept(item) || conceptReady()) return false;
    loadConcept().then(() => { after?.(); document.dispatchEvent(new CustomEvent('bl-taste-change')); }, () => { after?.(true); });
    return true;
}
const KEY = 'bl-mart-taste-v1';
const SNAP_MAX = 50, SNAP_WAIT = 500;
const MODE_LABEL = { names: '「이름:」 줄로 나눴어요', screen: '실리태번 화면 복사로 읽었어요', alternate: '이름이 없어 빈 줄마다 번갈아 나눴어요' };
export const SAMPLE = `세라피나: 창밖으로 숲 바람이 스며들었다. 세라피나는 식은 찻잔을 내려놓고 **천천히** 고개를 들었다.
"깨어났네요. 상처는 거의 다 아물었어요."
*그녀가 손끝으로 이마를 짚었다.* 『다행이다… 숲이 이 사람을 받아 주었어.』
여행자: 여기가 어디예요? 숲에서 길을 잃은 것까지는 기억나는데.
세라피나: 「엘도리아 숲 안쪽, 제 오두막이에요.」 세라피나가 창문을 조금 더 열었다.
여행자: "고마워요." 차 냄새가 좋네요.`;
const PLACEHOLDER = `채팅 로그를 붙여 넣어요.

이름: 글  ← 줄 앞에 「이름:」 이 있으면 그 이름으로 나눠요
이름이 없으면 빈 줄마다 번갈아 깡통 · 나로 봐요.
실리태번 화면에서 그대로 복사한 글(이름 줄 · 시간 줄 · 본문)도 돼요.
"대사" · *행동* · 『속마음』 · **강조** 표기를 알아봐요.`;

// 머리 칸(제목 · 깡통 · 모델 · 프롬프트 알약 · 알약 빼기)은 로그와 달리 이 브라우저에 오래 남겨요(localStorage) — 모델 · 프롬프트는 잘 안 바뀌어서
const HEAD_KEY = 'bl-mart-mylog-head-v1';
/** 머리 칸 표본 값 — 마트 카드 표본(테마 tools/mart/sample.mjs FIELDS)과 같아요. 비운 칸은 이 값을 써서 머리가 비지 않아요 */
export const HEAD_SAMPLE = { title: 'Title', char: '세라피나', model: 'Argon', prompt: '천사깡' };
const HEAD_KEYS = ['title', 'char', 'model', 'prompt'];
export const headStore = {
    load() { try { const v = JSON.parse(localStorage.getItem(HEAD_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } },
    save(data) { try { localStorage.setItem(HEAD_KEY, JSON.stringify(data)); } catch { /* 저장이 막힌 창 — 이 창에서만 */ } },
};
/** 로그에서 찾은 깡통 이름(이름 없이 붙여 넣어 「깡통」 기본 이름이면 빈 글) — 깡통 알약 칸을 비웠을 때 표본 이름보다 먼저 써요 */
export const charOf = model => { const name = String(model?.charName ?? '').trim(); return name && name !== DEFAULT_NAMES[0] ? name : ''; };
/** 그릴 머리 칸 — 비운 칸은 표본 값(깡통은 로그의 깡통 이름 먼저) · 알약 빼기면 알약(LOG · 깡통 · 모델 · 프롬프트)만 빼고 제목은 늘 남아 머리 칸이 비지 않아요 */
export function headFields(head = {}, date = '', charName = '') {
    const pick = key => String(head[key] ?? '').trim() || (key === 'char' && charName) || HEAD_SAMPLE[key];
    // 11-07 제목 · 알약 빼기는 칸을 비우지 않고 그린 뒤 걷어요(cutOf drop — 칸만 비우면 그 칸을 담던 머리 박스가 빈 채로 남았어요)
    return { title: pick('title'), date: String(date ?? ''), mark: 'LOG', char: pick('char'), model: pick('model'), prompt: pick('prompt') };
}
// 11-07 「보일 것」 칩(사용자 「위 아래 글자들 … 부가적인 것들 빼는 것도 다 버튼 · 완전 심플」 — 테마 1.0.7 로그 복사 창과 같은 칩): 켬 = 보여요
const HIDES = ['hideTitle', 'hidePills', 'hideTop', 'hideBottom'];
const SHOW_LABEL = { hideTitle: '제목', hidePills: '알약', hideTop: '위 글', hideBottom: '아래 글' };
/** 위 글 · 아래 글 빼기(테마 log-copy-bare.js 사본이 틀에 박힌 머리 표 · 부제 · 도장 · 꼬리말 · 서명을 걷어요) */
export const cutOf = head => ({ top: !!head?.hideTop, bottom: !!head?.hideBottom, drop: [...(head?.hideTitle ? ['title'] : []), ...(head?.hidePills ? ['mark', 'char', 'model', 'prompt'] : [])] });
/** 머리 칸 서명 — 그 자리에서 고친 미리보기(edit)가 지금 머리 칸으로 그린 것인지 견줘요 */
const headSig = head => JSON.stringify([...HEAD_KEYS.map(k => String(head?.[k] ?? '').trim()), ...HIDES.map(k => !!head?.[k])]);
/** 저장된 머리 칸(예전 판이 이 탭에 남긴 제목도 이어받아요) */
const loadHead = saved => { const h = headStore.load(); return { title: h.title ?? saved?.fields?.title ?? '', char: h.char ?? '', model: h.model ?? '', prompt: h.prompt ?? '', ...Object.fromEntries(HIDES.map(k => [k, !!h[k]])) }; };

let dialog = null, state = null;
export const store = {
    load() { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } },
    save(data) { try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 저장이 막힌 창 — 이 창에서만 */ } },
};
const persist = () => {
    if (!state) return;
    const prev = store.load();
    const sig = headSig(state.head);
    const edit = state.item && state.html ? { id: state.item.id, html: state.html, head: sig } : (prev.edit?.id && prev.text === state.text && prev.edit.head === sig ? prev.edit : null);
    headStore.save({ ...state.head });
    store.save({ ...prev, text: state.text, swap: state.swap, fields: { date: state.fields.date ?? '' }, names: state.names, showNames: state.showNames, edit });
    document.dispatchEvent(new CustomEvent('bl-taste-change'));   // 「📝 내 로그로 보기」(mart.js)가 카드 미리보기를 다시 그려요
};
// ── 「📝 내 로그로 보기」: 같은 로그(sessionStorage)로 글꾸 하나를 그려요 — 카드 미리보기 · 카드 HTML 복사가 써요(mart.js). 시식 창에서 그 자리에서 고친 것이 있으면 그걸 먼저 ──
let parsedCache = { text: null, parsed: null };
/** 이름 줄을 보일지 — 토글을 안 건드렸으면(null) 「이름:」 · 실리태번 복사 로그는 보이고, 이름 없이 붙여 넣은 로그는 빼요 */
export const namesOn = (showNames, parsed) => (typeof showNames === 'boolean' ? showNames : parsed?.mode !== 'alternate');
export function hasLog() { const saved = store.load(); return !!String(saved.text ?? '').trim(); }
export function renderWithLog(item) {
    const saved = store.load();
    const text = String(saved.text ?? '');
    if (!text.trim()) return '';
    if (!drawable(item)) { needConcept(item); return ''; }   // 11-07 일러스트 컨셉: 모듈을 받으면 카드를 다시 그려요(bl-taste-change)
    const head = loadHead(saved);
    if (saved.edit?.id === item.id && saved.edit.html && saved.edit.head === headSig(head)) return saved.edit.html;
    if (parsedCache.text !== text) parsedCache = { text, parsed: parseLog(text) };
    if (!parsedCache.parsed.turns.length) return '';
    try { const model = buildModel(parsedCache.parsed, { swap: !!saved.swap, names: saved.names ?? {} }); return tasteHtml(withInks(item), model, headFields(head, saved.fields?.date, charOf(model)), { names: namesOn(saved.showNames, parsedCache.parsed), ...cutOf(head) }); } catch { return ''; }
}

// ── 미리보기 그 자리에서 고치기 ──
const HAS_LETTER = /[\p{L}\p{N}]/u;
/** 글이 직접 든 요소에만 contenteditable · 글 없는 장식(그림 · 이모지 · 움직이는 조각)은 그 안에서 못 고치게(contenteditable=false) */
export function markEditable(root) {
    for (const el of root.querySelectorAll('*')) {
        if (/^(STYLE|SCRIPT|BR)$/.test(el.tagName)) continue;
        const own = [...el.childNodes].some(n => n.nodeType === 3 && HAS_LETTER.test(n.data));
        if (own) { el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); }
        else if (el.closest('[contenteditable="true"]') && !el.querySelector('[contenteditable="true"]') && !HAS_LETTER.test(el.textContent || '')) el.setAttribute('contenteditable', 'false');
    }
}
/** 미리보기 DOM → 내보낼 HTML(편집 표시만 걷어요 · 댓글 · 움직임 <style> 그대로) */
export const exportOf = root => root.innerHTML.replace(/ contenteditable="(?:true|false|plaintext-only)"/g, '').replace(/ spellcheck="false"/g, '');

const hist = { stack: [], at: -1, timer: 0 };
function pushSnap() {
    const html = state.preview.innerHTML;
    if (hist.stack[hist.at] === html) return;
    hist.stack.length = hist.at + 1;
    hist.stack.push(html);
    if (hist.stack.length > SNAP_MAX) hist.stack.shift();
    hist.at = hist.stack.length - 1;
    afterChange();
}
function flushSnap() { if (hist.timer) { clearTimeout(hist.timer); hist.timer = 0; pushSnap(); } }
function afterChange() {
    state.html = state.model && drawable(state.item) ? exportOf(state.preview) : '';
    sync();
    persist();
    if (globalThis.martTaste) globalThis.martTaste.html = state.html;   // 시험(?mart-test)에서 결과를 읽어요
}
/** 미리보기에 HTML 을 놓고(편집 표시 달기) 스냅샷 한 칸 */
function show(html) {
    state.preview.innerHTML = html;
    markEditable(state.preview);
    state.preview.scrollTop = 0;
    flushSnap();
    pushSnap();
}
function travel(dir) {
    flushSnap();
    const next = hist.at + dir;
    if (next < 0 || next >= hist.stack.length) return;
    hist.at = next;
    state.preview.innerHTML = hist.stack[next];
    markEditable(state.preview);
    afterChange();
}
function resetHist() { clearTimeout(hist.timer); hist.timer = 0; hist.stack = []; hist.at = -1; }

function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'mart-sheet mart-taste';
    dialog.setAttribute('aria-labelledby', 'mart-taste-title');
    dialog.innerHTML = `<header class="mart-sheet-head"><span class="mart-sheet-grip" aria-hidden="true"></span><div class="mart-sheet-name"><h2 id="mart-taste-title"></h2><div class="mart-sheet-meta"><p class="mart-desc">채팅 로그를 붙여 넣으면 이 글꾸에 끼워 보여 줘요. 미리보기 글씨는 눌러서 바로 고치고, 그대로 복사해 깡싸 글쓰기 HTML 칸에 붙여요.</p></div></div><button type="button" class="ibtn x mart-sheet-x" data-taste="close" aria-label="닫기"></button></header>
<div class="mart-sheet-body mart-taste-body">
  <div class="mart-taste-in">
    <textarea class="mart-taste-text" rows="6" spellcheck="false" aria-label="채팅 로그" placeholder="${esc(PLACEHOLDER)}"></textarea>
    <div class="mart-taste-roles" role="group" aria-label="누가 깡통이고 누가 나인지">
      <label class="mart-taste-chip is-char"><span class="em" aria-hidden="true">🤖</span>깡통<input type="text" class="mart-taste-name" data-side="char" maxlength="24" aria-label="깡통 이름"><small class="mart-taste-more"></small></label>
      <button type="button" class="btn mart-taste-swap" data-taste="swap" title="깡통 · 나를 뒤집어요"><span class="em" aria-hidden="true">🔁</span>바꾸기</button>
      <label class="mart-taste-chip is-user"><span class="em" aria-hidden="true">🙂</span>나<input type="text" class="mart-taste-name" data-side="user" maxlength="24" aria-label="내 이름"></label>
      <button type="button" class="chip mart-taste-names" data-taste="names" aria-pressed="true" title="메시지마다 이름 줄을 보일지 — 끄면 본문만(간격은 그대로)">이름 보이기</button>
      <button type="button" class="btn mart-taste-sample" data-taste="sample">표본 글 넣기</button>
      <small class="mart-taste-mode" aria-live="polite"></small>
    </div>
    <div class="mart-taste-headbar"><small class="mart-taste-head-note">머리 칸 — 비워 두면 흐린 글씨(표본 값)가 들어가요</small></div>
    <div class="mart-taste-shows" role="group" aria-label="보일 것 — 빼면 완전 심플해요"><button type="button" class="chip mart-taste-show" data-taste="show" data-hide="hideTitle" aria-pressed="true" title="틀 머리의 제목">제목 보이기</button><button type="button" class="chip mart-taste-pills mart-taste-show" data-taste="show" data-hide="hidePills" aria-pressed="true" title="제목 아래 알약(깡통 · 모델 · 프롬프트)">알약 보이기</button><button type="button" class="chip mart-taste-show" data-taste="show" data-hide="hideTop" aria-pressed="true" title="첫 메시지 위의 틀 글(머리 표 · 부제 · 능력치 칩 · 도장 …) — 제목 · 알약은 따로">위 글 보이기</button><button type="button" class="chip mart-taste-show" data-taste="show" data-hide="hideBottom" aria-pressed="true" title="마지막 메시지 아래의 틀 글(꼬리말 · 서명 · 보낸 이 …)">아래 글 보이기</button></div>
    <div class="mart-taste-inks"></div>
    <div class="mart-taste-fields">
      <label class="is-wide">제목 <input type="text" class="field" data-head="title" maxlength="80" placeholder="${esc(HEAD_SAMPLE.title)}"></label>
      <label class="is-wide">날짜 <input type="text" class="field" data-field="date" maxlength="60" placeholder="비우면 없음"></label>
      <label class="is-pill">깡통 <input type="text" class="field" data-head="char" maxlength="40" placeholder="${esc(HEAD_SAMPLE.char)}" aria-label="깡통 알약"></label>
      <label class="is-pill">모델 <input type="text" class="field" data-head="model" maxlength="40" placeholder="${esc(HEAD_SAMPLE.model)}" aria-label="모델 알약"></label>
      <label class="is-pill is-last">프롬프트 <input type="text" class="field" data-head="prompt" maxlength="40" placeholder="${esc(HEAD_SAMPLE.prompt)}" aria-label="프롬프트 알약"></label>
    </div>
  </div>
  <div class="mart-taste-bar"><span class="mart-taste-hint"><span class="em" aria-hidden="true">✏️</span> 미리보기 글씨를 눌러 바로 고쳐요</span><button type="button" class="btn" data-taste="undo" title="되돌리기 (지운 블록도 돌아와요)"><span aria-hidden="true">↶</span>되돌리기</button><button type="button" class="btn" data-taste="redo" title="다시하기"><span aria-hidden="true">↷</span>다시하기</button></div>
  <div class="mart-sheet-preview mart-taste-preview" aria-label="미리보기 — 글씨를 눌러 고쳐요"></div>
</div>
<footer class="mart-sheet-foot"></footer>`;
    document.body.append(dialog);
    const area = dialog.querySelector('.mart-taste-text');
    const preview = dialog.querySelector('.mart-taste-preview');
    let timer = 0;
    area.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.text = area.value; state.names = {}; state.showNames = null; parse(); }, 220); });   // 새 글은 이름 줄 기본값도 새로
    // 11-10 실리태번 화면에서 복사한 채팅이면 대사 글자색(인라인 color)을 읽어 그 캐릭터 색으로 칠해요 — 글 칸에는 글만 그대로 들어가요
    area.addEventListener('paste', (e) => {
        const dt = e.clipboardData || globalThis.clipboardData;
        const html = dt?.getData('text/html') || '';
        if (html) useColors(html, dt.getData('text/plain') || '', state?.say || (() => {}));
    });
    let inkTimer = 0;
    dialog.addEventListener('input', (e) => {
        const t = e.target;
        if (t.matches('[data-ink]')) { paintDot(t); clearTimeout(inkTimer); const item = state?.item; inkTimer = setTimeout(() => setInk(item, t.dataset.ink, t.value), 150); return; }   // 11-08 글자색(색 고르기를 움직이는 동안 0.15초 묶음)
        if (t.matches('[data-field]')) { state.fields[t.dataset.field] = t.value; schedule(); }
        else if (t.matches('[data-head]')) { state.head[t.dataset.head] = t.value; schedule(); }
        else if (t.matches('.mart-taste-name')) { const i = t.dataset.side === 'user' ? userIndex() : charIndex(); if (i >= 0) state.names[i] = t.value; schedule(); }
        else if (preview.contains(t) || t === preview) { clearTimeout(hist.timer); hist.timer = setTimeout(() => { hist.timer = 0; pushSnap(); }, SNAP_WAIT); }   // 연속 타자는 0.5초 묶음
    });
    // 붙여 넣기는 글만(서식 · 태그 없이) · Enter 는 줄바꿈 <br>(문단 <div> 가 생기지 않게)
    preview.addEventListener('paste', (e) => {
        if (!e.target.closest?.('[contenteditable="true"]')) return;
        e.preventDefault();
        const text = (e.clipboardData || globalThis.clipboardData)?.getData('text/plain') ?? '';
        if (text) document.execCommand('insertText', false, text.replace(/\r\n?/g, '\n'));
    });
    preview.addEventListener('keydown', (e) => {
        if (!e.target.closest?.('[contenteditable="true"]')) return;
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); document.execCommand('insertHTML', false, '<br>'); }
        else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); travel(-1); }
        else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); travel(1); }
    });
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) { dialog.close(); return; }
        if (e.target.closest('[data-ink-reset]')) { if (state?.item) resetInks(state.item); return; }
        const b = e.target.closest('[data-taste]'); if (!b) return;
        const act = b.dataset.taste;
        if (act === 'close') dialog.close();
        else if (act === 'swap') { state.swap = !state.swap; render(); }
        else if (act === 'sample') { area.value = SAMPLE; state.text = SAMPLE; state.names = {}; state.showNames = null; parse(); }
        else if (act === 'names') { state.showNames = !namesOn(state.showNames, state.parsed); render(); }   // 새로 그리니 스냅샷 한 칸
        else if (act === 'show' && HIDES.includes(b.dataset.hide)) { state.head[b.dataset.hide] = !state.head[b.dataset.hide]; render(); }   // 11-07 보일 것 칩(새로 그리니 스냅샷 한 칸)
        else if (act === 'copy') copy();
        else if (act === 'download') download();
        else if (act === 'undo') travel(-1);
        else if (act === 'redo') travel(1);
        else if (act === 'apply') { flushSnap(); persist(); state.onApply?.(); dialog.close(); }
        else if (act === 'off') { state.onOff?.(); dialog.close(); }
    });
    dialog.addEventListener('close', () => { flushSnap(); persist(); preview.replaceChildren(); resetHist(); state.back?.focus?.({ preventScroll: true }); });
}

const userIndex = () => state.model?.roles.userAt ?? -1;
const charIndex = () => state.model?.roles.names.findIndex((_, i) => i !== userIndex()) ?? -1;
let scheduled = 0;
function schedule() { clearTimeout(scheduled); scheduled = setTimeout(render, 120); }
function parse() { state.parsed = parseLog(state.text); render(); }
/** 칩 · 안내 줄(미리보기는 안 건드려요) */
function paintRoles() {
    const parsed = state.parsed;
    const mode = dialog.querySelector('.mart-taste-mode');
    const charIn = dialog.querySelector('[data-side="char"]'), userIn = dialog.querySelector('[data-side="user"]'), more = dialog.querySelector('.mart-taste-more');
    const roles = state.model?.roles;
    const ci = charIndex(), ui = userIndex();
    if (document.activeElement !== charIn) charIn.value = roles ? (ci >= 0 ? roles.names[ci] : '') : '';
    if (document.activeElement !== userIn) userIn.value = roles ? (ui >= 0 ? roles.names[ui] : '') : '';
    charIn.disabled = !roles || ci < 0; userIn.disabled = !roles || ui < 0;
    more.textContent = roles && roles.chars.length > 1 ? ` · ${roles.chars.slice(1).join(' · ')}` : '';
    mode.textContent = state.model ? `${MODE_LABEL[parsed.mode]} · 메시지 ${state.model.messages.length}개` : '';
    const on = namesOn(state.showNames, parsed);
    const namesBtn = dialog.querySelector('[data-taste="names"]');
    namesBtn.setAttribute('aria-pressed', String(on)); namesBtn.textContent = on ? '이름 보이기' : '이름 빼기';   // 켬 ✔ 는 aria-pressed 로 CSS 가 namesBtn.disabled = !state.model;
    // 머리 칸: 깡통 알약의 흐린 안내는 로그에서 찾은 깡통 이름(없으면 표본) · 알약을 빼면 알약 세 칸은 쉬어요
    for (const btn of dialog.querySelectorAll('[data-taste="show"]')) { const on = !state.head[btn.dataset.hide]; btn.setAttribute('aria-pressed', String(on)); btn.textContent = `${SHOW_LABEL[btn.dataset.hide]} ${on ? '보이기' : '빼기'}`; }
    const pills = !state.head.hidePills;
    dialog.querySelector('[data-head="char"]').placeholder = charOf(state.model) || HEAD_SAMPLE.char;
    for (const key of ['char', 'model', 'prompt']) dialog.querySelector(`[data-head="${key}"]`).disabled = !pills;
    dialog.querySelector('[data-head="title"]').disabled = !!state.head.hideTitle;
}
/** 그릴 머리 칸(제목 · 날짜 · 알약) */
const drawFields = () => headFields(state.head, state.fields.date, charOf(state.model));
/** 로그 · 바꾸기 · 제목 · 날짜 · 틀에서 미리보기를 새로 그려요(그 자리에서 고친 것은 되돌리기 칸에 남아요) */
function render() {
    if (!state || !dialog) return;
    state.model = state.parsed.turns.length ? buildModel(state.parsed, { swap: state.swap, names: state.names }) : null;
    paintRoles();
    if (state.setup) { sync(); return; }   // 「📝 내 로그로 보기」 설정 창은 미리보기 없이 글 · 역할 · 제목 · 날짜만
    const preview = state.preview;
    if (!state.model || !drawable(state.item)) {
        flushSnap();
        preview.innerHTML = `<p class="mart-sheet-wait">${!drawable(state.item) ? '틀을 받는 중이에요…' : '로그를 붙여 넣으면 여기에 글꾸에 끼운 모양이 나와요'}</p>`;
        state.html = ''; sync();
        return;
    }
    try { show(toneOut(state.item, tasteHtml(withInks(state.item), state.model, drawFields(), { names: namesOn(state.showNames, state.parsed), ...cutOf(state.head) }))); }   // 11-10 고른 대사색으로
    catch (error) { preview.innerHTML = `<p class="mart-sheet-wait">못 그렸어요 · ${esc(error.message)}</p>`; state.html = ''; sync(); }
}
document.addEventListener('bl-tone-change', () => { if (state && dialog?.open && !state.setup) render(); });   // 11-10 캐릭터를 바꾸면 시식 미리보기도
function sync() {
    if (state.setup) { dialog.querySelector('[data-taste="apply"]').disabled = !state.model; return; }
    for (const b of dialog.querySelectorAll('.mart-sheet-foot button')) b.disabled = !state.html;
    dialog.querySelector('[data-taste="undo"]').disabled = hist.at <= 0;
    dialog.querySelector('[data-taste="redo"]').disabled = hist.at >= hist.stack.length - 1;
}
const FOOT_TASTE = '<div class="mart-actions is-geulkku is-taste"><button type="button" class="btn" data-taste="download" title="완성 HTML 을 .html 파일로 받아요"><span aria-hidden="true">⬇</span>내려받기</button><button type="button" class="btn primary" data-taste="copy" title="깡싸 글쓰기 HTML 칸에 붙이는 완성 HTML(미리보기 그대로 · 고친 글씨 포함)"><span class="em" aria-hidden="true">📋</span>HTML 복사</button></div>';
const footSetup = on => `<div class="mart-actions is-geulkku is-taste is-setup">${on ? '<button type="button" class="btn" data-taste="off" title="카드 미리보기를 다시 표본 글로">끄기 — 표본 글로</button>' : ''}<button type="button" class="btn primary" data-taste="apply"><span class="em" aria-hidden="true">📝</span>내 로그로 보기</button></div><p class="mart-taste-foot-note">목록의 카드 미리보기와 카드 「📋 HTML 복사」가 전부 이 로그로 그려져요 · 분류 · 디자인 칩을 바꿔도 그대로예요</p>`;

async function copy() {
    flushSnap();
    const html = kkangtongReady(shutPeek(state.html)); if (!html) return;   // 11-09 미리보기로만 펼친 상자는 닫아서 복사 · 11-10 깡통에 붙일 꼴
    const done = () => state.say?.('복사됐어요 · 깡싸 글쓰기 HTML 칸에 붙여요', 3600);
    try {
        if (globalThis.ClipboardItem && navigator.clipboard?.write) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([html], { type: 'text/plain' }) })]);
        else await navigator.clipboard.writeText(html);
        done();
    } catch {
        // 대체(권한 막힘 · 오래된 폰): 숨은 글 칸을 골라 복사
        const area = Object.assign(document.createElement('textarea'), { value: html, readOnly: true });
        area.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px;font-size:16px';
        dialog.append(area); area.focus(); area.select(); area.setSelectionRange(0, html.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { /* 아래 */ }
        area.remove();
        if (ok) done(); else state.say?.('복사가 막혔어요 · 「⬇ 내려받기」로 받아 주세요', 3600);
    }
}
function download() {
    flushSnap();
    const html = kkangtongReady(shutPeek(state.html)); if (!html) return;   // 11-09 내려받기도 복사와 같게 닫힌 채 · 11-10 깡통에 붙일 꼴
    const name = String(state.item.name || state.item.label || '글꾸').replace(/[\\/:*?"<>|#%]+/g, '').replace(/\s+/g, '-');
    const blob = new Blob([tasteDocument(html, `${state.item.name || state.item.label} · 시식`)], { type: 'text/html' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `글꾸-시식-${name}.html`, hidden: true });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    state.say?.('받았어요 · 열면 복사한 것과 같은 모양이에요', 3200);
}

/**
 * 시식 창 열기 — mart.js 가 상세 창에서 불러요.
 * @param {{ item: object }|null} cardState 글꾸 카드 상태(item 에 template 이 없으면 ready 로 받아요) · null 이면 「📝 내 로그로 보기」 설정 창(미리보기 없이 로그 · 역할 · 제목 · 날짜만)
 * @param {{ ready?: Promise<object>, say?: (text: string, ms?: number) => void, text?: string, swap?: boolean, fields?: object, on?: boolean, onApply?: () => void, onOff?: () => void }} [options]
 */
export async function openTaste(cardState, { ready = null, say = null, text, swap, fields, on = false, onApply = null, onOff = null, glyph = null } = {}) {
    if (!dialog) build();
    const saved = store.load();
    const setup = !cardState;
    const head = loadHead(saved);
    if (String(fields?.title ?? '').trim()) head.title = fields.title;   // 시험(?taste-title=)이 준 제목
    state = { item: cardState?.item ?? null, setup, onApply, onOff, say, back: document.activeElement, preview: dialog.querySelector('.mart-taste-preview'), text: text ?? saved.text ?? '', swap: swap ?? !!saved.swap, fields: { date: (fields?.date || saved.fields?.date) ?? '' }, head, names: {}, showNames: null, parsed: null, model: null, html: '' };
    if (text === undefined && saved.text === state.text) { if (saved.names && typeof saved.names === 'object') state.names = { ...saved.names }; if (typeof saved.showNames === 'boolean') state.showNames = saved.showNames; }
    const item = state.item;
    resetHist();
    dialog.classList.toggle('is-setup', setup);
    dialog.querySelector('.mart-sheet-foot').innerHTML = setup ? footSetup(on) : FOOT_TASTE;
    // 창 제목: 시식하기 — (그 글꾸 틀의 아이콘 · 없으면 이모지) 이름 — 아이콘은 mart.js 가 glyph 로 넘겨요
    dialog.querySelector('#mart-taste-title').innerHTML = setup ? '<span class="em" aria-hidden="true">📝</span><span>내 로그로 보기</span>' : `<span class="em" aria-hidden="true">🍽️</span><span>시식하기 —</span>${glyph ? glyph(item) : item.emoji ? `<span class="em" aria-hidden="true">${esc(item.emoji)}</span>` : ''}<span>${esc(item.name || item.label)}</span>`;
    dialog.querySelector('.mart-desc').textContent = setup ? '로그를 한 번 넣어 두면 목록을 넘기며 글꾸마다 내 로그가 끼워진 모습을 바로 보고 복사해요. 크게 보기의 시식하기도 같은 로그를 써요.' : '채팅 로그를 붙여 넣으면 이 글꾸에 끼워 보여 줘요. 미리보기 글씨는 눌러서 바로 고치고, 그대로 복사해 깡싸 글쓰기 HTML 칸에 붙여요.';
    dialog.querySelector('.mart-taste-text').value = state.text;
    for (const input of dialog.querySelectorAll('[data-field]')) input.value = state.fields[input.dataset.field] ?? '';
    for (const input of dialog.querySelectorAll('[data-head]')) input.value = state.head[input.dataset.head] ?? '';
    state.parsed = parseLog(state.text);
    dialog.querySelector('.mart-taste-inks').replaceChildren();
    if (!setup) syncInks(dialog.querySelector('.mart-taste-inks'), item);   // 11-08 글자색 칩(틀을 아직 안 받았으면 받은 뒤에)
    // 같은 글꾸 · 같은 로그를 다시 열면 마지막 미리보기(그 자리에서 고친 것)부터 — 아니면 새로 그려요
    const keep = !setup && text === undefined && saved.edit?.id === item.id && saved.edit.html && saved.edit.head === headSig(state.head) && saved.text === state.text && drawable(item);
    if (keep) { state.model = buildModel(state.parsed, { swap: state.swap, names: state.names }); paintRoles(); show(saved.edit.html); }
    else render();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.mart-sheet-body').scrollTop = 0;
    (state.text && !setup ? dialog.querySelector('.mart-sheet-x') : dialog.querySelector('.mart-taste-text')).focus({ preventScroll: true });
    if (!setup && !drawable(item) && ready) {
        const mine = state;
        try { await ready; } catch { if (state === mine) state.preview.innerHTML = '<p class="mart-sheet-wait">틀을 못 받았어요 · 잠시 뒤 다시 열어 주세요</p>'; return; }
        if (state === mine) { syncInks(dialog.querySelector('.mart-taste-inks'), state.item); render(); }
    }
    // 11-07 일러스트 컨셉(concept-*)은 자료를 받은 뒤에도 그리는 모듈이 더 필요해요 — 받으면 다시 그리고, 못 받으면 그렇다고 알려요
    if (!setup && state.item && !drawable(state.item)) {
        const mine = state;
        needConcept(state.item, (failed) => { if (state !== mine) return; if (failed) state.preview.innerHTML = '<p class="mart-sheet-wait">틀을 못 받았어요 · 잠시 뒤 다시 열어 주세요</p>'; else render(); });
    }
}
/** 시험(?mart-test) — 결과 HTML · 해석 결과를 밖에서 읽고, 미리보기 편집을 흉내 내요: [['edit', 찾을 글, 새 글], ['clear', 찾을 글], ['undo'], ['redo']] */
export const tasteTest = {
    get state() { return state; }, parseLog, buildModel, tasteHtml,
    run(steps) {
        const preview = state.preview;
        const find = (needle) => [...preview.querySelectorAll('[contenteditable="true"]')].find(el => [...el.childNodes].some(n => n.nodeType === 3 && n.data.includes(needle)));
        for (const [act, a, b] of steps) {
            if (act === 'edit') { const el = find(a); const node = el && [...el.childNodes].find(n => n.nodeType === 3 && n.data.includes(a)); if (node) { node.data = node.data.replace(a, b); el.dispatchEvent(new Event('input', { bubbles: true })); flushSnap(); } }
            else if (act === 'clear') { const el = find(a); if (el) { el.remove(); preview.dispatchEvent(new Event('input', { bubbles: true })); flushSnap(); } }   // 블록 통째 삭제
            else if (act === 'undo') travel(-1);
            else if (act === 'redo') travel(1);
        }
        return state.html;
    },
};

// 11-08 글자색 팔레트: 바꾼 색으로 표본 글(카드 · 상세 창 미리보기 · 카드 HTML 복사)을 그려요 — 마트 빌드 미리보기와 같은 표본 글 · 머리 칸
let sampleModel = null;
export function sampleHtml(item) {
    if (!drawable(item)) return '';
    sampleModel ||= buildModel(parseLog(SAMPLE));
    try { return tasteHtml(withInks(item), sampleModel, headFields(HEAD_SAMPLE, '', charOf(sampleModel)), { names: true }); } catch { return ''; }
}
document.addEventListener('bl-inks-change', (e) => {
    if (!dialog?.open || !state || state.setup || state.item?.id !== e.detail?.id) return;
    syncInks(dialog.querySelector('.mart-taste-inks'), state.item);
    render();
});
