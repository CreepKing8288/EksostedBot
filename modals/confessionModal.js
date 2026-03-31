const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  // The "create" helper used by the /confess command
  create: () => {
    const modal = new ModalBuilder()
      .setCustomId('confession_modal')
      .setTitle('Submit a Confession');

    const content = new TextInputBuilder()
      .setCustomId('content')
      .setLabel('Confession Content')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const attachment = new TextInputBuilder()
      .setCustomId('attachment')
      .setLabel('Attachment URL (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(content),
      new ActionRowBuilder().addComponents(attachment)
    );

    return modal;
  },

  // The "execute" helper to process the data after they click Submit
  execute: async (interaction, client) => {
    await interaction.deferReply({ ephemeral: true });

    const content = interaction.fields.getTextInputValue('content');
    const attachment = interaction.fields.getTextInputValue('attachment');

    // 1. Get Config & Counter
    const config = await client.db.collection('settings').findOne({ _id: 'config' });
    const counterDoc = await client.db.collection('settings').findOneAndUpdate(
      { _id: 'counter' },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const num = counterDoc.count || 1780;

    // 2. Send to Public Channel
    const confChannel = await client.channels.fetch(config.confession_channel_id);
    const embed = new EmbedBuilder()
      .setTitle(`Anonymous Confession (#${num})`)
      .setDescription(`"${content}"`)
      .setColor('Random');
    
    if (attachment) embed.setImage(attachment);
    await confChannel.send({ embeds: [embed] });

    // 3. Send to Log Channel
    const logChannel = await client.channels.fetch(config.log_channel_id);
    const logEmbed = new EmbedBuilder()
      .setTitle('Confession Log')
      .addFields(
        { name: 'Number', value: `#${num}`, inline: true },
        { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
        { name: 'Message', value: content }
      )
      .setColor('Blue')
      .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
    await interaction.followUp({ content: ":white_check_mark: Confession added!", ephemeral: true });
  }
};