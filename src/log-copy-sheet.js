// 로그 복사 시트 — 고른 글 도구 줄의 「로그 복사」를 누르면 뜨는 작은 창 하나. 화면은 넷이 전부예요:
//   ① 모양 칩 한 줄(즐겨찾기 · 최근 먼저, 맨 끝 「+ 내 글꾸」) ② 색 칩 한 줄(에이드 팔레트 · 밤/낮, 기본 = 지금 팔레트)
//   ③ 도구 칩 셋 — 「이름 숨김」 · 「바꾸기」(켜면 바로 아래 줄이 펼쳐져요) · 「숨기기」(미리보기에서 고른 글을 눌러야 보이는 글로 — log-copy-spoiler.js) ④ 미리보기 — 그 자리에서 눌러 고쳐요(글자 · 제목 · 모델 · 프롬프트, Ctrl+B · I) ⑤ 「복사」(+ 작은 「마크다운」)
// 모양 칩 위에 분류 칩 줄(기본 · 대화 · 종이 · 할로윈 · 갤러리 · 내 글꾸 — 설정창 화면 칩과 같은 .salty-seg.bl-screen-chips) — 그 분류의 모양만 보여요.
// 이름 숨김 · 바꾸기 목록은 채팅 캡처와 같은 저장 칸(captureTools.redact · names · mask · maskStyles · replace · replaceRules) — 한 번 정하면 두 기능이 함께 따라가요.
// 색 칩으로 지금과 다른 에이드를 고르면 틀뿐 아니라 로그 글의 역할 색(본문 · 대사 · 형광펜 · 속마음 · 강조 · 면 · 선)도 그 팔레트 값으로 다시 계산해요 — 직접 고른 고정 색은 그대로.
// 「복사」는 클립보드에 text/html(서식)과 text/plain(그 HTML 코드 글자)을 같이 넣어요 — HTML 칸에 붙이면 코드, 보통 편집기에 붙이면 서식.
//   1.0.1 코드 글자는 사람이 고치기 쉬운 꼴(블록마다 줄 · 들여쓰기 · 메시지 · 이름 · 본문 · 머리 칸 주석 — log-copy-pretty.js), 서식은 한 줄 그대로 — 그려지는 모양은 둘이 같아요.
// 미리보기는 스크립트를 못 돌리는 sandbox iframe(테마 화면과 분리) · 복사 전에 다시 소독(log-copy-sanitize.js).
// 1.1.3 깡통 로그 틀 묶음의 미리보기는 붙일 곳 흉내(log-copy-site-sim.js): 밤 · 낮 바탕 위에 틀 · 위아래 코멘트 자리(문서 머리의 규칙이라 복사 글에는 안 들어가요).
// 1.1.3 앞에는 깡통 로그 틀 셋 + 밝기 + 복사만 — 분류 · 다른 모양 · 색 칩 · 글자색 · 도구 · 보일 것 · 머리 칸 · 내 글꾸는 「더 보기」를 누르면 펼쳐져요(기능은 그대로).
//   깡통 로그 틀로 열면 접힌 채, 다른 틀을 쓰던 설정으로 열면 예전처럼 펼친 채 시작해요(접힘은 저장하지 않아요).
// 마지막 모양 · 색 · 즐겨찾기 · 내 글꾸는 테마 설정 logCopy 에 남아요(모델 · 프롬프트 · 제목은 열 때마다 새로 채움). 시작 그래프 밖.
import { getSettings, saveSettings } from './settings.js';
import { showThemeModal } from './modal.js';
import { PALETTES, PALETTE_FAMILIES, isPaletteId, ensurePalettes, paletteColors, paletteFamily, paletteVariant, safeColor, onColor } from './palettes.js';
import { PRESETS, CATEGORIES, OWN_COLORS, movedShape, presetsIn, categoryOf, renderLog, logMarkdown, dateLabel } from './log-copy-presets.js';
import { logHtml } from './log-copy-render.js';
import { templateColors } from './log-copy-template.js';   // 1.0.1 글꾸 마트에서 받은 내 글꾸
import { motionCss, motionStyleFor } from './log-copy-motion.js';   // 1.0.1 글꾸 움직임 · 누르면 반응(미리보기 칸 · HTML 복사 맨 앞 <style>)
import { sanitizeHtml, sanitizeTree, slotPath, fromPath, guessSlot, imagesFromCode } from './log-copy-sanitize.js';
import { applyFade, revealTab } from './tab-scroll.js';
import { transformLog, recolorLog } from './log-copy-words.js';   // 이름 숨김 · 단어 바꾸기 (채팅 캡처 「로그 공유 · 이름 가림」 설정을 같이 써요) · 고른 에이드로 역할 색 다시 계산
import { withNameAliases } from './name-aliases.js';
import { wrapSpoiler, unwrapSpoiler, spoilerAt, ensureStyle as ensureSpoilerStyle, previewModel } from './log-copy-spoiler.js';   // 숨긴 글 · 미리보기에서 고친 글로 마크다운
import { prettyLogHtml } from './log-copy-pretty.js';
import { liftForCopy, copyBody, insertHead, withCommentSlots } from './log-copy-lift.js';   // 1.1.2 인라인 그림 주소 → 맨 앞 <style> 클래스 · 정화기 맞춤(overflow:clip · block-size · 스크롤바 숨김)
import { placeLemon, normCorner, CORNER_LABEL } from './log-copy-lemon.js';   // 1.1.2 「레몬 바로가기」(기본 꺼짐) — 빈 모서리에 레몬 · 누르면 블루레몬에이드 소개 글
import { bareLog } from './log-copy-bare.js';   // 1.0.7 위 글 · 아래 글 빼기(틀에 박힌 머리 표 · 꼬리말 …)   // 1.0.1 「HTML 복사」 코드를 사람이 고치기 쉬운 꼴로 (줄 나눔 · 주석 — 모양은 그대로)
import { fitBare } from './log-copy-bare-fit.js';   // 1.0.7 빼고 나서 글을 덮게 된 떠 있는 장식 걷기(11-07 사용자 「컴퓨터가 내려와 글을 덮어」)
import { TOKEN_KEYS } from './palettes.js';   // 가로 칩 줄: 넘치는 쪽 가장자리 흐림 · 고른 칩 보이기 (탭 줄과 같은 부품)
import { TONE_SHAPES, isToneShape, toneFor, toneLookup } from './log-copy-tone.js';   // 1.1.3 「깡통 로그」 틀 묶음(깡통 로그 · 미니 · 진한 바탕) — 색은 대사색 하나에서 · 에이드 색 칩 없이 밝기만
import { people } from './people.js';   // 1.1.3 인물표의 정해 둔 대사색(없으면 화면에서 읽은 색)
import { SITE, sitePreviewCss, siteCheck } from './log-copy-site-sim.js';
import { isBasicShape, BASIC_INFO, BASIC_HEIGHT, BASIC_INFO_LABEL, BASIC_HEIGHT_LABEL } from './log-copy-basic.js';   // 1.1.3 「기본 글꾸」 새 틀 18 — 밝기만 · 정보 칸(끔 · 칩 · 탭) · 높이(자동 · 작게 · 중간 · 크게)   // 1.1.3 붙일 곳 흉내(바탕 · 코멘트 자리) · 복사 직전 점검

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const HOLD_MS = 520;
const CUSTOM_MAX = 20;
const CUSTOM_BYTES = 60000;
// 1.0.7 「보일 것」 칩 줄(사용자 「위 아래 글자들 … 부가적인 것들 빼는 것도 다 버튼 · 완전 심플한 게 좋을 때도 있음」) — 켬 = 보여요 · 끄면 빼요. 저장 칸 logCopy.<key>
const SHOWS = [
    ['titleOff', 'fa-heading', '제목', '틀 머리의 제목'],
    ['dateOff', 'fa-calendar', '날짜', '틀의 날짜'],
    ['tagsOff', 'fa-tags', '깡통 · 모델 · 프롬프트', '머리의 깡통 · 모델 · 프롬프트 알약'],
    ['namesOff', 'fa-user', '이름 줄', '메시지마다 이름 줄 — 끄면 본문만(간격은 그대로)'],
    ['topOff', 'fa-arrow-up', '위 글', '첫 메시지 위의 틀 글(머리 표 · 부제 · 능력치 칩 · 도장 …) — 제목 · 날짜 · 알약은 따로'],
    ['bottomOff', 'fa-arrow-down', '아래 글', '마지막 메시지 아래의 틀 글(꼬리말 · 서명 · 보낸 이 …)'],
];
// 1.0.7 「머리 칸」(글꾸 마트 시식 창과 같은 칸) — 미리보기에서 눌러 고친 것과 서로 따라가요
const FIELD_INPUTS = [['title', '제목', '제목'], ['date', '날짜', '비우면 없음'], ['char', '깡통', '깡통 이름'], ['model', '모델', '비우면 없음'], ['prompt', '프롬프트', '비우면 없음']];
const SNAP_MAX = 50, SNAP_WAIT = 500;
// 1.0.8 글자색(글꾸 마트 사이트와 같은 역할 — 사용자 「로그 복사 실리태번판도 글자색 바꾸는 거 · 바꾼 판을 내 글꾸에 저장」) — 틈 템플릿 글꾸(내장 심플 · 마트에서 받은 내 글꾸)만
const INK_ROLES = [['name', '이름'], ['text', '본문'], ['dialogue', '대사'], ['thought', '속마음'], ['emphasis', '강조'], ['mark', '형광펜']];

/** 테마 설정 logCopy (settings.js 가 모양을 정리해요) */
const store = () => getSettings().logCopy;

/** 지금 연결의 모델 이름 · 프롬프트 프리셋 이름 (실리태번 공개 API, 없으면 빈 칸) */
export function connectionNames(ctx = globalThis.SillyTavern?.getContext?.()) {
    let model = '', prompt = '';
    try { if (ctx?.mainApi === 'openai' && typeof ctx.getChatCompletionModel === 'function') model = String(ctx.getChatCompletionModel() || ''); } catch { /* 판마다 다름 */ }
    if (!model && typeof ctx?.onlineStatus === 'string' && !/^no_connection$/i.test(ctx.onlineStatus)) model = ctx.onlineStatus;
    try { prompt = String(ctx?.getPresetManager?.()?.getSelectedPresetName?.() || ''); } catch { /* 없음 */ }
    return { model: model.trim(), prompt: prompt.trim() };
}

/** 테마 화면 글꼴 · 자간 (설정창과 같은 값 — 자간은 em 으로 옮겨 글자 크기마다 같은 비율) */
export function uiFont() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;font-family:var(--salty-font-ui, inherit);font-size:20px;letter-spacing:var(--bl-settings-tracking, normal)';
    probe.textContent = '가';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const spacing = Number.parseFloat(style.letterSpacing);
    const out = { family: style.fontFamily.replace(/"/g, "'"), tracking: Number.isFinite(spacing) && spacing ? `${Math.round((spacing / 20) * 1000) / 1000}em` : 'normal' };
    probe.remove();
    if (!/(serif|sans-serif|monospace|system-ui)\s*$/i.test(out.family)) out.family += ', sans-serif';
    return out;
}

/** 팔레트 id 의 실제 색 (켜지 않고 값만 계산) */
/** 팔레트 id 의 역할 색 전부 (TOKEN_KEYS + pop) — 로그 글 역할 색 다시 계산용 */
export function tokensOf(id) {
    const p = paletteColors({ ...getSettings(), palette: id });
    const out = {};
    for (const key of [...TOKEN_KEYS, 'pop']) if (p[key]) out[key] = safeColor(p[key]);
    return out;
}

export function colorsOf(id) {
    const p = paletteColors({ ...getSettings(), palette: id });
    const v = key => safeColor(p[key] ?? p.text);
    return { bg: v('bg'), surface: v('surface'), raised: v('raised'), text: v('text'), muted: v('muted'), faint: v('faint'), accent: v('accent'), pop: safeColor(p.pop || p.accent), line: v('line'), marker: v('marker'), onAccent: onColor(p.accent) };
}

const nowPalette = () => getSettings().palette || 'salt';
/** 모양이 쓸 팔레트 — 할로윈처럼 dark 표시가 있는 틀은 고른 에이드의 밤 판 */
const paletteFor = (shape, id) => (PRESETS.find(p => p.id === shape)?.dark ? paletteVariant(paletteFamily(id), 'dark') : id);
/** 전용 색 틀(할로윈 — 사용자 결정 「할로윈만 할로윈색」)의 색 묶음, 아니면 null */
const ownColors = (shape) => { const k = OWN_COLORS[PRESETS.find(p => p.id === shape)?.own]; return k ? { ...k, raised: k.panel2 } : null; };
const modeOf = id => PALETTES[id]?.mode || (/night|^black$/.test(id) ? 'dark' : 'light');

function chipOrder(s) {
    const ids = PRESETS.map(p => p.id);
    const fav = ids.filter(id => s.fav.includes(id));
    const recent = s.recent.filter(id => ids.includes(id) && !fav.includes(id));
    return [...fav, ...recent, ...ids.filter(id => !fav.includes(id) && !recent.includes(id))];
}

// ── 시트 ─────────────────────────────────────────────────────

let open = null;

/** @param {object} model captureLog() 결과 */
export async function openLogSheet(model) {
    if (!model?.messages?.length) { toastr.warning('글을 다시 골라 주세요.', '', { timeOut: 1800 }); return; }
    open?.close();
    ensureStyle();
    await ensurePalettes();
    const s = store();
    // 1.0.1 옛 내장 컨셉 30(일러스트 · 마트로 옮김)을 즐겨찾기 · 최근에 둔 것 → 같은 주제의 내장 심플 30(concept-sp-*)으로 한 번 옮겨 저장
    const moved = list => [...new Set(list.map(movedShape))];
    if ([s.shape, ...s.fav, ...s.recent].some(id => movedShape(id) !== id)) { s.shape = movedShape(s.shape); s.fav = moved(s.fav); s.recent = moved(s.recent); saveSettings(); }
    const names = connectionNames();
    const first = model.messages.find(m => m.time)?.time ?? Date.now();
    const state = {
        shape: movedShape(s.shape),   // 1.0.1 시험판에서 고른 옛 내장 컨셉 id → 같은 주제의 내장 심플 글꾸
        palette: isPaletteId(s.palette) && modeOf(s.palette) === modeOf(nowPalette()) ? s.palette : nowPalette(),
        fields: { title: model.chatTitle || 'Title', mark: 'LOG', char: model.charName || model.chatName, model: names.model, prompt: names.prompt, date: dateLabel(first), from: model.userName, tail: '', info: '', page: '1', subtitle: model.chatName ? `${model.chatName}의 기록` : '' },
        category: CATEGORIES.some(c => c.id === s.category) ? s.category : 'basic',   // 분류 칩 — 처음은 「기본」, 마지막에 고른 것을 기억
        images: [],   // 갤러리: 붙여 넣은 이미지 코드 · 주소 (이번 시트에만)
        picking: false,
        picked: false,   // 이번에 색 칩을 직접 눌렀나 — 누른 것만 기억해요(안 누르면 다음에도 지금 팔레트)
        armed: null,   // 길게 눌러 지울 준비가 된 내 글꾸 id
        edited: null,   // 1.0.1 미리보기에서 고친 글(메시지 노드만 바꾼 모델) — 틀 · 색을 바꿔 다시 그려도 그대로
        dirty: false,   // 마지막으로 그린 뒤 미리보기 글을 고쳤나 (고쳤을 때만 거둬요 — 안 고친 메시지는 그림 · 링크가 있는 원래 노드 그대로)
        drawnTexts: null,   // 1.0.7 막 그린 미리보기의 메시지별 글 — 거둘 때 이것과 달라진 메시지만 「고친 것」(이름 숨김 · 바꾸기 · 틀이 바꾼 글자는 고친 것이 아니에요)
        order: chipOrder(s),
        inks: {}, inkShape: null,   // 1.0.8 이번 창에서 바꾼 글자색(모양을 바꾸면 비워요) · 내 글꾸에 저장하면 그 글꾸 색이 돼요
        toneTitle: '',   // 1.1.3 깡통 로그 틀 묶음의 제목 — 늘 빈 채로 시작해요(레몬만) · 다른 틀의 제목 · 「비워 둔 머리 칸」 기억과 따로(서로 안 건드려요)
        tone: null,   // 1.1.3 막 그린 깡통 로그 틀의 색 묶음(숨긴 글 알약 · 미리보기 바탕)
        more: true,   // 1.1.3 「더 보기」 펼침 — 아래에서 모양이 정해진 뒤 정해요
    };
    // 1.0.8 비워 둔 머리 칸(깡통 · 모델 · 프롬프트 알약 · 날짜 · 제목)은 다음에 열어도 빈 채로 — 전엔 열 때마다 지금 연결 이름으로 다시 채워 지운 알약이 돌아왔어요(사용자 「없애 뒀으면 없는 상태로 시작」)
    for (const key of s.blank || []) state.fields[key] = '';
    if (!PRESETS.some(p => p.id === state.shape) && !s.custom.some(c => c.id === state.shape)) state.shape = 'card';
    // 깡통 로그 틀이면 접힌 채 · 다른 틀을 쓰던 설정이면 예전 그대로 펼친 채. 접힌 줄에서 켜 둔 것이 지금 글을 바꾸고 있으면(이름 숨김 · 바꾸기 · 이름 줄 끔) 펼쳐서 보여요
    { const ct = getSettings().captureTools; state.more = s.custom.some(c => c.id === state.shape) || !isToneShape(state.shape) || !!(ct?.redact || ct?.replace || s.namesOff); }
    const ui = uiFont();

    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-lc';
    dialog.setAttribute('aria-labelledby', 'bl-lc-title');
    dialog.innerHTML = `<header class="bl-lc-head"><h3 id="bl-lc-title"><i class="fa-solid fa-copy" aria-hidden="true"></i><span>로그 복사</span><small>메시지 ${model.messages.length}개</small></h3><button type="button" class="salty-btn bl-lc-icon" data-lc="close" aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
        <div class="bl-lc-scroll">
            <div class="salty-seg bl-screen-chips bl-lc-cats" role="group" aria-label="분류" data-lc-cats></div>
            <div class="bl-lc-chips bl-chip-row" role="radiogroup" aria-label="모양" data-lc-shapes></div>
            <div class="bl-lc-gallery" data-lc-gallery hidden><textarea rows="3" placeholder="이미지 코드(&lt;img …&gt;)나 이미지 주소를 붙여 넣어요" aria-label="갤러리 사진 코드" data-lc-images></textarea><span class="bl-lc-note" data-lc-images-count></span></div>
            <div class="bl-lc-colors" data-lc-colors><div class="bl-lc-mode" role="group" aria-label="밝기">${['light', 'dark'].map(kind => `<button type="button" data-lc-mode="${kind}" aria-label="${kind === 'light' ? '화이트' : '나이트'}"><i class="fa-regular fa-${kind === 'light' ? 'sun' : 'moon'}" aria-hidden="true"></i></button>`).join('')}</div><div class="bl-lc-pals bl-chip-row" role="radiogroup" aria-label="색" data-lc-pals></div></div>
            <div class="bl-lc-easy" role="group" aria-label="조절 — 간편 · 세밀" data-lc-easy hidden></div>
            <div class="bl-lc-inks bl-chip-row" role="group" aria-label="글자색 — 눌러서 바꿔요" data-lc-inks hidden></div>
            <div class="bl-lc-tools bl-chip-row" role="group" aria-label="이름 숨김 · 바꾸기"><button type="button" class="bl-lc-chip" data-lc="hide" aria-pressed="false"><i class="fa-solid fa-user-secret" aria-hidden="true"></i><span>이름 숨김</span></button><button type="button" class="bl-lc-chip" data-lc="words" aria-pressed="false"><i class="fa-solid fa-right-left" aria-hidden="true"></i><span>바꾸기</span><small data-lc-words-count></small></button><button type="button" class="bl-lc-chip" data-lc="fields" aria-pressed="false" title="제목 · 날짜 · 깡통 · 모델 · 프롬프트 칸을 글칸으로 고쳐요"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span>머리 칸</span></button><button type="button" class="bl-lc-chip" data-lc="spoiler" disabled title="미리보기에서 글을 고르면 눌러요"><i class="fa-solid fa-eye-slash" aria-hidden="true"></i><span>숨기기</span></button></div>
            <div class="bl-lc-shows bl-chip-row" role="group" aria-label="보일 것 — 끄면 빼요" data-lc-shows>${SHOWS.map(([key, icon, label, title]) => `<button type="button" class="bl-lc-chip" data-lc-show="${key}" aria-pressed="true" title="${esc(title)}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${esc(label)}</span></button>`).join('')}<button type="button" class="bl-lc-chip" data-lc-lemon aria-pressed="false" title="켜면 틀의 빈 모서리에 작은 레몬을 넣어요 — 누르면 블루레몬에이드 소개 글이 새 창으로 열려요"><i class="fa-solid fa-lemon" aria-hidden="true"></i><span>레몬 바로가기</span></button><button type="button" class="bl-lc-chip" data-lc-lemon-at hidden title="레몬 자리 — 누를 때마다 자동 · 왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래"><i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i><span>자동</span></button><button type="button" class="bl-lc-chip" data-lc-height hidden title="틀 높이 — 누를 때마다 자동(글 길이만큼) · 작게 · 중간 · 크게(틀 안에서 넘겨요)"><i class="fa-solid fa-up-down" aria-hidden="true"></i><span>높이 · 자동</span></button></div>
            <div class="bl-lc-fields" data-lc-fields hidden>${FIELD_INPUTS.map(([key, label, hint]) => `<label class="bl-lc-field"><span>${esc(label)}</span><input type="text" maxlength="${key === 'title' ? 80 : 60}" placeholder="${esc(hint)}" data-lc-field="${key}"></label>`).join('')}</div>
            <div class="bl-lc-names" data-lc-names hidden><div class="bl-lc-name-list" data-lc-name-list></div><div class="bl-lc-row2"><input type="text" maxlength="40" placeholder="더 가릴 이름" aria-label="더 가릴 이름" data-lc-name-input><button type="button" class="salty-btn bl-lc-icon" data-lc="name-add" aria-label="가릴 이름 더하기"><i class="fa-solid fa-plus" aria-hidden="true"></i></button></div></div>
            <div class="bl-lc-words" data-lc-words hidden><div data-lc-rules></div><button type="button" class="salty-btn bl-lc-add-rule" data-lc="rule-add"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>줄 더하기</span></button></div>
            <div class="bl-lc-more"><button type="button" class="bl-lc-chip" data-lc="more" aria-expanded="false"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i><span>더 보기</span></button></div>
            <div class="bl-lc-pick" data-lc-pick hidden><span>로그 넣을 곳을 눌러요</span><button type="button" class="salty-btn" data-lc="auto">자동으로</button></div>
            <div class="bl-lc-bar" data-lc-bar><span class="bl-lc-note"><i class="fa-solid fa-pen" aria-hidden="true"></i> 미리보기 글씨를 눌러 바로 고쳐요</span><button type="button" class="salty-btn bl-lc-icon" data-lc="undo" aria-label="되돌리기" title="되돌리기 (지운 블록도 돌아와요)" disabled><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button><button type="button" class="salty-btn bl-lc-icon" data-lc="redo" aria-label="다시하기" title="다시하기" disabled><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button></div>
            <div class="bl-lc-stage" data-lc-stage><div class="bl-lc-egg" data-lc-egg hidden>✨ 장식을 눌러 보세요</div><iframe sandbox="allow-same-origin" title="미리보기 — 글자를 눌러 바로 고쳐요" data-lc-frame></iframe></div>
            <div class="bl-lc-paste" data-lc-paste hidden><button type="button" class="salty-btn bl-lc-mart" data-lc="mart"><i class="fa-solid fa-store" aria-hidden="true"></i><span>마트에서 가져오기</span></button><textarea rows="8" placeholder="공유받은 글꾸 HTML 이나 글꾸 마트에서 복사한 글을 붙여 넣어요" aria-label="글꾸 HTML"></textarea><div class="bl-lc-row"><button type="button" class="salty-btn" data-lc="paste-cancel">취소</button><button type="button" class="salty-btn bl-tool-primary" data-lc="paste-save">저장</button></div></div>
        </div>
        <footer class="bl-lc-foot"><button type="button" class="salty-btn" data-lc="md" title="틀 · 색 없이 글만 마크다운으로">글만 복사</button><button type="button" class="salty-btn" data-lc="download" title="보이는 모양 그대로 .html 파일로 받아요">내려받기</button><button type="button" class="salty-btn bl-tool-primary" data-lc="copy" title="보이는 모양 그대로(틀 · 색 · 글꼴) HTML 로"><i class="fa-solid fa-copy" aria-hidden="true"></i> HTML 복사</button></footer>`;
    document.body.append(dialog);
    const $ = selector => dialog.querySelector(selector);
    const frame = $('[data-lc-frame]');
    // 1.1.0 칩 줄(모양 · 분류 · 색 · 글자색 · 가릴 이름 · 바꾸기 줄)은 누를 때마다 innerHTML 로 다시 그려요 — 누른 칩에 있던 초점이 함께 사라져 body 로 떨어지면
    //   키보드 · 화면 읽기 사용자는 창 맨 앞부터 다시 Tab 해야 했어요. 다시 그린 줄에서 같은 열쇠(data-*)의 칩으로 초점을 돌려줘요 ·
    //   그 칩이 없어졌으면(지운 내 글꾸 · 뺀 이름 · 지운 줄) 같은 줄의 고른 칩이나 첫 단추로
    const FOCUS_KEYS = ['data-lc-easy', 'data-lt', 'data-lt-i', 'data-lt-color', 'data-lt-tab', 'data-lt-sum', 'data-lc-view', 'data-shape', 'data-lc-del', 'data-cat', 'data-palette', 'data-lc-mode', 'data-lc-ink', 'data-lc-name-remove', 'data-lc-rule-remove', 'data-lc'];
    const FOCUS_ROWS = '.bl-lt-chips, .bl-lc-easy-chips, [data-lc-easy], [data-lc-shapes], [data-lc-cats], [data-lc-pals], [data-lc-inks], [data-lc-name-list], [data-lc-rules]';
    function keepFocus(paint) {
        return (...args) => {
            const active = document.activeElement;
            if (!active || active === dialog || !dialog.contains(active)) return paint(...args);
            const attr = FOCUS_KEYS.find(name => active.hasAttribute(name));
            const key = attr ? `[${attr}="${CSS.escape(active.getAttribute(attr))}"]` : null;
            // 1.1.5 조절 화면: 켬/끔 칩은 누르면 열쇠 끝(값)이 바뀌어 같은 칸(갈래|칸|)의 칩으로 · 칩 줄은 통째로 새로 그려지니 붙어 있는 줄(조절 칸 상자)로
            const near = attr === 'data-lt' ? `[data-lt^="${CSS.escape(active.getAttribute(attr).replace(/[^|]*$/, ''))}"]` : null;
            const rows = [active.closest(FOCUS_ROWS), active.closest('[data-lc-easy]')];
            const out = paint(...args);
            if (!active.isConnected) ((key && dialog.querySelector(key)) || (near && dialog.querySelector(near)) || rows.find(r => r?.isConnected)?.querySelector('[aria-checked="true"], button:not(:disabled)'))?.focus({ preventScroll: true });
            return out;
        };
    }
    const custom = () => store().custom.find(c => c.id === state.shape) ?? null;
    // 1.1.4 글꾸 마트 「테마로 담기」로 받은 심플 글꾸(frame + set) · 직접 붙인 HTML 글꾸(틀 칸 없음 · 로그 자리 고르기)
    const simpleOn = () => !!custom()?.frame;
    const rawOf = mine => !!mine && !mine.template && !mine.frame;
    // 담아 온 조절 값을 입히는 모듈(마트 사본 — 크니까 받은 심플 글꾸를 처음 그릴 때만 받아요 · 받는 동안은 틀만 그려요)
    // 1.1.5 틀별 능력표(마트 측정 상한 — geulkku-mart/caps-table.js)도 같이 받아요: 조절 모듈과 함께 오니 칸 · 그림이 일괄 상한으로 한 번 그려졌다가 바뀌는 일이 없어요.
    //   표를 못 받으면 예전처럼 일괄 상한(정적 능력표)으로 그려요.
    let setMod = null, setModLoading = null, capRow = () => null;
    const needSet = () => {
        if (setMod || setModLoading) return;
        setModLoading = Promise.all([import('./log-copy-simple-set.js'), import('./geulkku-mart/caps-table.js').catch(() => null)]).then(([m, c]) => { if (c) capRow = c.capsRow; setMod = m; if (dialog.isConnected && simpleOn()) draw(); }, (error) => { setModLoading = null; toastr.warning(`조절 값을 입히지 못했어요 — 틀만 그려요 (${error?.message || error})`, '로그 복사'); });
    };
    // 1.1.5 조절 화면(간편의 색 · 질감 줄 · 「세밀」 갈래) — 받은 심플 글꾸의 간편 줄을 처음 그릴 때만 받아요(시작 그래프 밖 · 못 받으면 1.1.4 간편 줄 셋만)
    let fineMod = null, fineLoading = null;
    const needFine = () => {
        if (fineMod || fineLoading) return;
        fineLoading = import('./log-copy-tune-ui.js').then((m) => {
            fineMod = m;
            if (!document.getElementById('bl-lt-style')) { const style = document.createElement('style'); style.id = 'bl-lt-style'; style.textContent = m.FINE_STYLE; document.head.append(style); }
            if (dialog.isConnected && simpleOn()) drawEasy();
        }, () => { fineLoading = null; });
    };
    const fine = { view: 'easy', open: new Set(['motion']), tab: 'text', hold: false, timer: 0 };   // 이번 시트에만 기억해요
    // 1.1.3 깡통 로그 틀 묶음인가 — 색 칩 대신 밝기만 · 제목은 빈 채 · 알약 없음 · 이름표는 말하는 사람이 둘 이상일 때만(log-copy-tone.js)
    const toneOn = () => !custom() && isToneShape(state.shape);
    // 1.1.3 「기본 글꾸」 새 틀인가 — 색은 화자 대사색 · 틀은 무채(에이드 색 칩 없이 밝기만) · 레몬은 틀 안에 · 정보 칸 · 높이 칩
    const basicOn = () => !custom() && isBasicShape(state.shape);
    const fieldOf = key => ((toneOn() && key === 'title' ? state.toneTitle : state.fields[key]) ?? '');
    const setField = (key, value) => { if (toneOn() && key === 'title') state.toneTitle = value; else state.fields[key] = value; };
    // 1.0.1 마트 글꾸(template)는 받은 고정 색 — 전용 색 틀처럼 다뤄요(미리보기 바탕 · 숨긴 글 색)
    const own = () => {
        if (toneOn() && state.tone) { const t = state.tone; return { bg: SITE[t.mode].bg, line: t.line, raised: t.card, muted: t.text, text: t.text }; }   // 1.1.3 틀이 쓰는 색만(새 색 없음) · 미리보기 바탕은 붙일 곳 바탕
        if (basicOn() || simpleOn()) return modeOf(state.palette) === 'light' ? { bg: SITE.light.bg, line: 'rgba(20, 20, 24, 0.1)', raised: '#f5f5f6', muted: '#5f6168', text: '#26272b' } : { bg: SITE.dark.bg, line: 'rgba(224, 224, 228, 0.09)', raised: '#1c1e21', muted: '#9a9da6', text: '#e1e1e5' };   // 1.1.3 기본 글꾸 새 틀의 무채(시안 값) · 미리보기 바탕은 붙일 곳 바탕
        const mine = custom(); if (!mine?.template) return ownColors(state.shape); const k = templateColors(mine.colors); return { ...k, raised: k.panel2 };
    };
    // 1.1.4 「간편」(설계 4-2) — 받은 심플 글꾸에서만: 스타일(추천 여섯) · 움직임(끔 · 약 · 중 · 강) · 글 크기(작게 · 보통 · 크게). 밤낮은 밝기 칩 · 색은 인물표 색.
    //   값은 그 글꾸의 set 하나(설정에 남아요) · 조절 모듈(needSet)을 받은 뒤에 보여요.
    const drawEasy = keepFocus(() => {
        const box = $('[data-lc-easy]'), mine = custom(), on = !!mine?.frame && !!setMod;
        box.hidden = !on;
        if (!on) { box.replaceChildren(); return; }
        const e = setMod.easyOf(mine.set), level = Object.fromEntries(setMod.EASY_MOTION);
        const chip = (key, label, pressed) => `<button type="button" class="bl-lc-chip" data-lc-easy="${esc(key)}" aria-pressed="${pressed}"><span>${esc(label)}</span></button>`;
        const row = (label, chips, note = '') => `<div class="bl-lc-easy-row" role="group" aria-label="${esc(label)}"><span class="bl-lc-easy-h">${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><div class="bl-lc-easy-chips">${chips}</div></div>`;
        needFine();
        if (fine.hold) return;   // 슬라이더를 끄는 동안은 칸을 다시 그리지 않아요(미리보기만)
        // 1.1.5 간편 | 세밀 — 색 · 질감 줄과 세밀 갈래는 조절 화면 모듈(fineMod)이 그려요. 값은 같은 set 하나
        const mode = modeOf(state.palette), caps = capRow(mine.frame.key), more = fineMod ? fineMod.easyExtra(mine.set, mine.frame, mode, caps) : null;
        const view = fineMod && fine.view === 'fine' ? 'fine' : 'easy';
        const tabs = more ? `<div class="bl-lc-view" role="group" aria-label="조절 단계"><button type="button" data-lc-view="easy" aria-pressed="${view === 'easy'}">간편</button><button type="button" data-lc-view="fine" aria-pressed="${view === 'fine'}">세밀${more.total ? `<b>${more.total}</b>` : ''}</button></div>` : '';
        if (view === 'fine') {
            const at = new Map([...box.querySelectorAll('.bl-lt-chips')].map((strip, i) => [i, strip.scrollLeft]));
            box.innerHTML = tabs + fineMod.fineHtml(mine.set, mine.frame, { mode, open: fine.open, tab: fine.tab, caps });
            [...box.querySelectorAll('.bl-lt-chips')].forEach((strip, i) => { if (at.get(i)) strip.scrollLeft = at.get(i); });
            return;
        }
        box.innerHTML = tabs + row('스타일', setMod.LOOKS.map(x => chip(`style:${x.id}`, x.label, e.style === x.id)).join(''), e.style ? '' : '직접 조절')
            + (more?.color ?? '')
            + row('움직임', setMod.EASY_MOTION.map(([v, l]) => chip(`motion:${v}`, l, e.motion === v)).join('') + (more ? `<button type="button" class="bl-lc-chip" data-lc-view="motion" aria-pressed="${!!e.apart}" title="글 움직임과 소품 움직임을 따로 골라요"><span>따로</span></button>` : ''), e.apart ? `글 ${level[e.apart.text]} · 소품 ${level[e.apart.prop]}` : '')
            + row('글 크기', setMod.EASY_SIZE.map(([v, l]) => chip(`size:${v}`, l, e.fixed == null && e.size === v)).join(''), e.fixed != null ? `직접 ${e.fixed}px` : '')
            + (more ? more.texture + more.tail : '');
        requestAnimationFrame(() => { for (const strip of box.querySelectorAll('.bl-lc-easy-chips')) { revealTab(strip, strip.querySelector('[aria-pressed="true"]')); applyFade(strip); } });
    });
    // 1.0.8 글자색 — 바꿀 수 있는 글꾸(틈 템플릿)와 바꾼 색을 얹은 판
    const inkBase = () => { const mine = custom(); return mine ? (mine.template ? mine : null) : (PRESETS.find(p => p.id === state.shape)?.template ?? null); };
    const inkTemplate = () => { const base = inkBase(); return base && Object.keys(state.inks).length ? { ...base, colors: { ...templateColors(base.colors), ...state.inks } } : null; };
    const drawInks = keepFocus(() => {
        const row = $('[data-lc-inks]'), base = inkBase();
        if (state.inkShape !== state.shape) { state.inks = {}; state.inkShape = state.shape; }
        row.hidden = !base;
        if (!base) { row.replaceChildren(); return; }
        const k = { ...templateColors(base.colors), ...state.inks }, changed = Object.keys(state.inks).length > 0;
        const key = INK_ROLES.map(([role]) => k[role]).join() + changed;
        requestAnimationFrame(() => applyFade(row));   // 처음엔 숨어 있어 여는 때 흐림 계산을 건너뛰어요 — 보일 때마다 다시
        if (row.dataset.key === key) return;
        row.dataset.key = key;
        const save = custom() ? '내 글꾸 색 저장' : '내 글꾸에 저장', off = changed ? '' : ' disabled';
        row.innerHTML = `<i class="fa-solid fa-palette bl-lc-ink-title" aria-hidden="true" title="글자색"></i><button type="button" class="bl-lc-chip bl-lc-ink-act" data-lc="ink-reset" aria-label="원래 색" title="원래 색"${off}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button><button type="button" class="bl-lc-chip bl-lc-ink-act" data-lc="ink-save" aria-label="${save}" title="${save}"${off}><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i></button><i class="bl-lc-ink-sep" aria-hidden="true"></i>${INK_ROLES.map(([role, label]) => `<button type="button" class="bl-lc-chip bl-lc-ink" data-lc-ink="${role}" style="--ink:${esc(k[role])}" aria-label="${esc(label)} 색 바꾸기"><i class="bl-lc-ink-dot" aria-hidden="true"></i><span>${esc(label)}</span></button>`).join('')}`;
    });
    // 1.1.5 세밀 칸 · 간편의 색 · 질감 칩 — 그 글꾸의 조절 값을 바꿔 저장하고 다시 그려요(값 다듬기는 조절 화면 모듈 → 마트 사본)
    const tuneAct = (action, { redraw = true } = {}) => {
        const live = custom();
        if (!live?.frame || !fineMod || !action) return;
        const next = fineMod.fineAct(live.set, live.frame.key, action, modeOf(state.palette));
        if (next === live.set) return;
        live.set = next; saveSettings();
        if (redraw) draw(); else { clearTimeout(fine.timer); fine.timer = setTimeout(draw, 120); }
    };
    const pickTune = async (button) => {
        const id = button.dataset.ltColor;
        const { openColorPick } = await import('./colorpick.js');
        fine.hold = true;
        openColorPick({ anchor: button, value: button.dataset.value || '#888888', onInput: (css) => {
            const hex = String(css).toLowerCase();
            if (!/^#[0-9a-f]{6}$/.test(hex)) return;
            button.style.setProperty('--ink', hex); button.classList.remove('is-unset');
            tuneAct(`${id}|${JSON.stringify(hex)}`, { redraw: false });
        }, onClose: () => { fine.hold = false; clearTimeout(fine.timer); draw(); } });
    };
    let inkTimer = 0;
    const pickInk = async (button) => {
        const role = button.dataset.lcInk, base = inkBase();
        if (!base) return;
        const { openColorPick } = await import('./colorpick.js');
        openColorPick({ anchor: button, value: state.inks[role] ?? templateColors(base.colors)[role], onInput: (css) => {
            state.inks[role] = String(css).toLowerCase();
            button.style.setProperty('--ink', css);
            clearTimeout(inkTimer); inkTimer = setTimeout(draw, 120);
        }, onClose: () => { clearTimeout(inkTimer); draw(); } });
    };
    /** 바꾼 글자색을 내 글꾸로 — 받은 내 글꾸면 그 글꾸 색을 고치고, 내장 글꾸면 「이름 · 내 색」 새 내 글꾸로 */
    const saveInks = () => {
        const base = inkBase(), mine = custom(), s2 = store();
        if (!base || !Object.keys(state.inks).length) return;
        const colors = { ...templateColors(base.colors), ...state.inks };
        if (mine?.template) { mine.colors = colors; state.inks = {}; saveSettings(); toastr.success('내 글꾸 색을 저장했어요', '', { timeOut: 1600 }); draw(); return; }
        if (s2.custom.length >= CUSTOM_MAX) { toastr.warning(`내 글꾸는 ${CUSTOM_MAX}개까지예요 — 칩 옆 ✕ 나 길게 눌러 지워요`, '', { timeOut: 2500 }); return; }
        const label = PRESETS.find(p => p.id === state.shape)?.label || '글꾸', used = new Set(s2.custom.map(c => c.name));
        let name = `${label} · 내 색`.slice(0, 40), n = 2;
        while (used.has(name)) name = `${label} · 내 색 ${n++}`.slice(0, 40);
        const item = { id: `c${Date.now().toString(36)}`, name, html: '', template: base.template, colors, messages: base.messages || 'box', tail: base.tail || '', emoji: base.emoji || '', ...(base.type ? { type: base.type } : {}), slot: null };
        s2.custom = [...s2.custom, item];
        state.shape = item.id; state.category = 'mine'; state.picking = false; state.inks = {}; state.inkShape = item.id;
        saveSettings();
        toastr.success(`「${name}」로 내 글꾸에 저장했어요`, '', { timeOut: 2000 });
        drawShapes(); drawColors(); draw();
    };

    // 이름 숨김 · 바꾸기 — 채팅 캡처 설정 그대로
    const tools = () => getSettings().captureTools;
    const hideList = () => withNameAliases([model.chatName, ...model.messages.map(m => m.name), model.userName, ...tools().names].filter(Boolean));
    // 1.0.1 미리보기에서 고친 글 거두기: 메시지 수가 같을 때만, 글이 실제로 달라진 메시지의 노드만 바꿔요(안 고친 메시지는 그림 · 링크 · 글자 꾸밈이 있는 원래 노드)
    const textOf = nodes => (nodes || []).map(n => n.t === 'text' ? n.text : n.t === 'br' ? '\n' : textOf(n.children)).join('');
    const harvest = () => {
        if (!state.dirty) return;
        state.dirty = false;
        const doc = frame.contentDocument;
        if (!doc?.querySelector('[data-bl-msg]')) return;
        const got = previewModel(doc);
        const base = state.edited ?? model;
        const drawn = state.drawnTexts;
        if (!got || got.messages.length !== base.messages.length) return;   // 틀이 메시지를 합치거나 나눴으면 못 잇기 — 원래 글로
        // 1.0.7: 원래 글이 아니라 막 그린 미리보기 글과 견줘요 — 이름 숨김 · 바꾸기가 켜져 있거나 틀이 글자를 바꾸면
        // 손대지 않은 메시지도 원래 글과 달라 서식 없는 미리보기 노드로 갈아 끼워졌어요(분류 · 모양 칩을 누르면 대사 색 · 기울임이 사라짐)
        const edited = (m, i) => {
            const now = textOf(got.messages[i].nodes).trim();
            return drawn?.length === got.messages.length ? now !== drawn[i] : now !== textOf(m.nodes).trim();
        };
        if (!base.messages.some((m, i) => edited(m, i))) return;
        state.edited = { ...base, messages: base.messages.map((m, i) => edited(m, i) ? { ...m, nodes: got.messages[i].nodes } : m) };
    };
    // 1.0.7 「↶ 되돌리기 · ↷ 다시하기」(글꾸 마트 시식 창과 같은 길) — 미리보기 HTML 스냅샷 · 다시 그리면 새로 시작(그 전에 고친 것은 거둬 이어져요)
    const hist = { stack: [], at: -1, timer: 0 };
    const drawHist = () => { $('[data-lc="undo"]').disabled = hist.at <= 0; $('[data-lc="redo"]').disabled = hist.at >= hist.stack.length - 1; };
    const snapNow = () => {
        const body = frame.contentDocument?.body;
        if (!body) return;
        const html = body.innerHTML;
        if (hist.stack[hist.at] === html) return;
        hist.stack.length = hist.at + 1;
        hist.stack.push(html);
        if (hist.stack.length > SNAP_MAX) hist.stack.shift();
        hist.at = hist.stack.length - 1;
        drawHist();
    };
    const resetHist = (doc) => { clearTimeout(hist.timer); hist.timer = 0; hist.stack = doc?.body ? [doc.body.innerHTML] : []; hist.at = hist.stack.length - 1; drawHist(); };
    const travel = (dir) => {
        if (hist.timer) { clearTimeout(hist.timer); hist.timer = 0; snapNow(); }
        const next = hist.at + dir, doc = frame.contentDocument;
        if (!doc?.body || next < 0 || next >= hist.stack.length) return;
        hist.at = next;
        doc.body.innerHTML = hist.stack[next];
        state.dirty = true;
        state.spoilerRange = null;
        readFields(doc);
        drawHist();
    };
    /** 미리보기의 칸(data-f) → state.fields · 머리 칸 글칸 */
    const readFields = (doc) => {
        for (const element of doc.querySelectorAll('[data-f]')) if (!basicOn() || element.getClientRects().length) setField(element.getAttribute('data-f'), element.textContent);   // 1.1.3 기본 글꾸 새 틀은 같은 칸이 칩 · 정보 줄 두 곳에 있어요 — 보이는 쪽만 읽어요
        for (const input of dialog.querySelectorAll('[data-lc-field]')) if (document.activeElement !== input) input.value = fieldOf(input.dataset.lcField);
        rememberBlank();
    };
    /** 1.0.8 비운 머리 칸을 설정에 적어요(다시 채우면 빼요) — 바뀐 게 있을 때만 저장 */
    const rememberBlank = () => {
        if (toneOn()) return;   // 1.1.3 깡통 로그 틀 묶음의 빈 제목은 그 틀의 기본이라 「비워 둔 머리 칸」으로 적지 않아요(다른 틀의 제목까지 비게 돼요)
        const s4 = store(), before = (s4.blank || []).join();
        const next = FIELD_INPUTS.map(([key]) => key).filter(key => !String(state.fields[key] ?? '').trim());
        if (next.join() !== before) { s4.blank = next; saveSettings(); }
    };
    const spoilerColors = (nodes, sp) => { for (const n of nodes || []) { if (n.kind === 'spoiler') n.sp = sp; if (n.children) spoilerColors(n.children, sp); } };
    const view = () => {
        const ct = tools();
        const out = transformLog(state.edited ?? model, { rules: ct.replace ? ct.replaceRules : [], hide: ct.redact ? { names: hideList(), mask: ct.mask, style: ct.maskStyles?.[ct.mask], word: ct.maskWord } : null });
        const target = custom() || ownColors(state.shape) || toneOn() || basicOn() ? null : paletteFor(state.shape, state.palette);   // 1.1.3 기본 글꾸 새 틀도 대사색을 그대로 읽어요   // 1.1.3 깡통 로그 틀 묶음은 로그의 대사색을 그대로 읽어요(에이드 색으로 다시 칠하지 않아요)
        if (target && target !== nowPalette()) out.model = recolorLog(out.model, tokensOf(nowPalette()), tokensOf(target));
        return out;
    };
    // 1.0.7 「보일 것」 칩 · 머리 칸 글칸 — 틀을 그릴 때마다(직접 붙인 글꾸는 틀 칸이 없어 이름 줄만)
    const drawShows = () => {
        const s3 = store(), mine = custom(), raw = rawOf(mine);   // 직접 붙인 글꾸(HTML)는 틀 칸이 없어요 — 이름 줄만
        const sn = simpleOn();   // 1.1.4 받은 심플 글꾸: 제목 · 이름 줄 · 레몬만(날짜 · 알약 · 위아래 틀 글이 없는 틀)
        const tn = toneOn();   // 1.1.3 깡통 로그 틀 묶음에는 날짜 · 알약 · 위아래 틀 글이 없어요 — 제목 · 이름 줄만
        const bn = basicOn();   // 1.1.3 기본 글꾸 새 틀: 「깡통 · 모델 · 프롬프트」 칩 자리가 정보 칸(끔 · 칩 · 탭) 고르기 · 위 글 · 아래 글은 없어요(틀 글이 곧 시안)
        for (const [key, , label, title] of SHOWS) {
            const chip = $(`[data-lc-show="${key}"]`), info = bn && key === 'tagsOff';
            chip.setAttribute('aria-pressed', String(info ? s3.basicInfo !== 'off' : !s3[key]));
            chip.disabled = (raw && key !== 'namesOff') || ((tn || sn) && key !== 'titleOff' && key !== 'namesOff') || (bn && (key === 'topOff' || key === 'bottomOff'));
            chip.querySelector('span').textContent = info ? `정보 · ${BASIC_INFO_LABEL[s3.basicInfo] ?? '끔'}` : label;
            chip.title = info ? '모델 · 프롬프트 칸 — 누를 때마다 끔 · 칩(LOG · 모델 · 프롬프트) · 탭(LOG · 프롬프트). 칩 · 탭 글자는 미리보기에서 눌러 고쳐요(♥ · ★ 도 돼요)' : title;
        }
        { const chip = $('[data-lc-height]'); chip.hidden = !bn; chip.style.display = bn ? '' : 'none'; chip.setAttribute('aria-pressed', String(!!s3.basicHeight)); chip.querySelector('span').textContent = `높이 · ${BASIC_HEIGHT_LABEL[s3.basicHeight] ?? '자동'}`; }
        { const chip = $('[data-lc-lemon]'), at = $('[data-lc-lemon-at]'), atOn = s3.lemonLink && !bn && !sn; chip.setAttribute('aria-pressed', String(!!s3.lemonLink)); at.hidden = !atOn; at.style.display = atOn ? "" : "none"; at.querySelector('span').textContent = `레몬 · ${CORNER_LABEL[normCorner(s3.lemonAt)]}`; }   // 1.1.2 레몬 바로가기(1.1.3 기본 글꾸 새 틀은 레몬이 틀 안 제자리라 자리 칩이 없어요)
        for (const input of dialog.querySelectorAll('[data-lc-field]')) {
            const key = input.dataset.lcField;
            input.disabled = raw || ((tn || sn) && key !== 'title') || (key === 'title' && s3.titleOff) || (key === 'date' && s3.dateOff) || (['char', 'model', 'prompt'].includes(key) && s3.tagsOff && !bn);
            if (document.activeElement !== input) input.value = fieldOf(key);
        }
        $('[data-lc="fields"]').setAttribute('aria-pressed', String(!$('[data-lc-fields]').hidden));
    };
    const drawTools = keepFocus(() => {
        const ct = tools();
        $('[data-lc="hide"]').setAttribute('aria-pressed', String(ct.redact));
        $('[data-lc="words"]').setAttribute('aria-pressed', String(ct.replace));
        const rules = ct.replaceRules.filter(r => r.from.trim()).length;
        $('[data-lc-words-count]').textContent = rules ? String(rules) : '';
        $('[data-lc-names]').hidden = !ct.redact;
        $('[data-lc-words]').hidden = !ct.replace;
        $('[data-lc-name-list]').innerHTML = (ct.mask === 'auto' ? `<span class="bl-lc-note bl-lc-maskword-row"><input type="text" class="bl-lc-maskword" maxlength="12" value="${esc(ct.maskWord || '○○')}" aria-label="가릴 글자" title="본문 속 이름을 이 글자로 가려요" data-lc-maskword>으로 가려요</span>` : `<span class="bl-lc-note">${esc(ct.mask === 'mosaic' ? '▒▒' : '색 칸')}으로 가려요</span>`) + ct.names.map((name, i) => `<button type="button" class="bl-lc-chip bl-lc-name" data-lc-name-remove="${i}" aria-label="${esc(name)} 빼기"><span>${esc(name)}</span><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`).join('');
        const box = $('[data-lc-rules]');
        if (box.querySelector('input:focus')) return;   // 치는 중에는 줄을 다시 그리지 않아요
        const rows = ct.replaceRules.length ? ct.replaceRules : [{ from: '', to: '' }];
        box.innerHTML = rows.map((rule, i) => `<div class="bl-lc-rule" data-rule="${i}"><input type="text" maxlength="100" placeholder="찾을 말" aria-label="찾을 말 ${i + 1}" data-rule-from value="${esc(rule.from)}"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i><input type="text" maxlength="100" placeholder="바꿀 말" aria-label="바꿀 말 ${i + 1}" data-rule-to value="${esc(rule.to)}"><button type="button" class="salty-btn bl-lc-icon" data-lc-rule-remove="${i}" aria-label="${i + 1}번 줄 지우기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>`).join('');
    });
    let ruleTimer = 0;
    const readRules = () => {
        const ct = tools();
        const rows = [...dialog.querySelectorAll('.bl-lc-rule')].map(row => ({ from: row.querySelector('[data-rule-from]').value.slice(0, 100), to: row.querySelector('[data-rule-to]').value.slice(0, 100) }));
        ct.replaceRules = rows.filter(r => r.from || r.to).slice(0, 50);
        saveSettings();
    };

    // ① 모양 칩
    const drawShapes = keepFocus(() => {
        const s2 = store();
        // 1.1.3 접힌 채: 깡통 로그 틀 셋(+ 지금 고른 다른 틀 하나)만 · 펼치면 예전처럼 그 분류의 모양
        const less = !state.more;
        const shown = new Set(less ? [...TONE_SHAPES, state.shape] : presetsIn(state.category, s2.custom));
        const order = less ? [...TONE_SHAPES, ...(PRESETS.some(p => p.id === state.shape) && !isToneShape(state.shape) ? [state.shape] : [])] : state.order.filter(id => shown.has(id));
        $('[data-lc-cats]').innerHTML = CATEGORIES.map(c => `<button type="button" class="${state.category === c.id ? 'on' : ''}" aria-pressed="${state.category === c.id}" data-cat="${c.id}">${esc(c.label)}</button>`).join('');
        const presetChips = order.map((id) => {
            const p = PRESETS.find(x => x.id === id);
            const on = state.shape === id;
            const mark = p.emoji ? `<span class="bl-lc-emoji" aria-hidden="true">${p.emoji}</span>` : `<i class="fa-solid ${p.icon}" aria-hidden="true"></i>`;
            return `<button type="button" class="bl-lc-chip" role="radio" aria-checked="${on}" data-shape="${id}">${mark}<span>${esc(p.label)}</span>${s2.fav.includes(id) ? '<i class="fa-solid fa-star bl-lc-fav" aria-label="즐겨찾기"></i>' : ''}</button>`;
        }).join('');
        const customChips = s2.custom.filter(c => shown.has(c.id)).map((c) => {
            const on = state.shape === c.id, armed = state.armed === c.id;
            // 1.0.1: 마트에서 받은 글꾸(template)는 🛒 표시 · 칩 옆 ✕ 로도 지워요(누르면 지울 준비 → 칩이나 ✕ 를 한 번 더 · 길게 누르기와 같아요)
            const mart = c.template || c.frame ? '<span class="bl-lc-mart" aria-label="마트에서 받음" title="마트에서 받음">🛒</span>' : '';
            return `<button type="button" class="bl-lc-chip${armed ? ' is-armed' : ''}" role="radio" aria-checked="${on}" data-shape="${esc(c.id)}">${c.emoji && !armed ? `<span class="bl-lc-emoji" aria-hidden="true">${esc(c.emoji)}</span>` : `<i class="fa-solid ${armed ? 'fa-trash' : 'fa-shapes'}" aria-hidden="true"></i>`}<span>${armed ? '지우기' : esc(c.name)}</span>${armed ? '' : mart}</button>`
                + `<button type="button" class="bl-lc-chip bl-lc-x${armed ? ' is-armed' : ''}" data-lc-del="${esc(c.id)}" aria-label="${esc(c.name)} ${armed ? '정말 지우기' : '지우기'}" title="${armed ? '한 번 더 누르면 지워요' : '지우기'}"><i class="fa-solid ${armed ? 'fa-trash' : 'fa-xmark'}" aria-hidden="true"></i></button>`;
        }).join('');
        $('[data-lc-shapes]').innerHTML = presetChips + customChips + (less ? '' : '<button type="button" class="bl-lc-chip bl-lc-add" data-lc="paste"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>내 글꾸</span></button>');
        const strip = $('[data-lc-shapes]'), cats = $('[data-lc-cats]');
        requestAnimationFrame(() => { revealTab(strip, strip.querySelector('[aria-checked="true"]')); applyFade(strip); revealTab(cats, cats.querySelector('.on')); applyFade(cats); });
        const preset = PRESETS.find(x => x.id === state.shape);
        $('[data-lc-gallery]').hidden = !preset?.images;
        $('[data-lc-images-count]').textContent = preset?.images ? `사진 ${(model.images?.length ?? 0) + state.images.length}장` : '';
    });
    // 1.1.3 「더 보기」: 접힘은 창 class 하나(bl-lc-less)로 — 접힌 줄은 그대로 그려 두고 숨기기만 해요(펼치면 고르던 것 그대로)
    const drawMore = () => {
        dialog.classList.toggle('bl-lc-less', !state.more);
        const button = $('[data-lc="more"]');
        button.setAttribute('aria-expanded', String(state.more));
        button.querySelector('i').className = `fa-solid fa-chevron-${state.more ? 'up' : 'down'}`;
        button.querySelector('span').textContent = state.more ? '접기' : '더 보기';
    };
    // ② 색 칩 — 테마 「색」 화면의 에이드 카드(.salty-pal) 그대로, 작게
    const drawColors = keepFocus(() => {
        const mode = modeOf(state.palette);
        const plain = (!!custom() && !simpleOn()) || !!ownColors(state.shape);   // 내 글꾸 · 전용 색 틀(할로윈)은 에이드 색 칩이 없어요(1.1.4 받은 심플 글꾸는 밝기만)
        $('[data-lc-colors]').hidden = plain;
        if (plain) return;
        for (const button of dialog.querySelectorAll('[data-lc-mode]')) button.setAttribute('aria-pressed', String(button.dataset.lcMode === mode));
        // 1.1.3 깡통 로그 틀 묶음은 색 칩을 숨기고 밝기(화이트 · 나이트)만 남겨요 — 틀 색은 대사색에서 나와요
        const tn = toneOn();
        $('[data-lc-pals]').hidden = tn || basicOn() || simpleOn();   // 1.1.3 기본 글꾸 새 틀도 밝기만
        if (tn || basicOn() || simpleOn()) { $('[data-lc-pals]').replaceChildren(); return; }
        const settings = getSettings();
        const families = Object.entries(PALETTE_FAMILIES).filter(([family]) => family !== 'custom' || settings.customName || settings.colorOverrides?.['custom-light'] || settings.colorOverrides?.['custom-night']);
        const selected = paletteFamily(state.palette);
        $('[data-lc-pals]').innerHTML = families.map(([family, data]) => {
            const id = paletteVariant(family, mode), c = colorsOf(id);
            const label = family === 'custom' ? settings.customName || data.label : data.label;
            return `<button type="button" class="salty-pal ${selected === family ? 'on' : ''}" role="radio" aria-checked="${selected === family}" data-palette="${esc(id)}" style="--pal-bg:${c.bg};--pal-surface:${c.surface};--pal-text:${c.text};--pal-muted:${c.muted};--pal-accent:${c.accent};--pal-marker:${c.marker};--pal-pop:${c.pop}"><span class="salty-pal-page"><span><b>${esc(data.sample || label)}</b></span><i></i></span><b>${esc(label)}</b></button>`;
        }).join('');
        const pals = $('[data-lc-pals]');
        revealTab(pals, pals.querySelector('.on'));
        applyFade(pals);
    });

    // ③ 미리보기 (눌러서 고침)
    const pageBg = () => (own()?.bg ?? (custom() || (state.shape === 'plain' && state.palette === nowPalette()) ? getComputedStyle(dialog).backgroundColor : colorsOf(paletteFor(state.shape, state.palette)).bg));
    const draw = () => {
        harvest();
        drawShows();
        drawInks();
        drawEasy();
        const mine = custom();
        let html;
        const shown = view();
        // 1.1.3 깡통 로그 틀 묶음: 인물표의 정해 둔 대사색을 먼저(이름 숨김 · 바꾸기로 이름이 바뀌어도 원래 이름으로 물어요) · 밝기는 고른 팔레트의 밝기
        const toneNow = toneOn(), toneMode = modeOf(state.palette);
        const lookup = toneNow || basicOn() || simpleOn() ? toneLookup(shown.model.messages, (state.edited ?? model).messages, name => people.get(name)) : null;
        state.tone = toneNow ? toneFor(state.shape, shown.model, { mode: toneMode, lookup }).tone : null;
        if (state.edited) { const c = own() ?? colorsOf(paletteFor(state.shape, state.palette)); for (const m of shown.model.messages) spoilerColors(m.nodes, { line: c.line, raised: c.raised, muted: c.muted, family: ui.family, tracking: ui.tracking }); }
        const fields = shown.rewriteFields(state.fields);
        const s3 = store();
        // 1.1.3 깡통 로그 틀 묶음의 제목은 따로(빈 채로 시작) — 「제목」을 끄면 비워요. 알약 · 날짜 · 꼬리 칸은 이 틀이 그리지 않아요
        const drawFields = toneNow ? { ...fields, title: s3.titleOff ? '' : shown.rewriteFields({ title: state.toneTitle }).title } : fields;
        // 1.0.1 「깡통 · 모델 · 프롬프트」 칩 · 1.0.7 「보일 것」 칩 — 칸을 비워 그리지 않고 그린 뒤 걷어요(log-copy-bare.js):
        // 칸만 비우면 그 칸을 담던 머리 박스 · 구분선이 빈 채로 남았어요(11-07 사용자 「제목 · 위 글 · 알약 다 빼면 가로 박스도 사라져야지」)
        const drop = [...(s3.titleOff ? ['title'] : []), ...(s3.dateOff ? ['date'] : []), ...(s3.tagsOff ? ['mark', 'char', 'model', 'prompt'] : [])];
        if (mine?.frame) { needSet(); html = renderLog(shown.model, { simple: mine, setMod, caps: capRow(mine.frame.key), mode: toneMode, lookup, fields: { ...fields, ...(s3.titleOff ? { title: '' } : {}) }, names: !s3.namesOff, lemonLink: !!s3.lemonLink }); }   // 1.1.4 받은 심플 글꾸(제목 끄기는 칸을 비워서)
        else if (rawOf(mine)) html = mine.html;
        else if (basicOn()) html = renderLog(shown.model, { shape: state.shape, fields: { ...fields, ...(s3.titleOff ? { title: '' } : {}), ...(s3.dateOff ? { date: '' } : {}) }, images: shown.rewriteImages(state.images), names: !s3.namesOff, lemonLink: !!s3.lemonLink, mode: toneMode, lookup, info: s3.basicInfo, height: s3.basicHeight, marks: true });   // 1.1.3 기본 글꾸 새 틀(제목 · 날짜 끄기는 칸을 비워서 — 틀이 그 줄째 빼요)
        else html = renderLog(shown.model, { shape: state.shape, colors: state.shape === 'plain' ? null : colorsOf(paletteFor(state.shape, state.palette)), ui, fields: drawFields, images: shown.rewriteImages(state.images), screen: tokensOf(nowPalette()), template: inkTemplate() ?? mine, names: !s3.namesOff, lemonLink: !!s3.lemonLink, mode: toneMode, lookup });
        if ((!mine || mine.template) && !toneNow && !basicOn()) { const full = html; html = fitBare(full, bareLog(full, { top: s3.topOff, bottom: s3.bottomOff, drop })); }   // 1.0.7 위 글 · 아래 글 · 칸 빼기 → 글을 덮게 된 장식 걷기
        // 1.1.3 깡통 로그 틀 묶음: 붙인 뒤 덮일 글자색(바탕 대비 4.6 아래)은 그릴 때 밝기만 맞춰요 — 미리보기와 복사 글이 같게
        if (toneNow) html = siteCheck(html, { mode: toneMode }).html;
        $('[data-lc-pick]').hidden = !(rawOf(mine) && (state.picking || !mine.slot));
        frame.onload = () => {
            const doc = frame.contentDocument;
            if (!doc) return;
            if (rawOf(mine)) {   // 마트 글꾸(template · 1.1.4 심플 frame)는 자리가 정해져 있어 고르지 않아요
                const slot = state.picking ? null : (Array.isArray(mine.slot) && fromPath(doc.body, mine.slot)) || guessSlot(doc.body);
                if (slot) { slot.innerHTML = logHtml(shown.model, { frameless: false, names: !s3.namesOff }); slot.setAttribute('data-bl-slot', ''); }
                if (state.picking) {
                    doc.body.style.cursor = 'crosshair';
                    doc.addEventListener('click', (event) => {
                        event.preventDefault();
                        const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
                        if (!target || target === doc.body) return;
                        const live = custom();   // 설정을 다시 읽으면 새 객체 — 지금 것에 적는다
                        if (live) live.slot = slotPath(target, doc.body);
                        state.picking = false;
                        saveSettings();
                        draw();
                    }, { once: true });
                    return;
                }
            }
            ensureSpoilerStyle(doc);
            if (store().lemonLink && !basicOn() && !simpleOn()) { try { placeLemon(doc, normCorner(store().lemonAt)); } catch { /* 못 재면 레몬 없이 */ } }   // 1.1.2 레몬 바로가기: 그려진 모양을 재서 빈 모서리에(미리보기에 보이는 그대로 복사돼요)
            state.drawnTexts = (previewModel(doc)?.messages ?? []).map(m => textOf(m.nodes).trim());   // 1.0.7 거둘 때 견줄 「막 그린 글」
            const syncSpoiler = () => {
                const sel = doc.getSelection();
                const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
                const inside = range ? spoilerAt(range) : null;
                state.spoilerRange = range && (inside || !range.collapsed) ? range.cloneRange() : null;
                const chip = $('[data-lc="spoiler"]');
                const wasOff = chip.disabled;
                chip.disabled = !state.spoilerRange;
                // 폰(384)은 칩 줄이 가로로 넘쳐 「숨기기」가 줄 밖에 있어요(1.0.1 「깡통 · 모델 · 프롬프트」 칩이 앞에 들어옴) — 켜질 때 칩 줄만 옆으로 밀어 보여요(본문 세로 스크롤은 그대로)
                if (wasOff && !chip.disabled) {
                    const row = chip.parentElement, r = chip.getBoundingClientRect(), box = row.getBoundingClientRect();
                    if (r.right > box.right) row.scrollLeft += r.right - box.right + 16;
                    else if (r.left < box.left) row.scrollLeft -= box.left - r.left + 16;
                }
                chip.setAttribute('aria-pressed', String(!!inside));
                chip.querySelector('span').textContent = inside ? '풀기' : '숨기기';
            };
            doc.addEventListener('selectionchange', syncSpoiler);
            syncSpoiler();
            doc.designMode = 'on';
            try { doc.execCommand('styleWithCSS', false, true); } catch { /* 옛 브라우저 */ }
            // 1.0.8 장식(data-bl-egg)을 누를 땐 편집을 잠깐 꺼요 — 문서 전체가 편집 모드라 폰에서 장식을 눌러도 자판이 올라오고 편집으로 넘어가 움직임이 안 보였어요(사용자 제보)
            let eggTimer = 0;
            doc.addEventListener('pointerdown', (event) => {
                if (!event.target?.closest?.('[data-bl-egg]')) return;
                doc.designMode = 'off';
                clearTimeout(eggTimer);
                eggTimer = setTimeout(() => { doc.designMode = 'on'; try { doc.execCommand('styleWithCSS', false, true); } catch { /* 옛 브라우저 */ } }, 900);
            }, true);
            doc.addEventListener('input', () => {
                state.dirty = true;   // 1.0.1 고친 글은 다음 그리기 전에 거둬 틀을 바꿔도 이어요
                readFields(doc);
                clearTimeout(hist.timer); hist.timer = setTimeout(() => { hist.timer = 0; snapNow(); }, SNAP_WAIT);   // 1.0.7 연속 타자는 0.5초 묶음
            });
            // 1.0.7 글꾸 마트 시식 창과 같게: 붙여 넣기는 글만(서식 · 태그 없이) · Enter 는 줄바꿈 <br>(문단 칸이 새로 생기지 않게)
            doc.addEventListener('paste', (event) => {
                const text = event.clipboardData?.getData('text/plain') ?? '';
                event.preventDefault();
                if (text) doc.execCommand('insertText', false, text.replace(/\r\n?/g, '\n'));
            });
            doc.addEventListener('keydown', (event) => {   // 미리보기 안 Esc 도 창 닫기
                if (event.key === 'Escape') { dialog.close(); return; }
                const key = event.key.toLowerCase();
                if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!doc.execCommand('insertLineBreak')) doc.execCommand('insertHTML', false, '<br>'); }
                else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z') { event.preventDefault(); travel(-1); }
                else if ((event.ctrlKey || event.metaKey) && (key === 'y' || (event.shiftKey && key === 'z'))) { event.preventDefault(); travel(1); }
            });
            resetHist(doc);
        };
        $('[data-lc-egg]').hidden = !/\sdata-bl-egg="/.test(html);   // 1.0.1 누르면 반응하는 장식이 있는 틀: 미리보기 머리에 한 줄
        frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>html{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}${motionCss()}${toneNow ? sitePreviewCss(toneMode) : ''}</style></head><body style="margin:0;padding:12px;background-color:${esc(pageBg())};-webkit-text-size-adjust:100%;overflow-wrap:anywhere">${html}</body></html>`;
    };

    /** 미리보기에 보이는 그대로(고친 것 포함) — 소독하고 고치기 표시를 걷은 HTML (marks: 표시를 남겨요 — 편집용 꼴이 메시지 · 이름 · 칸 자리를 찾아요) */
    const result = ({ marks = false } = {}) => {
        const doc = frame.contentDocument;
        if (!doc?.body) return '';
        // 글자색 굳히기: 미리보기에서 고친 글 · 숨긴 글 · 내 글꾸까지 (붙인 곳의 바탕 · 글자색 · <style> 이 무엇이든 안 보이는 글자 0 — 사용자 규칙) — pinColors
        if (!basicOn()) pinColors(doc.body, frame.contentWindow);   // 1.1.3 기본 글꾸 새 틀은 글자색을 틀 <style> 이 color + fill 로 맡아요(인라인으로 굳히면 탭 · 도장 누름의 글자색 바뀜이 멈춰요)
        const body = doc.body.cloneNode(true);
        // 1.0.9+ 미리보기로만 펼친 상자(닫힌 채 시작하는 틀 · data-bl-peek)는 복사 글에서 다시 닫아요 — 붙인 곳에서는 닫힌 채 시작해 누르면 열려요
        for (const box of body.querySelectorAll('details[data-bl-peek]')) { box.removeAttribute('open'); box.removeAttribute('data-bl-peek'); }
        sanitizeTree(body, { keepPreviewMarks: marks });
        // 1.1.3 복사 직전 점검(깡통 로그 틀 묶음): 미리보기에서 고친 글 · 숨긴 글까지 덮일 글자색을 한 번 더 봐요(인라인 그림 주소 · overflow 는 원래 길 liftForCopy 가 옮기고 바꿔요)
        const html = body.innerHTML.trim();
        return toneOn() ? siteCheck(html, { mode: modeOf(state.palette) }).html : html;
    };

    const remember = () => {
        const s2 = store();
        s2.shape = state.shape;
        if (state.picked) s2.palette = state.palette;
        s2.category = state.category;
        if (PRESETS.some(p => p.id === state.shape)) s2.recent = [state.shape, ...s2.recent.filter(id => id !== state.shape)].slice(0, 5);
        saveSettings();
    };

    // 1.0.1 마트에서 가져오기 — 새 창으로 글꾸 마트 열기 · 붙여넣기 · 파일 (받은 글꾸는 「내 글꾸」로, 액자는 보관함으로)
    const openMart = async (text) => {
        // 1.1.0 창 모듈을 못 받으면(연결 끊김 · 새 판 올라온 뒤 옛 조각) 누른 것이 조용히 끝났어요 — 설정 창 쪽처럼 알려요
        let openMartImport;
        try { ({ openMartImport } = await import('./mart-import-ui.js')); }
        catch (error) { toastr.error(`마트 창을 열지 못했어요 — ${error?.message || error}`, '마트에서 가져오기'); return; }
        openMartImport({ kind: 'geulkku', text, apply: (fn) => { fn(getSettings()); saveSettings(); }, done: (result) => {
            const first = result.geulkku[0];
            if (!first) return;
            $('[data-lc-paste] textarea').value = '';
            showPaste(false);
            state.shape = first; state.category = 'mine'; state.picking = false;
            drawShapes(); drawColors(); draw();
        } });
    };
    const showPaste = (on) => {
        $('[data-lc-paste]').hidden = !on;
        $('[data-lc-stage]').hidden = on;
        $('.bl-lc-foot').hidden = on;
        if (on) $('[data-lc-paste] textarea').focus();
    };

    // 길게 누르기: 프리셋 칩 = 즐겨찾기 별, 내 글꾸 칩 = 지우기 준비
    let hold = 0, held = false;
    $('[data-lc-shapes]').addEventListener('pointerdown', (event) => {
        const chip = event.target.closest('[data-shape]');
        held = false;
        clearTimeout(hold);
        if (!chip) return;
        hold = setTimeout(() => {
            held = true;
            const id = chip.dataset.shape, s2 = store();
            if (PRESETS.some(p => p.id === id)) {
                s2.fav = s2.fav.includes(id) ? s2.fav.filter(x => x !== id) : [...s2.fav, id];
                saveSettings();
                toastr.info(s2.fav.includes(id) ? '즐겨찾기에 넣었어요' : '즐겨찾기에서 뺐어요', '', { timeOut: 1200 });
            } else state.armed = state.armed === id ? null : id;
            drawShapes();
        }, HOLD_MS);
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) $('[data-lc-shapes]').addEventListener(type, () => clearTimeout(hold));
    $('[data-lc-shapes]').addEventListener('contextmenu', event => event.preventDefault());

    dialog.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target || !dialog.contains(target)) return;
        if (target.dataset.lcView) {   // 1.1.5 간편 | 세밀 · 「따로」(세밀의 움직임 갈래로) · 더 조절하기
            if (!fineMod) return;
            if (target.dataset.lcView === 'motion') fine.open.add('motion');
            fine.view = target.dataset.lcView === 'easy' ? 'easy' : 'fine';
            drawEasy();
            if (target.dataset.lcView === 'motion') $('[data-lt-g="motion"]')?.scrollIntoView({ block: 'nearest' });
            return;
        }
        if (target.dataset.ltTab) { fine.tab = target.dataset.ltTab; drawEasy(); return; }   // 「글」 갈래의 작은 칩
        if (target.dataset.lt) { tuneAct(target.dataset.lt); return; }   // 세밀 칸 · 간편의 색 · 질감 칩
        if (target.dataset.ltColor) { pickTune(target); return; }
        if (target.dataset.lcEasy) {   // 1.1.4 간편 칸 — 그 글꾸의 조절 값을 바꿔 저장하고 다시 그려요
            const live = custom();
            if (!live?.frame || !setMod) return;
            const [kind, value] = target.dataset.lcEasy.split(':');
            const next = kind === 'style' ? setMod.withStyle(live.set, value) : kind === 'motion' ? setMod.withMotion(live.set, value) : setMod.withSize(live.set, Number(value));
            if (next !== live.set) { live.set = next; saveSettings(); draw(); }
            return;
        }
        if (target.dataset.lcDel) {   // 내 글꾸 칩 옆 ✕: 처음엔 지울 준비 · 준비된 것은 지우기
            const id = target.dataset.lcDel;
            if (state.armed === id) {
                const s2 = store();
                s2.custom = s2.custom.filter(c => c.id !== id);
                if (state.shape === id) state.shape = 'card';
                state.armed = null;
                saveSettings();
                toastr.info('내 글꾸를 지웠어요', '', { timeOut: 1200 });
                drawShapes(); drawColors(); draw();
            } else { state.armed = id; drawShapes(); }
            return;
        }
        if (target.dataset.shape) {
            if (held) { held = false; return; }
            const id = target.dataset.shape;
            if (state.armed === id) {
                const s2 = store();
                s2.custom = s2.custom.filter(c => c.id !== id);
                if (state.shape === id) state.shape = 'card';
                state.armed = null;
                saveSettings();
            } else {
                state.armed = null;
                state.shape = id;
                state.picking = false;
                state.category = categoryOf(id);
            }
            drawShapes(); drawColors(); draw();
            return;
        }
        if (target.dataset.cat) {
            state.category = target.dataset.cat;
            const s2 = store(); s2.category = state.category; saveSettings();
            drawShapes();
            return;
        }
        if (target.dataset.lcInk) { pickInk(target); return; }   // 1.0.8 글자색
        if (target.dataset.palette) { state.palette = target.dataset.palette; state.picked = true; drawColors(); draw(); return; }
        if (target.dataset.lcMode) { state.palette = paletteVariant(paletteFamily(state.palette), target.dataset.lcMode); state.picked = true; drawColors(); draw(); return; }
        switch (target.dataset.lc) {
            case 'close': dialog.close(); break;
            case 'more': state.more = !state.more; drawMore(); drawShapes(); drawColors(); for (const strip of dialog.querySelectorAll('.bl-chip-row')) applyFade(strip); break;   // 1.1.3 더 보기 · 접기(미리보기는 다시 그리지 않아요)
            case 'ink-reset': state.inks = {}; draw(); break;
            case 'ink-save': saveInks(); break;
            case 'auto': { const mine = custom(); if (mine) { mine.slot = 'auto'; state.picking = false; saveSettings(); draw(); } break; }   // 'auto' = 고르지 않고 guessSlot 으로
            case 'paste': showPaste(true); break;
            case 'paste-cancel': showPaste(false); break;
            case 'mart': openMart(''); break;
            case 'paste-save': {
                const raw = $('[data-lc-paste] textarea').value.trim();
                if (!raw) return;
                if (/^\{[\s\S]*"bl-mart"/.test(raw)) { openMart(raw); return; }   // 1.0.1 마트에서 복사한 글(JSON)은 마트 가져오기로
                const html = sanitizeHtml(raw);
                if (!html.trim()) { toastr.warning('글꾸로 쓸 HTML 이 없어요.', '', { timeOut: 2000 }); return; }
                if (html.length > CUSTOM_BYTES) { toastr.warning(`글꾸가 너무 커요 (${Math.round(CUSTOM_BYTES / 1000)}KB 까지)`, '', { timeOut: 2500 }); return; }
                const s2 = store();
                if (s2.custom.length >= CUSTOM_MAX) { toastr.warning(`내 글꾸는 ${CUSTOM_MAX}개까지예요 — 칩 옆 ✕ 나 길게 눌러 지워요`, '', { timeOut: 2500 }); return; }
                const used = new Set(s2.custom.map(c => c.name));
                let n = s2.custom.length + 1;
                while (used.has(`내 글꾸 ${n}`)) n++;
                const item = { id: `c${Date.now().toString(36)}`, name: `내 글꾸 ${n}`, html, slot: null };
                s2.custom = [...s2.custom, item];
                saveSettings();
                $('[data-lc-paste] textarea').value = '';
                state.shape = item.id;
                state.picking = true;
                showPaste(false);
                drawShapes(); drawColors(); draw();
                break;
            }
            case 'md': {
                const fromPreview = frame.contentDocument ? previewModel(frame.contentDocument) : null;   // 미리보기에서 고친 글 · 숨긴 글까지
                const ok = await writeClipboard(null, logMarkdown(fromPreview ?? view().model, { names: !store().namesOff }));
                toast(ok, '글만 마크다운으로 복사했어요');
                if (ok) { remember(); dialog.close(); }
                break;
            }
            case 'copy': {
                const shown = result();
                if (!shown) return;
                // 1.0.1 글꾸 움직임 · 누르면 반응: 붙인 곳엔 테마 CSS 가 없어서 그 글꾸가 쓰는 키프레임만 맨 앞 <style> 로
                // 1.1.2 인라인 style 의 그림 주소(url)는 같은 <style> 의 클래스 규칙으로 — 커뮤니티 사이트가 인라인 url(&quot; 를 지워 그림이 사라졌어요(log-copy-lift.js)
                const lifted = liftForCopy(shown, motionStyleFor(shown));   // 1.1.2 위아래 코멘트 빈칸 · 코멘트 글줄 규칙까지
                const html = lifted.full;   // <style> 은 감싸는 요소 안 첫 자식
                // 1.0.1 서식(text/html)은 한 줄 그대로, 글(text/plain — HTML 칸 · 코드 편집기에 붙는 쪽)은 사람이 고치기 쉬운 꼴(줄 나눔 · 주석, 모양은 같아요 — log-copy-pretty.js) · 맨 앞 <style> 은 안내 주석 바로 아래
                const ok = await writeClipboard(html, withCommentSlots(prettyLogHtml(insertHead(copyBody(result({ marks: true })).html, lifted.head), { label: PRESETS.find(p => p.id === state.shape)?.label ?? custom()?.name ?? '', head: '' })));
                toast(ok, 'HTML 로 복사했어요 — 글 쓰기 창에 붙이면 모양 그대로, HTML 칸에 붙이면 주석 달린 고치기 쉬운 코드예요');
                if (ok) { remember(); dialog.close(); }
                break;
            }
            case 'spoiler': {
                const doc = frame.contentDocument, range = state.spoilerRange;
                if (!doc || !range) break;
                const inside = spoilerAt(range);
                if (inside) unwrapSpoiler(inside);
                else wrapSpoiler(doc, range, own() ?? colorsOf(paletteFor(state.shape, state.palette)), ui);
                ensureSpoilerStyle(doc);
                doc.getSelection()?.removeAllRanges();
                state.spoilerRange = null;
                state.dirty = true;   // 1.0.1 숨긴 글도 틀을 바꿔 다시 그릴 때 그대로
                snapNow();   // 1.0.7 숨기기 · 풀기도 되돌리기 한 칸
                target.disabled = true; target.setAttribute('aria-pressed', 'false'); target.querySelector('span').textContent = '숨기기';
                break;
            }
            case 'hide': { const ct = tools(); ct.redact = !ct.redact; saveSettings(); drawTools(); draw(); break; }
            case 'fields': { const box = $('[data-lc-fields]'); box.hidden = !box.hidden; drawShows(); if (!box.hidden) box.querySelector('input:not(:disabled)')?.focus(); break; }
            case 'undo': travel(-1); break;
            case 'redo': travel(1); break;
            case 'download': {
                const shown = result();
                if (!shown) return;
                const name = PRESETS.find(p => p.id === state.shape)?.label ?? custom()?.name ?? '로그';
                // 1.0.7 「⬇ 내려받기」(글꾸 마트 시식 창과 같은 꼴) — 복사한 HTML 을 따로 열어도 같은 모양
                const doc = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(fieldOf('title') || name)}</title>\n</head>\n<body style="margin:0;padding:16px;background:${esc(pageBg())};-webkit-text-size-adjust:100%">\n${liftForCopy(shown, motionStyleFor(shown)).full}\n</body>\n</html>\n`;
                const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([doc], { type: 'text/html' })), download: `로그-${String(name).replace(/[\\/:*?"<>|#%]+/g, '').replace(/\s+/g, '-')}.html`, hidden: true });
                document.body.append(a); a.click();
                setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
                toastr.success('받았어요 — 열면 복사한 것과 같은 모양이에요', '', { timeOut: 1800 });
                remember();
                break;
            }
            case 'words': { const ct = tools(); ct.replace = !ct.replace; saveSettings(); drawTools(); draw(); if (ct.replace) $('[data-lc-rules] input')?.focus(); break; }
            case 'rule-add': { readRules(); const ct = tools(); if (ct.replaceRules.length < 50) { ct.replaceRules = [...ct.replaceRules, { from: '', to: '' }]; saveSettings(); } drawTools(); [...dialog.querySelectorAll('[data-rule-from]')].pop()?.focus(); break; }
            case 'name-add': {
                const input = $('[data-lc-name-input]'), name = input.value.trim();
                const ct = tools();
                if (name && !ct.names.includes(name) && ct.names.length < 40) { ct.names = [...ct.names, name]; saveSettings(); }
                input.value = ''; drawTools(); draw(); break;
            }
            default:
                if (target.dataset.lcShow === 'tagsOff' && basicOn()) { const s2 = store(); s2.basicInfo = BASIC_INFO[(BASIC_INFO.indexOf(s2.basicInfo) + 1) % BASIC_INFO.length]; saveSettings(); draw(); }   // 1.1.3 기본 글꾸 새 틀: 정보 칸 끔 → 칩 → 탭
                else if (target.dataset.lcHeight !== undefined) { const s2 = store(); s2.basicHeight = BASIC_HEIGHT[(BASIC_HEIGHT.indexOf(s2.basicHeight) + 1) % BASIC_HEIGHT.length]; saveSettings(); draw(); }   // 1.1.3 높이 자동 → 작게 → 중간 → 크게
                else if (target.dataset.lcShow) { const s2 = store(), key = target.dataset.lcShow; s2[key] = !s2[key]; saveSettings(); draw(); }   // 1.0.7 「보일 것」 칩
                else if (target.dataset.lcLemon !== undefined) { const s2 = store(); s2.lemonLink = !s2.lemonLink; saveSettings(); draw(); }   // 1.1.2 레몬 바로가기 켜기 · 끄기
                else if (target.dataset.lcLemonAt !== undefined) { const s2 = store(), order = ['auto', 'tl', 'tr', 'bl', 'br']; s2.lemonAt = order[(order.indexOf(normCorner(s2.lemonAt)) + 1) % order.length]; saveSettings(); draw(); }   // 1.1.2 레몬 자리 돌리기
                else if (target.dataset.lcRuleRemove !== undefined) { const i = Number(target.dataset.lcRuleRemove); const ct = tools(); ct.replaceRules = ct.replaceRules.filter((_, n) => n !== i); saveSettings(); drawTools(); draw(); }
                else if (target.dataset.lcNameRemove !== undefined) { const i = Number(target.dataset.lcNameRemove); const ct = tools(); ct.names = ct.names.filter((_, n) => n !== i); saveSettings(); drawTools(); draw(); }
                break;
        }
    });
    let imageTimer = 0;
    // 1.1.5 세밀 숫자 조절칸 — 끄는 동안은 미리보기만(칸은 그대로) · 놓으면 칸까지 다시 그려요
    const tuneInput = (event, done) => {
        const input = event.target, cell = input.closest?.('[data-lt-f]');
        if (!cell || !fineMod) return false;
        if (input.type === 'number' && !done) return true;   // 숫자칸은 다 적은 뒤(change)에만
        const action = fineMod.inputAction(cell.dataset.ltF, cell.dataset.scale, input.type, input.value);
        if (input.type === 'range') { const box = cell.querySelector('input[type="number"]'); if (box) box.value = String(Number((Number(input.value) / (Number(cell.dataset.scale) || 1)).toFixed(4))); input.classList.remove('is-unset'); }
        fine.hold = !done;
        tuneAct(action, { redraw: done });
        if (done) { clearTimeout(fine.timer); drawEasy(); }
        return true;
    };
    dialog.addEventListener('change', (event) => { tuneInput(event, true); });
    dialog.addEventListener('toggle', (event) => { const g = event.target?.dataset?.ltG; if (!g) return; const was = fine.open.has(g); if (event.target.open) fine.open.add(g); else fine.open.delete(g); if (was !== event.target.open) drawEasy(); }, true);
    dialog.addEventListener('input', (event) => {
        if (tuneInput(event, false)) return;
        if (event.target.matches?.('[data-lc-images]')) {
            clearTimeout(imageTimer);
            imageTimer = setTimeout(() => { state.images = imagesFromCode(event.target.value); drawShapes(); draw(); }, 300);
            return;
        }
        if (event.target.matches?.('[data-lc-field]')) {   // 1.0.7 머리 칸 글칸 → 그 칸 값 · 미리보기
            setField(event.target.dataset.lcField, event.target.value);
            clearTimeout(ruleTimer); ruleTimer = setTimeout(() => { rememberBlank(); draw(); }, 300); return;
        }
        if (event.target.matches?.('[data-lc-maskword]')) {   // 11-03: 가림 글자(기본 ○○)를 직접 정해요 — 치는 동안 칸은 다시 그리지 않고 미리보기만
            const ct = tools(); ct.maskWord = event.target.value.trim().slice(0, 12) || '○○'; saveSettings();
            clearTimeout(ruleTimer); ruleTimer = setTimeout(draw, 300); return;
        }
        if (!event.target.closest?.('.bl-lc-rule')) return;
        clearTimeout(ruleTimer);
        ruleTimer = setTimeout(() => { readRules(); $('[data-lc-words-count]').textContent = String(tools().replaceRules.filter(r => r.from.trim()).length || ''); draw(); }, 300);
    });
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.matches?.('[data-lc-name-input]')) { event.preventDefault(); $('[data-lc="name-add"]').click(); }
    });
    // 1.1.0: 닫을 때 남은 대기(규칙 · 그림 주소 · 글자색 · 되돌리기 묶음 · 길게 누르기)를 모두 걷어요 — 닫힌 직후 떨어진 창을 다시 그리지 않게
    dialog.addEventListener('close', () => { clearTimeout(ruleTimer); clearTimeout(imageTimer); clearTimeout(inkTimer); clearTimeout(fine.timer); clearTimeout(hist.timer); clearTimeout(hold); hist.timer = 0; if (open === dialog) open = null; dialog.remove(); }, { once: true });
    open = dialog;
    drawMore();
    drawShapes();
    drawColors();
    drawTools();
    draw();
    showThemeModal(dialog);
    for (const strip of dialog.querySelectorAll('.bl-chip-row')) strip.addEventListener('scroll', () => applyFade(strip), { passive: true });
    requestAnimationFrame(() => {
        const shapes = $('[data-lc-shapes]');
        revealTab(shapes, shapes.querySelector('[aria-checked="true"]'));
        for (const strip of dialog.querySelectorAll('.bl-chip-row')) applyFade(strip);
    });
}

/**
 * 글자색 굳히기(로그 복사 창 result): color 가 인라인으로 없는 요소에 지금 보이는 글자색 · 칠하는 색(-webkit-text-fill-color)을 적어요.
 * 1.0.7 일부 커뮤니티 사이트는 다크 모드에 맞춘다며 글의 color 를 인라인 !important 로 덮어써요(파랑 대사가 검정 · 남색 제목이 흰색으로 바뀌어 안 보임 — 사용자 제보).
 *   실제로 칠하는 색은 건드리지 않아서 같은 색을 함께 적어 둬요. 글자를 투명하게 칠한 장식(그라데이션 글씨)은 그대로.
 * 1.1.0 읽기를 다 하고 나서 써요 — 전엔 요소마다 쓰고 바로 다음 요소의 getComputedStyle 을 읽어 요소 수만큼 스타일 다시 계산을 강제했어요
 *   (복사 한 번에 result 가 두 번 · 긴 로그는 요소 수천 개). 조상에 적는 값은 그 조상의 계산값 그대로라 자식이 읽는 값은 같아요.
 */
export function pinColors(body, win) {
    const todo = [];
    for (const el of body.querySelectorAll('*')) {
        if (el.matches('style, script, br, img, col, colgroup')) continue;
        const color = !el.style.color, fill = !el.style.webkitTextFillColor;
        if (!color && !fill) continue;
        const cs = win.getComputedStyle(el);
        todo.push([el, color ? cs.color : null, fill ? cs.webkitTextFillColor : null]);
    }
    for (const [el, color, fill] of todo) {
        if (color !== null) el.style.color = color;
        if (fill !== null) el.style.webkitTextFillColor = /^(transparent|rgba\(0, 0, 0, 0\))$/.test(fill || '') ? fill : el.style.color;
    }
}

function toast(ok, message) {
    if (ok) toastr.success(message, '', { timeOut: 1600 });
    else toastr.error('클립보드에 넣지 못했어요. 다시 눌러 주세요.', '로그 복사');
}

/** 클립보드: text/html(있으면) + text/plain. 안전한 주소가 아니어서 Clipboard API 가 없으면 copy 사건으로 */
export async function writeClipboard(html, text) {
    try {
        if (globalThis.isSecureContext && navigator.clipboard) {
            if (html && navigator.clipboard.write && globalThis.ClipboardItem) {
                await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
                return true;
            }
            if (!html && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
        }
    } catch (error) { console.warn('[로그 복사] Clipboard API', error); }
    let ok = false;
    const onCopy = (event) => {
        event.clipboardData?.setData('text/plain', text);
        if (html) event.clipboardData?.setData('text/html', html);
        event.preventDefault();
        ok = !!event.clipboardData;
    };
    document.addEventListener('copy', onCopy, true);
    try { document.execCommand('copy'); } catch { /* 막힘 */ } finally { document.removeEventListener('copy', onCopy, true); }
    return ok;
}

// 시트 모양 — 철칙 크기표(칩 34/32 · 글자 단추 36/34 · 아이콘 단추 34 · 큰 주요 단추 40/44 · 모서리 8/12) · 평평(면 + 1px 선) · 스크롤바 숨김.
// 색은 테마 변수만. 에이드 카드는 테마 「색」 화면의 .salty-pal 을 그대로 쓰고 크기만 줄여요.
const STYLE = `
.bl-tool-dialog.bl-lc { width:min(560px, calc(100vw - 24px)); padding:0; overflow:hidden; display:flex; flex-direction:column; max-height:calc(100dvh - 24px); }
.bl-lc-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 8px 8px 16px; border-bottom:1px solid var(--salty-line); }
.bl-lc-head h3 { display:flex; align-items:center; gap:8px; margin:0; min-width:0; font-size:16px; font-weight:650; line-height:1.4; white-space:nowrap; overflow:hidden; }
.bl-lc-head h3 i { flex:none; margin:0; color:var(--salty-accent-ink, var(--salty-accent)); translate:0 -.05em; }   /* 1.0.1 fa-copy 잉크가 제목 글자보다 0.81px(16px 의 0.05em) 아래 → 제 크기 비율로 올려요(뒤 0.01) */
.bl-lc-head h3 small { min-width:0; margin:0; overflow:hidden; text-overflow:ellipsis; color:var(--salty-muted); font-size:13px; font-weight:400; }
.bl-lc .bl-lc-icon { position:relative; flex:none; width:34px; min-width:34px; height:34px; min-height:34px; padding:0; gap:0; border:0; background:transparent; }
.bl-lc .bl-lc-icon::before { content:''; position:absolute; inset:-5px; }
.bl-lc-scroll { display:grid; grid-auto-rows:max-content; gap:8px; padding:12px 0; overflow-y:auto; min-height:0; scrollbar-width:none; }   /* 11-03: 줄 높이는 내용 크기로 — auto 줄이면 창이 꽉 찼을 때 overflow:hidden 인 미리보기 줄이 남은 자리로 줄어들어(최소 높이 0) iframe 만 잘리고 넘치는 내용이 없어져 스크롤이 안 됐어요(사용자 제보) */
.bl-lc-scroll::-webkit-scrollbar, .bl-lc-chips::-webkit-scrollbar, .bl-lc-pals::-webkit-scrollbar { display:none; }
.bl-lc .salty-seg.bl-lc-cats { display:flex; flex-wrap:nowrap; margin:0 16px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; }
.bl-lc .salty-seg.bl-lc-cats::-webkit-scrollbar { display:none; }
.bl-lc .salty-seg.bl-lc-cats > button { flex:1 0 auto; min-width:max-content; min-height:var(--bl-ui-chip, 34px); white-space:nowrap; font:inherit; font-size:13px; letter-spacing:inherit; cursor:pointer; }
.bl-lc-gallery[hidden] { display:none; }
.bl-lc-gallery { display:grid; gap:4px; margin:0 16px; }
.bl-lc-gallery textarea { box-sizing:border-box; width:100%; min-height:72px; padding:8px 10px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font-family:var(--salty-font-code, monospace); font-size:13px; scrollbar-width:none; resize:vertical; }
.bl-lc-gallery textarea:focus { outline:1px solid var(--salty-accent); }
.bl-lc-chips, .bl-lc-pals { display:flex; gap:8px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; padding:5px 16px; scroll-padding:0 16px; }
.bl-lc-chip { position:relative; flex:none; box-sizing:border-box; display:inline-flex; align-items:center; gap:4px; min-height:var(--bl-ui-chip, 34px); margin:0; padding:0 10px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-surface); color:var(--salty-text); font:inherit; font-size:13px; line-height:1.2; letter-spacing:inherit; white-space:nowrap; box-shadow:none; cursor:pointer; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }
.bl-lc-chip > i { font-size:12px; color:var(--salty-muted); }
.bl-lc-chip > .bl-lc-emoji { font-size:14px; line-height:1; }
.bl-lc-chip:is([aria-checked="true"], [aria-pressed="true"]) { background:var(--salty-accent-10, var(--salty-raised)); font-weight:650; }
.bl-lc-chip[aria-pressed="true"] > i:first-child { color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-chip small { font-size:12px; color:var(--salty-muted); }
.bl-lc-chip:disabled { opacity:.5; cursor:default; }
.bl-lc-inks[hidden] { display:none; }
.bl-lc .bl-lc-inks { flex-wrap:nowrap; gap:6px; }
.bl-lc-ink-title { flex:none; color:var(--salty-muted); font-size:13px; }
.bl-lc-inks .bl-lc-chip { min-height:30px; padding:0 8px 0 7px; gap:4px; font-size:12px; }
.bl-lc-ink-dot { flex:none; width:12px; height:12px; border-radius:50%; background:var(--ink); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--salty-text) 22%, transparent); }
.bl-lc-inks .bl-lc-chip.bl-lc-ink-act { justify-content:center; min-width:30px; padding:0; }
.bl-lc-inks .bl-lc-chip.bl-lc-ink-act:not(:disabled) > i { color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-inks .bl-lc-chip.bl-lc-ink-act:disabled { opacity:.35; }
.bl-lc-ink-sep { flex:none; width:1px; height:18px; background:var(--salty-line); }
.bl-lc-chip[aria-checked="true"] > i:first-child { color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-chip .bl-lc-fav { font-size:10px; color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-chip.is-armed { border-color:var(--salty-danger, currentColor); color:var(--salty-danger, inherit); }
.bl-lc-chip.is-armed > i { color:inherit; }
.bl-lc-chip.bl-lc-x { justify-content:center; min-width:var(--bl-ui-chip, 34px); margin-left:-6px; padding:0 8px; }
.bl-lc-chip > .bl-lc-mart { font-size:11px; line-height:1; }
.bl-lc-chip:focus-visible, .bl-lc .salty-pal:focus-visible { outline:1px solid var(--salty-accent); outline-offset:1px; }
.bl-lc-colors { display:flex; align-items:center; gap:0; padding-left:16px; min-width:0; }
.bl-lc-colors[hidden], .bl-lc-pals[hidden], .bl-lc-pick[hidden], .bl-lc-paste[hidden], .bl-lc-stage[hidden], .bl-lc-foot[hidden] { display:none; }
.bl-lc-colors .bl-lc-pals { flex:1; min-width:0; padding-left:8px; }
.bl-lc-mode { display:flex; flex:none; gap:4px; padding:4px; border-radius:12px; background:var(--salty-fill-shade, var(--salty-shade)); }
.bl-lc-mode button { display:grid; place-items:center; width:34px; height:34px; margin:0; padding:0; border:0; border-radius:8px; background:transparent; color:var(--salty-muted); font-size:14px; cursor:pointer; }
.bl-lc-mode button[aria-pressed="true"] { background:var(--salty-fill-surface, var(--salty-surface)); color:var(--salty-accent); }
.bl-lc .bl-lc-pals .salty-pal { flex:none; width:96px; gap:4px; padding:4px 4px 6px; margin:4px 0; cursor:pointer; }
.bl-lc .bl-lc-pals .salty-pal.on { box-shadow:0 0 0 2px var(--salty-bg), 0 0 0 4px var(--salty-accent); }
.bl-lc .bl-lc-pals .salty-pal-page { padding:6px 8px; font-size:12px; }
.bl-lc .bl-lc-pals .salty-pal-page i { margin-top:6px; }
.bl-lc .bl-lc-pals .salty-pal > b { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bl-lc-pick { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 16px; padding:0 0 0 12px; border:1px solid var(--salty-accent); border-radius:8px; color:var(--salty-text); font-size:13px; }
.bl-lc-pick .salty-btn { min-height:34px; border:0; border-left:1px solid var(--salty-line); border-radius:0 8px 8px 0; }
.bl-lc-stage { margin:0 16px; border:1px solid var(--salty-line); border-radius:12px; overflow:hidden; background:var(--salty-bg); }
.bl-lc-egg { padding:6px 12px; border-bottom:1px solid var(--salty-line); color:var(--salty-muted); font-size:12px; line-height:1.4; }
.bl-lc-egg[hidden] { display:none; }
.bl-lc-stage iframe { display:block; width:100%; height:min(52dvh, 460px); border:0; background:transparent; }
.bl-lc-paste { display:grid; gap:8px; margin:0 16px; }
.bl-lc-paste textarea { box-sizing:border-box; width:100%; min-height:200px; padding:8px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font-family:var(--salty-font-code, monospace); font-size:13px; scrollbar-width:none; }
.bl-lc-paste textarea:focus { outline:1px solid var(--salty-accent); }
.bl-lc-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.bl-lc-tools, .bl-lc-shows, .bl-lc-inks { display:flex; align-items:center; gap:8px; padding:5px 16px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; }
.bl-lc-tools::-webkit-scrollbar, .bl-lc-shows::-webkit-scrollbar, .bl-lc-inks::-webkit-scrollbar { display:none; }
/* 1.0.7 「보일 것」 칩: 끈 칩(뺀 것)은 흐린 글씨 + 가운데 줄 — 켬 = 보여요 */
.bl-lc-easy { display:grid; gap:0; padding:2px 0; }
.bl-lc-easy[hidden] { display:none; }
.bl-lc-easy-row { display:flex; align-items:center; gap:4px; min-width:0; padding-left:16px; }   /* 1.1.4 간편: 줄 이름 + 가로로 미는 칩 줄(설계 4-8 — 칸이 셋 · 넷뿐인 줄도 칩 꼴 그대로) */
.bl-lc-easy-h { flex:none; display:grid; min-width:52px; color:var(--salty-muted); font-size:12px; line-height:1.3; }
.bl-lc-easy-h small { font-size:11px; color:var(--salty-muted); }
.bl-lc-easy-chips { display:flex; flex:1; align-items:center; gap:8px; min-width:0; padding:5px 16px 5px 0; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; }
.bl-lc-easy-chips::-webkit-scrollbar { display:none; }
.bl-lc-shows .bl-lc-chip[aria-pressed="false"] > span { color:var(--salty-muted); text-decoration:line-through; }
.bl-lc-fields[hidden], .bl-lc-bar[hidden] { display:none; }
.bl-lc-fields { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap:8px; margin:0 16px; }
.bl-lc-field { display:flex; align-items:center; gap:8px; min-width:0; color:var(--salty-muted); font-size:13px; }
.bl-lc-field > span { flex:none; }
.bl-lc-field input { box-sizing:border-box; flex:1; width:100%; min-width:0; min-height:36px; padding:0 10px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font:inherit; font-size:var(--bl-ts-ctl, 14px); }
.bl-lc-field input:focus { outline:1px solid var(--salty-accent); }
.bl-lc-field input:disabled { opacity:.5; }
.bl-lc-bar { display:flex; align-items:center; gap:4px; margin:0 16px -4px; min-width:0; }
.bl-lc-bar > .bl-lc-note { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
.bl-lc-bar > .bl-lc-note > i { font-size:11px; }
.bl-lc .bl-lc-bar .bl-lc-icon:disabled { opacity:.4; }
.bl-lc-names[hidden], .bl-lc-words[hidden] { display:none; }
.bl-lc-names, .bl-lc-words { display:grid; gap:8px; margin:0 16px; }
.bl-lc-name-list { display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0; }
.bl-lc-note { color:var(--salty-muted); font-size:13px; }
.bl-lc-name > i { font-size:11px; }
.bl-lc-row2 { display:flex; gap:8px; align-items:center; }
.bl-lc-rule { display:grid; grid-template-columns:minmax(0, 1fr) auto minmax(0, 1fr) auto; gap:8px; align-items:center; margin-bottom:8px; }
.bl-lc-rule > i { font-size:12px; color:var(--salty-muted); }
.bl-lc-names input, .bl-lc-rule input { box-sizing:border-box; width:100%; min-width:0; min-height:36px; padding:0 10px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font:inherit; font-size:14px; letter-spacing:inherit; box-shadow:none; }
.bl-lc-names input:focus, .bl-lc-rule input:focus { outline:1px solid var(--salty-accent); }
.bl-lc-maskword-row { display:inline-flex; align-items:center; gap:4px; }
.bl-lc-names input.bl-lc-maskword { width:6em; min-height:30px; padding:0 8px; text-align:center; font-size:13px; }
.bl-lc .bl-lc-add-rule { justify-self:start; min-height:36px; }
@media (min-width: 769px) and (pointer: fine) { .bl-lc-names input, .bl-lc-rule input, .bl-lc .bl-lc-add-rule, .bl-lc-field input { min-height:34px; } }
.bl-lc-more { display:flex; padding:0 16px; }
.bl-lc-more .bl-lc-chip > i { font-size:12.5px; color:inherit; }   /* 「더 보기 · 접기」 꺾쇠는 테마의 다른 꺾쇠와 같은 꼴(12.5px · 글자색) — 칩 아이콘 꼴(12px · 흐린 색)이면 꺾쇠 변형이 하나 늘어요 */
.bl-lc.bl-lc-less :is(.bl-lc-cats, .bl-lc-gallery, .bl-lc-pals, .bl-lc-inks, .bl-lc-tools, .bl-lc-shows, .bl-lc-fields, .bl-lc-names, .bl-lc-words) { display:none; }   /* 1.1.3 접힌 채: 「더 보기」 안의 줄 */
.bl-lc-foot { display:grid; grid-template-columns:auto auto 1fr; gap:8px; padding:12px 16px 16px; border-top:1px solid var(--salty-line); }
.bl-lc-foot .salty-btn { min-height:40px; }
.bl-lc-foot .bl-tool-primary { border-color:var(--salty-accent); background:var(--salty-accent); color:var(--salty-on-accent, #fff); font-weight:650; padding:0 16px; border-radius:12px; }   /* 화면당 하나 큰 주요 단추 = 포인트 면 (볼록 · 그림자 없음) · 1.0.7 크기표 큰 주요 단추(여백 16 · 모서리 12 — 새 판 확인 창 · 입력 창 큰 단추와 같은 모양) */
@media (min-width: 769px) and (pointer: fine) { .bl-lc-chip { min-height:32px; } .bl-lc-foot .salty-btn { min-height:44px; } }
@media (pointer: coarse) { .bl-lc .salty-seg.bl-lc-cats > button { position:relative; } .bl-lc-chip::before, .bl-lc-mode button::before, .bl-lc .salty-seg.bl-lc-cats > button::before { content:''; position:absolute; left:50%; top:50%; width:max(100%, 44px); height:max(100%, 44px); transform:translate(-50%, -50%); } .bl-lc-mode button { position:relative; } }   /* 누르는 칸 44 (철칙 §1 투명 ::before) */
`;
function ensureStyle() {
    if (document.getElementById('bl-lc-style')) return;
    const style = document.createElement('style');
    style.id = 'bl-lc-style';
    style.textContent = STYLE;
    document.head.append(style);
}
