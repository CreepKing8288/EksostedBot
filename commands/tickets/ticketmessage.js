const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const TicketSettings = require('../../models/TicketSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketmessage')
    .setDescription('Configure ticket welcome and close messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('welcome')
        .setDescription('Set the welcome message sent when a ticket opens')
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription(
              'The welcome message. Use {user} to mention the ticket creator'
            )
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('close')
        .setDescription('Set the message sent when a ticket is closed')
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('The close message shown before the ticket is deleted')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription('Reset a message back to its default')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Which message to reset')
            .setRequired(true)
            .addChoices(
              { name: 'welcome', value: 'welcome' },
              { name: 'close', value: 'close' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View current ticket messages')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'welcome': {
        const message = interaction.options.getString('message');

        await TicketSettings.findOneAndUpdate(
          { guildId: interaction.guildId },
          { $set: { welcomeMessage: message } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const preview = message.replace('{user}', interaction.user.toString());

        const embed = new EmbedBuilder()
          .setTitle('Welcome Message Updated')
          .setDescription('The welcome message has been updated.')
          .addFields({ name: 'Preview', value: preview })
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'close': {
        const message = interaction.options.getString('message');

        await TicketSettings.findOneAndUpdate(
          { guildId: interaction.guildId },
          { $set: { closeMessage: message } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Close Message Updated')
          .setDescription(`The close message has been set to:\n**${message}**`)
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'reset': {
        const type = interaction.options.getString('type');

        const defaults = {
          welcome: 'Welcome to your ticket, {user}! Support will be with you shortly.',
          close: 'This ticket will be closed in 5 seconds.',
        };

        const field = type === 'welcome' ? 'welcomeMessage' : 'closeMessage';

        await TicketSettings.findOneAndUpdate(
          { guildId: interaction.guildId },
          { $set: { [field]: defaults[type] } }
        );

        const embed = new EmbedBuilder()
          .setTitle('Message Reset')
          .setDescription(`The ${type} message has been reset to default.`)
          .setColor('Blue');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'view': {
        const settings = await TicketSettings.findOne({ guildId: interaction.guildId });

        if (!settings) {
          return interaction.reply({
            content: 'Ticket system is not configured yet.',
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('Ticket Messages')
          .setColor('Blue')
          .addFields(
            {
              name: 'Welcome Message',
              value: settings.welcomeMessage || '*Not set (using default)*',
            },
            {
              name: 'Close Message',
              value: settings.closeMessage || '*Not set (using default)*',
            }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
