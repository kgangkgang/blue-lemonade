// 모델 등록 — 실리태번의 공급자별 모델 선택창 표
// 실리태번 1.18 'staging' 기준. public/scripts/openai.js의 chat_completion_sources(177), settingsToUpdate(305~),
// saveModelList(2025~)와 public/index.html의 #chat_completion_source 목록에서 확인했다.
//
// kind  'select'   : <select>에 우리 optgroup을 넣는다
//       'custom'   : 자유 입력칸 + 자동완성 목록(datalist)과 보조 select
// wiped true       : 연결(Connect)할 때 실리태번이 목록을 비우고 새로 채운다 → 그때마다 다시 넣어 줘야 한다

export const SOURCES = [
    { id: 'openai', label: 'OpenAI', kind: 'select', selector: '#model_openai_select', key: 'openai_model', wiped: false },
    { id: 'claude', label: 'Claude', kind: 'select', selector: '#model_claude_select', key: 'claude_model', wiped: false, note: '이름에 -v가 들어가면 실리태번이 -로 바꿔 저장해요.' },
    { id: 'makersuite', label: 'Google AI Studio', kind: 'select', selector: '#model_google_select', key: 'google_model', wiped: false },
    { id: 'vertexai', label: 'Google Vertex AI', kind: 'select', selector: '#model_vertexai_select', key: 'vertexai_model', wiped: false },
    { id: 'openrouter', label: 'OpenRouter', kind: 'select', selector: '#model_openrouter_select', key: 'openrouter_model', wiped: true },
    { id: 'ai21', label: 'AI21', kind: 'select', selector: '#model_ai21_select', key: 'ai21_model', wiped: false, note: 'j2로 시작하는 이름은 실리태번이 기본 모델로 바꿔요.' },
    { id: 'mistralai', label: 'MistralAI', kind: 'select', selector: '#model_mistralai_select', key: 'mistralai_model', wiped: true },
    { id: 'cohere', label: 'Cohere', kind: 'select', selector: '#model_cohere_select', key: 'cohere_model', wiped: false },
    { id: 'perplexity', label: 'Perplexity', kind: 'select', selector: '#model_perplexity_select', key: 'perplexity_model', wiped: false },
    { id: 'groq', label: 'Groq', kind: 'select', selector: '#model_groq_select', key: 'groq_model', wiped: true },
    { id: 'electronhub', label: 'Electron Hub', kind: 'select', selector: '#model_electronhub_select', key: 'electronhub_model', wiped: true },
    { id: 'chutes', label: 'Chutes', kind: 'select', selector: '#model_chutes_select', key: 'chutes_model', wiped: true },
    { id: 'nanogpt', label: 'NanoGPT', kind: 'select', selector: '#model_nanogpt_select', key: 'nanogpt_model', wiped: true },
    { id: 'deepseek', label: 'DeepSeek', kind: 'select', selector: '#model_deepseek_select', key: 'deepseek_model', wiped: true },
    { id: 'aimlapi', label: 'AI/ML API', kind: 'select', selector: '#model_aimlapi_select', key: 'aimlapi_model', wiped: true },
    { id: 'xai', label: 'xAI (Grok)', kind: 'select', selector: '#model_xai_select', key: 'xai_model', wiped: true },
    { id: 'pollinations', label: 'Pollinations', kind: 'select', selector: '#model_pollinations_select', key: 'pollinations_model', wiped: true },
    { id: 'moonshot', label: 'Moonshot AI', kind: 'select', selector: '#model_moonshot_select', key: 'moonshot_model', wiped: true },
    { id: 'fireworks', label: 'Fireworks AI', kind: 'select', selector: '#model_fireworks_select', key: 'fireworks_model', wiped: true },
    { id: 'cometapi', label: 'CometAPI', kind: 'select', selector: '#model_cometapi_select', key: 'cometapi_model', wiped: true },
    { id: 'siliconflow', label: 'SiliconFlow', kind: 'select', selector: '#model_siliconflow_select', key: 'siliconflow_model', wiped: true },
    { id: 'workers_ai', label: 'Cloudflare Workers AI', kind: 'select', selector: '#model_workers_ai_select', key: 'workers_ai_model', wiped: true },
    { id: 'zai', label: 'Z.AI (GLM)', kind: 'select', selector: '#model_zai_select', key: 'zai_model', wiped: false },
    { id: 'minimax', label: 'MiniMax', kind: 'select', selector: '#model_minimax_select', key: 'minimax_model', wiped: false },
    {
        id: 'azure_openai', label: 'Azure OpenAI', kind: 'select', selector: '#azure_openai_model', key: 'azure_openai_model', wiped: true,
        note: '연결하면 실리태번이 배포된 모델 하나로 목록을 덮어써요.',
    },
    {
        id: 'custom', label: 'Custom (OpenAI 호환)', kind: 'custom', selector: '#model_custom_select', key: 'custom_model', wiped: true,
        input: '#custom_model_id', datalist: '#model_custom_select_fill',
        note: '이 공급자는 원래 이름을 직접 칠 수 있어요. 등록해 두면 입력칸 자동완성과 목록에 같이 나와요.',
    },
];

const BY_ID = new Map(SOURCES.map(source => [source.id, source]));

export function sourceById(id) {
    return BY_ID.get(String(id ?? '')) ?? null;
}

/** 화면에 있는 컨트롤들. 없으면 빈 배열 (그 공급자 폼이 아직 안 열렸을 때) */
export function controlsOf(source) {
    const found = [];
    for (const selector of [source.selector, source.datalist]) {
        if (!selector) continue;
        const element = document.querySelector(selector);
        if (element) found.push(element);
    }
    return found;
}

/** 실리태번이 고른 모델을 저장하는 자리 (oai_settings의 키) */
export function settingsKeyOf(source) {
    return source.key;
}
