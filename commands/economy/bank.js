const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');
const ServerShop = require('../../models/ServerShop');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Borrow or repay EksosCoin loans from the bank.')
    .addSubcommand((sub) =>
      sub
        .setName('borrow')
        .setDescription('Borrow EksosCoin from the bank.')
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Amount to borrow.').setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('repay')
        .setDescription('Repay your loan.')
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Amount to repay (0 = repay all).').setRequired(true).setMinValue(0)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('View your loan status and server bank info.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    let userData = await EksosCoin.findOne({ userId });
    if (!userData) {
      userData = await EksosCoin.create({ userId });
    }

    if (sub === 'borrow') {
      if (!interaction.guild) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Server Only')
              .setDescription('You can only borrow in a server.'),
          ],
          ephemeral: true,
        });
      }

      const amount = interaction.options.getInteger('amount');

      let shopData = await ServerShop.findOne({ guildId: interaction.guild.id });
      if (!shopData) {
        shopData = await ServerShop.create({ guildId: interaction.guild.id });
      }

      if (shopData.bankMaxLoan <= 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Bank Disabled')
              .setDescription('This server has disabled bank loans.'),
          ],
          ephemeral: true,
        });
      }

      if (userData.loan > 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Existing Loan')
              .setDescription(
                `You already owe **${userData.loan.toLocaleString()} eksoscoin**. Repay it first with \`/bank repay\`.`
              ),
          ],
          ephemeral: true,
        });
      }

      const rate = shopData.bankInterestRate;
      const interest = Math.floor(amount * (rate / 100));
      const totalOwed = amount + interest;

      if (totalOwed > shopData.bankMaxLoan) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Exceeds Max Loan')
              .setDescription(
                `With **${rate}%** interest, you would owe **${totalOwed.toLocaleString()} eksoscoin** but this server's max loan is **${shopData.bankMaxLoan.toLocaleString()} eksoscoin**.`
              ),
          ],
          ephemeral: true,
        });
      }

      userData.balance += amount;
      userData.totalEarned += amount;
      userData.loan = totalOwed;
      userData.loanGuildId = interaction.guild.id;
      await userData.save();

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Loan Approved!')
        .setDescription(`You borrowed **${amount.toLocaleString()} eksoscoin** from the bank.`)
        .addFields(
          { name: 'Borrowed', value: `${amount.toLocaleString()} eksoscoin`, inline: true },
          { name: 'Interest', value: `${interest.toLocaleString()} eksoscoin (${rate}%)`, inline: true },
          { name: 'Total Owed', value: `**${totalOwed.toLocaleString()} eksoscoin**`, inline: true },
          { name: 'Wallet', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
        )
        .setFooter({ text: 'Repay anytime with /bank repay' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'repay') {
      if (userData.loan <= 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xfee75c)
              .setTitle('No Active Loan')
              .setDescription('You don\'t have any outstanding loan to repay.'),
          ],
          ephemeral: true,
        });
      }

      const amount = interaction.options.getInteger('amount');
      const repayment = amount === 0 ? Math.min(userData.loan, userData.balance) : Math.min(amount, userData.loan, userData.balance);

      if (repayment <= 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Insufficient Funds')
              .setDescription(
                `You owe **${userData.loan.toLocaleString()} eksoscoin** but only have **${userData.balance.toLocaleString()}** in your wallet.`
              ),
          ],
          ephemeral: true,
        });
      }

      userData.balance -= repayment;
      userData.totalSpent += repayment;
      userData.loan -= repayment;

      let loanGuildName = 'Unknown';
      if (userData.loanGuildId) {
        try {
          const guild = await interaction.client.guilds.fetch(userData.loanGuildId);
          loanGuildName = guild.name;
        } catch {}
      }

      let description;
      let embedColor;

      if (userData.loan <= 0) {
        userData.loan = 0;
        userData.loanGuildId = null;
        embedColor = 0x57f287;
        description = `You repaid **${repayment.toLocaleString()} eksoscoin** and cleared your debt!`;
      } else {
        embedColor = 0xf5a623;
        description = `You repaid **${repayment.toLocaleString()} eksoscoin**.`;
      }

      await userData.save();

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Loan Repayment')
        .setDescription(description)
        .addFields(
          { name: 'Repaid', value: `${repayment.toLocaleString()} eksoscoin`, inline: true },
          { name: 'Remaining Debt', value: `${userData.loan.toLocaleString()} eksoscoin`, inline: true },
          { name: 'Wallet', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'info') {
      let shopData = null;
      if (interaction.guild) {
        shopData = await ServerShop.findOne({ guildId: interaction.guild.id });
      }

      const fields = [];

      if (userData.loan > 0) {
        let loanGuildName = 'Unknown';
        if (userData.loanGuildId) {
          try {
            const guild = await interaction.client.guilds.fetch(userData.loanGuildId);
            loanGuildName = guild.name;
          } catch {}
        }

        fields.push(
          { name: '🏦 Outstanding Loan', value: `**${userData.loan.toLocaleString()} eksoscoin**`, inline: true },
          { name: '📍 Loan From', value: loanGuildName, inline: true }
        );
      } else {
        fields.push(
          { name: '🏦 Outstanding Loan', value: 'None', inline: true }
        );
      }

      fields.push(
        { name: '💰 Wallet', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true },
        { name: '🏦 Bank', value: `${userData.bank.toLocaleString()} eksoscoin`, inline: true },
        { name: '💎 Total', value: `${(userData.balance + userData.bank).toLocaleString()} eksoscoin`, inline: true }
      );

      if (shopData) {
        fields.push(
          { name: '── Server Bank Info ──', value: '\u200b', inline: false },
          { name: '📊 Interest Rate', value: `${shopData.bankInterestRate}%`, inline: true },
          { name: '📈 Max Loan', value: `${shopData.bankMaxLoan.toLocaleString()} eksoscoin`, inline: true }
        );

        if (shopData.bankMaxLoan > 0 && shopData.bankInterestRate >= 0) {
          const maxBorrowBeforeInterest = Math.floor(shopData.bankMaxLoan / (1 + shopData.bankInterestRate / 100));
          fields.push(
            { name: '💵 Max Borrowable', value: `**${maxBorrowBeforeInterest.toLocaleString()} eksoscoin** (before interest)`, inline: false }
          );
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xf5a623)
        .setTitle(`${interaction.user.username}'s Bank Info`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(fields)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },
};
