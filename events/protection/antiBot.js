const { EmbedBuilder } = require('discord.js');
const ProtectionSettings = require('../../models/ProtectionSettings');

const joinTracker = new Map();

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    const settings = await ProtectionSettings.findOne({ guildId: member.guild.id });
    if (!settings || !settings.antiBot) return;

    const now = Date.now();
    const timeWindow = 60000;

    if (!joinTracker.has(member.guild.id)) {
      joinTracker.set(member.guild.id, []);
    }

    const joins = joinTracker.get(member.guild.id);
    joins.push(now);

    const recentJoins = joins.filter((t) => now - t < timeWindow);
    joinTracker.set(member.guild.id, recentJoins);

    if (recentJoins.length >= settings.antiBotThreshold) {
      const logChannel = member.guild.channels.cache.find(
        (ch) =>
          ch.name === 'protection-logs' ||
          ch.name === 'mod-logs' ||
          ch.name === 'server-logs'
      );

      try {
        await member.ban({
          reason: 'Anti-Bot Protection: Suspected bot account (rapid joins)',
        });

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🤖 Anti-Bot Protection Triggered')
          .setDescription(
            `**${member.user.tag}** (${member.id}) was automatically banned.\n` +
            `**Reason:** Suspected bot account — joined during a rapid join spike (${recentJoins.length} joins in 60s).\n` +
            `**Threshold:** ${settings.antiBotThreshold} joins/minute`
          )
          .setFooter({ text: 'Anti-Bot Protection' })
          .setTimestamp();

        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error(`[Anti-Bot] Failed to ban ${member.user.tag}:`, err.message);
      }
    }

    if (member.user.bot && member.user.createdTimestamp > now - 86400000 * 7) {
      try {
        await member.ban({
          reason: 'Anti-Bot Protection: Newly created bot account',
        });

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🤖 Anti-Bot Protection Triggered')
          .setDescription(
            `**${member.user.tag}** (${member.id}) was automatically banned.\n` +
            `**Reason:** Newly created bot account (less than 7 days old).`
          )
          .setFooter({ text: 'Anti-Bot Protection' })
          .setTimestamp();

        const logChannel = member.guild.channels.cache.find(
          (ch) =>
            ch.name === 'protection-logs' ||
            ch.name === 'mod-logs' ||
            ch.name === 'server-logs'
        );

        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error(`[Anti-Bot] Failed to ban bot ${member.user.tag}:`, err.message);
      }
    }
  },
};
