import React, { useMemo, useState } from 'react';
import { Cet6Word } from '../services/cet6';
import { ProgressMap } from '../services/progress';

interface Props { words: Cet6Word[]; progress: ProgressMap; onOutcome: (word: string, quality: number) => void; }

export const Test: React.FC<Props> = ({ words, progress, onOutcome }) => {
    const testList = useMemo(() => words.slice(0, 20), [words]);
    const [index, setIndex] = useState(0);
    const [answer, setAnswer] = useState('');
    const [correct, setCorrect] = useState(0);
    const [finished, setFinished] = useState(false);
    const [reveal, setReveal] = useState(false);

    if (testList.length === 0) return <p>暂无单词</p>;
    const current = testList[index];

    function submit() {
        const firstMeaning = current.translation.split(/；|;|，|,/)[0];
        const ok = answer.trim() !== '' && firstMeaning.includes(answer.trim());
        if (ok) setCorrect(c => c + 1);
        onOutcome(current.word, ok ? 4 : 2);
        setReveal(true);
    }
    function next() {
        setReveal(false);
        setAnswer('');
        if (index === testList.length - 1) {
            setFinished(true);
        } else {
            setIndex(i => i + 1);
        }
    }

    if (finished) {
        const ratio = Math.round(correct / testList.length * 100);
        return (
            <div className="card max-w-md mx-auto text-center">
                <h2 className="text-2xl font-bold gradient-text mb-4">测试完成</h2>
                <p className="text-lg">共 {testList.length} 个，答对 {correct} 个（{ratio}%）</p>
                <button className="mt-4 px-4 py-2 bg-primary text-white rounded" onClick={() => { setIndex(0); setCorrect(0); setFinished(false); setReveal(false); }}>再测一次</button>
            </div>
        );
    }

    return (
        <div className="card max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4 gradient-text">测试模式</h2>
            <p className="text-4xl font-extrabold mb-4">{current.word}</p>
            {current.phonetic && <p className="mb-2 text-sm opacity-70">/{current.phonetic}/</p>}
            <input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="输入中文释义(首个义项关键词)" className="w-full mt-4 px-3 py-2 rounded bg-white/80 dark:bg-white/10 border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary" />
            {reveal && <p className="mt-3 text-sm">正确释义：{current.translation}</p>}
            <div className="mt-4 flex justify-center gap-3 flex-wrap">
                {!reveal && <button onClick={submit} className="px-4 py-2 bg-secondary text-white rounded">提交</button>}
                {reveal && <button onClick={next} className="px-4 py-2 bg-primary text-white rounded">{index === testList.length - 1 ? '完成' : '下一题'}</button>}
            </div>
            <p className="mt-4 text-xs opacity-60">{index + 1} / {testList.length}</p>
        </div>
    );
};
