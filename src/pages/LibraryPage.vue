<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLibrary } from '../composables/useLibrary'
import { imgUrl } from '../utils/api'
import { storage, STORAGE_KEYS } from '../utils/storage'
import type { MediaItem, HistoryEntry, WatchProgress } from '../types'

const {
  saved,
  history,
  inProgress,
  progress,
  watched,
  isSaved,
  removeItem,
  markWatched,
  markUnwatched,
  isWatched,
  clearHistory,
  clearProgress,
  loadLibrary,
} = useLibrary()

const router = useRouter()
const sort = ref<string>('manual')

const isEmpty = computed(
  () => saved.value.length === 0 && history.value.length === 0 && inProgress.value.length === 0,
)

const sortedSaved = computed<MediaItem[]>(() => {
  const arr = [...saved.value]
  switch (sort.value) {
    case 'title':
      return arr.sort((a, b) => {
        const ta = (a.title ?? a.name ?? '').toLowerCase()
        const tb = (b.title ?? b.name ?? '').toLowerCase()
        return ta.localeCompare(tb)
      })
    case 'rating':
      return arr.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    case 'year':
      return arr.sort((a, b) => {
        const ya = (a.release_date ?? a.first_air_date ?? '0000').slice(0, 4)
        const yb = (b.release_date ?? b.first_air_date ?? '0000').slice(0, 4)
        return yb.localeCompare(ya)
      })
    case 'manual':
    default:
      return arr
  }
})

function navigate(item: MediaItem) {
  const type = item.media_type ?? 'movie'
  if (type === 'tv') {
    router.push(`/tv/${item.id}`)
  } else {
    router.push(`/movie/${item.id}`)
  }
}

function progressPct(item: MediaItem): number {
  const key = `${item.media_type ?? 'movie'}_${item.id}`
  return progress.value[key]?.pct ?? 0
}

function historyProgressPct(entry: HistoryEntry): number {
  const key = entry.episodeKey
    ? `tv_${entry.item.id}_${entry.episodeKey}`
    : `${entry.item.media_type ?? 'movie'}_${entry.item.id}`
  return progress.value[key]?.pct ?? 0
}

function removeHistoryEntry(entry: HistoryEntry) {
  history.value = history.value.filter(
    (h) => !(h.item.id === entry.item.id && h.episodeKey === entry.episodeKey && h.watchedAt === entry.watchedAt),
  )
  storage.set(STORAGE_KEYS.HISTORY, history.value)
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function onSortChange(e: Event) {
  sort.value = (e.target as HTMLSelectElement).value
  storage.set(STORAGE_KEYS.WATCHLIST_SORT, sort.value)
}

function confirmClearHistory() {
  if (confirm('Clear all watch history? This cannot be undone.')) {
    clearHistory()
  }
}

function confirmClearProgress() {
  if (confirm('Reset all watch progress? This cannot be undone.')) {
    clearProgress()
  }
}

onMounted(() => {
  loadLibrary()
  sort.value = storage.get<string>(STORAGE_KEYS.WATCHLIST_SORT, 'manual') ?? 'manual'
})
</script>

<template>
  <div class="library-page">
    <!-- Header -->
    <div class="library-header">
      <h1 class="library-title">My Library</h1>
      <p class="library-subtitle">Your watchlist, history, and progress in one place.</p>
    </div>

    <!-- Empty state -->
    <div v-if="isEmpty" class="empty-state" aria-label="Empty library">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p class="empty-text">Start watching to build your library</p>
      <p class="empty-subtext">Items you save and shows you watch will appear here.</p>
    </div>

    <template v-else>
      <!-- Continue Watching -->
      <section v-if="inProgress.length > 0" class="library-section">
        <h2 class="section-title">Continue Watching</h2>
        <div class="cards-grid">
          <div
            v-for="item in inProgress"
            :key="`${item.media_type}_${item.id}`"
            class="continue-card"
            @click="navigate(item)"
          >
            <div class="card-thumb">
              <img
                v-if="item.poster_path"
                :src="imgUrl(item.poster_path, 'w300')"
                :alt="item.title ?? item.name ?? ''"
                loading="lazy"
              />
              <div v-else class="card-thumb-placeholder">
                <span>No Image</span>
              </div>
              <div class="progress-bar-wrap">
                <div
                  class="progress-bar-fill"
                  :style="{ width: progressPct(item) + '%' }"
                ></div>
              </div>
            </div>
            <div class="card-info">
              <span class="card-title">{{ item.title ?? item.name }}</span>
              <span class="card-meta">{{ progressPct(item).toFixed(0) }}% watched</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Watchlist -->
      <section v-if="saved.length > 0" class="library-section">
        <div class="section-header-row">
          <h2 class="section-title">My Watchlist</h2>
          <div class="sort-control">
            <label for="watchlist-sort" class="sort-label">Sort:</label>
            <select
              id="watchlist-sort"
              class="sort-select"
              :value="sort"
              @change="onSortChange"
            >
              <option value="manual">Custom Order</option>
              <option value="title">Title A–Z</option>
              <option value="rating">Highest Rated</option>
              <option value="year">Newest First</option>
            </select>
          </div>
        </div>
        <div class="cards-grid">
          <div
            v-for="item in sortedSaved"
            :key="`${item.media_type}_${item.id}`"
            class="watchlist-card"
          >
            <div class="card-thumb" @click="navigate(item)">
              <img
                v-if="item.poster_path"
                :src="imgUrl(item.poster_path, 'w300')"
                :alt="item.title ?? item.name ?? ''"
                loading="lazy"
              />
              <div v-else class="card-thumb-placeholder">
                <span>No Image</span>
              </div>
              <span v-if="item.media_type" class="media-badge">
                {{ item.media_type === 'tv' ? 'TV' : 'Movie' }}
              </span>
            </div>
            <div class="card-info">
              <span class="card-title">{{ item.title ?? item.name }}</span>
              <span v-if="item.vote_average" class="card-rating">
                &#9733; {{ item.vote_average.toFixed(1) }}
              </span>
              <button
                class="remove-btn"
                :aria-label="`Remove ${item.title ?? item.name} from watchlist`"
                @click="removeItem(item.id, item.media_type ?? 'movie')"
              >
                &times; Remove
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Watch History -->
      <section v-if="history.length > 0" class="library-section">
        <div class="section-header-row">
          <h2 class="section-title">Watch History</h2>
          <button class="text-btn danger-btn" @click="confirmClearHistory">Clear All</button>
        </div>
        <ul class="history-list">
          <li
            v-for="(entry, idx) in history"
            :key="`${entry.item.id}_${entry.episodeKey ?? ''}_${entry.watchedAt}`"
            class="history-item"
          >
            <div class="history-thumb" @click="navigate(entry.item)">
              <img
                v-if="entry.item.poster_path"
                :src="imgUrl(entry.item.poster_path, 'w92')"
                :alt="entry.item.title ?? entry.item.name ?? ''"
                loading="lazy"
              />
              <div v-else class="history-thumb-placeholder"></div>
            </div>
            <div class="history-info" @click="navigate(entry.item)">
              <span class="history-title">{{ entry.item.title ?? entry.item.name }}</span>
              <span v-if="entry.episodeKey" class="history-episode">
                {{ entry.episodeName ? `${entry.episodeKey.toUpperCase()} – ${entry.episodeName}` : entry.episodeKey.toUpperCase() }}
              </span>
              <span class="history-date">{{ formatDate(entry.watchedAt) }}</span>
            </div>
            <span v-if="entry.item.media_type" class="media-badge media-badge--sm">
              {{ entry.item.media_type === 'tv' ? 'TV' : 'Movie' }}
            </span>
            <button
              class="remove-btn remove-btn--icon"
              :aria-label="`Remove from history`"
              @click="removeHistoryEntry(entry)"
            >
              &times;
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.library-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
  padding: 2rem 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* ---- Header ---- */
.library-header {
  margin-bottom: 2rem;
}

.library-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.library-subtitle {
  color: #888;
  margin: 0;
  font-size: 0.95rem;
}

/* ---- Empty state ---- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 2rem;
  text-align: center;
  color: #666;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 1rem;
  color: #555;
}

.empty-text {
  font-size: 1.2rem;
  font-weight: 600;
  color: #bbb;
  margin: 0 0 0.5rem;
}

.empty-subtext {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
}

/* ---- Sections ---- */
.library-section {
  margin-bottom: 3rem;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
  color: #fff;
}

/* ---- Sort control ---- */
.sort-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-label {
  font-size: 0.85rem;
  color: #aaa;
}

.sort-select {
  background: #1e1e1e;
  border: 1px solid #333;
  color: #fff;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
}

.sort-select:focus {
  outline: 2px solid var(--accent, #e50914);
  outline-offset: 1px;
}

/* ---- Cards grid ---- */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

/* ---- Continue watching card ---- */
.continue-card {
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  background: #161616;
  transition: transform 0.2s;
}

.continue-card:hover {
  transform: translateY(-3px);
}

.watchlist-card {
  border-radius: 6px;
  overflow: hidden;
  background: #161616;
  transition: transform 0.2s;
}

.watchlist-card:hover {
  transform: translateY(-3px);
}

.card-thumb {
  position: relative;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  cursor: pointer;
}

.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  font-size: 0.75rem;
}

.media-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.media-badge--sm {
  position: static;
  flex-shrink: 0;
  align-self: center;
  background: #2a2a2a;
}

/* ---- Progress bar ---- */
.progress-bar-wrap {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent, #e50914);
  transition: width 0.3s;
}

/* ---- Card info ---- */
.card-info {
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.card-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  font-size: 0.75rem;
  color: #888;
}

.card-rating {
  font-size: 0.75rem;
  color: #f5c518;
}

/* ---- Remove button ---- */
.remove-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 2px 0;
  text-align: left;
  transition: color 0.15s;
}

.remove-btn:hover {
  color: var(--accent, #e50914);
}

.remove-btn--icon {
  font-size: 1.1rem;
  padding: 0 0.5rem;
  flex-shrink: 0;
  align-self: center;
}

/* ---- History list ---- */
.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #161616;
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  cursor: default;
  transition: background 0.15s;
}

.history-item:hover {
  background: #1f1f1f;
}

.history-thumb {
  flex-shrink: 0;
  width: 48px;
  height: 72px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}

.history-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.history-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: #2a2a2a;
}

.history-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  cursor: pointer;
}

.history-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-episode {
  font-size: 0.8rem;
  color: #aaa;
}

.history-date {
  font-size: 0.75rem;
  color: #666;
}

/* ---- Utility buttons ---- */
.text-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.danger-btn {
  color: #f87171;
}

.danger-btn:hover {
  background: rgba(248, 113, 113, 0.1);
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .library-page {
    padding: 1.5rem 1rem;
  }

  .library-title {
    font-size: 1.5rem;
  }

  .cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .history-item {
    gap: 0.75rem;
  }

  .section-header-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
