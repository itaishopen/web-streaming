import { storage, STORAGE_KEYS } from './storage'

interface BackupData {
  version: number
  exportedAt: number
  saved: unknown
  history: unknown
  progress: unknown
  watched: unknown
  settings: Record<string, unknown>
}

export function exportBackup(): void {
  const settingKeys = [
    STORAGE_KEYS.ACCENT_COLOR, STORAGE_KEYS.FONT_SIZE,
    STORAGE_KEYS.COMPACT_MODE, STORAGE_KEYS.REDUCE_ANIMATIONS,
    STORAGE_KEYS.RECORD_HISTORY, STORAGE_KEYS.WATCHED_THRESHOLD,
    STORAGE_KEYS.INTRO_SKIP_MODE, STORAGE_KEYS.RATING_COUNTRY,
    STORAGE_KEYS.MAX_AGE_RATING, STORAGE_KEYS.PLAYER_SOURCE,
    STORAGE_KEYS.HOME_VIEW_MODE, STORAGE_KEYS.HOME_LAYOUT,
    STORAGE_KEYS.WATCHLIST_SORT,
  ]
  const settings: Record<string, unknown> = {}
  settingKeys.forEach((k) => { settings[k] = storage.get(k) })

  const backup: BackupData = {
    version: 1,
    exportedAt: Date.now(),
    saved: storage.get(STORAGE_KEYS.SAVED),
    history: storage.get(STORAGE_KEYS.HISTORY),
    progress: storage.get(STORAGE_KEYS.PROGRESS),
    watched: storage.get(STORAGE_KEYS.WATCHED),
    settings,
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `streambert-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<void> {
  const text = await file.text()
  const data = JSON.parse(text) as BackupData
  if (data.version !== 1) throw new Error('Unsupported backup version')
  if (data.saved)    storage.set(STORAGE_KEYS.SAVED, data.saved)
  if (data.history)  storage.set(STORAGE_KEYS.HISTORY, data.history)
  if (data.progress) storage.set(STORAGE_KEYS.PROGRESS, data.progress)
  if (data.watched)  storage.set(STORAGE_KEYS.WATCHED, data.watched)
  if (data.settings) {
    Object.entries(data.settings).forEach(([k, v]) => {
      if (v !== undefined) storage.set(k, v)
    })
  }
}
