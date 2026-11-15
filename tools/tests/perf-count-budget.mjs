// 1.5.1 최적화 캠페인 — 세는 값 상한(다시 느려지지 않게 막는 장치).
//   시간(ms)은 PC 가 바쁘면 흔들리지만, 장면마다 「세는 값」(스타일 재계산 횟수 · 재계산 요소 합 · 선택자 견줌 수 · 50ms 넘는 긴 작업 수 ·
//   첫 화면 전 테마 모듈 수 · 바이트)은 거의 안 흔들려요. 그 값을 tools/perf-count-budget.json 의 상한과 견줘요.
//   · 상한은 v1.5.0 실측(같은 판을 세 번 재서 가장 큰 값) + 흔들림 몫(약 3%)으로 시작했고, 캠페인이 줄일 때마다 **내리기만** 해요. 올리는 것은 사람이 정해요(까닭을 json 에).
//   · 지표: 재계산 횟수 · 요소 · 견줌 · 긴 작업 수 · 합(추적 켬 · 부풂) · (부팅) 첫 화면 전 모듈 · (큰 카드 열기 · 생성 스트리밍) 페이지 안 긴 작업 수 · 합 · 늦은 프레임 25+ · 50+.
//   · mode 가 "warn" 이면 넘어도 알림만(종료 코드 0) · "block" 이면 실패(1). 지금은 warn — 캠페인 끝에 조정자가 block 으로 켜요.
//   쓰는 법:
//     node tools/tests/perf-count-budget.mjs                         json 모양만 확인(리그 없이 · 공개 CI 에서도 돌아요)
//     node tools/tests/perf-count-budget.mjs --from <count.json> [--variant 이름]
//        count.json = 측정 폴더 도구(opt-score)의 `node score.mjs count <판> --scene boot,chatShort,chatLong300,settingsST,stream,typing --cond phone|pc` 결과
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const budgetFile = path.resolve(here, '..', 'perf-count-budget.json');
const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const B = JSON.parse(fs.readFileSync(budgetFile, 'utf8'));

/** 장면 결과(count.json 의 scenes[장면])에서 지표 값 꺼내기 — 이름은 json 의 열쇠와 같아요 */
export const METRICS = {
    'recalc.count': r => r?.recalc?.count,
    'recalc.elements': r => r?.recalc?.elements,
    'selector.attempts': r => r?.selector?.attempts,
    'longTasks.count': r => r?.longTasks?.count,
    'longTasks.ms': r => r?.longTasks?.ms == null ? undefined : Math.round(r.longTasks.ms),   // 추적 켠 채 잰 합(부풂) — 같은 도구끼리만 견줘요
    'page.longTasks': r => r?.lt,                       // 페이지 안 longtask 관찰(큰 카드 열기 · 생성 스트리밍 장면)
    'page.longTaskMs': r => r?.ltSum == null ? undefined : Math.round(r.ltSum),
    'page.lateFrames25': r => r?.late25,               // 생성 스트리밍: 25ms 넘은 프레임 수
    'page.lateFrames50': r => r?.late50,
    'startup.modulesBeforeFirst': r => r?.startup?.modulesBeforeFirst,
    'startup.bytesBeforeFirst': r => r?.startup?.bytesBeforeFirst,
};
const median = a => { const v = a.filter(x => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

/** 순수: 상한 표 · 결과 줄 → [{ cond, scene, metric, now, max, over }] */
export function judge(budget, runs, { variant = null } = {}) {
    const out = [];
    for (const [cond, scenes] of Object.entries(budget.conds || {})) {
        const R = runs.filter(r => r.scenes && r.cond === cond && (!variant || r.variant === variant));
        if (!R.length) continue;
        for (const [scene, lim] of Object.entries(scenes)) for (const [metric, max] of Object.entries(lim)) {
            if (metric.startsWith('_')) continue;
            const now = median(R.map(r => METRICS[metric]?.(r.scenes[scene])));
            out.push({ cond, scene, metric, now, max, over: now != null && now > max, missing: now == null });
        }
    }
    return out;
}

let failed = 0;
// ① 모양(늘 돌아요)
try {
    assert.ok(['warn', 'block'].includes(B.mode), 'mode 는 warn 또는 block');
    assert.ok(B.conds && typeof B.conds === 'object', 'conds 가 있어야 해요');
    for (const [cond, scenes] of Object.entries(B.conds)) {
        assert.ok(/^(phone|pc)(@cpu[\d.]+)?$/.test(cond), `조건 ${cond}`);   // phone@cpu1 = 폰 화면 · CPU 1배(실제 폰에 맞춘 값)
        for (const [scene, lim] of Object.entries(scenes)) for (const [metric, max] of Object.entries(lim)) {
            if (metric.startsWith('_')) continue;
            assert.ok(METRICS[metric], `${cond}/${scene}: 모르는 지표 ${metric}`);
            assert.ok(Number.isInteger(max) && max >= 0, `${cond}/${scene}/${metric}: 상한은 0 이상 정수`);
        }
    }
    // 순수 판정 자체 시험
    const t = judge({ conds: { phone: { boot: { 'recalc.count': 10 } } } }, [{ cond: 'phone', variant: 'x', scenes: { boot: { recalc: { count: 11 } } } }, { cond: 'phone', variant: 'x', scenes: { boot: { recalc: { count: 9 } } } }, { cond: 'phone', variant: 'x', scenes: { boot: { recalc: { count: 12 } } } }]);
    assert.equal(t[0].now, 11); assert.equal(t[0].over, true);
    console.log(`ok 세는 값 상한 모양(${B.mode} · 조건 ${Object.keys(B.conds).join(', ')})`);
} catch (e) { failed++; console.error('FAIL 세는 값 상한 모양\n' + (e.stack || e)); }

// ② 견주기(--from 이 있을 때만)
const from = arg('--from');
if (from) {
    const data = JSON.parse(fs.readFileSync(path.resolve(from), 'utf8'));
    const variant = arg('--variant') || data.variants?.find(v => v.name !== 'vanilla')?.name || null;
    const rows = judge(B, (data.runs || []).map(r => ({ ...r, cond: r.cond || data.cond })), { variant });
    const over = rows.filter(r => r.over);
    for (const r of rows) console.log(`${r.over ? (B.mode === 'block' ? 'FAIL' : '알림') : r.missing ? '못 잼' : 'ok'} ${r.cond}/${r.scene} ${r.metric}: ${r.now ?? '—'} / 상한 ${r.max}${r.over ? ` (+${((r.now - r.max) / r.max * 100).toFixed(1)}%)` : ''}`);
    console.log(`판 ${variant}: 상한 넘음 ${over.length} / ${rows.length}${over.length && B.mode === 'warn' ? ' — 지금은 알림만(막지 않음)' : ''}`);
    if (over.length && B.mode === 'block') failed++;
    const lower = rows.filter(r => !r.over && r.now != null && r.now < r.max * 0.9);
    if (lower.length) console.log(`내릴 수 있는 상한 ${lower.length}개(지금 값이 상한보다 10% 넘게 낮음): ${lower.map(r => `${r.cond}/${r.scene}/${r.metric} ${r.now}<${r.max}`).join(' · ')}`);
}
process.exit(failed ? 1 : 0);
