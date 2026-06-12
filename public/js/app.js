/* ============================================
   Main Application Controller
   SkyPulse Weather Dashboard
   ============================================ */

const App = {
  /**
   * Initialize the application
   */
  init() {
    // Check authentication state and show the appropriate page
    if (Auth.isLoggedIn()) {
      this.showDashboard();
    } else {
      this.showAuth();
    }

    // Initialize auth form event handlers
    Auth.initAuthForms();

    // Setup user dropdown menu
    this.setupUserMenu();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
  },

  /**
   * Show the dashboard (logged-in state)
   */
  showDashboard() {
    UI.showPage('dashboard-section');

    // Display username in the nav
    const userName = document.getElementById('user-name');
    userName.textContent = Auth.user?.username || 'User';

    // Initialize weather module (binds event listeners)
    Weather.init();

    // Load user's favorite cities
    Favorites.loadFavorites();

    // Reset weather display if needed
    if (!Weather.currentData) {
      document.getElementById('welcome-state').style.display = 'flex';
      document.getElementById('weather-display').style.display = 'none';
    }
  },

  /**
   * Show the auth page (logged-out state)
   */
  showAuth() {
    UI.showPage('auth-section');

    // Reset dashboard state
    document.getElementById('welcome-state').style.display = 'flex';
    document.getElementById('weather-display').style.display = 'none';
    document.getElementById('loading-state').style.display = 'none';

    // Reset weather module state
    Weather.currentData = null;
    Weather.forecastData = null;
    Weather._initialized = false;
  },

  /**
   * Setup the user dropdown menu behavior
   */
  setupUserMenu() {
    const userBtn = document.getElementById('user-btn');
    const dropdown = document.getElementById('user-dropdown');

    // Toggle dropdown on button click
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });

    // Close dropdown when clicking anywhere else
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== userBtn) {
        dropdown.classList.remove('active');
      }
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.classList.remove('active');
      }
    });

    // Logout handler
    document.getElementById('logout-btn').addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
      this.showAuth();
      UI.showToast('Signed out successfully', 'success');
    });
  },

  /**
   * Setup global keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('city-search');
        if (searchInput && document.getElementById('dashboard-section').classList.contains('active')) {
          searchInput.focus();
          searchInput.select();
        }
      }
    });
  }
};

// ============================================
// Boot the application when DOM is ready
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
