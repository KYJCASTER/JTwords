// Gemini AI 集成：用户自带 API Key 调用 Google Gemini 模型生成例句 / 短语 / 翻译。
// 注意：API Key 保存在 localStorage，仅在本地浏览器使用，请勿在公共设备留存。
// 文档参考（可能会更新）：https://ai.google.dev/  请求格式使用 v1beta generateContent。

export interface AIGenerateResult {
    example?: string;
    example_zh?: string;
    phrases?: string[];
    phrase_translations?: string[]; // 与 phrases 对应的中文
    note?: string; // 其它信息
}

const LS_KEY = 'gemini_api_key_v1';
const LS_MODEL = 'gemini_model_name_v1';

export function setGeminiKey(key: string) { localStorage.setItem(LS_KEY, key.trim()); }
export function getGeminiKey(): string | null { return localStorage.getItem(LS_KEY) || null; }
export function clearGeminiKey() { localStorage.removeItem(LS_KEY); }
export function hasGeminiKey(): boolean { return !!getGeminiKey(); }
export function setGeminiModel(model: string) { localStorage.setItem(LS_MODEL, model.trim()); }
// 默认改为使用 2.5-flash 体验（更快更便宜）；若用户已在 localStorage 设定则沿用其值
export function getGeminiModel(): string { return localStorage.getItem(LS_MODEL) || 'gemini-2.5-flash-exp-02-05'; }
// 目前界面仅提供 2.5-pro 与 2.5-flash 选择；如需扩展请在 WordList 下拉中添加。

interface RawGeminiResponse { candidates?: { content?: { parts?: { text?: string }[] } }[]; }

function buildPrompt(word: string, translation: string) {
    return `You are an English learning assistant. Generate high-quality example and 4-6 common collocations for the target CET-6 word. Output STRICT JSON only.\nTarget word: ${word}\nExisting Chinese meaning: ${translation}\nRequirements:\n1. Provide one concise, natural English example sentence USING the word (inflect if needed).\n2. Provide a natural Chinese translation of the example.\n3. Provide 4-6 useful English collocations/phrases containing or strongly related to the word (avoid trivial forms).\n4. Provide Chinese translations for each phrase (order aligned).\nJSON schema: {"example":"...","example_zh":"...","phrases":["..."],"phrase_translations":["..."],"note":"optional short note"}`;
}

export async function generateWithGemini(word: string, translation: string): Promise<AIGenerateResult> {
    const key = getGeminiKey();
    if (!key) throw new Error('未配置 Gemini API Key');
    const model = encodeURIComponent(getGeminiModel());
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const prompt = buildPrompt(word, translation);
    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 512 }
    };
    let resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) {
        // 处理常见问题：404 多半是模型标识不存在；尝试自动回退
        if (resp.status === 404) {
            const sel = getGeminiModel();
            let fallback: string | null = null;
            if (/2\.5.*pro/i.test(sel)) fallback = 'gemini-1.5-pro-latest';
            else if (/2\.5.*flash/i.test(sel)) fallback = 'gemini-1.5-flash-latest';
            if (fallback) {
                console.warn('[AI] 模型 404, 回退到', fallback);
                setGeminiModel(fallback);
                return generateWithGemini(word, translation); // 递归一次
            }
        }
        if (resp.status === 403) throw new Error('HTTP 403 权限/配额不足（检查是否开通 API / 计费）');
        if (resp.status === 401) throw new Error('HTTP 401 Key 无效或未授权');
        if (resp.status === 429) throw new Error('HTTP 429 速率或配额超限');
        throw new Error('HTTP ' + resp.status + ' 请求失败');
    }
    const json = await resp.json() as RawGeminiResponse;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // 可能模型会在 JSON 前后加反引号或解释文本——尝试提取第一个 JSON 对象
    const match = text.match(/\{[\s\S]*\}/);
    let data: any = {};
    try { data = JSON.parse(match ? match[0] : text); } catch { throw new Error('AI 返回非 JSON: ' + text.slice(0, 120)); }
    // 规范化
    if (typeof data.example !== 'string') data.example = undefined;
    if (typeof data.example_zh !== 'string') data.example_zh = undefined;
    if (!Array.isArray(data.phrases)) data.phrases = undefined; else data.phrases = data.phrases.map((p: any) => String(p).trim()).filter(Boolean);
    if (!Array.isArray(data.phrase_translations)) data.phrase_translations = undefined; else data.phrase_translations = data.phrase_translations.map((p: any) => String(p).trim()).filter(Boolean);
    // 兼容字段映射（外部使用 exampleZh / phraseTranslations）
    (data as any).exampleZh = data.example_zh;
    (data as any).phraseTranslations = data.phrase_translations;
    return data as AIGenerateResult;
}

// 拉取可用模型列表（仅名称），用于调试 404 问题
export async function listModels(): Promise<string[]> {
    const key = getGeminiKey();
    if (!key) throw new Error('未配置 Key');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('列出模型失败 HTTP ' + resp.status);
    const data = await resp.json();
    if (!data.models) return [];
    return data.models.map((m: any) => m.name?.replace(/^models\//, '')).filter(Boolean);
}

export async function testGeminiKey(): Promise<string> {
    try {
        const r = await generateWithGemini('example', 'n. 例子; 示例');
        if (r.example) return '成功';
        return '响应成功但未得到例句';
    } catch (e: any) {
        return '失败: ' + (e?.message || e);
    }
}
