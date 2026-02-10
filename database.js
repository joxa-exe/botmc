// database.js
const fs = require('fs');
const path = require('path');

// ===================== FILES =====================
const usersFile = path.join(__dirname, 'users.json');
const botsFile = path.join(__dirname, 'bots.json');
const adminsFile = path.join(__dirname, 'admins.json');

// ===================== HELPERS =====================
function readJSON(file) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '{}', 'utf8');
    return {};
  }
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error(`❌ ${file} o'qishda xato:`, error.message);
    return {};
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`❌ ${file} yozishda xato:`, error.message);
    return false;
  }
}

// ===================== USERS =====================
function saveUser(userId, info) {
  const users = readJSON(usersFile);
  const id = userId.toString();
  
  if (!users[id]) {
    users[id] = {
      id: id,
      createdAt: new Date().toISOString(),
      ...info
    };
  } else {
    users[id] = { ...users[id], ...info, updatedAt: new Date().toISOString() };
  }
  
  writeJSON(usersFile, users);
  return users[id];
}

function getUser(userId) {
  const users = readJSON(usersFile);
  return users[userId.toString()] || null;
}

function getAllUserIds() {
  const users = readJSON(usersFile);
  return Object.keys(users);
}

function isPremium(userId) {
  const user = getUser(userId.toString());
  return !!(user && user.premium === true);
}

function addPremium(userId) {
  const users = readJSON(usersFile);
  const id = userId.toString();
  
  if (!users[id]) {
    users[id] = {
      id: id,
      premium: true,
      premiumSince: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  } else {
    users[id].premium = true;
    users[id].premiumSince = users[id].premiumSince || new Date().toISOString();
    users[id].updatedAt = new Date().toISOString();
  }
  
  writeJSON(usersFile, users);
  return true;
}

function removePremium(userId) {
  const users = readJSON(usersFile);
  const id = userId.toString();
  
  if (users[id]) {
    users[id].premium = false;
    users[id].premiumRemoved = new Date().toISOString();
    users[id].updatedAt = new Date().toISOString();
    writeJSON(usersFile, users);
  }
  
  return true;
}

function isBanned(userId) {
  const user = getUser(userId.toString());
  return !!(user && user.banned === true);
}

// ===================== SETTINGS =====================
function getSettings() {
  return {
    regularLimit: 1,
    premiumLimit: 5,
    premiumPrice: 5000, // so'm
    ddosBotCount: 2,
    ddosDuration: 5000 // 5 soniya
  };
}

// ===================== ADMINS =====================
function getAllAdmins() {
  const admins = readJSON(adminsFile);
  return Object.keys(admins);
}

function isAdmin(userId) {
  const admins = readJSON(adminsFile);
  const id = userId.toString();
  return !!admins[id];
}

function addAdmin(userId) {
  const admins = readJSON(adminsFile);
  const id = userId.toString();
  
  if (!admins[id]) {
    admins[id] = {
      id: id,
      addedAt: new Date().toISOString(),
      addedBy: 'system'
    };
    writeJSON(adminsFile, admins);
    return true;
  }
  return false;
}

function removeAdmin(userId) {
  const admins = readJSON(adminsFile);
  const id = userId.toString();
  
  if (admins[id]) {
    delete admins[id];
    writeJSON(adminsFile, admins);
    return true;
  }
  return false;
}

// ===================== BOTS =====================
function getUserBots(userId) {
  const bots = readJSON(botsFile);
  const id = userId.toString();
  
  return Object.values(bots).filter(bot => bot.userId === id);
}

function addBot(bot) {
  const bots = readJSON(botsFile);
  
  if (!bot.id) {
    bot.id = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  if (!bot.createdAt) {
    bot.createdAt = new Date().toISOString();
  }
  
  if (!bot.status) {
    bot.status = 'online';
  }
  
  bots[bot.id] = bot;
  writeJSON(botsFile, bots);
  return bot.id;
}

function removeBot(botId) {
  const bots = readJSON(botsFile);
  
  if (bots[botId]) {
    delete bots[botId];
    writeJSON(botsFile, bots);
    return true;
  }
  return false;
}

function getBot(botId) {
  const bots = readJSON(botsFile);
  return bots[botId] || null;
}

function getAllBots() {
  const bots = readJSON(botsFile);
  return Object.values(bots);
}

function updateBotStatus(botId, status) {
  const bots = readJSON(botsFile);
  
  if (bots[botId]) {
    bots[botId].status = status;
    bots[botId].lastStatusChange = new Date().toISOString();
    writeJSON(botsFile, bots);
    return true;
  }
  return false;
}

// ===================== STATISTICS =====================
function getStats() {
  const users = readJSON(usersFile);
  const bots = readJSON(botsFile);
  const admins = readJSON(adminsFile);
  
  const totalUsers = Object.keys(users).length;
  const totalBots = Object.keys(bots).length;
  const premiumUsers = Object.values(users).filter(u => u.premium).length;
  const onlineBots = Object.values(bots).filter(b => b.status === 'online').length;
  
  return {
    totalUsers,
    totalBots,
    premiumUsers,
    onlineBots,
    totalAdmins: Object.keys(admins).length
  };
}

// ===================== EXPORT =====================
module.exports = {
  // JSON helpers
  readJSON,
  writeJSON,
  
  // Users
  saveUser,
  getUser,
  getAllUserIds,
  isPremium,
  addPremium,
  removePremium,
  isBanned,
  
  // Settings
  getSettings,
  
  // Admins
  getAllAdmins,
  isAdmin,
  addAdmin,
  removeAdmin,
  
  // Bots
  getUserBots,
  addBot,
  removeBot,
  getBot,
  getAllBots,
  updateBotStatus,
  
  // Stats
  getStats
};
