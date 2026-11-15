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
// 1.5.1 갈래 기본 아이콘: 표에 없는 그림 글자도 글꼴이 덮어요(이어진 구간 [시작, 끝])
const FB = (META.fallback?.ranges || []).map(([a, b]) => [parseInt(a, 16), parseInt(b, 16)]);
for (const [a, b] of FB) for (let c = a; c <= b; c++) want.add(c);

check('① @font-face 하나 · 이름 · 주소 · unicode-range = 표', () => {
    assert.equal(faces.length, 1);
    const f = faces[0];
    assert.match(f, /font-family:\s*'bl-mb-icons'/);
    assert.match(f, /src:\s*url\('\.\/ext-status-icons\.woff2'\)\s*format\('woff2'\)/);
    assert.match(f, /font-display:\s*block/);
    const range = new Set((f.match(/unicode-range:\s*([^;]+);/)?.[1] || '').split(',').flatMap(s => { const [a, b = a] = s.trim().replace(/^U\+/i, '').split('-').map(h => parseInt(h, 16)); const out = []; for (let c = a; c <= b; c++) out.push(c); return out; }));
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
    assert.equal(META.uvs?.selector, 'FE0F'); assert.ok(META.uvs?.count >= Object.keys(META.map).length);
});
check('③ 글꼴은 그 확장 뿌리에만 · 채팅 본문 · 입력칸 · 말풍선 글은 빼요', () => {
    const rules = [...sheet.replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, '$1').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
    const uses = rules.filter(r => /font-family:\s*'bl-mb-icons'/.test(r.body));
    assert.ok(uses.length >= 4, `글꼴을 쓰는 규칙 ${uses.length}`);
    for (const r of uses) {
        assert.ok(!/#chat|\.mes_text|\.mes\b/.test(r.sel), `채팅 본문에 걸면 안 돼요: ${r.sel}`);
        for (const s of r.sel.split(/,\s*(?![^()]*\))/)) assert.match(s.trim(), /^body\.salty(:not\(\[data-bl-ext-raw\]\))? .*(\.ss-|#ss-|dialog\.bl-ext-avadlg )/, `그 확장 뿌리 밖: ${s}`);   // :not(…) 은 채팅방 고양이(「원작 그대로 보기」면 원래 아이콘) · dialog.bl-ext-avadlg 는 맞춤 모듈이 표식을 단 그 확장의 「얼굴 바꾸기」 창(실리태번 팝업이라 .ss- 이름이 없어요)
        assert.match(r.body, /'bl-mb-icons',\s*var\(--salty-font-(ui|mb, var\(--salty-font-ui\))\)/, '테마 UI 글꼴(1.5.1: 미트볼 글꼴을 골랐으면 그 글꼴 · 아니면 UI 글꼴) 앞에만 끼워요(글꼴이 없으면 원래 글꼴)');
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
    // 1.5.4: 문자열의 유니코드 정규화(normalize('NFKC') — 이름 견주기)는 DOM 노드 normalize() 와 달라 빼요
    assert.ok(!/createTreeWalker|NodeFilter|splitText|\.nodeValue\s*=|\.normalize\((?!\s*['\"]NFK?[CD]['\"])|replaceChildren|textContent\s*=\s*[^;]*\.(replace|split)/.test(mod), '글자 노드를 바꾸는 코드가 생겼어요');
    // 얼굴 고르개의 고를 그림 표(AVA_PICKS — 사람이 고르는 목록이지 글자를 바꾸는 표가 아니에요)만 빼고 봐요. 그 표의 그림은 전부 선 아이콘 글꼴에 있어야 해요(없으면 고른 얼굴이 색 그림 글자로 떠요)
    const picks = /export const AVA_PICKS = \[[\s\S]*?\n\];/.exec(mod)?.[0] || '';
    assert.ok(picks, '얼굴 고르개 표');
    const list = [...picks.matchAll(/\[0x([0-9A-F]+), '([^']+)'\]/g)].map(m => [m[1], m[2]]);
    assert.ok(list.length >= 16 && list.length % 8 === 0, `고를 그림 ${list.length}개 — 8열 격자를 꽉 채워요`);
    for (const [hex, name] of list) assert.ok(META.map[hex], `얼굴 고르개의 ${name}(U+${hex})가 선 아이콘 글꼴 표에 없어요`);
    assert.equal(new Set(list.map(x => x[0])).size, list.length, '같은 그림이 두 번 없어요');
    for (const hex of ['1F431', '1F436', '1F98A', '1F43B', '1F430', '1F43C', '1F438', '1F427', '1F981', '1F42F', '1F428', '1F439', '1F989', '1F43A', '1F99D', '1F42E']) assert.ok(META.map[hex] && list.some(x => x[0] === hex), `이름으로 정해지는 동물 얼굴 U+${hex}`);
    assert.ok(!/1F[0-9A-F]{3}|\\u\{1F(?!63C)/i.test(mod.replace(picks, '').replace(/icon: \['\\u\{1F63C\}', 'cat'\]/, '')), '그림 글자 바꾸기는 글꼴로만(모듈에 그림 글자를 바꾸는 표를 두지 않아요)');
    // 얼굴 바꾸기 창: 고른 그림은 그 확장의 입력칸에 적기만 하고(저장은 그 확장), 창에 글자로 찍힌 「[object …]」 한 덩이만 비워요
    assert.ok(mod.includes("input.value = pick.dataset.blAva || '';") && mod.includes("if (junk) { junk.before(hint, grid); junk.data = ''; } else box.append(hint, grid);"));
    assert.ok(mod.includes("if (ava && !doc.body.hasAttribute('data-bl-ext-raw'))"), '「원작 그대로 보기」면 고르개를 놓지 않아요');
});
check('⑤-2 남은 그림 글자 0 — 미트볼 상태창 2.7.21 화면 문자열에서 모은 그림 글자(210종)가 전부 선 아이콘 글꼴 표 · 시트의 unicode-range 에 있어요', () => {
    // 2.7.21 원작 사본의 화면 문자열(index.js · style.css · src/*.js)을 \\p{Extended_Pictographic} 로 훑어 모은 코드 포인트(11-15 검수 · 숫자만 적어요 — 원작 글 · 코드는 싣지 않아요).
    // 새 판에서 그림 글자가 늘면 허브 점검 대본(리그 사진 대본의 「남은 그림 글자」 세기)이 먼저 잡고, 이 표와 글꼴 표에 같이 더해요.
    const SEEN = '2194 2197 21A9 231B 23EA 23F3 23F8 25B6 2600 2601 2615 2620 2665 267B 2692 2693 2694 2696 2699 26A0 26A1 26C5 26C8 26D3 26EA 26F0 26F2 26F5 2702 2705 2709 270D 270F 2714 2728 2744 274C 2753 2754 2764 2B50 1F0CF 1F193 1F300 1F309 1F30A 1F310 1F319 1F31F 1F327 1F328 1F32B 1F331 1F332 1F333 1F338 1F33C 1F33E 1F340 1F342 1F353 1F356 1F377 1F37A 1F37D 1F380 1F381 1F382 1F389 1F392 1F3A9 1F3AC 1F3AD 1F3B2 1F3C6 1F3CE 1F3D6 1F3D8 1F3D9 1F3E0 1F3E2 1F3E5 1F3E6 1F3EA 1F3EB 1F3F0 1F3F7 1F40E 1F415 1F419 1F41E 1F426 1F427 1F428 1F42E 1F42F 1F430 1F431 1F432 1F436 1F438 1F439 1F43A 1F43B 1F43C 1F43E 1F441 1F449 1F44D 1F451 1F464 1F465 1F489 1F48C 1F48D 1F494 1F495 1F496 1F497 1F49E 1F4A1 1F4A2 1F4A4 1F4A5 1F4A8 1F4AC 1F4AD 1F4B0 1F4B1 1F4B8 1F4BE 1F4C5 1F4CA 1F4CB 1F4CC 1F4CD 1F4D6 1F4DA 1F4DC 1F4DD 1F4E3 1F4E6 1F4EC 1F4F0 1F4F1 1F4F7 1F500 1F501 1F504 1F507 1F50D 1F50E 1F512 1F513 1F514 1F524 1F525 1F527 1F52C 1F52E 1F534 1F54A 1F550 1F573 1F5B1 1F5BC 1F5D1 1F5E1 1F5E8 1F5FA 1F5FC 1F602 1F605 1F622 1F62D 1F62E 1F63C 1F63F 1F648 1F689 1F693 1F6A6 1F6AA 1F6AB 1F6B2 1F6B6 1F6CF 1F6D2 1F6DF 1F6E0 1F6E1 1F6E3 1F6F0 1F916 1F91D 1F976 1F981 1F988 1F989 1F98A 1F98B 1F99D 1F9E9 1F9ED 1F9F0 1F9F1 1F9F9 1FA91 1FAB4 1FAB6'.split(' ');
    const missing = SEEN.filter(hex => !META.map[hex]);
    assert.deepEqual(missing, [], `글꼴 표에 없는 그림 글자 ${missing.length}개(0 이어야 해요): ${missing.join(' ')}`);
    const range = new Set((/unicode-range:\s*([^;]+);/.exec(sheet)?.[1] || '').split(',').map(x => x.trim().replace(/^U\+/, '')));
    const out = SEEN.filter(hex => !range.has(hex));
    assert.deepEqual(out, [], `시트의 unicode-range 밖 ${out.length}개: ${out.join(' ')}`);
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
check('⑦ 1.5.1 표에 없는 그림 글자도 새지 않아요 — 색 그림이 기본인 글자 · U+1F000 위 그림 글자는 전부 이 글꼴에 있어요(값이 자유인 자리: 지도 마디 · 장소 · 아이템 …)', () => {
    // 11-15 사용자 「세계에 아직도 이모티콘이 보인다」: 1.5.0 은 그 확장 화면 문자열에서 모은 210종만 표에 넣어, AI · 사용자가 고르는 장소 그림(집 · 펜 · 노트북 · 도시락 · 사진기 · 성 · 밤 도시)이 기기의 색 그림으로 샜어요
    const cps = woff2Cmap(fs.readFileSync(path.join(root, 'src', META.font)));
    const miss = [];
    for (let cp = 0x2300; cp <= 0x1FAFF; cp++) {
        const ch = String.fromCodePoint(cp);
        if (/\p{Emoji_Presentation}/u.test(ch) || (cp >= 0x1F000 && /\p{Extended_Pictographic}/u.test(ch) && /\p{Emoji}/u.test(ch))) if (!cps.has(cp)) miss.push(cp.toString(16).toUpperCase());
    }
    assert.deepEqual(miss, [], '글꼴에 없는 그림 글자');
    for (const hex of ['1F3E1', '1F58A', '1F4BB', '1F371', '1F4F8', '1F3EF', '1F303']) assert.ok(META.map[hex], `사용자 사진의 그림 U+${hex} 는 표에(갈래 기본 아이콘이 아니라 제 그림)`);
    assert.ok(META.fallback?.count > 1000 && META.fallback.by?.mappin && META.fallback.by?.dot, '갈래 기본 아이콘 표');
    // 「글자 + FE0F」도 이 글꼴로: 표의 글자는 전부, 갈래 기본 글자는 구간을 끊느라 건너뛴 몇 자 말고 전부
    const fe0f = cps.uvs.get(0xFE0F) || new Set(); let skipped = 0;
    for (const [a, b] of FB) for (let c = a; c <= b; c++) if (!fe0f.has(c)) skipped++;
    assert.ok(skipped <= 12, `FE0F 변형이 없는 갈래 기본 글자 ${skipped}`);
});
console.log(`ext-status-icons: ${passed}개 통과`);
