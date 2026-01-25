const {
  addPremium,
  removePremium,
  isPremium,
  getAllPremium,
  getAllBots,
  getSettings,
  updateSettings,
  isAdmin,
  getAllAdmins,
  addAdmin,
  removeAdmin
} = require('./database.js');

function initAdmin(bot) {
  const waitingResponses = new Map();

  bot.onText(/^\/admin$/, (msg) => {
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
      return bot.sendMessage(msg.chat.id, '❌ Siz admin emassiz!');
    }
    
    const keyboard = {
      keyboard: [
        ['👑 Premium qoshish', '👑 Premium ochirish'],
        ['👥 Admin qoshish', '👥 Admin ochirish'],
        ['📊 Premiumlar royxati', '🤖 Barcha botlar'],
        ['👥 Adminlar royxati', '⚙️ Sozlamalar'],
        ['📈 Statistika', '🏠 Bosh menyu']
      ],
      resize_keyboard: true
    };
    
    bot.sendMessage(msg.chat.id, '👑 ADMIN PANEL 👑', {
      reply_markup: keyboard
    });
  });

  bot.onText(/👑 Premium qoshish/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const chatId = msg.chat.id;
    waitingResponses.set(chatId, { action: 'addPremium', userId });
    
    bot.sendMessage(chatId, 'Premium qoshish uchun foydalanuvchi ID sini yuboring:');
  });

  bot.onText(/👑 Premium ochirish/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const chatId = msg.chat.id;
    waitingResponses.set(chatId, { action: 'removePremium', userId });
    
    bot.sendMessage(chatId, 'Premium ochirish uchun foydalanuvchi ID sini yuboring:');
  });

  bot.onText(/👥 Admin qoshish/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const chatId = msg.chat.id;
    waitingResponses.set(chatId, { action: 'addAdmin', userId });
    
    bot.sendMessage(chatId, 'Admin qoshish uchun foydalanuvchi ID sini yuboring:');
  });

  bot.onText(/👥 Admin ochirish/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const chatId = msg.chat.id;
    waitingResponses.set(chatId, { action: 'removeAdmin', userId });
    
    bot.sendMessage(chatId, 'Admin ochirish uchun foydalanuvchi ID sini yuboring:');
  });

  bot.onText(/📊 Premiumlar royxati/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const premiumUsers = getAllPremium();
    
    if (premiumUsers.length === 0) {
      return bot.sendMessage(msg.chat.id, '❌ Premium foydalanuvchilar yoq!');
    }
    
    let message = '👑 Premium foydalanuvchilar:\n\n';
    premiumUsers.forEach((id, index) => {
      message += `${index + 1}. ID: ${id}\n`;
    });
    
    bot.sendMessage(msg.chat.id, message);
  });

  bot.onText(/🤖 Barcha botlar/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const allBots = getAllBots();
    
    if (allBots.length === 0) {
      return bot.sendMessage(msg.chat.id, '❌ Botlar yoq!');
    }
    
    let message = '🤖 Barcha botlar:\n\n';
    allBots.forEach((bot, index) => {
      const time = new Date(bot.createdAt).toLocaleString();
      message += `${index + 1}. ${bot.botName}\n`;
      message += `   User: ${bot.userId}\n`;
      message += `   Server: ${bot.server}\n`;
      message += `   Vaqt: ${time}\n\n`;
    });
    
    message += `\nJami: ${allBots.length} ta bot`;
    
    bot.sendMessage(msg.chat.id, message);
  });

  bot.onText(/👥 Adminlar royxati/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const allAdmins = getAllAdmins();
    
    let message = '👥 Adminlar royxati:\n\n';
    allAdmins.forEach((id, index) => {
      const isYou = id === userId ? ' (Siz)' : '';
      message += `${index + 1}. ID: ${id}${isYou}\n`;
    });
    
    message += `\nJami: ${allAdmins.length} ta admin`;
    
    bot.sendMessage(msg.chat.id, message);
  });

  bot.onText(/⚙️ Sozlamalar/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const settings = getSettings();
    
    const keyboard = {
      keyboard: [
        ['💰 Premium narxi', '🔢 Premium limit'],
        ['🔢 Oddiy limit', '🏠 Bosh menyu']
      ],
      resize_keyboard: true
    };
    
    bot.sendMessage(msg.chat.id, 
      `Joriy sozlamalar:\n\n` +
      `💰 Premium narxi: ${settings.premiumPrice} so'm\n` +
      `🔢 Premium limit: ${settings.premiumLimit} ta bot\n` +
      `🔢 Oddiy limit: ${settings.regularLimit} ta bot`,
      {
        reply_markup: keyboard
      }
    );
  });

  bot.onText(/💰 Premium narxi/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const chatId = msg.chat.id;
    waitingResponses.set(chatId, { action: 'setPremiumPrice', userId });
    
    const settings = getSettings();
    bot.sendMessage(chatId, 
      `Joriy premium narxi: ${settings.premiumPrice} so'm\n\n` +
      `Yangi premium narxini kiriting (so'm):`
    );
  });

  bot.onText(/🔢 Premium limit/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const chatId = msg.chat.id;
    waitingResponses.set(chatId, { action: 'setPremiumLimit', userId });
    
    const settings = getSettings();
    bot.sendMessage(chatId, 
      `Joriy premium limit: ${settings.premiumLimit} ta bot\n\n` +
      `Yangi premium limitni kiriting (bot soni):`
    );
  });

  bot.onText(/🔢 Oddiy limit/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const chatId = msg.chat.id;
    waitingResponses.set(chatId, { action: 'setRegularLimit', userId });
    
    const settings = getSettings();
    bot.sendMessage(chatId, 
      `Joriy oddiy limit: ${settings.regularLimit} ta bot\n\n` +
      `Yangi oddiy limitni kiriting (bot soni):`
    );
  });

  bot.onText(/📈 Statistika/, (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const premiumUsers = getAllPremium();
    const allBots = getAllBots();
    const allAdmins = getAllAdmins();
    const settings = getSettings();
    
    const message = 
      `📊 Statistika:\n\n` +
      `👥 Premium foydalanuvchilar: ${premiumUsers.length} ta\n` +
      `🤖 Faol botlar: ${allBots.length} ta\n` +
      `👥 Adminlar: ${allAdmins.length} ta\n` +
      `💰 Premium narxi: ${settings.premiumPrice} so'm\n` +
      `📅 Yangilangan: ${new Date().toLocaleString()}`;
    
    bot.sendMessage(msg.chat.id, message);
  });

  // Message listener for waiting responses
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    const waiting = waitingResponses.get(chatId);
    if (!waiting) return;
    
    // Check if user is admin
    if (!isAdmin(userId) || userId !== waiting.userId) {
      waitingResponses.delete(chatId);
      return;
    }
    
    const action = waiting.action;
    waitingResponses.delete(chatId);
    
    if (action === 'addPremium') {
      const newUserId = parseInt(text);
      if (isNaN(newUserId)) {
        return bot.sendMessage(chatId, '❌ Notogri ID!');
      }
      
      if (addPremium(newUserId)) {
        bot.sendMessage(chatId, `✅ ${newUserId} Premiumga qoshildi!`);
      } else {
        bot.sendMessage(chatId, `ℹ️ ${newUserId} allaqachon Premium!`);
      }
    }
    
    else if (action === 'removePremium') {
      const removeUserId = parseInt(text);
      if (isNaN(removeUserId)) {
        return bot.sendMessage(chatId, '❌ Notogri ID!');
      }
      
      if (removePremium(removeUserId)) {
        bot.sendMessage(chatId, `✅ ${removeUserId} Premiumdan ochirildi!`);
      } else {
        bot.sendMessage(chatId, `ℹ️ ${removeUserId} Premium emas!`);
      }
    }
    
    else if (action === 'addAdmin') {
      const newAdminId = parseInt(text);
      if (isNaN(newAdminId)) {
        return bot.sendMessage(chatId, '❌ Notogri ID!');
      }
      
      if (addAdmin(newAdminId)) {
        bot.sendMessage(chatId, `✅ ${newAdminId} Admin qoshildi!`);
      } else {
        bot.sendMessage(chatId, `ℹ️ ${newAdminId} allaqachon Admin!`);
      }
    }
    
    else if (action === 'removeAdmin') {
      const removeAdminId = parseInt(text);
      if (isNaN(removeAdminId)) {
        return bot.sendMessage(chatId, '❌ Notogri ID!');
      }
      
      if (removeAdminId === userId) {
        return bot.sendMessage(chatId, '❌ O\'zingizni adminlikdan ochira olmaysiz!');
      }
      
      if (removeAdmin(removeAdminId)) {
        bot.sendMessage(chatId, `✅ ${removeAdminId} Adminlikdan ochirildi!`);
      } else {
        bot.sendMessage(chatId, `ℹ️ ${removeAdminId} Admin emas!`);
      }
    }
    
    else if (action === 'setPremiumPrice') {
      const newPrice = parseInt(text);
      if (isNaN(newPrice) || newPrice < 0) {
        return bot.sendMessage(chatId, '❌ Notogri narx! Iltimos, musbat raqam kiriting.');
      }
      
      const updated = updateSettings({ premiumPrice: newPrice });
      if (updated) {
        bot.sendMessage(chatId, `✅ Premium narxi ${newPrice} so'mga yangilandi!`);
      } else {
        bot.sendMessage(chatId, '❌ Yangilashda xato!');
      }
    }
    
    else if (action === 'setPremiumLimit') {
      const newLimit = parseInt(text);
      if (isNaN(newLimit) || newLimit < 1) {
        return bot.sendMessage(chatId, '❌ Notogri limit! Iltimos, 1 yoki undan katta raqam kiriting.');
      }
      
      const updated = updateSettings({ premiumLimit: newLimit });
      if (updated) {
        bot.sendMessage(chatId, `✅ Premium limit ${newLimit} ta botga yangilandi!`);
      } else {
        bot.sendMessage(chatId, '❌ Yangilashda xato!');
      }
    }
    
    else if (action === 'setRegularLimit') {
      const newLimit = parseInt(text);
      if (isNaN(newLimit) || newLimit < 1) {
        return bot.sendMessage(chatId, '❌ Notogri limit! Iltimos, 1 yoki undan katta raqam kiriting.');
      }
      
      const updated = updateSettings({ regularLimit: newLimit });
      if (updated) {
        bot.sendMessage(chatId, `✅ Oddiy limit ${newLimit} ta botga yangilandi!`);
      } else {
        bot.sendMessage(chatId, '❌ Yangilashda xato!');
      }
    }
  });
}

module.exports = {
  initAdmin
};
