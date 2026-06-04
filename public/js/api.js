/* ==========================================================================
   AeroTemp API Client Driver
   Manages tokens, authenticated endpoints, and error handling.
   ========================================================================== */

const API_BASE = '/api';

const API = {
  // Save JWT Token and User data
  setSession(token, user) {
    localStorage.setItem('aerotemp_token', token);
    localStorage.setItem('aerotemp_user', JSON.stringify(user));
  },

  // Get current JWT Token
  getToken() {
    return localStorage.getItem('aerotemp_token');
  },

  // Get current user object
  getUser() {
    const userStr = localStorage.getItem('aerotemp_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (_) {
      return null;
    }
  },

  // Clear session data
  clearSession() {
    localStorage.removeItem('aerotemp_token');
    localStorage.removeItem('aerotemp_user');
  },

  // Verify session viability
  isAuthenticated() {
    return !!this.getToken();
  },

  // Core Request Handler wrapper
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    // Set headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Attach JWT if present
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration / invalidation automatically
        if (response.status === 401 || response.status === 403) {
          this.clearSession();
          // Dispatch custom event to let app.js know it should transition to login view
          window.dispatchEvent(new Event('aerotemp_unauthorized'));
        }
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Call failed [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth Operations
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setSession(data.token, data.user);
    return data.user;
  },

  async register(username, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setSession(data.token, data.user);
    return data.user;
  },

  async verifyToken() {
    if (!this.getToken()) return null;
    try {
      const data = await this.request('/auth/me');
      // Update local storage in case of updates
      localStorage.setItem('aerotemp_user', JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      this.clearSession();
      return null;
    }
  },

  logout() {
    this.clearSession();
    window.dispatchEvent(new Event('aerotemp_logout'));
  },

  // Weather Operations
  async getCurrentWeather({ city, lat, lon }) {
    let query = '';
    if (city) query = `city=${encodeURIComponent(city)}`;
    else if (lat && lon) query = `lat=${lat}&lon=${lon}`;
    
    return await this.request(`/weather/current?${query}`);
  },

  async getForecast({ city, lat, lon }) {
    let query = '';
    if (city) query = `city=${encodeURIComponent(city)}`;
    else if (lat && lon) query = `lat=${lat}&lon=${lon}`;
    
    return await this.request(`/weather/forecast?${query}`);
  },

  // Favorites Operations
  async getFavorites() {
    return await this.request('/favorites');
  },

  async addFavorite(city) {
    return await this.request('/favorites', {
      method: 'POST',
      body: JSON.stringify({ city })
    });
  },

  async removeFavorite(city) {
    return await this.request(`/favorites/${encodeURIComponent(city)}`, {
      method: 'DELETE'
    });
  },

  // Search History Operations
  async getHistory() {
    return await this.request('/history');
  },

  async clearHistory() {
    return await this.request('/history', {
      method: 'DELETE'
    });
  }
};
