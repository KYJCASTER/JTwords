// 自动生成无版权例句与常用词组（程序化模板）
// 目的：在缺失真实语料时提供可读且中性、安全的占位内容。

export type POS = 'n' | 'v' | 'adj' | 'adv' | 'other';

export function guessPOS(translation?: string): POS {
    if (!translation) return 'other';
    const t = translation.toLowerCase();
    if (/\bn\./.test(t)) return 'n';
    if (/\bv[ti]?\./.test(t)) return 'v';
    if (/\badj\./.test(t)) return 'adj';
    if (/\badv\./.test(t)) return 'adv';
    return 'other';
}

export function generateExample(word: string, translation?: string): string {
    const pos = guessPOS(translation);
    const base = word.toLowerCase();
    const h = hash(base);
    const pick = <T,>(arr: T[]) => arr[h % arr.length];
    switch (pos) {
        case 'n': return pick([
            `The ${base} plays a key role in daily practice.`,
            `This ${base} is often discussed in modern studies.`,
            `A clear ${base} can improve overall performance.`,
            `Our team evaluated the ${base} carefully today.`
        ]);
        case 'v': return pick([
            `They decided to ${base} the plan after a short review.`,
            `You can ${base} the task with patience and focus.`,
            `We attempt to ${base} every process to make it lean.`,
            `Engineers often ${base} features in small steps.`
        ]);
        case 'adj': return pick([
            `The ${base} design attracted immediate attention.`,
            `A ${base} approach sometimes solves hidden issues.`,
            `Users prefer a ${base} interface for daily work.`,
            `Maintaining a ${base} mindset helps the team grow.`
        ]);
        case 'adv': return pick([
            `She responded ${base} to the unexpected change.`,
            `The system now runs ${base} after refactoring.`,
            `They collaborated ${base} across departments.`,
            `All modules were updated ${base} during the night.`
        ]);
        default: return pick([
            `The term ${base} appears frequently in practical notes.`,
            `People mention ${base} when refining their workflow.`,
            `A simple example shows how ${base} can be applied.`,
            `We recorded ${base} as part of routine learning.`
        ]);
    }
}

export function generatePhrases(word: string, translation?: string): string[] {
    const pos = guessPOS(translation);
    const base = word.toLowerCase();
    const h = hash(base);
    const pickSet = <T,>(arr: T[]) => rotate(arr, h).slice(0, Math.min(5, arr.length));
    if (pos === 'n') return pickSet([
        `core ${base}`,
        `modern ${base}`,
        `${base} level`,
        `${base} process`,
        `${base} analysis`,
        `${base} module`
    ]);
    if (pos === 'v') return pickSet([
        `${base} the plan`,
        `${base} workflow`,
        `${base} changes`,
        `try to ${base}`,
        `${base} continuously`,
        `${base} effectively`
    ]);
    if (pos === 'adj') return pickSet([
        `highly ${base}`,
        `${base} feature`,
        `${base} style`,
        `${base} layout`,
        `${base} result`,
        `${base} pattern`
    ]);
    if (pos === 'adv') return pickSet([
        `adapt ${base}`,
        `respond ${base}`,
        `work ${base}`,
        `scale ${base}`,
        `grow ${base}`
    ]);
    return pickSet([
        `general ${base}`,
        `basic ${base}`,
        `${base} usage`,
        `${base} concept`,
        `${base} note`,
        `${base} tag`
    ]);
}

// =============== 中文辅助生成（占位翻译）================
// 仅用于界面显示，避免修改原数据结构；生成的中文不保证严格语义，只作学习辅助占位。

function extractChineseCore(translation?: string): string {
    if (!translation) return '';
    // 去掉前导的英文词性与符号，如 "v. ", "adj. ", "n. " 等
    const t = translation.replace(/^[a-zA-Z.\s]+/, '').trim();
    // 取第一个分号/顿号/逗号前的词，避免过长
    const first = t.split(/[；，,、]/)[0];
    return first || t || '';
}

export function generateExampleZh(word: string, translation?: string): string {
    const pos = guessPOS(translation);
    const core = extractChineseCore(translation) || word;
    switch (pos) {
        case 'n': return `这个${core}在日常应用中发挥关键作用。`;
        case 'v': return `他们决定${core}计划，以提高效率。`;
        case 'adj': return `这种${core}的设计立刻引起关注。`;
        case 'adv': return `系统经过优化后现在运行得更加${core}。`;
        default: return `这里展示单词“${word}”的一个基础用法示例。`;
    }
}

export function generatePhraseZh(phrase: string, word: string, translation?: string): string {
    const core = extractChineseCore(translation) || word;
    // 简单规则：如果短语里包含单词本身，则将该单词替换成中文核心释义
    if (phrase.toLowerCase().includes(word.toLowerCase())) {
        return phrase.replace(new RegExp(word, 'i'), core);
    }
    return `与 ${core} 相关的搭配`;
}

function hash(str: string): number {
    let h = 0; for (let i = 0; i < str.length; i++) h = (h * 131 + str.charCodeAt(i)) >>> 0; return h;
}
function rotate<T>(arr: T[], offset: number): T[] {
    if (!arr.length) return arr; const o = offset % arr.length; return arr.slice(o).concat(arr.slice(0, o));
}
