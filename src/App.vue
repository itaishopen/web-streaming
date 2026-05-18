<template>
  <div class="app-layout">
    <app-sidebar
      :page="currentPage"
      :can-go-back="canGoBack"
      :saved-items="savedItems"
      @navigate="onSidebarNavigate"
      @search-open="showSearch = true"
      @go-back="router.back()"
    />

    <main class="main-content" id="main-scroll">
      <RouterView />
    </main>

    <search-modal
      :api-key="apiKey"
      :open="showSearch"
      :offline="offline"
      @modal-close="showSearch = false"
      @item-select="onSearchSelect"
    />

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSettings } from './composables/useSettings'
import { useLibrary } from './composables/useLibrary'
import type { MediaItem } from './types'
import './components/app-sidebar'
import './components/search-modal'

const router = useRouter()
const route  = useRoute()

const { settings, loadSettings, applyTheme } = useSettings()
const { saved, loadLibrary }                  = useLibrary()

const showSearch = ref(false)
const toast      = ref('')
const offline    = ref(!navigator.onLine)

const apiKey     = computed(() => settings.value.apiKey)
const savedItems = computed(() => saved.value)

const currentPage = computed(() => {
  const path = route.path
  if (path === '/')         return 'home'
  if (path.startsWith('/movie')) return 'movie'
  if (path.startsWith('/tv'))    return 'tv'
  if (path === '/library')  return 'library'
  if (path === '/settings') return 'settings'
  return 'home'
})

const canGoBack = computed(() => window.history.length > 1 && currentPage.value !== 'home')

function onSidebarNavigate(e: Event) {
  const page = (e as CustomEvent<{ page: string }>).detail.page
  if (page === 'home')     router.push('/')
  if (page === 'library')  router.push('/library')
  if (page === 'settings') router.push('/settings')
}

function onSearchSelect(e: Event) {
  const item = (e as CustomEvent<MediaItem>).detail
  showSearch.value = false
  const type = item.media_type === 'tv' ? 'tv' : 'movie'
  router.push(`/${type}/${item.id}`)
}

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

onMounted(() => {
  loadSettings()
  loadLibrary()
  applyTheme()

  window.addEventListener('online',  () => { offline.value = false })
  window.addEventListener('offline', () => { offline.value = true  })

  // keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      showSearch.value = true
    }
  })
})

watch(() => settings.value.accentColor, applyTheme)
watch(() => settings.value.fontSize,    applyTheme)

// expose toast globally via provide (pages can inject)
</script>
