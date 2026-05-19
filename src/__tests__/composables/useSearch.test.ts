import { useSearch } from '../../composables/useSearch'
import { storage } from '../../utils/storage'

const mockFetch = global.fetch as jest.Mock

beforeEach(() => {
  localStorage.clear()
  mockFetch.mockReset()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// ---------------------------------------------------------------------------
// loadHistory
// ---------------------------------------------------------------------------

describe('loadHistory()', () => {
  it('initializes to empty array when nothing stored', () => {
    const { loadHistory, searchHistory } = useSearch()
    loadHistory()
    expect(searchHistory.value).toEqual([])
  })

  it('loads history from storage', () => {
    storage.set('searchHistory', ['batman', 'inception'])
    const { loadHistory, searchHistory } = useSearch()
    loadHistory()
    expect(searchHistory.value).toEqual(['batman', 'inception'])
  })
})

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

describe('search()', () => {
  it('clears results and sets loading to false for empty query', () => {
    const { search, results, loading } = useSearch()
    search('', 'key')
    expect(results.value).toEqual([])
    expect(loading.value).toBe(false)
  })

  it('clears results for whitespace-only query', () => {
    const { search, results, loading } = useSearch()
    search('   ', 'key')
    expect(results.value).toEqual([])
    expect(loading.value).toBe(false)
  })

  it('sets loading to true immediately for non-empty query', () => {
    const { search, loading } = useSearch()
    search('batman-load-check', 'key')
    expect(loading.value).toBe(true)
  })

  it('populates results after debounce fires', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        results: [
          { id: 1, title: 'Batman', media_type: 'movie', poster_path: null, backdrop_path: null, overview: '', vote_average: 8 },
        ],
      }),
    })
    const { search, results } = useSearch()
    search('batman-debounce-a', 'key')
    await jest.runAllTimersAsync()
    expect(results.value).toHaveLength(1)
    expect(results.value[0].title).toBe('Batman')
  })

  it('sets loading to false after debounce completes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ results: [] }),
    })
    const { search, loading } = useSearch()
    search('loading-check-unique', 'key')
    await jest.runAllTimersAsync()
    expect(loading.value).toBe(false)
  })

  it('filters out person results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        results: [
          { id: 1, title: 'Batman', media_type: 'movie', poster_path: null, backdrop_path: null, overview: '', vote_average: 8 },
          { id: 2, name: 'Christian Bale', media_type: 'person', poster_path: null, backdrop_path: null, overview: '', vote_average: 0 },
        ],
      }),
    })
    const { search, results } = useSearch()
    search('batman-person-filter-unique', 'key')
    await jest.runAllTimersAsync()
    expect(results.value).toHaveLength(1)
    expect(results.value[0].media_type).not.toBe('person')
  })

  it('limits results to 12', async () => {
    const manyResults = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      title: `Movie ${i}`,
      media_type: 'movie',
      poster_path: null,
      backdrop_path: null,
      overview: '',
      vote_average: 7,
    }))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ results: manyResults }),
    })
    const { search, results } = useSearch()
    search('many-results-unique', 'key')
    await jest.runAllTimersAsync()
    expect(results.value).toHaveLength(12)
  })

  it('clears results on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    const { search, results } = useSearch()
    search('error-query-unique', 'key')
    await jest.runAllTimersAsync()
    expect(results.value).toEqual([])
  })

  it('sets loading to false on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    const { search, loading } = useSearch()
    search('error-loading-unique', 'key')
    await jest.runAllTimersAsync()
    expect(loading.value).toBe(false)
  })

  it('cancels pending debounce when called again before it fires', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ results: [] }),
    })
    const { search } = useSearch()
    search('first-cancelled-unique', 'key')
    search('second-wins-unique', 'key')
    await jest.runAllTimersAsync()
    // Only one fetch should happen (for the second call)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// addToHistory
// ---------------------------------------------------------------------------

describe('addToHistory()', () => {
  it('adds a query to search history', () => {
    const { addToHistory, searchHistory } = useSearch()
    addToHistory('batman')
    expect(searchHistory.value).toContain('batman')
  })

  it('ignores empty query', () => {
    const { addToHistory, searchHistory } = useSearch()
    addToHistory('')
    expect(searchHistory.value).toHaveLength(0)
  })

  it('ignores whitespace-only query', () => {
    const { addToHistory, searchHistory } = useSearch()
    addToHistory('   ')
    expect(searchHistory.value).toHaveLength(0)
  })

  it('moves duplicate to front and deduplicates', () => {
    const { addToHistory, searchHistory } = useSearch()
    addToHistory('batman')
    addToHistory('inception')
    addToHistory('batman')
    expect(searchHistory.value[0]).toBe('batman')
    expect(searchHistory.value).toHaveLength(2)
  })

  it('limits history to 12 entries', () => {
    const { addToHistory, searchHistory } = useSearch()
    for (let i = 0; i < 15; i++) {
      addToHistory(`query-${i}`)
    }
    expect(searchHistory.value).toHaveLength(12)
  })

  it('persists to storage', () => {
    const { addToHistory } = useSearch()
    addToHistory('batman')
    expect(storage.get<string[]>('searchHistory')).toContain('batman')
  })
})

// ---------------------------------------------------------------------------
// removeFromHistory
// ---------------------------------------------------------------------------

describe('removeFromHistory()', () => {
  it('removes the specified query', () => {
    const { addToHistory, removeFromHistory, searchHistory } = useSearch()
    addToHistory('batman')
    addToHistory('inception')
    removeFromHistory('batman')
    expect(searchHistory.value).not.toContain('batman')
    expect(searchHistory.value).toContain('inception')
  })

  it('persists the removal to storage', () => {
    const { addToHistory, removeFromHistory } = useSearch()
    addToHistory('batman')
    removeFromHistory('batman')
    expect(storage.get<string[]>('searchHistory')).not.toContain('batman')
  })
})

// ---------------------------------------------------------------------------
// clearHistory
// ---------------------------------------------------------------------------

describe('clearHistory()', () => {
  it('empties search history', () => {
    const { addToHistory, clearHistory, searchHistory } = useSearch()
    addToHistory('batman')
    addToHistory('inception')
    clearHistory()
    expect(searchHistory.value).toHaveLength(0)
  })

  it('persists empty history to storage', () => {
    const { addToHistory, clearHistory } = useSearch()
    addToHistory('batman')
    clearHistory()
    expect(storage.get<string[]>('searchHistory')).toEqual([])
  })
})
