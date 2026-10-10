// SillyTavern 1.19 chat/text completion sources. Hosts identify the seller, not the model author.
const entry = (label, hosts, url, extra = {}) => ({ label, hosts: hosts.split(' '), url, ...extra });
export const PROVIDERS = Object.freeze({
    anthropic: entry('Anthropic', 'api.anthropic.com', 'https://platform.claude.com/docs/en/about-claude/pricing'),
    openai: entry('OpenAI', 'api.openai.com', 'https://developers.openai.com/api/docs/pricing'),
    deepseek: entry('DeepSeek', 'api.deepseek.com', 'https://api-docs.deepseek.com/quick_start/pricing/'),
    gemini: entry('Google Gemini', 'generativelanguage.googleapis.com', 'https://ai.google.dev/gemini-api/docs/pricing', { note: '유료 계정의 공개 단가예요. 무료 할당량·검색·캐시 보관료는 별도예요.' }),
    vertex: entry('Google Vertex AI', 'aiplatform.googleapis.com us-central1-aiplatform.googleapis.com', 'https://cloud.google.com/vertex-ai/generative-ai/pricing', { note: '종량제 공개 단가예요. 예약 처리량·지역·계약 할인·검색·보관료는 별도예요.' }),
    mistral: entry('Mistral', 'api.mistral.ai', 'https://docs.mistral.ai/inference/pricing'),
    cohere: entry('Cohere', 'api.cohere.ai api.cohere.com', 'https://cohere.com/pricing', { note: '프로덕션 API 공개 단가예요. 평가 키·계약형 모델은 계정 요금을 확인하세요.' }),
    ai21: entry('AI21', 'api.ai21.com', 'https://www.ai21.com/pricing/'),
    perplexity: entry('Perplexity', 'api.perplexity.ai', 'https://docs.perplexity.ai/docs/getting-started/pricing', { reported: true, note: '검색·요청료가 별도예요. 응답에 총 비용이 있으면 그 값을 사용해요.' }),
    groq: entry('Groq', 'api.groq.com', 'https://console.groq.com/docs/models'),
    xai: entry('xAI', 'api.x.ai', 'https://docs.x.ai/developers/pricing'),
    moonshot: entry('Moonshot / Kimi', 'api.moonshot.ai api.kimi.ai', 'https://platform.kimi.ai/docs/pricing/chat'),
    moonshot_cn: entry('Moonshot 중국', 'api.moonshot.cn', 'https://platform.moonshot.cn/docs/pricing/chat', { currency: 'CNY' }),
    zai: entry('Z.AI', 'api.z.ai', 'https://docs.z.ai/guides/overview/pricing'),
    siliconflow: entry('SiliconFlow', 'api.siliconflow.com', 'https://www.siliconflow.com/pricing'),
    siliconflow_cn: entry('SiliconFlow 중국', 'api.siliconflow.cn', 'https://siliconflow.cn/pricing', { currency: 'CNY' }),
    minimax: entry('MiniMax', 'api.minimax.io', 'https://platform.minimax.io/docs/guides/pricing-paygo'),
    minimax_cn: entry('MiniMax 중국', 'api.minimaxi.com', 'https://platform.minimaxi.com/docs/guides/pricing-paygo', { currency: 'CNY' }),
    openrouter: entry('OpenRouter', 'openrouter.ai', 'https://openrouter.ai/models', { reported: true, minimum: true, note: '목록 단가는 시작 가격이에요. 실제 경유 제공처·라우팅에 따라 달라져 요청 응답의 비용을 사용해요.' }),
    chutes: entry('Chutes', 'llm.chutes.ai', 'https://chutes.ai/pricing', { note: '종량제 단가예요. 구독·크레딧 혜택은 계정에서 확인하세요.' }),
    electronhub: entry('ElectronHub', 'api.electronhub.ai', 'https://www.electronhub.ai/pricing'),
    nanogpt: entry('NanoGPT', 'nano-gpt.com', 'https://nano-gpt.com/pricing', { note: '종량제 단가예요. 구독에 포함되는 사용량은 계정에서 확인하세요.' }),
    aimlapi: entry('AI/ML API', 'api.aimlapi.com', 'https://aimlapi.com/ai-ml-api-pricing'),
    pollinations: entry('Pollinations', 'gen.pollinations.ai', 'https://enter.pollinations.ai', { currency: 'Pollen', note: 'Pollen 기준 단가예요. 무료 지급분·구매 할인은 별도이며 USD 합계에 섞지 않아요.' }),
    pollinations_free: entry('Pollinations 익명', 'text.pollinations.ai', 'https://pollinations.ai', { billing: 'free', note: '익명 무료 경로예요. 사용 제한·모델 제공 여부는 서비스 정책을 따라요.' }),
    fireworks: entry('Fireworks', 'api.fireworks.ai', 'https://docs.fireworks.ai/serverless/pricing'),
    cometapi: entry('CometAPI', 'api.cometapi.com', 'https://www.cometapi.com/pricing/'),
    azure: entry('Azure OpenAI', '', 'https://azure.microsoft.com/en-us/pricing/details/azure-openai/', { billing: 'deployment', note: '배포 이름만으로 모델·지역·Global/Data Zone/Regional·계약 요금을 알 수 없어요. Azure 배포 요금표를 확인하세요.' }),
    workers: entry('Cloudflare Workers AI', 'api.cloudflare.com', 'https://developers.cloudflare.com/workers-ai/platform/pricing/', { note: '유료 초과 사용량의 토큰 환산 단가예요. 하루 무료 Neuron 할당량·계정 기본료는 별도예요.' }),
    together: entry('Together AI', 'api.together.xyz api.together.ai', 'https://www.together.ai/pricing'),
    featherless: entry('Featherless', 'api.featherless.ai', 'https://featherless.ai/pricing', { billing: 'plan', note: 'Chat 월 US$25 정액제 / Developer US$50부터 충전·토큰 과금 / Business 별도 계약. 연결 주소만으로 플랜을 구분할 수 없어 요청 비용은 미확인이에요.' }),
    infermatic: entry('Infermatic', 'api.totalgpt.ai api.infermatic.ai', 'https://infermatic.ai/pricing/', { billing: 'plan', note: 'Essential US$9 / Standard US$16 / Plus US$20 월정액. 일부 프리미엄 모델은 크레딧을 따로 사용해요. 요청별 금액으로 나누지 않아요.' }),
    dreamgen: entry('DreamGen', 'dreamgen.com api.dreamgen.com', 'https://dreamgen.com/pricing', { billing: 'plan', note: '월정액·일일/월간 크레딧·모델별 차감 방식이에요. 선택한 플랜과 모델의 요금표를 확인하세요.' }),
    mancer: entry('Mancer', 'neuro.mancer.tech', 'https://mancer.tech/models', { currency: 'Mancer credit', note: 'Mancer 크레딧 단가예요. 구매한 크레딧의 환율은 USD 합계와 구분해요.' }),
    huggingface: entry('Hugging Face', 'router.huggingface.co api-inference.huggingface.co', 'https://huggingface.co/docs/inference-providers/pricing', { billing: 'deployment', note: '경유 제공처의 단가·월간 크레딧·전용 Endpoint 사용 시간에 따라 달라져요. 경유 제공처를 모르면 비용을 계산하지 않아요.' }),
    novelai: entry('NovelAI', 'api.novelai.net text.novelai.net', 'https://novelai.net/', { billing: 'plan', note: '텍스트 생성은 월정액 플랜 기준이에요(US$10부터). 구독료를 요청당 토큰 가격으로 나누지 않아요. 이미지 Anlas는 별도예요.' }),
    horde: entry('AI Horde', 'aihorde.net', 'https://aihorde.net/', { billing: 'free', note: '분산형 무료 서비스예요. 우선순위 포인트인 kudos는 현금 비용에 합산하지 않아요.' }),
    local: entry('직접 운영 서버', '', '', { billing: 'local', note: 'Ollama·KoboldCpp·llama.cpp·Text Generation WebUI·vLLM·Aphrodite·Tabby 등 직접 운영 경로예요. 서버 임대료·전기료는 제공처 토큰 단가와 달라 요청 비용으로 계산하지 않아요.' }),
});

export const CHAT_PROVIDER = Object.freeze({ openai:'openai', claude:'anthropic', anthropic:'anthropic', openrouter:'openrouter', ai21:'ai21', makersuite:'gemini', vertexai:'vertex', mistralai:'mistral', cohere:'cohere', perplexity:'perplexity', groq:'groq', chutes:'chutes', electronhub:'electronhub', nanogpt:'nanogpt', deepseek:'deepseek', aimlapi:'aimlapi', xai:'xai', pollinations:'pollinations', moonshot:'moonshot', fireworks:'fireworks', cometapi:'cometapi', azure_openai:'azure', zai:'zai', siliconflow:'siliconflow', minimax:'minimax', workers_ai:'workers' });
export const TEXT_PROVIDER = Object.freeze({ mancer:'mancer', togetherai:'together', infermaticai:'infermatic', dreamgen:'dreamgen', openrouter:'openrouter', featherless:'featherless', huggingface:'huggingface', ooba:'local', vllm:'local', aphrodite:'local', tabby:'local', koboldcpp:'local', llamacpp:'local', ollama:'local', generic:'other' });
export const PROXY_SOURCES = new Set(['openai','claude','anthropic','makersuite','vertexai','mistralai','deepseek','xai','moonshot','zai']);

export function providerAt(origin) {
    if (!origin.startsWith('https://')) return 'other';
    const host = new URL(origin).host;
    for (const [id, info] of Object.entries(PROVIDERS)) if (info.hosts.includes(host)) return id;
    if (/^[a-z0-9-]+\.openai\.azure\.com$/.test(host) || /^[a-z0-9-]+\.services\.ai\.azure\.com$/.test(host)) return 'azure';
    if (/^[a-z0-9-]+-aiplatform\.googleapis\.com$/.test(host)) return 'vertex';
    if (/^[a-z0-9-]+\.(?:us|eu)\.endpoints\.huggingface\.cloud$/.test(host)) return 'huggingface';
    return 'other';
}
