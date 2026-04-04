const { Events } = require('discord.js');
const AFK = require('../../models/AFK');

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const userAFK = await AFK.findOneAndDelete({
      guildId: message.guild.id,
      userId: message.author.id,
    });

    if (userAFK) {
      const duration = Math.floor((Date.now() - new Date(userAFK.timestamp).getTime()) / 1000);
      const minutes = Math.floor(duration / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      let timeStr;
      if (days > 0) timeStr = `${days}d ${hours % 24}h`;
      else if (hours > 0) timeStr = `${hours}h ${minutes % 60}m`;
      else timeStr = `${minutes}m`;

      const welcomeBack = await message.channel.send({
        content: `${message.author}, welcome back! You were AFK for **${timeStr}**.`,
      }).catch(() => {});

      if (welcomeBack) {
        setTimeout(async () => {
          await welcomeBack.delete().catch(() => {});
        }, 10000);
      }
    }

    const mentionedUsers = message.mentions.users;
    if (mentionedUsers.size === 0) return;

    for (const [userId, user] of mentionedUsers) {
      if (user.bot) continue;

      const afkData = await AFK.findOne({
        guildId: message.guild.id,
        userId,
      });

      if (afkData) {
        const duration = Math.floor((Date.now() - new Date(afkData.timestamp).getTime()) / 1000);
        const minutes = Math.floor(duration / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        let timeStr;
        if (days > 0) timeStr = `${days}d ${hours % 24}h`;
        else if (hours > 0) timeStr = `${hours}h ${minutes % 60}m`;
        else timeStr = `${minutes}m`;

        const reply = await message.reply({
          content: `${user} is AFK: **${afkData.reason}** (${timeStr} ago)`,
          allowedMentions: { users: [message.author.id] },
        }).catch(() => {});

        if (reply) {
          setTimeout(async () => {
            await reply.delete().catch(() => {});
          }, 10000);
        }
      }
    }
  },
};
