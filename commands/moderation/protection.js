const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ProtectionSettings = require('../../models/ProtectionSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('protection')
    .setDescription('Manage server protection systems (anti-bot, anti-nuke, anti-raid).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Toggle a specific protection system.')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('The protection system to toggle.')
            .setRequired(true)
            .addChoices(
              { name: 'Anti-Bot', value: 'antiBot' },
              { name: 'Anti-Nuke', value: 'antiNuke' },
              { name: 'Anti-Raid', value: 'antiRaid' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Enable or disable the protection.')
            .setRequired(true)
            .addChoices(
              { name: 'Enable', value: 'on' },
              { name: 'Disable', value: 'off' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('View the current status of all protection systems.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('threshold')
        .setDescription('Set the threshold for a protection system.')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('The protection system to configure.')
            .setRequired(true)
            .addChoices(
              { name: 'Anti-Bot', value: 'antiBot' },
              { name: 'Anti-Nuke', value: 'antiNuke' },
              { name: 'Anti-Raid', value: 'antiRaid' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('value')
            .setDescription('The threshold value (number of actions before triggering).')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('punishment')
        .setDescription('Set the punishment for triggered protections.')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('The punishment to apply.')
            .setRequired(true)
            .addChoices(
              { name: 'Ban', value: 'ban' },
              { name: 'Kick', value: 'kick' },
              { name: 'Timeout (7 days)', value: 'timeout' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('whitelist')
        .setDescription('Manage whitelisted users (immune to protection).')
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('Add or remove a user from the whitelist.')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' },
              { name: 'View', value: 'view' }
            )
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to add/remove from whitelist.')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    let settings = await ProtectionSettings.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = new ProtectionSettings({ guildId: interaction.guild.id });
      await settings.save();
    }

    switch (subcommand) {
      case 'toggle': {
        const type = interaction.options.getString('type');
        const state = interaction.options.getString('state');
        const isEnabled = state === 'on';

        settings[type] = isEnabled;
        await settings.save();

        const names = { antiBot: 'Anti-Bot', antiNuke: 'Anti-Nuke', antiRaid: 'Anti-Raid' };
        const emojis = { antiBot: '🤖', antiNuke: '🛡️', antiRaid: '⚔️' };

        const embed = new EmbedBuilder()
          .setColor(isEnabled ? 0x00ff00 : 0xff0000)
          .setTitle(`${emojis[type]} ${names[type]} Protection`)
          .setDescription(
            `${names[type]} protection has been **${isEnabled ? 'enabled' : 'disabled'}**.`
          )
          .setFooter({ text: `Toggled by ${interaction.user.tag}` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      case 'status': {
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('🛡️ Protection System Status')
          .setDescription(`Current protection settings for **${interaction.guild.name}**.`)
          .addFields(
            {
              name: '🤖 Anti-Bot',
              value: settings.antiBot ? '✅ Enabled' : '❌ Disabled',
              inline: true,
            },
            {
              name: '🛡️ Anti-Nuke',
              value: settings.antiNuke ? '✅ Enabled' : '❌ Disabled',
              inline: true,
            },
            {
              name: '⚔️ Anti-Raid',
              value: settings.antiRaid ? '✅ Enabled' : '❌ Disabled',
              inline: true,
            },
            {
              name: 'Thresholds',
              value:
                `**Anti-Bot:** ${settings.antiBotThreshold} joins/min\n` +
                `**Anti-Nuke:** ${settings.antiNukeThreshold} actions/30s\n` +
                `**Anti-Raid:** ${settings.antiRaidThreshold} joins/${settings.antiRaidTimeWindow / 1000}s`,
              inline: false,
            },
            {
              name: 'Punishment',
              value: `**${settings.punishment.charAt(0).toUpperCase() + settings.punishment.slice(1)}**`,
              inline: true,
            },
            {
              name: 'Whitelisted Users',
              value:
                settings.whitelistedUsers.length > 0
                  ? settings.whitelistedUsers.map((id) => `<@${id}>`).join(', ')
                  : 'None',
              inline: true,
            }
          )
          .setFooter({ text: `Requested by ${interaction.user.tag}` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      case 'threshold': {
        const type = interaction.options.getString('type');
        const value = interaction.options.getInteger('value');

        const thresholdKeys = {
          antiBot: 'antiBotThreshold',
          antiNuke: 'antiNukeThreshold',
          antiRaid: 'antiRaidThreshold',
        };

        settings[thresholdKeys[type]] = value;
        await settings.save();

        const names = { antiBot: 'Anti-Bot', antiNuke: 'Anti-Nuke', antiRaid: 'Anti-Raid' };
        const emojis = { antiBot: '🤖', antiNuke: '🛡️', antiRaid: '⚔️' };

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(`${emojis[type]} Threshold Updated`)
          .setDescription(
            `${names[type]} threshold has been set to **${value}**.`
          )
          .setFooter({ text: `Updated by ${interaction.user.tag}` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      case 'punishment': {
        const type = interaction.options.getString('type');
        settings.punishment = type;
        await settings.save();

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('⚖️ Punishment Updated')
          .setDescription(
            `Protection punishment has been set to **${type.charAt(0).toUpperCase() + type.slice(1)}**.`
          )
          .setFooter({ text: `Updated by ${interaction.user.tag}` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      case 'whitelist': {
        const action = interaction.options.getString('action');

        if (action === 'view') {
          const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('📋 Whitelisted Users')
            .setDescription(
              settings.whitelistedUsers.length > 0
                ? settings.whitelistedUsers.map((id) => `<@${id}>`).join('\n')
                : 'No whitelisted users.'
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }

        const user = interaction.options.getUser('user');
        if (!user) {
          return interaction.reply({
            content: 'Please specify a user to add/remove from the whitelist.',
            ephemeral: true,
          });
        }

        if (action === 'add') {
          if (!settings.whitelistedUsers.includes(user.id)) {
            settings.whitelistedUsers.push(user.id);
            await settings.save();
          }

          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ User Whitelisted')
            .setDescription(
              `**${user.tag}** has been added to the protection whitelist.\n` +
              `They will be immune to all protection systems.`
            )
            .setFooter({ text: `Added by ${interaction.user.tag}` })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }

        if (action === 'remove') {
          const index = settings.whitelistedUsers.indexOf(user.id);
          if (index !== -1) {
            settings.whitelistedUsers.splice(index, 1);
            await settings.save();
          }

          const embed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('❌ User Removed from Whitelist')
            .setDescription(
              `**${user.tag}** has been removed from the protection whitelist.`
            )
            .setFooter({ text: `Removed by ${interaction.user.tag}` })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }
      }
    }
  },
};
