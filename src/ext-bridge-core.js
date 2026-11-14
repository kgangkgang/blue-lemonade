// 남의 확장 기능 다리 (1.2.x) — 실리태번 · 화면 없이 도는 순수 부분이에요(tools/tests/ext-bridge-core.mjs 가 그대로 불러요).
//   미트볼 상태창이 확장 AI 에 보내는 요청에 ① 번역 용어집의 이름 줄을 싣고 ② 사용자가 고른 회사 · 모델로 보내는 일의 「판단」만 여기 있어요.
//   · 누가 불렀나: 호출 스택의 확장 폴더(크롬 · 파이어폭스 · 사파리 꼴) — 그 확장의 코드를 읽거나 고치지 않고 주소만 봐요.
//   · 어느 기능인가: 스택에 남은 그 확장의 함수 이름(FN_SLOT). 이름이 바뀌어 못 알아보면 '' — 「확장 AI 전체」 칸으로 가요(조용히 덜 세밀해질 뿐).
//   · 용어집: 번역 애드온과 같은 항목 · 같은 차례 · 같은 찾기 규칙(translator/glossary-prompt.js · glossary-match.js). 요청 글에 실제로 나온 표기만 실어요.
//   설정은 테마 설정(salty)과 따로 extension_settings[BRIDGE_KEY] 에 — 사용자가 칸을 바꿀 때만 생겨요.
import { chatGlossaryEntries } from './addons/translator/chat-glossary.js';
import { GLOSSARY_SETTINGS_KEY, glossaryScopeKeysOf, pickGlossaryEntries, glossaryBlockText } from './addons/translator/glossary-prompt.js';
import { glossaryLines, glossaryFold, glossaryAlternatives } from './addons/translator/glossary-match.js';
import { panelLangCode } from './addons/prompt/glossary.js';

export { GLOSSARY_SETTINGS_KEY };
export const BRIDGE_KEY = 'blue_lemonade_bridge';
/** 이어 주는 확장 — module: 그 확장의 설정 자리(읽기만) · root · head: 설정 칸과 그 안의 묶음 머리(src/ext-compat.js SETS 와 같은 값) · match: 설치 정보(manifest)에서 그 확장을 알아보는 말 · stateKey: 본편 주입 칸 · tag: 본편 답 끝 상태 줄 태그 */
export const TARGET = Object.freeze({ id: 'meatball', name: '미트볼 상태창', module: 'statussim', root: '#ss-settings', head: 'b.ss-set-h', match: /meatball|미트볼/i, stateKey: 'statussim_state', sideKeys: Object.freeze(['statussim_people', 'statussim_romance']), tag: '<meatball>' });
/** 본편 요청에 싣는 용어집 칸의 이름(실리태번 확장 주입) */
export const MAIN_PROMPT_KEY = 'bl_status_glossary';
/** 본편 용어집을 찾을 때 보는 최근 메시지 수 */
export const MAIN_RECENT = 12;

/** 모델을 따로 고를 수 있는 칸 — 그 확장의 「기능별 모델」 묶음과 같은 갈래예요. [칸, 이름, 맡는 기능(화면 덧글), 그 확장의 연결 프로필 설정 이름(읽기만)] */
export const SLOTS = Object.freeze([
    ['base', '확장 AI 전체', '', 'aiProfile'],
    ['contact', '연락', '메신저 · 편지 · 선톡 · 연락 요약 · 속마음', 'profContact'],
    ['gen', '만들기', '만들기 · 추가 지시 · 물가 · 플레이 방식 · 인물 욕구', 'profGen'],
    ['feeds', '소식', '뉴스 · 가십 · 게시판 · 의뢰 · SNS · 추천 음악', 'profFeeds'],
    ['analyze', '별도 분석', '자동 반영이 B · A+B 일 때 답마다 스스로 불려요 · 칩 점검의 「AI로 다시 분석」', 'profAnalyze'],
    ['help', '도우미', '', 'profHelp'],
    ['translate', '번역', '번역 담당이 「번역 모델 (LLM)」일 때 · 상태창 칸 · 편지 · 메시지 번역', 'trProfile'],
]);
const SLOT_IDS = SLOTS.map(([id]) => id);
export const slotLabel = id => (SLOTS.find(([key]) => key === id) || ['', ''])[1];
const hasText = value => typeof value === 'string' && value.trim() !== '';
/**
 * 그 확장 쪽에서 이 기능에 연결 프로필을 골라 두었나 — 골랐으면 그 확장의 선택이 먼저라 우리 모델로 돌리지 않아요.
 * (그 프로필이 실패해 「메인 연결로 다시」 오는 요청도 사용자가 고른 대로 메인으로 가요.) 기능을 못 알아봤으면 일곱 칸 가운데 하나라도 골랐을 때.
 */
export function targetHasProfile(settings, slot) {
    const own = SLOTS.find(([id]) => id === slot);
    const keys = own ? [own[3], SLOTS[0][3]] : SLOTS.map(row => row[3]);
    return keys.some(key => hasText(settings?.[key]));
}
/** await 뒤에 다시 보내는 요청(스택에 기능 함수가 안 남는 브라우저)을 같은 본문으로 알아보는 짧은 열쇠 — 글 전체를 쥐고 있지 않아요 */
export const promptKey = prompt => { const text = String(prompt ?? ''); return `${text.length}:${text.slice(0, 80)}:${text.slice(-80)}`; };
/** 다시 보내면 두 번 청구될 수 있는 실패(기다리다 끊음 · 중계 서버 524) — 메인 연결로 다시 보내지 않아요(번역기 현재 연결과 같은 규칙) */
export const billedMaybe = reason => /(?<![\d.,])\b524\b(?![.,]\d)/.test(String(reason ?? ''));

/** 스택에 남는 그 확장의 함수 이름 → 칸 (2.6.1 · 2.7.0 · 2.7.2 · 2.7.9 · 2.7.11 · 2.7.15 · 2.7.17 에서 같아요 · 판이 바뀌어 이름이 달라지면 못 알아보고 「확장 AI 전체」로)
 *  2.7.9 전수(원작 사본을 구문 분석해 aiGenerate · aiJSON · 번역 함수를 부르는 곳을 모두 뽑음): 새 길은 칩 점검(pipFix → analyzeMessage) 하나 — 안쪽 함수가 같아 그대로 걸려요.
 *  2.7.17: 「남은 글 번역하기」가 실리 번역기가 못 바꾼 글을 묻고 나서 번역 모델로 한 번 더 보내요(같은 translateMissing → trJSON · 번역 칸) — 「실리 기본 번역」이어도 이때는 번역 요청이 나가요.
 *  2.7.15: 새 길 「남은 글 번역하기」(translateMissing → trJSON) 하나 — 안쪽 함수가 trJSON 이라 번역 칸으로 걸려요. 채팅이 바뀌면 번역 결과도 버려요(원작).
 *  2.7.11 전수도 같은 길(부르는 곳 · 기능 묶음 그대로 — aiGenerate 가 채팅이 바뀌면 결과를 버리는 것과 「본편 쓰는 중」 판단을 실리 표시(#mes_stop · data-generating)로 바꾼 것뿐).
 *  2.7.7 부터 메인 연결 요청은 「본편이 다 쓸 때까지 기다리기」 await 뒤에 나가요 → 기능 함수는 비동기 프레임으로만 남아요(남지 않는 엔진은 ext-bridge.js 가 받은 때의 스택으로 봐요). */
export const FN_SLOT = Object.freeze({
    analyzeMessage: 'analyze',
    phoneReply: 'contact', letterReply: 'contact', pingMessage: 'contact', summarizeThread: 'contact', peekMind: 'contact',
    genModule: 'gen', genGroup: 'gen', instructModule: 'gen', askPrice: 'gen', detectPlay: 'gen', fillWants: 'gen',
    freshItems: 'feeds', snsReactions: 'feeds', musicPicks: 'feeds', boardReplies: 'feeds',
    askHelp: 'help',
    trJSON: 'translate', trText: 'translate', trJSONToEnglish: 'translate',
});
/** 한국어 → 영어로 되돌리는 요청 — 용어집(원문 → 한국어)과 방향이 반대라 싣지 않아요 */
const REVERSE_FN = 'trJSONToEnglish';

const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// ── 호출 스택 ─────────────────────────────────────────
const THIRD = /\/scripts\/extensions\/third-party\/([^/?#]+)\//;
const folderOf = url => { const hit = THIRD.exec(url); if (!hit) return ''; try { return decodeURIComponent(hit[1]); } catch { return hit[1]; } };
const lastName = name => String(name || '').replace(/\s*\[as [^\]]*\]\s*$/, '').split('/')[0].split('.').pop().replace(/[^\w$]/g, '');

/** 스택 글 → [{ fn, url, folder }] (안쪽 → 바깥쪽). 크롬 「at 이름 (주소)」 · 파이어폭스 · 사파리 「이름@주소」 둘 다 읽어요. 주소 없는 줄은 건너뛰어요 */
export function parseFrames(stack) {
    const frames = [];
    for (const raw of String(stack ?? '').split('\n')) {
        const line = raw.trim();
        let fn = '', url = '';
        if (line.startsWith('at ')) {
            const body = line.slice(3).replace(/^async\s+/, '').replace(/^new\s+/, '');
            const open = body.endsWith(')') ? body.lastIndexOf(' (') : -1;
            if (open >= 0) { fn = lastName(body.slice(0, open)); url = body.slice(open + 2, -1); } else url = body;
        } else {
            const at = line.indexOf('@');
            if (at < 0) continue;
            fn = lastName(line.slice(0, at).split('*').pop());
            url = line.slice(at + 1);
        }
        if (!/^[a-z][\w+.-]*:\/\//i.test(url) && !url.startsWith('/')) continue;
        frames.push({ fn, url, folder: folderOf(url) });
    }
    return frames;
}

/** 바로 부른 쪽이 이어 주는 확장인가 → 그 폴더 이름(아니면 ''). 맨 앞의 테마 자신 프레임은 건너뛰고, 그 뒤 세 프레임 안에서만 찾아요(다른 확장이 사이에 한 겹 끼어 있어도 돼요) */
export function findTarget(frames, own, isTarget) {
    let seen = 0;
    for (const frame of frames) {
        if (!seen && own && frame.folder === own) continue;
        if (++seen > 3) break;
        if (frame.folder && frame.folder !== own && isTarget(frame.folder)) return frame.folder;
    }
    return '';
}

/** 그 확장 프레임 가운데 가장 안쪽의 아는 함수 → { slot, fn } (못 알아보면 둘 다 '') */
export function slotOf(frames, folder) {
    for (const frame of frames) if (frame.folder === folder && Object.hasOwn(FN_SLOT, frame.fn)) return { slot: FN_SLOT[frame.fn], fn: frame.fn };
    return { slot: '', fn: '' };
}

// ── 설정 ──────────────────────────────────────────────
/** 저장값 → 쓰는 값. 없는 칸은 기본값(용어집 둘 다 켬 · 모델은 안 고름) */
export function readBridge(raw) {
    const saved = isObj(raw) && isObj(raw[TARGET.id]) ? raw[TARGET.id] : {};
    const models = {};
    for (const id of SLOT_IDS) {
        const value = isObj(saved.models) && isObj(saved.models[id]) ? saved.models[id] : {};
        const provider = /^[a-z0-9_-]{1,40}$/.test(str(value.provider, 40)) ? str(value.provider, 40) : '';
        models[id] = { provider, model: provider ? str(value.model, 200) : '', name: provider ? str(value.name, 200) : '' };
    }
    return { glossary: saved.glossary !== false, glossaryMain: saved.glossaryMain !== false, models };
}
/** 그 칸에서 보낼 모델 이름('' = 아직 못 보냄) */
export const modelOf = slot => (slot?.model === 'custom' ? str(slot.name, 200) : str(slot?.model, 200));
const usable = slot => !!slot?.provider && !!modelOf(slot);
/** 이 기능을 어디로 보낼까 — 그 칸 → 「확장 AI 전체」 → null(그 확장 설정대로) */
export function pickFor(config, slot) {
    const models = config?.models || {};
    if (slot && slot !== 'base' && usable(models[slot])) return { slot, ...models[slot] };
    return usable(models.base) ? { slot: 'base', ...models.base } : null;
}
export const anyModel = config => SLOT_IDS.some(id => usable(config?.models?.[id]));
/** 직접 연결 본문 만들기(settings-ai-connection.js buildDirectPayload)가 받는 꼴 — Custom 주소는 늘 실리태번에 저장된 주소(저장된 키가 다른 주소로 가지 않게) */
export const directConfig = pick => ({ provider: pick.provider, models: { [pick.provider]: pick.model }, customModels: { [pick.provider]: pick.name || '' }, customUrl: '' });
/** 응답 길이에 맞춘 기다리는 시간 — 번역기 직접 연결과 같은 셈(90초 + 토큰당 10ms · 10분까지) */
export const timeoutFor = tokens => Math.min(600000, 90000 + Math.max(0, Number(tokens) || 0) * 10);

// ── 용어집 ────────────────────────────────────────────
/** 실리태번 매크로가 다시 풀리지 않게 {{ 를 끊어요(용어집 글은 사용자 글이라 그대로 둬야 해요) */
export const inert = text => String(text ?? '').replace(/\{\{/g, '{ {');

/**
 * 이 요청에 용어집을 어떤 꼴로 실을까 → 'gen'(한국어로 바로 만드는 요청) · 'tr'(영어 → 한국어 번역 요청) · ''(안 실음)
 * mode: 그 확장의 「상태창 생성 언어」(ko · en · enview) — en · enview 는 생성이 영어라 번역 요청에만, 번역할 언어가 한국어일 때만 실어요
 */
export function glossaryKind({ mode = 'ko', slot = '', fn = '', trLang = '' } = {}) {
    if (fn === REVERSE_FN) return '';
    if (mode === 'en' || mode === 'enview') return slot === 'translate' && panelLangCode(trLang || '한국어') === 'ko' ? 'tr' : '';
    return 'gen';
}

/** 지금 채팅에 걸린 용어집 항목 — 이 채팅 → 캐릭터(그룹 · 멤버) → 전체(번역기와 같은 차례). 용어집 「사용」이 꺼져 있으면 [] */
export function activeEntries(translatorSettings, ctx) {
    if (!isObj(translatorSettings) || translatorSettings.glossary_enabled === false) return [];
    const entries = Array.isArray(translatorSettings.glossary_entries) ? translatorSettings.glossary_entries : [];
    return pickGlossaryEntries(entries, glossaryScopeKeysOf(ctx), chatGlossaryEntries(ctx?.chatMetadata));
}

/** 그 확장 「번역 지침」의 「원문 = 번역」 · 「->」 · 「→」 줄 왼쪽 표기(접은 꼴) — 같은 원문은 그 확장 지침이 이기게 용어집 줄에서 빼요 */
export function ruleSources(rules) {
    const out = new Set();
    for (const line of String(rules ?? '').split(/\r?\n/)) {
        const hit = /^\s*(.+?)\s*(?:=|->|→)\s*\S/.exec(line);
        if (hit) out.add(glossaryFold(hit[1]));
    }
    out.delete('');
    return out;
}

const CHOICE = ' Where several options are separated by " / ", pick the one that fits the context and use only options from the list.';
const HEAD = {
    gen: choice => `[Glossary]\nThe user fixed these Korean renderings. When a name or term below is written in Korean, use exactly the given rendering (Korean particles may attach naturally). A name the status data already writes in Korean keeps that existing spelling.${choice ? CHOICE : ''}`,
    main: choice => `[Glossary for the ${TARGET.tag} block]\nInside the ${TARGET.tag} block only: when a name or term below is written in Korean, use exactly the given rendering. A name the status state already lists keeps that existing spelling. This does not change the language or wording of the story text.${choice ? CHOICE : ''}`,
};

/**
 * 확장 AI 요청에 붙일 블록 → { block, lines }. text: 이번 요청 글(시스템 + 본문) — 여기 실제로 나온 표기만 줄이 돼요.
 * kind 'tr' 은 번역기 채팅 번역과 글자 그대로 같은 지시 꼴, 'gen' 은 「이미 있는 이름은 그대로」를 덧붙인 꼴. 줄 수 상한은 두지 않아요.
 */
export function extBlock(entries, text, { kind = 'gen', skip = null } = {}) {
    if (!kind || !Array.isArray(entries) || !entries.length || !String(text ?? '').trim()) return { block: '', lines: [] };
    const list = skip?.size ? entries.filter(entry => !glossaryAlternatives(entry.src).some(form => skip.has(glossaryFold(form)))) : entries;
    const { lines, hasChoice } = glossaryLines(list, text, { maxLines: Infinity });
    if (!lines.length) return { block: '', lines: [] };
    const block = kind === 'tr' ? glossaryBlockText(lines, hasChoice, 'ko') : `${HEAD.gen(hasChoice)}\n${lines.join('\n')}`;
    return { block: inert(block), lines };
}

/**
 * 본편 요청(답 끝 상태 줄)에 실을 블록 → { block, lines }. recent: 최근 메시지 · 지금 쓰는 글 — 여기 나온 표기만.
 * stateText: 그 확장이 본편에 넣은 상태 글 — 번역 표기가 이미 거기 있으면 줄을 만들지 않아요(같은 말을 또 싣지 않게).
 */
export function mainBlock(entries, recent, stateText = '') {
    if (!Array.isArray(entries) || !entries.length || !String(recent ?? '').trim()) return { block: '', lines: [] };
    const state = String(stateText ?? '');
    const fresh = entries.filter(entry => !glossaryAlternatives(entry.dst).some(form => form && state.includes(form)));
    const { lines, hasChoice } = glossaryLines(fresh, recent, { maxLines: Infinity });
    if (!lines.length) return { block: '', lines: [] };
    return { block: inert(`${HEAD.main(hasChoice)}\n${lines.join('\n')}`), lines };
}

/** 시스템 글 끝에 블록을 붙여요 */
export const appendBlock = (text, block) => (block ? (String(text ?? '').trim() ? `${String(text).replace(/\s+$/, '')}\n\n${block}` : block) : String(text ?? ''));

/** 연결 프로필 요청의 글(메시지 배열 또는 한 줄 글)에 블록을 넣은 새 값 — 받은 값은 고치지 않아요 */
export function blockIntoPrompt(prompt, block) {
    if (!block) return prompt;
    if (typeof prompt === 'string') return `${block}\n\n${prompt}`;
    if (!Array.isArray(prompt)) return prompt;
    const at = prompt.findIndex(message => message?.role === 'system' && typeof message.content === 'string');
    if (at < 0) return [{ role: 'system', content: block }, ...prompt];
    return prompt.map((message, index) => (index === at ? { ...message, content: appendBlock(message.content, block) } : message));
}
/** 요청 글 전체(찾기용) */
export const promptText = prompt => (typeof prompt === 'string' ? prompt : Array.isArray(prompt) ? prompt.map(message => (typeof message?.content === 'string' ? message.content : '')).join('\n') : '');

/** 설정 칸에 보이는 용어집 안내 한 줄 */
export function glossaryNote({ addon = true, enabled = true, count = 0, mode = 'ko', engine = 'llm', trLang = '' } = {}) {
    if (!addon) return '번역 애드온이 꺼져 있어 싣지 않아요.';
    if (!enabled) return '번역 설정의 용어집 「사용」이 꺼져 있어 싣지 않아요.';
    if (!count) return '이 채팅에 걸린 용어집 항목이 아직 없어요.';
    const head = `이 채팅에 걸린 용어집 ${count}개 가운데 요청 글에 나온 이름만 실어요.`;
    if (mode !== 'en' && mode !== 'enview') return `${head} 이미 상태창에 있는 이름은 바꾸지 않아요.`;
    if (engine === 'st') return `${head} 지금은 「실리 기본 번역」이라 보통은 실을 요청이 없어요(실리 번역기가 못 바꾼 글을 번역 모델로 다시 보낼 때 · 번역 모델로 바꾸면 번역 요청에 실려요).`;
    if (panelLangCode(trLang || '한국어') !== 'ko') return `${head} 번역할 언어가 한국어가 아니라 싣지 않아요.`;
    return `${head} 상태창을 영어로 만드는 설정이라 번역 요청에만 실어요.`;
}
