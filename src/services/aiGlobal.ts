// 全局 AI 配置 + 批量生成功能（集中管理 API Key、模型、参数、任务队列）
import { generateWithGemini, setGeminiKey, getGeminiKey, setGeminiModel, getGeminiModel } from './ai';
import { upsertOverride } from './enrich';
import type { Cet6Word } from './cet6';

export interface AISettings { model: string; temperature: number; topP: number; maxTokens: number; autoGenerate: boolean; }
const DEFAULT_SETTINGS: AISettings = { model: getGeminiModel(), temperature: 0.5, topP: 0.9, maxTokens: 512, autoGenerate: false };

const LS_AI_CFG = 'ai_global_settings_v1';

let settings: AISettings = (() => {
    try { const raw = localStorage.getItem(LS_AI_CFG); if (raw) { const parsed = JSON.parse(raw); return { ...DEFAULT_SETTINGS, ...parsed }; } } catch { } return { ...DEFAULT_SETTINGS };
})();

function persist() { try { localStorage.setItem(LS_AI_CFG, JSON.stringify(settings)); } catch { } }

export function getAISettings(): AISettings { return settings; }
export function updateAISettings(partial: Partial<AISettings>) { settings = { ...settings, ...partial }; if (partial.model) setGeminiModel(partial.model); persist(); }
export function setGlobalAPIKey(key: string) { setGeminiKey(key); }
export function getGlobalAPIKey(): string | null { return getGeminiKey(); }

// 简易批量队列
export interface AITaskResult { word: string; ok: boolean; error?: string; updated?: boolean; }

export async function batchGenerate(words: Cet6Word[], limit = 10, onProgress?: (done: number, total: number, w: string) => void): Promise<AITaskResult[]> {
    const key = getGlobalAPIKey(); if (!key) throw new Error('未设置全局 API Key');
    const results: AITaskResult[] = [];
    for (let i = 0; i < words.length && i < limit; i++) {
        const w = words[i];
        // 已有例句且已有短语则直接跳过，减少重复消耗
        if (w.example && w.phrases && w.phrases.length > 0) {
            results.push({ word: w.word, ok: true, updated: false });
            onProgress?.(i + 1, Math.min(words.length, limit), w.word);
            continue;
        }
        try {
            const r = await generateWithGemini(w.word, w.translation);
            const payload: any = { word: w.word }; let changed = false;
            if (r.example && r.example !== w.example) { w.example = r.example; payload.example = r.example; changed = true; }
            if ((r as any).exampleZh && (r as any).exampleZh !== (w as any).exampleZh) { (w as any).exampleZh = (r as any).exampleZh; payload.exampleZh = (r as any).exampleZh; changed = true; }
            if (r.phrases && r.phrases.length) { w.phrases = r.phrases; payload.phrases = r.phrases; changed = true; }
            if ((r as any).phraseTranslations && (r as any).phraseTranslations.length) { (w as any).phraseTranslations = (r as any).phraseTranslations; payload.phraseTranslations = (r as any).phraseTranslations; changed = true; }
            if (changed) upsertOverride(payload);
            results.push({ word: w.word, ok: true, updated: changed });
        } catch (e: any) {
            results.push({ word: w.word, ok: false, error: e?.message || String(e) });
        }
        onProgress?.(i + 1, Math.min(words.length, limit), w.word);
    }
    return results;
}

// 针对单词若缺失例句或短语尝试自动生成（受 autoGenerate 与 API Key 控制）
export async function generateIfMissing(w: Cet6Word): Promise<boolean> {
    if (!settings.autoGenerate) return false;
    const key = getGlobalAPIKey(); if (!key) return false;
    const need = !w.example || !w.phrases || w.phrases.length === 0;
    if (!need) return false;
    try {
        const r = await generateWithGemini(w.word, w.translation);
        const payload: any = { word: w.word }; let changed = false;
        if (r.example && r.example !== w.example) { w.example = r.example; payload.example = r.example; changed = true; }
        if ((r as any).exampleZh && (r as any).exampleZh !== (w as any).exampleZh) { (w as any).exampleZh = (r as any).exampleZh; payload.exampleZh = (r as any).exampleZh; changed = true; }
        if (r.phrases && r.phrases.length) { w.phrases = r.phrases; payload.phrases = r.phrases; changed = true; }
        if ((r as any).phraseTranslations && (r as any).phraseTranslations.length) { (w as any).phraseTranslations = (r as any).phraseTranslations; payload.phraseTranslations = (r as any).phraseTranslations; changed = true; }
        if (changed) upsertOverride(payload);
        return changed;
    } catch { return false; }
}
