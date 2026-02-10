const bedrock = require('bedrock-protocol');
const dns = require('dns');
const net = require('net');
const path = require('path');
const fs = require('fs');

const {
  addBot,
  getUserBots,
  getSettings,
  isPremium,
  removeBot,
  saveUser,
  isBanned,
  readJSON, // ⬅️ QO'SHILDI
  writeJSON // ⬅️ QO'SHILDI
} = require('./database.js');

/* ===============================
   🌍 GLOBAL STATE
================================ */
global.mcActiveConnections = global.mcActiveConnections || new Map();
const activeConnections = global.mcActiveConnections;

// JSON fayl yo'llari
const botsFile = path.join(__dirname, 'bots.json');
const usersFile = path.join(__dirname, 'users.json');

/* ===============================
   🔍 DNS RESOLVE
================================ */
async function resolveDNS(hostname) {
  if (net.isIP(hostname)) return hostname;
  try {
    const res = await dns.promises.resolve4(hostname);
    return res[0] || hostname;
  } catch {
    return hostname;
  }
}

/* ===============================
   🤖 BOT NOMI
================================ */
function generateBotName(userId) {
  const bots = getUserBots(userId);
  const count = bots.filter(b => b.userId === userId).length;
  return `TELEGRAM_MCPEBot_${userId}_${count + 1}`;
}

/* ===============================
   🚀 BOT YARATISH
================================ */
async function createMinecraftBot({ ip, port, version, userId }) {
  const userIdStr = userId.toString();

  // 🚫 BAN TEKSHIRISH
  if (isBanned(userIdStr)) {
    throw new Error('🚫 Siz ban qilingansiz');
  }

  // 🔢 LIMITLAR TEKSHIRISH
  const userBots = getUserBots(userIdStr);
  const premium = isPremium(userIdStr);
  const settings = getSettings();
  
  const limit = premium ? (settings.premiumLimit || 5) : (settings.regularLimit || 1);

  if (userBots.length >= limit) {
    throw new Error(premium 
      ? `❌ Premium limit: ${userBots.length}/${limit} ta bot` 
      : `❌ Oddiy limit: 1 ta bot\n💎 Premium bilan ${limit} ta bo'ladi`
    );
  }

  const host = await resolveDNS(ip);
  const serverPort = parseInt(port) || 19132;

  return new Promise((resolve, reject) => {
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const botName = generateBotName(userIdStr);

    let client;
    let connected = false;
    let timeoutId;

    try {
      client = bedrock.createClient({
        host: host,
        port: serverPort,
        username: botName,
        offline: true,
        version: version,
        viewDistance: 0,
        authTitle: false,
        skipPing: true
      });

      client.botId = botId;
      client.userId = userIdStr;

      // ⏱ Connection timeout (30 soniya)
      timeoutId = setTimeout(() => {
        if (!connected) {
          client.close();
          reject(new Error('❌ Serverga ulanish vaqti tugadi (30s)'));
        }
      }, 30000);

      /* ===== SPAWN ===== */
      client.once('spawn', () => {
        clearTimeout(timeoutId);
        connected = true;
        
        activeConnections.set(botId, client);

        // Botni bazaga qo'shish
        addBot({
          id: botId,
          userId: userIdStr,
          botName: botName,
          ip: host,
          port: serverPort,
          server: `${host}:${serverPort}`,
          version: version,
          status: 'online',
          connectedAt: new Date().toISOString()
        });

        // Foydalanuvchi ma'lumotlarini yangilash
        saveUser(userIdStr, {
          lastBotAdded: new Date().toISOString(),
          totalBots: (userBots.length + 1)
        });

        resolve({
          success: true,
          message: `✅ Bot qo'shildi!\n\n🤖 ${botName}\n🌐 ${host}:${serverPort}\n📦 ${version}\n🟢 Holat: Online`
        });
      });

      /* ===== DISCONNECT ===== */
      client.on('disconnect', (reason) => {
        clearTimeout(timeoutId);
        activeConnections.delete(botId);
        
        // Bot holatini "offline" ga o'zgartirish
        try {
          const bots = JSON.parse(fs.readFileSync(botsFile, 'utf8') || '{}');
          if (bots[botId]) {
            bots[botId].status = 'offline';
            bots[botId].disconnectedAt = new Date().toISOString();
            bots[botId].disconnectReason = reason;
            fs.writeFileSync(botsFile, JSON.stringify(bots, null, 2), 'utf8');
          }
        } catch (err) {
          console.error('❌ Bot holatini yangilashda xato:', err.message);
        }
        
        console.log(`🤖 Bot disconnect: ${botName} (${reason || 'noma\'lum'})`);
      });

      /* ===== ERROR ===== */
      client.on('error', (err) => {
        clearTimeout(timeoutId);
        activeConnections.delete(botId);
        console.error(`❌ Bot xatosi (${botName}):`, err.message);
        
        if (!connected) {
          reject(new Error(`❌ Serverga ulanish mumkin emas: ${err.message}`));
        }
      });

    } catch (err) {
      clearTimeout(timeoutId);
      console.error('❌ Bot yaratishda xato:', err.message);
      reject(new Error('❌ Bot yaratishda texnik xatolik'));
    }
  });
}

/* ===============================
   ⛔ BOTNI TO'XTATISH
================================ */
async function stopBot(botId, userId = null) {
  // Agar userId berilsa, premium tekshirish
  if (userId && !isPremium(userId.toString())) {
    throw new Error('❌ Oddiy foydalanuvchi botni o\'chira olmaydi');
  }

  const client = activeConnections.get(botId);

  if (client) {
    try {
      client.close();
    } catch (err) {
      console.error('❌ Botni yopishda xato:', err.message);
    }
  }

  activeConnections.delete(botId);
  removeBot(botId);

  return { success: true, message: '✅ Bot to\'xtatildi' };
}

/* ===============================
   ⛔ USER BOTLARINI TO'XTATISH
================================ */
async function stopUserBots(userId) {
  const userIdStr = userId.toString();

  if (!isPremium(userIdStr)) {
    throw new Error('❌ Bu funksiya faqat Premium foydalanuvchilar uchun');
  }

  const bots = getUserBots(userIdStr);
  let stopped = 0;

  for (const bot of bots) {
    const client = activeConnections.get(bot.id);
    if (client) {
      try {
        client.close();
      } catch (err) {}
      activeConnections.delete(bot.id);
    }
    removeBot(bot.id);
    stopped++;
  }

  return {
    success: true,
    stoppedCount: stopped,
    message: `✅ ${stopped} ta bot to'xtatildi`
  };
}

/* ===============================
   📊 AKTIV BOTLAR
================================ */
function getActiveBots() {
  return Array.from(activeConnections.keys());
}

/* ===============================
   📊 USER BOTLARINI KELTIRISH
================================ */
function getUserActiveBots(userId) {
  const userIdStr = userId.toString();
  const activeBots = [];
  
  for (const [botId, client] of activeConnections.entries()) {
    if (client.userId === userIdStr) {
      activeBots.push(botId);
    }
  }
  
  return activeBots;
}

module.exports = {
  createMinecraftBot,
  stopBot,
  stopUserBots,
  getActiveBots,
  getUserActiveBots
};
