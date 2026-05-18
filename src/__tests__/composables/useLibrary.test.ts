import { useLibrary } from '../../composables/useLibrary'
import { storage, STORAGE_KEYS } from '../../utils/storage'
import type { MediaItem, HistoryEntry, WatchProgress } from '../../types'

const sampleMovie: MediaItem = {
  id: 1,
  title: 'Test Movie',
  poster_path: null,
  backdrop_path: null,
  overview: '',
  vote_average: 7.5,
  media_type: 'movie',
}

const sampleTVShow: MediaItem = {
  id: 2,
  name: 'Test Show',
  poster_path: null,
  backdrop_path: null,
  overview: '',
  vote_average: 8.0,
  media_type: 'tv',
}

function makeEntry(item: MediaItem, episodeKey?: string): HistoryEntry {
  return { item, watchedAt: Date.now(), episodeKey }
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadLibrary()', () => {
  it('initializes saved as an empty array when nothing is in storage', () => {
    const { loadLibrary, saved } = useLibrary()
    loadLibrary()
    expect(saved.value).toEqual([])
  })

  it('initializes history as an empty array when nothing is in storage', () => {
    const { loadLibrary, history } = useLibrary()
    loadLibrary()
    expect(history.value).toEqual([])
  })

  it('initializes progress as an empty object when nothing is in storage', () => {
    const { loadLibrary, progress } = useLibrary()
    loadLibrary()
    expect(progress.value).toEqual({})
  })

  it('initializes watched as an empty object when nothing is in storage', () => {
    const { loadLibrary, watched } = useLibrary()
    loadLibrary()
    expect(watched.value).toEqual({})
  })

  it('loads previously persisted data from storage', () => {
    storage.set(STORAGE_KEYS.SAVED, [sampleMovie])
    const { loadLibrary, saved } = useLibrary()
    loadLibrary()
    expect(saved.value).toHaveLength(1)
    expect(saved.value[0].id).toBe(1)
  })
})

describe('saveItem()', () => {
  it('adds an item to saved', () => {
    const { loadLibrary, saveItem, saved } = useLibrary()
    loadLibrary()
    saveItem(sampleMovie)
    expect(saved.value).toHaveLength(1)
    expect(saved.value[0].id).toBe(1)
  })

  it('prepends item to saved (newest first)', () => {
    const { loadLibrary, saveItem, saved } = useLibrary()
    loadLibrary()
    saveItem(sampleMovie)
    saveItem(sampleTVShow)
    expect(saved.value[0].id).toBe(2)
    expect(saved.value[1].id).toBe(1)
  })

  it('does not add duplicates with the same id and media_type', () => {
    const { loadLibrary, saveItem, saved } = useLibrary()
    loadLibrary()
    saveItem(sampleMovie)
    saveItem(sampleMovie)
    expect(saved.value).toHaveLength(1)
  })

  it('persists the item to localStorage', () => {
    const { loadLibrary, saveItem } = useLibrary()
    loadLibrary()
    saveItem(sampleMovie)
    const persisted = storage.get<MediaItem[]>(STORAGE_KEYS.SAVED)
    expect(persisted).toHaveLength(1)
    expect(persisted![0].id).toBe(1)
  })

  it('allows saving items with same id but different media_type', () => {
    const movieVersion = { ...sampleTVShow, media_type: 'movie' as const }
    const { loadLibrary, saveItem, saved } = useLibrary()
    loadLibrary()
    saveItem(sampleTVShow)
    saveItem(movieVersion)
    expect(saved.value).toHaveLength(2)
  })
})

describe('removeItem()', () => {
  it('removes item from saved by id and media_type', () => {
    const { loadLibrary, saveItem, removeItem, saved } = useLibrary()
    loadLibrary()
    saveItem(sampleMovie)
    saveItem(sampleTVShow)
    removeItem(1, 'movie')
    expect(saved.value).toHaveLength(1)
    expect(saved.value[0].id).toBe(2)
  })

  it('persists the removal to localStorage', () => {
    const { loadLibrary, saveItem, removeItem } = useLibrary()
    loadLibrary()
    saveItem(sampleMovie)
    removeItem(1, 'movie')
    const persisted = storage.get<MediaItem[]>(STORAGE_KEYS.SAVED)
    expect(persisted).toHaveLength(0)
  })
})

describe('isSaved()', () => {
  it('returns true after saveItem', () => {
    const { loadLibrary, saveItem, isSaved } = useLibrary()
    loadLibrary()
    saveItem(sampleMovie)
    expect(isSaved(1, 'movie')).toBe(true)
  })

  it('returns false before saving', () => {
    const { loadLibrary, isSaved } = useLibrary()
    loadLibrary()
    expect(isSaved(1, 'movie')).toBe(false)
  })

  it('returns false after removeItem', () => {
    const { loadLibrary, saveItem, removeItem, isSaved } = useLibrary()
    loadLibrary()
    saveItem(sampleMovie)
    removeItem(1, 'movie')
    expect(isSaved(1, 'movie')).toBe(false)
  })
})

describe('addHistory()', () => {
  it('prepends entry to history', () => {
    const { loadLibrary, addHistory, history } = useLibrary()
    loadLibrary()
    const entry1 = makeEntry(sampleMovie)
    const entry2 = makeEntry(sampleTVShow)
    addHistory(entry1)
    addHistory(entry2)
    expect(history.value[0].item.id).toBe(2)
    expect(history.value[1].item.id).toBe(1)
  })

  it('deduplicates by item.id + episodeKey (moves to front)', () => {
    const { loadLibrary, addHistory, history } = useLibrary()
    loadLibrary()
    const entry = makeEntry(sampleMovie, 's1e1')
    addHistory(entry)
    addHistory(makeEntry(sampleTVShow))
    // Re-add the same movie episode
    addHistory(makeEntry(sampleMovie, 's1e1'))
    expect(history.value).toHaveLength(2)
    expect(history.value[0].item.id).toBe(1)
    expect(history.value[0].episodeKey).toBe('s1e1')
  })

  it('trims history to 100 entries', () => {
    const { loadLibrary, addHistory, history } = useLibrary()
    loadLibrary()
    for (let i = 0; i < 110; i++) {
      addHistory(makeEntry({ ...sampleMovie, id: i + 100 }))
    }
    expect(history.value).toHaveLength(100)
  })

  it('persists history to localStorage', () => {
    const { loadLibrary, addHistory } = useLibrary()
    loadLibrary()
    addHistory(makeEntry(sampleMovie))
    const persisted = storage.get<HistoryEntry[]>(STORAGE_KEYS.HISTORY)
    expect(persisted).toHaveLength(1)
  })
})

describe('saveProgress() and getProgress()', () => {
  it('stores and retrieves progress by key', () => {
    const { loadLibrary, saveProgress, getProgress } = useLibrary()
    loadLibrary()
    const prog: WatchProgress = { watched: 300, duration: 600, pct: 50, updatedAt: Date.now() }
    saveProgress('movie_1', prog)
    expect(getProgress('movie_1')).toEqual(prog)
  })

  it('returns undefined for unknown key', () => {
    const { loadLibrary, getProgress } = useLibrary()
    loadLibrary()
    expect(getProgress('missing_key')).toBeUndefined()
  })

  it('persists progress to localStorage', () => {
    const { loadLibrary, saveProgress } = useLibrary()
    loadLibrary()
    const prog: WatchProgress = { watched: 60, duration: 120, pct: 50, updatedAt: 0 }
    saveProgress('movie_1', prog)
    const stored = storage.get<Record<string, WatchProgress>>(STORAGE_KEYS.PROGRESS)
    expect(stored!['movie_1']).toEqual(prog)
  })
})

describe('markWatched() and markUnwatched() and isWatched()', () => {
  it('isWatched returns true after markWatched', () => {
    const { loadLibrary, markWatched, isWatched } = useLibrary()
    loadLibrary()
    markWatched('movie_1')
    expect(isWatched('movie_1')).toBe(true)
  })

  it('isWatched returns false for unmarked key', () => {
    const { loadLibrary, isWatched } = useLibrary()
    loadLibrary()
    expect(isWatched('movie_1')).toBe(false)
  })

  it('isWatched returns false after markUnwatched', () => {
    const { loadLibrary, markWatched, markUnwatched, isWatched } = useLibrary()
    loadLibrary()
    markWatched('movie_1')
    markUnwatched('movie_1')
    expect(isWatched('movie_1')).toBe(false)
  })

  it('persists watched state to localStorage', () => {
    const { loadLibrary, markWatched } = useLibrary()
    loadLibrary()
    markWatched('movie_1')
    const stored = storage.get<Record<string, boolean>>(STORAGE_KEYS.WATCHED)
    expect(stored!['movie_1']).toBe(true)
  })
})

describe('clearHistory()', () => {
  it('empties history', () => {
    const { loadLibrary, addHistory, clearHistory, history } = useLibrary()
    loadLibrary()
    addHistory(makeEntry(sampleMovie))
    addHistory(makeEntry(sampleTVShow))
    clearHistory()
    expect(history.value).toHaveLength(0)
  })

  it('persists empty history to localStorage', () => {
    const { loadLibrary, addHistory, clearHistory } = useLibrary()
    loadLibrary()
    addHistory(makeEntry(sampleMovie))
    clearHistory()
    expect(storage.get<HistoryEntry[]>(STORAGE_KEYS.HISTORY)).toEqual([])
  })
})

describe('clearProgress()', () => {
  it('empties progress', () => {
    const { loadLibrary, saveProgress, clearProgress, progress } = useLibrary()
    loadLibrary()
    saveProgress('movie_1', { watched: 60, duration: 120, pct: 50, updatedAt: 0 })
    clearProgress()
    expect(progress.value).toEqual({})
  })

  it('empties watched', () => {
    const { loadLibrary, markWatched, clearProgress, watched } = useLibrary()
    loadLibrary()
    markWatched('movie_1')
    clearProgress()
    expect(watched.value).toEqual({})
  })

  it('persists empty progress and watched to localStorage', () => {
    const { loadLibrary, saveProgress, markWatched, clearProgress } = useLibrary()
    loadLibrary()
    saveProgress('movie_1', { watched: 60, duration: 120, pct: 50, updatedAt: 0 })
    markWatched('movie_1')
    clearProgress()
    expect(storage.get(STORAGE_KEYS.PROGRESS)).toEqual({})
    expect(storage.get(STORAGE_KEYS.WATCHED)).toEqual({})
  })
})

describe('inProgress computed', () => {
  it('returns items with pct between 5 and 95 (inclusive)', () => {
    const { loadLibrary, addHistory, saveProgress, inProgress } = useLibrary()
    loadLibrary()

    // Movie with pct = 50 -> should be included
    const key50 = `movie_${sampleMovie.id}`
    addHistory(makeEntry(sampleMovie))
    saveProgress(key50, { watched: 300, duration: 600, pct: 50, updatedAt: 0 })

    expect(inProgress.value).toHaveLength(1)
    expect(inProgress.value[0].id).toBe(sampleMovie.id)
  })

  it('excludes items with pct < 5', () => {
    const { loadLibrary, addHistory, saveProgress, inProgress } = useLibrary()
    loadLibrary()
    addHistory(makeEntry(sampleMovie))
    saveProgress(`movie_${sampleMovie.id}`, { watched: 2, duration: 600, pct: 0.3, updatedAt: 0 })
    expect(inProgress.value).toHaveLength(0)
  })

  it('excludes items with pct > 95', () => {
    const { loadLibrary, addHistory, saveProgress, inProgress } = useLibrary()
    loadLibrary()
    addHistory(makeEntry(sampleMovie))
    saveProgress(`movie_${sampleMovie.id}`, { watched: 590, duration: 600, pct: 98, updatedAt: 0 })
    expect(inProgress.value).toHaveLength(0)
  })

  it('includes items with pct exactly 5', () => {
    const { loadLibrary, addHistory, saveProgress, inProgress } = useLibrary()
    loadLibrary()
    addHistory(makeEntry(sampleMovie))
    saveProgress(`movie_${sampleMovie.id}`, { watched: 30, duration: 600, pct: 5, updatedAt: 0 })
    expect(inProgress.value).toHaveLength(1)
  })

  it('includes items with pct exactly 95', () => {
    const { loadLibrary, addHistory, saveProgress, inProgress } = useLibrary()
    loadLibrary()
    addHistory(makeEntry(sampleMovie))
    saveProgress(`movie_${sampleMovie.id}`, { watched: 570, duration: 600, pct: 95, updatedAt: 0 })
    expect(inProgress.value).toHaveLength(1)
  })

  it('uses tv_<id>_<episodeKey> key format for TV episode progress', () => {
    const { loadLibrary, addHistory, saveProgress, inProgress } = useLibrary()
    loadLibrary()
    addHistory(makeEntry(sampleTVShow, 's1e1'))
    saveProgress(`tv_${sampleTVShow.id}_s1e1`, { watched: 600, duration: 2400, pct: 25, updatedAt: 0 })
    expect(inProgress.value).toHaveLength(1)
    expect(inProgress.value[0].id).toBe(sampleTVShow.id)
  })

  it('returns empty array when no history', () => {
    const { loadLibrary, inProgress } = useLibrary()
    loadLibrary()
    expect(inProgress.value).toEqual([])
  })
})
