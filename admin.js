const {
  addPremium,
  removePremium,
  addAdmin,
  removeAdmin,
  isAdmin,
  getAllAdmins,
  getAllUserIds,
  getUserBots,
  removeBot,
  getStats,
  isBanned,
  saveUser
} = require('./database');

function initAdmin(bot) {

  // ===================== ASOSIY ADMIN =====================
  const MAIN_ADMIN_ID = 1179710266;

  // ===================== STATE =====================
  const wait = new Map();

  // ===================== ADMIN TEKSHIRUV =====================
  function isAllowed(userId) {
    if (userId === MAIN_ADMIN_ID) return true;
    return isAdmin(userId);
  }

  // ===================== KEYBOARD =====================
  const ADMIN_KB = {
    resize_keyboard: true,
    keyboard: [
      ['👑 Premium qo‘shish', '👑 Premium o‘chirish'],
      ['👥 Admin qo‘shish', '👥 Admin o‘chirish'],
      ['📊 Statistika', '🚫 User ban'],
      ['🤖 Botlarni o‘chirish', '📢 Broadcast'],
      ['🔄 Foydalanuvchi ma\'lumoti', '🏠 Menyu']
    ]
  };

  // ===================== /admin =====================
  bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!isAllowed(userId)) {
      return bot.sendMessage(chatId, '❌ Siz admin emassiz');
    }

    const stats = getStats();
    const text = `👑 <b>ADMIN PANEL</b>\n\n` +
                 `📊 <b>Statistika:</b>\n` +
                 `👥 Foydalanuvchilar: ${stats.totalUsers}\n` +
                 `🤖 Botlar: ${stats.totalBots}\n` +
                 `💎 Premium: ${stats.premiumUsers}\n` +
                 `🟢 Online botlar: ${stats.onlineBots}\n` +
                 `👑 Adminlar: ${stats.totalAdmins}\n\n` +
                 `👇 Quyidagi tugmalardan foydalaning:`;

    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: ADMIN_KB
    });
  });

  // ===================== MESSAGE =====================
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();

    if (!text || text.startsWith('/')) return;
    if (!isAllowed(userId)) return;

    // ===== ADMIN MENYUGA QAYTISH =====
    if (text === '🏠 Menyu') {
      wait.delete(chatId);
      const stats = getStats();
      const menuText = `👑 <b>ADMIN PANEL</b>\n\n` +
                       `📊 <b>Statistika:</b>\n` +
                       `👥 Foydalanuvchilar: ${stats.totalUsers}\n` +
                       `🤖 Botlar: ${stats.totalBots}\n` +
                       `💎 Premium: ${stats.premiumUsers}\n` +
                       `🟢 Online botlar: ${stats.onlineBots}\n` +
                       `👑 Adminlar: ${stats.totalAdmins}`;
      
      return bot.sendMessage(chatId, menuText, {
        parse_mode: 'HTML',
        reply_markup: ADMIN_KB
      });
    }

    // ===== KUTILAYOTGAN HOLAT =====
    if (wait.has(chatId)) {
      const action = wait.get(chatId);
      wait.delete(chatId);

      // ===== BROADCAST =====
      if (action === 'broadcast') {
        const users = getAllUserIds();
        let sent = 0;
        let failed = 0;

        for (const id of users) {
          try {
            await bot.sendMessage(id, `📢 <b>ADMIN XABARI</b>\n\n${text}\n\n👤 Admin: @${msg.from.username || 'noma\'lum'}`, {
              parse_mode: 'HTML'
            });
            sent++;
            // 100 ms kutish har 10ta xabardan keyin
            if (sent % 10 === 0) await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            failed++;
            console.error(`❌ Broadcast ${id} ga:`, error.message);
          }
        }

        return bot.sendMessage(chatId, 
          `✅ Broadcast yakunlandi\n\n` +
          `📤 Yuborildi: ${sent} ta\n` +
          `❌ Yuborilmadi: ${failed} ta\n` +
          `📝 Matn: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`
        );
      }

      // ===== USER ID TEKSHIRISH =====
      const targetId = text.trim();
      if (!targetId || isNaN(targetId)) {
        return bot.sendMessage(chatId, '❌ Noto‘g‘ri ID format. Faqat raqam kiriting.');
      }

      const numericId = Number(targetId);

      // ===== ACTIONLAR =====
      switch (action) {

        case 'addPremium':
          addPremium(numericId);
          saveUser(numericId, { premiumAddedBy: userId, premiumAddedAt: new Date().toISOString() });
          return bot.sendMessage(chatId, `✅ <b>${numericId}</b> → PREMIUM qo'shildi`, { parse_mode: 'HTML' });

        case 'removePremium':
          removePremium(numericId);
          saveUser(numericId, { premiumRemovedBy: userId, premiumRemovedAt: new Date().toISOString() });
          return bot.sendMessage(chatId, `❌ <b>${numericId}</b> → PREMIUM o'chirildi`, { parse_mode: 'HTML' });

        case 'addAdmin':
          if (numericId === MAIN_ADMIN_ID) {
            return bot.sendMessage(chatId, 'ℹ️ Bu asosiy admin');
          }
          const added = addAdmin(numericId);
          if (added) {
            return bot.sendMessage(chatId, `✅ <b>${numericId}</b> → ADMIN qo'shildi`, { parse_mode: 'HTML' });
          } else {
            return bot.sendMessage(chatId, `ℹ️ <b>${numericId}</b> allaqachon admin`, { parse_mode: 'HTML' });
          }

        case 'removeAdmin':
          if (numericId === MAIN_ADMIN_ID) {
            return bot.sendMessage(chatId, '❌ Asosiy admin ochirilmaydi');
          }
          const removed = removeAdmin(numericId);
          if (removed) {
            return bot.sendMessage(chatId, `❌ <b>${numericId}</b> → ADMIN o'chirildi`, { parse_mode: 'HTML' });
          } else {
            return bot.sendMessage(chatId, `ℹ️ <b>${numericId}</b> admin emas`, { parse_mode: 'HTML' });
          }

        case 'removeBots':
          const bots = getUserBots(numericId);
          if (!bots.length) {
            return bot.sendMessage(chatId, `ℹ️ <b>${numericId}</b> da botlar topilmadi`, { parse_mode: 'HTML' });
          }
          bots.forEach(b => removeBot(b.id));
          return bot.sendMessage(chatId, 
            `🗑 <b>${numericId}</b> ning botlari o'chirildi\n` +
            `📊 ${bots.length} ta bot o'chirildi`, 
            { parse_mode: 'HTML' }
          );

        case 'banUser':
          if (numericId === MAIN_ADMIN_ID || isAdmin(numericId)) {
            return bot.sendMessage(chatId, '❌ Adminni ban qilish mumkin emas');
          }
          saveUser(numericId, { 
            banned: true, 
            bannedBy: userId, 
            bannedAt: new Date().toISOString(),
            banReason: 'Admin tomonidan'
          });
          return bot.sendMessage(chatId, `🚫 <b>${numericId}</b> → BAN qilindi`, { parse_mode: 'HTML' });

        case 'userInfo':
          const user = require('./database').getUser(numericId);
          if (!user) {
            return bot.sendMessage(chatId, `ℹ️ <b>${numericId}</b> topilmadi`, { parse_mode: 'HTML' });
          }
          
          const userBots = getUserBots(numericId);
          const userInfo = `👤 <b>USER MA'LUMOTI</b>\n\n` +
                          `🆔 ID: ${numericId}\n` +
                          `📛 Ism: ${user.firstName || 'Noma\'lum'}\n` +
                          `👤 Username: @${user.username || 'yo\'q'}\n` +
                          `💎 Premium: ${user.premium ? '✅' : '❌'}\n` +
                          `🚫 Ban: ${user.banned ? '✅' : '❌'}\n` +
                          `🤖 Botlar: ${userBots.length} ta\n` +
                          `📅 Qo'shilgan: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Noma\'lum'}\n` +
                          `🕒 Oxirgi faollik: ${user.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Noma\'lum'}`;
          
          return bot.sendMessage(chatId, userInfo, { parse_mode: 'HTML' });
      }
    }

    // ===================== BUTTONLAR =====================
    switch (text) {

      case '👑 Premium qo‘shish':
        wait.set(chatId, 'addPremium');
        return bot.sendMessage(chatId, '🟢 Premium beriladigan foydalanuvchi ID sini kiriting:');

      case '👑 Premium o‘chirish':
        wait.set(chatId, 'removePremium');
        return bot.sendMessage(chatId, '🔴 Premium ochiriladigan foydalanuvchi ID sini kiriting:');

      case '👥 Admin qo‘shish':
        wait.set(chatId, 'addAdmin');
        return bot.sendMessage(chatId, '🟢 Admin qilinadigan foydalanuvchi ID sini kiriting:');

      case '👥 Admin o‘chirish':
        wait.set(chatId, 'removeAdmin');
        return bot.sendMessage(chatId, '🔴 Admin ochiriladigan foydalanuvchi ID sini kiriting:');

      case '🤖 Botlarni o‘chirish':
        wait.set(chatId, 'removeBots');
        return bot.sendMessage(chatId, '🗑 Botlari ochiriladigan foydalanuvchi ID sini kiriting:');

      case '📢 Broadcast':
        wait.set(chatId, 'broadcast');
        return bot.sendMessage(chatId, '📣 Broadcast matnini kiriting (barcha foydalanuvchilarga yuboriladi):');

      case '🚫 User ban':
        wait.set(chatId, 'banUser');
        return bot.sendMessage(chatId, '🚫 Ban qilinadigan foydalanuvchi ID sini kiriting:');

      case '🔄 Foydalanuvchi ma\'lumoti':
        wait.set(chatId, 'userInfo');
        return bot.sendMessage(chatId, '👤 Ma\'lumot korish uchun foydalanuvchi ID sini kiriting:');

      case '📊 Statistika':
        const stats = getStats();
        const statsText = `📊 <b>STATISTIKA</b>\n\n` +
                         `👥 Foydalanuvchilar: ${stats.totalUsers}\n` +
                         `🤖 Botlar: ${stats.totalBots}\n` +
                         `💎 Premium: ${stats.premiumUsers}\n` +
                         `🟢 Online botlar: ${stats.onlineBots}\n` +
                         `🔴 Offline botlar: ${stats.totalBots - stats.onlineBots}\n` +
                         `👑 Adminlar: ${stats.totalAdmins}\n\n` +
                         `🔄 Yangilangan: ${new Date().toLocaleTimeString()}`;
        
        return bot.sendMessage(chatId, statsText, { parse_mode: 'HTML' });
    }
  });
}

module.exports = { initAdmin };
