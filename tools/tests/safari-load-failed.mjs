// 버그 사냥 8 — 사파리(웹킷)의 연결 끊김 오류 문구 「Load failed」를 연결 오류로 알아보는지
//   크롬은 fetch 가 연결 단계에서 실패하면 TypeError 「Failed to fetch」, 파이어폭스는 「NetworkError …」인데
//   사파리 · iOS 의 모든 브라우저는 TypeError 「Load failed」 예요(WebKit 리그에서 그대로 봤어요).
//   테마의 일시 오류 · 연결 오류 판정이 앞의 둘만 보아서, 사파리에서는
//     · 번역 · 한글화 패널이 끊김을 일시 오류로 못 보고 다시 보내지 않았고(크롬에서는 다시 보냄)
//     · TTS 분석은 끊김을 「일시 오류 아님」으로 보아 같은 글을 날 응답으로 한 번 더 보냈어요(생성이 됐을 수 있어 값을 두 번 치름)
//     · 알림이 「요청 실패: Load failed」 같은 영어 원문으로 떴어요.
//   ① 소스 전체에서 'failed to fetch' 로 연결 오류를 가르는 줄은 같은 줄에 'load failed' 도 봐야 해요(만드는 줄 — new TypeError — 은 빼요)
//   ② 따로 불러 돌릴 수 있는 판정 함수는 직접 돌려요.   node tools/tests/safari-load-failed.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let pass = 0;

{   // ① 줄 검사
    const miss = [];
    const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/^(vendor|node_modules)$/.test(e.name)) walk(p); } else if (/\.js$/.test(e.name)) {
        fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => { if (/failed to fetch/i.test(line) && !/new TypeError\(/.test(line) && !/load failed/i.test(line)) miss.push(`${path.relative(root, p)}:${i + 1}`); });
    } } };
    walk(path.join(root, 'src'));
    assert.deepEqual(miss, [], `「failed to fetch」 만 보고 사파리 「Load failed」 를 안 보는 줄: ${miss.join(', ')}`);
    pass++;
}

{   // ② 한글화 패널 일시 오류 판정(순수 모듈)
    const { isTransientFailure } = await import(pathToFileURL(path.join(root, 'src/addons/prompt/request-errors.js')).href);
    const safari = new TypeError('Load failed');
    assert.equal(isTransientFailure(safari, safari.message), true, '사파리 연결 끊김은 일시 오류');
    assert.equal(isTransientFailure(new TypeError('Failed to fetch'), 'Failed to fetch'), true, '크롬 연결 끊김은 그대로 일시 오류');
    assert.equal(isTransientFailure(new Error('Unauthorized'), 'Unauthorized'), false, '키 오류는 그대로 일시 오류 아님');
    pass++;
}

{   // ③ 성능 보조 시작 오류(순수 모듈) — 사파리에서 파일을 못 받은 것도 「파일을 불러오지 못했어요」
    const { perfStartError } = await import(pathToFileURL(path.join(root, 'src/addons/perf/start-error.js')).href);
    assert.equal(perfStartError('ENTRY', new TypeError('Load failed')).perfKind, 'FETCH');
    assert.equal(perfStartError('ENTRY', new TypeError('x is not a function')).perfKind, 'INIT');
    pass++;
}

console.log(`safari-load-failed: ${pass}/3 통과`);
