// 1.2.1 옛 판 공지 압축 — 1.0.0 앞 판(2.x ~ 8.x) 공지 원문(tools/notice-old.src.mjs)을 deflate-raw · base64 로 눌러 src/notice-old.gen.js 를 떠요.
//   node tools/notice-old-gen.mjs           → src/notice-old.gen.js 를 다시 써요
//   node tools/notice-old-gen.mjs --check   → 원본에서 다시 떠서 src/notice-old.gen.js 와 한 글자도 같은지(CI)
//   왜: 공지 창 조각의 88%(약 380KB)가 1.0.0 앞 판 공지였어요. 글은 그대로 두고 눌러 담아 받는 바이트만 줄여요 — 푸는 것은 공지 창을 열 때(src/notice.js).
//   본보기: 「블루레몬 추천」 자료(tools/mart/picks-gen.mjs → src/log-copy-picks.gen.js)와 같은 꼴이에요.
//   경계: 옛 구간 맨 앞 판의 날짜가 최근 구간(src/notice-data.js) 맨 끝 판의 날짜와 같으면 안 돼요 — 공지 창은 같은 날 판을 한 장으로 묶어서,
//   경계가 하루 가운데를 가르면 장이 둘로 쪼개져 보이는 글이 달라져요. 그러면 여기서 멈춰요.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools/notice-old.src.mjs');
const GEN = path.join(ROOT, 'src/notice-old.gen.js');

/** 옛 구간 목록 → 생성물 글 */
export function genText(old, recent) {
    if (!Array.isArray(old) || !old.length) throw new Error('옛 구간이 비었어요');
    if (recent?.length && recent.at(-1).date === old[0].date) throw new Error(`경계가 같은 날(${old[0].date})을 갈라요 — 최근 · 옛 구간 경계를 다른 날로 옮겨요`);
    const blob = JSON.stringify(old);
    const z = zlib.deflateRawSync(Buffer.from(blob, 'utf8'), { level: 9 }).toString('base64');
    return `// 생성물 — 고치지 말고 tools/notice-old.src.mjs 를 고친 뒤 node tools/notice-old-gen.mjs 로 다시 떠요(${old.length}판 · ${old[0].version} ~ ${old.at(-1).version} · 풀면 ${Buffer.byteLength(blob).toLocaleString('en-US')}B)\n`
        + `// 1.2.1 1.0.0 앞 판 공지(JSON 목록)를 deflate-raw · base64 로 — 공지 창을 열 때만 받아 풀어요(src/notice.js loadOldNotices)\n`
        + `export const OLD_NOTICES_COUNT = ${old.length};\n`
        + `export const OLD_NOTICES_Z = ${JSON.stringify(z)};\n`;
}

export async function build() {
    const { OLD_NOTICES } = await import(pathToFileURL(SRC).href);
    const { NOTICES } = await import(pathToFileURL(path.join(ROOT, 'src/notice-data.js')).href);
    return genText(OLD_NOTICES, NOTICES);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const text = await build();
    if (process.argv.includes('--check')) {
        const same = fs.existsSync(GEN) && fs.readFileSync(GEN, 'utf8') === text;
        console.log(same ? '같아요' : '다름 — node tools/notice-old-gen.mjs 로 다시 떠요');
        process.exit(same ? 0 : 1);
    }
    fs.writeFileSync(GEN, text);
    console.log(`${path.relative(ROOT, GEN)} ${Buffer.byteLength(text).toLocaleString('en-US')}B`);
}
