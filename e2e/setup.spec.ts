import { test, expect } from '@playwright/test'
import { mockTmdbTrending, mockMovieDetails } from './helpers'

test.describe('Setup Screen', () => {
  test('shows setup screen when no API key is stored', async ({ page }) => {
    // Navigate without seeding an API key
    await page.goto('/')

    // The setup-screen custom element should be present and visible
    const setupScreen = page.locator('setup-screen')
    await expect(setupScreen).toBeVisible()

    // Verify that the shadow DOM contains an input element
    const hasInput = await page.evaluate(() => {
      const el = document.querySelector('setup-screen')
      if (!el || !el.shadowRoot) return false
      return !!el.shadowRoot.querySelector('input')
    })
    expect(hasInput).toBe(true)
  })

  test('skip button bypasses setup and goes to home', async ({ page }) => {
    await mockTmdbTrending(page)
    await page.goto('/')

    // Wait for the setup-screen to appear
    await page.locator('setup-screen').waitFor({ state: 'visible' })

    // Click the skip button inside the shadow DOM
    await page.evaluate(() => {
      const el = document.querySelector('setup-screen')
      const btn = el?.shadowRoot?.querySelector('.btn-skip') as HTMLButtonElement | null
      btn?.click()
    })

    // After skipping, the setup-screen should either be hidden or the home content appears
    // The app shows spotlight once trending data is loaded, or at least hides setup-screen
    await expect(page.locator('setup-screen')).toBeHidden({ timeout: 5000 })
  })

  test('valid API key submission proceeds to home', async ({ page }) => {
    // Mock TMDB configuration endpoint to return 200
    await page.route('**/api.themoviedb.org/3/configuration**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          images: { base_url: 'https://image.tmdb.org/t/p/', secure_base_url: 'https://image.tmdb.org/t/p/' },
        }),
      })
    })
    await mockTmdbTrending(page)

    await page.goto('/')
    await page.locator('setup-screen').waitFor({ state: 'visible' })

    // Type a fake key into the shadow DOM input
    await page.evaluate(() => {
      const el = document.querySelector('setup-screen')
      const input = el?.shadowRoot?.querySelector('input') as HTMLInputElement | null
      if (input) {
        input.value = 'fake-valid-key'
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })

    // Click the submit/connect button inside shadow DOM
    await page.evaluate(() => {
      const el = document.querySelector('setup-screen')
      const btn = el?.shadowRoot?.querySelector('.btn-primary') as HTMLButtonElement | null
      btn?.click()
    })

    // After valid key, setup-screen should disappear
    await expect(page.locator('setup-screen')).toBeHidden({ timeout: 5000 })
  })

  test('invalid API key shows error message', async ({ page }) => {
    // Mock TMDB configuration endpoint to return 401
    await page.route('**/api.themoviedb.org/3/configuration**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ status_message: 'Invalid API key', status_code: 7 }),
      })
    })

    await page.goto('/')
    await page.locator('setup-screen').waitFor({ state: 'visible' })

    // Type a bad key
    await page.evaluate(() => {
      const el = document.querySelector('setup-screen')
      const input = el?.shadowRoot?.querySelector('input') as HTMLInputElement | null
      if (input) {
        input.value = 'bad-key-that-will-fail'
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })

    // Click the connect/submit button
    await page.evaluate(() => {
      const el = document.querySelector('setup-screen')
      const btn = el?.shadowRoot?.querySelector('.btn-primary') as HTMLButtonElement | null
      btn?.click()
    })

    // Wait for error message to appear in the shadow DOM
    await page.waitForFunction(() => {
      const el = document.querySelector('setup-screen')
      const errEl = el?.shadowRoot?.querySelector('.error-msg')
      return errEl && errEl.textContent && errEl.textContent.trim().length > 0
    }, { timeout: 5000 })

    const errorText = await page.evaluate(() => {
      const el = document.querySelector('setup-screen')
      return el?.shadowRoot?.querySelector('.error-msg')?.textContent?.trim() ?? ''
    })
    expect(errorText.length).toBeGreaterThan(0)
  })
})
