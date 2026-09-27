const CODE=String.raw`(?<!(?:position|pos|line|column|col|offset|char(?:acter)?|index|byte|length)[\s:#=]*)(?<![\d.,])\b`;
const TRANSIENT_CODE=new RegExp(String.raw`${CODE}(?:429|50[0-3]|529)\b(?![.,]\d)`);
const TRANSIENT_MESSAGE=new RegExp(String.raw`${CODE}(?:429|50[0-3]|529)\b(?![.,]\d)|too many requests|rate.?limit|resource.?exhausted|overloaded|unavailable|bad gateway|internal server error|failed to fetch|networkerror|network error|econnreset|socket hang up`,'i');
const CLOUDFLARE_524=new RegExp(String.raw`${CODE}524\b(?![.,]\d)`);
const PARSE_FAILURE=/unexpected token|not valid json|unexpected end of json|<!doctype|<html/i;
export const isTransientFailure=(error,reason)=>!CLOUDFLARE_524.test(reason)&&(error?.name==='SyntaxError'||PARSE_FAILURE.test(reason)?TRANSIENT_CODE.test(reason):TRANSIENT_MESSAGE.test(reason));

// ST may forward provider failures as HTTP 200 JSON. Preserve them as errors.
export function responseError(data) {
    const raw = data?.error;
    const reason = (typeof raw === 'string' ? raw : raw?.message) || data?.message || 'API가 번역 요청을 거절했어요.';
    const status = Number(raw?.status ?? raw?.code ?? data?.status);
    const error = new Error(String(reason));
    if (Number.isInteger(status) && status >= 400 && status <= 599) error.status = status;
    if (data?.quota_error && !error.status) error.status = 429;
    error.transient = error.status === 524 ? false : error.status ? error.status === 429 || error.status >= 500 : isTransientFailure(error, error.message);
    return error;
}
