const fs = require('fs');
const path = require('path');
const os = require('os');

const isVercel = process.env.VERCEL === '1';
const DB_DIR = isVercel ? path.join(os.tmpdir(), 'weather-app-data') : path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

function initializeDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialData = { users: [], favorites: [], search_history: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

function readDb() {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    const initialData = { users: [], favorites: [], search_history: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }
}

function writeDb(data) {
  initializeDb();
  const tempFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
    }
    return false;
  }
}

function createUser(username, email, passwordHash) {
  const db = readDb();
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === email.toLowerCase()))) {
    throw new Error('UNIQUE constraint failed');
  }
  const newUser = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    username,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  };
  db.users.push(newUser);
  writeDb(db);
  return newUser;
}

function findUserByEmail(email) {
  const db = readDb();
  return db.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id) {
  const db = readDb();
  return db.users.find(u => u.id === id);
}

function getFavorites(userId) {
  const db = readDb();
  return db.favorites
    .filter(f => f.userId === userId)
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
}

function addFavorite(userId, cityName, country, lat, lon) {
  const db = readDb();
  const cleanCity = cityName.trim();
  const exists = db.favorites.some(f => f.userId === userId && f.city_name.toLowerCase() === cleanCity.toLowerCase());
  if (exists) {
    throw new Error('UNIQUE constraint failed');
  }
  const newFav = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    userId,
    city_name: cleanCity,
    country,
    lat,
    lon,
    addedAt: new Date().toISOString()
  };
  db.favorites.push(newFav);
  writeDb(db);
  return newFav;
}

function removeFavorite(id, userId) {
  const db = readDb();
  const strId = String(id);
  const initialLength = db.favorites.length;
  db.favorites = db.favorites.filter(f => !(String(f.id) === strId && f.userId === userId));
  writeDb(db);
  return { changes: initialLength - db.favorites.length };
}

function getHistory(userId, limit = 10) {
  const db = readDb();
  return db.search_history
    .filter(h => h.userId === userId)
    .sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt))
    .slice(0, limit);
}

function addHistory(userId, cityName) {
  const db = readDb();
  const cleanCity = cityName.trim();
  if (!cleanCity) return;
  db.search_history = db.search_history.filter(h => !(h.userId === userId && h.city_name && h.city_name.toLowerCase() === cleanCity.toLowerCase()));
  const newSearch = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    userId,
    city_name: cleanCity,
    searchedAt: new Date().toISOString()
  };
  db.search_history.push(newSearch);
  const userSearches = db.search_history.filter(h => h.userId === userId);
  if (userSearches.length > 50) {
    const oldestToKeep = userSearches.sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt)).slice(0, 50);
    const oldestIds = new Set(oldestToKeep.map(h => h.id));
    db.search_history = db.search_history.filter(h => h.userId !== userId || oldestIds.has(h.id));
  }
  writeDb(db);
}

function clearHistory(userId) {
  const db = readDb();
  db.search_history = db.search_history.filter(h => h.userId !== userId);
  writeDb(db);
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  addFavorite,
  removeFavorite,
  getFavorites,
  getHistory,
  addHistory,
  clearHistory,
  initializeDb
};
