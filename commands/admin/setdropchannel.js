const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const CrateConfig = require('../../models/CrateConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setdropchannel')
    .setDescription('Set the crate drop channel for this server')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel where crate drops should appear')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You need Administrator permission to use this command.',
        ephemeral: true,
      });
    }

    const channel = interaction.options.getChannel('channel');
    const config = await CrateConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { $set: { dropChannelId: channel.id } },
      { upsert: true, new: true }
    );

    const embed = new EmbedBuilder()
      .setTitle('Crate Drop Channel Set')
      .setDescription(`Crate drops will now be posted in ${channel}.`)
      .setColor('Green');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
