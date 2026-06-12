/* ============================================
   Favorites Management Module
   SkyPulse Weather Dashboard
   ============================================ */

const Favorites = {
  list: [],

  /**
   * Load favorites from the API
   */
  async loadFavorites() {
    try {
      const res = await fetch('/api/user/favorites', {
        headers: Auth.getHeaders()
      });
      if (res.ok) {
        this.list = await res.json();
        this.render();
      } else if (res.status === 401) {
        // Token expired, redirect to login
        Auth.logout();
        App.showAuth();
        UI.showToast('Session expired. Please sign in again.', 'warning');
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  },

  /**
   * Add a city to favorites
   * @param {string} cityName
   * @param {string} country
   * @param {number} lat
   * @param {number} lon
   */
  async addFavorite(cityName, country, lat, lon) {
    try {
      const res = await fetch('/api/user/favorites', {
        method: 'POST',
        headers: Auth.getHeaders(),
        body: JSON.stringify({ city_name: cityName, country, lat, lon })
      });

      if (res.ok) {
        UI.showToast(`${cityName} added to favorites ❤️`, 'success');
        await this.loadFavorites();
        // Update the favorite button state
        this.checkIfFavorite(cityName);
      } else {
        const data = await res.json();
        UI.showToast(data.error || 'Already in favorites', 'warning');
      }
    } catch (err) {
      UI.showToast('Failed to add favorite', 'error');
    }
  },

  /**
   * Remove a city from favorites
   * @param {number} id - Favorite entry ID
   */
  async removeFavorite(id) {
    try {
      const res = await fetch(`/api/user/favorites/${id}`, {
        method: 'DELETE',
        headers: Auth.getHeaders()
      });

      if (res.ok) {
        UI.showToast('Removed from favorites', 'success');
        await this.loadFavorites();
        // Update fav button if currently viewing that city
        if (Weather.currentData) {
          this.checkIfFavorite(Weather.currentData.name);
        }
      } else {
        UI.showToast('Failed to remove favorite', 'error');
      }
    } catch (err) {
      UI.showToast('Failed to remove favorite', 'error');
    }
  },

  /**
   * Check if a city is in favorites and update the heart button
   * @param {string} cityName
   */
  checkIfFavorite(cityName) {
    const isFav = this.list.some(
      f => f.city_name.toLowerCase() === cityName.toLowerCase()
    );
    const btn = document.getElementById('fav-btn');

    // Toggle visual state
    btn.classList.toggle('is-favorite', isFav);

    // Update click handler
    btn.onclick = () => {
      // Add pulse animation
      btn.classList.add('pulse-anim');
      setTimeout(() => btn.classList.remove('pulse-anim'), 400);

      if (isFav) {
        const fav = this.list.find(
          f => f.city_name.toLowerCase() === cityName.toLowerCase()
        );
        if (fav) this.removeFavorite(fav.id);
      } else {
        const d = Weather.currentData;
        if (d) {
          this.addFavorite(
            d.name,
            d.sys ? d.sys.country : '',
            d.coord ? d.coord.lat : 0,
            d.coord ? d.coord.lon : 0
          );
        }
      }
    };
  },

  /**
   * Render the favorites list in the DOM
   */
  render() {
    const container = document.getElementById('favorites-container');
    const title = document.getElementById('favorites-title');

    if (this.list.length === 0) {
      title.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    title.style.display = 'block';

    container.innerHTML = this.list.map((fav, index) => `
      <div class="favorite-card" data-city="${this._escapeHtml(fav.city_name)}" 
           style="animation-delay: ${index * 0.08}s">
        <div class="fav-info">
          <span class="fav-city">${this._escapeHtml(fav.city_name)}</span>
          <span class="fav-country">${this._escapeHtml(fav.country || '')}</span>
        </div>
        <div class="fav-actions">
          <button class="fav-load-btn" onclick="Weather.searchCity('${this._escapeJs(fav.city_name)}')">View</button>
          <button class="fav-delete-btn" onclick="Favorites.removeFavorite(${fav.id})" title="Remove">&times;</button>
        </div>
      </div>
    `).join('');
  },

  /**
   * Escape HTML entities to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  /**
   * Escape string for safe use in JS template strings within onclick
   * @param {string} str
   * @returns {string}
   */
  _escapeJs(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  }
};
