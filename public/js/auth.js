/* ============================================
   Authentication Module
   SkyPulse Weather Dashboard
   ============================================ */

const Auth = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),

  /**
   * Check if user is currently logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return !!this.token;
  },

  /**
   * Get authorization headers for API calls
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  },

  /**
   * Register a new user
   * @param {string} username
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} Response data with token and user
   */
  async register(username, email, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    this.setSession(data.token, data.user);
    return data;
  },

  /**
   * Log in an existing user
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} Response data with token and user
   */
  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    this.setSession(data.token, data.user);
    return data;
  },

  /**
   * Store session data locally
   * @param {string} token - JWT token
   * @param {Object} user - User object
   */
  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  /**
   * Clear session and log out
   */
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /**
   * Initialize auth form event handlers
   */
  initAuthForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');

    // Toggle between login and register forms
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
    });

    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
    });

    // Login form submission
    loginBtn.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        UI.showToast('Please fill in all fields', 'warning');
        return;
      }

      UI.setButtonLoading(loginBtn, true);

      try {
        await this.login(email, password);
        UI.showToast(`Welcome back, ${this.user.username}!`, 'success');
        // Clear form
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        // Navigate to dashboard
        App.showDashboard();
      } catch (err) {
        UI.showToast(err.message, 'error');
      } finally {
        UI.setButtonLoading(loginBtn, false, 'Sign In');
      }
    });

    // Register form submission
    registerBtn.addEventListener('click', async () => {
      const username = document.getElementById('register-username').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;

      if (!username || !email || !password) {
        UI.showToast('Please fill in all fields', 'warning');
        return;
      }

      if (password.length < 6) {
        UI.showToast('Password must be at least 6 characters', 'warning');
        return;
      }

      UI.setButtonLoading(registerBtn, true);

      try {
        await this.register(username, email, password);
        UI.showToast(`Welcome, ${this.user.username}! Account created.`, 'success');
        // Clear form
        document.getElementById('register-username').value = '';
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
        // Navigate to dashboard
        App.showDashboard();
      } catch (err) {
        UI.showToast(err.message, 'error');
      } finally {
        UI.setButtonLoading(registerBtn, false, 'Create Account');
      }
    });

    // Allow Enter key to submit forms
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginBtn.click();
    });

    document.getElementById('register-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') registerBtn.click();
    });
  }
};
