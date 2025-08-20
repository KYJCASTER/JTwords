// Runtime loader for pre-generated CET6 chunks with fallback to existing remote loader
import { Cet6Word } from './cet6';

export interface ChunkManifest { count: number; chunkSize: number; chunks: string[]; generatedAt: number; }

let manifest: ChunkManifest | null = null;
let loadedWords: Cet6Word[] = [];
let loadingPromise: Promise<void> | null = null;

async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed ' + url);
    return res.json();
}

export async function ensureChunksLoaded(progressCb?: (loaded: number, total: number) => void) {
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
        try {
            manifest = await fetchJSON<ChunkManifest>('/cet6/manifest.json');
        } catch {
            // no manifest -> build step not run; skip
            return;
        }
        if (!manifest) return;
        const total = manifest.count;
        for (let i = 0; i < manifest.chunks.length; i++) {
            const chunkName = manifest.chunks[i];
            try {
                const part = await fetchJSON<Cet6Word[]>(`/cet6/${chunkName}`);
                loadedWords.push(...part);
                progressCb && progressCb(loadedWords.length, total);
            } catch { /* ignore individual chunk errors */ }
        }
    })();
    return loadingPromise;
}

export function getAllChunkWords(): Cet6Word[] { return loadedWords; }
export function hasChunkDataset(): boolean { return !!manifest; }
