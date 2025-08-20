// 词汇补充数据加载 (开放/自制数据 JSON)
// 把实际的数据放在 public/data/enrich.json (或多个拆分)，结构示例见 enrich.sample.json
// 许可要求：请仅使用公共领域或允许再分发 (如 CC0 / CC-BY 并注明) 的例句/搭配/派生信息。

import { Cet6Word } from './cet6';

export interface EnrichEntry { word: string; freq?: number; example?: string; phrases?: string[]; note?: string; exampleZh?: string; phraseTranslations?: string[]; synonyms?: string[]; mnemonic?: string; }

const OVERRIDE_KEY = 'enrich_overrides_v1';
let overrides: Record<string, EnrichEntry> = {};

function loadOverrides() {
    try {
        const raw = localStorage.getItem(OVERRIDE_KEY);
        if (!raw) return;
        const json = JSON.parse(raw);
        if (json && typeof json === 'object') overrides = json;
    } catch { /* ignore */ }
}

function saveOverrides() {
    try { localStorage.setItem((OVERRIDE_KEY), JSON.stringify(overrides)); } catch { /* ignore */ }
}

let enrichMap: Record<string, EnrichEntry> | null = null;
let loading: Promise<void> | null = null;

export async function loadEnrich(): Promise<void> {
    if (enrichMap) return; if (loading) return loading;
    loading = (async () => {
        const urls = ['/data/enrich.json', '/data/enrich.sample.json'];
        for (const url of urls) {
            try {
                const resp = await fetch(url, { cache: 'no-cache' });
                if (!resp.ok) continue;
                const json = await resp.json();
                if (Array.isArray(json)) {
                    enrichMap = {};
                    json.forEach((e: EnrichEntry) => { if (e.word) enrichMap![e.word.toLowerCase()] = e; });
                    break;
                }
            } catch {/* ignore */ }
        }
        if (!enrichMap) enrichMap = {}; // fallback empty
        loadOverrides();
    })();
    return loading;
}

export function mergeEnrich(words: Cet6Word[]): Cet6Word[] {
    if (!enrichMap) return words;
    return words.map(w => {
        const e = enrichMap![w.word] || overrides[w.word];
        if (e) {
            if (e.example && !w.example) w.example = e.example;
            if (e.phrases && (!w.phrases || w.phrases.length <= 2)) w.phrases = e.phrases;
            if (e.freq) w.freq = e.freq;
            if ((e as any).exampleZh && !(w as any).exampleZh) (w as any).exampleZh = (e as any).exampleZh;
            if ((e as any).phraseTranslations && !(w as any).phraseTranslations) (w as any).phraseTranslations = (e as any).phraseTranslations;
            if ((e as any).synonyms && !(w as any).synonyms) (w as any).synonyms = (e as any).synonyms;
            if ((e as any).mnemonic && !(w as any).mnemonic) (w as any).mnemonic = (e as any).mnemonic;
        }
        // 不再自动生成例句与短语，保持为空，留待 AI 或用户手动填写
        return w;
    });
}

export function upsertOverride(entry: EnrichEntry) {
    if (!entry.word) return;
    overrides[entry.word] = { ...(overrides[entry.word] || {}), ...entry };
    saveOverrides();
}

export function exportOverrides(): string {
    return JSON.stringify(Object.values(overrides), null, 2);
}

export function clearOverrides() {
    overrides = {}; saveOverrides();
}
