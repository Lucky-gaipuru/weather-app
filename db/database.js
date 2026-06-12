const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'weather.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    city_name  TEXT    NOT NULL,
    country    TEXT,
    lat        REAL,
    lon        REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, city_name)
  );

  CREATE TABLE IF NOT EXISTS search_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    city_name   TEXT    NOT NULL,
    searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── User helpers ────────────────────────────────────────────────────────────────

const createUser = (username, email, passwordHash) => {
  const stmt = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  );
  const result = stmt.run(username, email, passwordHash);
  return findUserById(result.lastInsertRowid);
};

const findUserByEmail = (email) => {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
};

const findUserById = (id) => {
  const stmt = db.prepare(
    'SELECT id, username, email, created_at FROM users WHERE id = ?'
  );
  return stmt.get(id);
};

// ── Favorites helpers ───────────────────────────────────────────────────────────

const addFavorite = (userId, cityName, country, lat, lon) => {
  const stmt = db.prepare(
    'INSERT INTO favorites (user_id, city_name, country, lat, lon) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(userId, cityName, country || null, lat || null, lon || null);
  return { id: result.lastInsertRowid, user_id: userId, city_name: cityName, country, lat, lon };
};

const removeFavorite = (id, userId) => {
  const stmt = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?');
  return stmt.run(id, userId);
};

const getFavorites = (userId) => {
  const stmt = db.prepare(
    'SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(userId);
};

// ── Search history helpers ──────────────────────────────────────────────────────

const addHistory = (userId, cityName) => {
  const stmt = db.prepare(
    'INSERT INTO search_history (user_id, city_name) VALUES (?, ?)'
  );
  return stmt.run(userId, cityName);
};

const getHistory = (userId, limit = 20) => {
  const stmt = db.prepare(
    'SELECT * FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT ?'
  );
  return stmt.all(userId, limit);
};

const clearHistory = (userId) => {
  const stmt = db.prepare('DELETE FROM search_history WHERE user_id = ?');
  return stmt.run(userId);
};

module.exports = {
  db,
  createUser,
  findUserByEmail,
  findUserById,
  addFavorite,
  removeFavorite,
  getFavorites,
  addHistory,
  getHistory,
  clearHistory,
};
