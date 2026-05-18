import { ref, computed } from 'vue'
import { storage, STORAGE_KEYS } from '../utils/storage'
import type { MediaItem, WatchProgress, HistoryEntry } from '../types'

export function useLibrary() {
  const saved = ref<MediaItem[]>([])
  const history = ref<HistoryEntry[]>([])
  const progress = ref<Record<string, WatchProgress>>({})
  const watched = ref<Record<string, boolean>>({})

  function loadLibrary(): void {
    saved.value = storage.get<MediaItem[]>(STORAGE_KEYS.SAVED, [])!
    history.value = storage.get<HistoryEntry[]>(STORAGE_KEYS.HISTORY, [])!
    progress.value = storage.get<Record<string, WatchProgress>>(STORAGE_KEYS.PROGRESS, {})!
    watched.value = storage.get<Record<string, boolean>>(STORAGE_KEYS.WATCHED, {})!
  }

  function saveItem(item: MediaItem): void {
    const exists = saved.value.some((s) => s.id === item.id && s.media_type === item.media_type)
    if (!exists) {
      saved.value = [item, ...saved.value]
      storage.set(STORAGE_KEYS.SAVED, saved.value)
    }
  }

  function removeItem(id: number, type: string): void {
    saved.value = saved.value.filter((s) => !(s.id === id && s.media_type === type))
    storage.set(STORAGE_KEYS.SAVED, saved.value)
  }

  function isSaved(id: number, type: string): boolean {
    return saved.value.some((s) => s.id === id && s.media_type === type)
  }

  function addHistory(entry: HistoryEntry): void {
    // Deduplicate by item id + episodeKey
    const deduped = history.value.filter(
      (h) => !(h.item.id === entry.item.id && h.episodeKey === entry.episodeKey),
    )
    // Prepend and trim to 100
    history.value = [entry, ...deduped].slice(0, 100)
    storage.set(STORAGE_KEYS.HISTORY, history.value)
  }

  function saveProgress(key: string, prog: WatchProgress): void {
    progress.value = { ...progress.value, [key]: prog }
    storage.set(STORAGE_KEYS.PROGRESS, progress.value)
  }

  function getProgress(key: string): WatchProgress | undefined {
    return progress.value[key]
  }

  function markWatched(key: string): void {
    watched.value = { ...watched.value, [key]: true }
    storage.set(STORAGE_KEYS.WATCHED, watched.value)
  }

  function markUnwatched(key: string): void {
    const updated = { ...watched.value }
    delete updated[key]
    watched.value = updated
    storage.set(STORAGE_KEYS.WATCHED, watched.value)
  }

  function isWatched(key: string): boolean {
    return watched.value[key] === true
  }

  function clearHistory(): void {
    history.value = []
    storage.set(STORAGE_KEYS.HISTORY, [])
  }

  function clearProgress(): void {
    progress.value = {}
    watched.value = {}
    storage.set(STORAGE_KEYS.PROGRESS, {})
    storage.set(STORAGE_KEYS.WATCHED, {})
  }

  const inProgress = computed<MediaItem[]>(() => {
    return history.value
      .filter((entry) => {
        // Build progress key from item id and episodeKey
        const key = entry.episodeKey
          ? `tv_${entry.item.id}_${entry.episodeKey}`
          : `${entry.item.media_type ?? 'movie'}_${entry.item.id}`
        const prog = progress.value[key]
        return prog !== undefined && prog.pct >= 5 && prog.pct <= 95
      })
      .map((entry) => entry.item)
  })

  return {
    saved,
    history,
    progress,
    watched,
    inProgress,
    loadLibrary,
    saveItem,
    removeItem,
    isSaved,
    addHistory,
    saveProgress,
    getProgress,
    markWatched,
    markUnwatched,
    isWatched,
    clearHistory,
    clearProgress,
  }
}
