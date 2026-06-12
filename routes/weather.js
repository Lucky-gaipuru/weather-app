const express = require('express');
const authenticate = require('../middleware/auth');
const { addHistory } = require('../db/database');

const router = express.Router();

// All weather routes require authentication
router.use(authenticate);

// ── In-memory cache (Map with TTL) ──────────────────────────────────────────────

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Return cached data if it exists and hasn't expired, otherwise null.
 */
const getCached = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

/**
 * Store data in the cache with the current timestamp.
 */
const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

/**
 * Build the OpenWeatherMap URL for a given endpoint.
 */
const buildOwmUrl = (endpoint, query) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const base = `https://api.openweathermap.org/data/2.5/${endpoint}`;

  if (query.lat && query.lon) {
    return `${base}?lat=${query.lat}&lon=${query.lon}&appid=${apiKey}&units=metric`;
  }
  return `${base}?q=${encodeURIComponent(query.city)}&appid=${apiKey}&units=metric`;
};

// ── GET /current ────────────────────────────────────────────────────────────────

router.get('/current', async (req, res, next) => {
  try {
    const { city, lat, lon } = req.query;

    if (!city && !(lat && lon)) {
      return res
        .status(400)
        .json({ error: 'Provide a "city" query param or "lat" and "lon".' });
    }

    const cacheKey = `current:${city || `${lat},${lon}`}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const url = buildOwmUrl('weather', { city, lat, lon });
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorBody.message || 'Failed to fetch weather data.',
      });
    }

    const data = await response.json();
    setCache(cacheKey, data);

    // Save to search history
    const cityName = data.name || city || `${lat},${lon}`;
    addHistory(req.user.id, cityName);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /forecast ───────────────────────────────────────────────────────────────

router.get('/forecast', async (req, res, next) => {
  try {
    const { city, lat, lon } = req.query;

    if (!city && !(lat && lon)) {
      return res
        .status(400)
        .json({ error: 'Provide a "city" query param or "lat" and "lon".' });
    }

    const cacheKey = `forecast:${city || `${lat},${lon}`}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const url = buildOwmUrl('forecast', { city, lat, lon });
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorBody.message || 'Failed to fetch forecast data.',
      });
    }

    const data = await response.json();
    setCache(cacheKey, data);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
