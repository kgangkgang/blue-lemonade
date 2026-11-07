// 글꾸 마트 「🍽️ 시식하기」 — model(taste-parse.js) + 글꾸 틀(마트 자료 항목: template · colors · messages · tail · type) → 깡싸 글쓰기 HTML 칸에 붙이는 완성 HTML.
// 그리기는 테마 모듈 사본(mart/lib/log-copy/ · omni-next 953c439a)이 그대로 해요 — 테마 마트 빌드(tools/mart-build.mjs previewOf)와 같은 길:
//   renderLog(template) → 미리보기 표시(data-f · data-bl-*) 걷기 · 그 틀이 쓰는 움직임 <style> 만 맨 앞 · 사람이 고치기 쉬운 꼴(prettyLogHtml).
// 사이트용 어댑터(깡싸 규칙): 스크립트 없음 · 인라인 <svg> · <img data:> 없음(그림은 전부 CSS background-image — 틀 자료가 이미 그래요) ·
//   글자색은 깡싸 다크 모드가 color 를 덮어도 보이게 인라인 color 옆에 -webkit-text-fill-color 를 같은 값으로 덧써요(커뮤니티 편집기가 class 를 지워 선택자 규칙은 못 써요 — 인라인이 제일 세요).
// DOM 없는 순수 함수예요(node 로 시험).
import { renderLog, dateLabel } from './lib/log-copy/log-copy-presets.js';
import { prettyLogHtml } from './lib/log-copy/log-copy-pretty.js';
import { motionStyleFor } from './lib/log-copy/log-copy-motion.js';
import { withoutSvgData } from './lib/log-copy/log-copy-template.js';
import { bareLog } from './lib/log-copy/log-copy-bare.js?v=20261108a';
import { fitBare } from './lib/log-copy/log-copy-bare-fit.js?v=20261108a';   // 11-07 빼고 나서 글을 덮게 된 떠 있는 장식 걷기(사용자 「컴퓨터가 내려와 글을 덮어 · 이런 것들 없애줘」)
import { SCREEN } from './taste-parse.js';

export { dateLabel };
/** 테마 마트 빌드와 같은 화면 글꼴 값(틀 부품 글씨 — 제목 · 알약 · 꼬리) */
export const UI = { family: "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", tracking: '-0.025em' };

// ── 11-07 일러스트 컨셉 30종(concept-* · 틀(template) 없이 미리보기만 있던 글꾸 — 시식 창이 「틀을 받는 중이에요…」에서 멈췄어요) ──
// 그리는 모듈(테마 tools/mart/geulkku-concept30.mjs 사본 · 240KB)은 그 글꾸를 열 때만 받아요
let concept = null, conceptLoading = null;
export const isConcept = item => !item?.template && !item?.shape && /^concept-[a-z0-9-]+$/.test(String(item?.id ?? ''));
export const conceptReady = () => !!concept;
export function loadConcept() {
    conceptLoading ||= import('./lib/log-copy/log-copy-concept30.js?v=20261108a').then((m) => { concept = m; return m; }, (error) => { conceptLoading = null; throw error; });
    return conceptLoading;
}
/** 지금 시식으로 그릴 수 있나 — 받은 글꾸(template) · 기본 틀(shape) · 받아 둔 일러스트 컨셉 */
export const canTaste = item => !!(item?.template || item?.shape || (isConcept(item) && concept?.MART_CONCEPT_FRAMES.some(f => f.id === item.id)));

/** 인라인 style 의 color 옆에 -webkit-text-fill-color 를 같은 값으로 (background-color · border-color 는 안 건드려요) */
export function inkForKkangsa(html) {
    return String(html ?? '').replace(/ style="([^"]*)"/g, (all, css) => {
        if (/-webkit-text-fill-color/.test(css)) return all;
        const next = css.replace(/(^|;)\s*color\s*:\s*([^;"]+)/g, (m, lead, value) => `${lead}color:${value.trim()};-webkit-text-fill-color:${value.trim()}`);
        return next === css ? all : ` style="${next}"`;
    });
}

/**
 * @param {object} item 글꾸 자료 항목(template · colors · messages · tail · type · label) — 또는 테마 로그 복사 기본 틀(shape · palette · images: tools/geulkku-builtin.mjs)
 * @param {object} model taste-parse.js buildModel 결과
 * @param {{ title?: string, date?: string, mark?: string, char?: string, model?: string, prompt?: string }} [fields] 머리 칸 — 제목 · 날짜 · 알약(LOG 표 · 깡통 · 모델 · 프롬프트). 빈 칸은 그리지 않아요(표본 값 채우기는 taste.js headFields 가 해요)
 * @param {{ names?: boolean }} [options] names: 메시지마다 이름 줄(false 면 본문만 · 간격은 그대로 — 테마 logHtml names:false 와 같은 길)
 * @returns {string} 완성 HTML(빈 로그면 빈 글)
 */
export function tasteHtml(item, model, fields = {}, { names = true, top = false, bottom = false, drop = [] } = {}) {
    if (!canTaste(item) || !model?.messages?.length) return '';
    const cut = (key, max) => String(fields[key] ?? '').trim().slice(0, max);
    const clean = { title: cut('title', 80), date: cut('date', 60), mark: cut('mark', 24), char: cut('char', 40), model: cut('model', 40), prompt: cut('prompt', 40) };
    // 기본 틀은 테마 로그 복사 창과 같은 길: renderLog(shape · 기본 에이드 색) — 갤러리 틀은 표본 사진(절대 주소 · 마트 ensureItem)을 같이 넣어요
    // 11-07 일러스트 컨셉 30종(틀 없이 미리보기만 있던 글꾸)은 테마 마트 빌드와 같은 renderConcept 로 그려요
    const drawn = item.template || item.shape
        ? renderLog(model, { ...(item.template ? { template: item } : { shape: item.shape, colors: item.palette, images: item.images || [] }), ui: UI, fields: clean, size: 'm', screen: SCREEN, names: !!names })
        : concept.renderConcept(model, { id: item.id, ui: UI, fields: clean, size: 'm', screen: SCREEN, names: !!names });
    // 11-07 위 글 · 아래 글 빼기: 미리보기 표시(data-f · data-bl-msg)가 남아 있을 때 걷어요(테마 1.0.7 로그 복사 창과 같은 길)
    const raw = fitBare(drawn, bareLog(drawn, { top, bottom, drop }));
    if (!raw) return '';
    // 테마 마트 빌드 previewOf 와 같은 검사: 미리보기 표시는 걷고 반응(data-bl-egg)만 남겨요 · 실행 · 주소 · class 가 있으면 내보내지 않아요
    const body = raw.replace(/ data-f="[a-z]+"/g, '').replace(/ data-bl-(?!egg=)[a-z]+(?:="[^"]*")?/g, '');
    const plain = withoutSvgData(body);
    if (plain === null) throw new Error('그림(svg) 부품에 쓸 수 없는 것이 있어요');
    if (/<script|<style|\sclass=|\son[a-z]+=|javascript:|url\(|var\(--/i.test(plain.replace(/curl/g, ''))) throw new Error('결과에 실행 · 주소 · class 가 있어요');
    const style = motionStyleFor(body);
    if (/url\(|@import|<\/style[\s\S]*<style/i.test(style)) throw new Error('움직임 <style> 이 이상해요');
    const pretty = prettyLogHtml(raw, { label: item.label || item.name || '', head: style, fields: false });
    return inkForKkangsa(pretty);
}

/** 내려받기(.html) 문서 — 복사한 HTML 을 따로 열어도 같은 모양 */
export function tasteDocument(html, title = '글꾸 시식') {
    const esc = s => String(s ?? '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
    return `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n</head>\n<body style="margin:0;padding:16px;background:#f3f1ec;-webkit-text-size-adjust:100%">\n${html}\n</body>\n</html>\n`;
}
