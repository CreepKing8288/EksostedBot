const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your or another user\'s EksosCoin balance.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to check. Defaults to yourself.')
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;

    let userData = await EksosCoin.findOne({ userId: target.id });
    if (!userData) {
      userData = await EksosCoin.create({ userId: target.id, balance: 0, bank: 0 });
    }

    const total = userData.balance + userData.bank;

    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle(`${target.username}'s EksosCoin Wallet`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '💰 Wallet', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true },
        { name: '🏦 Bank', value: `${userData.bank.toLocaleString()} eksoscoin`, inline: true },
        { name: '💎 Total', value: `${total.toLocaleString()} eksoscoin`, inline: true }
      )
      .setFooter({ text: 'EksosCoin is a global currency across all servers.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
