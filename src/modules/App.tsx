import React, { useEffect, useMemo, useState } from 'react';
import { WordList } from './WordList';
import { Review } from './Review';
import { Flashcard } from './Flashcard';
import { Test } from './Test';
import { ReverseTest } from './ReverseTest';
import { ensureCet6Loaded, getCet6Page, getCet6Total, clearCet6Cache, Cet6Word } from '../services/cet6';
import { advancedSearch } from '../services/search';
import { useFavorites, exportFavorites } from '../services/favorites';
import { useProgress } from '../services/progress';
import { recordReview, getDaily, subscribeDaily, setGoal, goalRatio, scheduleReminder } from '../services/daily';
import type { ProgressMap } from '../services/progress';
import { ensureChunksLoaded, getAllChunkWords, hasChunkDataset } from '../services/chunkLoader';
import { Starfield } from './Starfield';
import { getAISettings, updateAISettings, setGlobalAPIKey, getGlobalAPIKey, batchGenerate } from '../services/aiGlobal';

type Mode = 'list' | 'review' | 'flashcard' | 'test' | 'reverse' | 'stats';

export const App: React.FC = () => {
    // UI & mode
    const [mode, setMode] = useState<Mode>('list');
    // 顶栏滚动提升效果
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    // 搜索（原始输入 + 防抖后的 query）
    const [queryRaw, setQueryRaw] = useState('');
    const [query, setQuery] = useState('');
    // 主题
    const [dark, setDark] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');
    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('theme', dark ? 'dark' : 'light');
    }, [dark]);

    // 进度 & 日常
    const { progress, updateOutcome: rawUpdateOutcome, resetProgress } = useProgress();
    function updateOutcome(word: string, quality: number) {
        rawUpdateOutcome(word, quality);
        recordReview(quality);
    }
    const [daily, setDaily] = useState(() => getDaily());
    useEffect(() => subscribeDaily(setDaily), []);

    // 收藏
    const { favorites, isFavorite, toggleFavorite, clearFavorites, importFavorites } = useFavorites();

    // 数据分页 / 分块
    const [page, setPage] = useState(1);
    const pageSize = 80;
    const [allWords, setAllWords] = useState<Cet6Word[]>([]);
    const [chunkLoading, setChunkLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accent, setAccent] = useState<'en-US' | 'en-GB'>('en-US');

    // 过滤选项
    const [onlyFav, setOnlyFav] = useState(false);
    const [searchMode, setSearchMode] = useState<'normal' | 'fuzzy' | 'regex'>('normal');
    const [rootMode, setRootMode] = useState(false);
    // 夜间模式子风格：normal | galaxy | black
    const [darkVariant, setDarkVariant] = useState<'normal' | 'galaxy' | 'black'>(() => (localStorage.getItem('theme_variant') as any) || 'normal');
    // 全局 AI 设置弹窗
    const [showAIGlobal, setShowAIGlobal] = useState(false);
    const [aiProgress, setAiProgress] = useState<{ done: number; total: number; current?: string; log: string[] }>({ done: 0, total: 0, log: [] });
    const aiCfg = getAISettings();
    useEffect(() => { localStorage.setItem('theme_variant', darkVariant); }, [darkVariant]);

    // 展示开关 (例句 / 词组 / 词频)
    const [showExample, setShowExample] = useState(() => localStorage.getItem('show_example') !== '0');
    const [showPhrases, setShowPhrases] = useState(() => localStorage.getItem('show_phrases') !== '0');
    const [showFreq, setShowFreq] = useState(() => localStorage.getItem('show_freq') === '1');
    useEffect(() => { localStorage.setItem('show_example', showExample ? '1' : '0'); }, [showExample]);
    useEffect(() => { localStorage.setItem('show_phrases', showPhrases ? '1' : '0'); }, [showPhrases]);
    useEffect(() => { localStorage.setItem('show_freq', showFreq ? '1' : '0'); }, [showFreq]);

    // 防抖处理搜索
    useEffect(() => {
        const t = setTimeout(() => setQuery(queryRaw.trim()), 300);
        return () => clearTimeout(t);
    }, [queryRaw]);

    // 加载逻辑：首次 + 分页
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true); setError(null);
            try {
                if (hasChunkDataset()) {
                    setChunkLoading(true);
                    await ensureChunksLoaded();
                    if (cancelled) return;
                    const all = getAllChunkWords();
                    setAllWords(all.slice(0, page * pageSize));
                } else {
                    await ensureCet6Loaded();
                    if (cancelled) return;
                    const slice = getCet6Page(page, pageSize);
                    setAllWords(prev => [
                        ...prev,
                        ...slice.filter(w => !prev.find(p => p.word === w.word))
                    ]);
                }
            } catch (e: any) {
                if (!cancelled) setError(e?.message || '加载失败');
            } finally {
                if (!cancelled) setLoading(false);
                setChunkLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [page]);

    const total = useMemo(() => {
        if (hasChunkDataset()) return getAllChunkWords().length;
        return getCet6Total();
    }, [allWords.length]);

    const indexMap = useMemo(() => {
        const m: Record<string, number> = {};
        allWords.forEach((w, i) => { if (!m[w.word]) m[w.word] = i + 1; });
        return m;
    }, [allWords]);

    const filtered = useMemo(() => {
        let base: Cet6Word[] = allWords;
        if (onlyFav) base = base.filter(w => isFavorite(w.word));
        if (!query) return base;
        const adv = advancedSearch(base, query, { mode: searchMode, root: rootMode, limit: 800 });
        return adv.map(r => r.word);
    }, [query, allWords, onlyFav, favorites, searchMode, rootMode]);

    function loadMore() {
        if (hasChunkDataset()) {
            setAllWords(getAllChunkWords().slice(0, (page + 1) * pageSize));
            setPage(p => p + 1);
        } else if (allWords.length < total) {
            setPage(p => p + 1);
        }
    }

    async function refreshRemote() {
        clearCet6Cache();
        setAllWords([]);
        setPage(1);
    }

    const darkBgClass = dark ? (darkVariant === 'galaxy' ? 'bg-anime-dark-galaxy' : darkVariant === 'black' ? 'bg-black-oled' : 'bg-anime-dark') : 'bg-anime-pink';
    return (
        <div className={`min-h-screen pt-28 md:pt-32 px-4 md:px-8 pb-8 space-y-6 ${darkBgClass} text-slate-800 dark:text-slate-100 transition-colors relative overflow-hidden`}>
            {dark && darkVariant === 'galaxy' && <Starfield />}
            {/* 顶栏 */}
            <div className="fixed top-0 left-0 right-0 z-40">
                <div className={`top-bar ${scrolled ? 'scrolled' : ''} bg-white/60 dark:bg-[#1f1d2b]/60 border-b border-white/40 dark:border-white/10`}>
                    <div className="max-w-7xl mx-auto h-20 flex items-center justify-between px-4 md:px-8 gap-6">
                        <div className="flex items-center gap-4 min-w-0">
                            {/* 动态 Logo 融合到顶栏 */}
                            <h1 className="text-3xl md:text-4xl font-extrabold gradient-text drop-shadow flex items-center gap-2 animate-floaty leading-none whitespace-nowrap select-none">
                                惊天背单词 <span className="hidden sm:inline">✨</span>
                            </h1>
                            <nav className="hidden md:flex items-center gap-3 text-sm">
                                {(['list', 'review', 'flashcard', 'test', 'reverse', 'stats'] as Mode[]).map(m => (
                                    <button key={m} onClick={() => setMode(m)} className={`top-nav-btn ${mode === m ? 'active' : ''}`}>{m === 'list' ? '词库' : m === 'review' ? '复习' : m === 'flashcard' ? '闪卡' : m === 'test' ? '测试' : m === 'reverse' ? '拼写' : '统计'}</button>
                                ))}
                            </nav>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <button onClick={() => setDark(d => !d)} className="top-nav-btn !bg-secondary !text-white !border-transparent">{dark ? '日间' : '夜间'}</button>
                            {dark && (
                                <select value={darkVariant} onChange={e => setDarkVariant(e.target.value as any)} className="top-nav-btn bg-white/30 dark:bg-white/10">
                                    <option value="normal">暗色</option>
                                    <option value="galaxy">星空</option>
                                    <option value="black">纯黑</option>
                                </select>
                            )}
                            <button onClick={() => setShowAIGlobal(true)} className="top-nav-btn bg-primary/70 text-white border-primary/60">AI</button>
                        </div>
                    </div>
                    {/* 移动端横向滚动导航 */}
                    <div className="md:hidden overflow-x-auto no-scrollbar px-4 pb-3 -mt-3">
                        <div className="flex gap-3 w-max">
                            {(['list', 'review', 'flashcard', 'test', 'reverse', 'stats'] as Mode[]).map(m => (
                                <button key={m} onClick={() => setMode(m)} className={`top-nav-btn ${mode === m ? 'active' : ''}`}>{m === 'list' ? '词库' : m === 'review' ? '复习' : m === 'flashcard' ? '闪卡' : m === 'test' ? '测试' : m === 'reverse' ? '拼写' : '统计'}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="space-y-2">
                    {/* 原页面内的大标题已与顶栏合并，避免重复 */}
                    <div className="flex gap-2 flex-wrap items-center">
                        <input value={queryRaw} onChange={e => { setQueryRaw(e.target.value); }} placeholder="高级搜索: 普通/模糊/正则" className="px-3 py-2 rounded bg-white/70 dark:bg-white/10 border border-white/40 focus-ring text-sm transition shadow-sm focus:shadow-md" />
                        <select value={searchMode} onChange={e => setSearchMode(e.target.value as any)} className="px-2 py-2 rounded bg-white/70 dark:bg-white/10 text-xs">
                            <option value="normal">普通</option>
                            <option value="fuzzy">模糊</option>
                            <option value="regex">正则</option>
                        </select>
                        <button onClick={() => setRootMode(r => !r)} className={`px-3 py-2 rounded-full text-xs btn-press hover-raise ${rootMode ? 'bg-primary text-white' : 'bg-white/70 dark:bg-white/10'}`}>词根</button>
                        <button onClick={() => resetProgress()} className="px-3 py-2 rounded-full text-xs bg-accent text-slate-800 shadow btn-press hover-raise">重置熟练度</button>
                        <div className="flex items-center gap-1 text-xs">
                            <input type="number" min={1} value={daily.goal} onChange={e => setGoal(parseInt(e.target.value) || daily.goal)} className="w-16 px-2 py-1 rounded bg-white/60 dark:bg-white/10 border border-white/40" />
                            <span>日目标</span>
                            <div className="w-24 h-2 bg-white/40 rounded overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: (goalRatio() * 100) + '%' }}></div>
                            </div>
                            <span>{daily.correct}/{daily.goal}</span>
                            <button onClick={() => scheduleReminder(30)} className="px-2 py-1 bg-primary/60 text-white rounded btn-press hover-raise">提醒</button>
                        </div>
                        <button onClick={refreshRemote} className="px-3 py-2 rounded-full text-xs bg-primary/70 text-white shadow btn-press hover-raise">刷新词库</button>
                        <button onClick={() => setOnlyFav(f => !f)} className={`px-3 py-2 rounded-full text-xs btn-press hover-raise ${onlyFav ? 'bg-yellow-400 text-slate-900' : 'bg-white/70 dark:bg-white/10 text-slate-700 dark:text-slate-200'}`}>{onlyFav ? '★ 仅收藏' : '☆ 全部'}</button>
                        <button onClick={() => {
                            const data = JSON.stringify({ favorites: exportFavorites(favorites), ts: Date.now() }, null, 2);
                            const blob = new Blob([data], { type: 'application/json' });
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob); a.download = 'favorites.json'; a.click();
                            URL.revokeObjectURL(a.href);
                        }} className="px-3 py-2 rounded-full text-xs bg-secondary text-white btn-press hover-raise">导出收藏</button>
                        <label className="px-3 py-2 rounded-full text-xs bg-secondary/60 text-white cursor-pointer hover-raise">
                            导入收藏
                            <input type="file" accept="application/json" className="hidden" onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                file.text().then(txt => {
                                    try {
                                        const json = JSON.parse(txt);
                                        if (Array.isArray(json)) importFavorites(json as string[]);
                                        else if (Array.isArray(json.favorites)) importFavorites(json.favorites);
                                    } catch { alert('JSON 格式错误'); }
                                });
                                e.target.value = '';
                            }} />
                        </label>
                        <button onClick={() => clearFavorites()} className="px-3 py-2 rounded-full text-xs bg-accent text-slate-800 btn-press hover-raise">清空收藏</button>
                        {/* 设置开关 */}
                        <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-white/60 dark:bg-white/10 border border-white/30">
                            <label className="flex items-center gap-0.5 cursor-pointer">
                                <input type="checkbox" checked={showExample} onChange={e => setShowExample(e.target.checked)} className="accent-primary" />例句
                            </label>
                            <label className="flex items-center gap-0.5 cursor-pointer">
                                <input type="checkbox" checked={showPhrases} onChange={e => setShowPhrases(e.target.checked)} className="accent-primary" />短语
                            </label>
                            <label className="flex items-center gap-0.5 cursor-pointer">
                                <input type="checkbox" checked={showFreq} onChange={e => setShowFreq(e.target.checked)} className="accent-primary" />词频
                            </label>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap md:justify-end md:items-start">
                    <select value={accent} onChange={e => setAccent(e.target.value as any)} className="px-3 py-2 rounded-full text-xs bg-white/70 dark:bg-white/10 border border-white/40">
                        <option value="en-US">美音</option>
                        <option value="en-GB">英音</option>
                    </select>
                    <button onClick={() => batchPronounce(filtered.slice(0, 20).map(w => w.word), accent)} className="px-3 py-2 rounded-full text-xs bg-primary/60 text-white btn-press hover-raise">批量朗读20</button>
                </div>
            </header>
            <main className="space-y-6">
                {mode === 'list' && <>
                    {error && <div className="p-3 rounded bg-red-500/80 text-white text-sm">加载错误：{error}</div>}
                    <WordList words={filtered} indexMap={indexMap} progress={progress} onLoadMore={loadMore} hasMore={allWords.length < total} accent={accent} showExample={showExample} showPhrases={showPhrases} showFreq={showFreq} />
                    {loading && <div className="text-center text-xs opacity-70 animate-pulse">加载中...</div>}
                    {chunkLoading && <div className="text-center text-xs opacity-70">(分块数据加载)</div>}
                </>}
                {mode === 'review' && <Review words={filtered} progress={progress} onOutcome={updateOutcome} />}
                {mode === 'flashcard' && <Flashcard words={filtered} progress={progress} onOutcome={updateOutcome} />}
                {mode === 'test' && <Test words={filtered} progress={progress} onOutcome={updateOutcome} />}
                {mode === 'reverse' && <ReverseTest words={filtered} progress={progress} onOutcome={updateOutcome} />}
                {mode === 'stats' && <Stats allWords={allWords} progress={progress} favorites={favorites} />}
            </main>
            <footer className="text-center text-xs opacity-70 py-4">词条: {allWords.length}/{total || '...'} | 熟练度存储 localStorage | 今日完成 {daily.correct}/{daily.goal}</footer>
            {showAIGlobal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setShowAIGlobal(false)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white/90 dark:bg-[#24283b]/95 border border-white/40 dark:border-white/10 shadow-2xl p-6 space-y-5 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <h3 className="text-xl font-bold gradient-text">全局 AI 设置</h3>
                            <button onClick={() => setShowAIGlobal(false)} className="px-3 py-1 rounded-full bg-white/60 dark:bg-white/10 text-xs">关闭</button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6 text-xs">
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="block text-[11px] opacity-70">API Key</label>
                                    <input defaultValue={getGlobalAPIKey() || ''} onBlur={e => setGlobalAPIKey(e.target.value.trim())} placeholder="粘贴你的 Key" className="w-full px-3 py-2 rounded bg-white/70 dark:bg-white/10 border border-white/40" />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[11px] opacity-70">模型</label>
                                    <select defaultValue={aiCfg.model} onChange={e => updateAISettings({ model: e.target.value })} className="w-full px-3 py-2 rounded bg-white/70 dark:bg-white/10 border border-white/40">
                                        <option value="gemini-2.5-pro-exp-02-05">2.5-pro</option>
                                        <option value="gemini-2.5-flash-exp-02-05">2.5-flash</option>
                                        <option value="gemini-1.5-pro-latest">1.5-pro</option>
                                        <option value="gemini-1.5-flash-latest">1.5-flash</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1"><label className="block text-[11px] opacity-70">Temp</label><input type="number" step="0.1" min={0} max={1} defaultValue={aiCfg.temperature} onBlur={e => updateAISettings({ temperature: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1 rounded bg-white/70 dark:bg-white/10 border border-white/40" /></div>
                                    <div className="space-y-1"><label className="block text-[11px] opacity-70">topP</label><input type="number" step="0.05" min={0} max={1} defaultValue={aiCfg.topP} onBlur={e => updateAISettings({ topP: parseFloat(e.target.value) || 1 })} className="w-full px-2 py-1 rounded bg-white/70 dark:bg-white/10 border border-white/40" /></div>
                                    <div className="space-y-1"><label className="block text-[11px] opacity-70">Tokens</label><input type="number" min={64} max={2048} defaultValue={aiCfg.maxTokens} onBlur={e => updateAISettings({ maxTokens: parseInt(e.target.value) || 512 })} className="w-full px-2 py-1 rounded bg-white/70 dark:bg-white/10 border border-white/40" /></div>
                                </div>
                                <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none mt-1">
                                    <input type="checkbox" defaultChecked={aiCfg.autoGenerate} onChange={e => updateAISettings({ autoGenerate: e.target.checked })} />
                                    自动填充缺失例句/短语
                                </label>
                                <div className="space-y-1">
                                    <label className="block text-[11px] opacity-70">批量生成 (区间: 起始 ~ 结束，基于已加载顺序，1 开始)</label>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <input id="ai-batch-start" type="number" min={1} max={allWords.length || 1} defaultValue={1} className="w-24 px-2 py-1 rounded bg-white/70 dark:bg-white/10 border border-white/40" />
                                        <span className="text-xs opacity-60">到</span>
                                        <input id="ai-batch-end" type="number" min={1} max={allWords.length || 1} defaultValue={Math.min(50, allWords.length || 50)} className="w-24 px-2 py-1 rounded bg-white/70 dark:bg-white/10 border border-white/40" />
                                        <button onClick={async () => {
                                            const sEl = document.getElementById('ai-batch-start') as HTMLInputElement;
                                            const eEl = document.getElementById('ai-batch-end') as HTMLInputElement;
                                            let start = parseInt(sEl.value) || 1;
                                            let end = parseInt(eEl.value) || start;
                                            if (start < 1) start = 1;
                                            if (end < start) end = start;
                                            if (end > allWords.length) { alert('结束索引超出已加载数量，请先“加载更多”'); return; }
                                            const slice = allWords.slice(start - 1, end);
                                            const total = slice.length;
                                            if (!total) { alert('区间为空'); return; }
                                            setAiProgress({ done: 0, total, log: [], current: '' });
                                            const res = await batchGenerate(slice, total, (d, t, w) => setAiProgress(p => ({ ...p, done: d, total: t, current: w })));
                                            setAiProgress(p => ({ ...p, log: res.map(r => `${wIndexDisplay(start, end, slice, res, r.word)} ${r.word}:${r.ok ? (r.updated ? '更新' : '跳过') : '失败-' + r.error}`) }));
                                        }} className="px-3 py-1 rounded bg-primary/70 text-white text-xs">开始</button>
                                    </div>
                                    <div className="h-2 w-full bg-white/40 rounded overflow-hidden mt-1"><div className="h-full bg-primary/70 transition-all" style={{ width: (aiProgress.total ? (aiProgress.done / aiProgress.total * 100) : 0) + '%' }} /></div>
                                    <p className="text-[10px] opacity-70">{aiProgress.done}/{aiProgress.total} {aiProgress.current ? '当前: ' + aiProgress.current : ''}</p>
                                    <p className="text-[10px] opacity-50">提示：索引以当前已加载顺序计算；若目标范围未加载请先在列表底部点击“加载更多”。</p>
                                </div>
                            </div>
                            <div className="space-y-2 flex flex-col">
                                <label className="text-[11px] opacity-70">批量日志</label>
                                <div className="flex-1 min-h-[180px] rounded bg-black/80 text-green-300 p-2 font-mono text-[11px] overflow-y-auto whitespace-pre-wrap">
                                    {aiProgress.log.length ? aiProgress.log.join('\n') : '尚无记录'}
                                </div>
                                <p className="text-[10px] opacity-60 leading-relaxed">说明：仅写入有变化的条目到本地覆盖。可多次运行，不会重复扣费相同结果（模型可能仍然稍有变化）。</p>
                            </div>
                        </div>
                        <div className="text-[10px] opacity-50 pt-2 border-t border-white/30 dark:border-white/5">数据本地存储；请勿在公共设备保留 Key。</div>
                    </div>
                </div>
            )}
        </div>
    );
};

function btn(active: boolean) {
    return `px-4 py-2 rounded-full text-sm font-semibold shadow transition backdrop-blur border border-white/50 ${active ? 'bg-primary text-white scale-105' : 'bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20'} `;
}

const Stats: React.FC<{ allWords: any[]; progress: ProgressMap; favorites: Record<string, true>; }> = ({ allWords, progress, favorites }) => {
    const total = allWords.length || 1;
    const values = Object.values(progress);
    const learned = values.filter(p => p.level >= 3).length;
    const mastered = values.filter(p => p.level >= 5).length;
    const favCount = Object.keys(favorites).length;
    const totalCorrect = values.reduce((s, p) => s + (p.correct || 0), 0);
    const totalWrong = values.reduce((s, p) => s + (p.wrong || 0), 0);
    const acc = totalCorrect + totalWrong ? totalCorrect / (totalCorrect + totalWrong) : 0;
    const avgEf = values.length ? (values.reduce((s, p) => s + (p.ef || 2.5), 0) / values.length) : 2.5;
    const now = Date.now();
    const dueNow = values.filter(p => (p.nextReview || 0) && p.nextReview! <= now).length;
    // 未来 7 天复习预测
    const forecastBuckets: { day: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
        const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); dayStart.setDate(dayStart.getDate() + i);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const key = dayStart.toISOString().slice(5, 10);
        const c = values.filter(p => p.nextReview && p.nextReview >= dayStart.getTime() && p.nextReview < dayEnd.getTime()).length;
        forecastBuckets.push({ day: key, count: c });
    }
    const maxForecast = Math.max(1, ...forecastBuckets.map(b => b.count));
    const dist = [0, 1, 2, 3, 4, 5].map(l => ({ l, c: values.filter(p => p.level === l).length }));
    const daily = buildDailySeries(progress);

    function pct(n: number, d: number) { return (n / d * 100).toFixed(1) + '%'; }

    return (
        <div className="card max-w-5xl mx-auto space-y-8 animate-pop">
            <h2 className="text-2xl md:text-3xl font-bold gradient-text flex items-center gap-3">
                <span>统计面板</span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/80 text-white">Beta</span>
            </h2>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
                <StatCard label="词条加载" value={allWords.length} sub={`总目标 ${total}`} />
                <ProgressRing label="学习进度" value={learned} max={total} color="#ff6bcb" />
                <ProgressRing label="掌握进度" value={mastered} max={total} color="#ffe66b" />
                <StatCard label="收藏" value={favCount} sub={pct(favCount, total)} />
            </div>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
                <StatCard label="正确率" value={(acc * 100).toFixed(1) + '%'} sub={`${totalCorrect}✓ / ${totalWrong}✗`} />
                <StatCard label="平均EF" value={avgEf.toFixed(2)} sub="(记忆稳定性)" />
                <StatCard label="待复习" value={dueNow} sub="当前到期" highlight={dueNow > 0} />
                <StatCard label="复习记录" value={daily.reduce((s, d) => s + d.count, 0)} sub="历史总次数" />
            </div>
            <section className="space-y-3">
                <h3 className="font-semibold text-sm tracking-wide">等级分布</h3>
                <div className="grid grid-cols-6 gap-2">
                    {dist.map(d => (
                        <div key={d.l} className="p-3 rounded bg-white/60 dark:bg-white/10 flex flex-col items-center gap-1">
                            <span className="text-[11px] opacity-70">Lv{d.l}</span>
                            <span className="text-lg font-bold">{d.c}</span>
                            <span className="text-[10px] opacity-60">{pct(d.c, total)}</span>
                        </div>
                    ))}
                </div>
            </section>
            <section className="space-y-3">
                <h3 className="font-semibold text-sm tracking-wide flex items-center gap-2">未来7天复习预测 <span className="text-[10px] opacity-60">(根据 SM-2 计算的 nextReview)</span></h3>
                <div className="flex items-end gap-2 h-32">
                    {forecastBuckets.map(b => (
                        <div key={b.day} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full bg-primary/30 dark:bg-primary/20 rounded relative overflow-hidden" style={{ height: '100%' }}>
                                <div className="absolute bottom-0 left-0 w-full bg-primary/70 dark:bg-primary/50 transition-all" style={{ height: (b.count / maxForecast * 100) + '%' }} />
                            </div>
                            <span className="text-[10px] opacity-70">{b.day}</span>
                            <span className="text-[10px] font-medium">{b.count}</span>
                        </div>
                    ))}
                </div>
            </section>
            <section>
                <MiniChart daily={daily} />
            </section>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: React.ReactNode; sub?: string; highlight?: boolean; }> = ({ label, value, sub, highlight }) => (
    <div className={`p-4 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur flex flex-col gap-1 border border-white/30 dark:border-white/5 ${highlight ? 'animate-pulseBorder' : ''}`}>
        <span className="text-[11px] uppercase tracking-wide opacity-70">{label}</span>
        <span className="text-xl font-bold gradient-text">{value}</span>
        {sub && <span className="text-[11px] opacity-60">{sub}</span>}
    </div>
);

const ProgressRing: React.FC<{ label: string; value: number; max: number; color: string; }> = ({ label, value, max, color }) => {
    const percent = max ? value / max : 0;
    const size = 80; const stroke = 8; const r = (size - stroke) / 2; const circ = 2 * Math.PI * r; const dash = circ * percent;
    return (
        <div className="p-4 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur flex items-center gap-3 border border-white/30 dark:border-white/5">
            <svg width={size} height={size} className="shrink-0">
                <circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff30" strokeWidth={stroke} fill="none" />
                <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dasharray .6s' }} />
                <text x="50%" y="52%" textAnchor="middle" fontSize="14" fill="#fff">{(percent * 100).toFixed(0)}%</text>
            </svg>
            <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide opacity-70">{label}</span>
                <span className="text-lg font-bold gradient-text">{value}</span>
                <span className="text-[10px] opacity-60">/{max}</span>
            </div>
        </div>
    );
};

function batchPronounce(words: string[], accent: string) {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const voice = voices.find(v => v.lang === accent) || voices.find(v => v.lang.startsWith('en'));
    words.forEach((w, i) => {
        const ut = new SpeechSynthesisUtterance(w);
        ut.voice = voice || null;
        ut.rate = 1; ut.pitch = 1;
        ut.lang = voice?.lang || accent;
        setTimeout(() => synth.speak(ut), i * 400);
    });
}

function buildDailySeries(progress: ProgressMap) {
    const buckets: Record<string, number> = {};
    Object.values(progress).forEach(p => {
        if (!p.lastReview) return;
        const d = new Date(p.lastReview); const key = d.toISOString().slice(0, 10);
        buckets[key] = (buckets[key] || 0) + 1;
    });
    const keys = Object.keys(buckets).sort();
    return keys.map(k => ({ date: k, count: buckets[k] }));
}

const MiniChart: React.FC<{ daily: { date: string; count: number; }[] }> = ({ daily }) => {
    if (!daily.length) return <p className="mt-4 text-xs opacity-60">暂无复习记录</p>;
    const max = Math.max(...daily.map(d => d.count));
    return <div className="mt-6">
        <h3 className="font-semibold mb-2 text-sm">每日复习次数</h3>
        <div className="flex items-end gap-1 h-24">
            {daily.slice(-14).map(d => <div key={d.date} className="flex-1 bg-primary/60 dark:bg-primary/40 relative" style={{ height: (d.count / (max || 1)) * 100 + '%' }}>
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px]">{d.count}</span>
                <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[10px] rotate-45">{d.date.slice(5)}</span>
            </div>)}
        </div>
    </div>;
};

function wIndexDisplay(start: number, end: number, slice: Cet6Word[], res: any[], word: string) {
    const idx = slice.findIndex(w => w.word === word);
    return idx >= 0 ? `[${start + idx}]` : '';
}
