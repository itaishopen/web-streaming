import { storage, formatBytes, clearAppCaches, STORAGE_KEYS } from '../../utils/storage'

const PREFIX = 'webstream_'

describe('storage.get()', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns undefined for a missing key with no fallback', () => {
    expect(storage.get('nonexistent')).toBeUndefined()
  })

  it('returns fallback when key is missing', () => {
    expect(storage.get('nonexistent', 42)).toBe(42)
  })

  it('deserializes a stored value correctly', () => {
    storage.set('myKey', { name: 'Alice', age: 30 })
    const result = storage.get<{ name: string; age: number }>('myKey')
    expect(result).toEqual({ name: 'Alice', age: 30 })
  })

  it('returns fallback when stored JSON is corrupted', () => {
    localStorage.setItem(PREFIX + 'badKey', '{ not valid json !!!')
    expect(storage.get('badKey', 'fallback')).toBe('fallback')
  })

  it('returns undefined (not the fallback) when key exists but value is stored null JSON', () => {
    // JSON.parse('null') === null, which is falsy but not a parse error
    localStorage.setItem(PREFIX + 'nullKey', 'null')
    expect(storage.get('nullKey', 'fallback')).toBeNull()
  })
})

describe('storage.set()', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists a JSON-serialized value to localStorage', () => {
    storage.set('testKey', [1, 2, 3])
    const raw = localStorage.getItem(PREFIX + 'testKey')
    expect(raw).toBe(JSON.stringify([1, 2, 3]))
  })

  it('persists a string value', () => {
    storage.set('strKey', 'hello world')
    const raw = localStorage.getItem(PREFIX + 'strKey')
    expect(raw).toBe('"hello world"')
  })

  it('persists a boolean value', () => {
    storage.set('boolKey', true)
    const raw = localStorage.getItem(PREFIX + 'boolKey')
    expect(raw).toBe('true')
  })
})

describe('storage.remove()', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deletes a key that was previously set', () => {
    storage.set('toDelete', 'value')
    expect(storage.get('toDelete')).toBe('value')
    storage.remove('toDelete')
    expect(storage.get('toDelete')).toBeUndefined()
  })

  it('does not throw when removing a key that does not exist', () => {
    expect(() => storage.remove('doesNotExist')).not.toThrow()
  })
})

describe('storage.clearAll()', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('removes all webstream_ prefixed keys', () => {
    storage.set('key1', 'a')
    storage.set('key2', 'b')
    storage.set('key3', 'c')
    storage.clearAll()
    expect(storage.get('key1')).toBeUndefined()
    expect(storage.get('key2')).toBeUndefined()
    expect(storage.get('key3')).toBeUndefined()
  })

  it('leaves keys that do not have the webstream_ prefix untouched', () => {
    localStorage.setItem('other_key', 'should remain')
    storage.set('willBeCleared', 'gone')
    storage.clearAll()
    expect(localStorage.getItem('other_key')).toBe('should remain')
    expect(storage.get('willBeCleared')).toBeUndefined()
  })
})

describe('formatBytes()', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats 500 bytes as "500 B"', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats exactly 1023 bytes as "1023 B"', () => {
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('formats 1024 bytes as "1.0 KB"', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  it('formats 1 MB (1048576 bytes) as "1.0 MB"', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
  })

  it('formats 1 GB (1073741824 bytes) as "1.00 GB"', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB')
  })

  it('formats 1536 bytes as "1.5 KB"', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })
})

describe('clearAppCaches()', () => {
  beforeEach(() => {
    localStorage.clear()
    // Provide a minimal caches stub so the window check doesn't fail
    Object.defineProperty(global, 'caches', {
      value: { keys: jest.fn().mockResolvedValue([]) },
      configurable: true,
      writable: true,
    })
  })

  it('removes the four cache keys from storage', () => {
    storage.set(STORAGE_KEYS.TRENDING_CACHE, [{ id: 1 }])
    storage.set(STORAGE_KEYS.TRENDING_CACHE_DATE, '2024-01-01')
    storage.set(STORAGE_KEYS.ANILIST_CACHE, [{ id: 2 }])
    storage.set(STORAGE_KEYS.EPISODE_GROUP_CACHE, [{ id: 3 }])

    clearAppCaches()

    expect(storage.get(STORAGE_KEYS.TRENDING_CACHE)).toBeUndefined()
    expect(storage.get(STORAGE_KEYS.TRENDING_CACHE_DATE)).toBeUndefined()
    expect(storage.get(STORAGE_KEYS.ANILIST_CACHE)).toBeUndefined()
    expect(storage.get(STORAGE_KEYS.EPISODE_GROUP_CACHE)).toBeUndefined()
  })

  it('does not throw when cache keys do not exist', () => {
    expect(() => clearAppCaches()).not.toThrow()
  })
})
