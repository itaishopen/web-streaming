import { test, expect } from '@playwright/test'
import {
  seedApiKey,
  mockSearchResults,
  mockSearchResultsWithAuth,
  mockMovieDetails,
  assertLitAttributeDelivered,
} from './helpers'

test.describe('Search Modal', () => {
  test('opens with Ctrl+F keyboard shortcut', async ({ page }) => {
    await seedApiKey(page)
    await mockSearchResults(page)
    await page.goto('/')

    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Control+f')

    const modalVisible = await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      if (!modal || !modal.shadowRoot) return false
      return modal.shadowRoot.querySelector('.overlay') !== null
    })
    expect(modalVisible).toBe(true)

    const inputFocused = await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      const input = modal?.shadowRoot?.querySelector('.search-input')
      return input === document.activeElement || modal?.shadowRoot?.activeElement === input
    })
    expect(inputFocused).toBe(true)
  })

  test('closes with Escape key', async ({ page }) => {
    await seedApiKey(page)
    await mockSearchResults(page)
    await page.goto('/')

    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Control+f')

    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelector('.overlay') !== null
    }, { timeout: 3000 })

    await page.keyboard.press('Escape')

    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelector('.overlay') === null
    }, { timeout: 3000 })

    const modalGone = await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelector('.overlay') === null
    })
    expect(modalGone).toBe(true)
  })

  test('shows results when typing', async ({ page }) => {
    await seedApiKey(page)
    await mockSearchResults(page)
    await page.goto('/')

    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Control+f')

    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelector('.search-input') !== null
    }, { timeout: 3000 })

    await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      const input = modal?.shadowRoot?.querySelector('.search-input') as HTMLInputElement | null
      if (input) {
        input.value = 'test'
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      }
    })

    await page.waitForTimeout(500)

    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      const results = modal?.shadowRoot?.querySelectorAll('.result-item')
      return results && results.length > 0
    }, { timeout: 5000 })

    const hasResult = await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      const items = modal?.shadowRoot?.querySelectorAll('.result-item')
      if (!items) return false
      return Array.from(items).some((item) => item.textContent?.includes('Search Result Movie'))
    })
    expect(hasResult).toBe(true)
  })

  test('clicking a result navigates to the item page', async ({ page }) => {
    await seedApiKey(page)
    await mockSearchResults(page)
    await mockMovieDetails(page, 999)
    await page.route('**/api.themoviedb.org/3/movie/999**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          title: 'Search Result Movie',
          media_type: 'movie',
          poster_path: null,
          backdrop_path: null,
          overview: 'A search result movie.',
          vote_average: 7.0,
          release_date: '2023-05-01',
          runtime: 100,
          genres: [],
          belongs_to_collection: null,
          tagline: '',
          status: 'Released',
          videos: { results: [] },
        }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Control+f')

    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelector('.search-input') !== null
    }, { timeout: 3000 })

    await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      const input = modal?.shadowRoot?.querySelector('.search-input') as HTMLInputElement | null
      if (input) {
        input.value = 'test'
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      }
    })

    await page.waitForTimeout(500)
    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      const results = modal?.shadowRoot?.querySelectorAll('.result-item')
      return results && results.length > 0
    }, { timeout: 5000 })

    await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      const firstResult = modal?.shadowRoot?.querySelector('.result-item') as HTMLButtonElement | null
      firstResult?.click()
    })

    await expect(page).toHaveURL(/#\/movie\/999/, { timeout: 5000 })
  })

  /**
   * Verifies that search-modal receives the API key via the correct 'api-key'
   * attribute (kebab-case). Catches the Vue→Lit attribute name mismatch where
   * Lit's default observed attribute is 'apikey' (lowercased), not 'api-key'.
   *
   * If this attribute is not delivered, search-modal fires fetch() with no
   * Authorization header and gets 401s — returning zero results silently.
   */
  test('search-modal has api-key attribute set to stored API key', async ({ page }) => {
    const TEST_KEY = 'fake-tmdb-key-for-testing'
    await seedApiKey(page, TEST_KEY)
    await mockSearchResults(page)
    await page.goto('/')

    await page.waitForLoadState('networkidle')

    // Assert the attribute name is exactly 'api-key' (not 'apikey' or 'apiKey')
    await assertLitAttributeDelivered(page, 'search-modal', 'api-key', TEST_KEY)
  })

  /**
   * Verifies search requests carry the Authorization Bearer token.
   * Uses mockSearchResultsWithAuth which returns 401 when the token is absent,
   * so the test fails with no results instead of silently passing.
   */
  test('search requests include Authorization header with stored API key', async ({ page }) => {
    const TEST_KEY = 'fake-tmdb-key-for-testing'
    await seedApiKey(page, TEST_KEY)
    await mockSearchResultsWithAuth(page, TEST_KEY)
    await page.goto('/')

    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Control+f')

    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelector('.search-input') !== null
    }, { timeout: 3000 })

    await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      const input = modal?.shadowRoot?.querySelector('.search-input') as HTMLInputElement | null
      if (input) {
        input.value = 'test'
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      }
    })

    await page.waitForTimeout(500)

    // If the Authorization header was missing, mock returns 401 and no results appear
    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      const results = modal?.shadowRoot?.querySelectorAll('.result-item')
      return results && results.length > 0
    }, { timeout: 5000 })

    const count = await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelectorAll('.result-item')?.length ?? 0
    })
    expect(count).toBeGreaterThan(0)
  })
})
