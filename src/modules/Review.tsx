import React, { useState, useEffect, useMemo } from 'react';
import { Cet6Word } from '../services/cet6';
import { ProgressMap, getLevelDisplay } from '../services/progress';

interface Props { words: Cet6Word[]; progress: ProgressMap; onOutcome: (word: string, quality: number) => void; }

export const Review: React.FC<Props> = ({ words, progress, onOutcome }) => {
    const [index, setIndex] = useState(0);
    const [show, setShow] = useState(false);
    const dueWords = useMemo(() => {
        const now = Date.now();
        return words.filter(w => {
            const p = progress[w.word];
            if (!p) return true;
            return !p.nextReview || p.nextReview <= now;
        });
    }, [words, progress]);

    useEffect(() => { setIndex(0); setShow(false); }, [dueWords]);

    if (dueWords.length === 0) return <p className="text-center opacity-60">暂无到期复习词，稍后再来~</p>;
    const current = dueWords[index];
    const prog = progress[current.word];

    function next() { setShow(false); setIndex(i => (i + 1) % dueWords.length); }

    function mark(quality: number) {
        onOutcome(current.word, quality);
        next();
    }

    return (
        <div className="card max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4 gradient-text">复习模式</h2>
            <p className="text-4xl font-extrabold mb-4">{current.word}</p>
            {current.phonetic && <p className="mb-2 text-sm opacity-70">/{current.phonetic}/</p>}
            {prog && <p className="text-xs opacity-60 mb-2">Lv{prog.level} {getLevelDisplay(prog.level)} ✓{prog.correct}/✗{prog.wrong}</p>}
            {show && <p className="text-lg mt-2">{current.translation}</p>}
            <div className="mt-6 flex justify-center gap-3 flex-wrap">
                <button onClick={() => setShow(s => !s)} className="px-4 py-2 rounded bg-secondary text-white shadow">{show ? '隐藏释义' : '显示释义'}</button>
                {show && (
                    <div className="flex gap-2 flex-wrap justify-center">
                        {[0, 1, 2, 3, 4, 5].map(q => (
                            <button key={q} onClick={() => mark(q)} className={`px-3 py-2 rounded text-xs shadow ${q < 3 ? 'bg-accent text-slate-900' : 'bg-primary text-white'}`}>{q}</button>
                        ))}
                    </div>
                )}
                {!show && <button onClick={next} className="px-4 py-2 rounded bg-primary text-white shadow">跳过</button>}
            </div>
            <p className="mt-4 text-xs opacity-60">{index + 1} / {dueWords.length}</p>
        </div>
    );
};
