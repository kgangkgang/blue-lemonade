# 다른 확장과 맞물리는 표시


<details>
<summary>투명 그림 외곽선 — <code>data-salty-cutout</code> (7.3.0)</summary>

블루레몬에이드는 채팅에 들어온 투명 배경 그림(캐릭터 컷 · 생성 그림)에 이미지 › 투명 그림의 외곽선 · 빛 · 그림자를 하나의 SVG 필터로 걸어요. 채팅 메시지 안의 그림은 따로 할 일이 없어요. 그 밖의 곳(직접 만든 `<dialog>` 모아 보기 · 크게 보기 등)에 같은 효과를 받으려면 그림이나 그 틀에 표시를 달아 주세요.

| 값 | 뜻 |
|---|---|
| `data-salty-cutout="auto"` | 블루레몬에이드가 그림 가장자리를 재서 투명하면 외곽선을 걸어요 (같은 출처 그림만 잴 수 있어요). |
| `data-salty-cutout="on"` | 재지 않고 투명 그림으로 보고 걸어요 (다른 출처라 잴 수 없는 그림). |
| `data-salty-cutout="off"` | 이 그림(또는 이 틀 안의 그림)에는 걸지 않아요. 채팅 안에서도 통해요. |

```html
<dialog class="my-viewer" data-salty-cutout="auto">
  <img src="/user/images/Seraphina/cut-01.png" alt="">
</dialog>
```

- 나중에 넣은 그림 · 나중에 단 표시도 알아서 따라가요. 그림이 실린 뒤 한 번 재고 같은 주소는 기억해요.
- 외곽선 굵기는 CSS px 라 채팅에서 작게 보이든 크게 보이든 같아요. CSS `transform` 으로 확대하면 그림과 같이 커져요.
- 그림 칸 가장자리에 닿은 몸(잘린 면) 쪽으로는 칸 밖으로 그리지 않아요. 사용자가 「끄기」를 고르면 아무것도 안 걸려요.
- 걸린 그림에는 `.salty-alpha`(채팅) · `.salty-alpha-view`(채팅 밖) 클래스가 붙고, 켜져 있는 동안 `body.salty-cutedge` 가 있어요. 따로 테두리를 그리는 확장은 이걸 보고 겹치지 않게 쉬면 돼요.

</details>

<details>
<summary>결과 보관함 창구 — <code>Symbol.for('blue-lemonade.result-keeper.v1')</code> (1.0.3)</summary>

QR 책장에서 「답을 보관함으로」를 고른 QR 을 누르면, 그 QR 이 만든 다음 AI 답 하나를 이 창구로 넘겨요. 보관함을 가진 확장이 창구를 열어 두면 책장에 그 칸이 생기고, 없으면 아무것도 보이지 않아요.

```js
globalThis[Symbol.for('blue-lemonade.result-keeper.v1')] = {
  label: '내 보관함',                 // 책장 화면에 「답을 내 보관함으로」로 보여요 (30자까지)
  available: () => true,              // (선택) 지금 받을 수 있는지 — false 면 책장이 칸을 숨겨요
  async keep({ text, title, source, qr, speaker, chatId, at }) {
    // text: 답 본문 그대로 · title: 책장에 적은 QR 이름 · source: 'blue-lemonade.qr-shelf' · qr: QR 이름표
    // 저장했으면 true 또는 { id } — 그때만 블루레몬에이드가 채팅에서 그 메시지를 실리태번 삭제 함수로 빼요
    return true;
  },
};
```

- 창구는 QR 을 누를 때마다 다시 읽어요. 나중에 열어도, 바꿔 끼워도 돼요.
- `keep` 이 false · 오류면 답은 채팅에 그대로 남고 알림만 떠요.
- 기다리는 동안 블루레몬에이드는 실리태번 사건 두 개(새 답 그림 · 채팅 바뀜)만 듣고, 첫 답 · 채팅 바뀜 · 2분 중 먼저 오는 것에서 떼요.

</details>

<details>
<summary>사용량 장부 — <code>Symbol.for('blue-lemonade.usage')</code> (7.4.0)</summary>

확장마다 「무슨 기능이 얼마 썼나」를 한 곳에 모으는 장부예요. 블루레몬에이드가 켜져 있으면 `globalThis[Symbol.for('blue-lemonade.usage')]` 가 있어요. 없으면(꺼짐 · 옛 판) 아무것도 하지 말고 그냥 넘어가면 돼요. 기록은 이 기기 IndexedDB(`BlueLemonadeUsage`)에만 90일 남고, 밖으로 보내지 않아요.

```js
const ledger = globalThis[Symbol.for('blue-lemonade.usage')];
ledger?.record({
  ext: '내 확장',            // 사람이 읽는 확장 이름 (영수증에 그대로)
  feature: '요약 만들기',    // 기능 이름 — 자세하게
  model: 'claude-opus-5-5', // 실제 보낸 모델 id
  api: 'claude',            // 실리태번 연결 종류(vertexai · claude · makersuite · openai · custom …) — 공식 단가 찾기용
  origin: 'https://api.example.com', // (선택) 요청을 보낸 주소 — origin 만 남겨요. 중계면 중계 단가로 따로 셈해요
  input: 9210, output: 820, // 토큰 — 응답의 usage 값을 먼저
  cachedInput: 0, thinking: 0,
  estimated: false,         // usage 가 없어 토크나이저로 셌으면 true (영수증에 「≈」)
  ok: true, at: Date.now(), chatId, mesId,
});
```

- **토큰 칸 뜻 (두 번 세지 않기)**: `input` 은 캐시로 읽은 몫을 포함한 입력 전체, `cachedInput` 은 그중 캐시 몫이에요. `output` 은 생각을 포함한 출력 전체, `thinking` 은 그중 생각 몫(정보용)이에요. 응답이 생각을 따로 주면(예: Gemini `thoughtsTokenCount`) `output` 에 더해 넣고 `thinking` 에도 적어 주세요. 값 = (input − cachedInput) × 입력 단가 + cachedInput × 캐시 단가 + output × 출력 단가.
- 글자로 과금되는 엔진(TTS 등)은 `characters` 에 글자 수를 적어요. 단가를 모르면 값은 비워 둬요.
- 응답이 요청 비용을 직접 알려 주면 `reportedUsd` 에 적으면 그 값을 써요.
- **키 · 토큰 · 비밀은 넣지 마세요.** 정해진 칸만 남기고, 주소는 origin 만, 비밀처럼 보이는 글은 버려요.

| 함수 | 돌려주는 것 |
|---|---|
| `record(entry)` | `Promise<id \| null>` — 곧바로 돌아와요(네트워크 없음) |
| `query({ from, to })` | `[{ ...entry, cost: { usd, krw, priceSource, priceDate, estimated, approx, kind, relay, payMethod, note } }]` |
| `summary({ day: 'YYYY-MM-DD' })` · `summary({ month: 'YYYY-MM' })` · `summary({ from, to })` | `{ total: { usd, krw, unknown }, requests, replies, lines, byExt, byFeature, byModel, topReply, krw }` — `lines` 는 (확장 · 기능 · 모델 · 연결 · 결제 수단)마다 한 줄, 값이 큰 줄부터. 「본 답」 줄은 `replies` · `perReplyUsd` · `perReplyKrw` |
| `price(model, api, at?)` | `Promise<{ inPerM, outPerM, cachedInPerM, currency, source, date, approx, note } \| null>` (100만 토큰당 USD) |
| `on('change', cb)` | 떼는 함수 |
| `payMethods()` | `{ defaults, set, choices }` — 연결마다 「크레딧 · 실제 결제 · 중계」 |

- **가격**: 기록 시각의 단가로, 요청이 실제로 나간 연결의 표로 셈해요. 공식 API 는 블루레몬에이드 가격표(공식 공개 단가, 매일 갱신)와 날짜별 단가(예: Gemini 4 Argon 은 12월 1일부터 $4 / $20). 확인하지 못한 단가는 `approx: true` 와 `note`(예: 「≈ Vertex 미확인」)가 붙어요.
- **중계**: 성능 보조 › 예산에 넣은 중계 서버로 나간 요청은 공식과 다른 줄(`tag: '(중계 · 주소)'`)이에요. 예산 기능이 받아 온 중계 장부와 맞춘 실제 과금(쿼터 달러)을 먼저 쓰고, 못 맞추면 중계 단가표로 어림해 「≈」를 붙여요. 원화는 설정 환율로 바꾸고 그 가정을 `krwNote` 에 적어요.
- **결제 수단** 기본값: Vertex AI · Anthropic 공식 = 크레딧, 중계 = 중계, 그 밖 = 실제 결제. 사용자가 바꿀 수 있어요. `summary().lines[].payMethod` 로 영수증 도장을 고르면 돼요.
- 블루레몬에이드는 (성능 보조 애드온이 켜져 있으면) 스스로 실리태번 본 생성(본 답 · 다시 생성 · 스와이프 · 이어 쓰기 · 사칭)과 자기 기능(번역 · 번역 다시(교정) · 다시 쓰기 · TTS 대사 분석 · TTS 음성 · 전개 지시 …)을 적어요. 다른 확장의 요청은 그 확장이 적어야 두 번 세지 않아요.
- 값은 가격표 기준 어림값이에요. 실제 청구와 다를 수 있어요.

</details>

<details>
<summary>저장 공간 보고 — <code>Symbol.for('st.storage-report.v1')</code> (7.4.0)</summary>

이 기기에 남긴 캐시 · 기록을 한 화면에서 보고 비울 수 있게 하는 다리예요. 다리를 만드는 확장이 `globalThis[Symbol.for('st.storage-report.v1')] = { register(report) }` 를 두면, 다른 확장은 거기에 등록해요. 다리가 아직 없으면 `globalThis[Symbol.for('st.storage-report.pending')]` 배열에 넣어 두면 다리가 나중에 읽어 가요.

```js
const report = {
  id: 'my-ext', owner: 'my-ext', label: '내 확장',
  measure: async () => ({ items: [{ id: 'cache', label: '캐시', count: 12, bytes: 34567, note: '하루' }] }),
  clean: [{
    id: 'cache', label: '캐시 비우기',
    describe: async () => ({ count: 12, bytes: 34567, note: '다시 받으면 요금이 들 수 있어요' }),   // 지우지 않아요
    run: async () => ({ count: 12, bytes: 34567 }),                                                  // 부르는 쪽이 사용자에게 물은 뒤에만
  }],
};
const bridge = globalThis[Symbol.for('st.storage-report.v1')];
if (bridge?.register) bridge.register(report);
else (globalThis[Symbol.for('st.storage-report.pending')] ??= []).push(report);
```

블루레몬에이드는 `id: 'blue-lemonade'` 로 목소리 캐시 · 번역 캐시 · 요청 기록 · 사용량 장부 · 가격표 · 모델 목록 캐시를 보고하고, 목소리 캐시 · 번역 캐시 · 요청 기록 비우기를 내놓아요.

</details>

<details>
<summary>요청 로그 — <code>Symbol.for('st.request-log.v1')</code> 의 <code>recent({ replies })</code> (7.4.0)</summary>

`await globalThis[Symbol.for('st.request-log.v1')]?.recent?.({ replies: 5 })` 는 최근 답 5개마다 `{ at, purposes: { 'chat.generate': 1, 'translation.chat': 1, … } }` 를 최근 답부터 돌려줘요. 답 하나는 본 생성 하나와 그 뒤 다음 본 생성 전까지의 요청이에요. 숫자만 주고(글 · 모델 · 키는 주지 않아요), 요청 로그를 꺼 두면 `null` 이에요. 요청에 용도 이름표를 붙이는 `begin({ caller, purpose, label, user })` 은 전처럼 있어요.

</details>

<details>
<summary>남의 확장 화면 맞춤 — 미트볼 상태창 2.6.1 · 2.7.0 (1.2.x)</summary>

블루레몬에이드는 확인한 확장이 깔려 있을 때만 그 확장의 화면을 테마의 낮 · 밤 색과 부품 모양에 맞춰요. 그 확장이 없으면 모듈도 시트도 받지 않아요.

| 확장 | 확인한 판 | 확인한 날 | 맞춘 것 |
|---|---|---|---|
| 미트볼 상태창 | 2.6.1 · 2.7.0 | 2026-11-13 | 채팅 위 상태 띠 · 가장자리 손잡이 · 변동 칩 · 알림 · 만들기 창 · 상태창 창 · 확장 설정 칸(가로 분류 탭 · 머리줄 고양이 아이콘) · 로그 복사에서 변동 칩 빼기 |

- 켬 조건 · 확인한 판은 `src/ext-compat.js` 의 `SETS` 한 곳이에요. `index.js` 는 그 확장의 설정 칸(`#ss-settings`)이 있을 때만 이 모듈을 받고, 모듈이 맞춤 시트 `src/ext-status.css` 를 붙여요. 설정 칸이 있었던 것은 이 기기에 표시(`localStorage` `bl-ext-compat`)해 두어 다음 시작에는 첫 화면부터 붙고, 그 확장을 지우면 그다음 시작에 표시가 지워져 그 뒤로는 아무것도 받지 않아요. 실리태번은 확장을 깔 때 새로 읽지 않아서, 그 뒤 내는 「확장 설정 읽음」 사건에서 한 번 더 봐요(깐 그 세션에도 걸려요).
- 색은 그 확장이 여는 색 변수(`--ss-*`)를 팔레트에 이어요. 테마가 켜져 있는 동안은 그 확장의 색 판 선택을 팔레트가 덮어요(모서리 · 글자 배율은 그 확장 값 그대로).
- 테마 설정 「다른 확장 원래 색 유지」로 그 확장 칸을 고르면 설정 칸 안의 색(글자색 · 면 · 선 색)은 그 확장의 원래 색으로 두고, 자리 · 크기 고침과 분류 탭은 그대로예요. 상태 띠 · 창 · 칩은 테마 색 그대로예요.
- 설정 칸은 그 확장의 묶음 머리를 그때 읽어 탭으로 나눠 보여요. 그 확장의 요소는 옮기거나 지우지 않고 표식(`data-bl-tab-g` · `data-bl-tab-off`)만 달아요. 탭 줄은 테마의 다른 가로 탭 줄처럼 ← → · Home · End · 마우스 휠로 넘기고, 넘친 쪽은 흐리게 보여요. 감시자 · 타이머는 없어요(문서 누름 받기 하나).
- 2.7.0 머리줄의 고양이 그림 글자는 테마 선 아이콘(직접 그린 고양이 · 글자색)으로 바꿔 보여요. 글자는 그대로 두고 화면에서만 감춰서 읽어 주는 이름은 같아요. 다른 그림 글자(2.6.1)는 그대로예요.
- 깔린 판이 확인한 판과 다르면 설정 칸 맨 아래 안내 한 줄이 그 사실을 알려요. 맞춤은 그대로 걸려요.
- 그 확장의 코드 · CSS · 그림 · 소리는 이 저장소에 들어 있지 않아요.
- 테마를 끄거나 제로 모드(모양만)면 맞춤이 걸리지 않아요.

</details>
