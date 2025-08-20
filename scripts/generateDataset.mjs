// Build-time CET6 dataset fetch & chunk script
import fs from 'fs';
import path from 'path';
import https from 'https';

const REMOTE = 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET6_TODO.txt';
const OUT_DIR = path.resolve('public', 'cet6');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const CHUNK_SIZE = 400; // adjustable

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode !== 200) return reject(new Error('Status ' + res.statusCode));
            let data = '';
            res.setEncoding('utf8');
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function parse(raw) {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
        const m = line.match(/^([a-zA-Z\-']+)(?:\s+\[([^\]]+)\])?\s+(.+)$/);
        if (m) {
            out.push({ word: m[1].toLowerCase(), phonetic: m[2] || '', translation: m[3].replace(/\s+/g, ' ') });
        } else {
            // fallback simple split
            const segs = line.split(/\s+-\s+|\s{2,}/);
            if (segs.length >= 2) out.push({ word: segs[0].toLowerCase(), phonetic: '', translation: segs.slice(1).join(' ') });
        }
    }
    // dedupe
    const map = new Map();
    for (const w of out) if (!map.has(w.word)) map.set(w.word, w);
    return Array.from(map.values());
}

async function main() {
    console.log('[dataset] Fetching CET6 ...');
    let raw;
    try { raw = await fetchText(REMOTE); } catch (e) { console.error('Fetch failed', e); process.exit(1); }
    const words = parse(raw);
    console.log(`[dataset] Parsed words: ${words.length}`);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const chunks = [];
    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
        const chunk = words.slice(i, i + CHUNK_SIZE);
        const name = `chunk-${Math.floor(i / CHUNK_SIZE)}.json`;
        fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(chunk));
        chunks.push(name);
    }
    const manifest = { count: words.length, chunkSize: CHUNK_SIZE, chunks, generatedAt: Date.now() };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log('[dataset] Wrote manifest +', chunks.length, 'chunks to', OUT_DIR);
}

main();
