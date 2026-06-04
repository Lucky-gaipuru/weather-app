/* ==========================================================================
   AeroTemp Core Frontend Orchestrator
   Manages UI state, views, events, local persistence, and Chart.js forecast canvas.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- UI Elements ---
  const authView = document.getElementById('authView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const showLoginBtn = document.getElementById('showLoginBtn');
  const authAlert = document.getElementById('authAlert');
  
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const geoBtn = document.getElementById('geoBtn');
  
  const unitCBtn = document.getElementById('unitCBtn');
  const unitFBtn = document.getElementById('unitFBtn');
  const userNameText = document.getElementById('userNameText');
  const logoutBtn = document.getElementById('logoutBtn');
  
  const favoritesList = document.getElementById('favoritesList');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  
  const dashboardLoader = document.getElementById('dashboardLoader');
  const weatherContent = document.getElementById('weatherContent');
  
  const weatherCityName = document.getElementById('weatherCityName');
  const weatherCountryCode = document.getElementById('weatherCountryCode');
  const weatherDateText = document.getElementById('weatherDateText');
  const weatherTempBig = document.getElementById('weatherTempBig');
  const weatherTempMax = document.getElementById('weatherTempMax');
  const weatherTempMin = document.getElementById('weatherTempMin');
  const weatherIconContainer = document.getElementById('weatherIconContainer');
  const weatherDescText = document.getElementById('weatherDescText');
  const weatherFeelsLike = document.getElementById('weatherFeelsLike');
  
  const favoriteToggleBtn = document.getElementById('favoriteToggleBtn');
  const favToggleIcon = document.getElementById('favToggleIcon');
  
  const metricWindText = document.getElementById('metricWindText');
  const metricWindDir = document.getElementById('metricWindDir');
  const metricHumidityText = document.getElementById('metricHumidityText');
  const metricUvText = document.getElementById('metricUvText');
  const metricUvLabel = document.getElementById('metricUvLabel');
  const metricPressureText = document.getElementById('metricPressureText');
  const metricVisibilityText = document.getElementById('metricVisibilityText');
  
  const multidayListContainer = document.getElementById('multidayListContainer');

  // --- State Variables ---
  let currentUnit = localStorage.getItem('aerotemp_unit') || 'C'; // C or F
  let currentCityData = null;      // Currently loaded weather data
  let currentForecastData = null;  // Currently loaded forecast data
  let userFavorites = [];          // Array of favorite cities
  let forecastChartInstance = null;// Chart.js canvas object

  // --- Constants ---
  const DEFAULT_CITY = 'New York';

  // --- Initialization ---
  initApp();

  async function initApp() {
    // Sync UI temperature unit switches
    updateUnitToggleUI();
    
    // Check if JWT token exists in local storage
    if (API.isAuthenticated()) {
      showLoader();
      const user = await API.verifyToken();
      if (user) {
        setupDashboardView(user);
      } else {
        setupAuthView();
      }
      hideLoader();
    } else {
      setupAuthView();
    }
  }

  // --- View Setup Routines ---
  function setupAuthView() {
    authView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    loginForm.reset();
    registerForm.reset();
    hideAlert();
  }

  async function setupDashboardView(user) {
    userNameText.textContent = user.username;
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    
    showLoader();
    try {
      // Hydrate favorites and search history concurrently
      await Promise.all([
        loadFavorites(),
        loadHistory()
      ]);

      // Load initial weather (first favorite, or geolocation, or default)
      if (userFavorites.length > 0) {
        await loadWeatherData(userFavorites[0].city);
      } else {
        // Try getting geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              await loadWeatherDataByCoords(position.coords.latitude, position.coords.longitude);
            },
            async () => {
              // Fallback to default
              await loadWeatherData(DEFAULT_CITY);
            },
            { timeout: 5000 }
          );
        } else {
          await loadWeatherData(DEFAULT_CITY);
        }
      }
    } catch (err) {
      console.error('Failed to load initial dashboard datasets:', err);
    } finally {
      hideLoader();
    }
  }

  // --- Auth View Event Listeners & Controllers ---
  showRegisterBtn.addEventListener('click', () => {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    hideAlert();
  });

  showLoginBtn.addEventListener('click', () => {
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
    hideAlert();
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userVal = document.getElementById('loginUser').value;
    const passVal = document.getElementById('loginPass').value;
    
    setAuthLoading(true, 'loginSubmitBtn');
    hideAlert();
    try {
      const user = await API.login(userVal, passVal);
      setupDashboardView(user);
    } catch (err) {
      showAlert(err.message || 'Login failed. Please check credentials.');
    } finally {
      setAuthLoading(false, 'loginSubmitBtn');
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userVal = document.getElementById('registerUser').value;
    const passVal = document.getElementById('registerPass').value;

    if (passVal.length < 6) {
      showAlert('Password must be at least 6 characters long.');
      return;
    }

    setAuthLoading(true, 'registerSubmitBtn');
    hideAlert();
    try {
      const user = await API.register(userVal, passVal);
      setupDashboardView(user);
    } catch (err) {
      showAlert(err.message || 'Registration failed. Choose another username.');
    } finally {
      setAuthLoading(false, 'registerSubmitBtn');
    }
  });

  // --- Global Event Dispatch Listeners ---
  window.addEventListener('aerotemp_unauthorized', () => {
    setupAuthView();
  });

  window.addEventListener('aerotemp_logout', () => {
    setupAuthView();
  });

  logoutBtn.addEventListener('click', () => {
    API.logout();
  });

  // --- Dashboard Logic: Weather Fetching & Renderers ---
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const city = searchInput.value.trim();
    if (!city) return;
    
    showLoader();
    try {
      await loadWeatherData(city);
      searchInput.value = '';
    } catch (err) {
      alert(`Could not fetch weather for "${city}". Verify spelling.`);
    } finally {
      hideLoader();
    }
  });

  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    showLoader();
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await loadWeatherDataByCoords(position.coords.latitude, position.coords.longitude);
        } catch (err) {
          alert('Error loading local coordinates weather.');
        } finally {
          hideLoader();
        }
      },
      (error) => {
        hideLoader();
        alert('Permission to retrieve coordinates was denied or unavailable.');
      }
    );
  });

  async function loadWeatherData(city) {
    const current = await API.getCurrentWeather({ city });
    const forecast = await API.getForecast({ city });
    
    currentCityData = current;
    currentForecastData = forecast;
    
    renderDashboard();
    await loadHistory(); // refresh history panel
  }

  async function loadWeatherDataByCoords(lat, lon) {
    const current = await API.getCurrentWeather({ lat, lon });
    const forecast = await API.getForecast({ lat, lon });
    
    currentCityData = current;
    currentForecastData = forecast;
    
    renderDashboard();
    await loadHistory();
  }

  // --- Main Dashboard Rendering Module ---
  function renderDashboard() {
    if (!currentCityData || !currentForecastData) return;
    
    const weather = currentCityData;
    const forecast = currentForecastData;
    
    // 1. Text elements
    weatherCityName.textContent = weather.name;
    weatherCountryCode.textContent = weather.sys.country;
    weatherDateText.textContent = formatDate(weather.dt || Math.floor(Date.now() / 1000));
    
    // 2. Temp Unit Formatting
    const currentTemp = formatTemp(weather.main.temp);
    weatherTempBig.textContent = currentTemp;
    weatherTempMax.textContent = `${formatTemp(weather.main.temp_max)}°`;
    weatherTempMin.textContent = `${formatTemp(weather.main.temp_min)}°`;
    weatherFeelsLike.textContent = `Feels like ${formatTemp(weather.main.feels_like)}°`;
    
    // 3. Description & Icons
    weatherDescText.textContent = weather.weather[0].description;
    renderWeatherIcon(weather.weather[0].main, weatherIconContainer);
    
    // 4. Secondary Metrics
    metricWindText.textContent = `${Math.round(weather.wind.speed * 3.6)} km/h`; // convert m/s to km/h
    metricWindDir.textContent = getWindDirection(weather.wind.deg);
    metricHumidityText.textContent = `${weather.main.humidity}%`;
    metricPressureText.textContent = `${weather.main.pressure} hPa`;
    metricVisibilityText.textContent = `${(weather.visibility / 1000).toFixed(1)} km visibility`;
    
    // 5. UV Index badge coloring
    const uvVal = weather.uvIndex || 0;
    metricUvText.textContent = uvVal;
    if (uvVal <= 2) {
      metricUvLabel.textContent = 'Low';
      metricUvLabel.className = 'metric-subtitle badge badge-uv-low';
    } else if (uvVal <= 5) {
      metricUvLabel.textContent = 'Moderate';
      metricUvLabel.className = 'metric-subtitle badge badge-uv-moderate';
    } else {
      metricUvLabel.textContent = 'High';
      metricUvLabel.className = 'metric-subtitle badge badge-uv-high';
    }

    // 6. Sync Favorite Toggle button
    const isFav = userFavorites.some(f => f.city.toLowerCase() === weather.name.toLowerCase());
    if (isFav) {
      favoriteToggleBtn.classList.add('active');
      favToggleIcon.setAttribute('data-lucide', 'heart-off');
      favoriteToggleBtn.setAttribute('title', 'Remove Saved Location');
    } else {
      favoriteToggleBtn.classList.remove('active');
      favToggleIcon.setAttribute('data-lucide', 'heart');
      favoriteToggleBtn.setAttribute('title', 'Save Location');
    }
    
    // 7. Dynamic Ambient background adjustment
    updateDynamicAmbientBlobs(weather.weather[0].main);

    // 8. Render Forecast sections
    renderHourlyForecastChart(forecast.list.slice(0, 8)); // Next 24 hours (8 intervals of 3 hours)
    renderDailyExtendedForecastList(forecast.list);
    
    // Refresh SVG icons
    lucide.createIcons();
  }

  // --- Favorite Operations & UI Updating ---
  favoriteToggleBtn.addEventListener('click', async () => {
    if (!currentCityData) return;
    
    const cityName = currentCityData.name;
    const isFav = userFavorites.some(f => f.city.toLowerCase() === cityName.toLowerCase());
    
    showLoader();
    try {
      if (isFav) {
        userFavorites = await API.removeFavorite(cityName);
      } else {
        userFavorites = await API.addFavorite(cityName);
      }
      renderFavoritesList();
      renderDashboard(); // refresh favorites toggle icon
    } catch (err) {
      console.error('Error toggling favorite:', err);
    } finally {
      hideLoader();
    }
  });

  async function loadFavorites() {
    userFavorites = await API.getFavorites();
    renderFavoritesList();
  }

  function renderFavoritesList() {
    favoritesList.innerHTML = '';
    
    if (userFavorites.length === 0) {
      favoritesList.innerHTML = '<li class="empty-list-placeholder">No saved locations yet.</li>';
      return;
    }
    
    userFavorites.forEach(fav => {
      const li = document.createElement('li');
      li.className = 'city-item';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'city-item-name';
      nameSpan.textContent = fav.city;
      nameSpan.addEventListener('click', async () => {
        showLoader();
        await loadWeatherData(fav.city);
        hideLoader();
      });
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'city-item-remove-btn';
      removeBtn.setAttribute('aria-label', `Remove ${fav.city} from saved locations`);
      removeBtn.innerHTML = '<i data-lucide="x"></i>';
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        showLoader();
        try {
          userFavorites = await API.removeFavorite(fav.city);
          renderFavoritesList();
          if (currentCityData && currentCityData.name.toLowerCase() === fav.city.toLowerCase()) {
            renderDashboard(); // refresh dashboard toggle icon
          }
        } catch (err) {
          console.error(err);
        } finally {
          hideLoader();
        }
      });
      
      li.appendChild(nameSpan);
      li.appendChild(removeBtn);
      favoritesList.appendChild(li);
    });
    
    lucide.createIcons({ attrs: { class: 'icon-sm' } });
  }

  // --- Search History Logic & UI Updating ---
  async function loadHistory() {
    const history = await API.getHistory();
    renderHistoryList(history);
  }

  function renderHistoryList(history) {
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      historyList.innerHTML = '<li class="empty-list-placeholder">Your searches will appear here.</li>';
      clearHistoryBtn.classList.add('hidden');
      return;
    }
    
    clearHistoryBtn.classList.remove('hidden');
    history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'city-item';
      li.style.justifyContent = 'flex-start';
      li.style.gap = '8px';
      
      const clockIcon = document.createElement('i');
      clockIcon.setAttribute('data-lucide', 'clock');
      clockIcon.style.width = '14px';
      clockIcon.style.height = '14px';
      clockIcon.style.color = 'var(--text-muted)';
      
      const textSpan = document.createElement('span');
      textSpan.className = 'city-item-name';
      textSpan.textContent = item.query;
      
      li.appendChild(clockIcon);
      li.appendChild(textSpan);
      
      li.addEventListener('click', async () => {
        showLoader();
        await loadWeatherData(item.query);
        hideLoader();
      });
      
      historyList.appendChild(li);
    });
    
    lucide.createIcons();
  }

  clearHistoryBtn.addEventListener('click', async () => {
    showLoader();
    try {
      const cleared = await API.clearHistory();
      renderHistoryList(cleared);
    } catch (err) {
      console.error(err);
    } finally {
      hideLoader();
    }
  });

  // --- Temperature Scale Controllers ---
  unitCBtn.addEventListener('click', () => {
    if (currentUnit === 'C') return;
    currentUnit = 'C';
    localStorage.setItem('aerotemp_unit', 'C');
    updateUnitToggleUI();
    renderDashboard();
  });

  unitFBtn.addEventListener('click', () => {
    if (currentUnit === 'F') return;
    currentUnit = 'F';
    localStorage.setItem('aerotemp_unit', 'F');
    updateUnitToggleUI();
    renderDashboard();
  });

  function updateUnitToggleUI() {
    if (currentUnit === 'C') {
      unitCBtn.classList.add('active');
      unitFBtn.classList.remove('active');
    } else {
      unitFBtn.classList.add('active');
      unitCBtn.classList.remove('active');
    }
  }

  function formatTemp(tempC) {
    if (currentUnit === 'F') {
      return Math.round((tempC * 9/5) + 32);
    }
    return Math.round(tempC);
  }

  // --- Ambient Background Logic Adjustment ---
  function updateDynamicAmbientBlobs(weatherMain) {
    const blob1 = document.getElementById('blob1');
    const blob2 = document.getElementById('blob2');
    const blob3 = document.getElementById('blob3');
    
    if (!blob1 || !blob2 || !blob3) return;

    // Shift glow color values matching local conditions
    // Standard hues: blue/purple/teal
    if (weatherMain === 'Clear') {
      blob1.style.background = 'radial-gradient(circle, var(--accent-yellow) 0%, transparent 70%)';
      blob2.style.background = 'radial-gradient(circle, var(--accent-teal) 0%, transparent 70%)';
      blob3.style.background = 'radial-gradient(circle, var(--accent-blue) 0%, transparent 70%)';
    } else if (weatherMain === 'Rain' || weatherMain === 'Drizzle') {
      blob1.style.background = 'radial-gradient(circle, #3b82f6 0%, transparent 70%)';
      blob2.style.background = 'radial-gradient(circle, #1e293b 0%, transparent 70%)';
      blob3.style.background = 'radial-gradient(circle, #475569 0%, transparent 70%)';
    } else if (weatherMain === 'Snow') {
      blob1.style.background = 'radial-gradient(circle, #93c5fd 0%, transparent 70%)';
      blob2.style.background = 'radial-gradient(circle, #f3f4f6 0%, transparent 70%)';
      blob3.style.background = 'radial-gradient(circle, var(--accent-blue) 0%, transparent 70%)';
    } else if (weatherMain === 'Thunderstorm') {
      blob1.style.background = 'radial-gradient(circle, var(--accent-purple) 0%, transparent 70%)';
      blob2.style.background = 'radial-gradient(circle, #0f172a 0%, transparent 70%)';
      blob3.style.background = 'radial-gradient(circle, var(--accent-red) 0%, transparent 70%)';
    } else { // Clouds, Haze, Mist...
      blob1.style.background = 'radial-gradient(circle, var(--accent-blue) 0%, transparent 70%)';
      blob2.style.background = 'radial-gradient(circle, var(--accent-purple) 0%, transparent 70%)';
      blob3.style.background = 'radial-gradient(circle, var(--accent-teal) 0%, transparent 70%)';
    }
  }

  // --- Extended 5-Day List Renderer ---
  function renderDailyExtendedForecastList(forecastList) {
    multidayListContainer.innerHTML = '';
    
    // Group forecastList (which has data for every 3 hours) by day
    const daysMap = new Map();
    
    forecastList.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toDateString(); // "Thu Jun 04 2026"
      
      if (!daysMap.has(dayKey)) {
        daysMap.set(dayKey, []);
      }
      daysMap.get(dayKey).push(item);
    });

    // Skip the first key if it only has 1 or 2 slots, or just grab the next 5 days
    let daysArray = Array.from(daysMap.keys()).slice(1, 6); // Grab next 5 distinct days
    if (daysArray.length < 5) {
      daysArray = Array.from(daysMap.keys()).slice(0, 5);
    }
    
    daysArray.forEach(dayKey => {
      const items = daysMap.get(dayKey);
      
      // Calculate min & max temp for that day
      let min = Infinity;
      let max = -Infinity;
      
      // Select weather state of mid-day if possible, or first item
      let midItem = items[Math.floor(items.length / 2)] || items[0];
      
      items.forEach(item => {
        if (item.main.temp < min) min = item.main.temp;
        if (item.main.temp > max) max = item.main.temp;
      });
      
      const dayDate = new Date(midItem.dt * 1000);
      const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNumStr = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const row = document.createElement('div');
      row.className = 'multiday-row';
      
      // Day Info
      const dayCol = document.createElement('div');
      dayCol.className = 'forecast-day';
      dayCol.textContent = dayName;
      const dateSpan = document.createElement('span');
      dateSpan.textContent = dayNumStr;
      dayCol.appendChild(dateSpan);
      
      // Icon
      const iconCol = document.createElement('div');
      iconCol.className = 'forecast-icon-wrapper';
      renderWeatherIcon(midItem.weather[0].main, iconCol, true);
      
      // Description
      const descCol = document.createElement('div');
      descCol.className = 'forecast-desc';
      descCol.textContent = midItem.weather[0].main;
      
      // Temps
      const tempCol = document.createElement('div');
      tempCol.className = 'forecast-temp';
      tempCol.textContent = `${formatTemp(max)}°`;
      const minSpan = document.createElement('span');
      minSpan.textContent = `${formatTemp(min)}°`;
      tempCol.appendChild(minSpan);
      
      row.appendChild(dayCol);
      row.appendChild(iconCol);
      row.appendChild(descCol);
      row.appendChild(tempCol);
      
      multidayListContainer.appendChild(row);
    });
  }

  // --- Chart.js Temperature Graph Renderer ---
  function renderHourlyForecastChart(hourlyData) {
    const labels = hourlyData.map(item => {
      const timeStr = item.dt_txt.split(' ')[1]; // "12:00:00"
      const hour = parseInt(timeStr.split(':')[0]);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const cleanHour = hour % 12 || 12;
      return `${cleanHour} ${ampm}`;
    });

    const temperatures = hourlyData.map(item => formatTemp(item.main.temp));

    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    // Destroy previous instance to avoid conflicts
    if (forecastChartInstance) {
      forecastChartInstance.destroy();
    }

    // Set chart colors & gradients
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

    forecastChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Temperature (°${currentUnit})`,
          data: temperatures,
          backgroundColor: gradient,
          borderColor: '#8b5cf6',
          borderWidth: 2,
          pointBackgroundColor: '#14b8a6',
          pointBorderColor: 'rgba(255,255,255,0.8)',
          pointHoverRadius: 6,
          pointRadius: 4,
          fill: true,
          tension: 0.4 // Curves curves line
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(18, 24, 38, 0.9)',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 12 },
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            displayColors: false,
            callbacks: {
              label: (context) => `Temp: ${context.raw}°${currentUnit}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { family: 'Inter', size: 11 }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            },
            ticks: {
              color: '#9ca3af',
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${val}°`
            }
          }
        }
      }
    });
  }

  // --- Helper Function: Format unix timestamps ---
  function formatDate(unixSecs) {
    const date = new Date(unixSecs * 1000);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  // --- Helper Function: Fetch Cardinal Wind direction ---
  function getWindDirection(deg) {
    if (!deg && deg !== 0) return 'Calm';
    const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    const idx = Math.round(deg / 45) % 8;
    return `From ${directions[idx]}`;
  }

  // --- Helper Function: Draw SVGs with Lucide tags dynamically ---
  function renderWeatherIcon(mainCondition, container, isMini = false) {
    container.innerHTML = '';
    
    const condition = mainCondition.toLowerCase();
    let iconName = 'cloud-sun';
    let extraClass = isMini ? '' : 'weather-large-icon';

    if (condition.includes('clear')) {
      iconName = 'sun';
    } else if (condition.includes('cloud')) {
      iconName = condition.includes('scatter') || condition.includes('few') ? 'cloud-sun' : 'cloud';
    } else if (condition.includes('rain') || condition.includes('drizzle')) {
      iconName = 'cloud-rain';
    } else if (condition.includes('snow')) {
      iconName = 'snowflake';
    } else if (condition.includes('thunderstorm') || condition.includes('storm')) {
      iconName = 'cloud-lightning';
    } else if (condition.includes('wind') || condition.includes('mist') || condition.includes('fog') || condition.includes('haze')) {
      iconName = 'wind';
    }

    const svgIcon = document.createElement('i');
    svgIcon.setAttribute('data-lucide', iconName);
    if (extraClass) svgIcon.className = extraClass;
    
    container.appendChild(svgIcon);
  }

  // --- Auth UI Helpers ---
  function showAlert(msg) {
    authAlert.querySelector('.alert-message').textContent = msg;
    authAlert.classList.remove('hidden');
  }

  function hideAlert() {
    authAlert.classList.add('hidden');
  }

  function setAuthLoading(isLoading, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    if (isLoading) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.querySelector('span').textContent = 'Processing...';
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.querySelector('span').textContent = btnId === 'loginSubmitBtn' ? 'Sign In' : 'Create Account';
    }
  }

  // --- Overlay Loader Helpers ---
  function showLoader() {
    dashboardLoader.classList.remove('hidden');
  }

  function hideLoader() {
    dashboardLoader.classList.add('hidden');
  }
});
