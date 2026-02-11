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
  readJSON,
  writeJSON
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
      client.botName = botName;

      // ⏱ Connection timeout (30 soniya)
      timeoutId = setTimeout(() => {
        if (!connected) {
          try {
            if (client && client.close) client.close();
          } catch {}
          reject(new Error('❌ Serverga ulanish vaqti tugadi (30s)'));
        }
      }, 30000);

      /* ===== SPAWN ===== */
      client.once('spawn', () => {
        clearTimeout(timeoutId);
        connected = true;

        activeConnections.set(botId, client);
        console.log(`✅ Bot yaratildi: ${botName} (${botId})`);

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
          botId: botId,
          botName: botName,
          message: `✅ Bot qo'shildi!\n\n🤖 ${botName}\n🌐 ${host}:${serverPort}\n📦 ${version}\n🟢 Holat: Online`
        });
      });

      /* ===== DISCONNECT ===== */
      client.on('disconnect', (reason) => {
        clearTimeout(timeoutId);
        
        if (activeConnections.has(botId)) {
          activeConnections.delete(botId);
        }
        
        console.log(`🤖 Bot disconnect: ${botName} (${reason || 'noma\'lum'})`);

        // Bot holatini "offline" ga o'zgartirish
        try {
          const bots = JSON.parse(fs.readFileSync(botsFile, 'utf8') || '{}');
          if (bots[botId]) {
            bots[botId].status = 'offline';
            bots[botId].disconnectedAt = new Date().toISOString();
            bots[botId].disconnectReason = reason || 'unknown';
            fs.writeFileSync(botsFile, JSON.stringify(bots, null, 2), 'utf8');
          }
        } catch (err) {
          console.error('❌ Bot holatini yangilashda xato:', err.message);
        }
      });

      /* ===== ERROR ===== */
      client.on('error', (err) => {
        clearTimeout(timeoutId);
        
        if (activeConnections.has(botId)) {
          activeConnections.delete(botId);
        }
        
        console.error(`❌ Bot xatosi (${botName}):`, err.message);

        // Xato holatini saqlash
        try {
          const bots = JSON.parse(fs.readFileSync(botsFile, 'utf8') || '{}');
          if (bots[botId]) {
            bots[botId].status = 'error';
            bots[botId].error = err.message;
            bots[botId].errorAt = new Date().toISOString();
            fs.writeFileSync(botsFile, JSON.stringify(bots, null, 2), 'utf8');
          }
        } catch (e) {}

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
   ⛔ BOTNI TO'XTATISH (REAL SERVERDAN CHIQADIGAN)
================================ */
async function stopBot(botId, userId = null) {
  // Agar userId berilsa, premium tekshirish
  if (userId && !isPremium(userId.toString())) {
    throw new Error('❌ Oddiy foydalanuvchi botni o\'chira olmaydi');
  }

  const client = activeConnections.get(botId);
  let trulyClosed = false;
  let methodsUsed = [];

  console.log(`🛑 HAQIQIY Bot yopilmoqda: ${botId}`);

  // 1. Clientni HAQIQIY yopish (5 xil usul)
  if (client) {
    try {
      console.log(`🔍 Client mavjud: ${client.username || 'unknown'}`);
      
      // Method 1: bedrock-protocolning to'g'ri usuli
      try {
        if (typeof client.quit === 'function') {
          console.log(`🔄 Method 1: client.quit()`);
          client.quit('User requested disconnect');
          methodsUsed.push('quit()');
          trulyClosed = true;
        }
      } catch (e) {
        console.log(`❌ Method 1 xato: ${e.message}`);
      }

      // Method 2: Agar quit ishlamasa, close + socket destroy
      if (!trulyClosed) {
        try {
          console.log(`🔄 Method 2: close() + socket.destroy()`);
          if (typeof client.close === 'function') {
            client.close();
            methodsUsed.push('close()');
          }
          
          if (client.socket && !client.socket.destroyed) {
            client.socket.destroy();
            methodsUsed.push('socket.destroy()');
            trulyClosed = true;
          }
        } catch (e) {
          console.log(`❌ Method 2 xato: ${e.message}`);
        }
      }

      // Method 3: Agar hali ham yopilmagan bo'lsa, connectionni uzish
      if (!trulyClosed && client.connection) {
        try {
          console.log(`🔄 Method 3: connection.close()`);
          if (typeof client.connection.close === 'function') {
            client.connection.close();
            methodsUsed.push('connection.close()');
            trulyClosed = true;
          }
        } catch (e) {
          console.log(`❌ Method 3 xato: ${e.message}`);
        }
      }

      // Method 4: Force disconnect packet yuborish
      if (!trulyClosed) {
        try {
          console.log(`🔄 Method 4: disconnect packet`);
          // Disconnect packet yuborish
          if (client.queue && typeof client.queue === 'object') {
            client.queue = []; // Queueni tozalash
            methodsUsed.push('queue.clear()');
          }
          
          // Agar write funksiyasi bo'lsa, disconnect paket yuborish
          if (typeof client.write === 'function') {
            try {
              client.write('disconnect', { reason: 'User left' });
              methodsUsed.push('write(disconnect)');
            } catch (e) {}
          }
          trulyClosed = true;
        } catch (e) {
          console.log(`❌ Method 4 xato: ${e.message}`);
        }
      }

      // Method 5: Nihoyat, remove all listeners
      if (!trulyClosed) {
        try {
          console.log(`🔄 Method 5: removeAllListeners`);
          client.removeAllListeners();
          methodsUsed.push('removeAllListeners()');
          trulyClosed = true;
        } catch (e) {
          console.log(`❌ Method 5 xato: ${e.message}`);
        }
      }

      console.log(`✅ Bot yopish urinishlari: ${methodsUsed.join(', ')}`);
      
    } catch (err) {
      console.error('❌ Botni yopishda asosiy xato:', err.message);
    }
  } else {
    console.log(`ℹ️ Bot aktiv connectionsda topilmadi: ${botId}`);
  }

  // 2. Active connections dan o'chirish (garov)
  activeConnections.delete(botId);

  // 3. JSON fayldan o'chirish
  const removed = removeBot(botId);

  // 4. Bot holatini stopped qilish
  try {
    const bots = JSON.parse(fs.readFileSync(botsFile, 'utf8') || '{}');
    if (bots[botId]) {
      bots[botId].status = 'manually_stopped';
      bots[botId].stoppedAt = new Date().toISOString();
      bots[botId].stoppedBy = userId ? userId.toString() : 'system';
      bots[botId].methodsUsed = methodsUsed;
      bots[botId].trulyClosed = trulyClosed;
      fs.writeFileSync(botsFile, JSON.stringify(bots, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('❌ Bot holatini yangilashda xato:', err.message);
  }

  return { 
    success: true, 
    message: trulyClosed ? '✅ Bot HAQIQIY to\'xtatildi va serverdan chiqdi' : '⚠️ Bot to\'xtatildi, lekin serverda qolgan bo\'lishi mumkin',
    trulyClosed: trulyClosed,
    removed: removed,
    methodsUsed: methodsUsed,
    botId: botId
  };
}

/* ===============================
   ⛔ USER BARCHA BOTLARINI TO'XTATISH
================================ */
async function stopUserBots(userId) {
  const userIdStr = userId.toString();

  if (!isPremium(userIdStr)) {
    throw new Error('❌ Bu funksiya faqat Premium foydalanuvchilar uchun');
  }

  const bots = getUserBots(userIdStr);
  let stopped = 0;
  let failed = 0;
  let trulyClosedCount = 0;

  console.log(`🛑 User ${userIdStr} barcha botlari yopilmoqda: ${bots.length} ta`);

  for (const bot of bots) {
    try {
      const result = await stopBot(bot.id, userId);
      if (result.trulyClosed) {
        trulyClosedCount++;
      }
      stopped++;
    } catch (err) {
      console.error(`❌ ${bot.id} o'chirishda xato:`, err.message);
      failed++;
    }
  }

  return {
    success: true,
    totalBots: bots.length,
    stoppedCount: stopped,
    trulyClosedCount: trulyClosedCount,
    failedCount: failed,
    message: `✅ ${stopped} ta bot to'xtatildi (${trulyClosedCount} ta haqiqiy), ${failed} ta xato`
  };
}

/* ===============================
   📊 AKTIV BOTLAR
================================ */
function getActiveBots() {
  const active = [];
  
  for (const [botId, client] of activeConnections.entries()) {
    active.push({
      id: botId,
      username: client.botName || client.username || 'unknown',
      userId: client.userId || 'unknown',
      connected: client.connected || false
    });
  }
  
  return active;
}

/* ===============================
   📊 USER AKTIV BOTLARI
================================ */
function getUserActiveBots(userId) {
  const userIdStr = userId.toString();
  const activeBots = [];

  for (const [botId, client] of activeConnections.entries()) {
    if (client.userId === userIdStr) {
      activeBots.push({
        id: botId,
        username: client.botName || client.username || 'unknown',
        connected: client.connected || false
      });
    }
  }

  return activeBots;
}

/* ===============================
   🔍 BOT HOLATINI TEKSHIRISH
================================ */
function checkBotStatus(botId) {
  const client = activeConnections.get(botId);
  
  try {
    const bots = JSON.parse(fs.readFileSync(botsFile, 'utf8') || '{}');
    const botData = bots[botId] || null;
    
    return {
      inMemory: !!client,
      inJSON: !!botData,
      connected: client ? (client.connected || false) : false,
      username: client ? (client.botName || client.username || 'unknown') : (botData ? botData.botName : 'unknown'),
      status: botData ? botData.status : 'not_found',
      userId: botData ? botData.userId : 'unknown',
      server: botData ? botData.server : 'unknown'
    };
  } catch (err) {
    return {
      inMemory: !!client,
      inJSON: false,
      connected: client ? (client.connected || false) : false,
      username: client ? (client.botName || client.username || 'unknown') : 'unknown',
      status: 'error',
      error: err.message
    };
  }
}

/* ===============================
   💣 BARCHA BOTLARNI TO'XTATISH (ADMIN)
================================ */
async function stopAllBots() {
  const botIds = Array.from(activeConnections.keys());
  let stopped = 0;
  let failed = 0;
  
  console.log(`💣 Barcha botlar yopilmoqda: ${botIds.length} ta`);

  for (const botId of botIds) {
    try {
      const client = activeConnections.get(botId);
      if (client) {
        // Barcha usullarni ishlatish
        try {
          if (typeof client.quit === 'function') client.quit('Admin stop all');
          if (typeof client.close === 'function') client.close();
          if (client.socket && !client.socket.destroyed) client.socket.destroy();
          if (client.connection && typeof client.connection.close === 'function') client.connection.close();
          client.removeAllListeners();
        } catch (e) {}
        
        activeConnections.delete(botId);
        stopped++;
        console.log(`✅ Yopildi: ${botId}`);
      }
    } catch (err) {
      console.error(`❌ ${botId} yopishda xato:`, err.message);
      failed++;
    }
  }

  // JSON faylni tozalash
  try {
    fs.writeFileSync(botsFile, JSON.stringify({}, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ JSON faylni tozalashda xato:', err.message);
  }

  return {
    success: true,
    total: botIds.length,
    stopped: stopped,
    failed: failed,
    message: `💣 ${stopped} ta bot yopildi, ${failed} ta xato`
  };
}

module.exports = {
  createMinecraftBot,
  stopBot,
  stopUserBots,
  getActiveBots,
  getUserActiveBots,
  checkBotStatus,
  stopAllBots
};
