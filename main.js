const TelegramBot = require('node-telegram-bot-api');
const { createMinecraftBot, stopUserBots, stopBot } = require('./qoshish.js');
const { initAdmin } = require('./admin.js');
const { DDoSAttack } = require('./ddos.js');
const { saveUser, getUserBots, getSettings, isPremium, removeBot } = require('./database.js');

const bot = new TelegramBot('6513975219:AAGYkY2pFPGyttgOKKWaCLrGwL43aT6IbHw', { 
    polling: true,
    request: { timeout: 30000 }
});

const userStates = new Map();
const ddosAttacks = new Map();

// Keyboardlar
const keyboards = {
    main: { keyboard: [['➕ Bot'], ['📋 Botlarim'], ['💎 Premium', 'ℹ️ Yordam']], resize_keyboard: true },
    premium: { keyboard: [['➕ Bot'], ['📋 Botlarim'], ['💎 Premium', '⚡ DDoS'], ['🛑 DDoS', '🛑 To\'xtatish'], ['🏠 Menyu']], resize_keyboard: true },
    cancel: { keyboard: [['🚫 Bekor']], resize_keyboard: true },
    version: { keyboard: [['1.21.50', '1.20.80'], ['1.19.80', '1.17.40', 'Auto'], ['🚫 Bekor']], resize_keyboard: true }
};

function getUserKeyboard(userId) {
    return isPremium(userId) ? keyboards.premium : keyboards.main;
}

function formatBotInfo(botData) {
    const time = Math.floor((Date.now() - new Date(botData.createdAt)) / 60000);
    const hours = Math.floor(time / 60);
    const minutes = time % 60;
    return `🤖 ${botData.botName}\n🌐 ${botData.server}\n📦 ${botData.version}\n⏰ ${hours > 0 ? hours + ' soat ' : ''}${minutes} daqiqa`;
}

// Start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    
    saveUser(userId, { username, firstName: msg.from.first_name, firstSeen: new Date().toISOString() });
    
    const premium = isPremium(userId);
    const settings = getSettings();
    
    let text = `👋 ${username}!\n`;
    text += premium ? `💎 Premium\nLimit: ${settings.premiumLimit} bot\nDDoS: ✅` 
                   : `📱 Oddiy\nLimit: 1 bot\nPremium: ${settings.premiumPrice} so'm`;
    
    bot.sendMessage(chatId, text, { reply_markup: getUserKeyboard(userId) });
});

// Bot qo'shish
bot.onText(/➕ Bot/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const userBots = getUserBots(userId);
    const premium = isPremium(userId);
    const limit = premium ? getSettings().premiumLimit : 1;
    
    if (userBots.length >= limit) {
        if (!premium) {
            // Oddiy foydalanuvchi: eski botni o'chirish
            removeBot(userBots[0].id);
        } else {
            return bot.sendMessage(chatId, `❌ Limit: ${userBots.length}/${limit}`, { 
                reply_markup: getUserKeyboard(userId) 
            });
        }
    }
    
    userStates.set(chatId, { step: 'ip', userId });
    bot.sendMessage(chatId, '🌐 IP kiriting:', { reply_markup: keyboards.cancel });
});

// Botlarim
bot.onText(/📋 Botlarim/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userBots = getUserBots(userId);
    
    if (userBots.length === 0) {
        return bot.sendMessage(chatId, '❌ Bot yo\'q', { reply_markup: getUserKeyboard(userId) });
    }
    
    let text = `📋 Botlar (${userBots.length}):\n\n`;
    const kb = { keyboard: [], resize_keyboard: true };
    
    userBots.forEach(bot => {
        text += formatBotInfo(bot) + '\n\n';
        kb.keyboard.push([`🛑 ${bot.botName}`]);
    });
    
    kb.keyboard.push(['🏠 Menyu']);
    bot.sendMessage(chatId, text, { reply_markup: kb });
});

// Premium
bot.onText(/💎 Premium/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const settings = getSettings();
    
    if (isPremium(userId)) {
        const userBots = getUserBots(userId);
        bot.sendMessage(chatId, `💎 SIZ PREMIUM\nLimit: ${settings.premiumLimit} bot\nJoriy: ${userBots.length} bot\nDDoS: ✅`, { 
            reply_markup: keyboards.premium 
        });
    } else {
        bot.sendMessage(chatId, `💎 Premium: ${settings.premiumPrice} so'm\nLimit: ${settings.premiumLimit} bot\nDDoS: 10 bot\n\nSotib olish: @crpytouzb`, { 
            reply_markup: keyboards.main 
        });
    }
});

// Yordam
bot.onText(/ℹ️ Yordam/, (msg) => {
    const settings = getSettings();
    bot.sendMessage(msg.chat.id, 
        `ℹ️ YORDAM\n\n📱 Oddiy: 1 bot\n💎 Premium: ${settings.premiumLimit} bot + DDoS\n\n1. IP kiriting\n2. Port kiriting\n3. Versiya tanlang\n\nAdmin: @crpytouzb`,
        { reply_markup: keyboards.main }
    );
});

// Message handler
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from?.id;
    if (!userId || !text || text.startsWith('/')) return;
    
    const state = userStates.get(chatId);
    if (!state) return;
    
    try {
        // Bot qo'shish - IP
        if (state.step === 'ip') {
            if (text === '🚫 Bekor') {
                userStates.delete(chatId);
                return bot.sendMessage(chatId, '❌ Bekor', { reply_markup: getUserKeyboard(userId) });
            }
            
            const ip = text.trim();
            if (!ip) return bot.sendMessage(chatId, '❌ IP kiriting:', { reply_markup: keyboards.cancel });
            
            userStates.set(chatId, { step: 'port', userId, ip });
            bot.sendMessage(chatId, '🔢 Port (19132):', { reply_markup: keyboards.cancel });
        }
        // Bot qo'shish - Port
        else if (state.step === 'port') {
            if (text === '🚫 Bekor') {
                userStates.delete(chatId);
                return bot.sendMessage(chatId, '❌ Bekor', { reply_markup: getUserKeyboard(userId) });
            }
            
            let port = parseInt(text);
            if (isNaN(port)) port = 19132;
            
            userStates.set(chatId, { step: 'version', userId, ip: state.ip, port });
            bot.sendMessage(chatId, '📦 Versiya:', { reply_markup: keyboards.version });
        }
        // Bot qo'shish - Versiya
        else if (state.step === 'version') {
            if (text === '🚫 Bekor') {
                userStates.delete(chatId);
                return bot.sendMessage(chatId, '❌ Bekor', { reply_markup: getUserKeyboard(userId) });
            }
            
            const { ip, port } = state;
            const loading = await bot.sendMessage(chatId, `🔄 Bot ulanmoqda...`);
            
            try {
                const result = await createMinecraftBot({ ip, port, version: text, userId });
                const userBots = getUserBots(userId);
                const premium = isPremium(userId);
                const limit = premium ? getSettings().premiumLimit : 1;
                
                await bot.editMessageText(`✅ Bot qo'shildi!\n\n${formatBotInfo(result)}\n📊 ${userBots.length}/${limit}`, {
                    chat_id: chatId,
                    message_id: loading.message_id
                });
                
                userStates.delete(chatId);
            } catch (error) {
                await bot.editMessageText(`❌ ${error.message}`, {
                    chat_id: chatId,
                    message_id: loading.message_id
                });
                userStates.delete(chatId);
            }
        }
    } catch (error) {
        console.error('Xato:', error.message);
        userStates.delete(chatId);
        bot.sendMessage(chatId, '❌ Xatolik', { reply_markup: getUserKeyboard(userId) });
    }
});

// Botni to'xtatish
bot.on('message', async (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!text?.startsWith('🛑 ') || text === '🛑 DDoS' || text === '🛑 To\'xtatish') return;
    
    const botName = text.replace('🛑 ', '');
    const userBots = getUserBots(userId);
    const botToStop = userBots.find(b => b.botName === botName);
    
    if (!botToStop) return;
    
    // Faqat Premium foydalanuvchilar botlarni to'xtata oladi
    if (!isPremium(userId)) {
        return bot.sendMessage(chatId, '❌ Faqat Premium uchun!\n💎 Yangi bot qo\'shganda avvalgisi o\'chiriladi', { 
            reply_markup: keyboards.main 
        });
    }
    
    const loading = await bot.sendMessage(chatId, `🛑 ${botName} to'xtatilmoqda...`);
    
    try {
        const result = await stopBot(botToStop.id);
        await bot.editMessageText(result.message, {
            chat_id: chatId,
            message_id: loading.message_id
        });
    } catch (error) {
        await bot.editMessageText(`❌ ${error.message}`, {
            chat_id: chatId,
            message_id: loading.message_id
        });
    }
});

// DDoS boshlash
bot.onText(/⚡ DDoS/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isPremium(userId)) {
        return bot.sendMessage(chatId, '❌ Premium kerak', { reply_markup: keyboards.main });
    }
    
    userStates.set(chatId, { step: 'ddos_ip', userId });
    bot.sendMessage(chatId, '🌐 DDoS IP:', { reply_markup: keyboards.cancel });
});

// DDoS to'xtatish
bot.onText(/🛑 DDoS/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isPremium(userId)) {
        return bot.sendMessage(chatId, '❌ Premium kerak', { reply_markup: keyboards.main });
    }
    
    if (!ddosAttacks.has(userId)) {
        return bot.sendMessage(chatId, '❌ DDoS yo\'q', { reply_markup: keyboards.premium });
    }
    
    try {
        const result = ddosAttacks.get(userId).stopAllAttacks();
        ddosAttacks.delete(userId);
        bot.sendMessage(chatId, `✅ DDoS to'xtatildi\n${result.stoppedBots} bot`, { reply_markup: keyboards.premium });
    } catch (error) {
        bot.sendMessage(chatId, '❌ Xatolik', { reply_markup: keyboards.premium });
    }
});

// Botlarni to'xtatish (Premium uchun)
bot.onText(/🛑 To\'xtatish/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isPremium(userId)) {
        return bot.sendMessage(chatId, '❌ Premium kerak', { reply_markup: keyboards.main });
    }
    
    const userBots = getUserBots(userId);
    if (userBots.length === 0) {
        return bot.sendMessage(chatId, '❌ Bot yo\'q', { reply_markup: keyboards.premium });
    }
    
    const loading = await bot.sendMessage(chatId, `🛑 ${userBots.length} bot to'xtatilmoqda...`);
    
    try {
        const result = await stopUserBots(userId);
        await bot.editMessageText(result.message, {
            chat_id: chatId,
            message_id: loading.message_id
        });
    } catch (error) {
        await bot.editMessageText(`❌ ${error.message}`, {
            chat_id: chatId,
            message_id: loading.message_id
        });
    }
});

// Menyu va Bekor
bot.onText(/🏠 Menyu/, (msg) => {
    userStates.delete(msg.chat.id);
    bot.sendMessage(msg.chat.id, '🏠 Menyu', { reply_markup: getUserKeyboard(msg.from.id) });
});

bot.onText(/🚫 Bekor/, (msg) => {
    userStates.delete(msg.chat.id);
    bot.sendMessage(msg.chat.id, '❌ Bekor', { reply_markup: getUserKeyboard(msg.from.id) });
});

// Admin panel
initAdmin(bot);

console.log('🤖 Bot ishga tushdi');

// Error handlerlar
bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error.message);
});
