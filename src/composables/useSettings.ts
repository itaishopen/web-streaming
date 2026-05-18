import { ref } from 'vue'
import { storage, STORAGE_KEYS } from '../utils/storage'
import { applyAccentColor } from '../utils/appearance'
import type { AppSettings } from '../types'

const DEFAULTS: AppSettings = {
  apiKey: '',
  accentColor: 'red',
  fontSize: 'normal',
  compactMode: false,
  reduceAnimations: false,
  recordHistory: true,
  watchedThreshold: 3,
  introSkipMode: 'prompt',
  ratingCountry: 'US',
  maxAgeRating: 18,
  playerSource: 'autoembed',
  subtitlesEnabled: true,
  defaultSubtitleLang: 'en',
  homeViewMode: 'carousel',
  startPage: 'home',
}

// Module-level singleton so every component shares the same reactive ref.
const settings = ref<AppSettings>({ ...DEFAULTS })

const STORAGE_KEY_MAP: Record<keyof AppSettings, string> = {
  apiKey:             STORAGE_KEYS.API_KEY,
  accentColor:        STORAGE_KEYS.ACCENT_COLOR,
  fontSize:           STORAGE_KEYS.FONT_SIZE,
  compactMode:        STORAGE_KEYS.COMPACT_MODE,
  reduceAnimations:   STORAGE_KEYS.REDUCE_ANIMATIONS,
  recordHistory:      STORAGE_KEYS.RECORD_HISTORY,
  watchedThreshold:   STORAGE_KEYS.WATCHED_THRESHOLD,
  introSkipMode:      STORAGE_KEYS.INTRO_SKIP_MODE,
  ratingCountry:      STORAGE_KEYS.RATING_COUNTRY,
  maxAgeRating:       STORAGE_KEYS.MAX_AGE_RATING,
  playerSource:       STORAGE_KEYS.PLAYER_SOURCE,
  subtitlesEnabled:   STORAGE_KEYS.SUBTITLES_ENABLED,
  defaultSubtitleLang:STORAGE_KEYS.DEFAULT_SUBTITLE_LANG,
  homeViewMode:       STORAGE_KEYS.HOME_VIEW_MODE,
  startPage:          STORAGE_KEYS.START_PAGE,
}

export function useSettings() {
  function loadSettings(): void {
    settings.value = {
      apiKey:             storage.get<string>(STORAGE_KEYS.API_KEY)             ?? DEFAULTS.apiKey,
      accentColor:        storage.get<string>(STORAGE_KEYS.ACCENT_COLOR)        ?? DEFAULTS.accentColor,
      fontSize:           storage.get<AppSettings['fontSize']>(STORAGE_KEYS.FONT_SIZE)       ?? DEFAULTS.fontSize,
      compactMode:        storage.get<boolean>(STORAGE_KEYS.COMPACT_MODE)       ?? DEFAULTS.compactMode,
      reduceAnimations:   storage.get<boolean>(STORAGE_KEYS.REDUCE_ANIMATIONS)  ?? DEFAULTS.reduceAnimations,
      recordHistory:      storage.get<boolean>(STORAGE_KEYS.RECORD_HISTORY)     ?? DEFAULTS.recordHistory,
      watchedThreshold:   storage.get<number>(STORAGE_KEYS.WATCHED_THRESHOLD)   ?? DEFAULTS.watchedThreshold,
      introSkipMode:      storage.get<AppSettings['introSkipMode']>(STORAGE_KEYS.INTRO_SKIP_MODE) ?? DEFAULTS.introSkipMode,
      ratingCountry:      storage.get<string>(STORAGE_KEYS.RATING_COUNTRY)      ?? DEFAULTS.ratingCountry,
      maxAgeRating:       storage.get<number>(STORAGE_KEYS.MAX_AGE_RATING)      ?? DEFAULTS.maxAgeRating,
      playerSource:       storage.get<string>(STORAGE_KEYS.PLAYER_SOURCE)       ?? DEFAULTS.playerSource,
      subtitlesEnabled:   storage.get<boolean>(STORAGE_KEYS.SUBTITLES_ENABLED)  ?? DEFAULTS.subtitlesEnabled,
      defaultSubtitleLang:storage.get<string>(STORAGE_KEYS.DEFAULT_SUBTITLE_LANG) ?? DEFAULTS.defaultSubtitleLang,
      homeViewMode:       storage.get<AppSettings['homeViewMode']>(STORAGE_KEYS.HOME_VIEW_MODE) ?? DEFAULTS.homeViewMode,
      startPage:          storage.get<string>(STORAGE_KEYS.START_PAGE)          ?? DEFAULTS.startPage,
    }
  }

  function saveSettings<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    storage.set(STORAGE_KEY_MAP[key], value)
    settings.value = { ...settings.value, [key]: value }
  }

  function applyTheme(): void {
    const { accentColor, fontSize, compactMode, reduceAnimations } = settings.value
    applyAccentColor(accentColor)

    const root = document.documentElement
    const fontSizeMap: Record<AppSettings['fontSize'], string> = {
      small: '14px', normal: '16px', large: '18px',
    }
    root.style.setProperty('--base-font-size', fontSizeMap[fontSize])
    root.dataset.fontSize = fontSize

    if (compactMode)        root.dataset.compact          = 'true'
    else                    delete root.dataset.compact

    if (reduceAnimations)   root.dataset.reduceAnimations = 'true'
    else                    delete root.dataset.reduceAnimations
  }

  return { settings, loadSettings, saveSettings, applyTheme }
}
