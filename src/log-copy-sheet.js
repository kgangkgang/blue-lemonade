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
import { PRESETS, CATEGORIES, presetsIn, categoryOf, renderLog, logMarkdown, dateLabel } from './log-copy-presets.js';
import { logHtml } from './log-copy-render.js';
import { templateColors } from './log-copy-template.js';   // 1.0.1 글꾸 마트에서 받은 내 글꾸
import { readSaved, RETIRED_FALLBACK } from './log-copy-retired.js';   // 1.1.7 뺀 옛 내장 글꾸 48종의 이름표(저장된 id 읽기만) · 1.1.8 복사 뒤에도 옛 id 기억
import { PAGES } from './repo.js';   // 1.1.7 뺀 내장 글꾸의 마트 새 판 바로가기 · 1.1.8 빈 「내 글꾸」 · 붙여 넣기 칸의 마트 열기
import { motionCss, motionStyleFor } from './log-copy-motion.js';   // 1.0.1 글꾸 움직임 · 누르면 반응(미리보기 칸 · HTML 복사 맨 앞 <style>)
import { sanitizeHtml, sanitizeTree, slotPath, fromPath, guessSlot, imagesFromCode } from './log-copy-sanitize.js';
import { applyFade, revealTab } from './tab-scroll.js';
import { transformLog, recolorLog } from './log-copy-words.js';   // 이름 숨김 · 단어 바꾸기 (채팅 캡처 「로그 공유 · 이름 가림」 설정을 같이 써요) · 고른 에이드로 역할 색 다시 계산
import { withNameAliases } from './name-aliases.js';
import { wrapSpoiler, unwrapSpoiler, spoilerAt, ensureStyle as ensureSpoilerStyle, previewModel, harvestEdits, nodesMark, stripRowMarks } from './log-copy-spoiler.js';   // 숨긴 글 · 미리보기에서 고친 글로 마크다운
import { prettyLogHtml } from './log-copy-pretty.js';
import { liftForCopy, copyBody, insertHead, withCommentSlots, byteSize, sizeNote } from './log-copy-lift.js';   // 1.1.2 인라인 그림 주소 → 맨 앞 <style> 클래스 · 정화기 맞춤(overflow:clip · block-size · 스크롤바 숨김)
import { placeLemon, normCorner, CORNER_LABEL } from './log-copy-lemon.js';   // 1.1.2 「레몬 바로가기」(기본 꺼짐) — 빈 모서리에 레몬 · 누르면 블루레몬에이드 소개 글
import { bareLog } from './log-copy-bare.js';   // 1.0.7 위 글 · 아래 글 빼기(틀에 박힌 머리 표 · 꼬리말 …)   // 1.0.1 「HTML 복사」 코드를 사람이 고치기 쉬운 꼴로 (줄 나눔 · 주석 — 모양은 그대로)
import { fitBare } from './log-copy-bare-fit.js';   // 1.0.7 빼고 나서 글을 덮게 된 떠 있는 장식 걷기(11-07 사용자 「컴퓨터가 내려와 글을 덮어」)
import { TOKEN_KEYS } from './palettes.js';   // 가로 칩 줄: 넘치는 쪽 가장자리 흐림 · 고른 칩 보이기 (탭 줄과 같은 부품)
import { TONE_SHAPES, isToneShape, toneFor, toneLookup } from './log-copy-tone.js';   // 1.1.3 「깡통 로그」 틀 묶음(깡통 로그 · 미니 · 진한 바탕) — 색은 대사색 하나에서 · 에이드 색 칩 없이 밝기만
import { people } from './people.js';   // 1.1.3 인물표의 정해 둔 대사색(없으면 화면에서 읽은 색)
import { SITE, sitePreviewCss, siteCheck } from './log-copy-site-sim.js';
import { speakerLetters, castLetters } from './log-copy-simple.js';   // 11-12 받은 심플 글꾸: 캐릭터 색을 아는지(「소품도 캐릭터 색」 칩이 쓸모 있는지) — renderLog 와 같은 판정
import { GUIDE_HTML, CODE_HTML, CODE_BUTTON, STYLE as HANDOFF_STYLE, guide, showCode, selectAll, copyArea } from './log-copy-handoff.js';   // 1.2.0 붙이는 길 — 바닥 줄 위 안내 · 「코드 보기」 칸 · 복사 뒤 창 유지
import { mineOrder, removeMine, restoreMine, countLine, infoLabel, MINE_MAX } from './log-copy-mine.js';   // 1.2.0 받은 글꾸 관리 — 즐겨찾기 · 최근 · 되돌리는 지우기 · n/20
import { attachUndo } from './ask.js';
import { isBasicShape, BASIC_INFO, BASIC_HEIGHT, BASIC_INFO_LABEL, BASIC_HEIGHT_LABEL } from './log-copy-basic.js';   // 1.1.3 「기본 글꾸」 새 틀 18 — 밝기만 · 정보 칸(끔 · 칩 · 탭) · 높이(자동 · 작게 · 중간 · 크게)   // 1.1.3 붙일 곳 흉내(바탕 · 코멘트 자리) · 복사 직전 점검
import { createSelectBar } from './log-copy-select-bar.js';   // 11-12 고른 글 옆 막대(눌러야 보이게 · 숨김 풀기)
import { wrapHtml, wrapModel, wrapMode } from './log-copy-wrap.js';   // 11-13 본문 줄바꿈 글자 단위(기본) · 단어 단위 — 마트 mart/word-wrap.js 와 같은 사본

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
const modeOf = id => PALETTES[id]?.mode || (/night|^black$/.test(id) ? 'dark' : 'light');

function chipOrder(s) {
    const ids = PRESETS.map(p => p.id);
    const fav = ids.filter(id => s.fav.includes(id));
    const recent = s.recent.filter(id => ids.includes(id) && !fav.includes(id));
    return [...fav, ...recent, ...ids.filter(id => !fav.includes(id) && !recent.includes(id))];
}

// ── 시트 ─────────────────────────────────────────────────────

let open = null;
let stageBig = false;   // 1.1.6 폰 화면 미리보기 크기 — 작게(화면 약 30%)로 시작 · 크게로 바꾸면 이 탭이 열려 있는 동안 기억해요(설정에는 안 남겨요 — 시작 묶음 0바이트)
const PHONE = '(max-width: 600px)';   // 1.1.6 폰 화면 규칙이 걸리는 폭(STYLE 의 @media 와 같아요)
const MART_GEULKKU = `${PAGES}/mart/geulkku/`;   // 1.1.8 글꾸를 얻는 곳(1.1.7 부터 내장 글꾸 없이 마트 → 「테마용 복사」 → 여기 붙여 넣기 하나)

// 「전환 넣기」(복사 글에 해 · 달 전환 단추 — log-copy-flip.js) 켬끔 기억: 이 기기에만(localStorage) — 설정 꼴 · 시작 묶음은 그대로예요
const FLIP_KEY = 'bl-lc-flip';
const flipSaved = () => { try { return globalThis.localStorage?.getItem(FLIP_KEY) === '1'; } catch { return false; } };
const flipSave = (on) => { try { if (on) globalThis.localStorage?.setItem(FLIP_KEY, '1'); else globalThis.localStorage?.removeItem(FLIP_KEY); } catch { /* 사생활 모드 · 막힘 — 이번 창에만 */ } };
const FLIP_NONE = '이 글꾸는 낮 · 밤 두 판이 없어요';   // log-copy-flip.js FLIP_NONE 과 같은 글(조각을 받기 전에도 보여요)

/** @param {object} model captureLog() 결과 */
export async function openLogSheet(model) {
    if (!model?.messages?.length) { toastr.warning('글을 다시 골라 주세요.', '', { timeOut: 1800 }); return; }
    open?.close();
    ensureStyle();
    await ensurePalettes();
    const s = store();
    // 1.1.8 「블루레몬 추천」 기본 글꾸(log-copy-picks.js) — 창을 열 때만 받아요(따로 조각 · 못 받거나 못 풀면 추천 줄 없이 예전 그대로)
    let pk = { picks: [], mod: null };
    try { const mod = await import('./log-copy-picks.js'); pk = { picks: await mod.loadPicks(), mod }; } catch { /* 추천 없이 */ }
    // 「전환 넣기」 조각(log-copy-flip.js) — 켜 둔 사람만, 창을 열 때나 처음 켤 때 받아요(못 받으면 전환 없이 예전 그대로)
    let flipMod = null;
    const needFlip = async () => { if (!flipMod) { try { flipMod = await import('./log-copy-flip.js'); } catch { /* 전환 없이 */ } } return flipMod; };
    if (flipSaved()) await needFlip();
    const pickOn = id => !!pk.mod && pk.mod.pickIds(pk.picks, store().custom).includes(id);   // 보이는 추천 글꾸인가(마트에서 같은 틀을 받아 뒀으면 받은 쪽이 이겨요)
    const catOf = id => (pickOn(id) ? pk.mod.PICK_CATEGORY.id : categoryOf(id));
    const catList = pk.picks.length ? [CATEGORIES[0], pk.mod.PICK_CATEGORY, ...CATEGORIES.slice(1)] : CATEGORIES;   // 「기본」 바로 뒤
    const names = connectionNames();
    const first = model.messages.find(m => m.time)?.time ?? Date.now();
    const state = {
        shape: s.shape,
        palette: isPaletteId(s.palette) && modeOf(s.palette) === modeOf(nowPalette()) ? s.palette : nowPalette(),
        fields: { title: model.chatTitle || 'Title', mark: 'LOG', char: model.charName || model.chatName, model: names.model, prompt: names.prompt, date: dateLabel(first), from: model.userName, tail: '', info: '', page: '1', subtitle: model.chatName ? `${model.chatName}의 기록` : '' },
        category: catList.some(c => c.id === s.category) ? s.category : 'basic',   // 분류 칩 — 처음은 「기본」, 마지막에 고른 것을 기억
        images: [],   // 갤러리: 붙여 넣은 이미지 코드 · 주소 (이번 시트에만)
        picking: false,
        picked: false,   // 이번에 색 칩을 직접 눌렀나 — 누른 것만 기억해요(안 누르면 다음에도 지금 팔레트)
        edited: null,   // 1.0.1 미리보기에서 고친 글(메시지 노드만 바꾼 모델) — 틀 · 색을 바꿔 다시 그려도 그대로
        dirty: false,   // 마지막으로 그린 뒤 미리보기 글을 고쳤나 (고쳤을 때만 거둬요 — 안 고친 메시지는 그림 · 링크가 있는 원래 노드 그대로)
        drawnTexts: null,   // 1.0.7 막 그린 미리보기의 메시지별 글 — 거둘 때 이것과 달라진 메시지만 「고친 것」(이름 숨김 · 바꾸기 · 틀이 바꾼 글자는 고친 것이 아니에요)
        order: chipOrder(s),
        inks: {}, inkShape: null,   // 1.0.8 이번 창에서 바꾼 글자색(모양을 바꾸면 비워요) · 내 글꾸에 저장하면 그 글꾸 색이 돼요
        toneTitle: '',   // 1.1.3 깡통 로그 틀 묶음의 제목 — 늘 빈 채로 시작해요(레몬만) · 다른 틀의 제목 · 「비워 둔 머리 칸」 기억과 따로(서로 안 건드려요)
        tone: null,   // 1.1.3 막 그린 깡통 로그 틀의 색 묶음(숨긴 글 알약 · 미리보기 바탕)
        more: true,   // 1.1.3 「더 보기」 펼침 — 아래에서 모양이 정해진 뒤 정해요
        folds: {}, allCats: false, allShapes: false,   // 1.1.6 폰 화면: 펼친 갈래 · 분류 · 틀 줄 전부 보기(이번 창에만)
        pickOpen: null,   // 1.1.8 판 고르기를 펼친 추천 묶음(이번 창에만)
        ed: { on: false, shape: null, texts: new Map(), orig: new Map(), step: null },   // 11-12 「글 고치기」 켬 · 소품 안 고친 글(그 틀에만) · 고른 소품 단계(이번 창에만)
        flip: !!flipMod, flipPlan: null, flipDrawn: false, flipLive: false, flipWhy: false,   // 「전환 넣기」 켬 (켜 둔 사람은 위에서 조각을 받았어요 — 못 받았으면 끈 채) · 막 그린 글의 전환 계획(못 다는 글꾸면 null) · 계획을 세워 봤나 · 미리보기에 알약이 얹혔나 · 못 다는 까닭 줄을 눌러 열었나
    };
    // 1.0.8 비워 둔 머리 칸(깡통 · 모델 · 프롬프트 알약 · 날짜 · 제목)은 다음에 열어도 빈 채로 — 전엔 열 때마다 지금 연결 이름으로 다시 채워 지운 알약이 돌아왔어요(사용자 「없애 뒀으면 없는 상태로 시작」)
    for (const key of s.blank || []) state.fields[key] = '';
    // 1.1.7 뺀 옛 내장 글꾸(빼빼로데이 등)를 고른 채였으면 — 저장 값은 그대로 두고 읽기만 바꿔요: 마트 새 판을 받아 뒀으면 그 글꾸로 이어서 · 아니면 기본 틀(깡통 로그)로
    //   1.1.8 옛 id 는 retiredFrom 에 남겨요 — 깡통 로그로 복사해 모양이 바뀌어도 나중에 새 판을 받으면 이어져요. 안내는 9초 알림 대신 시트 안 띠(닫을 때까지 · drawRetired)
    const read = readSaved(s, pk.mod ? pk.mod.pickIds(pk.picks, s.custom).map(id => ({ id })) : []);   // 1.1.8 추천 글꾸에 마트 새 판이 있으면 그 판으로(택배 상자 · 속보 방송)
    if (read.from && s.retiredFrom !== read.from) s.retiredFrom = read.from;
    if (read.retired) { state.shape = read.shape; state.category = catOf(read.shape); }
    const retired = read.retired && read.shape === RETIRED_FALLBACK ? read : null;   // 띠에 쓸 것(새 판으로 이어 그렸으면 없음)
    if (!PRESETS.some(p => p.id === state.shape) && !s.custom.some(c => c.id === state.shape) && !pickOn(state.shape)) state.shape = 'card';
    // 깡통 로그 틀이면 접힌 채 · 다른 틀을 쓰던 설정이면 예전 그대로 펼친 채. 접힌 줄에서 켜 둔 것이 지금 글을 바꾸고 있으면(이름 숨김 · 바꾸기 · 이름 줄 끔) 펼쳐서 보여요
    { const ct = getSettings().captureTools; state.more = s.custom.some(c => c.id === state.shape) || pickOn(state.shape) || !isToneShape(state.shape) || !!(ct?.redact || ct?.replace || s.namesOff); }
    const ui = uiFont();

    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-lc';
    dialog.setAttribute('aria-labelledby', 'bl-lc-title');
    dialog.innerHTML = `<header class="bl-lc-head"><h3 id="bl-lc-title"><i class="fa-solid fa-copy" aria-hidden="true"></i><span>로그 복사</span><small>메시지 ${model.messages.length}개</small></h3><div class="bl-lc-mode salty-mode-switch bl-lc-hd-mode" role="group" aria-label="밝기" data-lc-hd-mode>${['light', 'dark'].map(kind => `<button type="button" data-lc-mode="${kind}" aria-label="${kind === 'light' ? '화이트' : '나이트'}"><i class="fa-regular fa-${kind === 'light' ? 'sun' : 'moon'}" aria-hidden="true"></i></button>`).join('')}</div><button type="button" class="salty-btn bl-lc-icon" data-lc="close" aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
        <div class="bl-lc-scroll">
            <div class="bl-lc-band" role="status" data-lc-retired hidden></div>
            <div class="bl-lc-tl" data-lc-tl><div class="salty-seg bl-screen-chips bl-lc-cats" role="group" aria-label="분류" data-lc-cats></div><button type="button" class="salty-btn bl-lc-icon bl-lc-tl-all" data-lc="cats-all" aria-expanded="false" aria-label="분류 전부 보기"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button></div>
            <div class="bl-lc-cr" data-lc-cr><div class="bl-lc-chips bl-chip-row" role="radiogroup" aria-label="모양" data-lc-shapes></div><button type="button" class="bl-lc-chip bl-lc-cr-more" data-lc="shapes-all" aria-label="틀 전부 보기" hidden></button></div>
            <div class="bl-lc-band bl-lc-empty" data-lc-empty hidden><span>아직 받은 글꾸가 없어요. <b>글꾸 마트</b>에서 마음에 드는 틀을 크게 보고 <b>테마용 복사</b>를 누른 뒤, 여기에 붙여 넣어 받아요.</span><span class="bl-lc-band-go"><a class="salty-btn" href="${esc(MART_GEULKKU)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-store" aria-hidden="true"></i><span>마트 열기</span></a><button type="button" class="salty-btn" data-lc="paste"><i class="fa-solid fa-paste" aria-hidden="true"></i><span>붙여 넣기</span></button></span></div>
            <div class="bl-lc-mine" data-lc-mine hidden></div>
            <div class="bl-lc-gallery" data-lc-gallery hidden><textarea rows="3" placeholder="이미지 코드(&lt;img …&gt;)나 이미지 주소를 붙여 넣어요" aria-label="갤러리 사진 코드" data-lc-images></textarea><span class="bl-lc-note" data-lc-images-count></span></div>
            <div class="bl-lc-colors" data-lc-colors><div class="bl-lc-mode salty-mode-switch" role="group" aria-label="밝기">${['light', 'dark'].map(kind => `<button type="button" data-lc-mode="${kind}" aria-label="${kind === 'light' ? '화이트' : '나이트'}"><i class="fa-regular fa-${kind === 'light' ? 'sun' : 'moon'}" aria-hidden="true"></i></button>`).join('')}</div><button type="button" class="bl-lc-chip bl-lc-flip" data-lc="flip" aria-pressed="false" aria-label="낮 · 밤 전환 넣기"><i class="fa-regular fa-sun" aria-hidden="true"></i><i class="fa-regular fa-moon" aria-hidden="true"></i><span>전환 넣기</span></button><div class="bl-lc-pals bl-chip-row" role="radiogroup" aria-label="색" data-lc-pals></div></div>
            <div class="bl-lc-note bl-lc-flip-note" role="status" data-lc-flip-note hidden></div>
            <div class="bl-lc-easy" role="group" aria-label="조절 — 간편 · 세밀" data-lc-easy hidden></div>
            <div class="bl-lc-inks bl-chip-row" role="group" aria-label="글자색 — 눌러서 바꿔요" data-lc-inks hidden></div>
            <div class="bl-lc-tools bl-chip-row" role="group" aria-label="글 도구"><button type="button" class="bl-lc-chip" data-lc="hide" aria-pressed="false"><i class="fa-solid fa-user-secret" aria-hidden="true"></i><span>이름 숨김</span></button><button type="button" class="bl-lc-chip" data-lc="words" aria-pressed="false"><i class="fa-solid fa-right-left" aria-hidden="true"></i><span>바꾸기</span><small data-lc-words-count></small></button><button type="button" class="bl-lc-chip" data-lc="fields" aria-pressed="false" title="제목 · 날짜 · 깡통 · 모델 · 프롬프트 칸을 글칸으로 고쳐요"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span>머리 칸</span></button><button type="button" class="bl-lc-chip" data-lc="spoiler" disabled title="미리보기에서 글을 고르면 눌러요"><i class="fa-solid fa-eye-slash" aria-hidden="true"></i><span>숨기기</span></button><button type="button" class="bl-lc-chip" data-lc="wrap" aria-pressed="false" title="본문 줄바꿈 — 켜면 단어 단위 · 끄면 글자 단위(기본)"><i class="fa-solid fa-text-width" aria-hidden="true"></i><span>단어 단위 줄바꿈</span></button></div>
            <div class="bl-lc-sep" aria-hidden="true">로그 꾸밈</div>
            <div class="bl-lc-folds" data-lc-folds>
                <section class="bl-lc-fd" data-lc-fd="shows"><button type="button" class="bl-lc-fd-h" data-lc-fold="shows" aria-expanded="false"><b>보일 것</b><span data-lc-fd-sum></span><mark data-lc-fd-mark hidden></mark><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><div class="bl-lc-shows bl-chip-row" role="group" aria-label="보일 것 — 끄면 빼요" data-lc-shows>${SHOWS.map(([key, icon, label, title]) => `<button type="button" class="bl-lc-chip" data-lc-show="${key}" aria-pressed="true" title="${esc(title)}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${esc(label)}</span></button>`).join('')}<button type="button" class="bl-lc-chip" data-lc-lemon aria-pressed="false" title="켜면 틀의 빈 모서리에 작은 레몬을 넣어요 — 누르면 블루레몬에이드 소개 글이 새 창으로 열려요"><i class="fa-solid fa-lemon" aria-hidden="true"></i><span>레몬 바로가기</span></button><button type="button" class="bl-lc-chip" data-lc-lemon-at hidden title="레몬 자리 — 누를 때마다 자동 · 왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래"><i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i><span>자동</span></button><button type="button" class="bl-lc-chip" data-lc-height hidden title="틀 높이 — 누를 때마다 자동(글 길이만큼) · 작게 · 중간 · 크게(틀 안에서 넘겨요)"><i class="fa-solid fa-up-down" aria-hidden="true"></i><span>높이 · 자동</span></button></div></section>
                <section class="bl-lc-fd" data-lc-fd="fields"><button type="button" class="bl-lc-fd-h" data-lc-fold="fields" aria-expanded="false"><b>머리 칸</b><span data-lc-fd-sum></span><mark data-lc-fd-mark hidden></mark><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><div class="bl-lc-fields" data-lc-fields hidden>${FIELD_INPUTS.map(([key, label, hint]) => `<label class="bl-lc-field"><span>${esc(label)}</span><input type="text" maxlength="${key === 'title' ? 80 : 60}" placeholder="${esc(hint)}" data-lc-field="${key}"></label>`).join('')}</div></section>
                <section class="bl-lc-fd" data-lc-fd="names"><button type="button" class="bl-lc-fd-h" data-lc-fold="names" aria-expanded="false"><b>이름 가리기</b><span data-lc-fd-sum></span><mark data-lc-fd-mark hidden></mark><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><button type="button" class="bl-lc-sw" role="switch" data-lc-sw="hide" aria-checked="false"><span>이름 숨김<small>채팅 캡처의 이름 가림과 같은 목록이에요</small></span><i aria-hidden="true"></i></button><div class="bl-lc-names" data-lc-names hidden><div class="bl-lc-np-r" role="group" aria-label="가릴 이름"><span class="bl-lc-np-h">가릴 이름</span><div class="bl-lc-np-list"><div class="bl-lc-name-list" data-lc-name-list></div><span class="bl-lc-np-add"><input type="text" maxlength="40" placeholder="이름 더하기" aria-label="더 가릴 이름" data-lc-name-input><button type="button" class="salty-btn bl-lc-icon" data-lc="name-add" aria-label="가릴 이름 더하기"><i class="fa-solid fa-plus" aria-hidden="true"></i></button></span></div></div><div class="bl-lc-np-r" role="group" aria-label="대신 보일 말" data-lc-mask-row></div></div></section>
                <section class="bl-lc-fd" data-lc-fd="words"><button type="button" class="bl-lc-fd-h" data-lc-fold="words" aria-expanded="false"><b>글자 바꾸기</b><span data-lc-fd-sum></span><mark data-lc-fd-mark hidden></mark><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><button type="button" class="bl-lc-sw" role="switch" data-lc-sw="words" aria-checked="false"><span>바꾸기<small>본문의 말을 다른 말로 바꿔 복사해요</small></span><i aria-hidden="true"></i></button><div class="bl-lc-words" data-lc-words hidden><div data-lc-rules></div><button type="button" class="salty-btn bl-lc-add-rule" data-lc="rule-add"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>줄 더하기</span></button></div></section>
                <section class="bl-lc-fd" data-lc-fd="wrap"><button type="button" class="bl-lc-fd-h" data-lc-fold="wrap" aria-expanded="false"><b>줄바꿈</b><span data-lc-fd-sum></span><mark data-lc-fd-mark hidden></mark><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><button type="button" class="bl-lc-sw" role="switch" data-lc-sw="wrap" aria-checked="false"><span>단어 단위로 줄바꿈<small>끄면 글자 단위(기본)</small></span><i aria-hidden="true"></i></button></section>
            </div>
            <div class="bl-lc-hint" data-lc-hint><i class="fa-solid fa-eye-slash" aria-hidden="true"></i><span>눌러야 보이는 글: 미리보기에서 글을 끌어 고르면 바로 옆에 <b>눌러야 보이게</b>가 떠요</span><button type="button" class="bl-lc-chip" data-lc-sw="spoiler" aria-pressed="false" disabled title="미리보기에서 글을 고르면 눌러요"><span>숨기기</span></button></div>
            <div class="bl-lc-more"><button type="button" class="bl-lc-chip" data-lc="more" aria-expanded="false"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i><span>더 보기</span></button></div>
            <div class="bl-lc-pick" data-lc-pick hidden><span>로그 넣을 곳을 눌러요</span><button type="button" class="salty-btn" data-lc="auto">자동으로</button></div>
            <div class="bl-lc-stk" data-lc-stk>
            <div class="bl-lc-bar" data-lc-bar><b class="bl-lc-ph">미리보기</b><span class="bl-lc-ph bl-lc-bar-name" data-lc-stage-name></span><span class="bl-lc-note"><i class="fa-solid fa-pen" aria-hidden="true"></i> 미리보기 글씨를 눌러 바로 고쳐요</span><button type="button" class="salty-btn bl-lc-icon bl-lc-edit" data-lc="edit" aria-pressed="false" aria-label="글 고치기" title="글 고치기 — 고칠 수 있는 글을 점선 칸으로 보여요(소품 안 글자까지)" hidden><i class="fa-solid fa-i-cursor" aria-hidden="true"></i><span>글 고치기</span></button><button type="button" class="salty-btn bl-lc-icon" data-lc="undo" aria-label="되돌리기" title="되돌리기 (지운 블록도 돌아와요)" disabled><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button><button type="button" class="salty-btn bl-lc-icon" data-lc="redo" aria-label="다시하기" title="다시하기" disabled><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button><button type="button" class="salty-btn bl-lc-icon bl-lc-ph" data-lc="stage-size" aria-pressed="false" aria-label="미리보기 크게" title="미리보기 크게"><i class="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true"></i></button><button type="button" class="salty-btn bl-lc-icon bl-lc-ph" data-lc="stage-fold" aria-expanded="true" aria-label="미리보기 접기" title="미리보기 접기"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button></div>
            <div class="bl-lc-stage" data-lc-stage><div class="bl-lc-egg" data-lc-egg hidden>✨ 장식을 눌러 보세요</div><iframe sandbox="allow-same-origin" title="미리보기 — 글자를 눌러 바로 고쳐요" data-lc-frame></iframe></div>
            </div>
            <div class="bl-lc-paste" data-lc-paste hidden><p class="bl-lc-note">글꾸 마트에서 틀을 크게 보고 <b>테마용 복사</b>를 누른 뒤 여기에 붙여 넣고 <b>받기</b>를 눌러요. 공유받은 글꾸 HTML 도 돼요.</p><div class="bl-lc-row"><a class="salty-btn" href="${esc(MART_GEULKKU)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-store" aria-hidden="true"></i><span>글꾸 마트 열기</span></a><button type="button" class="salty-btn bl-lc-mart" data-lc="mart"><i class="fa-solid fa-file-import" aria-hidden="true"></i><span>파일로 받기</span></button></div><textarea rows="8" placeholder="글꾸 마트에서 「테마용 복사」한 글이나 공유받은 글꾸 HTML 을 붙여 넣어요" aria-label="글꾸 HTML"></textarea><div class="bl-lc-msg" role="status" aria-live="polite" data-lc-paste-msg hidden></div><div class="bl-lc-row"><button type="button" class="salty-btn" data-lc="paste-cancel">취소</button><button type="button" class="salty-btn bl-tool-primary" data-lc="paste-save">받기</button></div></div>
            ${CODE_HTML}
        </div>
        <footer class="bl-lc-foot">${GUIDE_HTML}<button type="button" class="salty-btn" data-lc="md" title="틀 · 색 없이 글만 마크다운으로"><i class="fa-solid fa-align-left bl-lc-ph" aria-hidden="true"></i><span class="bl-lc-long">글만 복사</span><span class="bl-lc-ph">글만</span></button><button type="button" class="salty-btn" data-lc="download" title="보이는 모양 그대로 .html 파일로 받아요"><i class="fa-solid fa-download bl-lc-ph" aria-hidden="true"></i><span class="bl-lc-long">내려받기</span><span class="bl-lc-ph">파일로</span></button>${CODE_BUTTON}<button type="button" class="salty-btn bl-tool-primary" data-lc="copy" title="보이는 모양 그대로(틀 · 색 · 글꼴) HTML 로"><i class="fa-solid fa-copy" aria-hidden="true"></i> HTML 복사</button></footer>`;
    document.body.append(dialog);
    const $ = selector => dialog.querySelector(selector);
    const frame = $('[data-lc-frame]');
    const selBar = createSelectBar({ host: dialog });   // 11-12 미리보기에서 글을 고르면 바로 옆에 뜨는 막대 — 버튼은 아래 frame.onload 의 selBar.watch
    // 1.1.0 칩 줄(모양 · 분류 · 색 · 글자색 · 가릴 이름 · 바꾸기 줄)은 누를 때마다 innerHTML 로 다시 그려요 — 누른 칩에 있던 초점이 함께 사라져 body 로 떨어지면
    //   키보드 · 화면 읽기 사용자는 창 맨 앞부터 다시 Tab 해야 했어요. 다시 그린 줄에서 같은 열쇠(data-*)의 칩으로 초점을 돌려줘요 ·
    //   그 칩이 없어졌으면(지운 내 글꾸 · 뺀 이름 · 지운 줄) 같은 줄의 고른 칩이나 첫 단추로
    const FOCUS_KEYS = ['data-lc-easy', 'data-lt', 'data-lt-i', 'data-lt-color', 'data-lt-tab', 'data-lt-sum', 'data-lc-view', 'data-shape', 'data-lc-del', 'data-cat', 'data-palette', 'data-lc-mode', 'data-lc-ink', 'data-lc-name-remove', 'data-lc-rule-remove', 'data-lc-pv', 'data-lc-pvar', 'data-lc'];
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
    const custom = () => store().custom.find(c => c.id === state.shape) ?? (pk.mod ? pk.mod.pickEntry(pk.picks, store().custom, state.shape, store) : null);   // 1.1.8 추천 글꾸도 받은 글꾸와 같은 꼴(조절 값은 logCopy.pickSet)
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
        const mine = custom(); if (!mine?.template) return null; const k = templateColors(mine.colors); return { ...k, raised: k.panel2 };
    };
    // 1.1.4 「간편」(설계 4-2) — 받은 심플 글꾸에서만: 스타일(추천 여섯) · 움직임(끔 · 약 · 중 · 강) · 글 크기(작게 · 보통 · 크게). 밤낮은 밝기 칩 · 색은 인물표 색.
    //   값은 그 글꾸의 set 하나(설정에 남아요) · 조절 모듈(needSet)을 받은 뒤에 보여요.
    const drawEasy = keepFocus(() => {
        const box = $('[data-lc-easy]'), mine = custom(), on = !!mine?.frame && !!setMod;
        box.hidden = !on;
        dialog.classList.toggle('bl-lc-tuned', on);   // 1.1.6 폰: 조절 칸 아래 「로그 꾸밈」 나눔 줄
        if (!on) { box.replaceChildren(); return; }
        const e = setMod.easyOf(mine.set), level = Object.fromEntries(setMod.EASY_MOTION);
        const chip = (key, label, pressed, off = false) => `<button type="button" class="bl-lc-chip" data-lc-easy="${esc(key)}" aria-pressed="${pressed}"${off ? ' disabled' : ''}><span>${esc(label)}</span></button>`;
        const row = (label, chips, note = '') => `<div class="bl-lc-easy-row" role="group" aria-label="${esc(label)}"><span class="bl-lc-easy-h">${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><div class="bl-lc-easy-chips">${chips}</div></div>`;
        needFine();
        if (fine.hold) return;   // 슬라이더를 끄는 동안은 칸을 다시 그리지 않아요(미리보기만)
        // 1.1.5 간편 | 세밀 — 색 · 질감 줄과 세밀 갈래는 조절 화면 모듈(fineMod)이 그려요. 값은 같은 set 하나
        const mode = modeOf(state.palette), caps = capRow(mine.frame.key), more = fineMod ? fineMod.easyExtra(mine.set, mine.frame, mode, caps, { castKnown: state.castKnown !== false }) : null;
        const view = fineMod && fine.view === 'fine' ? 'fine' : 'easy';
        const tabs = more ? `<div class="bl-lc-view" role="group" aria-label="조절 단계"><button type="button" data-lc-view="easy" aria-pressed="${view === 'easy'}">간편</button><button type="button" data-lc-view="fine" aria-pressed="${view === 'fine'}">세밀${more.total ? `<b>${more.total}</b>` : ''}</button></div>` : '';
        if (view === 'fine') {
            const at = new Map([...box.querySelectorAll('.bl-lt-chips')].map((strip, i) => [i, strip.scrollLeft]));
            box.innerHTML = tabs + fineMod.fineHtml(mine.set, mine.frame, { mode, open: fine.open, tab: fine.tab, caps, castKnown: state.castKnown !== false });
            [...box.querySelectorAll('.bl-lt-chips')].forEach((strip, i) => { if (at.get(i)) strip.scrollLeft = at.get(i); });
            return;
        }
        box.innerHTML = tabs + row('스타일', setMod.LOOKS.map(x => chip(`style:${x.id}`, x.label, e.style === x.id)).join(''), e.style ? '' : '직접 조절')
            + (more?.color ?? '')
            // 11-12: 이 틀이 못 받는 세기는 흐려요(마트 간편 줄과 같게) — 전엔 약 · 중 · 강이 늘 켜져 있어 눌러도 미리보기 · 복사 글이 그대로인 틀이 28틀 중 20틀이었어요
            + (({ can, note }) => row('움직임', setMod.EASY_MOTION.map(([v, l]) => chip(`motion:${v}`, l, e.motion === v, !can(v))).join('') + (more ? `<button type="button" class="bl-lc-chip" data-lc-view="motion" aria-pressed="${!!e.apart}" title="글 움직임과 소품 움직임을 따로 골라요"><span>따로</span></button>` : ''), e.apart ? `글 ${level[e.apart.text]} · 소품 ${level[e.apart.prop]}` : note))(fineMod ? fineMod.easyMotion(more?.motion) : { can: () => true, note: '' })
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
        if (s2.custom.length >= CUSTOM_MAX) { toastr.warning(`내 글꾸는 ${CUSTOM_MAX}개까지예요 — 칩 옆 ✕ 로 하나 지우고 다시 눌러요`, '', { timeOut: 2500 }); return; }
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
    const hideList = () => withNameAliases([model.chatName, model.charName, ...model.messages.map(m => m.name), model.userName, ...tools().names].filter(Boolean));   // 1.1.8 캐릭터 카드 이름(charName — 「깡통」 칸 기본값)도
    /** 1.1.6 저절로 가리는 이름(내 이름 먼저 · 말한 사람 · 대화 이름 — 더한 이름 · 별명 빼고) — 이름 가림 상자에 보여요 */
    const autoNames = () => { const added = new Set(tools().names); return [...new Set([model.userName, ...model.messages.map(m => m.name), model.chatName].map(n => String(n ?? '').trim()).filter(Boolean))].filter(n => !added.has(n)); };
    /** 가린 이름 대신 보일 말(가림 글자 · 모자이크 · 색 칸) */
    const maskLabel = () => { const ct = tools(); return ct.mask === 'auto' ? ct.maskWord || '○○' : ct.mask === 'mosaic' ? '▒▒' : '색 칸'; };
    // 1.0.1 미리보기에서 고친 글 거두기: 메시지 수가 같을 때만, 글이 실제로 달라진 메시지의 노드만 바꿔요(안 고친 메시지는 그림 · 링크 · 글자 꾸밈이 있는 원래 노드)
    const textOf = nodes => (nodes || []).map(n => n.t === 'text' ? n.text : n.t === 'br' ? '\n' : textOf(n.children)).join('');
    const harvest = () => {
        if (!state.dirty) return;
        state.dirty = false;
        const doc = frame.contentDocument;
        if (!doc?.body) return;
        // 1.0.7: 원래 글이 아니라 막 그린 미리보기 글과 견줘요 — 이름 숨김 · 바꾸기가 켜져 있거나 틀이 글자를 바꾸면
        // 손대지 않은 메시지도 원래 글과 달라 서식 없는 미리보기 노드로 갈아 끼워졌어요(분류 · 모양 칩을 누르면 대사 색 · 기울임이 사라짐)
        // 1.1.8 받은 심플 글꾸도: [data-bl-msg] 대신 줄 표지 주석으로 묶어요(log-copy-spoiler.js harvestEdits · previewModel)
        const next = harvestEdits(previewModel(doc), state.edited ?? model, state.drawnTexts, state.drawnMarks);
        if (next) state.edited = next;
    };
    // 1.0.7 「↶ 되돌리기 · ↷ 다시하기」(글꾸 마트 시식 창과 같은 길) — 미리보기 HTML 스냅샷 · 다시 그리면 새로 시작(그 전에 고친 것은 거둬 이어져요)
    const hist = { stack: [], at: -1, timer: 0 };
    // 1.2.0 글 고치기 중에도 되돌리기는 이 한 줄(고친 차례 그대로)만 써요 — 편집 모듈의 칸 단위 되돌리기와 섞으면 차례가 뒤바뀌고 「되돌린 것」이 새 칸으로 쌓여 세 번째부터 거꾸로 갔어요
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
        const opened = [...doc.body.querySelectorAll('details:not([data-bl-spoiler])')].map(d => d.open);   // 눌러 연 소품은 되돌려도 연 채(고치던 글이 도로 접히지 않게)
        doc.body.innerHTML = hist.stack[next];
        [...doc.body.querySelectorAll('details:not([data-bl-spoiler])')].forEach((d, i, all) => { if (all.length === opened.length && opened[i]) d.open = true; });
        if (eb) { eb.refresh(); syncProps(); }   // 11-12 되돌린 문서에 칸 번호 · 점선 칸을 다시 · 소품 고친 글도 그 글로
        state.dirty = true;
        state.spoilerRange = null;
        readFields(doc);
        drawHist();
    };
    /** 미리보기의 칸(data-f) → state.fields · 머리 칸 글칸 */
    const readFields = (doc) => {
        // 1.2.0 꺼 둔 제목 칸은 안 읽어요(빈 글이 제목으로 저장돼 다시 켜도 · 다른 틀에서도 비었어요) · 칸 안 숨긴 글은 알약 글 · 흐린 사본을 빼고 읽어요
        const off = store().titleOff;
        const words = (el) => { if (!el.querySelector('[data-bl-spoiler]')) return el.textContent; const c = el.cloneNode(true); for (const x of c.querySelectorAll('summary')) x.remove(); return c.textContent; };
        for (const element of doc.querySelectorAll('[data-f]')) if ((!basicOn() || element.getClientRects().length) && !(off && element.getAttribute('data-f') === 'title')) setField(element.getAttribute('data-f'), words(element));   // 1.1.3 기본 글꾸 새 틀은 같은 칸이 칩 · 정보 줄 두 곳에 있어요 — 보이는 쪽만 읽어요
        for (const input of dialog.querySelectorAll('[data-lc-field]')) if (document.activeElement !== input) input.value = fieldOf(input.dataset.lcField);
        rememberBlank();
        drawFolds();
    };
    // 11-12 「글 고치기」 — 글꾸 마트와 같은 공용 편집 모듈(geulkku-mart/edit-blocks.js — 마트 사본): 고칠 칸을 점선 칸으로 한꺼번에 · 누르면 그 자리에서 · 소품 전 · 후.
    //   틀 뿌리(.gk — 받은 심플 글꾸 · 기본 글꾸 새 틀)가 있는 미리보기에서만 단추가 보여요. 켜면 문서 전체 편집(designMode)을 끄고 칸만 고쳐요 · 끄면 예전처럼.
    //   나눠 맡기: 메시지 줄(로그 칸 .gk-lg · .lg · data-bl-msg)과 제목 · 숨은 줄(data-f)은 「고친 글 거두기」(harvest · readFields)가,
    //   그 밖의 소품 안 글(견출지 · 도장 · 영수증 · 팻말 …)은 여기 state.ed.texts 가 맡아요 — 다시 그려도 넣고, 복사 글은 미리보기 그대로라 같이 들어가요.
    //   소품 글 열쇠 = 그 틀의 소품 칸 차례(p0 · p1 …) — 로그 글 길이 · 이름 숨김이 바뀌어도 같아요. 틀을 바꾸면 비워요(이번 창에만).
    let edMod = null, edLoading = null, eb = null;
    const needEd = () => (edMod ? Promise.resolve(edMod) : (edLoading ??= import('./geulkku-mart/edit-blocks.js').then(m => (edMod = m), () => { edLoading = null; return null; })));
    const editRoot = doc => doc?.body?.querySelector(':scope > .gk, :scope > * > .gk') ?? null;
    const OWNED = '.gk-lg, .lg, [data-f], [data-bl-msg], [data-bl-slot]';   // 고친 글 거두기 몫(메시지 · 제목 · 숨은 줄)
    const propCells = () => [...(eb ? frame.contentDocument?.body?.querySelectorAll('[data-bl-pk]') ?? [] : [])].map(el => [el.dataset.blPk, el]);   // 열쇠는 막 그렸을 때 붙여요(armEdit) — 글을 다 지운 칸이 칸 목록에서 빠져도 뒤 칸 열쇠가 안 밀려요(되돌린 문서에도 그대로 · 복사 글에서는 걷어요)
    /** 소품 칸 글을 원래(그린 그대로)와 견줘 기억 — 같아지면(되돌림) 지워요 */
    const syncProps = () => { for (const [key, el] of propCells()) { const now = el.innerHTML, orig = state.ed.orig.get(key); if (now === orig) { if ((state.ed.texts.get(key)?.was ?? orig) === orig) state.ed.texts.delete(key); } else state.ed.texts.set(key, { html: now, was: state.ed.texts.get(key)?.was ?? orig }); } };   // was: 고치기 전 그 칸 글 — 다시 그렸을 때 같은 칸인지 봐요
    const drawEdit = () => { const b = $('[data-lc="edit"]'); b.setAttribute('aria-pressed', String(!!state.ed.on && !!eb)); b.setAttribute('aria-label', state.ed.on ? '글 고치기 끝내기' : '글 고치기'); b.title = state.ed.on ? '글 고치기 끝내기 — 점선 칸을 거둬요' : '글 고치기 — 고칠 수 있는 글을 점선 칸으로 보여요(소품 안 글자까지)'; };
    /** 막 그린 미리보기에 편집 모듈을 걸어요: 칸 번호 → 소품 고친 글 다시 넣기 → (켜 둔 채면) 점선 칸 · 고른 소품 단계 */
    const armEdit = (doc) => {
        eb = null;
        const root = editRoot(doc), button = $('[data-lc="edit"]');
        button.hidden = !root;
        if (!root) { drawEdit(); return; }
        if (!edMod) { needEd().then(m => { if (m && frame.contentDocument === doc && !eb) { armEdit(doc); resetHist(doc); } }); drawEdit(); return; }
        if (state.ed.shape !== state.shape) { state.ed.shape = state.shape; state.ed.texts = new Map(); state.ed.step = null; }
        eb = edMod.createEditBlocks(doc.body, { label: '소품', onStep: (k) => { state.ed.step = k; } });
        eb.refresh();
        eb.slots().filter(el => !el.closest(OWNED)).forEach((el, k) => { el.dataset.blPk = `p${k}`; });
        const cells = propCells();
        state.ed.orig = new Map(cells.map(([key, el]) => [key, el.innerHTML]));
        // 고친 글은 「고치기 전 글이 같은 칸」에만 다시 넣어요 — 보일 것 · 이름 숨김으로 소품 칸 수가 달라져 차례가 밀려도 다른 칸에 들어가지 않게(같은 차례가 아니면 그 글을 가진 칸이 하나일 때만 옮겨요)
        const elOf = new Map(cells), placed = new Map();
        for (const [key, t] of state.ed.texts) {
            let at = state.ed.orig.get(key) === t.was ? key : null;
            if (!at) { const same = cells.filter(([k]) => state.ed.orig.get(k) === t.was && !state.ed.texts.has(k) && !placed.has(k)); if (same.length === 1) at = same[0][0]; }
            if (at) { elOf.get(at).innerHTML = t.html; placed.set(at, t); } else if (!placed.has(key)) placed.set(key, t);
        }
        state.ed.texts = placed;
        if (!doc.getElementById('bl-lc-ed-css')) { const s = doc.createElement('style'); s.id = 'bl-lc-ed-css'; s.textContent = '.bl-eb-on summary [data-bl-ed],.bl-eb-on figcaption [data-bl-ed]{-webkit-user-select:text!important;user-select:text!important}'; doc.head.append(s); }   // 틀이 소품 요약 칸(summary)의 글 고르기를 막아 둬요(누르면 소품이 움직이게) — 고치는 동안만 풀어요(head 라 복사 글에 안 가요)
        if (state.ed.on) editOn(doc);
        drawEdit();
    };
    /** 점선 칸 켜기: 문서 전체 편집을 끄고 칸만 · 고른 소품 단계 그대로 */
    const editOn = (doc) => { doc.designMode = 'off'; eb.setOn(true); if (state.ed.step != null) eb.setStep(state.ed.step); };
    /** 고른 자리가 든 「글 고치기」 칸(한 칸 안일 때만 · 머리 칸 빼고) — 굵게 · 기울임은 이 칸 안에서만(테마 · 마트 같은 규칙) */
    const edCell = (range) => {
        if (!(eb && state.ed.on) || !range) return null;
        const at = range.startContainer, cell = (at.nodeType === 1 ? at : at.parentElement)?.closest?.('[data-bl-ed][contenteditable="true"]');
        return cell && cell.contains(range.endContainer) && !cell.closest('[data-f]') ? cell : null;   // 제목 · 머리 칸(data-f)은 글자만 기억해요 — 꾸밈을 넣어도 다시 그리면 풀리니 단추를 안 내요
    };
    /** 칸 안 굵게 · 기울임 — 마트처럼 태그(<b> · <i>)로 넣어요(style 을 단 span 이면 그 칸이 고칠 칸 규칙에서 빠져요) */
    const edFormat = (doc, cell, cmd) => {
        try { doc.execCommand('styleWithCSS', false, false); } catch { /* 옛 브라우저 */ }
        doc.execCommand(cmd);
        // 이미 굵은(기울인) 글에 누르면 브라우저가 풀려고 style 을 단 span 을 넣어요 — 칸 규칙(속성 없는 꾸밈 태그만)을 지키게 그런 껍데기는 벗겨요(가린 이름 · 숨긴 글은 그대로)
        for (const el of [...cell.querySelectorAll('*')]) if (!(['B', 'I', 'STRONG', 'EM', 'S', 'BR'].includes(el.tagName) && !el.attributes.length) && !el.hasAttribute('data-bl-mask') && !el.closest('[data-bl-spoiler]')) el.replaceWith(...el.childNodes);
        cell.dispatchEvent(new InputEvent('input', { bubbles: true }));
    };
    /** 복사 · 내려받기 직전: 점선 칸 · 전 · 후 막대 · 멈춘 소품 단계를 걷은 채로 fn — 끝나면 다시 켜요 */
    const editOffFor = (fn) => {
        const on = !!(eb && state.ed.on), step = eb?.step;
        if (on) eb.setOn(false);
        try { return fn(); } finally { if (on && frame.contentDocument) { eb.setOn(true); if (step != null) eb.setStep(step); } }
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
        const target = custom() || toneOn() || basicOn() ? null : paletteFor(state.shape, state.palette);   // 1.1.3 기본 글꾸 새 틀도 대사색을 그대로 읽어요   // 1.1.3 깡통 로그 틀 묶음은 로그의 대사색을 그대로 읽어요(에이드 색으로 다시 칠하지 않아요)
        if (target && target !== nowPalette()) out.model = recolorLog(out.model, tokensOf(nowPalette()), tokensOf(target));
        out.model = wrapModel(out.model, store().wrap);
        if (wrapMode(store().wrap) === 'char') out.model = { ...out.model, messages: out.model.messages.map(m => (m.name ? { ...m, nameStyle: { ...m.nameStyle, 'word-break': 'keep-all' } } : m)) };   // 글자 단위여도 이름 줄은 낱말째(「틀 없이」 이름 줄은 바탕을 물려받아요)   // 11-13 메시지 글(인라인 글자 모양)의 줄바꿈 — 채팅 화면은 keep-all 이라 그대로 뜨면 단어 단위였어요
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
        drawFolds();
    };
    // 1.1.6 폰 화면(시안 (나)): 「보일 것 · 이름 가리기 · 글자 바꾸기 · 머리 칸」 접는 갈래 — 접힌 머리에 지금 상태를 적어요(펴지 않아도 무엇이 켜졌는지 보여요).
    //   PC 에서는 갈래 상자가 없어 줄이 예전 그대로예요(.bl-lc-fd 는 display:contents · 머리는 숨김). 펼침은 이번 창에만 기억해요.
    const drawFolds = () => {
        const ct = tools(), head = id => $(`[data-lc-fd="${id}"]`);
        const put = (id, sum, mark = '', on = false) => {
            const fd = head(id), m = fd.querySelector('[data-lc-fd-mark]');
            fd.querySelector('[data-lc-fd-sum]').textContent = sum;
            m.textContent = mark; m.hidden = !mark; m.classList.toggle('is-on', on);
        };
        const off = [...dialog.querySelectorAll('[data-lc-show]')].filter(c => !c.disabled && !c.hidden && c.getAttribute('aria-pressed') === 'false' && !(basicOn() && c.dataset.lcShow === 'tagsOff')).map(c => c.querySelector('span').textContent);
        put('shows', off.length ? `뺀 것 ${off.join(' · ')}` : '전부 보여요', off.length ? `뺌 ${off.length}` : '');
        const autos = autoNames(), all = autos.length + ct.names.length;
        put('names', ct.redact ? `${autos[0] || ct.names[0] || '이름'}${all > 1 ? ` 외 ${all - 1}` : ''} → ${maskLabel()}` : '꺼짐', ct.redact ? '켬' : '', true);
        const rules = ct.replaceRules.filter(r => r.from.trim());
        put('words', ct.replace ? (rules.map(r => `${r.from} → ${r.to}`).join(' · ') || '줄 없음') : '꺼짐', ct.replace ? '켬' : '', true);
        put('fields', ['title', 'date', 'char'].map(fieldOf).map(v => String(v).trim()).filter(Boolean).join(' · ') || '비어 있어요');
        put('wrap', wrapMode(store().wrap) === 'word' ? '단어 단위' : '글자 단위 (기본)');   // 11-13 접힌 머리에 지금 줄바꿈
        for (const fd of dialog.querySelectorAll('[data-lc-fd]')) { const on = !!state.folds[fd.dataset.lcFd]; fd.classList.toggle('is-open', on); fd.querySelector('[data-lc-fold]').setAttribute('aria-expanded', String(on)); }
    };
    const drawTools = keepFocus(() => {
        const ct = tools();
        $('[data-lc="hide"]').setAttribute('aria-pressed', String(ct.redact));
        $('[data-lc="words"]').setAttribute('aria-pressed', String(ct.replace));
        $('[data-lc-sw="hide"]').setAttribute('aria-checked', String(ct.redact));
        $('[data-lc-sw="words"]').setAttribute('aria-checked', String(ct.replace));
        { const word = wrapMode(store().wrap) === 'word'; $('[data-lc="wrap"]').setAttribute('aria-pressed', String(word)); $('[data-lc-sw="wrap"]').setAttribute('aria-checked', String(word)); }   // 11-13 줄바꿈(PC 칩 · 폰 알약 스위치)
        const rules = ct.replaceRules.filter(r => r.from.trim()).length;
        $('[data-lc-words-count]').textContent = rules ? String(rules) : '';
        $('[data-lc-names]').hidden = !ct.redact;
        $('[data-lc-words]').hidden = !ct.replace;
        // 1.1.6 이름 가림 상자(11-12 사용자가 고른 폰 시안 (나) — PC 도 같이): 「가릴 이름」 = 저절로 가리는 이름(말한 사람 · 내 이름) + 더한 이름 · 「대신 보일 말」 = 가림 글자 칸 + 보기.
        //   전엔 「[깡캐] 으로 가려요」 — 받침 없는 말 뒤에도 「으로」였고, 무엇을 가리는지는 안 보였어요
        const autos = autoNames(), more = autos.length > 6 ? autos.length - 6 : 0;
        $('[data-lc-name-list]').innerHTML = autos.slice(0, 6).map(name => `<span class="bl-lc-tag">${esc(name)}${name === model.userName ? '<small>내 이름</small>' : ''}</span>`).join('') + (more ? `<span class="bl-lc-tag">외 ${more}</span>` : '')
            + ct.names.map((name, i) => `<button type="button" class="bl-lc-chip bl-lc-name" data-lc-name-remove="${i}" aria-label="${esc(name)} 빼기"><span>${esc(name)}</span><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`).join('');
        const maskRow = $('[data-lc-mask-row]');
        if (!maskRow.querySelector('input:focus')) maskRow.innerHTML = `<span class="bl-lc-np-h">대신 보일 말</span>${ct.mask === 'auto' ? `<input type="text" class="bl-lc-maskword" maxlength="12" value="${esc(ct.maskWord || '○○')}" aria-label="가린 이름 대신 보일 말" title="본문 속 이름을 이 글자로 가려요" data-lc-maskword>` : `<span class="bl-lc-tag">${esc(maskLabel())}</span>`}<span class="bl-lc-np-ex">${esc(autos[0] || '이름')} → <b data-lc-mask-ex>${esc(maskLabel())}</b></span>`;
        drawFolds();
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
        $('[data-lc-cats]').innerHTML = catList.map(c => `<button type="button" class="${state.category === c.id ? 'on' : ''}" aria-pressed="${state.category === c.id}" data-cat="${c.id}">${esc(c.label)}</button>`).join('');
        const presetChips = order.map((id) => {
            const p = PRESETS.find(x => x.id === id);
            const on = state.shape === id;
            const mark = p.emoji ? `<span class="bl-lc-emoji" aria-hidden="true">${p.emoji}</span>` : `<i class="fa-solid ${p.icon}" aria-hidden="true"></i>`;
            return `<button type="button" class="bl-lc-chip" role="radio" aria-checked="${on}" data-shape="${id}">${mark}<span>${esc(p.label)}</span>${s2.fav.includes(id) ? '<i class="fa-solid fa-star bl-lc-fav" aria-label="즐겨찾기"></i>' : ''}</button>`;
        }).join('');
        // 1.1.8 「블루레몬 추천」: 묶음마다 칩 하나 · 같은 이름 판이 여럿이면 옆 둥근 꺾쇠로 판 고르기(펼치면 판 칩이 칩 바로 뒤에) · 접힌 줄에서는 지금 고른 추천 칩만
        const pickRow = !pk.mod ? '' : pk.mod.pickChips(pk.picks, s2.custom, s2.pickVar).filter(g => (less ? g.ids.includes(state.shape) : state.category === pk.mod.PICK_CATEGORY.id)).map((g) => {
            const cur = g.ids.includes(state.shape) ? state.shape : g.current, label = g.labels[g.ids.indexOf(cur)], many = g.ids.length > 1, open = many && state.pickOpen === g.group;
            return `<button type="button" class="bl-lc-chip" role="radio" aria-checked="${state.shape === cur}" data-shape="${esc(cur)}"><span class="bl-lc-emoji" aria-hidden="true">${esc(g.emoji)}</span><span>${esc(g.name)}</span>${many && label !== g.name ? `<small>${esc(label)}</small>` : ''}</button>`
                + (many ? `<button type="button" class="bl-lc-chip bl-lc-pv" data-lc-pv="${esc(g.group)}" aria-expanded="${open}" aria-label="${esc(g.name)} 판 고르기 — ${g.ids.length}가지" title="판 고르기"><i class="bl-lc-chev" aria-hidden="true"></i></button>` : '')
                + (open ? g.ids.map((id, i) => `<button type="button" class="bl-lc-chip bl-lc-pvi" aria-pressed="${id === cur}" data-lc-pvar="${esc(id)}">${esc(g.labels[i])}</button>`).join('') : '');
        }).join('');
        // 1.2.0 내 글꾸도 즐겨찾기 → 최근 → 받은 차례 · 별 표시. 길게 누르기는 모든 칩에서 즐겨찾기(전엔 내 글꾸만 「지울 준비」) · 지우기는 칩 옆 ✕ 로 바로(알림의 ↶ 로 되돌려요)
        const customChips = mineOrder(s2.custom, s2.fav, s2.recent).filter(c => shown.has(c.id)).map((c) => {
            const on = state.shape === c.id;
            // 1.0.1: 마트에서 받은 글꾸(template)는 🛒 표시
            const mart = c.template || c.frame ? '<span class="bl-lc-mart" aria-label="마트에서 받음" title="마트에서 받음">🛒</span>' : '';
            return `<button type="button" class="bl-lc-chip" role="radio" aria-checked="${on}" data-shape="${esc(c.id)}">${c.emoji ? `<span class="bl-lc-emoji" aria-hidden="true">${esc(c.emoji)}</span>` : '<i class="fa-solid fa-shapes" aria-hidden="true"></i>'}<span>${esc(c.name)}</span>${mart}${s2.fav.includes(c.id) ? '<i class="fa-solid fa-star bl-lc-fav" aria-label="즐겨찾기"></i>' : ''}</button>`
                + `<button type="button" class="bl-lc-chip bl-lc-x" data-lc-del="${esc(c.id)}" aria-label="${esc(c.name)} 지우기" title="지우기 — 지운 뒤 알림의 ↶ 로 되돌려요"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
        }).join('');
        // 1.1.8 접힌 줄에도 내 글꾸 입구 — 받은 것이 없으면 붙여 넣기 칸(안내 · 마트 열기)으로 · 있으면 펼쳐 「내 글꾸」 분류로(전엔 접힌 줄에 글꾸를 얻는 길이 없었어요)
        const mineN = s2.custom.length;
        const take = `<button type="button" class="bl-lc-chip bl-lc-add" data-lc="take" title="${mineN ? '받은 글꾸 보기' : '글꾸 마트에서 받은 글꾸를 붙여 넣어요'}"><i class="fa-solid fa-${mineN ? 'shapes' : 'plus'}" aria-hidden="true"></i><span>내 글꾸</span>${mineN ? `<small>${mineN}</small>` : ''}</button>`;
        const room = s2.custom.length >= MINE_MAX ? ' is-full' : '';   // 1.2.0 「+ 내 글꾸 n/20」
        $('[data-lc-shapes]').innerHTML = presetChips + pickRow + customChips + (less ? take : `<button type="button" class="bl-lc-chip bl-lc-add${room}" data-lc="paste" title="${room ? '꽉 찼어요 — 칩 옆 ✕ 로 하나 지우면 새로 받아요' : '글꾸 마트에서 받은 글꾸를 붙여 넣어요'}"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>내 글꾸</span><small>${s2.custom.length}/${MINE_MAX}</small></button>`)
            + (state.allShapes ? '<button type="button" class="bl-lc-chip bl-lc-ghost" data-lc="shapes-all" aria-expanded="true"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i><span>접기</span></button>' : '');   // 1.1.6 폰: 전부 펼친 틀 줄 끝 「접기」
        const strip = $('[data-lc-shapes]'), cats = $('[data-lc-cats]');
        $('[data-lc-cr]').classList.toggle('is-all', state.allShapes);
        $('[data-lc-tl]').classList.toggle('is-all', state.allCats);
        { const b = $('[data-lc="cats-all"]'); b.setAttribute('aria-expanded', String(state.allCats)); b.setAttribute('aria-label', state.allCats ? '분류 접기' : '분류 전부 보기'); b.querySelector('i').className = `fa-solid fa-chevron-${state.allCats ? 'up' : 'down'}`; }
        requestAnimationFrame(() => { revealTab(strip, strip.querySelector('[aria-checked="true"]')); applyFade(strip); revealTab(cats, cats.querySelector('.on')); applyFade(cats); fitShapes(); });
        drawRetired();
        $('[data-lc-empty]').hidden = less || state.category !== 'mine' || mineN > 0;   // 1.1.8 빈 「내 글꾸」 안내
        drawMine(less);
        const preset = PRESETS.find(x => x.id === state.shape);
        $('[data-lc-gallery]').hidden = !preset?.images;
        $('[data-lc-images-count]').textContent = preset?.images ? `사진 ${(model.images?.length ?? 0) + state.images.length}장` : '';
    });
    // 1.2.0 「내 글꾸」 분류 줄 아래 한 줄: 「내 글꾸 n/20」(꽉 차면 할 일) · 고른 글꾸의 받은 날 · 판 · 손길 안내
    const drawMine = (less) => {
        const row = $('[data-lc-mine]'), s2 = store(), n = s2.custom.length;
        row.hidden = less || state.category !== 'mine' || !n;
        if (row.hidden) { row.replaceChildren(); return; }
        const count = countLine(n), mine = custom(), info = mine ? infoLabel(mine) : '';
        row.classList.toggle('is-full', count.full);
        row.innerHTML = `<b>${esc(count.text)}</b>${info ? `<span>「${esc(mine.name)}」 ${esc(info)}</span>` : ''}${count.full ? '' : '<span>길게 누르면 즐겨찾기 · ✕ 는 지우기</span>'}`;
    };
    // 1.2.0 내 글꾸 지우기(칩 옆 ✕) — 바로 지우고 알림의 ↶ 로 되돌려요. 고른 글꾸였으면 깡통 로그로
    const dropMine = (id) => {
        const s2 = store(), name = s2.custom.find(c => c.id === id)?.name ?? '내 글꾸', was = state.shape === id;
        const undo = removeMine(s2, id);
        if (!undo) return;
        if (was) { state.shape = TONE_SHAPES[0]; state.picking = false; }
        saveSettings();
        drawShapes(); drawColors(); if (was) draw();
        const note = toastr.info(`「${name}」를 지웠어요 — ↶ 를 누르면 되돌려요`, '내 글꾸', { timeOut: 8000 });
        attachUndo(note, () => {
            const s3 = store();
            if (!restoreMine(s3, undo)) { toastr.warning(s3.custom.length >= MINE_MAX ? `내 글꾸가 꽉 차서(${MINE_MAX}/${MINE_MAX}) 되돌리지 못했어요` : '같은 글꾸를 그새 다시 받아서 되돌릴 것이 없어요', '내 글꾸', { timeOut: 4000 }); return; }
            saveSettings();
            if (!dialog.isConnected) return;
            const back = was && state.shape === TONE_SHAPES[0];   // 그새 다른 틀을 골랐으면 그 틀 그대로
            if (back) { state.shape = id; state.category = 'mine'; }
            drawShapes(); drawColors(); if (back) draw();
        });
    };
    // 1.1.6 폰: 옆으로 넘치는 틀 줄에 「+n」(줄 밖에 남은 칩 수 · 누르면 감싸 펼침) — 줄을 다시 그릴 때 한 번만 재요(스크롤마다 재지 않아요)
    const fitShapes = () => {
        const row = $('[data-lc-cr]'), strip = $('[data-lc-shapes]'), pill = $('.bl-lc-cr-more');
        const phone = !!globalThis.matchMedia?.(PHONE).matches;
        row.classList.remove('is-over');   // 검토 11-12: 지난번 넘침 여백(오른쪽 64px)을 빼고 재요 — 그대로 재면 들어맞는 줄도 계속 넘친다고 봤어요
        const over = phone && state.more && !state.allShapes && strip.scrollWidth > strip.clientWidth + 2;
        row.classList.toggle('is-over', over);
        pill.hidden = !over;
        if (!over) return;
        const edge = strip.getBoundingClientRect().right - 64;
        const n = [...strip.querySelectorAll(':scope > [data-shape], :scope > [data-lc="paste"]')].filter(c => c.getBoundingClientRect().right > edge).length;   // 틀 칩만(내 글꾸 옆 ✕ 는 그 칩의 일부)
        pill.textContent = n ? `+${n}` : '전부';
    };
    // 1.1.3 「더 보기」: 접힘은 창 class 하나(bl-lc-less)로 — 접힌 줄은 그대로 그려 두고 숨기기만 해요(펼치면 고르던 것 그대로)
    const drawMore = () => {
        dialog.classList.toggle('bl-lc-less', !state.more);
        const button = $('[data-lc="more"]');
        button.setAttribute('aria-expanded', String(state.more));
        button.querySelector('i').className = `fa-solid fa-chevron-${state.more ? 'up' : 'down'}`;
        button.querySelector('span').textContent = state.more ? '접기' : '더 보기';
    };
    // 1.1.8 뺀 옛 내장 글꾸 띠 — 깡통 로그로 그리는 동안 · 닫거나(✕ — 저장해요) 새 판을 받거나 다른 틀로 복사할 때까지 남아요
    const drawRetired = () => {
        const band = $('[data-lc-retired]'), on = !!retired && state.shape === RETIRED_FALLBACK && !store().retiredOff;
        band.hidden = !on;
        if (!on) { band.replaceChildren(); return; }
        const name = esc(retired.retired.name);
        band.innerHTML = retired.tell
            ? `<span><b>「${name}」 글꾸는 이제 글꾸 마트에 있어요.</b> 마트에서 새 판을 <b>테마용 복사</b>로 복사해 붙여 넣으면 이어서 써요. 지금은 깡통 로그로 보여 드려요.</span><span class="bl-lc-band-go"><a class="salty-btn" href="${esc(`${PAGES}/mart/geulkku/?view#${encodeURIComponent(retired.tell)}`)}" target="_blank" rel="noopener noreferrer" data-lc-retired-go><i class="fa-solid fa-store" aria-hidden="true"></i><span>새 판 보기</span></a><button type="button" class="salty-btn" data-lc="paste"><i class="fa-solid fa-paste" aria-hidden="true"></i><span>붙여 넣기</span></button></span>`
            : `<span><b>「${name}」 글꾸는 이제 없어요.</b> 마트에도 새 판이 없어 깡통 로그로 보여 드려요.</span>`;
        band.insertAdjacentHTML('beforeend', '<button type="button" class="salty-btn bl-lc-icon bl-lc-band-x" data-lc="retired-x" aria-label="안내 닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>');
    };
    // 「전환 넣기」 켬끔(밝기 옆) — 낮 · 밤 두 판 규칙이 다 있는 갈래(블루레몬 추천 · 받은 심플 글꾸 · 기본 글꾸 새 틀)에서만 켜져요. 그린 뒤 flipPlan 이 한 번 더 확인해요(log-copy-flip.js)
    //   못 다는 글꾸(깡통 로그 틀 · 에이드 색 틀 · 옛 마트 글꾸 · 붙여 넣은 HTML)와 깡통 글 하나 크기를 넘는 글은 흐리게 + 까닭 한 줄. 색을 뒤집어 지어내지 않아요.
    const flipCan = () => simpleOn() || basicOn();
    const flipOn = () => state.flipLive && !!state.flipPlan && !!flipMod;   // 지금 미리보기에 알약이 얹혀 있고 복사 글에 전환이 실리는가
    const flipFull = text => (flipOn() ? flipMod.flipCopy(text) ?? text : text);   // 내려받기 문서에도 같은 전환(문서 글 통째로 넘겨도 틀 뿌리를 찾아 달아요)
    const drawFlip = () => {
        const chip = $('[data-lc="flip"]'), note = $('[data-lc-flip-note]'), plan = state.flipPlan;
        const none = !flipCan() || (state.flipDrawn && !plan), over = !none && !!plan?.over, off = none || over;
        const on = state.flip && !off;
        if (!off) state.flipWhy = false;
        const why = none ? FLIP_NONE : over ? flipMod.flipNote(plan) : '';
        chip.setAttribute('aria-pressed', String(on));
        chip.setAttribute('aria-disabled', String(off));
        chip.title = off ? why : '복사 글에 해 · 달 단추를 넣어요 — 읽는 사람이 낮 · 밤을 바꿔 봐요';
        const text = off ? (state.flip || state.flipWhy ? why : '') : on && plan ? flipMod.flipNote(plan) : '';
        note.hidden = !text;
        note.textContent = text;
        $('[data-lc-colors]').classList.toggle('bl-lc-flip-idle', off && !state.flip && !state.flipWhy);   // 폰: 쓸 수 없고 켜 두지도 않았으면 줄을 늘리지 않아요
    };
    // ② 색 칩 — 테마 「색」 화면의 에이드 카드(.salty-pal) 그대로, 작게
    const drawColors = keepFocus(() => {
        const mode = modeOf(state.palette);
        const plain = !!custom() && !simpleOn();   // 내 글꾸는 에이드 색 칩이 없어요(1.1.4 받은 심플 글꾸는 밝기만)
        $('[data-lc-colors] > .bl-lc-mode').hidden = plain;   // 내 글꾸(옛 마트 글꾸 · 붙여 넣은 HTML)는 밝기 · 색 칩이 없어요 — 이 줄에는 「전환 넣기」(흐림)만 남아요
        $('[data-lc-hd-mode]').hidden = plain;   // 1.1.6 폰: 밝기는 머리 줄로(색 칩 줄에는 에이드 카드만)
        $('[data-lc-colors]').classList.toggle('bl-lc-pal-off', plain || toneOn() || basicOn() || simpleOn());
        drawFlip();
        if (plain) { $('[data-lc-pals]').hidden = true; $('[data-lc-pals]').replaceChildren(); return; }
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

    /** 「숨기기」 칩 둘(도구 줄 · 1.1.6 폰 안내 줄)을 같이 — 미리보기에서 글을 골라야 켜져요 · 숨긴 글 안이면 「풀기」 */
    const spoilerChips = (off, inside) => {
        for (const chip of dialog.querySelectorAll('[data-lc="spoiler"], [data-lc-sw="spoiler"]')) { chip.disabled = off; chip.setAttribute('aria-pressed', String(inside)); chip.querySelector('span').textContent = inside ? '풀기' : '숨기기'; }
    };
    // 1.1.6 폰: 미리보기 크게 · 작게(이 탭 동안 기억) · 접기(이번 창만)
    const drawStage = () => {
        dialog.classList.toggle('bl-lc-big', stageBig);
        const size = $('[data-lc="stage-size"]'), fold = $('[data-lc="stage-fold"]'), shut = dialog.classList.contains('bl-lc-shut');
        size.setAttribute('aria-pressed', String(stageBig)); size.setAttribute('aria-label', stageBig ? '미리보기 작게' : '미리보기 크게'); size.title = size.getAttribute('aria-label');
        size.querySelector('i').className = `fa-solid fa-${stageBig ? 'down-left-and-up-right-to-center' : 'up-right-and-down-left-from-center'}`;
        size.disabled = shut;
        fold.setAttribute('aria-expanded', String(!shut)); fold.setAttribute('aria-label', shut ? '미리보기 펴기' : '미리보기 접기'); fold.title = fold.getAttribute('aria-label');
        fold.querySelector('i').className = `fa-solid fa-chevron-${shut ? 'down' : 'up'}`;
    };
    // ③ 미리보기 (눌러서 고침)
    const pageBg = () => (own()?.bg ?? (custom() || (state.shape === 'plain' && state.palette === nowPalette()) ? getComputedStyle(dialog).backgroundColor : colorsOf(paletteFor(state.shape, state.palette)).bg));
    const draw = () => {
        harvest();
        handoffReset();   // 1.2.0 복사한 글 · 보던 코드는 바꾸기 전 모양이에요
        $('[data-lc-stage-name]').textContent = PRESETS.find(p => p.id === state.shape)?.label ?? custom()?.name ?? '';   // 1.1.6 폰: 미리보기 머리에 틀 이름
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
        if (mine?.frame) {   // 11-12 캐릭터 색(인물표 · 화면 대사색 · 고른 화자 색)을 모르면 「소품도 캐릭터 색」은 그림을 안 바꿔요 — 칩을 흐려요(바뀌면 조절 칸만 다시)
            const known = castLetters(speakerLetters(shown.model, { main: mine.frame.main, second: mine.frame.second, lookup }), mine.frame, mine.set?.themeCast).main != null;
            if (known !== (state.castKnown !== false)) { state.castKnown = known; drawEasy(); }
        }
        let again = null;   // 같은 글을 다른 밝기로 한 번 더 그리는 길(「전환 넣기」가 낮 판 · 밤 판을 견줘요) — 받은 심플 글꾸 · 기본 글꾸 새 틀만
        if (mine?.frame) { needSet(); again = mode => renderLog(shown.model, { simple: mine, setMod, caps: capRow(mine.frame.key), mode, lookup, fields: { ...fields, ...(s3.titleOff ? { title: '' } : {}) }, names: !s3.namesOff, lemonLink: !!s3.lemonLink, rows: true }); html = again(toneMode); }   // 1.1.4 받은 심플 글꾸(제목 끄기는 칸을 비워서) · 1.1.8 rows: 고친 글을 거둘 줄 표지(복사 때 걷어요)
        else if (rawOf(mine)) html = mine.html;
        else if (basicOn()) { again = mode => renderLog(shown.model, { shape: state.shape, fields: { ...fields, ...(s3.titleOff ? { title: '' } : {}), ...(s3.dateOff ? { date: '' } : {}) }, images: shown.rewriteImages(state.images), names: !s3.namesOff, lemonLink: !!s3.lemonLink, mode, lookup, info: s3.basicInfo, height: s3.basicHeight, marks: true }); html = again(toneMode); }   // 1.1.3 기본 글꾸 새 틀(제목 · 날짜 끄기는 칸을 비워서 — 틀이 그 줄째 빼요)
        else html = renderLog(shown.model, { shape: state.shape, colors: state.shape === 'plain' ? null : colorsOf(paletteFor(state.shape, state.palette)), ui, fields: drawFields, images: shown.rewriteImages(state.images), screen: tokensOf(nowPalette()), template: inkTemplate() ?? mine, names: !s3.namesOff, lemonLink: !!s3.lemonLink, mode: toneMode, lookup });
        if ((!mine || mine.template) && !toneNow && !basicOn()) { const full = html; html = fitBare(full, bareLog(full, { top: s3.topOff, bottom: s3.bottomOff, drop })); }   // 1.0.7 위 글 · 아래 글 · 칸 빼기 → 글을 덮게 된 장식 걷기
        // 1.1.3 깡통 로그 틀 묶음: 붙인 뒤 덮일 글자색(바탕 대비 4.6 아래)은 그릴 때 밝기만 맞춰요 — 미리보기와 복사 글이 같게
        if (toneNow) html = siteCheck(html, { mode: toneMode }).html;
        html = wrapHtml(html, store().wrap);   // 11-13 틀 <style> 의 본문 줄바꿈을 고른 값으로(미리보기 = 복사 글) — 제목 · 이름표 · 소품 글자는 틀 그대로
        // 「전환 넣기」: 켜 뒀고 두 판이 있는 갈래면 반대 밝기로 한 번 더 그려(줄바꿈도 같은 값으로) 견주고(뿌리 class 만 달라야 해요) 전환 계획을 세워요 — 못 세우면 전환 없이 예전 그대로
        state.flipPlan = null; state.flipDrawn = false; state.flipLive = false;
        if (state.flip && flipMod && again) {
            try { state.flipPlan = flipMod.flipPlan({ now: html, other: wrapHtml(again(toneMode === 'light' ? 'dark' : 'light'), store().wrap), mode: toneMode, full: liftForCopy(mine?.frame ? stripRowMarks(html) : html, motionStyleFor(html)).full }); } catch { state.flipPlan = null; }
            state.flipDrawn = true;
        }
        drawFlip();
        $('[data-lc-pick]').hidden = !(rawOf(mine) && (state.picking || !mine.slot));
        // 1.2.0 눌러야 글이 나오는 소품(닫힌 채 시작하는 details): 미리보기에서 눌러 연 것은 「미리보기로만 연 것」(data-bl-peek)이라 복사 글에서는 닫힌 채로 가고,
        //   조절 · 밝기로 다시 그려도 같은 틀이면 연 채로 둬요(전엔 칩을 누를 때마다 글이 도로 접혀 소품을 또 눌러야 했고, 연 채 복사하면 붙인 글이 열린 채 시작했어요)
        const PROP = 'details:not([data-bl-spoiler])';
        const held = state.propShape === state.shape && frame.contentDocument?.body ? [...frame.contentDocument.body.querySelectorAll(PROP)].map(d => d.open) : null;
        state.propShape = state.shape;
        frame.onload = () => {
            const doc = frame.contentDocument;
            if (!doc) return;
            [...doc.body.querySelectorAll(PROP)].forEach((d, i, all) => { if (d.open) return; d.setAttribute('data-bl-peek', ''); if (held?.length === all.length && held[i]) d.open = true; });
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
            const fresh = previewModel(doc)?.messages ?? [];
            state.drawnMarks = fresh.map(m => nodesMark(m.nodes));   // 1.2.0 글자는 그대로 두고 굵게 · 기울임만 바꿔도 다시 그릴 때 남게
            state.drawnTexts = fresh.map(m => textOf(m.nodes).trim());   // 1.0.7 거둘 때 견줄 「막 그린 글」
            const syncSpoiler = () => {
                const sel = doc.getSelection();
                const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
                const inside = range ? spoilerAt(range) : null;
                state.spoilerRange = range && (inside || !range.collapsed) ? range.cloneRange() : null;
                const chip = $('[data-lc="spoiler"]');
                const wasOff = chip.disabled;
                spoilerChips(!state.spoilerRange, !!inside);
                // 폰(384)은 칩 줄이 가로로 넘쳐 「숨기기」가 줄 밖에 있어요(1.0.1 「깡통 · 모델 · 프롬프트」 칩이 앞에 들어옴) — 켜질 때 칩 줄만 옆으로 밀어 보여요(본문 세로 스크롤은 그대로)
                if (wasOff && !chip.disabled) {
                    const row = chip.parentElement, r = chip.getBoundingClientRect(), box = row.getBoundingClientRect();
                    if (r.right > box.right) row.scrollLeft += r.right - box.right + 16;
                    else if (r.left < box.left) row.scrollLeft -= box.left - r.left + 16;
                }
            };
            doc.addEventListener('selectionchange', syncSpoiler);
            syncSpoiler();
            // 11-12 고른 글 옆 막대: 「숨기기」 칩과 같은 길(칩을 눌러요 — 되돌리기 한 칸 · 다시 그릴 때 이어짐 그대로)
            //   평소엔 「눌러야 보이게 / 숨김 풀기」 하나만(사용자 「굵게랑 기울임은 왜 있는 거임?」) — 굵게 · 기울임은 「글 고치기」 모드에서 한 칸 안을 골랐을 때만(edCell · 테마 · 마트 · 폰 · PC 같은 규칙)
            const reselect = (range) => { const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(range); };
            selBar.watch(doc, {
                frame,
                caret: range => !!spoilerAt(range),   // 숨긴 글을 누르기만 해도 「숨김 풀기」
                buttons: (range) => (spoilerAt(range)
                    ? [{ id: 'unhide', label: '숨김 풀기', main: true, title: '숨김 풀기 — 다시 바로 보이는 글로', run: (r) => { reselect(r); syncSpoiler(); $('[data-lc="spoiler"]').click(); } }]
                    : [{ id: 'hide', label: '눌러야 보이게', main: true, title: '숨기기 — 고른 글을 눌러야 보이는 글로', run: (r) => { reselect(r); syncSpoiler(); $('[data-lc="spoiler"]').click(); } },
                        ...(edCell(range) ? [['bold', '굵게', '굵게(Ctrl+B)'], ['italic', '기울임', '기울임(Ctrl+I)']].map(([id, label, title]) => ({ id, label, title, run: (r) => { const cell = edCell(r); if (cell) { reselect(r); edFormat(doc, cell, id); } } })) : [])]),
            });
            doc.designMode = 'on';
            try { doc.execCommand('styleWithCSS', false, true); } catch { /* 옛 브라우저 */ }
            // 1.0.8 장식(data-bl-egg)을 누를 땐 편집을 잠깐 꺼요 — 문서 전체가 편집 모드라 폰에서 장식을 눌러도 자판이 올라오고 편집으로 넘어가 움직임이 안 보였어요(사용자 제보)
            let eggTimer = 0;
            doc.addEventListener('pointerdown', (event) => {
                if (!event.target?.closest?.('[data-bl-egg]')) return;
                doc.designMode = 'off';
                clearTimeout(eggTimer);
                eggTimer = setTimeout(() => { if (eb && state.ed.on) return; doc.designMode = 'on'; try { doc.execCommand('styleWithCSS', false, true); } catch { /* 옛 브라우저 */ } }, 900);
            }, true);
            doc.addEventListener('input', () => {
                state.dirty = true;   // 1.0.1 고친 글은 다음 그리기 전에 거둬 틀을 바꿔도 이어요
                if (eb) syncProps();   // 11-12 소품 안 고친 글(글 고치기 칸 · 문서 편집 둘 다 — 칸 단위 되돌리기도 input 을 내요)
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
                if (event.key === 'Escape') { if (state.ed.on && event.target?.closest?.('[data-bl-ed]')) return; dialog.close(); return; }   // 11-12 글 고치기 칸 안 Esc 는 그 칸만 고치기 전으로(편집 모듈)
                const key = event.key.toLowerCase();
                const ed = !!(eb && state.ed.on);
                if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { if (ed) return; event.preventDefault(); if (!doc.execCommand('insertLineBreak')) doc.execCommand('insertHTML', false, '<br>'); }   // 글 고치기 중 Enter = 칸 끝내기(편집 모듈)
                else if (ed && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && (key === 'b' || key === 'i')) { const cell = edCell(doc.getSelection()?.rangeCount ? doc.getSelection().getRangeAt(0) : null); if (cell) { event.preventDefault(); edFormat(doc, cell, key === 'b' ? 'bold' : 'italic'); } }
                else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z') { event.preventDefault(); travel(-1); drawHist(); }
                else if ((event.ctrlKey || event.metaKey) && (key === 'y' || (event.shiftKey && key === 'z'))) { event.preventDefault(); travel(1); drawHist(); }
            });
            // 11-12 글 고치기: 소품 요약 칸(summary) 안 칸을 눌러도 소품이 열리고 닫히지 않게(고른 전 · 후 단계 그대로) · 칸을 끝내면 되돌리기 단추를 다시
            doc.addEventListener('click', (event) => { if (state.ed.on && eb && event.target?.closest?.('summary:not(.blsp-h)')) event.preventDefault(); }, true);
            //   소품 덮개(견출지 접힌 귀 · 겉면 …)가 칸 위에 떠 있으면 누름이 덮개에 닿아요 — 누른 자리 아래의 고칠 칸을 찾아 그 칸에 커서를 놓아요
            doc.addEventListener('mousedown', (event) => {
                if (!(state.ed.on && eb) || event.button !== 0 || event.target?.closest?.('[data-bl-ed], .bl-eb-steps')) return;
                const cell = doc.elementsFromPoint(event.clientX, event.clientY).map(el => el.closest('[data-bl-ed][contenteditable="true"]')).find(Boolean);
                if (!cell) return;
                event.preventDefault();
                cell.focus();
                const sel = doc.getSelection(); sel.selectAllChildren(cell); sel.collapseToEnd();
            }, true);
            doc.addEventListener('focusout', () => setTimeout(drawHist, 0));
            // 「전환 넣기」: 틀 앞에 해 · 달 알약 한 줄(복사 글과 같은 모양 · 자리) — 누르면 뿌리의 낮밤 class 만 바꿔 반대 판을 미리 봐요. 살아 있는 글은 그대로라 고친 글 거두기 · 글 고치기 · 되돌리기는 예전 길이에요
            if (state.flipPlan && !state.flipPlan.over && editRoot(doc)) {
                flipMod.flipArm(doc, editRoot(doc), state.flipPlan);
                state.flipLive = true;
                doc.addEventListener('click', (event) => {
                    if (!event.target?.closest?.('[data-bl-dn] .gkt-t')) return;
                    event.preventDefault(); event.stopPropagation();
                    if (flipOn() && editRoot(doc)) flipMod.flipPress(doc, editRoot(doc), state.flipPlan);
                }, true);
            }
            armEdit(doc);
            resetHist(doc);
        };
        $('[data-lc-egg]').hidden = !/\sdata-bl-egg="/.test(html);   // 1.0.1 누르면 반응하는 장식이 있는 틀: 미리보기 머리에 한 줄
        frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>html{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}${motionCss()}${toneNow ? sitePreviewCss(toneMode) : ''}</style></head><body style="margin:0;padding:12px;background-color:${esc(pageBg())};-webkit-text-size-adjust:100%;overflow-wrap:anywhere">${html}</body></html>`;
    };

    /** 미리보기에 보이는 그대로(고친 것 포함) — 소독하고 고치기 표시를 걷은 HTML (marks: 표시를 남겨요 — 편집용 꼴이 메시지 · 이름 · 칸 자리를 찾아요) */
    const result = (opts = {}) => editOffFor(() => resultNow(opts));   // 11-12 글 고치기 점선 칸 · 전 · 후 막대 · 멈춘 소품은 걷고(소품은 켜기 전 열림으로) 읽어요
    const resultNow = ({ marks = false } = {}) => {
        const doc = frame.contentDocument;
        if (!doc?.body) return '';
        // 글자색 굳히기: 미리보기에서 고친 글 · 숨긴 글 · 내 글꾸까지 (붙인 곳의 바탕 · 글자색 · <style> 이 무엇이든 안 보이는 글자 0 — 사용자 규칙) — pinColors
        const pin = !basicOn() && !flipOn();   // 전환을 싣는 글은 글자색을 인라인으로 굳히지 않아요 — 굳히면 읽는 사람이 밤 판으로 바꿔도 글자가 낮 색 그대로예요(색은 틀 <style> 의 낮 · 밤 규칙이 맡아요 · 기본 글꾸 새 틀과 같은 길)
        const live = !pin ? null : [...doc.body.querySelectorAll('[style], strong, em, b, i, s, span')].map(el => [el, el.getAttribute('style')]);   // 1.2.0 굳힌 색은 사본에만 남겨요 — 살아 있는 미리보기에 남으면 「글 고치기」가 굵게 · 기울임 든 줄을 칸으로 못 잡았어요
        if (pin) pinColors(doc.body, frame.contentWindow);   // 1.1.3 기본 글꾸 새 틀은 글자색을 틀 <style> 이 color + fill 로 맡아요(인라인으로 굳히면 탭 · 도장 누름의 글자색 바뀜이 멈춰요)
        const body = doc.body.cloneNode(true);
        if (flipOn()) flipMod.flipStrip(body, state.flipPlan);   // 미리보기 알약 줄은 걷고 틀은 처음 판으로 — 전환은 맨 끝(copyPack)에서 공용 함수가 달아요
        if (live) { const had = new Map(live); for (const el of doc.body.querySelectorAll('[style]')) { const was = had.get(el); if (was === undefined || was === null) el.removeAttribute('style'); else if (el.getAttribute('style') !== was) el.setAttribute('style', was); } }
        // 1.0.9+ 미리보기로만 펼친 상자(닫힌 채 시작하는 틀 · data-bl-peek)는 복사 글에서 다시 닫아요 — 붙인 곳에서는 닫힌 채 시작해 누르면 열려요
        for (const box of body.querySelectorAll('details[data-bl-peek]')) { box.removeAttribute('open'); box.removeAttribute('data-bl-peek'); }
        for (const el of body.querySelectorAll('[data-bl-ed], [data-bl-pk]')) { el.removeAttribute('data-bl-ed'); el.removeAttribute('data-bl-pk'); }   // 11-12 글 고치기 칸 번호 · 소품 칸 열쇠는 편집용 꼴(marks)에도 안 가요
        sanitizeTree(body, { keepPreviewMarks: marks });
        // 1.1.3 복사 직전 점검(깡통 로그 틀 묶음): 미리보기에서 고친 글 · 숨긴 글까지 덮일 글자색을 한 번 더 봐요(인라인 그림 주소 · overflow 는 원래 길 liftForCopy 가 옮기고 바꿔요)
        const html = simpleOn() ? stripRowMarks(body.innerHTML.trim()) : body.innerHTML.trim();   // 1.1.8 받은 심플 글꾸의 미리보기 표지(줄 주석 · 칸 표시)는 복사 글에 안 가요
        return toneOn() ? siteCheck(html, { mode: modeOf(state.palette) }).html : html;
    };

    /** 1.2.0 붙일 글 한 벌 — html: 서식(text/html) · code: 글(text/plain · 「HTML」 칸 · 「코드 보기」 칸) · 「HTML 복사」와 「코드 보기」가 같은 글을 써요 */
    const packPlain = () => {
        const shown = result();
        if (!shown) return null;
        // 1.0.1 글꾸 움직임 · 누르면 반응: 붙인 곳엔 테마 CSS 가 없어서 그 글꾸가 쓰는 키프레임만 맨 앞 <style> 로
        // 1.1.2 인라인 style 의 그림 주소(url)는 같은 <style> 의 클래스 규칙으로 — 커뮤니티 사이트가 인라인 url(&quot; 를 지워 그림이 사라졌어요(log-copy-lift.js)
        const lifted = liftForCopy(shown, motionStyleFor(shown));   // 1.1.2 위아래 코멘트 빈칸 · 코멘트 글줄 규칙까지
        const html = lifted.full;   // <style> 은 감싸는 요소 안 첫 자식
        // 1.0.1 서식(text/html)은 한 줄 그대로, 글(text/plain — HTML 칸 · 코드 편집기에 붙는 쪽)은 사람이 고치기 쉬운 꼴(줄 나눔 · 주석, 모양은 같아요 — log-copy-pretty.js) · 맨 앞 <style> 은 안내 주석 바로 아래
        const code = withCommentSlots(prettyLogHtml(insertHead(copyBody(result({ marks: true })).html, lifted.head), { label: PRESETS.find(p => p.id === state.shape)?.label ?? custom()?.name ?? '', head: '' }));
        return { html, code };
    };
    // 「전환 넣기」: 다 만든 글 두 벌에 같은 전환을 달아요(둘 다 달릴 때만 — 한쪽만 달린 글은 내지 않아요) · 꺼 두면 위에서 만든 글 그대로예요
    const copyPack = () => {
        const pack = packPlain();
        if (!pack || !flipOn()) return pack;
        const a = flipMod.flipCopy(pack.html), b = flipMod.flipCopy(pack.code);
        return a && b ? { html: a, code: b } : pack;
    };
    const mdText = () => {
        const fromPreview = frame.contentDocument ? previewModel(frame.contentDocument) : null;   // 미리보기에서 고친 글 · 숨긴 글까지
        return logMarkdown(fromPreview ?? view().model, { names: !store().namesOff });
    };
    // 1.2.0 붙이는 길(log-copy-handoff.js): 바닥 줄 안내 · 「코드 보기」 칸 — 모양을 바꿔 다시 그리면 평소로
    let handoff = 'idle';
    const tell = (kind) => { handoff = kind; guide(dialog, kind); };
    const codeBox = () => $('[data-lc-code]');
    const openCode = (text, options) => { handoff = 'code'; showCode(dialog, true, { text, ...options }); codeBox().scrollIntoView?.({ block: 'nearest' }); };
    const handoffReset = () => {
        if (handoff === 'idle') return;
        if (!codeBox().hidden) showCode(dialog, false);
        tell('idle');
    };

    const remember = () => {
        const s2 = store();
        s2.shape = state.shape;
        if (s2.retiredFrom && state.shape !== RETIRED_FALLBACK) { s2.retiredFrom = ''; s2.retiredOff = false; }   // 1.1.8 새 판이나 다른 틀로 복사했으면 옛 id 이어짐은 끝 · 깡통 로그로 복사했으면 기억해 둬요
        if (state.picked) s2.palette = state.palette;
        s2.category = state.category;
        if (PRESETS.some(p => p.id === state.shape) || s2.custom.some(c => c.id === state.shape)) s2.recent = [state.shape, ...s2.recent.filter(id => id !== state.shape)].slice(0, 5);   // 1.2.0 내 글꾸도 최근에
        saveSettings();
    };

    // 1.0.1 마트에서 가져오기 — 새 창으로 글꾸 마트 열기 · 붙여넣기 · 파일 (받은 글꾸는 「내 글꾸」로, 액자는 보관함으로)
    //   1.1.8 붙여 넣은 마트 글은 이 칸에서 바로 받아요(창을 하나 더 띄우지 않고 · 결과는 칸 안 글 · 받으면 알림). 마트 창은 「파일로 받기」에만 써요
    const apply = (fn) => { fn(getSettings()); saveSettings(); };
    /** 받은 글꾸 고르기 — 옛 내장 글꾸의 새 판이 들어 있으면 그것으로 이어요(띠도 끝) · @returns 이어 준 옛 이름 | '' */
    const received = (result) => {
        const back = retired?.retired.mart && result.geulkku.includes(retired.retired.mart) ? retired.retired.mart : '';
        const first = back || result.geulkku[0];
        if (!first) return '';
        if (back) { const s2 = store(); s2.retiredFrom = ''; s2.retiredOff = false; saveSettings(); }
        $('[data-lc-paste] textarea').value = '';
        showPaste(false);
        state.shape = first; state.category = 'mine'; state.picking = false; state.more = true;
        drawMore(); drawShapes(); drawColors(); draw();
        return back ? retired.retired.name : '';
    };
    const tellTaken = (head, lines, back) => {
        toastr.success(back ? `「${back}」 새 판으로 이어서 써요` : head, '내 글꾸', { timeOut: 4000 });
        if (lines.length) toastr.warning(lines.join(' · '), '덜 받은 것', { timeOut: 8000 });
    };
    const openMart = async (text) => {
        // 1.1.0 창 모듈을 못 받으면(연결 끊김 · 새 판 올라온 뒤 옛 조각) 누른 것이 조용히 끝났어요 — 설정 창 쪽처럼 알려요
        let openMartImport;
        try { ({ openMartImport } = await import('./mart-import-ui.js')); }
        catch (error) { toastr.error(`마트 창을 열지 못했어요 — ${error?.message || error}`, '마트에서 가져오기'); return; }
        openMartImport({ kind: 'geulkku', text, apply, done: (result) => { const back = received(result); if (result.geulkku.length) tellTaken(`글꾸 ${result.geulkku.length}개를 「내 글꾸」에 받았어요`, [], back); } });
    };
    /** 붙여 넣기 칸 안 결과 글(받지 못한 까닭 · 확인하는 중) */
    const pasteMsg = (head = '', bad = false, lines = []) => {
        const box = $('[data-lc-paste-msg]');
        box.hidden = !head;
        box.classList.toggle('is-bad', bad);
        box.innerHTML = head ? `<b>${esc(head)}</b>${lines.length ? `<ul>${lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}` : '';
    };
    const takeHere = async (raw) => {
        let takeMart;
        try { ({ takeMart } = await import('./mart-import-ui.js')); }
        catch (error) { console.warn('[Blue Lemonade] 글꾸 받기', error); pasteMsg('받는 기능을 불러오지 못했어요 — 연결을 확인하고 다시 눌러요', true); return; }
        const button = $('[data-lc="paste-save"]');
        button.disabled = true;
        try {
            const { head, lines, result } = await takeMart(raw, { apply, progress: line => pasteMsg(line) });
            if (!dialog.isConnected) return;
            if (result?.geulkku.length) { tellTaken(head, lines, received(result)); return; }
            if (result?.frames.length) { $('[data-lc-paste] textarea').value = ''; pasteMsg(`${head} — 설정 › 장식 액자 보관함에서 써요`, false, lines); return; }
            pasteMsg(head, true, lines);
        } finally { button.disabled = false; }
    };
    const showPaste = (on) => {
        if (on) handoffReset();
        $('[data-lc-paste]').hidden = !on;
        $('[data-lc-stage]').hidden = on;
        $('.bl-lc-foot').hidden = on;
        pasteMsg('');
        if (on) $('[data-lc-paste] textarea').focus();
    };

    // 길게 누르기: 모든 칩 = 즐겨찾기 별(1.2.0 내 글꾸도 — 전엔 내 글꾸만 「지울 준비」라 같은 손길이 칩마다 달랐어요)
    let hold = 0, held = false;
    $('[data-lc-shapes]').addEventListener('pointerdown', (event) => {
        const chip = event.target.closest('[data-shape]');
        held = false;
        clearTimeout(hold);
        if (!chip) return;
        hold = setTimeout(() => {
            const id = chip.dataset.shape, s2 = store();
            if (!PRESETS.some(p => p.id === id) && !s2.custom.some(c => c.id === id)) return;   // 추천 판은 즐겨찾기가 없어요 — 누름을 먹지 않고 평소처럼 골라요
            held = true;
            s2.fav = s2.fav.includes(id) ? s2.fav.filter(x => x !== id) : [...s2.fav, id];
            saveSettings();
            toastr.info(s2.fav.includes(id) ? '즐겨찾기에 넣었어요 — 그 분류 맨 앞에 와요' : '즐겨찾기에서 뺐어요', '', { timeOut: 1600 });
            drawShapes();
        }, HOLD_MS);
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) $('[data-lc-shapes]').addEventListener(type, () => clearTimeout(hold));
    $('[data-lc-shapes]').addEventListener('contextmenu', event => event.preventDefault());
    // 1.2.0 PC: 옆으로 넘기는 칩 줄(분류 · 틀 · 색 · 간편 칩) 위에서는 Shift 없이 휠로도 옆으로 넘어가요 — 줄 끝에 닿으면 평소처럼 창이 위아래로 굴러요
    dialog.addEventListener('wheel', (event) => {
        if (event.shiftKey || event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        const row = event.target.closest?.('.bl-chip-row, [data-lc-shapes], [data-lc-cats]');
        if (!row || row.scrollWidth <= row.clientWidth + 1) return;
        const before = row.scrollLeft;
        row.scrollLeft += event.deltaY;
        if (row.scrollLeft !== before) event.preventDefault();
    }, { passive: false });

    dialog.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target || !dialog.contains(target)) return;
        if (target.dataset.lcFold) {   // 1.1.6 폰: 접는 갈래 — 「머리 칸」 갈래는 펴면 칸이 보여요(PC 의 「머리 칸」 칩과 같은 상태)
            const id = target.dataset.lcFold;
            state.folds[id] = !state.folds[id];
            if (id === 'fields') { $('[data-lc-fields]').hidden = !state.folds[id]; drawShows(); } else drawFolds();
            return;
        }
        if (target.dataset.lcSw === 'spoiler') { $('[data-lc="spoiler"]').click(); return; }   // 1.1.6 폰 안내 줄의 「숨기기」 = 도구 줄 칩
        if (target.dataset.lcSw) { $(`[data-lc="${target.dataset.lcSw}"]`).click(); return; }   // 1.1.6 폰 갈래 스위치(이름 숨김 · 바꾸기) = 도구 줄 칩
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
        if (target.dataset.lcPv) { state.pickOpen = state.pickOpen === target.dataset.lcPv ? null : target.dataset.lcPv; drawShapes(); return; }   // 1.1.8 추천 묶음 옆 꺾쇠: 판 칩 펴기 · 접기
        if (target.dataset.lcPvar) {   // 1.1.8 판 고르기 — 고른 판을 기억하고(logCopy.pickVar) 그 판으로 그려요 · 판 칩은 접어요
            const id = target.dataset.lcPvar;
            if (!pk.mod?.choosePick(store, id)) return;
            state.shape = id; state.picking = false; state.pickOpen = null; state.category = catOf(id);
            saveSettings();
            drawShapes(); drawColors(); draw();
            requestAnimationFrame(() => $(`[data-shape="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }));
            return;
        }
        if (target.dataset.lcDel) { dropMine(target.dataset.lcDel); return; }   // 1.2.0 내 글꾸 칩 옆 ✕: 바로 지우고 알림의 ↶ 로 되돌려요(전엔 두 번 눌러 지우고 되돌릴 수 없었어요)
        if (target.dataset.shape) {
            if (held) { held = false; return; }
            const id = target.dataset.shape;
            state.shape = id;
            state.picking = false;
            state.category = catOf(id);
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
            case 'flip': {   // 「전환 넣기」 켬끔 — 흐린 채(못 다는 글꾸 · 너무 큰 글)로 누르면 까닭 줄을 열고 닫아요(켜 둔 채였으면 꺼요)
                if (target.getAttribute('aria-disabled') === 'true') { if (state.flip) { state.flip = false; flipSave(false); state.flipWhy = true; } else state.flipWhy = !state.flipWhy; drawFlip(); break; }
                const next = !state.flip;
                if (next && !(await needFlip())) { toastr.warning('전환 조각을 받지 못했어요 — 잠시 뒤 다시 켜 보세요', '로그 복사', { timeOut: 4000 }); break; }
                if (!dialog.isConnected) return;
                state.flip = next; flipSave(next);
                draw();
                break;
            }
            case 'cats-all': state.allCats = !state.allCats; drawShapes(); break;   // 1.1.6 폰: 분류 탭 전부 보기
            case 'shapes-all': {   // 1.1.6 폰: 틀 줄 「+n」 · 「접기」
                const held = document.activeElement === target;
                state.allShapes = !state.allShapes; drawShapes(); if (!state.allShapes) $('[data-lc-shapes]').scrollLeft = 0;
                // 검토 11-12: 누른 단추가 숨어(알약) · 다시 그려져(「접기」) 초점이 body 로 떨어졌어요 — 키보드 · 화면 읽기로 누른 것이면 짝 단추로(넘침을 다 잰 다음 프레임)
                if (held) requestAnimationFrame(() => (state.allShapes ? $('[data-lc-shapes] .bl-lc-ghost') : $('.bl-lc-cr-more:not([hidden])') ?? $('[data-lc-shapes] [aria-checked="true"]'))?.focus({ preventScroll: true }));
                break;
            }
            case 'stage-size': stageBig = !stageBig; drawStage(); break;
            case 'stage-fold': dialog.classList.toggle('bl-lc-shut'); drawStage(); break;
            case 'more': state.more = !state.more; drawMore(); drawShapes(); drawColors(); for (const strip of dialog.querySelectorAll('.bl-chip-row')) applyFade(strip); break;   // 1.1.3 더 보기 · 접기(미리보기는 다시 그리지 않아요)
            case 'ink-reset': state.inks = {}; draw(); break;
            case 'ink-save': saveInks(); break;
            case 'auto': { const mine = custom(); if (mine) { mine.slot = 'auto'; state.picking = false; saveSettings(); draw(); } break; }   // 'auto' = 고르지 않고 guessSlot 으로
            case 'paste': showPaste(true); break;
            case 'take': if (store().custom.length) { state.more = true; state.category = 'mine'; drawMore(); drawShapes(); drawColors(); } else showPaste(true); break;   // 1.1.8 접힌 줄의 「내 글꾸」
            case 'retired-x': { const s2 = store(); s2.retiredOff = true; saveSettings(); drawRetired(); $('[data-lc-shapes] [aria-checked="true"]')?.focus({ preventScroll: true }); break; }   // 1.1.8 띠 닫기(다음에 열어도 닫힌 채 · 옛 id 이어짐은 그대로)
            case 'paste-cancel': showPaste(false); break;
            case 'mart': openMart(''); break;
            case 'paste-save': {
                const raw = $('[data-lc-paste] textarea').value.trim();
                if (!raw) { pasteMsg('붙여 넣은 글이 없어요 — 글꾸 마트에서 「테마용 복사」를 누른 뒤 여기에 붙여 넣어요', true); return; }
                if (/^\{/.test(raw)) { await takeHere(raw); return; }   // 1.0.1 마트에서 복사한 글(JSON) · 1.1.8 이 칸에서 바로 받아요(덜 복사돼 끊긴 글도 같은 길 — 「복사가 덜 된 것 같아요」)
                const s2 = store();
                if (s2.custom.length >= CUSTOM_MAX) { pasteMsg(`내 글꾸가 꽉 찼어요(지금 ${s2.custom.length}/${CUSTOM_MAX}) — 「내 글꾸」에서 칩 옆 ✕ 로 하나 지우고 다시 받아요`, true); return; }   // 1.1.8 소독 전에(헛일 없이)
                const html = sanitizeHtml(raw);
                if (!html.trim()) { pasteMsg('글꾸로 쓸 HTML 이 없어요 — 글꾸 마트의 「테마용 복사」나 글꾸 HTML 을 붙여 넣어요', true); return; }
                if (html.length > CUSTOM_BYTES) { pasteMsg(`글꾸가 너무 커요(${Math.round(CUSTOM_BYTES / 1000)}KB 까지)`, true); return; }
                const used = new Set(s2.custom.map(c => c.name));
                let n = s2.custom.length + 1;
                while (used.has(`내 글꾸 ${n}`)) n++;
                const item = { id: `c${Date.now().toString(36)}`, name: `내 글꾸 ${n}`, html, slot: null };
                s2.custom = [...s2.custom, item];
                saveSettings();
                $('[data-lc-paste] textarea').value = '';
                state.shape = item.id;
                state.picking = true;
                state.category = 'mine'; state.more = true;
                showPaste(false);
                drawMore(); drawShapes(); drawColors(); draw();
                break;
            }
            // 1.2.0 복사해도 창은 열린 채(다시 복사 · 「글만」도 바로 · 채팅 글을 다시 고르지 않게) — 붙일 곳은 바닥 줄 안내에 남아요. 클립보드가 막히면 「코드 보기」 칸을 열어 직접 복사해요
            case 'md': {
                const text = mdText();
                const ok = await writeClipboard(null, text);
                if (!dialog.isConnected) return;
                if (ok) { remember(); tell('md'); } else openCode(text, { why: 'fail', plain: true });
                break;
            }
            case 'copy': {
                const pack = copyPack();
                if (!pack) return;
                const { html, code } = pack;
                const big = sizeNote(Math.max(byteSize(html), byteSize(code)), model.messages.length);   // 1.1.8 깡통 사이트 글 하나 한계(약 240KB) — 복사는 그대로 하고 크기를 알려요
                if (big) toastr.warning(big, '로그 복사', { timeOut: 8000 });
                const ok = await writeClipboard(html, code);
                if (!dialog.isConnected) return;
                if (ok) { remember(); tell('html'); } else openCode(code, { why: 'fail' });
                break;
            }
            case 'code': { const pack = copyPack(); if (!pack) break; const big = sizeNote(byteSize(pack.code), model.messages.length); if (big) toastr.warning(big, '로그 복사', { timeOut: 8000 }); openCode(pack.code); break; }   // 바닥 줄 「코드」(폰) · 복사 뒤 안내의 「코드 보기」
            case 'code-back': showCode(dialog, false); tell('idle'); break;
            case 'code-all': selectAll($('[data-lc-code-text]')); break;
            case 'code-copy': {
                const kind = codeBox().dataset.kind === 'md' ? 'md' : 'html';
                const ok = await copyArea($('[data-lc-code-text]'));
                if (!dialog.isConnected) return;
                if (ok) { remember(); showCode(dialog, false); tell(kind); }
                else toastr.warning('이 브라우저가 복사를 막았어요 — 글칸을 길게 눌러 「전부 선택 › 복사」해요', '로그 복사', { timeOut: 6000 });
                break;
            }
            case 'spoiler': {
                const doc = frame.contentDocument, range = state.spoilerRange;
                if (!doc || !range) break;
                const inside = spoilerAt(range);
                if (inside) unwrapSpoiler(inside);
                else if (!wrapSpoiler(doc, range, own() ?? colorsOf(paletteFor(state.shape, state.palette)), ui)) toastr.info('여기는 숨길 수 없어요 — 한 메시지 안의 글을 골라요', '로그 복사', { timeOut: 3000 });
                if (eb) syncProps();   // 소품 칸 안에서 숨긴 글도 소품 고친 글로(다시 그리면 사라졌어요)
                ensureSpoilerStyle(doc);
                doc.getSelection()?.removeAllRanges();
                state.spoilerRange = null;
                state.dirty = true;   // 1.0.1 숨긴 글도 틀을 바꿔 다시 그릴 때 그대로
                snapNow();   // 1.0.7 숨기기 · 풀기도 되돌리기 한 칸
                spoilerChips(true, false);
                break;
            }
            case 'hide': { const ct = tools(); ct.redact = !ct.redact; saveSettings(); drawTools(); draw(); break; }
            case 'wrap': { const s2 = store(); if (wrapMode(s2.wrap) === 'word') delete s2.wrap; else s2.wrap = 'word'; saveSettings(); drawTools(); draw(); break; }   // 11-13 줄바꿈 글자 단위 ↔ 단어 단위(단어 단위만 설정에 남아요 · 없으면 글자 단위)
            case 'fields': { const box = $('[data-lc-fields]'); box.hidden = !box.hidden; state.folds.fields = !box.hidden; drawShows(); if (!box.hidden) box.querySelector('input:not(:disabled)')?.focus(); break; }
            case 'undo': travel(-1); drawHist(); break;   // 글 고치기 중에도 같은 한 줄(고친 차례 거꾸로 하나씩)
            case 'redo': travel(1); drawHist(); break;
            case 'edit': {   // 11-12 「글 고치기」 켬 · 끔 — 켜면 문서 전체 편집을 끄고 점선 칸만 · 끄면 예전처럼 문서 편집
                state.ed.on = !state.ed.on;
                const doc = frame.contentDocument;
                if (!eb) { if (doc) needEd().then(m => { if (m && frame.contentDocument === doc && !eb) { armEdit(doc); drawHist(); } }); drawEdit(); break; }
                if (doc) {
                    doc.getSelection()?.removeAllRanges();
                    if (state.ed.on) editOn(doc);
                    else { eb.setOn(false); doc.designMode = 'on'; try { doc.execCommand('styleWithCSS', false, true); } catch { /* 옛 브라우저 */ } }
                }
                drawEdit(); drawHist();
                break;
            }
            case 'download': {
                const shown = result();
                if (!shown) return;
                const name = PRESETS.find(p => p.id === state.shape)?.label ?? custom()?.name ?? '로그';
                // 1.0.7 「⬇ 내려받기」(글꾸 마트 시식 창과 같은 꼴) — 복사한 HTML 을 따로 열어도 같은 모양
                const heading = store().titleOff ? '' : view().rewriteFields({ title: fieldOf('title') }).title;   // 1.1.8 이름 숨김 · 바꾸기를 거친 제목(전엔 채팅 제목 그대로라 이름이 문서 제목으로 샜어요) · 제목을 껐으면 틀 이름
                const doc = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(String(heading ?? '').trim() || name)}</title>\n</head>\n<body style="margin:0;padding:16px;background:${esc(pageBg())};-webkit-text-size-adjust:100%">\n${liftForCopy(shown, motionStyleFor(shown)).full}\n</body>\n</html>\n`;
                const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([flipFull(doc)], { type: 'text/html' })), download: `로그-${String(name).replace(/[\\/:*?"<>|#%]+/g, '').replace(/\s+/g, '-')}.html`, hidden: true });
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
    // 1.1.7 폰: 브라우저가 누른 칸을 화면 안으로 끌어올 때 붙박이 미리보기(.bl-lc-stk) 자리를 빼지 않아, 「가릴 이름」 같은 칸이 미리보기 밑에 깔렸어요(자판이 뜨면 더) — 끌어온 뒤 미리보기 아래로 내려 줘요
    const unhide = (el) => {
        if (!el?.isConnected || !globalThis.matchMedia?.(PHONE).matches) return;
        const box = el.closest('.bl-lc-scroll'), stk = box?.querySelector('.bl-lc-stk'); if (!stk) return;
        const r = el.getBoundingClientRect(), top = stk.getBoundingClientRect().bottom + 8, bottom = Math.min(box.getBoundingClientRect().bottom, globalThis.visualViewport ? visualViewport.offsetTop + visualViewport.height : Infinity) - 8;
        // 「크게」 미리보기에 자판까지 뜨면 미리보기 아래 · 보이는 바닥 사이에 칸이 들어갈 자리가 없어요 — 치는 동안만 미리보기를 작게(칸에서 손을 떼면 그대로 돌아와요)
        if (r.height > bottom - top && dialog.classList.contains('bl-lc-big') && !dialog.classList.contains('bl-lc-typing')) { dialog.classList.add('bl-lc-typing'); setTimeout(() => unhide(el), 50); return; }
        if (r.top < top) box.scrollTop -= top - r.top;   // 위에서 미리보기가 덮으면 내리고
        else if (r.bottom > bottom) box.scrollTop += Math.min(r.bottom - bottom, r.top - top);   // 보이는 바닥 아래로 밀렸으면 올려요(미리보기 밑으로는 안 넘게)
    };
    dialog.addEventListener('focusout', () => setTimeout(() => { if (!dialog.contains(dialog.ownerDocument.activeElement)) dialog.classList.remove('bl-lc-typing'); }, 0));
    const TYPING = 'input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea:not([readonly])';   // 자판이 올라오는 칸(「코드 보기」 글칸은 읽기 전용)
    dialog.addEventListener('focusin', (event) => { const el = event.target; if (!el?.matches?.(TYPING)) return; setTimeout(() => unhide(el), 300); });
    const onVv = () => { const el = dialog.ownerDocument.activeElement; if (dialog.contains(el)) setTimeout(() => unhide(el), 100); };
    globalThis.visualViewport?.addEventListener('resize', onVv);
    // 1.2.0 칸을 누른 뒤 자판이 올라오는데 브라우저가 칸을 끌어오지 않으면 칸이 바닥 단추 줄 밑에 남았어요 — 창 배치가 다 줄어들기 전에 잰 「보이는 바닥」이 옛 값일 수 있어요. 스크롤 칸 높이가 실제로 바뀐 뒤에 한 번 더 재요
    const boxWatch = globalThis.ResizeObserver ? new ResizeObserver(() => { const el = dialog.ownerDocument.activeElement; if (el && dialog.contains(el) && el.matches(TYPING)) unhide(el); }) : null;
    boxWatch?.observe($('.bl-lc-scroll'));
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
            const ex = $('[data-lc-mask-ex]'); if (ex) ex.textContent = ct.maskWord;   // 1.1.6 「하루 → ○○」 보기도 치는 대로
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
    dialog.addEventListener('close', () => { selBar.destroy(); boxWatch?.disconnect(); globalThis.visualViewport?.removeEventListener('resize', onVv); clearTimeout(ruleTimer); clearTimeout(imageTimer); clearTimeout(inkTimer); clearTimeout(fine.timer); clearTimeout(hist.timer); clearTimeout(hold); hist.timer = 0; if (open === dialog) open = null; dialog.remove(); }, { once: true });
    open = dialog;
    guide(dialog, 'idle');
    drawStage();
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
.bl-lc-add.is-full { opacity:.6; }
.bl-lc-mine { display:flex; flex-wrap:wrap; gap:2px 10px; margin:-2px 16px 0; color:var(--salty-muted); font-size:12px; line-height:1.5; }
.bl-lc-mine[hidden] { display:none; }
.bl-lc-mine > b { font-weight:650; color:var(--salty-text); }
.bl-lc-mine.is-full > b { color:var(--salty-danger, var(--salty-text)); }
.bl-lc-chip.bl-lc-pv { justify-content:center; min-width:var(--bl-ui-chip, 34px); margin-left:-6px; padding:0 8px; }
.bl-lc-chev { display:inline-block; flex:none; width:14px; height:14px; background:currentColor; -webkit-mask:var(--bl-ui-glyph-chev, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 5.5L7 9L11.5 5.5'/%3E%3C/svg%3E")) center / contain no-repeat; mask:var(--bl-ui-glyph-chev, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 5.5L7 9L11.5 5.5'/%3E%3C/svg%3E")) center / contain no-repeat; transition:transform .15s ease; }
.bl-lc-pv[aria-expanded="true"] > .bl-lc-chev { transform:rotate(180deg); }
.bl-lc-chip.bl-lc-pvi { min-height:30px; padding:0 9px; font-size:12px; border-style:dashed; }
.bl-lc-chip.bl-lc-pvi[aria-pressed="true"] { border-style:solid; }
.bl-lc-chip.bl-lc-x { justify-content:center; min-width:var(--bl-ui-chip, 34px); margin-left:-6px; padding:0 8px; }
.bl-lc-chip > .bl-lc-mart { font-size:11px; line-height:1; }
.bl-lc-chip:focus-visible, .bl-lc .salty-pal:focus-visible { outline:1px solid var(--salty-accent); outline-offset:1px; }
.bl-lc-colors { display:flex; align-items:center; gap:0; padding-left:16px; min-width:0; }
.bl-lc-colors[hidden], .bl-lc-pals[hidden], .bl-lc-pick[hidden], .bl-lc-paste[hidden], .bl-lc-stage[hidden], .bl-lc-foot[hidden] { display:none; }
.bl-lc-colors .bl-lc-pals { flex:1; min-width:0; padding-left:8px; }
.bl-lc-mode { display:flex; flex:none; gap:4px; padding:4px; border-radius:12px; background:var(--salty-fill-shade, var(--salty-shade)); }
.bl-lc-mode button { display:grid; place-items:center; width:38px; height:34px; margin:0; padding:0; border:0; border-radius:8px; background:transparent; color:var(--salty-muted); font-size:var(--bl-deco-glyph-17, 17px); cursor:pointer; }
.bl-lc-mode button[aria-pressed="true"] { background:var(--bl-ui-pick-face, var(--salty-tint-18)); color:var(--bl-ui-pick-ink, var(--salty-accent)); }   /* 1.2.2 공용 밝기 스위치(.salty-mode-switch — 설정 › 색의 해 · 달)와 같은 꼴: 38×34 · 그림 17 · 고른 칸 = 옅은 고른 면 + 색 그림 */
.bl-lc-mode[hidden] { display:none; }
.bl-lc-colors > .bl-lc-flip { margin-left:8px; gap:3px; }
.bl-lc-mode[hidden] + .bl-lc-flip { margin-left:0; }
.bl-lc-flip[aria-pressed="true"] > i { color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-chip[aria-disabled="true"] { opacity:.5; cursor:default; }
.bl-lc-flip-note { padding:0 16px; font-size:12px; line-height:1.4; }
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
.bl-lc .bl-lc-bar .bl-lc-edit { width:auto; gap:6px; padding:0 10px; font-size:13px; }   /* 11-12 「글 고치기」(공용 편집 모듈 — 점선 칸 · 소품 전 · 후) — PC 는 글자까지 · 폰은 아이콘만 */
.bl-lc .bl-lc-bar .bl-lc-edit[hidden] { display:none; }
.bl-lc .bl-lc-bar .bl-lc-edit[aria-pressed="true"] { color:var(--salty-accent-ink, var(--salty-accent)); background:var(--salty-accent-10, var(--salty-raised)); }
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
.bl-lc-names { padding:10px 12px; border-radius:12px; background:var(--salty-shade, var(--salty-raised)); }   /* 1.1.6 이름 가림 상자: 「가릴 이름」 · 「대신 보일 말」 두 줄 */
.bl-lc-np-r { display:flex; align-items:center; flex-wrap:wrap; gap:6px; min-width:0; }
.bl-lc-np-h { flex:none; width:64px; color:var(--salty-muted); font-size:12px; line-height:1.3; }
.bl-lc-np-r:first-child { align-items:flex-start; }
.bl-lc-np-r:first-child > .bl-lc-np-h { padding-top:8px; }
.bl-lc-np-list { flex:1; display:flex; flex-wrap:wrap; align-items:center; gap:6px; min-width:0; }
.bl-lc-np-list > .bl-lc-name-list { display:contents; }
.bl-lc-tag { box-sizing:border-box; display:inline-flex; align-items:center; gap:4px; min-height:21px; padding:0 8px; border:1px solid var(--salty-line); border-radius:999px; background:var(--salty-shade); color:var(--salty-muted); font-size:12.5px; font-weight:400; line-height:1.2; white-space:nowrap; }   /* 1.2.2 알아서 찾은 이름 = 공용 알약(설정 · 확장 서랍의 작은 알약과 같은 꼴: 21 · 12.5 · 옅은 면 · 보조 글자) — 지울 수 있는 이름은 칩 */
.bl-lc-tag > small { color:var(--salty-muted); font-size:11px; }
.bl-lc-np-add { flex:1 1 120px; display:flex; align-items:center; gap:2px; min-width:120px; }
.bl-lc-names .bl-lc-np-add input { min-height:32px; font-size:13px; }
.bl-lc-np-ex { min-width:0; color:var(--salty-muted); font-size:12px; overflow-wrap:anywhere; }
.bl-lc-np-ex > b { color:var(--salty-accent-ink, var(--salty-accent)); font-weight:650; }
.bl-lc-names input.bl-lc-maskword { flex:none; width:6.5em; min-height:32px; padding:0 8px; text-align:center; font-size:13px; }
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
/* 1.1.8 띠(뺀 옛 글꾸 안내 · 빈 「내 글꾸」) · 붙여 넣기 칸 안내 · 결과 글 */
.bl-lc-band[hidden], .bl-lc-msg[hidden] { display:none; }
.bl-lc-band { display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; margin:0 16px; padding:8px 6px 8px 12px; border:1px solid var(--salty-accent); border-radius:12px; background:var(--salty-accent-10, var(--salty-raised)); color:var(--salty-text); font-size:13px; line-height:1.5; }
.bl-lc-band > span:first-child { flex:1 1 220px; min-width:0; }
.bl-lc-band b { font-weight:650; }
.bl-lc-band-go { display:flex; flex-wrap:wrap; gap:6px; }
.bl-lc-band .salty-btn, .bl-lc-paste a.salty-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:34px; padding:0 10px; color:var(--salty-text); font-size:13px; text-decoration:none; }
.bl-lc-band.bl-lc-empty { border-style:dashed; border-color:var(--salty-line); background:transparent; color:var(--salty-muted); }
.bl-lc-paste > .bl-lc-note { margin:0; line-height:1.6; }
.bl-lc-msg { padding:8px 12px; border-radius:8px; background:var(--salty-raised); font-size:13px; line-height:1.6; overflow-wrap:anywhere; }
.bl-lc-msg.is-bad { color:var(--salty-danger, var(--salty-text)); }
.bl-lc-msg ul { margin:4px 0 0; padding-left:18px; color:var(--salty-muted); }
/* 1.1.6 폰 화면(11-12 사용자가 고른 시안 (나) 「미리보기 위」) — 넓은 창(PC)에서는 감싸는 칸이 없는 듯(display:contents) · 폰 부품은 숨겨 예전 그대로예요 */
.bl-lc-tl, .bl-lc-cr, .bl-lc-folds, .bl-lc-fd, .bl-lc-stk { display:contents; }
.bl-lc .bl-lc-hd-mode, .bl-lc .bl-lc-tl-all, .bl-lc-cr-more, .bl-lc-fd-h, .bl-lc-sw, .bl-lc-hint, .bl-lc-sep, .bl-lc .bl-lc-ph, .bl-lc-chip.bl-lc-ghost { display:none; }
@media (max-width: 600px) {
  /* 머리 줄: 제목 · 밝기(작은 둘 칸) · 닫기 */
  .bl-lc-head { padding:4px 6px 4px 16px; z-index:4; background:inherit; pointer-events:none; } .bl-lc-head > * { pointer-events:auto; }   /* 1.2.2 머리줄 간격 8(철칙 §7 · 넓은 창 규칙 그대로) · 밝기 스위치(38 높이)가 들어가도 줄 높이는 그대로 46. 11-14 아래 스크롤 칸이 5px 올라와도 머리줄이 위에 그대로 보이고(창의 flex 칸이라 z-index 가 먹어요 · 내린 글이 비치지 않게 창 바탕을 물려받아요) · 빈 여백을 누르면 아래 탭이 받아요 */
  .bl-lc-head h3 { flex:1; }
  .bl-lc .bl-lc-mode.bl-lc-hd-mode { display:flex; gap:2px; padding:2px; border-radius:10px; }
  .bl-lc .bl-lc-mode.bl-lc-hd-mode[hidden], .bl-lc-colors > .bl-lc-mode, .bl-lc-colors.bl-lc-pal-off.bl-lc-flip-idle, .bl-lc-flip-idle > .bl-lc-flip { display:none; }
  .bl-lc-colors { padding-left:0; }
  .bl-lc-colors .bl-lc-pals { padding-left:16px; }
  .bl-lc-colors > .bl-lc-flip { margin-left:16px; }
  .bl-lc-colors:not(.bl-lc-flip-idle) .bl-lc-pals { padding-left:8px; }
  /* 차례: 분류 → 틀 → 미리보기(붙박이) → 색 · 조절 → 「로그 꾸밈」 갈래 → 숨기기 안내 */
  .bl-lc-scroll { margin-top:-5px; padding:5px 0 14px; }   /* 간격 8 은 넓은 창 규칙 그대로. 11-14 위로 5 올리고 안쪽 여백 5(내용 자리 그대로): 맨 윗줄 분류 탭의 누르는 상자 44 가 위 5px 를 이 칸 위 끝에서 잘려 아래로만 늘던 것 — 올린 5px 는 머리줄 아래 여백 4 + 선 1 자리예요 */
  .bl-lc-tl { order:1; } .bl-lc-cr { order:2; } .bl-lc-mine { order:2; } .bl-lc-gallery { order:3; } .bl-lc-pick { order:4; } .bl-lc-stk { order:5; } .bl-lc-paste { order:5; }
  .bl-lc-band.bl-lc-empty { order:2; } .bl-lc-band[data-lc-retired] { margin-top:8px; }   /* 1.1.8 빈 안내는 틀 줄 바로 아래 · 옛 글꾸 띠는 맨 위 */
  .bl-lc-colors { order:6; } .bl-lc-flip-note { order:6; } .bl-lc-easy { order:7; } .bl-lc-inks { order:8; } .bl-lc-sep { order:9; } .bl-lc-folds { order:10; } .bl-lc-hint { order:11; } .bl-lc-scroll > .bl-lc-more { order:12; }
  .bl-lc-tools { display:none; }
  .bl-lc:not(.bl-lc-less) .bl-lc-scroll > .bl-lc-more { display:none; }
  .bl-lc.bl-lc-less :is(.bl-lc-tl, .bl-lc-cr-more, .bl-lc-sep, .bl-lc-folds, .bl-lc-hint) { display:none; }
  .bl-lc.bl-lc-less .bl-lc-cr { padding-top:8px; }
  /* 분류: 밑줄 글 탭 + 오른쪽 끝 「전부」 */
  .bl-lc-tl { display:flex; align-items:flex-start; gap:2px; min-width:0; padding-right:6px; border-bottom:1px solid var(--salty-line); }   /* 1.2.2 「전부」 꺾쇠는 탭 줄 옆 제자리(탭 위에 겹쳐 띄우지 않아요) — 넘치면 공용 탭 줄 흐림(98-tab-strips · 28px)이 꺾쇠 앞에서 끝나요 */
  .bl-tool-dialog.bl-lc .salty-seg.bl-lc-cats { flex:1 1 auto; min-width:0; gap:2px; margin:-5px 0; padding:5px 0 5px 10px; border:0; border-radius:0; background:transparent; box-shadow:none; --bl-tab-reveal-inset:28px !important; }   /* 위아래 안쪽 여백 5(바깥 여백을 그만큼 줄여 자리 그대로): 탭 높이 34 의 누르는 상자 44 가 이 줄의 overflow-y:hidden 에 잘려 34 로 줄던 것(ext-status 분류 탭과 같은 꼴) */
  .bl-tool-dialog.bl-lc .salty-seg.bl-lc-cats > button { position:relative; flex:none; min-width:0; min-height:var(--bl-ui-chip, 34px); padding:0 8px; border:0; border-radius:8px; background:transparent; box-shadow:none; color:var(--salty-muted); font-size:13px; font-weight:400; }   /* 1.2.2 공용 고르기 묶음 칸(34 · 13 · 여백 8 · 모서리 8 — PC 의 같은 줄과 같아요) 위에 밑줄만 */
  .bl-lc:not(#bl-lc-a) .salty-seg.bl-lc-cats > button.on { isolation:isolate; color:var(--salty-text) !important; font-weight:700 !important; }
  .bl-tool-dialog.bl-lc .salty-seg.bl-lc-cats > button.on::before { content:''; position:absolute; inset:0; width:auto; height:auto; transform:none; z-index:-1; background:var(--salty-bg); }   /* 테마 칩 「고름」 면(층 안 !important 라 덮어쓰지 못해요)을 창 바탕으로 가려 밑줄 탭만 보여요 */
  .bl-tool-dialog.bl-lc .salty-seg.bl-lc-cats > button.on::after { content:''; position:absolute; left:8px; right:8px; bottom:0; height:2.5px; border-radius:2px 2px 0 0; background:var(--salty-accent); }
  .bl-tool-dialog.bl-lc .bl-lc-tl.is-all > .salty-seg.bl-lc-cats { flex-wrap:wrap; overflow:visible; -webkit-mask-image:none !important; mask-image:none !important; }
  .bl-lc .bl-lc-tl-all { display:grid; place-items:center; flex:none; color:var(--salty-text); }
  .bl-lc:not(#bl-lc-a):not(#bl-lc-b) :is(.bl-lc-tl-all, .bl-lc-bar .bl-lc-icon) { border-color:transparent !important; border-width:0 !important; }   /* 테마 단추 테두리(밀도 규칙 !important)를 이 둘에서만 걷어요 — 공용 아이콘만 단추(34 · 상자 없음 · 선 없음) */
  /* 틀 줄: 넘치면 오른쪽이 흐려지고 「+n」 알약(누르면 감싸 펼침 · 끝에 「접기」) */
  .bl-lc-cr { display:block; position:relative; min-width:0; }
  .bl-lc-cr > .bl-lc-chips { gap:6px; padding:4px 16px; --bl-tab-reveal-inset:112px !important; }
  .bl-lc-cr.is-over > .bl-lc-chips { padding-right:64px; }
  .bl-lc-cr.is-over > .bl-lc-chips[data-bl-fade="right"] { -webkit-mask-image:linear-gradient(to right, #000 calc(100% - 112px), transparent calc(100% - 64px)) !important; mask-image:linear-gradient(to right, #000 calc(100% - 112px), transparent calc(100% - 64px)) !important; }
  .bl-lc-cr.is-over > .bl-lc-chips[data-bl-fade="both"] { -webkit-mask-image:linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 112px), transparent calc(100% - 64px)) !important; mask-image:linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 112px), transparent calc(100% - 64px)) !important; }
  .bl-lc-cr.is-all > .bl-lc-chips { flex-wrap:wrap; overflow:visible; -webkit-mask-image:none !important; mask-image:none !important; }
  .bl-lc-cr > .bl-lc-cr-more { display:inline-flex; position:absolute; right:10px; top:50%; margin:0; translate:0 -50%; color:var(--salty-accent-ink, var(--salty-accent)); }   /* 1.2.2 「+n」 = 줄의 다른 틀 칩과 같은 공용 칩(34 · 13 · 여백 10 · 모서리 8 · 면 · 선) — 글자만 포인트색 */
  .bl-lc-cr > .bl-lc-cr-more[hidden] { display:none; }
  .bl-lc-chip.bl-lc-ghost { display:inline-flex; border-style:dashed; background:transparent; color:var(--salty-accent-ink, var(--salty-accent)); }
  .bl-lc-chip.bl-lc-ghost > i { color:inherit; }
  /* 미리보기: 틀 줄 바로 아래 · 내려도 맨 위에 붙어 있어요 · 작게(약 30%) / 크게(52%) / 접기 */
  .bl-lc-stk { display:block; position:sticky; top:0; z-index:3; padding:2px 16px 8px; background:var(--salty-bg); }
  .bl-lc-stk::after { content:''; position:absolute; left:0; right:0; bottom:-10px; height:10px; background:linear-gradient(var(--salty-bg), transparent); pointer-events:none; }
  .bl-lc-bar { gap:2px; min-height:38px; margin:0; padding:0 4px 0 12px; border:1px solid var(--salty-line); border-radius:12px 12px 0 0; background:var(--salty-surface); }
  .bl-lc-bar > .bl-lc-note { display:none; }
  .bl-lc .bl-lc-bar > b.bl-lc-ph { display:block; flex:none; color:var(--salty-text); font-size:13px; font-weight:650; }
  .bl-lc .bl-lc-bar > .bl-lc-bar-name { display:block; flex:1; min-width:0; margin-left:6px; overflow:hidden; color:var(--salty-muted); font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
  .bl-lc .bl-lc-bar .bl-lc-icon { display:grid; place-items:center; background:transparent; width:34px; min-width:34px; height:34px; min-height:34px; color:var(--salty-text); font-size:var(--bl-ui-ink-fa, 12.5px); }   /* 1.2.2 공용 아이콘만 단추(34 · 잉크 12.5 · 글자색) */
  .bl-lc .bl-lc-bar .bl-lc-icon:disabled { opacity:.35; }
  .bl-lc .bl-lc-bar .bl-lc-edit { width:34px; padding:0; }
  .bl-lc .bl-lc-bar .bl-lc-edit > span { display:none; }
  .bl-lc-stage { margin:0; border-top:0; border-radius:0 0 12px 12px; }
  .bl-lc-stage iframe { height:clamp(150px, 30dvh, 270px); }
  .bl-lc.bl-lc-big .bl-lc-stage iframe { height:52dvh; }
  .bl-lc.bl-lc-big.bl-lc-typing .bl-lc-stage iframe { height:clamp(150px, 30dvh, 270px); }   /* 1.1.7 「크게」에 자판이 뜬 채 칸에 치는 동안만 작게 */
  .bl-lc.bl-lc-shut .bl-lc-stage { height:0; border-width:0; }   /* 접어도 미리보기 문서는 그대로 그려 둬요(높이만 0 — 칸 읽기 · 되돌리기가 그대로) */
  .bl-lc.bl-lc-shut .bl-lc-bar { border-radius:12px; }
  .bl-lc-paste { margin:6px 16px 0; }
  /* 조절(받은 글꾸): 줄 이름을 위로 · 그 아래 「로그 꾸밈」 나눔 줄 */
  .bl-lc-easy { gap:8px; padding:4px 0 0; }
  .bl-lc-easy-row { display:grid; gap:2px; padding-left:0; }
  .bl-lc-easy-h { display:flex; align-items:baseline; gap:6px; min-width:0; padding:0 16px; color:var(--salty-text); font-size:14px; font-weight:650; }
  .bl-lc-easy-h small { color:var(--salty-muted); font-size:12px; font-weight:400; }
  .bl-lc-easy-chips { padding:4px 16px; }
  .bl-lc .bl-lc-easy-note { margin:0 16px 2px; }
  .bl-lc.bl-lc-tuned .bl-lc-sep { display:flex; align-items:center; gap:8px; margin:6px 16px 0; color:var(--salty-faint, var(--salty-muted)); font-size:12px; font-weight:600; }
  .bl-lc-sep::after { content:''; flex:1; height:1px; background:var(--salty-line); }
  /* 접는 갈래 넷 — 접힌 머리에 지금 상태 · 켠 것은 노란 「켬」 */
  .bl-lc-folds { display:grid; gap:8px; margin:0 16px; }
  .bl-lc-fd { display:grid; gap:10px; min-width:0; border:1px solid var(--salty-line); border-radius:12px; background:var(--salty-surface); }
  .bl-lc-fd.is-open { padding-bottom:14px; }
  .bl-lc-fd:not(.is-open) > :not(.bl-lc-fd-h) { display:none; }
  .bl-lc-fd[data-lc-fd="shows"] { order:1; } .bl-lc-fd[data-lc-fd="names"] { order:2; } .bl-lc-fd[data-lc-fd="words"] { order:3; } .bl-lc-fd[data-lc-fd="fields"] { order:4; } .bl-lc-fd[data-lc-fd="wrap"] { order:5; }   /* 11-13 줄바꿈 갈래는 머리 칸 뒤 */
  .bl-lc-fd-h { box-sizing:border-box; display:flex; align-items:center; gap:8px; width:100%; min-width:0; min-height:47px; margin:0; padding:0 12px; border:0; border-radius:8px; background:transparent; color:var(--salty-text); font:inherit; font-size:var(--bl-ts-ctl, 14px); text-align:left; cursor:pointer; }   /* 1.2.2 접는 줄 단추 = 공용 글자 단추 꼴(글자 한 단계 · 여백 12 · 모서리 8 · 상자 없음 — 빠른 QR 찾기의 접는 줄과 같아요) · 갈래 이름 · 요약 글자는 아래에서 따로 */
  .bl-lc-fd.is-open > .bl-lc-fd-h { margin-bottom:-6px; }
  .bl-lc-fd-h > b { flex:none; font-size:15px; font-weight:650; }
  .bl-lc-fd-h > span { flex:1; min-width:0; overflow:hidden; color:var(--salty-muted); font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
  .bl-lc-fd-h > mark { flex:none; padding:1px 8px; border-radius:999px; background:var(--salty-accent-10, var(--salty-raised)); color:var(--salty-accent-ink, var(--salty-accent)); font-size:12px; font-weight:650; }
  .bl-lc-fd-h > mark.is-on { background:var(--salty-accent); color:var(--salty-on-accent, var(--salty-bg)); }   /* 1.2.2 「켬」 = 스위치 켬과 같은 팔레트 강조색(테마 규칙: 켜짐에는 두 번째 포인트 · 팔레트 밖 노랑을 안 써요) */
  .bl-lc-fd-h > mark[hidden] { display:none; }
  .bl-lc-fd-h > i { flex:none; color:var(--salty-text); font-size:var(--bl-ui-ink-fa, 12.5px); transition:transform .15s; }   /* 1.2.2 테마의 다른 꺾쇠와 같은 꼴(12.5 · 글자색) */
  .bl-lc-fd.is-open > .bl-lc-fd-h > i { transform:rotate(180deg); }
  .bl-lc-fd-h:focus-visible, .bl-lc-sw:focus-visible, .bl-lc-cr-more:focus-visible { outline:1px solid var(--salty-accent); outline-offset:-1px; }
  .bl-lc-fd > :is(.bl-lc-shows, .bl-lc-names, .bl-lc-words, .bl-lc-fields, .bl-lc-sw) { margin:0 12px; }
  .bl-lc-fd > .bl-lc-names { margin-top:-4px; }
  /* 「보일 것」: 감싸는 칩 · 켬 = 채운 동그라미 + 체크 · 끔 = 빈 동그라미(글자를 긋지 않아요) */
  .bl-lc-fd > .bl-lc-shows { flex-wrap:wrap; gap:6px; padding:0; overflow:visible; }
  .bl-lc-fd .bl-lc-shows .bl-lc-chip { gap:6px; padding:0 11px; }
  .bl-lc-fd .bl-lc-shows .bl-lc-chip[aria-pressed] > i:first-child { box-sizing:border-box; display:grid; place-items:center; width:15px; height:15px; border:1.5px solid var(--salty-faint, var(--salty-muted)); border-radius:50%; font-size:0; }
  .bl-lc-fd .bl-lc-shows .bl-lc-chip[aria-pressed] > i:first-child::before { content:none; }
  .bl-lc-fd .bl-lc-shows .bl-lc-chip[aria-pressed="true"] { font-weight:500; --bl-ui-pick-check-position:absolute; --bl-ui-pick-check-inset:13px auto auto 14px; --bl-ui-pick-check-margin:0; }   /* 테마의 「고름」 체크를 칩 끝이 아니라 동그라미 안으로 옮겨요 */
  .bl-lc-fd .bl-lc-shows .bl-lc-chip[aria-pressed="true"]::after { color:var(--salty-on-accent, #fff); }
  .bl-lc-fd .bl-lc-shows .bl-lc-chip[aria-pressed="true"] > i:first-child { border-color:var(--salty-accent); background:var(--salty-accent); }
  .bl-lc-fd .bl-lc-shows .bl-lc-chip[aria-pressed="false"] { background:transparent; color:var(--salty-muted); }
  .bl-lc-fd .bl-lc-shows .bl-lc-chip[aria-pressed="false"] > span { color:inherit; text-decoration:none; }
  /* 스위치 줄(이름 숨김 · 바꾸기) */
  .bl-lc .bl-lc-sw { box-sizing:border-box; display:flex; align-items:center; gap:10px; min-width:0; min-height:44px; padding:0; border:0; background:transparent; color:var(--salty-text); font:inherit; font-size:14px; text-align:left; cursor:pointer; }
  .bl-lc-sw > span { flex:1; min-width:0; }
  .bl-lc-sw > span > small { display:block; color:var(--salty-muted); font-size:12px; line-height:1.35; }
  .bl-lc-sw > i { flex:none; position:relative; width:40px; height:24px; border-radius:999px; background:var(--salty-shade-2, var(--salty-raised)); box-shadow:inset 0 0 0 1px var(--salty-line); transition:background .15s; }
  .bl-lc-sw > i::after { content:''; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:var(--salty-surface); box-shadow:0 1px 2px rgba(0, 0, 0, .25); transition:left .15s; }
  .bl-lc-sw[aria-checked="true"] > i { background:var(--salty-accent); box-shadow:none; }
  .bl-lc-sw[aria-checked="true"] > i::after { left:19px; background:#fff; }
  /* 머리 칸: 이름 위 · 2열(제목은 한 줄 전체) */
  .bl-lc-fd > .bl-lc-fields { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
  .bl-lc-fd .bl-lc-field { display:grid; gap:3px; font-size:12px; }
  .bl-lc-fd .bl-lc-field:first-child { grid-column:1 / -1; }
  @media (max-width: 359px) { .bl-lc-fd .bl-lc-field:nth-child(2) { grid-column:1 / -1; } }   /* 1.2.0 폭 320: 반 칸에서는 날짜(「2026년 11월 12일」)가 잘려요 — 날짜 칸도 한 줄을 다 써요 */
  /* 숨기기 안내 한 줄 */
  .bl-lc-hint { display:flex; align-items:center; gap:8px; min-height:44px; margin:0 16px; padding:4px 6px 4px 12px; border:1px dashed var(--salty-line); border-radius:12px; color:var(--salty-muted); font-size:12px; line-height:1.4; }
  .bl-lc-hint > span { flex:1; min-width:0; }
  .bl-lc-hint > i { flex:none; color:var(--salty-faint, var(--salty-muted)); font-size:13px; }
  .bl-lc-hint b { color:var(--salty-text); font-weight:650; }
  .bl-lc-hint > .bl-lc-chip:disabled { opacity:.6; }
  /* 바닥 줄: 「글만 · 파일로 · HTML 복사」(320 에서도 안 잘려요) */
  .bl-lc-foot { grid-template-columns:auto auto minmax(0, 1fr); gap:6px; padding:10px 12px 12px; }
  .bl-lc-foot .salty-btn { min-width:0; }   /* 1.2.2 단추 꼴은 넓은 폭과 같은 공용 창 단추(40 · 글자 그대로 · 옅은 면 + 선) · 주요 단추(여백 16 · 모서리 12) — 폰은 짧은 이름만 */
  .bl-lc-foot .salty-btn:not(.bl-tool-primary) { display:inline-flex; align-items:center; justify-content:center; gap:5px; }
  .bl-lc-foot .salty-btn:not(.bl-tool-primary) > i { font-size:13px; color:var(--salty-muted); }
  .bl-lc-foot .bl-lc-long { display:none; }
  .bl-lc .bl-lc-foot .bl-lc-ph { display:inline; }
  .bl-lc .bl-lc-foot i.bl-lc-ph { display:inline-block; }
  .bl-lc-foot .bl-tool-primary { white-space:nowrap; }
  @media (max-width: 359px) { .bl-lc-foot .salty-btn { font-size:13px; } .bl-lc-foot .salty-btn:not(.bl-tool-primary) { padding:0 8px; } .bl-lc-foot .bl-tool-primary { font-size:14px; padding:0 12px; } }   /* 폭 320: 「글만 · 코드 · HTML 복사」 가 한 줄에 들어가게 글자만 한 단계 작게 */
}
`;
function ensureStyle() {
    if (document.getElementById('bl-lc-style')) return;
    const style = document.createElement('style');
    style.id = 'bl-lc-style';
    style.textContent = STYLE + HANDOFF_STYLE;
    document.head.append(style);
}
