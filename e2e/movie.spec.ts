import { test, expect } from '@playwright/test'
import { seedApiKey, seedProgress, mockMovieDetails } from './helpers'

test.describe('Movie Page', () => {
  test('displays movie details', async ({ page }) => {
    await seedApiKey(page)
    await mockMovieDetails(page, 1000)
    await page.goto('/#/movie/1000')

    // Wait for the spotlight section to appear
    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // Title should contain 'Test Movie 1'
    // The movie page uses .movie-title class (not .spotlight-title)
    await expect(page.locator('.movie-title')).toContainText('Test Movie 1', { timeout: 10000 })

    // Genre should be visible
    await expect(page.locator('.genres')).toContainText('Action', { timeout: 5000 })

    // Runtime: 120 minutes formatted as "2h"
    await expect(page.locator('.meta-row')).toContainText('120', { timeout: 5000 })
  })

  test('watch button starts the player', async ({ page }) => {
    await seedApiKey(page)
    await mockMovieDetails(page, 1000)
    await page.goto('/#/movie/1000')

    // Wait for page to load
    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // Find and click the Watch button
    const watchBtn = page.locator('.action-row .btn-primary').filter({ hasText: /watch/i })
    await expect(watchBtn).toBeVisible({ timeout: 5000 })
    await watchBtn.click()

    // Player section should now be visible
    await expect(page.locator('.player-section')).toBeVisible({ timeout: 5000 })

    // An iframe should be present inside the player section
    await expect(page.locator('.player-section iframe')).toBeVisible({ timeout: 5000 })
  })

  test('source selector is visible when player is shown', async ({ page }) => {
    await seedApiKey(page)
    await mockMovieDetails(page, 1000)
    await page.goto('/#/movie/1000')

    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // The source select is always visible in the spotlight, not just during playback
    const sourceSelect = page.locator('#source-select')
    await expect(sourceSelect).toBeVisible({ timeout: 5000 })

    // Click Watch button to start player
    const watchBtn = page.locator('.action-row .btn-primary').filter({ hasText: /watch/i })
    await watchBtn.click()
    await expect(page.locator('.player-section')).toBeVisible({ timeout: 5000 })

    // Source selector should still be visible
    await expect(sourceSelect).toBeVisible()
  })

  test('quick-mark buttons appear during playback', async ({ page }) => {
    await seedApiKey(page)
    await mockMovieDetails(page, 1000)
    await page.goto('/#/movie/1000')

    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // Start playing
    const watchBtn = page.locator('.action-row .btn-primary').filter({ hasText: /watch/i })
    await watchBtn.click()
    await expect(page.locator('.player-section')).toBeVisible({ timeout: 5000 })

    // Quick marks section should be visible
    const quickMarks = page.locator('.quick-marks')
    await expect(quickMarks).toBeVisible({ timeout: 5000 })

    // Should have 25%, 50%, 75% buttons
    await expect(quickMarks.locator('button').filter({ hasText: '25%' })).toBeVisible()
    await expect(quickMarks.locator('button').filter({ hasText: '50%' })).toBeVisible()
    await expect(quickMarks.locator('button').filter({ hasText: '75%' })).toBeVisible()
  })

  test('bookmark button toggles saved state', async ({ page }) => {
    await seedApiKey(page)
    await mockMovieDetails(page, 1000)
    await page.goto('/#/movie/1000')

    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // Find the bookmark/save button (btn-icon-only with emoji)
    const bookmarkBtn = page.locator('.btn-icon-only')
    await expect(bookmarkBtn).toBeVisible({ timeout: 5000 })

    // Get initial title/content
    const initialTitle = await bookmarkBtn.getAttribute('title')

    // Click to toggle
    await bookmarkBtn.click()

    // The title should change (from "Save to library" to "Remove from library" or vice versa)
    await expect(bookmarkBtn).not.toHaveAttribute('title', initialTitle ?? '', { timeout: 3000 })
  })

  test('progress bar appears when movie has tracked progress', async ({ page }) => {
    await seedApiKey(page)
    await mockMovieDetails(page, 1000)
    await seedProgress(page, 'movie_1000', 45)
    await page.goto('/#/movie/1000')

    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // Start playing to reveal the player section and progress bar
    const watchBtn = page.locator('.action-row .btn-primary').filter({ hasText: /watch/i })
    await watchBtn.click()
    await expect(page.locator('.player-section')).toBeVisible({ timeout: 5000 })

    // The progress bar fill should have a non-zero width
    const progressFill = page.locator('.progress-bar-fill')
    await expect(progressFill).toBeVisible({ timeout: 5000 })

    const width = await progressFill.evaluate((el) => {
      return window.getComputedStyle(el).width
    })

    // Width should not be '0px' since we seeded 45% progress
    expect(width).not.toBe('0px')
  })
})
