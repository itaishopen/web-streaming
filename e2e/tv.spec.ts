import { test, expect } from '@playwright/test'
import { seedApiKey, seedProgress, mockTvDetails } from './helpers'

test.describe('TV Page', () => {
  test('displays show details and seasons', async ({ page }) => {
    await seedApiKey(page)
    await mockTvDetails(page, 2000)
    await page.goto('/#/tv/2000')

    // Wait for spotlight section
    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // Show title should be visible (TV page uses .show-title)
    await expect(page.locator('.show-title')).toContainText('Test Series 1', { timeout: 10000 })

    // Season tabs should show Season 1 and Season 2
    const seasonTabs = page.locator('.season-tabs')
    await expect(seasonTabs).toBeVisible({ timeout: 10000 })
    await expect(seasonTabs.locator('button').filter({ hasText: 'Season 1' })).toBeVisible()
    await expect(seasonTabs.locator('button').filter({ hasText: 'Season 2' })).toBeVisible()
  })

  test('episode grid shows 10 episodes for season 1', async ({ page }) => {
    await seedApiKey(page)
    await mockTvDetails(page, 2000)
    await page.goto('/#/tv/2000')

    // Wait for episodes grid to appear
    await expect(page.locator('.episodes-grid')).toBeVisible({ timeout: 10000 })

    // Should have 10 ep-card elements
    const epCards = page.locator('.ep-card')
    await expect(epCards).toHaveCount(10, { timeout: 10000 })
  })

  test('clicking an episode starts the player', async ({ page }) => {
    await seedApiKey(page)
    await mockTvDetails(page, 2000)
    await page.goto('/#/tv/2000')

    // Wait for the first episode card
    const firstEpCard = page.locator('.ep-card').first()
    await expect(firstEpCard).toBeVisible({ timeout: 10000 })

    // Click it
    await firstEpCard.click()

    // Player section should appear with an iframe
    await expect(page.locator('.player-section')).toBeVisible({ timeout: 5000 })
  })

  test('season tab switches episode list', async ({ page }) => {
    await seedApiKey(page)
    await mockTvDetails(page, 2000)

    // Mock season 2 episodes with different names
    await page.route('**/api.themoviedb.org/3/tv/2000/season/2**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          season_number: 2,
          name: 'Season 2',
          poster_path: null,
          episodes: Array.from({ length: 10 }, (_, i) => ({
            id: 300 + i,
            episode_number: i + 1,
            season_number: 2,
            name: `Season 2 Episode ${i + 1}`,
            overview: `Season 2 Episode ${i + 1} overview`,
            still_path: null,
            air_date: '2024-06-01',
            runtime: 45,
          })),
        }),
      })
    })

    await page.goto('/#/tv/2000')

    // Wait for season tabs
    const seasonTabs = page.locator('.season-tabs')
    await expect(seasonTabs).toBeVisible({ timeout: 10000 })

    // Wait for initial episodes to load
    await expect(page.locator('.ep-card').first()).toBeVisible({ timeout: 10000 })

    // Click Season 2 tab
    await seasonTabs.locator('button').filter({ hasText: 'Season 2' }).click()

    // Wait for season 2 episodes to appear
    await expect(page.locator('.ep-card').first()).toContainText('Season 2 Episode', { timeout: 10000 })
  })

  test('episode progress bars appear for in-progress episodes', async ({ page }) => {
    await seedApiKey(page)
    await mockTvDetails(page, 2000)
    // Seed progress for first episode at 50%
    await seedProgress(page, 'tv_2000_s1e1', 50)
    await page.goto('/#/tv/2000')

    // Wait for the episodes grid
    await expect(page.locator('.episodes-grid')).toBeVisible({ timeout: 10000 })

    // The first ep-card should have a progress indicator (ep-still-progress or ep-still-progress-fill)
    const firstEpCard = page.locator('.ep-card').first()
    await expect(firstEpCard).toBeVisible({ timeout: 10000 })

    const progressFill = firstEpCard.locator('.ep-still-progress-fill')
    await expect(progressFill).toBeVisible({ timeout: 5000 })

    const width = await progressFill.evaluate((el) => {
      return window.getComputedStyle(el).width
    })
    expect(width).not.toBe('0px')
  })
})
