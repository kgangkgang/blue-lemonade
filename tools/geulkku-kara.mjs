#!/usr/bin/env node
// 글꾸 마트에 「노래방 글꾸」 6종(가사가 흐르는 노래 카드 — 비 오는 밤 · 하늘 팝 · 어두운 동화 · 검은 자막 · 따뜻한 물방울 · 첫눈)을 덧붙여요(11-09).
// - 실행: node tools/geulkku-kara.mjs [--check]   (node 24 · 외부 의존 없음 · 멱등)
//   --check: 쓰지 않고 지금 자료와 같은지만 봐요(다르면 1로 끝나요).
// - 틀은 mart/kara/kara-core.js(만들기 화면 mart/kara/ 와 같은 모듈)로 견본 가사 · 견본 mp3(mart/data/sample/kara/tone.mp3 · 24초 합성음) · 견본 표지(cover-<테마>.svg)로 그려요.
// - 로그 복사 틀이 아니라 <style> · <audio> 가 든 게시글 HTML 이에요: copyOnly(HTML 복사만) + photo + audio. 카드 · 상세 창의 「🎤 내 곡으로 만들기」 링크는 mart.js sourceLinks 가 붙여요.
// - 순서: geulkku-song.mjs 뒤에 돌려요(카드 · 분류 차례가 노래 앨범 바로 뒤). split 을 다시 돌리면 이것도 다시 돌려요.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'mart', 'data', 'geulkku');
const INDEX = path.join(DIR, 'index.json');
const CHECK = process.argv.includes('--check');
const { THEMES, THEME_IDS, buildPost, checkPost, parseLyrics } = await import(pathToFileURL(path.join(ROOT, 'mart', 'kara', 'kara-core.js')).href);
const CAT = { id: 'kara', label: '노래방 글꾸', group: 'concept' };
const KEY = 'sg-kara';
const AFTER = 'song';
const BASE = 'https://kgangkgang.github.io/blue-lemonade/mart/data/sample/kara/';
// 견본 가사(지어낸 안내 글 · 24초) — 사용자 곡 · 가사가 아니에요
export const SAMPLE_LRC = `[0:00] 여기에 첫 줄 가사를 적어요
[0:04] 시간은 [분:초] 로 줄 앞에 써요
[0:08] 노래가 흐르면 이 줄이 가운데로 와요
[0:12] 번역이나 원문은 바로 아래 줄에 적어요
작은 글로 같은 줄에 붙어요
[0:16] 글자색은 부르는 캐릭터 색이에요
[0:20] 마지막 줄까지 천천히 넘어가요`;
const COMMON = '플레이어를 누르면 가사 · 레코드판이 같이 움직여요(스크립트 없음) · 「🎤 내 곡으로 만들기」에서 mp3 주소 · 제목 · 이름 · 색 · [분:초] 가사를 넣으면 복사할 HTML 이 바로 나와요 · 여러 곡이면 곡 사이에 코멘트 칸 · 깡싸 정화기 대응(인라인 글자색 · 단색 바탕 · id/for/name 없음 · 진짜 img · audio)';
const NAMES = { ign: '비 오는 밤 노래방', mes: '하늘 팝 노래방', tale: '어두운 동화 노래방', meme: '검은 자막 노래방', tom: '물방울 노래방', snow: '첫눈 노래방' };

const serial = ({ items, ...head }) => `${JSON.stringify(head, null, 1).replace(/\n}$/, '')},\n "items": [\n${items.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}\n`;
const { lines } = parseLyrics(SAMPLE_LRC);
const heavy = {}, rows = [];
THEME_IDS.forEach((th, i) => {
  const T = THEMES[th], id = `kara-${th}`;
  const song = { th, title: '견본 노래', sub: 'SAMPLE SONG', who: [{ name: 'Aster', color: '#79A9D8' }], mp3: `${BASE}tone.mp3`, cover: { src: `${BASE}cover-${th}.svg`, w: 800, h: 800 }, dur: 24, lines };
  const { html, warn } = buildPost([song], { start: 1, key: i + 1 });   // 테마마다 다른 클래스 꼬리(k1~k6) — 마트 한 화면에 6종이 같이 떠도 키프레임 이름이 안 겹쳐요
  if (warn.length) throw new Error(`${id}: ${warn.join(' / ')}`);
  const bad = checkPost(html);
  if (bad.length) throw new Error(`${id}: 깡싸에서 지워지거나 쓰면 안 되는 것이 있어요 — ${bad.join(', ')}`);
  for (const m of html.matchAll(/src="https:\/\/kgangkgang\.github\.io\/blue-lemonade\/mart\/data\/sample\/kara\/([^"]+)"/g)) if (!fs.existsSync(path.join(ROOT, 'mart', 'data', 'sample', 'kara', m[1]))) throw new Error(`${id}: 견본 kara/${m[1]} 이 없어요`);
  if (!/<audio /.test(html) || !/<img /.test(html)) throw new Error(`${id}: 견본 mp3 · 표지가 없어요`);
  heavy[id] = { preview: html };
  rows.push({ id, name: NAMES[th], emoji: T.emoji, category: CAT.id, style: '심플', desc: `${T.desc} · ${COMMON}`, c: KEY, copyOnly: true, photo: true, audio: true, bytes: Buffer.byteLength(html), fx: 'me', bg: T.bg, ink: T.ink, accent: T.accent });
});
const text = `${JSON.stringify({ items: heavy })}\n`;
const file = `${KEY}.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;

const raw = fs.readFileSync(INDEX, 'utf8');
const data = JSON.parse(raw);
const keep = data.items.filter(x => x.category !== CAT.id);
// 카드 차례: 노래 앨범 바로 뒤(없으면 화보 갤러리 뒤 · 심플 그림체 끝)
let at = keep.map(x => x.category).lastIndexOf(AFTER) + 1;
if (at <= 0) at = keep.map(x => x.category).lastIndexOf('hwabo') + 1;
if (at <= 0) { at = keep.findIndex(x => (x.style || '일러스트') !== '심플'); if (at < 0) at = keep.length; }
const items = [...keep.slice(0, at), ...rows, ...keep.slice(at)];
const cats = data.categories.filter(c => c.id !== CAT.id);
const prevAt = [AFTER, 'hwabo'].map(id => cats.findIndex(c => c.id === id)).find(i => i >= 0) ?? -1;
const builtinAt = cats.findIndex(c => c.builtin);
cats.splice(prevAt >= 0 ? prevAt + 1 : builtinAt >= 0 ? builtinAt : cats.length, 0, CAT);
const chunks = { ...data.chunks, [KEY]: { file, n: rows.length, bytes: Buffer.byteLength(text) } };
const next = { ...data, count: items.length, categories: cats, chunks };
const ordered = Object.fromEntries(Object.keys(data).filter(k => k !== 'items').map(k => [k, next[k]]));
const indexText = serial({ ...ordered, items });
const oldFile = data.chunks?.[KEY]?.file;
if (CHECK) {
  const same = raw === indexText && fs.existsSync(path.join(DIR, file)) && fs.readFileSync(path.join(DIR, file), 'utf8') === text;
  console.log(same ? `확인: 노래방 글꾸 ${rows.length}종 그대로예요` : '노래방 글꾸 자료가 달라요 — node tools/geulkku-kara.mjs 로 다시 만들어요');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(path.join(DIR, file), text);
if (oldFile && oldFile !== file && fs.existsSync(path.join(DIR, oldFile))) fs.rmSync(path.join(DIR, oldFile));
fs.writeFileSync(INDEX, indexText);
console.log(`노래방 글꾸 ${rows.length}종 → ${file}(${Buffer.byteLength(text)}B) · 글꾸 모두 ${items.length}종 · 분류 「${CAT.label}」(컨셉 묶음 · 노래 앨범 뒤)`);
