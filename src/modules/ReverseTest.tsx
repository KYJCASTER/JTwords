import React, { useMemo, useState } from 'react';
import { Cet6Word } from '../services/cet6';
import { ProgressMap } from '../services/progress';
// @ts-ignore tooling resolution workaround
import { levenshtein } from '../utils/levenshtein';

interface Props { words: Cet6Word[]; progress: ProgressMap; onOutcome: (word: string, quality: number) => void; }

export const ReverseTest: React.FC<Props> = ({ words, onOutcome }) => {
    const testList = useMemo(() => words.slice(0, 20), [words]);
    const [index, setIndex] = useState(0);
    const [answer, setAnswer] = useState('');
    const [score, setScore] = useState<number | null>(null);
    const [finished, setFinished] = useState(false);

    if (testList.length === 0) return <p>暂无单词</p>;
    const current = testList[index];

    function submit() {
        const target = current.word.toLowerCase();
        const a = answer.trim().toLowerCase();
        if (!a) { setScore(0); onOutcome(current.word, 1); return; }
        const dist = levenshtein(a, target);
        let quality: number;
        if (a === target) quality = 5; else if (dist === 1) quality = 4; else if (dist <= 2) quality = 3; else if (dist <= 3) quality = 2; else quality = 1;
        setScore(quality);
        onOutcome(current.word, quality);
    }
    function next() {
        setAnswer(''); setScore(null);
        if (index === testList.length - 1) setFinished(true); else setIndex(i => i + 1);
    }

    if (finished) {
        return <div className="card max-w-md mx-auto text-center">
            <h2 className="text-2xl font-bold gradient-text mb-4">拼写测试完成</h2>
            <button className="mt-4 px-4 py-2 bg-primary text-white rounded" onClick={() => { setIndex(0); setFinished(false); setScore(null); }}>再测一次</button>
        </div>;
    }

    return <div className="card max-w-xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4 gradient-text">反向拼写测试</h2>
        <p className="text-lg mb-4">中文释义：{current.translation.split(/；|;|，|,/)[0]}</p>
        <input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="输入英文单词" className="w-full mt-2 px-3 py-2 rounded bg-white/80 dark:bg-white/10 border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary" />
        {score !== null && <p className="mt-2 text-sm">正确：{current.word} | 评分 {score}</p>}
        <div className="mt-4 flex justify-center gap-3 flex-wrap">
            {score === null && <button onClick={submit} className="px-4 py-2 bg-secondary text-white rounded">提交</button>}
            {score !== null && <button onClick={next} className="px-4 py-2 bg-primary text-white rounded">{index === testList.length - 1 ? '完成' : '下一题'}</button>}
        </div>
        <p className="mt-4 text-xs opacity-60">{index + 1} / {testList.length}</p>
    </div>;
};
