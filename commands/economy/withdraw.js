const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw EksosCoin from your bank into your wallet.')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount to withdraw (use 0 for all).')
        .setRequired(true)
        .setMinValue(0)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const amount = interaction.options.getInteger('amount');

    let userData = await EksosCoin.findOne({ userId });
    if (!userData) {
      userData = await EksosCoin.create({ userId });
    }

    const withdrawAmount = amount === 0 ? userData.bank : amount;

    if (withdrawAmount > userData.bank) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Insufficient Funds')
            .setDescription(`You only have **${userData.bank.toLocaleString()} eksoscoin** in your bank.`),
        ],
        ephemeral: true,
      });
    }

    if (withdrawAmount <= 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Invalid Amount')
            .setDescription('You must withdraw at least 1 eksoscoin.'),
        ],
        ephemeral: true,
      });
    }

    userData.bank -= withdrawAmount;
    userData.balance += withdrawAmount;
    await userData.save();

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Withdrawal Successful!')
      .setDescription(`Withdrew **${withdrawAmount.toLocaleString()} eksoscoin** from your bank.`)
      .addFields(
        { name: 'Wallet', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true },
        { name: 'Bank', value: `${userData.bank.toLocaleString()} eksoscoin`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
