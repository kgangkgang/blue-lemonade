// 6.2.6 웹 검색 · 출처 — 순수 함수. DOM · 실리태번 import 없음 (tools/tests/websearch-mark.mjs 가 node 로 검사한다).
// 화면 · 이벤트 연결은 src/websearch.js, 응답 흔적을 알리는 곳은 성능 보조의 요청 로그(src/addons/perf/capture.js).
//
// 사용자: 「검색한 답에는 작은 지구 표시를 띄우고, 낱말을 꾹 누르면 프롬프트 어디서 왔는지(카드 · 로어북 · 기억 · 지시, 없으면 '지어냄/검색') 보여 주는 거」
// · 응답 흔적(webSearchEvidence): 실리태번 서버는 Claude 5 모델 + 웹 검색 켬이면 web_search 도구를 붙인다(src/endpoints/backends/chat-completions.js).
//   답의 server_tool_use(name web_search) · web_search_tool_result 블록, usage.server_tool_use.web_search_requests 가 그 증거.
//   다른 공급자도 같은 뜻의 흔적이 있으면 본다: OpenAI 계열 url_citation 주석 · Responses web_search_call, Gemini groundingMetadata, citations.
// · 출처(buildOrigin): 보낸 프롬프트(메시지 배열)를 블록(종류 · 이름 · 글)으로 나눈다. 카드 · 로어북 · 기억 · 지시 · 페르소나 · 작가의 노트 · 프리셋은
//   그 글의 앞머리(서명)가 프롬프트에 있을 때만 블록이 된다(= 실제로 보낸 것만). 채팅 기록은 보낸 메시지 쪽에서 찾는다. 어느 블록에도
//   거의 안 덮인 메시지는 「프롬프트」(system) · 「기록」(user · assistant) 블록 — 보낸 글자는 빠짐없이 찾을 수 있게.
// · 낱말(wordAt · searchKeys): 글자 · 숫자가 이어진 한 덩이, 2자 이상. 한국어는 끝의 조사 하나만 뗀다(간단 규칙 하나, 형태소 분석 없음).

export const WEBSEARCH_KEY = 'bl_websearch';     // mes.extra 플래그 (true) — 스와이프 정보의 extra 에도
export const SETTING_KEY = 'webSearchMarks';     // settings.chat.webSearchMarks (기본 켬)
export const KIND_ORDER = ['카드', '로어북', '기억', '지시', '페르소나', '작가의 노트', '프리셋', '확장', '기록', '프롬프트'];
export const SIG_LEN = 40;
export const MAX_LABELS = 3;
export const MIN_WORD = 2;
/** 기억에 둘 출처 기록 — 답 24개 · 글자 2,000,000 까지 (오래된 것부터 버린다) */
export const ORIGIN_KEEP = Object.freeze({ entries: 24, chars: 2_000_000 });

const isObj = v => !!v && typeof v === 'object';
const str = v => (typeof v === 'string' ? v : '');

export function marksEnabled(settings) {
    return settings?.chat?.[SETTING_KEY] !== false;
}

// ── 응답 흔적 ─────────────────────────────────────────────────

const WEB_TOOL = /^web_(search|fetch)/;
function webBlock(block) {
    if (!isObj(block)) return false;
    if (block.type === 'server_tool_use') return WEB_TOOL.test(str(block.name));
    return /^web_(search|fetch)_tool_result$/.test(str(block.type));
}
function webUsage(usage) {
    return Number(usage?.server_tool_use?.web_search_requests) > 0;
}

/**
 * 응답 조각(스트림 한 덩이 또는 전체 응답)에 웹 검색을 쓴 흔적이 있으면 그 종류, 없으면 null.
 * @returns {'claude'|'openai'|'gemini'|'citations'|null}
 */
export function webSearchEvidence(json) {
    if (!isObj(json)) return null;
    // Claude — 스트림(content_block_start · message_start · message_delta) · 전체 응답(message) · 실리태번 서버가 감싼 응답(choices + content)
    if (json.type === 'content_block_start' && webBlock(json.content_block)) return 'claude';
    if (Array.isArray(json.content) && json.content.some(webBlock)) return 'claude';
    if (webUsage(json.usage) || webUsage(json.message?.usage) || webUsage(json.delta?.usage)) return 'claude';
    // OpenAI 계열 — url_citation 주석(chat completions · OpenRouter web 플러그인), Responses 의 web_search_call
    if (Array.isArray(json.choices)) {
        for (const choice of json.choices) {
            const ann = choice?.message?.annotations ?? choice?.delta?.annotations;
            if (Array.isArray(ann) && ann.some(a => a?.type === 'url_citation')) return 'openai';
        }
    }
    if (Array.isArray(json.output) && json.output.some(item => item?.type === 'web_search_call')) return 'openai';
    if (json.type === 'response.output_item.added' && json.item?.type === 'web_search_call') return 'openai';
    if (typeof json.type === 'string' && json.type.startsWith('response.web_search_call.')) return 'openai';
    // Gemini — google_search 도구의 groundingMetadata
    if (Array.isArray(json.candidates)) {
        for (const candidate of json.candidates) {
            const g = candidate?.groundingMetadata;
            if (isObj(g) && ((Array.isArray(g.webSearchQueries) && g.webSearchQueries.length) || (Array.isArray(g.groundingChunks) && g.groundingChunks.length))) return 'gemini';
        }
    }
    // Perplexity · xAI 등 — citations / search_results
    if ((Array.isArray(json.citations) && json.citations.length) || (Array.isArray(json.search_results) && json.search_results.length)) return 'citations';
    return null;
}

// ── 글 다루기 ─────────────────────────────────────────────────

export function normalizeText(text) {
    return str(text).replace(/\s+/g, ' ').trim();
}

/** 메시지 content(문자열 · 조각 배열) → 글. 그림 같은 조각은 뺀다 */
export function textOf(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map(part => (typeof part === 'string' ? part : str(part?.text))).filter(Boolean).join('\n');
    if (isObj(content)) return str(content.text);
    return '';
}

/** 블록 서명: 정리한 글의 앞 40자(짧은 글은 전부, 4자 미만은 없음). 앞머리에 {{random}} 같은 바뀌는 매크로가 있을 수 있어 그다음 40자도 */
export function signatures(text) {
    const n = normalizeText(text);
    if (n.length < 4) return [];
    if (n.length <= SIG_LEN) return [n];
    const out = [n.slice(0, SIG_LEN)];
    if (n.length >= SIG_LEN * 2) out.push(n.slice(SIG_LEN, SIG_LEN * 2));
    return out;
}

/** 확장 주입(extension_prompts) 키 → 블록 종류 · 이름. 안 보낼 것(quiet · 스토리 스트링)은 null */
export function labelExtensionPrompt(key) {
    const k = str(key);
    if (!k || k === 'QUIET_PROMPT' || k === '__STORY_STRING__') return null;
    if (k === '1_memory') return { kind: '기억', name: '요약' };
    if (k === '2_floating_prompt') return { kind: '작가의 노트', name: '' };
    if (k === '3_vectors') return { kind: '기억', name: '벡터' };
    if (k === '4_vectors_data_bank') return { kind: '기억', name: '데이터 뱅크' };
    if (k.startsWith('DEPTH_PROMPT')) return { kind: '카드', name: '캐릭터 노트' };
    if (k.startsWith('customDepthWI') || k.startsWith('customWIOutlet_')) return { kind: '로어북', name: '' };
    if (k.startsWith('script_inject_')) return { kind: '프롬프트', name: '주입' };
    if (/memor|recall|summar|chroma|기억/i.test(k)) return { kind: '기억', name: '' };   // 기억 확장들 — 이름은 적지 않는다
    return { kind: '확장', name: k.replace(/^\d+_/, '') };
}

/** 프롬프트 관리자 순서(prompt_order)에서 이 캐릭터에 켜진 항목 식별자. 순서 정보가 없으면 null(= 모두) */
export function enabledPromptIds(promptOrder, characterId) {
    if (!Array.isArray(promptOrder) || !promptOrder.length) return null;
    const pick = id => promptOrder.find(entry => String(entry?.character_id) === String(id));
    const entry = pick(characterId) ?? pick(100001) ?? pick(100000) ?? promptOrder[0];
    if (!Array.isArray(entry?.order)) return null;
    return new Set(entry.order.filter(o => o && o.enabled !== false).map(o => String(o.identifier)));
}

// ── 출처 블록 ─────────────────────────────────────────────────

const NAME_PREFIX = /^[^\n:]{1,60}: /;
const COVERED = 0.7;   // 메시지 글자의 이만큼이 블록으로 덮였으면 따로 블록을 만들지 않는다

/** 채팅 배열 → 서명 → 번호 (기록 블록에 번호를 달 때). 같은 서명이 둘이면 뒤의 것 */
export function makeChatIndex(chat) {
    const map = new Map();
    if (!Array.isArray(chat)) return map;
    chat.forEach((m, i) => { const sig = signatures(m?.mes)[0]; if (sig) map.set(sig, i); });
    return map;
}

function historyIndex(index, norm) {
    if (!index?.size) return null;
    for (const t of [norm, norm.replace(NAME_PREFIX, '')]) {
        const sig = signatures(t)[0];
        if (sig && index.has(sig)) return index.get(sig);
    }
    return null;
}

function kindRank(kind) {
    const i = KIND_ORDER.indexOf(kind);
    return i < 0 ? KIND_ORDER.length : i;
}

/**
 * 보낸 메시지(sent: [{role, content|text, name?}]) + 후보(sources: [{kind, name, text}]) → 블록 [{kind, name, text}] (종류 순서).
 * chatIndex: makeChatIndex(chat) — 기록 블록에 번호를 달 때 (없으면 번호 없이).
 */
export function buildOrigin(sent, sources, chatIndex) {
    const messages = (Array.isArray(sent) ? sent : [])
        .map(m => ({ role: str(m?.role) || 'system', name: str(m?.name), text: normalizeText(typeof m?.text === 'string' ? m.text : textOf(m?.content)) }))
        .filter(m => m.text);
    const systemText = messages.filter(m => m.role === 'system').map(m => m.text).join('\n');
    const otherText = messages.filter(m => m.role !== 'system').map(m => m.text).join('\n');
    const blocks = [];
    const sigs = [];   // 찾은 블록의 서명 (blocks 와 같은 순서) — 메시지가 어느 블록에 덮였는지 볼 때
    for (const src of Array.isArray(sources) ? sources : []) {
        const text = normalizeText(src?.text);
        const list = signatures(text);
        if (!list.length) continue;
        const sig = list.find(s => systemText.includes(s)) ?? list.find(s => otherText.includes(s));
        if (!sig) continue;
        blocks.push({ kind: str(src.kind) || '프롬프트', name: str(src.name), text });
        sigs.push(sig);
    }
    for (const m of messages) {
        if (/^example_(user|assistant)$/.test(m.name)) { blocks.push({ kind: '카드', name: '예시 대화', text: m.text }); continue; }
        let covered = 0;
        sigs.forEach((sig, k) => { if (m.text.includes(sig)) covered += blocks[k].text.length; });
        if (covered >= m.text.length * COVERED) continue;
        if (m.role === 'system') { blocks.push({ kind: '프롬프트', name: '', text: m.text }); continue; }
        const i = historyIndex(chatIndex, m.text);
        blocks.push({ kind: '기록', name: i === null ? '' : `#${i}`, text: m.text });
    }
    return blocks.map((block, i) => ({ block, i })).sort((a, b) => kindRank(a.block.kind) - kindRank(b.block.kind) || a.i - b.i).map(x => x.block);
}

/** 기억에 둘 기록의 크기(글자 수) */
export function originSize(record) {
    const sum = list => (Array.isArray(list) ? list : []).reduce((n, item) => n + str(item?.text).length, 0);
    return sum(record?.sent) + sum(record?.sources);
}

/** Map(넣은 순서 = 오래된 것부터) 을 ORIGIN_KEEP 안으로 — 오래된 기록부터 버린다 */
export function trimOrigins(map, keep = ORIGIN_KEEP) {
    let total = 0;
    for (const record of map.values()) total += Number(record?.size) || 0;
    for (const key of [...map.keys()]) {
        if (map.size <= keep.entries && total <= keep.chars) break;
        total -= Number(map.get(key)?.size) || 0;
        map.delete(key);
    }
    return map;
}

// ── 낱말 ──────────────────────────────────────────────────────

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** text 의 offset 자리에 있는 낱말(글자 · 숫자 덩이). 낱말 끝 바로 뒤에 놓인 커서는 그 낱말로 */
export function wordAt(text, offset) {
    const s = str(text);
    let i = Math.min(Math.max(0, Math.trunc(Number(offset) || 0)), s.length);
    if (!(i < s.length && WORD_CHAR.test(s[i])) && i > 0 && WORD_CHAR.test(s[i - 1])) i -= 1;
    if (!(i < s.length && WORD_CHAR.test(s[i]))) return null;
    let start = i, end = i + 1;
    while (start > 0 && WORD_CHAR.test(s[start - 1])) start--;
    while (end < s.length && WORD_CHAR.test(s[end])) end++;
    return { word: s.slice(start, end), start, end };
}

/** 한국어 조사 — 끝에 붙은 것 하나만 (긴 것부터). 남는 글이 2자 이상일 때만 뗀다 */
const JOSA = /(?:에서는|으로부터|으로써|으로서|에게서|한테서|에게는|께서는|이라고|이라서|이라도|이라면|이든지|부터|까지|에서|에게|한테|으로|께서|이다|였다|이며|이고|이야|이나|이란|라고|라서|라도|라면|처럼|보다|마다|밖에|조차|은|는|이|가|을|를|의|에|와|과|도|만|로|께|야|나|란)$/;
export function stemKorean(word) {
    const w = str(word);
    if (!/[가-힣]$/.test(w)) return w;
    const m = JOSA.exec(w);
    if (!m) return w;
    const stem = w.slice(0, w.length - m[0].length);
    return stem.length >= MIN_WORD ? stem : w;
}

/** 찾을 열쇠: 낱말 그대로 + 조사를 뗀 것 (소문자, 2자 이상, 중복 없이) */
// 6.3.x 일본어: 띄어쓰기가 없어 꾹 누른 「낱말」이 경칭 · 조사 · 문장까지 붙는다 — 끝의 경칭 · 조사를 뗀 말, 가타카나 덩이(이름)도 열쇠로
// 경칭 · 조사는 한자 · 가타카나 뒤에서만 뗀다 — 히라가나 낱말(かえで · きっと)의 끝 글자를 조사로 떼지 않게
const JA_TAIL = /(?<=[\p{Script=Han}ァ-ヺー])(?:様|さま|さん|くん|君|ちゃん|殿|先輩|先生|は|が|の|を|に|へ|と|も|や|で|から|まで|より)+$/u;
const KATAKANA_RUN = /[ァ-ヺー]{2,}/gu;
/** 찾을 열쇠 (소문자). aliasesOf: 이름의 다른 표기(영 · 한 · 일 — 이름 다리)를 주는 함수 — 없으면 예전 열쇠만.
 *  at: 낱말 안에서 누른 자리 — 주면 그 자리의 가타카나 덩이만 열쇠로 (일본어 「낱말」은 문장 한 토막이라 다른 데 있는 외래어 · 이름으로 찾지 않게) */
export function searchKeys(word, { aliasesOf, at } = {}) {
    const w = str(word).trim();
    const out = [], forms = [];
    const add = k => {
        const form = str(k).trim(), low = form.toLowerCase();
        if (low.length >= MIN_WORD && !out.includes(low)) { out.push(low); forms.push(form); }
    };
    for (const k of [w, stemKorean(w)]) add(k);
    add(w.replace(JA_TAIL, ''));
    for (const m of w.matchAll(KATAKANA_RUN)) {
        if (!/[ァ-ヺ]/u.test(m[0])) continue;                                                  // 'ーー' 처럼 늘임표만인 덩이는 낱말이 아니다
        if (Number.isFinite(at) && (at < m.index || at > m.index + m[0].length)) continue;   // 누른 덩이만
        add(m[0]);
    }
    if (typeof aliasesOf === 'function') {
        for (const k of [...forms]) {
            if (/^\p{Ll}/u.test(k)) continue;   // 소문자로 시작하는 라틴 낱말(it · scale)은 이름이 아니다 — 다리의 이름꼴 규칙
            let more = [];
            try { more = aliasesOf(k) || []; } catch { more = []; }
            for (const a of Array.isArray(more) ? more : []) add(a);
        }
    }
    return out;
}

export function blockLabel(block) {
    return block?.name ? `${block.kind} · ${block.name}` : str(block?.kind);
}

/** 낱말이 든 블록의 이름표 (종류 순서, 같은 이름표는 한 번, 최대 max) */
export function findOrigins(blocks, word, max = MAX_LABELS, options = {}) {
    const keys = searchKeys(word, options);
    const labels = [];
    if (!keys.length || !Array.isArray(blocks)) return labels;
    for (const block of blocks) {
        const text = str(block?.text).toLowerCase();
        if (!keys.some(k => text.includes(k))) continue;
        const label = blockLabel(block);
        if (!labels.includes(label)) labels.push(label);
        if (labels.length >= max) break;
    }
    return labels;
}

/** 칩 한 줄: 이름표들 ' / ' 로, 없으면 기록이 없을 때 「기록 없음」, 번역문을 보고 있으면 「번역문 · 못 찾음」, 웹 검색을 쓴 답이면 「검색/지어냄」, 아니면 「지어냄」 */
export function chipText(labels, { searched = false, hasRecord = true, translated = false } = {}) {
    if (Array.isArray(labels) && labels.length) return labels.slice(0, MAX_LABELS).join(' / ');
    if (!hasRecord) return '기록 없음';
    if (translated) return '번역문 · 못 찾음';   // 번역 낱말은 원문 프롬프트와 말이 달라 못 찾을 수 있다 — 「지어냄」이라 단정하지 않는다
    return searched ? '검색/지어냄' : '지어냄';
}
