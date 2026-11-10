// 로어북 스캔에서 상태창 글 빼기 (1.1.2, 기본 꺼짐) — 순수 계산 (DOM · 실리태번 없음, tools/tests/wi-skip.mjs 가 검사해요).
// 왜: 상태창 · 트래커처럼 접힌 칸이나 코드 칸에 든 낱말(지명 · 이름)이 로어북 키워드에 걸려 엉뚱한 항목이 켜져요.
// 무엇을: 로어북이 키워드를 찾는 동안만 그 칸의 글을 빼요. AI 에게 보내는 프롬프트에는 원래 글이 그대로 들어가요.
// 빼는 칸(가장 좁게): ``` · ~~~ 코드 칸과 <details>…</details> 접는 칸. 닫히지 않은 칸은 건드리지 않아요.
const FENCE = /(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;
const DETAILS = /<details\b[^>]*>[\s\S]*?<\/details\s*>/gi;

/** 스캔용 글: 코드 칸 · 접는 칸을 뺀 글 (뺀 것이 없으면 받은 글 그대로) */
export function stripForScan(text) {
    const source = String(text ?? '');
    if (!source || (!source.includes('```') && !source.includes('~~~') && !/<details\b/i.test(source))) return source;
    // 접는 칸 안에 코드 칸이 들기도 하고 그 반대도 있어요 — 바깥 칸부터 한 번씩
    return source.replace(DETAILS, '').replace(FENCE, '$1').replace(/\n{3,}/g, '\n\n');
}

/**
 * 생성 직전 메시지 목록(실리태번이 가로채기에 넘기는 배열)에서 스캔용 사본으로 바꿔 끼워요.
 * 원래 메시지 객체는 건드리지 않고(실제 채팅과 같은 객체예요) 그 자리에 글만 바꾼 사본을 둬요.
 * 돌려주는 restore() 를 부르면 사본이 아직 그 배열에 있는 자리만 원래 객체로 되돌려요(여러 번 불러도 한 번만).
 * @returns {{ count: number, restore: () => number }}
 */
export function swapForScan(chat) {
    const swapped = [];
    if (Array.isArray(chat)) for (let i = 0; i < chat.length; i++) {
        const message = chat[i];
        if (!message || typeof message !== 'object' || typeof message.mes !== 'string') continue;
        const mes = stripForScan(message.mes);
        if (mes === message.mes) continue;
        const copy = { ...message, mes };
        chat[i] = copy;
        swapped.push([copy, message]);
    }
    let done = false;
    return {
        count: swapped.length,
        restore() {
            if (done) return 0;
            done = true;
            let restored = 0;
            for (const [copy, original] of swapped) {
                // 다른 확장이 그 사이 배열을 자르거나 끼워 넣었을 수 있어요 — 번호가 아니라 사본 객체로 찾아요
                const at = chat.indexOf(copy);
                if (at >= 0) { chat[at] = original; restored++; }
            }
            return restored;
        },
    };
}
