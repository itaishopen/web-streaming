import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { SearchResult } from '../types'

const HISTORY_KEY = 'streambert_searchHistory'
const MAX_HISTORY = 12
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p'

function imgUrl(path: string | null | undefined, size = 'w92'): string {
  if (!path) return ''
  return `${TMDB_IMG_BASE}/${size}${path}`
}

@customElement('search-modal')
export class SearchModal extends LitElement {
  // attribute: 'api-key' so Lit observes the kebab-case attribute Vue sets
  @property({ type: String, attribute: 'api-key' }) apiKey = ''
  @property({ type: Boolean }) open = false
  @property({ type: Boolean }) offline = false

  @state() private _query = ''
  @state() private _results: SearchResult[] = []
  @state() private _loading = false
  @state() private _searchHistory: string[] = []

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null

  connectedCallback() {
    super.connectedCallback()
    this._loadHistory()
    document.addEventListener('keydown', this._handleGlobalKeyDown)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('keydown', this._handleGlobalKeyDown)
    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer)
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('open') && this.open) {
      this.updateComplete.then(() => {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>('.search-input')
        if (input) {
          input.focus()
        }
      })
    }
  }

  private _loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      this._searchHistory = raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      this._searchHistory = []
    }
  }

  private _saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this._searchHistory))
    } catch {
      // storage unavailable
    }
  }

  private _addToHistory(term: string) {
    const trimmed = term.trim()
    if (!trimmed) return
    this._searchHistory = [trimmed, ...this._searchHistory.filter(h => h !== trimmed)].slice(0, MAX_HISTORY)
    this._saveHistory()
    this.requestUpdate()
  }

  private _removeFromHistory(term: string) {
    this._searchHistory = this._searchHistory.filter(h => h !== term)
    this._saveHistory()
    this.requestUpdate()
  }

  private _clearHistory() {
    this._searchHistory = []
    this._saveHistory()
    this.requestUpdate()
  }

  private _handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) {
      this._close()
    }
  }

  private _close() {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }))
  }

  private _handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      this._close()
    }
  }

  private _handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value
    this._query = val

    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer)

    if (!val.trim()) {
      this._results = []
      this._loading = false
      return
    }

    this._loading = true
    this._debounceTimer = setTimeout(() => {
      this._doSearch(val.trim())
    }, 380)
  }

  private async _doSearch(term: string) {
    if (this.offline || !this.apiKey) {
      this._loading = false
      this._results = []
      return
    }
    try {
      const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(term)}&include_adult=false&page=1`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      if (!res.ok) throw new Error(`Search failed: ${res.status}`)
      const data = (await res.json()) as { results: SearchResult[] }
      const filtered = (data.results ?? []).filter(r => r.media_type !== 'person')
      this._results = filtered as SearchResult[]
      this._addToHistory(term)
    } catch {
      this._results = []
    } finally {
      this._loading = false
    }
  }

  private _selectItem(item: SearchResult) {
    this.dispatchEvent(new CustomEvent('item-select', { detail: item, bubbles: true, composed: true }))
    this._close()
  }

  private _useHistoryTerm(term: string) {
    this._query = term
    this._loading = true
    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer)
    this._doSearch(term)
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('.search-input')
    if (input) input.value = term
  }

  private _typeBadge(item: SearchResult): string {
    if (item.media_type === 'tv') return 'TV'
    if (item.media_type === 'movie') return 'Movie'
    return ''
  }

  private _year(item: SearchResult): string {
    return (item.release_date ?? item.first_air_date ?? '').slice(0, 4)
  }

  static styles = css`
    :host {
      display: contents;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.88);
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 80px;
      backdrop-filter: blur(6px);
      animation: fadeIn 0.18s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0 }
      to   { opacity: 1 }
    }

    .modal {
      width: 100%;
      max-width: 640px;
      background: #141414;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.75);
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 120px);
      border: 1px solid #2a2a2a;
      animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0 }
      to   { transform: translateY(0);     opacity: 1 }
    }

    /* ── Search bar ──────────────────────────────────────────────── */
    .search-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid #222;
      background: #1a1a1a;
      flex-shrink: 0;
    }

    .search-bar svg {
      width: 20px;
      height: 20px;
      color: #888;
      flex-shrink: 0;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
    }

    .search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-size: 16px;
      line-height: 1;
      caret-color: #e50914;
    }

    .search-input::placeholder {
      color: #555;
    }

    .close-btn {
      width: 30px;
      height: 30px;
      border: none;
      background: #2a2a2a;
      color: #888;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }

    .close-btn:hover {
      background: #333;
      color: #fff;
    }

    .close-btn svg {
      width: 14px;
      height: 14px;
    }

    /* ── Offline banner ──────────────────────────────────────────── */
    .offline-banner {
      padding: 10px 18px;
      background: #2d1c00;
      color: #f59e0b;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .offline-banner svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      flex-shrink: 0;
    }

    /* ── Body ────────────────────────────────────────────────────── */
    .modal-body {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #333 transparent;
    }

    .modal-body::-webkit-scrollbar {
      width: 4px;
    }

    .modal-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .modal-body::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 2px;
    }

    /* ── Spinner ─────────────────────────────────────────────────── */
    .spinner-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 0;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #2a2a2a;
      border-top-color: #e50914;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg) }
    }

    /* ── Results list ────────────────────────────────────────────── */
    .results-list {
      padding: 8px 0;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 18px;
      cursor: pointer;
      transition: background 0.14s ease;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
    }

    .result-item:hover {
      background: #1e1e1e;
    }

    .result-thumb {
      width: 44px;
      height: 62px;
      border-radius: 4px;
      overflow: hidden;
      flex-shrink: 0;
      background: #1e1e1e;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .result-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .result-thumb svg {
      width: 20px;
      height: 20px;
      color: #444;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.5;
    }

    .result-info {
      flex: 1;
      min-width: 0;
    }

    .result-title {
      font-size: 14px;
      font-weight: 600;
      color: #f0f0f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .result-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 3px;
    }

    .result-year {
      font-size: 12px;
      color: #666;
    }

    .result-rating {
      font-size: 12px;
      color: #f5c518;
    }

    .result-type {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .result-type.tv {
      background: #0e3a5c;
      color: #60b4f0;
    }

    .result-type.movie {
      background: #1a3a1a;
      color: #4ade80;
    }

    /* ── Recent searches section ─────────────────────────────────── */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px 6px;
    }

    .section-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
    }

    .clear-btn {
      font-size: 12px;
      color: #888;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      transition: color 0.14s;
    }

    .clear-btn:hover {
      color: #e50914;
    }

    .history-list {
      padding: 4px 0 8px;
    }

    .history-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 18px;
      cursor: pointer;
      transition: background 0.14s;
    }

    .history-item:hover {
      background: #1a1a1a;
    }

    .history-item svg {
      width: 14px;
      height: 14px;
      color: #555;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      flex-shrink: 0;
    }

    .history-term {
      flex: 1;
      font-size: 14px;
      color: #aaa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: none;
      border: none;
      text-align: left;
      cursor: pointer;
      padding: 0;
    }

    .history-term:hover {
      color: #fff;
    }

    .history-remove {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #444;
      transition: color 0.14s, background 0.14s;
      flex-shrink: 0;
    }

    .history-remove:hover {
      color: #e50914;
      background: #2a1a1a;
    }

    .history-remove svg {
      width: 12px;
      height: 12px;
    }

    /* ── Empty state ─────────────────────────────────────────────── */
    .empty-state {
      padding: 36px 18px;
      text-align: center;
      color: #555;
      font-size: 14px;
    }
  `

  render() {
    if (!this.open) return nothing

    const showHistory = !this._query.trim() && this._searchHistory.length > 0
    const showResults = !!this._query.trim() && !this._loading
    const showEmpty = !!this._query.trim() && !this._loading && this._results.length === 0

    return html`
      <div class="overlay" @click=${this._handleOverlayClick}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Search">
          <!-- Search bar -->
          <div class="search-bar">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              class="search-input"
              type="text"
              placeholder="Search movies, TV shows…"
              autocomplete="off"
              spellcheck="false"
              .value=${this._query}
              @input=${this._handleInput}
            />
            <button class="close-btn" aria-label="Close search" @click=${this._close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Offline banner -->
          ${this.offline ? html`
            <div class="offline-banner">
              <svg viewBox="0 0 24 24">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
              You are offline — search is unavailable
            </div>
          ` : nothing}

          <div class="modal-body">
            <!-- Loading spinner -->
            ${this._loading ? html`
              <div class="spinner-wrap">
                <div class="spinner"></div>
              </div>
            ` : nothing}

            <!-- Results -->
            ${showResults && !showEmpty ? html`
              <div class="results-list" role="listbox">
                ${this._results.map(item => {
                  const thumb = imgUrl(item.poster_path, 'w92')
                  const year = this._year(item)
                  const rating = item.vote_average ? item.vote_average.toFixed(1) : ''
                  const badge = this._typeBadge(item)
                  const badgeClass = item.media_type === 'tv' ? 'tv' : 'movie'
                  const displayTitle = item.title ?? item.name ?? 'Unknown'

                  return html`
                    <button
                      class="result-item"
                      role="option"
                      aria-label=${displayTitle}
                      @click=${() => this._selectItem(item)}
                    >
                      <div class="result-thumb">
                        ${thumb
                          ? html`<img src=${thumb} alt=${displayTitle} loading="lazy"/>`
                          : html`
                              <svg viewBox="0 0 24 24">
                                <rect x="2" y="5" width="20" height="14" rx="2"/>
                                <line x1="2" y1="9" x2="22" y2="9"/>
                                <line x1="2" y1="15" x2="22" y2="15"/>
                                <line x1="7" y1="5" x2="7" y2="9"/>
                                <line x1="12" y1="5" x2="12" y2="9"/>
                                <line x1="17" y1="5" x2="17" y2="9"/>
                                <line x1="7" y1="15" x2="7" y2="19"/>
                                <line x1="12" y1="15" x2="12" y2="19"/>
                                <line x1="17" y1="15" x2="17" y2="19"/>
                              </svg>
                            `
                        }
                      </div>
                      <div class="result-info">
                        <div class="result-title">${displayTitle}</div>
                        <div class="result-meta">
                          ${year ? html`<span class="result-year">${year}</span>` : nothing}
                          ${rating ? html`<span class="result-rating">★ ${rating}</span>` : nothing}
                          ${badge ? html`<span class="result-type ${badgeClass}">${badge}</span>` : nothing}
                        </div>
                      </div>
                    </button>
                  `
                })}
              </div>
            ` : nothing}

            <!-- Empty state -->
            ${showEmpty ? html`
              <div class="empty-state">No results found for "${this._query}"</div>
            ` : nothing}

            <!-- Recent searches -->
            ${showHistory ? html`
              <div>
                <div class="section-header">
                  <span class="section-label">Recent Searches</span>
                  <button class="clear-btn" @click=${this._clearHistory}>Clear all</button>
                </div>
                <div class="history-list">
                  ${this._searchHistory.map(term => html`
                    <div class="history-item">
                      <svg viewBox="0 0 24 24">
                        <polyline points="12 8 12 12 14 14"/>
                        <path d="M3.05 11a9 9 0 1 0 .5-4.5"/>
                        <polyline points="3 3 3 9 9 9"/>
                      </svg>
                      <button class="history-term" @click=${() => this._useHistoryTerm(term)}>${term}</button>
                      <button
                        class="history-remove"
                        aria-label=${`Remove ${term} from history`}
                        @click=${() => this._removeFromHistory(term)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  `)}
                </div>
              </div>
            ` : nothing}

            <!-- Prompt to search if nothing yet -->
            ${!this._query && !showHistory ? html`
              <div class="empty-state">Start typing to search…</div>
            ` : nothing}
          </div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'search-modal': SearchModal
  }
}
