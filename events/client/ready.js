const { Events, ActivityType } = require('discord.js');
const startGiveawayScheduler = require('../../functions/giveawayScheduler');
const serverStatusUpdater = require('../../functions/serverStatusUpdater');
const updateStatus = require('../../functions/statusRotation');
const startLeaderboardScheduler = require('../../functions/leaderboardScheduler');
const fs = require('fs');
const path = require('path');
const voiceStateUpdate = require('../voiceStateUpdate');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    startGiveawayScheduler(client);
    serverStatusUpdater(client);
    updateStatus(client);
    startLeaderboardScheduler(client);
    if (typeof voiceStateUpdate.initialize === 'function') {
      await voiceStateUpdate.initialize(client);
    }
    const commandFolderPath = path.join(__dirname, '../../commands');
    const categories = fs
      .readdirSync(commandFolderPath)
      .filter((file) =>
        fs.statSync(path.join(commandFolderPath, file)).isDirectory()
      );

    let categoryText = `${global.styles.accentColor('📂 Categories:')}\n`;
    categories.forEach((category) => {
      categoryText += `    ${global.styles.primaryColor('🔸')} ${global.styles.commandColor(category)}\n`;
    });

    const startTime = new Date().toLocaleString();
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
      2
    );
    const serverCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce(
      (acc, guild) => acc + guild.memberCount,
      0
    );

    const divider = global.styles.dividerColor(
      '═══════════════════════════════════════════════════════════════'
    );

    console.log(`\n${divider}`);

    console.log(
      `${global.styles.infoColor('🤖 Bot User       :')} ${global.styles.userColor(client.user.tag)}`
    );
    console.log(
      `${global.styles.infoColor('🌍 Servers        :')} ${global.styles.accentColor(serverCount)}`
    );
    console.log(
      `${global.styles.infoColor('👥 Total Users    :')} ${global.styles.successColor(userCount)}`
    );
    console.log(
      `${global.styles.infoColor('📡 Status         :')} ${global.styles.successColor('Online 🟢')}`
    );
    console.log(
      `${global.styles.infoColor('⏰ Started At     :')} ${global.styles.secondaryColor(startTime)}`
    );
    console.log(
      `${global.styles.infoColor('📦 Version        :')} ${global.styles.secondaryColor('v1.0.0')}`
    );
    console.log(
      `${global.styles.infoColor('🔧 Node.js        :')} ${global.styles.highlightColor(process.version)}`
    );
    console.log(
      `${global.styles.infoColor('💾 Memory Usage   :')} ${global.styles.errorColor(`${memoryUsage} MB`)}\n`
    );

    console.log(`${divider}`);
    console.log(`${categoryText}`);
    console.log(`${divider}`);
    console.log(`${global.styles.successColor('\n🚀 Bot is ready! 🚀')}`);
    console.log(`${divider}\n`);
  },
};
