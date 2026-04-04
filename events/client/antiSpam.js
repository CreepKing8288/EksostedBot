const { Events, PermissionFlagsBits } = require('discord.js');
const AntiSpam = require('../../models/AntiSpam');

const messageCounts = new Map();

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const config = await AntiSpam.findOne({ guildId: message.guild.id });
    if (!config || !config.enabled) return;

    if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    if (config.whitelistedChannels.includes(message.channel.id)) return;

    if (config.whitelistedRoles.some(roleId => message.member.roles.cache.has(roleId))) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const key = `${guildId}-${userId}`;
    const now = Date.now();

    if (!messageCounts.has(key)) {
      messageCounts.set(key, []);
    }

    const timestamps = messageCounts.get(key);
    timestamps.push(now);

    const recentMessages = timestamps.filter(ts => now - ts <= config.timeWindowMs);
    messageCounts.set(key, recentMessages);

    if (recentMessages.length > config.maxMessages) {
      await message.delete().catch(() => {});

      if (config.punishment === 'timeout' && message.member.moderatable) {
        await message.member.timeout(config.timeoutDuration * 1000, 'Spam detected').catch(() => {});
      }

      const warning = await message.channel.send({
        content: `${message.author}, your messages have been flagged for spam.`,
      }).catch(() => {});
      if (warning) {
        setTimeout(async () => { await warning.delete().catch(() => {}); }, 5000);
      }

      messageCounts.delete(key);
      return;
    }

    if (config.duplicateCheck) {
      const recentInChannel = await message.channel.messages.fetch({ limit: 10 });
      const recentByUser = recentInChannel.filter(m => m.author.id === userId && m.id !== message.id);

      for (const [_, recentMsg] of recentByUser) {
        if (recentMsg.content.toLowerCase() === message.content.toLowerCase() && message.content.length > 10) {
          await message.delete().catch(() => {});
          const warning = await message.channel.send({
            content: `${message.author}, please do not repeat messages.`,
          }).catch(() => {});
          if (warning) {
            setTimeout(async () => { await warning.delete().catch(() => {}); }, 5000);
          }
          return;
        }
      }
    }

    if (config.capsCheck && message.content.length > 10) {
      const capsCount = (message.content.match(/[A-Z]/g) || []).length;
      const totalLetters = (message.content.match(/[a-zA-Z]/g) || []).length;
      if (totalLetters > 0 && (capsCount / totalLetters) * 100 > config.capsThreshold) {
        await message.delete().catch(() => {});
        const warning = await message.channel.send({
          content: `${message.author}, please avoid excessive caps.`,
        }).catch(() => {});
        if (warning) {
          setTimeout(async () => { await warning.delete().catch(() => {}); }, 5000);
        }
      }
    }
  },
};
