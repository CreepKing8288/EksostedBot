const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CrateConfig = require('../../models/CrateConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('togglecrate')
    .setDescription('Enable or disable crate drops for this server')
    .addStringOption((option) =>
      option
        .setName('state')
        .setDescription('Turn the crate drop system on or off')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You need Administrator permission to use this command.',
        ephemeral: true,
      });
    }

    const state = interaction.options.getString('state');
    const enabled = state === 'on';

    await CrateConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { $set: { enabled } },
      { upsert: true, new: true }
    );

    const embed = new EmbedBuilder()
      .setTitle('Crate Drops Updated')
      .setDescription(`Crate drops are now **${enabled ? 'enabled' : 'disabled'}**.`)
      .setColor(enabled ? 'Green' : 'Red');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
