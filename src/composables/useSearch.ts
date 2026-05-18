import { ref } from 'vue'
import { tmdbFetch } from '../utils/api'
import { storage, STORAGE_KEYS } from '../utils/storage'
import type { SearchResult } from '../types'

interface TMDBSearchResponse {
  results: SearchResult[]
  total_results: number
  total_pages: number
  page: number
}

export function useSearch() {
  const query = ref<string>('')
  const results = ref<SearchResult[]>([])
  const loading = ref<boolean>(false)
  const searchHistory = ref<string[]>([])

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function loadHistory(): void {
    searchHistory.value = storage.get<string[]>('searchHistory', [])!
  }

  function search(q: string, apiKey: string): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
    }

    const trimmed = q.trim()
    query.value = trimmed

    if (!trimmed) {
      results.value = []
      loading.value = false
      return
    }

    loading.value = true

    debounceTimer = setTimeout(async () => {
      try {
        const data = await tmdbFetch<TMDBSearchResponse>(
          `/search/multi?query=${encodeURIComponent(trimmed)}&include_adult=false&page=1`,
          apiKey,
        )
        results.value = (data.results ?? [])
          .filter((r) => r.media_type !== 'person')
          .slice(0, 12)
      } catch {
        results.value = []
      } finally {
        loading.value = false
      }
    }, 380)
  }

  function addToHistory(q: string): void {
    const trimmed = q.trim()
    if (!trimmed) return
    const deduped = searchHistory.value.filter((h) => h !== trimmed)
    searchHistory.value = [trimmed, ...deduped].slice(0, 12)
    storage.set('searchHistory', searchHistory.value)
  }

  function removeFromHistory(q: string): void {
    searchHistory.value = searchHistory.value.filter((h) => h !== q)
    storage.set('searchHistory', searchHistory.value)
  }

  function clearHistory(): void {
    searchHistory.value = []
    storage.set('searchHistory', [])
  }

  return {
    query,
    results,
    loading,
    searchHistory,
    loadHistory,
    search,
    addToHistory,
    removeFromHistory,
    clearHistory,
  }
}
