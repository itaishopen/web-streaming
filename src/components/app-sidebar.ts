import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { imgUrl } from '../utils/api'

interface SavedItem {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  media_type?: string
}

@customElement('app-sidebar')
export class AppSidebar extends LitElement {
  @property({ type: String }) page = 'home'
  @property({ type: Boolean }) canGoBack = false
  @property({ type: Array }) savedItems: SavedItem[] = []

  private _navigate(targetPage: string) {
    this.dispatchEvent(new CustomEvent('navigate', { detail: { page: targetPage }, bubbles: true, composed: true }))
  }

  private _openSearch() {
    this.dispatchEvent(new CustomEvent('search-open', { bubbles: true, composed: true }))
  }

  private _goBack() {
    this.dispatchEvent(new CustomEvent('go-back', { bubbles: true, composed: true }))
  }

  private _itemLabel(item: SavedItem): string {
    return item.title ?? item.name ?? 'Unknown'
  }

  static styles = css`
    :host {
      display: block;
    }

    /* ── Sidebar (desktop) ─────────────────────────────────────── */
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      width: 68px;
      background: #111;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 0 8px;
      z-index: 200;
      box-sizing: border-box;
      border-right: 1px solid #222;
    }

    /* ── Logo ──────────────────────────────────────────────────── */
    .logo {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.08em;
      color: #e50914;
      text-transform: uppercase;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      margin-bottom: 20px;
      user-select: none;
      line-height: 1;
    }

    /* ── Nav items ─────────────────────────────────────────────── */
    .nav-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 100%;
    }

    .nav-item {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      cursor: pointer;
      color: #888;
      transition: background 0.18s ease, color 0.18s ease;
      border: none;
      background: transparent;
    }

    .nav-item:hover {
      background: #1e1e1e;
      color: #fff;
    }

    .nav-item.active {
      background: #e50914;
      color: #fff;
    }

    .nav-item svg {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }

    /* ── Tooltips ──────────────────────────────────────────────── */
    .nav-item::after {
      content: attr(data-tooltip);
      position: absolute;
      left: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%);
      background: #222;
      color: #fff;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      padding: 5px 10px;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 300;
    }

    .nav-item:hover::after {
      opacity: 1;
    }

    /* ── Divider ───────────────────────────────────────────────── */
    .divider {
      width: 36px;
      height: 1px;
      background: #222;
      margin: 8px 0;
      flex-shrink: 0;
    }

    /* ── Saved items ───────────────────────────────────────────── */
    .saved-section {
      flex: 1;
      width: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      scrollbar-width: thin;
      scrollbar-color: #333 transparent;
    }

    .saved-section::-webkit-scrollbar {
      width: 3px;
    }
    .saved-section::-webkit-scrollbar-track {
      background: transparent;
    }
    .saved-section::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 2px;
    }

    .saved-thumb {
      position: relative;
      width: 32px;
      height: 44px;
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.15s ease;
    }

    .saved-thumb:hover {
      transform: scale(1.08);
    }

    .saved-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .saved-thumb .placeholder-icon {
      width: 100%;
      height: 100%;
      background: #1e1e1e;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #555;
    }

    .saved-thumb .placeholder-icon svg {
      width: 16px;
      height: 16px;
    }

    /* ── Spacer ────────────────────────────────────────────────── */
    .spacer {
      flex: 1;
    }

    /* ── Bottom nav item ───────────────────────────────────────── */
    .nav-bottom {
      margin-top: 8px;
    }

    /* ── Mobile bottom bar ─────────────────────────────────────── */
    .bottom-bar {
      display: none;
    }

    @media (max-width: 768px) {
      .sidebar {
        display: none;
      }

      .bottom-bar {
        display: flex;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: #111;
        border-top: 1px solid #222;
        z-index: 200;
        align-items: stretch;
      }

      .bar-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        cursor: pointer;
        color: #666;
        font-size: 10px;
        font-weight: 500;
        border: none;
        background: transparent;
        transition: color 0.15s ease;
        padding: 0;
      }

      .bar-item:hover {
        color: #ccc;
      }

      .bar-item.active {
        color: #e50914;
      }

      .bar-item svg {
        width: 22px;
        height: 22px;
      }
    }
  `

  private _renderFilmIcon() {
    return html`
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
    `
  }

  render() {
    const isHome = this.page === 'home'
    const isLibrary = this.page === 'library'
    const isSettings = this.page === 'settings'

    return html`
      <!-- Desktop sidebar -->
      <nav class="sidebar">
        <div class="logo">Streambert</div>

        <div class="nav-group">
          ${this.canGoBack ? html`
            <button
              class="nav-item"
              data-tooltip="Go Back"
              @click=${this._goBack}
              aria-label="Go back"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          ` : nothing}

          <button
            class="nav-item"
            data-tooltip="Search"
            @click=${this._openSearch}
            aria-label="Search"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          <button
            class="nav-item ${isHome ? 'active' : ''}"
            data-tooltip="Home"
            @click=${() => this._navigate('home')}
            aria-label="Home"
            aria-current=${isHome ? 'page' : nothing}
          >
            <svg viewBox="0 0 24 24" fill="${isHome ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>

          <button
            class="nav-item ${isLibrary ? 'active' : ''}"
            data-tooltip="Library"
            @click=${() => this._navigate('library')}
            aria-label="Library"
            aria-current=${isLibrary ? 'page' : nothing}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </button>
        </div>

        ${this.savedItems.length > 0 ? html`
          <div class="divider"></div>
          <div class="saved-section">
            ${this.savedItems.map(item => html`
              <div
                class="saved-thumb"
                title=${this._itemLabel(item)}
                @click=${() => this._navigate(`detail-${item.media_type ?? 'movie'}-${item.id}`)}
              >
                ${item.poster_path
                  ? html`<img src=${imgUrl(item.poster_path, 'w92')} alt=${this._itemLabel(item)} loading="lazy"/>`
                  : html`<div class="placeholder-icon">${this._renderFilmIcon()}</div>`
                }
              </div>
            `)}
          </div>
        ` : html`<div class="spacer"></div>`}

        ${this.savedItems.length === 0 ? nothing : html`<div class="divider"></div>`}

        <button
          class="nav-item nav-bottom ${isSettings ? 'active' : ''}"
          data-tooltip="Settings"
          @click=${() => this._navigate('settings')}
          aria-label="Settings"
          aria-current=${isSettings ? 'page' : nothing}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
              1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06
              a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
              A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0
              9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33
              l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4
              h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </nav>

      <!-- Mobile bottom bar -->
      <nav class="bottom-bar" aria-label="Bottom navigation">
        <button class="bar-item ${isHome ? 'active' : ''}" @click=${() => this._navigate('home')} aria-label="Home">
          <svg viewBox="0 0 24 24" fill="${isHome ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Home</span>
        </button>

        <button class="bar-item" @click=${this._openSearch} aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>Search</span>
        </button>

        <button class="bar-item ${isLibrary ? 'active' : ''}" @click=${() => this._navigate('library')} aria-label="Library">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <span>Library</span>
        </button>

        <button class="bar-item ${isSettings ? 'active' : ''}" @click=${() => this._navigate('settings')} aria-label="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
              1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06
              a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
              A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0
              9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33
              l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4
              h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Settings</span>
        </button>
      </nav>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-sidebar': AppSidebar
  }
}
