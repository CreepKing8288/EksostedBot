const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MemberData, GuildSettings } = require('../../models/Level');

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcleaderboard')
    .setDescription('View the server voice leaderboard based on VC XP.'),

  async execute(interaction) {
    await interaction.deferReply();

    const guildData = await GuildSettings.findOne({ guildId: interaction.guild.id });
    if (!guildData || !guildData.levelingEnabled) {
      return interaction.editReply({
        content: '❌ Leveling system is not enabled in this server.',
      });
    }

    const leaderboard = await MemberData.find({ guildId: interaction.guild.id, voiceXp: { $gt: 0 } })
      .sort({ voiceXp: -1, voiceSeconds: -1 })
      .lean();

    if (!leaderboard.length) {
      return interaction.editReply({
        content: 'No voice activity XP has been recorded yet.',
      });
    }

    const topMembers = leaderboard.slice(0, 10);
    const rows = await Promise.all(
      topMembers.map(async (member, index) => {
        let userLabel = `Unknown User (${member.userId})`;
        try {
          const user = await interaction.client.users.fetch(member.userId);
          if (user) userLabel = `${user.username}#${user.discriminator}`;
        } catch {
          // ignore missing users
        }

        return `**#${index + 1}** • ${userLabel}\n` +
          `• VC XP: **${member.voiceXp}** • Time: **${formatDuration(member.voiceSeconds || 0)}**`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle('Voice Activity Leaderboard')
      .setDescription(rows.join('\n\n'))
      .setColor('Blue')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
