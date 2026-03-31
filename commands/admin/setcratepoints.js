const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CrateConfig = require('../../models/CrateConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcratepoints')
    .setDescription('Set experience points for a crate size')
    .addStringOption((option) =>
      option
        .setName('size')
        .setDescription('Choose the crate size to set points for')
        .setRequired(true)
        .addChoices(
          { name: 'Small', value: 'small' },
          { name: 'Medium', value: 'medium' },
          { name: 'Large', value: 'large' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('points')
        .setDescription('How much XP this crate size should grant')
        .setRequired(true)
        .setMinValue(1)
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You need Administrator permission to use this command.',
        ephemeral: true,
      });
    }

    const size = interaction.options.getString('size');
    const points = interaction.options.getInteger('points');
    const update = {};
    update[`points.${size}`] = points;

    const config = await CrateConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { $set: update },
      { upsert: true, new: true }
    );

    const embed = new EmbedBuilder()
      .setTitle('Crate Points Updated')
      .setDescription(`**${size.charAt(0).toUpperCase() + size.slice(1)}** crates will now grant **${points} XP**.`)
      .setColor('Green');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
