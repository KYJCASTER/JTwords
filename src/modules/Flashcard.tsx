import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Cet6Word } from '../services/cet6';
import { ProgressMap, getLevelDisplay } from '../services/progress';

interface Props { words: Cet6Word[]; progress: ProgressMap; onOutcome: (word: string, quality: number) => void; }

// Anki 风格闪卡组件
export const Flashcard: React.FC<Props> = ({ words, progress, onOutcome }) => {
    // 移除反向模式，仅保留正向：单词 -> 释义
    const [autoAdvance, setAutoAdvance] = useState(true);
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false); // 是否已翻转（显示释义）
    const [answered, setAnswered] = useState(false);
    // 移除悬停倾斜效果
    // 自适应高度：测量正反面内容最大高度，动态设置容器高度，防止内容溢出半透明外框
    const frontRef = useRef<HTMLDivElement | null>(null);
    const backRef = useRef<HTMLDivElement | null>(null);
    const [containH, setContainH] = useState<number>(Math.min(window.innerHeight * 0.65, 640));

    const dueWords = useMemo(() => {
        const now = Date.now();
        return words.filter(w => {
            const p = progress[w.word];
            if (!p) return true;
            return !p.nextReview || p.nextReview <= now; // 到期或新词
        });
    }, [words, progress]);

    const current = dueWords[index];

    useEffect(() => { setIndex(0); setFlipped(false); setAnswered(false); }, [dueWords]);

    useEffect(() => {
        function handler(e: KeyboardEvent) {
            if (!current) return;
            if (e.code === 'Space') { e.preventDefault(); if (!answered) setFlipped(f => !f); }
            if (!flipped) return;
            if (['Digit1', 'Numpad1'].includes(e.code)) rate(1); // Again
            else if (['Digit2', 'Numpad2'].includes(e.code)) rate(3); // Hard
            else if (['Digit3', 'Numpad3', 'Enter'].includes(e.code)) rate(4); // Good
            else if (['Digit4', 'Numpad4'].includes(e.code)) rate(5); // Easy
        }
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [flipped, answered, current]);

    const next = useCallback(() => {
        setAnswered(false); setFlipped(false);
        setIndex(i => (i + 1 < dueWords.length ? i + 1 : 0));
    }, [dueWords.length]);

    const rate = (quality: number) => {
        if (!current || !flipped) return;
        onOutcome(current.word, quality);
        setAnswered(true);
        if (autoAdvance) setTimeout(() => next(), 250);
    };

    if (dueWords.length === 0) return <div className="card max-w-lg mx-auto text-center animate-pop"><h2 className="text-2xl font-bold gradient-text mb-4">闪卡</h2><p className="text-sm opacity-70">暂无到期单词，稍后再来 ~</p></div>;
    if (!current) return null;
    const prog = progress[current.word];

    const front = current.word; // 正面显示单词
    const translationFull = current.translation;
    const backWord = current.word;

    function onMove() { /* removed tilt */ }
    function resetTilt() { /* removed tilt */ }

    // 添加额外顶部外边距避免与页面顶栏/按钮重叠
    // 动态高度重算
    useEffect(() => {
        function recalc() {
            // 固定基准最大 640px，且不超过视口 70%，最小 320
            const h = Math.max(320, Math.min(640, Math.floor(window.innerHeight * 0.7)));
            setContainH(h);
        }
        recalc();
        window.addEventListener('resize', recalc);
        return () => window.removeEventListener('resize', recalc);
    }, []);

    return <div className="max-w-4xl mx-auto space-y-8 mt-10 md:mt-14">
        <div className="flex flex-wrap gap-3 items-center text-xs">
            <label className="flex items-center gap-1 cursor-pointer select-none"><input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} />自动下一张</label>
            <span className="opacity-60">({index + 1}/{dueWords.length})</span>
            {prog && <span className="opacity-60">Lv{prog.level} {getLevelDisplay(prog.level)}</span>}
        </div>
        <div
            className="flashcard-outer w-full max-w-4xl"
            // 悬停倾斜已移除
            aria-live="polite"
            style={{ height: containH }}
        >
            <div
                className={`flashcard-inner ${flipped ? 'flipped' : ''}`}
                style={{ transform: `rotateY(${flipped ? 180 : 0}deg)` }}
                onClick={() => { if (!flipped && !answered) setFlipped(true); }}
            >
                <div className="flashcard-face front" ref={frontRef}>
                    <p className="text-3xl font-extrabold leading-snug break-words select-none">{front}</p>
                    {current.phonetic && <p className="mt-4 text-sm opacity-70">/{current.phonetic}/</p>}
                    <button className="mt-8 px-5 py-2 rounded-full bg-secondary text-white btn-press hover-raise shadow-lg shadow-secondary/30" onClick={() => setFlipped(true)}>显示释义 (Space)</button>
                </div>
                <div className="flashcard-face back justify-start items-stretch" ref={backRef}>
                    <p className="text-3xl font-bold mb-4 break-words drop-shadow text-center">{backWord}</p>
                    <div className="space-y-5 px-2 overflow-auto custom-scrollbar w-full" style={{ maxHeight: containH - 170 }}>
                        <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">{translationFull}</p>
                        {current.example && <div className="text-base bg-white/20 dark:bg-white/10 rounded-lg p-4 border border-white/20"><span className="block text-[11px] uppercase tracking-wide opacity-60 mb-1">Example</span><p className="leading-relaxed whitespace-pre-wrap">{current.example}</p>{(current as any).exampleZh && <p className="mt-2 text-sm opacity-85">{(current as any).exampleZh}</p>}</div>}
                        {current.phrases && current.phrases.length > 0 && <div className="text-base bg-white/15 dark:bg-white/5 rounded-lg p-4 border border-white/10"><span className="block text-[11px] uppercase tracking-wide opacity-60 mb-1">Phrases</span><div className="flex flex-wrap gap-2">{current.phrases.slice(0, 10).map((p, i) => <span key={p} className="px-3 py-1 rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/30 text-primary dark:text-primary/90 text-xs md:text-sm">{p}{(current as any).phraseTranslations && (current as any).phraseTranslations[i] ? ' · ' + (current as any).phraseTranslations[i] : ''}</span>)}</div></div>}
                    </div>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <button disabled={answered} onClick={() => rate(1)} className="px-3 py-1 rounded bg-red-500/80 text-white text-xs disabled:opacity-40 shadow">Again(1)</button>
                        <button disabled={answered} onClick={() => rate(3)} className="px-3 py-1 rounded bg-accent text-slate-900 text-xs disabled:opacity-40 shadow">Hard(2)</button>
                        <button disabled={answered} onClick={() => rate(4)} className="px-3 py-1 rounded bg-primary/80 text-white text-xs disabled:opacity-40 shadow">Good(3)</button>
                        <button disabled={answered} onClick={() => rate(5)} className="px-3 py-1 rounded bg-secondary text-white text-xs disabled:opacity-40 shadow">Easy(4)</button>
                    </div>
                    {!autoAdvance && answered && <button onClick={next} className="mt-4 px-4 py-2 rounded bg-secondary/70 text-white text-xs shadow">下一张</button>}
                    {!answered && <button onClick={() => { setFlipped(false); }} className="mt-3 text-[11px] opacity-60 hover:opacity-90">返回</button>}
                </div>
            </div>
        </div>
        <p className="text-center text-[11px] opacity-60">快捷键: Space 翻转 · 1 Again · 2 Hard · 3 Good/Enter · 4 Easy</p>
    </div>;
};

// 需要在全局样式中补充：
// .perspective { perspective: 1200px; }
// .rotate-y-180 { transform: rotateY(180deg); }
// .backface-hidden { backface-visibility: hidden; }
