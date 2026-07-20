const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Send EksosCoin to another user.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to send coins to.').setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName('amount').setDescription('The amount of EksosCoin to send.').setRequired(true)
    ),

  async execute(interaction) {
    const sender = interaction.user;
    const recipient = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (recipient.id === sender.id) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Invalid Transaction')
            .setDescription('You cannot send coins to yourself!'),
        ],
        ephemeral: true,
      });
    }

    if (recipient.bot) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Invalid Transaction')
            .setDescription('You cannot send coins to a bot!'),
        ],
        ephemeral: true,
      });
    }

    if (amount <= 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Invalid Amount')
            .setDescription('The amount must be greater than 0.'),
        ],
        ephemeral: true,
      });
    }

    let senderData = await EksosCoin.findOne({ userId: sender.id });
    if (!senderData) {
      senderData = await EksosCoin.create({ userId: sender.id });
    }

    if (senderData.balance < amount) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Insufficient Funds')
            .setDescription(`You only have **${senderData.balance.toLocaleString()} eksoscoin** in your wallet.`),
        ],
        ephemeral: true,
      });
    }

    let recipientData = await EksosCoin.findOne({ userId: recipient.id });
    if (!recipientData) {
      recipientData = await EksosCoin.create({ userId: recipient.id });
    }

    senderData.balance -= amount;
    senderData.totalSpent += amount;
    recipientData.balance += amount;
    recipientData.totalEarned += amount;

    await senderData.save();
    await recipientData.save();

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Transfer Successful!')
      .setDescription(`${sender.tag} sent **${amount.toLocaleString()} eksoscoin** to ${recipient.tag}!`)
      .addFields(
        { name: 'Your New Balance', value: `${senderData.balance.toLocaleString()} eksoscoin`, inline: true },
        { name: `${recipient.username}'s Balance`, value: `${recipientData.balance.toLocaleString()} eksoscoin`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
