import { storage, STORAGE_KEYS } from './storage'
import type { HomeRow } from '../types'

export const DEFAULT_ROWS: HomeRow[] = [
  { id: 'continue',  label: 'Continue Watching', visible: true },
  { id: 'similar',   label: 'Similar To…',        visible: true },
  { id: 'movies',    label: 'Trending Movies',    visible: true },
  { id: 'series',    label: 'Trending Series',    visible: true },
  { id: 'toprated',  label: 'Top Rated',          visible: true },
]

const KNOWN_IDS = new Set(DEFAULT_ROWS.map((r) => r.id))

export function loadHomeLayout(): HomeRow[] {
  const saved = storage.get<HomeRow[]>(STORAGE_KEYS.HOME_LAYOUT)
  if (!saved) return [...DEFAULT_ROWS]
  const filtered = saved.filter((r) => KNOWN_IDS.has(r.id))
  const savedIds = new Set(filtered.map((r) => r.id))
  const extras = DEFAULT_ROWS.filter((r) => !savedIds.has(r.id))
  return [...filtered, ...extras]
}

export function saveHomeLayout(rows: HomeRow[]): void {
  storage.set(STORAGE_KEYS.HOME_LAYOUT, rows)
}

export function loadHomeViewMode(): 'carousel' | 'list' {
  return storage.get<'carousel' | 'list'>(STORAGE_KEYS.HOME_VIEW_MODE, 'carousel') ?? 'carousel'
}

export function saveHomeViewMode(mode: 'carousel' | 'list'): void {
  storage.set(STORAGE_KEYS.HOME_VIEW_MODE, mode)
}

export function loadStartPage(): string {
  return storage.get<string>(STORAGE_KEYS.START_PAGE, 'home') ?? 'home'
}
