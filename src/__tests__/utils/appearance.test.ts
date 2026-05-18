import { ACCENT_PRESETS, applyAccentColor } from '../../utils/appearance'

describe('ACCENT_PRESETS', () => {
  it('has exactly 6 entries', () => {
    expect(ACCENT_PRESETS).toHaveLength(6)
  })

  it('each preset has id, label, color, color2, dim, glow properties', () => {
    ACCENT_PRESETS.forEach((preset) => {
      expect(preset).toHaveProperty('id')
      expect(preset).toHaveProperty('label')
      expect(preset).toHaveProperty('color')
      expect(preset).toHaveProperty('color2')
      expect(preset).toHaveProperty('dim')
      expect(preset).toHaveProperty('glow')
    })
  })

  it('includes presets with ids: red, blue, purple, green, orange, pink', () => {
    const ids = ACCENT_PRESETS.map((p) => p.id)
    expect(ids).toContain('red')
    expect(ids).toContain('blue')
    expect(ids).toContain('purple')
    expect(ids).toContain('green')
    expect(ids).toContain('orange')
    expect(ids).toContain('pink')
  })

  it('each preset has non-empty string values for all fields', () => {
    ACCENT_PRESETS.forEach((preset) => {
      expect(typeof preset.id).toBe('string')
      expect(preset.id.length).toBeGreaterThan(0)
      expect(typeof preset.label).toBe('string')
      expect(preset.label.length).toBeGreaterThan(0)
      expect(typeof preset.color).toBe('string')
      expect(preset.color.length).toBeGreaterThan(0)
      expect(typeof preset.color2).toBe('string')
      expect(preset.color2.length).toBeGreaterThan(0)
      expect(typeof preset.dim).toBe('string')
      expect(preset.dim.length).toBeGreaterThan(0)
      expect(typeof preset.glow).toBe('string')
      expect(preset.glow.length).toBeGreaterThan(0)
    })
  })
})

describe('applyAccentColor()', () => {
  let setPropertyMock: jest.SpyInstance

  beforeEach(() => {
    setPropertyMock = jest.spyOn(document.documentElement.style, 'setProperty')
  })

  afterEach(() => {
    setPropertyMock.mockRestore()
  })

  it('sets --accent to #e50914 for "red"', () => {
    applyAccentColor('red')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent', '#e50914')
  })

  it('sets --accent to #2563eb for "blue"', () => {
    applyAccentColor('blue')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent', '#2563eb')
  })

  it('falls back to the red preset for an unknown id', () => {
    applyAccentColor('unknown-id')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent', '#e50914')
  })

  it('sets all four CSS custom properties: --accent, --accent2, --accent-dim, --accent-glow', () => {
    applyAccentColor('purple')
    const calledProps = setPropertyMock.mock.calls.map((call) => call[0])
    expect(calledProps).toContain('--accent')
    expect(calledProps).toContain('--accent2')
    expect(calledProps).toContain('--accent-dim')
    expect(calledProps).toContain('--accent-glow')
  })

  it('sets correct values for purple preset', () => {
    applyAccentColor('purple')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent', '#7c3aed')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent2', '#8b5cf6')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent-dim', 'rgba(124,58,237,0.15)')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent-glow', '0 0 30px rgba(124,58,237,0.3)')
  })

  it('sets correct values for green preset', () => {
    applyAccentColor('green')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent', '#059669')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent2', '#10b981')
  })

  it('sets correct values for orange preset', () => {
    applyAccentColor('orange')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent', '#d97706')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent2', '#f59e0b')
  })

  it('sets correct values for pink preset', () => {
    applyAccentColor('pink')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent', '#db2777')
    expect(setPropertyMock).toHaveBeenCalledWith('--accent2', '#ec4899')
  })

  it('calls setProperty exactly 4 times per invocation', () => {
    setPropertyMock.mockClear()
    applyAccentColor('red')
    expect(setPropertyMock).toHaveBeenCalledTimes(4)
  })
})
