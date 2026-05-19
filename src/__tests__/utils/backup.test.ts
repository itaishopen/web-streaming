import { exportBackup, importBackup } from '../../utils/backup'
import { storage, STORAGE_KEYS } from '../../utils/storage'

// Helpers
function makeFile(content: string, name = 'backup.json'): File {
  return new File([content], name, { type: 'application/json' })
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

describe('exportBackup()', () => {
  let createObjectURLMock: jest.Mock
  let revokeObjectURLMock: jest.Mock
  let createElementSpy: jest.SpyInstance
  let anchorClickMock: jest.Mock
  let capturedBlob: Blob | undefined

  beforeEach(() => {
    capturedBlob = undefined
    anchorClickMock = jest.fn()

    createObjectURLMock = jest.fn((blob: Blob) => {
      capturedBlob = blob
      return 'blob:mock-url'
    })
    revokeObjectURLMock = jest.fn()

    global.URL.createObjectURL = createObjectURLMock
    global.URL.revokeObjectURL = revokeObjectURLMock

    createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = {
          href: '',
          download: '',
          click: anchorClickMock,
        } as unknown as HTMLAnchorElement
        return anchor
      }
      return document.createElement(tag)
    })
  })

  afterEach(() => {
    createElementSpy.mockRestore()
  })

  it('triggers a file download by calling anchor.click()', () => {
    exportBackup()
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
  })

  it('creates a Blob with valid JSON', async () => {
    exportBackup()
    expect(capturedBlob).toBeDefined()
    const text = await capturedBlob!.text()
    expect(() => JSON.parse(text)).not.toThrow()
  })

  it('includes version: 1 in the exported JSON', async () => {
    exportBackup()
    const text = await capturedBlob!.text()
    const data = JSON.parse(text)
    expect(data.version).toBe(1)
  })

  it('includes exportedAt timestamp in the exported JSON', async () => {
    const before = Date.now()
    exportBackup()
    const after = Date.now()
    const text = await capturedBlob!.text()
    const data = JSON.parse(text)
    expect(data.exportedAt).toBeGreaterThanOrEqual(before)
    expect(data.exportedAt).toBeLessThanOrEqual(after)
  })

  it('includes saved, history, progress, watched fields when storage is populated', async () => {
    storage.set(STORAGE_KEYS.SAVED, [{ id: 1 }])
    storage.set(STORAGE_KEYS.HISTORY, [{ item: { id: 1 }, watchedAt: 0 }])
    storage.set(STORAGE_KEYS.PROGRESS, { movie_1: { watched: 60, duration: 120, pct: 50, updatedAt: 0 } })
    storage.set(STORAGE_KEYS.WATCHED, { movie_1: true })
    exportBackup()
    const text = await capturedBlob!.text()
    const data = JSON.parse(text)
    expect(data).toHaveProperty('saved')
    expect(data).toHaveProperty('history')
    expect(data).toHaveProperty('progress')
    expect(data).toHaveProperty('watched')
  })

  it('calls URL.createObjectURL', () => {
    exportBackup()
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
  })

  it('calls URL.revokeObjectURL to clean up', () => {
    exportBackup()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url')
  })

  it('exports data that was previously stored', async () => {
    storage.set(STORAGE_KEYS.SAVED, [{ id: 99, title: 'My Movie' }])
    exportBackup()
    const text = await capturedBlob!.text()
    const data = JSON.parse(text)
    expect(data.saved).toEqual([{ id: 99, title: 'My Movie' }])
  })
})

describe('importBackup()', () => {
  it('restores saved, history, progress, watched from backup file', async () => {
    const backup = {
      version: 1,
      exportedAt: Date.now(),
      saved: [{ id: 1, title: 'Film' }],
      history: [{ item: { id: 1 }, watchedAt: 123456 }],
      progress: { movie_1: { watched: 60, duration: 120, pct: 50, updatedAt: 0 } },
      watched: { movie_1: true },
      settings: {},
    }
    const file = makeFile(JSON.stringify(backup))
    await importBackup(file)

    expect(storage.get(STORAGE_KEYS.SAVED)).toEqual([{ id: 1, title: 'Film' }])
    expect(storage.get(STORAGE_KEYS.HISTORY)).toEqual([{ item: { id: 1 }, watchedAt: 123456 }])
    expect(storage.get(STORAGE_KEYS.PROGRESS)).toEqual({ movie_1: { watched: 60, duration: 120, pct: 50, updatedAt: 0 } })
    expect(storage.get(STORAGE_KEYS.WATCHED)).toEqual({ movie_1: true })
  })

  it('throws "Unsupported backup version" when version !== 1', async () => {
    const backup = {
      version: 2,
      exportedAt: Date.now(),
      saved: [],
      history: [],
      progress: {},
      watched: {},
      settings: {},
    }
    const file = makeFile(JSON.stringify(backup))
    await expect(importBackup(file)).rejects.toThrow('Unsupported backup version')
  })

  it('only sets keys that are present (truthy) in the backup', async () => {
    const setItemSpy = jest.spyOn(localStorage, 'setItem')
    const backup = {
      version: 1,
      exportedAt: Date.now(),
      saved: [{ id: 5 }],
      // history, progress, watched are absent / falsy
      history: null,
      progress: null,
      watched: null,
      settings: {},
    }
    const file = makeFile(JSON.stringify(backup))
    await importBackup(file)

    // saved should be set
    expect(storage.get(STORAGE_KEYS.SAVED)).toEqual([{ id: 5 }])
    // history / progress / watched should NOT have been written (they were null/falsy)
    const writtenKeys = setItemSpy.mock.calls.map((c) => c[0])
    expect(writtenKeys).not.toContain('webstream_' + STORAGE_KEYS.HISTORY)
    expect(writtenKeys).not.toContain('webstream_' + STORAGE_KEYS.PROGRESS)
    expect(writtenKeys).not.toContain('webstream_' + STORAGE_KEYS.WATCHED)

    setItemSpy.mockRestore()
  })

  it('restores settings from the backup', async () => {
    const backup = {
      version: 1,
      exportedAt: Date.now(),
      saved: [],
      history: [],
      progress: {},
      watched: {},
      settings: {
        [STORAGE_KEYS.ACCENT_COLOR]: 'blue',
        [STORAGE_KEYS.FONT_SIZE]: 'large',
      },
    }
    const file = makeFile(JSON.stringify(backup))
    await importBackup(file)

    expect(storage.get(STORAGE_KEYS.ACCENT_COLOR)).toBe('blue')
    expect(storage.get(STORAGE_KEYS.FONT_SIZE)).toBe('large')
  })
})
