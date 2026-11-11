// 글꾸 지니(mart/genie/) — 아키네이터처럼 몇 가지를 묻고 글꾸 · 액자를 하나 맞혀 추천해요. 시안(재정비-1103/글꾸-지니/지니-시안.html)의 캐릭터 · 말투 · 흐름 · 점수표 그대로예요.
// 자료는 마트가 읽는 파일 그대로예요: 글꾸 data/geulkku/index.json(가벼운 목록 · 미리보기는 그 틀의 조각만 나중에) · 액자 data/frames.json. 고른 쪽만 받아요.
// 결과 카드는 마트 부품을 빌려 써요(mart.js 의 조각 받기 · 미리보기 · 담기 · HTML 복사, frame-room.js 의 액자 그림 · 담기) — 그래서 담기 · 복사 내용이 마트와 똑같아요.
// 주소: ?kind=frames 면 액자부터 · 캡처용 ?scene=hello|ask|guess|result|party&seed=숫자&answers=0,1,0,0,0
import { geulkkuList, frameKit, mylogOn, cart, esc, ensureItem, previewOf, tagsHtml, glyphHtml, descOf, entryOf, doAct, sourceLinks, LOAD_FAIL, isBuiltin, BUILTIN_TAG } from './mart.js?v=20261111w';
import { lemonize } from './lemon.js?v=20261109a';   // 11-09 레몬 하나 — 🍋 대신 테마와 같은 레몬 그림(lemon.svg)

const Q = new URLSearchParams(location.search);
const seed = Number(Q.get('seed')) || 0;
const rnd = seed ? mulberry(seed) : Math.random;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = arr => arr[Math.floor(rnd() * arr.length)];

/* ───────── 점수표 · 질문 흐름 ─────────
   w = { cat:{분류id:점수}, name:{이름에 들어가면 점수}, concept:{콘셉트id:점수} }
   set = 되돌릴 수 없는 거름망(style · orientation · kind)
   react = 고른 직후 지니가 넘겨짚는 한마디(다음 질문 위에 붙어요) */
// 11-11 글꾸 마트가 심플 새 틀 28개만 남아서(사용자 「마트에 옛날것들 다 없애라」) 글꾸 질문을 새 틀에 맞춰 줄였어요.
//   그림 결(심플 · 일러스트 · 다꾸 · 무테) · 세계관 · 인물 질문은 뺐어요(새 틀은 전부 심플이고 세계관 틀이 없어요).
//   점수는 새 틀 이름(name)과 분류(cat — simple-open 눌러서 열어요 · simple-tap 누르면 바뀌어요 · simple-sound 소리 카드 · simple-still 가만히 보기)로만 줘요.
//   옛 질문표는 git 이력(되살릴 자리 — 마트-길닦기.md 12절)에 있어요.
const GEULKKU_STEPS = [
    { id: 'mood', q: '먼저… 오늘 분위기가 어때요?', opts: [
        { t: '상큼', i: '🍋', react: '탄산 터지는 소리가 들려요. 밝은 쪽이군요.', w: { name: { '여름 바다': 3, '바람개비': 3, '형광펜': 3, '토스터': 2, '메신저': 2, '견출지': 2, '지퍼': 3, '줄자': 3, 'RPG 스탯': 1 } } },
        { t: '차분', i: '🌙', react: '흠… 밤에 로그를 올리는 깡이군요.', w: { name: { '새벽': 3, '흐림': 3, '티백': 3, '모래시계': 2, '음성 메모': 2, '블라인드': 2, '바인더': 3, '돋보기': 3, '뉴턴의 요람': 1, '라면': 1 } } },
        { t: '달달', i: '🎀', react: '입꼬리가 벌써 올라갔네요.', w: { name: { '편지 봉투': 3, '실 전화': 3, '낫표': 3, '쥘부채': 3, '새해 첫날': 2, '카페 영수증': 3, '라면': 3 } } },
        { t: '으스스', i: '👻', react: '촛불이 흔들려요… 이쪽이군요.', w: { name: { '호박': 3, '성냥': 3, '새벽': 2, '지우개': 3, '블라인드': 1, '모래시계': 1 } } },
    ] },
    { id: 'touch', q: '글꾸를 누르면 어떻게 되면 좋겠어요?', opts: [
        { t: '열어야 글이 나와요', i: '🎁', react: '두근두근 여는 맛이군요.', w: { cat: { 'simple-open': 3 } } },
        { t: '뭔가 바뀌어요', i: '✨', react: '눌러 보는 재미를 아는 분.', w: { cat: { 'simple-tap': 3 } } },
        { t: '목소리가 들려요', i: '🎧', react: '소리까지 챙기는 분이군요.', w: { cat: { 'simple-sound': 3 } } },
        { t: '그냥 보기만 해요', i: '🖼️', react: '조용히 읽히는 글이 좋군요.', w: { cat: { 'simple-still': 2 }, name: { '여름 바다': 1, '음성 메모': 1, '바람개비': 1 } } },
    ] },
    { id: 'sky', q: '창밖은 지금 어때요?', opts: [
        { t: '쨍쨍해요', i: '☀️', react: '선글라스 챙기셨죠.', w: { name: { '여름 바다': 3, '새해 첫날': 2, '바람개비': 2, '토스터': 1 } } },
        { t: '흐리거나 비 와요', i: '🌧️', react: '빗소리 들으며 쓰는 글… 좋죠.', w: { name: { '흐림': 3, '블라인드': 2, '티백': 2, '실 전화': 1 } } },
        { t: '밤이에요', i: '🌙', react: '역시… 밤 사람.', w: { name: { '새벽': 3, '성냥': 2, '호박': 2, '모래시계': 1, '음성 메모': 1 } } },
        { t: '모르겠어요', i: '🕰️', react: '시간 감각을 잃은 분… 글이 잘 써지는 때죠.', w: {} },
    ] },
];

const FRAME_STEPS = [
    { id: 'mood', q: '먼저… 오늘 분위기가 어때요?', opts: [
        { t: '상큼', i: '🍋', react: '탄산 터지는 소리가 들려요.', w: { cat: { seasons: 2, weather: 1, daily: 1, games: 1, scenic: 1 }, concept: { summer: 2, sunny: 2, rainbow: 2, 'lemon-water': 3, picnic: 2, spring: 1 } } },
        { t: '차분', i: '🌙', react: '흠… 밤에 로그를 올리는 깡이군요.', w: { cat: { basic: 2, graphic: 1, scenic: 2 }, concept: { 'night-sky': 3, watercolor: 2, memo: 2, cafe: 2, 'celestial-archive': 2, 'frost-system': 1, 'layered-memo': 1 } } },
        { t: '달달', i: '🎀', react: '입꼬리가 벌써 올라갔네요.', w: { cat: { birthday: 2, christmas: 1 }, concept: { cake: 2, balloons: 2, 'birthday-gift': 2, confetti: 2, ribbon: 2, 'pixel-heart': 2, carousel: 2, 'ferris-wheel': 1 } } },
        { t: '으스스', i: '👻', react: '촛불이 흔들려요… 이쪽이군요.', w: { cat: { halloween: 4 }, concept: { 'magic-mirror': 1, 'black-cat': 1 } } },
    ] },
    { id: 'feel', q: '만져 보면 어떤 느낌이면 좋겠어요?', opts: [
        { t: '납작하게', i: '📐', react: '종이 위에 그린 느낌이군요.', w: {} },
        { t: '입체로', i: '🧊', react: '손에 잡히는 게 좋은 분.', w: {} },
        { t: '진짜처럼', i: '📷', react: '질감 덕후… 알아봤어요.', w: {} },
        { t: '선만 살짝', i: '🤍', react: '미니멀리스트군요. 바로 보여 드릴게요.', set: { kind: 'frame-preset' } },
    ] },
    { id: 'flat', when: a => a.feel === 0, q: '선은 어떤 선?', opts: [
        { t: '또렷한 선', i: '✏️', react: '깔끔한 2D 결이에요.', set: { style: 'two-d' } },
        { t: '붓 자국', i: '🎨', react: '손맛 나는 일러스트 결이에요.', set: { style: 'illustrated' } },
    ] },
    { id: 'solid', when: a => a.feel === 1, q: '어떤 입체?', opts: [
        { t: '반들반들', i: '🧊', react: '매끈한 3D 결이에요.', set: { style: 'three-d' } },
        { t: '몰랑몰랑', i: '🧸', react: '손으로 빚은 클레이 결이에요.', set: { style: 'clay' } },
    ] },
    { id: 'real', when: a => a.feel === 2, q: '어떤 진짜?', opts: [
        { t: '질감 그대로', i: '📷', react: '나무 · 금속 그대로, 실사풍이에요.', set: { style: 'skeuomorphism' } },
        { t: '투명 유리', i: '🫧', react: '비치는 유리 결이에요.', set: { style: 'glassy' } },
    ] },
    { id: 'shape', when: a => a.feel !== 3, q: '넣을 사진은 어떤 모양이에요?', opts: [
        { t: '세로', i: '📱', react: '폰으로 찍은 사진이군요.', set: { orientation: 'portrait' } },
        { t: '가로', i: '🖥️', react: '풍경 사진이 많은 분.', set: { orientation: 'landscape' } },
        { t: '상관없어요', i: '🤷', react: '둘 다 보여 드릴게요.', w: {} },
    ] },
    { id: 'use', when: a => a.feel !== 3, q: '이 액자, 어디에 걸어요?', opts: [
        { t: '일상 채팅', i: '📅', react: '매일 보는 액자군요.', w: { cat: { daily: 2, basic: 1, weather: 1, seasons: 1 } } },
        { t: '기념일', i: '🎉', react: '달력에 동그라미 쳐 둔 날이 있군요.', w: { cat: { birthday: 3, christmas: 2 } } },
        { t: '놀이 · 게임', i: '🎮', react: '코인 넣는 소리가 들려요.', w: { cat: { games: 3 } } },
        { t: '세계관 · 그래픽', i: '🏰', react: '오… 깊은 세계에 사는 분이군요.', w: { cat: { worlds: 3, graphic: 2, 'halo-char': 2, 'gangho-char': 2, 'sentinel-world': 3, 'sentinel-char': 2 } } },
    ] },
];

const FLOWS = {
    geulkku: { steps: GEULKKU_STEPS, label: '글꾸', hello: '안녕하세요, 글꾸 지니예요.\n몇 가지만 물어보면 <em>당신이 원하는 글꾸</em>를 맞혀 볼게요.' },
    frames: { steps: FRAME_STEPS, label: '액자', hello: '안녕하세요, 글꾸 지니예요.\n이번엔 <em>당신 사진에 딱 맞는 액자</em>를 맞혀 볼게요.' },
};

/* ───────── 자료 — 마트가 읽는 파일 그대로, 고른 쪽만 한 번 받아요 ───────── */
const DATA = {};        // { geulkku: { categories, items }, frames: { categories, items } }
let frames = null;      // frame-room.js 지니용 부품(그리기 · 담기)
const jobs = {};
function loadKind(k) {
    jobs[k] ||= (k === 'geulkku'
        ? geulkkuList().then((d) => { DATA.geulkku = d; })
        : frameKit().then((kit) => { frames = kit; DATA.frames = kit.data; }));
    jobs[k].catch(() => { delete jobs[k]; });   // 실패하면 다음에 다시 받아요
    return jobs[k];
}

/* ───────── 상태 ───────── */
let kind = Q.get('kind') === 'frames' ? 'frames' : 'geulkku';
let answers = {}, stepIdx = -1, guessDone = false, guessCat = null, guessDelta = {}, current = null, filters = {}, seen = new Set(), tier = 0, cardState = null;

const $ = id => document.getElementById(id);
const genie = $('gn-genie'), bubble = $('gn-bubble'), choices = $('gn-choices'), result = $('gn-result'), hint = $('gn-hint'), dots = $('gn-dots');
const instant = !!Q.get('scene');   // 캡처 장면은 뜸 들이지 않아요

function setMood(m) { genie.dataset.mood = m; }
function say(html, lead) { bubble.innerHTML = (lead ? `<small>${lead}</small>` : '') + `<span class="q">${html.replace(/\n/g, '<br>')}</span>`; bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = ''; }
function buttons(list) {
    choices.innerHTML = list.map((b, i) => `<button type="button" class="${b.cls || ''}" data-i="${i}">${b.i ? `<span class="ico" aria-hidden="true">${lemonize(b.i)}</span>` : ''}${esc(b.t)}</button>`).join('');
    choices.onclick = (e) => { const btn = e.target.closest('button'); if (btn) list[+btn.dataset.i].on(); };
    choices.hidden = !list.length;
}
function activeSteps() { return FLOWS[kind].steps.filter(s => !s.when || s.when(answers)); }
function drawDots() { const total = activeSteps().length + 1; dots.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < stepIdx ? 'on' : i === stepIdx ? 'now' : ''}"></i>`).join(''); }

/* ───────── 점수 ───────── */
function catLabel(id) { const c = DATA[kind].categories.find(x => x.id === id); return c ? c.label : id; }
function score(item) {
    let s = 0;
    for (const st of activeSteps()) {
        const o = st.opts[answers[st.id]]; if (!o || !o.w) continue;
        s += (o.w.cat?.[item.category] || 0);
        if (o.w.concept) s += (o.w.concept[item.concept] || 0);
        if (o.w.name) for (const k in o.w.name) if (item.name.includes(k)) s += o.w.name[k];
    }
    s += guessDelta[item.category] || 0;
    return s;
}
// 「다른 거!」를 누를수록 0 → 1 → 2 점 아래 후보까지 넓혀요
function candidates(t = tier) {
    let pool = DATA[kind].items;
    if (kind === 'frames') pool = pool.filter(i => (filters.kind ? i.kind === filters.kind : i.kind === 'frame'));
    for (const k of ['style', 'orientation']) if (filters[k]) pool = pool.filter(i => i[k] === filters[k]);
    const scored = pool.map(i => ({ i, s: score(i) })).sort((a, b) => b.s - a.s);
    if (!scored.length) return [];
    const top = scored[0].s;
    if (top <= 0) return scored.map(x => x.i);                                         // 점수 없으면 전부(거름망만)
    let best = scored.filter(x => x.s >= top - t).map(x => x.i);
    if (best.length < 3) best = scored.filter(x => x.s >= top - t - 1).map(x => x.i);  // 동점이 적으면 한 칸 아래까지
    return best;
}
function topCategory() {
    const tally = {};
    for (const i of candidates()) tally[i.category] = (tally[i.category] || 0) + 1;
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/* ───────── 흐름 ───────── */
function start() {
    answers = {}; filters = {}; stepIdx = -1; guessDone = false; guessCat = null; guessDelta = {}; seen = new Set(); current = null; tier = 0; cardState = null;
    result.hidden = true; result.innerHTML = ''; hint.innerHTML = '';
    document.querySelectorAll('.gn-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
    setMood('hello'); drawDots();
    say(FLOWS[kind].hello);
    buttons([{ t: `${FLOWS[kind].label} 찾아 주세요`, i: '🔮', cls: 'gn-wide gn-lemon', on: () => { stepIdx = 0; ask(); } }]);
    hint.innerHTML = `${DATA[kind].items.length}종 중에서 골라요 · 질문은 4~6개예요`;
    const foot = $('gn-foot'), n = ['geulkku', 'frames'].filter(k => DATA[k]).map(k => `${FLOWS[k].label} ${DATA[k].items.length}종`).join(' · ');
    if (foot) foot.firstChild.textContent = `블루레몬에이드 마트 · 글꾸 지니 · 자료는 마트 목록(${n}) 그대로예요 · `;
}
function ask(lead) {
    const steps = activeSteps();
    if (stepIdx >= steps.length) return guess(lead);
    const st = steps[stepIdx];
    setMood('hello'); drawDots();
    say(st.q, lead);
    buttons(st.opts.map((o, i) => ({ t: o.t, i: o.i, cls: st.opts.length === 2 || (st.opts.length % 2 === 1 && i === st.opts.length - 1) ? 'gn-wide' : '', on: () => choose(st, i) })));
    hint.innerHTML = stepIdx > 0 ? '<button type="button" id="gn-back">← 앞 질문으로</button>' : '';
    const back = $('gn-back');
    if (back) back.onclick = () => { stepIdx = Math.max(0, stepIdx - 1); const prev = activeSteps()[stepIdx]; delete answers[prev.id]; if (prev.opts.some(o => o.set)) for (const o of prev.opts) for (const k in (o.set || {})) delete filters[k]; ask(); };
}
function choose(st, i) {
    const o = st.opts[i];
    answers[st.id] = i;
    if (o.set) Object.assign(filters, o.set);
    if (filters.kind === 'frame-preset') { stepIdx = activeSteps().length; return think(() => reveal(o.react), 700); }
    stepIdx += 1;
    think(() => ask(o.react), 650);
}
function think(fn, ms) {
    setMood('think'); say(pick(['흠…', '잠깐만요…', '그렇다면…', '어디 보자…']));
    choices.innerHTML = ''; hint.innerHTML = '';
    if (instant) fn(); else setTimeout(fn, ms);
}
function guessYes() { guessDone = true; guessDelta[guessCat] = (guessDelta[guessCat] || 0) + 2; think(() => reveal('역시 제 촉이 맞았어요.'), 600); }
function guessNo() { guessDone = true; guessDelta[guessCat] = (guessDelta[guessCat] || 0) - 6; think(() => reveal('어… 그럼 이쪽일 거예요.'), 800); }
function guess(lead) {
    const cat = topCategory(); guessCat = cat; drawDots();
    if (!cat || guessDone) return reveal(lead);
    setMood('sure');
    say(`흠… 당신, <em>${esc(catLabel(cat))}</em> 쪽 사람이군요?`, lead);
    buttons([
        { t: '맞아요', i: '🎯', on: guessYes },
        { t: '아니에요', i: '🙅', on: guessNo },
    ]);
    hint.innerHTML = '';
}
function reveal(lead) {
    let list = candidates().filter(i => !seen.has(i.id));
    if (!list.length && tier < 3) { tier += 1; list = candidates().filter(i => !seen.has(i.id)); }   // 다 봤으면 한 칸 넓혀요
    const pool = list.length ? list : candidates();
    if (!pool.length) { setMood('think'); say('어라… 그 조합은 아직 마트에 없어요. 처음부터 다시 해 볼까요?'); buttons([{ t: '처음부터', i: '🔄', cls: 'gn-wide', on: start }]); return; }
    if (!list.length) seen = new Set();
    current = pick(pool); seen.add(current.id);
    stepIdx = activeSteps().length + 1; drawDots();
    setMood('sure');
    say('확신해요… <em>이거예요!</em>', lead);
    renderCard(current);
    buttons([
        { t: '좋아요, 이거!', i: '💛', cls: 'gn-lemon', on: celebrate },
        { t: '다른 거!', i: '🔁', on: () => think(() => reveal(pick(['그럼 이건요?', '흠, 이건 어때요?', '한 번 더 넘겨짚어 볼게요.'])), 500) },
        { t: '처음부터 다시', cls: 'gn-wide gn-ghost', on: start },
    ]);
    hint.innerHTML = tier ? `범위를 ${tier}칸 넓혀 후보 ${pool.length}개 중 하나예요` : `같은 점수 후보 ${pool.length}개 중 하나예요`;
}
function celebrate() {
    setMood('party');
    say(`찾았다! <em>${esc(current.name)}</em>, 당신 거예요.\n마트에서 받아 가세요.`);
    buttons([
        { t: '마트에서 열기', i: '🛒', cls: 'gn-wide gn-pri', on: () => { location.href = martHref(current); } },
        { t: '하나 더 찾기', i: '🔮', cls: 'gn-wide gn-ghost', on: start },
    ]);
    hint.innerHTML = '';
}
/** 마트에서 그 항목 바로 열기 — 글꾸는 크게 보기 창(?view=1#id), 액자는 액자 방(#id) */
function martHref(item) { return kind === 'geulkku' ? `../geulkku/?view=1#${encodeURIComponent(item.id)}` : `../frames/#${encodeURIComponent(item.id)}`; }

/* ───────── 결과 카드 — 마트 카드 부품 그대로 ───────── */
function whyHtml() {
    const bits = [];
    for (const st of activeSteps()) { const o = st.opts[answers[st.id]]; if (o) bits.push(`${o.i} ${o.t}`); }
    return `<div class="gn-why"><b>지니의 근거</b> · ${bits.map(x => lemonize(esc(x))).join(' · ')}${guessCat ? ` · 촉 「${esc(catLabel(guessCat))}」` : ''}</div>`;
}
function renderCard(item) {
    result.hidden = false;
    return kind === 'geulkku' ? geulkkuCard(item) : frameCard(item);
}
function geulkkuCard(item) {
    const state = cardState = { item, values: {} };
    const href = martHref(item);
    const ph = `<div class="mart-ph" style="${item.bg ? `--ph-bg:${esc(item.bg)};` : ''}${item.ink ? `--ph-ink:${esc(item.ink)}` : ''}">${glyphHtml(item, '📝')}<b>${esc(item.name)}</b></div>`;
    const html = '<button type="button" class="btn" data-act="html" title="확장 없이 커뮤니티 글쓰기 HTML 칸에 바로 붙여 쓰는 완성 HTML(보이는 글씨는 전부 바꿔도 돼요)"><span class="em" aria-hidden="true">📋</span>HTML 복사</button>';
    const big = `<a class="btn" href="${href}" title="글꾸 마트의 크게 보기 창으로 가요"><span class="em" aria-hidden="true">🔍</span>크게 보기</a>`;
    // 테마에 이미 든 심플(내장) · HTML 로만 쓰는 오리지널은 마트처럼 담기 대신 표시만
    const first = item.builtin ? '<span class="mart-builtin" title="블루레몬에이드 로그 복사에 이미 있어요 · 마트에서 가져오지 않아도 돼요">✓ 이미 테마에 있어요</span>'
        : item.copyOnly ? '<span class="mart-builtin" title="테마로 받기는 준비 중이에요 · 커뮤니티 글에 HTML 로 붙여 써요">HTML 복사로 써요</span>'
        : '<button type="button" class="btn mart-pick" data-act="pick" aria-pressed="false"><span class="em" aria-hidden="true">🛒</span>담기</button>';
    result.innerHTML = `<article class="mart-card" data-id="${esc(item.id)}"${item.accent ? ` style="--accent:${esc(item.accent)}"` : ''}>
        <a class="mart-preview geulkku${item.preview ? '' : ' is-wait'}" href="${href}" aria-label="${esc(item.name)} 크게 보기"><div class="mart-preview-in" inert>${item.preview ? previewOf(state) : ph}</div><span class="mart-zoom-hint tag" aria-hidden="true"><span class="em">🔍</span>크게 보기</span></a>
        <div class="mart-title"><b>${glyphHtml(item)}<span class="t">${esc(item.name)}</span></b>${tagsHtml(item)}</div>
        <p class="mart-desc">${esc(descOf(item))}</p>${sourceLinks(item)}
        ${whyHtml()}
        ${mylogOn() ? '<p class="gn-mylog">📝 「내 로그로 보기」가 켜져 있어 내 로그로 그렸어요 · HTML 복사도 내 로그로 돼요</p>' : ''}
        <div class="mart-actions gn-acts is-geulkku">${first}${html}${big}</div>
    </article>`;
    const el = state.el = result.firstElementChild;
    el.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) doAct(state, b.dataset.act, b); });
    syncPick();
    if (!item.preview) {
        const box = el.querySelector('.mart-preview');
        ensureItem(item).then(() => {
            if (cardState !== state) return;
            box.querySelector('.mart-preview-in').innerHTML = previewOf(state);
            box.classList.remove('is-wait');
        }, () => { box.classList.add('is-fail'); box.querySelector('.mart-ph b')?.setAttribute('data-fail', LOAD_FAIL); });
    }
}
function frameCard(item) {
    const href = martHref(item);
    const own = isBuiltin(item);   // 심플 액자 = 테마에 이미 있어요 — 담기 대신 안내
    const desc = item.kind === 'frame-preset' ? item.desc : `${item.styleLabel || ''} · ${item.orientation === 'landscape' ? '가로' : '세로'} 그림 액자`;
    result.innerHTML = `<article class="mart-card is-frame${item.kind === 'frame-preset' ? ' is-simple' : ''}" data-id="${esc(item.id)}">
        <a class="mart-preview frame" href="${href}" aria-label="${esc(item.name)} — 액자 방에서 크게 보고 맞춰 보기"><span class="mart-stage"></span><span class="mart-zoom-hint tag" aria-hidden="true"><span class="em">🔍</span>맞춰 보기</span></a>
        <div class="mart-title"><b><span class="t">${esc(item.conceptLabel || item.name)}</span></b><span class="mart-tags"><span class="mart-tag tag">${esc(item.categoryLabel || catLabel(item.category))}</span>${own ? BUILTIN_TAG : ''}</span></div>
        <p class="mart-desc">${esc(desc)}</p>${sourceLinks(item)}
        ${whyHtml()}
        <div class="mart-actions gn-acts is-two">${own ? '<span class="mart-builtin" title="블루레몬에이드 테마 설정 › 장식 액자에 이미 있어요">✓ 이미 테마에 있어요</span>' : '<button type="button" class="btn mart-pick" data-act="pick" aria-pressed="false"><span class="em" aria-hidden="true">🛒</span>담기</button>'}<a class="btn" href="${href}" title="액자 마트의 액자 방에서 이 액자를 바로 열어요"><span class="em" aria-hidden="true">🖼️</span>액자 방에서 보기</a></div>
    </article>`;
    const el = result.firstElementChild;
    const st = cardState = frames.paint(item, el);   // 마트 카드와 같은 그림 · 같은 담김 표시
    el.addEventListener('click', (e) => { const b = e.target.closest('button[data-act=pick]'); if (b) frames.pick(st, b); });
}
/** 글꾸 카드 담김 표시(액자는 frame-room.js 가 맞춰요) */
function syncPick() {
    if (!cardState || cardState.item.kind !== 'geulkku') return;
    const b = cardState.el?.querySelector('.mart-pick'); if (!b) return;
    const on = cart.has(entryOf(cardState).key);
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? '담김' : '<span class="em" aria-hidden="true">🛒</span>담기';
    b.title = on ? '다시 누르면 장바구니에서 빼요' : '장바구니에 담기';
    cardState.el.classList.toggle('is-picked', on);
}
cart.onChange(syncPick);

/* ───────── 시작 · 캡처용 장면 ───────── */
async function switchTo(k) {
    kind = k;
    const url = new URL(location.href);
    if (k === 'frames') url.searchParams.set('kind', 'frames'); else url.searchParams.delete('kind');
    history.replaceState(null, '', url);
    if (!DATA[k]) {
        document.querySelectorAll('.gn-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === k)));
        result.hidden = true; choices.innerHTML = ''; hint.innerHTML = '';
        setMood('think'); say(`잠깐만요… ${FLOWS[k].label} 마트 목록을 펼치는 중이에요.`);
        try { await loadKind(k); } catch { failed(k); return; }
        if (kind !== k) return;
    }
    start();
}
function failed(k) {
    setMood('think');
    say('어라… 마트 목록을 못 받았어요. 잠시 뒤 다시 불러 볼까요?');
    buttons([{ t: '다시 불러오기', i: '🔄', cls: 'gn-wide', on: () => switchTo(k) }]);
}
document.querySelector('.gn-seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.dataset.kind === kind) return; switchTo(b.dataset.kind); });

async function boot() {
    if (instant) document.body.classList.add('gn-shot');
    try { await loadKind(kind); } catch { failed(kind); return; }
    start();
    const scene = Q.get('scene');
    if (!scene || scene === 'hello') return;
    // 캡처용: 첫 두 질문을 자동으로 답하고 세 번째 질문에서 멈춰요(ask) · 끝까지 답하면 넘겨짚기(guess) · 결과(result) · 축하(party)
    const auto = (Q.get('answers') || '0,1,0,0,0,0,0').split(',').map(Number);
    stepIdx = 0; ask();
    let n = 0;
    const stopAt = scene === 'ask' ? 2 : 99;
    while (stepIdx < activeSteps().length && n < stopAt) { const st = activeSteps()[stepIdx]; choose(st, Math.min(auto[n] ?? 0, st.opts.length - 1)); n++; if (filters.kind === 'frame-preset') break; }
    if (scene === 'ask' || scene === 'guess') return;
    if (guessCat && !guessDone) guessYes();               // 「맞아요」 누른 셈
    if (scene === 'party') celebrate();
}
boot();
