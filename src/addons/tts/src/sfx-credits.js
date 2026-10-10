// User-supplied attribution is preserved as data, never treated as verified licensing.
// This module is independent of settings so normalization cannot create an import cycle.
const record = value => !!value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value, limit) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit) : '';
export const sfxSha256 = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value) ? value.toLowerCase() : '';
export function sfxCreditUrl(value) {
    if (typeof value !== 'string' || value.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(value)) return '';
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
}
export function normalizeSfxCredit(value) {
    if (!record(value)) return null;
    const credit = {};
    for (const [key, limit] of Object.entries({ name: 160, author: 240, license: 120, modifications: 1000, encoding: 120 })) {
        const clean = text(key === 'modifications' ? value.modifications ?? value.changes : value[key], limit);
        if (clean) credit[key] = clean;
    }
    for (const key of ['source', 'licenseUrl', 'licenseEvidence', 'downloadUrl']) {
        const clean = sfxCreditUrl(value[key]); if (clean) credit[key] = clean;
    }
    const fileName = text(value.fileName, 180).split(/[\\/]/).pop();
    if (fileName) credit.fileName = fileName;
    for (const key of ['sha256', 'sourceSha256']) { const clean = sfxSha256(value[key]); if (clean) credit[key] = clean; }
    if (typeof value.retrieved === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.retrieved) && Number.isFinite(Date.parse(value.retrieved))) credit.retrieved = value.retrieved;
    for (const [key, min, max] of [['excerptStart', 0, 86400], ['excerptSeconds', 0.001, 3600], ['fadeInSeconds', 0, 60], ['fadeOutSeconds', 0, 60], ['gainDb', -120, 60], ['bytes', 1, 16777216]]) {
        const number = value[key];
        if (typeof number === 'number' && Number.isFinite(number) && number >= min && number <= max && (key !== 'bytes' || Number.isSafeInteger(number))) credit[key] = number;
    }
    return Object.keys(credit).length ? credit : null;
}
/** Legacy global credits are joined only by one exact original name + computed audio hash. */
export function importedSfxCredit(item, legacyCredits, actualSha256) {
    if (!record(item)) return null;
    const actual = sfxSha256(actualSha256);
    if (record(item.credit)) {
        if ('sha256' in item.credit && (!actual || sfxSha256(item.credit.sha256) !== actual)) return null;
        return normalizeSfxCredit(item.credit);
    }
    if (!actual || !Array.isArray(legacyCredits) || legacyCredits.length > 64) return null;
    const matches = legacyCredits.filter(credit => record(credit) && credit.name === item.name && sfxSha256(credit.sha256) === actual);
    return matches.length === 1 ? normalizeSfxCredit(matches[0]) : null;
}
export function sfxCreditChanges(value) {
    const c = normalizeSfxCredit(value); if (!c) return '';
    if (c.modifications) return c.modifications;
    const changes = [];
    if (c.excerptStart != null || c.excerptSeconds != null) changes.push(`발췌${c.excerptStart != null ? ` 시작 ${c.excerptStart}초` : ''}${c.excerptSeconds != null ? ` · 길이 ${c.excerptSeconds}초` : ''}`);
    if (c.gainDb != null) changes.push(`음량 ${c.gainDb} dB`);
    if (c.fadeInSeconds != null) changes.push(`페이드 인 ${c.fadeInSeconds}초`);
    if (c.fadeOutSeconds != null) changes.push(`페이드 아웃 ${c.fadeOutSeconds}초`);
    if (c.encoding) changes.push(c.encoding);
    return changes.join(', ');
}
export function customSfxAttribution(row) {
    const c = normalizeSfxCredit(row.credit);
    const lines = [row.name, '사용자가 추가한 음원 · 제공된 출처 정보 (라이선스 별도 검증 안 함)'];
    if (!c) lines.push('원작자·출처·라이선스 정보 없음');
    else {
        if (c.name && c.name !== row.name) lines.push(`원본 이름: ${c.name}`);
        lines.push(`원작자: ${c.author || '정보 없음'}`, `라이선스: ${c.license || '정보 없음'}`);
        if (c.source) lines.push(`출처: ${c.source}`);
        if (c.fileName) lines.push(`원본 파일: ${c.fileName}`);
        if (c.licenseUrl) lines.push(`라이선스 주소: ${c.licenseUrl}`);
        if (c.licenseEvidence) lines.push(`라이선스 안내: ${c.licenseEvidence}`);
        const changes = sfxCreditChanges(c); if (changes) lines.push(`제공된 음원 변경 내역: ${changes}`);
    }
    lines.push('재생·내보내기 변경: 대본 설정에 따라 반복/길이 조절·믹싱');
    return lines.join('\n') + '\n';
}
/** DOM nodes use textContent; no imported content is inserted as HTML. */
export function sfxCreditElement(sound) {
    const c = normalizeSfxCredit(sound.credit);
    if (!c && !sound.custom) return null;
    const box = document.createElement(sound.custom ? 'details' : 'span'); box.className = 'lvs-sound-credit';
    const addText = (tag, value) => { const node = document.createElement(tag); node.textContent = value; box.append(node); return node; };
    if (sound.custom) {
        addText('summary', c ? '출처 · 라이선스 보기' : '출처 정보 없음');
        addText('span', '사용자가 제공한 정보 · 라이선스 별도 검증 안 함');
    }
    if (!c) return box;
    if (c.name && c.name !== sound.name) addText('span', `원본 이름: ${c.name}`);
    addText('span', [c.author || (sound.custom ? '원작자 정보 없음' : ''), c.license || (sound.custom ? '라이선스 정보 없음' : '')].filter(Boolean).join(' · '));
    const links = document.createElement('span');
    for (const [key, label] of [['source', '출처'], ['licenseUrl', '라이선스'], ['licenseEvidence', '이용 안내']]) {
        if (!c[key]) continue;
        const link = document.createElement('a'); link.textContent = label; link.href = c[key]; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `${sound.name} ${label}`); if (links.childNodes.length) links.append(document.createTextNode(' · ')); links.append(link);
    }
    if (links.childNodes.length) box.append(links);
    if (c.fileName) addText('span', `원본 파일: ${c.fileName}`);
    if (sound.custom) { const changes = sfxCreditChanges(c); if (changes) addText('span', `변경: ${changes}`); }
    return box;
}
