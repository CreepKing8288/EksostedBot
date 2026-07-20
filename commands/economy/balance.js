const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your EksosCoin balance or manage your bank.')
    .addSubcommand((sub) =>
      sub
        .setName('wallet')
        .setDescription('Check your or another user\'s balance.')
        .addUserOption((o) => o.setName('user').setDescription('The user to check.'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('deposit')
        .setDescription('Deposit coins from your wallet into your bank.')
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Amount to deposit (0 = all).').setRequired(true).setMinValue(0)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('withdraw')
        .setDescription('Withdraw coins from your bank into your wallet.')
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Amount to withdraw (0 = all).').setRequired(true).setMinValue(0)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    let userData = await EksosCoin.findOne({ userId });
    if (!userData) {
      userData = await EksosCoin.create({ userId, balance: 0, bank: 0 });
    }

    if (subcommand === 'wallet') {
      const target = interaction.options.getUser('user') || interaction.user;
      if (target.id !== userId) {
        userData = await EksosCoin.findOne({ userId: target.id });
        if (!userData) {
          userData = await EksosCoin.create({ userId: target.id, balance: 0, bank: 0 });
        }
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
    } else if (subcommand === 'deposit') {
      const amount = interaction.options.getInteger('amount');
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
    } else if (subcommand === 'withdraw') {
      const amount = interaction.options.getInteger('amount');
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
    }
  },
};
