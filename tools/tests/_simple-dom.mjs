// 시험 전용 작은 DOM — 로그 복사 소독기(src/log-copy-sanitize.js sanitizeTree)를 브라우저 없이 그대로 돌려요(log-copy-simple*.mjs 가 같이 써요).
//   sanitizeTree 가 쓰는 것만: querySelectorAll(태그 목록 · *) · attributes · get/set/removeAttribute · remove · tagName · <style> textContent.
//   주석(<!-- … -->)은 주석 마디로 들고 있다가 그대로 다시 써요(브라우저 innerHTML 과 같아요 — 소독기는 요소만 봐요).
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['style', 'script', 'textarea', 'title']);
const unent = s => s.replace(/&(quot|amp|lt|gt|#39);/g, (_, e) => ({ quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'" })[e]);
class Note { constructor(text) { this.note = text; } }
export class El {
    constructor(name, parent = null) { this.name = name; this.tagName = name.toUpperCase(); this.attrs = []; this.children = []; this.parentElement = parent; }
    get attributes() { return this.attrs.map(a => ({ ...a })); }
    getAttribute(n) { return this.attrs.find(a => a.name === n.toLowerCase())?.value ?? null; }
    setAttribute(n, v) { const a = this.attrs.find(x => x.name === n.toLowerCase()); if (a) a.value = String(v); else this.attrs.push({ name: n.toLowerCase(), value: String(v) }); }
    removeAttribute(n) { this.attrs = this.attrs.filter(a => a.name !== n.toLowerCase()); }
    remove() { const list = this.parentElement?.children; if (list) list.splice(list.indexOf(this), 1); }
    get textContent() { return this.children.map(c => (typeof c === 'string' ? c : c instanceof Note ? '' : c.textContent)).join(''); }
    set textContent(v) { this.children = [String(v)]; }
    querySelectorAll(sel) {
        const want = sel.split(',').map(s => s.trim().toLowerCase());
        const out = [];
        const walk = el => { for (const c of el.children) if (c instanceof El) { if (want.includes('*') || want.includes(c.name)) out.push(c); walk(c); } };
        walk(this);
        return out;
    }
    get innerHTML() {
        return this.children.map((c) => {
            if (typeof c === 'string') return c;
            if (c instanceof Note) return `<!--${c.note}-->`;
            const attrs = c.attrs.map(a => ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
            return VOID.has(c.name) ? `<${c.name}${attrs}>` : `<${c.name}${attrs}>${c.innerHTML}</${c.name}>`;
        }).join('');
    }
}
export function parse(html) {
    const root = new El('body');
    let cur = root, at = 0;
    const s = String(html);
    while (at < s.length) {
        const lt = s.indexOf('<', at);
        if (lt < 0) { cur.children.push(s.slice(at)); break; }
        if (lt > at) cur.children.push(s.slice(at, lt));
        if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt); cur.children.push(new Note(s.slice(lt + 4, e < 0 ? s.length : e))); at = e < 0 ? s.length : e + 3; continue; }
        const close = /^<\/([a-zA-Z][\w-]*)\s*>/.exec(s.slice(lt));
        if (close) { const name = close[1].toLowerCase(); let el = cur; while (el && el.name !== name) el = el.parentElement; if (el && el.parentElement) cur = el.parentElement; at = lt + close[0].length; continue; }
        const open = /^<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/.exec(s.slice(lt));
        if (!open) { cur.children.push('<'); at = lt + 1; continue; }
        const el = new El(open[1].toLowerCase(), cur);
        for (const [, n, dq, sq, bare] of open[2].matchAll(/\s+([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) el.attrs.push({ name: n.toLowerCase(), value: unent(dq ?? sq ?? bare ?? '') });
        cur.children.push(el);
        at = lt + open[0].length;
        if (RAW.has(el.name)) { const end = s.toLowerCase().indexOf(`</${el.name}`, at), stop = end < 0 ? s.length : end; el.children.push(s.slice(at, stop)); at = stop; continue; }
        if (!VOID.has(el.name) && !open[3]) cur = el;
    }
    return root;
}
/** 소독기를 거친 글 */
export const sanitizedBy = sanitizeTree => html => { const body = parse(html); sanitizeTree(body); return body.innerHTML; };
