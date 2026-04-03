const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const AIChatConfig = require('../../models/AIChatConfig');
const { startQuietCheck } = require('../../handlers/aiChatHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aichat')
    .setDescription('Configure AI chat for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Enable AI chat in a channel')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Channel to enable AI chat in').setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('quiet_timeout')
            .setDescription('Minutes of inactivity before bot starts a topic (default: 30)')
            .setMinValue(5)
            .setMaxValue(240)
        )
        .addStringOption((option) =>
          option
            .setName('personality')
            .setDescription('Bot personality (default: friendly and engaging)')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('disable')
        .setDescription('Disable AI chat in a channel')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Channel to disable AI chat in').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Show AI chat configuration for this server')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable the AI chat system entirely')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Whether AI chat should be enabled').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('personality')
        .setDescription('Change the bot personality')
        .addStringOption((option) =>
          option.setName('value').setDescription('Describe the personality you want (e.g. sarcastic, wholesome, chaotic)').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('timeout')
        .setDescription('Change the quiet timeout duration')
        .addIntegerOption((option) =>
          option.setName('minutes').setDescription('Minutes of inactivity before bot starts a topic').setRequired(true).setMinValue(5).setMaxValue(240)
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const quietTimeout = interaction.options.getInteger('quiet_timeout') || 30;
      const personality = interaction.options.getString('personality') || 'friendly and engaging';

      if (!channel.isTextBased()) {
        return await interaction.reply({ content: 'Please select a text-based channel.', ephemeral: true });
      }

      let config = await AIChatConfig.findOne({ guildId: interaction.guildId });

      if (!config) {
        config = new AIChatConfig({
          guildId: interaction.guildId,
          enabled: true,
          channels: [channel.id],
          quietTimeoutMinutes: quietTimeout,
          personality,
        });
      } else {
        if (!config.channels.includes(channel.id)) {
          config.channels.push(channel.id);
        }
        config.enabled = true;
        config.quietTimeoutMinutes = quietTimeout;
        if (personality) config.personality = personality;
      }

      await config.save();

      const { startQuietCheck } = require('../../handlers/aiChatHandler');
      startQuietCheck(interaction.client, config);

      const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('AI Chat Enabled')
        .setDescription(
          `AI chat is now active in ${channel}.\n\n` +
          `The bot will start conversations when the channel is quiet for ${quietTimeout} minutes.\n` +
          `Members can mention the bot to chat with it anytime!`
        )
        .setTimestamp();

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'disable') {
      const channel = interaction.options.getChannel('channel');
      const config = await AIChatConfig.findOne({ guildId: interaction.guildId });

      if (!config || !config.channels.includes(channel.id)) {
        return await interaction.reply({
          content: `AI chat is not enabled in ${channel}.`,
          ephemeral: true,
        });
      }

      config.channels = config.channels.filter((ch) => ch !== channel.id);

      if (config.channels.length === 0) {
        config.enabled = false;
      }

      await config.save();

      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('AI Chat Disabled')
        .setDescription(`AI chat has been removed from ${channel}.`)
        .setTimestamp();

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'status') {
      const config = await AIChatConfig.findOne({ guildId: interaction.guildId });

      if (!config) {
        return await interaction.reply({
          content: 'AI chat is not configured in this server. Use `/aichat setup` to get started.',
          ephemeral: true,
        });
      }

      const channelList = config.channels
        .map((chId) => {
          const ch = interaction.guild.channels.cache.get(chId);
          return ch ? `${ch}` : `<#${chId}> (deleted)`;
        })
        .join('\n') || 'None';

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('AI Chat Configuration')
        .addFields(
          { name: 'Status', value: config.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Quiet Timeout', value: `${config.quietTimeoutMinutes} minutes`, inline: true },
          { name: 'Personality', value: config.personality, inline: true },
          { name: 'Channels', value: channelList }
        )
        .setTimestamp();

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled');
      let config = await AIChatConfig.findOne({ guildId: interaction.guildId });

      if (!config) {
        return await interaction.reply({
          content: 'Please setup AI chat first with `/aichat setup`.',
          ephemeral: true,
        });
      }

      config.enabled = enabled;
      await config.save();

      if (enabled) {
        startQuietCheck(interaction.client, config);
      }

      const embed = new EmbedBuilder()
        .setColor(enabled ? '#00ff7f' : '#ff4444')
        .setTitle(`AI Chat ${enabled ? 'Enabled' : 'Disabled'}`)
        .setDescription(`AI chat system has been ${enabled ? 'turned on' : 'turned off'} for this server.`)
        .setTimestamp();

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'personality') {
      const personality = interaction.options.getString('value');
      let config = await AIChatConfig.findOne({ guildId: interaction.guildId });

      if (!config) {
        return await interaction.reply({
          content: 'Please setup AI chat first with `/aichat setup`.',
          ephemeral: true,
        });
      }

      config.personality = personality;
      await config.save();

      const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('Personality Updated')
        .setDescription(`Bot personality has been updated to: **${personality}**`)
        .setTimestamp();

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'timeout') {
      const minutes = interaction.options.getInteger('minutes');
      let config = await AIChatConfig.findOne({ guildId: interaction.guildId });

      if (!config) {
        return await interaction.reply({
          content: 'Please setup AI chat first with `/aichat setup`.',
          ephemeral: true,
        });
      }

      config.quietTimeoutMinutes = minutes;
      await config.save();

      const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('Timeout Updated')
        .setDescription(`Quiet timeout has been changed to **${minutes} minutes**.`)
        .setTimestamp();

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
