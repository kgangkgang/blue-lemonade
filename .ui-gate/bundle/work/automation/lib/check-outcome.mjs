// 검사 실행과 제품 판정을 분리해요. 준비 오류·미측정·부분 결과는 기준선으로 숨길 수 없어요.
// 10-29 waste-audit: count() 가 객체를 통째로 1로 세어 ui-lint 의 unmeasured:{contrast:0}(미측정 0건)이 「측정하지 못한 대상이 남았어요」가 됐어요
//   → int-824 에서 ui-lint 5종 × 3회 = 15번 종료 코드 2(각 3분) · 같은 리그의 다음 검사 10개가 「리그 오염 의심」으로 연쇄. 객체는 값을 더해 세요({contrast:0} → 0 · {contrast:3} → 3 · {} → 0).
const count = v => Array.isArray(v) ? v.length
 : typeof v === 'number' && Number.isFinite(v) ? Math.max(0,v)
 : v && typeof v === 'object' ? Object.values(v).reduce((n,x)=>n+count(x),0)
 : v ? 1 : 0;
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
export function completionProblems(result) {
 const problems=[];
 if(!object(result))return ['검사 결과가 객체가 아니에요'];
 if(!Array.isArray(result.fails))problems.push('검사 결과에 실패 배열이 없어요');
 else if(result.fails.some(f=>!object(f)||typeof f.key!=='string'||!f.key.trim()))problems.push('실패 항목의 식별자가 없어요');
 const info=object(result.info)?result.info:{};
 if(result.error)problems.push(String(result.error));
 if(count(result.errors)||count(info.errors)||count(info.errorCount))problems.push('검사 준비·실행 오류가 남았어요');
 if(count(info.unmeasured)||count(info.unexecuted)||count(info.missing)||count(info.missingScreens))problems.push('측정하지 못한 대상이 남았어요');
 if(Array.isArray(info.coverage)&&info.coverage.some(r=>r.error||r.incomplete||count(r.unmeasured)))problems.push('화면별 검사 범위가 미완료예요');
 if(info.editor&&(count(info.editor.errors)||count(info.editor.missing)||info.editor.complete===false))problems.push('편집기 검사 범위가 미완료예요');
 if(typeof result.total!=='number'||!Number.isFinite(result.total)||result.total<0)problems.push('측정 건수가 없거나 올바르지 않아요');
 else if(result.total===0){const expected=result.expectedEmpty===true||info.expectedEmpty===true,reason=result.emptyReason??info.emptyReason;if(!expected||typeof reason!=='string'||!reason.trim())problems.push('측정 0건의 예상 빈 대상 근거가 없어요');}
 if(Number.isFinite(info.expected)&&info.expected>result.total)problems.push(`예상 ${info.expected}건 중 ${result.total}건만 측정했어요`);
 return problems;
}
// 11-03 재정비 B — 종료 코드 규칙(AUTOMATION.md 「종료 코드 규칙」): 리그 검사 스크립트는 결과 json 을 쓰고 이 셋 중 하나로 끝나요(checks/rig/lib.mjs emit 이 정함).
//   0 통과(다 잼 · 실패 0) · 1 실패(다 잼 · fails 있음) · 2 미완료(결과는 썼지만 다 못 잼 — result.incomplete:true · 사유는 completionProblems · info.unmeasured · info.errors).
//   미완료는 「검사 오류」가 아니에요 — 1.0.0 관문에서 btn-ink 의 종료 코드 2 가 「검사 종료 코드 2 — 성공 결과로 인정하지 않아요」 오류로 적혀
//   오류 2 · 미완료 2 로 두 번 세였고 · 사유(어느 단추 · 왜)가 표에서 사라졌고 · check.mjs 가 크래시로 보고 리그 교체 판단까지 갔어요.
//   검사 오류(error)는 결과 자체를 믿을 수 없을 때만: 시간 초과 · 종료 신호 · 약속 밖 종료 코드 · 결과 모양이 깨짐(아래 BROKEN) · 건너뜀+실패.
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, INCOMPLETE: 2 });
const BROKEN_RE = /^(검사 결과가 객체가 아니에요|검사 결과에 실패 배열이 없어요|실패 항목의 식별자가 없어요|측정 건수가 없거나 올바르지 않아요|측정 0건의 예상 빈 대상 근거가 없어요|다른 검사의 결과가 들어왔어요)/;
/** completionProblems 한 줄이 「결과 모양이 깨짐(검사 오류)」인지 — 아니면 측정 범위가 덜 찬 「미완료」 */
export const isBrokenProblem = (problem, result) => BROKEN_RE.test(String(problem)) || (!!result?.error && String(problem) === String(result.error));
/** 미완료 사유 한 줄: 무엇이 덜 찼는지 + 결과가 남긴 구체 사유(info.unmeasured 의 「어느 요소 ← 왜」 · info.errors) */
export function incompleteReason(result, problems = completionProblems(result)) {
 const info = object(result?.info) ? result.info : {};
 const parts = problems.filter(p => !isBrokenProblem(p, result));
 const um = Array.isArray(info.unmeasured) ? info.unmeasured : [];
 const detail = um.slice(0, 3).map(u => typeof u === 'string' ? u : [u?.group, u?.label].filter(Boolean).join(' / ') + (u?.reason ? ' ← ' + u.reason : '')).filter(Boolean);
 if (!detail.length && Array.isArray(info.errors)) detail.push(...info.errors.slice(0, 2).map(e => typeof e === 'string' ? e : e?.msg || e?.error || JSON.stringify(e)));
 if (!parts.length && !detail.length) return result?.incomplete === true ? '검사가 스스로 미완료로 표시했어요(사유 없음)' : null;
 return [parts.join(' · '), detail.length ? `예: ${detail.join(' · ')}${um.length > 3 ? ` 외 ${um.length - 3}` : ''}` : ''].filter(Boolean).join(' — ').slice(0, 400);
}
export function scriptOutcome(result,{code=0,signal=null,timedOut=false,minutes=25,expectedCheck=null}={}){
 const fails=Array.isArray(result?.fails)?result.fails:[];
 const skipped=typeof result?.skipped==='string'?result.skipped:typeof result?.info?.skipped==='string'?result.info.skipped:null;
 const incompleteExit=code===EXIT.INCOMPLETE&&result?.incomplete===true;   // 약속대로 「미완료」로 끝남 — 오류 아님
 let error=null;
 if(timedOut)error=`시간 초과 ${minutes}분 — 일부 결과만 남았어요`;
 else if(signal||code===null)error=`검사가 종료 신호로 중단됐어요${signal?' ('+signal+')':''}`;
 else if(code!==EXIT.PASS&&!(code===EXIT.FAIL&&fails.length)&&!incompleteExit)error=code===EXIT.INCOMPLETE?'검사 종료 코드 2(미완료)인데 결과에 미완료 표시(incomplete:true)가 없어요':`검사 종료 코드 ${code} — 성공 결과로 인정하지 않아요`;
 else if(skipped&&fails.length)error='건너뜀과 실패가 함께 기록돼 결과를 확인해야 해요';
 const preparation=skipped?[]:completionProblems(result);
 if(expectedCheck&&result?.check!==expectedCheck)preparation.push('다른 검사의 결과가 들어왔어요: '+String(result?.check||'식별자 없음'));
 const broken=preparation.filter(p=>isBrokenProblem(p,result));
 if(!error&&broken.length)error=broken.join(' · ');
 const incomplete=result?.incomplete===true||preparation.length>0||incompleteExit;
 const why=incomplete&&!error?incompleteReason(result,preparation):null;
 return{check:result?.check,ran:!skipped&&!error&&!incomplete,skipped,error,fails:error||incomplete?[]:fails,...(error||incomplete?{partialFails:fails}:{}),total:result?.total,info:result?.info,code,signal,incomplete,...(why?{incompleteReason:why}:{}),completionProblems:preparation,expectedEmpty:result?.expectedEmpty??result?.info?.expectedEmpty,emptyReason:result?.emptyReason??result?.info?.emptyReason};
}

// 10-29 waste-audit: 검사 오류의 출처 — 「리그·통신(rig)」 은 /goto 뒤 같은 리그에서 한 번 더 돌릴 가치가 있고,
//   「제품·검사 범위(product)」(창이 정말 안 열림 · 측정 못 한 대상 · 예상 건수 미달)는 다시 돌려도 같아서 재시도하지 않고 사람에게 남겨요.
//   8.2.4 사고: TTS 의 리그 500(도구)이 「창 못 엶」 실패(제품)로 적혀 세 번 재시도 · 리그 교체가 이어졌고, ui-lint 의 count() 버그(검사 범위)도 세 번씩 재시도됐어요.
export const TOOL_ERROR_RE = /리그 응답 오류|리그 RPC|요청 시간이 넘었어요|평가식이 .*끝나지 않았어요|주 스레드가 응답하지|ETIMEDOUT|EEVALSTUCK|CDP 연결|TimeoutError|AbortError|fetch failed|ECONNREFUSED|ECONNRESET|socket hang up|결과 파일이 없어요|종료 신호로 중단|시간 초과/;
const PRODUCT_ERROR_RE = /못 엶|열리지 않|열기 실패|뜨지 않았어요|측정하지 못한|측정 0건|건만 측정했어요|범위가 미완료|측정할 창이 없어요|예상 빈 대상/;
const str = v => typeof v === 'string' ? v : v && typeof v === 'object' ? String(v.msg || v.error || v.reason || JSON.stringify(v)) : v == null ? '' : String(v);
export function errorSource(result) {
 if(!object(result))return {source:'unknown',why:'결과 없음',texts:[]};
 const texts=[]; const push=v=>{const s=str(v).trim(); if(s)texts.push(s);};
 push(result.error); push(result.envError);
 for(const p of Array.isArray(result.completionProblems)?result.completionProblems:[])push(p);
 const info=object(result.info)?result.info:{};
 for(const e of Array.isArray(info.errors)?info.errors:[])push(e);
 for(const c of Array.isArray(info.coverage)?info.coverage:[])push(c?.error);
 for(const s of Array.isArray(info.screens)?info.screens:[])push(s?.error);
 for(const u of Array.isArray(info.unmeasured)?info.unmeasured:[])push(u?.reason||u);
 for(const f of Array.isArray(result.fails)?result.fails:[])if(PRODUCT_ERROR_RE.test(str(f?.msg)))push(f.msg);
 const tool=texts.filter(t=>TOOL_ERROR_RE.test(t));
 if(result.envError)return {source:'rig',why:'환경 오류: '+str(result.envError).slice(0,160),texts:tool};
 if(tool.length)return {source:'rig',why:tool[0].slice(0,160),texts:tool};
 const product=texts.filter(t=>PRODUCT_ERROR_RE.test(t));
 if(product.length)return {source:'product',why:product[0].slice(0,160),texts:product};
 return {source:texts.length?'unknown':'none',why:texts[0]?.slice(0,160)||null,texts};
}
export const sourceLabel = source => source === 'rig' ? '리그·통신 오류' : source === 'product' ? '제품·검사 범위 문제' : source === 'none' ? '오류 없음' : '원인 미분류';
