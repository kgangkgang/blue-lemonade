// 프롬프트 템플릿 애드온이 담는 원본 ZIP 만들기 — zonde306/ST-Prompt-Template (AGPL-3.0) 의 한 커밋을 수정 없이 담는다.
//   node tools/prompt-template-bundle.mjs <원본 git 체크아웃 경로> [테마 루트=.]
//   node tools/prompt-template-bundle.mjs --check [테마 루트=.]     ← 담긴 ZIP 이 SOURCE.json 과 맞는지만 본다 (원본 없이)
// 담는 것: 그 커밋의 git 추적 파일 전부 (작업 트리가 깨끗해야 한다) 에서 dist/*.map(소스맵)만 뺀다. ZIP 안 맨 위 폴더는 ST-Prompt-Template/ —
// 원본 번들이 제 폴더 이름(third-party/ST-Prompt-Template)을 고정해 두어 설치 폴더 이름이 꼭 이것이어야 한다.
// 재현: 항목 이름 정렬 · 수정 시각 = 커밋 시각(UTC) · deflate 9 · 디렉터리 항목 없음 · 외부 속성 0. 파일별 SHA-256 은 SOURCE.json 에.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const FOLDER = 'ST-Prompt-Template';
export const UPSTREAM = 'https://github.com/zonde306/ST-Prompt-Template';
export const EXCLUDE = [/^\.git(\/|$)/, /\.map$/];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

const CRC = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); return n >>> 0; });
export function crc32(buffer) { let crc = 0xffffffff; for (const b of buffer) crc = (crc >>> 8) ^ CRC[(crc ^ b) & 255]; return (crc ^ 0xffffffff) >>> 0; }

/** 항목 [{ name, data }] (이름 순) → ZIP 바이트. 시각은 dosTime/dosDate 하나로 (재현용) */
export function buildZip(entries, { time = 0, date = 0x21 } = {}) {
    const locals = [], centrals = [];
    let offset = 0;
    for (const { name, data } of entries) {
        const nameBytes = Buffer.from(name, 'utf8');
        const packed = deflateRawSync(data, { level: 9 });
        const method = packed.length < data.length ? 8 : 0, body = method ? packed : data;
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
        local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(method, 10);
        central.writeUInt16LE(time, 12); central.writeUInt16LE(date, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBytes.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
        locals.push(local, nameBytes, body); centrals.push(central, nameBytes);
        offset += local.length + nameBytes.length + body.length;
    }
    const directory = Buffer.concat(centrals), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
    return Buffer.concat([...locals, directory, end]);
}

/** ZIP 바이트 → [{ name, data }] (중앙 디렉터리 순). 시험 · --check 용 작은 읽기 (zip64 · 암호 없음) */
export function readZip(buffer) {
    let end = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
    if (end < 0) throw Error('ZIP 끝 표시가 없어요');
    const count = buffer.readUInt16LE(end + 10), start = buffer.readUInt32LE(end + 16);
    const out = []; let p = start;
    for (let i = 0; i < count; i++) {
        if (buffer.readUInt32LE(p) !== 0x02014b50) throw Error('중앙 디렉터리가 깨졌어요');
        const method = buffer.readUInt16LE(p + 10), crc = buffer.readUInt32LE(p + 16), packedSize = buffer.readUInt32LE(p + 20), size = buffer.readUInt32LE(p + 24);
        const nameLength = buffer.readUInt16LE(p + 28), extraLength = buffer.readUInt16LE(p + 30), commentLength = buffer.readUInt16LE(p + 32), local = buffer.readUInt32LE(p + 42);
        const name = buffer.subarray(p + 46, p + 46 + nameLength).toString('utf8');
        const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
        const body = buffer.subarray(dataStart, dataStart + packedSize);
        const data = method === 8 ? inflateRawSync(body) : method === 0 ? Buffer.from(body) : (() => { throw Error('지원하지 않는 압축 방식: ' + method); })();
        if (data.length !== size || crc32(data) !== crc) throw Error('항목이 깨졌어요: ' + name);
        out.push({ name, data, method, time: buffer.readUInt16LE(p + 12), date: buffer.readUInt16LE(p + 14) });
        p += 46 + nameLength + extraLength + commentLength;
    }
    return out;
}

const dosStamp = unixSeconds => {
    const d = new Date(unixSeconds * 1000);
    return { time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1), date: ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate() };
};

export function sourceOf(root) { return JSON.parse(fs.readFileSync(path.join(root, 'src/addons/prompt-template/SOURCE.json'), 'utf8')); }

/** 담긴 ZIP 이 SOURCE.json 과 맞는지 — 맞으면 { files, bytes } 를 돌려주고 아니면 던진다 */
export function check(root) {
    const dir = path.join(root, 'src/addons/prompt-template'), source = sourceOf(root);
    const zip = fs.readFileSync(path.join(dir, source.zip));
    if (sha(zip) !== source.zipSha256 || zip.length !== source.zipBytes) throw Error('ZIP 바이트가 SOURCE.json 과 달라요');
    const entries = readZip(zip);
    const want = new Map(source.files.map(f => [`${FOLDER}/${f.path}`, f]));
    if (entries.length !== want.size) throw Error(`항목 수 ${entries.length} ≠ SOURCE.json ${want.size}`);
    for (const { name, data } of entries) {
        const f = want.get(name);
        if (!f) throw Error('SOURCE.json 에 없는 항목: ' + name);
        if (data.length !== f.bytes || sha(data) !== f.sha256) throw Error('내용이 달라요: ' + name);
        if (EXCLUDE.some(re => re.test(f.path))) throw Error('빼야 하는 파일이 들어 있어요: ' + name);
    }
    const manifest = JSON.parse(entries.find(e => e.name === `${FOLDER}/manifest.json`).data.toString('utf8'));
    if (manifest.version !== source.version || manifest.display_name !== source.display_name) throw Error('manifest 판 · 이름이 SOURCE.json 과 달라요');
    const license = entries.find(e => e.name === `${FOLDER}/LICENSE`)?.data;
    if (!license || !license.equals(fs.readFileSync(path.join(dir, 'LICENSE')))) throw Error('애드온 폴더의 LICENSE 가 ZIP 안 원본 LICENSE 와 달라요');
    return { files: entries.length, bytes: entries.reduce((n, e) => n + e.data.length, 0) };
}

export function build(upstream, root) {
    const git = (...args) => execFileSync('git', ['-C', upstream, ...args], { encoding: 'utf8' }).trim();
    if (git('status', '--porcelain')) throw Error('원본 작업 트리가 깨끗하지 않아요 — 커밋 그대로여야 담을 수 있어요');
    const commit = git('rev-parse', 'HEAD'), commitDate = git('log', '-1', '--format=%cI'), unix = Number(git('log', '-1', '--format=%ct'));
    const names = git('ls-files', '-z').split('\0').filter(Boolean).filter(n => !EXCLUDE.some(re => re.test(n))).sort();
    const files = names.map(name => {
        const data = fs.readFileSync(path.join(upstream, name));
        if (fs.lstatSync(path.join(upstream, name)).isSymbolicLink()) throw Error('링크 파일은 담지 않아요: ' + name);
        return { path: name, bytes: data.length, sha256: sha(data), data };
    });
    const manifest = JSON.parse(files.find(f => f.path === 'manifest.json').data.toString('utf8'));
    const zip = buildZip(files.map(f => ({ name: `${FOLDER}/${f.path}`, data: f.data })), dosStamp(unix));
    const dir = path.join(root, 'src/addons/prompt-template');
    fs.mkdirSync(dir, { recursive: true });
    const zipName = `${FOLDER}.zip`;
    fs.writeFileSync(path.join(dir, zipName), zip);
    fs.writeFileSync(path.join(dir, 'LICENSE'), files.find(f => f.path === 'LICENSE').data);
    const source = {
        upstream: UPSTREAM, folder: FOLDER, commit, commitDate, version: manifest.version, display_name: manifest.display_name, license: 'AGPL-3.0',
        excluded: ['.git/**', '**/*.map'], zip: zipName, zipBytes: zip.length, zipSha256: sha(zip), fileCount: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0),
        files: files.map(({ path: p, bytes, sha256 }) => ({ path: p, bytes, sha256 })),
    };
    fs.writeFileSync(path.join(dir, 'SOURCE.json'), JSON.stringify(source, null, 1) + '\n');
    return source;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args[0] === '--check') {
        const result = check(path.resolve(args[1] || '.'));
        console.log(`담긴 ZIP 확인: 파일 ${result.files}개 · 풀면 ${result.bytes} B`);
    } else {
        if (!args[0]) { console.error('사용: node tools/prompt-template-bundle.mjs <원본 체크아웃> [테마 루트] | --check [테마 루트]'); process.exit(2); }
        const source = build(path.resolve(args[0]), path.resolve(args[1] || '.'));
        console.log(`ZIP 만듦: ${source.folder} ${source.version} @ ${source.commit.slice(0, 12)} · 파일 ${source.fileCount}개 · ${source.zipBytes} B · sha256 ${source.zipSha256}`);
    }
}
