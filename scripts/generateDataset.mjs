// Build-time CET6 dataset fetch & chunk script
import fs from 'fs';
import path from 'path';
import https from 'https';

// Allow overrides via env
const REMOTE = process.env.DATASET_REMOTE_URL || 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET6_TODO.txt';
const OUT_DIR = path.resolve('public', 'cet6');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const CHUNK_SIZE = 400; // adjustable
const MAX_RETRIES = Number(process.env.DATASET_FETCH_RETRIES || 3);
const TIMEOUT_MS = Number(process.env.DATASET_FETCH_TIMEOUT || 15000);
const OFFLINE = /^(1|true)$/i.test(process.env.DATASET_OFFLINE || '');

function fetchOnce(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: TIMEOUT_MS }, res => {
            if (res.statusCode !== 200) return reject(new Error('Status ' + res.statusCode));
            let data = '';
            res.setEncoding('utf8');
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        });
        req.on('timeout', () => { req.destroy(new Error('Request timeout')); });
        req.on('error', reject);
    });
}

async function fetchWithRetry(url) {
    if (OFFLINE) throw new Error('Offline mode enabled');
    let attempt = 0;
    while (true) {
        try {
            attempt++;
            if (attempt > 1) console.log(`[dataset] Retry attempt ${attempt}/${MAX_RETRIES}`);
            return await fetchOnce(url);
        } catch (e) {
            if (attempt >= MAX_RETRIES) throw e;
            const backoff = 1000 * attempt; // linear backoff
            await new Promise(r => setTimeout(r, backoff));
        }
    }
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

function writeChunks(words, source = 'remote') {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const chunks = [];
    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
        const chunk = words.slice(i, i + CHUNK_SIZE);
        const name = `chunk-${Math.floor(i / CHUNK_SIZE)}.json`;
        fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(chunk));
        chunks.push(name);
    }
    const manifest = { count: words.length, chunkSize: CHUNK_SIZE, chunks, generatedAt: Date.now(), source };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`[dataset] Wrote manifest (${source}) + ${chunks.length} chunks to ${OUT_DIR}`);
}

function existingOk() {
    if (fs.existsSync(MANIFEST)) {
        try {
            const meta = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
            if (meta.count && Array.isArray(meta.chunks) && meta.chunks.length) {
                console.log('[dataset] Existing dataset detected, skipping regeneration.');
                return true;
            }
        } catch { }
    }
    return false;
}

async function main() {
    console.log('[dataset] Generating CET6 dataset...');
    if (existingOk()) return; // reuse
    let raw;
    try {
        raw = await fetchWithRetry(REMOTE);
        const words = parse(raw);
        console.log(`[dataset] Parsed words: ${words.length}`);
        writeChunks(words, 'remote');
        return;
    } catch (e) {
        console.warn('[dataset] Remote fetch failed:', e.message);
    }

    // Fallback minimal dataset so build does not fail
    const fallbackWords = [
        { word: 'abandon', phonetic: '', translation: 'v. 放弃; 抛弃' },
        { word: 'ability', phonetic: '', translation: 'n. 能力; 才能' },
        { word: 'able', phonetic: '', translation: 'adj. 能够的' },
        { word: 'abolish', phonetic: '', translation: 'v. 废除; 取消' },
        { word: 'abroad', phonetic: '', translation: 'adv. 在国外; 到海外' }
    ];
    console.log('[dataset] Using fallback minimal dataset (', fallbackWords.length, 'words ).');
    writeChunks(fallbackWords, 'fallback');
}

main();
