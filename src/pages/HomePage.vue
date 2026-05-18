<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettings } from '../composables/useSettings'
import { useLibrary } from '../composables/useLibrary'
import { tmdbFetch, imgUrl, isAnimeContent } from '../utils/api'
import { loadHomeLayout, loadHomeViewMode } from '../utils/homeLayout'
import { storage, STORAGE_KEYS } from '../utils/storage'
import type { MediaItem, HomeRow } from '../types'

const { settings } = useSettings()
const {
  saved,
  history,
  progress,
  inProgress,
  isSaved,
  saveItem,
  removeItem,
  markWatched,
  markUnwatched,
  isWatched,
} = useLibrary()
const router = useRouter()

const trendingMovies = ref<MediaItem[]>([])
const trendingSeries = ref<MediaItem[]>([])
const topRated = ref<MediaItem[]>([])
const similarItems = ref<MediaItem[]>([])
const loading = ref(true)
const offline = ref(false)
const homeRows = ref<HomeRow[]>([])
const viewMode = ref<'carousel' | 'list'>('carousel')

const spotlightItem = computed<MediaItem | null>(() => trendingMovies.value[0] ?? null)

function navigate(item: MediaItem) {
  const type = item.media_type ?? 'movie'
  if (type === 'tv') {
    router.push(`/tv/${item.id}`)
  } else {
    router.push(`/movie/${item.id}`)
  }
}

function isWithin24Hours(dateStr: string | null): boolean {
  if (!dateStr) return false
  const then = new Date(dateStr).getTime()
  return Date.now() - then < 24 * 60 * 60 * 1000
}

async function fetchSimilar(item: MediaItem) {
  const type = item.media_type === 'tv' ? 'tv' : 'movie'
  try {
    const data = await tmdbFetch<{ results: MediaItem[] }>(
      `/${type}/${item.id}/similar?page=1`,
      settings.value.apiKey,
    )
    similarItems.value = (data.results ?? []).slice(0, 20).map((r) => ({
      ...r,
      media_type: type,
    }))
  } catch {
    similarItems.value = []
  }
}

async function loadTrending() {
  loading.value = true
  offline.value = false

  // Check 24h localStorage cache
  const cacheDate = storage.get<string>(STORAGE_KEYS.TRENDING_CACHE_DATE, null)
  const cache = storage.get<{
    movies: MediaItem[]
    series: MediaItem[]
    topRated: MediaItem[]
  }>(STORAGE_KEYS.TRENDING_CACHE, null)

  if (cache && isWithin24Hours(cacheDate ?? null)) {
    trendingMovies.value = cache.movies
    trendingSeries.value = cache.series
    topRated.value = cache.topRated
    loading.value = false

    // Still fetch similar based on last watched
    const lastWatched = history.value[0]?.item
    if (lastWatched) fetchSimilar(lastWatched)
    return
  }

  try {
    const [moviesData, seriesData, topMovies, topSeries] = await Promise.all([
      tmdbFetch<{ results: MediaItem[] }>('/trending/movie/week', settings.value.apiKey),
      tmdbFetch<{ results: MediaItem[] }>('/trending/tv/week', settings.value.apiKey),
      tmdbFetch<{ results: MediaItem[] }>('/movie/top_rated?page=1', settings.value.apiKey),
      tmdbFetch<{ results: MediaItem[] }>('/tv/top_rated?page=1', settings.value.apiKey),
    ])

    trendingMovies.value = (moviesData.results ?? []).map((r) => ({
      ...r,
      media_type: 'movie' as const,
    }))

    trendingSeries.value = (seriesData.results ?? []).map((r) => ({
      ...r,
      media_type: 'tv' as const,
    }))

    // Interleave top rated movies and series
    const topM = (topMovies.results ?? []).map((r) => ({ ...r, media_type: 'movie' as const }))
    const topS = (topSeries.results ?? []).map((r) => ({ ...r, media_type: 'tv' as const }))
    const interleaved: MediaItem[] = []
    const maxLen = Math.max(topM.length, topS.length)
    for (let i = 0; i < maxLen; i++) {
      if (topM[i]) interleaved.push(topM[i])
      if (topS[i]) interleaved.push(topS[i])
    }
    topRated.value = interleaved.slice(0, 40)

    // Persist to cache
    storage.set(STORAGE_KEYS.TRENDING_CACHE, {
      movies: trendingMovies.value,
      series: trendingSeries.value,
      topRated: topRated.value,
    })
    storage.set(STORAGE_KEYS.TRENDING_CACHE_DATE, new Date().toISOString())

    // Similar items based on last watched
    const lastWatched = history.value[0]?.item
    if (lastWatched) fetchSimilar(lastWatched)
  } catch (err) {
    offline.value = !navigator.onLine
    console.error('Failed to load trending:', err)
  } finally {
    loading.value = false
  }
}

function progressPct(item: MediaItem): number {
  const key = `${item.media_type ?? 'movie'}_${item.id}`
  return progress.value[key]?.pct ?? 0
}

onMounted(() => {
  homeRows.value = loadHomeLayout()
  viewMode.value = loadHomeViewMode()

  if (settings.value.apiKey) {
    loadTrending()
  } else {
    loading.value = false
  }
})
</script>

<template>
  <div class="home-page">
    <!-- No API Key: setup screen -->
    <template v-if="!settings.apiKey">
      <div class="setup-wrapper">
        <setup-screen @setup-complete="(key: string) => { settings.apiKey = key; loadTrending() }" />
      </div>
    </template>

    <!-- Loading -->
    <template v-else-if="loading">
      <div class="loading-center">
        <div class="spinner" aria-label="Loading…"></div>
      </div>
    </template>

    <!-- Offline banner -->
    <template v-else>
      <div v-if="offline" class="offline-banner" role="alert">
        <span>You appear to be offline. Showing cached content.</span>
      </div>

      <!-- Spotlight section -->
      <div v-if="spotlightItem" class="spotlight-section" aria-label="Featured title">
        <img
          v-if="spotlightItem.backdrop_path"
          class="backdrop"
          :src="imgUrl(spotlightItem.backdrop_path, 'original')"
          :alt="spotlightItem.title ?? spotlightItem.name ?? ''"
          loading="eager"
        />
        <div class="gradient"></div>
        <div class="spotlight-content">
          <h1 class="spotlight-title">{{ spotlightItem.title ?? spotlightItem.name }}</h1>
          <p class="spotlight-meta">
            <span v-if="spotlightItem.vote_average">
              &#9733; {{ spotlightItem.vote_average.toFixed(1) }}
            </span>
            <span v-if="spotlightItem.release_date || spotlightItem.first_air_date">
              &nbsp;&middot;&nbsp;
              {{ (spotlightItem.release_date ?? spotlightItem.first_air_date ?? '').slice(0, 4) }}
            </span>
          </p>
          <p v-if="spotlightItem.overview" class="spotlight-overview">
            {{ spotlightItem.overview.slice(0, 200) }}{{ spotlightItem.overview.length > 200 ? '…' : '' }}
          </p>
          <div class="spotlight-actions">
            <button class="btn btn-primary" @click="navigate(spotlightItem)">
              &#9654; Watch Now
            </button>
            <button class="btn btn-secondary" @click="navigate(spotlightItem)">
              More Info
            </button>
          </div>
        </div>
      </div>

      <!-- Home rows -->
      <template v-for="row in homeRows" :key="row.id">
        <template v-if="row.visible">

          <!-- Continue Watching -->
          <div v-if="row.id === 'continue' && inProgress.length > 0" class="row-section">
            <h2 class="section-title">Continue Watching</h2>
            <div class="cards-grid">
              <div
                v-for="item in inProgress"
                :key="`${item.media_type}_${item.id}`"
                class="progress-card"
                @click="navigate(item)"
              >
                <media-card
                  :item="JSON.stringify(item)"
                  :progress="progressPct(item)"
                ></media-card>
              </div>
            </div>
          </div>

          <!-- Similar Items -->
          <div v-else-if="row.id === 'similar' && similarItems.length > 0" class="row-section">
            <h2 class="section-title">Similar To What You Watched</h2>
            <div v-if="viewMode === 'carousel'">
              <trending-carousel
                :items="JSON.stringify(similarItems)"
                @item-click="navigate"
              ></trending-carousel>
            </div>
            <div v-else class="cards-grid">
              <media-card
                v-for="item in similarItems"
                :key="`${item.media_type}_${item.id}`"
                :item="JSON.stringify(item)"
                @click="navigate(item)"
              ></media-card>
            </div>
          </div>

          <!-- Trending Movies -->
          <div v-else-if="row.id === 'movies' && trendingMovies.length > 0" class="row-section">
            <h2 class="section-title">Trending Movies</h2>
            <div v-if="viewMode === 'carousel'">
              <trending-carousel
                :items="JSON.stringify(trendingMovies)"
                @item-click="navigate"
              ></trending-carousel>
            </div>
            <div v-else class="cards-grid">
              <media-card
                v-for="item in trendingMovies"
                :key="item.id"
                :item="JSON.stringify(item)"
                @click="navigate(item)"
              ></media-card>
            </div>
          </div>

          <!-- Trending Series -->
          <div v-else-if="row.id === 'series' && trendingSeries.length > 0" class="row-section">
            <h2 class="section-title">Trending Series</h2>
            <div v-if="viewMode === 'carousel'">
              <trending-carousel
                :items="JSON.stringify(trendingSeries)"
                @item-click="navigate"
              ></trending-carousel>
            </div>
            <div v-else class="cards-grid">
              <media-card
                v-for="item in trendingSeries"
                :key="item.id"
                :item="JSON.stringify(item)"
                @click="navigate(item)"
              ></media-card>
            </div>
          </div>

          <!-- Top Rated -->
          <div v-else-if="row.id === 'toprated' && topRated.length > 0" class="row-section">
            <h2 class="section-title">Top Rated</h2>
            <div v-if="viewMode === 'carousel'">
              <trending-carousel
                :items="JSON.stringify(topRated)"
                @item-click="navigate"
              ></trending-carousel>
            </div>
            <div v-else class="cards-grid">
              <media-card
                v-for="item in topRated"
                :key="`${item.media_type}_${item.id}`"
                :item="JSON.stringify(item)"
                @click="navigate(item)"
              ></media-card>
            </div>
          </div>

        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
}

/* ---- Spotlight ---- */
.spotlight-section {
  position: relative;
  height: 70vh;
  min-height: 400px;
  overflow: hidden;
}

.spotlight-section img.backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.5;
}

.spotlight-section .gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(10, 10, 10, 0.95) 0%,
    rgba(10, 10, 10, 0.6) 40%,
    transparent 100%
  );
}

.spotlight-content {
  position: absolute;
  bottom: 0;
  left: 0;
  padding: 2rem;
  z-index: 1;
  max-width: 600px;
}

.spotlight-title {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.1;
  margin: 0 0 0.5rem;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.spotlight-meta {
  color: #aaa;
  margin: 0.5rem 0;
  font-size: 0.95rem;
}

.spotlight-overview {
  color: #ccc;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0.5rem 0;
}

.spotlight-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.6rem 1.4rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s, transform 0.15s;
}

.btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

.btn-primary {
  background: var(--accent, #e50914);
  color: #fff;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

/* ---- Rows ---- */
.row-section {
  padding: 2rem 1.5rem;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #fff;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.progress-card {
  cursor: pointer;
  position: relative;
}

/* ---- Loading ---- */
.loading-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--accent, #e50914);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ---- Offline banner ---- */
.offline-banner {
  background: #7c3aed;
  color: #fff;
  text-align: center;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

/* ---- Setup wrapper ---- */
.setup-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
}

/* ---- Mobile ---- */
@media (max-width: 768px) {
  .spotlight-section {
    height: 50vh;
  }

  .spotlight-title {
    font-size: 1.5rem;
  }

  .spotlight-content {
    padding: 1.25rem;
  }

  .row-section {
    padding: 1.5rem 1rem;
  }

  .cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
  }
}
</style>
