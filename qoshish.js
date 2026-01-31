const bedrock = require('bedrock-protocol');
const { addBot, getUserBots, getSettings, isPremium, removeBot } = require('./database.js');

const activeConnections = new Map();
const reconnectAttempts = new Map();

async function createMinecraftBot(serverData) {
  const { ip, port, version, userId } = serverData;
  
  // Foydalanuvchi botlarini tekshirish
  const userBots = getUserBots(userId);
  const premium = isPremium(userId);
  const limit = premium ? getSettings().premiumLimit : 1;
  
  // Agar oddiy foydalanuvchi va bot bor bo'lsa, uni serverdan chiqarish
  if (!premium && userBots.length > 0) {
    const oldBot = userBots[0];
    
    // Eski botni serverdan chiqarish
    const oldClient = activeConnections.get(oldBot.id);
    if (oldClient) {
      try {
        oldClient.removeAllListeners();
        oldClient.close();
        console.log(`Eski bot ${oldBot.botName} serverdan chiqarildi`);
      } catch (e) {
        console.error('Eski botni chiqarishda xato:', e.message);
      }
      activeConnections.delete(oldBot.id);
    }
    
    // Bazadan o'chirish
    removeBot(oldBot.id);
  }
  
  // Premium uchun limit tekshirish
  if (premium && userBots.length >= limit) {
    throw new Error(`❌ Premium limiti: ${userBots.length}/${limit}`);
  }
  
  // Bot nomini yaratish
  const botNumber = userBots.filter(b => b.userId === userId).length + 1;
  const botName = `Telegram_MCPEBotAdderBot_${botNumber}`;
  
  return new Promise((resolve, reject) => {
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    reconnectAttempts.set(botId, 0);
    
    function connectBot() {
      let client = null;
      
      try {
        // Versiya moslashuvi
        let clientVersion = version === 'Auto' ? '1.21.50' : version;
        
        // Agar server 1.21.51 bo'lsa, bot ham 1.21.51 bilan ulanishga urinib ko'rish
        if (clientVersion === '1.21.50') {
          console.log(`Trying with version: ${clientVersion}`);
        }
        
        client = bedrock.createClient({
          host: ip,
          port: parseInt(port) || 19132,
          username: botName,
          offline: true,
          version: clientVersion,
          connectTimeout: 25000,
          skipPing: true,
          authTitle: false,
          viewDistance: 1,
          chatsDisabled: true,
          defaultChatMode: 'disabled',
          profilesFolder: './bot_profiles',
          onMsaCode: (data) => {
            console.log('MSA code:', data);
          }
        });
        
        client.botId = botId;
        client.botVersion = clientVersion;
        
        client.on('spawn', () => {
          console.log(`✅ Bot ${botName} serverga ulandi (${clientVersion}): ${ip}:${port}`);
          reconnectAttempts.set(botId, 0);
          
          // Bot ma'lumotlarini saqlash
          const botData = {
            id: botId,
            userId: userId,
            botName: botName,
            server: `${ip}:${port}`,
            version: clientVersion,
            status: 'connected',
            createdAt: new Date().toISOString(),
            connectedAt: new Date().toISOString()
          };
          
          // Bazaga saqlash
          addBot(botData);
          
          // Active connectionsga qo'shish
          activeConnections.set(botId, client);
          
          // Bot serverda qolishi uchun keep-alive
          const keepAliveInterval = setInterval(() => {
            if (client && client.connection) {
              try {
                client.queue('client_to_server_handshake', {});
              } catch (e) {
                // Silent fail
              }
            }
          }, 15000);
          
          client.on('close', () => {
            clearInterval(keepAliveInterval);
            activeConnections.delete(botId);
            console.log(`Bot ${botName} disconnect qilindi, qayta ulanmoqda...`);
            
            setTimeout(() => {
              const attempts = reconnectAttempts.get(botId) || 0;
              if (attempts < 15) {
                reconnectAttempts.set(botId, attempts + 1);
                console.log(`Bot ${botName} qayta ulanmoqda (${attempts + 1}/15)...`);
                connectBot();
              }
            }, 2000);
          });
          
          if (!client._hasResolved) {
            client._hasResolved = true;
            resolve({
              success: true,
              botId: botData.id,
              botName: botName,
              server: `${ip}:${port}`,
              version: clientVersion,
              status: 'connected'
            });
          }
        });
        
        client.on('error', (error) => {
          console.error(`Bot ${botName} xatosi (${clientVersion}):`, error.message);
          
          // Agar versiya xatosi bo'lsa, boshqa versiya bilan urinib ko'rish
          if (error.message.includes('version') || error.message.includes('incompatible')) {
            console.log(`Versiya mos kelmadi (${clientVersion}), Auto versiyani sinab ko'ramiz`);
            
            if (clientVersion !== '1.21.51') {
              // 1.21.51 versiyasi bilan urinib ko'rish
              setTimeout(() => {
                if (client) {
                  try {
                    client.close();
                  } catch (e) {}
                }
                console.log(`Bot ${botName} 1.21.51 versiyasi bilan qayta ulanmoqda...`);
                clientVersion = '1.21.51';
                connectBot();
              }, 1000);
              return;
            }
          }
          
          if (!client._hasRejected) {
            client._hasRejected = true;
            reject(new Error(`❌ Server xatosi: ${error.message}`));
          }
        });
        
        client.on('kick', (reason) => {
          const kickReason = typeof reason === 'string' ? reason : (reason?.reason || 'Noma\'lum sabab');
          console.log(`Bot ${botName} kiklandi (${clientVersion}):`, kickReason);
          
          if (!client._hasResolved) {
            client._hasResolved = true;
            resolve({
              success: true,
              botId: botId,
              botName: botName,
              server: `${ip}:${port}`,
              version: clientVersion,
              status: 'kicked',
              message: 'Bot qo\'shildi (lekin kiklandi)'
            });
          }
          
          // Agar unexpected_packet xatosi bo'lsa, versiyani o'zgartirish
          if (kickReason.includes('unexpected_packet') && clientVersion === '1.21.50') {
            console.log(`Unexpected packet xatosi, 1.21.51 versiyasi bilan urinib ko'ramiz`);
            setTimeout(() => {
              if (client) {
                try {
                  client.close();
                } catch (e) {}
              }
              clientVersion = '1.21.51';
              console.log(`Bot ${botName} 1.21.51 versiyasi bilan qayta ulanmoqda...`);
              connectBot();
            }, 1000);
          } else {
            // Oddiy qayta ulanish
            setTimeout(() => {
              if (client) {
                try {
                  client.close();
                } catch (e) {}
              }
              const attempts = reconnectAttempts.get(botId) || 0;
              if (attempts < 15) {
                reconnectAttempts.set(botId, attempts + 1);
                console.log(`Bot ${botName} kiklandi, qayta ulanmoqda (${attempts + 1}/15)...`);
                connectBot();
              }
            }, 1000);
          }
        });
        
        // 30 soniyada ulanmasa xato
        setTimeout(() => {
          if (client && !client.connection && !client._hasResolved && !client._hasRejected) {
            console.log(`Bot ${botName} vaqt tugadi (${clientVersion}), qayta ulanmoqda...`);
            if (client) {
              try {
                client.close();
              } catch (e) {}
            }
            
            const attempts = reconnectAttempts.get(botId) || 0;
            if (attempts < 10) {
              reconnectAttempts.set(botId, attempts + 1);
              setTimeout(() => {
                console.log(`Bot ${botName} qayta ulanmoqda (timeout ${attempts + 1}/10)...`);
                connectBot();
              }, 3000);
            } else {
              if (!client._hasRejected) {
                client._hasRejected = true;
                reject(new Error('❌ Serverga ulanib bo\'lmadi'));
              }
            }
          }
        }, 30000);
        
      } catch (error) {
        console.error(`Bot ${botName} yaratishda xato (${version}):`, error.message);
        
        if (client) {
          try {
            client.close();
          } catch (e) {}
        }
        
        const attempts = reconnectAttempts.get(botId) || 0;
        if (attempts < 5 && !error.message.includes('Premium limiti')) {
          reconnectAttempts.set(botId, attempts + 1);
          console.log(`Bot ${botName} yaratishda xato, qayta urinmoqda (${attempts + 1}/5)...`);
          setTimeout(() => connectBot(), 4000);
        } else {
          reject(new Error(`❌ Bot yaratishda xato: ${error.message}`));
        }
      }
    }
    
    // Birinchi marta ulanish
    connectBot();
  });
}

// Botni to'xtatish (faqat Premium uchun)
async function stopBot(botId) {
  try {
    const client = activeConnections.get(botId);
    if (client) {
      client.removeAllListeners();
      client.close();
      activeConnections.delete(botId);
      reconnectAttempts.delete(botId);
    }
    
    // Bazadan o'chirish
    removeBot(botId);
    
    return { success: true, message: '✅ Bot to\'xtatildi va serverdan chiqarildi' };
  } catch (error) {
    return { success: false, message: `❌ Xatolik: ${error.message}` };
  }
}

// Foydalanuvchi botlarini to'xtatish (faqat Premium uchun)
async function stopUserBots(userId) {
  try {
    const userBots = getUserBots(userId);
    let stopped = 0;
    
    for (const bot of userBots) {
      try {
        // Botni serverdan chiqarish
        const client = activeConnections.get(bot.id);
        if (client) {
          client.removeAllListeners();
          client.close();
          activeConnections.delete(bot.id);
          reconnectAttempts.delete(bot.id);
        }
        
        // Bazadan o'chirish
        removeBot(bot.id);
        stopped++;
      } catch (e) {
        console.error(`Bot ${bot.id} to'xtatishda xato:`, e.message);
      }
    }
    
    return { 
      success: true, 
      message: `✅ ${stopped} ta bot to'xtatildi va serverdan chiqarildi`,
      stoppedCount: stopped 
    };
  } catch (error) {
    return { success: false, message: `❌ Xatolik: ${error.message}` };
  }
}

module.exports = {
  createMinecraftBot,
  stopBot,
  stopUserBots
};
