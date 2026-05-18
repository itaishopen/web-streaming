import { useSettings } from '../../composables/useSettings'
import { storage, STORAGE_KEYS } from '../../utils/storage'

// Mock applyAccentColor from appearance utils
jest.mock('../../utils/appearance', () => ({
  applyAccentColor: jest.fn(),
}))

import { applyAccentColor } from '../../utils/appearance'

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

describe('loadSettings()', () => {
  it('sets default apiKey to empty string when nothing in storage', () => {
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.apiKey).toBe('')
  })

  it('sets default accentColor to "red" when nothing in storage', () => {
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.accentColor).toBe('red')
  })

  it('sets default fontSize to "normal" when nothing in storage', () => {
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.fontSize).toBe('normal')
  })

  it('sets default compactMode to false', () => {
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.compactMode).toBe(false)
  })

  it('sets default reduceAnimations to false', () => {
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.reduceAnimations).toBe(false)
  })

  it('sets default recordHistory to true', () => {
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.recordHistory).toBe(true)
  })

  it('reads existing apiKey from localStorage', () => {
    storage.set(STORAGE_KEYS.API_KEY, 'my-api-key')
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.apiKey).toBe('my-api-key')
  })

  it('reads existing accentColor from localStorage', () => {
    storage.set(STORAGE_KEYS.ACCENT_COLOR, 'blue')
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.accentColor).toBe('blue')
  })

  it('reads existing fontSize from localStorage', () => {
    storage.set(STORAGE_KEYS.FONT_SIZE, 'large')
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.fontSize).toBe('large')
  })

  it('reads existing compactMode from localStorage', () => {
    storage.set(STORAGE_KEYS.COMPACT_MODE, true)
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.compactMode).toBe(true)
  })

  it('reads existing playerSource from localStorage', () => {
    storage.set(STORAGE_KEYS.PLAYER_SOURCE, 'embedsu')
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.playerSource).toBe('embedsu')
  })

  it('reads existing homeViewMode from localStorage', () => {
    storage.set(STORAGE_KEYS.HOME_VIEW_MODE, 'list')
    const { loadSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.homeViewMode).toBe('list')
  })
})

describe('saveSettings()', () => {
  it('updates settings.value.accentColor in memory', () => {
    const { loadSettings, saveSettings, settings } = useSettings()
    loadSettings()
    saveSettings('accentColor', 'blue')
    expect(settings.value.accentColor).toBe('blue')
  })

  it('persists accentColor value to localStorage', () => {
    const { loadSettings, saveSettings } = useSettings()
    loadSettings()
    saveSettings('accentColor', 'green')
    expect(storage.get(STORAGE_KEYS.ACCENT_COLOR)).toBe('green')
  })

  it('updates settings.value.fontSize in memory', () => {
    const { loadSettings, saveSettings, settings } = useSettings()
    loadSettings()
    saveSettings('fontSize', 'small')
    expect(settings.value.fontSize).toBe('small')
  })

  it('persists fontSize value to localStorage', () => {
    const { loadSettings, saveSettings } = useSettings()
    loadSettings()
    saveSettings('fontSize', 'large')
    expect(storage.get(STORAGE_KEYS.FONT_SIZE)).toBe('large')
  })

  it('updates settings.value.compactMode in memory', () => {
    const { loadSettings, saveSettings, settings } = useSettings()
    loadSettings()
    saveSettings('compactMode', true)
    expect(settings.value.compactMode).toBe(true)
  })

  it('persists compactMode value to localStorage', () => {
    const { loadSettings, saveSettings } = useSettings()
    loadSettings()
    saveSettings('compactMode', true)
    expect(storage.get(STORAGE_KEYS.COMPACT_MODE)).toBe(true)
  })

  it('does not mutate other settings when saving one key', () => {
    const { loadSettings, saveSettings, settings } = useSettings()
    loadSettings()
    const originalFontSize = settings.value.fontSize
    saveSettings('accentColor', 'pink')
    expect(settings.value.fontSize).toBe(originalFontSize)
  })
})

describe('applyTheme()', () => {
  it('calls applyAccentColor with the current accentColor', () => {
    const { loadSettings, applyTheme } = useSettings()
    storage.set(STORAGE_KEYS.ACCENT_COLOR, 'purple')
    loadSettings()
    applyTheme()
    expect(applyAccentColor).toHaveBeenCalledWith('purple')
  })

  it('calls applyAccentColor once per applyTheme call', () => {
    const { loadSettings, applyTheme } = useSettings()
    loadSettings()
    applyTheme()
    expect(applyAccentColor).toHaveBeenCalledTimes(1)
  })

  it('sets data-font-size attribute on documentElement', () => {
    const { loadSettings, saveSettings, applyTheme } = useSettings()
    loadSettings()
    saveSettings('fontSize', 'large')
    applyTheme()
    expect(document.documentElement.dataset.fontSize).toBe('large')
  })

  it('sets data-font-size to "normal" by default', () => {
    const { loadSettings, applyTheme } = useSettings()
    loadSettings()
    applyTheme()
    expect(document.documentElement.dataset.fontSize).toBe('normal')
  })

  it('sets data-font-size to "small" when fontSize is small', () => {
    const { loadSettings, saveSettings, applyTheme } = useSettings()
    loadSettings()
    saveSettings('fontSize', 'small')
    applyTheme()
    expect(document.documentElement.dataset.fontSize).toBe('small')
  })

  it('sets data-compact attribute when compactMode is true', () => {
    const { loadSettings, saveSettings, applyTheme } = useSettings()
    loadSettings()
    saveSettings('compactMode', true)
    applyTheme()
    expect(document.documentElement.dataset.compact).toBe('true')
  })

  it('removes data-compact attribute when compactMode is false', () => {
    const { loadSettings, saveSettings, applyTheme } = useSettings()
    loadSettings()
    // First set it to true, then back to false
    saveSettings('compactMode', true)
    applyTheme()
    saveSettings('compactMode', false)
    applyTheme()
    expect(document.documentElement.dataset.compact).toBeUndefined()
  })

  it('sets --base-font-size CSS property', () => {
    const setPropertySpy = jest.spyOn(document.documentElement.style, 'setProperty')
    const { loadSettings, saveSettings, applyTheme } = useSettings()
    loadSettings()
    saveSettings('fontSize', 'large')
    applyTheme()
    expect(setPropertySpy).toHaveBeenCalledWith('--base-font-size', '18px')
    setPropertySpy.mockRestore()
  })
})
