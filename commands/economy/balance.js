const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');
const ServerShop = require('../../models/ServerShop');

const DEFAULT_FEE = 5;

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
    )
    .addSubcommand((sub) =>
      sub
        .setName('transfer')
        .setDescription('Send EksosCoin to another user (5% fee applies).')
        .addUserOption((o) => o.setName('user').setDescription('The user to send coins to.').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Amount to send from your wallet.').setRequired(true).setMinValue(1)
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
      const now = Date.now();
      const protectedUntil = userData.walletProtectedUntil && userData.walletProtectedUntil.getTime() > now;
      const protectionText = protectedUntil
        ? `\n🛡️ Wallet Shield active until <t:${Math.floor(userData.walletProtectedUntil.getTime() / 1000)}:R>`
        : '';

      const embed = new EmbedBuilder()
        .setColor(0xf5a623)
        .setTitle(`${target.username}'s EksosCoin Wallet`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '💰 Wallet', value: `${userData.balance.toLocaleString()} eksoscoin${protectionText}`, inline: true },
          { name: '🏦 Bank', value: `${userData.bank.toLocaleString()} / ${userData.bankLimit.toLocaleString()} eksoscoin`, inline: true },
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

      if (userData.bank + depositAmount > userData.bankLimit) {
        const canDeposit = Math.max(0, userData.bankLimit - userData.bank);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Bank Limit Reached')
              .setDescription(
                `Your bank can only hold **${userData.bankLimit.toLocaleString()} eksoscoin**.\nYou can deposit up to **${canDeposit.toLocaleString()}** more. Buy a Bank Note from the shop to increase your limit!`
              ),
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
          { name: 'Bank', value: `${userData.bank.toLocaleString()} / ${userData.bankLimit.toLocaleString()} eksoscoin`, inline: true }
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
          { name: 'Bank', value: `${userData.bank.toLocaleString()} / ${userData.bankLimit.toLocaleString()} eksoscoin`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (subcommand === 'transfer') {
      const recipient = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      let transferFeePercent = DEFAULT_FEE;
      if (interaction.guild) {
        const shopData = await ServerShop.findOne({ guildId: interaction.guild.id });
        if (shopData && shopData.transferFeePercent !== undefined) {
          transferFeePercent = shopData.transferFeePercent;
        }
      }

      if (recipient.id === userId) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Invalid Transfer')
              .setDescription('You cannot transfer coins to yourself!'),
          ],
          ephemeral: true,
        });
      }

      if (recipient.bot) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Invalid Transfer')
              .setDescription('You cannot transfer coins to a bot!'),
          ],
          ephemeral: true,
        });
      }

      if (amount > userData.balance) {
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

      const fee = Math.ceil(amount * (transferFeePercent / 100));
      const received = amount - fee;

      const confirmEmbed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('Confirm Transfer')
        .setDescription(`Are you sure you want to send coins to ${recipient}?`)
        .addFields(
          { name: '📤 Sending', value: `**${amount.toLocaleString()} eksoscoin**`, inline: true },
          { name: `🏦 Fee (${transferFeePercent}%)`, value: `**-${fee.toLocaleString()} eksoscoin**`, inline: true },
          { name: '📥 Recipient Receives', value: `**${received.toLocaleString()} eksoscoin**`, inline: true },
          { name: 'Your Wallet After', value: `**${(userData.balance - amount).toLocaleString()} eksoscoin**`, inline: false }
        )
        .setFooter({ text: 'Click Confirm to proceed or Cancel to abort. Expires in 30 seconds.' })
        .setTimestamp();

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('transfer_confirm')
          .setLabel('Confirm')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('transfer_cancel')
          .setLabel('Cancel')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      );

      const response = await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow] });

      const collector = response.createMessageComponentCollector({
        filter: (i) => i.user.id === userId,
        time: 30000,
        max: 1,
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'transfer_confirm') {
          const senderData = await EksosCoin.findOne({ userId });
          if (!senderData || senderData.balance < amount) {
            return i.update({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xed4245)
                  .setTitle('Transfer Failed')
                  .setDescription('Your balance changed. Insufficient funds for this transfer.'),
              ],
              components: [],
            });
          }

          let recipientData = await EksosCoin.findOne({ userId: recipient.id });
          if (!recipientData) {
            recipientData = await EksosCoin.create({ userId: recipient.id });
          }

          senderData.balance -= amount;
          senderData.totalSpent += amount;
          recipientData.balance += received;
          recipientData.totalEarned += received;

          await senderData.save();
          await recipientData.save();

          const successEmbed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('Transfer Complete!')
            .setDescription(`${interaction.user.tag} sent **${received.toLocaleString()} eksoscoin** to ${recipient.tag}!`)
            .addFields(
              { name: 'Fee Deducted', value: `${fee.toLocaleString()} eksoscoin (${transferFeePercent}%)`, inline: true },
              { name: 'Your New Balance', value: `${senderData.balance.toLocaleString()} eksoscoin`, inline: true }
            )
            .setTimestamp();

          await i.update({ embeds: [successEmbed], components: [] });
        } else if (i.customId === 'transfer_cancel') {
          const cancelEmbed = new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Transfer Cancelled')
            .setDescription('The transfer has been cancelled.');

          await i.update({ embeds: [cancelEmbed], components: [] });
        }
      });

      collector.on('end', async (collected) => {
        if (collected.size === 0) {
          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Transfer Expired')
            .setDescription('The transfer confirmation timed out.');

          await interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
        }
      });
    }
  },
};
