// 리그 fixture: 데이터가 찬 화면(출석 N일 · 영수증 · 편지 · 메시지 · 엑스트라 · 긴 목록 · 채팅 2개)을 합성 계정에 심는다.
// 파일 쪽(data/default-user)은 up 때 쓰고, 브라우저 쪽(IndexedDB 사용량 장부 · 엑스트라 목소리)은 페이지가 뜬 뒤 browserScript() 로 넣는다.
// 저장 모양 근거: 개인 애드온 기록(./fixture-life.mjs) · 테마 usage-ledger(IndexedDB BlueLemonadeUsage/entries keyPath id, index at) · ST chats jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { REAL_ST } from './common.mjs';
import { lifeFiles } from './fixture-life.mjs';

const DAY = 86400000;
const dayKey = t => new Date(t).toISOString().slice(0, 10);
const rnd = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };   // mulberry32

export function loadSpec(name) {
    const file = path.isAbsolute(name) ? name : path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'fixtures', `${name}.json`);
    const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    // 10-27 영향지도 · 기준 사진 캐시: 「auto」 는 리그를 띄운 시각이라 리그마다 채팅 시각(오후 9:56 ↔ 10:58)이 달라 사진 캐시 표본 대조가 늘 「다름」이었어요.
    //   BL_FIXTURE_TODAY(ISO 시각)가 있으면 그 시각으로 고정해요 — shot-diff 는 페이지 시계 고정(2026-10-24 12:00 KST)과 같은 값을 넘겨요. 없으면 예전과 같아요.
    const envToday = process.env.BL_FIXTURE_TODAY ? Date.parse(process.env.BL_FIXTURE_TODAY) : NaN;
    spec.todayMs = Number.isFinite(envToday) ? envToday : spec.today === 'auto' || !spec.today ? Date.now() : Date.parse(spec.today);
    spec.todaySource = Number.isFinite(envToday) ? 'env' : spec.today === 'auto' || !spec.today ? 'auto' : 'spec';
    return spec;
}

export { lifeFiles };   // 11-12 Actions: 개인 애드온 고정물은 ./fixture-life.mjs 로(공개 묶음에서는 빈 대역)

/** ST 채팅 jsonl 2개(짧은 것 · 긴 것) — 지어낸 문장만 */
export function chatFiles(spec) {
    const out = {};
    const lines = ['오늘 날씨가 참 맑네요.', '산책이라도 다녀올까요?', '아까 책에서 본 구절이 자꾸 생각나요.', '차 한 잔 더 드릴까요?', '내일 일정은 어떻게 돼요?', '고양이가 창가에서 자고 있어요.'];
    // 10-26 perf: rich 는 대사(큰따옴표) · *강조* · `코드` · 줄바꿈이 섞인 글(실제 답장 모양), images 는 N 턴마다 그림 한 장(실리태번 정적 그림 — 새 그림 생성 0), count 는 같은 모양의 채팅을 여러 개(제목 뒤 -02 …). 옵션이 없으면 예전과 똑같아요.
    const PICS = ['/img/ai4.png', '/img/five.png', '/img/addbg3.png'];
    const richLine = i => `${lines[i % lines.length]} "${lines[(i + 1) % lines.length]} 그렇지 않아요?" *${lines[(i + 2) % lines.length]}*${i % 5 === 4 ? '\n\n`숫자 ' + (1000 + i * 37) + '` 가 눈에 띄어요.' : ''}${i % 7 === 6 ? '\n' + lines[(i + 3) % lines.length].repeat(6) : ''}`;
    for (const chat of spec.chats) {
        for (let n = 1; n <= (chat.count || 1); n++) {
            const title = chat.count ? `${chat.title.replace(/-\d+$/, '')}-${String(n).padStart(2, '0')}` : chat.title;
            const t = spec.todayMs - DAY * n; const rows = [JSON.stringify({ user_name: 'Hero', character_name: chat.name, create_date: new Date(t).toISOString(), chat_metadata: { fixture: 'automation/full' } })];
            for (let i = 0; i < chat.turns; i++) {
                const extra = {}; if (chat.images && !(i % 2) && i % chat.images === chat.images - 1) { extra.media = [{ type: 'image', url: PICS[(i / chat.images | 0) % PICS.length] }]; extra.inline_image = true; }
                rows.push(JSON.stringify({ name: i % 2 ? 'Hero' : chat.name, is_user: !!(i % 2), is_system: false, send_date: new Date(t + i * 60000).toISOString(), mes: chat.rich ? richLine(i + n) : lines[i % lines.length] + (i % 7 === 6 ? ' ' + lines[(i + 3) % lines.length].repeat(6) : ''), extra }));
            }
            out[`chats/${chat.character}/${title}.jsonl`] = rows.join('\n') + '\n';
        }
    }
    return out;
}

/** 긴 목록: 월드 인포 N 항목 + 태그 */
export function longListFiles(spec) {
    const entries = {};
    for (let i = 0; i < spec.world.entries; i++) entries[i] = { uid: i, key: [`키워드${i}`], keysecondary: [], comment: `항목 ${i + 1} — 긴 목록 시험용`, content: `지어낸 설정 글 ${i + 1}. `.repeat(3), constant: false, selective: true, order: 100, position: 0, disable: i % 9 === 8, probability: 100, useProbability: true };
    return { [`worlds/${spec.world.name}.json`]: { entries } };
}

export function writeFiles(userDir, files) {
    const root = path.resolve(userDir), real = path.resolve(REAL_ST, 'data').toLowerCase();
    const resolved = fs.existsSync(root) ? fs.realpathSync(root) : root;
    if ([root, resolved].some(p => p.toLowerCase() === real || p.toLowerCase().startsWith(real + path.sep))) throw Error('실제 사용자 자료에는 시험 고정물을 쓰지 않아요');
    for (const rel of Object.keys(files)) { const target = path.resolve(root, rel), relative = path.relative(root, target); if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('고정물 파일이 격리 폴더 밖을 가리켜요'); }
    const written = [];
    for (const [rel, data] of Object.entries(files)) {
        const p = path.join(userDir, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); written.push(rel);
    }
    return written;
}

/** settings.json 에 넣을 fixture 조각(태그 · 엑스트라 표시용) */
export function settingsPatch(spec, settings) {
    if (spec.activeCharacter) settings.active_character = spec.activeCharacter;   // 10-26 perf: 켤 때 늘 같은 캐릭터의 마지막 채팅이 열리게(옵션 없으면 예전과 같음)
    settings.tags = [...(settings.tags || [])];
    for (let i = (settings.tags || []).length; i < Math.min(spec.longList, 40); i++) settings.tags.push({ id: `fx-tag-${i}`, name: `태그 ${i + 1}`, color: '', color2: '' });
    return settings;
}

/** 브라우저 쪽: 사용량 장부(IndexedDB) 영수증 N건 + 엑스트라 화자 N명 — 페이지가 뜬 뒤 eval. 모양이 바뀌면 여기만 고친다. */
export function browserScript(spec) {
    const r = rnd(7); const today = spec.todayMs; const rows = [];
    const models = ['claude-sonnet-4-5', 'gpt-5-mini', 'gemini-2.5-flash'];
    for (let i = 0; i < spec.receipts; i++) {
        const at = today - Math.floor(r() * 3) * DAY - Math.floor(r() * 8) * 3600000; const inp = 800 + Math.floor(r() * 6000), outp = 100 + Math.floor(r() * 900);
        rows.push({ id: `fx-${i}-${at}`, at, api: 'openai', model: models[i % models.length], origin: 'https://relay.example.test', inputTokens: inp, outputTokens: outp, cacheRead: 0, cacheWrite: 0, usd: +((inp * 3 + outp * 15) / 1e6).toFixed(6), kind: 'chat', fixture: true });
    }
    return `(async()=>{const rows=${JSON.stringify(rows)};const extras=${JSON.stringify(spec.extras)};
      const open=()=>new Promise((res,rej)=>{const q=indexedDB.open('BlueLemonadeUsage');q.onupgradeneeded=()=>{const s=q.result.createObjectStore('entries',{keyPath:'id'});s.createIndex('at','at')};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
      const db=await open();await new Promise((res,rej)=>{const tx=db.transaction('entries','readwrite');const st=tx.objectStore('entries');for(const row of rows)st.put(row);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close();
      let extrasApplied=false;try{const ctx=SillyTavern.getContext();const es=ctx.extensionSettings;es.lemon_voice=es.lemon_voice||{};es.lemon_voice.fixtureExtras=extras;extrasApplied=true;}catch{}
      return {receipts:rows.length,extras:extras.length,extrasApplied};})()`;
}

export function buildAll(spec, userDir, settings) {
    const files = { ...lifeFiles(spec), ...chatFiles(spec), ...longListFiles(spec) };
    const written = writeFiles(userDir, files);
    settingsPatch(spec, settings);
    return { files: written, browser: browserScript(spec), summary: { attendanceDays: spec.attendanceDays, letters: spec.letters, receipts: spec.receipts, extras: spec.extras.length, worldEntries: spec.world.entries, chats: spec.chats.map(c => c.turns), chatFiles: written.filter(f => f.startsWith('chats/')).length } };
}
