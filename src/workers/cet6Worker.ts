// Web Worker: 获取并解析 CET6 文本，返回词数组
interface Cet6Word { word: string; translation: string; phonetic?: string }

self.onmessage = async (ev: MessageEvent) => {
    const { url } = ev.data as { url: string };
    try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const text = await resp.text();
        const words = parse(text);
        (self as any).postMessage({ ok: true, words });
    } catch (e: any) {
        (self as any).postMessage({ ok: false, error: e?.message || String(e) });
    }
};

function parse(text: string): Cet6Word[] {
    const lines = text.split(/\r?\n/);
    const res: Cet6Word[] = [];
    let pending: string | null = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const single = line.match(/^([a-zA-Z][a-zA-Z\-]*)\s+\[([^\]]+)\]\s+(.+)$/);
        if (single) {
            push(res, { word: single[1].toLowerCase(), phonetic: single[2].trim(), translation: clean(single[3]) });
            pending = null; continue;
        }
        if (/^[a-zA-Z][a-zA-Z\-]*$/.test(line)) { pending = line.toLowerCase(); continue; }
        if (pending && /^\[[^\]]+\]/.test(line)) {
            const m = line.match(/^\[([^\]]+)\]\s*(.*)$/); if (m) { push(res, { word: pending, phonetic: m[1].trim(), translation: clean(m[2]) || '(释义缺失)' }); pending = null; continue; }
        }
    }
    return res.filter(w => w.translation.length > 1);
}
function push(arr: Cet6Word[], w: Cet6Word) { if (!arr.find(x => x.word === w.word)) arr.push(w); }
function clean(s: string) { return s.replace(/\s+/g, ' ').replace(/\|\|.*$/, '').trim(); }
