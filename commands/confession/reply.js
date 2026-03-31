const { SlashCommandBuilder } = require('discord.js');
const replyModal = require('../../modals/replyModal'); // Adjust the path based on your folder structure

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reply')
    .setDescription('Reply to a confession')
    .addIntegerOption(option => 
      option.setName('number').setDescription('Confession ID').setRequired(true)
    ),

  async execute(interaction, client) {
    // 1. Check if the user is banned before showing the modal
    const isBanned = await client.db.collection('bans').findOne({ user_id: interaction.user.id });
    
    if (isBanned) {
      return interaction.reply({ 
        content: "You are currently banned from using the confession system.", 
        ephemeral: true 
      });
    }

    // 2. Get the confession number from the command options
    const targetNum = interaction.options.getInteger('number');

    // 3. Trigger the modal helper and pass the target number to pre-fill the ID field
    await interaction.showModal(replyModal.create(targetNum));
  },
};