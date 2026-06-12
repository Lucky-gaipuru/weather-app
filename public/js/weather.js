/* ============================================
   Weather Data Module
   SkyPulse Weather Dashboard
   ============================================ */

const Weather = {
  currentUnit: 'C',
  currentData: null,
  forecastData: null,
  _initialized: false,

  /**
   * Search weather by city name
   * @param {string} city - City name to search
   */
  async searchCity(city) {
    UI.showLoading();
    try {
      const [currentRes, forecastRes] = await Promise.all([
        fetch(`/api/weather/current?city=${encodeURIComponent(city)}`, {
          headers: Auth.getHeaders()
        }),
        fetch(`/api/weather/forecast?city=${encodeURIComponent(city)}`, {
          headers: Auth.getHeaders()
        })
      ]);

      if (!currentRes.ok) {
        const err = await currentRes.json();
        throw new Error(err.error || 'Failed to fetch current weather');
      }
      if (!forecastRes.ok) {
        const err = await forecastRes.json();
        throw new Error(err.error || 'Failed to fetch forecast');
      }

      this.currentData = await currentRes.json();
      this.forecastData = await forecastRes.json();
      this.renderCurrentWeather();
      this.renderForecast();
      Favorites.checkIfFavorite(this.currentData.name);
    } catch (err) {
      UI.showToast(err.message, 'error');
      // Show welcome state again if no data loaded yet
      if (!this.currentData) {
        UI.hideLoading();
        document.getElementById('welcome-state').style.display = 'flex';
      }
    } finally {
      UI.hideLoading();
    }
  },

  /**
   * Search weather by geographic coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   */
  async searchByLocation(lat, lon) {
    UI.showLoading();
    try {
      const [currentRes, forecastRes] = await Promise.all([
        fetch(`/api/weather/current?lat=${lat}&lon=${lon}`, {
          headers: Auth.getHeaders()
        }),
        fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`, {
          headers: Auth.getHeaders()
        })
      ]);

      if (!currentRes.ok) {
        const err = await currentRes.json();
        throw new Error(err.error || 'Failed to fetch current weather');
      }
      if (!forecastRes.ok) {
        const err = await forecastRes.json();
        throw new Error(err.error || 'Failed to fetch forecast');
      }

      this.currentData = await currentRes.json();
      this.forecastData = await forecastRes.json();
      this.renderCurrentWeather();
      this.renderForecast();
      Favorites.checkIfFavorite(this.currentData.name);
      UI.showToast(`Weather loaded for ${this.currentData.name}`, 'success');
    } catch (err) {
      UI.showToast(err.message, 'error');
      if (!this.currentData) {
        UI.hideLoading();
        document.getElementById('welcome-state').style.display = 'flex';
      }
    } finally {
      UI.hideLoading();
    }
  },

  /**
   * Render current weather data to the DOM
   */
  renderCurrentWeather() {
    const d = this.currentData;
    if (!d) return;

    // Populate location info
    document.getElementById('weather-city').textContent =
      `${d.name}${d.sys && d.sys.country ? ', ' + d.sys.country : ''}`;
    document.getElementById('weather-description').textContent =
      d.weather[0].description.charAt(0).toUpperCase() + d.weather[0].description.slice(1);

    // Temperature
    document.getElementById('weather-temp').textContent =
      UI.formatTemp(d.main.temp, this.currentUnit);
    document.getElementById('weather-feels').textContent =
      UI.formatTemp(d.main.feels_like, this.currentUnit);

    // Weather icon
    document.getElementById('weather-icon-large').textContent =
      UI.getWeatherEmoji(d.weather[0].icon);

    // Detail cards
    document.getElementById('weather-humidity').textContent = d.main.humidity + '%';
    document.getElementById('weather-wind').textContent = d.wind.speed + ' m/s';
    document.getElementById('weather-pressure').textContent = d.main.pressure + ' hPa';
    document.getElementById('weather-visibility').textContent =
      d.visibility ? (d.visibility / 1000).toFixed(1) + ' km' : 'N/A';
    document.getElementById('weather-sunrise').textContent =
      d.sys && d.sys.sunrise ? UI.formatTime(d.sys.sunrise) : 'N/A';
    document.getElementById('weather-sunset').textContent =
      d.sys && d.sys.sunset ? UI.formatTime(d.sys.sunset) : 'N/A';

    // Show weather display, hide welcome
    document.getElementById('welcome-state').style.display = 'none';
    document.getElementById('weather-display').style.display = 'block';

    // Trigger staggered entrance animation for detail cards
    document.querySelectorAll('.detail-card').forEach((card, i) => {
      card.classList.remove('animate-in');
      // Force reflow
      void card.offsetWidth;
      card.style.animationDelay = `${i * 0.1}s`;
      card.classList.add('animate-in');
    });

    // Update search input with city name
    const searchInput = document.getElementById('city-search');
    if (searchInput) searchInput.value = d.name;
  },

  /**
   * Render 5-day forecast to the DOM
   */
  renderForecast() {
    const container = document.getElementById('forecast-container');
    if (!this.forecastData || !this.forecastData.list) {
      container.innerHTML = '';
      return;
    }

    // Group forecast entries by date
    const dailyMap = {};
    const today = new Date().toLocaleDateString();

    this.forecastData.list.forEach(item => {
      const date = new Date(item.dt * 1000).toLocaleDateString();
      // Skip today's remaining entries
      if (date === today) return;
      if (!dailyMap[date]) {
        dailyMap[date] = { items: [] };
      }
      dailyMap[date].items.push(item);
    });

    container.innerHTML = '';

    // Take up to 5 days
    const days = Object.entries(dailyMap).slice(0, 5);

    days.forEach(([date, data]) => {
      const temps = data.items.map(i => i.main.temp);
      const high = Math.max(...temps);
      const low = Math.min(...temps);
      // Pick the midday entry for icon/description
      const midItem = data.items[Math.floor(data.items.length / 2)];

      const card = document.createElement('div');
      card.className = 'forecast-card';
      card.innerHTML = `
        <div class="forecast-day">${UI.formatDate(midItem.dt)}</div>
        <div class="forecast-icon">${UI.getWeatherEmoji(midItem.weather[0].icon)}</div>
        <div class="forecast-temps">
          <span class="temp-high">${UI.formatTemp(high, this.currentUnit)}</span>
          <span class="temp-low">${UI.formatTemp(low, this.currentUnit)}</span>
        </div>
        <div class="forecast-desc">${midItem.weather[0].description}</div>
      `;
      container.appendChild(card);
    });
  },

  /**
   * Toggle temperature unit between Celsius and Fahrenheit
   */
  toggleUnit() {
    this.currentUnit = this.currentUnit === 'C' ? 'F' : 'C';
    document.getElementById('unit-toggle').textContent = '°' + this.currentUnit;
    if (this.currentData) {
      this.renderCurrentWeather();
      this.renderForecast();
    }
  },

  /**
   * Use browser geolocation to get weather for current position
   */
  useMyLocation() {
    if (!navigator.geolocation) {
      UI.showToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    UI.showToast('Getting your location...', 'info');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.searchByLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            UI.showToast('Location access was denied. Please enable it in your browser settings.', 'error');
            break;
          case err.POSITION_UNAVAILABLE:
            UI.showToast('Location information is unavailable', 'error');
            break;
          case err.TIMEOUT:
            UI.showToast('Location request timed out', 'error');
            break;
          default:
            UI.showToast('An error occurred getting your location', 'error');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000 // Cache for 5 minutes
      }
    );
  },

  /**
   * Initialize weather module — bind event listeners
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Search on Enter key
    const searchInput = document.getElementById('city-search');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        this.searchCity(searchInput.value.trim());
      }
    });

    // Location button
    document.getElementById('location-btn').addEventListener('click', () => {
      this.useMyLocation();
    });

    // Unit toggle
    document.getElementById('unit-toggle').addEventListener('click', () => {
      this.toggleUnit();
    });
  }
};
