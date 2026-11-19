// 1.5.0 「이모티콘 절대 금지 · 다 아이콘으로」 — 테마 소스(src · css · index.js)에 화면용 그림 글자가 없는지 지켜요.
//   node tools/tests/no-screen-emoji.mjs [저장소 뿌리]
//   보는 것: 주석을 뺀 코드(문자열 · CSS 값 · JSON · HTML 본문). 막는 글자 =
//     ① 색 그림이 기본인 글자(Emoji_Presentation) ② 변형 선택자(U+FE0F)가 붙은 글자 ③ 폰에서 색 그림으로 바뀌곤 하는 기호(⚠ ⚙ ☀ ❤ ♥ ✔ ✏ ▶ …)
//   두는 것(ALLOW): 화면에 그리려고 쓴 글자가 아닌 곳 — 프리셋 원작 이름 대조표 · 본문에서 찾아내는 정규식 · 실리태번 본체 기호 설명 · 게시된 공지 기록.
//     새로 두려면 까닭을 적어 ALLOW 에 넣어요. 화면에 그릴 것은 선 아이콘(Font Awesome · 테마 svg · src/emoji-icon.js)으로 써요.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const TEXTY = '⚠⚙☀☁❄❤♥♡✔✖✏✍⌨▶◀⏹⏮⏭⏯☑✂✉☎⚔⚖♻↩↪➡⬅⬆⬇';
const BAD = new RegExp(`\\p{Emoji_Presentation}|[\\u{1F1E6}-\\u{1F1FF}]|.\\uFE0F|[${TEXTY}]`, 'gu');

// [경로 정규식, 둘 글자(없으면 전부), 까닭]
const ALLOW = [
    [/^src\/(vendor|addons\/[^/]+\/vendor)\//, null, '남의 묶음(vendor)'],
    [/^src\/ext-status/, null, '미트볼 상태창 맞춤 — 그림 글자를 선 아이콘으로 바꾸는 표(tools/tests/ext-status-icons.mjs 가 지켜요)'],
    [/^src\/emoji-icon\.js$/, null, '그림 글자 → 아이콘 표(찾는 열쇠)'],
    [/^src\/scripts\/(plain|titles)\//, null, '프리셋 · 확장 원작 이름 대조표(원작 이름 그대로 맞대요 · 원작 화면은 원작대로)'],
    [/^src\/scripts\/fruit-(entry|option-effects|option-help)\.js$/, null, '프리셋 원작 항목 이름을 가리키는 글'],
    [/^src\/fruit-type-(schema|sample)\.js$/, null, '프리셋 원작 항목 이름 · 원작 출력 표본'],
    [/^src\/fruit-family\.js$/, null, '프리셋 원작 항목 이름'],
    [/^src\/(prompt-choice-core|prompt-folders-core|prompt-folders|preview-details|role-icons-tidy|weather|weather-meatball|ext-bridge-tr|swipe-picker-translation)\.js$/, null, '본문 · 이름에서 찾아내는 글자(정규식 · 대조)'],
    [/^src\/(mb-place-mark|mb-map-floors)\.js$/, '📍🗺', '그 확장이 그린 장소 글(「📍 @…」 · 「🗺️ 새 장소: @…」)을 찾는 글자 — 버그 사냥 6 장소 이름 앞 기호'],
    [/^src\/addons\/regexlink\/(engine|index|regexperf)\.js$/, '⚠❗😀', '이름에서 걷어 내는 글자 · 시험 입력'],
    [/^src\/addons\/translator\/(index|rp-lines|translation-check)\.js$/, '♡♥⚠❗🔔', '본문에서 찾아내는 글자(문장 끝 · 경고 줄)'],
    [/^src\/addons\/translator\/selection\/delete-core\.js$/, null, 'HTML 개체 표'],
    [/^src\/addons\/tts\/src\/providers\/elevenlabs\.js$/, '♪♡❤', '읽기 전에 걷어 내는 글자'],
    [/^src\/log-copy-(motion|simple\.gen|picks\.gen|basic\.gen|presets|pretty)\.js$/, null, '글꾸 자료(틀의 emoji 칸 · 글꾸 본문 장식) — 고르는 화면에서는 src/emoji-icon.js 가 아이콘으로 그려요'],
    [/^src\/geulkku-mart\//, null, '글꾸 마트 자료'],
    [/^src\/(deus-preview-samples|panel)\.js$/, '🕐🕒🗓📍⛅🗺📊🧶🌀🧭⚡⚔☀🌙', '데우스 프리셋 출력 표본(실제 채팅에 나오는 원작 글자 그대로)'],
    [/^src\/notice-old\.gen\.js$/, null, '1.0.0 앞 판 공지 묶음(글을 얼려 둔 기록 — tools/tests/notice-old-pack.mjs 가 지문으로 지켜요). 최근 구간 src/notice-data.js 는 1.5.1 부터 그림 글자 0'],
    [/^src\/ko-ui-data\.js$/, '🔵🟢🔗❌', '실리태번 원문 열쇠(왼쪽 글자) — 1.5.1 부터 우리말 값과 월드 인포 도움말(src/wi-help-data.js)에는 그림 글자가 없어요'],
    [/^src\/ko-ui-text\.[a-z]+\.gen\.json$/, null, '생성물(작업 갈래에는 커밋하지 않아요) — 원본 tools/scripts-src/korean.js 를 아래에서 봐요'],
    [/^tools\/scripts-src\/korean\.js$/, '🔵🟢🔗❌⚙👤🤖⚠📦🐛💬🗣🪪⏫💻🎨📕📚🔧🔢🔍🌐', '실리태번 원문 열쇠 · 본체 기호 설명 · 태번 헬퍼 변경 기록 제목(원작 글자)'],
    [/^src\/credits\.js$/, '✨♡', '출처 표시의 원작 이름 · 원작자 표기'],
    [/^src\/addons\/translator\/display-cards\.js$/, null, '본문 앞 장식 글자를 찾는 정규식'],
    [/^src\/api-status\.js$/, null, '주석 속 글자(문자열 아님)'],
    [/^src\/mb-prompt\.js$/, '🔗', '미트볼 편집 기록 글 — 그 확장 「합치기」 단추가 남기는 기록(label)과 글자까지 같게 써요(그 확장 관리 탭이 원작대로 그려요)'],
];
const skipDir = /(^|\/)(node_modules|dist|\.git)(\/|$)/;

/** JS 주석 걷기 — 문자열 · 템플릿은 그대로 */
export function stripJs(t) {
    let out = '', i = 0, mode = null; const n = t.length, stack = [];
    while (i < n) {
        const c = t[i], d = t[i + 1];
        if (mode === 'line') { if (c === '\n') { mode = null; out += c; } else out += ' '; i++; continue; }
        if (mode === 'block') { if (c === '*' && d === '/') { mode = null; out += '  '; i += 2; } else { out += c === '\n' ? '\n' : ' '; i++; } continue; }
        if (mode === "'" || mode === '"') { if (c === '\\') { out += c + (d ?? ''); i += 2; continue; } if (c === mode || c === '\n') mode = null; out += c; i++; continue; }
        if (mode === '`') {
            if (c === '\\') { out += c + (d ?? ''); i += 2; continue; }
            if (c === '`') { mode = null; out += c; i++; continue; }
            if (c === '$' && d === '{') { stack.push(0); mode = null; out += '${'; i += 2; continue; }
            out += c; i++; continue;
        }
        if (c === '/' && d === '/' && t[i - 1] !== ':' && t[i - 1] !== '\\') { mode = 'line'; out += '  '; i += 2; continue; }
        if (c === '/' && d === '*') { mode = 'block'; out += '  '; i += 2; continue; }
        if (c === '/') {
            // 정규식 글자: 닫는 / 까지 그대로(글자 묶음 [...] 안의 / 는 닫는 것이 아님) — 안의 따옴표가 문자열로 읽히지 않게
            const before = out.trimEnd();
            if (!before || /[(,=:[!&|?{};+*%<>~^]$/.test(before) || /\b(return|typeof|case|of|in)$/.test(before)) {
                let j = i + 1, cls = false;
                for (; j < n && t[j] !== '\n'; j++) { if (t[j] === '\\') { j++; continue; } if (t[j] === '[') cls = true; else if (t[j] === ']') cls = false; else if (t[j] === '/' && !cls) break; }
                if (t[j] === '/') { out += t.slice(i, j + 1); i = j + 1; continue; }
            }
        }
        if (c === "'" || c === '"' || c === '`') { mode = c; out += c; i++; continue; }
        if (stack.length) {
            if (c === '{') stack[stack.length - 1]++;
            else if (c === '}') { if (stack[stack.length - 1] === 0) { stack.pop(); mode = '`'; out += c; i++; continue; } stack[stack.length - 1]--; }
        }
        out += c; i++;
    }
    return out;
}
const blank = m => m.replace(/[^\n]/g, ' ');
const stripCss = t => t.replace(/\/\*[\s\S]*?\*\//g, blank);
const stripHtml = t => t.replace(/<!--[\s\S]*?-->/g, blank);

function walk(dir, acc) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = dir + '/' + e.name;
        if (skipDir.test(p)) continue;
        if (e.isDirectory()) walk(p, acc);
        else if (/\.(js|mjs|css|json|html)$/.test(e.name)) acc.push(p);
    }
    return acc;
}
export function scan(base = root) {
    const b = base.split(path.sep).join('/');
    const files = [...walk(b + '/src', []), ...walk(b + '/css', []), b + '/index.js', b + '/tools/scripts-src/korean.js'].filter(f => fs.existsSync(f));   // 한글화 표는 생성물 대신 원본을 봐요
    const hits = [];
    for (const file of files) {
        const rel = file.slice(b.length + 1);
        const rules = ALLOW.filter(([re]) => re.test(rel));
        if (rules.some(([, chars]) => chars === null)) continue;
        const ok = new Set(rules.flatMap(([, chars]) => [...chars]));
        let text = fs.readFileSync(file, 'utf8');
        text = /\.(js|mjs)$/.test(file) ? stripJs(text) : /\.css$/.test(file) ? stripCss(text) : /\.html$/.test(file) ? stripHtml(text) : text;
        text.split('\n').forEach((line, i) => {
            const found = (line.match(BAD) || []).map(m => String.fromCodePoint(m.codePointAt(0))).filter(ch => !ok.has(ch));
            if (found.length) hits.push({ file: rel, line: i + 1, chars: [...new Set(found)].join(' ') });
        });
    }
    return hits;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    let failed = 0;
    const test = (name, fn) => { try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').slice(0, 30).join('\n     ')); } };
    test('주석 걷기: 문자열 · 템플릿 속 글자는 남고 주석 속 글자는 빠져요', () => {
        const s = stripJs("const a = '⚙ x'; // \u{1F600} 주석\nconst b = `t ${ /* \u{1F525} */ c } \u{1F34B}`;");
        assert.ok(s.includes('⚙') && s.includes('\u{1F34B}')); assert.ok(!s.includes('\u{1F600}') && !s.includes('\u{1F525}'));
    });
    test('막는 글자: 색 그림 · 변형 선택자 · 폰에서 색으로 바뀌는 기호 / 두는 글자: 화살표 · 저작권 · 도형', () => {
        for (const ch of ['\u{1F4AC}', '⚙️', '⚠', '▶', '❤']) assert.ok(ch.match(BAD), ch);
        for (const ch of ['↔', '↗', '©', '★', '×', '↺', '✕']) assert.equal(ch.match(BAD), null, ch);
    });
    test('테마 소스에 화면용 그림 글자 0', () => {
        const hits = scan();
        assert.equal(hits.length, 0, `화면용 그림 글자 ${hits.length}곳 — 선 아이콘으로 바꾸거나(화면에 그리는 글) 까닭을 적어 ALLOW 에 넣어요(찾는 글자)\n` + hits.slice(0, 40).map(h => `${h.file}:${h.line}  ${h.chars}`).join('\n'));
    });
    test('글꾸 고르는 화면은 틀의 emoji 칸을 아이콘으로 그려요(src/emoji-icon.js)', () => {
        const sheet = fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8');
        assert.ok(!/bl-lc-emoji/.test(sheet), '그림 글자를 그대로 그리는 칸(.bl-lc-emoji)이 없어요');
        assert.ok((sheet.match(/emojiMark\(/g) || []).length >= 3, '칩 세 곳이 emojiMark 로 그려요');
    });
    test('아이콘 표: 이름이 모두 Font Awesome 무료 6.5.2 에 있고, 내장 · 마트 틀의 emoji 가 모두 표에 있어요', async () => {
        const fa = new Set(fs.readFileSync(path.join(root, 'tools/fa-free-6.5.2.txt'), 'utf8').split(/\s+/));
        const src = fs.readFileSync(path.join(root, 'src/emoji-icon.js'), 'utf8');
        const table = src.match(/const TABLE = `([\s\S]*?)`;/)[1];
        const bad = table.split(/\s+/).filter(Boolean).filter(cell => { const ch = String.fromCodePoint(cell.codePointAt(0)); return !fa.has(cell.slice(ch.length)); });
        assert.deepEqual(bad, [], '없는 아이콘 이름');
    });
    const { emojiIcon, emojiMark } = await import('../../src/emoji-icon.js');
    test('emojiIcon: 변형 선택자 · 이어 붙인 그림은 첫 그림으로 · 모르면 fallback · 빈 값도 fallback', () => {
        assert.equal(emojiIcon('\u{1F4AC}'), 'fa-comment'); assert.equal(emojiIcon('\u{1F5FA}️'), 'fa-map'); assert.equal(emojiIcon('\u{1F408}‍⬛'), 'fa-cat');
        assert.equal(emojiIcon('\u{1FAE0}'), 'fa-shapes'); assert.equal(emojiIcon(''), 'fa-shapes'); assert.equal(emojiIcon(undefined, 'fa-feather'), 'fa-feather');
        assert.equal(emojiMark('\u{1F525}'), '<i class="fa-solid fa-fire" aria-hidden="true"></i>');
    });
    test('내장 · 마트 틀의 emoji 가 모두 아이콘 표에 있어요', () => {
        const all = new Set();
        for (const dir of ['src', 'tools/mart', 'tools/tests/fixtures']) {
            if (!fs.existsSync(path.join(root, dir))) continue;
            for (const f of walk(path.join(root, dir).split(path.sep).join('/'), [])) for (const m of fs.readFileSync(f, 'utf8').matchAll(/["']?emoji["']?\s*:\s*["']([^"']{1,12})["']/g)) all.add(m[1]);
        }
        const miss = [...all].filter(e => emojiIcon(e, '') === '');
        assert.deepEqual(miss, [], '표에 없는 틀 그림 글자');
    });
    if (failed) { console.log(`\n실패 ${failed}`); process.exit(1); }
    console.log('\n모두 통과');
}
