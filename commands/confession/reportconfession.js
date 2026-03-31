const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reportconfession')
    .setDescription('Report a specific confession to staff')
    .addIntegerOption(opt => opt.setName('number').setDescription('The confession number (#)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for reporting').setRequired(true))
    .addStringOption(opt => opt.setName('note').setDescription('Additional details').setRequired(true)),

  async execute(interaction, client) {
    const config = await client.db.collection('settings').findOne({ _id: 'config' });
    if (!config?.log_channel_id) return interaction.reply({ content: "Log system not set up.", ephemeral: true });

    const reportEmbed = new EmbedBuilder()
      .setTitle('New Report')
      .setColor(0xFF0000)
      .addFields(
        { name: 'Confession', value: `#${interaction.options.getInteger('number')}`, inline: true },
        { name: 'Reported By', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: interaction.options.getString('reason') },
        { name: 'Note', value: interaction.options.getString('note') }
      )
      .setTimestamp();

    const logChannel = await client.channels.fetch(config.log_channel_id);
    await logChannel.send({ embeds: [reportEmbed] });

    await interaction.reply({ content: "Report sent to staff. Thank you.", ephemeral: true });
  },
};