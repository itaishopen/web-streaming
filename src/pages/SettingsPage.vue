<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import { PLAYER_SOURCES } from '../utils/api'
import { ACCENT_PRESETS, applyAccentColor } from '../utils/appearance'
import { exportBackup, importBackup } from '../utils/backup'
import { loadHomeLayout, saveHomeLayout } from '../utils/homeLayout'
import { storage, STORAGE_KEYS, clearAppCaches } from '../utils/storage'
import type { HomeRow, AppSettings } from '../types'

const { settings, saveSettings } = useSettings()

// ---- API settings ----
const apiKeyInput = ref('')
const showApiKey = ref(false)
const apiKeyValid = ref<null | boolean>(null)
const validating = ref(false)

// ---- Content ----
const ratingCountry = ref('US')
const maxAgeRating = ref(18)

// ---- Playback ----
const playerSource = ref('vidsrc')
const watchedThreshold = ref(3)
const introSkipMode = ref<'off' | 'auto' | 'prompt'>('prompt')

// ---- Interface ----
const accentColor = ref('red')
const fontSize = ref<'small' | 'normal' | 'large'>('normal')
const compactMode = ref(false)
const reduceAnimations = ref(false)

// ---- Home Layout ----
const homeRows = ref<HomeRow[]>([])
const viewMode = ref<'carousel' | 'list'>('carousel')
const dragIndex = ref<number | null>(null)

// ---- Library & Privacy ----
const watchlistSort = ref('manual')
const recordHistory = ref(true)

// ---- Toast ----
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2000)
}

// ---- Persist helpers ----
function persist<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  saveSettings(key, value)
}

// ---- API ----
async function validateApiKey() {
  if (!apiKeyInput.value.trim()) return
  validating.value = true
  apiKeyValid.value = null
  try {
    const res = await fetch('https://api.themoviedb.org/3/configuration', {
      headers: { Authorization: `Bearer ${apiKeyInput.value.trim()}` },
    })
    apiKeyValid.value = res.ok
    if (res.ok) {
      persist('apiKey', apiKeyInput.value.trim())
      showToast('API key saved.')
    }
  } catch {
    apiKeyValid.value = false
  } finally {
    validating.value = false
  }
}

function saveApiKey() {
  persist('apiKey', apiKeyInput.value.trim())
  showToast('API key saved.')
}

// ---- Content ----
function onRatingCountryChange() {
  persist('ratingCountry', ratingCountry.value)
  showToast('Rating country updated.')
}

function onMaxAgeRatingChange() {
  persist('maxAgeRating', maxAgeRating.value)
  showToast('Max age rating updated.')
}

// ---- Playback ----
function onPlayerSourceChange() {
  persist('playerSource', playerSource.value)
  showToast('Player source updated.')
}

function onWatchedThresholdChange() {
  persist('watchedThreshold', watchedThreshold.value)
  showToast('Watched threshold saved.')
}

function onIntroSkipModeChange() {
  persist('introSkipMode', introSkipMode.value)
  showToast('Intro skip mode saved.')
}

// ---- Interface ----
function selectAccent(id: string) {
  accentColor.value = id
  persist('accentColor', id)
  applyAccentColor(id)
  showToast('Accent color applied.')
}

function onFontSizeChange() {
  persist('fontSize', fontSize.value)
  const map: Record<string, string> = { small: '14px', normal: '16px', large: '18px' }
  document.documentElement.style.setProperty('--base-font-size', map[fontSize.value] ?? '16px')
  showToast('Font size updated.')
}

function onCompactModeChange() {
  persist('compactMode', compactMode.value)
  if (compactMode.value) {
    document.documentElement.dataset.compact = 'true'
  } else {
    delete document.documentElement.dataset.compact
  }
  showToast('Compact mode ' + (compactMode.value ? 'enabled.' : 'disabled.'))
}

function onReduceAnimationsChange() {
  persist('reduceAnimations', reduceAnimations.value)
  if (reduceAnimations.value) {
    document.documentElement.dataset.reduceAnimations = 'true'
  } else {
    delete document.documentElement.dataset.reduceAnimations
  }
  showToast('Animation preference saved.')
}

// ---- Home layout drag-to-reorder ----
function onDragStart(idx: number) {
  dragIndex.value = idx
}

function onDragOver(e: DragEvent, idx: number) {
  e.preventDefault()
  if (dragIndex.value === null || dragIndex.value === idx) return
  const rows = [...homeRows.value]
  const moved = rows.splice(dragIndex.value, 1)[0]
  rows.splice(idx, 0, moved)
  homeRows.value = rows
  dragIndex.value = idx
}

function onDragEnd() {
  dragIndex.value = null
  saveHomeLayout(homeRows.value)
  showToast('Home layout saved.')
}

function toggleRowVisibility(idx: number) {
  homeRows.value[idx].visible = !homeRows.value[idx].visible
  saveHomeLayout(homeRows.value)
  showToast('Row visibility updated.')
}

function onViewModeChange() {
  storage.set(STORAGE_KEYS.HOME_VIEW_MODE, viewMode.value)
  persist('homeViewMode', viewMode.value)
  showToast('View mode updated.')
}

// ---- Library & Privacy ----
function onWatchlistSortChange() {
  storage.set(STORAGE_KEYS.WATCHLIST_SORT, watchlistSort.value)
  showToast('Watchlist sort saved.')
}

function onRecordHistoryChange() {
  persist('recordHistory', recordHistory.value)
  showToast('History recording ' + (recordHistory.value ? 'enabled.' : 'disabled.'))
}

// ---- Backup & Restore ----
function doExport() {
  exportBackup()
  showToast('Backup exported.')
}

const importFileInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  importFileInput.value?.click()
}

async function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    await importBackup(file)
    showToast('Backup imported successfully. Reload to see changes.')
  } catch (err) {
    alert('Import failed: ' + (err instanceof Error ? err.message : String(err)))
  }
  // Reset file input so the same file can be re-selected
  if (importFileInput.value) importFileInput.value.value = ''
}

// ---- Storage ----
function doClearCaches() {
  clearAppCaches()
  showToast('App caches cleared.')
}

function doResetProgress() {
  if (!confirm('Reset all watch progress? This action cannot be undone.')) return
  storage.remove(STORAGE_KEYS.PROGRESS)
  storage.remove(STORAGE_KEYS.WATCHED)
  showToast('Watch progress reset.')
}

// ---- Mount ----
onMounted(() => {
  apiKeyInput.value = settings.value.apiKey
  ratingCountry.value = settings.value.ratingCountry
  maxAgeRating.value = settings.value.maxAgeRating
  playerSource.value = settings.value.playerSource
  watchedThreshold.value = settings.value.watchedThreshold
  introSkipMode.value = settings.value.introSkipMode
  accentColor.value = settings.value.accentColor
  fontSize.value = settings.value.fontSize
  compactMode.value = settings.value.compactMode
  reduceAnimations.value = settings.value.reduceAnimations
  recordHistory.value = settings.value.recordHistory
  viewMode.value = settings.value.homeViewMode
  homeRows.value = loadHomeLayout()
  watchlistSort.value = storage.get<string>(STORAGE_KEYS.WATCHLIST_SORT, 'manual') ?? 'manual'
})
</script>

<template>
  <div class="settings-page">
    <!-- Toast notification -->
    <Transition name="toast-fade">
      <div v-if="toast" class="toast-notification" role="status" aria-live="polite">
        {{ toast }}
      </div>
    </Transition>

    <div class="settings-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Customize your streaming experience.</p>
    </div>

    <div class="settings-columns">

      <!-- ================================================ -->
      <!-- 1. API -->
      <!-- ================================================ -->
      <div class="settings-section">
        <h2 class="section-heading">API</h2>

        <div class="field-group">
          <label for="api-key" class="field-label">TMDB API Read Access Token</label>
          <p class="field-hint">
            Get your token from
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">
              themoviedb.org
            </a>
          </p>
          <div class="input-row">
            <input
              id="api-key"
              class="text-input"
              :type="showApiKey ? 'text' : 'password'"
              v-model="apiKeyInput"
              placeholder="eyJhbGciOiJIUzI1NiJ9…"
              autocomplete="off"
              spellcheck="false"
            />
            <button
              class="icon-btn"
              :aria-label="showApiKey ? 'Hide token' : 'Show token'"
              @click="showApiKey = !showApiKey"
            >
              <svg v-if="showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          <div class="btn-row">
            <button class="btn btn-secondary" @click="saveApiKey">Save</button>
            <button
              class="btn btn-primary"
              :disabled="validating || !apiKeyInput.trim()"
              @click="validateApiKey"
            >
              {{ validating ? 'Validating…' : 'Validate' }}
            </button>
            <span
              v-if="apiKeyValid === true"
              class="validation-msg validation-msg--ok"
              aria-live="polite"
            >Valid</span>
            <span
              v-else-if="apiKeyValid === false"
              class="validation-msg validation-msg--err"
              aria-live="polite"
            >Invalid key</span>
          </div>
        </div>
      </div>

      <!-- ================================================ -->
      <!-- 2. Content -->
      <!-- ================================================ -->
      <div class="settings-section">
        <h2 class="section-heading">Content</h2>

        <div class="field-group">
          <label for="rating-country" class="field-label">Rating Country</label>
          <select
            id="rating-country"
            class="select-input"
            v-model="ratingCountry"
            @change="onRatingCountryChange"
          >
            <option value="US">United States (US)</option>
            <option value="GB">United Kingdom (GB)</option>
            <option value="DE">Germany (DE)</option>
            <option value="FR">France (FR)</option>
            <option value="AU">Australia (AU)</option>
            <option value="NZ">New Zealand (NZ)</option>
            <option value="BR">Brazil (BR)</option>
            <option value="CA">Canada (CA)</option>
            <option value="JP">Japan (JP)</option>
          </select>
        </div>

        <div class="field-group">
          <label for="max-age-rating" class="field-label">
            Maximum Age Rating
            <span class="field-value-badge">{{ maxAgeRating }}</span>
          </label>
          <p class="field-hint">Content rated above this age will be hidden (0 = no restriction, 18 = all content).</p>
          <input
            id="max-age-rating"
            class="text-input"
            type="number"
            min="0"
            max="18"
            v-model.number="maxAgeRating"
            @change="onMaxAgeRatingChange"
          />
        </div>
      </div>

      <!-- ================================================ -->
      <!-- 3. Playback -->
      <!-- ================================================ -->
      <div class="settings-section">
        <h2 class="section-heading">Playback</h2>

        <div class="field-group">
          <label for="player-source" class="field-label">Player Source</label>
          <select
            id="player-source"
            class="select-input"
            v-model="playerSource"
            @change="onPlayerSourceChange"
          >
            <option
              v-for="src in PLAYER_SOURCES"
              :key="src.id"
              :value="src.id"
            >
              {{ src.label }}{{ src.supportsProgress ? ' (progress sync)' : '' }}
            </option>
          </select>
        </div>

        <div class="field-group">
          <label for="watched-threshold" class="field-label">
            Watched Threshold (minutes)
          </label>
          <p class="field-hint">Mark as watched after this many minutes of playback.</p>
          <input
            id="watched-threshold"
            class="text-input text-input--sm"
            type="number"
            min="1"
            max="60"
            v-model.number="watchedThreshold"
            @change="onWatchedThresholdChange"
          />
        </div>

        <div class="field-group">
          <label class="field-label">Intro Skip Mode</label>
          <div class="radio-group">
            <label class="radio-label">
              <input
                type="radio"
                name="intro-skip"
                value="off"
                v-model="introSkipMode"
                @change="onIntroSkipModeChange"
              />
              Off
            </label>
            <label class="radio-label">
              <input
                type="radio"
                name="intro-skip"
                value="auto"
                v-model="introSkipMode"
                @change="onIntroSkipModeChange"
              />
              Auto-skip
            </label>
            <label class="radio-label">
              <input
                type="radio"
                name="intro-skip"
                value="prompt"
                v-model="introSkipMode"
                @change="onIntroSkipModeChange"
              />
              Prompt me
            </label>
          </div>
        </div>
      </div>

      <!-- ================================================ -->
      <!-- 4. Interface -->
      <!-- ================================================ -->
      <div class="settings-section">
        <h2 class="section-heading">Interface</h2>

        <div class="field-group">
          <label class="field-label">Accent Color</label>
          <div class="swatch-row" role="radiogroup" aria-label="Accent color">
            <button
              v-for="preset in ACCENT_PRESETS"
              :key="preset.id"
              class="swatch-btn"
              :class="{ 'swatch-btn--active': accentColor === preset.id }"
              :style="{ background: preset.color }"
              :aria-label="preset.label"
              :aria-pressed="accentColor === preset.id"
              :title="preset.label"
              @click="selectAccent(preset.id)"
            >
              <span v-if="accentColor === preset.id" class="swatch-check">&#10003;</span>
            </button>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Font Size</label>
          <div class="segmented-control">
            <button
              v-for="sz in ['small', 'normal', 'large'] as const"
              :key="sz"
              class="segment-btn"
              :class="{ 'segment-btn--active': fontSize === sz }"
              @click="() => { fontSize = sz; onFontSizeChange() }"
            >
              {{ sz.charAt(0).toUpperCase() + sz.slice(1) }}
            </button>
          </div>
        </div>

        <div class="field-group">
          <div class="toggle-row">
            <div>
              <span class="field-label">Compact Mode</span>
              <p class="field-hint">Reduce padding and spacing throughout the app.</p>
            </div>
            <button
              role="switch"
              :aria-checked="compactMode"
              class="toggle-switch"
              :class="{ 'toggle-switch--on': compactMode }"
              @click="() => { compactMode = !compactMode; onCompactModeChange() }"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>

        <div class="field-group">
          <div class="toggle-row">
            <div>
              <span class="field-label">Reduce Animations</span>
              <p class="field-hint">Minimize motion for accessibility or performance.</p>
            </div>
            <button
              role="switch"
              :aria-checked="reduceAnimations"
              class="toggle-switch"
              :class="{ 'toggle-switch--on': reduceAnimations }"
              @click="() => { reduceAnimations = !reduceAnimations; onReduceAnimationsChange() }"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- ================================================ -->
      <!-- 5. Home Layout -->
      <!-- ================================================ -->
      <div class="settings-section">
        <h2 class="section-heading">Home Layout</h2>
        <p class="field-hint">Drag rows to reorder. Toggle visibility with the eye button.</p>

        <ul class="layout-rows" role="list">
          <li
            v-for="(row, idx) in homeRows"
            :key="row.id"
            class="layout-row"
            :class="{ 'layout-row--dragging': dragIndex === idx, 'layout-row--hidden': !row.visible }"
            draggable="true"
            @dragstart="onDragStart(idx)"
            @dragover="onDragOver($event, idx)"
            @dragend="onDragEnd"
          >
            <span class="drag-handle" aria-hidden="true">&#8942;&#8942;</span>
            <span class="row-label">{{ row.label }}</span>
            <button
              class="icon-btn"
              :aria-label="row.visible ? `Hide ${row.label}` : `Show ${row.label}`"
              :title="row.visible ? 'Hide row' : 'Show row'"
              @click="toggleRowVisibility(idx)"
            >
              <!-- Eye open -->
              <svg v-if="row.visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <!-- Eye closed -->
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </button>
          </li>
        </ul>

        <div class="field-group" style="margin-top: 1.5rem;">
          <label class="field-label">Default View Mode</label>
          <div class="segmented-control">
            <button
              class="segment-btn"
              :class="{ 'segment-btn--active': viewMode === 'carousel' }"
              @click="() => { viewMode = 'carousel'; onViewModeChange() }"
            >
              Carousel
            </button>
            <button
              class="segment-btn"
              :class="{ 'segment-btn--active': viewMode === 'list' }"
              @click="() => { viewMode = 'list'; onViewModeChange() }"
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      <!-- ================================================ -->
      <!-- 6. Library & Privacy -->
      <!-- ================================================ -->
      <div class="settings-section">
        <h2 class="section-heading">Library &amp; Privacy</h2>

        <div class="field-group">
          <label for="watchlist-sort" class="field-label">Default Watchlist Sort</label>
          <select
            id="watchlist-sort"
            class="select-input"
            v-model="watchlistSort"
            @change="onWatchlistSortChange"
          >
            <option value="manual">Custom Order</option>
            <option value="title">Title A–Z</option>
            <option value="rating">Highest Rated</option>
            <option value="year">Newest First</option>
          </select>
        </div>

        <div class="field-group">
          <div class="toggle-row">
            <div>
              <span class="field-label">Record Watch History</span>
              <p class="field-hint">Track what you watch for history and continue-watching.</p>
            </div>
            <button
              role="switch"
              :aria-checked="recordHistory"
              class="toggle-switch"
              :class="{ 'toggle-switch--on': recordHistory }"
              @click="() => { recordHistory = !recordHistory; onRecordHistoryChange() }"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- ================================================ -->
      <!-- 7. Backup & Restore -->
      <!-- ================================================ -->
      <div class="settings-section">
        <h2 class="section-heading">Backup &amp; Restore</h2>
        <p class="field-hint">Export or import your watchlist, history, progress, and settings.</p>

        <div class="btn-row">
          <button class="btn btn-primary" @click="doExport">
            Export Backup
          </button>
          <button class="btn btn-secondary" @click="triggerImport">
            Import Backup
          </button>
          <input
            ref="importFileInput"
            type="file"
            accept="application/json,.json"
            style="display: none"
            @change="onImportFile"
          />
        </div>
      </div>

      <!-- ================================================ -->
      <!-- 8. Storage -->
      <!-- ================================================ -->
      <div class="settings-section">
        <h2 class="section-heading">Storage</h2>

        <div class="storage-actions">
          <div class="storage-action-item">
            <div>
              <span class="field-label">Clear App Caches</span>
              <p class="field-hint">Remove trending, AniList, and episode group caches. Fresh data will be fetched on next visit.</p>
            </div>
            <button class="btn btn-secondary" @click="doClearCaches">Clear Cache</button>
          </div>

          <div class="storage-action-item">
            <div>
              <span class="field-label">Reset Watch Progress</span>
              <p class="field-hint">Delete all saved playback positions and watched markers. This cannot be undone.</p>
            </div>
            <button class="btn btn-danger" @click="doResetProgress">Reset Progress</button>
          </div>
        </div>
      </div>

    </div><!-- /.settings-columns -->
  </div>
</template>

<style scoped>
/* ============================================================
   Page shell
   ============================================================ */
.settings-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
  padding: 2rem 1.5rem;
  max-width: 860px;
  margin: 0 auto;
  position: relative;
}

.settings-header {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.page-subtitle {
  color: #888;
  margin: 0;
  font-size: 0.95rem;
}

/* ============================================================
   Sections
   ============================================================ */
.settings-columns {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  background: #161616;
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
}

.section-heading {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #2a2a2a;
}

/* ============================================================
   Field groups
   ============================================================ */
.field-group {
  margin-bottom: 1.25rem;
}

.field-group:last-child {
  margin-bottom: 0;
}

.field-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #ddd;
  margin-bottom: 0.4rem;
}

.field-hint {
  font-size: 0.8rem;
  color: #777;
  margin: 0.25rem 0 0.5rem;
  line-height: 1.4;
}

.field-hint a {
  color: var(--accent, #e50914);
  text-decoration: none;
}

.field-hint a:hover {
  text-decoration: underline;
}

.field-value-badge {
  font-size: 0.8rem;
  background: var(--accent-dim, rgba(229, 9, 20, 0.15));
  color: var(--accent, #e50914);
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 0.5rem;
  font-weight: 700;
}

/* ============================================================
   Inputs
   ============================================================ */
.text-input {
  width: 100%;
  box-sizing: border-box;
  background: #0f0f0f;
  border: 1px solid #333;
  color: #fff;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: border-color 0.15s;
}

.text-input:focus {
  outline: none;
  border-color: var(--accent, #e50914);
}

.text-input--sm {
  width: 120px;
}

.select-input {
  width: 100%;
  box-sizing: border-box;
  background: #0f0f0f;
  border: 1px solid #333;
  color: #fff;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s;
}

.select-input:focus {
  outline: none;
  border-color: var(--accent, #e50914);
}

.input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.input-row .text-input {
  flex: 1;
}

/* ============================================================
   Buttons
   ============================================================ */
.btn {
  padding: 0.5rem 1.1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s, transform 0.15s;
  white-space: nowrap;
}

.btn:hover:not(:disabled) {
  opacity: 0.85;
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent, #e50914);
  color: #fff;
}

.btn-secondary {
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #3a3a3a;
}

.btn-danger {
  background: #7f1d1d;
  color: #fca5a5;
  border: 1px solid #991b1b;
}

.btn-danger:hover {
  background: #991b1b;
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-top: 0.75rem;
}

/* ============================================================
   Icon button (small square)
   ============================================================ */
.icon-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

.icon-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

/* ============================================================
   Validation message
   ============================================================ */
.validation-msg {
  font-size: 0.82rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
}

.validation-msg--ok {
  background: rgba(5, 150, 105, 0.15);
  color: #34d399;
}

.validation-msg--err {
  background: rgba(229, 9, 20, 0.12);
  color: #f87171;
}

/* ============================================================
   Radio group
   ============================================================ */
.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-top: 0.25rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: #ccc;
  cursor: pointer;
}

.radio-label input[type='radio'] {
  accent-color: var(--accent, #e50914);
  cursor: pointer;
}

/* ============================================================
   Accent swatches
   ============================================================ */
.swatch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.25rem;
}

.swatch-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, transform 0.15s;
}

.swatch-btn:hover {
  transform: scale(1.1);
}

.swatch-btn--active {
  border-color: #fff;
  transform: scale(1.1);
}

.swatch-check {
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

/* ============================================================
   Segmented control
   ============================================================ */
.segmented-control {
  display: inline-flex;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
  margin-top: 0.25rem;
}

.segment-btn {
  background: none;
  border: none;
  color: #888;
  padding: 0.45rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.segment-btn + .segment-btn {
  border-left: 1px solid #333;
}

.segment-btn--active {
  background: var(--accent, #e50914);
  color: #fff;
  font-weight: 600;
}

.segment-btn:not(.segment-btn--active):hover {
  background: #1e1e1e;
  color: #ddd;
}

/* ============================================================
   Toggle switch
   ============================================================ */
.toggle-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
}

.toggle-switch {
  flex-shrink: 0;
  position: relative;
  width: 44px;
  height: 24px;
  background: #333;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.25s;
  padding: 0;
}

.toggle-switch--on {
  background: var(--accent, #e50914);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: left 0.25s;
  pointer-events: none;
}

.toggle-switch--on .toggle-thumb {
  left: 23px;
}

/* ============================================================
   Home layout rows
   ============================================================ */
.layout-rows {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.layout-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #1e1e1e;
  border: 1px solid #2e2e2e;
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  cursor: grab;
  transition: background 0.15s, opacity 0.15s;
  user-select: none;
}

.layout-row:active {
  cursor: grabbing;
}

.layout-row--dragging {
  background: #252525;
  border-color: var(--accent, #e50914);
  opacity: 0.85;
}

.layout-row--hidden .row-label {
  color: #555;
  text-decoration: line-through;
}

.drag-handle {
  color: #555;
  font-size: 0.75rem;
  letter-spacing: -2px;
  flex-shrink: 0;
}

.row-label {
  flex: 1;
  font-size: 0.875rem;
  color: #ccc;
}

/* ============================================================
   Storage actions
   ============================================================ */
.storage-actions {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.storage-action-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
}

.storage-action-item .field-label {
  margin-bottom: 0.2rem;
}

.storage-action-item .field-hint {
  margin: 0;
}

/* ============================================================
   Toast
   ============================================================ */
.toast-notification {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: #1e1e1e;
  border: 1px solid #333;
  color: #fff;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  z-index: 9999;
  white-space: nowrap;
  pointer-events: none;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

/* ============================================================
   Responsive
   ============================================================ */
@media (max-width: 768px) {
  .settings-page {
    padding: 1.25rem 1rem;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .storage-action-item {
    flex-direction: column;
    gap: 0.75rem;
  }

  .storage-action-item .btn {
    align-self: flex-start;
  }

  .toggle-row {
    gap: 1rem;
  }

  .btn-row {
    gap: 0.5rem;
  }
}
</style>
