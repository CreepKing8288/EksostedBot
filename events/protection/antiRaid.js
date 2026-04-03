const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const ProtectionSettings = require('../../models/ProtectionSettings');

const raidTracker = new Map();
const raidModeActive = new Map();

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    const settings = await ProtectionSettings.findOne({ guildId: member.guild.id });
    if (!settings || !settings.antiRaid) return;

    if (member.user.bot) return;

    const now = Date.now();
    const timeWindow = settings.antiRaidTimeWindow || 10000;

    if (!raidTracker.has(member.guild.id)) {
      raidTracker.set(member.guild.id, []);
    }

    const joins = raidTracker.get(member.guild.id);
    joins.push({ id: member.id, timestamp: now, user: member.user });

    const recentJoins = joins.filter((j) => now - j.timestamp < timeWindow);
    raidTracker.set(member.guild.id, recentJoins);

    if (recentJoins.length >= settings.antiRaidThreshold && !raidModeActive.get(member.guild.id)) {
      raidModeActive.set(member.guild.id, true);

      const logChannel = member.guild.channels.cache.find(
        (ch) =>
          ch.name === 'protection-logs' ||
          ch.name === 'mod-logs' ||
          ch.name === 'server-logs'
      );

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('⚠️ Anti-Raid Protection Triggered')
        .setDescription(
          `**Raid detected!** ${recentJoins.length} users joined within ${timeWindow / 1000}s.\n` +
          `Enabling lockdown mode — banning all recent joiners.`
        )
        .addFields(
          { name: 'Joins in window', value: `${recentJoins.length}`, inline: true },
          { name: 'Threshold', value: `${settings.antiRaidThreshold}`, inline: true },
          { name: 'Time window', value: `${timeWindow / 1000}s`, inline: true }
        )
        .setFooter({ text: 'Anti-Raid Protection' })
        .setTimestamp();

      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }

      try {
        await member.guild.edit({
          verificationLevel: 'VERY_HIGH',
          reason: 'Anti-Raid Protection: Lockdown activated',
        });
      } catch (err) {
        console.error('[Anti-Raid] Failed to set verification level:', err.message);
      }

      for (const join of recentJoins) {
        try {
          const m = await member.guild.members.fetch(join.id).catch(() => null);
          if (m) {
            switch (settings.punishment) {
              case 'ban':
                await m.ban({ reason: 'Anti-Raid Protection: Mass join event detected' });
                break;
              case 'kick':
                await m.kick('Anti-Raid Protection: Mass join event detected');
                break;
              case 'timeout':
                await m.timeout(86400000 * 7, 'Anti-Raid Protection: Mass join event detected');
                break;
            }
          }
        } catch (err) {
          console.error(`[Anti-Raid] Failed to punish user ${join.id}:`, err.message);
        }
      }

      const resolvedEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Anti-Raid Protection Resolved')
        .setDescription(
          `Successfully handled the raid attempt.\n` +
          `**${recentJoins.length}** users were ${settings.punishment}ed.\n` +
          `Verification level has been set to VERY_HIGH.`
        )
        .setFooter({ text: 'Anti-Raid Protection' })
        .setTimestamp();

      if (logChannel) {
        await logChannel.send({ embeds: [resolvedEmbed] });
      }

      setTimeout(() => {
        raidModeActive.delete(member.guild.id);
        raidTracker.delete(member.guild.id);
      }, 300000);
    }
  },
};
