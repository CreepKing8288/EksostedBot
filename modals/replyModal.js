const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  // The "create" helper used by the /reply command or buttons
  create: (targetNum = null) => {
    const modal = new ModalBuilder()
      .setCustomId('reply_modal')
      .setTitle('Submit a Reply');

    const replyContent = new TextInputBuilder()
      .setCustomId('reply_content')
      .setLabel('Reply')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const confessionId = new TextInputBuilder()
      .setCustomId('confession_id')
      .setLabel('Confession To Reply To')
      .setPlaceholder('ID #')
      .setValue(targetNum ? String(targetNum) : "")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const attachment = new TextInputBuilder()
      .setCustomId('attachment')
      .setLabel('Attachment URL (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(replyContent),
      new ActionRowBuilder().addComponents(confessionId),
      new ActionRowBuilder().addComponents(attachment)
    );

    return modal;
  },

  // The "execute" helper to process the reply
  execute: async (interaction, client) => {
    await interaction.deferReply({ ephemeral: true });

    const replyContent = interaction.fields.getTextInputValue('reply_content');
    const targetNum = interaction.fields.getTextInputValue('confession_id');
    const attachment = interaction.fields.getTextInputValue('attachment');

    // 1. Fetch Config
    const config = await client.db.collection('settings').findOne({ _id: 'config' });
    const confChannel = await client.channels.fetch(config.confession_channel_id);

    // 2. Find the target confession message to start/find a thread
    const messages = await confChannel.messages.fetch({ limit: 100 });
    const targetMsg = messages.find(m => m.embeds[0]?.title?.includes(`#${targetNum}`));

    if (!targetMsg) {
      return interaction.followUp({ content: `❌ Could not find confession #${targetNum}`, ephemeral: true });
    }

    // 3. Handle Thread Logic
    let thread = targetMsg.thread;
    if (!thread) {
      thread = await targetMsg.startThread({
        name: `Confession Replies (#${targetNum})`,
        autoArchiveDuration: 60,
      });
    }

    // 4. Get Next Reply ID from counter
    const counterDoc = await client.db.collection('settings').findOneAndUpdate(
      { _id: 'counter' },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const replyId = counterDoc.count;

    // 5. Send Reply to Thread
    const replyEmbed = new EmbedBuilder()
      .setTitle(`Anonymous Reply (#${replyId})`)
      .setDescription(`"${replyContent}"`)
      .setColor('Random');

    if (attachment) replyEmbed.setImage(attachment);

    await thread.send({ embeds: [replyEmbed] });

    // 6. Log the Reply
    const logChannel = await client.channels.fetch(config.log_channel_id);
    const logEmbed = new EmbedBuilder()
      .setTitle('Reply Log')
      .setColor('Green')
      .addFields(
        { name: 'To Confession', value: `#${targetNum}`, inline: true },
        { name: 'Reply ID', value: `#${replyId}`, inline: true },
        { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})` },
        { name: 'Message', value: replyContent }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });

    await interaction.followUp({ content: "Reply sent!", ephemeral: true });
  }
};