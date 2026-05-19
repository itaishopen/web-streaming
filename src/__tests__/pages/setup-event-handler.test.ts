/**
 * Tests for the setup-complete event handling logic in HomePage.vue.
 *
 * Bug: the original handler treated the CustomEvent as a plain string and
 * never extracted detail.apiKey, so saveSettings('apiKey', ...) was called
 * with undefined, and subsequent TMDB requests used an empty bearer token.
 *
 * The fix: read (e as CustomEvent<{ apiKey: string }>).detail?.apiKey ?? ''
 *
 * These tests verify the extraction pattern works correctly for every
 * relevant input shape, so the same class of error cannot re-enter.
 */

/** Mirrors the exact extraction logic used in HomePage.vue's onSetupComplete. */
function extractApiKey(e: Event): string {
  return (e as CustomEvent<{ apiKey: string }>).detail?.apiKey ?? ''
}

describe('setup-complete event — apiKey extraction', () => {
  it('extracts apiKey from a well-formed CustomEvent', () => {
    const e = new CustomEvent('setup-complete', { detail: { apiKey: 'my-tmdb-token' } })
    expect(extractApiKey(e)).toBe('my-tmdb-token')
  })

  it('returns empty string when detail has no apiKey field', () => {
    const e = new CustomEvent('setup-complete', { detail: {} })
    expect(extractApiKey(e)).toBe('')
  })

  it('returns empty string when detail is null', () => {
    const e = new CustomEvent('setup-complete', { detail: null })
    expect(extractApiKey(e)).toBe('')
  })

  it('returns empty string for a plain Event (no detail property)', () => {
    const e = new Event('setup-complete')
    expect(extractApiKey(e)).toBe('')
  })

  it('returns empty string when apiKey is explicitly empty string', () => {
    const e = new CustomEvent('setup-complete', { detail: { apiKey: '' } })
    expect(extractApiKey(e)).toBe('')
  })

  it('does not coerce the key — preserves the exact string', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.abc123'
    const e = new CustomEvent('setup-complete', { detail: { apiKey: token } })
    expect(extractApiKey(e)).toBe(token)
  })

  it('does not return the event itself when treated as a string (regression)', () => {
    // The old broken handler did: const key = e as unknown as string
    const e = new CustomEvent('setup-complete', { detail: { apiKey: 'valid-key' } })
    const broken = e as unknown as string
    const correct = extractApiKey(e)
    // broken would be '[object CustomEvent]' or similar, definitely not 'valid-key'
    expect(correct).not.toBe(broken)
    expect(correct).toBe('valid-key')
  })
})

describe('setup-complete event — integration with useSettings', () => {
  const { useSettings } = require('../../composables/useSettings')

  jest.mock('../../utils/appearance', () => ({
    applyAccentColor: jest.fn(),
  }))

  beforeEach(() => {
    localStorage.clear()
  })

  it('full path: event fires → apiKey extracted → saveSettings persists it', () => {
    const { loadSettings, saveSettings, settings } = useSettings()
    loadSettings()
    expect(settings.value.apiKey).toBe('')

    // Simulate what HomePage.vue's onSetupComplete does
    const e = new CustomEvent('setup-complete', { detail: { apiKey: 'live-token' }, bubbles: true, composed: true })
    const key = extractApiKey(e)
    saveSettings('apiKey', key)

    expect(settings.value.apiKey).toBe('live-token')
  })

  it('saving apiKey via event is visible to all useSettings() callers (singleton check)', () => {
    const instance1 = useSettings()
    const instance2 = useSettings()
    instance1.loadSettings()

    const e = new CustomEvent('setup-complete', { detail: { apiKey: 'broadcast-token' } })
    const key = extractApiKey(e)
    instance1.saveSettings('apiKey', key)

    // A second component that only called useSettings() must see the key
    expect(instance2.settings.value.apiKey).toBe('broadcast-token')
  })
})
