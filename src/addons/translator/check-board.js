import { showThemeModal } from '../../modal.js';
import { CHECK_REASONS, MESSAGE_REASONS, paragraphAt, paragraphRange } from './translation-check.js';
const PAGE_SIZE = 20, TEXT_LIMIT = 30000;
let active = null;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = value => String(value ?? '').replace(/<!--[\s\S]*?(?:-->|$)/g, '').replace(/<[^>]*>/g, '').trim();
const excerpt = value => plain(value).slice(0, 120);
const reason = (code, result) => CHECK_REASONS[code] || (typeof MESSAGE_REASONS[code] === 'function'
    ? MESSAGE_REASONS[code](result.sourceCount, result.count) : MESSAGE_REASONS[code]) || code;

export function openCheckBoard({ review, context, unavailable = () => '' }) {
    active?.close();
    if (!document.getElementById('llmt-check-board-style')) {
        const link = document.createElement('link'); link.id = 'llmt-check-board-style'; link.rel = 'stylesheet';
        link.href = new URL('./check-board.css', import.meta.url).href; document.head.append(link);
    }
    const dialog = document.createElement('dialog'); dialog.className = 'llmt-check-board'; active = dialog;
    dialog.setAttribute('aria-label', '의심 번역 모아보기');
    dialog.innerHTML = `<header><h3>의심 번역 모아보기</h3><button type="button" data-close aria-label="닫기">×</button></header>
        <p>의심 표시는 확정된 오역이 아니에요. 기존 번역 점검 결과만 모아요. 고유명사·용어집 표기·원문에 있던 한국어와 한자는 문맥과 함께 확인해 주세요.</p>
        <p class="llmt-board-note">현재 채팅에서 최근 점검한 최대 300개 메시지가 대상이에요. 목록을 열거나 다시 검사해도 번역 요청은 보내지 않아요.</p>
        <div class="llmt-board-toolbar"><button type="button" data-refresh>목록 새로고침</button><span data-count role="status"></span></div>
        <p data-unavailable></p><div data-list></div><nav aria-label="의심 번역 목록 페이지"><button type="button" data-prev>이전</button><span data-page></span><button type="button" data-next>다음</button></nav>
        <section data-detail hidden></section><p data-status role="status" aria-live="polite"></p>`;
    document.body.append(dialog); showThemeModal(dialog);
    const start = context(), owner = start.chatMetadata, chat = String(start.getCurrentChatId?.() ?? start.chatId ?? ''), cleanups = [];
    let page = 0, entries = [], selected = null, busy = false, closed = false;
    const $ = selector => dialog.querySelector(selector);
    const message = text => { if (!closed) $('[data-status]').textContent = text; };
    function assertChat() {
        const now = context();
        if (closed || now.chatMetadata !== owner || String(now.getCurrentChatId?.() ?? now.chatId ?? '') !== chat) throw Error('채팅이 바뀌었어요. 모아보기를 다시 열어 주세요.');
    }
    function refresh() {
        assertChat(); entries = review.list(); page = Math.min(page, Math.max(0, Math.ceil(entries.length / PAGE_SIZE) - 1));
        const shown = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        $('[data-unavailable]').textContent = unavailable();
        $('[data-count]').textContent = `의심 메시지 ${entries.length}개`;
        $('[data-list]').innerHTML = shown.length ? shown.map((entry, i) => {
            const codes = [...new Set([...entry.result.paragraphs.flatMap(row => row.reasons), ...entry.result.message])];
            return `<button type="button" class="llmt-board-row" data-item="${page * PAGE_SIZE + i}"><strong>#${entry.id} · 의심 문단 ${entry.result.flagged || 0}개</strong><span>${escape(codes.map(code => reason(code, entry.result)).join(' '))}</span><small>${escape(excerpt(entry.state.translation))}</small></button>`;
        }).join('') : '<p>현재 모아 둔 의심 번역이 없어요. 아직 점검하지 않았거나, 표시 중인 번역이 바뀐 메시지는 목록에 나오지 않아요.</p>';
        $('[data-page]').textContent = `${page + 1} / ${Math.max(1, Math.ceil(entries.length / PAGE_SIZE))}`;
        $('[data-prev]').disabled = busy || page === 0; $('[data-next]').disabled = busy || (page + 1) * PAGE_SIZE >= entries.length;
        if (selected) { try { review.current(selected); } catch { selected = null; $('[data-detail]').hidden = true; message('메시지 변경으로 이전 비교를 닫았어요.'); } }
    }
    function show(entry, index = entry.result.paragraphs[0]?.index ?? -1) {
        assertChat(); review.current(entry); selected = entry;
        const picked = review.plan(entry, index), row = picked?.row;
        const source = row?.missing ? paragraphRange(entry.state.source, row.missing[0], row.missing[1], entry.state.protect)
            : row?.source >= 0 ? paragraphAt(entry.state.source, row.source, entry.state.protect) : entry.state.source;
        const translation = row ? paragraphAt(entry.state.translation, row.index, entry.state.protect) : entry.state.translation;
        const text = value => plain(value).slice(0, TEXT_LIMIT);
        const detail = $('[data-detail]'); detail.hidden = false;
        detail.innerHTML = `<h4>#${entry.id} 원문과 번역 비교</h4>${entry.result.paragraphs.length ? `<label>의심 문단<select data-paragraph>${entry.result.paragraphs.map(row => `<option value="${row.index}" ${row.index === index ? 'selected' : ''}>${row.index + 1}번째 · ${escape(row.reasons.map(code => reason(code, entry.result)).join(' '))}</option>`).join('')}</select></label>` : ''}
            <div class="llmt-board-compare"><section><h5>${row?.missing ? '빠진 것으로 보이는 원문' : '원문'}</h5><pre data-source></pre></section><section><h5>현재 번역</h5><pre data-translation></pre></section></div>
            ${(plain(source).length > TEXT_LIMIT || plain(translation).length > TEXT_LIMIT) ? '<p>긴 글은 앞 30,000자까지만 표시해요.</p>' : ''}
            <div class="llmt-board-actions"><button type="button" data-recheck>이 메시지 다시 검사 · 요청 없음</button>${picked?.action ? `<button type="button" data-fix="${picked.action[0]}">${escape(picked.action[1])}${picked.action[0] === 'clean' ? ' · 요청 없음' : ' · 번역 요청'}</button>` : '<p>짝을 확실히 찾지 못해 문단만 다시 번역할 수 없어요.</p>'}
            <button type="button" data-fix="whole">선택한 메시지 전체 다시 번역 · 번역 요청</button></div>`;
        const heading = detail.querySelector('h4'); heading.tabIndex = -1; heading.focus({ preventScroll: true }); detail.scrollIntoView({ block: 'start', behavior: 'instant' });
        detail.dataset.index = String(index); $('[data-source]').textContent = text(source); $('[data-translation]').textContent = text(translation);
        $('[data-paragraph]')?.addEventListener('change', event => { try { show(entry, Number(event.target.value)); } catch (e) { message(e.message); refresh(); } });
    }
    dialog.addEventListener('click', async event => {
        const button = event.target.closest('button'); if (!button || button.disabled) return;
        if (button.hasAttribute('data-close')) { dialog.close(); return; }
        if (busy) return;
        try {
            assertChat();
            if (button.hasAttribute('data-refresh')) { refresh(); return; }
            if (button.hasAttribute('data-prev') || button.hasAttribute('data-next')) { page += button.hasAttribute('data-next') ? 1 : -1; refresh(); return; }
            if (button.hasAttribute('data-item')) { show(entries[Number(button.dataset.item)]); return; }
            if (button.hasAttribute('data-recheck')) { const next = review.recheck(selected); refresh(); if (next.result?.warn) show(next); else { selected = null; $('[data-detail]').hidden = true; } message('다시 검사했어요. 번역 요청은 보내지 않았어요.'); return; }
            if (button.hasAttribute('data-fix')) {
                const entry = selected, index = Number($('[data-detail]').dataset.index), kind = button.dataset.fix;
                busy = true; dialog.querySelectorAll('button:not([data-close]),select').forEach(el => el.disabled = true);
                message(kind === 'clean' ? '선택한 메시지에서 초안을 걷어 내는 중…' : '선택한 항목만 번역하는 중…');
                try { const outcome = await review.run(entry, index, kind); if (!closed) { selected = null; $('[data-detail]').hidden = true; message(outcome.changed ? '표시 번역이 바뀌었어요. 최신 점검 결과와 내용을 확인해 주세요.' : '번역문 변경은 확인되지 않았어요. 최신 내용과 번역 안내를 확인해 주세요.'); } }
                finally { busy = false; if (!closed) { dialog.querySelectorAll('button,select').forEach(el => el.disabled = false); refresh(); } }
            }
        } catch (e) { message(e.message); }
    });
    const source = start.eventSource, types = start.eventTypes || {};
    const onChange = () => { if (closed) return; try { assertChat(); refresh(); } catch { dialog.close(); } };
    for (const name of ['CHAT_CHANGED', 'MESSAGE_DELETED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'CHARACTER_MESSAGE_RENDERED']) {
        const type = types[name]; if (!type || !source?.on) continue; source.on(type, onChange); cleanups.push(() => source.removeListener(type, onChange));
    }
    dialog.addEventListener('close', () => { closed = true; cleanups.forEach(fn => fn()); dialog.remove(); if (active === dialog) active = null; }, { once: true });
    refresh(); $('[data-refresh]').focus(); return dialog;
}
