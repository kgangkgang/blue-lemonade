// Korean chat-input shortcuts. No model call, script evaluation or chat mutation.
// Numbers match SillyTavern's visible #messageId, starting at #0.
const EXAMPLE = '/240번 채팅으로 가기 · /맨 아래로 · /대화 검색 단어 · /생성 중지';
const HELP = `${EXAMPLE} · 번호는 화면의 #0부터예요.`;
const MOVE = '(?:가기|가|가줘|가주세요|이동|이동하기|이동해|이동해줘|이동해주세요|점프|보기|보여줘|보여주세요)?';
const NUMBER = new RegExp(`^#?([+-]?[\\d,.]+)(?:번)?(?:채팅|메시지|메세지|대화)?(?:으로|로)?${MOVE}$`);
const REVERSED = new RegExp(`^(?:채팅|메시지|메세지|대화)#?([+-]?[\\d,.]+)(?:번)?(?:으로|로)?${MOVE}$`);
const NOUNS = ['', '채팅', '메시지', '메세지', '대화'];
const MOVES = ['', '가기', '가', '가줘', '가주세요', '이동', '이동하기', '이동해', '이동해줘', '이동해주세요', '점프', '보기', '보여줘', '보여주세요'];
const TAILS = ['', '번'].flatMap(number => NOUNS.flatMap(noun => ['', '으로', '로'].flatMap(particle => MOVES.map(move => number + noun + particle + move))));
const REVERSED_TAILS = ['', '번'].flatMap(number => ['', '으로', '로'].flatMap(particle => MOVES.map(move => number + particle + move)));
const PHRASES = [
    ...['', '채팅', '채팅의', '대화', '대화의'].flatMap(prefix => ['위', '맨위', '상단', '최상단', '맨처음', '처음', '첫메시지', '첫채팅'].flatMap(noun => ['', '으로', '로'].flatMap(particle => ['', '가기', '이동', '이동하기', '가줘', '보여줘'].map(move => [prefix + noun + particle + move, 'top'])))),
    ...['', '채팅', '채팅의', '대화', '대화의'].flatMap(prefix => ['아래', '맨아래', '밑', '맨밑', '하단', '최하단', '끝', '맨끝', '마지막', '마지막메시지', '마지막채팅', '최신메시지'].flatMap(noun => ['', '으로', '로'].flatMap(particle => ['', '가기', '이동', '이동하기', '가줘', '보여줘'].map(move => [prefix + noun + particle + move, 'bottom'])))),
    ...['생성', '답변', '응답'].flatMap(noun => ['', '을'].flatMap(particle => ['중지', '정지', '멈춰', '멈추기', '중지해줘', '정지해줘', '멈춰줘'].map(move => [noun + particle + move, 'stop']))),
    ...['도움말', '명령어도움말', '자연어도움말'].map(word => [word, 'help']),
    ...['멈춰', '멈춰줘', '중지', '정지', '그만'].map(word => [word, 'stop']),
];
const SEARCH_PREFIXES = ['', '대화', '채팅', '현재대화', '현재채팅'].flatMap(noun => ['검색', '찾기', '찾아줘', '찾아주세요'].map(verb => noun + verb));

// Bounded comparison of known command words only; digits and search text never enter it.
function withinOneEdit(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++edits > 1) return false;
        if (a.length >= b.length) i++;
        if (b.length >= a.length) j++;
    }
    return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}

// Negation and other deliberate operations must never disappear as a "typo".
const NOT_A_TYPO = /(?:안|못|마$|하지마|가지마|말고|말아|않|금지|삭제|수정|재생성|취소|막기|차단|제거|초기화|저장|전송|정리|앞|뒤|상위|하위|다음|이전)/;
function uniqueCandidate(candidates) {
    if (candidates.size === 1) return candidates.values().next().value;
    if (candidates.size > 1) return { kind: 'invalid', message: '여러 뜻으로 읽혀요. /도움말의 표현으로 다시 적어 주세요.' };
    return null;
}

function typoSearch(raw) {
    const candidates = new Map();
    // Search needs a real whitespace boundary. Validate only its short command
    // prefix; negation, numbers, length and spelling inside the query are literal.
    for (const boundary of raw.slice(0, 21).matchAll(/[ \t]+/g)) {
        const prefix = raw.slice(0, boundary.index).normalize('NFKC').replace(/[ \t]/g, '');
        let query = raw.slice(boundary.index + boundary[0].length).trim();
        if (!query || !/^[가-힣]+$/.test(prefix) || NOT_A_TYPO.test(prefix)) continue;
        if (SEARCH_PREFIXES.some(expected => withinOneEdit(prefix, expected))) {
            if (/^(["']).*\1$/.test(query)) query = query.slice(1, -1).trim();
            if (query) candidates.set(query, { kind: 'search', query });
        }
    }
    return uniqueCandidate(candidates);
}

function slightTypo(raw, compact) {
    if (NOT_A_TYPO.test(compact) || /(?:^|\s)(?:안|못|마)(?:\s|$)/.test(raw)) return null;
    const candidates = new Map();
    const add = action => candidates.set(JSON.stringify(action), action);
    if (/^[가-힣]+$/.test(compact) && compact.length >= 3 && compact.length <= 64) {
        const explicitTop = /위|상단|처음|첫/.test(compact);
        const explicitBottom = /아래|밑|하단|끝|마지막|최신/.test(compact);
        for (const [phrase, kind] of PHRASES) {
            if (kind === 'top' && explicitBottom || kind === 'bottom' && explicitTop) continue;
            if (withinOneEdit(compact, phrase)) add({ kind });
        }
    }
    const numbered = compact.length <= 64 && compact.match(/^([가-힣]*)#?([+-]?[\d,.]+)([가-힣]*)$/);
    if (numbered) {
        const [, prefix, token, tail] = numbered;
        const index = Number(token.replaceAll(',', ''));
        if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(token) || !Number.isSafeInteger(index)) return null;
        if (!prefix) {
            // Bare short noise after a number is too ambiguous to correct.
            if (tail.length >= 3 && TAILS.some(expected => withinOneEdit(tail, expected))) add({ kind: 'jump', index });
        } else {
            for (const noun of NOUNS.slice(1)) {
                if (prefix === noun && REVERSED_TAILS.some(expected => withinOneEdit(tail, expected))) add({ kind: 'jump', index });
                else if (withinOneEdit(prefix, noun) && REVERSED_TAILS.includes(tail)) add({ kind: 'jump', index });
            }
        }
    }
    return uniqueCandidate(candidates);
}

/** Null means leave the input entirely to SillyTavern / installed extensions. */
export function parseNaturalSlash(input, commands = {}) {
    if (typeof input !== 'string' || !input.trim().startsWith('/')) return null;
    const raw = input.trim().slice(1).trim();
    const first = raw.split(/\s|\||:\}/)[0];
    if (Object.hasOwn(commands, first)) return null; // Never shadow an existing command.
    if (raw.startsWith(':') || raw.startsWith('{:')) return null; // Native QR / closure syntax.
    if (!raw || /^(?:도움말|명령어도움말|자연어도움말)$/.test(raw.replace(/\s/g, ''))) return { kind: 'help' };
    if (!/[가-힣]/.test(first) && !/^#?[+\-\d０-９]/.test(first)) return null;
    // Multiple statements / pasted paragraphs are never silently reduced to one action.
    if (/[\r\n|]/.test(raw)) return { kind: 'invalid', message: '자연어 명령은 한 줄에 하나씩 입력해 주세요.' };
    const search = raw.match(/^(?:(?:현재\s*)?(?:대화|채팅|체팅)\s*)?(?:검색|찾기|찾아줘|찾아주세요)(?:\s+(.+))?$/);
    if (search) {
        let query = (search[1] || '').trim();
        if (/^(["']).*\1$/.test(query)) query = query.slice(1, -1).trim();
        return query ? { kind: 'search', query } : { kind: 'invalid', message: '찾을 말을 붙여 주세요. 예: /대화 검색 약속' };
    }
    const searchTypo = typoSearch(raw);
    if (searchTypo) return searchTypo;
    // A small explicit spelling alias, only in command words. Search text / numbers
    // and registered extension command names are never guessed or corrected.
    const normalized = raw.normalize('NFKC');
    if (/\d[ \t]+\d/.test(normalized)) return { kind: 'invalid', message: '메시지 번호는 숫자 사이에 공백 없이 적어 주세요.' };
    const text = normalized.replace(/[ \t]/g, '').replaceAll('체팅', '채팅');
    const number = text.match(NUMBER) || text.match(REVERSED);
    if (number) {
        const token = number[1];
        const index = Number(token.replaceAll(',', ''));
        if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(token) || !Number.isSafeInteger(index)) {
            return { kind: 'invalid', message: '메시지 번호는 0 이상의 정수로 적어 주세요.' };
        }
        return { kind: 'jump', index };
    }
    if (/^(?:(?:채팅|대화)(?:의)?)?(?:위|맨위|상단|최상단|맨처음|처음|첫메시지|첫채팅)(?:으로|로)?(?:가기|이동|이동하기|가줘|보여줘)?$/.test(text)) return { kind: 'top' };
    if (/^(?:(?:채팅|대화)(?:의)?)?(?:아래|맨아래|밑|맨밑|하단|최하단|끝|맨끝|마지막|마지막메시지|마지막채팅|최신메시지)(?:으로|로)?(?:가기|이동|이동하기|가줘|보여줘)?$/.test(text)) return { kind: 'bottom' };
    if (/^(?:생성|답변|응답)(?:을)?(?:중지|정지|멈춰|멈추기|중지해줘|정지해줘|멈춰줘)$/.test(text)) return { kind: 'stop' };
    if (/^(?:멈춰|멈춰줘|중지|정지|그만)$/.test(text)) return { kind: 'stop' };
    const corrected = slightTypo(raw, text);
    if (corrected) return corrected;
    return { kind: 'invalid', message: '아직 모르는 명령이에요. /도움말에서 가능한 표현을 확인해 주세요.' };
}

export function naturalSlashLabel(action, chatLength = 0) {
    if (!action) return '';
    if (action.kind === 'help') return HELP;
    if (action.kind === 'invalid') return action.message;
    if (action.kind === 'stop') return '생성 중지';
    if (action.kind === 'search') return `대화에서 “${action.query}” 찾기`;
    const index = action.kind === 'top' ? 0 : action.kind === 'bottom' ? chatLength - 1 : action.index;
    if (!chatLength) return '먼저 대화를 열어 주세요.';
    if (index >= chatLength) return `없는 번호예요. 현재 대화는 #0~#${chatLength - 1}입니다.`;
    return `#${index} 메시지로 이동 · 화면 번호 기준(#0부터)`;
}

const chatIdentity = ctx => `${ctx.groupId ?? ''}/${ctx.characterId ?? ''}/${ctx.chatId ?? ctx.getCurrentChatId?.() ?? ''}`;
const normalizeSearch = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase();

/** Execute only fixed, read-only navigation / stop operations, never arbitrary STscript. */
export async function runNaturalSlash(action, ctx, searchState = {}) {
    if (action.kind === 'help' || action.kind === 'invalid') return { ok: false, message: naturalSlashLabel(action) };
    if (action.kind === 'stop') {
        if (typeof ctx.stopGeneration !== 'function') return { ok: false, message: '이 실리태번 버전에서는 생성 중지를 사용할 수 없어요.' };
        return { ok: true, message: ctx.stopGeneration() ? '생성을 멈췄어요.' : '진행 중인 생성이 없어요.' };
    }
    const chat = ctx.chat;
    if (!Array.isArray(chat) || !chat.length) return { ok: false, message: '먼저 대화를 열어 주세요.' };
    let index = action.kind === 'top' ? 0 : action.kind === 'bottom' ? chat.length - 1 : action.index;
    let found = null;
    let nextSearchState = null;
    if (action.kind === 'search') {
        const query = normalizeSearch(action.query);
        // Search all loaded chat data, including messages not yet rendered on screen.
        found = chat.flatMap((message, id) => [message?.mes, message?.extra?.display_text].some(text => normalizeSearch(text).includes(query)) ? [id] : []);
        if (!found.length) return { ok: false, message: `“${action.query}”을 찾지 못했어요.` };
        const identity = chatIdentity(ctx);
        const previous = searchState.query === query && searchState.identity === identity ? searchState.index : -1;
        index = found.find(id => id > previous) ?? found[0];
        nextSearchState = { query, identity, index };
    }
    if (!Number.isSafeInteger(index) || index < 0 || index >= chat.length) return { ok: false, message: `없는 번호예요. 현재 대화는 #0~#${chat.length - 1}입니다.` };
    const command = ctx.SlashCommandParser?.commands?.['chat-jump'];
    if (typeof command?.callback !== 'function') return { ok: false, message: '이 실리태번 버전에서는 메시지 이동을 사용할 수 없어요.' };
    // Native chat-jump renders older messages as necessary and highlights the destination.
    await command.callback({}, String(index));
    if (nextSearchState) Object.assign(searchState, nextSearchState);
    return { ok: true, index, message: found ? `검색 ${found.indexOf(index) + 1}/${found.length} · #${index} · 같은 명령을 다시 실행하면 다음 결과` : `#${index} 메시지로 이동했어요.` };
}

let started = false;

export function startNaturalSlash({ isEnabled = () => true } = {}) {
    if (started) return;
    const initial = globalThis.SillyTavern?.getContext?.();
    if (!initial) return;
    started = true;
    let busy = false;
    let hint = null;
    const searchState = {};
    const box = () => document.getElementById('send_textarea');
    const current = () => {
        if (!isEnabled()) return null;
        const ctx = SillyTavern.getContext();
        return { ctx, action: parseNaturalSlash(box()?.value, ctx.SlashCommandParser?.commands) };
    };
    function show(message, actionable = false) {
        if (!hint) {
            const host = document.getElementById('send_form');
            if (!host) return;
            hint = document.createElement('button');
            hint.id = 'bl-natural-slash';
            hint.type = 'button';
            hint.className = 'bl-natural-slash';
            hint.addEventListener('click', event => { event.preventDefault(); void execute(); });
            host.prepend(hint);
        }
        hint.textContent = message;
        hint.hidden = !message;
        hint.disabled = !actionable || busy;
    }
    function refresh() {
        const state = current();
        const action = state?.action;
        // The host reports these valid Korean shortcuts as unknown slash commands.
        // Hide that one non-floating completion surface only while this input has focus.
        document.body.toggleAttribute('data-bl-natural-slash', !!action && document.activeElement === box() && box().value.trim() !== '/');
        show(naturalSlashLabel(action, state?.ctx.chat?.length), !!action && !['invalid', 'help'].includes(action.kind));
    }
    async function execute() {
        const state = current();
        if (!state?.action || busy) return false;
        const input = box();
        const original = input.value;
        const identity = chatIdentity(state.ctx);
        busy = true;
        show('처리 중…');
        try {
            const result = await runNaturalSlash(state.action, state.ctx, searchState);
            const now = SillyTavern.getContext();
            if (chatIdentity(now) !== identity) { show('대화가 바뀌었어요. 현재 대화에서 다시 실행해 주세요.'); return true; }
            // Never erase text typed while older messages were being rendered.
            if (result.ok && input.value === original && state.action.kind !== 'search') {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (input.value === original || !input.value) show(result.message, result.ok && state.action.kind === 'search');
        } catch (error) {
            console.warn('[Blue Lemonade] 자연어 명령', error);
            if (input.value === original) show('명령을 실행하지 못했어요. 입력한 내용은 그대로 두었어요.');
        } finally {
            busy = false;
            if (input.value && input.value !== original) refresh();
            else if (hint && state.action.kind === 'search' && input.value === original) hint.disabled = false;
        }
        return true;
    }
    // Capture only recognized natural input. Regular ST commands keep their own handlers,
    // autocomplete, quoting and pipelines. No Generate() event or API call is started here.
    document.addEventListener('click', event => {
        if (!event.target.closest?.('#send_but') || !current()?.action) return;
        event.preventDefault(); event.stopImmediatePropagation(); void execute();
    }, true);
    document.addEventListener('keydown', event => {
        if (event.target !== box() || event.key !== 'Enter' || event.isComposing || event.keyCode === 229 || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return;
        const state = current();
        if (!state?.action || !state.ctx.shouldSendOnEnter?.()) return;
        event.preventDefault(); event.stopImmediatePropagation(); void execute();
    }, true);
    document.addEventListener('input', event => { if (event.target === box()) refresh(); });
    document.addEventListener('focusin', refresh);
    document.addEventListener('focusout', () => {
        document.body.removeAttribute('data-bl-natural-slash');
    });
    const types = initial.eventTypes || initial.event_types;
    if (types?.CHAT_CHANGED) initial.eventSource.on(types.CHAT_CHANGED, () => { Object.keys(searchState).forEach(key => delete searchState[key]); refresh(); });
    // Changing Blue Lemonade's usage mode must hide its input helper immediately.
    new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    refresh();
}
