/**
 * Tests for the singleton behaviour of useSettings.
 *
 * Root cause of the 401 bug: useSettings was NOT a singleton — every component
 * that called useSettings() got its own fresh ref({ apiKey: '' }), so saving
 * the key in one component never reached another. The fix was to move the ref
 * to module scope. These tests ensure that regression can never re-enter.
 */
import { useSettings } from '../../composables/useSettings'
import { storage, STORAGE_KEYS } from '../../utils/storage'

jest.mock('../../utils/appearance', () => ({
  applyAccentColor: jest.fn(),
}))

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

describe('useSettings singleton', () => {
  it('returns the same settings ref object from two separate calls', () => {
    const a = useSettings()
    const b = useSettings()
    expect(a.settings).toBe(b.settings)
  })

  it('saveSettings on one instance is immediately visible on another', () => {
    const a = useSettings()
    const b = useSettings()
    a.loadSettings()
    a.saveSettings('apiKey', 'shared-key-123')
    expect(b.settings.value.apiKey).toBe('shared-key-123')
  })

  it('loadSettings on one instance populates settings seen by another', () => {
    storage.set(STORAGE_KEYS.API_KEY, 'stored-key')
    const a = useSettings()
    const b = useSettings()
    a.loadSettings()
    expect(b.settings.value.apiKey).toBe('stored-key')
  })

  it('multiple components calling saveSettings do not create independent state', () => {
    // Simulate two components each calling useSettings() independently
    const comp1 = useSettings()
    const comp2 = useSettings()
    const comp3 = useSettings()
    comp1.loadSettings()
    comp2.saveSettings('accentColor', 'blue')
    // All instances must see the change
    expect(comp1.settings.value.accentColor).toBe('blue')
    expect(comp3.settings.value.accentColor).toBe('blue')
  })

  it('settings ref is not reset between calls — changes persist across imports', () => {
    const first = useSettings()
    first.loadSettings()
    first.saveSettings('apiKey', 'persistent-key')

    // Simulate a second "import" by calling useSettings() again
    const second = useSettings()
    expect(second.settings.value.apiKey).toBe('persistent-key')
  })
})
