// 노래방 글꾸 만들기 화면 — 곡 칸(테마 · mp3 · 제목 · 이름 · 색 · 표지 · 길이 · 가사) 여러 개 → kara-core.buildPost → HTML 복사 · 사이트 흉내 미리보기. 전부 브라우저 안(서버 없음).
import { THEMES, THEME_IDS, buildPost, checkPost, parseLyrics, mmss, isHex } from './kara-core.js?v=20261109i';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DRAFT = 'bl-kara-draft';
const form = $('.kb-form'), list = $('.kb-songs'), out = $('.kb-out'), code = $('.kb-code'), frame = $('.kb-frame'), warnBox = $('.kb-warn'), status = $('.kb-status');
const btnCopy = $('[data-act="copy"]'), btnDl = $('[data-act="download"]');
const qsTheme = new URLSearchParams(location.search).get('theme');
const blank = th => ({ th: THEMES[th] ? th : 'ign', mp3: '', title: '', sub: '', name: '', color: THEMES[THEMES[th] ? th : 'ign'].accent, cover: '', coverW: 0, coverH: 0, dur: '', lyrics: '' });
let songs = [];
let made = '';
try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (Array.isArray(d?.songs) && d.songs.length) songs = d.songs.map(s => ({ ...blank(s.th), ...s })); if (typeof d?.gaps === 'boolean') form.elements.gaps.checked = d.gaps; } catch { /* 저장이 막힌 창 */ }
if (!songs.length) songs = [blank(qsTheme || 'ign')];
else if (qsTheme && THEMES[qsTheme]) songs[0].th = qsTheme;

const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify({ songs, gaps: form.elements.gaps.checked })); } catch { /* 저장이 막힌 창 */ } };
const say = (t, bad) => { status.textContent = t; status.classList.toggle('is-bad', !!bad); };
const mmssOf = v => { const m = /^\s*(\d+):(\d{1,2}(?:\.\d+)?)\s*$/.exec(v); if (m) return Number(m[1]) * 60 + Number(m[2]); const n = Number(v); return n > 0 ? n : 0; };

function songHtml(s, i) {
  const opts = THEME_IDS.map(id => `<option value="${id}"${id === s.th ? ' selected' : ''}>${esc(THEMES[id].emoji)} ${esc(THEMES[id].label)} — ${esc(THEMES[id].desc)}</option>`).join('');
  return `<fieldset class="kb-song" data-i="${i}">
<div class="kb-song-head"><h2>TRACK ${String(i + 1).padStart(2, '0')}</h2>${songs.length > 1 ? `<button type="button" class="ibtn" data-act="up" aria-label="위로" title="위로"${i === 0 ? ' disabled' : ''}><span class="em" aria-hidden="true">▲</span></button><button type="button" class="ibtn" data-act="down" aria-label="아래로" title="아래로"${i === songs.length - 1 ? ' disabled' : ''}><span class="em" aria-hidden="true">▼</span></button>` : ''}<button type="button" class="ibtn x quiet" data-act="del" aria-label="이 곡 빼기" title="이 곡 빼기"${songs.length === 1 ? ' disabled' : ''}></button></div>
<div class="kb-grid">
<label class="kb-field"><span class="kb-label">테마</span><span class="field-wrap"><select class="field" data-k="th" aria-label="테마">${opts}</select></span></label>
<label class="kb-field"><span class="kb-label">mp3 주소</span><span class="field-wrap"><input class="field" type="url" data-k="mp3" value="${esc(s.mp3)}" placeholder="https://img.kkangtong.xyz/post-audios/uploads/….mp3" inputmode="url"></span><small>글에 올린 mp3 의 주소예요(수정 › HTML 에서 복사). 넣으면 길이를 저절로 읽어요.</small></label>
<label class="kb-field"><span class="kb-label">제목</span><span class="field-wrap"><input class="field" type="text" data-k="title" value="${esc(s.title)}" placeholder="곡 제목" maxlength="60"></span></label>
<label class="kb-field"><span class="kb-label">작은 글(원제 · 부제)</span><span class="field-wrap"><input class="field" type="text" data-k="sub" value="${esc(s.sub)}" placeholder="비워도 돼요" maxlength="80"></span></label>
<div class="kb-field"><span class="kb-label">부르는 이름 · 캐릭터 색</span><div class="kb-inline"><label class="field-wrap kb-touch"><input class="field" type="text" data-k="name" value="${esc(s.name)}" placeholder="이름(영어 권장)" maxlength="24" aria-label="부르는 이름"></label><label class="mart-ink" title="가사 · 레코드판 · 재생 단추 색"><input type="color" data-k="color" value="${isHex(s.color) ? s.color : '#79a9d8'}" aria-label="캐릭터 색"><span class="mart-ink-dot" style="background:${isHex(s.color) ? s.color : '#79a9d8'}" aria-hidden="true"></span><span class="kb-ink-hex">${esc(isHex(s.color) ? s.color : '#79a9d8')}</span></label></div></div>
<label class="kb-field"><span class="kb-label">곡 길이</span><span class="field-wrap"><input class="field" type="text" data-k="dur" value="${esc(s.dur)}" placeholder="3:24 (mp3 주소를 넣으면 저절로)" inputmode="decimal"></span></label>
<label class="kb-field kb-wide"><span class="kb-label">표지 그림 주소(없어도 돼요)</span><span class="field-wrap"><input class="field" type="url" data-k="cover" value="${esc(s.cover)}" placeholder="https://img.kkangtong.xyz/post-images/uploads/….jpg" inputmode="url"></span><small>${s.coverW && s.coverH ? `${s.coverW}×${s.coverH} · ` : ''}글에 올린 그림 주소를 넣으면 첨부 목록에도 떠요. 비우면 레코드판만 돌아요.</small></label>
<label class="kb-field kb-wide"><span class="kb-label">가사 — 한 줄에 [분:초] 가사</span><textarea data-k="lyrics" placeholder="[0:00] 첫 줄 가사&#10;[0:04] 둘째 줄 가사&#10;시간 없는 줄은 바로 위 줄의 작은 글(번역 · 원문)&#10;[0:08] …  (LRC 파일 내용을 그대로 붙여도 돼요)" spellcheck="false">${esc(s.lyrics)}</textarea></label>
</div></fieldset>`;
}
function render() { list.innerHTML = songs.map(songHtml).join(''); }
render();

// 입력 → 상태(다시 그리지 않아요 — 초점 유지). 색은 알약 점 · 글자도 같이.
list.addEventListener('input', e => {
  const el = e.target, k = el.dataset.k; if (!k) return;
  const i = Number(el.closest('.kb-song').dataset.i), s = songs[i]; if (!s) return;
  s[k] = el.value;
  if (k === 'color') { const lab = el.closest('.mart-ink'); lab.querySelector('.mart-ink-dot').style.background = el.value; lab.querySelector('.kb-ink-hex').textContent = el.value; }
  if (k === 'th' && !el.closest('.kb-song').querySelector('[data-k="color"]').dataset.touched) { /* 테마를 바꿔도 고른 색은 그대로 둬요 */ }
  save();
});
list.addEventListener('change', e => {
  const el = e.target, k = el.dataset.k; if (!k) return;
  const i = Number(el.closest('.kb-song').dataset.i), s = songs[i]; if (!s) return;
  if (k === 'color') el.dataset.touched = '1';
  if (k === 'mp3' && /^https?:\/\//.test(s.mp3)) probeAudio(s, i);
  if (k === 'cover') { s.coverW = 0; s.coverH = 0; if (/^https?:\/\//.test(s.cover)) probeImage(s, i); }
  save();
});
list.addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const i = Number(b.closest('.kb-song').dataset.i), act = b.dataset.act;
  if (act === 'del' && songs.length > 1) songs.splice(i, 1);
  if (act === 'up' && i > 0) [songs[i - 1], songs[i]] = [songs[i], songs[i - 1]];
  if (act === 'down' && i < songs.length - 1) [songs[i + 1], songs[i]] = [songs[i], songs[i + 1]];
  render(); save();
});
form.addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b || b.closest('.kb-song')) return;
  if (b.dataset.act === 'add') { if (songs.length >= 10) { say('깡싸는 한 글에 mp3 10개까지예요'); return; } songs.push(blank(songs[songs.length - 1].th)); render(); save(); list.lastElementChild?.querySelector('[data-k="mp3"]')?.focus(); }
  if (b.dataset.act === 'copy') copyOut();
  if (b.dataset.act === 'download') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([made], { type: 'text/html;charset=utf-8' })); a.download = '노래방-글꾸.html'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
});
form.elements.gaps.addEventListener('change', save);

/** mp3 주소로 길이 읽기(미디어 요소의 duration 은 다른 사이트 파일도 읽혀요 · 실패하면 조용히 넘어가요) */
function probeAudio(s, i) {
  const a = new Audio(); a.preload = 'metadata';
  const done = () => { if (a.duration && isFinite(a.duration) && !s.dur) { s.dur = mmss(Math.round(a.duration)); const el = list.querySelector(`.kb-song[data-i="${i}"] [data-k="dur"]`); if (el) el.value = s.dur; save(); say(`${i + 1}번 곡 길이 ${s.dur} 을 읽었어요`); } };
  a.addEventListener('loadedmetadata', done, { once: true });
  a.addEventListener('error', () => say(`${i + 1}번 곡 mp3 길이를 못 읽었어요 — 길이 칸에 직접 적어요`), { once: true });
  a.src = s.mp3;
}
function probeImage(s, i) {
  const im = new Image();
  im.onload = () => { s.coverW = im.naturalWidth; s.coverH = im.naturalHeight; save(); const sm = list.querySelector(`.kb-song[data-i="${i}"] [data-k="cover"]`)?.closest('.kb-field')?.querySelector('small'); if (sm) sm.textContent = `${s.coverW}×${s.coverH} · 글에 올린 그림 주소를 넣으면 첨부 목록에도 떠요. 비우면 레코드판만 돌아요.`; };
  im.onerror = () => say(`${i + 1}번 곡 표지 그림을 못 읽었어요 — 주소를 확인해요`);
  im.src = s.cover;
}

// 사이트 흉내 미리보기: 본문은 shadow root 안 · :where 회색 글자 규칙 · img 를 번호표 상자로 감쌈 · height% → auto · id/for/name 지움
const SITE = `.content{color:rgb(245,245,245)}:where(.content p:not([style*="color"]),.content span:not([style*="color"]),.content div:not([style*="color"]),.content li:not([style*="color"]),.content td:not([style*="color"])){color:rgb(31,41,55)}`;
function previewDoc(html) {
  let n = 0;
  const pv = html.replace(/<img ([^>]*)>/g, (m, a) => `<div class="image-number-wrapper" style="position:relative"><img ${a}><div class="image-number-badge" style="position:absolute;top:6px;left:6px;background:#2563eb;color:#fff;font-size:12px;padding:0 6px;border-radius:6px">${++n}</div></div>`)
    .replace(/ src="__MP3__"/g, '').replace(/height:\s*[\d.]+%/g, 'height:auto').replace(/ (id|for|name)="[^"]*"/g, '');   // 빈 mp3 자리표는 미리보기에서 src 를 빼요(404 없이 빈 플레이어)
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px 12px;background:#1b1c20;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif}</style></head><body><div class="post-content"><template shadowrootmode="open"><style>${SITE}</style><div class="content">${pv}</div></template></div></body></html>`;
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const input = songs.map(s => {
    const { lines, meta, warn } = parseLyrics(s.lyrics);
    const dur = mmssOf(s.dur) || (meta.length ? mmssOf(meta.length) : 0);
    return { th: s.th, title: s.title || meta.ti || '', sub: s.sub, who: [{ name: s.name || meta.ar || '', color: s.color }], mp3: s.mp3.trim(), cover: /^https?:\/\//.test(s.cover.trim()) ? { src: s.cover.trim(), w: s.coverW, h: s.coverH } : null, dur, lines, _warn: warn };
  });
  const { html, warn } = buildPost(input, { gaps: form.elements.gaps.checked });
  const problems = checkPost(html);
  made = html;
  code.value = html;
  const notes = [...input.flatMap((s, i) => s._warn.map(w => `${i + 1}번 곡: ${w}`)), ...warn];
  warnBox.innerHTML = [...problems.map(p => `<li class="is-bad">문제: ${esc(p)}</li>`), ...notes.map(w => `<li>${esc(w)}</li>`)].join('');
  warnBox.hidden = !warnBox.innerHTML;
  frame.srcdoc = previewDoc(html);
  out.hidden = false;
  btnCopy.disabled = btnDl.disabled = false;
  say(`${input.length}곡 · ${(html.length / 1024).toFixed(0)}KB 만들었어요${problems.length ? ' — 문제가 있어요(아래 참고)' : ''}`, problems.length > 0);
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  save();
});
async function copyOut() {
  if (!made) return;
  try { await navigator.clipboard.writeText(made); say('복사했어요 — 글쓰기 HTML 칸에 붙여요'); }
  catch { code.focus(); code.select(); try { document.execCommand('copy'); say('복사했어요 — 글쓰기 HTML 칸에 붙여요'); } catch { say('복사가 막혔어요 — 아래 칸의 글을 직접 복사해요', true); } }
}
$('[data-filter="width"]').addEventListener('click', e => {
  const b = e.target.closest('button[data-w]'); if (!b) return;
  for (const x of b.parentElement.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  frame.width = b.dataset.w; frame.height = b.dataset.w === '760' ? '900' : '760';
});
// 「비우기」: 머리줄에 따로 두지 않고 상태 글 옆 링크로(초안은 이 브라우저에만 남아요)
const clear = Object.assign(document.createElement('button'), { type: 'button', className: 'btn', innerHTML: '<span class="em" aria-hidden="true">🧹</span>비우기', title: '적은 내용을 모두 지워요(이 브라우저에 남은 초안도)' });
clear.addEventListener('click', () => { songs = [blank(songs[0]?.th || 'ign')]; made = ''; code.value = ''; out.hidden = true; btnCopy.disabled = btnDl.disabled = true; render(); try { localStorage.removeItem(DRAFT); } catch { /* 저장이 막힌 창 */ } say('비웠어요'); });
$('.kb-row-add').append(clear);
