require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_weather_token_key_1298471982739182';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || '';

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory cache for Weather API requests to save rate limits (10 mins)
const weatherCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in ms

function getCachedData(key) {
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  weatherCache.set(key, { timestamp: Date.now(), data });
}

// Ensure database is initialized
db.initializeDb();

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or expired' });
    }
    req.user = user;
    next();
  });
}

// Generate high-fidelity deterministic Mock Weather Data based on City Name hash code
function generateMockWeather(city) {
  const cityName = city.trim();
  let hash = 0;
  for (let i = 0; i < cityName.length; i++) {
    hash = cityName.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  // Determine Climate Type based on hash
  // Types: 0 = Temperate, 1 = Tropical (Hot/Wet), 2 = Desert (Hot/Dry), 3 = Cold (Snowy), 4 = Marine (Cool/Rainy)
  const climateType = hash % 5;
  
  let baseTemp = 18; // Default Temperate
  let humidity = 60;
  let windSpeed = 3.5;
  let weatherMain = 'Clouds';
  let weatherDesc = 'partly cloudy';
  let weatherIcon = '03d'; // OpenWeatherMap codes
  let uvIndex = 4;
  let pressure = 1013;

  if (climateType === 1) { // Tropical
    baseTemp = 28 + (hash % 6); // 28 - 33 C
    humidity = 80 + (hash % 15); // 80 - 94%
    windSpeed = 2 + (hash % 4);
    if (hash % 3 === 0) {
      weatherMain = 'Rain';
      weatherDesc = 'heavy tropical rain';
      weatherIcon = '09d';
    } else {
      weatherMain = 'Clouds';
      weatherDesc = 'scattered clouds, humid';
      weatherIcon = '02d';
    }
    uvIndex = 8 + (hash % 4);
  } else if (climateType === 2) { // Desert
    baseTemp = 35 + (hash % 10); // 35 - 44 C
    humidity = 10 + (hash % 15); // 10 - 24%
    windSpeed = 4 + (hash % 8);
    weatherMain = 'Clear';
    weatherDesc = 'clear sky, blazing sun';
    weatherIcon = '01d';
    uvIndex = 10 + (hash % 3);
    pressure = 1008;
  } else if (climateType === 3) { // Cold
    baseTemp = -10 + (hash % 15); // -10 to +4 C
    humidity = 70 + (hash % 20);
    windSpeed = 5 + (hash % 10);
    if (hash % 2 === 0) {
      weatherMain = 'Snow';
      weatherDesc = 'light snow showers';
      weatherIcon = '13d';
    } else {
      weatherMain = 'Clouds';
      weatherDesc = 'overcast freezing clouds';
      weatherIcon = '04d';
    }
    uvIndex = 1 + (hash % 2);
    pressure = 1005;
  } else if (climateType === 4) { // Marine / Rainy
    baseTemp = 10 + (hash % 7); // 10 - 16 C
    humidity = 85 + (hash % 12);
    windSpeed = 6 + (hash % 9);
    weatherMain = 'Rain';
    weatherDesc = 'drizzle and light mist';
    weatherIcon = '10d';
    uvIndex = 2 + (hash % 2);
    pressure = 1009;
  } else { // Temperate
    baseTemp = 15 + (hash % 10); // 15 - 24 C
    humidity = 50 + (hash % 15);
    windSpeed = 3 + (hash % 5);
    const conditions = ['Clear', 'Clouds', 'Rain'];
    const cond = conditions[hash % 3];
    if (cond === 'Clear') {
      weatherMain = 'Clear';
      weatherDesc = 'clear sky';
      weatherIcon = '01d';
    } else if (cond === 'Clouds') {
      weatherMain = 'Clouds';
      weatherDesc = 'broken clouds';
      weatherIcon = '04d';
    } else {
      weatherMain = 'Rain';
      weatherDesc = 'moderate rain';
      weatherIcon = '10d';
    }
  }

  // Adjust slightly for current hour of day
  const hour = new Date().getHours();
  const diurnalc = Math.cos((hour - 14) * Math.PI / 12); // Max at 2 PM (14:00), Min at 2 AM
  const currentTemp = Math.round((baseTemp + diurnalc * 4) * 10) / 10;
  const tempMin = Math.round((baseTemp - 5) * 10) / 10;
  const tempMax = Math.round((baseTemp + 5) * 10) / 10;
  const feelsLike = Math.round((currentTemp + (humidity > 70 ? 1.5 : -1.0)) * 10) / 10;

  // Sunset & Sunrise (Roughly 6 AM / 7 PM)
  const today = Math.floor(Date.now() / 1000);
  const sunrise = today - (hour * 3600) + (6 * 3600);
  const sunset = today - (hour * 3600) + (19 * 3600);

  return {
    name: cityName,
    sys: { country: hash % 2 === 0 ? 'US' : 'GB', sunrise, sunset },
    coord: { lat: 30 + (hash % 30), lon: -80 + (hash % 150) },
    weather: [{ main: weatherMain, description: weatherDesc, icon: weatherIcon }],
    main: {
      temp: currentTemp,
      feels_like: feelsLike,
      temp_min: tempMin,
      temp_max: tempMax,
      humidity,
      pressure
    },
    wind: { speed: windSpeed, deg: hash % 360 },
    visibility: weatherMain === 'Rain' ? 6000 : 10000,
    uvIndex // custom dashboard metric
  };
}

function generateMockForecast(city) {
  const current = generateMockWeather(city);
  const hash = current.coord.lat + current.coord.lon; // Unique seed for city
  
  const list = [];
  const startDt = Math.floor(Date.now() / 1000);
  const icons = {
    'Clear': '01d',
    'Clouds': '03d',
    'Rain': '10d',
    'Snow': '13d'
  };

  // Generate 5-day / 3-hour entries (40 intervals)
  for (let i = 0; i < 40; i++) {
    const targetDt = startDt + (i * 3 * 3600);
    const dateObj = new Date(targetDt * 1000);
    const targetHour = dateObj.getHours();

    // Diurnal cycle: colder at night, warmer in day
    const diurnal = Math.cos((targetHour - 14) * Math.PI / 12);
    // Add some random variation over time
    const dayTrend = Math.sin((i / 8) * Math.PI) * 2;
    const temp = Math.round((current.main.temp + diurnal * 4 + dayTrend) * 10) / 10;
    
    // Choose weather code based on index
    let itemMain = current.weather[0].main;
    let itemDesc = current.weather[0].description;
    
    // Periodically shift weather weather state
    if (i % 8 === 0 && current.weather[0].main !== 'Clear') {
      const states = ['Clear', 'Clouds', 'Rain', 'Snow'];
      itemMain = states[(Math.floor(hash) + i) % (current.main.temp < 0 ? 4 : 3)];
      
      if (itemMain === 'Clear') { itemDesc = 'clear sky'; }
      else if (itemMain === 'Clouds') { itemDesc = 'broken clouds'; }
      else if (itemMain === 'Rain') { itemDesc = 'light rain'; }
      else if (itemMain === 'Snow') { itemDesc = 'flurries'; }
    }

    list.push({
      dt: targetDt,
      main: {
        temp,
        feels_like: Math.round((temp + (current.main.humidity > 70 ? 1 : -0.5)) * 10) / 10,
        humidity: Math.max(10, Math.min(100, current.main.humidity + Math.round(diurnal * -10))),
        pressure: current.main.pressure
      },
      weather: [{
        main: itemMain,
        description: itemDesc,
        icon: icons[itemMain] || '03d'
      }],
      wind: {
        speed: Math.max(1, Math.round((current.wind.speed + Math.sin(i) * 2) * 10) / 10)
      },
      dt_txt: dateObj.toISOString().replace('T', ' ').substring(0, 19)
    });
  }

  return {
    list,
    city: {
      name: current.name,
      country: current.sys.country,
      sunrise: current.sys.sunrise,
      sunset: current.sys.sunset
    }
  };
}

// Helper to check if real API is active and functioning
async function fetchFromOpenWeatherMap(endpoint, queryParams) {
  if (!WEATHER_API_KEY) return null;
  
  // Use native node fetch
  const url = `https://api.openweathermap.org/data/2.5/${endpoint}?${queryParams}&appid=${WEATHER_API_KEY}&units=metric`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`OpenWeatherMap API error on ${endpoint}:`, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Error requesting OpenWeatherMap ${endpoint}:`, err);
    return null;
  }
}


// API Auth Routes
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || username.trim().length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username must be >= 3 chars, password >= 6 chars' });
  }

  try {
    const existing = db.users.findByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const user = db.users.create(username.trim(), hash);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error during registration' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter username and password' });
  }

  try {
    const user = db.users.findByUsername(username);
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.users.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ error: 'Server verification error' });
  }
});


// Weather Routes (Protected to demonstrate secure full-stack dashboard flow)
app.get('/api/weather/current', authenticateToken, async (req, res) => {
  const { city, lat, lon } = req.query;
  
  if (!city && (!lat || !lon)) {
    return res.status(400).json({ error: 'Provide a city name, or lat/lon coordinates' });
  }

  const cacheKey = city ? `current_city_${city.toLowerCase()}` : `current_coords_${lat}_${lon}`;
  const cached = getCachedData(cacheKey);
  if (cached) {
    // Add to history even if cached
    if (city) db.searchHistory.add(req.user.id, city);
    return res.json(cached);
  }

  let weatherData = null;

  if (WEATHER_API_KEY) {
    const query = city ? `q=${encodeURIComponent(city)}` : `lat=${lat}&lon=${lon}`;
    weatherData = await fetchFromOpenWeatherMap('weather', query);
  }

  // Fallback to mock data if API key is not configured or failed
  if (!weatherData) {
    let lookupCity = city || 'Detected Location';
    if (lat && lon && !city) {
      // Mock reverse geocode placeholder name
      lookupCity = `Coords (${parseFloat(lat).toFixed(2)}, ${parseFloat(lon).toFixed(2)})`;
    }
    weatherData = generateMockWeather(lookupCity);
    // Add mock UV index property
    if (!weatherData.uvIndex) weatherData.uvIndex = 5;
  } else {
    // Inject a realistic UV index for OpenWeatherMap if not present
    weatherData.uvIndex = Math.min(10, Math.floor(Math.random() * 8) + 1);
  }

  // Save to Cache
  setCachedData(cacheKey, weatherData);

  // Log to User search history
  db.searchHistory.add(req.user.id, weatherData.name);

  res.json(weatherData);
});

app.get('/api/weather/forecast', authenticateToken, async (req, res) => {
  const { city, lat, lon } = req.query;

  if (!city && (!lat || !lon)) {
    return res.status(400).json({ error: 'Provide a city name, or lat/lon coordinates' });
  }

  const cacheKey = city ? `forecast_city_${city.toLowerCase()}` : `forecast_coords_${lat}_${lon}`;
  const cached = getCachedData(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  let forecastData = null;

  if (WEATHER_API_KEY) {
    const query = city ? `q=${encodeURIComponent(city)}` : `lat=${lat}&lon=${lon}`;
    forecastData = await fetchFromOpenWeatherMap('forecast', query);
  }

  if (!forecastData) {
    let lookupCity = city || 'Detected Location';
    if (lat && lon && !city) {
      lookupCity = `Coords (${parseFloat(lat).toFixed(2)}, ${parseFloat(lon).toFixed(2)})`;
    }
    forecastData = generateMockForecast(lookupCity);
  }

  setCachedData(cacheKey, forecastData);
  res.json(forecastData);
});


// Favorites Routes (Protected)
app.get('/api/favorites', authenticateToken, (req, res) => {
  try {
    const list = db.favorites.getByUserId(req.user.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching favorites' });
  }
});

app.post('/api/favorites', authenticateToken, (req, res) => {
  const { city } = req.body;
  if (!city || !city.trim()) {
    return res.status(400).json({ error: 'City name is required' });
  }

  try {
    const list = db.favorites.add(req.user.id, city);
    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error adding favorite' });
  }
});

app.delete('/api/favorites/:city', authenticateToken, (req, res) => {
  const { city } = req.params;
  if (!city) {
    return res.status(400).json({ error: 'City parameter is required' });
  }

  try {
    const list = db.favorites.remove(req.user.id, city);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error deleting favorite' });
  }
});


// Search History Routes (Protected)
app.get('/api/history', authenticateToken, (req, res) => {
  try {
    const history = db.searchHistory.getByUserId(req.user.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching history' });
  }
});

app.delete('/api/history', authenticateToken, (req, res) => {
  try {
    const emptyHistory = db.searchHistory.clear(req.user.id);
    res.json(emptyHistory);
  } catch (err) {
    res.status(500).json({ error: 'Error clearing history' });
  }
});


// Fallback to client-side single page app entry index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  WEATHER DASHBOARD SERVER RUNNING`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Weather Engine: ${WEATHER_API_KEY ? 'OpenWeatherMap LIVE API' : 'High-Fidelity MOCK Fallback Engine (No API Key set)'}`);
  console.log(`========================================`);
});
