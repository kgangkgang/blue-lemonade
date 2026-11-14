// 11-14 로그 복사 「글 속 그림」 — 고른 메시지에 붙은 그림(캐릭터 에셋 · 생성 그림 · 본문 img · 메시지에 붙인 그림)을 그 메시지 맨 앞에 넣어요(사용자 「에셋 있으면 자동으로 이런 식으로」).
//   붙인 곳(깡통)에서 남이 보려면 그림 주소가 깡통에 올린 주소여야 해요 — 실리태번 주소(내 PC · 내 서버)는 남이 못 보고 주소가 드러나요.
//   그래서 그림을 두 갈래로 나눠요:
//     - 바로 넣는 그림: 실리태번 밖 공개 주소(https · 점 있는 공개 도메인 · 내 서버 · 내부망 · IP 주소가 아님) — 주소 그대로
//     - 올릴 그림: 그 밖 전부(실리태번 주소 · data: · 내부망 · IP) — 시트 「글 속 그림」 칸에 깡통에 올린 이미지 코드(주소)를 차례대로 붙여야 들어가요(안 붙이면 그 그림은 빼요)
//   붙인 코드도 같은 검사를 거쳐요(검토 보1 — 실리태번 주소를 잘못 붙여도 복사 글에 실리지 않게) · 이름 숨김도 걸어요.
//   그림 칸은 인라인 style 만(깡통 편집기가 지워도 모양이 남게) + 표지 class blq-pic(깡통이 그림마다 다는 번호표 숨기기 규칙 — log-copy-lift.js PIC_RULE).
//   DOM 없는 순수 모듈(시험 tools/tests/log-copy-pics.mjs).

/** 표지 class — 복사 글의 <style> 이 이 칸 안 깡통 번호표만 숨겨요(갤러리 틀의 번호표 규칙은 안 건드려요) */
export const PIC_CLASS = 'blq-pic';
/** 깡통이 그림마다 붙이는 번호표(div.image-number-badge)와 감싸는 칸(div.image-number-wrapper — 떠 있는 판) — 그림 칸 안에서만 숨기고 흐름대로 */
export const PIC_RULE = `.${PIC_CLASS} .image-number-badge{display:none!important}.${PIC_CLASS} .image-number-wrapper{display:block!important;position:static!important}`;
/** 그림 alt — 깡통 업로드 그림과 같은 말(캐릭터 · 파일 이름이 글에 남지 않게) */
export const PIC_ALT = '업로드 이미지';
/** 한 번에 넣는 그림 수 상한(갤러리와 같은 40) */
export const PIC_MAX = 40;

const escAttr = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const OK_SRC = /^(https?:\/\/|data:image\/(?:png|gif|jpe?g|webp|avif);)/i;
const size = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0);

/**
 * 그림 칸 HTML 한 덩이 — 둥근 모서리 · 칸 폭 가득 · 아래 한 줄 띄움(사진 꼴) · 들여쓰기 · 줄 높이 0
 *   w · h(원본 크기)를 알면 aspect-ratio 를 적어요 — 깡통에서 그림이 늦게 떠도 글이 밀리지 않게(검토 사7) · auto: 뜬 뒤엔 실제 그림 비율(올린 그림을 잘랐어도 안 늘어나요)
 * @param {{ src: string, w?: number, h?: number }} pic
 * @param {{ tag?: 'div'|'span' }} [o] span: <p> 안에 들어갈 때(블록 꼴 span)
 */
export function picHtml(pic, { tag = 'div' } = {}) {
    const src = String(pic?.src ?? '').trim();
    if (!OK_SRC.test(src)) return '';
    const w = size(pic?.w), h = size(pic?.h);
    const box = `${tag === 'span' ? 'display:block;' : ''}margin:0 0 1em;line-height:0;text-indent:0;text-align:center`;
    return `<${tag} class="${PIC_CLASS}" data-bl-pic style="${box}"><img src="${escAttr(src)}" alt="${escAttr(PIC_ALT)}" loading="lazy" style="display:block;width:100%;max-width:100%;height:auto;${w && h ? `aspect-ratio:auto ${w}/${h};` : ''}margin:0;border-radius:8px"></${tag}>`;
}

/** 남이 못 보는(또는 내 자리가 드러나는) 호스트인가 — 점 없는 이름 · 내부 꼬리 · IP 주소(v4 · v6 모두)는 전부 내부로(검토 사2) */
function privateHost(host) {
    const h = String(host ?? '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (!h || !h.includes('.') || h.includes(':')) return true;   // 한 단어 이름(공유기 · MagicDNS) · IPv6(::ffff:… 포함)
    if (/^\d+(\.\d+){3}$/.test(h)) return true;   // IPv4 — 공개 IP 라도 내 서버 자리일 수 있어 올려요
    return /(^|\.)(localhost|local|internal|lan|home|localdomain|intranet|corp|private|arpa|ts\.net|test|invalid|example)$/.test(h);
}

/**
 * 깡통에 올려야 하는 그림인가 — https · 점 있는 공개 도메인 · 실리태번과 다른 곳일 때만 「바로」, 그 밖(http · data: · file: · 상대 주소 · 내부망 · IP)은 올려야 해요.
 * @param {string} src 그림 주소(절대 주소)
 * @param {string} [origin] 실리태번 주소(location.origin)
 */
export function needsUpload(src, origin = '') {
    const text = String(src ?? '').trim();
    if (!/^https:\/\//i.test(text)) return true;
    let url;
    try { url = new URL(text); } catch { return true; }
    if (url.username || url.password) return true;
    if (origin && url.origin === String(origin)) return true;
    try { if (origin && url.hostname === new URL(String(origin)).hostname) return true; } catch { /* 모르는 origin */ }
    return privateHost(url.hostname);
}

/**
 * 고른 로그의 그림 목록(같은 주소는 한 번 · 처음 나온 차례) — 시트 「글 속 그림」 칸이 보여 줘요.
 * @returns {{ src: string, w: number, h: number, upload: boolean, n: number }[]} n: 올릴 그림 번호(1부터 · 바로 넣는 그림은 0)
 */
export function picList(model, origin = '') {
    const out = [], seen = new Set();
    let n = 0;
    for (const m of model?.messages ?? []) for (const p of m?.pics ?? []) {
        const src = String(p?.src ?? '').trim();
        if (!src || seen.has(src) || out.length >= PIC_MAX) continue;
        seen.add(src);
        const upload = needsUpload(src, origin);
        out.push({ src, w: size(p?.w), h: size(p?.h), upload, n: upload ? ++n : 0 });
    }
    return out;
}

/**
 * 그림마다 어디로 갈지 — 시트 칸 요약이 실제로 들어가는 수를 그대로 적게(검토 사5)
 * @returns {{ items: { src: string, upload: boolean, n: number, to: string, why: ''|'wait'|'bad'|'hidden' }[], bad: number[] }}
 *   to: 복사 글에 들어갈 주소(빈 글이면 안 들어감) · why: wait 아직 안 붙임 · bad 붙인 코드가 실리태번 · 내부망 · data: 주소 · hidden 이름 숨김으로 뺌 · bad: 거절한 코드 번호(1부터)
 */
export function picPlan(model, { codes = [], origin = '', allow = () => true } = {}) {
    const list = picList(model, origin);
    const bad = [];
    codes.forEach((c, i) => { if (needsUpload(String(c ?? '').trim(), origin)) bad.push(i + 1); });
    const items = list.map((item) => {
        if (!item.upload) return { ...item, to: allow(item.src) ? item.src : '', why: allow(item.src) ? '' : 'hidden' };
        const code = String(codes[item.n - 1] ?? '').trim();
        if (!code) return { ...item, to: '', why: 'wait' };
        if (needsUpload(code, origin) || !OK_SRC.test(code)) return { ...item, to: '', why: 'bad' };
        if (!allow(code)) return { ...item, to: '', why: 'hidden' };
        return { ...item, to: code, why: '' };
    });
    return { items, bad };
}

/**
 * 메시지마다 그림 노드({ t: 'pic', src, w, h })를 글 맨 앞에 — 렌더러(log-copy-render.js nodesHtml · 심플 · 기본 글꾸 새 틀)가 그림 칸으로 그려요.
 *   올릴 그림은 붙인 주소(codes 차례 = 올릴 그림 번호 차례)가 공개 https 일 때만 그 주소로 · 없거나 실리태번 · 내부망 주소면 빼요. 그림이 하나도 안 들어가면 받은 모델 그대로(복사 글 바이트도 그대로).
 * @param {object} model 로그 모델(메시지마다 pics: [{ src, w?, h? }])
 * @param {{ codes?: string[], origin?: string, off?: boolean, allow?: (src: string) => boolean }} [o] codes: 깡통에 올린 그림 주소(차례대로) · off: 그림 넣기 끔 ·
 *   allow: 이 주소를 써도 되나(이름 숨김이 켜져 있으면 주소에 가린 이름이 든 그림은 빼요 — log-copy-words.js rewriteImages · 붙인 코드에도)
 */
export function attachPics(model, { codes = [], origin = '', off = false, allow = () => true } = {}) {
    if (off || !model?.messages?.length) return model;
    const { items } = picPlan(model, { codes, origin, allow });
    const to = new Map(items.filter(x => x.to).map(x => [x.src, x]));
    if (!to.size) return model;
    let any = false;
    const messages = model.messages.map((m) => {
        const pics = [...new Set((m?.pics ?? []).map(p => String(p?.src ?? '').trim()))].map(src => to.get(src)).filter(Boolean);
        if (!pics.length) return m;
        any = true;
        return { ...m, nodes: [...pics.map(x => ({ t: 'pic', src: x.to, ...(x.w && x.h ? { w: x.w, h: x.h } : {}) })), ...(m.nodes ?? [])] };
    });
    return any ? { ...model, messages } : model;
}

/**
 * 「깡통에 올린 코드」 칸 글 → 그림 주소 목록(붙인 차례 그대로 · 거를 주소도 자리를 지켜요 — 하나를 버리면 뒤 번호가 밀리니까요).
 *   <img src> 가 있으면 그 주소들, 없으면 줄마다 주소 꼴(https? · file: · data: · / 로 시작) 낱말. 검사는 picPlan 이 해요.
 */
export function codesFrom(text) {
    const raw = String(text ?? '');
    const unent = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const tags = [...raw.matchAll(/<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(m => unent(m[1] ?? m[2] ?? m[3] ?? ''));
    if (tags.length) return tags.slice(0, PIC_MAX);
    return raw.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => /^(https?:\/\/|file:|data:|\/)\S+$/i.test(w)).slice(0, PIC_MAX);
}

/** 시험 · 다른 길에서 그림 노드가 든 모델인가 */
export const hasPics = model => (model?.messages ?? []).some(m => (m?.nodes ?? []).some(n => n?.t === 'pic'));
