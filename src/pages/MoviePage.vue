<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettings } from '../composables/useSettings'
import { useLibrary } from '../composables/useLibrary'
import { tmdbFetch, imgUrl, PLAYER_SOURCES, getSourceUrl } from '../utils/api'
import { fetchMovieRating, isRestricted } from '../utils/ageRating'
import type { MovieDetails, Collection, RatingInfo, WatchProgress, MediaItem } from '../types'

const route = useRoute()
const router = useRouter()
const { settings } = useSettings()
const {
  isSaved,
  saveItem,
  removeItem,
  progress,
  saveProgress,
  watched,
  markWatched,
  markUnwatched,
  addHistory,
  loadLibrary,
  getProgress,
  isWatched,
} = useLibrary()

const id = computed(() => Number(route.params.id))

const details = ref<MovieDetails | null>(null)
const trailerKey = ref<string | null>(null)
const collection = ref<Collection | null>(null)
const playing = ref<boolean>(false)
const playerSource = ref<string>(settings.value.playerSource)
const ratingInfo = ref<RatingInfo | null>(null)
const loading = ref<boolean>(true)
const playerLoading = ref<boolean>(true)
const showTrailer = ref<boolean>(false)
const currentProgress = ref<WatchProgress | null>(null)

const playerUrl = computed(() => {
  return getSourceUrl(playerSource.value, 'movie', id.value)
})

const iframeSandbox = computed(() => {
  const src = PLAYER_SOURCES.find((s) => s.id === playerSource.value)
  return src?.sandboxed
    ? 'allow-scripts allow-same-origin allow-forms allow-presentation allow-top-navigation-by-user-activation'
    : undefined
})

const progressKey = computed(() => `movie_${id.value}`)

const savedStatus = computed(() => isSaved(id.value, 'movie'))

const movieWatched = computed(() => isWatched(progressKey.value))

const ratingRestricted = computed(() => {
  if (!ratingInfo.value) return false
  return isRestricted(ratingInfo.value.minAge, settings.value.maxAgeRating)
})

const releaseYear = computed(() => {
  if (!details.value?.release_date) return ''
  return details.value.release_date.slice(0, 4)
})

const formattedRuntime = computed(() => {
  if (!details.value?.runtime) return ''
  const h = Math.floor(details.value.runtime / 60)
  const m = details.value.runtime % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
})

const ratingStars = computed(() => {
  if (!details.value) return []
  const score = details.value.vote_average / 2 // 0-10 -> 0-5
  return Array.from({ length: 5 }, (_, i) => {
    const val = i + 1
    if (score >= val) return 'full'
    if (score >= val - 0.5) return 'half'
    return 'empty'
  })
})

const backdropStyle = computed(() => {
  if (!details.value?.backdrop_path) return {}
  return {
    backgroundImage: `url(${imgUrl(details.value.backdrop_path, 'original')})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center top',
  }
})

let progressInterval: ReturnType<typeof setInterval> | null = null

function startProgressTracking() {
  if (progressInterval) return
  progressInterval = setInterval(() => {
    if (!playing.value) return
    const key = progressKey.value
    const existing = getProgress(key) ?? { watched: 0, duration: details.value?.runtime ? details.value.runtime * 60 : 7200, pct: 0, updatedAt: Date.now() }
    const newWatched = existing.watched + 5
    const duration = existing.duration || 7200
    const pct = Math.min(100, Math.round((newWatched / duration) * 100))
    const updated: WatchProgress = { watched: newWatched, duration, pct, updatedAt: Date.now() }
    saveProgress(key, updated)
    currentProgress.value = updated

    if (pct >= settings.value.watchedThreshold * 10 && !movieWatched.value) {
      // auto-mark once threshold crossed — left to user interaction
    }
  }, 5000)
}

function stopProgressTracking() {
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
}

function onIframeLoad() {
  playerLoading.value = false
}

function markQuick(pct: number) {
  const duration = details.value?.runtime ? details.value.runtime * 60 : 7200
  const newWatched = Math.round((pct / 100) * duration)
  const updated: WatchProgress = { watched: newWatched, duration, pct, updatedAt: Date.now() }
  saveProgress(progressKey.value, updated)
  currentProgress.value = updated
}

function toggleWatched() {
  if (movieWatched.value) {
    markUnwatched(progressKey.value)
  } else {
    markWatched(progressKey.value)
    markQuick(100)
  }
}

function toggleSave() {
  if (!details.value) return
  if (savedStatus.value) {
    removeItem(id.value, 'movie')
  } else {
    const item: MediaItem = {
      id: details.value.id,
      title: details.value.title,
      poster_path: details.value.poster_path,
      backdrop_path: details.value.backdrop_path,
      overview: details.value.overview,
      vote_average: details.value.vote_average,
      release_date: details.value.release_date,
      media_type: 'movie',
      genre_ids: details.value.genres?.map((g) => g.id),
      original_language: (details.value as any).original_language,
    }
    saveItem(item)
  }
}

function startPlaying() {
  playing.value = true
  playerLoading.value = true
  startProgressTracking()
}

async function fetchDetails() {
  loading.value = true
  playing.value = false
  playerLoading.value = true
  stopProgressTracking()
  details.value = null
  trailerKey.value = null
  collection.value = null
  ratingInfo.value = null

  try {
    const data = await tmdbFetch<MovieDetails>(
      `/movie/${id.value}?append_to_response=videos`,
      settings.value.apiKey,
    )
    details.value = data

    // Trailer
    const videos = data.videos?.results ?? []
    const trailer =
      videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ??
      videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
      videos.find((v) => v.site === 'YouTube')
    trailerKey.value = trailer?.key ?? null

    // Collection
    if (data.belongs_to_collection) {
      try {
        const col = await tmdbFetch<Collection>(
          `/collection/${data.belongs_to_collection.id}`,
          settings.value.apiKey,
        )
        collection.value = col
      } catch {
        // collection fetch failed, ignore
      }
    }

    // Age rating
    ratingInfo.value = await fetchMovieRating(id.value, settings.value.apiKey)

    // Load existing progress
    loadLibrary()
    currentProgress.value = getProgress(progressKey.value) ?? null

    // Add to history
    if (settings.value.recordHistory) {
      const item: MediaItem = {
        id: data.id,
        title: data.title,
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path,
        overview: data.overview,
        vote_average: data.vote_average,
        release_date: data.release_date,
        media_type: 'movie',
        genre_ids: data.genres?.map((g) => g.id),
      }
      addHistory({ item, watchedAt: Date.now() })
    }
  } catch (err) {
    console.error('Failed to fetch movie details:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadLibrary()
  fetchDetails()
})

onUnmounted(() => {
  stopProgressTracking()
})

watch(id, (newId, oldId) => {
  if (newId !== oldId) {
    fetchDetails()
  }
})

watch(playing, (val) => {
  if (val) {
    startProgressTracking()
  } else {
    stopProgressTracking()
  }
})
</script>

<template>
  <div class="movie-page">
    <!-- Loading spinner -->
    <div v-if="loading" class="loading-screen">
      <div class="spinner"></div>
    </div>

    <template v-else-if="details">
      <!-- Spotlight / banner section -->
      <div class="spotlight-section" :style="backdropStyle">
        <div class="spotlight-section__overlay-left"></div>
        <div class="spotlight-section__overlay-bottom"></div>
        <div class="spotlight-layout">
          <img
            v-if="details.poster_path"
            class="poster"
            :src="imgUrl(details.poster_path, 'w300')"
            :alt="details.title"
          />
          <div class="spotlight-content">
            <h1 class="movie-title">{{ details.title }}</h1>
            <p v-if="details.tagline" class="tagline">{{ details.tagline }}</p>

            <!-- Meta row -->
            <div class="meta-row">
              <span v-if="releaseYear" class="meta-item">{{ releaseYear }}</span>
              <span v-if="formattedRuntime" class="meta-item">{{ formattedRuntime }}</span>
              <span v-if="details.genres?.length" class="meta-item genres">
                {{ details.genres.map((g) => g.name).join(' · ') }}
              </span>
            </div>

            <!-- Star rating -->
            <div class="stars-row">
              <span
                v-for="(star, i) in ratingStars"
                :key="i"
                class="star"
                :class="star"
              >
                <template v-if="star === 'full'">★</template>
                <template v-else-if="star === 'half'">⯨</template>
                <template v-else>☆</template>
              </span>
              <span class="score-text">{{ details.vote_average.toFixed(1) }}</span>
            </div>

            <!-- Age rating badge -->
            <div v-if="ratingInfo?.certification" class="rating-badge-row">
              <span
                class="rating-badge"
                :class="{ restricted: ratingRestricted }"
              >{{ ratingInfo.certification }}</span>
              <span v-if="ratingRestricted" class="restricted-label">Age restricted</span>
            </div>

            <!-- Overview -->
            <p class="overview">{{ details.overview }}</p>

            <!-- Action buttons -->
            <div class="action-row">
              <button class="btn btn-primary" @click="startPlaying">
                <span class="btn-icon">▶</span> Watch
              </button>
              <button
                v-if="trailerKey"
                class="btn btn-secondary"
                @click="showTrailer = true"
              >
                Trailer
              </button>
              <button
                class="btn btn-icon-only"
                :title="savedStatus ? 'Remove from library' : 'Save to library'"
                @click="toggleSave"
              >
                {{ savedStatus ? '🔖' : '🏷️' }}
              </button>
            </div>

            <!-- Source selector -->
            <div class="source-row">
              <label for="source-select" class="source-label">Source:</label>
              <select
                id="source-select"
                v-model="playerSource"
                class="source-select"
              >
                <option
                  v-for="src in PLAYER_SOURCES"
                  :key="src.id"
                  :value="src.id"
                >{{ src.label }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Player section -->
      <div v-if="playing" class="player-section">
        <div v-if="playerLoading" class="player-loading-overlay">
          <div class="spinner"></div>
        </div>
        <iframe
          v-if="playerUrl"
          :src="playerUrl"
          :sandbox="iframeSandbox"
          allowfullscreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          @load="onIframeLoad"
        ></iframe>
        <div v-else class="player-unavailable">
          <p>This source does not support movies. Please choose another.</p>
        </div>

        <!-- Progress bar -->
        <div class="progress-bar-wrap">
          <div
            class="progress-bar-fill"
            :style="{ width: `${currentProgress?.pct ?? 0}%` }"
          ></div>
        </div>

        <!-- Quick mark buttons -->
        <div class="quick-marks">
          <span class="quick-marks-label">Mark progress:</span>
          <button class="btn btn-xs" @click="markQuick(25)">25%</button>
          <button class="btn btn-xs" @click="markQuick(50)">50%</button>
          <button class="btn btn-xs" @click="markQuick(75)">75%</button>
          <button class="btn btn-xs btn-accent" @click="markQuick(100)">100%</button>
          <button
            class="btn btn-xs"
            :class="movieWatched ? 'btn-watched' : 'btn-outline'"
            @click="toggleWatched"
          >
            {{ movieWatched ? '✓ Watched' : 'Mark Watched' }}
          </button>
        </div>
      </div>

      <!-- Collection section -->
      <div v-if="collection && collection.parts && collection.parts.length > 1" class="collection-section">
        <h2 class="section-title">{{ collection.name }}</h2>
        <div class="collection-row">
          <media-card
            v-for="part in collection.parts"
            :key="part.id"
            :item="part"
            @click="router.push(`/movie/${part.id}`)"
          ></media-card>
        </div>
      </div>
    </template>

    <!-- Trailer modal -->
    <trailer-modal
      :open="showTrailer"
      :video-key="trailerKey"
      @close="showTrailer = false"
    ></trailer-modal>
  </div>
</template>

<style scoped>
.movie-page {
  background: #0d0d0d;
  min-height: 100vh;
  color: #fff;
}

/* ── Spotlight / banner ── */
.spotlight-section {
  position: relative;
  min-height: 500px;
  display: flex;
  align-items: flex-end;
  padding: 2rem;
  background-color: #111;
}

.spotlight-section__overlay-left {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%);
  z-index: 0;
}

.spotlight-section__overlay-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(to bottom, transparent, #0d0d0d);
  z-index: 0;
}

.spotlight-layout {
  display: flex;
  gap: 2rem;
  z-index: 1;
  position: relative;
  max-width: 1200px;
  width: 100%;
  align-items: flex-end;
  padding-bottom: 2rem;
}

.poster {
  width: 200px;
  border-radius: 8px;
  flex-shrink: 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

.spotlight-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.movie-title {
  font-size: 2.4rem;
  font-weight: 700;
  line-height: 1.1;
  margin: 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.tagline {
  font-style: italic;
  color: #aaa;
  margin: 0;
  font-size: 1rem;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.meta-item {
  font-size: 0.85rem;
  color: #ccc;
  background: rgba(255, 255, 255, 0.08);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.genres {
  background: transparent;
  padding: 0;
  color: #999;
}

.stars-row {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.star {
  font-size: 1rem;
  color: #888;
  line-height: 1;
}

.star.full {
  color: var(--accent, #e50914);
}

.star.half {
  color: var(--accent, #e50914);
}

.score-text {
  margin-left: 0.4rem;
  font-size: 0.85rem;
  color: #ccc;
}

.rating-badge-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rating-badge {
  display: inline-block;
  border: 1.5px solid #ccc;
  color: #ccc;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.rating-badge.restricted {
  border-color: #e53e3e;
  color: #e53e3e;
}

.restricted-label {
  font-size: 0.78rem;
  color: #e53e3e;
}

.overview {
  font-size: 0.95rem;
  line-height: 1.6;
  color: #ddd;
  margin: 0;
  max-width: 640px;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-top: 0.4rem;
}

.source-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.source-label {
  font-size: 0.82rem;
  color: #999;
}

.source-select {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.82rem;
  cursor: pointer;
}

.source-select option {
  background: #222;
  color: #fff;
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.2rem;
  border-radius: 6px;
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s, transform 0.1s;
}

.btn:active {
  transform: scale(0.97);
}

.btn-primary {
  background: var(--accent, #e50914);
  color: #fff;
}

.btn-primary:hover {
  filter: brightness(1.15);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.25);
}

.btn-outline {
  background: transparent;
  color: #ccc;
  border: 1px solid #555;
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn-accent {
  background: var(--accent, #e50914);
  color: #fff;
}

.btn-watched {
  background: #2f855a;
  color: #fff;
}

.btn-icon-only {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.5rem 0.65rem;
  font-size: 1rem;
  color: #fff;
  border-radius: 6px;
}

.btn-icon-only:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-xs {
  padding: 0.3rem 0.65rem;
  font-size: 0.78rem;
  border-radius: 4px;
  border: 1px solid #444;
  background: #1e1e1e;
  color: #ccc;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-xs:hover {
  background: #2a2a2a;
}

.btn-icon {
  font-size: 0.85rem;
}

/* ── Player ── */
.player-section {
  background: #000;
  position: relative;
  aspect-ratio: 16 / 9;
  max-height: 80vh;
  overflow: hidden;
}

.player-section iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.player-unavailable {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
}

.player-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.progress-bar-wrap {
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0.5rem 0 0;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent, #e50914);
  transition: width 0.3s ease;
}

.quick-marks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #111;
}

.quick-marks-label {
  font-size: 0.78rem;
  color: #888;
  margin-right: 0.25rem;
}

/* ── Collection ── */
.collection-section {
  padding: 2rem 1.5rem;
}

.section-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: #fff;
}

.collection-row {
  overflow-x: auto;
  display: flex;
  gap: 1rem;
  padding: 1rem 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.collection-row::-webkit-scrollbar {
  height: 4px;
}

.collection-row::-webkit-scrollbar-track {
  background: transparent;
}

.collection-row::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* ── Loading ── */
.loading-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d0d0d;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent, #e50914);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .poster {
    display: none;
  }

  .movie-title {
    font-size: 1.7rem;
  }

  .spotlight-section {
    padding: 1rem;
  }

  .spotlight-layout {
    padding-bottom: 1rem;
  }
}
</style>
