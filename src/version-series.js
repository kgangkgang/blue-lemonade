// 판 계열(series): 공개 부활판부터 판 번호를 1.0.0 으로 다시 시작해요(옛 계열 마지막 판 8.2.5).
//   판 문자열(manifest 의 "version")은 그대로 「1.0.0」 — 실리태번과 다른 도구가 읽어요. 계열은 manifest 의 따로 칸 "bl_series" 에 적어요.
//   칸이 없는 manifest · 옛 기록은 계열 1(8.2.5 이하)이에요. 비교는 언제나 (계열, 판) 짝으로 해요: 8.2.5(계열 1) < 1.0.0(계열 2) < 1.0.1 < 1.1.0.
//   화면 코드가 씀: 공지 창 · 판 알약의 「안 본 공지」(src/notice.js — 저장값 noticeSeen 은 releaseString) · 새 판 확인(src/update-check.js — 원격 manifest 의 bl_series 도 읽음).
//   공지 데이터 · release-notes 의 항목은 계열 2 부터 series 칸을 달아요(없으면 계열 1).
//   도구 쪽 입구는 tools/version-series.mjs(이 파일을 그대로 다시 내보냄). 자동화 쪽 같은 규칙: automation lib/version-series.mjs.

export const SERIES_KEY = 'bl_series';
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const TAGGED = /^s(\d+):(\d+\.\d+\.\d+)$/;

/** manifest(또는 { version, bl_series }) 의 계열 — 칸이 없거나 이상하면 1 */
export function seriesOf(manifest) {
    const n = manifest && typeof manifest === 'object' ? manifest[SERIES_KEY] : undefined;
    return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** '8.2.5' · 's2:1.0.0' · { version, series } · manifest → { series, version, parts } (모양이 아니면 null) */
export function parseRelease(value) {
    let series = 1, version = '';
    if (typeof value === 'string') {
        const t = TAGGED.exec(value.trim());
        if (t) { series = Number(t[1]); version = t[2]; } else version = value.trim();
    } else if (value && typeof value === 'object') {
        version = String(value.version ?? '').trim();
        series = Number.isInteger(value.series) && value.series >= 1 ? value.series : seriesOf(value);
    } else return null;
    const m = SEMVER.exec(version);
    if (!m || series < 1) return null;
    return { series, version, parts: m.slice(1).map(Number) };
}

/** 저장 · 표시용 한 줄: 계열 1 은 맨 판('8.2.5'), 계열 2 부터 's2:1.0.0' (옛 값과 섞여도 뜻이 안 바뀌어요) */
export function releaseString(value) {
    const r = parseRelease(value);
    if (!r) return '';
    return r.series === 1 ? r.version : `s${r.series}:${r.version}`;
}

/** (계열, 판) 비교: a 가 새것이면 양수 · 같으면 0 · 옛것이면 음수. 못 읽는 값은 가장 옛것 */
export function compareRelease(a, b) {
    const x = parseRelease(a), y = parseRelease(b);
    if (!x || !y) return (x ? 1 : 0) - (y ? 1 : 0);
    if (x.series !== y.series) return x.series - y.series;
    for (let i = 0; i < 3; i++) if (x.parts[i] !== y.parts[i]) return x.parts[i] - y.parts[i];
    return 0;
}

export const isNewerRelease = (a, b) => compareRelease(a, b) > 0;
