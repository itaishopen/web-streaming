import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { MediaItem } from '../types'

@customElement('trending-carousel')
export class TrendingCarousel extends LitElement {
  // Accept both a plain JS array (Vue DOM property) and a JSON string (attribute fallback)
  @property({
    converter: {
      fromAttribute: (v: string | null): MediaItem[] => {
        if (!v) return []
        try { return JSON.parse(v) as MediaItem[] } catch { return [] }
      },
    },
  })
  items: MediaItem[] | string = []

  @property({ type: String }) title = ''
  @property({ type: String }) titleHighlight = ''
  @property({ type: Object }) ratingsMap: Record<number, string> = {}

  // Normalise to always return an array regardless of how Vue passed items
  private get _items(): MediaItem[] {
    const raw = this.items
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as MediaItem[] } catch { return [] }
    }
    return Array.isArray(raw) ? raw : []
  }

  @state() private _activeIndex = 0
  @state() private _animating = false

  private _autoTimer: ReturnType<typeof setInterval> | null = null
  private _interacting = false
  private _interactTimer: ReturnType<typeof setTimeout> | null = null
  private _wheelLastTime = 0
  private _touchStartX = 0
  private _touchStartY = 0

  connectedCallback() {
    super.connectedCallback()
    this._startAuto()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._stopAuto()
  }

  private _startAuto() {
    this._stopAuto()
    this._autoTimer = setInterval(() => {
      if (!this._interacting && this._items.length > 1) {
        this._advance(1)
      }
    }, 4000)
  }

  private _stopAuto() {
    if (this._autoTimer !== null) {
      clearInterval(this._autoTimer)
      this._autoTimer = null
    }
  }

  private _pauseAuto() {
    this._interacting = true
    if (this._interactTimer !== null) clearTimeout(this._interactTimer)
    this._interactTimer = setTimeout(() => {
      this._interacting = false
    }, 3000)
  }

  private _advance(delta: number) {
    if (this._animating || this._items.length === 0) return
    const len = this._items.length
    this._activeIndex = ((this._activeIndex + delta) % len + len) % len
    this._animating = true
    setTimeout(() => { this._animating = false }, 380)
    this.requestUpdate()
  }

  private _goTo(index: number) {
    if (index === this._activeIndex || this._animating) return
    this._pauseAuto()
    this._activeIndex = index
    this._animating = true
    setTimeout(() => { this._animating = false }, 380)
    this.requestUpdate()
  }

  private _handlePrev() {
    this._pauseAuto()
    this._advance(-1)
  }

  private _handleNext() {
    this._pauseAuto()
    this._advance(1)
  }

  private _handleWheel(e: WheelEvent) {
    e.preventDefault()
    const now = Date.now()
    if (now - this._wheelLastTime < 350) return
    this._wheelLastTime = now
    this._pauseAuto()
    if (e.deltaX > 0 || e.deltaY > 0) {
      this._advance(1)
    } else {
      this._advance(-1)
    }
  }

  private _handleTouchStart(e: TouchEvent) {
    this._touchStartX = e.touches[0].clientX
    this._touchStartY = e.touches[0].clientY
  }

  private _handleTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this._touchStartX
    const dy = e.changedTouches[0].clientY - this._touchStartY
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      this._pauseAuto()
      this._advance(dx < 0 ? 1 : -1)
    }
  }

  private _handleCardClick(item: MediaItem) {
    this.dispatchEvent(new CustomEvent('item-select', { detail: item, bubbles: true, composed: true }))
  }

  private _getVisibleCards(): Array<{ item: MediaItem; offset: number; index: number }> {
    const len = this._items.length
    if (len === 0) return []
    const results: Array<{ item: MediaItem; offset: number; index: number }> = []
    for (let offset = -2; offset <= 2; offset++) {
      const idx = ((this._activeIndex + offset) % len + len) % len
      results.push({ item: this._items[idx], offset, index: idx })
    }
    return results
  }

  private _scaleForOffset(offset: number): number {
    const abs = Math.abs(offset)
    if (abs === 0) return 1.0
    if (abs === 1) return 0.85
    return 0.65
  }

  private _opacityForOffset(offset: number): number {
    const abs = Math.abs(offset)
    if (abs === 0) return 1.0
    if (abs === 1) return 0.75
    return 0.45
  }

  private _zIndexForOffset(offset: number): number {
    const abs = Math.abs(offset)
    if (abs === 0) return 5
    if (abs === 1) return 4
    return 3
  }

  private _translateForOffset(offset: number): number {
    // Each card slot is ~180px wide
    return offset * 180
  }

  private _renderDots() {
    const len = this._items.length
    if (len <= 1) return nothing
    const MAX_DOTS = 10
    if (len <= MAX_DOTS) {
      return html`
        <div class="dots">
          ${this._items.map((_, i) => html`
            <button
              class="dot ${i === this._activeIndex ? 'dot--active' : ''}"
              aria-label=${`Go to item ${i + 1}`}
              @click=${() => this._goTo(i)}
            ></button>
          `)}
        </div>
      `
    }
    const visibleDots = this._items.slice(0, MAX_DOTS)
    const remaining = len - MAX_DOTS
    return html`
      <div class="dots">
        ${visibleDots.map((_, i) => html`
          <button
            class="dot ${i === this._activeIndex ? 'dot--active' : ''}"
            aria-label=${`Go to item ${i + 1}`}
            @click=${() => this._goTo(i)}
          ></button>
        `)}
        <span class="dots-more">+${remaining} more</span>
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .carousel-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      user-select: none;
    }

    /* ── Header ──────────────────────────────────────────────────── */
    .carousel-header {
      text-align: center;
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      line-height: 1.3;
    }

    .carousel-header .highlight {
      color: #e50914;
    }

    /* ── Stage ───────────────────────────────────────────────────── */
    .stage {
      position: relative;
      width: 100%;
      height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /* ── Nav buttons ─────────────────────────────────────────────── */
    .nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 10;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: rgba(255,255,255,0.12);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.18s ease;
      backdrop-filter: blur(4px);
    }

    .nav-btn:hover {
      background: rgba(255,255,255,0.24);
    }

    .nav-btn svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
    }

    .nav-btn--prev {
      left: 12px;
    }

    .nav-btn--next {
      right: 12px;
    }

    /* ── Cards container ─────────────────────────────────────────── */
    .cards-container {
      position: relative;
      width: 100%;
      height: 100%;
    }

    /* ── Individual card ─────────────────────────────────────────── */
    .carousel-card {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 160px;
      height: 240px;
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      transform-origin: center center;
      transition:
        transform 0.38s cubic-bezier(0.4, 0, 0.2, 1),
        opacity 0.38s cubic-bezier(0.4, 0, 0.2, 1),
        box-shadow 0.22s ease;
    }

    .carousel-card:hover {
      box-shadow: 0 20px 50px rgba(0,0,0,0.75);
    }

    .carousel-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      pointer-events: none;
    }

    .carousel-card .spotlight-placeholder {
      width: 100%;
      height: 100%;
      background: #1e1e1e;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #444;
    }

    .carousel-card .spotlight-placeholder svg {
      width: 48px;
      height: 48px;
    }

    .carousel-card .card-info {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px;
      background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .carousel-card:hover .card-info {
      opacity: 1;
    }

    .carousel-card .card-title {
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .carousel-card .card-rating {
      font-size: 10px;
      color: #f5c518;
      margin-top: 2px;
    }

    /* ── Dots ────────────────────────────────────────────────────── */
    .dots {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #444;
      border: none;
      cursor: pointer;
      padding: 0;
      transition: background 0.2s ease, transform 0.2s ease;
    }

    .dot:hover {
      background: #888;
    }

    .dot--active {
      background: #e50914;
      transform: scale(1.3);
    }

    .dots-more {
      font-size: 11px;
      color: #666;
      font-weight: 500;
    }
  `

  render() {
    if (this._items.length === 0) return nothing

    const visibleCards = this._getVisibleCards()

    return html`
      <div
        class="carousel-wrapper"
        @wheel=${this._handleWheel}
        @touchstart=${this._handleTouchStart}
        @touchend=${this._handleTouchEnd}
      >
        ${(this.title || this.titleHighlight) ? html`
          <div class="carousel-header">
            ${this.title ? html`<span>${this.title} </span>` : nothing}
            ${this.titleHighlight ? html`<span class="highlight">${this.titleHighlight}</span>` : nothing}
          </div>
        ` : nothing}

        <div class="stage">
          <button class="nav-btn nav-btn--prev" aria-label="Previous" @click=${this._handlePrev}>
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div class="cards-container">
            ${visibleCards.map(({ item, offset }) => {
              const scale = this._scaleForOffset(offset)
              const opacity = this._opacityForOffset(offset)
              const zIndex = this._zIndexForOffset(offset)
              const translateX = this._translateForOffset(offset)
              const posterUrl = item.poster_path
                ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
                : ''
              const title = item.title ?? item.name ?? ''
              const rating = item.vote_average ? item.vote_average.toFixed(1) : ''
              const year = (item.release_date ?? item.first_air_date ?? '').slice(0, 4)

              return html`
                <div
                  class="carousel-card"
                  style="
                    transform: translate(calc(-50% + ${translateX}px), -50%) scale(${scale});
                    opacity: ${opacity};
                    z-index: ${zIndex};
                    pointer-events: ${Math.abs(offset) <= 1 ? 'auto' : 'none'};
                  "
                  @click=${() => offset === 0 ? this._handleCardClick(item) : this._goTo(((this._activeIndex + offset) % this._items.length + this._items.length) % this._items.length)}
                  title=${title}
                >
                  ${posterUrl
                    ? html`<img src=${posterUrl} alt=${title} loading="lazy"/>`
                    : html`
                        <div class="spotlight-placeholder">
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
                  <div class="card-info">
                    <div class="card-title">${title}</div>
                    ${(rating || year) ? html`
                      <div class="card-rating">
                        ${rating ? html`★ ${rating}` : nothing}
                        ${rating && year ? html` · ` : nothing}
                        ${year ? html`${year}` : nothing}
                        ${this.ratingsMap[item.id] ? html` · ${this.ratingsMap[item.id]}` : nothing}
                      </div>
                    ` : nothing}
                  </div>
                </div>
              `
            })}
          </div>

          <button class="nav-btn nav-btn--next" aria-label="Next" @click=${this._handleNext}>
            <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        ${this._renderDots()}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trending-carousel': TrendingCarousel
  }
}
