#!/usr/bin/env node
// 글꾸 마트에 「화보 갤러리」 3종(책장 넘김 · 스토리 뷰어 · 라이트 테이블 — 커뮤니티 글에 붙이는 사진 화보 틀)을 덧붙여요(11-09).
// - 실행: node tools/geulkku-hwabo.mjs [--check]   (node 24 · 외부 의존 없음 · 멱등)
//   --check: 쓰지 않고 지금 자료와 같은지만 봐요(다르면 1로 끝나요).
// - 틀은 tools/hwabo-templates.cjs(견본 사진 12장 판), 견본 사진은 mart/data/sample/hwabo(tools/hwabo-samples.cjs).
// - 로그 복사 틀이 아니라 <style> · 체크박스가 든 게시글 HTML 이에요: copyOnly(HTML 복사만) + photo(시식 · 내 로그 · 글자색 없음).
//   테마 「마트에서 가져오기」로는 받지 않아요(테마 검사 checkTemplate 은 class · <style> 을 막아요).
// - 순서: 다른 글꾸 도구(split-geulkku · geulkku-accent · geulkku-builtin · geulkku-react) 뒤에 돌려요. split 을 다시 돌리면 이것도 다시 돌려요.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'mart', 'data', 'geulkku');
const INDEX = path.join(DIR, 'index.json');
const CHECK = process.argv.includes('--check');
const { book, story, table, forbidden } = createRequire(import.meta.url)('./hwabo-templates.cjs');
const N = 12;
const CAT = { id: 'hwabo', label: '화보 갤러리', group: 'concept' };
const KEY = 'hb-hwabo';
const COMMON = '사진 · 이름 · 코멘트를 바꿔 깡싸 글 HTML 칸에 붙여요 · 사진 수가 달라도 블록을 복사 · 지우기만 하면 돼요 · 사진 번호는 저절로';
const DEFS = [
  { id: 'hwabo-book', name: '책장 넘김', emoji: '📖', fn: book, bg: '#f3efe7', ink: '#1b1a1f', accent: '#b3242c', desc: `잡지처럼 한 쪽씩 넘겨요 · 위 · 아래 「이전 · 다음」과 「03 / 05」 · 표지 · SNS 카드 · 폴라로이드 · 필름 묶음 · ${COMMON}` },
  { id: 'hwabo-story', name: '스토리 뷰어', emoji: '📱', fn: story, bg: '#0a0d16', ink: '#eef1f8', accent: '#3f5fb5', desc: `SNS 스토리처럼 한 장씩 · 장 왼쪽 · 오른쪽을 누르거나 아래 단추로 넘겨요 · 위 진행 막대 · 하이라이트 동그라미 · 말풍선 답장 · ${COMMON}` },
  { id: 'hwabo-table', name: '라이트 테이블', emoji: '🎞️', fn: table, bg: '#f8f6f0', ink: '#24201b', accent: '#9a3b12', desc: `밀착 인화지 위 프레임 · 누르면 크게(다시 누르면 작게) · 롤 머리를 누르면 한 줄 필름 띠로 접혀요 · 코멘트 사진은 인화 + 말풍선 · ${COMMON}` },
];

// split-geulkku · geulkku-react 와 같은 index.json 꼴(머리는 들여쓰기 1 · 항목은 한 줄에 하나)
const serial = ({ items, ...head }) => `${JSON.stringify(head, null, 1).replace(/\n}$/, '')},\n "items": [\n${items.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}\n`;
const heavy = {}, rows = [];
for (const d of DEFS) {
  const { html } = d.fn(N);
  const bad = forbidden(html);
  if (bad.length) throw new Error(`${d.id}: 깡싸 정화기가 지우는 것이 있어요 — ${bad.join(', ')}`);
  if (!/<img [^>]*src="https:\/\/kgangkgang\.github\.io\/blue-lemonade\/mart\/data\/sample\/hwabo\//.test(html)) throw new Error(`${d.id}: 견본 사진 주소가 이상해요`);
  for (const m of html.matchAll(/src="https:\/\/kgangkgang\.github\.io\/blue-lemonade\/mart\/data\/sample\/hwabo\/([^"]+)"/g)) if (!fs.existsSync(path.join(ROOT, 'mart', 'data', 'sample', 'hwabo', m[1]))) throw new Error(`${d.id}: 견본 사진 ${m[1]} 이 없어요(node tools/hwabo-samples.cjs mart/data/sample/hwabo)`);
  heavy[d.id] = { preview: html };
  rows.push({ id: d.id, name: d.name, emoji: d.emoji, category: CAT.id, style: '심플', desc: d.desc, c: KEY, copyOnly: true, photo: true, bytes: Buffer.byteLength(html), fx: 'e', bg: d.bg, ink: d.ink, accent: d.accent });
}
const text = `${JSON.stringify({ items: heavy })}\n`;
const file = `${KEY}.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;

const raw = fs.readFileSync(INDEX, 'utf8');
const data = JSON.parse(raw);
const keep = data.items.filter(x => x.category !== CAT.id);
// 카드 차례: 반응 글꾸 바로 뒤(없으면 심플 그림체 끝)
let at = keep.map(x => x.category).lastIndexOf('react') + 1;
if (at <= 0) { at = keep.findIndex(x => (x.style || '일러스트') !== '심플'); if (at < 0) at = keep.length; }
const items = [...keep.slice(0, at), ...rows, ...keep.slice(at)];
const cats = data.categories.filter(c => c.id !== CAT.id);
const reactAt = cats.findIndex(c => c.id === 'react');
const builtinAt = cats.findIndex(c => c.builtin);
cats.splice(reactAt >= 0 ? reactAt + 1 : builtinAt >= 0 ? builtinAt : cats.length, 0, CAT);
const chunks = { ...data.chunks, [KEY]: { file, n: rows.length, bytes: Buffer.byteLength(text) } };
const next = { ...data, count: items.length, categories: cats, chunks };
const ordered = Object.fromEntries(Object.keys(data).filter(k => k !== 'items').map(k => [k, next[k]]));
const indexText = serial({ ...ordered, items });
const oldFile = data.chunks?.[KEY]?.file;
if (CHECK) {
  const same = raw === indexText && fs.existsSync(path.join(DIR, file)) && fs.readFileSync(path.join(DIR, file), 'utf8') === text;
  console.log(same ? `확인: 화보 갤러리 ${rows.length}종 그대로예요` : '화보 갤러리 자료가 달라요 — node tools/geulkku-hwabo.mjs 로 다시 만들어요');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(path.join(DIR, file), text);
if (oldFile && oldFile !== file && fs.existsSync(path.join(DIR, oldFile))) fs.rmSync(path.join(DIR, oldFile));
fs.writeFileSync(INDEX, indexText);
console.log(`화보 갤러리 ${rows.length}종 → ${file}(${Buffer.byteLength(text)}B) · 글꾸 모두 ${items.length}종 · 분류 「${CAT.label}」(컨셉 묶음)`);
