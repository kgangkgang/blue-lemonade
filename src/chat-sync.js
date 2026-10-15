// 6.7.0 다른 기기에서 바뀜 알림 (사용자: PC 에서 고친 번역을 열려 있던 폰이 옛 내용으로 다시 저장해 덮어썼다 — Syncthing 으로 data 를 나눠 씀)
//
// 실리태번의 integrity 검사는 채팅마다 한 번 정해지는 값이라(chat_metadata.integrity) 같은 채팅을 두 기기가 열면 서로 덮어써도 막지 않는다.
// 그래서 서버의 채팅 파일 정보만 가끔 보고, 우리가 마지막으로 본 것과 다르면
//   - 채팅 위에 얇은 띠 「다른 기기에서 이 채팅이 바뀌었어요 · 새로 불러오기」
//   - 그 상태에서 저장하려 하면 덮어쓰기 전에 한 번 묻는다 (새로 불러오기 · 그래도 저장 · 닫으면 이번 저장만 미룸)
// 서버 파일의 integrity 가 지금 채팅과 다르면 실리태번이 스스로 막고 묻는다 — 그때는 묻지 않고 실리태번 흐름에 맡긴다.
//
// 보는 때: 채팅을 연 뒤 한 번 · 탭이 다시 보일 때 · 저장 직전(10초 안에 봤으면 건너뜀) · 보이는 동안 60초마다 (숨은 탭은 멈춤).
// 보는 법 (서버 플러그인 없이 실리태번 기존 API 만 — 우리 ZIP 도우미 플러그인은 관리자 · 따로 설치라 폰에 없을 수 있다):
//   ① /api/chats/recent 에 지금 채팅 하나만 pinned 로 넣고 max 0 — 그 파일 하나만 읽어 메시지 수 · 크기(반올림된 글) · 마지막 메시지(글은 지문만 기억) · 그 시각.
//      이것만으로는 가운데 메시지의 번역만 고친 것을 큰 파일에서 놓칠 수 있다 (크기가 '3.12MB' 처럼 반올림돼 오고, 시각은 파일이 아니라 마지막 메시지의 시각).
//   ② 그래서 주기 확인 말고(탭이 보일 때 · 저장 직전 · 기준 잡을 때)는 /api/characters/get 의 date_last_chat(그 캐릭터 채팅 파일들의 가장 늦은 수정 시각)
//      · chat_size(바이트 합)도 본다 — 정확하다. 같은 캐릭터의 다른 채팅이 다른 기기에서 바뀌어도 걸리지만(드묾) 새로 불러오면 그대로라 해가 없다.
//      이 기기에서 같은 캐릭터의 다른 채팅을 저장 · 이름 바꾸기 · 지우면 기준을 다시 잡는다. 그룹 채팅은 ①만.
//   이 API 가 없는 옛 실리태번이면 조용히 멈춘다. 끄면(syncWatch=false) 타이머 · 이벤트를 걷고 fetch 감싸개는 그냥 통과한다.

const PERIOD = 60000, FRESH = 10000, REBASE = 1500, LOAD_WAIT = 1500;
const SAVE_PATHS = ['/api/chats/save', '/api/chats/group/save'];
const WRITE_PATHS = ['/api/chats/rename', '/api/chats/delete', '/api/chats/import', '/api/chats/group/delete', '/api/chats/group/import'];   // 이 기기의 다른 채팅 파일 바꿈 → 기준 다시

/** 지금 채팅을 /api/chats/recent 로 찾을 정보. 채팅이 없으면 null */
export function chatTarget(ctx) {
    if (!ctx) return null;
    const id = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId;
    if (!id) return null;
    if (ctx.groupId) return { file_name: `${id}.jsonl`, group: ctx.groupId, key: `g|${id}` };
    const character = ctx.characters?.[ctx.characterId];
    if (!character?.avatar || !character.chat) return null;
    return { file_name: `${character.chat}.jsonl`, avatar: character.avatar, key: `c|${character.avatar}|${character.chat}` };
}

/** 저장 본문에서 채팅 키 (perf/recovery.js bodyKey 와 같은 규칙 — 그 파일 12KB 를 불러오지 않으려고 따로 둔다). 못 읽으면 null */
export function saveBodyKey(path, body) {
    if (typeof body !== 'string') return null;
    try {
        if (path === '/api/chats/group/save') {
            const m = /^\{"id":("(?:[^"\\]|\\.)*"),/.exec(body.slice(0, 1024));
            return m ? `g|${JSON.parse(m[1])}` : null;
        }
        const head = /^\{"ch_name":"(?:[^"\\]|\\.)*","file_name":("(?:[^"\\]|\\.)*"),"chat":/.exec(body.slice(0, 4096));
        const tail = /,"avatar_url":("(?:[^"\\]|\\.)*"),"force":(?:true|false)\}$/.exec(body.slice(-4096));
        return head && tail ? `c|${JSON.parse(tail[1])}|${JSON.parse(head[1])}` : null;
    } catch { return null; }
}

export function pathOf(input) {
    try { return new URL(typeof input === 'string' ? input : input?.url ?? String(input), location.href).pathname; } catch { return ''; }
}

/** 글 대신 기억하는 짧은 지문 (길이 + 해시) */
export function textKey(text) {
    const s = String(text ?? '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    return `${s.length}:${h >>> 0}`;
}

/** 서버의 채팅 파일 정보 하나. 파일이 없으면 { missing: true }. API 가 없으면 Error('unsupported'). exact 면 캐릭터의 정확한 값도 (②) */
export async function fetchChatStat(target, { fetcher = fetch, headers = {}, metadata = false, exact = false } = {}) {
    const post = (url, body) => fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const pin = target.group ? { file_name: target.file_name, group: target.group } : { file_name: target.file_name, avatar: target.avatar };
    const r = await post('/api/chats/recent', { max: 0, pinned: [pin], metadata });
    if (r.status === 404 || r.status === 405) throw new Error('unsupported');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const stat = pickStat(await r.json(), target);
    if (exact && target.avatar && !stat.missing) {
        try {
            const c = await post('/api/characters/get', { avatar_url: target.avatar });
            if (c.ok) { const j = await c.json(); if (Number.isFinite(Number(j?.date_last_chat))) { stat.charMtime = Number(j.date_last_chat); stat.charSize = Number(j.chat_size) || 0; } }
        } catch { /* ①만으로 */ }
    }
    return stat;
}
export function pickStat(list, target) {
    const hit = Array.isArray(list) ? list.find(x => x?.file_name === target.file_name && (target.group ? x.group === target.group : x.avatar === target.avatar)) : null;
    if (!hit) return { missing: true };
    return { last: String(hit.last_mes ?? ''), size: String(hit.file_size ?? ''), items: Number(hit.chat_items) || 0, mes: textKey(hit.mes), integrity: hit.chat_metadata?.integrity };
}
/** 우리가 본 것(base)과 서버(now)가 다른가 — 정확한 값(②)은 둘 다 있을 때만 */
export function chatChanged(base, now) {
    if (!base || !now) return false;
    if (!!base.missing !== !!now.missing) return true;
    if (now.missing) return false;
    if (base.last !== now.last || base.size !== now.size || base.items !== now.items || base.mes !== now.mes) return true;
    return base.charMtime !== undefined && now.charMtime !== undefined && (base.charMtime !== now.charMtime || base.charSize !== now.charSize);
}

/**
 * 감시 본체 (검사에서 env 를 바꿔 끼운다).
 * env: getContext · fetcher(진짜 fetch) · now · setTimer · clearTimer · hidden() · ask() → 'reload'|'save'|'later' · strip(show:boolean) · busy() 답 생성 중?
 */
export function createChatSync(env) {
    const st = { on: false, target: null, base: null, stale: false, saving: 0, rebase: false, lastCheck: 0, timer: 0, rebaseTimer: 0, asking: null, passKey: '', unsupported: false, pendingReload: false, checking: null, gen: 0 };
    const ctx = () => env.getContext();
    const headers = () => { try { return ctx().getRequestHeaders(); } catch { return {}; } };
    const stat = (target, { metadata = false, exact = false } = {}) => fetchChatStat(target, { fetcher: env.fetcher, headers: headers(), metadata, exact });
    const schedule = () => {
        env.clearTimer(st.timer); st.timer = 0;
        if (st.on && !st.unsupported && !env.hidden()) st.timer = env.setTimer(() => { void check('period').finally(schedule); }, PERIOD);
    };
    const setStale = (value) => { if (st.stale === value) return; st.stale = value; env.strip(value); };

    /** 서버를 한 번 본다. 처음 · 우리 저장 뒤면 기준을 새로 잡고, 아니면 바뀌었나 본다 */
    function check(reason = '') {
        if (!st.on || st.unsupported || st.saving || st.asking || st.pendingReload) return Promise.resolve(null);
        if ((reason === 'period' || reason === 'visible') && env.hidden()) return Promise.resolve(null);   // 기준 잡기 · 저장 직전은 숨은 탭에서도 (한 번뿐)
        // 이미 도는 확인은 그 전에 읽은 값일 수 있다 — 탭이 보일 때 · 저장 직전이면 끝난 뒤 한 번 더 본다
        if (st.checking) return reason === 'visible' || reason === 'save' ? st.checking.then(() => check(`${reason}-again`)) : st.checking;
        const target = chatTarget(ctx());
        if (!target) { st.target = null; st.base = null; setStale(false); return Promise.resolve(null); }
        if (st.target?.key !== target.key) { st.target = target; st.base = null; st.rebase = false; setStale(false); }
        const gen = st.gen;
        st.checking = (async () => {
            try {
                const now = await stat(target, { exact: reason !== 'period' });
                st.lastCheck = env.now();
                if (st.target?.key !== target.key || st.saving || gen !== st.gen) return null;   // 그 사이 채팅이 바뀌었거나 우리 저장이 끼었다
                if (!st.base || st.rebase) { st.base = now; st.rebase = false; return now; }
                if (chatChanged(st.base, now)) setStale(true);
                else if (st.base.charMtime === undefined && now.charMtime !== undefined) st.base = { ...st.base, charMtime: now.charMtime, charSize: now.charSize };
                return now;
            } catch (error) {
                if (error?.message === 'unsupported') { st.unsupported = true; env.clearTimer(st.timer); }
                return null;
            } finally { st.checking = null; }
        })();
        return st.checking;
    }

    /** 기준 잡기 — 저장 · 다시 불러오기 · 묻는 창이 끝날 때까지 1초씩 미룬다 (기준 없이 다음 확인을 맞으면 그 사이 바뀜을 놓친다) */
    function baseline(wait, tries) {
        env.setTimer(() => {
            if (!st.on || st.base) return;
            if (tries > 0 && (st.saving || st.asking || st.pendingReload || st.checking)) { baseline(1000, tries - 1); return; }
            void check('load');
        }, wait);
    }

    /** 채팅을 새로 열었을 때: 띠를 걷고 기준을 다시 잡는다 (불러온 직후 실리태번이 저장할 수 있어 잠깐 기다림) */
    function reset() {
        st.target = null; st.base = null; st.rebase = false; st.passKey = ''; st.pendingReload = false;
        setStale(false);
        if (!st.on) return;
        baseline(LOAD_WAIT, 8);
        schedule();
    }

    async function reloadNow() {
        st.pendingReload = true;
        try {
            for (let n = 0; n < 600 && env.busy(); n++) await new Promise(r => env.setTimer(r, 500));   // 답을 받는 중이면 끝난 뒤에
            setStale(false);
            await ctx().reloadCurrentChat();
        } finally { st.pendingReload = false; }
    }

    /** 저장 요청 직전: 'save' 그대로 보냄 · 'skip' 보내지 않고 성공으로 돌려줌 */
    async function beforeSave(path, body) {
        if (!st.on || st.unsupported) return 'save';
        if (st.pendingReload) return 'skip';   // 새로 불러오기로 정했으면 그 전까지의 옛 내용 저장은 보내지 않는다
        const target = chatTarget(ctx());
        if (!target) return 'save';
        const key = saveBodyKey(path, body);
        if (key !== null && key !== target.key) return 'save';                    // 다른 채팅 파일(북마크 · 분기 저장 등)
        if (st.target?.key !== target.key) return 'save';                         // 아직 이 채팅의 기준이 없다
        if (!st.stale && st.base && !st.rebase && env.now() - st.lastCheck > FRESH) {
            await Promise.race([check('save'), new Promise(r => env.setTimer(r, 3000))]);   // 느리면 기다리지 않는다
        }
        if (!st.stale || st.passKey === target.key) return 'save';
        // 서버 파일이 아예 다른 채팅이면(integrity 다름) 실리태번이 막고 묻는다 — 겹쳐 묻지 않는다
        try {
            const mine = ctx().chatMetadata?.integrity, server = (await stat(target, { metadata: true })).integrity;
            if (mine && server && mine !== server) { st.passKey = target.key; return 'save'; }
        } catch { /* 못 보면 우리가 묻는다 */ }
        st.asking ??= Promise.resolve().then(() => env.ask()).catch(() => 'later').finally(() => { st.asking = null; });
        const answer = await st.asking;
        if (answer === 'save') { st.passKey = target.key; return 'save'; }
        if (answer === 'reload') { void reloadNow(); return 'skip'; }
        return 'skip';   // 닫음: 이번 저장만 미룸 (띠는 남고, 다음 저장 때 다시 묻는다)
    }

    /** 이 기기가 다른 채팅 파일을 바꿨다: 성공하면 다음 확인 값을 기준으로 (띠는 건드리지 않는다) */
    async function afterWrite(pending) {
        st.gen++;
        const response = await pending;
        if (response?.ok && st.base) { st.rebase = true; env.clearTimer(st.rebaseTimer); st.rebaseTimer = env.setTimer(() => { void check('rebase'); }, REBASE); }
        return response;
    }

    /** fetch 감싸개 안에서 부른다 */
    async function onSave(input, init, send) {
        const path = pathOf(input);
        let verdict = 'save';
        try { verdict = await beforeSave(path, init?.body); } catch { verdict = 'save'; }
        if (verdict === 'skip') return new Response('{"result":"ok"}', { status: 200, headers: { 'Content-Type': 'application/json' } });
        const target = st.target, key = saveBodyKey(path, init?.body);
        if (key !== null && key !== target?.key) return afterWrite(send());   // 다른 채팅 파일 — 띠는 그대로, 캐릭터 값(②)만 기준 다시
        st.saving++; st.gen++;
        try {
            const response = await send();
            if (response.ok && target && target.key === chatTarget(ctx())?.key) {
                setStale(false); st.passKey = ''; st.rebase = true;
                env.clearTimer(st.rebaseTimer); st.rebaseTimer = env.setTimer(() => { void check('rebase'); }, REBASE);
            }
            return response;
        } finally { st.saving--; }
    }

    function setOn(value) {
        value = !!value;
        if (st.on === value) return;
        st.on = value;
        if (value) reset();
        else { env.clearTimer(st.timer); env.clearTimer(st.rebaseTimer); st.timer = 0; st.base = null; st.target = null; setStale(false); }
    }
    function onVisible() { if (!st.on) return; if (env.hidden()) { env.clearTimer(st.timer); st.timer = 0; return; } void check('visible'); schedule(); }

    return { state: st, check, reset, beforeSave, onSave, setOn, onVisible, reloadNow, isSave: (input, init) => String(init?.method ?? input?.method ?? 'GET').toUpperCase() === 'POST' && SAVE_PATHS.includes(pathOf(input)),
        isWrite: (input, init) => String(init?.method ?? input?.method ?? 'GET').toUpperCase() === 'POST' && WRITE_PATHS.includes(pathOf(input)), afterWrite };
}

// ── 화면 (실제 실리태번에서만) ────────────────────────────────

let sync = null;

function stripEl(show) {
    let el = document.getElementById('bl-sync-strip');
    if (!show) { el?.remove(); return; }
    if (el) return;
    const host = document.getElementById('sheld'), chat = document.getElementById('chat');
    if (!host || !chat) return;
    el = document.createElement('div');
    el.id = 'bl-sync-strip';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span>다른 기기에서 이 채팅이 바뀌었어요</span><button type="button" class="bl-sync-reload">새로 불러오기</button>';
    el.querySelector('button').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await sync?.reloadNow(); } catch (error) { console.warn('[Blue Lemonade] 채팅 새로 불러오기', error); button.disabled = false; }
    });
    host.insertBefore(el, chat);
}

async function askOverwrite() {
    const ctx = SillyTavern.getContext();
    const box = document.createElement('div');
    box.className = 'bl-sync-ask';
    box.innerHTML = '<h3>다른 기기에서 이 채팅이 바뀌었어요</h3><p>지금 저장하면 다른 기기에서 바꾼 내용을 이 화면의 옛 내용으로 덮어써요.</p><p class="salty-note">새로 불러오면 이 기기에서 방금 바꾼 것(새 메시지 포함)은 저장되지 않아요.</p>';
    const result = await ctx.callGenericPopup(box, ctx.POPUP_TYPE.CONFIRM, '', { okButton: '새로 불러오기', cancelButton: '그래도 저장' });
    if (result === ctx.POPUP_RESULT.AFFIRMATIVE) return 'reload';
    if (result === ctx.POPUP_RESULT.NEGATIVE) return 'save';
    return 'later';
}

const generating = () => { const stop = document.getElementById('mes_stop'); return !!stop && getComputedStyle(stop).display !== 'none'; };

function install() {
    const ctx = SillyTavern.getContext();
    const native = window.fetch;
    sync = createChatSync({
        getContext: () => SillyTavern.getContext(),
        fetcher: (...args) => native.apply(window, args),
        now: () => Date.now(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: id => clearTimeout(id),
        hidden: () => document.visibilityState === 'hidden', ask: askOverwrite, strip: stripEl, busy: generating,
    });
    // 바깥 감싸개 하나 — 끄면 그냥 통과. 다른 확장의 감싸개(성능 보조의 저장 정리 등)는 안쪽에 그대로 남는다
    window.fetch = function chatSyncFetch(input, init) {
        if (sync.state.on && sync.isSave(input, init)) return sync.onSave(input, init, () => native.call(this, input, init));
        if (sync.state.on && sync.isWrite(input, init)) return sync.afterWrite(native.call(this, input, init));
        return native.call(this, input, init);
    };
    ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, () => sync.reset());
    document.addEventListener('visibilitychange', () => sync.onVisible());
}

/** features.js 가 부른다 (켤 때 처음 불러온다) */
export function syncChatWatch(on) {
    if (!sync) { if (!on) return; install(); }
    sync.setOn(on);
}
/** 콘솔 · 검사용: 지금 상태 (기준 · 띠 · 저장 중 수) */
export const chatWatchState = () => (sync ? { ...sync.state, checking: !!sync.state.checking, asking: !!sync.state.asking } : null);
