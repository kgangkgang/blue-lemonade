import { LABELS, esc } from './core.js';
import { state, save, context, chatKey, enabled } from './state.js';
import { requestRecords, clearRequests } from './requests.js';
import { diagnose } from './diagnostics.js';
import { addSample, learnTaste, syncTaste } from './taste.js';
import { prepareTranslation, applyTranslation } from './translation.js';
let selected = null, dialog = null;
export function setSelection(value) { selected = value; }
export function clearSelection() { selected = null; }
const textBlock = (label, text) => `<details><summary>${esc(label)}</summary><pre>${esc(text)}</pre></details>`;
function frame(id) {
    const box = document.createElement('dialog'); box.className = 'bl-assist'; box.dataset.tool = id;
    box.innerHTML = `<header><h3>${LABELS[id]}</h3><button type="button" data-close aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></header><div class="bl-assist-body"></div><p class="bl-assist-status" role="status" aria-live="polite"></p>`;
    document.body.append(box); box.querySelector('[data-close]').onclick = () => box.close();
    box.addEventListener('close', () => { box.remove(); if (dialog === box) dialog = null; });
    box.showModal(); dialog = box; return box;
}
export function closeTools() { dialog?.close(); selected = null; }
function status(box, message) { if (box.isConnected) box.querySelector('[role=status]').textContent = message; }
async function action(box, button, fn, busy = '처리 중…') {
    button.disabled = true; status(box, busy);
    try { await fn(); if (box.isConnected) status(box, ''); }
    catch (e) { status(box, e.message || '작업을 마치지 못했어요.'); }
    finally { button.disabled = false; }
}
export async function openTool(id) {
    if (!enabled(id)) { globalThis.toastr?.info('설정 → 확장에서 기능을 켜 주세요.'); return; }
    const snapshot = selected; dialog?.close(); const box = frame(id), body = box.querySelector('.bl-assist-body');
    if (id === 'conflicts') {
        body.innerHTML = '<p>알려진 중복 실행·설치 버전·화면 간섭을 살펴봐요.</p><div class="bl-assist-actions"><button data-check>검사</button><button data-copy disabled>진단 복사</button></div><div data-result></div>';
        let report = '';
        const run = () => action(box, body.querySelector('[data-check]'), async () => {
            const result = await diagnose(); if (!box.isConnected) return;
            report = result.report;
            body.querySelector('[data-result]').innerHTML = result.rows.map(r => `<article><b>${esc(r.level)}</b><p>${esc(r.text)}</p></article>`).join('');
            body.querySelector('[data-copy]').disabled = false;
        }, '점검 중…');
        body.querySelector('[data-check]').onclick = run;
        body.querySelector('[data-copy]').onclick = event => action(box, event.currentTarget, async () => { await navigator.clipboard.writeText(report); globalThis.toastr?.success('진단을 복사했어요.'); });
        await run();
    } else if (id === 'requestview') {
        const paint = () => {
            const records = requestRecords();
            body.innerHTML = '<p>켜 둔 동안의 최근 요청 5개를 이 탭에서만 보관해요. 새로고침하면 비워져요.</p><button data-clear>기록 비우기</button><div data-records></div>';
            body.querySelector('[data-clear]').onclick = () => { clearRequests(); paint(); };
            body.querySelector('[data-records]').innerHTML = records.length ? records.map(r => {
                const included = r.history.filter(h => h.matched).map(h => '#' + h.id).join(', ') || '일치 항목 없음';
                const unknown = r.history.filter(h => !h.matched).map(h => '#' + h.id).join(', ') || '없음';
                return `<article><h4>${esc(new Date(r.time).toLocaleTimeString())} · ${esc(r.model)}${Number.isInteger(r.messageId) ? ' · 답 #' + r.messageId : ''}</h4><p>${r.request.length}개 요청 메시지${r.clipped ? ' · 50만 자 이후는 생략됨' : ''}</p>${textBlock('대화 원문 대조', '전체 원문 확인: ' + included + '\n일치 미확인: ' + unknown + '\n일치 미확인은 제외 판정이 아니에요. 정규식·매크로·요약·서식 때문에 달라질 수 있어요.')}<details><summary>로어북 ${r.wi.length}개 활성화</summary>${r.wi.map(w => textBlock((w.matched ? '요청에서 확인 · ' : '일치 미확인 · ') + w.title, w.text)).join('') || '<p>활성화 이벤트에서 받은 항목이 없어요.</p>'}</details><details><summary>작가 노트·확장 주입 ${r.injections.length}개</summary>${r.injections.map(p => textBlock((p.matched ? '요청에서 확인 · ' : '일치 미확인 · ') + p.name, p.text)).join('')}</details><details><summary>전송 직전 요청 본문</summary>${r.request.map((m,i) => textBlock(`${i + 1}. ${m.role}`, m.content)).join('')}</details></article>`;
            }).join('') : '<p>기능을 켠 뒤 새 답변을 받으면 여기에 보여요.</p>';
        };
        paint(); const update = () => { if (box.isConnected) paint(); }; document.addEventListener('bl:request-recorded', update);
        box.addEventListener('close', () => document.removeEventListener('bl:request-recorded', update), { once: true });
    } else if (id === 'retranslate') {
        body.innerHTML = '<p>선택한 글이 들어 있는 문단을 원문에서 찾아 현재 번역 모델로 재번역해요. 확인 후 해당 문단만 교체해요.</p>' + (snapshot ? textBlock('선택한 번역문', snapshot.text) : '<p>창을 닫고 채팅 본문에서 문장이나 문단을 선택한 뒤, 나타나는 언어 버튼을 눌러 주세요.</p>') + '<button data-translate>다시 번역</button><div data-preview></div>';
        const button = body.querySelector('[data-translate]'); button.disabled = !snapshot;
        button.onclick = () => action(box, button, async () => {
            const job = await prepareTranslation(snapshot); if (!box.isConnected) return;
            const preview = body.querySelector('[data-preview]');
            preview.innerHTML = textBlock('교체할 기존 문단', job.translated.slice(job.span.start,job.span.end)) + textBlock('대응 원문 확인 (AI 대조)', job.original) + `<label>새 번역<textarea data-new rows="7">${esc(job.result)}</textarea></label><div class="bl-assist-actions"><button data-apply>이 부분 교체</button><button data-undo disabled>되돌리기</button></div>`;
            let undo = null;
            preview.querySelector('[data-apply]').onclick = event => action(box, event.currentTarget, async () => {
                job.result = preview.querySelector('[data-new]').value;
                undo = await applyTranslation(job);
                preview.querySelector('[data-apply]').hidden = true; preview.querySelector('[data-new]').disabled = true;
                preview.querySelector('[data-undo]').disabled = false; button.disabled = true;
                globalThis.toastr?.success('선택한 부분을 바꿨어요.');
            });
            preview.querySelector('[data-undo]').onclick = event => action(box, event.currentTarget, async () => {
                await applyTranslation(undo); preview.replaceChildren(); button.disabled = true;
                globalThis.toastr?.success('기존 번역으로 되돌렸어요.');
            });
        }, '원문을 대조하고 재번역하는 중… (모델 호출 2회)');
    } else if (id === 'taste') {
        const paint = () => {
            const s = state(), key = chatKey(), samples = s.samples.filter(v => v.scope === 'all' || v.chatKey === key);
            const rules = s.rules.filter(v => v.scope === 'all' || v.chatKey === key);
            body.innerHTML = `<p>예시에서 취향을 찾고, 채택한 규칙만 답변 생성에 적용해요.</p><label class="bl-assist-check"><input type="checkbox" data-active ${s.applyTaste ? 'checked' : ''}>채택한 취향 적용</label><details open><summary>예시 추가</summary><select data-kind aria-label="예시 종류"><option value="like">좋은 글</option><option value="dislike">싫은 글</option><option value="edit">내가 고친 글</option></select><textarea data-sample rows="4" maxlength="6000" placeholder="문장이나 답변" aria-label="예시 본문">${esc(snapshot?.text || '')}</textarea><textarea data-revision rows="3" maxlength="6000" placeholder="고친 문장" aria-label="고친 문장" hidden></textarea><input data-note maxlength="500" placeholder="이유 (선택)" aria-label="예시 이유"><select data-scope aria-label="예시 범위"><option value="chat">현재 채팅</option><option value="all">모든 채팅</option></select><button data-add>예시 담기</button></details><div class="bl-assist-actions"><button data-learn ${samples.length ? '' : 'disabled'}>취향 분석 (${samples.length}개)</button></div><p>분석할 때 위 범위의 예시를 현재 연결된 AI에 보내요. 후보는 자동 적용하지 않아요.</p><details><summary>저장한 예시 ${samples.length}개</summary>${samples.map(v => `<article><b>${{like:'좋은 글',dislike:'싫은 글',edit:'고친 글'}[v.kind] || ''}</b>${textBlock('본문', v.text + (v.revision ? '\n→\n' + v.revision : '') + (v.note ? '\n이유: ' + v.note : ''))}<button data-remove-sample="${esc(v.id)}" aria-label="예시 삭제"><i class="fa-solid fa-trash"></i></button></article>`).join('')}</details><section data-rules><h4>취향 후보·채택한 규칙</h4>${rules.map(r => `<article data-rule="${esc(r.id)}"><textarea rows="3" data-rule-text aria-label="문체 규칙">${esc(r.text)}</textarea><p>${esc(r.reason)}${r.evidence.length ? ' · 근거 예시 ' + r.evidence.length + '개' : ''}</p><div class="bl-assist-actions"><select data-rule-scope aria-label="규칙 적용 범위"><option value="chat" ${r.scope === 'chat' ? 'selected' : ''}>현재 채팅</option><option value="all" ${r.scope === 'all' ? 'selected' : ''}>모든 채팅</option></select><label class="bl-assist-check"><input type="checkbox" data-accept ${r.accepted ? 'checked' : ''}>채택</label><button data-remove-rule aria-label="규칙 삭제"><i class="fa-solid fa-trash"></i></button></div></article>`).join('') || '<p>예시를 분석하면 후보가 나와요.</p>'}</section>`;
            body.querySelector('[data-active]').onchange = event => { s.applyTaste = event.target.checked; save(); syncTaste(); };
            body.querySelector('[data-kind]').onchange = event => { body.querySelector('[data-revision]').hidden = event.target.value !== 'edit'; };
            body.querySelector('[data-add]').onclick = event => action(box, event.currentTarget, async () => {
                addSample({ text: body.querySelector('[data-sample]').value, kind: body.querySelector('[data-kind]').value, revision: body.querySelector('[data-revision]').value, note: body.querySelector('[data-note]').value, scope: body.querySelector('[data-scope]').value }); paint();
            });
            body.querySelector('[data-learn]').onclick = event => action(box, event.currentTarget, async () => { await learnTaste(); if (box.isConnected) paint(); }, '문체 취향을 분석하는 중…');
            body.querySelectorAll('[data-remove-sample]').forEach(button => button.onclick = () => { s.samples = s.samples.filter(v => v.id !== button.dataset.removeSample); save(); paint(); });
            body.querySelectorAll('[data-rule]').forEach(row => {
                const rule = s.rules.find(r => r.id === row.dataset.rule);
                const update = () => { rule.text = row.querySelector('[data-rule-text]').value.trim().slice(0, 600); rule.scope = row.querySelector('[data-rule-scope]').value; rule.chatKey = key; rule.accepted = row.querySelector('[data-accept]').checked && !!rule.text; save(); syncTaste(); };
                row.querySelectorAll('input,select,textarea').forEach(input => input.onchange = update);
                row.querySelector('[data-remove-rule]').onclick = () => { s.rules = s.rules.filter(r => r.id !== rule.id); save(); syncTaste(); paint(); };
            });
        };
        paint();
    }
}
