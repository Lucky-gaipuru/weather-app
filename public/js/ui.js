/* ============================================
   UI Helper Module
   SkyPulse Weather Dashboard
   ============================================ */

const UI = {
  /**
   * Show a toast notification
   * @param {string} message - The notification message
   * @param {string} type - 'success' | 'error' | 'warning' | 'info'
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this._dismissToast(toast));

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => this._dismissToast(toast), 4000);

    // Pause auto-dismiss on hover
    toast.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      const progress = toast.querySelector('.toast-progress');
      if (progress) progress.style.animationPlayState = 'paused';
    });

    toast.addEventListener('mouseleave', () => {
      const remaining = setTimeout(() => this._dismissToast(toast), 2000);
      const progress = toast.querySelector('.toast-progress');
      if (progress) progress.style.animationPlayState = 'running';
    });
  },

  /**
   * Dismiss a toast with exit animation
   * @param {HTMLElement} toast
   */
  _dismissToast(toast) {
    if (toast.classList.contains('toast-exit')) return;
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  },

  /**
   * Show loading state
   */
  showLoading() {
    document.getElementById('welcome-state').style.display = 'none';
    document.getElementById('weather-display').style.display = 'none';
    document.getElementById('loading-state').style.display = 'flex';
  },

  /**
   * Hide loading state
   */
  hideLoading() {
    document.getElementById('loading-state').style.display = 'none';
  },

  /**
   * Transition between pages (auth <-> dashboard)
   * @param {string} pageId - 'auth-section' or 'dashboard-section'
   */
  showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
      if (page.id === pageId) {
        page.classList.add('active');
        page.style.display = 'flex';
        // Trigger reflow for animation
        void page.offsetWidth;
        page.style.opacity = '1';
      } else {
        page.style.opacity = '0';
        page.classList.remove('active');
        // Delay hiding to allow fade out
        setTimeout(() => {
          if (!page.classList.contains('active')) {
            page.style.display = 'none';
          }
        }, 300);
      }
    });
  },

  /**
   * Map OpenWeatherMap icon codes to emoji
   * @param {string} iconCode - OWM icon code (e.g., '01d')
   * @returns {string} Emoji
   */
  getWeatherEmoji(iconCode) {
    const emojiMap = {
      '01d': '☀️',
      '01n': '🌙',
      '02d': '⛅',
      '02n': '☁️',
      '03d': '☁️',
      '03n': '☁️',
      '04d': '☁️',
      '04n': '☁️',
      '09d': '🌧️',
      '09n': '🌧️',
      '10d': '🌦️',
      '10n': '🌧️',
      '11d': '⛈️',
      '11n': '⛈️',
      '13d': '❄️',
      '13n': '❄️',
      '50d': '🌫️',
      '50n': '🌫️'
    };
    return emojiMap[iconCode] || '🌤️';
  },

  /**
   * Format temperature with unit conversion
   * @param {number} celsius - Temperature in Celsius
   * @param {string} unit - 'C' or 'F'
   * @returns {string} Formatted temperature string
   */
  formatTemp(celsius, unit = 'C') {
    if (unit === 'F') {
      return Math.round(celsius * 9 / 5 + 32) + '°F';
    }
    return Math.round(celsius) + '°C';
  },

  /**
   * Format a Unix timestamp to a locale time string
   * @param {number} timestamp - Unix timestamp (seconds)
   * @returns {string} Formatted time
   */
  formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  /**
   * Format a Unix timestamp to a short date string
   * @param {number} timestamp - Unix timestamp (seconds)
   * @returns {string} Formatted date
   */
  formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  },

  /**
   * Debounce utility
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Set a button to loading state
   * @param {HTMLElement} btn - Button element
   * @param {boolean} loading - Whether to show loading
   * @param {string} originalText - Original button text to restore
   */
  setButtonLoading(btn, loading, originalText = '') {
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = '';
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.textContent = originalText || btn.dataset.originalText || 'Submit';
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }
};
