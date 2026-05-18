import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('trailer-modal')
export class TrailerModal extends LitElement {
  @property({ type: Boolean }) open = false
  @property({ type: String }) videoKey = ''

  connectedCallback() {
    super.connectedCallback()
    document.addEventListener('keydown', this._handleGlobalKeyDown)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('keydown', this._handleGlobalKeyDown)
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

  static styles = css`
    :host {
      display: contents;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.92);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      backdrop-filter: blur(8px);
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0 }
      to   { opacity: 1 }
    }

    /* ── Modal container ─────────────────────────────────────────── */
    .modal {
      position: relative;
      width: 100%;
      max-width: 900px;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 32px 100px rgba(0,0,0,0.85);
      border: 1px solid #1e1e1e;
      animation: zoomIn 0.22s cubic-bezier(0.4,0,0.2,1);
    }

    @keyframes zoomIn {
      from { opacity: 0; transform: scale(0.92) }
      to   { opacity: 1; transform: scale(1)    }
    }

    /* ── 16:9 aspect ratio wrapper ───────────────────────────────── */
    .video-wrap {
      position: relative;
      width: 100%;
      padding-top: 56.25%; /* 16:9 */
    }

    .video-wrap iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    /* ── Close button ────────────────────────────────────────────── */
    .close-btn {
      position: absolute;
      top: -14px;
      right: -14px;
      width: 36px;
      height: 36px;
      background: #e50914;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      transition: background 0.18s ease, transform 0.18s ease;
      z-index: 10;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }

    .close-btn:hover {
      background: #ff1a24;
      transform: scale(1.1);
    }

    .close-btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2.5;
    }

    /* ── Responsive ──────────────────────────────────────────────── */
    @media (max-width: 600px) {
      .overlay {
        padding: 0;
        align-items: flex-end;
      }

      .modal {
        border-radius: 14px 14px 0 0;
        max-width: 100%;
      }

      .close-btn {
        top: 10px;
        right: 10px;
        position: fixed;
      }
    }
  `

  render() {
    if (!this.open) return nothing

    const embedUrl = `https://www.youtube-nocookie.com/embed/${this.videoKey}?autoplay=1&rel=0&modestbranding=1`

    return html`
      <div class="overlay" @click=${this._handleOverlayClick}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Trailer">
          <button class="close-btn" aria-label="Close trailer" @click=${this._close}>
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div class="video-wrap">
            ${this.videoKey ? html`
              <iframe
                src=${embedUrl}
                title="Trailer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            ` : nothing}
          </div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trailer-modal': TrailerModal
  }
}
