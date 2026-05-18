import { test, expect } from '@playwright/test'
import { seedApiKey, mockTmdbTrending, mockMovieDetails } from './helpers'

const MOBILE_VIEWPORT = { width: 375, height: 812 }

test.describe('Mobile Layout', () => {
  test('shows bottom nav bar instead of sidebar on mobile', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // app-sidebar custom element should exist in the DOM
    const appSidebar = page.locator('app-sidebar')
    await expect(appSidebar).toBeAttached()

    // On mobile, the desktop sidebar should be hidden and the bottom-bar should be shown
    // This is controlled by CSS media query inside the shadow DOM
    const sidebarHidden = await page.evaluate(() => {
      const sidebar = document.querySelector('app-sidebar')
      const sidebarEl = sidebar?.shadowRoot?.querySelector('.sidebar') as HTMLElement | null
      if (!sidebarEl) return false
      const display = window.getComputedStyle(sidebarEl).display
      return display === 'none'
    })
    expect(sidebarHidden).toBe(true)

    // The bottom bar should be visible
    const bottomBarVisible = await page.evaluate(() => {
      const sidebar = document.querySelector('app-sidebar')
      const bottomBar = sidebar?.shadowRoot?.querySelector('.bottom-bar') as HTMLElement | null
      if (!bottomBar) return false
      const display = window.getComputedStyle(bottomBar).display
      return display !== 'none'
    })
    expect(bottomBarVisible).toBe(true)
  })

  test('bottom nav navigates between pages', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Find and click the Library button in the bottom nav (inside app-sidebar shadow root)
    await page.evaluate(() => {
      const sidebar = document.querySelector('app-sidebar')
      // Find library button in the bottom bar by aria-label
      const libraryBtn = sidebar?.shadowRoot?.querySelector('.bar-item[aria-label="Library"]') as HTMLButtonElement | null
      libraryBtn?.click()
    })

    // URL should change to #/library
    await expect(page).toHaveURL(/#\/library/, { timeout: 5000 })
  })

  test('spotlight section renders on mobile with a visible height', async ({ page }) => {
    await seedApiKey(page)
    await mockTmdbTrending(page)
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Wait for spotlight section
    const spotlightSection = page.locator('.spotlight-section')
    await expect(spotlightSection).toBeVisible({ timeout: 10000 })

    // Get its bounding box height — should be > 200px (renders, just smaller on mobile)
    const box = await spotlightSection.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThan(200)
  })

  test('player is full width on mobile', async ({ page }) => {
    await seedApiKey(page)
    await mockMovieDetails(page, 1000)
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/#/movie/1000')

    // Wait for movie page to load
    await expect(page.locator('.spotlight-section')).toBeVisible({ timeout: 10000 })

    // Click Watch button to start player
    const watchBtn = page.locator('.action-row .btn-primary').filter({ hasText: /watch/i })
    await expect(watchBtn).toBeVisible({ timeout: 5000 })
    await watchBtn.click()

    // Wait for player section
    await expect(page.locator('.player-section')).toBeVisible({ timeout: 5000 })

    // Get player section and viewport widths
    const playerBox = await page.locator('.player-section').boundingBox()
    const viewportWidth = MOBILE_VIEWPORT.width

    expect(playerBox).not.toBeNull()
    // Player should be close to viewport width (within 10px tolerance for scrollbars etc.)
    expect(playerBox!.width).toBeGreaterThanOrEqual(viewportWidth - 10)
  })
})
