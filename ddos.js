const bedrock = require('bedrock-protocol');

async function DDoSAttack(bot, chatId, ip, port = 19132, version = '1.21.50') {
  const BOT_COUNT = 2;
  const ONLINE_TIME = 5000; // 5 soniya
  const clients = [];

  try {
    await bot.sendMessage(chatId, `⚡ DDoS boshlandi (TEST)\n\n🌐 ${ip}:${port}\n📦 ${version}\n🤖 Botlar: ${BOT_COUNT}\n⏱ ${ONLINE_TIME/1000} soniya`);

    for (let i = 1; i <= BOT_COUNT; i++) {
      const username = `TELEGRAM_MCPEbotAdderBot_${i}`;
      
      try {
        const client = bedrock.createClient({
          host: ip,
          port: port,
          username: username,
          offline: true,
          version: version
        });

        let joined = false;

        // Serverga kirdi
        client.on('spawn', () => {
          joined = true;
          console.log(`🤖 [DDOS-TEST] ${username} serverga kirdi`);
        });

        // Xatolik bo'lsa
        client.on('error', (err) => {
          console.log(`⚠️ ${username} error: ${err.message}`);
          if (!joined) {
            bot.sendMessage(chatId, `❌ ${username} serverga kira olmadi yoki server o'chiq`);
          }
        });

        // Disconnect
        client.on('disconnect', (reason) => {
          console.log(`🚪 [DDOS-TEST] ${username} serverdan chiqdi (${reason})`);
        });

        clients.push(client);
      } catch (err) {
        console.error(`❌ ${username} yaratishda xato:`, err.message);
      }
    }

    // Hammasi tugagach
    setTimeout(() => {
      // Barcha clientlarni yopish
      clients.forEach(client => {
        try {
          if (client && !client.closed) {
            client.close();
          }
        } catch (err) {}
      });

      bot.sendMessage(chatId, `✅ DDoS TEST TUGADI\n\n🤖 ${BOT_COUNT} ta bot urinish qildi\n🌐 ${ip}:${port}\n🛡`);
    }, ONLINE_TIME + 1000);

  } catch (err) {
    console.error('❌ DDoS test xatosi:', err);
    bot.sendMessage(chatId, '❌ DDoS jarayonida xatolik yuz berdi');
  }
}

// Ikkala nom bilan export qilish
module.exports = { 
  DDoSAttack, 
  startFakeDDoS: DDoSAttack 
};
