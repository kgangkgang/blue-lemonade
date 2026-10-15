// 2.6.0 생각 블록(추론) 카드 (사용자 요청 10-15): 과일의 마음 프리셋은 답마다 중국어 생각(ECoT)을 실리태번 추론 칸(extra.reasoning)에 둔다.
//   카드 머리에 길이 · 말을 작게 보이고, 펼친 카드 안 「번역해서 보기」로 번역기(채팅 번역 프롬프트 · 연결 · 용어집 · 문단 캐시 ·
//   숨김 주석 · 자리표시자 규칙 그대로 — index.js translateText)를 써서 한국어로 보여 준다.
//   번역은 extra.llmt_reasoning = { hash, text, shown } 에 따로 둔다 — 원문 reasoning 은 그대로(복사 · 편집 · 프롬프트에 넣는 글은 원문).
//   보이는 글만 서식 훅(isReasoning)에서 바꾼다: 실리태번이 추론 칸을 다시 그릴 때마다 같은 결과. 원문 글이 바뀌면(편집) 지문이 달라 옛 번역은 안 쓴다.
//   실리태번 기본 번역 확장이 넣은 reasoning_display_text 가 있으면 그쪽을 존중한다 (손대지 않음).
// 카드 꾸밈(머리 글 · 단추 줄)은 서식 훅이 그 메시지의 추론을 그릴 때 한 번 붙이고 고친다 — 상주 관찰자 없음.

const later = fn => setTimeout(fn, 0);
const SCRIPT_NAMES = [['중국어', /\p{Script=Han}/gu], ['일본어', /[\p{Script=Hiragana}\p{Script=Katakana}]/gu], ['영어', /\p{Script=Latin}/gu], ['한국어', /\p{Script=Hangul}/gu]];
/** 글의 주된 말 — 가나가 조금이라도 많으면 일본어 (한자만 많은 일본어 생각도 있다) */
function languageOf(text) {
    const value = String(text ?? '');
    const counts = Object.fromEntries(SCRIPT_NAMES.map(([name, re]) => [name, (value.match(re) || []).length]));
    if (counts['일본어'] > 20 && counts['일본어'] * 4 > counts['중국어']) return '일본어';
    const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return counts[best] ? best : '';
}
const trimmed = text => String(text ?? '').trim();

/**
 * deps:
 *  hashOf(text) → 문자열 지문 · translate(text, { onProgress, signal }) → Promise<번역문> · progressText(info, started) → 진행 문구
 *  save(id) → Promise (그 메시지 스와이프 맞추기 + 채팅 저장) · redraw(id) — 그 메시지의 추론 칸을 다시 그린다 (실리태번 updateReasoningUI)
 *  enabled() → 이 기능을 켰나
 */
export function createReasoningView({ getContext, hashOf, translate, progressText, save, redraw, enabled }) {
    const running = new Map();   // 메시지 객체 → { started, info, controller }
    const messageOf = id => getContext().chat?.[Number(id)] ?? null;
    /** 지금 원문에 맞는 저장된 번역 (없으면 null) */
    function storedOf(message) {
        const extra = message?.extra, data = extra?.llmt_reasoning, reasoning = extra?.reasoning;
        if (!data || typeof data.text !== 'string' || !trimmed(reasoning) || data.hash !== hashOf(trimmed(reasoning))) return null;
        return data;
    }

    /** 서식 훅 (isReasoning · 정규식 전): 번역해서 보기를 켠 메시지면 번역문을 그린다 */
    function render(mes, info) {
        const id = Number(info?.messageId);
        if (!(id >= 0)) return mes;
        later(() => decorate(id));
        if (!enabled()) return mes;
        const message = messageOf(id), stored = storedOf(message);
        if (!stored?.shown || message.extra.reasoning_display_text || trimmed(mes) !== trimmed(message.extra.reasoning)) return mes;
        return stored.text;
    }

    /** 카드 꾸밈: 머리에 「1,234자 · 중국어」, 펼친 안쪽 맨 위에 단추 줄 */
    function decorate(id) {
        const element = document.querySelector(`#chat .mes[mesid="${id}"]`), details = element?.querySelector('.mes_reasoning_details');
        const message = messageOf(id), reasoning = trimmed(message?.extra?.reasoning);
        if (!details) return;
        const header = details.querySelector('.mes_reasoning_header');
        let meta = details.querySelector('.llmt-rsn-meta'), bar = details.querySelector(':scope > .llmt-rsn-bar');
        const thinking = details.dataset.state === 'thinking' || element.querySelector('.reasoning_edit_textarea');
        if (!enabled() || !reasoning || thinking || message?.extra?.reasoning_display_text) { meta?.remove(); bar?.remove(); return; }
        const stored = storedOf(message), job = running.get(message), language = languageOf(reasoning);
        if (!meta && header) {
            meta = document.createElement('span');
            meta.className = 'llmt-rsn-meta';
            const title = header.querySelector('.mes_reasoning_header_title');
            if (title) title.after(meta); else header.append(meta);
        }
        if (meta) meta.textContent = [`${reasoning.length.toLocaleString('ko-KR')}자`, stored?.shown ? '한국어로 보는 중' : language].filter(Boolean).join(' · ');
        // 한국어 생각이면 번역 단추는 두지 않는다 (번역해 둔 것을 되돌리는 단추는 둔다)
        if (language === '한국어' && !stored?.shown && !job) { bar?.remove(); return; }
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'llmt-rsn-bar';
            bar.innerHTML = '<button type="button" class="menu_button llmt-rsn-btn"></button><span class="llmt-rsn-note" aria-live="polite"></span>';
            const summary = details.querySelector(':scope > .mes_reasoning_summary');
            if (summary) summary.after(bar); else details.append(bar);
        }
        const button = bar.querySelector('.llmt-rsn-btn'), note = bar.querySelector('.llmt-rsn-note');
        button.dataset.mesid = String(id);
        button.disabled = Boolean(job);
        button.textContent = job ? '번역 중…' : stored?.shown ? '원문 보기' : stored ? '번역 보기' : '번역해서 보기';
        note.textContent = job ? progressText(job.info, job.started) : stored?.shown ? '번역기로 옮긴 글이에요. 원문은 그대로 있어요.' : '';
    }

    async function toggle(id) {
        const message = messageOf(id);
        const reasoning = trimmed(message?.extra?.reasoning);
        if (!message || !reasoning || running.has(message)) return;
        const stored = storedOf(message);
        if (stored) {   // 이미 번역해 둔 것: 요청 없이 보기만 바꾼다
            stored.shown = !stored.shown;
            redraw(id); decorate(id);
            await save(id);
            return;
        }
        const job = { started: Date.now(), info: null, controller: new AbortController() };
        running.set(message, job);
        decorate(id);
        const tick = setInterval(() => { const at = getContext().chat.indexOf(message); if (at >= 0) decorate(at); }, 1000);
        try {
            const text = await translate(reasoning, { signal: job.controller.signal, onProgress: info => { job.info = info; } });
            const at = getContext().chat.indexOf(message);
            // 번역하는 동안 생각 글이 바뀌었거나 메시지가 사라졌으면 버린다
            if (at < 0 || trimmed(message.extra?.reasoning) !== reasoning) { toastr.info('생각 글이 바뀌어서 번역을 붙이지 않았어요.', '생각 번역'); return; }
            if (!trimmed(text)) throw new Error('빈 번역이 왔어요.');
            message.extra.llmt_reasoning = { hash: hashOf(reasoning), text: String(text).trim(), shown: true };
            running.delete(message);
            redraw(at); decorate(at);
            await save(at);
        } catch (error) {
            if (error?.cancelled) toastr.info(error.message, '생각 번역');
            else toastr.error(String(error?.message || error).slice(0, 200), '생각 번역 실패', { timeOut: 8000 });
        } finally {
            clearInterval(tick);
            running.delete(message);
            const at = getContext().chat.indexOf(message);
            if (at >= 0) decorate(at);
        }
    }

    document.addEventListener('click', event => {
        const button = event.target.closest?.('.llmt-rsn-btn');
        if (!button) return;
        event.preventDefault(); event.stopPropagation();
        toggle(Number(button.dataset.mesid ?? button.closest('.mes')?.getAttribute('mesid')));
    }, true);

    /** 화면에 있는 생각 칸 모두 다시 꾸미기 (설정을 바꿨을 때) */
    function decorateAll() {
        for (const element of document.querySelectorAll('#chat .mes[mesid]')) decorate(Number(element.getAttribute('mesid')));
    }
    return { render, decorate, decorateAll, toggle, languageOf };
}
