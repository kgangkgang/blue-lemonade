// 1.5.3 제자리 번역 — 월드인포 · 프리셋 프롬프트 · 봇카드 칸 · 페르소나 설명 옆 번역 단추
// 11-15 사용자 「월드인포, 프리셋 다 한글화패널이 지원하는 기능들 원본옆에 한글화패널 버튼만들어서 바로 번역가능하게 · 채팅처럼 번역버튼 누르면 번역본 다시누르면 원문」
//   + 「그 전개지시 프롬프트쪽에 번역기능있는거생각하면됨」 → 전개 지시의 「번역 보기」를 뽑은 공용 부품(src/inline-translate.js)을 그대로 써요.
// 누르면 칸 위에 번역본(읽기 전용 상자) · 아래에 원문 칸 그대로 — 다시 누르면 접혀 원문만. 원문 칸(textarea)의 값은 읽기만 해요: 실리태번이 저장 · 내보내기 · 프롬프트 조립에 쓰는 글은 언제나 원문이에요.
// 번역 · 저장 · 진행은 한글화 패널 것(inlineTranslation): 같은 캐시 열쇠 · 같은 진행 부품 · 같은 순서(패널 번역이 도는 동안은 겹쳐 보내지 않아요).
//
// 감시자(MutationObserver)는 하나도 안 걸어요: 해당 서랍 몇 개의 누름 · 고름 · 입력 뒤에만 열린 창을 훑어요(아래 「감시자 없이」). 단추는 칸마다 한 번(data-bl-kt 표시) — 실리태번이 목록을 다시 그리면 새 칸에 새로 붙고, 상태(펼침 · 번역)는 열쇠로 남아요.
import { createInlineTranslate, TR_SVG, trBoxInner, fitBox } from '../../inline-translate.js';
// 쉴 때 그림 둘: 옆에 원작 글꼴 아이콘이 있는 자리는 같은 글꼴의 같은 그림(.kt-g · 같은 기준선이라 잉크 가운데가 저절로 맞아요), 없는 자리는 SVG
const iconHtml = busy => (busy ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>' : `${TR_SVG}<i class="fa-solid fa-language kt-g" aria-hidden="true"></i>`);

const SEP = '␟';
// 번역 그림 잉크 높이 = 옆 원작 아이콘 잉크 높이 × 이 값. 1 이면 위아래 끝까지 옆 아이콘과 같아 화소 반올림까지 똑같이 떨어져요
//   (0.94 로 해 보니 1배 화면에서 잉크 키가 11 대 12 화소로 홀짝이 달라 가운데가 0.5px 어긋났어요)
const INK_RATIO = 1.04;   // 11-15 실측: 1 이면 1배 화면에서 잉크 키 11 대 12 화소(이 그림 가장자리가 덜 번져요) · 1.04 면 폰 3.75 · 3 · PC 1 모두 가운데 0.17px 안 · 키 1.00 ~ 1.05 배
// Font Awesome 6 글꼴 단위(512): 확대(maximize) 잉크 −32 ~ 416 · 번역(language) 잉크 0 ~ 384 — 두 그림 모두 잉크 가운데가 기준선 위 192 라 같은 기준선이면 가운데가 같아요
const FA_UNITS = 512, FA_INK_CENTER = 192, FA_LANG_INK = 384, FA_MAX_INK = 448;
const keyOf = (kind, target, id) => [kind, target, id].join(SEP);
const parseKey = key => { const [kind, target, id] = String(key).split(SEP); return { kind, target, id }; };

/** 시험 · 사진에서 세는 값 (감시 콜백 · 훑기 · 붙인 단추) */
export const inlineCounts = { mutations: 0, scans: 0, attached: 0 };   // mutations = 훑기를 부른 누름 · 고름 수

const CHAR_FIELDS = [
    ['description_textarea', 'description'], ['personality_textarea', 'personality'], ['scenario_pole', 'scenario'],
    ['firstmessage_textarea', 'first_mes'], ['mes_example_textarea', 'mes_example'], ['system_prompt_textarea', 'system_prompt'],
    ['post_history_instructions_textarea', 'post_history_instructions'], ['depth_prompt_prompt', 'character_note'], ['creator_notes_textarea', 'creator_notes'],
];

export function installInlineTargets(api, { doc = document, host = {} } = {}) {
    if (!api?.available) return null;
    const fields = new Map();   // key → { input, root } (가장 최근에 붙인 칸)
    const sourceOf = key => fields.get(key)?.input?.value ?? '';
    const rootOf = key => fields.get(key)?.root ?? null;
    const engine = async () => ({
        async cached(source, key) {
            const found = await blockFor(key);
            return found ? api.view(found) : null;
        },
        async translate(source, key, ui) {
            const found = await blockFor(key);
            if (!found) throw Object.assign(new Error('이 칸은 한글화 패널이 번역하지 않는 칸이에요.'), { userMessage: true });
            return api.translate(found, ui);
        },
    });
    async function blockFor(key) {
        const { kind, target, id } = parseKey(key);
        return api.block(kind, target, id, sourceOf(key));
    }
    const vw = () => (doc.defaultView || globalThis).innerWidth || 0;
    const tr = createInlineTranslate({ sourceOf, rootOf, engine, memo: false, tag: '[한글화 패널] 제자리 번역', iconHtml });

    // ── 단추 · 상자 만들기 (전개 지시와 같은 마크업 · 데이터 키) ──
    function makeButton(key) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'jj-tr-btn bl-kt-btn';
        button.dataset.pact = 'translate';
        button.dataset.tr = key;
        button.setAttribute('aria-label', '번역 보기');
        button.title = '번역 보기';
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = iconHtml(false);
        button.dataset.ic = 'idle';
        return button;
    }
    function makeBox(key) {
        const box = doc.createElement('div');
        box.className = 'jj-tr bl-kt';
        box.dataset.tr = key;
        box.hidden = true;
        box.innerHTML = trBoxInner('menu_button bl-kt-redo', { progress: true, note: '번역은 보기만 해요 · 고치기와 저장은 원문 칸에서' });
        return box;
    }
    const act = event => {
        const target = event.target.closest?.('[data-pact^="translate"]');
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();   // 월드인포 항목 머리(접기 · 펴기) · 실리태번 단추로 번지지 않게
        if (target.__blKtInputEl) ensureBox(target.__blKtInputEl);   // 상자는 처음 누를 때 만들어요(펼친 항목마다 숨은 상자를 미리 깔지 않게)
        const key = target.closest('[data-tr]')?.dataset.tr;
        tr.onAct(target.dataset.pact, key);
        const input = target.__blKtInputEl || target.closest('.jj-tr')?.nextElementSibling;
        if (input) requestAnimationFrame(() => fitBox(input.__blKtBox));
    };
    function ensureBox(input) {
        const key = input.__blKtButton.dataset.tr;
        let box = input.__blKtBox;
        if (!box || !box.isConnected) {
            box = makeBox(key);
            box.addEventListener('click', act);
            input.before(box);
            input.__blKtBox = box;
        } else if (box.dataset.tr !== key) box.dataset.tr = key;
        return box;
    }
    /** 단추를 옆 원작 아이콘(「크게 보기」)과 같은 면 크기 · 글자 크기 · 같은 간격으로. 아직 안 보이면(서랍 닫힘) 다음 프레임에 몇 번 더 */
    function mirror(button, anchor, tries = 8) {
        if (!anchor || !button.isConnected) return;
        // 1.5.2 통합(polish 「이름표 + 크게 보기」 줄): 그 줄은 --bl-ink-row: 1 로 「CSS 가 세로를 맞춘다」고 알려요 — 그러면 JS 는 위치 · 크기를 재지도 밀지도 않아요.
        //   크게 보기 줄은 같은 글꼴 그림을 기준선에 놓아 CSS 만으로 맞추고(style.css .kt-cssrow), 프리셋 이름표 줄은 polish 규칙이 상자를 맞춰요. 간격(앞 형제와 같은 간격)만 레이아웃 값으로 맞춰요
        const win = doc.defaultView || globalThis;
        if (win.getComputedStyle(button).getPropertyValue('--bl-ink-row').trim() === '1') {
            const iconRow = anchor.classList.contains('editor_maximize');
            button.classList.toggle('kt-cssrow', iconRow);
            button.classList.remove('kt-glyph');
            for (const v of ['--kt-w', '--kt-h', '--kt-fs', '--kt-top', '--kt-dy', '--kt-sx', '--kt-sy', '--kt-svg-h', '--kt-svg-w']) button.style.removeProperty(v);
            const p = anchor.previousElementSibling, row = win.getComputedStyle(button.parentElement);
            const flexGap = /flex|grid/.test(row.display) ? parseFloat(row.columnGap) || 0 : 0;
            const gap = iconRow && p?.offsetWidth && p.offsetParent === anchor.offsetParent ? Math.max(0, anchor.offsetLeft - (p.offsetLeft + p.offsetWidth)) : 10;
            button.style.setProperty('--kt-ml', `${gap - flexGap}px`);
            button.__ktVw = vw(); button.__ktAnchor = 'css';
            return;
        }
        button.classList.remove('kt-cssrow');
        const rr = anchor.getBoundingClientRect();
        // 안 보이거나(서랍 닫힘) 창이 열리며 줄었다 커지는 중이면(화면 크기가 제 크기와 1px 넘게 다름) 조금 뒤에 다시
        const moving = Math.abs(rr.width - anchor.offsetWidth) > 1 || Math.abs(rr.height - anchor.offsetHeight) > 1;
        if (!rr.width || !anchor.offsetWidth || moving) { if (tries > 0) setTimeout(() => mirror(button, anchor, tries - 1), moving ? 120 : 16); return; }
        // 창이 열리며 커지는 움직임(transform) 중에도 맞게: 크기는 offset 값 · 간격은 화면 값을 그 배율로 나눠요
        // (offset 값은 온 화소로 반올림돼요 — 배율은 1px 넘게 다를 때만 움직임으로 보고, 크기는 화면 값을 그 배율로 나눈 소수 그대로)
        const k = 1;
        const r = { left: rr.left, width: rr.width / k, height: rr.height / k };
        const icon = anchor.classList.contains('editor_maximize');
        const row = getComputedStyle(button.parentElement);
        const flexGap = /flex|grid/.test(row.display) ? parseFloat(row.columnGap) || 0 : 0;
        const prev = anchor.previousElementSibling?.getBoundingClientRect();
        // 원작 아이콘 옆이면 그 아이콘과 앞 글자 사이와 같은 간격 · 이름표 글자 바로 뒤면 원작 머리줄의 글자 → 아이콘 간격(10)
        const gap = icon && prev?.width ? Math.max(0, Math.round((r.left - prev.right) / k * 100) / 100) : 10;
        let ml = gap - flexGap;
        button.style.setProperty('--kt-ml', `${ml}px`);
        if (icon) {
            const a = getComputedStyle(anchor);
            button.style.setProperty('--kt-w', `${r.width}px`);
            button.style.setProperty('--kt-h', `${r.height}px`);
            button.style.setProperty('--kt-fs', a.fontSize);
        }
        // 이웃의 바깥 여백(테마가 음수로 당겨 둔 곳도 있어요)까지 맞게 — 실제 간격을 재서 한 번 고쳐요
        const real = (button.getBoundingClientRect().left - anchor.getBoundingClientRect().right) / k;
        // (아이콘 옆만 · 16px 안쪽만 — 이름표 옆은 창이 열리며 움직이는 중에 재면 크게 틀려요)
        if (icon && Math.abs(real - gap) > 0.25 && Math.abs(real - gap) <= 16) { ml += gap - real; button.style.setProperty('--kt-ml', `${ml}px`); }
        // 그림 크기를 면과 같은 홀짝의 온 화소로(면 가운데가 화소 사이에 오지 않게) · 줄 세로 가운데를 옆 아이콘과 같게(줄이 글자 기준선 맞춤인 곳도 있어요)
        const fs = parseFloat(getComputedStyle(button).fontSize) || 12.5;
        // 그림 비율(5:3)이 꼭 맞고 위아래 · 좌우 끝이 모두 기기 화소 칸에 떨어지는 크기(기기 화소로 3m × 5m) — 폰처럼 배율이 3.75 여도 가장자리가 번지지 않게
        const dpr = (doc.defaultView || globalThis).devicePixelRatio || 1, m = Math.max(2, Math.round(fs * 0.75 * dpr / 3));
        let sh = 3 * m / dpr, sw = 5 * m / dpr;
        button.style.setProperty('--kt-dy', '0px');
        if (icon) {
            button.style.setProperty('--kt-top', '0px');
            const a = anchor.getBoundingClientRect(), b = button.getBoundingClientRect();
            const d = ((a.top + a.height / 2) - (b.top + b.height / 2)) / k;
            if (Math.abs(d) > 0.25 && Math.abs(d) < 16) button.style.setProperty('--kt-top', `${d}px`);
            // 11-15 사용자 「번역버튼이랑 확대버튼 높이다르네」: 면끼리가 아니라 「잉크끼리」.
            //   옆 아이콘과 똑같은 상자 · 글자 크기 · 줄 높이 · 안쪽 여백 · 세로 맞춤으로 같은 글꼴의 번역 그림을 놓으면 기준선이 같아지고(브라우저 반올림까지 같아요),
            //   두 그림의 잉크 가운데가 글꼴에서 같은 높이(기준선 위 192/512)라 가운데가 맞아요. 키만 잉크 가운데를 축으로 늘려 옆 아이콘의 INK_RATIO 배로
            glyphMode(button, anchor);
        } else button.classList.remove('kt-glyph');
        button.style.setProperty('--kt-svg-h', `${sh}px`); button.style.setProperty('--kt-svg-w', `${sw}px`);
        // 옆이 이름표 글자(프리셋 「Prompt」)면 그림 가운데를 그 글자 잉크 가운데에(면 가운데와 글자 가운데가 1배 화면에서 0.5px 갈렸어요)
        let settled = true;
        if (!icon) {
            // 그림 키(기기 화소)를 글자 잉크 키와 같은 홀짝으로 — 다르면 1배 화면에서 가운데가 반 화소 갈려요
            const th = textInkHeight(anchor);
            if (th) { let hd = Math.round(sh * dpr); if ((hd - Math.round(th * dpr)) % 2) { hd += 1; sh = hd / dpr; sw = sh * 5 / 3; button.style.setProperty('--kt-svg-h', `${sh}px`); button.style.setProperty('--kt-svg-w', `${sw}px`); } }
            const ink = textInk(anchor), svg = button.querySelector('.jj-tr-svg');
            if (ink && svg) { const q = svg.getBoundingClientRect(); const d = ink - (q.top + q.height / 2); if (Math.abs(d) < 6) button.style.setProperty('--kt-dy', `${d}px`); else settled = false; } else settled = false;   // 창이 미끄러져 열리는 중이면 다음 훑기에 다시
        }
        snap(button);
        button.__ktVw = vw();
        button.__ktAnchor = settled ? `${anchor.offsetWidth}x${anchor.offsetHeight}` : '';
    }
    let inkCanvas = null;
    function textInkHeight(el) {
        try {
            const cs = (doc.defaultView || globalThis).getComputedStyle(el), text = el.textContent.trim();
            inkCanvas ||= doc.createElement('canvas');
            const ctx = inkCanvas.getContext('2d');
            ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
            const mt = ctx.measureText(text);
            return mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent;
        } catch (e) { return 0; }
    }
    /** 이름표 글자의 잉크 세로 가운데(화면 좌표): 글자 상자 위 + 브라우저가 쓰는 글꼴 위 높이 = 기준선, 잉크 위아래는 캔버스로 그 글로 재요 */
    function textInk(el) {
        try {
            const node = [...el.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim()) || el.firstChild;
            if (!node) return null;
            const rg = doc.createRange(); rg.selectNodeContents(node.nodeType === 3 ? node : el);
            const box = rg.getClientRects()[0]; if (!box) return null;
            const cs = (doc.defaultView || globalThis).getComputedStyle(el), text = (node.nodeValue || el.textContent).trim();
            inkCanvas ||= doc.createElement('canvas');
            const ctx = inkCanvas.getContext('2d');
            ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
            const mt = ctx.measureText(text), base = box.top + mt.fontBoundingBoxAscent;
            return base - (mt.actualBoundingBoxAscent - mt.actualBoundingBoxDescent) / 2;
        } catch (e) { return null; }
    }
    function glyphMode(button, anchor) {
        const win = doc.defaultView || globalThis, a = win.getComputedStyle(anchor), ab = win.getComputedStyle(anchor, '::before');
        if (!/Font Awesome/i.test(ab.fontFamily)) { button.classList.remove('kt-glyph'); return; }
        const set = (k, v) => button.style.setProperty(k, v);
        set('--kt-g-fs', ab.fontSize); set('--kt-g-lh', ab.lineHeight); set('--kt-g-va', ab.verticalAlign);
        set('--kt-g-pt', a.paddingTop); set('--kt-g-pb', a.paddingBottom); set('--kt-g-bt', a.borderTopWidth);
        set('--kt-g-fw', ab.fontWeight);
        // 상자 꾸밈도 같게: 테마가 그 아이콘을 flex 가운데 · ::before 블록으로 바꾼 자리(봇카드 · 페르소나)가 있어요
        set('--kt-g-d', a.display === 'inline' ? 'block' : a.display); set('--kt-g-ai', a.alignItems); set('--kt-g-jc', a.justifyContent);
        set('--kt-g-h', `${anchor.getBoundingClientRect().height}px`);
        set('--kt-g-bd', ab.display);
        button.classList.add('kt-glyph');
        // 키: 늘리기(transform scale)는 글자를 다시 그리며 기준선이 화소에 다시 맞춰져 1px 가까이 비켜났어요 → 글자 크기를 키우고(F2),
        //   커진 만큼 옮겨진 잉크 가운데를 되돌려요. 옆 아이콘 안에 원래 크기 · 키운 크기의 같은 글자를 폭 0 칸으로 잠깐 놓아 두 잉크 가운데의 차를 재요
        //   (같은 자리 · 같은 맞춤이라 공통 오차는 지워지고 크기 차이 몫만 남아요)
        const f1 = parseFloat(ab.fontSize) || 12.5, f2 = Math.round(f1 * FA_MAX_INK / FA_LANG_INK * INK_RATIO * 1000) / 1000;
        inkCanvas ||= doc.createElement('canvas');
        const ctx = inkCanvas.getContext('2d');
        const center = size => {
            const probe = doc.createElement('span'), mark = doc.createElement('span');
            mark.textContent = '';
            probe.append(mark);
            probe.style.cssText = `display:inline-block;width:0;overflow:visible;white-space:nowrap;visibility:hidden;padding:0;margin:0;border:0;font:${ab.fontStyle} ${ab.fontWeight} ${size}px/${ab.lineHeight} ${ab.fontFamily};vertical-align:${ab.verticalAlign}`;
            anchor.append(probe);
            const top = mark.getBoundingClientRect().top;
            probe.remove();
            ctx.font = `${ab.fontStyle} ${ab.fontWeight} ${size}px ${ab.fontFamily}`;
            return top + ctx.measureText('').fontBoundingBoxAscent - size * FA_INK_CENTER / FA_UNITS;
        };
        const k = 1;   // mirror 가 움직임이 끝난 뒤에만 불러요
        const shift = (center(f2) - center(f1)) / (k || 1);
        set('--kt-g-fs2', `${f2}px`);
        set('--kt-g-ty', `${Math.abs(shift) < 8 ? -shift : 0}px`);
    }
    /** 그림 상자를 기기 화소의 온 칸에 얹어요 */
    function snap(button) {
        const svg = button.querySelector('.jj-tr-svg'); if (!svg || button.classList.contains('kt-glyph') || button.__ktAnchor === 'css') return;
        button.style.setProperty('--kt-sx', '0px'); button.style.setProperty('--kt-sy', '0px');
        const dpr = (doc.defaultView || globalThis).devicePixelRatio || 1, q = svg.getBoundingClientRect();
        // 반 화소 넘게 옮겨야 하면(1배 화면에서 면이 …5 에 놓인 때) 옮기지 않아요 — 그땐 옮기면 가운데에서 0.5px 비켜나고, 그대로 두면 번진 가장자리가 양쪽 같아요
        // 그림 가장자리를 기기 화소 칸에 딱 — 번진 가장자리가 없어 잉크 = 그림 상자(옮긴 만큼은 0.5 기기 화소 안). 소수점 자리는 한쪽만 번져 0.5px 넘게 비켜났어요
        const fix = v => (Math.round(v * dpr) - v * dpr) / dpr;
        button.style.setProperty('--kt-sx', `${fix(q.left)}px`); button.style.setProperty('--kt-sy', `${fix(q.top)}px`);
    }
    // 화면 폭이 바뀌면(폰 ↔ PC · 창 크기) 테마 글자 크기가 달라져요 — 붙여 둔 단추의 면 크기를 다시 맞춰요(창 하나에 리스너 하나)
    let remirror = 0;
    const onResize = () => { if (remirror) return; remirror = requestAnimationFrame(() => { remirror = 0; for (const { input } of fields.values()) { const b = input.__blKtButton; if (b?.isConnected && !b.hidden) mirror(b, b.previousElementSibling); fitBox(input.__blKtBox, true); } }); };
    (doc.defaultView || globalThis).addEventListener?.('resize', onResize);
    /** 칸 하나에 단추 · 상자를 붙이거나(처음) 열쇠를 바꿔요(같은 칸이 다른 항목을 보일 때 — 프롬프트 편집 창 · 봇카드 칸) */
    function attach(input, anchor, key, root) {
        if (!input || !anchor) return;
        let button = input.__blKtButton;
        if (!button || !button.isConnected) {
            button = makeButton(key);
            button.__blKtInputEl = input;
            button.addEventListener('click', act);
            anchor.after(button);
            input.__blKtButton = button;
            mirror(button, anchor);
            input.dataset.blKt = '1';
            inlineCounts.attached++;
        }
        const fresh = !fields.has(key) || fields.get(key).input !== input || button.dataset.tr !== key || button.hidden;
        button.hidden = false;
        if (button.dataset.tr !== key) { button.dataset.tr = key; if (input.__blKtBox) input.__blKtBox.dataset.tr = key; }
        fields.set(key, { input, root });
        if (fresh && tr.states.get(key)?.open) { ensureBox(input); requestAnimationFrame(() => fitBox(input.__blKtBox)); }   // 펼쳐 둔 칸을 실리태번이 다시 그렸으면 상자도 다시
        // 화면 폭이 바뀌었거나, 처음 맞출 때 옆 아이콘이 안 보여 못 맞췄거나(고급 정의 창이 닫혀 있던 때) 옆 아이콘 크기가 바뀌었으면 다시 맞춰요
        if (!fresh && button.__ktAnchor !== 'css' && (button.__ktVw !== vw() || button.__ktAnchor !== `${anchor.offsetWidth}x${anchor.offsetHeight}`)) mirror(button, anchor);
        else if (!fresh) snap(button);   // 둘레가 다시 그려져 자리가 소수점만큼 옮겨졌을 수 있어요 — 그림만 격자에 다시
        if (fresh) tr.paint(key, root);   // 이미 붙여 칠한 칸을 다시 훑을 땐 손대지 않아요
        if (!input.__blKtInput) {   // 원문을 고치면 「원문이 바뀌었어요」 (펼쳐 둔 것만 칠해요)
            input.__blKtInput = true;
            input.addEventListener('input', () => { const k = input.__blKtButton?.dataset.tr; if (k && tr.states.get(k)?.open) tr.paint(k, fields.get(k)?.root); });
        }
    }
    function hide(input) { if (input?.__blKtButton) { input.__blKtButton.hidden = true; if (input.__blKtBox) input.__blKtBox.hidden = true; } }
    const commonRoot = (a, b) => { for (let n = a; n; n = n.parentElement) if (n.contains(b)) return n; return doc.body; };

    // ── 월드인포: 열린 항목의 내용 칸 ──
    const worldName = () => {
        const sel = doc.getElementById('world_editor_select');
        const opt = sel?.selectedOptions?.[0] ?? sel?.options?.[sel.selectedIndex];
        return opt && opt.value !== '' ? String(opt.textContent || '').trim() : '';
    };
    function scanWorld() {
        inlineCounts.scans++;
        const list = doc.getElementById('world_popup_entries_list');
        const book = worldName();
        if (!list || !book) return;
        for (const input of list.querySelectorAll('textarea[name="content"]')) {
            const entry = input.closest('.world_entry');
            const uid = entry?.getAttribute('uid');
            if (uid == null) continue;
            const anchor = input.parentElement?.querySelector('.editor_maximize');
            attach(input, anchor, keyOf('wi', book, `${book}::${uid}`), input.parentElement);
        }
    }
    // ── 프리셋: 프롬프트 편집 창의 내용 칸 (지금 프리셋) ──
    function scanPreset() {
        inlineCounts.scans++;
        const input = doc.getElementById('completion_prompt_manager_popup_entry_form_prompt');
        const id = doc.getElementById('completion_prompt_manager_popup_entry_form_save')?.dataset.pmPrompt;
        const preset = api.currentPreset?.() || '';
        // 같은 for 이름표가 「살펴보기」 쪽에도 하나 더 있어요(숨김) — 칸과 같은 묶음 안의 것만
        const anchor = input?.closest('.completion_prompt_manager_popup_entry_form_control')?.querySelector('label[for="completion_prompt_manager_popup_entry_form_prompt"]')
            || doc.querySelector('label[for="completion_prompt_manager_popup_entry_form_prompt"]');
        if (!input || !id || !preset || input.disabled) { hide(input); return; }
        // 이름표가 줄 하나(flex)라 그 뒤에 두면 단추가 다음 줄로 떨어져요 — 이름표 글자 바로 뒤(안쪽)에. 누름은 act 가 막아 칸으로 가지 않아요
        attach(input, anchor?.lastElementChild || anchor, keyOf('preset', preset, id), commonRoot(anchor, input));
    }

    // ── 봇카드: 캐릭터 편집 칸 (그룹 · 새 캐릭터 만들기 중에는 숨김) ──
    function scanChar() {
        inlineCounts.scans++;
        const avatar = host.currentCharacter?.() || '';
        for (const [elId, field] of CHAR_FIELDS) {
            const input = doc.getElementById(elId);
            if (!input) continue;
            if (!avatar) { hide(input); continue; }
            const anchor = doc.querySelector(`.editor_maximize[data-for="${elId}"]`);
            attach(input, anchor, keyOf('char', avatar, field), commonRoot(anchor || input, input));
        }
    }

    // ── 봇카드 추가 인사말: 따로 뜨는 창(dialog)의 인사말마다 ──
    function scanAlt(list) {
        inlineCounts.scans++;
        const avatar = host.currentCharacter?.() || '';
        for (const block of list.querySelectorAll('.alternate_greeting')) {
            const input = block.querySelector('textarea.alternate_greeting_text');
            const index = block.getAttribute('data-index');
            if (!input || index == null) continue;
            if (!avatar) { hide(input); continue; }
            attach(input, block.querySelector('.editor_maximize'), keyOf('char', avatar, `alt_greeting_${index}`), block);
        }
    }
    // ── 페르소나: 설명 칸 ──
    function scanPersona() {
        inlineCounts.scans++;
        const input = doc.getElementById('persona_description');
        const id = host.currentPersona?.() || '';
        if (!input) return;
        if (!id) { hide(input); return; }
        const anchor = doc.querySelector('.editor_maximize[data-for="persona_description"]');
        attach(input, anchor, keyOf('persona', id, 'description'), commonRoot(anchor || input, input));
    }

    // ── 감시자 없이: 서랍 몇 개에 누름 · 고름 · 입력만 (1.5.3 · 테마 감시 예산 v1.5.1 그대로 — MutationObserver 0) ──
    // 실리태번은 서랍 열기 · 항목 펼치기 · 쪽 넘김 · 책 바꾸기 · 편집 창 열기 · 추가 인사말 창을 모두 누름 · 고름 뒤에(대개 비동기로) 그려요.
    // 그래서 그 서랍 안의 누름 · 고름이 있으면 다음 프레임 · 0.25초 · 0.8초 뒤에 열려 있는 창만 훑어요. 훑기는 표시 없는 칸에만 단추를 붙여 몇 번 겹쳐도 같아요.
    // 서랍을 안 만지면 아무 일도 안 해요(열기 전 · 닫은 뒤 비용 0). 우리 단추 · 상자 안 누름은 건너뛰어요.
    const isOpen = el => !!el && (el.classList.contains('openDrawer') || (el.style.display !== 'none' && !el.classList.contains('closedDrawer') && el.getClientRects().length > 0));
    const byId = id => doc.getElementById(id);
    function scanOpen() {
        if (isOpen(byId('WorldInfo'))) scanWorld();
        if (isOpen(byId('completion_prompt_manager_popup'))) scanPreset();
        if (isOpen(byId('rm_ch_create_block')) || isOpen(byId('character_popup'))) scanChar();
        if (isOpen(byId('PersonaManagement'))) scanPersona();
        const lists = [...doc.querySelectorAll('dialog[open] .alternate_greetings_list')];   // 닫힌 창(아직 문서에 남은 것)은 빼요
        const list = lists[lists.length - 1];
        if (list) {
            const dialog = list.closest('dialog');
            if (dialog && !dialog.__blKt) { dialog.__blKt = true; for (const type of ['click', 'change']) dialog.addEventListener(type, poke, true); }   // 창 안 「더하기」 · 순서 바꿈
            scanAlt(list);
        }
    }
    const later = [];
    function queue() {
        for (const t of later.splice(0)) clearTimeout(t);
        requestAnimationFrame(scanOpen);
        later.push(setTimeout(scanOpen, 250), setTimeout(scanOpen, 800));
    }
    function poke(event) {
        const t = event.target;
        if (t?.closest?.('.bl-kt, .bl-kt-btn')) return;
        if (event.type === 'input' && t?.matches?.('textarea')) return;   // 원문을 적는 중 — 낡음 표시는 칸의 input 이 따로 칠해요
        inlineCounts.mutations++;
        queue();
    }
    const hosts = new Set();
    for (const id of ['WorldInfo', 'left-nav-panel', 'completion_prompt_manager_popup', 'right-nav-panel', 'rm_ch_create_block', 'character_popup', 'PersonaManagement']) {
        const el = byId(id);
        if (el) hosts.add(el.closest('.drawer') || el);
    }
    for (const host of hosts) for (const type of ['click', 'change', 'input']) host.addEventListener(type, poke, true);

    // 한글화 패널에서 번역이 끝나면 펼쳐 둔 칸만 캐시를 다시 읽어요 (요청 없음)
    const onChanged = () => { for (const [key, st] of tr.states) if (st.open) tr.reread(key); };
    doc.addEventListener('bl-kt:changed', onChanged);

    return {
        tr, fields, scanWorld, scanPreset, scanChar, scanPersona,
        /** 캐릭터 · 페르소나가 바뀌었을 때 (채팅 바뀜) — 열려 있으면 열쇠를 바꿔 다시 칠해요 */
        refresh() { if (isOpen(byId('rm_ch_create_block')) || isOpen(byId('character_popup'))) scanChar(); if (isOpen(byId('PersonaManagement'))) scanPersona(); },
        scanOpen,
        stop() { for (const host of hosts) for (const type of ['click', 'change', 'input']) host.removeEventListener(type, poke, true); for (const t of later.splice(0)) clearTimeout(t); doc.removeEventListener('bl-kt:changed', onChanged); (doc.defaultView || globalThis).removeEventListener?.('resize', onResize); },
    };
}
