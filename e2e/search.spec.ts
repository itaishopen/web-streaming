import { test, expect } from '@playwright/test'
import { seedApiKey, mockSearchResults, mockMovieDetails } from './helpers'

test.describe('Search Modal', () => {
  test('opens with Ctrl+F keyboard shortcut', async ({ page }) => {
    await seedApiKey(page)
    await mockSearchResults(page)
    await page.goto('/')

    // Wait for the page to settle
    await page.waitForLoadState('networkidle')

    // Press Ctrl+F to open the search modal
    await page.keyboard.press('Control+f')

    // The search-modal custom element should be visible (its open prop becomes true)
    // The modal renders an overlay when open=true
    const overlay = page.locator('search-modal .overlay').first()

    // Since Lit renders to shadow DOM, we check the shadow root
    const modalVisible = await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      if (!modal || !modal.shadowRoot) return false
      const overlay = modal.shadowRoot.querySelector('.overlay')
      return overlay !== null
    })
    expect(modalVisible).toBe(true)

    // The input inside the shadow DOM should be focused
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

    // Open search with Ctrl+F
    await page.keyboard.press('Control+f')

    // Wait for modal to open
    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelector('.overlay') !== null
    }, { timeout: 3000 })

    // Press Escape to close
    await page.keyboard.press('Escape')

    // Modal overlay should no longer be in the shadow DOM
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

    // Open search modal
    await page.keyboard.press('Control+f')

    // Wait for modal to open
    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelector('.search-input') !== null
    }, { timeout: 3000 })

    // Type into the search input via evaluate (shadow DOM)
    await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      const input = modal?.shadowRoot?.querySelector('.search-input') as HTMLInputElement | null
      if (input) {
        input.value = 'test'
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      }
    })

    // Wait for debounce (the component uses 380ms debounce)
    await page.waitForTimeout(500)

    // Wait for search results to appear in the shadow DOM
    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      const results = modal?.shadowRoot?.querySelectorAll('.result-item')
      return results && results.length > 0
    }, { timeout: 5000 })

    // 'Search Result Movie' should appear in the shadow DOM
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
    // Also mock release_dates for movie 999
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

    // Open search modal
    await page.keyboard.press('Control+f')

    // Wait for the search input to be ready
    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      return modal?.shadowRoot?.querySelector('.search-input') !== null
    }, { timeout: 3000 })

    // Type 'test' to search
    await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      const input = modal?.shadowRoot?.querySelector('.search-input') as HTMLInputElement | null
      if (input) {
        input.value = 'test'
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      }
    })

    // Wait for debounce and results
    await page.waitForTimeout(500)
    await page.waitForFunction(() => {
      const modal = document.querySelector('search-modal')
      const results = modal?.shadowRoot?.querySelectorAll('.result-item')
      return results && results.length > 0
    }, { timeout: 5000 })

    // Click the first result
    await page.evaluate(() => {
      const modal = document.querySelector('search-modal')
      const firstResult = modal?.shadowRoot?.querySelector('.result-item') as HTMLButtonElement | null
      firstResult?.click()
    })

    // URL should change to include movie/999
    await expect(page).toHaveURL(/#\/movie\/999/, { timeout: 5000 })
  })
})
