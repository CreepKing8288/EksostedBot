const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const isValidUrl = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

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
    if (!config?.confession_channel_id || !config?.log_channel_id) {
      return interaction.followUp({
        content: 'The confession system is not configured yet. Please ask an administrator to set the confession and log channels.',
        ephemeral: true,
      });
    }

    if (attachment && !isValidUrl(attachment)) {
      return interaction.followUp({
        content: 'The attachment URL is invalid. Please provide a valid http or https link, or leave it blank.',
        ephemeral: true,
      });
    }

    const counterDoc = await client.db.collection('settings').findOneAndUpdate(
      { _id: 'counter' },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    let num = counterDoc.value?.count;
    if (num == null) {
      const fallbackCounter = await client.db.collection('settings').findOne({ _id: 'counter' });
      num = fallbackCounter?.count ?? 1;
    }

    // 2. Send to Public Channel
    const confChannel = await client.channels.fetch(config.confession_channel_id).catch(() => null);
    if (!confChannel) {
      return interaction.followUp({
        content: 'The confession channel could not be found. Please ask an administrator to reconfigure it.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Anonymous Confession (#${num})`)
      .setDescription(`"${content}"`)
      .setColor('Random');
    
    if (attachment) embed.setImage(attachment);

    const replyButton = new ButtonBuilder()
      .setCustomId(`reply_confession_${num}`)
      .setLabel('Reply')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(replyButton);
    await confChannel.send({ embeds: [embed], components: [row] });

    // 3. Send to Log Channel
    const logChannel = await client.channels.fetch(config.log_channel_id).catch(() => null);
    if (!logChannel) {
      return interaction.followUp({
        content: 'The confession log channel could not be found. Please ask an administrator to reconfigure it.',
        ephemeral: true,
      });
    }
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