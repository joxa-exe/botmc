const TelegramBot = require('node-telegram-bot-api');
const { createMinecraftBot } = require('./qoshish.js');
const { initAdmin } = require('./admin.js');
const { DDoSAttack } = require('./ddos.js');
const { saveUser, getUserBots, removeBot, getSettings, isPremium } = require('./database.js');

const TELEGRAM_TOKEN = '8362458059:AAFW9YaKexmKqieZMlv8XPdWqHFS2sqM_AA';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const userStates = new Map();
const ddosAttacks = new Map();

const keyboards = {
  main: {
    keyboard: [['➕ Bot qoshish'], ['📋 Botlarim'], ['💎 Premium', 'ℹ️ Yordam']],
    resize_keyboard: true
  },
  premium: {
    keyboard: [
      ['➕ Bot qoshish'],
      ['📋 Botlarim'],
      ['💎 Premium holat', '⚡ DDoS boshlash'],
      ['🛑 DDoS to\'xtatish', '🏠 Bosh menyu']
    ],
    resize_keyboard: true
  },
  cancel: {
    keyboard: [['🚫 Bekor qilish']],
    resize_keyboard: true
  },
  version: {
    keyboard: [['1.21.50', '1.20.80'], ['1.19.80', '1.17.40', 'Auto'], ['🚫 Bekor qilish']],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

function getUserKeyboard(userId) {
  return isPremium(userId) ? keyboards.premium : keyboards.main;
}

function formatBotInfo(botData) {
  const timeAgo = Math.floor((Date.now() - new Date(botData.createdAt)) / 60000);
  const hours = Math.floor(timeAgo / 60);
  const minutes = timeAgo % 60;
  const timeStr = hours > 0 ? `${hours} soat ${minutes} daqiqa` : `${minutes} daqiqa`;
  
  return `🤖 ${botData.botName}\n🌐 ${botData.server}\n📦 ${botData.version}\n⏰ ${timeStr}`;
}

// ================== START HANDLER ==================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username ? '@' + msg.from.username : msg.from.first_name;

  saveUser(userId, {
    username: username,
    firstName: msg.from.first_name,
    firstSeen: new Date().toISOString()
  });

  const settings = getSettings();
  const isUserPremium = isPremium(userId);
  
  const message = isUserPremium 
    ? `💎 PREMIUM\n\nSalom ${username}!\nLimit: ${settings.premiumLimit} ta bot\nDDoS imkoniyati mavjud`
    : `Salom ${username}!\n\nOddiy foydalanuvchi: 1 ta bot\nPremium: ${settings.premiumLimit} ta bot + DDoS\n\nBot qoshish uchun "➕ Bot qoshish" tugmasini bosing`;

  bot.sendMessage(chatId, message, { reply_markup: getUserKeyboard(userId) });
});

// ================== BOT QOSHISH ==================
bot.onText(/➕ Bot qoshish/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userBots = getUserBots(userId);
  const isUserPremium = isPremium(userId);
  const settings = getSettings();
  const limit = isUserPremium ? settings.premiumLimit : 1;

  // Limit tekshirish
  if (userBots.length >= limit) {
    if (!isUserPremium) {
      // Oddiy foydalanuvchi: eskisini almashtirish
      const currentBot = userBots[0];
      const replaceMsg = await bot.sendMessage(
        chatId,
        `ℹ️ Sizda allaqachon bot bor:\n${formatBotInfo(currentBot)}\n\nYangi bot qoshish uchun avvalgi bot o'chiriladi. Davom ettirishni xohlaysizmi?`,
        {
          reply_markup: {
            keyboard: [['✅ Ha, o\'chirib yangisini qoshish'], ['❌ Yo\'q, bekor qilish']],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );

      bot.once('message', (response) => {
        if (response.chat.id === chatId && response.text === '✅ Ha, o\'chirib yangisini qoshish') {
          removeBot(currentBot.id);
          startBotCreation(chatId, userId);
        } else {
          bot.sendMessage(chatId, '❌ Bekor qilindi.', { reply_markup: getUserKeyboard(userId) });
        }
      });
      return;
    } else {
      return bot.sendMessage(chatId, `❌ Limit: ${userBots.length}/${limit} ta\nYangi bot qoshish uchun avval ba'zi botlarni o'chiring.`);
    }
  }

  startBotCreation(chatId, userId);
});

function startBotCreation(chatId, userId) {
  userStates.set(chatId, { step: 'waiting_ip', userId });
  bot.sendMessage(chatId, '🌐 Server IP kiriting:', { reply_markup: keyboards.cancel });
}

// ================== MESSAGE HANDLER ==================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from?.id;
  if (!userId || !text || text.startsWith('/')) return;

  const state = userStates.get(chatId);
  if (!state) return;

  try {
    // Bot qoshish jarayoni
    if (state.step === 'waiting_ip') {
      userStates.set(chatId, { ...state, step: 'waiting_port', ip: text });
      bot.sendMessage(chatId, '🔢 Port (odatiy 19132):', { reply_markup: keyboards.cancel });
    } 
    else if (state.step === 'waiting_port') {
      const port = parseInt(text) || 19132;
      userStates.set(chatId, { ...state, step: 'waiting_version', port });
      bot.sendMessage(chatId, '📦 Versiya tanlang:', { reply_markup: keyboards.version });
    } 
    else if (state.step === 'waiting_version') {
      const { ip, port, userId } = state;
      await bot.sendMessage(chatId, `🔄 Bot ulanmoqda...`);
      
      const result = await createMinecraftBot({ ip, port, version: text, userId });
      const userBots = getUserBots(userId);
      const isUserPremium = isPremium(userId);
      const limit = isUserPremium ? getSettings().premiumLimit : 1;

      bot.sendMessage(
        chatId,
        `✅ Bot qoshildi!\n\n${formatBotInfo(result)}\n📊 ${userBots.length}/${limit} ta bot`,
        { reply_markup: getUserKeyboard(userId) }
      );
      userStates.delete(chatId);
    }

    // DDoS jarayoni
    else if (state.step === 'ddos_ip') {
      userStates.set(chatId, { ...state, step: 'ddos_port', ddos_ip: text });
      bot.sendMessage(chatId, '🔢 DDoS uchun port kiriting:', { reply_markup: keyboards.cancel });
    } 
    else if (state.step === 'ddos_port') {
      userStates.set(chatId, { ...state, step: 'ddos_version', ddos_port: parseInt(text) || 19132 });
      bot.sendMessage(chatId, '📦 DDoS uchun versiya tanlang:', { reply_markup: keyboards.version });
    } 
    else if (state.step === 'ddos_version') {
      if (!isPremium(userId)) {
        userStates.delete(chatId);
        return bot.sendMessage(chatId, '❌ Premium obuna kerak!');
      }

      const { ddos_ip: ip, ddos_port: port } = state;
      if (!ddosAttacks.has(userId)) ddosAttacks.set(userId, new DDoSAttack(userId));

      await bot.sendMessage(chatId, `⚡ DDoS boshlanmoqda... (5 ta bot)`);
      const result = await ddosAttacks.get(userId).startAttack(ip, port, text, 5);

      bot.sendMessage(
        chatId,
        `⚡ DDoS BOSHLANDI!\n\n🌐 Target: ${ip}:${port}\n🤖 Botlar: 5 ta\n📦 Versiya: ${text}\n\nTo'xtatish uchun "🛑 DDoS to'xtatish"`,
        { reply_markup: keyboards.premium }
      );
      userStates.delete(chatId);
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ ${error.message}`, { reply_markup: getUserKeyboard(userId) });
    userStates.delete(chatId);
  }
});

// ================== BOTLARIM ==================
bot.onText(/📋 Botlarim/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userBots = getUserBots(userId);
  const isUserPremium = isPremium(userId);
  const limit = isUserPremium ? getSettings().premiumLimit : 1;

  if (userBots.length === 0) {
    return bot.sendMessage(
      chatId,
      `Sizda hozircha bot yo'q.\nBot qoshish uchun "➕ Bot qoshish" tugmasini bosing.`,
      { reply_markup: getUserKeyboard(userId) }
    );
  }

  let message = `📋 Botlaringiz (${userBots.length}/${limit}):\n\n`;
  const keyboard = { keyboard: [], resize_keyboard: true };

  userBots.forEach(bot => {
    message += `${formatBotInfo(bot)}\n\n`;
    
    if (isUserPremium) {
      keyboard.keyboard.push([`🔄 ${bot.botName}`, `🗑️ ${bot.botName}`]);
    } else {
      keyboard.keyboard.push([`🔄 ${bot.botName}`]);
    }
  });

  message += isUserPremium ? `🔄 - Qayta qoshish\n🗑️ - Botni o'chirish` : `🔄 - O'chirib yangi bot qoshish`;
  keyboard.keyboard.push(['🏠 Bosh menyu']);

  bot.sendMessage(chatId, message, { reply_markup: keyboard });
});

// ================== DDoS FUNCTIONS ==================
bot.onText(/⚡ DDoS boshlash/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isPremium(userId)) {
    return bot.sendMessage(chatId, '❌ DDoS faqat Premium uchun!', { reply_markup: keyboards.main });
  }

  userStates.set(chatId, { step: 'ddos_ip', userId });
  bot.sendMessage(chatId, '🌐 DDoS uchun server IP kiriting:', { reply_markup: keyboards.cancel });
});

bot.onText(/🛑 DDoS to\'xtatish/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const attack = ddosAttacks.get(userId);

  if (!attack) return bot.sendMessage(chatId, '❌ Faol DDoS hujum yo\'q', { reply_markup: keyboards.premium });
  
  const result = attack.stopAllAttacks();
  bot.sendMessage(chatId, `✅ DDoS TO'XTATILDI\n\n🛑 ${result.stoppedBots} ta bot o'chirildi`, { reply_markup: keyboards.premium });
});

// ================== QAYTA QOSHISH VA O'CHIRISH ==================
bot.on('message', async (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (text.startsWith('🔄 ')) {
    const botName = text.replace('🔄 ', '');
    const userBots = getUserBots(userId);
    const botToRecreate = userBots.find(b => b.botName === botName);
    
    if (!botToRecreate) return bot.sendMessage(chatId, '❌ Bot topilmadi.', { reply_markup: getUserKeyboard(userId) });

    // Oddiy foydalanuvchi: eskisini o'chirish
    if (!isPremium(userId)) removeBot(botToRecreate.id);

    const [ip, port] = botToRecreate.server.split(':');
    await bot.sendMessage(chatId, `🔄 Yangi bot qoshilmoqda...`);

    try {
      const result = await createMinecraftBot({
        ip,
        port: parseInt(port),
        version: botToRecreate.version,
        userId
      });

      bot.sendMessage(chatId, `✅ Yangi bot qoshildi!\n\n${formatBotInfo(result)}`, {
        reply_markup: getUserKeyboard(userId)
      });
    } catch (error) {
      bot.sendMessage(chatId, `❌ ${error.message}`, { reply_markup: getUserKeyboard(userId) });
    }
  }

  if (text.startsWith('🗑️ ')) {
    if (!isPremium(userId)) return bot.sendMessage(chatId, '❌ Bot o\'chirish faqat Premium uchun!');
    
    const botName = text.replace('🗑️ ', '');
    const userBots = getUserBots(userId);
    const botToRemove = userBots.find(b => b.botName === botName);
    
    if (botToRemove && removeBot(botToRemove.id)) {
      const remaining = getUserBots(userId).length;
      bot.sendMessage(chatId, `✅ "${botName}" o'chirildi.\n📊 Qolgan botlar: ${remaining} ta`, {
        reply_markup: keyboards.premium
      });
    }
  }
});

// ================== QOLGAN HANDLERLAR ==================
bot.onText(/💎 Premium/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const settings = getSettings();

  if (isPremium(userId)) {
    const userBots = getUserBots(userId);
    bot.sendMessage(chatId, `💎 SIZ PREMIUM OBUNACHISIZ!\n\nLimit: ${settings.premiumLimit} ta bot\nDDoS imkoniyati mavjud\nJoriy botlar: ${userBots.length} ta`, {
      reply_markup: keyboards.premium
    });
  } else {
    bot.sendMessage(chatId, `💎 PREMIUM OBUNA\n\nNarxi: ${settings.premiumPrice} so'm\nLimit: ${settings.premiumLimit} ta bot\nDDoS imkoniyati (5 ta bot)\n\nSotib olish uchun: @crpytouzb`, {
      reply_markup: keyboards.main
    });
  }
});

bot.onText(/ℹ️ Yordam/, (msg) => {
  const settings = getSettings();
  bot.sendMessage(msg.chat.id, 
    `ℹ️ YORDAM\n\n` +
    `📌 *Oddiy foydalanuvchi:*\n• 1 ta bot\n• Qayta qoshish (eski bot o'chiriladi)\n\n` +
    `💎 *Premium:*\n• ${settings.premiumLimit} ta bot\n• Bot o'chirish\n• DDoS hujum (5 bot)\n\n` +
    `🔧 *Qo'llanma:*\n1. IP: play.example.com\n2. Port: 19132\n3. Versiya: 1.21.50\n4. Admin: @crpytouzb`,
    { parse_mode: 'Markdown', reply_markup: keyboards.main }
  );
});

bot.onText(/🚫 Bekor qilish/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  userStates.delete(chatId);
  bot.sendMessage(chatId, '❌ Bekor qilindi.', { reply_markup: getUserKeyboard(userId) });
});

bot.onText(/🏠 Bosh menyu/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  userStates.delete(chatId);
  bot.sendMessage(chatId, '🏠 Bosh menyu:', { reply_markup: getUserKeyboard(userId) });
});

// ================== ADMIN PANEL ==================
initAdmin(bot);

console.log('🤖 Bot ishga tushdi...');
