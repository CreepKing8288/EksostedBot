const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const AntiSpam = require('../../models/AntiSpam');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Configure anti-spam protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable anti-spam')
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Turn anti-spam on or off')
            .setRequired(true)
            .addChoices(
              { name: 'on', value: 'on' },
              { name: 'off', value: 'off' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('threshold')
        .setDescription('Set how many messages before triggering spam')
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('Max messages in time window')
            .setMinValue(2)
            .setMaxValue(20)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('window')
            .setDescription('Time window in seconds')
            .setMinValue(2)
            .setMaxValue(30)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('punishment')
        .setDescription('Set punishment for spam')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Punishment type')
            .setRequired(true)
            .addChoices(
              { name: 'delete', value: 'delete' },
              { name: 'warn', value: 'warn' },
              { name: 'timeout', value: 'timeout' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('duration')
            .setDescription('Timeout duration in seconds (only for timeout)')
            .setMinValue(10)
            .setMaxValue(86400)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('settings')
        .setDescription('Toggle duplicate message and caps detection')
        .addStringOption((option) =>
          option
            .setName('feature')
            .setDescription('Feature to toggle')
            .setRequired(true)
            .addChoices(
              { name: 'duplicate-check', value: 'duplicate' },
              { name: 'caps-check', value: 'caps' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Turn feature on or off')
            .setRequired(true)
            .addChoices(
              { name: 'on', value: 'on' },
              { name: 'off', value: 'off' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('whitelistchannel')
        .setDescription('Add or remove a channel from anti-spam')
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
            .setDescription('Channel to whitelist/unwhitelist')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('View anti-spam configuration')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'toggle': {
        const state = interaction.options.getString('state');
        const enabled = state === 'on';

        await AntiSpam.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { enabled } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Anti-Spam Updated')
          .setDescription(`Anti-spam has been **${enabled ? 'enabled' : 'disabled'}**.`)
          .setColor(enabled ? 'Green' : 'Red');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'threshold': {
        const count = interaction.options.getInteger('count');
        const window = interaction.options.getInteger('window');

        await AntiSpam.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { maxMessages: count, timeWindowMs: window * 1000 } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Threshold Updated')
          .setDescription(`Max **${count}** messages per **${window}** seconds.`)
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'punishment': {
        const type = interaction.options.getString('type');
        const duration = interaction.options.getInteger('duration') || 60;

        await AntiSpam.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { punishment: type, timeoutDuration: duration } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Punishment Updated')
          .setDescription(`Punishment set to **${type}**${type === 'timeout' ? ` for **${duration}s**` : ''}.`)
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'settings': {
        const feature = interaction.options.getString('feature');
        const state = interaction.options.getString('state');
        const enabled = state === 'on';

        const field = feature === 'duplicate' ? 'duplicateCheck' : 'capsCheck';

        await AntiSpam.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { [field]: enabled } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Setting Updated')
          .setDescription(`${feature === 'duplicate' ? 'Duplicate message' : 'Excessive caps'} check **${enabled ? 'enabled' : 'disabled'}**.`)
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'whitelistchannel': {
        const action = interaction.options.getString('action');
        const channel = interaction.options.getChannel('channel');

        const config = await AntiSpam.findOneAndUpdate(
          { guildId: interaction.guild.id },
          {},
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (action === 'add') {
          if (!config.whitelistedChannels.includes(channel.id)) {
            config.whitelistedChannels.push(channel.id);
            await config.save();
          }

          const embed = new EmbedBuilder()
            .setTitle('Channel Whitelisted')
            .setDescription(`Anti-spam is now disabled in <#${channel.id}>.`)
            .setColor('Green');

          return interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
          config.whitelistedChannels = config.whitelistedChannels.filter(id => id !== channel.id);
          await config.save();

          const embed = new EmbedBuilder()
            .setTitle('Channel Unwhitelisted')
            .setDescription(`Anti-spam is now active in <#${channel.id}>.`)
            .setColor('Green');

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      case 'status': {
        const config = await AntiSpam.findOne({ guildId: interaction.guild.id });

        if (!config) {
          return interaction.reply({
            content: 'Anti-spam is not configured. Use `/antispam toggle on` to start.',
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('Anti-Spam Configuration')
          .setColor('Blue')
          .addFields(
            {
              name: 'Status',
              value: config.enabled ? '**Enabled**' : '**Disabled**',
              inline: true,
            },
            {
              name: 'Threshold',
              value: `${config.maxMessages} messages / ${config.timeWindowMs / 1000}s`,
              inline: true,
            },
            {
              name: 'Punishment',
              value: `**${config.punishment}**${config.punishment === 'timeout' ? ` (${config.timeoutDuration}s)` : ''}`,
              inline: true,
            },
            {
              name: 'Duplicate Check',
              value: config.duplicateCheck ? '**On**' : '**Off**',
              inline: true,
            },
            {
              name: 'Caps Check',
              value: config.capsCheck ? '**On**' : '**Off**',
              inline: true,
            },
            {
              name: 'Whitelisted Channels',
              value: config.whitelistedChannels.length > 0
                ? config.whitelistedChannels.map(id => `<#${id}>`).join(', ')
                : 'None',
            }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
