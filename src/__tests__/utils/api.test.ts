import {
  imgUrl,
  tmdbFetch,
  fetchAnilist,
  isAnimeContent,
  getSourceUrl,
  cleanAnilistDescription,
  PLAYER_SOURCES,
  DEFAULT_PLAYER_SOURCE,
  VALID_SOURCE_IDS,
} from '../../utils/api'
import type { MediaItem } from '../../types'

const mockFetch = global.fetch as jest.Mock

beforeEach(() => {
  mockFetch.mockReset()
})

// ---------------------------------------------------------------------------
// imgUrl
// ---------------------------------------------------------------------------

describe('imgUrl', () => {
  it('returns empty string for null', () => {
    expect(imgUrl(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(imgUrl(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(imgUrl('')).toBe('')
  })

  it('builds URL with default size w500', () => {
    expect(imgUrl('/poster.jpg')).toBe('https://image.tmdb.org/t/p/w500/poster.jpg')
  })

  it('builds URL with custom size', () => {
    expect(imgUrl('/poster.jpg', 'w300')).toBe('https://image.tmdb.org/t/p/w300/poster.jpg')
  })
})

// ---------------------------------------------------------------------------
// PLAYER_SOURCES / VALID_SOURCE_IDS / DEFAULT_PLAYER_SOURCE
// ---------------------------------------------------------------------------

describe('PLAYER_SOURCES', () => {
  it('contains autoembed, vidsrc, and allmanga sources', () => {
    const ids = PLAYER_SOURCES.map((s) => s.id)
    expect(ids).toContain('autoembed')
    expect(ids).toContain('vidsrc')
    expect(ids).toContain('allmanga')
  })

  it('every source has getMovieUrl and getTvUrl functions', () => {
    PLAYER_SOURCES.forEach((source) => {
      expect(typeof source.getMovieUrl).toBe('function')
      expect(typeof source.getTvUrl).toBe('function')
    })
  })

  it('autoembed builds correct movie URL', () => {
    const source = PLAYER_SOURCES.find((s) => s.id === 'autoembed')!
    expect(source.getMovieUrl(123)).toBe('https://player.autoembed.cc/embed/movie/123')
  })

  it('autoembed builds correct TV URL', () => {
    const source = PLAYER_SOURCES.find((s) => s.id === 'autoembed')!
    expect(source.getTvUrl(123, 2, 5)).toBe('https://player.autoembed.cc/embed/tv/123/2/5')
  })

  it('allmanga getMovieUrl returns empty string', () => {
    const source = PLAYER_SOURCES.find((s) => s.id === 'allmanga')!
    expect(source.getMovieUrl(999)).toBe('')
  })

  it('allmanga getTvUrl returns embed URL ignoring season/ep', () => {
    const source = PLAYER_SOURCES.find((s) => s.id === 'allmanga')!
    expect(source.getTvUrl(999, 1, 1)).toBe('https://allmanga.to/embed/999')
  })
})

describe('VALID_SOURCE_IDS', () => {
  it('contains every source id from PLAYER_SOURCES', () => {
    PLAYER_SOURCES.forEach((source) => {
      expect(VALID_SOURCE_IDS.has(source.id)).toBe(true)
    })
  })
})

describe('DEFAULT_PLAYER_SOURCE', () => {
  it('is a valid source id', () => {
    expect(VALID_SOURCE_IDS.has(DEFAULT_PLAYER_SOURCE)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// tmdbFetch
// ---------------------------------------------------------------------------

describe('tmdbFetch', () => {
  it('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ results: [{ id: 1 }] }),
    })
    const data = await tmdbFetch('/search/tf-success', 'test-key')
    expect(data).toEqual({ results: [{ id: 1 }] })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('includes Authorization header with api key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({}),
    })
    await tmdbFetch('/search/tf-header', 'my-secret-key')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/tf-header'),
      expect.objectContaining({ headers: { Authorization: 'Bearer my-secret-key' } }),
    )
  })

  it('returns cached result on second call (fetch called only once)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ cached: true }),
    })
    const path = '/search/tf-cache-hit'
    const first = await tmdbFetch(path, 'key')
    const second = await tmdbFetch(path, 'key')
    expect(first).toEqual(second)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
    await expect(tmdbFetch('/search/tf-error', 'bad-key')).rejects.toThrow('TMDB fetch failed: 401')
  })
})

// ---------------------------------------------------------------------------
// fetchAnilist
// ---------------------------------------------------------------------------

describe('fetchAnilist', () => {
  it('returns media on success', async () => {
    const media = { id: 1, idMal: 1001, title: { romaji: 'Test Anime' } }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: { Media: media } }),
    })
    const result = await fetchAnilist(1001)
    expect(result).toEqual(media)
  })

  it('returns null when Media is null in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: { Media: null } }),
    })
    const result = await fetchAnilist(1002)
    expect(result).toBeNull()
  })

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const result = await fetchAnilist(1003)
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const result = await fetchAnilist(1004)
    expect(result).toBeNull()
  })

  it('returns cached result on second call', async () => {
    const media = { id: 2, idMal: 1005 }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: { Media: media } }),
    })
    await fetchAnilist(1005)
    await fetchAnilist(1005)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// isAnimeContent
// ---------------------------------------------------------------------------

describe('isAnimeContent', () => {
  const base: MediaItem = {
    id: 1,
    poster_path: null,
    backdrop_path: null,
    overview: '',
    vote_average: 7,
  }

  it('returns false when genre_ids is undefined', () => {
    expect(isAnimeContent({ ...base })).toBe(false)
  })

  it('returns false when genre_ids does not include 16', () => {
    expect(isAnimeContent({ ...base, genre_ids: [28, 12] })).toBe(false)
  })

  it('returns false when genre includes 16 but not Japanese', () => {
    expect(isAnimeContent({ ...base, genre_ids: [16], original_language: 'en' })).toBe(false)
  })

  it('returns false when genre includes 16 and origin_country does not include JP', () => {
    expect(isAnimeContent({ ...base, genre_ids: [16], origin_country: ['US'] })).toBe(false)
  })

  it('returns true when genre includes 16 and original_language is ja', () => {
    expect(isAnimeContent({ ...base, genre_ids: [16], original_language: 'ja' })).toBe(true)
  })

  it('returns true when genre includes 16 and origin_country includes JP', () => {
    expect(isAnimeContent({ ...base, genre_ids: [16], origin_country: ['JP'] })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getSourceUrl
// ---------------------------------------------------------------------------

describe('getSourceUrl', () => {
  it('returns null for unknown source id', () => {
    expect(getSourceUrl('unknown-source', 'movie', 123)).toBeNull()
  })

  it('returns movie URL for known source', () => {
    expect(getSourceUrl('autoembed', 'movie', 123)).toBe(
      'https://player.autoembed.cc/embed/movie/123',
    )
  })

  it('returns TV URL for known source with season and ep', () => {
    expect(getSourceUrl('autoembed', 'tv', 123, 2, 5)).toBe(
      'https://player.autoembed.cc/embed/tv/123/2/5',
    )
  })

  it('returns null for TV without season and ep', () => {
    expect(getSourceUrl('autoembed', 'tv', 123)).toBeNull()
  })

  it('returns null for TV with season but no ep', () => {
    expect(getSourceUrl('vidsrc', 'tv', 123, 1)).toBeNull()
  })

  it('returns null for allmanga movie (empty URL)', () => {
    expect(getSourceUrl('allmanga', 'movie', 999)).toBeNull()
  })

  it('returns allmanga TV URL without requiring season/ep', () => {
    expect(getSourceUrl('allmanga', 'tv', 999)).toBe('https://allmanga.to/embed/999')
  })

  it('works for all non-allmanga sources with TV', () => {
    const tvSources = PLAYER_SOURCES.filter((s) => s.id !== 'allmanga')
    tvSources.forEach((source) => {
      const url = getSourceUrl(source.id, 'tv', 100, 1, 1)
      expect(url).not.toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// cleanAnilistDescription
// ---------------------------------------------------------------------------

describe('cleanAnilistDescription', () => {
  it('returns empty string for empty input', () => {
    expect(cleanAnilistDescription('')).toBe('')
  })

  it('removes HTML tags', () => {
    expect(cleanAnilistDescription('<p>Hello <b>world</b></p>')).toBe('Hello world')
  })

  it('converts <br> to newline', () => {
    expect(cleanAnilistDescription('Line 1<br>Line 2')).toBe('Line 1\nLine 2')
  })

  it('converts <br/> to newline', () => {
    expect(cleanAnilistDescription('Line 1<br/>Line 2')).toBe('Line 1\nLine 2')
  })

  it('removes (Source: ...) attribution', () => {
    expect(cleanAnilistDescription('Great show. (Source: Wikipedia)')).toBe('Great show.')
  })

  it('removes Source: attribution without parentheses', () => {
    const result = cleanAnilistDescription('Great show.\nSource: MyAnimeList')
    expect(result).not.toContain('Source:')
  })

  it('decodes &amp;', () => {
    expect(cleanAnilistDescription('A &amp; B')).toBe('A & B')
  })

  it('decodes &lt; and &gt;', () => {
    expect(cleanAnilistDescription('&lt;tag&gt;')).toBe('<tag>')
  })

  it('decodes &quot;', () => {
    expect(cleanAnilistDescription('Say &quot;hello&quot;')).toBe('Say "hello"')
  })

  it("decodes &#039;", () => {
    expect(cleanAnilistDescription("It&#039;s fine")).toBe("It's fine")
  })

  it('decodes &nbsp; to space', () => {
    expect(cleanAnilistDescription('non&nbsp;breaking')).toBe('non breaking')
  })

  it('collapses 3+ blank lines into 2', () => {
    expect(cleanAnilistDescription('Para 1\n\n\n\nPara 2')).toBe('Para 1\n\nPara 2')
  })

  it('trims leading and trailing whitespace', () => {
    expect(cleanAnilistDescription('  hello  ')).toBe('hello')
  })
})
