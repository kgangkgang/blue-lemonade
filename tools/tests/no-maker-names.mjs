// 공개되는 소스 주석 · 문서에 「만든 이 표시」(무슨 모델이 만들었는지 적은 글자)가 다시 들어오지 않게 지켜요.
//   node tools/tests/no-maker-names.mjs [테마 폴더]
// 잡는 꼴은 셋뿐이에요(좁게 — 기능 설명은 그대로 둬요).
//   (ㄱ) 괄호 안 「모델 이름 [판]」에 날짜 · 지시 번호가 같이 있거나, 괄호 안이 「모델 이름 + 소수점 판」 하나뿐인 꼴
//   (ㄴ) 「모델 이름 + 가/이 + 만든 · 쓴 · 그린 · 설계 · 디자인 · 검토」 · 「만든 이 / 작성 / author / … by + 모델 이름」 꼴
//   (ㄷ) 작업 분기 이름(도구 이름 + 빗금 + 분기)이 적힌 꼴
// 보는 곳: 소스(js · mjs · cjs · css · html · py · yml · cmd)의 주석 글자 + 문서(md · txt · json)의 모든 줄. dist · vendor · fonts 는 안 봐요.
// 어느 모델을 어떻게 다루는지 적은 기능 주석 · 가격표 · 모델 목록 · 목소리 이름 · 파일 종류 이름은 이 꼴에 안 걸려요(아래 보기 글이 증명해요).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || '.');

// 허용 목록 — 파일 경로 + 까닭. 여기 없는 파일은 예외가 없어요.
const ALLOW = {
    'src/addons/tts/src/sfx-library.js': '묶어 실은 원작 코드의 저작권 줄(원본 manifest 의 저자 표기) — 출처 표시라 빼지 않아요',
    'src/addons/tts/sfx/SOURCES.json': '묶어 실은 효과음 파일의 C2PA 메타데이터 관찰 기록 — 남의 파일의 출처 기록이에요',
    'src/addons/tts/NOTICE.md': '원작 저자 표기와 효과음 파일의 C2PA 관찰 기록 — 출처 표시라 빼지 않아요',
    'tools/tests/no-maker-names.mjs': '이 시험 자신 — 잡는 꼴의 보기 글이 들어 있어요',
};

const NAME = '(?:fable|opus|sonnet|haiku|claude|codex|gpt|gemini|페이블|오푸스|소넷|하이쿠|클로드|코덱스|제미나이)';
const ONE = new RegExp(`^${NAME}(?:[ -]?\\d+(?:\\.\\d+)*)?$`, 'i');           // 괄호 안 한 칸이 「모델 이름 [판]」뿐
const ONE_VER = new RegExp(`^${NAME}[ -]?\\d+\\.\\d+$`, 'i');                  // 「모델 이름 + 소수점 판」
const STAMP = /^(?:\d{4}-)?\d{1,2}-\d{1,2}$|^지시-\d+/;                          // 날짜 · 지시 번호
const MADE = new RegExp(`${NAME}[ \\d.]*(?:가|이) ?(?:만든|만들|쓴|썼|그린|그렸|설계|디자인|검토)`, 'i');
const BY = new RegExp(`(?:만든 ?이|작성자?|지은이|\\bauthor\\b[^\\n]{0,40}?|\\b(?:authored|written|designed|reviewed|made|created|modified|generated|drawn) (?:by|with)|co-authored-by)\\s*[:：]?\\s*(?:[\\w.]+ (?:&|and) )?${NAME}\\b`, 'i');
const BRANCH = /(?<![\w./-])codex\/[a-z0-9][\w.-]*/i;

/** 글 한 덩이에서 걸리는 꼴을 찾아요 — 없으면 '' */
export function makerMark(text) {
    for (const m of text.matchAll(/\(([^()\n]{1,80})\)/g)) {
        const cells = m[1].split(/\s*[·,]\s*/).map(s => s.trim());
        if (!cells.some(c => ONE.test(c))) continue;
        if (cells.length === 1 ? ONE_VER.test(cells[0]) : cells.some(c => STAMP.test(c))) return `(ㄱ) ${m[0]}`;
    }
    const made = text.match(MADE); if (made) return `(ㄴ) ${made[0]}`;
    const by = text.match(BY); if (by) return `(ㄴ) ${by[0]}`;
    const br = text.match(BRANCH); if (br) return `(ㄷ) ${br[0]}`;
    return '';
}

/** 소스 글에서 주석 글자만 줄 번호와 함께 꺼내요(// · /* *\/ · # · <!-- -->) */
export function commentsOf(text, ext) {
    const out = [], hash = ['.py', '.yml', '.yaml'].includes(ext), rem = ext === '.cmd';
    let block = '';   // 열려 있는 블록 주석의 닫는 글자
    text.split('\n').forEach((line, i) => {
        let rest = line, got = '';
        while (rest) {
            if (block) { const e = rest.indexOf(block); if (e < 0) { got += ` ${rest}`; rest = ''; } else { got += ` ${rest.slice(0, e)}`; rest = rest.slice(e + block.length); block = ''; } continue; }
            if (hash) { const h = rest.search(/(?:^|\s)#/); if (h >= 0) got += ` ${rest.slice(h)}`; break; }
            if (rem) { if (/^\s*(?:rem\b|::)/i.test(rest)) got += ` ${rest}`; break; }
            const at = rest.search(/(?<!:)\/\/|\/\*|<!--/); if (at < 0) break;
            if (rest.startsWith('//', at)) { got += ` ${rest.slice(at)}`; break; }
            block = rest.startsWith('/*', at) ? '*/' : '-->'; rest = rest.slice(at + (block === '*/' ? 2 : 4));
        }
        if (got) out.push({ line: i + 1, text: got });
    });
    return out;
}

// ── 보기 글: 잡는 것 · 안 잡는 것 ──
const BAD = [
    '// 전환을 달아요 — 순수 함수 (Fable 5.2 · 11-12)',
    '// 바탕 질감 고리(11-11 · Fable 5.2) — 모눈종이',
    '// 커스텀 고리(지시-1111 커스텀 · Opus 5.5) — 공용 모듈',
    '/* 11-11 무테 이음매 3(Opus 5.5): 자루 끝 */',
    '// 이 화면은 페이블이 만든 시안이에요',
    '// Claude 5.2 가 설계 · Sonnet 이 검토',
    '// 만든 이: Opus',
    '// written by Claude',
    '# Generated with Claude Code',
    '// 원본 codex/release-112 의 src/x.js 를 복사한 것이에요',
];
const GOOD = [
    '// Claude 5 · Fable · Gemini 3 이후는 생각을 짧게 시켜요',
    '// 생각하는 모델(Claude 하이쿠 5.5 · Fable · Gemini 3 이후 등)은 출력 한도를 넉넉히',
    '// 목록을 받을 수 없는 공급자 (Claude): 등록 → KNOWN',
    '// 400 {"message":"request blocked by Gemini API: PROHIBITED_CONTENT"} (2026-09-16 확인)',
    '// 예전 기본(OpenRouter Claude Haiku 5.5 · Google Gemini 3.8 Flash)으로 되돌려요',
    '// 목소리 fable · 파일 종류 .opus',
    '// id 는 openai/gpt-5-codex 꼴 · 주소는 https://example.com/codex/x',
    '// 원본 블루레몬에이드 1.1.2 의 src/x.js 를 복사한 것이에요',
    '// 모델 목록에 Fable 5.2 · GPT-6.1 Terra 를 넣었어요',
];
for (const s of BAD) assert.ok(makerMark(commentsOf(s, s.startsWith('#') ? '.py' : '.js').map(c => c.text).join('\n')), `잡아야 해요: ${s}`);
for (const s of GOOD) assert.equal(makerMark(commentsOf(s, '.js').map(c => c.text).join('\n')), '', `잡으면 안 돼요: ${s}`);
assert.equal(commentsOf('const a = "(Opus 5.5)";   // 가격표 줄', '.js')[0].text.includes('Opus'), false, '주석 밖 글자는 안 봐요');
assert.deepEqual(commentsOf('a /* 하나\n둘 */ b // 셋', '.js').map(c => c.line), [1, 2]);
console.log(`PASS 보기 글: 만든 이 표시 ${BAD.length}꼴은 잡고 기능 주석 ${GOOD.length}꼴은 지나가요`);

// ── 트리 훑기 ──
const SKIP_DIR = new Set(['.git', 'node_modules', 'dist', 'vendor', 'fonts', 'docs']);
const CODE = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.py', '.yml', '.yaml', '.cmd']);
const DOC = new Set(['.md', '.txt', '.json']);
const hits = [], seenAllow = new Set();
let files = 0;
const walk = rel => {
    for (const ent of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
        const r = rel ? `${rel}/${ent.name}` : ent.name;
        if (ent.isDirectory()) { if (!SKIP_DIR.has(ent.name)) walk(r); continue; }
        const ext = path.extname(ent.name).toLowerCase();
        if (!CODE.has(ext) && !DOC.has(ext)) continue;
        files += 1;
        const text = fs.readFileSync(path.join(dir, r), 'utf8').replace(/\r\n/g, '\n');
        const rows = DOC.has(ext) ? text.split('\n').map((t, i) => ({ line: i + 1, text: t })) : commentsOf(text, ext);
        for (const row of rows) {
            const why = makerMark(row.text); if (!why) continue;
            if (ALLOW[r]) { seenAllow.add(r); continue; }
            hits.push(`${r}:${row.line} ${why}`);
        }
    }
};
walk('');
assert.deepEqual(hits, [], `만든 이 표시가 남았어요 — 이름을 빼고 무엇을 하는지만 적어요:\n${hits.join('\n')}`);
for (const f of Object.keys(ALLOW)) assert.ok(fs.existsSync(path.join(dir, f)), `허용 목록의 파일이 없어요(목록에서 빼요): ${f}`);
console.log(`PASS 소스 주석 · 문서 ${files}개에 만든 이 표시가 없어요(허용 ${Object.keys(ALLOW).length}개 가운데 ${seenAllow.size}개가 실제로 걸려요 — 출처 기록)`);
