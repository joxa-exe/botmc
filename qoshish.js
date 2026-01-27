const bedrock = require('bedrock-protocol');
const { addBot, getUserBots, getSettings, isPremium } = require('./database.js');

async function createMinecraftBot(serverData) {
  let client = null;
  let timeout = null;

  try {
    const { ip, port, version, userId, username } = serverData;

    // Foydalanuvchi limitini tekshirish
    const limitCheck = checkUserLimit(userId);
    if (!limitCheck.canAdd) {
      throw new Error(`Bot limiti: ${limitCheck.current}/${limitCheck.limit}`);
    }

    const userBots = await getUserBots(userId);
    const botNumber = userBots.length + 1;
    const botName = `Tg_MCPEBotAdderBot_${botNumber}`;

    const botData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      userId: userId,
      username: username,
      botName: botName,
      server: `${ip}:${port}`,
      version: version,
      status: 'connecting',
      createdAt: new Date().toISOString()
    };

    // Bot ma'lumotlarini bazaga saqlash
    const botId = await addBot(botData);

    return new Promise((resolve, reject) => {
      timeout = setTimeout(() => {
        if (client) {
          client.close();
          client = null;
        }
        reject(new Error('Ulanish vaqti tugadi (15 soniya)'));
      }, 15000);

      client = bedrock.createClient({
        host: ip,
        port: parseInt(port) || 19132,
        username: botName,
        offline: true,
        version: version === 'Auto' ? undefined : version,
        connectTimeout: 10000,
        skipPing: true,
        authTitle: false
      });

      client.on('spawn', () => {
        clearTimeout(timeout);
        timeout = null;
        
        // Bot statusini yangilash
        botData.status = 'connected';
        botData.connectedAt = new Date().toISOString();
        // Bu yerda updateBot funksiyasi bo'lishi kerak
        
        resolve({
          success: true,
          botId: botId,
          botName: botName,
          server: `${ip}:${port}`,
          version: version,
          status: 'connected',
          message: 'Bot muvaffaqiyatli ulandi!'
        });
      });

      client.on('error', (error) => {
        clearTimeout(timeout);
        timeout = null;
        
        if (client) {
          client.close();
          client = null;
        }
        
        // Bot statusini yangilash
        botData.status = 'error';
        botData.error = error.message;
        // Bu yerda updateBot funksiyasi bo'lishi kerak
        
        reject(new Error(`Server xatosi: ${error.message}`));
      });

      client.on('kick', (reason) => {
        clearTimeout(timeout);
        timeout = null;
        
        if (client) {
          client.close();
          client = null;
        }
        
        // Bot statusini yangilash
        botData.status = 'kicked';
        botData.kickReason = reason;
        // Bu yerda updateBot funksiyasi bo'lishi kerak
        
        reject(new Error(`Bot kiklandi: ${reason}`));
      });

      client.on('close', () => {
        clearTimeout(timeout);
        timeout = null;
        
        // Bot statusini yangilash
        if (botData.status === 'connecting') {
          botData.status = 'disconnected';
          // Bu yerda updateBot funksiyasi bo'lishi kerak
        }
      });

    });

  } catch (error) {
    // Faollashtirilgan timeout va clientlarni tozalash
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    
    if (client) {
      client.close();
      client = null;
    }
    
    throw new Error(`Bot yaratishda xato: ${error.message}`);
  }
}

async function checkUserLimit(userId) {
  const settings = getSettings();
  const userBots = await getUserBots(userId);
  const userBotsCount = userBots.filter(bot => bot.status === 'connected').length;
  const userLimit = isPremium(userId) ? settings.premiumLimit : settings.regularLimit;

  return {
    canAdd: userBotsCount < userLimit,
    current: userBotsCount,
    limit: userLimit,
    remaining: userLimit - userBotsCount
  };
}

// Botni o'chirish funksiyasi (agar kerak bo'lsa)
async function disconnectBot(botId, userId) {
  try {
    const userBots = await getUserBots(userId);
    const bot = userBots.find(b => b.id === botId);
    
    if (!bot) {
      throw new Error('Bot topilmadi');
    }
    
    // Bu yerda botni disconnect qilish logikasi
    // Va bazadagi statusni yangilash
    
    return { success: true, message: 'Bot muvaffaqiyatli o\'chirildi' };
  } catch (error) {
    throw new Error(`Botni o'chirishda xato: ${error.message}`);
  }
}

// Barcha botlarni o'chirish
async function disconnectAllBots(userId) {
  try {
    const userBots = await getUserBots(userId);
    // Barcha botlarni disconnect qilish logikasi
    return { success: true, message: `${userBots.length} ta bot o'chirildi` };
  } catch (error) {
    throw new Error(`Botlarni o'chirishda xato: ${error.message}`);
  }
}

module.exports = {
  createMinecraftBot,
  checkUserLimit,
  disconnectBot,
  disconnectAllBots
};
