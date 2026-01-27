const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');
const DEFAULT_ADMINS = [1179710266, 5670994230];

// ================== CORE FUNCTIONS ==================

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return createDefaultDB();
    }
    
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(data);
    
    // Ensure all required fields exist
    if (!db.settings) db.settings = getDefaultSettings();
    if (!db.admins) db.admins = DEFAULT_ADMINS;
    if (!db.premiumUsers) db.premiumUsers = [];
    if (!db.activeBots) db.activeBots = [];
    if (!db.users) db.users = {};
    
    return db;
  } catch (error) {
    console.error('Database read error:', error);
    return createDefaultDB();
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Database save error:', error);
    return false;
  }
}

function createDefaultDB() {
  const defaultDB = {
    users: {},
    premiumUsers: [],
    activeBots: [],
    admins: DEFAULT_ADMINS,
    settings: getDefaultSettings()
  };
  
  saveDB(defaultDB);
  return defaultDB;
}

function getDefaultSettings() {
  return {
    premiumPrice: 15000,
    premiumLimit: 5,
    regularLimit: 1
  };
}

// ================== SETTINGS FUNCTIONS ==================

function getSettings() {
  const db = readDB();
  const defaultSettings = getDefaultSettings();
  
  // Ensure all settings fields exist with defaults
  const settings = {
    ...defaultSettings,
    ...db.settings
  };
  
  // Convert to numbers
  settings.premiumPrice = Number(settings.premiumPrice) || defaultSettings.premiumPrice;
  settings.premiumLimit = Number(settings.premiumLimit) || defaultSettings.premiumLimit;
  settings.regularLimit = Number(settings.regularLimit) || defaultSettings.regularLimit;
  
  return settings;
}

function updateSettings(newSettings) {
  const db = readDB();
  
  // Initialize settings if not exists
  if (!db.settings) {
    db.settings = getDefaultSettings();
  }
  
  // Update only provided settings
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
  
  // Save and return updated settings
  const saved = saveDB(db);
  return saved ? getSettings() : null;
}

// ================== ADMIN FUNCTIONS ==================

function addAdmin(userId) {
  const db = readDB();
  userId = Number(userId);
  
  if (!db.admins.includes(userId)) {
    db.admins.push(userId);
    return saveDB(db);
  }
  return false;
}

function removeAdmin(userId) {
  const db = readDB();
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
  return db.admins.includes(Number(userId));
}

function getAllAdmins() {
  const db = readDB();
  return db.admins || DEFAULT_ADMINS;
}

// ================== USER FUNCTIONS ==================

function saveUser(userId, userData) {
  const db = readDB();
  userId = Number(userId);
  
  if (!db.users) db.users = {};
  db.users[userId] = {
    ...userData,
    id: userId,
    updatedAt: new Date().toISOString()
  };
  
  return saveDB(db);
}

function getUser(userId) {
  const db = readDB();
  return db.users ? db.users[Number(userId)] : null;
}

// ================== PREMIUM FUNCTIONS ==================

function addPremium(userId) {
  const db = readDB();
  userId = Number(userId);
  
  if (!db.premiumUsers.includes(userId)) {
    db.premiumUsers.push(userId);
    return saveDB(db);
  }
  return false;
}

function removePremium(userId) {
  const db = readDB();
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
  return db.premiumUsers.includes(Number(userId));
}

function getAllPremium() {
  const db = readDB();
  return db.premiumUsers || [];
}

// ================== BOT FUNCTIONS ==================

function addBot(botData) {
  const db = readDB();
  if (!db.activeBots) db.activeBots = [];
  
  botData.id = Date.now().toString();
  botData.createdAt = new Date().toISOString();
  botData.userId = Number(botData.userId);
  
  db.activeBots.push(botData);
  
  return saveDB(db) ? botData.id : null;
}

function getUserBots(userId) {
  const db = readDB();
  userId = Number(userId);
  
  if (!db.activeBots) return [];
  return db.activeBots.filter(bot => bot.userId === userId);
}

function removeBot(botId) {
  const db = readDB();
  if (!db.activeBots) return false;
  
  const initialLength = db.activeBots.length;
  db.activeBots = db.activeBots.filter(bot => bot.id !== botId);
  
  if (db.activeBots.length < initialLength) {
    return saveDB(db);
  }
  return false;
}

function getAllBots() {
  const db = readDB();
  return db.activeBots || [];
}

module.exports = {
  readDB,
  saveDB,
  
  // Admin
  addAdmin,
  removeAdmin,
  isAdmin,
  getAllAdmins,
  
  // User
  saveUser,
  getUser,
  
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
  
  // Settings
  getSettings,
  updateSettings,
  
  // Constants
  DEFAULT_ADMINS
};
