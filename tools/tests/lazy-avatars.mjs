// 아바타 썸네일 지연 로딩 (src/lazy-avatars.js) — 가짜 DOM 흉내.
// 템플릿 <img> 에 lazy · async 를 붙이고, 목록 뿌리에만 childList 감시자를 걸고, 새로 들어온 lazy 그림만 자리표시로 바꿔 가까워질 때 되돌린다.
// 이미 있던 그림 · 그룹 아바타(lazy 표시 없음) · 캐시에서 받은 그림은 건드리지 않고, 끄면 모두 되돌린다.
//   node tools/tests/lazy-avatars.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

// ---- 작은 DOM 흉내: 태그 · id · class · 속성 · 자식, 선택자는 「#id .class tag[attr]」 꼴의 후손 조합과 쉼표만
function el(tag, { id = '', cls = '', attrs = {} } = {}, children = []) {
    const node = {
        nodeType: 1, tag, id, classes: cls.split(' ').filter(Boolean), attrs: { ...attrs }, dataset: {}, children, parent: null,
        get classList() { return { contains: c => node.classes.includes(c) }; },
        getAttribute(k) { return k in node.attrs ? node.attrs[k] : null; },
        setAttribute(k, v) { node.attrs[k] = String(v); },
        removeAttribute(k) { delete node.attrs[k]; },
        matches(sel) { return sel.split(',').some(s => matchCompound(node, s.trim())); },
        querySelectorAll(sel) { return query(node, sel); },
        querySelector(sel) { return query(node, sel)[0] || null; },
        append(...nodes) { for (const c of nodes) { c.parent = node; node.children.push(c); } },
    };
    for (const c of children) c.parent = node;
    return node;
}
function matchCompound(node, compound) {
    for (const part of compound.match(/#[\w-]+|\.[\w-]+|\[[\w-]+\]|^[a-z]+/g) || []) {
        if (part[0] === '#') { if (node.id !== part.slice(1)) return false; }
        else if (part[0] === '.') { if (!node.classes.includes(part.slice(1))) return false; }
        else if (part[0] === '[') { const a = part.slice(1, -1); if (!(a in node.attrs) && !(a.startsWith('data-') && dataKey(a) in node.dataset)) return false; }
        else if (node.tag !== part) return false;
    }
    return true;
}
const dataKey = a => a.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase());
function descendants(node, out = []) { for (const c of node.children) { out.push(c); descendants(c, out); } return out; }
function query(scope, selector) {
    const out = [];
    for (const sel of selector.split(',')) {
        const parts = sel.trim().split(/\s+/);
        for (const cand of descendants(scope)) {
            if (!matchCompound(cand, parts.at(-1))) continue;
            let ok = true, anc = cand.parent;
            for (let i = parts.length - 2; i >= 0 && ok; i--) { while (anc && anc !== scope && !matchCompound(anc, parts[i])) anc = anc.parent; if (!anc || anc === scope) ok = false; else anc = anc.parent; }
            if (ok && !out.includes(cand)) out.push(cand);
        }
    }
    return out;
}
const img = (src, extra = {}) => el('img', { attrs: { src, ...extra } });
const avatarBlock = (cls, image) => el('div', { cls }, [el('div', { cls: 'avatar' }, [image])]);

const tplImg = img(''), personaTplImg = img('', { alt: 'User Avatar' });
const charList = el('div', { id: 'rm_print_characters_block' }), personaList = el('div', { id: 'user_avatar_block' }), chat = el('div', { id: 'chat' });
const body = el('body', {}, [
    el('div', { id: 'character_template', cls: 'template_element' }, [avatarBlock('character_select', tplImg)]),
    el('div', { id: 'user_avatar_template', cls: 'template_element' }, [el('div', { cls: 'avatar-container' }, [el('div', { cls: 'avatar' }, [personaTplImg])])]),
    charList, personaList, chat,
]);
globalThis.document = { body, getElementById: id => query(body, '#' + id)[0] || (body.id === id ? body : null), querySelectorAll: sel => query(body, sel) };

const observers = [], mutation = [];
class FakeIO { constructor(cb, opts) { this.cb = cb; this.opts = opts; this.targets = new Set(); observers.push(this); } observe(t) { this.targets.add(t); } unobserve(t) { this.targets.delete(t); } disconnect() { this.targets.clear(); this.dead = true; } fire(t, seen) { this.cb([{ target: t, isIntersecting: seen }]); } }
class FakeMO { constructor(cb) { this.cb = cb; mutation.push(this); } observe(t, o) { this.target = t; this.opts = o; } disconnect() { this.dead = true; } added(...nodes) { this.cb([{ addedNodes: nodes }]); } }
globalThis.IntersectionObserver = FakeIO; globalThis.MutationObserver = FakeMO;

const la = await import(pathToFileURL(path.join(root, 'src/lazy-avatars.js')));
const existing = img('/thumbnail?type=avatar&file=old.png');
charList.append(avatarBlock('character_select', existing));

la.syncLazyAvatars(true);
t('켜면: 템플릿 <img> 에 loading=lazy · decoding=async, 목록 뿌리 둘과 #chat 에 childList 감시자(subtree 없음), 관찰자 하나', () => {
    assert.equal(tplImg.attrs.loading, 'lazy'); assert.equal(tplImg.attrs.decoding, 'async'); assert.equal(personaTplImg.attrs.loading, 'lazy');
    assert.deepEqual(la._forTest.state(), { on: true, io: true, roots: 2, chat: true, pending: 0 });
    assert.deepEqual(mutation.map(m => m.target.id).sort(), ['chat', 'rm_print_characters_block', 'user_avatar_block']);
    for (const m of mutation) assert.deepEqual(m.opts, { childList: true });
    assert.deepEqual(observers.at(-1).opts, { rootMargin: la.ROOT_MARGIN, threshold: 0 });
});
t('이미 목록에 있던 그림은 건드리지 않는다 (깜빡임 금지)', () => { assert.equal(existing.attrs.src, '/thumbnail?type=avatar&file=old.png'); assert.equal(existing.dataset.blSrc, undefined); });

const charMO = mutation.find(m => m.target === charList), io = observers.at(-1);
const fresh = img('/thumbnail?type=avatar&file=a.png', { loading: 'lazy', decoding: 'async' });   // 템플릿에서 복제된 그림처럼
const groupImg = img('/thumbnail?type=avatar&file=g.png');                                           // 그룹 아바타: 템플릿 밖에서 만들어져 lazy 표시가 없다
const cached = Object.assign(img('/thumbnail?type=avatar&file=c.png', { loading: 'lazy' }), { complete: true, naturalWidth: 50 });
const dataImg = img('data:image/png;base64,AAAA', { loading: 'lazy' });
t('새로 들어온 lazy 그림만 자리표시로 바꾸고 관찰한다 · 그룹 · 캐시 · data: 그림은 decoding 만', () => {
    charMO.added(avatarBlock('character_select', fresh), avatarBlock('group_select', groupImg), avatarBlock('character_select', cached), avatarBlock('character_select', dataImg), { nodeType: 3 });
    assert.equal(fresh.attrs.src, la.PLACEHOLDER); assert.equal(fresh.dataset.blSrc, '/thumbnail?type=avatar&file=a.png'); assert.ok(io.targets.has(fresh));
    assert.equal(groupImg.attrs.src, '/thumbnail?type=avatar&file=g.png'); assert.equal(groupImg.attrs.decoding, 'async'); assert.ok(!io.targets.has(groupImg));
    assert.equal(cached.attrs.src, '/thumbnail?type=avatar&file=c.png'); assert.ok(!io.targets.has(cached));
    assert.equal(dataImg.attrs.src, 'data:image/png;base64,AAAA');
});
t('같은 블록이 다시 들어와도 두 번 처리하지 않는다', () => { const before = fresh.dataset.blSrc; charMO.added(avatarBlock('character_select', fresh)); assert.equal(fresh.dataset.blSrc, before); assert.equal(io.targets.size, 1); });
t('안 보이는 알림은 무시 · 가까워지면 원래 주소로 돌리고 관찰을 뗀다', () => {
    io.fire(fresh, false); assert.equal(fresh.attrs.src, la.PLACEHOLDER);
    io.fire(fresh, true); assert.equal(fresh.attrs.src, '/thumbnail?type=avatar&file=a.png'); assert.equal(fresh.dataset.blSrc, undefined); assert.ok(!io.targets.has(fresh));
});
t('다른 모듈(multi-avatar)이 자리표시를 다른 그림으로 바꿔 두면 가까워져도 덮어쓰지 않는다', () => {
    const other = img('/thumbnail?type=avatar&file=b.png', { loading: 'lazy' });
    charMO.added(avatarBlock('character_select', other)); assert.equal(other.attrs.src, la.PLACEHOLDER);
    other.attrs.src = '/user/images/bl-avatar/x.webp';
    io.fire(other, true); assert.equal(other.attrs.src, '/user/images/bl-avatar/x.webp'); assert.equal(other.dataset.blSrc, undefined);
});
t('페르소나 목록도 같은 처리', () => {
    const p = img('/User Avatars/me.png', { loading: 'lazy' });
    mutation.find(m => m.target === personaList).added(el('div', { cls: 'avatar-container' }, [el('div', { cls: 'avatar' }, [p])]));
    assert.equal(p.attrs.src, la.PLACEHOLDER); io.fire(p, true); assert.equal(p.attrs.src, '/User Avatars/me.png');
});
t('최근 채팅(웰컴 패널)의 그림엔 decoding=async 만 · 메시지는 지나치고 · 답장 중엔 아무것도 안 한다', () => {
    const chatMO = mutation.find(m => m.target === chat);
    const r = img('/thumbnail?type=avatar&file=r.png');
    const panel = el('div', { cls: 'welcomePanel' }, [el('div', { cls: 'recentChatList' }, [el('div', { cls: 'recentChat' }, [el('div', { cls: 'avatar' }, [r])])])]);
    const mes = el('div', { cls: 'mes' }, [el('div', { cls: 'avatar' }, [img('/thumbnail?type=avatar&file=m.png')])]);
    chatMO.added(mes); assert.equal(mes.children[0].children[0].attrs.decoding, undefined);
    body.dataset.generating = 'true'; chatMO.added(panel); assert.equal(r.attrs.decoding, undefined);
    delete body.dataset.generating; chatMO.added(panel); assert.equal(r.attrs.decoding, 'async'); assert.equal(r.attrs.src, '/thumbnail?type=avatar&file=r.png');
});
t('끄면: 남은 자리표시를 모두 되돌리고 감시자 · 관찰자를 떼고 템플릿 속성을 뗀다', () => {
    const pending = img('/thumbnail?type=avatar&file=p.png', { loading: 'lazy' });
    charMO.added(avatarBlock('character_select', pending)); assert.equal(pending.attrs.src, la.PLACEHOLDER);
    la.syncLazyAvatars(false);
    assert.equal(pending.attrs.src, '/thumbnail?type=avatar&file=p.png');
    assert.ok(mutation.every(m => m.dead)); assert.ok(io.dead);
    assert.equal(tplImg.attrs.loading, undefined); assert.equal(personaTplImg.attrs.decoding, undefined);
    assert.deepEqual(la._forTest.state(), { on: false, io: false, roots: 0, chat: false, pending: 0 });
});
t('다시 켜면 새 감시자 · 관찰자로 (한 번만)', () => {
    la.syncLazyAvatars(true); la.syncLazyAvatars(true);
    assert.deepEqual(la._forTest.state(), { on: true, io: true, roots: 2, chat: true, pending: 0 }); assert.equal(mutation.filter(m => !m.dead).length, 3);
});
t('관찰자가 없는 브라우저: 템플릿 lazy 만 살리고 자리표시로는 바꾸지 않는다', () => {
    la.syncLazyAvatars(false); const saved = globalThis.IntersectionObserver; delete globalThis.IntersectionObserver;
    la.syncLazyAvatars(true);
    const x = img('/thumbnail?type=avatar&file=x.png', { loading: 'lazy' });
    mutation.filter(m => !m.dead).find(m => m.target === charList).added(avatarBlock('character_select', x));
    assert.equal(x.attrs.src, '/thumbnail?type=avatar&file=x.png'); assert.equal(x.attrs.decoding, 'async'); assert.equal(tplImg.attrs.loading, 'lazy');
    la.syncLazyAvatars(false); globalThis.IntersectionObserver = saved;
});

// ---- 연결: 설정 기본값 · 보정 · 패널 줄 · features · 라벨 · multi-avatar 가 data-bl-src 를 읽는지
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
t('설정 chat.lazyAvatars 기본 켬 · 옛 설정 보정 · 모습 초기화에서 남김 · 스타일 공유에서 빼는 동작 값', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /showMoreAuto: true, lazyAvatars: true,/); assert.match(settings, /s\.chat\.lazyAvatars = flag\(s\.chat\.lazyAvatars, true\)/);
    assert.match(settings, /'mesPins', 'lazyAvatars'[^\]]*\]\) \{/); assert.match(read('src/styles.js'), /'mesPins', 'lazyAvatars'[^\]]*\];/);
});
t('features 가 켬/끔을 넘기고 · 패널 「가볍게」 묶음에 줄 · 라벨 사전 · multi-avatar 가 원래 주소를 data-bl-src 에서도 읽는다', () => {
    assert.match(read('src/features.js'), /load\('lazyavatars', '\.\/lazy-avatars\.js'\)\.then\(m => m\?\.syncLazyAvatars\(lazyAvatars\)\)/);
    const panel = read('src/panel.js');
    assert.ok(panel.includes("cap('가볍게'")); assert.ok(panel.includes("toggle('chat.lazyAvatars', s.chat.lazyAvatars !== false)"));
    assert.ok(read('src/settings-labels.js').includes('"chat.lazyAvatars":"아바타는 가까워질 때 받기"'));
    const multi = read('src/multi-avatar/index.js');
    assert.match(multi, /const srcOf = img => img\.dataset\.blSrc \|\| img\.getAttribute\('src'\)/); assert.ok(!/avatarFromSrc\(img\.getAttribute\('src'\)/.test(multi));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/lazy-avatars\.mjs \./);
});

console.log(`PASS lazy-avatars: ${n} checks`);
