const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const AFK = require('../../models/AFK');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set or remove your AFK status')
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for being AFK')
        .setRequired(false)
    ),

  async execute(interaction) {
    const reason = interaction.options.getString('reason') || 'AFK';

    const existing = await AFK.findOne({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
    });

    if (existing) {
      await AFK.deleteOne({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
      });

      const duration = Math.floor((Date.now() - new Date(existing.timestamp).getTime()) / 1000);
      const minutes = Math.floor(duration / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      let timeStr;
      if (days > 0) timeStr = `${days}d ${hours % 24}h`;
      else if (hours > 0) timeStr = `${hours}h ${minutes % 60}m`;
      else timeStr = `${minutes}m`;

      const embed = new EmbedBuilder()
        .setTitle('AFK Removed')
        .setDescription(`Welcome back, ${interaction.user}! You were AFK for **${timeStr}**.`)
        .addFields({ name: 'Previous Reason', value: existing.reason })
        .setColor('Green');

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await AFK.findOneAndUpdate(
      { guildId: interaction.guild.id, userId: interaction.user.id },
      { $set: { reason, timestamp: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const embed = new EmbedBuilder()
      .setTitle('AFK Set')
      .setDescription(`${interaction.user} is now AFK.`)
      .addFields({ name: 'Reason', value: reason })
      .setColor('Blue');

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
