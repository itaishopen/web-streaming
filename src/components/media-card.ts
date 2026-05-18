import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { imgUrl } from '../utils/api'
import type { MediaItem } from '../types'

@customElement('media-card')
export class MediaCard extends LitElement {
  @property({ type: Object }) item: MediaItem | null = null
  @property({ type: Number }) progress = 0
  @property({ type: Boolean }) watched = false
  @property({ type: String }) ageRating = ''
  @property({ type: Boolean }) restricted = false

  @state() private _menuOpen = false
  @state() private _menuX = 0
  @state() private _menuY = 0

  private get _isAnime(): boolean {
    if (!this.item) return false
    const hasAnimeGenre = this.item.genre_ids?.includes(16) ?? false
    if (!hasAnimeGenre) return false
    const isJp = this.item.original_language === 'ja'
    const hasJpOrigin = this.item.origin_country?.includes('JP') ?? false
    return isJp || hasJpOrigin
  }

  private get _mediaTypeBadge(): string {
    if (this._isAnime) return 'ANIME'
    if (this.item?.media_type === 'tv') return 'TV'
    if (this.item?.media_type === 'movie') return 'HD'
    return ''
  }

  private get _title(): string {
    return this.item?.title ?? this.item?.name ?? 'Unknown'
  }

  private get _year(): string {
    const date = this.item?.release_date ?? this.item?.first_air_date ?? ''
    return date ? date.slice(0, 4) : ''
  }

  private get _rating(): string {
    if (!this.item) return ''
    return this.item.vote_average ? this.item.vote_average.toFixed(1) : ''
  }

  private _handleClick() {
    if (this.restricted || !this.item) return
    this.dispatchEvent(new CustomEvent('card-click', { detail: this.item, bubbles: true, composed: true }))
  }

  private _handleContextMenu(e: MouseEvent) {
    e.preventDefault()
    if (!this.item) return
    this._menuX = e.clientX
    this._menuY = e.clientY
    this._menuOpen = true
  }

  private _closeMenu() {
    this._menuOpen = false
  }

  private _markWatched(e: Event) {
    e.stopPropagation()
    this._menuOpen = false
    if (!this.item) return
    const key = `${this.item.media_type ?? 'movie'}-${this.item.id}`
    this.dispatchEvent(new CustomEvent('mark-watched', { detail: { item: this.item, key }, bubbles: true, composed: true }))
  }

  private _markUnwatched(e: Event) {
    e.stopPropagation()
    this._menuOpen = false
    if (!this.item) return
    const key = `${this.item.media_type ?? 'movie'}-${this.item.id}`
    this.dispatchEvent(new CustomEvent('mark-unwatched', { detail: { item: this.item, key }, bubbles: true, composed: true }))
  }

  private _handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      this._handleClick()
    }
  }

  static styles = css`
    :host {
      display: inline-block;
    }

    .card {
      position: relative;
      width: 160px;
      height: 240px;
      border-radius: 8px;
      overflow: visible;
      cursor: pointer;
      outline: none;
      flex-shrink: 0;
    }

    .card:focus-visible .inner {
      box-shadow: 0 0 0 2px #e50914;
    }

    .inner {
      position: relative;
      width: 160px;
      height: 240px;
      border-radius: 8px;
      overflow: hidden;
      background: #1a1a1a;
      transition: transform 0.22s ease, box-shadow 0.22s ease;
    }

    .card:hover .inner {
      transform: translateY(-6px) scale(1.03);
      box-shadow: 0 16px 40px rgba(0,0,0,0.65);
    }

    /* ── Poster image ──────────────────────────────────────────── */
    .poster {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .poster-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1e1e1e;
      color: #444;
    }

    .poster-placeholder svg {
      width: 48px;
      height: 48px;
    }

    /* ── Hover overlay ─────────────────────────────────────────── */
    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.45) 55%, transparent 100%);
      opacity: 0;
      transition: opacity 0.22s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding: 10px 8px 10px;
      box-sizing: border-box;
    }

    .card:hover .overlay {
      opacity: 1;
    }

    .play-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #e50914;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      flex-shrink: 0;
      transition: transform 0.15s ease, background 0.15s ease;
    }

    .play-btn:hover {
      transform: scale(1.1);
      background: #ff1a24;
    }

    .play-btn svg {
      width: 18px;
      height: 18px;
      fill: #fff;
      margin-left: 2px;
    }

    .overlay-title {
      font-size: 12px;
      font-weight: 600;
      color: #fff;
      text-align: center;
      line-height: 1.3;
      max-height: 2.6em;
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .overlay-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
    }

    .overlay-year {
      font-size: 11px;
      color: #aaa;
    }

    .overlay-rating {
      font-size: 11px;
      color: #f5c518;
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .overlay-rating svg {
      width: 10px;
      height: 10px;
      fill: #f5c518;
    }

    /* ── Progress bar ──────────────────────────────────────────── */
    .progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: rgba(255,255,255,0.15);
    }

    .progress-fill {
      height: 100%;
      background: #e50914;
      transition: width 0.3s ease;
    }

    /* ── Watched badge ─────────────────────────────────────────── */
    .watched-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 20px;
      height: 20px;
      background: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }

    .watched-badge svg {
      width: 12px;
      height: 12px;
      stroke: #fff;
      fill: none;
      stroke-width: 2.5;
    }

    /* ── Age rating badge ──────────────────────────────────────── */
    .age-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      background: rgba(0,0,0,0.75);
      border: 1px solid #555;
      color: #ccc;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 3px;
      z-index: 10;
      letter-spacing: 0.04em;
    }

    /* ── Media type badge ──────────────────────────────────────── */
    .type-badge {
      position: absolute;
      bottom: 8px;
      left: 6px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.06em;
      padding: 2px 5px;
      border-radius: 3px;
      z-index: 10;
    }

    .type-badge.anime {
      background: #6366f1;
      color: #fff;
    }

    .type-badge.tv {
      background: #0891b2;
      color: #fff;
    }

    .type-badge.hd {
      background: #16a34a;
      color: #fff;
    }

    /* ── Lock overlay ──────────────────────────────────────────── */
    .lock-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.72);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      z-index: 20;
    }

    .lock-overlay svg {
      width: 32px;
      height: 32px;
      color: #888;
    }

    .lock-overlay span {
      font-size: 11px;
      color: #888;
      font-weight: 500;
    }

    /* ── Context menu ──────────────────────────────────────────── */
    .ctx-menu {
      position: fixed;
      background: #1e1e1e;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 4px 0;
      min-width: 170px;
      z-index: 9999;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    }

    .ctx-menu-item {
      padding: 9px 14px;
      font-size: 13px;
      color: #ddd;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.12s ease;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
    }

    .ctx-menu-item:hover {
      background: #2a2a2a;
      color: #fff;
    }

    .ctx-menu-item svg {
      width: 15px;
      height: 15px;
      flex-shrink: 0;
    }

    .ctx-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
    }
  `

  render() {
    if (!this.item) return nothing

    const badgeClass = this._mediaTypeBadge === 'ANIME' ? 'anime' : this._mediaTypeBadge === 'TV' ? 'tv' : 'hd'
    const posterSrc = imgUrl(this.item.poster_path, 'w342')

    return html`
      <div
        class="card"
        tabindex="0"
        role="button"
        aria-label=${`Play ${this._title}`}
        @click=${this._handleClick}
        @contextmenu=${this._handleContextMenu}
        @keydown=${this._handleKeyDown}
      >
        <div class="inner">
          ${posterSrc
            ? html`<img class="poster" src=${posterSrc} alt=${this._title} loading="lazy"/>`
            : html`
                <div class="poster-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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
                </div>
              `
          }

          <!-- Hover overlay -->
          <div class="overlay">
            <div class="play-btn">
              <svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
            </div>
            <div class="overlay-title">${this._title}</div>
            <div class="overlay-meta">
              ${this._year ? html`<span class="overlay-year">${this._year}</span>` : nothing}
              ${this._rating ? html`
                <span class="overlay-rating">
                  <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ${this._rating}
                </span>
              ` : nothing}
            </div>
          </div>

          <!-- Progress bar -->
          ${this.progress > 0 ? html`
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(100, this.progress)}%"></div>
            </div>
          ` : nothing}

          <!-- Media type badge -->
          ${this._mediaTypeBadge ? html`
            <div class="type-badge ${badgeClass}">${this._mediaTypeBadge}</div>
          ` : nothing}

          <!-- Watched badge -->
          ${this.watched ? html`
            <div class="watched-badge" aria-label="Watched">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          ` : nothing}

          <!-- Age rating badge -->
          ${this.ageRating ? html`
            <div class="age-badge">${this.ageRating}</div>
          ` : nothing}

          <!-- Lock overlay -->
          ${this.restricted ? html`
            <div class="lock-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>Restricted</span>
            </div>
          ` : nothing}
        </div>
      </div>

      <!-- Context menu backdrop -->
      ${this._menuOpen ? html`
        <div class="ctx-backdrop" @click=${this._closeMenu}></div>
        <div
          class="ctx-menu"
          style="top: ${this._menuY}px; left: ${this._menuX}px;"
          role="menu"
        >
          ${this.watched
            ? html`
              <button class="ctx-menu-item" role="menuitem" @click=${this._markUnwatched}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                Mark as Unwatched
              </button>
            `
            : html`
              <button class="ctx-menu-item" role="menuitem" @click=${this._markWatched}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Mark as Watched
              </button>
            `
          }
        </div>
      ` : nothing}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-card': MediaCard
  }
}
