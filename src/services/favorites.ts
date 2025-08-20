// 收藏词汇管理
import { useCallback, useState } from 'react';

const KEY = 'cet6_fav_v1';

function load(): Record<string, true> {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { }
    return {};
}
function save(map: Record<string, true>) {
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { }
}

export interface UseFavoritesResult {
    favorites: Record<string, true>;
    toggleFavorite: (word: string) => void;
    isFavorite: (word: string) => boolean;
    clearFavorites: () => void;
    importFavorites: (list: string[]) => void;
}

export function useFavorites(): UseFavoritesResult {
    const [favorites, setFavorites] = useState<Record<string, true>>(() => load());

    const persist = useCallback((next: Record<string, true>) => { setFavorites(next); save(next); }, []);

    const toggleFavorite = useCallback((word: string) => {
        setFavorites(prev => {
            const copy = { ...prev } as Record<string, true>;
            if (copy[word]) delete copy[word]; else copy[word] = true;
            save(copy);
            return copy;
        });
    }, []);

    const isFavorite = useCallback((word: string) => !!favorites[word], [favorites]);
    const clearFavorites = useCallback(() => persist({}), [persist]);
    const importFavorites = useCallback((list: string[]) => {
        const merged: Record<string, true> = {};
        list.forEach(w => { if (w) merged[w] = true; });
        persist(merged);
    }, [persist]);

    return { favorites, toggleFavorite, isFavorite, clearFavorites, importFavorites };
}

export function exportFavorites(favs: Record<string, true>): string[] { return Object.keys(favs); }
