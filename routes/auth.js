const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createUser, findUserByEmail, findUserById } = require('../database');
const authenticate = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

/**
 * Generate a signed JWT for the given user id.
 */
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

// ── POST /register ──────────────────────────────────────────────────────────────

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || username.trim().length < 3) {
      return res
        .status(400)
        .json({ error: 'Username must be at least 3 characters.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters.' });
    }

    // Check for existing user
    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    // Hash & persist
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = createUser(username.trim(), email.toLowerCase(), passwordHash);

    const token = generateToken(user.id);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    // Handle UNIQUE constraint violations (username already taken, etc.)
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res
        .status(409)
        .json({ error: 'Username or email is already taken.' });
    }
    next(err);
  }
});

// ── POST /login ─────────────────────────────────────────────────────────────────

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required.' });
    }

    const user = findUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /me (protected) ─────────────────────────────────────────────────────────

router.get('/me', authenticate, (req, res, next) => {
  try {
    const user = findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
