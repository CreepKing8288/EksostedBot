const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CrateConfig = require('../../models/CrateConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcrateconfig')
    .setDescription('Configure automatic crate drops and claim expiration')
    .addStringOption((option) =>
      option
        .setName('autostate')
        .setDescription('Turn automatic crate drops on or off')
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('min_interval')
        .setDescription('Minimum auto drop interval in minutes')
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName('max_interval')
        .setDescription('Maximum auto drop interval in minutes')
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName('small_claims')
        .setDescription('How many users can claim a small crate')
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName('medium_claims')
        .setDescription('How many users can claim a medium crate')
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName('large_claims')
        .setDescription('How many users can claim a large crate')
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName('expiration')
        .setDescription('How long users have to claim a crate, in minutes')
        .setMinValue(1)
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You need Administrator permission to use this command.',
        ephemeral: true,
      });
    }

    const autoState = interaction.options.getString('autostate');
    const minInterval = interaction.options.getInteger('min_interval');
    const maxInterval = interaction.options.getInteger('max_interval');
    const smallClaims = interaction.options.getInteger('small_claims');
    const mediumClaims = interaction.options.getInteger('medium_claims');
    const largeClaims = interaction.options.getInteger('large_claims');
    const expiration = interaction.options.getInteger('expiration');

    if (
      autoState === null &&
      minInterval === null &&
      maxInterval === null &&
      smallClaims === null &&
      mediumClaims === null &&
      largeClaims === null &&
      expiration === null
    ) {
      return interaction.reply({
        content: 'Please provide at least one setting to update.',
        ephemeral: true,
      });
    }

    const currentConfig = await CrateConfig.findOne({ guildId: interaction.guild.id });
    const newMin = minInterval ?? currentConfig?.autoMinIntervalMinutes ?? 60;
    const newMax = maxInterval ?? currentConfig?.autoMaxIntervalMinutes ?? 120;

    if (newMin > newMax) {
      return interaction.reply({
        content: 'Minimum interval cannot be greater than maximum interval.',
        ephemeral: true,
      });
    }

    const updateData = {};
    if (autoState !== null) updateData.autoDropEnabled = autoState === 'on';
    if (minInterval !== null) updateData.autoMinIntervalMinutes = minInterval;
    if (maxInterval !== null) updateData.autoMaxIntervalMinutes = maxInterval;
    if (smallClaims !== null) updateData['claimLimits.small'] = smallClaims;
    if (mediumClaims !== null) updateData['claimLimits.medium'] = mediumClaims;
    if (largeClaims !== null) updateData['claimLimits.large'] = largeClaims;
    if (expiration !== null) updateData.claimExpiryMinutes = expiration;

    const config = await CrateConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const embed = new EmbedBuilder()
      .setTitle('Crate Auto-Drop Configuration Updated')
      .setColor('Green')
      .setDescription('Your crate auto-drop settings have been updated.');

    const fields = [];
    if (autoState !== null) {
      fields.push({
        name: 'Automatic Drops',
        value: `**${config.autoDropEnabled ? 'Enabled' : 'Disabled'}**`,
      });
    }
    if (minInterval !== null || maxInterval !== null) {
      fields.push({
        name: 'Auto Drop Interval',
        value: `Every **${config.autoMinIntervalMinutes}**–**${config.autoMaxIntervalMinutes}** minutes`,
      });
    }
    if (expiration !== null) {
      fields.push({
        name: 'Claim Expiration',
        value: `Users have **${config.claimExpiryMinutes}** minutes to claim a crate`,
      });
    }
    if (smallClaims !== null || mediumClaims !== null || largeClaims !== null) {
      const limits = config.claimLimits || { small: 3, medium: 2, large: 1 };
      fields.push({
        name: 'Claim Limits',
        value: `Small: **${limits.small}** users\nMedium: **${limits.medium}** users\nLarge: **${limits.large}** users`,
      });
    }

    if (fields.length > 0) {
      embed.addFields(fields);
    }

    if (interaction.client.scheduleCrateDropsForGuild) {
      if (config.autoDropEnabled) {
        interaction.client.scheduleCrateDropsForGuild(interaction.guild.id);
      } else if (interaction.client.cancelCrateDropSchedule) {
        interaction.client.cancelCrateDropSchedule(interaction.guild.id);
      }
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
