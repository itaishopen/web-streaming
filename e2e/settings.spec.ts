import { test, expect } from '@playwright/test'
import { seedApiKey } from './helpers'

test.describe('Settings Page', () => {
  test('all 8 settings sections are visible', async ({ page }) => {
    await seedApiKey(page)
    await page.goto('/#/settings')

    // Wait for the settings page to load
    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 5000 })

    // Count all settings-section elements — there should be 8
    const sections = page.locator('.settings-section')
    await expect(sections).toHaveCount(8, { timeout: 5000 })
  })

  test('accent color swatch changes theme color to blue', async ({ page }) => {
    await seedApiKey(page)
    await page.goto('/#/settings')

    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 5000 })

    // Find the blue color swatch button by aria-label
    const blueSwatchBtn = page.locator('.swatch-btn[aria-label="Blue"]')
    await expect(blueSwatchBtn).toBeVisible({ timeout: 5000 })
    await blueSwatchBtn.click()

    // Verify --accent CSS variable on documentElement changes to '#2563eb'
    const accentValue = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    })
    expect(accentValue).toBe('#2563eb')
  })

  test('font size change applies data attribute via base font size', async ({ page }) => {
    await seedApiKey(page)
    await page.goto('/#/settings')

    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 5000 })

    // Click the 'Large' font size option
    const largeBtn = page.locator('.segmented-control .segment-btn').filter({ hasText: 'Large' }).first()
    await expect(largeBtn).toBeVisible({ timeout: 5000 })
    await largeBtn.click()

    // Verify --base-font-size is set to '18px' on documentElement
    const fontSize = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
    })
    expect(fontSize).toBe('18px')
  })

  test('compact mode toggle updates documentElement data attribute', async ({ page }) => {
    await seedApiKey(page)
    await page.goto('/#/settings')

    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 5000 })

    // Find the compact mode toggle switch
    const compactToggle = page.locator('.toggle-switch[aria-checked]').first()

    // Get current state
    const initialState = await compactToggle.getAttribute('aria-checked')

    // Click the compact mode toggle (it's in the Interface section)
    await compactToggle.click()

    if (initialState === 'false') {
      // After enabling, documentElement should have data-compact='true'
      await expect(page.locator('html')).toHaveAttribute('data-compact', 'true', { timeout: 3000 })
    } else {
      // After disabling, documentElement should NOT have data-compact attribute
      const hasCompact = await page.evaluate(() => {
        return document.documentElement.hasAttribute('data-compact')
      })
      expect(hasCompact).toBe(false)
    }
  })

  test('export backup triggers download', async ({ page }) => {
    await seedApiKey(page)
    await page.goto('/#/settings')

    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 5000 })

    // Listen for download event
    const downloadPromise = page.waitForEvent('download')

    // Click the Export Backup button
    const exportBtn = page.locator('.btn').filter({ hasText: 'Export Backup' })
    await expect(exportBtn).toBeVisible({ timeout: 5000 })
    await exportBtn.click()

    const download = await downloadPromise
    // Download file should have .json extension
    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })

  test('clear cache button is clickable without errors', async ({ page }) => {
    await seedApiKey(page)

    // Monitor console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/#/settings')
    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 5000 })

    // Click the Clear Cache button
    const clearCacheBtn = page.locator('.btn').filter({ hasText: 'Clear Cache' })
    await expect(clearCacheBtn).toBeVisible({ timeout: 5000 })
    await clearCacheBtn.click()

    // Allow a moment for any async operations
    await page.waitForTimeout(500)

    // No JS errors should have been thrown by the click
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('API section has token input and save/validate buttons', async ({ page }) => {
    // Navigate without API key to ensure input is accessible
    await page.goto('/#/settings')

    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 5000 })

    // API section should have a password (or text) input
    const apiInput = page.locator('#api-key')
    await expect(apiInput).toBeVisible({ timeout: 5000 })

    // Should have Save and Validate buttons
    const saveBtn = page.locator('.btn').filter({ hasText: 'Save' })
    await expect(saveBtn).toBeVisible({ timeout: 5000 })

    const validateBtn = page.locator('.btn').filter({ hasText: /validate/i })
    await expect(validateBtn).toBeVisible({ timeout: 5000 })
  })
})
