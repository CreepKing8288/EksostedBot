const { Events, PermissionFlagsBits } = require('discord.js');
const LinkFilter = require('../../models/LinkFilter');

const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9]+/i;
const linkRegex = /https?:\/\/[^\s]+/i;

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const config = await LinkFilter.findOne({ guildId: message.guild.id });
    if (!config || !config.enabled) return;

    if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    if (config.whitelistedChannels.includes(message.channel.id)) return;

    if (config.whitelistedRoles.some(roleId => message.member.roles.cache.has(roleId))) return;

    const content = message.content;

    if (config.blockInvites && inviteRegex.test(content)) {
      await message.delete().catch(() => {});
      const warning = await message.channel.send({
        content: `${message.author}, Discord invite links are not allowed.`,
      }).catch(() => {});
      if (warning) {
        setTimeout(async () => { await warning.delete().catch(() => {}); }, 5000);
      }
      return;
    }

    if (config.blockAllLinks && linkRegex.test(content)) {
      const matchedLink = content.match(linkRegex)[0];
      const domain = new URL(matchedLink).hostname;

      if (config.allowedDomains.some(d => domain.includes(d))) return;

      await message.delete().catch(() => {});
      const warning = await message.channel.send({
        content: `${message.author}, links are not allowed in this server.`,
      }).catch(() => {});
      if (warning) {
        setTimeout(async () => { await warning.delete().catch(() => {}); }, 5000);
      }
    }
  },
};
