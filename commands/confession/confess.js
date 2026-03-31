const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confess')
    .setDescription('Open the modal to submit an anonymous confession'),

  async execute(interaction, client) {
    // Check if user is banned
    const isBanned = await client.db.collection('bans').findOne({ user_id: interaction.user.id });
    if (isBanned) return interaction.reply({ content: "You are banned from the confession system.", ephemeral: true });

    const ConfessionModal = require('../../modals/confessionModal'); // Path to your modal helper
    await interaction.showModal(ConfessionModal.create());
  },
};