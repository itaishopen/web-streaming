import { test, expect } from '@playwright/test'
import { seedApiKey, seedSavedItem, seedHistory, seedProgress, mockMovieDetails } from './helpers'

test.describe('Library Page', () => {
  test('shows empty state when library is empty', async ({ page }) => {
    await seedApiKey(page)
    await page.goto('/#/library')

    // Empty state should be visible
    const emptyState = page.locator('.empty-state')
    await expect(emptyState).toBeVisible({ timeout: 5000 })

    // Should contain relevant text about watching or library
    await expect(emptyState).toContainText(/watch|library/i)
  })

  test('shows saved items in watchlist', async ({ page }) => {
    await seedApiKey(page)
    await seedSavedItem(page, {
      id: 1000,
      title: 'Saved Movie',
      media_type: 'movie',
      poster_path: null,
      backdrop_path: null,
      overview: '',
      vote_average: 7.5,
    })
    await page.goto('/#/library')

    // Empty state should NOT be visible
    await expect(page.locator('.empty-state')).toBeHidden({ timeout: 5000 })

    // 'Saved Movie' should appear in the library
    await expect(page.getByText('Saved Movie')).toBeVisible({ timeout: 5000 })
  })

  test('shows watch history entries', async ({ page }) => {
    await seedApiKey(page)
    await seedHistory(page, {
      item: {
        id: 1000,
        title: 'Watched Movie',
        media_type: 'movie',
        poster_path: null,
        backdrop_path: null,
        overview: '',
        vote_average: 7,
      },
      watchedAt: Date.now(),
    })
    await page.goto('/#/library')

    // 'Watched Movie' should appear in the history section
    await expect(page.getByText('Watched Movie')).toBeVisible({ timeout: 5000 })
  })

  test('in-progress items appear in continue watching', async ({ page }) => {
    await seedApiKey(page)
    await seedHistory(page, {
      item: {
        id: 1000,
        title: 'In Progress Movie',
        media_type: 'movie',
        poster_path: null,
        backdrop_path: null,
        overview: '',
        vote_average: 7,
      },
      watchedAt: Date.now(),
    })
    // Seed progress so the item appears as in-progress (not fully watched)
    await seedProgress(page, 'movie_1000', 45)
    await page.goto('/#/library')

    // "Continue Watching" section heading should be visible
    await expect(page.locator('.section-title').filter({ hasText: 'Continue Watching' })).toBeVisible({ timeout: 5000 })

    // The in-progress movie should appear in the Continue Watching cards
    await expect(page.locator('.continue-card').filter({ hasText: 'In Progress Movie' })).toBeVisible({ timeout: 5000 })
  })

  test('clicking a saved item navigates to correct page', async ({ page }) => {
    await seedApiKey(page)
    await seedSavedItem(page, {
      id: 1001,
      title: 'Nav Movie',
      media_type: 'movie',
      poster_path: null,
      backdrop_path: null,
      overview: '',
      vote_average: 8,
    })

    // Mock movie details for navigation
    await page.route('**/api.themoviedb.org/3/movie/1001**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1001,
          title: 'Nav Movie',
          media_type: 'movie',
          poster_path: null,
          backdrop_path: null,
          overview: '',
          vote_average: 8,
          release_date: '2024-01-01',
          runtime: 90,
          genres: [],
          belongs_to_collection: null,
          tagline: '',
          status: 'Released',
          videos: { results: [] },
        }),
      })
    })
    await page.route('**/api.themoviedb.org/3/movie/*/release_dates**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
    })

    await page.goto('/#/library')

    // Wait for the saved item to appear and click on it (click the card thumb)
    const navMovieCard = page.locator('.watchlist-card').filter({ hasText: 'Nav Movie' })
    await expect(navMovieCard).toBeVisible({ timeout: 5000 })
    await navMovieCard.locator('.card-thumb').click()

    // URL should change to include movie/1001
    await expect(page).toHaveURL(/#\/movie\/1001/, { timeout: 5000 })
  })

  test('sort selector changes order of saved items', async ({ page }) => {
    await seedApiKey(page)

    // Seed multiple saved items with different titles
    await page.addInitScript(() => {
      const items = [
        { id: 2001, title: 'Zebra Movie', media_type: 'movie', poster_path: null, backdrop_path: null, overview: '', vote_average: 5.0 },
        { id: 2002, title: 'Alpha Movie', media_type: 'movie', poster_path: null, backdrop_path: null, overview: '', vote_average: 9.0 },
        { id: 2003, title: 'Middle Movie', media_type: 'movie', poster_path: null, backdrop_path: null, overview: '', vote_average: 7.0 },
      ]
      localStorage.setItem('webstream_saved', JSON.stringify(items))
    })

    await page.goto('/#/library')

    // Wait for the watchlist section to appear
    await expect(page.locator('.section-title').filter({ hasText: 'My Watchlist' })).toBeVisible({ timeout: 5000 })

    // Change sort to 'title'
    const sortSelect = page.locator('#watchlist-sort')
    await sortSelect.selectOption('title')

    // After sorting by title, "Alpha Movie" should appear before "Zebra Movie"
    const cardTitles = page.locator('.watchlist-card .card-title')
    await expect(cardTitles.first()).toContainText('Alpha Movie', { timeout: 3000 })

    const titles = await cardTitles.allTextContents()
    const alphaIndex = titles.findIndex((t) => t.includes('Alpha Movie'))
    const zebraIndex = titles.findIndex((t) => t.includes('Zebra Movie'))
    expect(alphaIndex).toBeLessThan(zebraIndex)
  })
})
