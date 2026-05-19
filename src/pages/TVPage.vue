<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettings } from '../composables/useSettings'
import { useLibrary } from '../composables/useLibrary'
import { tmdbFetch, imgUrl, PLAYER_SOURCES, isAnimeContent, getSourceUrl } from '../utils/api'
import { fetchTVRating, isRestricted } from '../utils/ageRating'
import type { TVDetails, SeasonDetails, Episode, RatingInfo, WatchProgress, MediaItem } from '../types'

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

const details = ref<TVDetails | null>(null)
const seasons = ref<SeasonDetails[]>([])
const selectedSeason = ref<number>(1)
const selectedEp = ref<Episode | null>(null)
const playing = ref<boolean>(false)
const playerSource = ref<string>(settings.value.playerSource)
const trailerKey = ref<string | null>(null)
const showTrailer = ref<boolean>(false)
const loading = ref<boolean>(true)
const loadingSeason = ref<boolean>(false)
const ratingInfo = ref<RatingInfo | null>(null)
const playerLoading = ref<boolean>(true)
const isAnime = ref<boolean>(false)
const currentProgress = ref<WatchProgress | null>(null)

function progressKey(ep: Episode): string {
  return `tv_${id.value}_s${ep.season_number}e${ep.episode_number}`
}

const playerUrl = computed(() => {
  if (!selectedEp.value) return null
  return getSourceUrl(
    playerSource.value,
    'tv',
    id.value,
    selectedEp.value.season_number,
    selectedEp.value.episode_number,
  )
})

const savedStatus = computed(() => isSaved(id.value, 'tv'))

const ratingRestricted = computed(() => {
  if (!ratingInfo.value) return false
  return isRestricted(ratingInfo.value.minAge, settings.value.maxAgeRating)
})

const releaseYear = computed(() => {
  if (!details.value?.first_air_date) return ''
  return details.value.first_air_date.slice(0, 4)
})

const ratingStars = computed(() => {
  if (!details.value) return []
  const score = details.value.vote_average / 2
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

/** Episodes for the currently selected season */
const currentSeasonEpisodes = computed<Episode[]>(() => {
  const s = seasons.value.find((s) => s.season_number === selectedSeason.value)
  return s?.episodes ?? []
})

function isEpWatched(ep: Episode): boolean {
  return isWatched(progressKey(ep))
}

function markEpWatched(ep: Episode) {
  markWatched(progressKey(ep))
}

function markEpUnwatched(ep: Episode) {
  markUnwatched(progressKey(ep))
}

function isSeasonWatched(seasonNum: number): boolean {
  const s = seasons.value.find((s) => s.season_number === seasonNum)
  if (!s || s.episodes.length === 0) return false
  return s.episodes.every((ep) => isWatched(progressKey(ep)))
}

function getEpProgress(ep: Episode): WatchProgress | null {
  return getProgress(progressKey(ep)) ?? null
}

function epProgressPct(ep: Episode): number {
  return getEpProgress(ep)?.pct ?? 0
}

let progressInterval: ReturnType<typeof setInterval> | null = null

function startProgressTracking() {
  if (progressInterval) return
  progressInterval = setInterval(() => {
    if (!playing.value || !selectedEp.value) return
    const ep = selectedEp.value
    const key = progressKey(ep)
    const existing = getProgress(key) ?? {
      watched: 0,
      duration: (ep.runtime ?? 24) * 60,
      pct: 0,
      updatedAt: Date.now(),
    }
    const newWatched = existing.watched + 5
    const duration = existing.duration || 1440
    const pct = Math.min(100, Math.round((newWatched / duration) * 100))
    const updated: WatchProgress = { watched: newWatched, duration, pct, updatedAt: Date.now() }
    saveProgress(key, updated)
    currentProgress.value = updated
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

function markEpQuick(ep: Episode, pct: number) {
  const duration = (ep.runtime ?? 24) * 60
  const newWatched = Math.round((pct / 100) * duration)
  const updated: WatchProgress = { watched: newWatched, duration, pct, updatedAt: Date.now() }
  saveProgress(progressKey(ep), updated)
  if (selectedEp.value?.id === ep.id) {
    currentProgress.value = updated
  }
}

function toggleEpWatched(ep: Episode) {
  if (isEpWatched(ep)) {
    markEpUnwatched(ep)
  } else {
    markEpWatched(ep)
    markEpQuick(ep, 100)
  }
}

function playEpisode(ep: Episode) {
  selectedEp.value = ep
  playing.value = true
  playerLoading.value = true
  currentProgress.value = getProgress(progressKey(ep)) ?? null
  stopProgressTracking()
  startProgressTracking()

  if (settings.value.recordHistory && details.value) {
    const item: MediaItem = {
      id: details.value.id,
      name: details.value.name,
      poster_path: details.value.poster_path,
      backdrop_path: details.value.backdrop_path,
      overview: details.value.overview,
      vote_average: details.value.vote_average,
      first_air_date: details.value.first_air_date,
      media_type: 'tv',
      genre_ids: details.value.genres?.map((g) => g.id),
    }
    addHistory({
      item,
      watchedAt: Date.now(),
      episodeKey: `s${ep.season_number}e${ep.episode_number}`,
      episodeName: ep.name,
    })
  }
}

function toggleSave() {
  if (!details.value) return
  if (savedStatus.value) {
    removeItem(id.value, 'tv')
  } else {
    const item: MediaItem = {
      id: details.value.id,
      name: details.value.name,
      poster_path: details.value.poster_path,
      backdrop_path: details.value.backdrop_path,
      overview: details.value.overview,
      vote_average: details.value.vote_average,
      first_air_date: details.value.first_air_date,
      media_type: 'tv',
      genre_ids: details.value.genres?.map((g) => g.id),
    }
    saveItem(item)
  }
}

async function selectSeason(n: number) {
  if (selectedSeason.value === n && seasons.value.find((s) => s.season_number === n)) return
  selectedSeason.value = n
  const alreadyLoaded = seasons.value.find((s) => s.season_number === n)
  if (alreadyLoaded) return

  loadingSeason.value = true
  try {
    const data = await tmdbFetch<SeasonDetails>(
      `/tv/${id.value}/season/${n}`,
      settings.value.apiKey,
    )
    seasons.value = [...seasons.value.filter((s) => s.season_number !== n), data]
  } catch (err) {
    console.error(`Failed to fetch season ${n}:`, err)
  } finally {
    loadingSeason.value = false
  }
}

async function fetchDetails() {
  loading.value = true
  playing.value = false
  playerLoading.value = true
  stopProgressTracking()
  details.value = null
  trailerKey.value = null
  seasons.value = []
  selectedEp.value = null
  ratingInfo.value = null
  isAnime.value = false

  try {
    const data = await tmdbFetch<TVDetails>(
      `/tv/${id.value}?append_to_response=videos`,
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

    // Anime detection
    const asMediaItem: MediaItem = {
      id: data.id,
      name: data.name,
      poster_path: data.poster_path,
      backdrop_path: data.backdrop_path,
      overview: data.overview,
      vote_average: data.vote_average,
      first_air_date: data.first_air_date,
      media_type: 'tv',
      genre_ids: data.genres?.map((g) => g.id),
      original_language: (data as any).original_language,
      origin_country: (data as any).origin_country,
    }
    isAnime.value = isAnimeContent(asMediaItem)

    // Rating
    ratingInfo.value = await fetchTVRating(id.value, settings.value.apiKey)

    // Load first valid season
    const firstSeason = data.seasons?.find((s) => s.season_number >= 1)
    if (firstSeason) {
      selectedSeason.value = firstSeason.season_number
      await selectSeason(firstSeason.season_number)
    }

    // Refresh library
    loadLibrary()

    // History
    if (settings.value.recordHistory) {
      const item: MediaItem = {
        id: data.id,
        name: data.name,
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path,
        overview: data.overview,
        vote_average: data.vote_average,
        first_air_date: data.first_air_date,
        media_type: 'tv',
        genre_ids: data.genres?.map((g) => g.id),
      }
      addHistory({ item, watchedAt: Date.now() })
    }
  } catch (err) {
    console.error('Failed to fetch TV details:', err)
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
  if (!val) stopProgressTracking()
})
</script>

<template>
  <div class="tv-page">
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
            :alt="details.name"
          />
          <div class="spotlight-content">
            <div class="title-row">
              <h1 class="show-title">{{ details.name }}</h1>
              <span v-if="isAnime" class="anime-badge">Anime</span>
            </div>
            <p v-if="details.tagline" class="tagline">{{ details.tagline }}</p>

            <!-- Meta -->
            <div class="meta-row">
              <span v-if="releaseYear" class="meta-item">{{ releaseYear }}</span>
              <span class="meta-item">{{ details.number_of_seasons }} season{{ details.number_of_seasons !== 1 ? 's' : '' }}</span>
              <span class="meta-item">{{ details.number_of_episodes }} episodes</span>
              <span v-if="details.genres?.length" class="meta-item genres">
                {{ details.genres.map((g) => g.name).join(' · ') }}
              </span>
            </div>

            <!-- Stars -->
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

            <!-- Actions -->
            <div class="action-row">
              <button
                class="btn btn-icon-only"
                :title="savedStatus ? 'Remove from library' : 'Save to library'"
                @click="toggleSave"
              >
                {{ savedStatus ? '🔖' : '🏷️' }}
              </button>
              <button
                v-if="trailerKey"
                class="btn btn-secondary"
                @click="showTrailer = true"
              >
                Trailer
              </button>
            </div>

            <!-- Source selector -->
            <div class="source-row">
              <label for="tv-source-select" class="source-label">Source:</label>
              <select
                id="tv-source-select"
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
      <div v-if="playing && selectedEp" class="player-section">
        <div v-if="playerLoading" class="player-loading-overlay">
          <div class="spinner"></div>
        </div>
        <iframe
          v-if="playerUrl"
          :src="playerUrl"
          allowfullscreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          @load="onIframeLoad"
        ></iframe>
        <div v-else class="player-unavailable">
          <p>This source is not available for this episode. Please choose another.</p>
        </div>

        <!-- Now playing label -->
        <div class="now-playing-label">
          <span>S{{ selectedEp.season_number }}E{{ selectedEp.episode_number }} — {{ selectedEp.name }}</span>
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
          <button class="btn btn-xs" @click="selectedEp && markEpQuick(selectedEp, 25)">25%</button>
          <button class="btn btn-xs" @click="selectedEp && markEpQuick(selectedEp, 50)">50%</button>
          <button class="btn btn-xs" @click="selectedEp && markEpQuick(selectedEp, 75)">75%</button>
          <button class="btn btn-xs btn-accent" @click="selectedEp && markEpQuick(selectedEp, 100)">100%</button>
          <button
            class="btn btn-xs"
            :class="selectedEp && isEpWatched(selectedEp) ? 'btn-watched' : 'btn-outline'"
            @click="selectedEp && toggleEpWatched(selectedEp)"
          >
            {{ selectedEp && isEpWatched(selectedEp) ? '✓ Watched' : 'Mark Watched' }}
          </button>
        </div>
      </div>

      <!-- Episodes section -->
      <div class="episodes-section">
        <!-- Season tabs -->
        <div class="season-tabs">
          <button
            v-for="season in details.seasons?.filter((s) => s.season_number >= 1)"
            :key="season.season_number"
            class="season-tab"
            :class="{ active: selectedSeason === season.season_number }"
            @click="selectSeason(season.season_number)"
          >
            {{ season.name }}
            <span v-if="isSeasonWatched(season.season_number)" class="season-check" title="All watched">✓</span>
          </button>
        </div>

        <!-- Season loading -->
        <div v-if="loadingSeason" class="season-loading">
          <div class="spinner spinner-sm"></div>
          <span>Loading episodes…</span>
        </div>

        <!-- Episodes grid -->
        <div v-else class="episodes-grid">
          <div
            v-for="ep in currentSeasonEpisodes"
            :key="ep.id"
            class="ep-card"
            :class="{ 'ep-card--watched': isEpWatched(ep), 'ep-card--playing': selectedEp?.id === ep.id && playing }"
            @click="playEpisode(ep)"
            @contextmenu.prevent="toggleEpWatched(ep)"
          >
            <!-- Still image -->
            <div class="ep-still-wrap">
              <img
                v-if="ep.still_path"
                class="ep-still"
                :src="imgUrl(ep.still_path, 'w300')"
                :alt="ep.name"
                loading="lazy"
              />
              <div v-else class="ep-still ep-still--placeholder">
                <span class="ep-still-num">{{ ep.episode_number }}</span>
              </div>
              <!-- Progress bar on still -->
              <div
                v-if="epProgressPct(ep) > 0 && epProgressPct(ep) < 100"
                class="ep-still-progress"
              >
                <div
                  class="ep-still-progress-fill"
                  :style="{ width: `${epProgressPct(ep)}%` }"
                ></div>
              </div>
              <!-- Watched badge -->
              <div v-if="isEpWatched(ep)" class="ep-watched-badge" title="Watched">✓</div>
              <!-- Playing indicator -->
              <div v-if="selectedEp?.id === ep.id && playing" class="ep-playing-badge">▶</div>
              <!-- Play overlay -->
              <div class="ep-play-overlay">
                <span class="ep-play-icon">▶</span>
              </div>
            </div>

            <div class="ep-info">
              <div class="ep-header">
                <span class="ep-number">E{{ ep.episode_number }}</span>
                <p class="ep-title">{{ ep.name }}</p>
              </div>
              <p class="ep-overview">{{ ep.overview || 'No description available.' }}</p>
              <div class="ep-meta">
                <span v-if="ep.runtime" class="ep-runtime">{{ ep.runtime }}m</span>
                <span v-if="ep.air_date" class="ep-airdate">{{ ep.air_date?.slice(0, 4) }}</span>
              </div>
            </div>
          </div>

          <p v-if="currentSeasonEpisodes.length === 0" class="no-episodes">
            No episodes found for this season.
          </p>
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
.tv-page {
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

.title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.show-title {
  font-size: 2.4rem;
  font-weight: 700;
  line-height: 1.1;
  margin: 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.anime-badge {
  display: inline-block;
  background: #7c3aed;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex-shrink: 0;
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

.now-playing-label {
  background: #111;
  padding: 0.4rem 1rem;
  font-size: 0.82rem;
  color: #aaa;
  border-bottom: 1px solid #222;
}

.progress-bar-wrap {
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0;
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

/* ── Episodes section ── */
.episodes-section {
  padding: 2rem;
}

.season-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.season-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  background: #1a1a1a;
  color: #bbb;
  border: 1px solid #333;
  transition: background 0.15s, color 0.15s;
}

.season-tab:hover {
  background: #252525;
  color: #fff;
}

.season-tab.active {
  background: var(--accent, #e50914);
  color: #fff;
  border-color: transparent;
}

.season-check {
  font-size: 0.72rem;
  color: #4ade80;
  font-weight: 700;
}

.season-tab.active .season-check {
  color: rgba(255, 255, 255, 0.85);
}

.season-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #888;
  padding: 2rem 0;
  font-size: 0.9rem;
}

.episodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.ep-card {
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
  border: 1px solid transparent;
}

.ep-card:hover {
  background: #222;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.ep-card--watched {
  opacity: 0.65;
}

.ep-card--watched:hover {
  opacity: 1;
}

.ep-card--playing {
  border-color: var(--accent, #e50914);
}

.ep-still-wrap {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #111;
}

.ep-still {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s;
}

.ep-card:hover .ep-still {
  transform: scale(1.04);
}

.ep-still--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e1e1e;
}

.ep-still-num {
  font-size: 2rem;
  font-weight: 700;
  color: #333;
}

.ep-still-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(0, 0, 0, 0.4);
}

.ep-still-progress-fill {
  height: 100%;
  background: var(--accent, #e50914);
}

.ep-watched-badge {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  background: #2f855a;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ep-playing-badge {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  background: var(--accent, #e50914);
  color: #fff;
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-weight: 700;
}

.ep-play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.ep-card:hover .ep-play-overlay {
  opacity: 1;
}

.ep-play-icon {
  font-size: 2rem;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.ep-info {
  padding: 0.75rem;
}

.ep-header {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}

.ep-number {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent, #e50914);
  flex-shrink: 0;
}

.ep-title {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  color: #eee;
}

.ep-overview {
  font-size: 0.8rem;
  color: #999;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin: 0 0 0.4rem;
  line-height: 1.4;
}

.ep-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.ep-runtime,
.ep-airdate {
  font-size: 0.72rem;
  color: #666;
}

.no-episodes {
  color: #666;
  font-size: 0.9rem;
  padding: 1rem 0;
  grid-column: 1 / -1;
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

.spinner-sm {
  width: 24px;
  height: 24px;
  border-width: 2px;
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

  .show-title {
    font-size: 1.7rem;
  }

  .spotlight-section {
    padding: 1rem;
  }

  .spotlight-layout {
    padding-bottom: 1rem;
  }

  .episodes-section {
    padding: 1rem;
  }

  .episodes-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
}
</style>
