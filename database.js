const fs = require('fs');
const path = require('path');
const os = require('os');

const isVercel = process.env.VERCEL === '1';
const DB_DIR = isVercel ? path.join(os.tmpdir(), 'weather-app-data') : path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database directory and file exist
function initializeDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      favorites: [],
      search_history: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// Read database contents
function readDb() {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file, resetting database:', err);
    const initialData = { users: [], favorites: [], search_history: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }
}

// Write database contents atomically
function writeDb(data) {
  initializeDb();
  const tempFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Error writing to database:', err);
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
    }
    return false;
  }
}

// User helper methods
const users = {
  findByUsername(username) {
    const db = readDb();
    return db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  },

  findById(id) {
    const db = readDb();
    return db.users.find(u => u.id === id);
  },

  create(username, passwordHash) {
    const db = readDb();
    
    // Check if user already exists
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Username already exists');
    }

    const newUser = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      username,
      password: passwordHash,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDb(db);

    // Return user without password
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }
};

// Favorites helper methods
const favorites = {
  getByUserId(userId) {
    const db = readDb();
    return db.favorites
      .filter(f => f.userId === userId)
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  },

  add(userId, city) {
    const db = readDb();
    const cleanCity = city.trim();
    
    // Check if already in favorites
    const exists = db.favorites.some(
      f => f.userId === userId && f.city.toLowerCase() === cleanCity.toLowerCase()
    );

    if (exists) {
      return this.getByUserId(userId);
    }

    const newFav = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      userId,
      city: cleanCity,
      addedAt: new Date().toISOString()
    };

    db.favorites.push(newFav);
    writeDb(db);
    return this.getByUserId(userId);
  },

  remove(userId, city) {
    const db = readDb();
    const cleanCity = city.trim().toLowerCase();
    
    db.favorites = db.favorites.filter(
      f => !(f.userId === userId && f.city.toLowerCase() === cleanCity)
    );
    
    writeDb(db);
    return this.getByUserId(userId);
  }
};

// Search history helper methods
const searchHistory = {
  getByUserId(userId, limit = 10) {
    const db = readDb();
    return db.search_history
      .filter(h => h.userId === userId)
      .sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt))
      .slice(0, limit);
  },

  add(userId, query) {
    const db = readDb();
    const cleanQuery = query.trim();
    if (!cleanQuery) return this.getByUserId(userId);

    // Remove older duplicate searches to keep it clean and unique-ish
    db.search_history = db.search_history.filter(
      h => !(h.userId === userId && h.query.toLowerCase() === cleanQuery.toLowerCase())
    );

    const newSearch = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      userId,
      query: cleanQuery,
      searchedAt: new Date().toISOString()
    };

    db.search_history.push(newSearch);

    // Limit overall storage per user to 50 records to save memory/disk
    const userSearches = db.search_history.filter(h => h.userId === userId);
    if (userSearches.length > 50) {
      const oldestToKeep = userSearches
        .sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt))
        .slice(0, 50);
      const oldestIds = new Set(oldestToKeep.map(h => h.id));
      
      db.search_history = db.search_history.filter(
        h => h.userId !== userId || oldestIds.has(h.id)
      );
    }

    writeDb(db);
    return this.getByUserId(userId);
  },

  clear(userId) {
    const db = readDb();
    db.search_history = db.search_history.filter(h => h.userId !== userId);
    writeDb(db);
    return [];
  }
};

module.exports = {
  users,
  favorites,
  searchHistory,
  initializeDb
};
