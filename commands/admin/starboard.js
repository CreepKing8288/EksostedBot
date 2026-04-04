const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const Starboard = require('../../models/Starboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configure the starboard system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Set up the starboard')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel for starboard posts')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('threshold')
            .setDescription('Number of stars needed to post')
            .setMinValue(1)
            .setMaxValue(50)
        )
        .addStringOption((option) =>
          option
            .setName('emoji')
            .setDescription('Star emoji (default: ⭐)')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable the starboard')
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Turn starboard on or off')
            .setRequired(true)
            .addChoices(
              { name: 'on', value: 'on' },
              { name: 'off', value: 'off' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ignorechannel')
        .setDescription('Add or remove a channel from starboard ignore list')
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('Add or remove')
            .setRequired(true)
            .addChoices(
              { name: 'add', value: 'add' },
              { name: 'remove', value: 'remove' }
            )
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to ignore/unignore')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('View starboard configuration')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'setup': {
        const channel = interaction.options.getChannel('channel');
        const threshold = interaction.options.getInteger('threshold') || 3;
        const emoji = interaction.options.getString('emoji') || '⭐';

        await Starboard.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { enabled: true, channelId: channel.id, threshold, emoji } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Starboard Setup')
          .setDescription('Starboard has been configured.')
          .addFields(
            { name: 'Channel', value: `<#${channel.id}>`, inline: true },
            { name: 'Threshold', value: `${emoji} ${threshold}`, inline: true },
            { name: 'Emoji', value: emoji, inline: true }
          )
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'toggle': {
        const state = interaction.options.getString('state');
        const enabled = state === 'on';

        await Starboard.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { enabled } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Starboard Updated')
          .setDescription(`Starboard has been **${enabled ? 'enabled' : 'disabled'}**.`)
          .setColor(enabled ? 'Green' : 'Red');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'ignorechannel': {
        const action = interaction.options.getString('action');
        const channel = interaction.options.getChannel('channel');

        const config = await Starboard.findOneAndUpdate(
          { guildId: interaction.guild.id },
          {},
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (action === 'add') {
          if (!config.ignoredChannels.includes(channel.id)) {
            config.ignoredChannels.push(channel.id);
            await config.save();
          }

          const embed = new EmbedBuilder()
            .setTitle('Channel Ignored')
            .setDescription(`Messages from <#${channel.id}> will not appear on the starboard.`)
            .setColor('Green');

          return interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
          config.ignoredChannels = config.ignoredChannels.filter(id => id !== channel.id);
          await config.save();

          const embed = new EmbedBuilder()
            .setTitle('Channel Unignored')
            .setDescription(`Messages from <#${channel.id}> can now appear on the starboard.`)
            .setColor('Green');

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      case 'status': {
        const config = await Starboard.findOne({ guildId: interaction.guild.id });

        if (!config || !config.channelId) {
          return interaction.reply({
            content: 'Starboard is not set up. Use `/starboard setup` to configure it.',
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('Starboard Configuration')
          .setColor('Blue')
          .addFields(
            {
              name: 'Status',
              value: config.enabled ? '**Enabled**' : '**Disabled**',
              inline: true,
            },
            {
              name: 'Channel',
              value: `<#${config.channelId}>`,
              inline: true,
            },
            {
              name: 'Emoji',
              value: config.emoji,
              inline: true,
            },
            {
              name: 'Threshold',
              value: `${config.emoji} ${config.threshold}`,
              inline: true,
            },
            {
              name: 'Ignored Channels',
              value: config.ignoredChannels.length > 0
                ? config.ignoredChannels.map(id => `<#${id}>`).join(', ')
                : 'None',
            }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
