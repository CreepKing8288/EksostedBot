const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const SwearFilter = require('../../models/SwearFilter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('swearfilter')
    .setDescription('Manage the swear filter for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable the swear filter')
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Turn the swear filter on or off')
            .setRequired(true)
            .addChoices(
              { name: 'on', value: 'on' },
              { name: 'off', value: 'off' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('mode')
        .setDescription('Set the detection mode')
        .addStringOption((option) =>
          option
            .setName('detection')
            .setDescription('Choose word-list or AI-powered detection')
            .setRequired(true)
            .addChoices(
              { name: 'word-list', value: 'wordlist' },
              { name: 'ai', value: 'ai' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('addword')
        .setDescription('Add a custom word to the swear filter')
        .addStringOption((option) =>
          option
            .setName('word')
            .setDescription('The word to block')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('removeword')
        .setDescription('Remove a custom word from the swear filter')
        .addStringOption((option) =>
          option
            .setName('word')
            .setDescription('The word to remove')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('Show all custom blocked words')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'toggle': {
        const state = interaction.options.getString('state');
        const enabled = state === 'on';

        await SwearFilter.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { enabled } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Swear Filter Updated')
          .setDescription(`Swear filter has been **${enabled ? 'enabled' : 'disabled'}**.`)
          .setColor(enabled ? 'Green' : 'Red');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'mode': {
        const detection = interaction.options.getString('detection');
        const aiMode = detection === 'ai';

        await SwearFilter.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { aiMode } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Detection Mode Updated')
          .setDescription(`Detection mode set to **${aiMode ? 'AI-powered' : 'word-list'}**.`)
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'addword': {
        const word = interaction.options.getString('word').toLowerCase();

        const config = await SwearFilter.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $set: { enabled: true }, $addToSet: { customWords: word } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Word Added')
          .setDescription(`Added **${word}** to the blocked words list.`)
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'removeword': {
        const word = interaction.options.getString('word').toLowerCase();

        const config = await SwearFilter.findOne({ guildId: interaction.guild.id });

        if (!config || !config.customWords.includes(word)) {
          const embed = new EmbedBuilder()
            .setTitle('Word Not Found')
            .setDescription(`**${word}** is not in the custom blocked words list.`)
            .setColor('Red');

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await SwearFilter.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { $pull: { customWords: word } }
        );

        const embed = new EmbedBuilder()
          .setTitle('Word Removed')
          .setDescription(`Removed **${word}** from the blocked words list.`)
          .setColor('Green');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'list': {
        const config = await SwearFilter.findOne({ guildId: interaction.guild.id });

        const customWords = config?.customWords || [];

        const embed = new EmbedBuilder()
          .setTitle('Swear Filter Settings')
          .setColor('Blue')
          .addFields(
            {
              name: 'Status',
              value: config?.enabled ? '**Enabled**' : '**Disabled**',
              inline: true,
            },
            {
              name: 'Detection Mode',
              value: config?.aiMode ? '**AI-powered**' : '**Word-list**',
              inline: true,
            },
            {
              name: 'Custom Blocked Words',
              value: customWords.length > 0
                ? customWords.map(w => `\`${w}\``).join(', ')
                : 'No custom words added.',
            }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
