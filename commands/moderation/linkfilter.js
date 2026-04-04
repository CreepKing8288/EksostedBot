const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const LinkFilter = require('../../models/LinkFilter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkfilter')
    .setDescription('Configure link and invite filtering')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable the link filter')
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Turn link filter on or off')
            .setRequired(true)
            .addChoices(
              { name: 'on', value: 'on' },
              { name: 'off', value: 'off' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('invites')
        .setDescription('Toggle Discord invite link blocking')
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Block or allow invite links')
            .setRequired(true)
            .addChoices(
              { name: 'block', value: 'block' },
              { name: 'allow', value: 'allow' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('alllinks')
        .setDescription('Toggle blocking of all links')
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Block or allow all links')
            .setRequired(true)
            .addChoices(
              { name: 'block', value: 'block' },
              { name: 'allow', value: 'allow' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('allowdomain')
        .setDescription('Add or remove an allowed domain')
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
        .addStringOption((option) =>
          option
            .setName('domain')
            .setDescription('Domain name (e.g. youtube.com)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('whitelistchannel')
        .setDescription('Add or remove a channel from link filter')
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
        .setDescription('View link filter configuration')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'toggle': {
        const state = interaction.options.getString('state');
        const enabled = state === 'on';

        await LinkFilter.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { enabled } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Link Filter Updated')
          .setDescription(`Link filter has been **${enabled ? 'enabled' : 'disabled'}**.`)
          .setColor(enabled ? 'Green' : 'Red');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'invites': {
        const state = interaction.options.getString('state');
        const block = state === 'block';

        await LinkFilter.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { blockInvites: block } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Invite Filter Updated')
          .setDescription(`Discord invite links are now **${block ? 'blocked' : 'allowed'}**.`)
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'alllinks': {
        const state = interaction.options.getString('state');
        const block = state === 'block';

        await LinkFilter.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { blockAllLinks: block } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Link Block Updated')
          .setDescription(`All links are now **${block ? 'blocked' : 'allowed'}**.`)
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'allowdomain': {
        const action = interaction.options.getString('action');
        const domain = interaction.options.getString('domain').toLowerCase();

        const config = await LinkFilter.findOneAndUpdate(
          { guildId: interaction.guild.id },
          {},
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (action === 'add') {
          if (!config.allowedDomains.includes(domain)) {
            config.allowedDomains.push(domain);
            await config.save();
          }

          const embed = new EmbedBuilder()
            .setTitle('Domain Allowed')
            .setDescription(`**${domain}** is now allowed even when link blocking is on.`)
            .setColor('Green');

          return interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
          config.allowedDomains = config.allowedDomains.filter(d => d !== domain);
          await config.save();

          const embed = new EmbedBuilder()
            .setTitle('Domain Removed')
            .setDescription(`**${domain}** is no longer in the allowed domains list.`)
            .setColor('Green');

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      case 'whitelistchannel': {
        const action = interaction.options.getString('action');
        const channel = interaction.options.getChannel('channel');

        const config = await LinkFilter.findOneAndUpdate(
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
            .setDescription(`Link filter is now disabled in <#${channel.id}>.`)
            .setColor('Green');

          return interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
          config.whitelistedChannels = config.whitelistedChannels.filter(id => id !== channel.id);
          await config.save();

          const embed = new EmbedBuilder()
            .setTitle('Channel Unwhitelisted')
            .setDescription(`Link filter is now active in <#${channel.id}>.`)
            .setColor('Green');

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      case 'status': {
        const config = await LinkFilter.findOne({ guildId: interaction.guild.id });

        if (!config) {
          return interaction.reply({
            content: 'Link filter is not configured. Use `/linkfilter toggle on` to start.',
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('Link Filter Configuration')
          .setColor('Blue')
          .addFields(
            {
              name: 'Status',
              value: config.enabled ? '**Enabled**' : '**Disabled**',
              inline: true,
            },
            {
              name: 'Block Invites',
              value: config.blockInvites ? '**Yes**' : '**No**',
              inline: true,
            },
            {
              name: 'Block All Links',
              value: config.blockAllLinks ? '**Yes**' : '**No**',
              inline: true,
            },
            {
              name: 'Allowed Domains',
              value: config.allowedDomains.length > 0
                ? config.allowedDomains.map(d => `\`${d}\``).join(', ')
                : 'None',
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
