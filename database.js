const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');
const DEFAULT_ADMINS = [1179710266,5670994230];

// Baza yaratish
function initDB() {
  const defaultDB = {
    users: {},
    premiumUsers: [],
    activeBots: [],
    admins: DEFAULT_ADMINS,
    settings: {
      premiumPrice: 15000,
      premiumLimit: 5,
      regularLimit: 1
    }
  };

  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
    }
    return true;
  } catch (error) {
    console.error('DB init error:', error);
    return false;
  }
}

// Baza o'qish
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      initDB();
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('DB read error:', error);
    return null;
  }
}

// Baza saqlash
function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return true;
  } catch (error) {
    console.error('DB save error:', error);
    return false;
  }
}

// Sozlamalar
function getSettings() {
  const db = readDB();
  return db?.settings || {
    premiumPrice: 15000,
    premiumLimit: 5,
    regularLimit: 1
  };
}

function updateSettings(newSettings) {
  const db = readDB();
  if (!db) return false;

  if (newSettings.premiumPrice !== undefined) {
    const price = Number(newSettings.premiumPrice);
    if (!isNaN(price) && price >= 0) {
      db.settings.premiumPrice = price;
    }
  }

  if (newSettings.premiumLimit !== undefined) {
    const limit = Number(newSettings.premiumLimit);
    if (!isNaN(limit) && limit >= 1) {
      db.settings.premiumLimit = limit;
    }
  }

  if (newSettings.regularLimit !== undefined) {
    const limit = Number(newSettings.regularLimit);
    if (!isNaN(limit) && limit >= 1) {
      db.settings.regularLimit = limit;
    }
  }

  return saveDB(db);
}

// Admin funksiyalari
function addAdmin(userId) {
  const db = readDB();
  if (!db) return false;

  userId = Number(userId);
  if (!db.admins.includes(userId)) {
    db.admins.push(userId);
    return saveDB(db);
  }
  return false;
}

function removeAdmin(userId) {
  const db = readDB();
  if (!db) return false;

  userId = Number(userId);
  const index = db.admins.indexOf(userId);
  if (index > -1 && db.admins.length > 1) {
    db.admins.splice(index, 1);
    return saveDB(db);
  }
  return false;
}

function isAdmin(userId) {
  const db = readDB();
  return db?.admins.includes(Number(userId)) || false;
}

function getAllAdmins() {
  const db = readDB();
  return db?.admins || DEFAULT_ADMINS;
}

// Premium funksiyalari
function addPremium(userId) {
  const db = readDB();
  if (!db) return false;

  userId = Number(userId);
  if (!db.premiumUsers.includes(userId)) {
    db.premiumUsers.push(userId);
    return saveDB(db);
  }
  return false;
}

function removePremium(userId) {
  const db = readDB();
  if (!db) return false;

  userId = Number(userId);
  const index = db.premiumUsers.indexOf(userId);
  if (index > -1) {
    db.premiumUsers.splice(index, 1);
    return saveDB(db);
  }
  return false;
}

function isPremium(userId) {
  const db = readDB();
  return db?.premiumUsers.includes(Number(userId)) || false;
}

function getAllPremium() {
  const db = readDB();
  return db?.premiumUsers || [];
}

// Bot funksiyalari
function addBot(botData) {
  const db = readDB();
  if (!db) return null;

  if (!db.activeBots) db.activeBots = [];

  const botId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  const newBot = {
    id: botId,
    botName: botData.botName || `Bot_${botId.substr(-6)}`,
    server: botData.server || 'unknown',
    version: botData.version || '1.21.50',
    userId: Number(botData.userId),
    status: 'connected',
    createdAt: new Date().toISOString()
  };

  db.activeBots.push(newBot);
  return saveDB(db) ? botId : null;
}

function getUserBots(userId) {
  const db = readDB();
  if (!db?.activeBots) return [];

  userId = Number(userId);
  return db.activeBots.filter(bot => bot.userId === userId);
}

function removeBot(botId) {
  const db = readDB();
  if (!db?.activeBots) return false;

  const initialLength = db.activeBots.length;
  db.activeBots = db.activeBots.filter(bot => bot.id !== botId);

  if (db.activeBots.length < initialLength) {
    return saveDB(db);
  }
  return false;
}

function getAllBots() {
  const db = readDB();
  return db?.activeBots || [];
}

// Foydalanuvchi funksiyalari
function saveUser(userId, userData) {
  const db = readDB();
  if (!db) return false;

  if (!db.users) db.users = {};

  userId = Number(userId);
  db.users[userId] = {
    id: userId,
    username: userData.username || '',
    firstName: userData.firstName || '',
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };

  return saveDB(db);
}

function getUser(userId) {
  const db = readDB();
  return db?.users?.[Number(userId)] || null;
}

// Baza tozalash (opsional)
function cleanupDB() {
  const db = readDB();
  if (!db) return false;

  // 24 soatdan eski botlarni o'chirish
  if (db.activeBots) {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    db.activeBots = db.activeBots.filter(bot => {
      const botTime = new Date(bot.createdAt).getTime();
      return botTime > cutoffTime;
    });
  }

  return saveDB(db);
}

// Dastlab baza yaratish
initDB();

// Har 6 soatda tozalash
setInterval(cleanupDB, 6 * 60 * 60 * 1000);

module.exports = {
  // Admin
  addAdmin,
  removeAdmin,
  isAdmin,
  getAllAdmins,

  // Premium
  addPremium,
  removePremium,
  isPremium,
  getAllPremium,

  // Bot
  addBot,
  getUserBots,
  removeBot,
  getAllBots,

  // User
  saveUser,
  getUser,

  // Settings
  getSettings,
  updateSettings,

  // DB
  readDB,
  saveDB
};
