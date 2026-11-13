import { workByTitle, sourceHtml } from './sources.js?v=20261113p';   // 11-12 밤 원작(출처) 자료 한 곳
// 액자 마트 — 그림 액자 수백 종 + 심플 30종 · 「내 사진 넣어 보기」 · 거르기(분류 · 찾기 · 가로/세로 · 그림체) · 조금씩 그리기 · 크게 보기.
// 크게 보기의 조절 칸은 테마 장식 액자 설정과 같은 이름 · 범위 · 기본값(data/frames.json 의 decor — tools/mart-build.mjs 가 테마 src/decor.js · panel.js · frames.js 에서 옮겨 와요)이고,
// 그리는 규칙도 테마 css/41-decor.css 와 같아요(액자 그림을 사진 위에 100% 100% · 사진은 마스크 + 사진창 clip-path(round 모서리) 안에서 object-fit · object-position · scale · 기울기 rotate · 그림자 SVG 필터).
// 사진은 이 브라우저 안에서만 써요(object URL · 캔버스) — 서버로 보내지 않아요. 「이 기기에 기억」을 켜면 작게 줄여 localStorage 에만 둬요.
const VIEW_KEY = 'bl-mart-view-v1', PHOTO_KEY = 'bl-mart-photo-v1';
const CHUNK = 24;
const VIEW_KEYS = ['opacity', 'zoom', 'x', 'y', 'fit', 'radius', 'presetTilt', 'frameHue', 'frameSat', 'frameBright'];   // 11-08 액자 색감(테마 1.0.7 과 같은 칸)   // 모든 액자에 같이(내 사진 맞춤) · frameWidth · frameHeight 는 액자마다
let api, data, spec, items = [];
let list = [], room = null, current = null, drawPreset = null;
const filters = { style: 'all', orient: 'all', q: '' };
const FRAME_GROUPS = [{ id: 'art', label: '그림 액자' }, { id: 'simple', label: '심플 · 내장' }];   // 심플 20 = 테마에 들어 있는 액자(「내장」으로 모아 봐요)
// 11-05 인물 액자(천지합동청 13 · 강호유람록 7) — 글꾸 마트(mart.js LABEL_FIX · SEARCH_ALSO · SOURCES)와 같은 보이는 이름 · 찾기 말 · 원작 링크
const CAT_SHOW = { 'gangho-char': '무협시뮬 · 인물' };   // 「강호유람록」은 실제 봇 이름 「무협시뮬」로 보여요(자료 이름은 그대로라 옛 이름으로도 찾아져요)
/** 보이는 이름 고침(자료의 옛 이름 → 지금 이름) */
export const showName = s => String(s).replace(/세라프(?= · 천지합동청)/g, '라파엘').replace(/강호유람록/g, '무협시뮬').replace(/^헌시뮬(?= · |$)/, 'D&H');
const catShow = (id, label) => CAT_SHOW[id] || label || '';
const CAT_SEARCH = { 'halo-char': '천지합동청 천악 halo 인물 캐릭터', 'hunter-char': '헌시뮬 헌터 던전 dungeons hunters 디앤에이치 인물 캐릭터', 'gangho-char': '강호유람록 무협 시뮬 무협시뮬 인물 캐릭터', scenic: '감성 풍경 분위기 참고',
    'sentinel-world': '센티넬버스 센가 센가시뮬 센가 아카데미 ksa 세계관', 'sentinel-char': '센티넬버스 센가 센가시뮬 센가 아카데미 센티넬 가이드 인물 캐릭터' };
// 11-06 센티넬버스(세계관 2 · 인물 11) — 깡싸 글 주소가 아직 없어 원작 봇 정식 이름을 글로만 보여요(글꾸 마트 목록 source 와 같은 이름 · 인물은 두 봇에 다 나와요)
const SENGA_SIM = '[실리/1차] 센티넬버스 시뮬레이션(센가시뮬) v1.3', SENGA_ACADEMY = '[실리/1차] 센티넬버스 아카데미';
const botsOf = item => item.kind !== 'frame' ? [] : item.concept === 'sentinel-ksa' ? [SENGA_SIM] : item.concept === 'sentinel-academy' ? [SENGA_ACADEMY] : item.category === 'sentinel-char' ? [SENGA_SIM, SENGA_ACADEMY] : [];
const botText = item => botsOf(item).map(b => sourceHtml(workByTitle(b) || { title: b }, '원작')).join('');   // 11-12 밤 주소를 받아 링크로(sources.js — 글꾸 마트 캐릭터 칸과 같은 자료)
// 인물 액자의 원작 링크는 글꾸 인물과 같은 길(분류 SOURCES + 「char-이름」 깡캐 글)로 — mart.js sourceLinks 를 그대로 빌려요
/** 그 액자의 원작 줄 HTML — 액자 방 · 지니 · 장바구니가 같이 써요(mart.js 가 frameSourceLinks 로 내보내요) */
export const frameLinks = item => links(item);
const links = item => item.kind === 'frame' && /^(halo|hunter|gangho)-char$/.test(item.category)   // 11-13 D&H 인물 액자 8(원작 = 헌시뮬 글)
    ? api.sourceLinks({ kind: 'frame-char', category: item.category, id: `char-${String(item.concept).replace(/^(halo|hunter|gangho)-/, '')}` }) : api.sourceLinks(item) + botText(item);
const states = new Map();
let view = {}, shadow = {}, photo = { url: '', label: '', own: false, file: null };
const root = document.documentElement;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
/** 11-12 주소 #뒤 액자 id — 깨진 % 글자(#% · #100%)면 빈 글(전엔 던져서 목록이 「목록을 못 불러왔어요」로 덮이고 랜덤 · ← → 가 안 붙었어요) */
const hashId = (hash = location.hash) => { try { return decodeURIComponent(String(hash).slice(1)); } catch { return ''; } };
const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
    set(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
};

// ── 맞춤 값(테마와 같은 칸) ──
function tidyView(raw = {}) {
    const d = spec.defaults, out = {};
    for (const s of spec.sliders) {
        if (!VIEW_KEYS.includes(s.key)) continue;
        if (s.key === 'radius' && (raw.radius === null || raw.radius === undefined)) { out.radius = null; continue; }
        const n = Number(raw[s.key]);
        out[s.key] = Number.isFinite(n) ? clamp(n, s.min, s.max) : d[s.key];
    }
    out.fit = spec.fit.some(([v]) => v === raw.fit) ? raw.fit : d.fit;
    return out;
}
function tidyShadow(raw = {}) {
    const d = spec.shadow.defaults, out = { edgeShadow: raw.edgeShadow === true, edgeShadowColor: /^#[0-9a-f]{6}$/i.test(raw.edgeShadowColor ?? '') ? raw.edgeShadowColor : d.edgeShadowColor };
    for (const s of spec.shadow.sliders) { const n = Number(raw[s.key]); out[s.key] = Number.isFinite(n) ? clamp(n, s.min, s.max) : d[s.key]; }
    return out;
}
const radiusOf = () => (view.radius ?? spec.radiusFallback);
function paintView() {
    root.style.setProperty('--mart-opacity', String(view.opacity / 100));
    root.style.setProperty('--mart-zoom', String(view.zoom / 100));
    root.style.setProperty('--mart-pos', `${view.x}% ${view.y}%`);
    root.style.setProperty('--mart-fit', view.fit);
    root.style.setProperty('--mart-radius', `${radiusOf()}px`);
    root.style.setProperty('--mart-tilt', `${view.presetTilt || 0}deg`);
    // 11-08 액자 색감(사용자 11-04 「코발트 액자가 사진 속 보라 넥타이와 안 맞아」) — 테마 decor.js frameFilter 와 같은 식 · 액자 그림만
    const hue = Number(view.frameHue) || 0, sat = view.frameSat ?? 100, bright = view.frameBright ?? 100;
    root.style.setProperty('--mart-filter', !hue && Number(sat) === 100 && Number(bright) === 100 ? 'none' : `hue-rotate(${hue}deg) saturate(${sat}%) brightness(${bright}%)`);
    paintShadow();
}
let saveTimer = 0;
const saveView = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set(VIEW_KEY, { view, shadow }), 300); };
// 테마 frame-shadow.js 와 같은 필터(알파 넓히기 · 흐림 · 옮기기 · 색)
function paintShadow() {
    const svg = document.getElementById('mart-shadow-svg');
    if (!svg) return;
    const s = shadow;
    svg.innerHTML = `<defs><filter id="mart-art-shadow" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB">
        <feMorphology in="SourceAlpha" operator="${s.edgeShadowSpread < 0 ? 'erode' : 'dilate'}" radius="${Math.abs(s.edgeShadowSpread)}" result="expanded"/>
        <feGaussianBlur in="expanded" stdDeviation="${s.edgeShadowBlur / 2}" result="soft"/>
        <feOffset in="soft" dx="${s.edgeShadowX}" dy="${s.edgeShadowY}" result="offset"/>
        <feFlood flood-color="${s.edgeShadowColor}" flood-opacity="${s.edgeShadowAlpha / 100}"/>
        <feComposite in2="offset" operator="in"/>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    room?.querySelector('.room-frame')?.classList.toggle('has-shadow', s.edgeShadow);
}

// ── 액자 한 개의 상태 ──
function stateOf(item) {
    let st = states.get(item.id);
    if (st) return st;
    const base = () => item.kind === 'frame-preset'
        ? { presetColor: item.presetColor, presetAccent: item.presetAccent, presetLabel: item.presetLabel, frameWidth: item.frameWidth ?? 100, frameHeight: item.frameHeight ?? 100 }
        : { frameWidth: 100, frameHeight: 100 };
    st = { item, values: base(), base, el: null, drawn: null, win: null };
    Object.defineProperty(st, 'view', { get: () => ({ ...view, frameWidth: st.values.frameWidth, frameHeight: st.values.frameHeight }) });
    states.set(item.id, st);
    return st;
}
const ratioOf = st => (st.item.kind === 'frame-preset' ? (st.drawn?.ratio ?? 0.75) : st.item.ratio) * st.values.frameWidth / st.values.frameHeight;
const winText = w => (w ? w.map(n => `${n}%`).join(' ') : '0%');
// 테마 decor-view.js windowFor 와 같은 재기(알파 > 8 의 바깥 상자) — 심플 액자 마스크용
const winCache = new Map();
function windowOf(mask) {
    if (winCache.has(mask)) return winCache.get(mask);
    const job = new Promise((resolve) => {
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
            const scale = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
            const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(img.naturalWidth * scale)), height: Math.max(1, Math.round(img.naturalHeight * scale)) });
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, c.width, c.height);
            const { width: w, height: h } = c, px = ctx.getImageData(0, 0, w, h).data;
            let l = w, t = h, r = -1, b = -1;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 8) { l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); b = Math.max(b, y); }
            resolve(r < 0 ? null : [t / h * 100, (w - r - 1) / w * 100, (h - b - 1) / h * 100, l / w * 100].map(n => Math.round(n * 1000) / 1000));
        };
        img.src = mask;
    });
    if (winCache.size > 40) winCache.delete(winCache.keys().next().value);
    winCache.set(mask, job);
    return job;
}
function drawSimple(st) {
    if (!drawPreset) return null;
    try { st.drawn = drawPreset(st.item.presetId, { ...st.values }); } catch (e) { st.drawn = null; st.error = e.message; }
    return st.drawn;
}

// ── 카드 ──
const sizeText = n => (n > 1e6 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
function frameHtml(st, big = false) {
    const { item } = st, esc = api.esc;
    if (item.kind === 'frame-preset') {
        const d = st.drawn || drawSimple(st);
        if (!d) return `<small class="mart-fail">${esc(st.error || '그림 도구를 못 불러왔어요')}</small>`;
        return `<span class="bl-frame" style="--ratio:${ratioOf(st)};--win:${winText(st.win)}"><span class="bl-photo" style="-webkit-mask-image:url('${d.mask}');mask-image:url('${d.mask}')">${big ? '<img class="bl-photo-real" alt="">' : '<span class="bl-photo-img"></span>'}</span><img class="bl-art" alt="" src="${d.art}"></span>`;
    }
    const art = api.asset(big ? item.full : item.thumb), mask = api.asset(big ? item.mask : item.maskThumb);
    return `<span class="bl-frame" style="--ratio:${ratioOf(st)};--win:${winText(item.window)}"><span class="bl-photo" style="-webkit-mask-image:url('${esc(mask)}');mask-image:url('${esc(mask)}')">${big ? '<img class="bl-photo-real" alt="">' : '<span class="bl-photo-img"></span>'}</span><img class="bl-art" alt="" ${big ? '' : 'loading="lazy" decoding="async" '}src="${esc(art)}"></span>`;
}
function paintCard(st) {
    if (!st.el) return;
    st.el.querySelector('.mart-stage').innerHTML = frameHtml(st);
    if (st.item.kind === 'frame-preset' && st.drawn) windowOf(st.drawn.mask).then((w) => { st.win = w; st.el?.querySelector('.bl-frame')?.style.setProperty('--win', winText(w)); });
}
function card(item) {
    const st = stateOf(item);
    if (st.el) return st.el;
    const esc = api.esc;
    const el = st.el = document.createElement('article');
    el.className = `mart-card is-frame${item.kind === 'frame-preset' ? ' is-simple' : ''}`;
    el.dataset.id = item.id;
    const own = api.isBuiltin(item);   // 심플 20 = 테마 장식 액자에 이미 있어요 — 담기 · 복사 대신 안내 + 그림 받기(테마 없이 쓰는 사람용)
    el.innerHTML = `<button type="button" class="mart-preview frame" data-act="open" aria-label="${esc(item.name)} — 크게 보고 맞춰 보기"><span class="mart-stage"></span><span class="mart-zoom-hint tag" aria-hidden="true"><span class="em">🔍</span>맞춰 보기</span></button>
        <div class="mart-title"><b><span class="t">${esc(item.name)}</span></b><span class="mart-tags"><span class="mart-tag tag">${esc(catShow(item.category, item.categoryLabel))}</span>${own ? api.BUILTIN_TAG : ''}</span></div>
        <p class="mart-desc">${esc(item.kind === 'frame-preset' ? item.desc : `${item.orientation === 'landscape' ? '가로' : '세로'} · ${item.styleLabel || ''}`)}${item.bytes && item.kind === 'frame' ? ` · 테마 받기 약 ${sizeText(item.bytes)}` : ''}</p>${links(item)}
        ${own ? `<div class="mart-actions is-builtin"><span class="mart-builtin" title="${BUILTIN_TITLE}">✓ 이미 테마에 들어 있어요</span><button type="button" class="btn" data-act="art" title="지금 색 그대로 그린 PNG — 테마 없이 실리태번 순정에서 쓸 때"><span class="em" aria-hidden="true">🖼️</span>그림 받기</button></div>`
        : '<div class="mart-actions"><button type="button" class="btn mart-pick" data-act="pick" aria-pressed="false"><span class="em" aria-hidden="true">🛒</span>담기</button><button type="button" class="btn" data-act="copy" title="이것 하나만 바로 복사(테마 「마트에서 가져오기」용)">복사</button></div>'}`;
    paintCard(st);
    syncCard(st);
    return el;
}
function syncCard(st) {
    const b = st.el?.querySelector('.mart-pick');
    if (!b) return;
    const on = api.cart.has(api.entryOf(st).key);
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? '담김' : '<span class="em" aria-hidden="true">🛒</span>담기';
    b.title = on ? '다시 누르면 장바구니에서 빼요' : '장바구니에 담기';
    st.el.classList.toggle('is-picked', on);
}
const BUILTIN_TITLE = '블루레몬에이드 테마 설정 › 장식 액자에 이미 있어요 · 색 · 글자도 거기서 바꿔요';
const BUILTIN_SAY = '이미 테마에 들어 있어요 · 테마 설정 › 장식 액자에서 바로 골라요';
function pick(st, from) {
    if (api.isBuiltin(st.item)) { api.say(BUILTIN_SAY, 3200); return; }   // 지니 결과 카드 등 담기 단추가 남은 곳에서 눌러도
    const entry = api.entryOf(st);
    if (api.cart.has(entry.key)) { api.cart.remove(entry.key); api.say('장바구니에서 뺐어요'); return; }
    const got = api.cart.add(entry, from);
    if (got === 'full') api.say('장바구니는 60개까지예요');
    else if (got === 'added') api.say(`담았어요 · 장바구니 ${api.cart.count()}개`, 2400);   // 11-12 밤 맞춰 보기 창 안에서는 머리줄 배지가 가려져 담겼는지 몰랐어요
}

// ── 거르기 · 조금씩 그리기 ──
let picker = null;   // 분류 두 단계(공용 부품 mart.js chipGroups)
/** 11-12 밤 「심플 · 내장」만 볼 때 — 심플 액자에는 방향 · 디자인이 없어 그 거르기를 누르면 0개가 됐어요 → 그 묶음에서는 두 칸을 숨기고 안 걸어요 */
const simpleOnly = () => picker?.sel.group === 'simple' || picker?.sel.cat === 'simple';
function matches(item) {
    if (picker && !picker.match(item.category)) return false;
    const plain = simpleOnly();
    if (!plain && filters.style !== 'all' && item.style !== filters.style) return false;
    if (!plain && filters.orient !== 'all' && item.orientation !== filters.orient) return false;
    return !filters.q || item._text.includes(filters.q);
}
// 카드 늦게 만들기(mart.js lazyGrid · 글꾸 마트와 같은 부품): 첫 화면 몫만 만들고 남은 자리는 빈 칸 높이로 잡아 둬요 — 스크롤이 가까이 오면 다음 묶음
let cards = null;
function applyFilter() {
    list = items.filter(matches);
    cards.set(list);
    const count = document.querySelector('.mart-count');
    if (count) count.textContent = `${list.length}개`;
    for (const seg of document.querySelectorAll('[data-filter="orient"], [data-filter="style"]')) seg.hidden = simpleOnly();
    if (!list.length) api.grid.insertAdjacentHTML('beforeend', '<p class="mart-empty">맞는 것이 없어요 <button type="button" class="btn" data-act="clear-filters">거르기 풀기</button></p>');
}
// 세그(방향 · 그림체)는 공용 부품(mart.js segHtml · wireSeg) — 글꾸 마트 그림체와 같은 모양 · 같은 동작
const segHtml = (options, active) => api.segHtml(options, active);

// ── 사진 ──
async function shrink(blob, side, type = 'image/webp', quality = 0.85) {
    const bmp = await createImageBitmap(blob);
    const s = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(bmp.width * s)), height: Math.max(1, Math.round(bmp.height * s)) });
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const out = await new Promise(r => c.toBlob(r, type, quality));
    c.width = c.height = 1;
    return out;
}
let photoSeq = 0;   // 11-12 사진을 빠르게 두 번 고르면(또는 줄이는 동안 표본 사진 · 지우기를 누르면) 늦게 끝난 앞 사진이 덮었어요 — 마지막에 고른 것만 넣어요
function setPhoto(url, label, own) {
    photoSeq++;   // 줄이는 중인 내 사진은 버려요
    if (photo.own && photo.url && photo.url !== url && photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url);
    photo = { ...photo, url, label, own };
    root.style.setProperty('--mart-photo', `url("${url}")`);
    for (const img of document.querySelectorAll('.bl-photo-real, [data-photo-thumb]')) img.src = url;
    const name = document.querySelector('[data-photo-label]');
    if (name) name.textContent = own ? `내 사진 · ${label}` : `표본 사진 · ${label}`;
    for (const b of document.querySelectorAll('[data-photo="clear"]')) b.hidden = !own;
    for (const k of document.querySelectorAll('.mart-tryon-keep')) k.hidden = !own;   // 11-12 밤 「이 기기에 기억」은 내 사진을 넣었을 때만(표본 사진일 땐 체크만 되고 아무 일도 없었어요)
    for (const s of document.querySelectorAll('select[data-photo="sample"]')) if (own) s.value = '';
    syncSampleBtn();
}
// 11-08 방 안 표본 사진 고르기는 테마식 펼침 목록 — 일부 폰 브라우저(삼성 인터넷 등)는 모달 창(<dialog>) 안의 기본 고르기 목록을 띄우지 않았어요
//   (사용자 「세라피나 · 선술집 눌러도 아무것도 안 떠」). 값은 숨긴 <select> 가 그대로 들고 같은 change 길로 바꿔요
function syncSampleBtn() {
    const text = room?.querySelector('.room-sample-text');
    if (text) text.textContent = photo.own ? `내 사진 · ${photo.label}` : (photo.label || '표본 사진');
}
function toggleSampleList(open) {
    const list = room.querySelector('.room-sample-list'), btn = room.querySelector('.room-sample-btn');
    const show = open ?? list.hidden;
    if (show) {
        const cur = room.querySelector('.room-sample-native').value;
        list.innerHTML = (data.samples || []).map(s => `<button type="button" role="option" class="room-sample-opt" data-room="sample-pick" data-src="${api.esc(s.src)}" aria-selected="${!photo.own && s.src === cur}">${api.esc(s.label)}</button>`).join('');
    }
    list.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
}
async function usePhotoFile(file) {
    if (!file || !/^image\//.test(file.type)) { api.say('그림 파일만 넣을 수 있어요'); return; }
    const my = ++photoSeq;
    try {
        const small = await shrink(file, 1600);   // 큰 폰 사진도 가볍게(방향 정보는 브라우저가 맞춰 줘요)
        if (my !== photoSeq) return;
        photo.file = small;
        setPhoto(URL.createObjectURL(small), (file.name || '붙여 넣은 그림').slice(0, 40), true);
        api.say('내 사진을 모든 액자에 넣었어요 · 사진은 이 브라우저 안에서만 써요', 3200);
        if (document.querySelector('[data-photo="keep"]')?.checked) keepPhoto(true);
    } catch { api.say('그림을 읽지 못했어요'); }
}
async function keepPhoto(on) {
    if (!on || !photo.own || !photo.file) { store.set(PHOTO_KEY, null); return; }
    try {
        let blob = await shrink(photo.file, 640, 'image/webp', 0.8);
        if (blob.type !== 'image/webp') blob = await shrink(photo.file, 640, 'image/jpeg', 0.82);   // 사파리는 webp 로 못 만들어요
        const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
        if (!store.set(PHOTO_KEY, { label: photo.label, data: dataUrl })) api.say('이 브라우저는 저장이 막혀 있어요 · 이 화면에서만 써요', 3200);
    } catch { api.say('사진을 기억하지 못했어요 · 이 화면에서만 써요', 3200); }
}
function clearPhoto() {
    store.set(PHOTO_KEY, null);
    photo.file = null;
    const keep = document.querySelector('[data-photo="keep"]'); if (keep) keep.checked = false;
    const s = data.samples?.[0];
    setPhoto(api.asset(s.src), s.label, false);
    for (const sel of document.querySelectorAll('select[data-photo="sample"]')) sel.value = s.src;
    api.say('내 사진을 지웠어요 · 표본 사진으로 돌아왔어요');
}
const pickPhoto = () => document.querySelector('[data-photo-file]')?.click();
function wirePhoto() {
    const samples = data.samples || [];
    const opts = `<option value="" disabled>표본 사진</option>${samples.map(s => `<option value="${api.esc(s.src)}">${api.esc(s.label)}</option>`).join('')}`;
    for (const sel of document.querySelectorAll('select[data-photo="sample"]')) { sel.innerHTML = opts; sel.value = samples[0]?.src || ''; }
    document.addEventListener('change', (e) => {
        const t = e.target;
        if (t.matches('select[data-photo="sample"]') && t.value) {
            const s = samples.find(x => x.src === t.value);
            store.set(PHOTO_KEY, null); photo.file = null;
            const keep = document.querySelector('[data-photo="keep"]'); if (keep) keep.checked = false;
            setPhoto(api.asset(s.src), s.label, false);
            for (const sel of document.querySelectorAll('select[data-photo="sample"]')) sel.value = s.src;
        } else if (t.matches('[data-photo-file]')) { usePhotoFile(t.files?.[0]); t.value = ''; }
        else if (t.matches('[data-photo="keep"]')) keepPhoto(t.checked);
    });
    document.addEventListener('click', (e) => {
        const act = e.target.closest('[data-photo]')?.dataset.photo;
        if (act === 'pick') pickPhoto();
        else if (act === 'clear') clearPhoto();
    });
    // 끌어다 놓기 · 붙여 넣기
    const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
    let depth = 0;
    addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; depth++; document.body.classList.add('mart-dropping'); });
    addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('mart-dropping'); });
    addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    addEventListener('drop', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault(); depth = 0; document.body.classList.remove('mart-dropping');
        usePhotoFile([...e.dataTransfer.files].find(f => /^image\//.test(f.type)));
    });
    addEventListener('paste', (e) => {
        const file = [...(e.clipboardData?.items || [])].find(i => i.kind === 'file' && /^image\//.test(i.type))?.getAsFile();
        if (file) { e.preventDefault(); usePhotoFile(file); }
    });
    restorePhoto(samples);
}
/** 기억한 내 사진이 있으면 그것, 없으면 첫 표본 사진(마트 · 지니 같이 써요) */
function restorePhoto(samples) {
    const kept = store.get(PHOTO_KEY);
    if (kept?.data && /^data:image\/(webp|jpeg|png);base64,/.test(kept.data)) {
        fetch(kept.data).then(r => r.blob()).then((blob) => {
            photo.file = blob;
            setPhoto(URL.createObjectURL(blob), String(kept.label || '기억한 사진').slice(0, 40), true);
            const keep = document.querySelector('[data-photo="keep"]'); if (keep) keep.checked = true;
        }).catch(() => store.set(PHOTO_KEY, null));
    }
    if (samples[0]) setPhoto(api.asset(samples[0].src), samples[0].label, false);
}

// ── 크게 보기 · 맞춰 보기(테마 장식 액자 설정과 같은 칸) ──
// 11-08 테마 설정 창처럼(사용자 「세로 2열로 파라미터 정렬 · 하나 바꿀 때마다 옆에 되돌리기」): 윗줄 이름 + ↺ + 값, 아랫줄 슬라이더 · ↺ 는 바꾼 칸에만
function slider(s, value, extra = '') {
    const shown = value ?? '', name = api.esc(s.label);
    return `<div class="room-range"><div class="room-range-top"><span class="room-range-name">${name}<button type="button" class="room-undo" data-undo="${s.key}" ${extra} title="${name} · 처음 값으로" aria-label="${name} · 처음 값으로" hidden>↺</button></span><output>${shown === '' ? '칸 기본' : shown}</output></div><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${value ?? spec.radiusFallback}" data-k="${s.key}" aria-label="${name}" ${extra}></div>`;
}
const undoBtn = (key, label) => `<button type="button" class="room-undo" data-undo-p="${key}" title="${label} · 처음 값으로" aria-label="${label} · 처음 값으로" hidden>↺</button>`;
/** 그 칸의 처음 값 — 맞춤 값은 테마 기본값, 가로 · 세로 비율 · 색은 이 액자의 처음 값, 그림자는 그림자 기본값 */
function defaultOf(k, isShadow) {
    if (isShadow) return spec.shadow.defaults[k];
    if (k === 'frameWidth' || k === 'frameHeight' || k.startsWith('preset') && k !== 'presetTilt') return current?.base()[k];
    return spec.defaults[k] ?? null;
}
function valueOf(k, isShadow) {
    if (isShadow) return shadow[k];
    if (k === 'frameWidth' || k === 'frameHeight' || k.startsWith('preset') && k !== 'presetTilt') return current?.values[k];
    return view[k] ?? null;
}
const same = (a, b) => (a ?? null) === (b ?? null) || (typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase());
/** ↺ 를 바꾼 칸에만 보여요 */
function syncUndo() {
    if (!room || !current) return;
    for (const b of room.querySelectorAll('.room-undo[data-undo], .room-undo[data-undo-p]')) {
        const k = b.dataset.undo || b.dataset.undoP, sh = !!b.dataset.shadow;
        const hide = same(valueOf(k, sh), defaultOf(k, sh));
        if (b.hidden !== hide) b.hidden = hide;
    }
}
/** 그 칸만 처음 값으로 */
function undoOne(k, isShadow) {
    const st = current, d = defaultOf(k, isShadow);
    if (isShadow) { shadow[k] = d; paintShadow(); }
    else if (k === 'frameWidth' || k === 'frameHeight' || k.startsWith('preset') && k !== 'presetTilt') { st.values[k] = d; frameChanged(st); }
    else { view[k] = d; paintView(); }
    saveView(); syncRoomControls();
}
// 11-08 미리보기 높이(사용자 「액자 미리보기 너무 커 · 실리태번 블루레몬처럼 줄이게」) — 테마 미리보기의 손잡이 막대 · ↺ 와 같게. 위아래로 놓이는 좁은 화면에서만 보여요
const STAGE_KEY = 'bl-mart-room-stage-h';
function setStageHeight(px, save = true) {
    const box = room.getBoundingClientRect().height || window.innerHeight;
    const h = px === null ? null : Math.round(clamp(px, 120, box * 0.8));
    if (h === null) room.style.removeProperty('--room-stage-h'); else room.style.setProperty('--room-stage-h', `${h}px`);
    room.querySelector('.room-resize-reset').hidden = h === null;
    if (save) store.set(STAGE_KEY, h);
    syncSlack();
}
function wireResize() {
    const grip = room.querySelector('.room-grip'), wrap = room.querySelector('.room-stage-wrap');
    let start = null;
    grip.addEventListener('pointerdown', (e) => { if (e.button > 0) return; start = { id: e.pointerId, y: e.clientY, h: wrap.getBoundingClientRect().height }; grip.setPointerCapture(e.pointerId); e.preventDefault(); });
    grip.addEventListener('pointermove', (e) => { if (start?.id !== e.pointerId) return; setStageHeight(start.h + e.clientY - start.y, false); e.preventDefault(); });
    const end = (e) => { if (start?.id !== e.pointerId) return; start = null; const v = room.style.getPropertyValue('--room-stage-h'); store.set(STAGE_KEY, v ? parseFloat(v) : null); };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('keydown', (e) => {
        if (e.key === 'Home') setStageHeight(null);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') setStageHeight(wrap.getBoundingClientRect().height + (e.key === 'ArrowUp' ? -16 : 16));
        else return;
        e.preventDefault();
    });
    const saved = Number(store.get(STAGE_KEY));
    if (saved > 0) { room.style.setProperty('--room-stage-h', `${saved}px`); room.querySelector('.room-resize-reset').hidden = false; }
}
/** 칸 묶음마다 슬라이더 수가 홀수면 마지막 칸은 한 줄 전체(테마 설정 창과 같게) */
function widenOdd() {
    for (const box of room.querySelectorAll('.room-group, .room-shadow-more')) {
        const ranges = [...box.children].filter(el => el.classList.contains('room-range'));
        ranges.forEach((el, i) => el.classList.toggle('is-wide', ranges.length % 2 === 1 && i === ranges.length - 1));
    }
}
function buildRoom() {
    const esc = api.esc;
    room = document.createElement('dialog');
    room.className = 'mart-room';
    room.setAttribute('aria-labelledby', 'mart-room-title');
    const s = Object.fromEntries(spec.sliders.map(x => [x.key, x]));
    room.innerHTML = `<svg id="mart-shadow-svg" width="0" height="0" aria-hidden="true" style="position:absolute"></svg>
    <div class="room-stage-wrap">
      <div class="room-stage" data-bg="light"><div class="room-frame-box"></div></div>
      <div class="room-stage-bar">
        <button type="button" class="ibtn room-step" data-room="prev" aria-label="앞 액자"><span aria-hidden="true">‹</span></button><span data-room-pos></span><button type="button" class="ibtn room-step" data-room="next" aria-label="다음 액자"><span aria-hidden="true">›</span></button>
        <button type="button" class="btn" data-room="bg" title="배경 밝게 · 어둡게 · 채팅">배경</button>
        <button type="button" class="btn" data-room="random" title="지금 거르기 안에서 하나 더 무작위로"><span class="em" aria-hidden="true">🎲</span>다른 거</button>
        <span class="room-hint">끌어서 옮기고 · 두 손가락(휠)로 확대</span>
      </div>
      <div class="room-resize"><div class="room-grip" role="separator" tabindex="0" aria-label="미리보기 높이 조절" aria-orientation="horizontal" title="위아래로 끌어서 높이 조절"><i></i></div><button type="button" class="room-undo room-resize-reset" data-room="stage-h" aria-label="미리보기 기본 높이" title="기본 높이로" hidden>↺</button></div>
    </div>
    <div class="room-side">
      <header class="room-head"><div><h2 id="mart-room-title"></h2><p class="room-desc"></p><div class="room-source"></div></div><button type="button" class="ibtn x room-x" data-room="close" aria-label="닫기"></button></header>
      <div class="room-photo"><button type="button" class="btn primary mart-tryon-pick" data-photo="pick"><span class="em" aria-hidden="true">📷</span>내 사진 넣기</button><div class="room-sample"><select class="room-sample-native" data-photo="sample" aria-hidden="true" tabindex="-1"></select><button type="button" class="field room-sample-btn" data-room="sample-menu" aria-haspopup="listbox" aria-expanded="false" aria-label="표본 사진 고르기"><span class="room-sample-text"></span></button><div class="room-sample-list" role="listbox" aria-label="표본 사진" hidden></div></div><button type="button" class="btn mart-tryon-clear" data-photo="clear" hidden>지우기</button></div>
      <div class="room-controls">
        <section class="room-group" data-group="frame"><h3>액자</h3>
          <div class="room-preset" hidden><span class="room-color"><label>액자 바탕색 <input type="color" data-p="presetColor"></label>${undoBtn('presetColor', '액자 바탕색')}</span><span class="room-color"><label>액자 포인트색 <input type="color" data-p="presetAccent"></label>${undoBtn('presetAccent', '액자 포인트색')}</span><label class="room-color room-label">칩 글자 <input type="text" class="field" data-p="presetLabel" maxlength="12" placeholder="비우면 없음"></label></div>
          ${slider(s.opacity, view.opacity)}${slider(s.presetTilt, view.presetTilt)}${slider(s.frameWidth, 100)}${slider(s.frameHeight, 100)}
          ${slider(s.frameHue, view.frameHue)}${slider(s.frameSat, view.frameSat)}${slider(s.frameBright, view.frameBright)}
        </section>
        <section class="room-group" data-group="photo"><h3>안쪽 사진</h3>
          <div class="room-seg" role="group" aria-label="안쪽 사진">${spec.fit.map(([v, l]) => `<button type="button" class="chip" data-fit="${v}" aria-pressed="${view.fit === v}">${esc(l)}</button>`).join('')}</div>
          ${slider(s.radius, view.radius)}${slider(s.zoom, view.zoom)}${slider(s.x, view.x)}${slider(s.y, view.y)}
        </section>
        <section class="room-group" data-group="shadow"><h3>그림자 <small>테마 › 테두리 칸 · 받기에는 안 담겨요</small></h3>
          <label class="check room-toggle"><input type="checkbox" data-sh="edgeShadow">그림자</label>
          <div class="room-shadow-more"><label class="room-color">그림자 색 <input type="color" data-sh="edgeShadowColor"></label>
          ${spec.shadow.sliders.map(x => slider(x, shadow[x.key], 'data-shadow="1"')).join('')}</div>
        </section>
        <p class="room-note">이름 · 범위 · 기본값은 테마 설정 › 장식 액자 칸과 같아요. 사진 맞춤(진하기 · 기울기 · 색감 · 모서리 · 채우기 · 확대 · 위치)은 모든 액자에 같이 쓰고, 가로 · 세로 비율은 액자마다 따로예요. 색감은 미리 보기용이라 받기에는 안 담겨요 — 테마 설정 › 장식 액자의 같은 칸으로 맞춰요.</p>
      </div>
      <footer class="room-actions"><button type="button" class="btn" data-room="reset">처음 값</button><button type="button" class="btn mart-pick" data-room="pick"><span class="em" aria-hidden="true">🛒</span>담기</button><button type="button" class="btn" data-room="copy">복사</button><span class="mart-builtin room-builtin" hidden title="${BUILTIN_TITLE}">✓ 이미 테마에 들어 있어요</span><button type="button" class="btn room-art" data-room="art" title="원본 그림 파일 받기 — 테마 없이 실리태번 순정에서 쓸 때"><span class="em" aria-hidden="true">🖼️</span>그림 받기</button></footer>
    </div>`;
    document.body.append(room);
    widenOdd();
    wireResize();
    paintShadow();
    const sel = room.querySelector('select[data-photo="sample"]');
    sel.innerHTML = document.querySelector('.mart-tryon select[data-photo="sample"]')?.innerHTML || '';
    sel.value = photo.own ? '' : (document.querySelector('.mart-tryon select[data-photo="sample"]')?.value || '');
    room.querySelector('[data-photo="clear"]').hidden = !photo.own;
    syncSampleBtn();
    room.addEventListener('input', onRoomInput);
    room.addEventListener('click', onRoomClick);
    room.addEventListener('close', () => { current = null; if (location.hash) history.replaceState(null, '', location.pathname + location.search); });
    wireStage(room.querySelector('.room-stage'));
}
// 사진 좌우 · 위아래는 object-position 이라, 사진이 창(액자 칸)에 그 축으로 꼭 맞으면(여유 0) 움직일 곳이 없어요.
// 「가득 채우기」는 한 축만 넘치고, 확대(scale)는 가운데 기준이라 여유를 만들지 않아요 — 테마(chat-appearance.css 장식 액자)도 같은 규칙.
// 그래서 여유가 없는 축 슬라이더는 옅게(비활성) + 안내를 달고, 값은 그대로 기억해요(다른 사진 · 액자에서 다시 써요).
function slackOf() {
    const img = room?.querySelector('.bl-photo-real'), box = img?.parentElement;
    const iw = img?.naturalWidth, ih = img?.naturalHeight, bw = box?.clientWidth, bh = box?.clientHeight;
    if (!iw || !ih || !bw || !bh) return null;
    const s = view.fit === 'contain' ? Math.min(bw / iw, bh / ih) : Math.max(bw / iw, bh / ih);
    return { x: Math.abs(iw * s - bw), y: Math.abs(ih * s - bh) };
}
const AXIS_NOTE = { x: '좌우 여유가 없어요 — 사진이 창 너비에 꼭 맞아요', y: '위아래 여유가 없어요 — 사진이 창 높이에 꼭 맞아요' };
function syncSlack() {
    if (!room) return;
    const slack = slackOf();
    for (const axis of ['x', 'y']) {
        const input = room.querySelector(`input[data-k="${axis}"]`), label = input?.closest('.room-range');
        if (!label) continue;
        const idle = !!slack && slack[axis] < 1;
        input.disabled = idle;
        label.classList.toggle('is-idle', idle);
        let note = label.nextElementSibling?.classList.contains('room-idle') ? label.nextElementSibling : null;
        if (idle && !note) { note = Object.assign(document.createElement('p'), { className: 'room-idle' }); label.after(note); }
        if (note) { note.hidden = !idle; note.textContent = `${AXIS_NOTE[axis]}. 확대해도 이 축은 안 움직여요(테마도 같아요) · ${view.fit === 'cover' ? '「전체 보이기」나 다른 사진에서 움직여요' : '「가득 채우기」나 다른 사진에서 움직여요'} · 값은 기억해 둬요`; }
    }
}
function syncRoomControls() {
    const st = current;
    for (const input of room.querySelectorAll('input[data-k]')) {
        const k = input.dataset.k, out = input.parentElement.querySelector('output');
        let v;
        if (input.dataset.shadow) v = shadow[k];
        else if (k === 'frameWidth' || k === 'frameHeight') v = st.values[k];
        else v = view[k];
        input.value = v ?? spec.radiusFallback;
        out.textContent = v === null ? `칸 기본(${spec.radiusFallback})` : String(v);
    }
    for (const b of room.querySelectorAll('[data-fit]')) b.setAttribute('aria-pressed', String(view.fit === b.dataset.fit));
    room.querySelector('[data-sh="edgeShadow"]').checked = shadow.edgeShadow;
    room.querySelector('[data-sh="edgeShadowColor"]').value = shadow.edgeShadowColor;
    room.querySelector('.room-shadow-more').hidden = !shadow.edgeShadow;
    const preset = room.querySelector('.room-preset');
    preset.hidden = st.item.kind !== 'frame-preset';
    if (!preset.hidden) {
        preset.querySelector('[data-p="presetColor"]').value = st.values.presetColor;
        preset.querySelector('[data-p="presetAccent"]').value = st.values.presetAccent;
        const label = preset.querySelector('.room-label');
        label.hidden = st.item.presetLabel === undefined;
        label.querySelector('input').value = st.values.presetLabel ?? '';
    }
    syncRoomPick();
    syncSlack();
    syncUndo();
}
function syncRoomPick() {
    if (!current) return;
    // 내장(심플 20): 담기 · 복사 대신 「이미 테마에 들어 있어요」 — 처음 값 · 그림 받기는 그대로
    const own = api.isBuiltin(current.item), foot = room.querySelector('.room-actions');
    foot.classList.toggle('is-builtin', own);
    for (const el of foot.querySelectorAll('[data-room="pick"], [data-room="copy"]')) el.hidden = own;
    foot.querySelector('.room-builtin').hidden = !own;
    const on = api.cart.has(api.entryOf(current).key), b = room.querySelector('[data-room="pick"]');
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? '담김' : '<span class="em" aria-hidden="true">🛒</span>담기';
}
function paintRoom() {
    const st = current, box = room.querySelector('.room-frame-box');
    box.innerHTML = frameHtml(st, true);
    const frame = box.querySelector('.bl-frame');
    frame.classList.add('room-frame');
    frame.classList.toggle('has-shadow', shadow.edgeShadow);
    const real = frame.querySelector('.bl-photo-real');
    real.addEventListener('load', syncSlack);
    real.src = photo.url;
    if (st.item.kind === 'frame-preset') {
        if (st.drawn) windowOf(st.drawn.mask).then((w) => { st.win = w; frame.style.setProperty('--win', winText(w)); });
    } else {
        // 큰 그림(긴 변 1086)은 여기서만 받아요 — 오는 동안은 썸네일
        const art = frame.querySelector('.bl-art'), full = art.src;
        art.src = api.asset(st.item.thumb);
        const big = new Image(); big.decoding = 'async';
        big.onload = () => { if (current === st) art.src = full; };
        big.src = full;
    }
}
function openRoom(st) {
    if (!room) buildRoom();
    current = st;
    const esc = api.esc, item = st.item;
    room.querySelector('#mart-room-title').textContent = item.name;
    room.querySelector('.room-desc').textContent = item.kind === 'frame-preset' ? `심플 액자 · ${item.desc}` : `${catShow(item.category, item.categoryLabel)} · ${item.desc}${item.bytes ? ` · 테마 받기 약 ${sizeText(item.bytes)}` : ''}`;
    room.querySelector('.room-source').innerHTML = links(item);
    const i = list.indexOf(item);
    room.querySelector('[data-room-pos]').textContent = i >= 0 ? `${i + 1} / ${list.length}` : '';
    syncRoomControls();
    paintRoom();
    if (!room.open) room.showModal();
    requestAnimationFrame(syncSlack);
    history.replaceState(null, '', `#${encodeURIComponent(item.id)}`);
}
function step(dir) {
    if (!current) return;
    const i = list.indexOf(current.item);
    if (i < 0 || !list.length) return;
    const next = list[(i + dir + list.length) % list.length];
    openRoom(stateOf(next));
}
// 「🎲 랜덤 추천」 — 지금 거르기(분류 · 방향 · 디자인 · 찾기) 안에서(list) 하나를 무작위로 · 직전 것은 피해요(mart.js randomPick 과 같은 규칙)
let lastRandom = null;
function pickRandom() {
    const pool = list.length > 1 ? list.filter(x => x !== lastRandom) : list;
    if (!pool.length) { api.say('고를 것이 없어요 · 거르기를 풀어 보세요'); return; }
    lastRandom = pool[Math.floor(Math.random() * pool.length)];
    openRoom(stateOf(lastRandom));
}
let redrawTimer = 0;
function frameChanged(st) {
    // 가로 · 세로 비율 · 심플 액자 색 · 글자 — 이 액자만
    if (st.item.kind === 'frame-preset') {
        clearTimeout(redrawTimer);
        redrawTimer = setTimeout(() => { drawSimple(st); paintCard(st); if (current === st) paintRoom(); syncCard(st); syncRoomPick(); }, 60);
        return;
    }
    const r = ratioOf(st);
    st.el?.querySelector('.bl-frame')?.style.setProperty('--ratio', r);
    room?.querySelector('.room-frame')?.style.setProperty('--ratio', r);
    if (room?.open) requestAnimationFrame(syncSlack);
}
function onRoomInput(e) {
    const t = e.target, st = current;
    if (!st) return;
    if (t.dataset.k) {
        const k = t.dataset.k, n = Number(t.value), out = t.parentElement.querySelector('output');
        if (t.dataset.shadow) { shadow[k] = n; paintShadow(); }
        else if (k === 'frameWidth' || k === 'frameHeight') { st.values[k] = n; frameChanged(st); }
        else { view[k] = n; paintView(); }
        out.textContent = String(n);
        saveView();
    } else if (t.dataset.p) {
        st.values[t.dataset.p] = t.value;
        frameChanged(st);
    } else if (t.dataset.sh === 'edgeShadow') {
        shadow.edgeShadow = t.checked; room.querySelector('.room-shadow-more').hidden = !t.checked; paintShadow(); saveView();
    } else if (t.dataset.sh === 'edgeShadowColor') {
        shadow.edgeShadowColor = t.value; paintShadow(); saveView();
    }
    syncUndo();
}
// 그림 받기 — 그림 액자는 원본 webp 그대로(액자-<콘셉트>-<디자인>-<세로|가로>.webp), 심플 액자는 지금 색 그대로 그린 PNG
function saveRoomArt(st) {
    const item = st.item;
    if (item.kind === 'frame-preset') {
        const d = st.drawn || drawSimple(st);
        if (!d) { api.say('그림을 못 그렸어요'); return; }
        api.saveArt(d.art, api.artName(['심플', api.entryOf(st).name], 'png'));
    } else if (item.full) {
        api.saveArt(api.asset(item.full), api.artName([item.conceptLabel, item.styleLabel, item.orientation === 'landscape' ? '가로' : '세로'], 'webp'));
    } else { api.say('받을 그림이 없어요'); return; }
    api.say('그림을 받았어요 · 실리태번에 그대로 올려 써요');
}
function onRoomClick(e) {
    if (e.target === room) { room.close(); return; }   // 바깥(배경) 누르기
    if (!e.target.closest('.room-sample')) toggleSampleList(false);   // 목록 밖을 누르면 닫혀요
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.room === 'sample-menu') { toggleSampleList(); return; }
    if (b.dataset.room === 'sample-pick') {
        const sel = room.querySelector('.room-sample-native');
        sel.value = b.dataset.src;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        toggleSampleList(false);
        room.querySelector('.room-sample-btn').focus();
        return;
    }
    if (b.dataset.undo || b.dataset.undoP) { undoOne(b.dataset.undo || b.dataset.undoP, !!b.dataset.shadow); return; }
    const act = b.dataset.room;
    if (b.dataset.fit) { view.fit = b.dataset.fit; paintView(); saveView(); syncRoomControls(); return; }
    if (act === 'close') room.close();
    else if (act === 'prev') step(-1);
    else if (act === 'next') step(1);
    else if (act === 'random') pickRandom();
    else if (act === 'bg') { const s = room.querySelector('.room-stage'); s.dataset.bg = { light: 'dark', dark: 'chat', chat: 'light' }[s.dataset.bg] || 'light'; }
    else if (act === 'stage-h') setStageHeight(null);
    else if (act === 'pick') { pick(current, b); }
    else if (act === 'copy') { if (api.isBuiltin(current.item)) api.say(BUILTIN_SAY, 3200); else api.copyEntries([api.entryOf(current)]); }
    else if (act === 'art') saveRoomArt(current);
    else if (act === 'reset') {
        view = tidyView(spec.defaults); shadow = tidyShadow(spec.shadow.defaults);
        current.values = current.base();
        paintView(); saveView(); frameChanged(current); syncRoomControls();
        if (current.item.kind !== 'frame-preset') { paintCard(current); paintRoom(); }
    }
}
// 끌어서 옮기기 · 두 손가락 확대 · 휠 확대(테마의 사진 좌우 · 위아래 · 확대 값이 바뀌어요)
function wireStage(stage) {
    const pts = new Map();
    let start = null;
    const snap = () => ({ x: view.x, y: view.y, zoom: view.zoom, pts: new Map([...pts].map(([k, v]) => [k, { ...v }])) });
    const dist = m => { const [a, b] = [...m.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    const commit = () => { paintView(); saveView(); if (room.open) syncRoomControls(); };
    stage.addEventListener('pointerdown', (e) => {
        if (!pts.size && !e.target.closest('.room-frame')) return;   // 11-12 첫 손가락만 액자 위면 돼요 — 둘째 손가락이 액자 옆 빈 무대에 닿으면 무시돼 확대가 안 되고 끌기만 됐어요
        stage.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        start = snap();
    });
    stage.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId) || !start) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const rect = stage.querySelector('.room-frame')?.getBoundingClientRect();
        if (!rect) return;
        const zs = spec.sliders.find(s => s.key === 'zoom');
        if (pts.size >= 2 && start.pts.size >= 2) {
            view.zoom = Math.round(clamp(start.zoom * dist(pts) / dist(start.pts), zs.min, zs.max));
        } else {
            const p0 = start.pts.get(e.pointerId); if (!p0) return;
            const k = 100 / (view.zoom / 100) * 1.4;
            const slack = slackOf();
            if (!slack || slack.x >= 1) view.x = Math.round(clamp(start.x - (e.clientX - p0.x) / rect.width * k, 0, 100));
            if (!slack || slack.y >= 1) view.y = Math.round(clamp(start.y - (e.clientY - p0.y) / rect.height * k, 0, 100));
        }
        paintView();
    });
    const end = (e) => { if (!pts.delete(e.pointerId)) return; start = pts.size ? snap() : null; commit(); };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', (e) => {
        if (!e.target.closest('.room-frame')) return;
        e.preventDefault();
        const zs = spec.sliders.find(s => s.key === 'zoom');
        view.zoom = Math.round(clamp(view.zoom - Math.sign(e.deltaY) * 5, zs.min, zs.max));
        commit();
    }, { passive: false });
}

// ── 시작 ──
/** 목록 · 맞춤 값(테마와 같은 칸) · 심플 액자 그림 도구 받기 — 액자 마트(start)와 지니(kit)가 같이 써요 */
async function load(a) {
    api = a;
    try { ({ drawPreset } = await import('./frame-presets.js?v=20261112b')); } catch { drawPreset = null; }
    const res = await fetch(new URL('./data/frames.json', import.meta.url), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`목록 ${res.status}`);
    data = await res.json();
    spec = data.decor;
    if (!spec) throw new Error('맞춤 칸 정보(decor)가 없어요');
    const saved = store.get(VIEW_KEY);
    view = tidyView({ ...spec.defaults, ...(saved?.view || {}) });
    shadow = tidyShadow({ ...spec.shadow.defaults, ...(saved?.shadow || {}) });
    paintView();
    items = data.items || [];
    // 11-12 밤 보이는 이름 하나로 — frames.json 은 테마 저장소 산출물이라 자료는 그대로 두고 읽자마자 바꿔 보여요(카드 · 맞춰 보기 · 장바구니 · 받는 파일 이름 · 지니가 모두 이 값을 써요).
    //   세라프 → 라파엘(공개 이름 규칙) · 강호유람록 → 무협시뮬 · 헌시뮬 → D&H. 옛 이름은 _old 에 남겨 찾기 말에 넣어요(옛 이름으로도 찾아져요). id · concept 는 그대로.
    for (const x of items) {
        const old = [x.name, x.conceptLabel, x.categoryLabel].filter(Boolean).join(' ');
        for (const k of ['name', 'conceptLabel', 'categoryLabel']) if (typeof x[k] === 'string') x[k] = showName(x[k]);
        x._old = old === [x.name, x.conceptLabel, x.categoryLabel].filter(Boolean).join(' ') ? '' : old;
    }
    for (const c of data.categories || []) if (typeof c.label === 'string') c.label = showName(c.label);
}
/** 지니(genie/) 결과 카드용 — 마트 카드와 같은 그림(frameHtml) · 같은 담기 값(stateOf → entryOf · 맞춰 둔 사진 값 그대로) */
export async function kit(a) {
    await load(a);
    restorePhoto(data.samples || []);
    api.cart.onChange(() => { for (const st of states.values()) syncCard(st); });
    return {
        data, items,
        /** 11-12 밤 그 액자의 원작 줄(인물 · 센티넬버스 봇 포함) — 지니 결과 카드도 액자 방과 같은 줄을 써요 */
        links,
        /** 카드 요소(.mart-stage · .mart-pick 이 든)에 그 액자를 그려요 */
        paint(item, el) { const st = stateOf(item); st.el = el; paintCard(st); syncCard(st); return st; },
        pick: (st, from) => pick(st, from),
        copy: st => api.copyEntries([api.entryOf(st)]),
    };
}
export async function start(a) {
    await load(a);
    for (const item of items) {
        const extra = item.kind === 'frame' && item.concept === 'halo-office' ? '천지합동청 천악 halo' : item.concept === 'hunter-sim' ? '헌시뮬 dungeons hunters 던전' : '';
        item._text = [item.name, item.desc, item.categoryLabel, item.conceptLabel, item.styleLabel, item.style, item.concept, item.orientation === 'landscape' ? '가로' : item.orientation ? '세로' : '', extra, item._old || '', CAT_SEARCH[item.category] || '', ...botsOf(item), catShow(item.category, ''), api.isBuiltin(item) ? '내장 테마 내장 블루레몬' : ''].join(' ').toLowerCase();
    }
    // 분류 두 단계(글꾸 마트와 같은 부품): 묶음 탭 「그림 액자 · 심플」 + 하위 칩 · 방향 · 그림체
    const cats = (data.categories || []).map(c => ({ id: c.id, label: catShow(c.id, c.label), n: items.filter(x => x.category === c.id).length, group: c.group || (c.id === 'simple' ? 'simple' : 'art') })).filter(c => c.n);
    picker = api.chipGroups({ groupsEl: document.querySelector('.mart-groups'), chipsEl: api.chips, cats, groups: FRAME_GROUPS, total: items.length, onChange: applyFilter });
    const orient = document.querySelector('[data-filter="orient"]'), style = document.querySelector('[data-filter="style"]');
    orient.innerHTML = segHtml([['all', '전체'], ['portrait', '세로'], ['landscape', '가로']], 'all');
    style.innerHTML = segHtml([['all', '모든 디자인'], ...(data.styles || []).map(s => [s.id, s.label])], 'all');
    api.wireSeg(orient, (v) => { filters.orient = v; applyFilter(); });
    api.wireSeg(style, (v) => { filters.style = v; applyFilter(); });
    { const count = document.querySelector('.mart-count'); if (count) { count.classList.add('is-line'); api.grid.before(count); } }   // 11-12 밤 개수는 목록 바로 위 왼쪽 한 줄(폰에서는 거르기 줄을 옆으로 밀어야 보였어요)
    let qt = 0;
    api.search.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { filters.q = api.search.value.trim().toLowerCase(); applyFilter(); }, 120); });
    // 카드 누르기
    api.grid.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-act]'); if (!b) return;
        if (b.dataset.act === 'clear-filters') {   // 빈 결과에서 한 번에 풀기: 찾기 · 방향 · 디자인 · 분류
            api.search.value = ''; filters.q = ''; filters.orient = filters.style = 'all';
            for (const seg of [orient, style]) for (const x of seg.children) x.setAttribute('aria-pressed', String(x === seg.firstElementChild));
            (document.querySelector('.mart-groups:not([hidden]) [data-group="all"]') || api.chips.querySelector('[data-cat="all"]'))?.click();
            applyFilter(); api.search.focus({ preventScroll: true }); return;
        }
        const st = states.get(b.closest('.mart-card')?.dataset.id); if (!st) return;
        if (b.dataset.act === 'open') openRoom(st);
        else if (b.dataset.act === 'pick') pick(st, b);
        else if (b.dataset.act === 'copy') api.copyEntries([api.entryOf(st)]);
        else if (b.dataset.act === 'art') saveRoomArt(st);   // 내장 심플 카드의 「그림 받기」(지금 색 그대로 PNG)
    });
    api.cart.onChange(() => { for (const st of states.values()) syncCard(st); syncRoomPick(); });
    wirePhoto();
    // 조금씩 그리기 — 첫 화면 몫(CHUNK)만 만들고 빈 칸이 가까워지면 다음 CHUNK 개(mart.js lazyGrid)
    cards = api.lazyGrid(api.grid, card, { first: CHUNK, step: CHUNK });
    applyFilter();
    { const cat = new URLSearchParams(location.search).get('cat'); if (cat) api.chips.querySelector(`[data-cat="${CSS.escape(cat)}"]`)?.click(); }   // 11-13 ?cat=분류 id(seasons · halloween · christmas · scenic · worlds · halo-char …) — 그 칩을 고른 채로 와요(홈 진열대)
    api.grid.setAttribute('aria-busy', 'false');
    const h = hashId();
    const hit = h && items.find(x => x.id === h);
    if (hit) openRoom(stateOf(hit));
    document.querySelector('.mart-random')?.addEventListener('click', pickRandom);
    addEventListener('hashchange', () => { const id = hashId(), it = id && items.find(x => x.id === id); if (it) openRoom(stateOf(it)); });   // 11-12 장바구니 줄 · 주소 고침으로 해시만 바뀌면 그 액자 맞춰 보기(openRoom 은 replaceState 라 다시 안 불려요)
    if (new URLSearchParams(location.search).has('random')) { history.replaceState(null, '', location.pathname); pickRandom(); }   // 홈 「🎲 오늘의 액자」
    addEventListener('resize', () => { if (room?.open) syncSlack(); });
    addEventListener('keydown', (e) => { if (room?.open && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); } });
}
