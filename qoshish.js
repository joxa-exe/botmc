const bedrock = require('bedrock-protocol');
const { addBot, getUserBots, getSettings, isPremium } = require('./database.js');

async function createMinecraftBot(serverData) {
  try {
    const { ip, port, version, userId, username } = serverData;
    
    const botNumber = (getUserBots(userId).length + 1);
    const botName = `MCPE_${username}_${botNumber}`;
    
    const botData = {
      id: Date.now().toString(),
      userId: userId,
      username: username,
      botName: botName,
      server: `${ip}:${port}`,
      version: version,
      status: 'connecting',
      createdAt: new Date().toISOString()
    };
    
    const botId = addBot(botData);
    
    const client = bedrock.createClient({
      host: ip,
      port: port,
      username: botName,
      offline: true,
      version: version === 'Auto' ? undefined : version,
      connectTimeout: 15000,
      skipPing: true
    });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.close();
        reject(new Error('Ulanish vaqti tugadi (15 soniya)'));
      }, 15000);
      
      client.on('spawn', () => {
        clearTimeout(timeout);
        resolve({
          success: true,
          botId: botId,
          botName: botName,
          server: `${ip}:${port}`,
          version: version,
          message: 'Bot muvaffaqiyatli ulandi!'
        });
      });
      
      client.on('error', (error) => {
        clearTimeout(timeout);
        client.close();
        reject(new Error(`Server xatosi: ${error.message}`));
      });
      
      client.on('kick', (reason) => {
        clearTimeout(timeout);
        client.close();
        reject(new Error(`Bot kiklandi: ${reason}`));
      });
    });
    
  } catch (error) {
    throw new Error(`Bot yaratishda xato: ${error.message}`);
  }
}

function checkUserLimit(userId) {
  const settings = getSettings();
  const userBotsCount = getUserBots(userId).length;
  const userLimit = isPremium(userId) ? settings.premiumLimit : settings.regularLimit;
  
  return {
    canAdd: userBotsCount < userLimit,
    current: userBotsCount,
    limit: userLimit,
    remaining: userLimit - userBotsCount
  };
}

module.exports = {
  createMinecraftBot,
  checkUserLimit
};
