const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Deposit EksosCoin from your wallet into your bank.')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount to deposit (use "all" via 0).')
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

    const depositAmount = amount === 0 ? userData.balance : amount;

    if (depositAmount > userData.balance) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Insufficient Funds')
            .setDescription(`You only have **${userData.balance.toLocaleString()} eksoscoin** in your wallet.`),
        ],
        ephemeral: true,
      });
    }

    if (depositAmount <= 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Invalid Amount')
            .setDescription('You must deposit at least 1 eksoscoin.'),
        ],
        ephemeral: true,
      });
    }

    userData.balance -= depositAmount;
    userData.bank += depositAmount;
    await userData.save();

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Deposit Successful!')
      .setDescription(`Deposited **${depositAmount.toLocaleString()} eksoscoin** into your bank.`)
      .addFields(
        { name: 'Wallet', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true },
        { name: 'Bank', value: `${userData.bank.toLocaleString()} eksoscoin`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
