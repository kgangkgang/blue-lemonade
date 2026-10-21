// Per-run display state. Only start() adds a request to the active list;
// cache reads, completed requests and waiting between requests never appear there.
export function translationKind(ns) {
    return ns.startsWith('pt-wi::') ? '월드인포' : ns.startsWith('pt-char::') ? '봇카드' : ns.startsWith('pt-persona::') ? '페르소나' : ns === 'regex' ? '정규식' : '프리셋';
}

function short(text, length) {
    const chars = Array.from(String(text || '').replace(/\s+/g, ' ').trim());
    return chars.length > length ? chars.slice(0, length - 1).join('') + '…' : chars.join('');
}

export function activeTranslationText({ ns, part, rows, done, total }) {
    const names = rows.slice(0, 2).map(row => short(row.name || '(이름 없음)', 24));
    const extra = rows.length > 2 ? ` 외 ${rows.length - 2}개` : '';
    return `${translationKind(ns)} · ${part} · ${done}/${total} 처리 — ${names.length ? names.join(', ') + extra + ' 번역 중' : '다음 항목 확인 중'}`;
}

export function translationSummary(result) {
    const { total, success, cached, failed, stopped, skipped } = result;
    const done = success + cached + failed + skipped;
    return `처리 ${done}/${total} (${Math.round(done / Math.max(1, total) * 100)}%) · 성공 ${success} · 재사용 ${cached} · 실패 ${failed}`
        + (stopped ? ` · 중단 ${stopped}` : '') + (skipped ? ` · 내용 없음 ${skipped}` : '');
}

export function createTranslationProgress({ targets, ns, part, write, isStopped = () => false }) {
    const active = new Map(), settled = new Set(), failures = new Map();
    const counts = { total: targets.length, success: 0, cached: 0, failed: 0, stopped: 0, skipped: 0 };
    let closed = false;
    // Cache hits can finish thousands of rows in one run. Count each outcome
    // once instead of walking every completed row on every progress update.
    const snapshot = () => {
        const result = { ...counts, failures: [] };
        for (const [row, reason] of failures) result.failures.push({ id: row.id, name: row.name || '(이름 없음)', reason });
        return result;
    };
    const paint = () => {
        if (closed) return;
        const result = snapshot();
        const done = result.success + result.cached + result.failed + result.skipped;
        const rows = [...active.values()].flat().filter(row => !settled.has(row));
        write(isStopped() ? `${translationKind(ns)} · ${part} · 중단 중…` : activeTranslationText({ ns, part, rows, done, total: targets.length }), result);
    };
    paint();
    return {
        start(rows) { const token = Symbol(); active.set(token, rows); paint(); return token; },
        end(token) { active.delete(token); paint(); },
        settle(row, state, error) {
            if (closed || settled.has(row)) return;
            settled.add(row);
            counts[state]++;
            if (state === 'failed') failures.set(row, short(error?.message || error || '번역 결과를 받지 못했어요.', 300));
            paint();
        },
        stopping: paint,
        finish() {
            for (const row of targets) if (!settled.has(row)) { settled.add(row); counts.stopped++; }
            active.clear(); closed = true;
            const result = snapshot();
            const ending = result.stopped ? '중단' : result.failed ? '일부 실패' : '완료';
            write(`${translationKind(ns)} · ${part} 번역 ${ending} — ${translationSummary(result)}`, result);
            return result;
        },
    };
}

// Failures stay readable after the yellow busy indicator goes out. Retrying is
// explicit, and only receives failed IDs; successful cached results stay intact.
export function renderTranslationResult(doc, wrap, result, retry) {
    wrap.querySelector('.pt-run-result')?.remove();
    if (!result.failures.length) return;
    const box = doc.createElement('div'); box.className = 'pt-run-result';
    const details = doc.createElement('details');
    const summary = doc.createElement('summary'); summary.textContent = `실패 ${result.failed}개 · 이름과 이유 보기`;
    const list = doc.createElement('ul');
    for (const row of result.failures) {
        const item = doc.createElement('li'); item.textContent = `${row.name} — ${row.reason}`; list.append(item);
    }
    details.append(summary, list); box.append(details);
    if (retry) {
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'pt-btn pt-btn-secondary';
        button.textContent = `실패 ${result.failed}개만 다시 번역`;
        button.onclick = () => retry(result.failures.map(row => row.id)); box.append(button);
    }
    wrap.append(box);
}
