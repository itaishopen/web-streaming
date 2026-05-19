import { certToMinAge, isRestricted, fetchMovieRating, fetchTVRating } from '../../utils/ageRating'

// Ensure localStorage returns 'US' for the rating country key
beforeEach(() => {
  localStorage.clear()
  // The storage utility uses 'webstream_ratingCountry' as the key
  localStorage.setItem('webstream_ratingCountry', JSON.stringify('US'))
  jest.clearAllMocks()
})

describe('certToMinAge()', () => {
  describe('US ratings', () => {
    it('maps "G" to 0', () => {
      expect(certToMinAge('G', 'US')).toBe(0)
    })

    it('maps "PG-13" to 13', () => {
      expect(certToMinAge('PG-13', 'US')).toBe(13)
    })

    it('maps "R" to 17', () => {
      expect(certToMinAge('R', 'US')).toBe(17)
    })

    it('maps "NC-17" to 18', () => {
      expect(certToMinAge('NC-17', 'US')).toBe(18)
    })
  })

  describe('DE ratings', () => {
    it('maps "FSK 16" to 16', () => {
      expect(certToMinAge('FSK 16', 'DE')).toBe(16)
    })

    it('maps "FSK 18" to 18', () => {
      expect(certToMinAge('FSK 18', 'DE')).toBe(18)
    })
  })

  describe('GB ratings', () => {
    it('maps "15" to 15', () => {
      expect(certToMinAge('15', 'GB')).toBe(15)
    })
  })

  describe('unknown cert', () => {
    it('returns 0 for an unknown certification', () => {
      expect(certToMinAge('UNKNOWN', 'US')).toBe(0)
    })

    it('returns 0 for an unrecognised country (falls back to US) with unknown cert', () => {
      expect(certToMinAge('BLAH', 'ZZ')).toBe(0)
    })
  })

  describe('case insensitivity', () => {
    it('maps "pg-13" (lower-case) to 13', () => {
      expect(certToMinAge('pg-13', 'US')).toBe(13)
    })

    it('maps "r" (lower-case) to 17', () => {
      expect(certToMinAge('r', 'US')).toBe(17)
    })
  })
})

describe('isRestricted()', () => {
  it('returns false when limitAge is 0 (no restriction)', () => {
    expect(isRestricted(13, 0)).toBe(false)
  })

  it('returns true when minAge exceeds limitAge', () => {
    expect(isRestricted(18, 16)).toBe(true)
  })

  it('returns false when minAge is below limitAge', () => {
    expect(isRestricted(12, 16)).toBe(false)
  })

  it('returns false when minAge equals limitAge (not strictly greater)', () => {
    expect(isRestricted(17, 17)).toBe(false)
  })
})

describe('fetchMovieRating()', () => {
  it('returns certification and minAge from a US PG-13 TMDB response', async () => {
    const mockResponse = {
      results: [
        {
          iso_3166_1: 'US',
          release_dates: [
            { certification: 'PG-13' },
          ],
        },
      ],
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    })

    const result = await fetchMovieRating(550, 'test-api-key')
    expect(result).toEqual({ certification: 'PG-13', minAge: 13 })
  })

  it('returns { certification: null, minAge: 0 } when fetch throws', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchMovieRating(550, 'test-api-key')
    expect(result).toEqual({ certification: null, minAge: 0 })
  })

  it('uses the preferred country result when available', async () => {
    localStorage.setItem('webstream_ratingCountry', JSON.stringify('DE'))
    const mockResponse = {
      results: [
        {
          iso_3166_1: 'DE',
          release_dates: [{ certification: 'FSK 18' }],
        },
        {
          iso_3166_1: 'US',
          release_dates: [{ certification: 'R' }],
        },
      ],
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    })

    const result = await fetchMovieRating(550, 'test-api-key')
    expect(result.certification).toBe('FSK 18')
    expect(result.minAge).toBe(18)
  })

  it('falls back to US result when preferred country not found', async () => {
    localStorage.setItem('webstream_ratingCountry', JSON.stringify('FR'))
    const mockResponse = {
      results: [
        {
          iso_3166_1: 'US',
          release_dates: [{ certification: 'PG-13' }],
        },
      ],
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    })

    const result = await fetchMovieRating(550, 'test-api-key')
    expect(result.certification).toBe('PG-13')
    expect(result.minAge).toBe(13)
  })
})

describe('fetchTVRating()', () => {
  it('returns certification and minAge from a US PG-13 TMDB TV response', async () => {
    const mockResponse = {
      results: [
        {
          iso_3166_1: 'US',
          rating: 'PG-13',
        },
      ],
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    })

    const result = await fetchTVRating(1396, 'test-api-key')
    expect(result).toEqual({ certification: 'PG-13', minAge: 13 })
  })

  it('returns { certification: null, minAge: 0 } when fetch throws', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchTVRating(1396, 'test-api-key')
    expect(result).toEqual({ certification: null, minAge: 0 })
  })

  it('uses the preferred country result for TV ratings', async () => {
    localStorage.setItem('webstream_ratingCountry', JSON.stringify('DE'))
    const mockResponse = {
      results: [
        { iso_3166_1: 'DE', rating: 'FSK 16' },
        { iso_3166_1: 'US', rating: 'TV-MA' },
      ],
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    })

    const result = await fetchTVRating(1396, 'test-api-key')
    expect(result.certification).toBe('FSK 16')
    expect(result.minAge).toBe(16)
  })
})
