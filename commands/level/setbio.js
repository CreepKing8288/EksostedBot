const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MemberData } = require('../../models/Level');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbio')
    .setDescription('Set your profile bio')
    .addStringOption((option) =>
      option
        .setName('bio')
        .setDescription('Your new about me text')
        .setRequired(true)
    ),

  async execute(interaction) {
    const bio = interaction.options.getString('bio');
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    let memberData = await MemberData.findOne({ guildId, userId });
    if (!memberData) {
      memberData = new MemberData({
        guildId,
        userId,
        level: 1,
        xp: 0,
        totalXp: 0,
        voiceXp: 0,
        voiceSeconds: 0,
        aboutMe: bio,
        achievements: [],
      });
    } else {
      memberData.aboutMe = bio;
    }

    await memberData.save();

    const embed = new EmbedBuilder()
      .setTitle('Bio Updated')
      .setDescription('Your profile bio has been updated successfully.')
      .setColor('Green');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
