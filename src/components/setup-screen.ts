import { LitElement, html, css, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'

@customElement('setup-screen')
export class SetupScreen extends LitElement {
  @state() private _apiKey = ''
  @state() private _checking = false
  @state() private _error = ''

  private _handleInput(e: Event) {
    this._apiKey = (e.target as HTMLInputElement).value.trim()
    if (this._error) this._error = ''
  }

  private async _handleSubmit(e: Event) {
    e.preventDefault()
    if (this._checking) return

    const key = this._apiKey.trim()
    if (!key) {
      this._error = 'Please enter your TMDB Read Access Token.'
      return
    }

    this._checking = true
    this._error = ''

    try {
      const res = await fetch('https://api.themoviedb.org/3/configuration', {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) {
        if (res.status === 401) {
          this._error = 'Invalid token. Please check your TMDB Read Access Token.'
        } else {
          this._error = `Validation failed (${res.status}). Please try again.`
        }
        return
      }
      this.dispatchEvent(new CustomEvent('setup-complete', {
        detail: { apiKey: key },
        bubbles: true,
        composed: true,
      }))
    } catch {
      this._error = 'Could not connect. Check your internet connection and try again.'
    } finally {
      this._checking = false
    }
  }

  private _handleSkip() {
    this.dispatchEvent(new CustomEvent('setup-complete', {
      detail: { apiKey: '' },
      bubbles: true,
      composed: true,
    }))
  }

  private _handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') this._handleSubmit(e)
  }

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0a0a0a;
      padding: 20px;
      box-sizing: border-box;
    }

    /* ── Card ────────────────────────────────────────────────────── */
    .setup-card {
      width: 100%;
      max-width: 440px;
      background: #141414;
      border-radius: 16px;
      padding: 40px 36px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.7);
      border: 1px solid #222;
      display: flex;
      flex-direction: column;
      gap: 28px;
      animation: fadeUp 0.3s ease;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px) }
      to   { opacity: 1; transform: translateY(0)    }
    }

    /* ── Logo ────────────────────────────────────────────────────── */
    .logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 44px;
      height: 44px;
      background: #e50914;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .logo-icon svg {
      width: 22px;
      height: 22px;
      fill: #fff;
    }

    .logo-text {
      font-size: 24px;
      font-weight: 900;
      color: #fff;
      letter-spacing: -0.02em;
    }

    .logo-text span {
      color: #e50914;
    }

    /* ── Instructions ────────────────────────────────────────────── */
    .instructions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .instructions h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #f0f0f0;
      line-height: 1.3;
    }

    .instructions p {
      margin: 0;
      font-size: 13px;
      color: #777;
      line-height: 1.6;
    }

    .instructions a {
      color: #e50914;
      text-decoration: none;
    }

    .instructions a:hover {
      text-decoration: underline;
    }

    /* ── Form ────────────────────────────────────────────────────── */
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .input-wrap {
      position: relative;
    }

    .token-input {
      width: 100%;
      padding: 12px 14px;
      background: #1e1e1e;
      border: 1.5px solid #2a2a2a;
      border-radius: 8px;
      color: #f0f0f0;
      font-size: 13px;
      font-family: monospace;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.18s ease;
      letter-spacing: 0.02em;
    }

    .token-input:focus {
      border-color: #e50914;
    }

    .token-input.has-error {
      border-color: #dc2626;
    }

    .token-input::placeholder {
      color: #444;
      font-family: inherit;
      letter-spacing: 0;
    }

    /* ── Error message ───────────────────────────────────────────── */
    .error-msg {
      font-size: 12px;
      color: #ef4444;
      display: flex;
      align-items: flex-start;
      gap: 6px;
      line-height: 1.5;
    }

    .error-msg svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      margin-top: 1px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
    }

    /* ── Buttons ─────────────────────────────────────────────────── */
    .btn-row {
      display: flex;
      gap: 10px;
    }

    .btn-primary {
      flex: 1;
      padding: 12px 20px;
      background: #e50914;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.18s ease, opacity 0.18s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary:hover:not(:disabled) {
      background: #ff1a24;
    }

    .btn-primary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-primary .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.65s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg) }
    }

    .btn-skip {
      padding: 12px 18px;
      background: transparent;
      color: #666;
      border: 1.5px solid #2a2a2a;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: border-color 0.18s, color 0.18s;
      white-space: nowrap;
    }

    .btn-skip:hover {
      border-color: #444;
      color: #aaa;
    }

    /* ── Footer note ─────────────────────────────────────────────── */
    .footer-note {
      font-size: 11px;
      color: #444;
      text-align: center;
      line-height: 1.6;
    }
  `

  render() {
    return html`
      <div class="setup-card">
        <!-- Logo -->
        <div class="logo-area">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24">
              <path d="M5 3l14 9-14 9V3z"/>
            </svg>
          </div>
          <div class="logo-text">Stream<span>bert</span></div>
        </div>

        <!-- Instructions -->
        <div class="instructions">
          <h2>Connect to TMDB</h2>
          <p>
            Get a free TMDB API Read Access Token at
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org</a>
            and paste it below to unlock full search, ratings, and metadata.
          </p>
        </div>

        <!-- Form -->
        <div class="form">
          <div class="input-wrap">
            <input
              class="token-input ${this._error ? 'has-error' : ''}"
              type="password"
              placeholder="Paste your Read Access Token…"
              autocomplete="off"
              spellcheck="false"
              .value=${this._apiKey}
              ?disabled=${this._checking}
              @input=${this._handleInput}
              @keydown=${this._handleKeyDown}
            />
          </div>

          ${this._error ? html`
            <div class="error-msg" role="alert">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              ${this._error}
            </div>
          ` : nothing}

          <div class="btn-row">
            <button
              class="btn-primary"
              ?disabled=${this._checking}
              @click=${this._handleSubmit}
            >
              ${this._checking
                ? html`<div class="spinner"></div> Validating…`
                : 'Connect'
              }
            </button>
            <button class="btn-skip" ?disabled=${this._checking} @click=${this._handleSkip}>
              Skip
            </button>
          </div>
        </div>

        <!-- Footer note -->
        <p class="footer-note">
          Your token is stored locally and never sent to any server other than TMDB.
        </p>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'setup-screen': SetupScreen
  }
}
