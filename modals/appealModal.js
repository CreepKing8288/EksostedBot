const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  create: () => {
    const modal = new ModalBuilder()
      .setCustomId('appeal_modal')
      .setTitle('Confession Ban Appeal');

    const explanation = new TextInputBuilder()
      .setCustomId('explanation')
      .setLabel('Why should you be unbanned?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(explanation));
    return modal;
  },

  execute: async (interaction, client) => {
    const reason = interaction.fields.getTextInputValue('explanation');
    const config = await client.db.collection('settings').findOne({ _id: 'config' });
    const logChannel = await client.channels.fetch(config.log_channel_id);

    await logChannel.send({
      content: `🚨 **NEW APPEAL**\n**User:** ${interaction.user} (${interaction.user.id})\n**Reason:** ${reason}`
    });

    await interaction.reply({ content: "Appeal sent.", ephemeral: true });
  }
};