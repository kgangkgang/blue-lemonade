// 1.2.x 미트볼 상태창 그림 글자(이모지) → 테마 선 아이콘 글꼴(src/ext-status-icons.woff2 · 표 src/ext-status-icons.json)
//   ① 맞춤 시트의 @font-face 는 하나 — 이름 · 주소 · unicode-range 가 표(+ FE0F · 200D)와 같아요
//   ② 글꼴 파일 = 표의 해시 · 크기 상한 안 · WOFF2 안 cmap 이 표의 그림 글자를 전부 가져요(목록 밖 글자는 원래대로)
//   ③ 글꼴은 그 확장 뿌리(설정 칸 · 창 · 띠 · 옆 서랍 · 변동 칩 · 알림)에만 — 채팅 본문(#chat · .mes_text)에는 안 걸고, 입력칸 · 말풍선 글은 빼요
//   ④ 그 확장이 없는 사람은 0: 늘 붙는 시트 · 시작 묶음 · dist 에 글꼴 이름 · 파일 이름이 없어요
//   ⑤ 저장 · AI 에 보내는 글 · 본문 글은 안 건드려요: 맞춤 모듈이 글자 노드를 고치지 않아요(그림 글자는 글꼴로만 바꿔 그려요)
//   ⑥ 세로 가운데(11-13 사용자 「아이콘으로 바꾼 뒤에 꼭 중앙 정렬 맞는지 확인」): 그림마다 잉크 상자의 가운데가 옆 글자(한글 · 대문자 · 숫자) 잉크 가운데와 같아요 —
//      표의 잰 값(글꼴을 만든 대본이 만든 글꼴 · 테마 글꼴에서 다시 잰 것 · 해시로 묶임)이 ±0.005em 안 · 줄 상자 값(ascent · descent)은 테마 글꼴과 같아 줄 높이를 건드리지 않아요.
//      화면 화소 측정은 허브 rig/static/icon-center.mjs(창 없는 브라우저 · 자리마다 ±0.5px)가 해요. 여기는 리그 없이 도는 정적 계약.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const root = path.resolve(process.argv[2] || '.');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };
const META = JSON.parse(read('src/ext-status-icons.json'));
const sheet = read('src/ext-status.css').replace(/\/\*[\s\S]*?\*\//g, '');
const faces = sheet.match(/@font-face\s*\{[^}]*\}/g) || [];
const want = new Set([...Object.keys(META.map), ...META.zeroWidth].map(h => parseInt(h, 16)));

check('① @font-face 하나 · 이름 · 주소 · unicode-range = 표', () => {
    assert.equal(faces.length, 1);
    const f = faces[0];
    assert.match(f, /font-family:\s*'bl-mb-icons'/);
    assert.match(f, /src:\s*url\('\.\/ext-status-icons\.woff2'\)\s*format\('woff2'\)/);
    assert.match(f, /font-display:\s*block/);
    const range = new Set((f.match(/unicode-range:\s*([^;]+);/)?.[1] || '').split(',').map(s => parseInt(s.trim().replace(/^U\+/i, ''), 16)));
    assert.deepEqual([...range].sort((a, b) => a - b), [...want].sort((a, b) => a - b));
    assert.equal(META.family, 'bl-mb-icons');
    for (const [hex, name] of Object.entries(META.map)) assert.ok(/^[a-z0-9]+$/.test(name), `${hex} 아이콘 이름`);
});

// WOFF2 → cmap(형식 12) 코드 포인트(표 디렉터리 · brotli 한 덩이 — glyf/loca 만 변환되고 cmap 은 그대로예요)
function woff2Cmap(buf) {
    assert.equal(buf.toString('latin1', 0, 4), 'wOF2');
    const numTables = buf.readUInt16BE(12), compLen = buf.readUInt32BE(20);
    const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
    let off = 48; const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const b = buf[off++]; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) return v; } throw Error('base128'); };
    const tables = [];
    for (let i = 0; i < numTables; i++) {
        const flags = buf[off++]; let tag = KNOWN[flags & 0x3f];
        if ((flags & 0x3f) === 63) { tag = buf.toString('latin1', off, off + 4); off += 4; }
        const ver = (flags >> 6) & 3, orig = base128();
        const transformed = (tag === 'glyf' || tag === 'loca') ? ver === 0 : ver !== 0;
        tables.push({ tag, len: transformed ? base128() : orig });
    }
    const data = zlib.brotliDecompressSync(buf.subarray(off, off + compLen));
    let at = 0; let cmap = null;
    for (const t of tables) { if (t.tag === 'cmap') cmap = data.subarray(at, at + t.len); at += t.len; }
    assert.ok(cmap, 'cmap 없음');
    const n = cmap.readUInt16BE(2); const cps = new Set(); const uvs = new Map();
    for (let i = 0; i < n; i++) {
        const o = cmap.readUInt32BE(4 + i * 8 + 4);
        if (cmap.readUInt16BE(o) === 14) {   // 변형 선택자 표: 선택자마다 기본 변형 범위(시작 3바이트 + 더 이어지는 수 1바이트)
            const recs = cmap.readUInt32BE(o + 6);
            for (let r = 0; r < recs; r++) { const q = o + 10 + r * 11; const sel = cmap.readUIntBE(q, 3), def = cmap.readUInt32BE(q + 3); const set = uvs.get(sel) || new Set(); uvs.set(sel, set); if (!def) continue; const ranges = cmap.readUInt32BE(o + def); for (let k = 0; k < ranges; k++) { const start = cmap.readUIntBE(o + def + 4 + k * 4, 3), more = cmap[o + def + 4 + k * 4 + 3]; for (let c = start; c <= start + more; c++) set.add(c); } }
            continue;
        }
        if (cmap.readUInt16BE(o) !== 12) continue;
        const groups = cmap.readUInt32BE(o + 12);
        for (let g = 0; g < groups; g++) { const s = cmap.readUInt32BE(o + 16 + g * 12), e = cmap.readUInt32BE(o + 20 + g * 12); for (let c = s; c <= e; c++) cps.add(c); }
    }
    cps.uvs = uvs;
    return cps;
}
check('② 글꼴 파일 = 표의 해시 · 40KB 안 · cmap 이 그림 글자를 전부 가져요', () => {
    const buf = fs.readFileSync(path.join(root, 'src', META.font));
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), META.sha256, '표를 만든 글꼴과 다른 파일이에요(허브 build-icons.py 로 다시 만들어요)');
    assert.equal(buf.length, META.bytes);
    assert.ok(buf.length <= 40000, `${buf.length}B — 그 확장이 있는 사람만 받지만 가볍게`);
    // 저장소는 src/** 를 글(줄바꿈 LF)로 다뤄요 — 글꼴에 이진 표시가 없으면 커밋할 때 안의 CR LF 가 LF 로 바뀌어 글꼴이 깨져요(11-13 다시 만든 글꼴에서 1바이트)
    assert.match(read('.gitattributes'), /^\/src\/\*\.woff2 binary$/m, '.gitattributes 에 /src/*.woff2 binary');
    const cps = woff2Cmap(buf);
    for (const c of want) assert.ok(cps.has(c), `U+${c.toString(16).toUpperCase()} 가 글꼴에 없어요`);
    for (const c of cps) assert.ok(want.has(c), `표에 없는 U+${c.toString(16).toUpperCase()} 가 글꼴에 있어요`);
    // 변형 선택자(U+FE0F): 표의 글자마다 「글자 + FE0F」 기본 변형이 있어야 해요 — 없으면 크롬이 「☀️ ⚠️ ❤️」처럼 FE0F 가 붙은 글자를 기기의 색 그림 글자로 그려요(11-13 리그 사진 「☀️ 맑음」)
    const fe0f = cps.uvs.get(0xFE0F) || new Set();
    for (const hex of Object.keys(META.map)) assert.ok(fe0f.has(parseInt(hex, 16)), `U+${hex} + FE0F 변형이 글꼴에 없어요`);
    assert.equal(META.uvs?.selector, 'FE0F'); assert.equal(META.uvs?.count, Object.keys(META.map).length);
});
check('③ 글꼴은 그 확장 뿌리에만 · 채팅 본문 · 입력칸 · 말풍선 글은 빼요', () => {
    const rules = [...sheet.replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, '$1').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
    const uses = rules.filter(r => /font-family:\s*'bl-mb-icons'/.test(r.body));
    assert.ok(uses.length >= 4, `글꼴을 쓰는 규칙 ${uses.length}`);
    for (const r of uses) {
        assert.ok(!/#chat|\.mes_text|\.mes\b/.test(r.sel), `채팅 본문에 걸면 안 돼요: ${r.sel}`);
        for (const s of r.sel.split(/,\s*(?![^()]*\))/)) assert.match(s.trim(), /^body\.salty(:not\(\[data-bl-ext-raw\]\))? .*(\.ss-|#ss-)/, `그 확장 뿌리 밖: ${s}`);   // :not(…) 은 채팅방 고양이(「원작 그대로 보기」면 원래 아이콘)
        assert.match(r.body, /'bl-mb-icons',\s*var\(--salty-font-ui\)/, '테마 UI 글꼴 앞에만 끼워요(글꼴이 없으면 원래 글꼴)');
    }
    const all = uses.map(r => r.sel).join(',');
    for (const root of ['#ss-settings', '.ss-root', '.ss-hud', '.ss-side', '.ss-msgcard', '.ss-toasts', 'dialog.ss-dlg .popup-content', 'dialog.popup.ss-dlg .popup-controls']) assert.ok(all.includes(root), `뿌리 ${root}`);
    const off = rules.find(r => /:is\(input, textarea\)/.test(r.sel) && /font-family:\s*var\(--salty-font-ui\)/.test(r.body));
    assert.ok(off && /\.ss-bub > span/.test(off.sel), '입력칸 · 말풍선 글은 그림 글자 그대로(사용자 · AI 가 쓴 글)');
    assert.ok(/:where\(:not\(\.ss-letter \*, \.ss-paper \*, \.ss-pdef \*, \.ss-json\)\)/.test(off.sel), '편지지 · 원고지 · JSON 칸의 원래 글꼴은 그대로');
});
check('④ 그 확장이 없는 사람은 0 — 늘 붙는 시트 · 시작 묶음 · dist 에 없어요', () => {
    for (const f of ['style.css', 'src/style-lazy.gen.css', 'style-ext.css', 'index.js']) { const t = read(f); assert.ok(!t.includes('bl-mb-icons') && !t.includes('ext-status-icons'), f); }
    const dist = path.join(root, 'dist');
    if (fs.existsSync(dist)) for (const f of fs.readdirSync(dist)) if (f.endsWith('.js')) assert.ok(!fs.readFileSync(path.join(dist, f), 'utf8').includes('ext-status-icons'), `dist/${f}`);
    assert.ok(!fs.readdirSync(path.join(root, 'css')).some(n => /icons?\.woff2/.test(n)));
});
check('⑤ 저장 · 프롬프트 · 본문 글은 안 건드려요 — 맞춤 모듈이 글자 노드를 고치지 않아요', () => {
    const mod = read('src/ext-compat.js').replace(/\/\/[^\n]*/g, '');
    assert.ok(!/createTreeWalker|NodeFilter|splitText|\.nodeValue\s*=|\.normalize\(|replaceChildren|textContent\s*=\s*[^;]*\.(replace|split)/.test(mod), '글자 노드를 바꾸는 코드가 생겼어요');
    assert.ok(!/1F[0-9A-F]{3}|\\u\{1F(?!63C)/i.test(mod.replace(/icon: \['\\u\{1F63C\}', 'cat'\]/, '')), '그림 글자 바꾸기는 글꼴로만(모듈에 그림 글자 표를 두지 않아요)');
});
check('⑥ 세로 가운데: 그림 잉크 가운데 = 옆 글자 잉크 가운데(±0.005em) · 줄 상자 값은 테마 글꼴과 같아요', () => {
    const m = META.metrics, ref = META.ref;
    assert.ok(m && ref, '글꼴 표에 잰 값이 없어요(허브 build-icons.py 로 다시 만들어요)');
    const em = v => v / m.upm;
    for (const k of ['hangul', 'caps', 'digits']) assert.ok(Math.abs(em(m.inkCenterY) - ref[k] / ref.upm) <= 0.005, `${k}: 아이콘 ${em(m.inkCenterY)}em ↔ 글자 ${ref[k] / ref.upm}em`);
    assert.ok(em(m.inkCenterDev) <= 0.001, `그림마다 어긋남 ${m.inkCenterDev} 단위 — 잉크 상자를 가운데에 맞춰 그려요`);
    assert.equal(em(m.ascent), ref.ascent / ref.upm, '줄 상자 위쪽 = 테마 글꼴');
    assert.equal(em(m.descent), ref.descent / ref.upm, '줄 상자 아래쪽 = 테마 글꼴');
    // 혼자 놓인 아이콘(알림 아이콘 칸)은 줄 상자 가운데에 놓여요 — 줄 상자 가운데와 잉크 가운데가 같아야 칸 가운데에 와요
    assert.ok(Math.abs(em((m.ascent + m.descent) / 2) - em(m.inkCenterY)) <= 0.005, '줄 상자 가운데 ↔ 잉크 가운데');
    assert.ok(em(m.inkHeightMax) <= 1.08 && em(m.box) >= 1.1 && em(m.box) <= 1.2, '그림 크기: 테마 선 아이콘 칸(1.2em)과 비슷하게');
    // 테마가 적어 둔 그 글꼴의 줄 상자 비율(src/apply.js FONT_METRICS)과도 맞아요
    const fm = /freesentation:\s*\['(\.\d+)',\s*'(\.\d+)'/.exec(read('src/apply.js'));
    assert.ok(fm && Math.abs(Number(fm[1]) - em(m.ascent)) <= 0.005 && Math.abs(Number(fm[2]) + em(m.descent)) <= 0.005, 'src/apply.js 의 줄 상자 비율');
    // 테마 글꼴에 없어 기기 글꼴 · 색 그림 글자로 떨어지던 글자 기호도 이 글꼴이 그려요
    for (const hex of ['2665', '2661', '2605', '266A', '2714', '2715', '267B', '21A9']) assert.ok(META.map[hex], `U+${hex}`);
});
console.log(`ext-status-icons: ${passed}개 통과`);
