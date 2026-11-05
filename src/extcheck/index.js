// 1.0.3 확장 충돌 검사 창 — 설정 › 확장 › 성능 보조 「확장 충돌 검사」 · /extconflict [GitHub 주소] 로 열어요.
//   누를 때만 받는 도구예요: 창을 열기 전에는 이 폴더의 모듈을 하나도 받지 않고 리스너 · 감시도 없어요(명령 이름만 index.js 가 걸어 둬요).
//   창을 닫으면 읽어 온 파일 글 · 결과를 버려요. 바깥 요청은 「받아서 검사」(GitHub) · 「AI 검토 보내기」(지금 연결 · 고른 프로필)를 누를 때 한 번씩뿐이에요.
import { compare, reportText, twinRows, LEVELS, aiRequest, parseAi, AI_VERDICTS, AI_LIMITS, parseGithubUrl, snippet, place } from './core.js';
import { readInstalled, readGithub, linkPlan, sourceText, clientVersion, OWN } from './source.js';
import { knownConflicts } from '../extension-folder.js';
import { showThemeModal } from '../modal.js';
import { getSettings, saveSettings } from '../settings.js';
import { copyPlain } from '../addons/perf/copy.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = () => { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } };
const AI_TOKENS = 1500, AI_TIMEOUT = 120000;
let open = null;

function store() {
    const s = getSettings();
    if (!s.extcheck || typeof s.extcheck !== 'object') s.extcheck = { aiConsent: false, profileId: '' };
    return s.extcheck;
}
const at = s => esc(place(s));

/** 창 열기 — url 이 오면 링크 칸을 채우고 「받을 곳」만 보여 줘요(받기는 단추를 눌러야) */
export async function openExtCheck({ url = '' } = {}) {
    if (open?.isConnected) { open.close(); }
    ensureStyle();
    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-xc';
    dialog.setAttribute('aria-labelledby', 'bl-xc-title');
    dialog.innerHTML = `<header class="bl-xc-head"><h3 id="bl-xc-title"><i class="fa-solid fa-puzzle-piece" aria-hidden="true"></i><span>확장 충돌 검사</span></h3><button type="button" class="bl-xc-x" data-xc="close" aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
        <div class="bl-xc-body">
        <p class="bl-xc-note">켜진 확장의 JS · CSS 를 이 실리태번 서버에서 읽어 같은 명령 · 전역 이름 · 설정 칸 · 단추 id · 덮어쓰기를 찾아요. 읽기만 하고 바깥으로 보내지 않아요. 이름이 같은 자리만 찾는 검사라 걸린 것이 모두 실제 충돌은 아니에요.</p>
        <div class="bl-xc-row"><button type="button" class="salty-btn bl-tool-primary bl-xc-run" data-xc="run"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span>다시 검사</span></button><button type="button" class="salty-btn bl-xc-copy" data-xc="copy" disabled><i class="fa-regular fa-copy" aria-hidden="true"></i><span>결과 복사</span></button></div>
        <p class="bl-xc-status" role="status" aria-live="polite" data-xc-status></p>
        <div data-xc-result></div>
        <details class="bl-xc-sec" data-xc-link-sec><summary><i class="fa-solid fa-link" aria-hidden="true"></i><span>링크로 설치 전 검사</span></summary>
            <p class="bl-xc-note">GitHub 저장소 주소를 넣으면 그 확장 파일을 받아 지금 깔린 확장과 맞대 봐요. 설치는 하지 않아요.</p>
            <label class="bl-xc-field"><span class="bl-xc-sr">GitHub 저장소 주소</span><input type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://github.com/이름/저장소" data-xc-url></label>
            <div class="bl-xc-row"><button type="button" class="salty-btn bl-xc-plan" data-xc="plan"><i class="fa-solid fa-list-check" aria-hidden="true"></i><span>받을 곳 보기</span></button><button type="button" class="salty-btn bl-tool-primary bl-xc-fetch" data-xc="fetch" disabled><i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i><span>받아서 검사</span></button></div>
            <div class="bl-xc-plan-box" data-xc-plan hidden></div>
        </details>
        <details class="bl-xc-sec" data-xc-ai-sec><summary><i class="fa-solid fa-robot" aria-hidden="true"></i><span>AI 검토 (선택 · 유료 1번)</span></summary>
            <p class="bl-xc-note">걸린 항목 주변 코드 조각만(최대 ${AI_LIMITS.items}건 · 약 ${(AI_LIMITS.chars / 10000).toFixed(0)}만 자) 고른 연결로 한 번 보내 항목마다 「충돌 확실 · 가능성 높음 · 문제 적음 · 오탐」과 쉬운 설명 · 해결 방법을 받아요. 프리셋 · 캐릭터 카드 · 채팅 · API 키는 보내지 않고, 코드 안의 키처럼 보이는 글도 가려요. 연결한 서비스 요금이 한 번 들어요.</p>
            <label class="bl-xc-field"><span>보낼 연결</span><select data-xc-profile></select></label>
            <p class="bl-xc-ai-size" data-xc-ai-size>먼저 검사를 마쳐야 보낼 양이 나와요.</p>
            <label class="bl-xc-consent" data-xc-consent-row><input type="checkbox" data-xc-consent><span>코드 조각을 이 연결로 보내는 데 동의해요(처음 한 번만 물어요)</span></label>
            <button type="button" class="salty-btn bl-tool-primary bl-xc-ai" data-xc="ai" disabled><i class="fa-solid fa-robot" aria-hidden="true"></i><span>AI 검토 보내기</span></button>
        </details>
        <details class="bl-xc-sec bl-xc-removed" data-xc-removed hidden><summary><i class="fa-solid fa-filter" aria-hidden="true"></i><span data-xc-removed-title>오탐으로 뺀 것</span></summary><div data-xc-removed-list></div></details>
        </div>`;
    document.body.append(dialog);
    open = dialog;
    const $ = sel => dialog.querySelector(sel);
    const controller = new AbortController();
    const state = { local: null, link: null, result: null, ai: {}, busy: false, meta: {} };
    const status = text => { if (dialog.isConnected) $('[data-xc-status]').textContent = text; };
    const busy = on => { state.busy = on; for (const b of dialog.querySelectorAll('[data-xc="run"],[data-xc="fetch"],[data-xc="ai"]')) b.disabled = on || (b.dataset.xc === 'fetch' && !dialog._plan) || (b.dataset.xc === 'ai' && !aiReady()); };

    // ── 결과 그리기 ──
    function render() {
        const out = $('[data-xc-result]'), r = state.result;
        if (!r) { out.innerHTML = ''; return; }
        const count = lv => r.findings.filter(f => f.level === lv).length;
        const chips = Object.entries(LEVELS).map(([lv, name]) => `<span class="bl-xc-badge" data-level="${lv}"><i aria-hidden="true"></i>${name} ${count(lv)}</span>`).join('') + (r.removed.length ? `<span class="bl-xc-badge">오탐 뺌 ${r.removed.length}</span>` : '');
        const items = lv => r.findings.map((f, i) => [f, i]).filter(([f]) => f.level === lv).map(([f, i]) => {
            const ai = state.ai[i];
            return `<article class="bl-xc-item" data-level="${lv}"><div class="bl-xc-item-head"><i class="bl-xc-dot" aria-hidden="true"></i><b>${esc(f.title)}</b>${ai ? `<span class="bl-xc-verdict" data-verdict="${esc(ai.verdict)}">AI: ${esc(AI_VERDICTS[ai.verdict])}</span>` : ''}</div>
                ${f.sides.length ? `<ul class="bl-xc-where">${f.sides.map(s => `<li>${at(s)}</li>`).join('')}</ul>` : ''}<p>${esc(f.text)}</p>
                ${ai ? `<p class="bl-xc-ai-why">${esc(ai.why)}${ai.fix ? `<br><b>해결:</b> ${esc(ai.fix)}` : ''}</p>` : ''}
                ${f.sides.some(s => s.line > 1) ? `<button type="button" class="salty-btn bl-xc-code" data-xc-code="${i}"><i class="fa-solid fa-code" aria-hidden="true"></i><span>코드 보기</span></button><div class="bl-xc-snips" data-xc-snip="${i}" hidden></div>` : ''}</article>`;
        }).join('');
        out.innerHTML = `<div class="bl-xc-sum">${chips}</div>` + (r.findings.length ? Object.entries(LEVELS).filter(([lv]) => count(lv)).map(([lv, name]) => `<details class="bl-xc-group" data-level="${lv}" ${lv !== 'info' ? 'open' : ''}><summary><i class="bl-xc-dot" aria-hidden="true"></i><span>${name}</span><span class="bl-xc-count">${count(lv)}</span></summary>${items(lv)}</details>`).join('')
            : '<p class="bl-xc-clear"><i class="fa-solid fa-check" aria-hidden="true"></i> 겹치는 이름을 찾지 못했어요. 이름이 달라도 서로 부딪히는 경우는 이 검사로 못 찾아요.</p>');
        const rem = $('[data-xc-removed]');
        rem.hidden = !r.removed.length;
        $('[data-xc-removed-title]').textContent = `오탐으로 뺀 것 ${r.removed.length}건`;
        const byRule = new Map(); for (const x of r.removed) (byRule.get(x.rule) || byRule.set(x.rule, []).get(x.rule)).push(x);
        $('[data-xc-removed-list]').innerHTML = [...byRule.values()].map(list => `<div class="bl-xc-rm"><p>${esc(list[0].why)}</p><ul>${list.slice(0, 30).map(x => `<li>${esc(x.title)} — ${x.sides.map(s => esc(s.name)).join(' · ')}</li>`).join('')}${list.length > 30 ? `<li>… 외 ${list.length - 30}건</li>` : ''}</ul></div>`).join('');
        $('[data-xc="copy"]').disabled = false;
        refreshAiSize();
    }
    function judge(focus = '') {
        const s = getSettings(), base = state.local;
        const profiles = [...base.profiles, ...(state.link ? [state.link.profile] : [])];
        const names = [...base.names, ...(state.link ? [`third-party/${state.link.profile.base}`] : [])];
        const result = compare(profiles, { clientVersion: state.meta.st, names, disabled: base.disabled, focus, addonOn: id => !!s.addons?.[id] });
        // 9.0.0 knownConflicts(내장 기능과 같은 일을 하는 단독 확장이 같이 켜짐) — 「오탐 표 twin」으로 뺀 이름 겹침 대신 이 한 줄
        const twins = twinRows(knownConflicts(names, base.disabled, s.addons || {}).filter(row => !focus || row.text.includes(state.link.profile.base)));
        result.findings.unshift(...twins);
        state.result = result; state.ai = {};
        render();
    }

    // ── 검사 ──
    async function runLocal() {
        if (state.busy) return;
        busy(true); state.link = null; status('확장 목록을 읽는 중…');
        try {
            state.meta.st = await clientVersion();
            state.local = await readInstalled({ signal: controller.signal, onProgress: (n, all, folder) => status(`확장 ${all}개 중 ${n}개 읽었어요 · ${folder}`) });
            const st = state.local.stats;
            state.meta = { ...state.meta, count: state.local.profiles.filter(p => p.enabled).length, files: st.files, skipped: st.skipped, link: '' };
            judge();
            status(`켜진 확장 ${state.meta.count}개 · 파일 ${st.files}개(${(st.bytes / 1024 / 1024).toFixed(1)}MB)를 읽었어요${st.skipped ? ` · 상한을 넘은 큰 파일 ${st.skipped}개는 건너뛰었어요` : ''}.`);
        } catch (error) {
            if (error?.name !== 'AbortError') status(`검사하지 못했어요 — ${error?.message || error}`);
        } finally { busy(false); }
    }
    function plan() {
        const parsed = parseGithubUrl($('[data-xc-url]').value);
        const box = $('[data-xc-plan]');
        box.hidden = false;
        dialog._plan = parsed;
        if (!parsed) { box.innerHTML = '<p>GitHub 저장소 주소가 아니에요. <code>https://github.com/이름/저장소</code> 꼴로 넣어 주세요.</p>'; busy(state.busy); return; }
        box.innerHTML = `<p>「받아서 검사」를 누르면 아래에서만 받아요. 받은 코드는 실행하지 않고 글로만 읽어요.</p><ul>${linkPlan(parsed).map(p => `<li><code>${esc(p.host)}</code> — ${esc(p.what)}</li>`).join('')}</ul>`;
        busy(state.busy);
    }
    async function runLink() {
        const parsed = dialog._plan;
        if (state.busy || !parsed) return;
        if (!state.local) await runLocal();
        if (!state.local) return;
        busy(true); status(`${parsed.owner}/${parsed.repo} 받는 중…`);
        try {
            state.link = await readGithub(parsed, { signal: controller.signal });
            state.meta.link = `github.com/${parsed.owner}/${parsed.repo} (${state.link.branch}) · 파일 ${state.link.stats.files}개`;
            judge(state.link.folder);
            status(`${parsed.repo} 파일 ${state.link.stats.files}개를 받아 지금 깔린 확장과 맞대 봤어요. 이 확장이 낀 것만 보여요 — 「다시 검사」를 누르면 설치된 것 전체로 돌아가요.`);
        } catch (error) {
            if (error?.name !== 'AbortError') status(error?.message || `받지 못했어요 — ${error}`);
        } finally { busy(false); }
    }

    // ── AI 검토 ──
    const aiItems = () => state.result ? state.result.findings.filter(f => f.sides.some(s => s.line > 1)) : [];
    function aiReady() { return !!state.result && aiItems().length > 0 && (store().aiConsent || $('[data-xc-consent]')?.checked); }
    let sizeToken = 0;
    async function buildAi() {
        const list = aiItems(), texts = new Map([...(state.local?.texts || new Map()), ...(state.link ? [[state.link.folder, state.link.texts]] : [])]);
        const code = new Map();
        for (const f of list.slice(0, AI_LIMITS.items)) for (const s of f.sides.slice(0, 3)) { const k = `${s.folder}\u0000${s.file}`; if (!code.has(k)) code.set(k, await sourceText(texts, s, controller.signal)); }
        return aiRequest(list, s => code.get(`${s.folder}\u0000${s.file}`) || '');
    }
    async function refreshAiSize() {
        const token = ++sizeToken, box = $('[data-xc-ai-size]');
        if (!aiItems().length) { box.textContent = state.result ? '보낼 코드 조각이 없어요(걸린 항목이 없거나 줄 번호가 없는 항목만 있어요).' : '먼저 검사를 마쳐야 보낼 양이 나와요.'; busy(state.busy); return; }
        box.textContent = '보낼 양을 세는 중…';
        try {
            const req = await buildAi();
            if (token !== sizeToken) return;
            const text = req.messages.map(m => m.content).join('\n');
            let tokens = Math.ceil(text.length / 3);
            try { const c = ctx(); if (typeof c?.getTokenCountAsync === 'function') tokens = await c.getTokenCountAsync(text); } catch { /* 어림 */ }
            if (token !== sizeToken) return;
            dialog._ai = req;
            box.textContent = `보낼 것: 항목 ${req.items.length}개 · ${req.chars.toLocaleString()}자 · 약 ${Number(tokens).toLocaleString()} 토큰 (+ 답 최대 ${AI_TOKENS.toLocaleString()} 토큰)`;
        } catch (error) { if (error?.name !== 'AbortError') box.textContent = `보낼 양을 세지 못했어요 — ${error?.message || error}`; }
        busy(state.busy);
    }
    async function sendAi() {
        const req = dialog._ai;
        if (state.busy || !req || !aiReady()) return;
        const keep = store();
        if (!keep.aiConsent) { keep.aiConsent = true; saveSettings(); $('[data-xc-consent-row]').hidden = true; }
        busy(true); status('AI 가 검토하는 중… (창을 닫으면 결과를 기다리지 않아요)');
        try {
            const text = await send(req.messages, keep.profileId, controller.signal);
            const verdicts = parseAi(text, req.items);
            const index = new Map(state.result.findings.map((f, i) => [f, i]));
            state.ai = {};
            for (const it of req.items) if (verdicts[it.id]) state.ai[index.get(it.finding)] = verdicts[it.id];
            for (const f of state.result.findings) delete f.ai;
            for (const [i, v] of Object.entries(state.ai)) state.result.findings[i].ai = v;
            const n = Object.keys(state.ai).length;
            render();
            status(n ? `AI 가 ${req.items.length}개 중 ${n}개를 판정했어요. 판정도 틀릴 수 있어요 — 「코드 보기」로 같이 확인해 주세요.` : 'AI 답에서 판정을 읽지 못했어요. 다른 연결로 다시 해 보세요.');
        } catch (error) {
            if (error?.name !== 'AbortError') status(`AI 검토를 마치지 못했어요 — ${error?.message || error}`);
        } finally { busy(false); }
    }

    // ── 연결 고르기 ──
    const select = $('[data-xc-profile]');
    let profiles = [];
    try { profiles = ctx()?.ConnectionManagerRequestService?.getSupportedProfiles?.() || []; } catch { profiles = []; }
    select.innerHTML = `<option value="">지금 연결</option>${profiles.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}`;
    select.value = profiles.some(p => p.id === store().profileId) ? store().profileId : '';
    select.addEventListener('change', () => { store().profileId = select.value; saveSettings(); });
    $('[data-xc-consent-row]').hidden = !!store().aiConsent;
    $('[data-xc-consent]').addEventListener('change', () => busy(state.busy));

    // ── 단추 ──
    dialog.addEventListener('click', async event => {
        const code = event.target.closest('[data-xc-code]');
        if (code) { await showCode(Number(code.dataset.xcCode), code); return; }
        const act = event.target.closest('[data-xc]')?.dataset.xc;
        if (act === 'close') dialog.close();
        else if (act === 'run') runLocal();
        else if (act === 'plan') plan();
        else if (act === 'fetch') runLink();
        else if (act === 'ai') sendAi();
        else if (act === 'copy') {
            const theme = state.local?.profiles.find(p => p.self)?.manifest.version || '';
            const text = reportText(state.result || { findings: [], removed: [] }, { ...state.meta, theme, at: new Date().toLocaleString('ko-KR') });
            const ok = await copyPlain(text);
            status(ok ? '결과를 복사했어요. 문의 글에 붙여 넣으면 돼요(설정 · 채팅 · 코드 글은 들어가지 않아요).' : '복사하지 못했어요. 브라우저가 복사를 막았어요.');
        }
    });
    async function showCode(i, button) {
        const box = dialog.querySelector(`[data-xc-snip="${i}"]`), f = state.result?.findings[i];
        if (!box || !f) return;
        if (!box.hidden) { box.hidden = true; button.querySelector('span').textContent = '코드 보기'; return; }
        const texts = new Map([...(state.local?.texts || new Map()), ...(state.link ? [[state.link.folder, state.link.texts]] : [])]);
        const parts = [];
        for (const s of f.sides.slice(0, 4)) {
            const text = s.line > 1 ? await sourceText(texts, s, controller.signal).catch(() => '') : '';
            parts.push(`<p>${at(s)}</p>${text ? `<pre>${esc(snippet(text, s.line, 3))}</pre>` : '<p class="bl-xc-note">이 파일 글을 다시 읽지 못했어요.</p>'}`);
        }
        box.innerHTML = parts.join('');
        box.hidden = false; button.querySelector('span').textContent = '코드 접기';
    }
    $('[data-xc-url]').addEventListener('input', () => { dialog._plan = null; $('[data-xc-plan]').hidden = true; busy(state.busy); });
    $('[data-xc-url]').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); plan(); } });
    dialog.addEventListener('close', () => { controller.abort(); dialog.remove(); if (open === dialog) open = null; });
    showThemeModal(dialog);
    if (url) { $('[data-xc-link-sec]').open = true; $('[data-xc-url]').value = url; plan(); }
    await runLocal();
    return dialog;
}

// 지금 연결(generateRaw) 또는 고른 연결 프로필로 한 번 — 프리셋 · 대화는 붙이지 않아요 (settings-ai.js 와 같은 길)
async function send(messages, profileId, signal) {
    const c = ctx();
    if (!c) throw new Error('실리태번 연결을 찾지 못했어요');
    let request;
    if (profileId) {
        const service = c.ConnectionManagerRequestService;
        if (typeof service?.sendRequest !== 'function') throw new Error('연결 프로필을 쓸 수 없어요');
        request = service.sendRequest(profileId, messages, AI_TOKENS, { stream: false, signal, extractData: true, includePreset: false }).then(r => typeof r === 'string' ? r : r?.content ?? '');
    } else {
        if (typeof c.generateRaw !== 'function') throw new Error('실리태번 생성 함수를 찾지 못했어요');
        request = c.generateRaw({ prompt: messages, responseLength: AI_TOKENS, trimNames: false });
    }
    let timer;
    const stop = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${AI_TIMEOUT / 1000}초 안에 답이 없어요`)), AI_TIMEOUT);
        signal?.addEventListener('abort', () => reject(Object.assign(new Error('창을 닫았어요'), { name: 'AbortError' })), { once: true });
    });
    try { return String(await Promise.race([request, stop]) ?? ''); } finally { clearTimeout(timer); }
}

const STYLE = `
.bl-tool-dialog.bl-xc { width:min(640px, calc(100vw - 24px)); padding:0; overflow:hidden; display:flex; flex-direction:column; max-height:calc(100dvh - 24px); box-sizing:border-box; }
.bl-xc-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 12px 8px; flex:none; }
.bl-xc-head h3 { display:flex; align-items:center; gap:8px; margin:0; font-size:var(--bl-ui-h-sub, 16px); font-weight:var(--bl-ui-strong, 650); }
.bl-xc-body { overflow:auto; padding:0 12px 12px; scrollbar-width:none; }
.bl-xc-body::-webkit-scrollbar, .bl-xc pre::-webkit-scrollbar { display:none; }
.bl-xc .salty-btn { min-height:var(--bl-ui-ctl, 36px); padding:calc(6px + var(--bl-text-nudge, 0px)) 10px calc(6px - var(--bl-text-nudge, 0px)); border-radius:var(--bl-ui-radius, 8px); font-size:var(--bl-ui-btn-fs, 14px); font-weight:400; line-height:1.4; gap:8px; }
.bl-xc .salty-btn:disabled { opacity:.5; cursor:default; }
.bl-xc-note { margin:8px 0; font-size:13px; line-height:1.6; color:var(--salty-muted); }
.bl-xc-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0; }
.bl-xc-status { margin:8px 0; min-height:1.4em; font-size:13px; line-height:1.5; color:var(--salty-muted); overflow-wrap:anywhere; }
.bl-xc-sum { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0 12px; }
.bl-xc-badge { display:inline-flex; align-items:center; gap:6px; min-height:21px; padding:0 8px; border:1px solid var(--salty-line); border-radius:999px; background:var(--salty-fill-shade, var(--salty-shade)); font-size:12.5px; line-height:1.2; color:var(--salty-muted); }
.bl-xc-badge > i, .bl-xc-dot { display:inline-block; flex:none; width:8px; height:8px; border-radius:50%; background:var(--salty-muted); }
.bl-xc [data-level="danger"] > i, .bl-xc [data-level="danger"] .bl-xc-dot { background:var(--bl-danger, var(--salty-danger)); }
.bl-xc [data-level="warn"] > i, .bl-xc [data-level="warn"] .bl-xc-dot { border-radius:1px; transform:rotate(45deg) scale(.9); background:var(--bl-warn, var(--salty-accent)); outline:1px solid var(--salty-line); }   /* 등급은 색 + 모양(● 위험 · ◆ 주의 · ○ 참고) — 낮 팔레트에서 주의 · 참고 색이 가까워도 갈려요 */
.bl-xc [data-level="info"] > i, .bl-xc [data-level="info"] .bl-xc-dot { box-sizing:border-box; background:transparent; border:2px solid var(--salty-accent); }
.bl-xc-group, .bl-xc-sec { margin:8px 0; border:1px solid var(--salty-line); border-radius:var(--bl-ui-radius, 8px); background:var(--salty-raised, var(--salty-surface)); }
.bl-xc-group > summary, .bl-xc-sec > summary { display:flex; align-items:center; gap:8px; min-height:var(--bl-ui-ctl, 36px); padding:0 10px; cursor:pointer; font-weight:var(--bl-ui-strong, 650); list-style:none; }
.bl-xc-group > summary::-webkit-details-marker, .bl-xc-sec > summary::-webkit-details-marker { display:none; }
.bl-xc-count { display:inline-flex; align-items:center; min-height:21px; padding:0 8px; border:1px solid var(--salty-line); border-radius:999px; background:var(--salty-fill-shade, var(--salty-shade)); font-size:12.5px; font-weight:400; line-height:1.2; color:var(--salty-muted); margin-right:auto; }
.bl-xc-sec > :not(summary) { margin-left:10px; margin-right:10px; }
.bl-xc-sec > :last-child { margin-bottom:10px; }
.bl-xc-item { padding:10px; border-top:1px solid var(--salty-line); }
.bl-xc-item-head { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.bl-xc-item-head b { flex:1 1 200px; min-width:0; overflow-wrap:anywhere; font-weight:var(--bl-ui-strong, 650); }
.bl-xc-item p { margin:6px 0; font-size:13px; line-height:1.6; overflow-wrap:anywhere; }
.bl-xc-where { margin:6px 0; padding-left:18px; font-size:13px; line-height:1.6; color:var(--salty-muted); overflow-wrap:anywhere; }
.bl-xc code { font:12px/1.5 ui-monospace, Consolas, monospace; overflow-wrap:anywhere; }
.bl-xc-verdict { display:inline-flex; align-items:center; min-height:20px; padding:0 8px; border:1px solid var(--salty-line); border-radius:10px; font-size:12px; color:var(--salty-text); }
.bl-xc-verdict[data-verdict="certain"] { border-color:var(--bl-danger, var(--salty-danger)); }
.bl-xc-verdict[data-verdict="false"], .bl-xc-verdict[data-verdict="minor"] { color:var(--salty-muted); }
.bl-xc-ai-why { color:var(--salty-text); }
.bl-xc-code { margin-top:4px; }
.bl-xc-snips p { margin:8px 0 4px; color:var(--salty-muted); font-size:12px; }
.bl-xc pre { margin:0; padding:8px; max-height:240px; overflow:auto; border:1px solid var(--salty-line); border-radius:var(--bl-ui-radius, 8px); background:var(--salty-field, var(--salty-surface)); color:var(--salty-text); font:12px/1.5 ui-monospace, Consolas, monospace; white-space:pre; scrollbar-width:none; }
.bl-xc-clear { margin:8px 0; padding:10px 12px; border-radius:8px; background:var(--salty-raised, var(--salty-surface)); font-size:13px; line-height:1.6; }
.bl-xc-field { display:flex; flex-direction:column; gap:4px; padding:4px 0; font-size:13px; color:var(--salty-muted); }
.bl-xc-field input, .bl-xc-field select { box-sizing:border-box; width:100%; min-height:var(--bl-ui-ctl, 36px); padding:6px 8px; border:1px solid var(--salty-line); border-radius:var(--bl-ui-radius, 8px); background-color:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font:inherit; font-size:14px; }
.bl-xc-field input:focus, .bl-xc-field select:focus { outline:1px solid var(--salty-accent); }
.bl-xc-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.bl-xc-plan-box { margin:4px 0 8px; padding:8px 10px; border-radius:8px; background:var(--salty-field, var(--salty-surface)); font-size:13px; line-height:1.6; overflow-wrap:anywhere; }
.bl-xc-plan-box[hidden], .bl-xc [hidden] { display:none !important; }
.bl-xc-plan-box ul, .bl-xc-rm ul { margin:4px 0 0; padding-left:18px; }
.bl-xc-ai-size { font-size:13px; color:var(--salty-text); margin:8px 0; }
.bl-xc-consent { display:flex; align-items:center; gap:8px; min-height:44px; font-size:13px; line-height:1.5; cursor:pointer; }
.bl-xc-consent input { flex:none; margin:0; }
.bl-xc-ai { display:flex; width:auto; margin-bottom:10px; }
.bl-xc-rm { font-size:13px; line-height:1.6; }
.bl-xc-rm p { margin:8px 0 2px; color:var(--salty-text); }
.bl-xc-rm li { color:var(--salty-muted); overflow-wrap:anywhere; }
@media (pointer: coarse) {
  .bl-xc .salty-btn, .bl-xc summary { position:relative; }
  .bl-xc .salty-btn::before, .bl-xc summary::after { content:''; position:absolute; left:50%; top:50%; width:max(100%, 44px); height:max(100%, 44px); transform:translate(-50%, -50%); }   /* summary::before 는 테마의 접힘 꺾쇠 */
  .bl-xc-x::after { content:''; position:absolute; left:50%; top:50%; width:44px; height:44px; transform:translate(-50%, -50%); }
  .bl-xc-field { padding:4px 0; }
}
@media (max-width: 640px) { .bl-xc-head { padding:12px 12px 8px; } .bl-xc-body { padding:0 12px 12px; } }
`;
function ensureStyle() {
    if (document.getElementById('bl-xc-style')) return;
    const style = document.createElement('style');
    style.id = 'bl-xc-style';
    style.textContent = STYLE;
    document.head.append(style);
}
