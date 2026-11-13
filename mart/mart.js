// 블루 레몬에이드 마트 — 전시 · 담기(장바구니 · cart.js) · 하나만 바로 복사. 데이터는 data/*.json(테마 저장소 tools/mart-build.mjs 산출물).
// 심플 액자는 테마 frame-presets.js 사본으로 브라우저에서 바로 그리고(색 · 글자 · 비율을 바꿔 본 값 그대로 받아요), 그림 액자는 썸네일 + 받기 파일.
// 받는 것은 코드가 아니라 데이터예요: { "bl-mart": 1, "items": [...] } — 테마 설정 「마트에서 가져오기」가 검사하고 넣어요.
// 글꾸는 나눠 받아요: 가벼운 목록 data/geulkku/index.json 만 먼저 받고, 미리보기 · 받기 칸은 그림체 × 분류 조각을 카드가 보일 때 · 누를 때 받아요.
const kind = document.body.dataset.mart;              // 'frames' | 'geulkku'
const grid = document.querySelector('.mart-grid');
const search = document.querySelector('.mart-tools input[type=search]');
const chips = document.querySelector('.mart-chips');
// 11-11 즐겨찾기 · 최근 틀(글꾸 · 테마 로그 복사 logCopy.fav · recent 꼴 — 즐겨찾기 96개 · 최근 5개 · 이 기기에만 기억)
const LIKE_KEY = 'bl-mart-geulkku-like-v1';
const like = (() => { let v = null; try { v = JSON.parse(localStorage.getItem(LIKE_KEY) || 'null'); } catch { /* 저장이 막힌 창 */ } const ids = a => (Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && x && x.length < 80))] : []); return { fav: ids(v?.fav).slice(0, 96), recent: ids(v?.recent).slice(0, 5) }; })();
const saveLike = () => { try { localStorage.setItem(LIKE_KEY, JSON.stringify(like)); } catch { /* 이 화면에서만 */ } };
const LIKE_CHIPS = { fav: '★ 즐겨찾기', recent: '최근' };
import { cart, say, onCheckout, artName, saveArt, layerHost } from './cart.js?v=20261113p';
import { lemonHtml, lemonize } from './lemon.js?v=20261109a';   // 11-09 레몬 하나 — 🍋 대신 테마와 같은 레몬 그림(lemon.svg)
import { inkChanged, colorsOf, setInk, resetInks, inksHtml, paintDot, syncInks } from './inks.js?v=20261108a';   // 11-08 글꾸 글자색 팔레트
import './colorpop.js?v=20261108c';   // 11-08 색 칸을 누르면 테마와 같은 색 고르기(폰 기본 창 대신)
import { toneHtml, toneItem, kkangtongReady } from './tone-geulkku.js?v=20261110v';   // 11-10 대사색 하나로 다시 칠하기 · 깡통에 붙일 꼴(인라인 url( → <style> · 글자색 fill)
import { toneState, toned, toneOut, toneKey, CAST_GROUPS } from './tone-state.js?v=20261113a';   // 11-10 목록 위 「캐릭터」에서 고른 캐릭터 대사색 · 밤낮
import { simpleReady } from './simple-frames.js?v=20261112b';   // 11-11 심플 새 틀 — HTML 복사는 틀 <style> 과 마트 규칙을 하나로
import { GRID_PATTERN_ENABLED, gridOff } from './grid-off.js?v=20261110w';   // 11-10 밤 틀 디자인 격자 끔(깃발 한 곳 — grid-off.js)
import { WORKS, CHAR_WORKS, ADRIAN_WORKS, workByTitle, sourceHtml, creditsHtml, itemSources, worldOf, WORLDS, worldSources } from './sources.js?v=20261113p';   // 11-12 밤 원작(출처) 자료 한 곳
import { mountCast, pickedCreditHtml, dayNightHtml } from './cast.js?v=20261113p';                // 11-10 캐릭터 고르기(세계관 묶음 · 꺽쇠 · 라디오)
import { frameMarkdown } from './mine-text.js?v=20261112f';   // 11-11 글만 복사(마크다운)
import { makeSet } from './geulkku-set.js?v=20261112e';   // 11-12 설정 꼴 blGeulkku 2
import { addToggle } from './day-night.js?v=20261113p';   // 11-13 낮 · 밤 전환(허브 지시-1112/낮밤-전환-마트/전환.mjs 와 글자까지 같은 사본)
import { lookNow } from './look.js?v=20261112a';
import { motionNow } from './motion-state.js?v=20261112a';
import { texNow } from './texture.js?v=20261112a';
import { shapeNow } from './shape.js?v=20261112a';   // 11-12 모양 · 색 더하기 — 테마로 담기 설정에
import { tuneOf } from './tune.js?v=20261112f';
import { tuneHtml, mineBoxHtml, syncTune, syncMine, wireTune, armEdit, stopEdit, viewSegHtml, setFlipInfo } from './tune-ui.js?v=20261113q';
setFlipInfo(item => flipInfo(item));
import { wrapHtml } from './word-wrap.js?v=20261113q';   // 11-13 본문 줄바꿈 글자 단위(기본) · 단어 단위 — 테마 src/log-copy-wrap.js 와 글자까지 같은 사본
import { wrapState } from './wrap-state.js?v=20261113q';
import { wireSelectHide } from './select-hide.js?v=20261112e';   // 11-12 미리보기에서 글을 고르면 옆에 뜨는 막대(눌러야 보이게 · 숨김 풀기 · 굵게 · 기울임)
import { themeTakeable } from './theme-take.js?v=20261113p';   // 11-12 테마가 이 틀을 받는지(테마 받기 검사를 옮긴 것 · 목록 틀은 index.json nt · 내 글꾸는 여기서)
import { ownList, ownItem, addOwn, forgetOwn, setOwnPath, cleanOwn, kkLint, scopePreview, fillSlot, OWN_CAT, OWN_MAX, OWN_BYTES } from './own.js?v=20261112a';   // 11-12 「내 글꾸」 — 남이 만든 글꾸 HTML 붙여 넣기
import { sanitizeHtml, guessSlot, fromPath, slotPath } from './lib/log-copy/log-copy-sanitize.js';
import { mineModelNow } from './mine-text.js?v=20261112f';
import { markEdits, HIDDEN_LINE_FRAMES, simpleFrameInfo } from './simple-frames.js?v=20261112b';
import { withCommentSlots } from './lib/log-copy/log-copy-lift.js';   // 11-11 크게 보기 「조절」 칸(색 칩 · 글 고치기 · 내 글꾸)
let styleActive = 'all', drawPreset = null, picker = null;
const states = [];   // 만든 카드만(글꾸) — 늦게 만들기(lazyGrid)라 처음엔 첫 화면 몫뿐이에요
const stateById = new Map();
let allItems = [], cards = null;   // 글꾸 목록 전부 · 카드 늦게 만들기(lazyGrid)

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// 11-13 그림 액자를 다시 그리며 파일 이름은 그대로 뒀어요(깡통 글 · 남의 글이 걸어 둔 옛 주소가 새 그림을 보여 주게) — 이름이 같으니 마트 안에서는 꼬리로 캐시만 갈아요. 그림을 또 바꾸면 이 꼬리를 올려요.
const FRAMES_V = '20261113a';
const asset = p => new URL(p, import.meta.url).href + (/^data\/frames\//.test(p) ? `?v=${FRAMES_V}` : '');   // data/… 는 mart/ 기준
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
        swap(from, to) { const i = list.indexOf(from); if (i >= 0) list[i] = to; },   // 11-10 컨셉 카드 안에서 디자인을 바꿀 때 그 자리 항목만 바꿔요
        get list() { return list; },
    };
}
// ── 공용 부품: 분류 두 단계 — 묶음 탭 한 줄(.mart-groups) + 하위 칩 한 줄(.mart-chips · 폰은 가로로 밀어 봐요 · PC 는 펼침) ──
// 글꾸 · 액자 마트가 같이 써요(mart.css). cats: [{ id, label, n, group }] · groups: [{ id, label }] — 쓰는 묶음이 둘 미만이면 탭 줄을 숨겨요.
// 숫자는 <span class="mart-n"> 로 작고 옅게. 고른 값은 match(분류 id) 로 물어봐요.
const numHtml = n => `<span class="mart-n n">${n}</span>`;   // 글자 뒤 흐름 안(배지 아님 · 13 · 보조색)
function chipGroups({ groupsEl, chipsEl, cats, groups = [], total, onChange, extra = null }) {
    const sel = { group: 'all', cat: 'all' };
    const used = groups.map(g => ({ ...g, cats: cats.filter(c => c.group === g.id) })).filter(g => g.cats.length);
    const sum = list => list.reduce((n, c) => n + c.n, 0);
    const groupOf = new Map(cats.map(c => [c.id, c.group]));
    const withGroups = !!groupsEl && used.length >= 2;
    if (groupsEl) groupsEl.hidden = !withGroups;
    const btn = (attr, id, label, n, on) => `<button type="button" class="${attr === 'group' ? 'tab' : 'chip'}" data-${attr}="${esc(id)}" aria-pressed="${on}">${attr === 'group' ? `<span class="tab-t">${esc(label)}</span>` : esc(label)}${numHtml(n)}</button>`;
    let paintChips = () => {
        const g = used.find(x => x.id === sel.group);
        const list = g ? [['all', '모두', sum(g.cats)], ...g.cats.map(c => [c.id, c.label, c.n])] : [['all', '전체', total], ...(extra?.() || []), ...cats.map(c => [c.id, c.label, c.n])];
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
        count: (id, n) => { const el = chipsEl.querySelector(`[data-cat="${id}"] .mart-n`); if (el) el.textContent = n; },   // 11-11 즐겨찾기 · 최근 숫자만 고쳐요(칩 줄을 다시 그리지 않아요)
        match: (category, builtin = false) => {
            if (sel.cat in LIKE_CHIPS) return true;   // 즐겨찾기 · 최근은 applyFilter 가 id 로 걸러요
            if (sel.cat === BUILTIN_MORE) return builtin && groupOf.get(category) !== 'builtin';
            if (sel.cat !== 'all') return category === sel.cat;
            return sel.group === 'all' || groupOf.get(category) === sel.group || (builtin && sel.group === 'builtin');
        },
    };
}
// ── 11-12 밤 글꾸 분류: 주제 묶음 탭(.mart-groups) + 하위 칩(.mart-topics) + 세계관 머리 띠(.mart-band) + 보조 거르기 줄(.mart-chips — 즐겨찾기 · 최근 · 내 글꾸 · 누름 방식) ──
//   사용자 「글꾸 카테고리에 뭐 일상 이벤트 예전에 있던 카테고리 가져오고 지금은 인물 출처도 빠지고 그 세계관 인물들 한꺼번에 보는 것도 없잖아」
//   분류 값은 목록 자료(index.json 항목 topic · world · who · 묶음은 topics)에서 와요 — 여기에 틀 id 를 박지 않아요. 주제 × 보조 거르기를 같이 걸 수 있어요.
//   「세계관 · 인물」에서 세계관 하나를 고르면 목록 머리에 띠(이름 · 틀/인물 수 · 원작 글 전부 · 인물 칩)가 뜨고, 인물 칩을 누르면 그 인물 틀만 남아요.
const SOUND_CAT = 'simple-sound';   // 보조 거르기 「소리 · 음악」 — 소리 줄이 든 틀(item.audio · 닫힌 채 시작하는 틀도 같이)
function topicPicker({ groupsEl, topicsEl, chipsEl, bandEl, items, groups, cats, onChange, extra }) {
    const sel = { group: 'all', topic: 'all', who: null, cat: 'all' };   // who: null 전부 · '' 인물 없는 세계관 틀 · 이름
    const groupOf = new Map(groups.flatMap(g => g.chips.map(c => [c, g.id])));
    const inTopic = x => sel.group === 'all' || (groupOf.get(x.topic) === sel.group && (sel.topic === 'all' || x.topic === sel.topic));
    const inWho = x => sel.who === null || (sel.who === '' ? !x.who : x.who === sel.who);
    const inCat = (x, cat = sel.cat) => cat === 'all' || cat in LIKE_CHIPS || cat === OWN_CAT || (cat === SOUND_CAT ? !!x.audio : x.category === cat);
    const count = f => items.reduce((n, x) => n + (f(x) ? 1 : 0), 0);
    const btn = (cls, attr, id, label, n, on, color = '') => `<button type="button" class="${cls}" data-${attr}="${esc(id)}" aria-pressed="${on}">${color ? `<i class="mart-ink-dot mart-cast-dot" style="background:${esc(color)}" aria-hidden="true"></i>` : ''}${cls === 'tab' ? `<span class="tab-t">${esc(label)}</span>` : esc(label)}${numHtml(n)}</button>`;
    const world = () => (sel.group === 'world' && sel.topic !== 'all' ? WORLDS.find(w => w.label === sel.topic) || null : null);
    const paintGroups = () => { groupsEl.innerHTML = [btn('tab', 'group', 'all', '전체', items.length, sel.group === 'all'), ...groups.map(g => btn('tab', 'group', g.id, g.label, count(x => groupOf.get(x.topic) === g.id), sel.group === g.id))].join(''); };
    const paintTopics = () => {
        const g = groups.find(x => x.id === sel.group);
        topicsEl.hidden = !g;
        topicsEl.innerHTML = g ? [btn('chip', 'topic', 'all', '모두', count(x => groupOf.get(x.topic) === g.id), sel.topic === 'all'), ...g.chips.map(c => btn('chip', 'topic', c, c, count(x => x.topic === c), sel.topic === c))].join('') : '';
        topicsEl.scrollLeft = 0;
    };
    /** 보조 거르기 줄 — 숫자는 지금 고른 주제 안에서 센 값(즐겨찾기 · 최근 · 내 글꾸는 전체) · 고른 칩을 다시 누르면 풀려요 */
    const paintCats = () => {
        const base = items.filter(x => inTopic(x) && inWho(x));
        chipsEl.innerHTML = [...extra().map(([id, label, n]) => btn('chip', 'cat', id, label, n, sel.cat === id)), '<span class="mart-chips-sep" aria-hidden="true"></span>', ...cats.map(c => btn('chip', 'cat', c.id, c.label, base.filter(x => inCat(x, c.id)).length, sel.cat === c.id))].join('');
    };
    const paintBand = () => {
        const w = world();
        bandEl.hidden = !w;
        if (!w) { bandEl.innerHTML = ''; return; }
        const list = items.filter(x => x.world === w.id), cast = CAST_GROUPS.find(g => g.id === w.group)?.cast || [];
        const people = cast.map(c => ({ ...c, n: list.filter(x => x.who === c.name).length })).filter(c => c.n);
        const plain = list.filter(x => !x.who).length;
        bandEl.innerHTML = `<div class="mart-band-h"><h2>${esc(w.label)}</h2><span class="mart-band-n">틀 ${list.length} · 인물 ${people.length}</span>${worldSources(w.id).map(s => sourceHtml(s)).join('')}</div>
            <div class="mart-band-people" role="group" aria-label="${esc(w.label)} 인물">${plain ? btn('chip', 'who', '', '세계관', plain, sel.who === '') : ''}${people.map(c => btn('chip', 'who', c.name, c.name, c.n, sel.who === c.name, c.color)).join('')}</div>`;
    };
    const edge = () => { for (const el of [groupsEl, topicsEl, chipsEl]) el.classList.toggle('has-more', el.scrollLeft + el.clientWidth < el.scrollWidth - 2); };
    const paint = () => { paintGroups(); paintTopics(); paintBand(); paintCats(); edge(); };
    const keep = (el, q) => { const b = el.querySelector(q); b?.focus({ preventScroll: true }); b?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); };
    groupsEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-group]'); if (!b) return; Object.assign(sel, { group: b.dataset.group, topic: 'all', who: null }); paint(); keep(groupsEl, '[aria-pressed="true"]'); onChange(); });
    topicsEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-topic]'); if (!b) return; Object.assign(sel, { topic: b.dataset.topic, who: null }); paint(); keep(topicsEl, '[aria-pressed="true"]'); onChange(); });
    bandEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-who]'); if (!b) return; const id = b.dataset.who; sel.who = sel.who === id ? null : id; paintBand(); paintCats(); keep(bandEl, `[data-who="${CSS.escape(id)}"]`); onChange(); });
    chipsEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-cat]'); if (!b) return; const id = b.dataset.cat; sel.cat = sel.cat === id ? 'all' : id; paintCats(); keep(chipsEl, `[data-cat="${CSS.escape(id)}"]`); onChange(); });
    for (const el of [groupsEl, topicsEl, chipsEl]) el.addEventListener('scroll', edge, { passive: true });
    addEventListener('resize', edge);
    paint();
    foldChips(chipsEl, groupsEl);
    foldBar(chipsEl.closest('.mart-tools'));
    return {
        sel,
        groupLabel: () => '',
        count: (id, n) => { const el = chipsEl.querySelector(`[data-cat="${id}"] .mart-n`); if (el) el.textContent = n; },
        /** 그 항목이 지금 거르기에 맞는지 — 내 글꾸(남의 HTML)는 주제가 없어 주제 거르기를 안 타요 */
        match: (category, builtin, item) => sel.cat === OWN_CAT || !item || (inTopic(item) && inWho(item) && inCat(item)),
        /** 세계관 하나 한꺼번에 보기(캐릭터 칸 「이 세계관 틀 N 보기 →」) */
        openWorld: (id) => {
            const w = worldOf(id); if (!w) return;
            Object.assign(sel, { group: 'world', topic: w.label, who: null, cat: sel.cat === OWN_CAT ? 'all' : sel.cat });
            paint(); onChange();
            bandEl.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
        },
        worlds: () => WORLDS.map(w => ({ id: w.id, label: w.label, group: w.group, n: count(x => x.world === w.id) })),
        /** 주소로 분류 열기(홈 진열대 칩 → mart/geulkku/?g=event&t=할로윈) — g = 묶음 id(daily · event · screen · world · basic) · t = 하위 칩 이름(없거나 모르면 그 묶음 전부). 모르는 묶음이면 false */
        open: (group, topic = 'all') => {
            const g = groups.find(x => x.id === group); if (!g) return false;
            Object.assign(sel, { group, topic: g.chips.includes(topic) ? topic : 'all', who: null });
            paint(); onChange(); return true;
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
    const parts = [...tools.querySelectorAll('.mart-groups, .mart-topics, .mart-chips, .mart-filters')];
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
        const top = tools.querySelector('.mart-topics:not([hidden]) [aria-pressed="true"]');   // 11-12 밤 글꾸: 주제 묶음 → 하위 칩(고른 것) + 보조 거르기
        if (top) { out.push(labelOf(top.dataset.topic !== 'all' ? top : grp)); if (cat) out.push(labelOf(cat)); }
        else if (cat && cat.dataset.cat !== 'all') out.push(labelOf(cat));
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
    tools.addEventListener('click', (e) => { if (e.target.closest('[data-filter] button, .mart-groups button, .mart-topics button, .mart-chips button')) paint(); });
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
/** 머리말: 접힌 동안은 제목 + 「쓰는 법 ⌄」(액자 마트는 「받는 법」)만 — 누르면 설명 · 쓰는 법 칸(.mart-head-help)이 펼쳐져요(11-12 밤 사용자 「차라리 글을 없애고 자세히 누르면 설명 나오게」 · 「쓰는 법이 제일 밑에 있는 것도 의아함」) */
function wireHead() {
    const head = document.querySelector('.mart-head'), h1 = head?.querySelector('h1'), help = head?.querySelector('.mart-head-help');
    if (!h1 || !help || head.querySelector('.mart-head-more')) return;
    help.id ||= 'mart-head-help';
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'mart-head-more chev', textContent: help.dataset.label || '쓰는 법' });
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', help.id);
    b.addEventListener('click', () => { const on = head.classList.toggle('is-open'); b.setAttribute('aria-expanded', String(on)); });
    h1.after(b);
}
wireHead();
// 글꾸 묶음 — 자료 categories[].group 이 있으면 그것, 없으면 내장(builtin) · 항목 id 머리(s · c · world · char · halloween)로 정해요
const GEULKKU_GROUPS = [{ id: 'series', label: '시리즈' }, { id: 'world', label: '세계관' }, { id: 'char', label: '인물' }, { id: 'concept', label: '컨셉' }, { id: 'halloween', label: '할로윈' }, { id: 'christmas', label: '크리스마스' }, { id: 'builtin', label: '내장' }, { id: 'etc', label: '기타' }];
// 「내장」 묶음의 가짜 칩 — 기념일 · 사물 · 장르 분류에 섞인 테마 내장 심플 글꾸 30종을 한데 모아요(분류 id 가 아니라 항목의 builtin 으로 걸러요)
const BUILTIN_MORE = 'builtin-more';
/** 테마(1.0.1)에 이미 들어 있는 것 — 글꾸는 자료의 builtin(내장 심플 30 · 로그 복사 기본 틀 19 · tools/geulkku-builtin.mjs), 액자는 심플 액자(frame-preset) 30 전부(1.1.4 부터 30 · 판 8)(테마 src/frame-presets.js FRAME_PRESETS 와 같아요) */
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
const SHOW_ALL_DESIGNS = new URLSearchParams(location.search).has('all-designs');   // 11-10 숨긴 디자인까지 보기(관리용 · ?all-designs)
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
        if (!GRID_PATTERN_ENABLED) for (const k of ['preview', 'template']) item[k] = gridOff(item.id, item[k]);   // 틀 디자인 격자 끔(grid-off.js 깃발)
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
    // 11-10 대사색을 골랐으면 그 색으로 다시 칠한 틀을 받아요(기본 것을 덮지 않게 id 꼬리)
    const tn = item.kind === 'geulkku' && toned(item) && item.template ? toneItem({ ...item, colors: colorsOf(item) }, toneState.k, { mode: toneState.mode, paper: toneState.paper }) : null;
    if (tn) return { kind: 'geulkku', id: `${item.id}-k${toneState.k ? toneState.k.slice(1) : 'none'}${toneState.mode[0]}`, label: item.label, emoji: item.emoji, template: tn.template, colors: tn.colors, messages: item.messages, tail: item.tail, ...(item.type ? { type: item.type } : {}) };
    if (item.kind === 'geulkku') return { kind: 'geulkku', id: item.id, label: item.label, emoji: item.emoji, template: item.template, colors: colorsOf(item), messages: item.messages, tail: item.tail, ...(item.type ? { type: item.type } : {}) };   // type: 제목 꼴(테마 mart-import 가 읽어요)
    return null;   // 그림 액자: 받기 파일을 그대로
}
/** 장바구니 한 줄 — 받을 데이터(receipt) 또는 그림 액자 받기 파일 주소, 서랍에 보일 이름 · 크기 */
let frameMod = null;   // 액자 방 모듈(받은 뒤) — 장바구니 줄의 액자 원작 줄에 써요
/** 11-12 밤 장바구니 줄에 실을 원작: [{ kind, title, url }] — 카드에 뜨는 원작 줄(글꾸 sourceLinks · 액자 frameLinks)을 그대로 읽어요 */
const sourcesOf = (item) => {
    const html = item.kind === 'geulkku' ? sourceLinks(item) : (frameMod?.frameLinks ? frameMod.frameLinks(item) : sourceLinks(item));
    return [...html.matchAll(/<a class="mart-source" href="(https:\/\/kkangtong\.xyz\/posts\/\d+)"[^>]*>🔗 ([^<·]+) · ([^<]*)<\/a>/g)].map(m => ({ kind: m[2].trim(), title: m[3].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"), url: m[1] }));
};
function entryOf(state) {
    const item = state.item, own = receipt(state);
    const base = { kind: item.kind, id: own?.id || item.id, key: `${item.kind}:${own?.id || item.id}`, name: own?.name || item.name || item.label, label: KIND_LABEL[item.kind], emoji: item.emoji || (item.kind === 'geulkku' ? '📝' : '🖼️'), ...((src => (src.length ? { src } : {}))(sourcesOf(item))), ...(item.kind === 'geulkku' && item.icon && !String(item.icon).startsWith('data:') ? { icon: `data/geulkku/${item.icon}` } : {}), href: asset(`${item.kind === 'geulkku' ? 'geulkku' : 'frames'}/#${item.id}`) };   // 마트 밖(지니)에서 담아도 제 마트로 돌아가요
    if (own) return { ...base, receipt: own, bytes: JSON.stringify(own).length, bg: item.colors?.bg };
    // 그림 액자(마트 팩 컬렉션): 받기 그림 주소만 두고 받는 순간 PNG 로 만들어요(frameReceipt)
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
            layerHost().append(area); area.select();   // 11-12 열린 창 밖(body)은 inert 라 골라지지 않아요
            const ok = document.execCommand('copy'); area.remove();
            if (ok) { if (!quiet) say('복사했어요'); return true; }
        } catch { /* 아래 */ }
        say('복사가 막혔어요 · 장바구니의 「📦 받기」로 받아 주세요', 3200);
        return false;
    }
}
/** 11-09 미리보기로만 펼친 상자(닫힌 채 시작하는 반응 글꾸 봉투 · 초대장 — 테마 drawTemplate 이 단 data-bl-peek)를 복사 글에서 다시 닫아요: 붙인 곳에서는 닫힌 채 시작해 누르면 열려요 */
export const shutPeek = html => String(html ?? '').replace(/<details\b[^>]*\sdata-bl-peek=""[^>]*>/g, tag => tag.replace(/\sopen(?:="[^"]*")?(?=[\s>])/, '').replace(/\sdata-bl-peek=""/, ''));
/** 글꾸 「HTML 복사」 — 테마 없이 커뮤니티 글(인라인 스타일만 · 스크립트 금지 편집기)에 바로 붙여 쓰는 완성 HTML. 미리보기에 보이는 것과 같아요.
 *  서식(text/html) + 그 코드 글자(text/plain)를 같이 넣어요 — 보통 편집기엔 모양 그대로, HTML 칸엔 코드로 붙어요 */
/** 11-11 「HTML 복사」 · 내려받기 · 글만 복사가 같이 쓰는 완성 HTML(복사 글과 같은 길) */
function readyHtml(state) {
    const item = state.item;
    return ensureItem(item).then(() => (inkChanged(item) && !tasteLoaded ? loadTaste().then(() => { delete state.inkHtml; return previewOf(state); }) : previewOf(state))).then(shutPeek).then(h => finishHtml(item, h));
}
/** 11-12 복사 글 마지막 손질 — 심플 새 틀은 <style> 하나 · 내 글꾸(own)는 마트 복사 글이면 이미 다듬은 꼴 그대로(코멘트 빈칸 · ✎ 만 다시) */
/** 11-13 「낮 · 밤 전환 넣기」 — 켜져 있으면 복사 글(simpleReady 뒤) · 크게 보기 미리보기에 해 · 달 전환을 달아요(day-night.js addToggle). 꼴이 아니면(내 글꾸 등) 원래 글 그대로 */
const flipOf = (html) => { try { return addToggle(html).html; } catch { return html; } };
const withFlip = html => (toneState.flip ? flipOf(html) : html);
/** 크게 보기 미리보기용 — 전환을 단 뒤 뿌리의 낮/밤 class(gk-tl · gk-td · gk-tx · gk-tn-*)를 떼요. 마트 화면에는 목록 카드의 틀 규칙(.gk-tl p · .gk-k8.gk-tl.gk-tn-d … — 미리보기와 한 문서)이 같이 있어서,
 *  뿌리에 그 class 가 남으면 밤으로 바꿔도 카드의 낮 규칙이 미리보기 글에 걸려요(블라인드 등). 전환을 단 글은 규칙이 모두 전환 조건으로 바뀌어 있어 떼어도 모습이 같아요(417틀 화면 대본). 복사 글은 그대로 둬요 */
const previewFlip = (html) => { if (!toneState.flip) return html; const out = flipOf(html); return out === html ? html : out.replace(/(<div class="gk )([^"]*)"/, (all, head, cls) => `${head}${cls.split(' ').filter(c => !/^gk-(?:tl|td|tx|tn-d|tn-n)$/.test(c)).join(' ')}"`); };
/** 깡통 한 글 상한(약 240KB) — 전환을 달면 이 틀 하나로 넘는지 · 얼마나 느는지(조절 칸 「밝기」 줄 알림) */
export const KK_POST_MAX = 240000;
function flipInfo(item) {
    const st = stateById.get(item.id); if (!st || !item.preview || !item.simple) return null;
    try { const base = simpleReady(shutPeek(previewOf(st))), added = addToggle(base).html; const size = s => new TextEncoder().encode(s).length; return { add: size(added) - size(base), total: size(added), over: size(added) > KK_POST_MAX }; } catch { return { fail: true }; }
}
function finishHtml(item, h) {
    if (item.own) {
        if (!item.simple || !/\.content>p,\.blq-cm\{/.test(h)) return item.simple ? withFlip(simpleReady(h)) : kkangtongReady(h);
        const key = simpleFrameInfo(h)?.key || '';
        return withCommentSlots(markEdits(kkangtongReady(h), { skip: HIDDEN_LINE_FRAMES.includes(key) ? [] : ['gk-hl'] }));
    }
    return item.simple ? withFlip(simpleReady(h)) : item.photo ? h : kkangtongReady(h);
}
/** 내려받기(.html) — 복사 글과 같은 HTML 을 파일로(앞에 doctype · charset 두 줄만).
 *  doctype 이 없으면 브라우저가 옛 방식(quirks)으로 열어 클래스 이름 대소문자를 안 가려요 — gk-nb(소품 막대)가 gk-nB(깡캐 이름표)에도 걸려 이름표가 막대가 돼요(k4 · k5 · k7 · k10 · k15 · q05) */
async function downloadHtml(state) {
    try {
        const html = await readyHtml(state), name = String(state.item.name || state.item.label || '글꾸').replace(/[\\/:*?"<>|]+/g, ' ').trim();
        const blob = new Blob([`<!doctype html>\n<meta charset="utf-8">\n${html}\n`], { type: 'text/html' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `글꾸-${name}.html`, hidden: true });
        document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        noteRecent(state.item.id); say('.html 파일로 받았어요', 2400);
    } catch { say(LOAD_FAIL, 3200); }
}
/**
 * 11-12 「테마로 담기」 — 심플 틀을 테마가 받는 꾸러미로(액자 마트 { "bl-mart": 1, items } 꼴 + 새 종류 geulkku-simple · 문서 지시-1111/글꾸-조절-설계/테마로-담기-꼴.md)
 *   html = 틀 원래 판(조각의 preview — 색 · 조절 전) · set = 지금 조절 값(blGeulkku 2 · 이 틀 값까지). 테마가 제 인물표 색 · 로그로 다시 그려요.
 */
export function themePack(item, set) {
    const key = themeKey(item);
    return { 'bl-mart': 1, items: [{ kind: 'geulkku-simple', v: 1, id: item.id, key, name: item.name || item.label || '글꾸', ...(item.emoji ? { emoji: item.emoji } : {}), ...(item.own ? { own: true } : {}), html: item.preview || '', set }] };
}
/** 11-12 틀 열쇠(k1079 · q05) — 내 글꾸(own-<무작위>)는 id 에 열쇠가 없어서 틀 HTML 뿌리 class(gk-k1079)에서 읽어요.
 *  예전에는 id 끝만 봐서 내 글꾸를 담으면 테마가 늘 「틀 열쇠가 틀려요」로 건너뛰었어요(무작위 id 끝이 k3 같으면 「HTML 과 달라요」) */
export const themeKey = item => simpleFrameInfo(item.preview)?.key || (String(item.id).match(/((?:k|q)\d+)$/) || [])[1] || '';
/**
 * 11-12 글자 복사(글만 복사 · 테마용 복사 · 설정 코드 복사가 같이) — 사파리(아이폰)는 누른 순간에 클립보드를 열어야 해요:
 *   글을 만드는 동안(조각 받기 · 압축) await 한 뒤 writeText 를 부르면 막혀서 「복사가 막혔어요」만 떴어요 → 「HTML 복사」(copyHtml)처럼 글은 Promise 로 넘기고,
 *   그래도 막히면 숨은 글 칸을 골라 복사. text: 글 또는 글 Promise · 글을 못 만들면 그 오류를 던져요 · 돌려주는 값 = 복사됐는지
 */
async function clipText(text) {
    const job = Promise.resolve(text); job.catch(() => { /* 아래에서 던져요 */ });
    try {
        if (globalThis.ClipboardItem && navigator.clipboard?.write) await navigator.clipboard.write([new ClipboardItem({ 'text/plain': job.then(t => new Blob([t], { type: 'text/plain' })) })]);
        else await navigator.clipboard.writeText(await job);
        return true;
    } catch {
        const value = await job;   // 글을 못 만들었으면 여기서 그 오류가 올라가요
        const area = Object.assign(document.createElement('textarea'), { value, readOnly: true });
        area.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px;font-size:16px';
        layerHost().append(area); area.focus(); area.select(); area.setSelectionRange(0, value.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { /* 아래 */ }
        area.remove();
        return ok;
    }
}
/** 테마 mart-import.js SIMPLE_SET_MAX 와 같은 값 — 조절 값 JSON 이 이보다 길면 테마는 조절 값을 통째로 버리고 틀만 받아요(알림 없이) */
export const THEME_SET_MAX = 16 * 1024;
async function themeTake(state, file) {
    const item = state.item;
    if (item.nt) { say(`${NOT_TAKE_HINT}(${item.nt}) · 「HTML 복사」로 써요`, 4200); return; }   // 단추는 막혀 있지만 다른 길(키보드 · 옛 칸)로 와도
    try {
        const set = makeSet({ tone: toneState, look: lookNow(), motion: motionNow(), tex: texNow(), shape: shapeNow(), tune: tuneOf(item.id), frame: item.own ? themeKey(item) : item.id });   // 내 글꾸도 틀 값(frames[열쇠])까지
        const text = ensureItem(item).then(() => JSON.stringify(themePack(item, set)));
        // 11-12 고친 글(한 칸 2000자 안팎)이 아홉 칸쯤 넘으면 16KB 를 넘어요 — 그대로 담되 테마가 틀만 받는다는 걸 알려요
        const big = JSON.stringify(set).length > THEME_SET_MAX, warn = big ? ' · 다만 조절 값(고친 글)이 16KB 를 넘어 테마는 틀만 받아요 — 고친 글을 줄이면 같이 받아요' : '', ms = big ? 6000 : 3200;
        if (file) {
            const blob = new Blob([await text], { type: 'application/json' }), name = String(item.name || '글꾸').replace(/[\\/:*?"<>|]+/g, ' ').trim();
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `글꾸-${name}.bl-mart.json`, hidden: true });
            document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
            say(`테마용 파일을 받았어요 · 블루레몬 1.1.4 부터 「마트에서 가져오기」로 받아요${warn}`, ms);
        } else if (await clipText(text)) say(`테마용 글을 복사했어요 · 블루레몬 1.1.4 부터 「마트에서 가져오기」에 붙여 넣어요${warn}`, ms);
        else say('복사가 막혔어요 · 「테마용 파일 받기」로 받아 주세요', 3200);
    } catch { say('담기가 막혔어요 · 잠시 뒤 다시 눌러 주세요', 3000); }
}
/** 글만 복사(마크다운) — 틀 없이 글만 올릴 때(테마 「글만」) */
async function copyText(state) {
    try {
        if (!(await clipText(readyHtml(state).then(frameMarkdown)))) { say('복사가 막혔어요 · 미리보기를 길게 눌러 골라 복사해 주세요', 3200); return; }
        noteRecent(state.item.id); say('글만 복사했어요 · 서식 없는 칸에 붙여요', 2600);
    } catch { say(LOAD_FAIL, 3200); }
}
async function copyHtml(state) {
    const item = state.item;
    const ready = ensureItem(item).then(() => (inkChanged(item) && !tasteLoaded ? loadTaste().then(() => { delete state.inkHtml; return previewOf(state); }) : previewOf(state))).then(shutPeek).then(h => finishHtml(item, h));   // 11-11 심플 새 틀: 틀 <style> + 코멘트 빈칸 · 16px 규칙을 <style> 하나로   // 11-10 깡통에 붙일 꼴(인라인 url( → <style> · 글자색 fill)   // 11-09 카드 · 상세 미리보기는 펼침, 복사 글은 닫힘   // 「📝 내 로그로 보기」가 켜져 있으면 내 로그가 든 완성 HTML   // 조각을 아직 안 받았으면 받은 뒤(클립보드는 누른 순간에 열어요)
    ready.catch(() => { /* 아래에서 알려요 */ });
    const done = () => { noteRecent(item.id); say('복사됐어요 · 깡통 글쓰기 HTML 칸에 붙여요', 3600); };
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
        layerHost().append(area); area.focus(); area.select(); area.setSelectionRange(0, html.length);   // 11-12 크게 보기 창이 열려 있으면 그 안에(창 밖 body 는 inert 라 골라지지 않아 대체 복사도 막혔어요)
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

// 세계관 · 캐릭터 글꾸의 원작 봇(깡싸 글) — 분류 id 로 묶어요 · 11-12 밤 자료는 sources.js 한 곳(글꾸 캐릭터 칸 · 액자 마트와 같이 읽어요)
const SOURCES = {
    'halo': WORKS.halo, 'halo-char': WORKS.halo,
    'hunter': WORKS.hunter, 'hunter-char': WORKS.hunter,
    'adrian': ADRIAN_WORKS, 'adrian-char': ADRIAN_WORKS,   // 아드리안은 원작 글이 둘
    'gangho': WORKS.gangho, 'gangho-char': WORKS.gangho,
};
// 캐릭터마다 따로 공유된 깡캐 글 — id 앞부분(char-이름)으로 묶어요
const CHAR_SOURCES = { 'char-uziel': CHAR_WORKS.uziel, 'char-lucifer': CHAR_WORKS.lucifer, 'char-asmodeus': CHAR_WORKS.asmodeus };
// 보이는 분류 이름 — 「강호유람록」은 실제 봇 이름 「무협시뮬」로 보여 주되, 옛 이름으로도 찾아지게 검색어에 남겨요
const LABEL_FIX = { 'gangho': '무협시뮬', 'gangho-char': '무협시뮬 · 인물' };
const SEARCH_ALSO = { 'song': '노래 앨범 mp3 음악 오디오 플레이리스트 트랙 싱글 깡통 게시글 깡싸 커뮤니티 글꾸', 'hwabo': '화보 사진 갤러리 사진첩 앨범 깡통 게시글 깡싸 커뮤니티 글꾸', 'gangho': '강호유람록 무협 시뮬 무협시뮬', 'gangho-char': '강호유람록 무협 시뮬 무협시뮬' };
const catLabel = (id, label) => LABEL_FIX[id] || label || '';
// 세계관 액자의 원작 봇 — 콘셉트 id 로 묶어요(url 이 빈 칸이면 링크를 안 보여요)
const FRAME_SOURCES = {
    'halo-office': SOURCES.halo,
    'hunter-sim': SOURCES.hunter,   // 11-12 밤 원작 제목은 sources.js 그대로(전엔 여기만 「Dungeons & Hunters」로 따로 적었어요)
    'adrian': SOURCES.adrian,
};
const sourceLinks = item => {
    // 11-07: 그림체가 붙은 id(char-이름-sp-1 · -dk- · -mt-)도 같은 인물 — 앞부분이 「char-이름」이면 깡캐 글을 붙여요(전엔 일러스트 char-이름-1 · -2 에만 붙었어요)
    const id = String(item.id || '');
    const ch = CHAR_SOURCES[Object.keys(CHAR_SOURCES).find(key => id === key || id.startsWith(key + '-'))];
    let w = item.kind === 'frame' ? FRAME_SOURCES[item.concept] : SOURCES[item.category];
    const ws = [].concat(w || []).filter(x => x && x.url);   // 원작이 둘인 분류(아드리안)는 나란히 · 자리만 있는 원작은 빼요
    w = ws.length ? ws : null;
    const a = (src, kind) => `<a class="mart-source" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer" title="원작 깡통 글">🔗 ${kind} · ${esc(src.title)}</a>`;
    // 틀마다 출처 봇이 다른 분류(11-06 센티넬버스 — 센가시뮬 · 센가 아카데미)는 목록의 source(봇 정식 이름)를 글로만 보여요(깡싸 글 주소는 아직 없어요)
    // 11-12 밤 새 틀(세계관 · 인물 104): 목록 자료의 src(sources.js 열쇠) 그대로 — 깡캐 글 먼저 · 원작 글 전부
    if (Array.isArray(item.src)) return itemSources(item).map(x => sourceHtml(x)).join('');
    const own = !w && item.source ? sourceHtml(workByTitle(item.source) || { title: item.source }, '원작') : '';   // 11-12 밤 주소를 받은 봇(센티넬버스 둘)은 링크로
    // 11-09 노래방 글꾸(kara): 견본 대신 내 mp3 · 가사로 만드는 화면(mart/kara/)으로 — 카드 · 상세 창 둘 다
    const kara = item.category === 'kara' ? `<a class="mart-source" href="${esc(asset(`kara/?theme=${String(id).replace(/^kara-/, '')}`))}" title="mp3 주소 · 제목 · 이름 · 색 · [분:초] 가사를 넣으면 이 테마의 HTML 이 바로 나와요">🎤 내 곡으로 만들기 · 노래방 글꾸</a>` : '';
    return (ch ? a(ch, '깡캐') : '') + (w ? w.map(x => a(x, '원작')).join('') : own) + kara;
};

// ── 카드 한 줄 정보 · 단추(카드와 크게 보기 시트가 같이 써요) ──
const HTML_TITLE = '확장 없이 깡통 글쓰기 HTML 칸에 바로 붙여 쓰는 완성 HTML(보이는 글씨는 전부 바꿔도 돼요)';
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
    const nt = item.kind === 'geulkku' && item.simple && item.nt ? notTakeTag(item) : '';   // 테마 로그 복사가 아직 못 받는 틀(11-12 밤 테마 1.2.0 기준 18 / 417 — tools/theme-takeable.json)
    const fx = '';   // 916 중 913 이 움직이고 915 가 반응해서(2026-11-05 셈) 「✨ 움직임 · 👆 반응」 꼬리표는 정보가 없어 뺐어요
    return `<span class="mart-tags"><span class="mart-tag tag">${esc(catLabel(item.category, item.categoryLabel))}</span>${style}${fx}${own}${nt}</span>`;
}
/** 11-12 「테마 아직 못 받음」 꼬리표 — item.nt = 테마 받기 검사가 건너뛰는 까닭(theme-take.js why) */
export const NOT_TAKE_HINT = '블루레몬 로그 복사가 아직 이 틀을 받지 못해요';
const notTakeTag = item => `<span class="mart-tag tag is-notake" title="${esc(`${NOT_TAKE_HINT}(${item.nt}) · 「HTML 복사」로 깡통 글에 붙여 써요`)}">테마 아직 못 받음</span>`;
const descOf = item => (LABEL_FIX[item.category] ? String(item.desc || '').replace(/강호유람록/g, '무협시뮬') : (item.desc || ''));
function actionsHtml(item) {
    const html = item.kind === 'geulkku' ? `<button type="button" class="btn" data-act="html" title="${HTML_TITLE}"><span class="em" aria-hidden="true">📋</span>HTML 복사</button>` : '';
    // 테마에 들어 있는 글꾸(내장 심플 30 · 로그 복사 기본 틀 19): 받을 것 없음 — 담기 · 테마용 복사 대신 안내 + HTML 복사(시식은 크게 보기에서 그대로)
    if (item.builtin) return `<div class="mart-actions is-geulkku is-builtin"><span class="mart-builtin" title="블루레몬에이드 로그 복사에 이미 있어요 · 마트에서 가져오지 않아도 돼요">✓ 이미 테마에 들어 있어요</span>${html}</div>`;
    if (item.own) return `<div class="mart-actions is-geulkku is-builtin is-copyonly is-own"><button type="button" class="btn mart-own-del" data-act="own-del" title="이 브라우저에서 지워요(두 번 눌러요)">지우기</button>${html}</div>`;   // 11-12 내 글꾸
    // 오리지널 컨셉 30 · 화보 갤러리 · 노래 앨범(copyOnly): 테마로 받지 않는 틀 — 「담기」 · 「테마용 복사」 없이 HTML 복사만
    // 11-12 밤 사용자 「왜 둘 다 html 복사로 써요 html 복사 이거임? 같은 말 아냐?」 — 왼쪽 안내 글을 뺐어요(0개). 테마가 못 받는 틀은 이름 줄 꼬리표 「테마 아직 못 받음」이 말해요
    if (item.copyOnly) return `<div class="mart-actions is-geulkku is-solo">${html}</div>`;
    return `<div class="mart-actions${item.kind === 'geulkku' ? ' is-geulkku' : ''}"><button type="button" class="btn mart-pick" data-act="pick" aria-pressed="false"><span class="em" aria-hidden="true">🛒</span>담기</button><button type="button" class="btn" data-act="copy" title="이것 하나만 바로 복사(테마 「마트에서 가져오기」용)">${item.kind === 'geulkku' ? '테마용 복사' : '바로 복사'}</button>${html}</div>`;
}
/** 11-11 즐겨찾기 ☆ · ★(무테 아이콘) — 카드 이름 줄 · 크게 보기 제목 옆 */
const favHtml = item => { if (item.kind !== 'geulkku' || item.own) return ''; const on = like.fav.includes(item.id); return `<button type="button" class="ibtn mart-fav" data-act="fav" data-fav="${esc(item.id)}" aria-pressed="${on}" aria-label="${esc(item.name || item.label)} 즐겨찾기" title="${on ? '즐겨찾기에서 빼기' : '즐겨찾기'}"></button>`; };   // 별은 마스크 그림(mart.css) — 글자 단추가 아니에요
const likeRows = items => Object.entries(LIKE_CHIPS).map(([id, label]) => [id, label, like[id].filter(x => items.some(i => i.id === x)).length]);
function likeChanged(which) {
    for (const [id, , n] of likeRows(allItems)) picker?.count(id, n);
    if (picker?.sel.cat === which) applyFilter();
}
function toggleFav(id) {
    const on = !like.fav.includes(id);
    like.fav = on ? [id, ...like.fav].slice(0, 96) : like.fav.filter(x => x !== id);
    saveLike();
    for (const b of document.querySelectorAll(`.mart-fav[data-fav="${CSS.escape(id)}"]`)) { b.setAttribute('aria-pressed', String(on)); b.title = on ? '즐겨찾기에서 빼기' : '즐겨찾기'; }
    say(on ? '즐겨찾기에 넣었어요 · 위 「★ 즐겨찾기」 칩에 모여요' : '즐겨찾기에서 뺐어요', 2200);
    likeChanged('fav');
}
/** 쓴 틀을 최근에(HTML 복사 · 내려받기 · 글만 복사) — 5개까지 · 마지막에 쓴 것이 앞 */
function noteRecent(id) {
    if (kind !== 'geulkku' || like.recent[0] === id || String(id).startsWith('own-')) return;
    like.recent = [id, ...like.recent.filter(x => x !== id)].slice(0, 5);
    saveLike(); likeChanged('recent');
}
function doAct(state, act, b) {
    if (act === 'view') openSheet(state);
    else if (act === 'fav') toggleFav(state.item.id);
    else if (act === 'copy') copyEntries(ensureItem(state.item).then(() => [entryOf(state)]));
    else if (act === 'html') copyHtml(state);
    else if (act === 'download') downloadHtml(state);
    else if (act === 'text') copyText(state);
    else if (act === 'theme-copy' || act === 'theme-file') themeTake(state, act === 'theme-file');
    else if (act === 'taste') openTaste(state);
    else if (act === 'random') pickRandom();
    else if (act === 'own-del') ownDelete(state, b);
    else if (act === 'own-pick') ownPick(state, b);
    else if (act === 'design') switchDesign(state, b.dataset.id);
    else if (act === 'pick') {
        const key = entryOf(state).key;   // 열쇠는 목록만으로 정해져요 — 담는 글(받기 칸)은 조각을 받은 뒤
        if (cart.has(key)) { cart.remove(key); say('장바구니에서 뺐어요'); return; }
        ensureItem(state.item).then(() => { if (!cart.has(key) && cart.add(entryOf(state), b) === 'full') say('장바구니는 60개까지예요'); }, () => say(LOAD_FAIL, 3200));
    }
}
// ── 「🍽️ 시식하기」(taste.js · 처음 누를 때 받아요) — 내 채팅 로그를 붙여 넣어 이 글꾸에 끼워 보고 HTML 복사 · 내려받기 ──
let tasteModule = null;
let tasteLoaded = null;   // 11-08 받은 시식 모듈(글자색을 바꾼 글꾸 미리보기를 바로 그리려고)
const loadTaste = () => (tasteModule ||= import('./taste.js?v=20261113p').then((m) => { tasteLoaded = m; return m; }, (error) => { tasteModule = null; throw error; }));
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
/** 그 카드에 보일 미리보기 HTML — 대사색을 골랐으면 그 색으로 다시 칠해요(tone-state.js · 고른 게 없으면 지금 모양 그대로) */
function previewOf(state) {
    const raw = rawPreviewOf(state);
    if (!raw || !toned(state.item)) return wrapOf(state, raw);
    const key = `${toneKey()}|${raw.length}|${raw.slice(-40)}`;
    if (state.toneKey !== key) { state.toneKey = key; state.toneHtml = toneOut(state.item, raw); }
    return wrapOf(state, state.toneHtml);
}
/** 11-13 본문 줄바꿈(wrap-state.js) — 카드 · 크게 보기 · 복사 글이 모두 이 길이라 셋이 같아요(한 문서에 같은 틀 규칙이 섞여도 어긋나지 않게) · 같은 글이면 지난번 것 그대로 */
function wrapOf(state, html) {
    if (!html || wrapState.mode !== 'char') return html;
    if (state.wrapIn !== html) { state.wrapIn = html; state.wrapOut = wrapHtml(html, 'char'); }
    return state.wrapOut;
}
/** 11-12 화면에 보일 미리보기 — 내 글꾸(own)는 붙인 글의 <style> 을 그 칸 안에만(마트 화면을 덮지 않게) · 복사 글(previewOf)은 그대로 */
const viewOf = state => (state.item.own ? scopePreview(previewOf(state), state.item.ownId) : previewOf(state));
const OWN_DOM = { parse: html => new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, 'text/html'), guessSlot, fromPath };
function rawPreviewOf(state) {
    const item = state.item;
    if (item.own && !item.simple) { const m = mineModelNow(); return m ? fillSlot(item.preview, m, item.path, OWN_DOM) : item.preview; }   // 마트 꼴이 아닌 내 글꾸: 내 글은 글 자리에
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
    for (const s of states) { if (s.item.id !== id) continue; delete s.myHtml; delete s.inkHtml; if (s.filled) { const box = s.el.querySelector('.mart-preview-in'); if (box) box.innerHTML = viewOf(s); } }
    if (sheet?.open && sheetState?.item.id === id && sheetState.item.preview) { sheet.querySelector('.mart-sheet-preview').innerHTML = sheetPreview(sheetState); syncInks(sheet.querySelector('.mart-sheet-inks'), sheetState.item); }
}
document.addEventListener('bl-inks-change', e => repaintInks(e.detail?.id));
// 11-10 캐릭터 · 밤낮을 바꾸면 만든 카드 · 크게 보기를 다시 칠해요
// 11-12 스타일 한 벌은 알림을 세 번(글 모양 · 움직임 · 모양) 내요 — 목록 카드 전부를 세 번 칠하지 않게 한 번으로 묶어요(누른 처리 끝 · 화면 그리기 전)
let repaintQueued = false, flashQueued = false;
function queueRepaint(flash) {
    flashQueued ||= flash;
    if (repaintQueued) return; repaintQueued = true;
    queueMicrotask(() => { repaintQueued = false; const f = flashQueued; flashQueued = false; repaintTone(); if (f) flashPreview(); });
}
function repaintTone() {
    for (const s of states) { delete s.toneKey; delete s.toneHtml; if (s.filled) { const box = s.el.querySelector('.mart-preview-in'); if (box) box.innerHTML = viewOf(s); } syncCard(s); }
    if (sheet?.open && sheetState?.item.preview) { sheet.querySelector('.mart-sheet-preview').innerHTML = sheetPreview(sheetState); const inks = sheet.querySelector('.mart-sheet-inks'); if (inks) inks.innerHTML = toned(sheetState.item) ? '' : inksHtml(sheetState.item); const cr = sheet.querySelector('.mart-sheet-credit'); if (cr) cr.innerHTML = sheetState.item.simple ? pickedCreditHtml() : ''; syncSheet(); paintTune(); }
}
// 11-11 조절 값(글자색 · 소품 색 · 고쳐 쓴 글)이 바뀌면 그 틀의 카드와 크게 보기를 다시 그려요 — 글만 고친 것이면 크게 보기 미리보기는 그대로(글 쓰는 자리가 안 날아가게)
document.addEventListener('bl-tune-change', (e) => {
    const id = e.detail?.id;
    for (const s of states) { if (s.item.id !== id) continue; delete s.toneKey; delete s.toneHtml; if (s.filled) { const box = s.el.querySelector('.mart-preview-in'); if (box) box.innerHTML = viewOf(s); } }
    if (!sheet?.open || sheetState?.item.id !== id || !sheetState.item.preview) return;
    if (!e.detail.textOnly) { sheet.querySelector('.mart-sheet-preview').innerHTML = sheetPreview(sheetState); paintTune(); flashPreview(); } else syncTune(sheet, sheetState.item);
    syncMine(sheet, sheetState.item);
});
// 11-12 크게 보기에서 조절을 누르면 미리보기를 잠깐 테두리로 강조해요(줄 간격처럼 작은 변화도 「바뀌었다」가 보이게 — 알림 말풍선 대신)
function flashPreview() {
    const pv = sheet?.open && sheet.querySelector('.mart-sheet-preview'); if (!pv) return;
    pv.classList.remove('is-flash'); void pv.offsetWidth; pv.classList.add('is-flash');
    clearTimeout(flashPreview.t); flashPreview.t = setTimeout(() => pv.classList.remove('is-flash'), 700);
}
document.addEventListener('bl-tone-change', e => queueRepaint(!e.detail?.caps));
// 11-10 컨셉 하나 = 카드 하나 — 같은 이름의 디자인(심플 · 일러스트 · 다꾸 · 무테 · 내장)은 카드 · 크게 보기 안에서 넘겨 봐요(사용자 「한 컨셉 들어가서 디자인 바꾸는식」)
const conceptPick = new Map();   // 컨셉 이름 → 고른 디자인 id
// 11-10 사용자 「심플만 남기돼」 — 디자인 넘기기는 뺐어요(무테 · 일러스트 · 다꾸는 자료로만 남아요)
const designsHtml = (item) => {
    const sibs = item._sibs || [];
    if (sibs.length < 2 || !SHOW_ALL_DESIGNS) return '';
    return `<div class="mart-designs mart-seg" role="group" aria-label="디자인">${sibs.map(x => `<button type="button" class="chip" data-act="design" data-id="${esc(x.id)}" aria-pressed="${x.id === item.id}">${esc(x.builtin ? '내장' : styleOf(x))}</button>`).join('')}</div>`;
};
function switchDesign(state, id) {
    const next = (state.item._sibs || []).find(x => x.id === id);
    if (!next || next === state.item) return;
    conceptPick.set(next.name, next.id);
    const inSheet = sheet?.open && sheetState === state;
    const old = state.el, fresh = stateOf(next);
    if (old.isConnected) { cards.swap(state.item, next); old.replaceWith(fresh.el); fillCard(fresh); }
    if (inSheet) openSheet(fresh);
    else fresh.el.querySelector(`.mart-designs [data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
function repaintMylog() {
    for (const s of states) { delete s.myHtml; if (s.filled) { const box = s.el.querySelector('.mart-preview-in'); if (box) box.innerHTML = viewOf(s); } }
    if (sheet?.open && sheetState?.item.preview) sheet.querySelector('.mart-sheet-preview').innerHTML = sheetPreview(sheetState);
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
const tasteHtml = item => (item.kind === 'geulkku' && !item.photo ? `<button type="button" class="btn mart-taste-open" data-act="taste" title="${TASTE_TITLE}"><span class="em" aria-hidden="true">🍽️</span>시식하기<small>내 로그를 넣어 봐요</small></button>` : '');
/** 11-09 화보 갤러리(photo): 상세 창 미리보기는 체크박스 id · label for 에 꼬리를 붙여요 — 같은 틀이 카드에도 있어 for= 가 카드(inert) 쪽 체크박스를 가리키지 않게. 복사 글은 원래 id 그대로 */
// 11-12 미리보기 접기(설계 4-8 — 폰에서 조절 칸을 넓게) · 이 기기에 기억
const PV_KEY = 'bl-mart-pv-fold-v1';
let pvFolded = (() => { try { return localStorage.getItem(PV_KEY) === '1'; } catch { return false; } })();
const pvFoldHtml = () => `<button type="button" class="ibtn chev mart-pv-fold" data-pv-fold aria-expanded="${!pvFolded}" aria-label="${pvFolded ? '미리보기 펼치기' : '미리보기 접기'}" title="${pvFolded ? '미리보기 펼치기' : '미리보기 접기'}"></button>`;
// ── 11-12 붙일 곳 흉내(테마 1.1.3 log-copy-site-sim.js 꼴) — 크게 보기 미리보기를 깡통 · 깡캐 글 화면처럼: 사이트 바탕 · 본문 글자색(밤낮) · 글 폭(PC 640 · 폰 360) · 위아래 코멘트 자리 ·
//   깡통이 붙이는 것(summary 뒤 빈 줄 <div><br></div> · .content details 여백 · 문단 줄 간격 · id · for · name 지움)을 복사 글 그대로 위에 흉내 내요. 흉내 중에는 「글 고치기」가 꺼져요 ──
const SITE_KEY = 'bl-mart-site-v1';
const SITE_MODES = [['mart', '마트'], ['pc', '글 · PC'], ['phone', '글 · 폰']];
const site = { mode: (() => { try { const v = localStorage.getItem(SITE_KEY); return SITE_MODES.some(([id]) => id === v) ? v : 'mart'; } catch { return 'mart'; } })() };
/** 깡통 정화기 · 사이트가 붙이는 것 흉내(글자만 — 사이트 규칙은 mart.css .mart-site) */
export const siteSim = html => String(html ?? '')
    .replace(/<\/summary>/g, '</summary><div><br></div>')
    .replace(/<([a-z][\w-]*)\b([^>]*)>/gi, (all, tag, attrs) => (/\s(?:id|for|name)\s*=/i.test(attrs) ? `<${tag}${attrs.replace(/\s(?:id|for|name)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')}>` : all))
    .replace(/<script\b[\s\S]*?<\/script>/gi, '');
function siteHtml(state) {
    const item = state.item;
    let h = siteSim(finishHtml(item, shutPeek(previewOf(state))));
    if (item.own) h = scopePreview(h, item.ownId);
    return `<div class="mart-site is-${site.mode} is-${toneState.mode === 'light' ? 'light' : 'dark'}"><div class="mart-site-page"><div class="content">${h}</div></div></div>`;
}
/** 11-13 미리보기 바로 위 한 줄(.mart-sheet-pvbar) — 왼쪽 「붙일 곳 흉내」 칩 셋 · 오른쪽 끝 해 · 달(「전환 넣기」를 켰을 때만 · 켬끔과 상관없이 줄 높이는 같아요).
 *   사용자 「어차피 위에 해랑 달 있는 칸에 공간 있는데 걍 위로 올려버리지 그래」 · 「지금 그러면 중복 여백만 많잖아」 — 전에는 미리보기 아래에 「붙일 곳 흉내」 줄이 따로 있었고 미리보기 안 위에 해 · 달만 든 빈 줄이 또 있었어요.
 *   해 · 달은 복사 글에 실리는 전환 단추의 미리보기예요: 마트 미리보기에서는 틀 안의 진짜 단추 줄(.gkt-b)을 숨기고 이 줄의 해 · 달이 그 단추(details.gkt-k)를 대신 열고 닫아요. 「글 · PC | 글 · 폰」 흉내에서는 깡통에서처럼 틀 위에 진짜 단추가 보여서 이 줄의 것은 비워 둬요.
 *   좁은 폰에서는 「글 · 」 머리를 접어 「마트 · PC · 폰」으로(뜻은 같아요 · 읽개에는 그대로) */
const siteChipHtml = (id, l) => { const m = /^(글 · )(.+)$/.exec(l); return `<button type="button" class="chip" data-site="${id}" aria-pressed="${site.mode === id}">${m ? `<span class="mart-pvbar-long">${m[1]}</span>${m[2]}` : l}</button>`; };
const pvBarHtml = item => (item.simple || item.own ? `<div class="mart-sheet-pvbar"><span class="mart-pvbar-label" aria-hidden="true">붙일 곳 흉내</span><span class="mart-seg mart-pvbar-site" role="group" aria-label="붙일 곳 흉내">${SITE_MODES.map(([id, l]) => siteChipHtml(id, l)).join('')}</span><span class="mart-pvbar-pill" data-pv-pill hidden title="복사 글에 들어가는 해 · 달 단추예요 — 눌러서 미리 봐요">${dayNightHtml('data-flip-pill', '')}</span></div>` : '');
/** 미리보기 안 전환 단추(details.gkt-k)의 지금 상태를 줄의 해 · 달에 맞춰요 — 닫힘 = 처음 판(지금 밝기) · 열림 = 반대 판 */
function syncPill() {
    const wrap = sheet?.querySelector('[data-pv-pill]'); if (!wrap) return;
    const k = site.mode === 'mart' ? sheet.querySelector('.mart-sheet-preview details.gkt-k') : null;
    wrap.hidden = !k;
    const now = !k ? '' : k.open ? (toneState.mode === 'light' ? 'dark' : 'light') : toneState.mode;
    for (const b of wrap.querySelectorAll('[data-flip-pill]')) b.setAttribute('aria-pressed', String(b.dataset.flipPill === now));
}
let pillWatch = null;
function setSite(mode) {
    if (!SITE_MODES.some(([id]) => id === mode)) return;
    site.mode = mode; try { localStorage.setItem(SITE_KEY, mode === 'mart' ? '' : mode); } catch { /* 이 화면에서만 */ }
    if (!sheet?.open || !sheetState) return;
    for (const b of sheet.querySelectorAll('[data-site]')) b.setAttribute('aria-pressed', String(b.dataset.site === mode));
    if (mode !== 'mart') stopEdit();
    const pv = sheet.querySelector('.mart-sheet-preview'); pv.classList.toggle('is-site', mode !== 'mart'); pv.innerHTML = sheetPreview(sheetState); paintTune();
}
const sheetPreview = state => (site.mode !== 'mart' && (state.item.simple || state.item.own) ? siteHtml(state) : state.item.simple && !state.item.own ? previewFlip(previewOf(state)) : state.item.photo || state.item.own ? viewOf(state).replace(/ (id|for)="([^"]+)"/g, ' $1="$2-view"') : previewOf(state));   // 11-13 전환 넣기를 켜면 미리보기에도 해 · 달 단추(눌러 볼 수 있어요)
// ── 글꾸 크게 보기 시트(폰은 아래에서 올라오고 PC 는 가운데) — 전체 미리보기 · 장식 누르기 · 스크롤은 여기서만 ──
let sheet = null, sheetState = null;
function openSheet(state) {
    if (!sheet) {
        sheet = document.createElement('dialog');
        sheet.className = 'mart-sheet';
        sheet.setAttribute('aria-labelledby', 'mart-sheet-title');
        sheet.innerHTML = '<header class="mart-sheet-head"><span class="mart-sheet-grip" aria-hidden="true"></span><div class="mart-sheet-name"><h2 id="mart-sheet-title"></h2><div class="mart-sheet-meta"></div><div class="mart-sheet-viewbox"></div></div><button type="button" class="ibtn x mart-sheet-x" data-sheet="close" aria-label="닫기"></button></header><div class="mart-sheet-body"></div><footer class="mart-sheet-foot"></footer>';
        document.body.append(sheet);
        sheet.addEventListener('click', (e) => {
            if (e.target === sheet) { sheet.close(); return; }   // 바깥(배경) 누르기
            const b = e.target.closest('button'); if (!b) return;
            if (b.dataset.sheet === 'close') sheet.close();
            else if (b.dataset.site) setSite(b.dataset.site);
            else if (b.dataset.flipPill) { const k = sheet.querySelector('.mart-sheet-preview details.gkt-k'); if (k) { k.open = b.dataset.flipPill !== toneState.mode; syncPill(); } }   // 줄의 해 · 달 → 미리보기 안 전환 단추
            else if (b.matches('[data-pv-fold]')) { pvFolded = !pvFolded; try { localStorage.setItem(PV_KEY, pvFolded ? '1' : ''); } catch { /* 이번 화면에서만 */ } sheet.classList.toggle('is-pv-folded', pvFolded); b.setAttribute('aria-expanded', String(!pvFolded)); b.title = b.ariaLabel = pvFolded ? '미리보기 펼치기' : '미리보기 접기'; }
            else if (b.matches('[data-tune-edit]') && site.mode !== 'mart') setSite('mart');   // 글 고치기는 마트 미리보기에서(흉내 글에는 칸 번호가 달라요)
            else if (b.dataset.act && sheetState) doAct(sheetState, b.dataset.act, b);
        });
        // 11-12 내 글꾸 「내 글 자리 고르기」: 고르는 중이면 미리보기를 누른 칸을 자리로(링크 · 소품은 안 눌려요)
        sheet.addEventListener('click', (e) => {
            if (!ownPicking || !sheetState?.item.own) return;
            const view = sheet.querySelector('.mart-sheet-preview .mart-own-view'), hit = e.target.closest?.('*');
            if (!view || !hit || !view.contains(hit) || hit === view) return;
            e.preventDefault(); e.stopPropagation();
            const el = hit.closest('.bl-own-slot') || hit, path = slotPath(el, view);
            ownPicking = false;
            if (!path?.length) { say('그 칸은 고를 수 없어요', 2400); return; }
            const id = sheetState.item.ownId;
            setOwnPath(id, path); refreshOwn(); applyFilter();
            const next = ownItems.find(x => x.ownId === id); if (next) openSheet(stateOf(next));
            say(mineModelNow() ? '그 칸에 내 글을 넣었어요' : '그 칸을 내 글 자리로 정했어요 · 목록 위 「내 글」에 글을 넣으면 들어가요', 3000);
        }, true);
        let inkTimer = 0;   // 11-08 글자색: 색 고르기를 움직이는 동안 칩 점은 바로 · 다시 그리기는 0.15초 묶음
        sheet.addEventListener('input', (e) => { const t = e.target; if (!t.matches?.('[data-ink]') || !sheetState) return; paintDot(t); clearTimeout(inkTimer); const item = sheetState.item; inkTimer = setTimeout(() => setInk(item, t.dataset.ink, t.value), 150); });
        sheet.addEventListener('click', (e) => { if (e.target.closest?.('[data-ink-reset]') && sheetState) resetInks(sheetState.item); });
        wireTune(sheet, { current: () => sheetState, openItem: (id) => { const it = allItems.find(x => x.id === id) || ownItems.find(x => x.id === id); if (!it) return false; openSheet(stateOf(it)); return true; }, say, clip: clipText });   // 11-12 아직 카드를 안 만든 틀도(완성 프리셋 파일에서 온 것)
        wireSelectHide(sheet, { current: () => sheetState, say });
        sheet.addEventListener('close', () => { const st = sheetState; sheetState = null; sheet.querySelector('.mart-sheet-body').replaceChildren(); st?.el.querySelector('.mart-preview')?.focus({ preventScroll: true }); });
    }
    sheetState = state;
    sheet.classList.toggle('is-pv-folded', pvFolded && !!state.item.simple);
    const { item } = state;
    sheet.querySelector('#mart-sheet-title').innerHTML = `${glyphHtml(item)}<span>${esc(item.name || item.label)}</span>${favHtml(item)}`;
    if (item.accent) sheet.style.setProperty('--accent', item.accent); else sheet.style.removeProperty('--accent');   // 담기 단추 색 = 그 글꾸 강조색
    sheet.querySelector('.mart-sheet-meta').innerHTML = `${tagsHtml(item)}${designsHtml(item)}<p class="mart-desc">${esc(descOf(item))}</p>${sourceLinks(item)}<div class="mart-cast-credit mart-sheet-credit">${item.simple ? pickedCreditHtml() : ''}</div>${item.own && item.warn.length ? `<details class="mart-own-check"><summary>깡통에 올리면</summary>${ownWarnHtml(item.warn)}</details>` : ''}`;   // 11-10 디자인 넘기기 · 11-12 내 글꾸 점검
    sheet.querySelector('.mart-sheet-viewbox').innerHTML = item.simple ? viewSegHtml(item) + pvFoldHtml() : '';   // 11-12 간편 | 세밀 — 창 머리(설계 4-8)
    const body = sheet.querySelector('.mart-sheet-body');
    body.innerHTML = `${pvBarHtml(item)}<div class="mart-sheet-preview${site.mode !== 'mart' && (item.simple || item.own) ? ' is-site' : ''}">${item.preview ? sheetPreview(state) : '<p class="mart-sheet-wait">불러오는 중이에요…</p>'}</div><div class="mart-sheet-side"><div class="mart-sheet-tune">${tuneHtml(item)}</div><div class="mart-sheet-inks">${item.preview && !toned(item) ? inksHtml(item) : ''}</div><div class="mart-sheet-mine">${mineBoxHtml(item)}</div></div>`;   // 11-12 미리보기 · 옆 칸(PC 두 칸 · 폰은 미리보기 위)
    pillWatch?.disconnect(); pillWatch = new MutationObserver(syncPill); pillWatch.observe(body.querySelector('.mart-sheet-preview'), { childList: true }); syncPill();
    paintTune();   // 11-08 글자색 칩 · 11-10 캐릭터 대사색으로 칠할 땐 칩 대신 그 색 하나
    if (!item.preview) {
        body.setAttribute('aria-busy', 'true');
        ensureItem(item).then(() => {
            fillCard(state);
            if (sheetState !== state) return;
            body.querySelector('.mart-sheet-preview').innerHTML = sheetPreview(state);
            body.querySelector('.mart-sheet-tune').innerHTML = tuneHtml(item); sheet.querySelector('.mart-sheet-viewbox').innerHTML = item.simple ? viewSegHtml(item) + pvFoldHtml() : ''; body.querySelector('.mart-sheet-mine').innerHTML = mineBoxHtml(item); paintTune();
            if (toned(item)) body.querySelector('.mart-sheet-inks').innerHTML = ''; else syncInks(body.querySelector('.mart-sheet-inks'), item);
            body.scrollTop = 0;
        }, () => { if (sheetState === state) body.querySelector('.mart-sheet-preview').innerHTML = `<p class="mart-sheet-wait">${LOAD_FAIL}</p>`; })
            .finally(() => body.removeAttribute('aria-busy'));
    }
    ownPicking = false;
    const pickBtn = item.own && !item.simple ? `<button type="button" class="btn" data-act="own-pick" aria-pressed="false" title="${item.path ? '고른 자리를 풀고 자동으로' : '미리보기에서 내 글이 들어갈 칸을 눌러 골라요'}">${item.path ? '내 글 자리 · 자동으로' : '내 글 자리 고르기'}</button>` : '';
    sheet.querySelector('.mart-sheet-foot').innerHTML = `<div class="mart-sheet-extra">${item.own ? pickBtn : `${tasteHtml(item)}${randomMoreHtml()}`}</div>` + actionsHtml(item);
    syncSheet();
    if (!sheet.open) sheet.showModal();
    paintTune();   // 창이 뜬 뒤 한 번 더 — 가로로 미는 칩 줄의 흐림 · 고른 칩 자리는 폭이 있어야 재요
    body.scrollTop = 0;
    sheet.querySelector('.mart-sheet-x').focus({ preventScroll: true });
}
/** 11-11 조절 칸을 지금 값으로 맞추고 미리보기의 글 자리를 다시 걸어요(미리보기를 새로 그린 뒤마다) */
function paintTune() {
    if (!sheet || !sheetState?.item.simple || !sheetState.item.preview) return;
    if (site.mode !== 'mart') { stopEdit(); syncTune(sheet, sheetState.item); return; }
    armEdit(sheet.querySelector('.mart-sheet-preview'), sheetState.item);
    syncTune(sheet, sheetState.item);
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
        <div class="mart-title"><b>${glyphHtml(item)}<span class="t">${esc(item.name || item.label)}</span></b>${tagsHtml(item)}${favHtml(item)}</div>
        ${kind === 'geulkku' ? designsHtml(item) : ''}<p class="mart-desc">${esc(descOf(item))}${size ? ` · ${size}` : ''}</p>${sourceLinks(item)}${params}
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
let topicGroups = [];   // 목록 자료 topics — [{ id, label, chips }]
const topicGroupLabel = topic => topicGroups.find(g => g.chips.includes(topic))?.label || '';
function textOf(item) { return [item.name || item.label, item.desc, item.source || '', item.topic || '', topicGroupLabel(item.topic), item.world ? `${worldOf(item.world)?.label || ''} 세계관 인물` : '', item.who || '', itemSources(item).map(x => x.title).join(' '), item.categoryLabel, catLabel(item.category, item.categoryLabel), SEARCH_ALSO[item.category] || '', picker?.groupLabel(item.category) || '', item.builtin ? '내장 테마 내장 블루레몬' : '', kind === 'geulkku' ? styleOf(item) : '', ...(item.tags || [])].join(' ').toLowerCase(); }

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
        box.querySelector('.mart-preview-in').innerHTML = viewOf(state);
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

// ── 11-12 「내 글꾸」 — 분류 칩 「내 글꾸 n」을 고르면 목록 맨 앞에 붙여 넣기 칸 + 내가 넣은 글꾸 카드(테마 「+ 내 글꾸」 꼴 · 20개 · 60KB) ──
let ownItems = [], ownBox = null;
function refreshOwn() {
    ownItems = ownList().map(ownItem);
    for (const x of ownItems) if (x.simple && x.preview) { const r = themeTakeable(x.preview, { id: x.id, key: themeKey(x) }); if (!r.ok) x.nt = r.why; }   // 11-12 「테마 아직 못 받음」(목록 틀은 index.json nt)
    for (const x of ownItems) x._text = textOf(x);
    for (let i = states.length - 1; i >= 0; i--) if (states[i].item.own) { stateById.delete(states[i].item.id); states.splice(i, 1); }   // 이름 · 자리가 바뀌면 카드를 새로
    picker?.count(OWN_CAT, ownItems.length);
}
const ownWarnHtml = (warn) => {
    const by = lv => warn.filter(w => w.level === lv), list = (head, cls, ws) => (ws.length ? `<p class="mart-own-warn-h">${head}</p><ul class="mart-own-warn ${cls}">${ws.map(w => `<li>${esc(w.msg)}</li>`).join('')}</ul>` : '');
    if (!warn.length) return '<p class="mart-own-ok">깡통에 올려도 지워지는 것이 없어 보여요</p>';
    return list(`깡통에 올리면 바뀌는 것 ${by('die').length}개`, 'is-die', by('die')) + list('살펴볼 것', 'is-check', by('check')) + list('「HTML 복사」가 고쳐 주는 것', 'is-fix', by('fix'));
};
function ownAddEl() {
    if (ownBox) return ownBox;
    ownBox = document.createElement('section');
    ownBox.className = 'mart-own-add';
    ownBox.setAttribute('aria-label', '내 글꾸 넣기');
    ownBox.innerHTML = `<h2 class="mart-own-h">내 글꾸 넣기 <small>남이 만든 글꾸 · 예전에 쓰던 글꾸 · 마트에서 복사한 글</small></h2>
        <textarea class="field mart-own-text" rows="4" placeholder="공유받은 글꾸 HTML 이나 글꾸 마트에서 복사한 글을 붙여 넣어요" aria-label="글꾸 HTML"></textarea>
        <label class="field-wrap mart-own-name"><input type="text" class="field" maxlength="24" placeholder="이름(비우면 「내 글꾸 n」)" aria-label="내 글꾸 이름"></label>
        <div class="mart-tune-line mart-hscroll"><button type="button" class="btn" data-own="add">넣기</button><button type="button" class="chip" data-own="file" title=".html 파일을 골라 넣어요">.html 파일 고르기</button><input type="file" accept=".html,.htm,text/html" hidden></div>
        <div class="mart-own-msg" role="status"><p class="mart-own-note">스크립트 · 누름 스크립트는 빼고 넣어요 · 마트에서 복사한 글이면 색 · 조절 칸 · 내 글 넣기가 다 돼요 · ${OWN_MAX}개 · 한 벌 60KB 까지 · 이 브라우저에만 남아요</p></div>`;
    const ta = ownBox.querySelector('textarea'), msg = ownBox.querySelector('.mart-own-msg'), file = ownBox.querySelector('input[type=file]'), nameIn = ownBox.querySelector('.mart-own-name input');
    const add = (raw) => {
        const text = String(raw ?? '').trim();
        if (!text) { say('글꾸 HTML 을 붙여 넣어 주세요', 2400); ta.focus(); return; }
        if (text.length > OWN_BYTES) { say(`너무 길어요 · ${Math.round(OWN_BYTES / 1000)}KB 까지예요`, 3000); return; }
        let clean = '';
        try { clean = cleanOwn(text, sanitizeHtml); } catch { clean = ''; }
        if (!clean.trim() || !/<[a-z]/i.test(clean)) { say('읽을 수 있는 HTML 이 없어요', 2600); return; }
        const warn = kkLint(text), row = addOwn({ name: nameIn.value, html: clean, warn });
        if (row === 'full') { say(`내 글꾸는 ${OWN_MAX}개까지예요 · 안 쓰는 것을 지워 주세요`, 3200); return; }
        if (row === 'big') { say('소독한 글이 너무 길어요', 2600); return; }
        if (row === 'quota' || !row) { say('이 브라우저에 더 저장할 칸이 없어요', 3000); return; }
        ta.value = ''; nameIn.value = '';
        refreshOwn(); applyFilter();
        ownBox.querySelector('.mart-own-msg').innerHTML = `<p class="mart-own-done">「${esc(row.name)}」을 넣었어요 · ${row.simple ? '마트 꼴이라 색 · 조절 · 내 글 넣기가 다 돼요' : '붙여 넣은 그대로 보여요 · 내 글은 크게 보기 「내 글 자리 고르기」 자리에 들어가요'}</p>${ownWarnHtml(row.warn)}`;
        say(`「${row.name}」을 내 글꾸에 넣었어요`, 2400);
    };
    ownBox.addEventListener('click', (e) => {
        const b = e.target.closest('[data-own]'); if (!b) return;
        if (b.dataset.own === 'add') add(ta.value);
        else if (b.dataset.own === 'file') file.click();
    });
    file.addEventListener('change', () => {
        const f = file.files?.[0]; file.value = ''; if (!f) return;
        if (f.size > OWN_BYTES * 2) { say('파일이 너무 커요', 2600); return; }
        f.text().then((t) => { if (!nameIn.value) nameIn.value = f.name.replace(/\.html?$/i, '').slice(0, 24); add(t); }, () => say('파일을 못 읽었어요', 2600));
    });
    msg.dataset.ready = '1';
    return ownBox;
}
/** 지우기는 두 번 눌러요(한 번 = 준비 · 3초 안에 한 번 더) */
function ownDelete(state, b) {
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 지워요'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '지우기'; } }, 3000); return; }
    forgetOwn(state.item.ownId);
    if (sheet?.open && sheetState === state) sheet.close();
    refreshOwn(); applyFilter();
    say(`「${state.item.name}」을 지웠어요`, 2400);
}
/** 마트 꼴이 아닌 내 글꾸: 크게 보기 미리보기에서 내 글이 들어갈 칸을 눌러 골라요(다시 누르면 자동으로) */
let ownPicking = false;
function ownPick(state, b) {
    if (state.item.path && !ownPicking) { setOwnPath(state.item.ownId, null); refreshOwn(); const next = ownItems.find(x => x.ownId === state.item.ownId); if (next) openSheet(stateOf(next)); say('내 글 자리를 자동으로 돌렸어요', 2400); return; }
    if (site.mode !== 'mart') setSite('mart');   // 흉내 글은 칸 차례가 달라요
    ownPicking = !ownPicking;
    sheet?.querySelector('.mart-sheet-preview')?.classList.toggle('is-picking', ownPicking);
    b.setAttribute('aria-pressed', String(ownPicking));
    if (ownPicking) say('미리보기에서 내 글이 들어갈 칸을 눌러요', 2600);
}
function applyFilter() {
    const q = (search.value || '').trim().toLowerCase();
    const ownCat = picker?.sel.cat === OWN_CAT;
    let list = (ownCat ? ownItems : allItems).filter(item => (!picker || picker.match(item.category, !!item.builtin, item)) && (ownCat || styleActive === 'all' || styleOf(item) === styleActive) && (!q || item._text.includes(q)));
    const likeCat = picker?.sel.cat in LIKE_CHIPS ? picker.sel.cat : '';   // 11-11 즐겨찾기(누른 차례) · 최근(마지막에 쓴 것부터)
    if (likeCat) list = like[likeCat].map(id => list.find(x => x.id === id)).filter(Boolean);
    // 11-10 「모든 디자인」이면 컨셉(같은 이름) 하나에 카드 하나 — 고른 디자인이 걸러진 안에 있으면 그것, 아니면 처음 것
    if (kind === 'geulkku' && styleActive === 'all' && !ownCat) {
        const by = new Map();
        for (const item of list) { const k = item.name; const had = by.get(k); if (!had || (conceptPick.get(k) === item.id)) by.set(k, item); }
        const keep = new Set(by.values());
        list = list.filter(item => keep.has(item));
    }
    const shown = list.length;
    cards.set(list);   // 첫 화면 몫만 카드로 · 나머지는 빈 칸(스크롤 가까이 오면 묶음으로)
    if (ownCat) grid.prepend(ownAddEl());   // 붙여 넣기 칸은 늘 맨 앞(카드는 그 뒤 · 빈 칸 앞에 붙어요)
    const count = document.querySelector('.mart-count');
    if (count) count.textContent = `${shown}개`;
    const narrowed = styleActive !== 'all' || (picker && (picker.sel.group !== 'all' || picker.sel.cat !== 'all'));
    if (ownCat && !shown) grid.insertAdjacentHTML('beforeend', `<p class="mart-empty">${q ? '맞는 내 글꾸가 없어요' : '아직 없어요 · 위 칸에 글꾸 HTML 을 붙여 넣어요'}</p>`);
    else if (!shown) grid.insertAdjacentHTML('beforeend', `<p class="mart-empty">${likeCat === 'fav' && !q ? '아직 없어요 · 카드 이름 옆 ☆ 를 누르면 여기 모여요' : likeCat === 'recent' && !q ? '아직 없어요 · HTML 복사 · 내려받기 · 글만 복사한 틀이 5개까지 여기 남아요' : `맞는 것이 없어요${narrowed ? ' · 거르기를 풀어 보세요' : ''}`}</p>`);
}
/** 11-12 주소 #뒤 글꾸 id — 깨진 % 글자(#% · #100% · 잘린 #%E0%A4)면 빈 글(전엔 decodeURIComponent 가 던져 다 그린 목록이 「목록을 못 불러왔어요」로 덮였어요) */
export const hashId = (hash = location.hash) => { try { return decodeURIComponent(String(hash).slice(1)); } catch { return ''; } };
async function main() {
    if (kind === 'frames') {
        try { ({ drawPreset } = await import('./frame-presets.js?v=20261112b')); } catch { drawPreset = null; }
    }
    // 글꾸: 가벼운 목록(index.json)만 — 미리보기 · 받기 칸은 조각(chunks)에서 나중에
    const res = await fetch(new URL(kind === 'geulkku' ? './data/geulkku/index.json' : `./data/${kind}.json`, import.meta.url), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`목록 ${res.status}`);
    const data = await res.json();
    const items = data.items || [];
    if (kind === 'geulkku') {
        chunkFiles = data.chunks || {};
        topicGroups = Array.isArray(data.topics) ? data.topics : [];
        const labels = new Map((data.categories || []).map(c => [c.id, c.label]));
        for (const x of items) Object.assign(x, { kind: 'geulkku', label: x.label || x.name, categoryLabel: x.categoryLabel || labels.get(x.category) || '' });
    }
    // 11-11 사용자 「마트에 옛날것들 다 없애라」 — 글꾸 목록(index.json)은 심플 새 틀만이에요(예전의 「컨셉 하나에 심플 하나」 거르기 · 「옛날 버전」 접기는 뺐어요 · 되살리는 법은 마트-길닦기.md 12절)
    const shownItems = items;
    // 분류 두 단계(공용 부품): 묶음 탭 + 하위 칩 — 새 틀은 묶음이 하나라 탭 줄은 숨고 칩만 보여요
    const cats = (data.categories || []).map(c => ({ id: c.id, label: catLabel(c.id, c.label), n: shownItems.filter(x => x.category === c.id).length, group: kind === 'geulkku' ? geulkkuGroup(c, shownItems) : (c.group || 'etc') })).filter(c => c.n);
    // 「내장」 묶음에 다른 분류 안의 내장 글꾸도 한 칩으로 — 가짜 칩 BUILTIN_MORE(새 틀에는 내장이 없어 안 생겨요)
    const builtinCats = new Set(cats.filter(c => c.group === 'builtin').map(c => c.id));
    const moreBuiltin = shownItems.filter(x => x.builtin && !builtinCats.has(x.category)).length;
    if (moreBuiltin) cats.push({ id: BUILTIN_MORE, label: '내장 심플', n: moreBuiltin, group: 'builtin' });
    if (kind === 'geulkku') refreshOwn();
    // 11-12 밤 글꾸: 주제 묶음 탭 + 하위 칩 + 세계관 머리 띠 · 예전 칩(즐겨찾기 · 최근 · 내 글꾸 · 누름 방식)은 보조 거르기 줄로 같이 걸어요(목록 자료에 topics 가 없으면 예전 칩 줄 그대로)
    const topicsEl = document.querySelector('.mart-topics'), bandEl = document.querySelector('.mart-band');
    picker = kind === 'geulkku' && topicGroups.length && topicsEl && bandEl
        ? topicPicker({ groupsEl: document.querySelector('.mart-groups'), topicsEl, chipsEl: chips, bandEl, items: shownItems, groups: topicGroups, cats, onChange: applyFilter, extra: () => [...likeRows(shownItems), [OWN_CAT, '내 글꾸', ownItems.length]] })
        : chipGroups({ groupsEl: document.querySelector('.mart-groups'), chipsEl: chips, cats, groups: GEULKKU_GROUPS, total: shownItems.length, onChange: applyFilter, extra: kind === 'geulkku' ? () => [...likeRows(shownItems), [OWN_CAT, '내 글꾸', ownItems.length]] : null });
    // 그림체(글꾸): 둘 이상일 때만 칩 줄을 보여요 — 하나뿐(지금은 기본만)이면 줄째 숨겨요
    const styleSeg = document.querySelector('[data-filter="style"]');
    if (styleSeg) {
        // 차례는 늘 심플 → 일러스트 → 다꾸 → 무테(모르는 그림체는 자료 차례대로 그 뒤)
        const styles = (data.styles || []).map(s => ({ ...s, id: STYLE_ALIAS[s.id] || s.id, label: STYLE_ALIAS[s.label] || s.label })).filter(s => items.some(x => styleOf(x) === s.id)).map((s, i) => [s, STYLE_ORDER.includes(s.id) ? STYLE_ORDER.indexOf(s.id) : STYLE_ORDER.length + i]).sort((a, b) => a[1] - b[1]).map(([s]) => s);
        const row = styleSeg.closest('.mart-filters') || styleSeg;
        row.hidden = styles.length < 2;
        if (!SHOW_ALL_DESIGNS) { styleSeg.hidden = true; styleSeg.style.display = 'none'; }   // 11-10 심플만 — 디자인 고르기 칩은 숨겨요(개수는 그대로 보여요)
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
    allItems = shownItems;
    for (const x of items) x._text = textOf(x);
    // 11-10 컨셉(같은 이름) 묶기 — 디자인 차례는 심플 → 일러스트 → 다꾸 → 무테 → 그 밖 · 11-11 심플 새 틀은 이름이 같아도 예전 글꾸와 안 묶어요
    const byName = new Map();
    for (const x of items) { const k = x.simple ? `\u0000새 틀\u0000${x.name}` : x.name; const a = byName.get(k) ?? []; a.push(x); byName.set(k, a); }
    const rank = x => (x.builtin ? -1 : STYLE_ORDER.includes(styleOf(x)) ? STYLE_ORDER.indexOf(styleOf(x)) : STYLE_ORDER.length);
    for (const a of byName.values()) { a.sort((p, q) => rank(p) - rank(q)); for (const x of a) x._sibs = a; }
    { const want = hashId(), it = want && items.find(x => x.id === want); if (it) conceptPick.set(it.name, it.id); }   // #글꾸id 로 오면 그 디자인이 카드에 보여요
    { const cr = document.querySelector('.mart-credits'); if (cr) cr.innerHTML = creditsHtml(CAST_GROUPS); }   // 11-12 밤 「원작」 칸 — 캐릭터를 안 골라도 보여요
    mountCast(document.querySelector('.mart-cast'), { say, worlds: () => picker?.worlds?.() || [], openWorld: id => picker?.openWorld?.(id) });   // 11-10 목록 위 「깡통: … ▾ · 깡캐: … ▾」
    cards = lazyGrid(grid, cardEl);
    applyFilter();
    { const p = new URLSearchParams(location.search); if (p.get('g')) picker?.open?.(p.get('g'), p.get('t') || 'all'); }   // 11-13 ?g=묶음&t=하위 칩 — 그 분류를 연 채로 와요(홈 진열대)
    grid.setAttribute('aria-busy', 'false');
    const h = hashId();
    const hit = h && items.find(x => x.id === h);
    // 11-11 옛 글꾸 주소(공유 링크 · 지니 ?view=1#id · 장바구니에 남은 것)로 오면 새 틀 목록을 그대로 보여 주고 한 줄만 알려요
    if (h && !hit && kind === 'geulkku') { say('이 글꾸는 새 틀로 바뀌었어요 · 새 글꾸 틀에서 골라 보세요', 3600); history.replaceState(null, '', location.pathname + location.search.replace(/([?&])view=1(&|$)/, '$1').replace(/[?&]$/, '')); }
    // ?view=1#글꾸id — 그 글꾸의 크게 보기 창을 바로 열어요(지니 결과 카드 「🔍 크게 보기」가 와요) · 목록은 그 자리까지 만들지 않아요
    if (hit && new URLSearchParams(location.search).has('view')) openSheet(stateOf(hit));
    else if (hit && cards.reveal(hit)) stateOf(hit).el.scrollIntoView({ block: 'center' });   // #글꾸id: 그 카드까지 만들고 굴러 가요
    document.querySelector('.mart-random')?.addEventListener('click', pickRandom);
    addEventListener('hashchange', () => { const id = hashId(), it = id && items.find(x => x.id === id); if (it) openSheet(stateOf(it)); });   // 11-12 장바구니 줄 · 주소 고침으로 해시만 바뀌면 그 글꾸 크게 보기
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
    ? import('./frame-room.js?v=20261113r').then(m => (frameMod = m).start({ grid, search, chips, esc, asset, entryOf, copyEntries, cart, say, artName, saveArt, sourceLinks, KIND_LABEL, segHtml, wireSeg, chipGroups, isBuiltin, BUILTIN_TAG, lazyGrid }))
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
export const frameKit = () => import('./frame-room.js?v=20261113r').then(m => (frameMod = m).kit({ esc, asset, entryOf, copyEntries, cart, say, artName, saveArt, sourceLinks, KIND_LABEL, segHtml, wireSeg, chipGroups, isBuiltin, BUILTIN_TAG, lazyGrid }));
export const mylogOn = () => mylog.on;
export { isBuiltin, BUILTIN_TAG, cart, say, esc, asset, ensureItem, previewOf, tagsHtml, glyphHtml, iconSrc, descOf, catLabel, styleOf, entryOf, receipt, doAct, copyEntries, copyHtml, sourceLinks, LOAD_FAIL };
