import { Page, expect } from '@playwright/test'

// Seeds localStorage with a fake API key so setup screen is skipped
export async function seedApiKey(page: Page, key = 'fake-tmdb-key-for-testing'): Promise<void> {
  await page.addInitScript((k) => {
    localStorage.setItem('streambert_apikey', JSON.stringify(k))
  }, key)
}

// Seeds a saved item into library
export async function seedSavedItem(page: Page, item: Record<string, unknown>): Promise<void> {
  await page.addInitScript((i) => {
    localStorage.setItem('streambert_saved', JSON.stringify([i]))
  }, item)
}

// Seeds watch history
export async function seedHistory(page: Page, entry: Record<string, unknown>): Promise<void> {
  await page.addInitScript((e) => {
    localStorage.setItem('streambert_history', JSON.stringify([e]))
  }, entry)
}

// Seeds watch progress
export async function seedProgress(page: Page, key: string, pct: number): Promise<void> {
  await page.addInitScript(([k, p]) => {
    const prog = { watched: p * 60, duration: 100 * 60, pct: p, updatedAt: Date.now() }
    localStorage.setItem('streambert_progress', JSON.stringify({ [k]: prog }))
  }, [key, pct] as [string, number])
}

/**
 * Mocks all TMDB trending/top-rated endpoints AND asserts each request carries
 * a valid Bearer token in the Authorization header.
 *
 * The old helpers fulfilled every request with 200 regardless of auth, which
 * hid the useSettings singleton bug (apiKey '' → no token → real 401).
 */
export async function mockTmdbTrendingWithAuth(page: Page, expectedKey = 'fake-tmdb-key-for-testing'): Promise<void> {
  const assertBearer = (headers: Record<string, string>, url: string) => {
    const auth = headers['authorization'] ?? headers['Authorization'] ?? ''
    if (!auth.startsWith('Bearer ')) {
      throw new Error(`Missing Bearer token on request to ${url}. Got: "${auth}"`)
    }
    if (!auth.includes(expectedKey)) {
      throw new Error(`Wrong API key on request to ${url}. Expected key containing "${expectedKey}", got: "${auth}"`)
    }
  }

  await page.route('**/api.themoviedb.org/3/trending/movie/week**', async (route) => {
    assertBearer(route.request().headers(), route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: Array.from({ length: 10 }, (_, i) => ({
          id: 1000 + i,
          title: `Test Movie ${i + 1}`,
          media_type: 'movie',
          poster_path: null,
          backdrop_path: null,
          overview: `Overview for movie ${i + 1}`,
          vote_average: 7.5,
          release_date: '2024-01-01',
          genre_ids: [28],
          original_language: 'en',
        })),
      }),
    })
  })

  await page.route('**/api.themoviedb.org/3/trending/tv/week**', async (route) => {
    assertBearer(route.request().headers(), route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: Array.from({ length: 10 }, (_, i) => ({
          id: 2000 + i,
          name: `Test Series ${i + 1}`,
          media_type: 'tv',
          poster_path: null,
          backdrop_path: null,
          overview: `Overview for series ${i + 1}`,
          vote_average: 8.0,
          first_air_date: '2024-01-01',
          genre_ids: [18],
          original_language: 'en',
        })),
      }),
    })
  })

  await page.route('**/api.themoviedb.org/3/movie/top_rated**', async (route) => {
    assertBearer(route.request().headers(), route.request().url())
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })

  await page.route('**/api.themoviedb.org/3/tv/top_rated**', async (route) => {
    assertBearer(route.request().headers(), route.request().url())
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })
}

// Legacy alias — does NOT check auth headers. Use mockTmdbTrendingWithAuth for new tests.
export async function mockTmdbTrending(page: Page): Promise<void> {
  await page.route('**/api.themoviedb.org/3/trending/movie/week**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: Array.from({ length: 10 }, (_, i) => ({
          id: 1000 + i,
          title: `Test Movie ${i + 1}`,
          media_type: 'movie',
          poster_path: null,
          backdrop_path: null,
          overview: `Overview for movie ${i + 1}`,
          vote_average: 7.5,
          release_date: '2024-01-01',
          genre_ids: [28],
          original_language: 'en',
        })),
      }),
    })
  })
  await page.route('**/api.themoviedb.org/3/trending/tv/week**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: Array.from({ length: 10 }, (_, i) => ({
          id: 2000 + i,
          name: `Test Series ${i + 1}`,
          media_type: 'tv',
          poster_path: null,
          backdrop_path: null,
          overview: `Overview for series ${i + 1}`,
          vote_average: 8.0,
          first_air_date: '2024-01-01',
          genre_ids: [18],
          original_language: 'en',
        })),
      }),
    })
  })
  await page.route('**/api.themoviedb.org/3/movie/top_rated**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })
  await page.route('**/api.themoviedb.org/3/tv/top_rated**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })
}

export async function mockMovieDetails(page: Page, id = 1000): Promise<void> {
  await page.route(`**/api.themoviedb.org/3/movie/${id}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        title: 'Test Movie 1',
        media_type: 'movie',
        poster_path: null,
        backdrop_path: null,
        overview: 'A great test movie.',
        vote_average: 8.2,
        release_date: '2024-03-15',
        runtime: 120,
        genres: [{ id: 28, name: 'Action' }],
        belongs_to_collection: null,
        tagline: 'Testing is fun',
        status: 'Released',
        videos: { results: [] },
      }),
    })
  })
  await page.route('**/api.themoviedb.org/3/movie/*/release_dates**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })
}

export async function mockTvDetails(page: Page, id = 2000): Promise<void> {
  await page.route(`**/api.themoviedb.org/3/tv/${id}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Test Series 1',
        media_type: 'tv',
        poster_path: null,
        backdrop_path: null,
        overview: 'A great test series.',
        vote_average: 8.0,
        first_air_date: '2024-01-01',
        number_of_seasons: 2,
        number_of_episodes: 20,
        genres: [{ id: 18, name: 'Drama' }],
        seasons: [
          { id: 101, season_number: 1, episode_count: 10, name: 'Season 1', poster_path: null, air_date: '2024-01-01' },
          { id: 102, season_number: 2, episode_count: 10, name: 'Season 2', poster_path: null, air_date: '2024-06-01' },
        ],
        episode_run_time: [45],
        videos: { results: [] },
        status: 'Returning Series',
      }),
    })
  })
  await page.route(`**/api.themoviedb.org/3/tv/${id}/season/1**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        season_number: 1,
        name: 'Season 1',
        poster_path: null,
        episodes: Array.from({ length: 10 }, (_, i) => ({
          id: 200 + i,
          episode_number: i + 1,
          season_number: 1,
          name: `Episode ${i + 1}`,
          overview: `Episode ${i + 1} overview`,
          still_path: null,
          air_date: '2024-01-01',
          runtime: 45,
        })),
      }),
    })
  })
  await page.route('**/api.themoviedb.org/3/tv/*/content_ratings**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })
}

/**
 * Mocks search results AND asserts the Authorization header is present.
 * Catches the api-key attribute mismatch bug where search-modal never received
 * the key (Lit observed 'apikey', Vue set 'api-key').
 */
export async function mockSearchResultsWithAuth(page: Page, expectedKey = 'fake-tmdb-key-for-testing'): Promise<void> {
  await page.route('**/api.themoviedb.org/3/search/multi**', async (route) => {
    const auth = route.request().headers()['authorization'] ?? route.request().headers()['Authorization'] ?? ''
    if (!auth.startsWith('Bearer ') || !auth.includes(expectedKey)) {
      // Return 401 so the test sees an actual failure instead of silently passing with no results
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ status_message: 'Invalid API key', status_code: 7 }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          { id: 999, title: 'Search Result Movie', media_type: 'movie', poster_path: null, vote_average: 7.0, release_date: '2023-05-01' },
          { id: 998, name: 'Search Result Series', media_type: 'tv', poster_path: null, vote_average: 7.5, first_air_date: '2023-01-01' },
        ],
      }),
    })
  })
}

// Legacy alias — does NOT check auth headers. Use mockSearchResultsWithAuth for new tests.
export async function mockSearchResults(page: Page): Promise<void> {
  await page.route('**/api.themoviedb.org/3/search/multi**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          { id: 999, title: 'Search Result Movie', media_type: 'movie', poster_path: null, vote_average: 7.0, release_date: '2023-05-01' },
          { id: 998, name: 'Search Result Series', media_type: 'tv', poster_path: null, vote_average: 7.5, first_air_date: '2023-01-01' },
        ],
      }),
    })
  })
}

/**
 * Verifies that a Lit custom element received a prop via an HTML attribute.
 * Use this to catch Vue→Lit attribute name mismatches (e.g. api-key vs apikey).
 */
export async function assertLitAttributeDelivered(
  page: Page,
  selector: string,
  attrName: string,
  expectedValue: string,
): Promise<void> {
  const value = await page.evaluate(
    ([sel, attr]) => document.querySelector(sel)?.getAttribute(attr) ?? null,
    [selector, attrName],
  )
  expect(value).toBe(expectedValue)
}
