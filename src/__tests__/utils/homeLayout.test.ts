import {
  loadHomeLayout,
  saveHomeLayout,
  loadHomeViewMode,
  saveHomeViewMode,
  loadStartPage,
  DEFAULT_ROWS,
} from '../../utils/homeLayout'
import type { HomeRow } from '../../types'

beforeEach(() => {
  localStorage.clear()
})

describe('loadHomeLayout()', () => {
  it('returns 5 default rows when nothing is saved', () => {
    const rows = loadHomeLayout()
    expect(rows).toHaveLength(5)
  })

  it('default rows have ids: continue, similar, movies, series, toprated', () => {
    const rows = loadHomeLayout()
    const ids = rows.map((r) => r.id)
    expect(ids).toContain('continue')
    expect(ids).toContain('similar')
    expect(ids).toContain('movies')
    expect(ids).toContain('series')
    expect(ids).toContain('toprated')
  })

  it('all default rows have visible: true', () => {
    const rows = loadHomeLayout()
    rows.forEach((row) => {
      expect(row.visible).toBe(true)
    })
  })

  it('returns default rows in the canonical order', () => {
    const rows = loadHomeLayout()
    expect(rows[0].id).toBe('continue')
    expect(rows[1].id).toBe('similar')
    expect(rows[2].id).toBe('movies')
    expect(rows[3].id).toBe('series')
    expect(rows[4].id).toBe('toprated')
  })
})

describe('saveHomeLayout() + loadHomeLayout()', () => {
  it('returns the saved order after saveHomeLayout', () => {
    const customOrder: HomeRow[] = [
      { id: 'movies',   label: 'Trending Movies',    visible: true },
      { id: 'series',   label: 'Trending Series',    visible: false },
      { id: 'toprated', label: 'Top Rated',          visible: true },
      { id: 'continue', label: 'Continue Watching',  visible: true },
      { id: 'similar',  label: 'Similar To…',        visible: true },
    ]
    saveHomeLayout(customOrder)
    const loaded = loadHomeLayout()
    expect(loaded[0].id).toBe('movies')
    expect(loaded[1].id).toBe('series')
    expect(loaded[2].id).toBe('toprated')
    expect(loaded[3].id).toBe('continue')
    expect(loaded[4].id).toBe('similar')
  })

  it('preserves the visible flag for each row', () => {
    const customOrder: HomeRow[] = [
      { id: 'movies',   label: 'Trending Movies', visible: false },
      { id: 'series',   label: 'Trending Series', visible: true },
      { id: 'toprated', label: 'Top Rated',       visible: false },
      { id: 'continue', label: 'Continue',        visible: true },
      { id: 'similar',  label: 'Similar',         visible: true },
    ]
    saveHomeLayout(customOrder)
    const loaded = loadHomeLayout()
    const moviesRow = loaded.find((r) => r.id === 'movies')!
    expect(moviesRow.visible).toBe(false)
  })
})

describe('loadHomeLayout() with partial saved data', () => {
  it('appends missing rows at the end when saved data omits a row', () => {
    const partial: HomeRow[] = [
      { id: 'movies',  label: 'Trending Movies', visible: true },
      { id: 'series',  label: 'Trending Series', visible: true },
      { id: 'toprated', label: 'Top Rated',      visible: true },
      // 'continue' and 'similar' are missing
    ]
    saveHomeLayout(partial)
    const loaded = loadHomeLayout()
    expect(loaded).toHaveLength(5)
    const ids = loaded.map((r) => r.id)
    expect(ids).toContain('continue')
    expect(ids).toContain('similar')
    // The saved rows come first
    expect(ids[0]).toBe('movies')
    expect(ids[1]).toBe('series')
    expect(ids[2]).toBe('toprated')
  })

  it('filters out unknown row ids', () => {
    const withUnknown = [
      { id: 'movies',  label: 'Trending Movies', visible: true },
      { id: 'INVALID', label: 'Unknown Row',      visible: true },
      { id: 'series',  label: 'Trending Series',  visible: true },
      { id: 'toprated', label: 'Top Rated',       visible: true },
      { id: 'continue', label: 'Continue',        visible: true },
      { id: 'similar', label: 'Similar',          visible: true },
    ]
    saveHomeLayout(withUnknown as HomeRow[])
    const loaded = loadHomeLayout()
    const ids = loaded.map((r) => r.id)
    expect(ids).not.toContain('INVALID')
    expect(loaded).toHaveLength(5)
  })
})

describe('loadHomeViewMode()', () => {
  it('returns "carousel" by default when nothing is saved', () => {
    expect(loadHomeViewMode()).toBe('carousel')
  })
})

describe('saveHomeViewMode() + loadHomeViewMode()', () => {
  it('returns "list" after saving "list"', () => {
    saveHomeViewMode('list')
    expect(loadHomeViewMode()).toBe('list')
  })

  it('returns "carousel" after saving "carousel"', () => {
    saveHomeViewMode('carousel')
    expect(loadHomeViewMode()).toBe('carousel')
  })
})

describe('loadStartPage()', () => {
  it('returns "home" by default', () => {
    expect(loadStartPage()).toBe('home')
  })

  it('returns stored value when set via storage', () => {
    // Use storage.set via the underlying storage util to pre-populate
    localStorage.setItem('webstream_startPage', JSON.stringify('library'))
    expect(loadStartPage()).toBe('library')
  })
})

describe('DEFAULT_ROWS', () => {
  it('exports DEFAULT_ROWS with the five expected rows', () => {
    expect(DEFAULT_ROWS).toHaveLength(5)
    const ids = DEFAULT_ROWS.map((r) => r.id)
    expect(ids).toEqual(['continue', 'similar', 'movies', 'series', 'toprated'])
  })
})
