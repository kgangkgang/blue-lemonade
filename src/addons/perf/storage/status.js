// 성능 보조 · 숨은 점검 도구 (「저장 공간」 창 제목을 1초 길게 누를 때만 불러온다 · 2026-10-31 따로 깔던 런처 확장에서 옮김)
// 확장 판(테마 · 테마 안 애드온 · 깔린 확장) · 켜진 기능(설정의 켜짐/꺼짐만) · 답마다 요청 수(창구가 생기면) · 최근 오류(이 페이지 메모리) · 진단 복사(가린 글).
// 닫혀 있을 때 하는 일 없음. 열 때 이미 있는 설정 · manifest 에서만 읽는다(파일을 따로 받지 않음).
import * as EXT from '../../../../../../../extensions.js';
import { ERRORS_KEY, featureList, buildDiagReport, scrub, ownerLabel, USAGE_HUB, usageLines, recentLines } from './core.js';
import { openPanel, esc, ensureStyle } from './panel.js';
import { addonVersions } from '../../../addon-versions.js';   // 테마 안 애드온의 판은 테마 애드온 판 표에서

const ctx = () => EXT.getContext();
const THEME = 'blue-lemonade';
// 테마 · 테마 안 애드온(embedded: 테마 addonVersions() 결과)은 테마 설정 플래그 · 테마 판 표로, 그 밖에 깔린 확장은 third-party/<폴더> manifest 로
function versions(embedded = []) {
    const disabled = new Set(ctx().extensionSettings?.disabledExtensions || []);
    const flags = ctx().extensionSettings?.salty?.addons || {};
    const manifestOf = name => { try { return EXT.getExtensionManifest?.(name) || null; } catch { return null; } };
    const rows = [];
    const themeName = `third-party/${THEME}`, tm = manifestOf(themeName);
    rows.push({ folder: THEME, label: tm?.display_name || '블루 레몬에이드', version: tm?.version || '?', enabled: !disabled.has(themeName) });
    for (const x of embedded) if (x && x.id) rows.push({ folder: `${x.id} · 테마 안`, label: x.label || x.id, version: x.version || '?', enabled: !!flags[x.id] });
    const names = Array.isArray(EXT.extensionNames) ? EXT.extensionNames : [];
    for (const name of names.filter(n => typeof n === 'string' && n.startsWith('third-party/') && n !== themeName).sort()) {
        const m = manifestOf(name);
        rows.push({ folder: name.slice('third-party/'.length), label: String(m?.display_name || name.slice('third-party/'.length)).slice(0, 40), version: m?.version || '?', enabled: !disabled.has(name) });
    }
    return rows;
}
/** 1.1.6 사용량 장부(블루 레몬에이드 허브)의 오늘 요약 — 열 때 한 번만 읽는다. 없으면 null */
async function usageToday() {
    try {
        const hub = globalThis[USAGE_HUB];
        if (typeof hub?.summary !== 'function') return null;
        const from = new Date(); from.setHours(0, 0, 0, 0);
        return usageLines(await hub.summary({ from: from.getTime(), to: Date.now() }));
    } catch (e) { console.warn('[Blue Lemonade] 사용량 장부', e); return null; }
}
/** 1.1.8 답마다 요청 수 — 블루 레몬에이드 요청 기록(st.request-log.v1.recent, 7.4.0~)의 최근 답 5개. 요청 기록이 꺼져 있거나 창구가 없으면 null */
async function requestCounts() {
    try {
        const log = globalThis[Symbol.for('st.request-log.v1')];
        if (typeof log?.recent !== 'function') return null;
        return recentLines(await log.recent({ replies: 5 }));
    } catch { return null; }
}
const env = () => ({ width: innerWidth, height: innerHeight, coarse: matchMedia('(pointer: coarse)').matches, st: (() => { try { return ctx().getSettings?.()?.version || document.querySelector('#version_display')?.textContent?.trim()?.slice(0, 40) || ''; } catch { return ''; } })() });
const time = at => new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function render(panel, usage = null, req = null) {
    const v = versions(panel._embedded || []), f = featureList(ctx().extensionSettings);
    const ring = globalThis[ERRORS_KEY], errors = ring?.list?.() || [];
    const origin = location.origin;
    panel.body.innerHTML = `<section class="bls-card" aria-label="확장 판"><h3>확장 판</h3><ul class="bls-list">${v.map(x => `<li><div class="bls-item-main"><span>${esc(x.label)}</span><small>${esc(x.folder)}</small></div><span class="bls-num">${x.version ? esc(x.version) : '없음'}${x.enabled === false ? ' · 꺼짐' : ''}</span></li>`).join('')}</ul></section>
      <section class="bls-card" aria-label="켜진 기능"><h3>켜진 기능</h3><ul class="bls-list">${f.map(x => `<li><div class="bls-item-main"><span>${esc(x.label)}</span><small>${esc(ownerLabel(x.owner))}</small></div><span class="bls-num">${esc(x.value)}</span></li>`).join('')}</ul><p class="bls-note">설정의 켜짐 · 꺼짐만 읽어요. 키 · 주소는 읽지 않아요.</p></section>
      <section class="bls-card" aria-label="답마다 요청 수"><h3>답마다 요청 수</h3>
        ${req ? (req.length ? `<ul class="bls-list bls-recent">${req.map(r => `<li><span>${esc(r)}</span></li>`).join('')}</ul><p class="bls-note">최근 답부터 · 블루 레몬에이드 요청 기록</p>` : '<p class="bls-note">요청 기록에 아직 답이 없어요.</p>') : ''}
        ${usage ? `<h3 class="bls-sub">오늘 사용량</h3><p class="bls-num bls-usage-head">${esc(usage.head)}</p>${usage.rows.length ? `<ul class="bls-list">${usage.rows.map(r => `<li><div class="bls-item-main"><span>${esc(r.label)}</span><small>${esc(r.value)}</small></div></li>`).join('')}</ul>` : ''}<p class="bls-note">사용량 장부(블루 레몬에이드) 오늘 기록 · 입력은 캐시 포함 전체, 출력은 생각 포함 전체 토큰 · 값은 가격표 어림 · ≈ 는 어림 토큰.</p>` : ''}
        ${!req && !usage ? '<p class="bls-note">아직 세어 주는 창구가 없어요. 블루 레몬에이드 요청 기록 · 사용량 장부가 켜지면 여기 보여요.</p>' : ''}</section>
      <section class="bls-card" aria-label="최근 오류"><div class="bls-row bls-between"><h3>최근 오류 ${errors.length}${ring?.dropped ? ` (+${Number(ring.dropped).toLocaleString('ko-KR')} 지남)` : ''}</h3>${errors.length ? '<button type="button" class="bls-btn" data-act="clear">비우기</button>' : ''}</div>
        ${errors.length ? `<ol class="bls-list bls-errors">${errors.slice().reverse().map(e => `<li><div class="bls-item-main"><span>${esc(scrub(e.text, origin).split('\n')[0].slice(0, 160))}</span><small>${time(e.at)} · ${esc(e.kind)}${e.source ? ` · ${esc(e.source)}` : ''}</small></div></li>`).join('')}</ol>` : '<p class="bls-note">이 페이지를 연 뒤로 잡힌 오류가 없어요.</p>'}
        <p class="bls-note">페이지가 도는 동안 메모리에만 30개까지 — 어디로도 보내지 않아요.</p></section>
      <div class="bls-row bls-wrap"><button type="button" class="bls-btn bls-primary" data-act="copy">진단 복사</button><span class="bls-status" role="status" aria-live="polite"></span></div>`;
    panel._report = () => buildDiagReport({ versions: v, features: f, errors, env: env(), requests: [...(req || []), ...(usage ? [usage.head, ...usage.rows.map(r => `${r.label}: ${r.value}`)] : [])] });
}
async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* 아래 */ }
    try { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch { return false; }
}
export async function openStatus() {
    await ensureStyle();
    const panel = openPanel({ id: 'bl-perf-status', title: '점검 도구', subtitle: '확장 상태 · 최근 오류' });
    if (!panel) return;
    if (!panel._embedded) { try { panel._embedded = await addonVersions(); } catch { panel._embedded = []; } }   // 테마 안 애드온 판 (한 번 읽으면 테마가 기억)
    if (panel._blsStatusJob) return panel._blsStatusJob;
    if (!panel._blsStatusBound) {
        panel._blsStatusBound = true;
        render(panel);
        panel.dialog.addEventListener('click', async e => {
            const b = e.target.closest('[data-act]'); if (!b) return;
            if (b.dataset.act === 'clear') { globalThis[ERRORS_KEY]?.clear?.(); render(panel, panel._usage, panel._req); return; }
            if (b.dataset.act === 'copy') {
                const ok = await copyText(panel._report());
                const s = panel.body.querySelector('.bls-status'); if (s) s.textContent = ok ? '복사했어요 · 키 · 채팅 글 · 주소는 뺐어요' : '복사하지 못했어요';
            }
        });
    }
    const job = (async () => {
        [panel._usage, panel._req] = await Promise.all([usageToday(), requestCounts()]);
        if (panel.dialog.isConnected) render(panel, panel._usage, panel._req);
        return panel;
    })().finally(() => { if (panel._blsStatusJob === job) panel._blsStatusJob = null; });
    panel._blsStatusJob = job;
    return job;
}
export { versions, requestCounts };
