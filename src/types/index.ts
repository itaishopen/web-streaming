export type MediaType = 'movie' | 'tv'

export interface MediaItem {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  vote_average: number
  release_date?: string
  first_air_date?: string
  media_type?: MediaType
  genre_ids?: number[]
  original_language?: string
  origin_country?: string[]
}

export interface MovieDetails extends MediaItem {
  runtime: number
  genres: Genre[]
  belongs_to_collection: Collection | null
  videos?: { results: VideoResult[] }
  tagline?: string
  status: string
  budget?: number
  revenue?: number
}

export interface TVDetails extends MediaItem {
  number_of_seasons: number
  number_of_episodes: number
  genres: Genre[]
  seasons: Season[]
  episode_run_time: number[]
  videos?: { results: VideoResult[] }
  tagline?: string
  status: string
  last_air_date?: string
  networks?: Network[]
}

export interface Genre {
  id: number
  name: string
}

export interface Season {
  id: number
  season_number: number
  episode_count: number
  name: string
  poster_path: string | null
  air_date?: string
}

export interface Episode {
  id: number
  episode_number: number
  season_number: number
  name: string
  overview: string
  still_path: string | null
  air_date?: string
  runtime?: number
  vote_average?: number
}

export interface SeasonDetails {
  season_number: number
  episodes: Episode[]
  name: string
  poster_path: string | null
}

export interface VideoResult {
  key: string
  site: string
  type: string
  name: string
  official: boolean
}

export interface Collection {
  id: number
  name: string
  poster_path: string | null
  backdrop_path: string | null
  parts?: MediaItem[]
}

export interface Network {
  id: number
  name: string
  logo_path: string | null
}

export interface SearchResult extends Omit<MediaItem, 'media_type'> {
  media_type: MediaType | 'person'
}

export interface WatchProgress {
  watched: number   // seconds watched
  duration: number  // total seconds
  pct: number       // 0-100
  updatedAt: number // timestamp
}

export interface HistoryEntry {
  item: MediaItem
  watchedAt: number
  episodeKey?: string  // e.g. "s1e2"
  episodeName?: string
}

export interface PlayerSource {
  id: string
  label: string
  getMovieUrl: (id: number) => string
  getTvUrl: (id: number, season: number, ep: number) => string
  supportsProgress: boolean
}

export interface AnilistMedia {
  id: number
  idMal: number | null
  title: { romaji: string; english: string | null; native: string }
  description: string
  coverImage: { large: string; extraLarge: string }
  bannerImage: string | null
  genres: string[]
  averageScore: number | null
  episodes: number | null
  status: string
  season: string | null
  seasonYear: number | null
  studios: { nodes: Array<{ name: string }> }
  relations: {
    edges: Array<{
      relationType: string
      node: { id: number; title: { romaji: string }; episodes: number | null; type: string }
    }>
  }
}

export interface AccentPreset {
  id: string
  label: string
  color: string
  color2: string
  dim: string
  glow: string
}

export interface HomeRow {
  id: string
  label: string
  visible: boolean
}

export interface AppSettings {
  apiKey: string
  accentColor: string
  fontSize: 'small' | 'normal' | 'large'
  compactMode: boolean
  reduceAnimations: boolean
  recordHistory: boolean
  watchedThreshold: number
  introSkipMode: 'off' | 'auto' | 'prompt'
  ratingCountry: string
  maxAgeRating: number
  playerSource: string
  subtitlesEnabled: boolean
  defaultSubtitleLang: string
  homeViewMode: 'carousel' | 'list'
  startPage: string
}

export interface RatingInfo {
  certification: string | null
  minAge: number
}
