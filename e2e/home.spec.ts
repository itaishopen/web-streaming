import { test, expect } from '@playwright/test'
import { seedApiKey, mockTmdbTrending, mockMovieDetails } from './helpers'

test.describe('Home Page', () => {
  test('shows trending content after API key is set', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)
    await page.goto('/')

    // Wait for the spotlight section to appear (trending data loaded)
    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // Confirm at least one media-card is in the DOM
    const mediaCards = page.locator('media-card')
    await expect(mediaCards.first()).toBeVisible({ timeout: 10000 })
    const count = await mediaCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('spotlight has title and watch button', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)
    await page.goto('/')

    // Wait for the spotlight title to contain the first test movie name
    await expect(page.locator('.spotlight-title')).toContainText('Test Movie 1', { timeout: 10000 })

    // Confirm spotlight actions area has at least one button
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
    await page.goto('/')

    // Wait for media cards to appear
    await page.locator('media-card').first().waitFor({ state: 'visible', timeout: 10000 })

    // Click the first media-card
    await page.locator('media-card').first().click()

    // The URL should contain movie/1000
    await expect(page).toHaveURL(/#\/movie\/1000/, { timeout: 5000 })
  })

  test('shows offline banner when network unavailable', async ({ page }) => {
    await seedApiKey(page)

    // Clear the trending cache so fresh fetch is attempted
    await page.addInitScript(() => {
      localStorage.removeItem('streambert_trendingCache')
      localStorage.removeItem('streambert_trendingCacheDate')
    })

    // Set offline before navigating
    await page.context().setOffline(true)
    await page.goto('/')

    // Look for the offline banner text
    await expect(
      page.locator('.offline-banner, [role="alert"]').filter({ hasText: /offline|internet/i })
    ).toBeVisible({ timeout: 10000 })

    // Restore connection
    await page.context().setOffline(false)
  })

  test('home layout rows are configurable - continue watching hidden when row not visible', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)

    // Seed home layout with continue row hidden
    await page.addInitScript(() => {
      const layout = [
        { id: 'continue',  label: 'Continue Watching', visible: false },
        { id: 'similar',   label: 'Similar To…',        visible: true },
        { id: 'movies',    label: 'Trending Movies',    visible: true },
        { id: 'series',    label: 'Trending Series',    visible: true },
        { id: 'toprated',  label: 'Top Rated',          visible: true },
      ]
      localStorage.setItem('streambert_homeLayout', JSON.stringify(layout))
    })

    await page.goto('/')

    // Wait for trending content to load
    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // Continue watching section should not be shown
    const continueSection = page.locator('.section-title').filter({ hasText: 'Continue Watching' })
    await expect(continueSection).toHaveCount(0)
  })
})
