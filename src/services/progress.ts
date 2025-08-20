export interface WordProgress {
    word: string;
    level: number; // 旧等级(兼容)
    correct: number;
    wrong: number;
    nextReview?: number; // 下次复习时间戳
    ef?: number; // SM-2 E-Factor
    interval?: number; // 上一次使用的间隔(天)
    lastReview?: number; // 上一次复习时间
    version?: number; // schema 版本
}

export type ProgressMap = Record<string, WordProgress>;

const KEY = 'cet6_progress_v2';
const SCHEMA_VERSION = 2;

function migrate(p: WordProgress): WordProgress {
    if (!p.version) {
        // v1 -> v2 初始化 SM-2 字段
        return { ...p, ef: 2.5, interval: 0, lastReview: 0, version: SCHEMA_VERSION };
    }
    return p;
}

function load(): ProgressMap {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const parsed: ProgressMap = JSON.parse(raw);
            for (const k in parsed) parsed[k] = migrate(parsed[k]);
            return parsed;
        }
    } catch { }
    return {};
}

function save(map: ProgressMap) {
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { }
}

export interface UseProgressResult {
    progress: ProgressMap;
    updateOutcome: (word: string, quality: number) => void; // 0-5
    resetProgress: () => void;
}

import { useCallback, useState } from 'react';

export function useProgress(): UseProgressResult {
    const [progress, setProgress] = useState<ProgressMap>(() => load());

    const persist = useCallback((next: ProgressMap) => {
        setProgress(next);
        save(next);
    }, []);

    const updateOutcome = useCallback((word: string, quality: number) => {
        persist(updateOne(progress, word, quality));
    }, [progress, persist]);

    const resetProgress = useCallback(() => {
        persist({});
    }, [persist]);

    return { progress, updateOutcome, resetProgress };
}

function updateOne(map: ProgressMap, word: string, quality: number): ProgressMap {
    const now = Date.now();
    const prev = map[word] || { word, level: 0, correct: 0, wrong: 0, ef: 2.5, interval: 0, lastReview: 0, version: SCHEMA_VERSION } as WordProgress;
    let { ef = 2.5, interval = 0, level = 0, correct = 0, wrong = 0 } = prev;
    // 统计
    if (quality >= 3) correct += 1; else wrong += 1;
    // SM-2 算法调整 EF
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ef < 1.3) ef = 1.3;
    let nextIntervalDays;
    if (quality < 3) {
        nextIntervalDays = 0.2; // 约 12 分钟
        level = Math.max(0, level - 1);
    } else {
        if (interval === 0) nextIntervalDays = 0.5; // 12h
        else if (interval < 1) nextIntervalDays = 1; // 1d
        else nextIntervalDays = interval * ef;
        level = Math.min(5, level + 1);
    }
    const nextReview = now + nextIntervalDays * 24 * 60 * 60 * 1000;
    const updated: WordProgress = { word, level, correct, wrong, nextReview, ef, interval: nextIntervalDays, lastReview: now, version: SCHEMA_VERSION };
    return { ...map, [word]: updated };
}

export function getLevelDisplay(level?: number) {
    const stars = '★★★★★';
    return stars.slice(0, level || 0);
}
