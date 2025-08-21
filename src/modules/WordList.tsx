import React, { useState } from 'react';
import { Cet6Word } from '../services/cet6';
import { ProgressMap, getLevelDisplay } from '../services/progress';
import { useFavorites } from '../services/favorites';
import { upsertOverride, exportOverrides, clearOverrides } from '../services/enrich';
// 虽已移除旧 synthetic 函数，但仍通过 generateIfMissing 自动补全缺失内容
import { generateWithGemini, getGeminiKey, setGeminiKey, testGeminiKey, setGeminiModel, getGeminiModel } from '../services/ai';
import { generateIfMissing } from '../services/aiGlobal';

interface Props { words: Cet6Word[]; indexMap?: Record<string, number>; progress: ProgressMap; onLoadMore: () => void; hasMore: boolean; accent?: string; showExample?: boolean; showPhrases?: boolean; showFreq?: boolean; }

export const WordList: React.FC<Props> = ({ words, indexMap, progress, onLoadMore, hasMore, accent = 'en-US', showExample = true, showPhrases = true, showFreq = false }) => {
    const { favorites, toggleFavorite, isFavorite } = useFavorites();
    const [detail, setDetail] = useState<Cet6Word | null>(null);
    const [aiBusy, setAiBusy] = useState(false);
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [testMsg, setTestMsg] = useState('');

    function speak(word: string) {
        try {
            const utter = new SpeechSynthesisUtterance(word);
            utter.lang = accent;
            speechSynthesis.speak(utter);
        } catch { /* ignore */ }
    }
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {words.map(w => {
                    // 尝试异步自动生成（不阻塞 UI）
                    if (!(w as any)._autoReq && (!w.example || !w.phrases || w.phrases.length === 0)) {
                        (w as any)._autoReq = true;
                        generateIfMissing(w).then(changed => { if (changed) { /* 触发重渲染 */ setDetail(d => d ? { ...d } : d); } });
                    }
                    const prog = progress[w.word];
                    return (
                        <div key={w.word} className="card relative cursor-pointer" onClick={() => setDetail(w)}>
                            <h3 className="text-lg font-bold gradient-text flex items-center gap-2">
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 dark:bg-primary/25 border border-primary/30 text-primary/80 dark:text-primary/70">{indexMap?.[w.word]}</span>
                                <span>{w.word}</span>
                                {prog && prog.level > 0 && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">Lv{prog.level}</span>}
                            </h3>
                            {w.phonetic && <p className="text-sm opacity-70">/{w.phonetic}/ {showFreq && w.freq ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/20 dark:bg-primary/30 text-primary/90">频 {w.freq}</span> : null}</p>}
                            <p className="mt-2 text-sm">{w.translation}</p>
                            {showExample && w.example && <p className="mt-2 text-xs italic opacity-80 leading-relaxed">例句: {w.example}</p>}
                            {showPhrases && w.phrases && w.phrases.length > 0 && (
                                <p className="mt-2 text-[11px] opacity-80 flex flex-wrap gap-1">短语: {w.phrases.slice(0, 3).map(p => <span key={p} className="px-2 py-0.5 rounded-full bg-primary/15 dark:bg-primary/20 border border-primary/30 text-primary dark:text-primary/90">{p}</span>)}</p>
                            )}
                            {prog && <p className="mt-2 text-[10px] opacity-60">熟练度: {getLevelDisplay(prog.level)} ✓{prog.correct}/✗{prog.wrong}</p>}
                            <div className="mt-2 flex gap-2 text-xs" onClick={e => e.stopPropagation()}>
                                <button onClick={() => speak(w.word)} className="px-2 py-1 rounded bg-primary/70 text-white">发音</button>
                                <button onClick={() => toggleFavorite(w.word)} className={`px-2 py-1 rounded ${isFavorite(w.word) ? 'bg-yellow-400 text-slate-900' : 'bg-white/50 dark:bg-white/10 text-slate-700 dark:text-slate-200'}`}>{isFavorite(w.word) ? '★ 已藏' : '☆ 收藏'}</button>
                            </div>
                            {isFavorite(w.word) && <span className="absolute top-2 right-2 text-yellow-400 text-lg">★</span>}
                        </div>
                    );
                })}
            </div>
            {hasMore && (
                <div className="text-center">
                    <button onClick={onLoadMore} className="px-6 py-2 rounded-full bg-secondary text-white shadow">加载更多</button>
                </div>
            )}
            {words.length === 0 && <p className="text-center opacity-60">无匹配结果</p>}
            {detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="relative z-10 w-full max-w-5xl rounded-2xl bg-gradient-to-br from-white/85 to-white/70 dark:from-[#2b2f55]/95 dark:to-[#232743]/95 border border-white/50 dark:border-white/10 shadow-2xl animate-pop overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 flex-wrap px-6 pt-5 pb-3 border-b border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 sticky top-0 backdrop-blur z-10">
                            <div className="flex flex-col gap-1 min-w-[180px]">
                                <h2 className="text-3xl font-extrabold gradient-text leading-none flex items-center gap-3">{detail.word}{detail.phonetic && <span className="text-base font-normal opacity-70">/{detail.phonetic}/</span>}</h2>
                                <div className="flex gap-3 text-[11px] opacity-70 flex-wrap">
                                    {detail.freq && showFreq && <span className="px-2 py-0.5 rounded bg-primary/15">词频 {detail.freq}</span>}
                                    {progress[detail.word] && <span className="px-2 py-0.5 rounded bg-primary/10">熟练度 {getLevelDisplay(progress[detail.word].level)}</span>}
                                    {isFavorite(detail.word) && <span className="px-2 py-0.5 rounded bg-yellow-400/80 text-slate-900">★ 已收藏</span>}
                                </div>
                            </div>
                            <div className="flex gap-2 text-[11px] flex-wrap justify-end">
                                <button onClick={() => {
                                    const data = exportOverrides();
                                    const blob = new Blob([data], { type: 'application/json' });
                                    const a = document.createElement('a');
                                    a.href = URL.createObjectURL(blob); a.download = 'overrides.json'; a.click();
                                    URL.revokeObjectURL(a.href);
                                }} className="px-3 py-1 rounded-full bg-primary/70 text-white shadow-sm hover:shadow">导出</button>
                                <button onClick={() => { if (confirm('确认清空本地自定义覆盖?')) { clearOverrides(); alert('已清空'); } }} className="px-3 py-1 rounded-full bg-red-500/80 text-white shadow-sm hover:shadow">清空</button>
                                <button onClick={() => setShowKeyModal(true)} className="px-3 py-1 rounded-full bg-secondary/80 text-white shadow-sm hover:shadow">AI设置</button>
                                <button disabled={aiBusy} onClick={async () => {
                                    if (!detail) return; if (!getGeminiKey()) { setShowKeyModal(true); return; }
                                    try { setAiBusy(true); const r = await generateWithGemini(detail.word, detail.translation); const overridePayload: any = { word: detail.word }; if (r.example) { detail.example = r.example; overridePayload.example = r.example; } if ((r as any).exampleZh) { (detail as any).exampleZh = (r as any).exampleZh; overridePayload.exampleZh = (r as any).exampleZh; } if (r.phrases && r.phrases.length) { detail.phrases = r.phrases; overridePayload.phrases = r.phrases; } if ((r as any).phraseTranslations && (r as any).phraseTranslations.length) { (detail as any).phraseTranslations = (r as any).phraseTranslations; overridePayload.phraseTranslations = (r as any).phraseTranslations; } upsertOverride(overridePayload); setDetail({ ...detail }); } catch (e: any) { alert('AI 生成失败: ' + (e?.message || e)); } finally { setAiBusy(false); }
                                }} className="px-3 py-1 rounded-full bg-primary/80 text-white shadow-sm hover:shadow disabled:opacity-50">{aiBusy ? '生成中...' : 'AI生成'}</button>
                                <button onClick={() => setDetail(null)} className="px-3 py-1 rounded-full bg-white/70 dark:bg-white/10 shadow-sm hover:shadow">关闭</button>
                            </div>
                        </div>
                        <div className="px-6 pb-6 max-h-[85vh] overflow-y-auto space-y-6 custom-scroll">
                            <section className="space-y-3">
                                <h3 className="text-sm font-semibold tracking-wide opacity-70">释义</h3>
                                <p className="text-base leading-relaxed whitespace-pre-wrap bg-white/50 dark:bg-white/5 rounded-lg p-4 border border-white/40 dark:border-white/10 shadow-inner">{detail.translation}</p>
                            </section>
                            <section className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3 p-4 rounded-xl bg-white/55 dark:bg-white/5 border border-white/40 dark:border-white/10 shadow-sm">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">例句 <span className="text-[10px] opacity-50">EN / ZH</span></h4>
                                    <textarea defaultValue={detail.example || ''} onBlur={e => { upsertOverride({ word: detail.word, example: e.target.value.trim() || undefined }); detail.example = e.target.value.trim() || undefined; }} placeholder="英文例句" className="w-full rounded-md bg-white/70 dark:bg-white/10 p-2 text-sm border border-white/40 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[96px] resize-vertical"></textarea>
                                    <textarea defaultValue={(detail as any).exampleZh || ''} onBlur={e => { const v = e.target.value.trim(); (detail as any).exampleZh = v || undefined; upsertOverride({ word: detail.word, exampleZh: v || undefined }); }} placeholder="中文翻译" className="w-full rounded-md bg-white/60 dark:bg-white/5 p-2 text-sm border border-white/30 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[72px] resize-vertical"></textarea>
                                </div>
                                <div className="space-y-3 p-4 rounded-xl bg-white/55 dark:bg-white/5 border border-white/40 dark:border-white/10 shadow-sm">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">短语 <span className="text-[10px] opacity-50">EN ↔ ZH</span></h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <textarea defaultValue={(detail.phrases && detail.phrases.length ? detail.phrases : []).join('\n')} onBlur={e => { const parts = e.target.value.split(/[\,\n]/).map(s => s.trim()).filter(Boolean); upsertOverride({ word: detail.word, phrases: parts.length ? parts : undefined }); detail.phrases = parts.length ? parts : undefined; }} placeholder="英文短语（每行一个）" className="w-full rounded-md bg-white/70 dark:bg-white/10 p-2 text-sm border border-white/40 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[150px] resize-vertical"></textarea>
                                        <textarea defaultValue={((detail as any).phraseTranslations && (detail as any).phraseTranslations.length ? (detail as any).phraseTranslations : []).join('\n')} onBlur={e => { const zh = e.target.value.split(/\n/).map(s => s.trim()).filter(Boolean); (detail as any).phraseTranslations = zh.length ? zh : undefined; upsertOverride({ word: detail.word, phraseTranslations: zh.length ? zh : undefined }); }} placeholder="对应中文行对齐" className="w-full rounded-md bg-white/60 dark:bg-white/5 p-2 text-sm border border-white/30 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[150px] resize-vertical"></textarea>
                                    </div>
                                    {detail.phrases && detail.phrases.length > 0 && (
                                        <div className="text-[11px] flex flex-wrap gap-2 pt-1">
                                            {detail.phrases.slice(0, 12).map((p, i) => <span key={p} className="px-2 py-1 rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/30 text-primary dark:text-primary/90">{p}{(detail as any).phraseTranslations && (detail as any).phraseTranslations[i] ? ' · ' + (detail as any).phraseTranslations[i] : ''}</span>)}
                                        </div>
                                    )}
                                </div>
                            </section>
                            <section className="flex flex-wrap gap-3 text-[11px] opacity-70">
                                <button onClick={() => { speak(detail.word); }} className="px-3 py-1 rounded-full bg-primary/70 text-white">发音</button>
                                <button onClick={() => { toggleFavorite(detail.word); }} className={`px-3 py-1 rounded-full ${isFavorite(detail.word) ? 'bg-yellow-400 text-slate-900' : 'bg-white/70 dark:bg-white/10 text-slate-700 dark:text-slate-200'}`}>{isFavorite(detail.word) ? '★ 已藏' : '☆ 收藏'}</button>
                                <button onClick={() => setDetail(null)} className="px-3 py-1 rounded-full bg-secondary text-white">完成</button>
                            </section>
                        </div>
                    </div>
                </div>
            )}
            {showKeyModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowKeyModal(false)}>
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="relative z-10 w-full max-w-md p-5 rounded-2xl bg-white/90 dark:bg-[#2c2f4a]/95 border border-white/40 dark:border-white/10 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold gradient-text">Gemini API 设置</h3>
                        <div className="space-y-2 text-xs">
                            <p className="opacity-70 leading-relaxed">在此填写你自己的 Google Gemini API Key (仅保存在本地浏览器)。未使用时请留空或清除。</p>
                            <input type="text" defaultValue={getGeminiKey() || ''} placeholder="粘贴 API Key" className="w-full px-3 py-2 rounded bg-white/70 dark:bg-white/10 border border-white/40 text-sm" onBlur={e => setGeminiKey(e.target.value)} />
                            <div className="flex items-center gap-2">
                                <select defaultValue={getGeminiModel()} onChange={e => setGeminiModel(e.target.value)} className="px-2 py-1 rounded bg-white/70 dark:bg-white/10 text-xs">
                                    <option value="gemini-2.5-pro-exp-02-05">2.5-pro</option>
                                    <option value="gemini-2.5-flash-exp-02-05">2.5-flash</option>
                                </select>
                                <button onClick={async () => { setTestMsg('测试中...'); const msg = await testGeminiKey(); setTestMsg(msg); }} className="px-3 py-1 rounded bg-primary/70 text-white text-xs">测试</button>
                                <span className="text-[11px] opacity-70">{testMsg}</span>
                            </div>
                            <p className="text-[10px] opacity-60">提示：调用会消耗你的额度；示例生成遵循 JSON 输出约束，若失败可重试或降低温度。</p>
                        </div>
                        <div className="flex gap-2 justify-end text-xs">
                            <button onClick={() => { setShowKeyModal(false); }} className="px-3 py-1 rounded bg-white/60 dark:bg-white/10">完成</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
