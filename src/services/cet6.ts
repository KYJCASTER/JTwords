// CET-6 词库服务：支持远程获取 + 本地缓存 + 分页切片。
// 数据来源（开放仓库，含释义与音标）: https://github.com/mahavivo/english-wordlists
// 使用 raw.githubusercontent.com 进行获取，若失败则回退到内置少量样例。

export interface Cet6Word { word: string; translation: string; phonetic?: string; example?: string; phrases?: string[]; freq?: number; }

const REMOTE_URL = 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET6_edited.txt';
const LS_KEY = 'cet6_words_v1';
const LS_TIME_KEY = 'cet6_words_v1_time';
// 允许缓存的最长时间（毫秒）— 7 天，可根据需要调整
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// 内置后备最小集合（网络失败时）
const fallbackData: Cet6Word[] = [
    { word: 'abandon', translation: 'v. 放弃；抛弃', phonetic: 'əˈbændən', example: 'He decided to abandon the burning car.', phrases: ['abandon hope', 'abandon oneself to'] },
    { word: 'abnormal', translation: 'adj. 反常的；异常的', phonetic: 'æbˈnɔːməl', example: 'The device detected an abnormal signal pattern.', phrases: ['abnormal behavior', 'abnormal growth'] },
    { word: 'abolish', translation: 'v. 废除；取消', phonetic: 'əˈbɒlɪʃ', example: 'They voted to abolish the outdated law.', phrases: ['abolish slavery', 'abolish a rule'] },
    { word: 'accelerate', translation: 'v. (使)加速；促进', phonetic: 'əkˈseləreɪt', example: 'We need to accelerate the approval process.', phrases: ['accelerate growth', 'accelerate development'] },
    { word: 'accompany', translation: 'v. 陪伴；伴随', phonetic: 'əˈkʌmpəni', example: 'She will accompany him to the conference.', phrases: ['accompany with', 'accompany on the piano'] },
    { word: 'accomplish', translation: 'v. 完成；实现', phonetic: 'əˈkɒmplɪʃ', example: 'He managed to accomplish all his goals.', phrases: ['accomplish a task', 'accomplish objectives'] },
];

let wordsCache: Cet6Word[] | null = null;
let loadingPromise: Promise<Cet6Word[]> | null = null;
let workerSupported = typeof Worker !== 'undefined';
let worker: Worker | null = null;

/** 解析远程文本
 * 文本格式较不规则，核心策略：
 * 1. 尝试匹配  “word [phonetic] rest”  单行格式。
 * 2. 若出现“word”单独一行，下一行以 [ 开头，则合并。
 * 3. 过滤非字母开头或过短 token。
 */
function parseRaw(text: string): Cet6Word[] {
    const lines = text.split(/\r?\n/);
    const result: Cet6Word[] = [];
    let pending: string | null = null;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        // 单行完整：word [phonetic] meaning
        const single = line.match(/^([a-zA-Z][a-zA-Z\-]*)\s+\[([^\]]+)\]\s+(.+)$/);
        if (single) {
            const word = single[1].toLowerCase();
            const phon = single[2].trim();
            const meaning = cleanupMeaning(single[3]);
            pushUnique(result, enrich({ word, phonetic: phon, translation: meaning }));
            pending = null;
            continue;
        }

        // 可能是单独的单词行
        if (/^[a-zA-Z][a-zA-Z\-]*$/.test(line)) {
            pending = line.toLowerCase();
            continue;
        }

        // 处理紧跟单词后的音标 + 释义行
        if (pending && /^\[[^\]]+\]/.test(line)) {
            const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
            if (m) {
                const phon = m[1].trim();
                const meaning = cleanupMeaning(m[2]);
                pushUnique(result, enrich({ word: pending, phonetic: phon, translation: meaning || '(释义缺失)' }));
                pending = null;
                continue;
            }
        }

        // 其余行忽略
    }
    // 去掉明显无效释义
    return result.filter(w => w.translation && w.translation.length > 1);
}

// 简易例句与词组占位扩展，可后续替换为真实语料
function enrich(w: Cet6Word): Cet6Word {
    if (!w.example) w.example = `This is an example sentence for "${w.word}".`;
    if (!w.phrases) w.phrases = [`${w.word} + n.`, `${w.word} + v.`];
    return w;
}

function cleanupMeaning(raw: string): string {
    return raw
        .replace(/\s+/g, ' ')
        .replace(/\|\|.*$/, '') // 去掉后续示例/搭配（保留前半）
        .replace(/\s*\([^)]*?\)\s*/g, m => m.length > 8 ? ' ' : m) // 保留短的词性注释
        .trim();
}

function pushUnique(arr: Cet6Word[], w: Cet6Word) {
    if (!arr.find(x => x.word === w.word)) arr.push(w);
}

/** 尝试从 localStorage 读取缓存 */
function loadFromCache(): Cet6Word[] | null {
    try {
        const ts = localStorage.getItem(LS_TIME_KEY);
        const data = localStorage.getItem(LS_KEY);
        if (!ts || !data) return null;
        if (Date.now() - Number(ts) > MAX_AGE) return null;
        const parsed = JSON.parse(data) as Cet6Word[];
        if (!Array.isArray(parsed) || parsed.length < 100) return null; // 简单质量门槛
        return parsed;
    } catch { return null; }
}

import { loadEnrich, mergeEnrich } from './enrich';

function saveToCache(list: Cet6Word[]) {
    try {
        // 仅缓存基础字段，AI 生成内容通过 overrides + mergeEnrich 注入
        const slim = list.map(w => ({ word: w.word, translation: w.translation, phonetic: w.phonetic, freq: (w as any).freq }));
        localStorage.setItem(LS_KEY, JSON.stringify(slim));
        localStorage.setItem(LS_TIME_KEY, Date.now().toString());
    } catch { /* 忽略 */ }
}

/** 确保词库加载（远程+缓存） */
export function ensureCet6Loaded(forceRefresh = false): Promise<Cet6Word[]> {
    if (wordsCache && !forceRefresh) return Promise.resolve(wordsCache);
    if (loadingPromise && !forceRefresh) return loadingPromise;

    loadingPromise = (async () => {
        if (!forceRefresh) {
            const cached = loadFromCache();
            if (cached) {
                // 之前直接返回缓存，导致未重新应用 overrides（AI 生成内容存于 overrides 中），刷新后看不到
                wordsCache = cached;
                try {
                    await loadEnrich();
                    wordsCache = mergeEnrich(wordsCache); // 覆盖/补充例句、短语等
                } catch { /* ignore enrich errors */ }
                return wordsCache;
            }
        }
        // 优先尝试 Worker（避免主线程卡顿）
        if (workerSupported && !worker) {
            try {
                worker = new Worker(new URL('../workers/cet6Worker.ts', import.meta.url), { type: 'module' });
            } catch (e) {
                workerSupported = false; worker = null; console.warn('[cet6] Worker 创建失败, fallback', e);
            }
        }
        if (worker) {
            const parsed = await new Promise<Cet6Word[]>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('worker timeout')), 20_000);
                worker!.onmessage = (ev: MessageEvent) => {
                    clearTimeout(timer);
                    const data = ev.data as { ok: boolean; words?: Cet6Word[]; error?: string };
                    if (data.ok && data.words) resolve(data.words); else reject(new Error(data.error || 'worker error'));
                };
                worker!.postMessage({ url: REMOTE_URL });
            }).catch(err => { console.warn('[cet6] Worker 失败，回退主线程', err); return [] as Cet6Word[]; });
            if (parsed.length > 100) {
                shuffleInPlace(parsed);
                await loadEnrich();
                const merged = mergeEnrich(parsed);
                wordsCache = merged; saveToCache(merged); loadingPromise = null; return merged;
            }
        }
        // 主线程直接抓取
        try {
            const resp = await fetch(REMOTE_URL, { cache: 'no-cache' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const text = await resp.text();
            const parsed = parseRaw(text);
            if (parsed.length < 100) throw new Error('parsed size too small: ' + parsed.length);
            shuffleInPlace(parsed);
            await loadEnrich();
            const merged = mergeEnrich(parsed);
            wordsCache = merged; saveToCache(merged); return wordsCache;
        } catch (err) {
            console.warn('[cet6] 远程获取失败，使用后备数据', err);
            const copy = [...fallbackData]; shuffleInPlace(copy);
            await loadEnrich();
            const merged = mergeEnrich(copy);
            wordsCache = merged; return wordsCache;
        } finally { loadingPromise = null; }
    })();
    return loadingPromise;
}

export function getCet6Total(): number { return wordsCache ? wordsCache.length : (fallbackData.length); }
export function getCet6Page(page = 1, pageSize = 50): Cet6Word[] {
    const data = wordsCache || fallbackData;
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
}

export function clearCet6Cache() {
    try {
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(LS_TIME_KEY);
    } catch { /* ignore */ }
    wordsCache = null;
}

export interface Cet6LoadState {
    loading: boolean;
    error: string | null;
    total: number;
}

function shuffleInPlace(arr: Cet6Word[]) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

