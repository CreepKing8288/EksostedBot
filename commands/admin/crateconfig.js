const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CrateConfig = require('../../models/CrateConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crateconfig')
    .setDescription('Show the current crate configuration and claim limits'),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You need Administrator permission to view crate configuration.',
        ephemeral: true,
      });
    }

    const config = await CrateConfig.findOne({ guildId: interaction.guild.id });
    if (!config) {
      return interaction.reply({
        content: 'No crate configuration found for this server. Set it up using `/setcrateconfig`.',
        ephemeral: true,
      });
    }

    const channelMention = config.dropChannelId
      ? `<#${config.dropChannelId}>`
      : 'Not configured';

    const limits = config.claimLimits || { small: 3, medium: 2, large: 1 };
    const points = config.points || { small: 10, medium: 25, large: 50 };

    const embed = new EmbedBuilder()
      .setTitle('Crate Configuration')
      .setColor('Blue')
      .addFields(
        { name: 'Automatic Drops', value: `${config.autoDropEnabled ? 'Enabled' : 'Disabled'}`, inline: true },
        { name: 'Drop Channel', value: channelMention, inline: true },
        {
          name: 'Auto Drop Interval',
          value: `Every **${config.autoMinIntervalMinutes ?? 60}**–**${config.autoMaxIntervalMinutes ?? 120}** minutes`,
          inline: false,
        },
        {
          name: 'Claim Expiration',
          value: `Users have **${config.claimExpiryMinutes ?? 5}** minutes to claim a crate`,
          inline: false,
        },
        {
          name: 'Claim Limits',
          value: `Small: **${limits.small}** users\nMedium: **${limits.medium}** users\nLarge: **${limits.large}** users`,
          inline: false,
        },
        {
          name: 'Crate XP Values',
          value: `Small: **${points.small}** XP\nMedium: **${points.medium}** XP\nLarge: **${points.large}** XP`,
          inline: false,
        }
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
