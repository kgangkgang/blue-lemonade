// 원본 omni-next 3274fc8f(1.0.7) 의 src/log-copy-bare.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 「🍽️ 시식하기」의 위 글 · 아래 글 빼기가 테마 로그 복사와 같은 길로 걷으려고 써요)
// 로그 복사 — 1.0.7 「위 글 · 아래 글 빼기」(사용자 「위 아래 글자들 … 부가적인 것들 빼는 것도 다 버튼 · 완전 심플한 게 좋을 때도 있음」).
// 틀에 박힌 글(머리 표 · 부제 · 능력치 칩 · 도장 · 꼬리말 · 서명 …)을 걷어요. renderLog 결과(미리보기 표시 data-f · data-bl-msg 가 붙은 HTML)에서
//   메시지(data-bl-msg)도, 남길 칸(제목 · 날짜 · 알약 · 추가 정보 — 제 버튼이 따로 있어요)도 품지 않은 「글 든 요소」를 통째로 걷어요.
//   첫 메시지보다 앞이면 위 글, 마지막 메시지보다 뒤면 아래 글 · 메시지 사이 글(배치 장식)은 그대로. 글 없는 장식(선 · 그림 · 테두리 · 이모지)도 그대로.
//   알약 앞 낱말(깡통 · 모델 · 프롬프트 — 값과 한 덩어리)과 추가 정보 접힘 상자는 남겨요. 제목 옆에 붙은 꾸밈 글(「To.」 …)은 걷어요.
//   접힘 머리(summary)는 걷지 않고 안의 글만 걷어요(머리를 지우면 브라우저가 「자세히」를 대신 그려요).
// 받은 HTML 을 고치지 않고 걷기만 해요(남는 부분은 글자 하나 다르지 않게). DOM 없는 순수 함수 — 테마 시트와 글꾸 마트 시식 창(사본)이 같이 써요.
export const KEEP_FIELDS = ['title', 'date', 'mark', 'char', 'model', 'prompt', 'info'];
/** 알약 앞 낱말(log-copy-presets.js HEAD_TAGS) */
export const KEEP_LABELS = ['깡통', '모델', '프롬프트'];
const VOID = new Set(['br', 'img', 'hr', 'wbr', 'col', 'area', 'source', 'input', 'meta', 'link']);
const LETTER = /[\p{L}\p{N}]/u;
const TOKEN = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|[^<]+|</g;

/** 글자 참조를 푼 글(글자인지만 봐요) */
const plain = text => text.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16) || 32)).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d) || 32)).replace(/&[a-z]+;/gi, ' ');

function parse(html) {
    const root = { tag: '', open: '', close: '', kids: [] };
    const stack = [root];
    for (const m of html.matchAll(TOKEN)) {
        const [all, close, open, attrs = '', self] = m;
        const top = stack[stack.length - 1];
        if (close) {
            const name = close.toLowerCase();
            const at = stack.findLastIndex((node, i) => i > 0 && node.tag === name);
            if (at > 0) { stack[at].close = all; stack.length = at; } else top.kids.push({ text: all, raw: true });
        } else if (open) {
            const name = open.toLowerCase();
            const field = /\sdata-f="([a-z]+)"/.exec(attrs)?.[1] ?? '';
            const node = { tag: name, open: all, close: '', kids: [], msg: /\sdata-bl-msg(?:[\s=]|$)/.test(attrs), field };
            top.kids.push(node);
            if (!self && !VOID.has(name)) stack.push(node);
        } else top.kids.push({ text: all, raw: all.startsWith('<!--') });
    }
    return root;
}
const textOf = node => (node.tag === undefined ? (node.raw ? '' : plain(node.text)) : node.kids.map(textOf).join(''));
const html = node => node.tag === undefined ? node.text : node.open + node.kids.map(html).join('') + node.close;

/** 아래까지 훑어 표시: msgs(메시지 수) · keep(남길 칸) · letters(글자) */
function measure(node) {
    if (node.tag === undefined) { node.letters = !node.raw && LETTER.test(plain(node.text)); return node; }
    node.keepHere = KEEP_FIELDS.includes(node.field);
    node.msgs = node.msg ? 1 : 0;
    node.keep = node.keepHere;
    node.letters = false;
    for (const kid of node.kids) {
        measure(kid);
        if (kid.tag === undefined) { node.letters ||= kid.letters; continue; }
        if (!node.msg) node.msgs += kid.msgs;
        node.keep ||= kid.keep;
        node.letters ||= kid.letters;
    }
    node.unit = node.keepHere || (node.tag === 'details' && node.keep && !node.msgs);
    return node;
}

/**
 * @param {string} source renderLog 결과(표시 포함)
 * @param {{ top?: boolean, bottom?: boolean }} [cut] top: 첫 메시지 앞 글을 · bottom: 마지막 메시지 뒤 글을 걷어요
 * @returns {string} 걷은 HTML(걷을 게 없거나 메시지 표시가 없으면 받은 그대로)
 */
export function bareLog(source, { top = false, bottom = false } = {}) {
    const text = String(source ?? '');
    if (!top && !bottom) return text;
    const root = measure(parse(text));
    const total = root.msgs;
    if (!total) return text;
    let seen = 0;
    const drop = () => (seen === 0 ? top : seen >= total ? bottom : false);
    const prune = (node) => {
        const pill = node.kids.some(kid => kid.keepHere);
        node.kids = node.kids.filter((kid) => {
            if (kid.tag === undefined) return !(kid.letters && drop());
            if (kid.msg) { seen += 1; return true; }
            if (kid.unit) { seen += kid.msgs; return true; }
            if (pill && KEEP_LABELS.includes(textOf(kid).trim())) return true;
            if (kid.msgs || kid.keep || kid.tag === 'summary') { prune(kid); return true; }
            return !(kid.letters && drop());
        });
    };
    prune(root);
    return html(root);
}
/** 읽고 다시 쓴 HTML(시험용 — 받은 것과 같아야 해요) */
export const bareRoundTrip = source => html(parse(String(source ?? '')));
