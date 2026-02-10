// ===================== IMPORTS =====================
const TelegramBot = require('node-telegram-bot-api');
const { initAdmin } = require('./admin');
const { createMinecraftBot } = require('./qoshish');
const { DDoSAttack } = require('./ddos'); // O'ZGARDI: startFakeDDoS → DDoSAttack
const {
  saveUser,
  isPremium,
  isAdmin,
  getUserBots,
  removeBot
} = require('./database');

// ===================== BOT =====================
const BOT_TOKEN = '8362458059:AAFW9YaKexmKqieZMlv8XPdWqHFS2sqM_AA'; // tokeningni qo‘y
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ===================== STATES =====================
const states = new Map();

// ===================== LIMITLAR =====================
const LIMITS = {
  regular: 1,
  premium: 5
};

// ===================== KEYBOARDS =====================
const KB = {
  main: {
    resize_keyboard: true,
    keyboard: [
      ['➕ Bot qo‘shish', '📋 Botlarim'],
      ['💎 Premium', 'ℹ️ Yordam']
    ]
  },
  premium: {
    resize_keyboard: true,
    keyboard: [
      ['➕ Bot qo‘shish', '📋 Botlarim'],
      ['⚡ DDoS', '🛑 Botlarni to‘xtatish'],
      ['💎 Premium', 'ℹ️ Yordam'],
      ['🏠 Menyu']
    ]
  },
  cancel: {
    resize_keyboard: true,
    keyboard: [['🚫 Bekor qilish']]
  },
  versions: {
    resize_keyboard: true,
    keyboard: [
      ['Auto', '1.21.50'],
      ['1.20.80', '1.19.80'],
      ['🚫 Bekor qilish']
    ]
  }
};

const userKeyboard = (id) => isPremium(id) ? KB.premium : KB.main;

// ===================== /START =====================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  saveUser(userId, {
    firstName: msg.from.first_name,
    username: msg.from.username || '',
    lastSeen: Date.now()
  });

  const limit = isPremium(userId) ? LIMITS.premium : LIMITS.regular;

  const text = `
👋 <b>Xush kelibsiz!</b>

🤖 Minecraft bot boshqaruv paneli

👤 Holat: ${isPremium(userId) ? '💎 PREMIUM' : '👤 ODDIY'}
📦 Bot limiti: ${limit}

👇 Tugmalardan foydalaning
`;

  bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: userKeyboard(userId)
  });
});

// ===================== MESSAGE HANDLER =====================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text?.trim();

  if (!text || text.startsWith('/')) return;

  const state = states.get(chatId);

  // ===== BEKOR =====
  if (text === '🚫 Bekor qilish' || text === '🏠 Menyu') {
    states.delete(chatId);
    return bot.sendMessage(chatId, '🏠 Asosiy menyu', {
      reply_markup: userKeyboard(userId)
    });
  }

  // ===================== YORDAM =====================
  if (text === 'ℹ️ Yordam') {
    return bot.sendMessage(chatId, `
ℹ️ <b>YORDAM</b>

➕ Bot qo‘shish — serverga bot ulash
📋 Botlarim — botlaringiz ro‘yxati
⚡ DDoS — test hujum (faqat premium)
💎 Premium — premium ma’lumotlari
/admin — admin panel (adminlar uchun)
`, { parse_mode: 'HTML' });
  }

  // ===================== PREMIUM INFO =====================
  if (text === '💎 Premium') {
    return bot.sendMessage(chatId, `
💎 <b>PREMIUM</b>

🤖 5 ta bot qo‘shish limiti
⚡ DDoS test funksiyasi
🚀 Tezroq ishlash

💰 Narxi: 5000 so‘m
📞 Admin bilan bog‘laning: @crpytouzb
`, { parse_mode: 'HTML' });
  }

  // ===================== BOT QO‘SHISH =====================
  if (text === '➕ Bot qo‘shish') {
    const bots = getUserBots(userId);
    const limit = isPremium(userId) ? LIMITS.premium : LIMITS.regular;

    if (bots.length >= limit) {
      return bot.sendMessage(chatId, `❌ Bot limiti tugagan. Sizda ${bots.length}/${limit} ta bot mavjud.`);
    }

    states.set(chatId, { step: 'bot_ip' });
    return bot.sendMessage(chatId, '🌐 Server IP manzilini kiriting:', { reply_markup: KB.cancel });
  }

  // ===== BOT QO‘SHISH STEPLARI =====
  if (state?.step === 'bot_ip') {
    states.set(chatId, { step: 'bot_port', ip: text });
    return bot.sendMessage(chatId, '🔢 Port kiriting (odatda 19132):', { reply_markup: KB.cancel });
  }

  if (state?.step === 'bot_port') {
    const port = parseInt(text) || 19132;
    states.set(chatId, { step: 'bot_version', ip: state.ip, port });
    return bot.sendMessage(chatId, '📦 Versiyani tanlang:', {
      reply_markup: KB.versions
    });
  }

  if (state?.step === 'bot_version') {
    try {
      await createMinecraftBot({
        userId,
        ip: state.ip,
        port: state.port,
        version: text
      });
      states.delete(chatId);
      return bot.sendMessage(chatId, '✅ Bot muvaffaqiyatli qo‘shildi va serverga ulandi!', {
        reply_markup: userKeyboard(userId)
      });
    } catch (error) {
      states.delete(chatId);
      return bot.sendMessage(chatId, `❌ Xato: ${error.message}`, {
        reply_markup: userKeyboard(userId)
      });
    }
  }

  // ===================== BOTLARIM =====================
  if (text === '📋 Botlarim') {
    const bots = getUserBots(userId);
    if (!bots.length) return bot.sendMessage(chatId, '🤖 Sizda hozircha botlar mavjud emas.');

    let msgText = `📋 <b>BOTLARINGIZ</b>\n\n`;
    const kb = { resize_keyboard: true, keyboard: [] };

    bots.forEach((b, i) => {
      const botName = b.botName || `Bot_${i+1}`;
      const server = b.server || `${b.ip}:${b.port}`;
      msgText += `${i + 1}. 🤖 ${botName}\n🌐 ${server}\n📦 ${b.version}\n📊 Holat: ${b.status || 'noma\'lum'}\n\n`;
      kb.keyboard.push([`❌ O'chirish: ${b.id}`]);
    });

    kb.keyboard.push(['🏠 Menyu']);

    return bot.sendMessage(chatId, msgText, {
      parse_mode: 'HTML',
      reply_markup: kb
    });
  }

  // ===================== BOT O‘CHIRISH =====================
  if (text.startsWith('❌ O\'chirish:')) {
    const botId = text.split(':')[1].trim();
    removeBot(botId);
    return bot.sendMessage(chatId, '✅ Bot o‘chirildi', {
      reply_markup: userKeyboard(userId)
    });
  }

  // ===================== DDOS =====================
  if (text === '⚡ DDoS') {
    if (!isPremium(userId)) {
      return bot.sendMessage(chatId, '❌ Bu funksiya faqat Premium foydalanuvchilar uchun.');
    }
    states.set(chatId, { step: 'ddos_ip' });
    return bot.sendMessage(chatId, '🌐 Hujum qilinadigan server IP manzilini kiriting:', { reply_markup: KB.cancel });
  }

  if (state?.step === 'ddos_ip') {
    states.set(chatId, { step: 'ddos_port', ip: text });
    return bot.sendMessage(chatId, '🔢 Port kiriting (19132):', { reply_markup: KB.cancel });
  }

  if (state?.step === 'ddos_port') {
    const port = parseInt(text) || 19132;
    states.set(chatId, { step: 'ddos_version', ip: state.ip, port });
    return bot.sendMessage(chatId, '📦 Versiyani tanlang:', {
      reply_markup: KB.versions
    });
  }

  if (state?.step === 'ddos_version') {
    states.delete(chatId);
    DDoSAttack(bot, chatId, state.ip, state.port); // O'ZGARDI: startFakeDDoS → DDoSAttack
  }

  // ===================== BOTLARNI TO'XTATISH =====================
  if (text === '🛑 Botlarni to‘xtatish') {
    if (!isPremium(userId)) {
      return bot.sendMessage(chatId, '❌ Bu funksiya faqat Premium foydalanuvchilar uchun.');
    }
    
    const bots = getUserBots(userId);
    if (!bots.length) {
      return bot.sendMessage(chatId, '🤖 Sizda to‘xtatish uchun botlar mavjud emas.');
    }
    
    let stoppedCount = 0;
    bots.forEach(bot => {
      removeBot(bot.id);
      stoppedCount++;
    });
    
    return bot.sendMessage(chatId, `✅ ${stoppedCount} ta bot to'xtatildi va o'chirildi.`, {
      reply_markup: userKeyboard(userId)
    });
  }
});

// ===================== ADMIN =====================
initAdmin(bot);

// ===================== LOG =====================
console.log('🤖 Bot ishga tushdi...');
bot.on('polling_error', e => console.error('Polling error:', e.message));
bot.on('error', e => console.error('Bot error:', e.message));
