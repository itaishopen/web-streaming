const PREFIX = 'webstream_'

export const storage = {
  get<T>(key: string, fallback?: T): T | undefined {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw === null) return fallback
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // storage full or private mode
    }
  },
  remove(key: string): void {
    localStorage.removeItem(PREFIX + key)
  },
  clearAll(): void {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) toRemove.push(k)
    }
    toRemove.forEach((k) => localStorage.removeItem(k))
  },
}

export const STORAGE_KEYS = {
  API_KEY: 'apikey',
  SAVED: 'saved',
  HISTORY: 'history',
  PROGRESS: 'progress',
  WATCHED: 'watched',
  ACCENT_COLOR: 'accentColor',
  FONT_SIZE: 'fontSize',
  COMPACT_MODE: 'compactMode',
  REDUCE_ANIMATIONS: 'reduceAnimations',
  RECORD_HISTORY: 'recordHistory',
  WATCHED_THRESHOLD: 'watchedThreshold',
  INTRO_SKIP_MODE: 'introSkipMode',
  RATING_COUNTRY: 'ratingCountry',
  MAX_AGE_RATING: 'maxAgeRating',
  PLAYER_SOURCE: 'playerSource',
  SUBTITLES_ENABLED: 'subtitlesEnabled',
  DEFAULT_SUBTITLE_LANG: 'defaultSubtitleLang',
  HOME_VIEW_MODE: 'homeViewMode',
  HOME_LAYOUT: 'homeLayout',
  START_PAGE: 'startPage',
  WATCHLIST_SORT: 'watchlistSort',
  TRENDING_CACHE: 'trendingCache',
  TRENDING_CACHE_DATE: 'trendingCacheDate',
  ANILIST_CACHE: 'anilistCache',
  EPISODE_GROUP_CACHE: 'episodeGroupCache',
} as const

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function clearAppCaches(): void {
  const cacheKeys = [
    STORAGE_KEYS.TRENDING_CACHE,
    STORAGE_KEYS.TRENDING_CACHE_DATE,
    STORAGE_KEYS.ANILIST_CACHE,
    STORAGE_KEYS.EPISODE_GROUP_CACHE,
  ]
  cacheKeys.forEach((k) => storage.remove(k))
  if ('caches' in window) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)))
  }
}
