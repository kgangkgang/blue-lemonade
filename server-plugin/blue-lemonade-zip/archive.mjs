// ZIP parsing is separate from disk writes. No archive code or install hooks run here.
export const LIMITS = Object.freeze({ zip: 64 * 1024 ** 2, expanded: 128 * 1024 ** 2, file: 32 * 1024 ** 2, entries: 8000 });
export class ZipError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function safePath(value) {
    if (typeof value !== 'string' || !value || value.length > 220 || value !== value.normalize('NFC')) throw new ZipError('지원하지 않는 파일 이름이에요.');
    const name = value.replaceAll('\\', '/');
    if (name.startsWith('/') || /[\x00-\x1f\x7f<>:"|?*]/.test(name)) throw new ZipError('압축 안에 안전하지 않은 경로가 있어요.');
    const parts = name.split('/');
    if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(p))) throw new ZipError('압축 안에 안전하지 않은 파일 이름이 있어요.');
    if (parts.some(p => p.toLowerCase() === '.git')) throw new ZipError('.git 폴더를 제외하고 다시 압축해 주세요.');
    return name;
}
export function folderName(value) {
    const name = safePath(value);
    if (name.includes('/') || name.startsWith('.') || name.length > 100) throw new ZipError('설치 폴더 이름을 확인해 주세요.');
    return name;
}
const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); return n >>> 0; });
function crc32(buffer) { let crc = 0xffffffff; for (const b of buffer) crc = (crc >>> 8) ^ table[(crc ^ b) & 255]; return (crc ^ 0xffffffff) >>> 0; }
export function manifestOf(buffer, files) {
    let m;
    try { m = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')); } catch { throw new ZipError('manifest.json을 읽을 수 없어요.'); }
    if (!m || Array.isArray(m) || typeof m.display_name !== 'string' || !m.display_name.trim() || m.display_name.length > 160) throw new ZipError('실리태번 확장 manifest.json이 아니에요.');
    if (typeof m.version !== 'string' || m.version.length > 80) throw new ZipError('확장 버전이 없거나 올바르지 않아요.');
    if (!m.js && !m.css) throw new ZipError('설치할 JS 또는 CSS 파일이 없어요.');
    for (const key of ['js', 'css']) if (m[key]) {
        const name = safePath(m[key]);
        if (!files.has(name)) throw new ZipError(`manifest.json에 적힌 ${key} 파일이 없어요.`);
    }
    return { display_name: m.display_name.trim(), version: m.version, author: typeof m.author === 'string' ? m.author.slice(0, 160) : '', homePage: typeof m.homePage === 'string' ? m.homePage.slice(0, 500) : '' };
}
export async function readArchive(buffer, yauzl) {
    if (!Buffer.isBuffer(buffer) || buffer.length > LIMITS.zip) throw new ZipError('ZIP은 64MB까지 넣을 수 있어요.', 413);
    return new Promise((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, decodeStrings: true, strictFileNames: false }, (error, zip) => {
            if (error) return reject(new ZipError('ZIP을 읽지 못했어요. 파일을 다시 확인해 주세요.'));
            let done = false, count = 0, size = 0;
            const entries = new Map(), seen = new Map();
            const fail = e => { if (done) return; done = true; zip.close(); reject(e instanceof ZipError ? e : new ZipError('손상되었거나 지원하지 않는 ZIP이에요.')); };
            zip.on('error', fail);
            zip.on('entry', entry => {
                try {
                    if (++count > LIMITS.entries) throw new ZipError('ZIP 안의 항목이 8,000개를 넘어요.');
                    const dir = entry.fileName.endsWith('/');
                    const name = safePath(dir ? entry.fileName.slice(0, -1) : entry.fileName);
                    const type = (entry.externalFileAttributes >>> 16) & 0xf000;
                    if (type && type !== 0x8000 && type !== 0x4000) throw new ZipError('링크나 특수 파일은 설치할 수 없어요.');
                    if ((type === 0x4000) !== dir && type) throw new ZipError('파일과 폴더 정보가 맞지 않아요.');
                    if (entry.generalPurposeBitFlag & 1) throw new ZipError('암호 없는 ZIP으로 다시 압축해 주세요.');
                    const lower = name.toLowerCase();
                    if (seen.has(lower)) throw new ZipError('이름이 겹치는 파일이 있어요. 대소문자도 구분하지 않아요.');
                    seen.set(lower, dir);
                    if (dir) { zip.readEntry(); return; }
                    size += entry.uncompressedSize;
                    if (entry.uncompressedSize > LIMITS.file || size > LIMITS.expanded) throw new ZipError('압축을 푼 크기가 너무 커요. 전체 128MB, 파일 하나 32MB까지 가능해요.', 413);
                    zip.openReadStream(entry, (err, stream) => {
                        if (err) return fail(err);
                        const chunks = []; let read = 0;
                        stream.on('error', fail);
                        stream.on('data', chunk => { read += chunk.length; if (read > entry.uncompressedSize || read > LIMITS.file) { stream.destroy(); fail(new ZipError('압축 크기 정보가 맞지 않아요.')); } else chunks.push(chunk); });
                        stream.on('end', () => {
                            if (done) return;
                            const data = Buffer.concat(chunks);
                            if (data.length !== entry.uncompressedSize || crc32(data) !== entry.crc32) return fail(new ZipError('ZIP 파일이 손상되었어요. 다시 받아 주세요.'));
                            entries.set(name, data); zip.readEntry();
                        });
                    });
                } catch (e) { fail(e); }
            });
            zip.on('end', () => {
                try {
                    if (done) return;
                    for (const name of seen.keys()) {
                        const parts = name.split('/'); parts.pop();
                        while (parts.length) { if (seen.get(parts.join('/')) === false) throw new ZipError('파일과 폴더의 이름이 겹쳐요.'); parts.pop(); }
                    }
                    const candidates = [...entries.keys()].filter(n => /(^|\/)manifest\.json$/.test(n));
                    // Pick the outermost manifest. Bundled addons may contain their own manifests.
                    const outer = candidates.filter(n => !candidates.some(p => p !== n && n.startsWith(p.slice(0, -13))));
                    if (outer.length !== 1) throw new ZipError('한 확장만 들어 있는 ZIP을 골라 주세요. manifest.json을 하나로 구분하지 못했어요.');
                    const prefix = outer[0].slice(0, -13), files = new Map();
                    for (const [name, data] of entries) if (name.startsWith(prefix)) files.set(name.slice(prefix.length), data);
                    const manifest = manifestOf(files.get('manifest.json'), files);
                    done = true; resolve({ files, manifest, size: [...files.values()].reduce((n, b) => n + b.length, 0), root: prefix.split('/').filter(Boolean).at(-1) || '' });
                } catch (e) { fail(e); }
            });
            zip.readEntry();
        });
    });
}
