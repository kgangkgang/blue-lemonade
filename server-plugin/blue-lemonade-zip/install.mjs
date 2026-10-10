import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { folderName, ZipError } from './archive.mjs';

const exists = async p => { try { return await fs.lstat(p); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const hash = b => createHash('sha256').update(b).digest('hex');
const key = s => s.toLowerCase().normalize('NFC');
async function writeRecord(box, record) {
    const temporary = path.join(box, `record-${randomUUID()}.tmp`);
    try { await fs.writeFile(temporary, JSON.stringify(record), { flag: 'wx' }); await fs.rename(temporary, path.join(box, 'record.json')); }
    finally { await fs.unlink(temporary).catch(() => {}); }
}
export async function safeDirectory(dir) {
    const absolute = path.resolve(dir), parsed = path.parse(absolute);
    let current = parsed.root;
    for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        const stat = await fs.lstat(current);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ZipError('설치 경로에 링크가 있어요. 일반 폴더에서만 설치할 수 있어요.');
    }
    return absolute;
}
async function snapshot(dir) {
    if (!await exists(dir)) return null;
    await safeDirectory(dir);
    const files = new Map(), dirs = [], digest = createHash('sha256'); let bytes = 0, count = 0;
    async function walk(root, rel = '') {
        const names = (await fs.readdir(root)).sort(), cases = new Set();
        for (const name of names) {
            if (cases.has(key(name))) throw new ZipError('기존 폴더에 대소문자만 다른 파일이 있어요.');
            cases.add(key(name));
            const sub = path.join(root, name), relative = rel ? `${rel}/${name}` : name, stat = await fs.lstat(sub);
            if (++count > 20000 || stat.isSymbolicLink()) throw new ZipError('기존 확장에 링크가 있거나 파일 수가 너무 많아요.');
            if (stat.isDirectory()) { dirs.push(relative); digest.update(`d:${relative}\0`); await walk(sub, relative); }
            else if (stat.isFile()) {
                bytes += stat.size;
                if (bytes > 512 * 1024 ** 2) throw new ZipError('기존 확장이 512MB를 넘어요. 큰 데이터는 따로 보관한 뒤 진행해 주세요.');
                const h = hash(await fs.readFile(sub)); files.set(relative, { hash: h, size: stat.size }); digest.update(`f:${relative}\0${h}\0`);
            } else throw new ZipError('기존 확장에 특수 파일이 있어요.');
        }
    }
    await walk(dir); return { files, dirs, bytes, digest: digest.digest('hex') };
}
async function manifest(dir) {
    try { const stat = await fs.lstat(path.join(dir, 'manifest.json')); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) return null; const m = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8')); return typeof m.display_name === 'string' ? { display_name: m.display_name.slice(0, 160), version: String(m.version || '?').slice(0, 80), homePage: String(m.homePage || '').slice(0, 500) } : null; } catch { return null; }
}
const repo = m => { try { const u = new URL(m.homePage); return u.hostname.toLowerCase() === 'github.com' ? u.pathname.replace(/\.git$|\/$/g, '').toLowerCase() : ''; } catch { return ''; } };
export class Installer {
    constructor({ yauzl, readArchive, beforePublish } = {}) { this.yauzl = yauzl; this.readArchive = readArchive; this.beforePublish = beforePublish; this.plans = new Map(); this.locks = new Set(); }
    async locked(base, run) {
        base = path.resolve(base);
        if (this.locks.has(base)) throw new ZipError('다른 설치가 진행 중이에요. 잠시 후 다시 눌러 주세요.', 409);
        this.locks.add(base); try { return await run(); } finally { this.locks.delete(base); }
    }
    async prepare(base) {
        base = await safeDirectory(base);
        const vault = path.join(path.dirname(base), '.blue-lemonade-zip');
        await fs.mkdir(vault, { recursive: true }); await safeDirectory(vault);
        // A crash between the two renames must leave a recoverable original.
        for (const id of await fs.readdir(vault)) {
            if (!/^[a-f0-9-]{36}$/.test(id)) continue;
            const box = path.join(vault, id); await safeDirectory(box);
            const record = await this.record(box);
            if (!record?.pending) continue;
            const target = path.join(base, folderName(record.folder)), original = path.join(box, 'files');
            if (await exists(original)) {
                await safeDirectory(original);
                if (!await exists(target)) { await fs.rename(original, target); record.recovered = true; }
                record.pending = false; await writeRecord(box, record);
            }
        }
        return { base, vault };
    }
    async record(box) { try { const stat = await fs.lstat(path.join(box, 'record.json')); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) return null; return JSON.parse(await fs.readFile(path.join(box, 'record.json'), 'utf8')); } catch { return null; } }
    async installed(base) {
        await safeDirectory(base); const list = [];
        for (const entry of await fs.readdir(base, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
            try { folderName(entry.name); } catch { continue; }
            const m = await manifest(path.join(base, entry.name)); if (m) list.push({ folder: entry.name, ...m });
        }
        return list;
    }
    async inspect(base, owner, buffer, filename) {
        return this.locked(base, async () => {
            await this.prepare(base);
            for (const [id, p] of this.plans) if (Date.now() > p.expires) this.plans.delete(id);
            // Bound retained uncompressed data across users; only the newest plan per owner is kept.
            for (const [id, p] of this.plans) if (p.owner === owner && p.base === path.resolve(base)) this.plans.delete(id);
            if (this.plans.size >= 2) throw new ZipError('다른 ZIP을 확인 중이에요. 잠시 후 다시 시도해 주세요.', 429);
            const archive = await this.readArchive(buffer, this.yauzl), list = await this.installed(base);
            let suggested = archive.root || String(filename || 'extension.zip').replace(/\.zip$/i, '');
            suggested = suggested.replace(/-(main|master|v?\d[\w.-]*)$/i, '');
            try { folderName(suggested); } catch { suggested = 'my-extension'; }
            const matches = list.filter(m => (repo(m) && repo(m) === repo(archive.manifest)) || m.display_name === archive.manifest.display_name || key(m.folder) === key(suggested));
            const token = randomUUID();
            this.plans.set(token, { owner, base: path.resolve(base), archive, expires: Date.now() + 10 * 60 * 1000 });
            const expiry = setTimeout(() => this.plans.delete(token), 10 * 60 * 1000); expiry.unref();
            return { token, manifest: archive.manifest, count: archive.files.size, bytes: archive.size, suggested, matches, installed: list, expiresIn: 600 };
        });
    }
    async preview(base, owner, token, folder) {
        return this.locked(base, async () => {
            await this.prepare(base); const p = this.plan(base, owner, token); folder = folderName(folder);
            const actual = (await fs.readdir(base)).find(n => key(n) === key(folder));
            if (actual && actual !== folder) throw new ZipError(`기존 폴더 이름 그대로 골라 주세요: ${actual}`);
            const old = await snapshot(path.join(base, folder));
            if (old && !await manifest(path.join(base, folder))) throw new ZipError('기존 폴더가 실리태번 확장이 아니어서 덮어쓸 수 없어요.');
            this.checkOverlay(p.archive.files, old);
            p.selection = { folder, digest: old?.digest ?? null };
            const replaced = [...p.archive.files.keys()].filter(n => old?.files.has(n)).length;
            return { folder, current: old ? await manifest(path.join(base, folder)) : null, incoming: p.archive.manifest, files: p.archive.files.size, replaced, kept: old ? old.files.size - replaced : 0, backupBytes: old?.bytes || 0 };
        });
    }
    plan(base, owner, token) {
        const p = this.plans.get(token);
        if (!p || p.owner !== owner || p.base !== path.resolve(base) || p.expires < Date.now()) throw new ZipError('확인 시간이 지났어요. ZIP을 다시 골라 주세요.', 409);
        return p;
    }
    checkOverlay(files, old) {
        const all = new Map();
        for (const n of old?.dirs || []) all.set(key(n), { name: n, dir: true });
        for (const n of old?.files.keys() || []) all.set(key(n), { name: n, dir: false });
        for (const n of files.keys()) {
            const parts = n.split('/');
            for (let i = 1; i <= parts.length; i++) {
                const sub = parts.slice(0, i).join('/'), dir = i < parts.length, found = all.get(key(sub));
                if (found && (found.name !== sub || found.dir !== dir)) throw new ZipError('기존 파일과 이름 또는 폴더 구조가 충돌해요. 별도 폴더에 설치해 주세요.');
                all.set(key(sub), { name: sub, dir });
            }
        }
    }
    async copyTree(source, stage, snap) {
        for (const dir of snap.dirs) await fs.mkdir(path.join(stage, dir), { recursive: true });
        for (const [name, item] of snap.files) {
            const sourcePath = path.join(source, name), stat = await fs.lstat(sourcePath);
            if (!stat.isFile() || stat.isSymbolicLink()) throw new ZipError('작업 중 파일이 바뀌었어요. 다시 확인해 주세요.', 409);
            const data = await fs.readFile(sourcePath);
            if (hash(data) !== item.hash) throw new ZipError('작업 중 파일이 바뀌었어요. 다시 확인해 주세요.', 409);
            await fs.writeFile(path.join(stage, name), data);
        }
    }
    async cleanStage(stage, vault) {
        // Only our flat staging tree is removed; user extension/backup trees are never deleted.
        if (path.dirname(stage) !== vault || !path.basename(stage).startsWith('stage-')) return;
        const snap = await snapshot(stage); if (!snap) return;
        for (const name of snap.files.keys()) await fs.unlink(path.join(stage, name));
        for (const name of snap.dirs.reverse()) await fs.rmdir(path.join(stage, name));
        await fs.rmdir(stage);
    }
    async publish(base, vault, folder, stage, old, action) {
        const target = path.join(base, folder);
        if ((await snapshot(target))?.digest !== old?.digest) throw new ZipError('확장 파일이 바뀌었어요. ZIP을 다시 확인해 주세요.', 409);
        let backup = null, moved = false;
        if (old) {
            backup = randomUUID(); const box = path.join(vault, backup);
            await fs.mkdir(box);
            await writeRecord(box, { folder, date: new Date().toISOString(), manifest: await manifest(target), bytes: old.bytes, action, pending: true });
            await fs.rename(target, path.join(box, 'files')); moved = true;
        }
        try {
            await this.beforePublish?.(); await fs.rename(stage, target);
        } catch (error) {
            if (moved && !await exists(target)) await fs.rename(path.join(vault, backup, 'files'), target);
            throw error;
        }
        // A pending journal with both folders present is finalized by prepare after a crash.
        if (backup) { const box = path.join(vault, backup), record = await this.record(box); record.pending = false; try { await writeRecord(box, record); } catch (e) { console.warn('[Blue Lemonade ZIP] Backup journal will be finalized on next access:', e.code); } }
        return { folder, backup, reload: true };
    }
    async install(base, owner, token) {
        return this.locked(base, async () => {
            const { vault } = await this.prepare(base), p = this.plan(base, owner, token);
            if (!p.selection) throw new ZipError('설치할 폴더를 먼저 확인해 주세요.');
            const { folder, digest } = p.selection, target = path.join(base, folder), old = await snapshot(target);
            if ((old?.digest ?? null) !== digest) throw new ZipError('확장 파일이 바뀌었어요. 설치 내용을 다시 확인해 주세요.', 409);
            this.checkOverlay(p.archive.files, old);
            const stage = path.join(vault, `stage-${randomUUID()}`); await fs.mkdir(stage);
            try {
                if (old) await this.copyTree(target, stage, old);
                for (const [name, data] of p.archive.files) { const out = path.join(stage, name); await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, data); }
                const result = await this.publish(base, vault, folder, stage, old, 'install'); this.plans.delete(token); return result;
            } finally { await this.cleanStage(stage, vault); }
        });
    }
    async backups(base) {
        return this.locked(base, async () => {
            const { vault } = await this.prepare(base), result = [];
            for (const id of await fs.readdir(vault)) if (/^[a-f0-9-]{36}$/.test(id)) {
                const box = path.join(vault, id), record = await this.record(box);
                if (record && await exists(path.join(box, 'files'))) result.push({ id, folder: folderName(record.folder), date: record.date, manifest: record.manifest, bytes: record.bytes });
            }
            return result.sort((a, b) => b.date.localeCompare(a.date));
        });
    }
    async restore(base, id) {
        return this.locked(base, async () => {
            if (!/^[a-f0-9-]{36}$/.test(id)) throw new ZipError('백업을 찾지 못했어요.');
            const { vault } = await this.prepare(base), box = path.join(vault, id), record = await this.record(box);
            if (!record) throw new ZipError('백업을 찾지 못했어요.');
            const folder = folderName(record.folder), source = path.join(box, 'files'), saved = await snapshot(source);
            if (!saved) throw new ZipError('백업 파일이 없어요.');
            const old = await snapshot(path.join(base, folder)), stage = path.join(vault, `stage-${randomUUID()}`); await fs.mkdir(stage);
            try { await this.copyTree(source, stage, saved); return await this.publish(base, vault, folder, stage, old, 'restore'); }
            finally { await this.cleanStage(stage, vault); }
        });
    }
}
