const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Appeal your confession system ban'),

  async execute(interaction, client) {
    const appealModal = require('../../modals/appealModal');
    await interaction.showModal(appealModal.create());
  },
};