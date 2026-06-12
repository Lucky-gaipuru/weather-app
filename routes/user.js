const express = require('express');
const authenticate = require('../middleware/auth');
const {
  addFavorite,
  removeFavorite,
  getFavorites,
  getHistory,
  clearHistory,
} = require('../database');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// ── GET /favorites ──────────────────────────────────────────────────────────────

router.get('/favorites', (req, res, next) => {
  try {
    const favorites = getFavorites(req.user.id);
    res.json({ favorites });
  } catch (err) {
    next(err);
  }
});

// ── POST /favorites ─────────────────────────────────────────────────────────────

router.post('/favorites', (req, res, next) => {
  try {
    const { city_name, country, lat, lon } = req.body;

    if (!city_name || !city_name.trim()) {
      return res.status(400).json({ error: 'city_name is required.' });
    }

    const favorite = addFavorite(
      req.user.id,
      city_name.trim(),
      country,
      lat,
      lon
    );

    res.status(201).json({ favorite });
  } catch (err) {
    // Handle duplicate favorite
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'City is already in favorites.' });
    }
    next(err);
  }
});

// ── DELETE /favorites/:id ───────────────────────────────────────────────────────

router.delete('/favorites/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const result = removeFavorite(Number(id), req.user.id);

    if (result.changes === 0) {
      return res
        .status(404)
        .json({ error: 'Favorite not found or does not belong to you.' });
    }

    res.json({ message: 'Favorite removed.' });
  } catch (err) {
    next(err);
  }
});

// ── GET /history ────────────────────────────────────────────────────────────────

router.get('/history', (req, res, next) => {
  try {
    const history = getHistory(req.user.id, 20);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /history ─────────────────────────────────────────────────────────────

router.delete('/history', (req, res, next) => {
  try {
    clearHistory(req.user.id);
    res.json({ message: 'Search history cleared.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
