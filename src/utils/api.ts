import type { AnilistMedia, MediaItem, PlayerSource } from '../types'

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export function imgUrl(path: string | null | undefined, size = 'w500'): string {
  if (!path) return ''
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

// ---------------------------------------------------------------------------
// Player sources
// ---------------------------------------------------------------------------

export const PLAYER_SOURCES: PlayerSource[] = [
  {
    id: 'autoembed',
    label: 'AutoEmbed',
    getMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    getTvUrl: (id, season, ep) => `https://player.autoembed.cc/embed/tv/${id}/${season}/${ep}`,
    supportsProgress: false,
  },
  {
    id: 'vidsrc',
    label: 'VidSrc',
    getMovieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    getTvUrl: (id, season, ep) => `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${ep}`,
    supportsProgress: false,
  },
  {
    id: 'vidbinge',
    label: 'VidBinge',
    getMovieUrl: (id) => `https://embed.vidbinge.com/embed/movie/${id}`,
    getTvUrl: (id, season, ep) => `https://embed.vidbinge.com/embed/tv/${id}/${season}/${ep}`,
    supportsProgress: false,
  },
  {
    id: 'vidsrc-icu',
    label: 'VidSrc ICU',
    getMovieUrl: (id) => `https://vidsrc.icu/embed/movie/${id}`,
    getTvUrl: (id, season, ep) => `https://vidsrc.icu/embed/tv/${id}/${season}/${ep}`,
    supportsProgress: false,
  },
  {
    id: 'vidsrc-mov',
    label: 'VidSrc MOV',
    getMovieUrl: (id) => `https://vidsrc.mov/embed/movie/${id}`,
    getTvUrl: (id, season, ep) => `https://vidsrc.mov/embed/tv/${id}/${season}/${ep}`,
    supportsProgress: false,
  },
  {
    id: 'superembed',
    label: 'SuperEmbed',
    getMovieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    getTvUrl: (id, season, ep) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${ep}`,
    supportsProgress: false,
  },
  {
    id: 'vidlink',
    label: 'VidLink',
    getMovieUrl: (id) => `https://vidlink.pro/movie/${id}`,
    getTvUrl: (id, season, ep) => `https://vidlink.pro/tv/${id}/${season}/${ep}`,
    supportsProgress: false,
  },
  {
    id: 'vidnest',
    label: 'VidNest',
    getMovieUrl: (id) => `https://vidnest.fun/movie/${id}`,
    getTvUrl: (id, season, ep) => `https://vidnest.fun/tv/${id}/${season}/${ep}`,
    supportsProgress: false,
  },
  {
    id: 'allmanga',
    label: 'AllManga',
    getMovieUrl: (_id) => '',
    getTvUrl: (id, _season, _ep) => `https://allmanga.to/embed/${id}`,
    supportsProgress: false,
  },
]

export const DEFAULT_PLAYER_SOURCE = 'autoembed'

/** Valid source IDs — used to migrate stale localStorage values. */
export const VALID_SOURCE_IDS = new Set(PLAYER_SOURCES.map((s) => s.id))

// ---------------------------------------------------------------------------
// Request queue — max 4 concurrent
// ---------------------------------------------------------------------------

interface QueueEntry {
  run: () => Promise<unknown>
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

let activeCount = 0
const MAX_CONCURRENT = 4
const queue: QueueEntry[] = []

function processQueue(): void {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const entry = queue.shift()!
    activeCount++
    entry
      .run()
      .then((val) => {
        activeCount--
        entry.resolve(val)
        processQueue()
      })
      .catch((err) => {
        activeCount--
        entry.reject(err)
        processQueue()
      })
  }
}

function enqueue<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ run: run as () => Promise<unknown>, resolve: resolve as (v: unknown) => void, reject })
    processQueue()
  })
}

// ---------------------------------------------------------------------------
// Session cache — 5-minute TTL
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: unknown
  expiresAt: number
}

const SESSION_CACHE = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function cacheGet<T>(key: string): T | null {
  const entry = SESSION_CACHE.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    SESSION_CACHE.delete(key)
    return null
  }
  return entry.data as T
}

function cacheSet(key: string, data: unknown): void {
  SESSION_CACHE.set(key, { data, expiresAt: Date.now() + CACHE_TTL })
}

// ---------------------------------------------------------------------------
// TMDB fetch
// ---------------------------------------------------------------------------

const TMDB_BASE = 'https://api.themoviedb.org/3'

export async function tmdbFetch<T = unknown>(path: string, apiKey: string): Promise<T> {
  const cacheKey = `tmdb:${path}`
  const cached = cacheGet<T>(cacheKey)
  if (cached !== null) return cached

  const result = await enqueue<T>(async () => {
    // Re-check cache after waiting in queue — another task may have fetched it
    const fresh = cacheGet<T>(cacheKey)
    if (fresh !== null) return fresh

    const res = await fetch(`${TMDB_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      throw new Error(`TMDB fetch failed: ${res.status} ${res.statusText} — ${path}`)
    }
    const data = (await res.json()) as T
    cacheSet(cacheKey, data)
    return data
  })

  return result
}

// ---------------------------------------------------------------------------
// AniList fetch
// ---------------------------------------------------------------------------

const ANILIST_QUERY = `
query ($malId: Int) {
  Media(idMal: $malId, type: ANIME) {
    id
    idMal
    title {
      romaji
      english
      native
    }
    description
    coverImage {
      large
      extraLarge
    }
    bannerImage
    genres
    averageScore
    episodes
    status
    season
    seasonYear
    studios {
      nodes {
        name
      }
    }
    relations {
      edges {
        relationType
        node {
          id
          title {
            romaji
          }
          episodes
          type
        }
      }
    }
  }
}
`.trim()

export async function fetchAnilist(malId: number): Promise<AnilistMedia | null> {
  const cacheKey = `anilist:${malId}`
  const cached = cacheGet<AnilistMedia | null>(cacheKey)
  if (cached !== undefined && cached !== null) return cached

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { malId } }),
    })
    if (!res.ok) {
      throw new Error(`AniList fetch failed: ${res.status}`)
    }
    const json = (await res.json()) as { data: { Media: AnilistMedia | null } }
    const media = json.data?.Media ?? null
    cacheSet(cacheKey, media)
    return media
  } catch {
    cacheSet(cacheKey, null)
    return null
  }
}

// ---------------------------------------------------------------------------
// Anime detection
// ---------------------------------------------------------------------------

export function isAnimeContent(item: MediaItem): boolean {
  const hasAnimeGenre = item.genre_ids?.includes(16) ?? false
  if (!hasAnimeGenre) return false
  const isJapanese = item.original_language === 'ja'
  const hasJpOrigin = item.origin_country?.includes('JP') ?? false
  return isJapanese || hasJpOrigin
}

// ---------------------------------------------------------------------------
// Source URL builder
// ---------------------------------------------------------------------------

export function getSourceUrl(
  sourceId: string,
  type: 'movie' | 'tv',
  id: number,
  season?: number,
  ep?: number,
): string | null {
  const source = PLAYER_SOURCES.find((s) => s.id === sourceId)
  if (!source) return null

  if (type === 'movie') {
    const url = source.getMovieUrl(id)
    return url || null
  }

  // TV / anime
  if (sourceId === 'allmanga') {
    // allmanga uses the anime id directly and doesn't need season/ep in the URL
    const url = source.getTvUrl(id, season ?? 1, ep ?? 1)
    return url || null
  }

  if (season === undefined || ep === undefined) return null
  const url = source.getTvUrl(id, season, ep)
  return url || null
}

// ---------------------------------------------------------------------------
// AniList description cleaner
// ---------------------------------------------------------------------------

export function cleanAnilistDescription(html: string): string {
  if (!html) return ''
  // Remove source notes like "(Source: ...)" or "Source: ..."
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\(Source:[^)]*\)/gi, '')
    .replace(/Source:[^\n]*/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text
}
