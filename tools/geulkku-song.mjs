#!/usr/bin/env node
// 글꾸 마트에 「노래 앨범」 3종(다크 앨범 · 밝은 싱글 · 플레이리스트 — 커뮤니티 글에 붙이는 그림 + mp3 노래 틀)을 덧붙여요(11-09).
// - 실행: node tools/geulkku-song.mjs [--check]   (node 24 · 외부 의존 없음 · 멱등)
//   --check: 쓰지 않고 지금 자료와 같은지만 봐요(다르면 1로 끝나요).
// - 틀은 tools/song-templates.cjs(견본 4곡 판), 견본 그림은 화보 견본 mart/data/sample/hwabo, 견본 mp3 는 mart/data/sample/song(직접 만든 6초 합성음).
// - 로그 복사 틀이 아니라 <style> · <audio> 가 든 게시글 HTML 이에요: copyOnly(HTML 복사만) + photo(시식 · 내 로그 · 글자색 없음).
// - 순서: geulkku-hwabo.mjs 뒤에 돌려요(카드 · 분류 차례가 화보 갤러리 바로 뒤). split 을 다시 돌리면 이것도 다시 돌려요.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'mart', 'data', 'geulkku');
const INDEX = path.join(DIR, 'index.json');
const CHECK = process.argv.includes('--check');
const { album, single, playlist, forbidden, wordsBad } = createRequire(import.meta.url)('./song-templates.cjs');
const CAT = { id: 'song', label: '노래 앨범', group: 'concept' };
const KEY = 'sg-song';
const AFTER = 'hwabo';
const COMMON = '그림 · mp3 주소와 제목 · 이름을 바꿔 깡싸 글 HTML 칸에 붙여요 · 곡 · 그림 · mp3 수가 달라도 블록을 복사 · 지우기만 하면 돼요 · 트랙 · 그림 번호는 저절로 · 곡마다 색(t1~t6) · 곡 사이 코멘트 칸';
const DEFS = [
  { id: 'song-album', name: '다크 앨범', emoji: '💿', fn: album, bg: '#0b0b0f', ink: '#f3f3f5', accent: '#c4364a', desc: `곡마다 큰 메인 그림 · 제목 · 캐릭터 칩 · 그림을 흐리게 깐 유리 mp3 카드 · 아래 그림 띠(폰은 손가락 · PC 는 휠 · 방향키) · ${COMMON}` },
  { id: 'song-single', name: '밝은 싱글', emoji: '🎼', fn: single, bg: '#f7f2ea', ink: '#1d1a17', accent: '#b3242c', desc: `종이빛 싱글 재킷 · 살짝 기운 액자 그림 · 세리프 제목 · 트랙 줄(ver. A · B …) · 아래 그림 격자 · ${COMMON}` },
  { id: 'song-playlist', name: '플레이리스트', emoji: '🎧', fn: playlist, bg: '#121318', ink: '#f1f2f5', accent: '#3f6fd8', desc: `음악 앱 목록처럼 한 줄에 한 곡 · 작은 그림 · 번호 · 제목 · mp3 · 「그림 ▾」를 누르면 그 곡 그림이 펼쳐져요 · ${COMMON}` },
];

const serial = ({ items, ...head }) => `${JSON.stringify(head, null, 1).replace(/\n}$/, '')},\n "items": [\n${items.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}\n`;
const heavy = {}, rows = [];
for (const d of DEFS) {
  const { html } = d.fn();
  const bad = forbidden(html).concat(wordsBad(html));
  if (bad.length) throw new Error(`${d.id}: 깡싸에서 지워지거나 쓰면 안 되는 것이 있어요 — ${bad.join(', ')}`);
  for (const [re, dir] of [[/src="https:\/\/kgangkgang\.github\.io\/blue-lemonade\/mart\/data\/sample\/hwabo\/([^"]+)"/g, 'hwabo'], [/src="https:\/\/kgangkgang\.github\.io\/blue-lemonade\/mart\/data\/sample\/song\/([^"]+)"/g, 'song']]) {
    const hits = [...html.matchAll(re)];
    if (!hits.length) throw new Error(`${d.id}: 견본 ${dir} 주소가 없어요`);
    for (const m of hits) if (!fs.existsSync(path.join(ROOT, 'mart', 'data', 'sample', dir, m[1]))) throw new Error(`${d.id}: 견본 ${dir}/${m[1]} 이 없어요`);
  }
  heavy[d.id] = { preview: html };
  rows.push({ id: d.id, name: d.name, emoji: d.emoji, category: CAT.id, style: '심플', desc: d.desc, c: KEY, copyOnly: true, photo: true, bytes: Buffer.byteLength(html), fx: 'e', bg: d.bg, ink: d.ink, accent: d.accent });
}
const text = `${JSON.stringify({ items: heavy })}\n`;
const file = `${KEY}.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;

const raw = fs.readFileSync(INDEX, 'utf8');
const data = JSON.parse(raw);
const keep = data.items.filter(x => x.category !== CAT.id);
// 카드 차례: 화보 갤러리 바로 뒤(없으면 반응 글꾸 뒤 · 심플 그림체 끝)
let at = keep.map(x => x.category).lastIndexOf(AFTER) + 1;
if (at <= 0) at = keep.map(x => x.category).lastIndexOf('react') + 1;
if (at <= 0) { at = keep.findIndex(x => (x.style || '일러스트') !== '심플'); if (at < 0) at = keep.length; }
const items = [...keep.slice(0, at), ...rows, ...keep.slice(at)];
const cats = data.categories.filter(c => c.id !== CAT.id);
const prevAt = [AFTER, 'react'].map(id => cats.findIndex(c => c.id === id)).find(i => i >= 0) ?? -1;
const builtinAt = cats.findIndex(c => c.builtin);
cats.splice(prevAt >= 0 ? prevAt + 1 : builtinAt >= 0 ? builtinAt : cats.length, 0, CAT);
const chunks = { ...data.chunks, [KEY]: { file, n: rows.length, bytes: Buffer.byteLength(text) } };
const next = { ...data, count: items.length, categories: cats, chunks };
const ordered = Object.fromEntries(Object.keys(data).filter(k => k !== 'items').map(k => [k, next[k]]));
const indexText = serial({ ...ordered, items });
const oldFile = data.chunks?.[KEY]?.file;
if (CHECK) {
  const same = raw === indexText && fs.existsSync(path.join(DIR, file)) && fs.readFileSync(path.join(DIR, file), 'utf8') === text;
  console.log(same ? `확인: 노래 앨범 ${rows.length}종 그대로예요` : '노래 앨범 자료가 달라요 — node tools/geulkku-song.mjs 로 다시 만들어요');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(path.join(DIR, file), text);
if (oldFile && oldFile !== file && fs.existsSync(path.join(DIR, oldFile))) fs.rmSync(path.join(DIR, oldFile));
fs.writeFileSync(INDEX, indexText);
console.log(`노래 앨범 ${rows.length}종 → ${file}(${Buffer.byteLength(text)}B) · 글꾸 모두 ${items.length}종 · 분류 「${CAT.label}」(컨셉 묶음)`);
