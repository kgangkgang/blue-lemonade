// 1.6.0 미트볼 창의 단추 줄이 바로 아래 카드에 붙던 것(프롬프트 · 토큰 창 › 토큰 안내 「칸별로 보기」) — 단추 줄과 카드 사이에 줄 위와 같은 틈(src/ext-status.css)
//   node tools/tests/mb-rowbtn-gap.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
const rule = sel => { const at = css.indexOf(sel + ' {'); assert.ok(at >= 0, sel); return css.slice(at, css.indexOf('}', at) + 1); };
// 단추 줄의 위 여백과 같은 값을 아래 카드 쪽에도
const top = /margin-top: (var\(--bl-s3, 12px\))/.exec(rule('body.salty .ss-scope .ss-row-btns'))[1];
assert.equal(rule('body.salty:not([data-bl-ext-raw]) .ss-scope .ss-row-btns + .ss-cost'), `body.salty:not([data-bl-ext-raw]) .ss-scope .ss-row-btns + .ss-cost { margin-top: ${top}; }`);
// 「칸별로 보기」 아래 막대 상자: 비어 있으면(높이 0) 아래 여백 하나가 줄과 카드 사이 틈 · 펼치면 막대와 카드 사이 틈
assert.equal(rule('body.salty:not([data-bl-ext-raw]) .ss-scope .ss-row-btns + .ss-tokmods-box'), `body.salty:not([data-bl-ext-raw]) .ss-scope .ss-row-btns + .ss-tokmods-box { margin-bottom: ${top}; }`);
console.log('mb-rowbtn-gap: 2개 통과');
