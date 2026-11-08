// 블루 레몬에이드 마트 — 전시 · 담기(장바구니 · cart.js) · 하나만 바로 복사. 데이터는 data/*.json(테마 저장소 tools/mart-build.mjs 산출물).
// 심플 액자는 테마 frame-presets.js 사본으로 브라우저에서 바로 그리고(색 · 글자 · 비율을 바꿔 본 값 그대로 받아요), 그림 액자는 썸네일 + 받기 파일.
// 받는 것은 코드가 아니라 데이터예요: { "bl-mart": 1, "items": [...] } — 테마 설정 「마트에서 가져오기」가 검사하고 넣어요.
// 글꾸는 나눠 받아요: 가벼운 목록 data/geulkku/index.json 만 먼저 받고, 미리보기 · 받기 칸은 그림체 × 분류 조각을 카드가 보일 때 · 누를 때 받아요.
const kind = document.body.dataset.mart;              // 'frames' | 'geulkku'
const grid = document.querySelector('.mart-grid');
const search = document.querySelector('.mart-tools input[type=search]');
const chips = document.querySelector('.mart-chips');
import { cart, say, onCheckout, artName, saveArt } from './cart.js?v=20261109a';
import { lemonHtml, lemonize } from './lemon.js?v=20261109a';   // 11-09 레몬 하나 — 🍋 대신 테마와 같은 레몬 그림(lemon.svg)
import { inkChanged, colorsOf, setInk, resetInks, inksHtml, paintDot, syncInks } from './inks.js?v=20261108a';   // 11-08 글꾸 글자색 팔레트
import './colorpop.js?v=20261108c';   // 11-08 색 칸을 누르면 테마와 같은 색 고르기(폰 기본 창 대신)
let styleActive = 'all', drawPreset = null, picker = null;
const states = [];   // 만든 카드만(글꾸) — 늦게 만들기(lazyGrid)라 처음엔 첫 화면 몫뿐이에요
const stateById = new Map();
let allItems = [], cards = null;   // 글꾸 목록 전부 · 카드 늦게 만들기(lazyGrid)

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const asset = p => new URL(p, import.meta.url).href;   // data/… 는 mart/ 기준
const where = kind === 'frames' ? '장식 액자 › 보관함' : '로그 복사 › 내 글꾸';
const KIND_LABEL = { frame: '그림 액자', 'frame-preset': '심플 액자', geulkku: '글꾸' };
// ── 공용 부품: 거르기 세그(액자 마트 방향 · 그림체 · 글꾸 마트 그림체 — 같은 모양 mart.css .mart-seg · 같은 동작) ──
const segHtml = (options, on) => options.map(([id, label]) => `<button type="button" class="chip" data-v="${esc(id)}" aria-pressed="${id === on}">${esc(label)}</button>`).join('');
/** 세그 하나를 고르면 그 버튼만 눌림 · onPick(값) */
function wireSeg(group, onPick) {
    group.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b || !group.contains(b)) return;
        for (const x of group.children) x.setAttribute('aria-pressed', String(x === b));
        onPick(b.dataset.v);
    });
}
// ── 공용 부품: 카드 늦게 만들기 — 글꾸 · 액자 마트가 같이 써요(11-05 · 1343 + 1292종에서 첫 로딩이 두 배로 느려져서) ──
//   거른 목록(list) 가운데 첫 화면 몫(first)만 카드로 만들고, 나머지 자리는 빈 칸(.mart-spacer · 남은 줄 수 × 줄 높이)으로 잡아 두어 스크롤 막대가 튀지 않아요.
//   빈 칸이 화면 가까이(margin) 오면 다음 묶음(step)을 그 앞에 붙여요 — IntersectionObserver 하나. 만든 카드는 build 쪽이 들고 있다가 다시 걸러질 때 그대로 써요.
//   set(list): 거르기 · 찾기 · 탭을 바꿀 때 · reveal(item): 그 항목까지 만들어 두기(#id 로 굴러 갈 때) · list: 지금 거른 목록
const LAZY_FIRST = 24, LAZY_STEP = 24;
function lazyGrid(gridEl, build, { first = LAZY_FIRST, step = LAZY_STEP, margin = '1000px 0px' } = {}) {
    let list = [], shown = 0;
    const spacer = document.createElement('div');
    spacer.className = 'mart-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    const cols = () => { const t = getComputedStyle(gridEl).gridTemplateColumns; return t && t !== 'none' ? t.trim().split(/\s+/).length : 1; };
    const size = () => {
        const left = list.length - shown;
        spacer.hidden = left <= 0;
        if (left <= 0) { spacer.style.height = ''; return; }
        const first = gridEl.querySelector('.mart-card');
        const gap = parseFloat(getComputedStyle(gridEl).rowGap) || 0, n = cols(), made = Math.ceil(shown / n);
        const row = first && made ? (spacer.offsetTop - first.offsetTop) / made : 400;   // 만든 줄들의 평균 높이(사이 틈 포함)
        const rows = Math.ceil(list.length / n) - made;   // 남은 줄(마지막 덜 찬 줄은 빈 칸 앞에서 채워져요)
        spacer.style.height = `${Math.max(0, rows * row - gap)}px`;
    };
    const io = 'IntersectionObserver' in globalThis ? new IntersectionObserver((seen) => { if (seen.some(e => e.isIntersecting)) grow(); }, { rootMargin: margin }) : null;
    const watch = () => { if (!io) return; io.unobserve(spacer); if (shown < list.length) io.observe(spacer); };   // 다시 지켜보면 바로 한 번 알려 줘요 — 아직 가까우면 한 묶음 더
    const add = n => { const next = list.slice(shown, shown + n); if (next.length) spacer.before(...next.map(build)); shown += next.length; };
    function grow() { if (shown >= list.length) return; add(step); size(); watch(); }
    addEventListener('resize', () => { if (list.length) size(); });
    return {
        set(next) { list = next; shown = 0; gridEl.replaceChildren(spacer); add(io ? first : list.length); size(); watch(); },
        reveal(item) { const i = list.indexOf(item); if (i < 0) return false; if (i >= shown) { add(i + 1 - shown); size(); watch(); } return true; },
        get list() { return list; },
    };
}
// ── 공용 부품: 분류 두 단계 — 묶음 탭 한 줄(.mart-groups) + 하위 칩 한 줄(.mart-chips · 폰은 가로로 밀어 봐요 · PC 는 펼침) ──
// 글꾸 · 액자 마트가 같이 써요(mart.css). cats: [{ id, label, n, group }] · groups: [{ id, label }] — 쓰는 묶음이 둘 미만이면 탭 줄을 숨겨요.
// 숫자는 <span class="mart-n"> 로 작고 옅게. 고른 값은 match(분류 id) 로 물어봐요.
const numHtml = n => `<span class="mart-n n">${n}</span>`;   // 글자 뒤 흐름 안(배지 아님 · 13 · 보조색)
function chipGroups({ groupsEl, chipsEl, cats, groups = [], total, onChange }) {
    const sel = { group: 'all', cat: 'all' };
    const used = groups.map(g => ({ ...g, cats: cats.filter(c => c.group === g.id) })).filter(g => g.cats.length);
    const sum = list => list.reduce((n, c) => n + c.n, 0);
    const groupOf = new Map(cats.map(c => [c.id, c.group]));
    const withGroups = !!groupsEl && used.length >= 2;
    if (groupsEl) groupsEl.hidden = !withGroups;
    const btn = (attr, id, label, n, on) => `<button type="button" class="${attr === 'group' ? 'tab' : 'chip'}" data-${attr}="${esc(id)}" aria-pressed="${on}">${esc(label)}${numHtml(n)}</button>`;
    let paintChips = () => {
        const g = used.find(x => x.id === sel.group);
        const list = g ? [['all', '모두', sum(g.cats)], ...g.cats.map(c => [c.id, c.label, c.n])] : [['all', '전체', total], ...cats.map(c => [c.id, c.label, c.n])];
        chipsEl.innerHTML = list.map(([id, label, n]) => btn('cat', id, label, n, id === sel.cat)).join('');
        chipsEl.scrollLeft = 0;
    };
    if (withGroups) {
        groupsEl.innerHTML = [btn('group', 'all', '전체', total, true), ...used.map(g => btn('group', g.id, g.label, sum(g.cats), false))].join('');
        groupsEl.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-group]'); if (!b) return;
            sel.group = b.dataset.group; sel.cat = 'all';
            for (const x of groupsEl.children) x.setAttribute('aria-pressed', String(x === b));
            b.scrollIntoView({ inline: 'nearest', block: 'nearest' });
            paintChips(); onChange();
        });
    }
    chipsEl.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-cat]'); if (!b) return;
        sel.cat = b.dataset.cat;
        for (const x of chipsEl.children) x.setAttribute('aria-pressed', String(x === b));
        b.scrollIntoView({ inline: 'nearest', block: 'nearest' });
        onChange();
    });
    paintChips();
    // PC: 세로 휠로도 칩 줄을 가로로 밀어요(끝에 닿으면 화면이 내려가요)
    for (const el of [groupsEl, chipsEl]) el?.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth + 1) return;
        const before = el.scrollLeft; el.scrollLeft += e.deltaY;
        if (el.scrollLeft !== before) e.preventDefault();
    }, { passive: false });
    // 오른쪽에 더 있으면 끝을 흐리게(PC · mart.css .has-more)
    const edge = () => { for (const el of [groupsEl, chipsEl]) el?.classList.toggle('has-more', el.scrollLeft + el.clientWidth < el.scrollWidth - 2); };
    for (const el of [groupsEl, chipsEl]) el?.addEventListener('scroll', edge, { passive: true });
    addEventListener('resize', edge);
    const repaint = paintChips;
    paintChips = () => { repaint(); edge(); };
    edge();
    foldChips(chipsEl, groupsEl);
    foldBar(chipsEl.closest('.mart-tools'));
    return {
        sel,
        groupLabel: id => used.find(g => g.id === groupOf.get(id))?.label || '',
        // builtin: 그 항목이 테마 내장인지 — 「내장」 묶음은 내장 분류(기본 틀) + 다른 분류 안의 내장 항목(내장 심플 30 · 가짜 칩 BUILTIN_MORE)을 같이 모아요
        match: (category, builtin = false) => {
            if (sel.cat === BUILTIN_MORE) return builtin && groupOf.get(category) !== 'builtin';
            if (sel.cat !== 'all') return category === sel.cat;
            return sel.group === 'all' || groupOf.get(category) === sel.group || (builtin && sel.group === 'builtin');
        },
    };
}
/** PC 세부 칩 줄 접기 「▾」 — 위 분류 줄 오른쪽 끝(mart.css 가 자리를 잡고 폰에선 숨겨요) · 접힘은 이 기기에 기억해요 */
const FOLD_KEY = 'bl-mart-chips-folded';
function foldChips(chipsEl, groupsEl) {
    const tools = chipsEl.closest('.mart-tools');
    if (!tools || tools.querySelector('.mart-chips-fold')) return;
    chipsEl.id ||= 'mart-chips';
    const fold = Object.assign(document.createElement('button'), { type: 'button', className: 'mart-chips-fold ibtn chev' });   // ⌄ 선 그림 마스크 14 · 34 상자 · 펼쳐져 있으면 뒤집혀요(aria-expanded)
    fold.setAttribute('aria-controls', chipsEl.id);
    let folded = false; try { folded = localStorage.getItem(FOLD_KEY) === '1'; } catch { /* 저장이 막힌 창 */ }
    const paint = () => {
        tools.classList.toggle('is-folded', folded);
        fold.setAttribute('aria-expanded', String(!folded));
        fold.setAttribute('aria-label', folded ? '세부 분류 칩 펼치기' : '세부 분류 칩 접기');
        fold.title = folded ? '세부 분류 칩 펼치기' : '세부 분류 칩 접기';
    };
    fold.addEventListener('click', () => { folded = !folded; try { localStorage.setItem(FOLD_KEY, folded ? '1' : ''); } catch { /* 이 화면에서만 */ } paint(); });
    (groupsEl || chipsEl).after(fold);
    paint();
}
/** 폰 거르기 띠 접기 — 접히면 한 줄(찾기 칸 + 「필터 · 고른 것 요약 ⌄」) · 펼치면 그 자리가 ⌄ 아이콘 단추 34(접기)
 *  화면을 내리면 저절로 접히고 위로 올리면 펼쳐져요 · 맨 위에선 늘 펼침. 직접 누른 접기 · 펼치기는 스크롤로 뒤집지 않아요(맨 위로 돌아오면 풀려요).
 *  PC · 태블릿(640 이상)은 단추가 안 보이고 띠도 늘 펼침(mart.css). 칩을 고르면 바로 거르고 띠는 그대로예요. */
const BAR_PHONE = matchMedia('(max-width:639px)');
const BAR_CALM = matchMedia('(prefers-reduced-motion:reduce)');
function foldBar(tools) {
    const row = tools?.querySelector('.mart-search-row');
    if (!row || row.querySelector('.mart-bar-fold')) return;
    const parts = [...tools.querySelectorAll('.mart-groups, .mart-chips, .mart-filters')];
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'mart-bar-fold chev' });   // 접힘 머리(「자세히」와 같은 모양 · ⌄ 선 그림 마스크 14)
    b.setAttribute('aria-controls', parts.map(el => el.id).filter(Boolean).join(' '));   // 이미 있는 id(세부 칩 줄 #mart-chips)만 — 새 id 를 붙이면 리그 기준선 열쇠(요소 경로)가 바뀌어요
    b.innerHTML = '<span class="mart-bar-t">필터</span><span class="mart-bar-sum"></span>';
    row.append(b);
    const sum = b.querySelector('.mart-bar-sum');
    // 지금 고른 것 요약: 세그(방향 · 디자인)에서 「전체」가 아닌 것 → 하위 칩(고른 게 있으면) 또는 묶음 탭
    const labelOf = x => { const c = x.cloneNode(true); c.querySelectorAll('.mart-n, .mart-seg-short').forEach(n => n.remove()); return c.textContent.trim(); };
    const picked = () => {
        const out = [];
        for (const seg of tools.querySelectorAll('[data-filter]')) { const on = seg.querySelector('[aria-pressed="true"]'); if (on && on !== seg.firstElementChild && !seg.closest('[hidden]')) out.push(labelOf(on)); }
        const cat = tools.querySelector('.mart-chips [aria-pressed="true"]'), grp = tools.querySelector('.mart-groups:not([hidden]) [aria-pressed="true"]');
        if (cat && cat.dataset.cat !== 'all') out.push(labelOf(cat));
        else if (grp && grp.dataset.group !== 'all') out.push(labelOf(grp));
        return out;
    };
    let collapsed = false, manual = false, lastY = scrollY, run = 0, quietUntil = 0, ticking = false;
    const paint = () => {
        const list = picked();
        sum.textContent = list.join(' · ');
        sum.hidden = !list.length;
        const what = list.length ? ` — 지금 ${list.join(' · ')}` : '';
        b.setAttribute('aria-expanded', String(!collapsed));
        b.setAttribute('aria-label', collapsed ? `필터 펼치기${what}` : '필터 접기');
        b.title = collapsed ? `디자인 · 분류 칩 펼치기${what}` : '디자인 · 분류 칩 접기';
    };
    const set = (on) => {
        if (collapsed === on) return;
        collapsed = on;
        tools.classList.toggle('is-collapsed', on);
        tools.classList.toggle('is-opening', !on && !BAR_CALM.matches);
        paint();
        quietUntil = performance.now() + 300;   // 띠 높이가 바뀌며 생기는 스크롤(끝 닿음 · 브라우저 스크롤 고정)은 사람이 굴린 게 아니라 무시해요
        requestAnimationFrame(() => { lastY = scrollY; run = 0; });
    };
    tools.addEventListener('animationend', () => tools.classList.remove('is-opening'));
    b.addEventListener('click', () => { manual = true; set(!collapsed); });
    tools.addEventListener('click', (e) => { if (e.target.closest('[data-filter] button, .mart-groups button, .mart-chips button')) paint(); });
    // 띠가 붙기 시작하는 자리(문서 기준) = 띠 바로 앞 표시의 위치 − 붙는 높이
    const mark = Object.assign(document.createElement('div'), { className: 'mart-bar-mark' });
    mark.setAttribute('aria-hidden', 'true');
    tools.before(mark);
    const onScroll = () => {
        ticking = false;
        const y = scrollY, dy = y - lastY; lastY = y;
        if (!BAR_PHONE.matches) { manual = false; set(false); return; }
        if (performance.now() < quietUntil) return;
        if (y < 8) { if (dy < 0 || !manual) { manual = false; set(false); } return; }   // 맨 위: 펼침(위로 굴러 돌아왔으면 직접 고른 것도 풀어요)
        if (manual || !dy) return;
        run = Math.sign(dy) === Math.sign(run) ? run + dy : dy;   // 같은 방향으로 굴린 거리
        const stickAt = mark.getBoundingClientRect().top + y - (parseFloat(getComputedStyle(tools).top) || 0);
        if (!collapsed && run > 8 && y > stickAt + tools.offsetHeight + 16) set(true);   // 붙은 띠 높이만큼 더 내려간 뒤에 접어요(접혀 줄어든 만큼 당겨져도 붙은 채로)
        else if (collapsed && run < -24) set(false);
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    BAR_PHONE.addEventListener?.('change', () => { manual = false; set(false); });
    // 카드로 굴려 갈 때(#글꾸id · 무작위) 띠 밑에 숨지 않게: 카드 scroll-margin-top = 붙는 높이 + 띠 높이 + 8
    const gap = () => document.documentElement.style.setProperty('--mart-bar-gap', `${(parseFloat(getComputedStyle(tools).top) || 0) + tools.offsetHeight + 8}px`);
    new ResizeObserver(gap).observe(tools);
    gap(); paint();
}
/** 머리말: 설명은 폰 두 줄 · PC 한 줄만 보이고 「자세히」로 펼쳐요(640~899 태블릿은 늘 펼침) */
function wireHead() {
    const head = document.querySelector('.mart-head'), h1 = head?.querySelector('h1');
    if (!h1 || head.querySelector('.mart-head-more')) return;
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'mart-head-more chev', textContent: '자세히' });
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => { const on = head.classList.toggle('is-open'); b.setAttribute('aria-expanded', String(on)); b.textContent = on ? '접기' : '자세히'; });
    h1.after(b);
}
wireHead();
// 글꾸 묶음 — 자료 categories[].group 이 있으면 그것, 없으면 내장(builtin) · 항목 id 머리(s · c · world · char · halloween)로 정해요
const GEULKKU_GROUPS = [{ id: 'series', label: '시리즈' }, { id: 'world', label: '세계관' }, { id: 'char', label: '인물' }, { id: 'concept', label: '컨셉' }, { id: 'halloween', label: '할로윈' }, { id: 'christmas', label: '크리스마스' }, { id: 'builtin', label: '내장' }, { id: 'etc', label: '기타' }];
// 「내장」 묶음의 가짜 칩 — 기념일 · 사물 · 장르 분류에 섞인 테마 내장 심플 글꾸 30종을 한데 모아요(분류 id 가 아니라 항목의 builtin 으로 걸러요)
const BUILTIN_MORE = 'builtin-more';
/** 테마(1.0.1)에 이미 들어 있는 것 — 글꾸는 자료의 builtin(내장 심플 30 · 로그 복사 기본 틀 19 · tools/geulkku-builtin.mjs), 액자는 심플 액자(frame-preset) 20 전부(테마 src/frame-presets.js FRAME_PRESETS 와 같아요) */
const isBuiltin = item => !!(item?.builtin || item?.kind === 'frame-preset');
const BUILTIN_TAG = '<span class="mart-tag tag is-builtin" title="블루레몬에이드 테마에 이미 들어 있어요 · 마트에서 가져오지 않아도 돼요">' + lemonHtml() + ' 테마 내장</span>';
const ID_GROUP = { s: 'series', c: 'concept', concept: 'concept', world: 'world', char: 'char', halloween: 'halloween' };
// 11-05 새 컨셉(id 머리는 모두 s-) — 크리스마스 · 연말은 할로윈처럼 제 묶음(시즌) · 앱 · 게임 · 레트로 · 점 · 덕질 · 학교는 「컨셉」(음식 · 취미 · 옛날 매체 · 상태창과 같은 결) · 계절 3~8 은 기존 계절 칩 그대로(시리즈)
//   헌시뮬 · 인물 · 아드리안 · 인물은 id 머리(char-)로 「인물」
const CAT_GROUP = { christmas: 'christmas', app: 'concept', game: 'concept', retro: 'concept', fortune: 'concept', fandom: 'concept', school: 'concept' };
function geulkkuGroup(c, items) {
    if (GEULKKU_GROUPS.some(g => g.id === c.group)) return c.group;
    if (CAT_GROUP[c.id]) return CAT_GROUP[c.id];
    if (c.builtin) return 'builtin';
    const tally = {};
    for (const x of items) if (x.category === c.id) { const g = ID_GROUP[String(x.id).split('-')[0]] || 'etc'; tally[g] = (tally[g] || 0) + 1; }
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'etc';
}
// 글꾸 그림체(테마 tools/mart/geulkku-style.mjs) — 항목 style 칸이 없으면 「일러스트」(옛 「기본」)
const STYLE_DEFAULT = '일러스트';
const STYLE_ORDER = ['심플', '일러스트', '다꾸', '무테'];
const STYLE_ALIAS = { 기본: '일러스트' };
const styleOf = item => STYLE_ALIAS[item.style] || item.style || STYLE_DEFAULT;

// ── 글꾸 조각 받기 — 목록의 c(그림체 × 분류 열쇠)로 조각 하나를 한 번만 받아 그 안 틀들에 미리보기 · 받기 칸을 채워요 ──
let chunkFiles = {};
const chunkJobs = new Map();
function loadChunk(key) {
    if (!chunkJobs.has(key)) {
        const f = chunkFiles[key];
        const job = (f ? fetch(new URL(`./data/geulkku/${f.file}`, import.meta.url)) : Promise.reject(new Error('조각이 목록에 없어요')))
            .then((res) => { if (!res.ok) throw new Error(`조각 ${res.status}`); return res.json(); })
            .then(d => d.items || {});
        job.catch(() => chunkJobs.delete(key));   // 실패하면 다음에 다시 받아요
        chunkJobs.set(key, job);
    }
    return chunkJobs.get(key);
}
/** 그 틀의 조각을 받은 뒤 항목에 미리보기 · 받기 칸을 붙여 돌려줘요(이미 있으면 바로) */
function ensureItem(item) {
    if (item.kind !== 'geulkku' || item.preview || !item.c) return Promise.resolve(item);
    return loadChunk(item.c).then((rows) => {
        const heavy = rows[item.id];
        if (!heavy) throw new Error(`${item.name} 틀이 조각에 없어요`);
        const { icon, ...rest } = heavy;
        Object.assign(item, rest);
        if (!item.icon && icon) item.icon = icon;   // 목록의 아이콘 파일 경로(icon/…svg)가 있으면 그대로(담기 · 장바구니에 짧게 남아요)
        // 갤러리 기본 틀의 표본 사진: 자료는 mart/ 기준(미리보기 안은 ../data/…) → 절대 주소로(HTML 복사 · 시식 결과를 다른 곳에 붙여도 보이게)
        if (Array.isArray(item.images)) item.images = item.images.map(x => ({ ...x, src: asset(x.src) }));
        if (item.preview?.includes('src="../data/')) item.preview = item.preview.replaceAll('src="../data/', `src="${asset('data/')}`);
        return item;
    });
}
const LOAD_FAIL = '틀을 못 받았어요 · 잠시 뒤 다시 눌러 주세요';

// ── 받는 모양(테마가 읽는 칸만) ──
const hash = text => { let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return (h >>> 0).toString(36).slice(0, 6); };
function receipt(state) {
    const item = state.item;
    if (item.kind === 'frame-preset') {
        const v = state.values;
        const out = { kind: 'frame-preset', id: item.id, name: item.name, presetId: item.presetId, presetColor: v.presetColor, presetAccent: v.presetAccent, frameWidth: v.frameWidth, frameHeight: v.frameHeight };
        if (item.presetLabel !== undefined) out.presetLabel = v.presetLabel;
        if (state.view) out.view = { ...state.view };   // 넣어 보기에서 맞춘 사진 값(지금 테마는 읽지 않고 넘어가요 — 보고서 참고)
        const changed = ['presetColor', 'presetAccent', 'presetLabel', 'frameWidth', 'frameHeight'].some(k => v[k] !== item[k]);
        if (changed) { out.id = `${item.id}-${hash(JSON.stringify(v))}`; out.name = `${item.name} · 내 색`; }   // 바꾼 것은 따로 보관(기본 것을 덮지 않게)
        return out;
    }
    if (item.kind === 'geulkku') return { kind: 'geulkku', id: item.id, label: item.label, emoji: item.emoji, template: item.template, colors: colorsOf(item), messages: item.messages, tail: item.tail, ...(item.type ? { type: item.type } : {}) };   // type: 제목 꼴(테마 mart-import 가 읽어요)
    return null;   // 그림 액자: 받기 파일을 그대로
}
/** 장바구니 한 줄 — 받을 데이터(receipt) 또는 그림 액자 받기 파일 주소, 서랍에 보일 이름 · 크기 */
function entryOf(state) {
    const item = state.item, own = receipt(state);
    const base = { kind: item.kind, id: own?.id || item.id, key: `${item.kind}:${own?.id || item.id}`, name: own?.name || item.name || item.label, label: KIND_LABEL[item.kind], emoji: item.emoji || (item.kind === 'geulkku' ? '📝' : '🖼️'), ...(item.kind === 'geulkku' && item.icon && !String(item.icon).startsWith('data:') ? { icon: `data/geulkku/${item.icon}` } : {}), href: asset(`${item.kind === 'geulkku' ? 'geulkku' : 'frames'}/#${item.id}`) };   // 마트 밖(지니)에서 담아도 제 마트로 돌아가요
    if (own) return { ...base, receipt: own, bytes: JSON.stringify(own).length, bg: item.colors?.bg };
    // 그림 액자(코덱스 컬렉션): 받기 그림 주소만 두고 받는 순간 PNG 로 만들어요(frameReceipt)
    if (item.full) return { ...base, art: item.full, mask: item.mask, ratio: item.ratio, thumb: item.thumb, bytes: item.bytes || 0, ...(state.view ? { view: { ...state.view } } : {}) };
    return { ...base, file: item.file, thumb: item.thumb, bytes: item.bytes || 0 };
}
// 테마 mart-import.js 와 같은 상한: 그림 한 장 data URL 400만 자(decor.js tidyDecor)
const ART_MAX = 4000000;
const loadImage = src => new Promise((resolve, reject) => { const img = new Image(); img.decoding = 'async'; img.onload = () => resolve(img); img.onerror = () => reject(new Error('그림을 못 불러왔어요')); img.src = src; });
/** 그림 액자 받기 항목 — 긴 변 1086 WebP 를 캔버스로 PNG data URL 로(테마가 직접 올린 그림을 PNG 로 담는 frame-editor.js 와 같은 길) · 마스크는 PNG 그대로 */
async function frameReceipt(entry) {
    const [art, mask] = await Promise.all([loadImage(asset(entry.art)), loadImage(asset(entry.mask))]);
    let scale = 1, artUrl = '', maskUrl = '', w = 0, h = 0;
    for (let i = 0; i < 6; i++) {
        w = Math.max(1, Math.round(art.naturalWidth * scale)); h = Math.max(1, Math.round(art.naturalHeight * scale));
        const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
        c.getContext('2d').drawImage(art, 0, 0, w, h);
        artUrl = c.toDataURL('image/png');
        const m = Object.assign(document.createElement('canvas'), { width: w, height: h });
        m.getContext('2d').drawImage(mask, 0, 0, w, h);
        maskUrl = m.toDataURL('image/png');
        c.width = c.height = m.width = m.height = 1;
        if (artUrl.length <= ART_MAX && maskUrl.length <= ART_MAX) break;
        scale *= 0.85;   // 아주 드물게 큰 그림 — 테마 상한에 맞춰 조금씩 줄여요
    }
    if (artUrl.length > ART_MAX) throw new Error(`${entry.name} 그림이 테마 상한보다 커요`);
    if (scale === 1) {   // 줄이지 않았으면 마스크는 받은 PNG 그대로(캔버스로 다시 담으면 몇 배 커져요)
        try {
            const blob = await (await fetch(asset(entry.mask))).blob();
            const raw = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
            if (/^data:image\/png;base64,/.test(raw)) maskUrl = raw;
        } catch { /* 캔버스로 만든 것을 그대로 */ }
    }
    const out = { kind: 'frame', id: entry.id, name: entry.name, decor: { art: artUrl, mask: maskUrl, ratio: Math.round(w / h * 10000) / 10000 } };
    if (entry.view) out.view = entry.view;
    return out;
}
/** 꾸러미 글(Promise) — 그림 액자는 받는 순간 만들거나(art) 받기 파일을 가져와 합쳐요(file) */
async function packText(entries) {
    const items = [];
    for (const entry of entries) {
        if (entry.receipt) { items.push(entry.receipt); continue; }
        if (entry.art) { items.push(await frameReceipt(entry)); continue; }
        const res = await fetch(asset(entry.file));
        if (!res.ok) throw new Error(`${entry.name} 파일을 못 받았어요`);
        items.push(...(await res.json()).items);
    }
    return JSON.stringify({ 'bl-mart': 1, items });
}

/** entries: 배열 또는 배열 Promise(글꾸 조각을 받는 중일 때) — 클립보드는 누른 순간에 열고 글은 Promise 로 넘겨요 */
async function copyEntries(entries, quiet = false, place = where) {
    const text = Promise.resolve(entries).then(packText);
    text.catch(() => { /* 아래에서 알려요 */ });
    try {
        // 사파리는 누른 순간에 클립보드를 열어야 해요 — 글은 Promise 로 넘겨요
        if (globalThis.ClipboardItem && navigator.clipboard?.write) await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text.then(t => new Blob([t], { type: 'text/plain' })) })]);
        else await navigator.clipboard.writeText(await text);
        if (!quiet) say(`복사했어요 · 테마 설정 › ${place} › 「마트에서 가져오기」에 붙여 넣어요`, 3200);
        return true;
    } catch {
        const failed = await text.then(() => null, e => e);
        if (failed) { say(failed.message || LOAD_FAIL, 3200); return false; }
        try {
            const area = Object.assign(document.createElement('textarea'), { value: await text });
            area.style.cssText = 'position:fixed;opacity:0;top:0';
            document.body.append(area); area.select();
            const ok = document.execCommand('copy'); area.remove();
            if (ok) { if (!quiet) say('복사했어요'); return true; }
        } catch { /* 아래 */ }
        say('복사가 막혔어요 · 장바구니의 「📦 받기」로 받아 주세요', 3200);
        return false;
    }
}
/** 글꾸 「HTML 복사」 — 테마 없이 커뮤니티 글(인라인 스타일만 · 스크립트 금지 편집기)에 바로 붙여 쓰는 완성 HTML. 미리보기에 보이는 것과 같아요.
 *  서식(text/html) + 그 코드 글자(text/plain)를 같이 넣어요 — 보통 편집기엔 모양 그대로, HTML 칸엔 코드로 붙어요 */
async function copyHtml(state) {
    const item = state.item;
    const ready = ensureItem(item).then(() => (inkChanged(item) && !tasteLoaded ? loadTaste().then(() => { delete state.inkHtml; return previewOf(state); }) : previewOf(state)));   // 「📝 내 로그로 보기」가 켜져 있으면 내 로그가 든 완성 HTML   // 조각을 아직 안 받았으면 받은 뒤(클립보드는 누른 순간에 열어요)
    ready.catch(() => { /* 아래에서 알려요 */ });
    const done = () => say('복사됐어요 · 깡싸 글쓰기 HTML 칸에 붙여요', 3600);
    try {
        if (globalThis.ClipboardItem && navigator.clipboard?.write) await navigator.clipboard.write([new ClipboardItem({ 'text/html': ready.then(h => new Blob([h], { type: 'text/html' })), 'text/plain': ready.then(h => new Blob([h], { type: 'text/plain' })) })]);
        else await navigator.clipboard.writeText(await ready);
        done();
    } catch {
        const failed = await ready.then(() => null, e => e);
        if (failed) { say(LOAD_FAIL, 3200); return; }
        const html = await ready;
        // 대체(오래된 폰 · 권한 막힘): 숨은 글 칸을 골라 복사 — iOS 는 readOnly + setSelectionRange 로 키보드 없이 골라져요
        const area = Object.assign(document.createElement('textarea'), { value: html, readOnly: true });
        area.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px;font-size:16px';
        document.body.append(area); area.focus(); area.select(); area.setSelectionRange(0, html.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { /* 아래 */ }
        area.remove();
        if (ok) done(); else say('복사가 막혔어요 · 미리보기를 길게 눌러 골라 복사해 주세요', 3600);
    }
}
async function saveEntries(entries, name) {
    try {
        const blob = new Blob([await packText(entries)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `${name}.bl-mart.json`;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        return true;
    } catch (error) { say(error.message || '파일을 못 만들었어요'); return false; }
}
// 시험용(주소에 ?mart-test 가 있을 때만): 받기 글을 만드는 길을 바깥 검사가 그대로 불러 봐요
if (new URLSearchParams(location.search).has('mart-test')) globalThis.martTest = { packText, entryOf, ensureItem, items: () => allItems, built: () => states.length, chunksLoaded: () => [...chunkJobs.keys()] };
onCheckout((act, entries) => (act === 'copy' ? copyEntries(entries, true) : saveEntries(entries, `blue-lemonade-mart-${entries.length}`)));

// ── 액자 그리기 ──
const BASE_RATIO = 360 / 480;
/** 정사각 미리보기 칸 안에 비율대로 (가로가 길면 폭 가득, 세로가 길면 높이 가득) */
const fit = (box, ratio) => { const r = Number(ratio) > 0 ? Number(ratio) : BASE_RATIO; box.style.width = r >= 1 ? '100%' : `${r * 100}%`; box.style.height = r >= 1 ? `${100 / r}%` : '100%'; };
function paintFrame(state) {
    const box = state.el.querySelector('.mart-fit');
    const { item } = state;
    if (item.kind === 'frame') {
        fit(box, item.ratio);
        box.innerHTML = `<div class="mart-photo" aria-hidden="true" style="mask-image:url('${esc(asset(item.maskThumb))}');-webkit-mask-image:url('${esc(asset(item.maskThumb))}')"></div><img alt="" loading="lazy" src="${esc(asset(item.thumb))}">`;
        return;
    }
    if (!drawPreset) { box.innerHTML = '<small class="mart-fail">그림 도구를 못 불러왔어요</small>'; return; }
    try {
        const v = state.values;
        const out = drawPreset(item.presetId, { ...v });
        fit(box, out.ratio * v.frameWidth / v.frameHeight);
        box.innerHTML = `<div class="mart-photo" aria-hidden="true" style="mask-image:url('${out.mask}');-webkit-mask-image:url('${out.mask}')"></div><img alt="" src="${out.art}">`;
    } catch (e) { box.innerHTML = `<small class="mart-fail">${esc(e.message)}</small>`; }
}

// 세계관 · 캐릭터 글꾸의 원작 봇(깡싸 글) — 분류 id 로 묶어요
const SOURCES = {
    'halo': { title: '천악 오피스물 ~천지합동청 H.A.L.O~', url: 'https://kkangtong.xyz/posts/54677' },
    'halo-char': { title: '천악 오피스물 ~천지합동청 H.A.L.O~', url: 'https://kkangtong.xyz/posts/54677' },
    'hunter': { title: '헌터물 시뮬봇 「Dungeons & Hunters」', url: 'https://kkangtong.xyz/posts/5150' },
    'adrian': { title: '독일 출생 수석 지휘자', url: 'https://kkangtong.xyz/posts/81234' },
    'gangho': { title: '미완성인 무협 시뮬레이션', url: 'https://kkangtong.xyz/posts/78795' },
    'gangho-char': { title: '미완성인 무협 시뮬레이션', url: 'https://kkangtong.xyz/posts/78795' },
    'hunter-char': { title: '헌터물 시뮬봇 「Dungeons & Hunters」', url: 'https://kkangtong.xyz/posts/5150' },
    'adrian-char': { title: '독일 출생 수석 지휘자', url: 'https://kkangtong.xyz/posts/81234' },
};
// 캐릭터마다 따로 공유된 깡캐 글 — id 앞부분(char-이름)으로 묶어요
const CHAR_SOURCES = {
    'char-uziel': { title: 'MZ가 되고 싶은 최초의 세라프(우지엘)', url: 'https://kkangtong.xyz/posts/127563' },
    'char-lucifer': { title: '미카엘 쌍둥이 친형 · 칠죄종 타락천사 루시퍼', url: 'https://kkangtong.xyz/posts/78569' },
    'char-asmodeus': { title: '나 때찌해줘 갸루오지상(아스모데우스)', url: 'https://kkangtong.xyz/posts/155899' },
};
// 보이는 분류 이름 — 「강호유람록」은 실제 봇 이름 「무협시뮬」로 보여 주되, 옛 이름으로도 찾아지게 검색어에 남겨요
const LABEL_FIX = { 'gangho': '무협시뮬', 'gangho-char': '무협시뮬 · 인물' };
const SEARCH_ALSO = { 'gangho': '강호유람록 무협 시뮬 무협시뮬', 'gangho-char': '강호유람록 무협 시뮬 무협시뮬' };
const catLabel = (id, label) => LABEL_FIX[id] || label || '';
// 세계관 액자의 원작 봇 — 콘셉트 id 로 묶어요(url 이 빈 칸이면 링크를 안 보여요)
const FRAME_SOURCES = {
    'halo-office': SOURCES.halo,
    'hunter-sim': { title: 'Dungeons & Hunters', url: 'https://kkangtong.xyz/posts/5150' },
    'adrian': SOURCES.adrian,
};
const sourceLinks = item => {
    // 11-07: 그림체가 붙은 id(char-이름-sp-1 · -dk- · -mt-)도 같은 인물 — 앞부분이 「char-이름」이면 깡캐 글을 붙여요(전엔 일러스트 char-이름-1 · -2 에만 붙었어요)
    const id = String(item.id || '');
    const ch = CHAR_SOURCES[Object.keys(CHAR_SOURCES).find(key => id === key || id.startsWith(key + '-'))];
    let w = item.kind === 'frame' ? FRAME_SOURCES[item.concept] : SOURCES[item.category];
    if (w && !w.url) w = null;   // 자리만 있는 원작
    const a = (src, kind) => `<a class="mart-source" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer" title="원작 깡싸 글">🔗 ${kind} · ${esc(src.title)}</a>`;
    // 틀마다 출처 봇이 다른 분류(11-06 센티넬버스 — 센가시뮬 · 센가 아카데미)는 목록의 source(봇 정식 이름)를 글로만 보여요(깡싸 글 주소는 아직 없어요)
    const own = !w && item.source ? `<span class="mart-source is-plain" title="원작 봇">원작 · ${esc(item.source)}</span>` : '';
    return (ch ? a(ch, '깡캐') : '') + (w ? a(w, '원작') : own);
};

// ── 카드 한 줄 정보 · 단추(카드와 크게 보기 시트가 같이 써요) ──
const HTML_TITLE = '확장 없이 커뮤니티 글쓰기 HTML 칸에 바로 붙여 쓰는 완성 HTML(보이는 글씨는 전부 바꿔도 돼요)';
// 글꾸 목록의 fx(m 움직임 · e 반응)는 나누기 도구가 미리보기에서 미리 재 둔 값이에요(조각을 받기 전에도 꼬리표를 달아요)
const hasMotion = item => (item.fx !== undefined || item.c ? String(item.fx || '').includes('m') : /style="[^"]*animation\s*:/.test(String(item.preview || '').replace(/<style>[\s\S]*?<\/style>/g, '')));
const hasEgg = item => (item.fx !== undefined || item.c ? String(item.fx || '').includes('e') : / data-bl-egg="/.test(item.preview || ''));
let showStyle = false;   // 그림체가 둘 이상일 때만 「기본」까지 꼬리표로 보여요
/** 글꾸 이름 앞 그림 — 그 글꾸 틀의 우리 아이콘(목록 icon/…svg · 목록에 없으면 조각의 data URI), 없으면 이모지(아이콘 없는 184종) */
const iconSrc = item => (item?.icon ? (String(item.icon).startsWith('data:') ? item.icon : asset(`data/geulkku/${item.icon}`)) : '');
const glyphHtml = (item, fallback = '') => { const src = iconSrc(item); const emoji = item?.emoji || fallback; return src ? `<img class="mart-ico" src="${esc(src)}" alt="" aria-hidden="true" decoding="async">` : emoji ? `<span class="em" aria-hidden="true">${lemonize(esc(emoji))}</span>` : ''; };
/** 이름 옆 꼬리표: 분류 · 그림체 · ✨ 움직임 · 👆 반응 */
function tagsHtml(item) {
    const style = item.kind === 'geulkku' && (showStyle || styleOf(item) !== STYLE_DEFAULT) ? `<span class="mart-tag tag is-style" title="디자인">${esc(styleOf(item))}</span>` : '';
    const own = item.kind === 'geulkku' && item.builtin ? BUILTIN_TAG : '';
    const fx = '';   // 916 중 913 이 움직이고 915 가 반응해서(2026-11-05 셈) 「✨ 움직임 · 👆 반응」 꼬리표는 정보가 없어 뺐어요
    return `<span class="mart-tags"><span class="mart-tag tag">${esc(catLabel(item.category, item.categoryLabel))}</span>${style}${fx}${own}</span>`;
}
const descOf = item => (LABEL_FIX[item.category] ? String(item.desc || '').replace(/강호유람록/g, '무협시뮬') : (item.desc || ''));
function actionsHtml(item) {
    const html = item.kind === 'geulkku' ? `<button type="button" class="btn" data-act="html" title="${HTML_TITLE}"><span class="em" aria-hidden="true">📋</span>HTML 복사</button>` : '';
    // 테마에 들어 있는 글꾸(내장 심플 30 · 로그 복사 기본 틀 19): 받을 것 없음 — 담기 · 테마용 복사 대신 안내 + HTML 복사(시식은 크게 보기에서 그대로)
    if (item.builtin) return `<div class="mart-actions is-geulkku is-builtin"><span class="mart-builtin" title="블루레몬에이드 로그 복사에 이미 있어요 · 마트에서 가져오지 않아도 돼요">✓ 이미 테마에 들어 있어요</span>${html}</div>`;
    // 오리지널 컨셉 30(copyOnly): 그림 곳곳에 글을 쓰는 틀이라 테마로 받기는 준비 중 — 「담기」 · 「테마용 복사」 없이 HTML 복사만
    if (item.copyOnly) return `<div class="mart-actions is-geulkku is-builtin is-copyonly"><span class="mart-builtin" title="테마로 받기는 준비 중이에요 · 커뮤니티 글에 HTML 로 붙여 써요">HTML 복사로 써요</span>${html}</div>`;
    return `<div class="mart-actions${item.kind === 'geulkku' ? ' is-geulkku' : ''}"><button type="button" class="btn mart-pick" data-act="pick" aria-pressed="false"><span class="em" aria-hidden="true">🛒</span>담기</button><button type="button" class="btn" data-act="copy" title="이것 하나만 바로 복사(테마 「마트에서 가져오기」용)">${item.kind === 'geulkku' ? '테마용 복사' : '바로 복사'}</button>${html}</div>`;
}
function doAct(state, act, b) {
    if (act === 'view') openSheet(state);
    else if (act === 'copy') copyEntries(ensureItem(state.item).then(() => [entryOf(state)]));
    else if (act === 'html') copyHtml(state);
    else if (act === 'taste') openTaste(state);
    else if (act === 'random') pickRandom();
    else if (act === 'pick') {
        const key = entryOf(state).key;   // 열쇠는 목록만으로 정해져요 — 담는 글(받기 칸)은 조각을 받은 뒤
        if (cart.has(key)) { cart.remove(key); say('장바구니에서 뺐어요'); return; }
        ensureItem(state.item).then(() => { if (!cart.has(key) && cart.add(entryOf(state), b) === 'full') say('장바구니는 60개까지예요'); }, () => say(LOAD_FAIL, 3200));
    }
}
// ── 「🍽️ 시식하기」(taste.js · 처음 누를 때 받아요) — 내 채팅 로그를 붙여 넣어 이 글꾸에 끼워 보고 HTML 복사 · 내려받기 ──
let tasteModule = null;
let tasteLoaded = null;   // 11-08 받은 시식 모듈(글자색을 바꾼 글꾸 미리보기를 바로 그리려고)
const loadTaste = () => (tasteModule ||= import('./taste.js?v=20261108a').then((m) => { tasteLoaded = m; return m; }, (error) => { tasteModule = null; throw error; }));
function openTaste(state, options = {}) {
    const ready = ensureItem(state.item);
    ready.catch(() => { /* 시식 창이 알려요 */ });
    return loadTaste().then(m => m.openTaste(state, { ready, say, glyph: glyphHtml, ...options }), () => say('시식 창을 못 열었어요 · 잠시 뒤 다시 눌러 주세요', 3200));
}
// ── 「🎲 랜덤 추천」(글꾸 · 액자 마트 공용 머리줄 단추 .mart-random · 상세 창의 「🎲 다른 거 추천」) — 지금 거르기 안에서(없으면 전체) 하나를 무작위로 골라 상세 창을 열어요 · 직전 것은 피해요 ──
// 액자 마트는 frame-room.js 가 같은 규칙으로 제 목록에서 골라요. 홈의 「🎲 오늘의 글꾸 · 액자」는 ?random=1 로 와서 바로 하나를 열어요.
let lastRandom = null;
export const randomMoreHtml = () => '<button type="button" class="btn mart-random-more" data-act="random" title="지금 거르기 안에서 하나 더 무작위로"><span class="em" aria-hidden="true">🎲</span>다른 거 추천</button>';
/** @param {T[]} pool @param {T|null} last @returns {T|null} */
export function randomPick(pool, last) {
    const list = pool.length > 1 ? pool.filter(x => x !== last) : pool;
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}
function pickRandom() {
    const pool = cards?.list ?? [];   // 지금 거른 목록(아직 안 만든 카드도)
    const next = randomPick(pool, lastRandom);
    if (!next) { say('고를 것이 없어요 · 거르기를 풀어 보세요'); return; }
    lastRandom = next;
    openSheet(stateOf(next));
    history.replaceState(null, '', `${location.pathname}#${encodeURIComponent(next.id)}`);
}
/** 그 글꾸의 카드 상태 — 아직 안 만들었으면 지금 만들어요(목록에는 안 붙여요) */
function stateOf(item) { return stateById.get(item.id) || (card(item), stateById.get(item.id)); }
const cardEl = item => stateOf(item).el;
// ── 「📝 내 로그로 보기」 — 로그를 한 번 넣어 두면 목록의 카드 미리보기 · 카드 「HTML 복사」 · 크게 보기 미리보기가 전부 그 로그로 그려져요(표본 글 대신). 로그는 시식 창과 같은 저장 칸(sessionStorage) ──
//   카드는 화면 가까이 온 것만 그려요(watchCard · fillCard 그대로). 켜짐은 sessionStorage 에 남고, 끄면 표본 글로 돌아가요. 시식 창에서 로그 · 역할 · 제목을 고치면(bl-taste-change) 카드를 다시 그려요.
const MYLOG_KEY = 'bl-mart-mylog-on';
const mylog = { on: false, mod: null };
/** 그 카드에 보일 미리보기 HTML — 내 로그가 켜져 있고 그려지면 그것, 아니면 표본 글 */
function previewOf(state) {
    const item = state.item;
    if (!mylog.on || !mylog.mod || !(item.template || item.shape)) {
        // 11-08 글자색을 바꾼 글꾸: 바꾼 색으로 표본 글을 다시 그려요(시식 모듈을 받기 전에는 원래 미리보기 · 받으면 다시 칠해요)
        if (item.preview && inkChanged(item)) {
            if (tasteLoaded) { if (state.inkHtml === undefined) state.inkHtml = tasteLoaded.sampleHtml(item) || ''; if (state.inkHtml) return state.inkHtml; }
            else loadTaste().then(() => repaintInks(item.id), () => {});
        }
        return item.preview || '';
    }   // shape: 로그 복사 기본 틀(테마 renderLog 그대로)
    if (state.myHtml === undefined) state.myHtml = mylog.mod.renderWithLog(item);
    return state.myHtml || item.preview || '';
}
/** 11-08 글자색을 바꾼 글꾸의 카드 · 상세 창 미리보기와 칩을 다시 칠해요 */
function repaintInks(id) {
    for (const s of states) { if (s.item.id !== id) continue; delete s.myHtml; delete s.inkHtml; if (s.filled) { const box = s.el.querySelector('.mart-preview-in'); if (box) box.innerHTML = previewOf(s); } }
    if (sheet?.open && sheetState?.item.id === id && sheetState.item.preview) { sheet.querySelector('.mart-sheet-preview').innerHTML = previewOf(sheetState); syncInks(sheet.querySelector('.mart-sheet-inks'), sheetState.item); }
}
document.addEventListener('bl-inks-change', e => repaintInks(e.detail?.id));
function repaintMylog() {
    for (const s of states) { delete s.myHtml; if (s.filled) { const box = s.el.querySelector('.mart-preview-in'); if (box) box.innerHTML = previewOf(s); } }
    if (sheet?.open && sheetState?.item.preview) sheet.querySelector('.mart-sheet-preview').innerHTML = previewOf(sheetState);
    paintMylogChip();
}
function paintMylogChip() {
    const b = document.querySelector('.mart-mylog'); if (!b) return;
    const has = mylog.mod?.hasLog();
    b.setAttribute('aria-pressed', String(mylog.on));
    b.innerHTML = `<span class="em" aria-hidden="true">📝</span><span class="t mart-mylog-text">${mylog.on ? '내 로그 · 고치기' : '내 로그로 보기'}</span>`;   // 켬 표시(옅은 파랑 면 + ✔)는 aria-pressed 로 CSS 가
    b.setAttribute('aria-label', mylog.on ? '내 로그로 보는 중 · 고치기' : '내 로그로 보기');
    b.title = mylog.on ? '카드 미리보기가 내 로그로 그려지고 있어요 · 누르면 로그를 고쳐요' : has ? '넣어 둔 로그로 카드 미리보기를 그려요' : '로그를 넣어 두면 목록의 카드가 전부 내 로그로 그려져요';
    let off = document.querySelector('.mart-mylog-off');
    if (!off) { off = Object.assign(document.createElement('button'), { type: 'button', className: 'btn mart-mylog-off', title: '내 로그 끄기 — 다시 표본 글로' }); off.textContent = '끄기'; off.addEventListener('click', () => setMylog(false)); b.after(off); }
    off.hidden = !mylog.on;
}
async function setMylog(on) {
    if (on) { try { mylog.mod = await loadTaste(); } catch { say('로그 도구를 못 불러왔어요'); return; } }
    mylog.on = on && !!mylog.mod?.hasLog();
    try { sessionStorage.setItem(MYLOG_KEY, mylog.on ? '1' : ''); } catch { /* 저장이 막힌 창 */ }
    repaintMylog();
    if (on && !mylog.on) say('로그가 비어 있어요 · 먼저 로그를 넣어 주세요', 3200);
}
async function openMylog() {
    try { mylog.mod = await loadTaste(); } catch { say('로그 창을 못 열었어요 · 잠시 뒤 다시 눌러 주세요', 3200); return; }
    mylog.mod.openTaste(null, { say, on: mylog.on, onApply: () => setMylog(true), onOff: () => setMylog(false) });
}
document.addEventListener('bl-taste-change', () => { if (mylog.on) repaintMylog(); else paintMylogChip(); });
const TASTE_TITLE = '내 채팅 로그를 붙여 넣어 이 글꾸에 끼워 보고, 완성 HTML 을 복사 · 내려받아요';
const tasteHtml = item => (item.kind === 'geulkku' ? `<button type="button" class="btn mart-taste-open" data-act="taste" title="${TASTE_TITLE}"><span class="em" aria-hidden="true">🍽️</span>시식하기<small>내 로그를 넣어 봐요</small></button>` : '');
// ── 글꾸 크게 보기 시트(폰은 아래에서 올라오고 PC 는 가운데) — 전체 미리보기 · 장식 누르기 · 스크롤은 여기서만 ──
let sheet = null, sheetState = null;
function openSheet(state) {
    if (!sheet) {
        sheet = document.createElement('dialog');
        sheet.className = 'mart-sheet';
        sheet.setAttribute('aria-labelledby', 'mart-sheet-title');
        sheet.innerHTML = '<header class="mart-sheet-head"><span class="mart-sheet-grip" aria-hidden="true"></span><div class="mart-sheet-name"><h2 id="mart-sheet-title"></h2><div class="mart-sheet-meta"></div></div><button type="button" class="ibtn x mart-sheet-x" data-sheet="close" aria-label="닫기"></button></header><div class="mart-sheet-body"></div><footer class="mart-sheet-foot"></footer>';
        document.body.append(sheet);
        sheet.addEventListener('click', (e) => {
            if (e.target === sheet) { sheet.close(); return; }   // 바깥(배경) 누르기
            const b = e.target.closest('button'); if (!b) return;
            if (b.dataset.sheet === 'close') sheet.close();
            else if (b.dataset.act && sheetState) doAct(sheetState, b.dataset.act, b);
        });
        let inkTimer = 0;   // 11-08 글자색: 색 고르기를 움직이는 동안 칩 점은 바로 · 다시 그리기는 0.15초 묶음
        sheet.addEventListener('input', (e) => { const t = e.target; if (!t.matches?.('[data-ink]') || !sheetState) return; paintDot(t); clearTimeout(inkTimer); const item = sheetState.item; inkTimer = setTimeout(() => setInk(item, t.dataset.ink, t.value), 150); });
        sheet.addEventListener('click', (e) => { if (e.target.closest?.('[data-ink-reset]') && sheetState) resetInks(sheetState.item); });
        sheet.addEventListener('close', () => { const st = sheetState; sheetState = null; sheet.querySelector('.mart-sheet-body').replaceChildren(); st?.el.querySelector('.mart-preview')?.focus({ preventScroll: true }); });
    }
    sheetState = state;
    const { item } = state;
    sheet.querySelector('#mart-sheet-title').innerHTML = `${glyphHtml(item)}<span>${esc(item.name || item.label)}</span>`;
    if (item.accent) sheet.style.setProperty('--accent', item.accent); else sheet.style.removeProperty('--accent');   // 담기 단추 색 = 그 글꾸 강조색
    sheet.querySelector('.mart-sheet-meta').innerHTML = `${tagsHtml(item)}<p class="mart-desc">${esc(descOf(item))}</p>${sourceLinks(item)}`;
    const body = sheet.querySelector('.mart-sheet-body');
    body.innerHTML = `<div class="mart-sheet-preview">${item.preview ? previewOf(state) : '<p class="mart-sheet-wait">불러오는 중이에요…</p>'}</div><div class="mart-sheet-inks">${item.preview ? inksHtml(item) : ''}</div>`;   // 11-08 글자색 칩
    if (!item.preview) {
        body.setAttribute('aria-busy', 'true');
        ensureItem(item).then(() => {
            fillCard(state);
            if (sheetState !== state) return;
            body.querySelector('.mart-sheet-preview').innerHTML = previewOf(state);
            syncInks(body.querySelector('.mart-sheet-inks'), item);
            body.scrollTop = 0;
        }, () => { if (sheetState === state) body.querySelector('.mart-sheet-preview').innerHTML = `<p class="mart-sheet-wait">${LOAD_FAIL}</p>`; })
            .finally(() => body.removeAttribute('aria-busy'));
    }
    sheet.querySelector('.mart-sheet-foot').innerHTML = `<div class="mart-sheet-extra">${tasteHtml(item)}${randomMoreHtml()}</div>` + actionsHtml(item);
    syncSheet();
    if (!sheet.open) sheet.showModal();
    body.scrollTop = 0;
    sheet.querySelector('.mart-sheet-x').focus({ preventScroll: true });
}
function syncSheet() {
    const b = sheetState && sheet?.querySelector('.mart-sheet-foot .mart-pick');
    if (!b) return;
    const on = cart.has(entryOf(sheetState).key);
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? '담김' : '<span class="em" aria-hidden="true">🛒</span>담기';   // 담김 = 옅은 파랑 면 + 파란 글자 + ✔(CSS)
}

function card(item) {
    const state = { item, values: { presetColor: item.presetColor, presetAccent: item.presetAccent, presetLabel: item.presetLabel, frameWidth: item.frameWidth ?? 100, frameHeight: item.frameHeight ?? 100 } };
    const el = state.el = document.createElement('article');
    el.className = 'mart-card'; el.dataset.category = item.category || ''; el.dataset.id = item.id;
    if (item.builtin) el.dataset.builtin = '1';   // 「내장」 묶음 거르기(chipGroups match)
    if (kind === 'geulkku') el.dataset.style = styleOf(item);
    if (item.accent) el.style.setProperty('--accent', item.accent);   // 담기 단추 테두리 · 글자 = 그 글꾸 강조색(흰 면 위 4.5:1 이상 · tools/geulkku-accent.mjs)
    el.dataset.text = item._text ?? textOf(item);
    // 글꾸 카드 미리보기: 틀의 머리(제목 · 알약 · 첫 메시지)만 고정 높이로 잘라 보여 주고, 누르면 전체 미리보기 시트(크게 보기). 카드 안에서는 스크롤 · 장식 누르기 없음(inert)
    // 조각을 받기 전에는 「썸네일 글」(틀 바탕색 위 이모지 · 이름) 자리만 — 카드가 화면 가까이 오면 그 조각을 받아 채워요(watchCard)
    const placeholder = `<div class="mart-ph" style="${item.bg ? `--ph-bg:${esc(item.bg)};` : ''}${item.ink ? `--ph-ink:${esc(item.ink)}` : ''}">${glyphHtml(item, '📝')}<b>${esc(item.name || item.label)}</b></div>`;
    const preview = kind === 'frames'
        ? '<div class="mart-preview frame"><div class="mart-fit"></div></div>'
        : `<div class="mart-preview geulkku is-wait" role="button" tabindex="0" data-act="view" aria-haspopup="dialog" aria-label="${esc(item.label)} 크게 보기"><div class="mart-preview-in" inert>${placeholder}</div><span class="mart-zoom-hint tag" aria-hidden="true"><span class="em">🔍</span>크게 보기</span></div>`;
    const params = item.kind === 'frame-preset' ? `<div class="mart-params">
        <label>바탕 <input type="color" data-k="presetColor" value="${esc(item.presetColor)}"></label>
        <label>선 <input type="color" data-k="presetAccent" value="${esc(item.presetAccent)}"></label>
        ${item.presetLabel !== undefined ? `<label>글자 <input type="text" class="field" data-k="presetLabel" maxlength="12" value="${esc(item.presetLabel)}" placeholder="비우면 없음"></label>` : ''}
        <button type="button" class="btn mart-reset" data-act="reset">처음 값</button>
        <label class="mart-range">가로 <input type="range" min="50" max="200" step="5" data-k="frameWidth" value="100"><output>100%</output></label>
        <label class="mart-range">세로 <input type="range" min="50" max="200" step="5" data-k="frameHeight" value="100"><output>100%</output></label>
    </div>` : '';
    const size = item.bytes ? `<small>${item.bytes > 1e6 ? `${(item.bytes / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(item.bytes / 1024))}KB`}</small>` : '';
    el.innerHTML = `${preview}${item.note ? `<p class="mart-note">${esc(item.note)}</p>` : ''}
        <div class="mart-title"><b>${glyphHtml(item)}<span class="t">${esc(item.name || item.label)}</span></b>${tagsHtml(item)}</div>
        <p class="mart-desc">${esc(descOf(item))}${size ? ` · ${size}` : ''}</p>${sourceLinks(item)}${params}
        ${actionsHtml(item)}`;
    el.addEventListener('input', (e) => {
        const k = e.target.dataset.k; if (!k) return;
        state.values[k] = e.target.type === 'range' ? Number(e.target.value) : e.target.value;
        const out = e.target.parentElement.querySelector('output'); if (out) out.textContent = `${e.target.value}%`;
        clearTimeout(state.t); state.t = setTimeout(() => paintFrame(state), e.target.type === 'range' ? 60 : 0);
        syncCard(state);   // 색을 바꾸면 다른 물건(새 id) — 「담기」로 돌아와요
    });
    el.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.mart-preview[data-act=view]')) { e.preventDefault(); openSheet(state); }
    });
    el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act;
        if (act !== 'reset') { doAct(state, act, b); return; }
        {
            state.values = { presetColor: item.presetColor, presetAccent: item.presetAccent, presetLabel: item.presetLabel, frameWidth: item.frameWidth ?? 100, frameHeight: item.frameHeight ?? 100 };
            for (const input of el.querySelectorAll('[data-k]')) { input.value = state.values[input.dataset.k] ?? ''; const out = input.parentElement.querySelector('output'); if (out) out.textContent = `${input.value}%`; }
            paintFrame(state);
            syncCard(state);
        }
    });
    if (kind === 'frames') paintFrame(state);
    else watchCard(state);
    states.push(state); stateById.set(item.id, state);
    syncCard(state);
    return el;
}
/** 찾기 글(이름 · 설명 · 분류 · 묶음 · 그림체 · 꼬리표) — 목록을 받을 때 한 번만 */
function textOf(item) { return [item.name || item.label, item.desc, item.source || '', item.categoryLabel, catLabel(item.category, item.categoryLabel), SEARCH_ALSO[item.category] || '', picker?.groupLabel(item.category) || '', item.builtin ? '내장 테마 내장 블루레몬' : '', kind === 'geulkku' ? styleOf(item) : '', ...(item.tags || [])].join(' ').toLowerCase(); }

// ── 글꾸 카드 미리보기 늦게 채우기 — 화면 가까이(위아래 한 화면쯤) 온 카드만 조각을 받고 틀 HTML 을 그려요(이미 받은 조각이어도 그리기는 보일 때). 걸러져 빠진 카드는 그리지 않아요 ──
const cardOf = new WeakMap();
const seen = 'IntersectionObserver' in globalThis
    ? new IntersectionObserver((list) => { for (const e of list) if (e.isIntersecting) { seen.unobserve(e.target); fillCard(cardOf.get(e.target)); } }, { rootMargin: '600px 0px' })
    : null;
function watchCard(state) {
    const box = state.el.querySelector('.mart-preview.geulkku');
    if (!seen) { fillCard(state); return; }
    cardOf.set(box, state); seen.observe(box);
}
function fillCard(state) {
    if (!state || state.filled) return;
    const box = state.el.querySelector('.mart-preview.geulkku');
    ensureItem(state.item).then(() => {
        if (state.filled) return;
        state.filled = true;
        seen?.unobserve(box);
        box.querySelector('.mart-preview-in').innerHTML = previewOf(state);
        box.classList.remove('is-wait', 'is-fail');
    }, () => { box.classList.add('is-fail'); box.querySelector('.mart-ph b')?.setAttribute('data-fail', '미리보기를 못 받았어요 · 눌러 다시 받아요'); });
}

// ── 담김 표시 ──
function syncCard(state) {
    if (state.item.builtin || state.item.copyOnly) return;   // 내장 글꾸 · HTML 복사만 하는 틀은 담지 않아요
    const on = cart.has(entryOf(state).key);
    const b = state.el.querySelector('.mart-pick');
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? '담김' : '<span class="em" aria-hidden="true">🛒</span>담기';
    b.title = on ? '다시 누르면 장바구니에서 빼요' : '장바구니에 담기';
    state.el.classList.toggle('is-picked', on);
}
cart.onChange(() => { states.forEach(syncCard); syncSheet(); });

function applyFilter() {
    const q = (search.value || '').trim().toLowerCase();
    const list = allItems.filter(item => (!picker || picker.match(item.category, !!item.builtin)) && (styleActive === 'all' || styleOf(item) === styleActive) && (!q || item._text.includes(q)));
    const shown = list.length;
    cards.set(list);   // 첫 화면 몫만 카드로 · 나머지는 빈 칸(스크롤 가까이 오면 묶음으로)
    const count = document.querySelector('.mart-count');
    if (count) count.textContent = `${shown}개`;
    const narrowed = styleActive !== 'all' || (picker && (picker.sel.group !== 'all' || picker.sel.cat !== 'all'));
    if (!shown) grid.insertAdjacentHTML('beforeend', `<p class="mart-empty">맞는 것이 없어요${narrowed ? ' · 거르기를 풀어 보세요' : ''}</p>`);
}
async function main() {
    if (kind === 'frames') {
        try { ({ drawPreset } = await import('./frame-presets.js')); } catch { drawPreset = null; }
    }
    // 글꾸: 가벼운 목록(index.json)만 — 미리보기 · 받기 칸은 조각(chunks)에서 나중에
    const res = await fetch(new URL(kind === 'geulkku' ? './data/geulkku/index.json' : `./data/${kind}.json`, import.meta.url), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`목록 ${res.status}`);
    const data = await res.json();
    const items = data.items || [];
    if (kind === 'geulkku') {
        chunkFiles = data.chunks || {};
        const labels = new Map((data.categories || []).map(c => [c.id, c.label]));
        for (const x of items) Object.assign(x, { kind: 'geulkku', label: x.label || x.name, categoryLabel: x.categoryLabel || labels.get(x.category) || '' });
    }
    // 분류 두 단계(공용 부품): 묶음 탭(시리즈 · 세계관 · 인물 · 컨셉 · 할로윈 · 크리스마스 · 내장) + 하위 칩
    const cats = (data.categories || []).map(c => ({ id: c.id, label: catLabel(c.id, c.label), n: items.filter(x => x.category === c.id).length, group: kind === 'geulkku' ? geulkkuGroup(c, items) : (c.group || 'etc') })).filter(c => c.n);
    // 「내장」 묶음에 다른 분류 안의 내장 글꾸(내장 심플 30)도 한 칩으로 — 가짜 칩 BUILTIN_MORE
    const builtinCats = new Set(cats.filter(c => c.group === 'builtin').map(c => c.id));
    const moreBuiltin = items.filter(x => x.builtin && !builtinCats.has(x.category)).length;
    if (moreBuiltin) cats.push({ id: BUILTIN_MORE, label: '내장 심플', n: moreBuiltin, group: 'builtin' });
    picker = chipGroups({ groupsEl: document.querySelector('.mart-groups'), chipsEl: chips, cats, groups: GEULKKU_GROUPS, total: items.length, onChange: applyFilter });
    // 그림체(글꾸): 둘 이상일 때만 칩 줄을 보여요 — 하나뿐(지금은 기본만)이면 줄째 숨겨요
    const styleSeg = document.querySelector('[data-filter="style"]');
    if (styleSeg) {
        // 차례는 늘 심플 → 일러스트 → 다꾸 → 무테(모르는 그림체는 자료 차례대로 그 뒤)
        const styles = (data.styles || []).map(s => ({ ...s, id: STYLE_ALIAS[s.id] || s.id, label: STYLE_ALIAS[s.label] || s.label })).filter(s => items.some(x => styleOf(x) === s.id)).map((s, i) => [s, STYLE_ORDER.includes(s.id) ? STYLE_ORDER.indexOf(s.id) : STYLE_ORDER.length + i]).sort((a, b) => a[1] - b[1]).map(([s]) => s);
        const row = styleSeg.closest('.mart-filters') || styleSeg;
        row.hidden = styles.length < 2;
        showStyle = styles.length >= 2;
        if (styles.length >= 2) {
            styleSeg.innerHTML = segHtml([['all', '모든 디자인'], ...styles.map(s => [s.id, s.label])], 'all');
            styleSeg.firstElementChild.innerHTML = '<span class="mart-seg-long">모든 디자인</span><span class="mart-seg-short">전체</span>';   // 폰은 찾기 칸과 한 줄이라 「전체」
            wireSeg(styleSeg, (v) => { styleActive = v; applyFilter(); });
            const narrow = matchMedia('(max-width:639px)');
            const hint = () => { search.placeholder = narrow.matches ? '찾기' : '이름 · 설명 · 디자인으로 찾기'; };
            hint(); narrow.addEventListener?.('change', hint);
        }
    }
    search.addEventListener('input', applyFilter);
    // 「📝 내 로그로 보기」 — 켜 둔 채 왔으면 카드를 그리기 전에 로그 도구를 받아 둬요
    document.querySelector('.mart-mylog')?.addEventListener('click', openMylog);
    let mylogOn = false; try { mylogOn = sessionStorage.getItem(MYLOG_KEY) === '1'; } catch { /* 저장이 막힌 창 */ }
    if (mylogOn) await setMylog(true); else loadTaste().then(m => { mylog.mod = m; paintMylogChip(); }, () => {});
    allItems = items;
    for (const x of items) x._text = textOf(x);
    cards = lazyGrid(grid, cardEl);
    applyFilter();
    grid.setAttribute('aria-busy', 'false');
    const h = decodeURIComponent(location.hash.slice(1));
    const hit = h && items.find(x => x.id === h);
    // ?view=1#글꾸id — 그 글꾸의 크게 보기 창을 바로 열어요(지니 결과 카드 「🔍 크게 보기」가 와요) · 목록은 그 자리까지 만들지 않아요
    if (hit && new URLSearchParams(location.search).has('view')) openSheet(stateOf(hit));
    else if (hit && cards.reveal(hit)) stateOf(hit).el.scrollIntoView({ block: 'center' });   // #글꾸id: 그 카드까지 만들고 굴러 가요
    document.querySelector('.mart-random')?.addEventListener('click', pickRandom);
    if (new URLSearchParams(location.search).has('random')) pickRandom();   // 홈 「🎲 오늘의 글꾸」
    // 시험용(?mart-test&mylog-text=…): 로그를 넣고 내 로그로 보기를 켜요
    const testParams = new URLSearchParams(location.search);
    if (testParams.has('mart-test') && testParams.get('mylog-text')) { const m = await loadTaste(); m.store.save({ ...m.store.load(), text: testParams.get('mylog-text'), swap: testParams.get('mylog-swap') === '1', fields: { title: testParams.get('mylog-title') ?? '', date: testParams.get('mylog-date') ?? '' }, showNames: testParams.has('mylog-names') ? testParams.get('mylog-names') === '1' : null }); m.headStore.save({ title: testParams.get('mylog-title') ?? '', char: testParams.get('mylog-char') ?? '', model: testParams.get('mylog-model') ?? '', prompt: testParams.get('mylog-prompt') ?? '', hidePills: testParams.get('mylog-pills') === '0', hideTitle: testParams.get('mylog-title-on') === '0', hideTop: testParams.get('mylog-top') === '0', hideBottom: testParams.get('mylog-bottom') === '0' }); await setMylog(true); globalThis.martMylog = { html: id => previewOf(stateOf(items.find(x => x.id === id))), on: () => mylog.on }; if (testParams.get('mylog-id')) { const it = items.find(x => x.id === testParams.get('mylog-id')); const st = it && stateOf(it); if (st) { await ensureItem(st.item); const out = document.createElement('script'); out.type = 'text/plain'; out.id = 'mylog-out'; out.textContent = previewOf(st); document.body.append(out); } } }
    // 시험용(?mart-test&taste=<글꾸 id>): 그 글꾸의 상세 창 · 시식 창을 바로 열어요(taste-text · taste-swap · taste-title · taste-date) — 헤드리스 캡처가 써요
    const params = new URLSearchParams(location.search);
    if (params.has('mart-test') && params.get('taste')) {
        const it = items.find(x => x.id === params.get('taste')), state = it && stateOf(it);
        if (state) {
            globalThis.martTaste = { html: '' };
            openSheet(state);
            if (params.has('taste-names')) { const m = await loadTaste(); m.store.save({ ...m.store.load(), text: params.get('taste-text') ?? '', showNames: params.get('taste-names') === '1' }); }
            await openTaste(state, { text: params.has('taste-names') ? undefined : (params.get('taste-text') ?? undefined), swap: params.has('taste-swap') ? params.get('taste-swap') === '1' : undefined, fields: { title: params.get('taste-title') ?? '', date: params.get('taste-date') ?? '' } });
            if (params.get('taste-steps')) { try { (await loadTaste()).tasteTest.run(JSON.parse(params.get('taste-steps'))); } catch (e) { globalThis.martTaste.error = String(e); } }   // 미리보기 편집 · 되돌리기 흉내
            const out = document.createElement('script'); out.type = 'text/plain'; out.id = 'taste-out'; out.textContent = globalThis.martTaste.html; document.body.append(out);   // --dump-dom 으로 읽어요
        }
    }
}
// 액자 마트: 수백 종 · 내 사진 넣어 보기 · 거르기 · 조금씩 그리기(frame-room.js) — 받기 · 장바구니는 여기 것을 그대로 써요
const start = kind === 'frames'
    ? import('./frame-room.js?v=20261108c').then(m => m.start({ grid, search, chips, esc, asset, entryOf, copyEntries, cart, say, artName, saveArt, sourceLinks, KIND_LABEL, segHtml, wireSeg, chipGroups, isBuiltin, BUILTIN_TAG, lazyGrid }))
    : kind === 'geulkku' ? main() : null;   // 그 밖의 페이지(지니)는 아래 부품만 빌려 써요
start?.catch(e => { grid.innerHTML = `<p class="mart-empty">목록을 못 불러왔어요 · ${esc(e.message)}</p>`; });

// ── 지니(genie/) 가 빌려 쓰는 부품 — 목록 · 조각 받기 · 카드 미리보기 · 담기 · 복사는 마트와 같은 길이에요 ──
/** 글꾸 목록(index.json)을 받아 마트와 같은 모양으로 다듬고, 「📝 내 로그로 보기」가 켜져 있으면 로그 도구를 받아 둬요 */
export async function geulkkuList() {
    const res = await fetch(new URL('./data/geulkku/index.json', import.meta.url), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`목록 ${res.status}`);
    const data = await res.json();
    chunkFiles = data.chunks || {};
    const labels = new Map((data.categories || []).map(c => [c.id, c.label]));
    for (const x of data.items || []) Object.assign(x, { kind: 'geulkku', label: x.label || x.name, categoryLabel: x.categoryLabel || labels.get(x.category) || '' });
    showStyle = new Set((data.items || []).map(styleOf)).size >= 2;
    let on = false; try { on = sessionStorage.getItem(MYLOG_KEY) === '1'; } catch { /* 저장이 막힌 창 */ }
    if (on) { try { mylog.mod = await loadTaste(); mylog.on = !!mylog.mod.hasLog(); } catch { mylog.on = false; } }
    return data;
}
/** 프레임 방(frame-room.js)의 지니용 준비 — 마트 액자 카드와 같은 그림 · 같은 담기 값 */
export const frameKit = () => import('./frame-room.js?v=20261108c').then(m => m.kit({ esc, asset, entryOf, copyEntries, cart, say, artName, saveArt, sourceLinks, KIND_LABEL, segHtml, wireSeg, chipGroups, isBuiltin, BUILTIN_TAG, lazyGrid }));
export const mylogOn = () => mylog.on;
export { isBuiltin, BUILTIN_TAG, cart, say, esc, asset, ensureItem, previewOf, tagsHtml, glyphHtml, iconSrc, descOf, catLabel, styleOf, entryOf, receipt, doAct, copyEntries, copyHtml, sourceLinks, LOAD_FAIL };
