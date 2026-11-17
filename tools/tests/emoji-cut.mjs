// 버그 사냥 7 — 보이는 글을 글자 수로 자를 때 이모지 반쪽(깨진 글자 �)이 남던 것
//   ① 답 완료 알림 본문(src/reply-notify.js replyPreview — 120자)
//   ② 퀵 리플라이 찾기 목록의 이름(30자) · 내용 줄(90자 · 검색어 앞 24자부터)(src/qrfind.js row · snippet)
//   ③ 생성 중 미리보기 그림(src/background-window.js — 끝 64자를 32자씩 두 줄)
//   이모지는 UTF-16 두 칸이라 slice 가 가운데를 자르면 반쪽이 남아요. 이제 자르는 자리가 쌍 가운데면 그 글자를 통째로 빼요.
//   소스에서 그 함수만 잘라 돌려요. 글은 지어낸 것.  node tools/tests/emoji-cut.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const fn = (src, name) => { const a = src.indexOf(`function ${name}(`); assert.ok(a >= 0, name); const b = src.indexOf('\n}\n', a); return src.slice(a, b + 2); };
const helper = src => { const m = src.match(/\nconst cutText = [^\n]+\n/); return m ? m[0] : 'const cutText = undefined;\n'; };
let pass = 0;

{   // ① 알림 본문
    const src = read('src/reply-notify.js');
    const make = new Function('SillyTavern', 'dropThinkingHead', `${helper(src)}${fn(src, 'replyPreview')}\nreturn replyPreview;`);
    for (let pad = 115; pad <= 121; pad++) {
        const mes = 'ㄱ'.repeat(pad) + '😀🍋🌙'.repeat(5);
        const replyPreview = make({ getContext: () => ({ chat: [{ is_user: false, name: '답', mes }] }) }, t => t);
        const { body } = replyPreview();
        assert.doesNotMatch(body, LONE, `알림 본문 끝에 이모지 반쪽(앞 ${pad}자)`);
        assert.ok(body.length >= 118 && body.length <= 120);
    }
    pass++;
}

{   // ② 퀵 리플라이 찾기
    const src = read('src/qrfind.js');
    const esc = s => String(s);
    const snippet = new Function('esc', `${helper(src)}${fn(src, 'snippet')}\nreturn snippet;`)(esc);
    for (let pad = 85; pad <= 92; pad++) {
        const text = 'ㄴ'.repeat(pad) + '🍋'.repeat(10);
        assert.doesNotMatch(snippet(text, ''), LONE, `내용 줄 끝(앞 ${pad}자)`);
    }
    for (let pad = 0; pad < 4; pad++) {
        const text = 'ㄷ'.repeat(70 + pad) + '🍋'.repeat(20) + '찾는말' + 'ㄹ'.repeat(120);
        const out = snippet(text, '찾는말');
        assert.doesNotMatch(out, LONE, `검색어 앞을 자른 첫머리(${pad})`);
        assert.ok(out.includes('찾는말'));
    }
    const marked = (s) => s;
    const row = new Function('esc', 'marked', 'snippet', `${helper(src)}${fn(src, 'row')}\nreturn row;`)(esc, marked, snippet);
    for (let pad = 27; pad <= 30; pad++) {
        const html = row({ label: '', text: 'ㅁ'.repeat(pad) + '🌙'.repeat(5), body: '', set: '' }, 0, '');
        const name = html.match(/<b>(.*?)<\/b>/)[1];
        assert.doesNotMatch(name, LONE, `이름(앞 ${pad}자)`);
    }
    pass++;
}

{   // ③ 생성 중 미리보기 — 그리는 두 줄
    const src = read('src/background-window.js');
    const at = src.indexOf('state.preview.replace(', src.indexOf('function draw('));
    const start = src.lastIndexOf('\n', at) + 1;
    const end = src.indexOf('\n', src.indexOf('ctx.fillText(text', start));
    const body = src.slice(start, end);
    for (let pad = 0; pad < 70; pad++) {
        const lines = [];
        const ctx = { fillText: t => lines.push(t) };
        new Function('state', 'ctx', `${helper(src)}${body}`)({ preview: 'ㅂ'.repeat(pad) + '😀'.repeat(40) + 'ㅅ'.repeat(pad % 3) }, ctx);
        assert.equal(lines.length, 2);
        for (const l of lines) assert.doesNotMatch(l, LONE, `미리보기 줄(앞 ${pad})`);
    }
    pass++;
}

console.log(`emoji-cut: ${pass} 통과`);
