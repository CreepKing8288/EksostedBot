const { Events, MessageFlags } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        console.error(
          `No command matching ${interaction.commandName} was found.`
        );
        return;
      }

      try {
        await command.execute(interaction, interaction.client);
      } catch (error) {
        console.error(error);

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: 'There was an error while executing this command!',
            flags: [MessageFlags.Ephemeral],
          });
        } else {
          await interaction.reply({
            content: 'There was an error while executing this command!',
            flags: [MessageFlags.Ephemeral],
          });
        }
      }
    }

    if (interaction.isButton()) {
      try {
        if (interaction.customId.startsWith('reply_confession_')) {
          const targetNum = interaction.customId.replace('reply_confession_', '');
          const isBanned = await interaction.client.db.collection('bans').findOne({ user_id: interaction.user.id });
          if (isBanned) {
            return interaction.reply({ content: 'You are currently banned from using the confession system.', ephemeral: true });
          }

          const replyModal = require('../../modals/replyModal');
          await interaction.showModal(replyModal.create(targetNum));
          return;
        }
      } catch (error) {
        console.error('Button interaction error:', error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error processing your button.', flags: [MessageFlags.Ephemeral] });
        } else {
          await interaction.reply({ content: 'There was an error processing your button.', flags: [MessageFlags.Ephemeral] });
        }
      }
    }

    if (interaction.isModalSubmit()) {
      try {
        if (interaction.customId === 'confession_modal') {
          const confessionModal = require('../../modals/confessionModal');
          await confessionModal.execute(interaction, interaction.client);
          return;
        }

        if (interaction.customId === 'reply_modal') {
          const replyModal = require('../../modals/replyModal');
          await replyModal.execute(interaction, interaction.client);
          return;
        }

        if (interaction.customId === 'appeal_modal') {
          const appealModal = require('../../modals/appealModal');
          await appealModal.execute(interaction, interaction.client);
          return;
        }
      } catch (error) {
        console.error('Modal submit error:', error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: 'There was an error processing your modal.',
            flags: [MessageFlags.Ephemeral],
          });
        } else {
          await interaction.reply({
            content: 'There was an error processing your modal.',
            flags: [MessageFlags.Ephemeral],
          });
        }
      }
    }

    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (command && command.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error('Autocomplete error:', error);
          await interaction.respond([]);
        }
      }
    }
  },
};
