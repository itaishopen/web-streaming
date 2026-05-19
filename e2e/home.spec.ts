import { test, expect } from '@playwright/test'
import {
  seedApiKey,
  mockTmdbTrending,
  mockTmdbTrendingWithAuth,
  mockMovieDetails,
  assertLitAttributeDelivered,
} from './helpers'

test.describe('Home Page', () => {
  test('shows trending content after API key is set', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)
    // Force list mode so media-card elements appear (carousel mode uses trending-carousel)
    await page.addInitScript(() => {
      localStorage.setItem('webstream_homeViewMode', JSON.stringify('list'))
    })
    await page.goto('/')

    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    const mediaCards = page.locator('media-card')
    await expect(mediaCards.first()).toBeVisible({ timeout: 10000 })
    const count = await mediaCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('spotlight has title and watch button', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)
    await page.goto('/')

    await expect(page.locator('.spotlight-title')).toContainText('Test Movie 1', { timeout: 10000 })

    const actionsArea = page.locator('.spotlight-actions')
    await expect(actionsArea).toBeVisible()
    const buttons = actionsArea.locator('button')
    const btnCount = await buttons.count()
    expect(btnCount).toBeGreaterThan(0)
  })

  test('clicking a media-card navigates to movie page', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)
    await mockMovieDetails(page, 1000)
    // Force list mode so media-card elements appear (carousel mode uses trending-carousel)
    await page.addInitScript(() => {
      localStorage.setItem('webstream_homeViewMode', JSON.stringify('list'))
    })
    await page.goto('/')

    await page.locator('media-card').first().waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('media-card').first().click()

    await expect(page).toHaveURL(/#\/movie\/1000/, { timeout: 5000 })
  })

  test('shows offline banner when network unavailable', async ({ page }) => {
    await seedApiKey(page)

    // Override navigator.onLine before app code runs, and clear cache so it actually tries to fetch
    await page.addInitScript(() => {
      localStorage.removeItem('webstream_trendingCache')
      localStorage.removeItem('webstream_trendingCacheDate')
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true })
    })

    // Abort all TMDB API requests so fetch() throws (simulates network failure)
    await page.route('**/api.themoviedb.org/**', (route) => route.abort('failed'))

    await page.goto('/')

    await expect(
      page.locator('.offline-banner, [role="alert"]').filter({ hasText: /offline|internet/i })
    ).toBeVisible({ timeout: 10000 })
  })

  test('home layout rows are configurable - continue watching hidden when row not visible', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)

    await page.addInitScript(() => {
      const layout = [
        { id: 'continue',  label: 'Continue Watching', visible: false },
        { id: 'similar',   label: 'Similar To…',        visible: true },
        { id: 'movies',    label: 'Trending Movies',    visible: true },
        { id: 'series',    label: 'Trending Series',    visible: true },
        { id: 'toprated',  label: 'Top Rated',          visible: true },
      ]
      localStorage.setItem('webstream_homeLayout', JSON.stringify(layout))
    })

    await page.goto('/')
    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    const continueSection = page.locator('.section-title').filter({ hasText: 'Continue Watching' })
    await expect(continueSection).toHaveCount(0)
  })

  /**
   * Full setup flow test — does NOT use seedApiKey().
   *
   * This exercises the complete chain that the old tests bypassed:
   *   setup-screen → user enters key → submit → setup-complete event fires
   *   → HomePage.onSetupComplete extracts detail.apiKey → saveSettings()
   *   → loadTrending() uses the key → TMDB request carries Bearer token
   *
   * If useSettings loses singleton behaviour, or onSetupComplete stops
   * extracting detail.apiKey, this test fails because the auth-checking
   * mock route throws and the content never loads.
   */
  test('full setup flow: entering API key leads to authenticated TMDB requests and content', async ({ page }) => {
    const TEST_KEY = 'fake-tmdb-key-for-testing'

    // Require all trending requests to carry the correct Authorization header
    await mockTmdbTrendingWithAuth(page, TEST_KEY)

    // Also mock the TMDB configuration validation the setup screen fires
    await page.route('**/api.themoviedb.org/3/configuration**', async (route) => {
      const auth = route.request().headers()['authorization'] ?? ''
      if (!auth.includes(TEST_KEY)) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ status_code: 7 }) })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: { base_url: 'https://image.tmdb.org/t/p/', secure_base_url: 'https://image.tmdb.org/t/p/' } }),
      })
    })

    // Navigate without any seeded key — setup screen must appear
    await page.goto('/')
    const setupScreen = page.locator('setup-screen')
    await expect(setupScreen).toBeVisible({ timeout: 5000 })

    // Type the key into the shadow DOM input
    await page.evaluate((key) => {
      const el = document.querySelector('setup-screen')
      const input = el?.shadowRoot?.querySelector('input') as HTMLInputElement | null
      if (input) {
        input.value = key
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, TEST_KEY)

    // Submit
    await page.evaluate(() => {
      const el = document.querySelector('setup-screen')
      const btn = el?.shadowRoot?.querySelector('.btn-primary') as HTMLButtonElement | null
      btn?.click()
    })

    // Setup screen should disappear
    await expect(setupScreen).toBeHidden({ timeout: 8000 })

    // Content should load — verifies the full chain worked
    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })
  })

  /**
   * Verifies that Vue correctly delivers the API key to search-modal via the
   * 'api-key' attribute (kebab-case). This catches the attribute name mismatch
   * where Lit's default is 'apikey' (lowercased camelCase) but Vue sets 'api-key'.
   */
  test('search-modal receives api-key attribute from Vue', async ({ page }) => {
    const TEST_KEY = 'fake-tmdb-key-for-testing'
    await seedApiKey(page, TEST_KEY)
    await mockTmdbTrending(page)
    await page.goto('/')

    // Wait for the app to mount and pass props
    await page.waitForLoadState('networkidle')

    // The search-modal element must have api-key attribute set to the stored key
    await assertLitAttributeDelivered(page, 'search-modal', 'api-key', TEST_KEY)
  })
})
