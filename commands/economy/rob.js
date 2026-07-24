const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

const ROB_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob another user\'s wallet.')
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('The user to rob.')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const target = interaction.options.getUser('target');

    if (target.id === userId) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Invalid Target')
            .setDescription('You cannot rob yourself!'),
        ],
        ephemeral: true,
      });
    }

    if (target.bot) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Invalid Target')
            .setDescription('You cannot rob a bot!'),
        ],
        ephemeral: true,
      });
    }

    let robberData = await EksosCoin.findOne({ userId });
    if (!robberData) robberData = await EksosCoin.create({ userId });

    let victimData = await EksosCoin.findOne({ userId: target.id });
    if (!victimData) victimData = await EksosCoin.create({ userId: target.id });

    // Cooldown check
    const now = new Date();
    if (robberData.robCooldownUntil && robberData.robCooldownUntil.getTime() > now.getTime()) {
      const remaining = Math.ceil((robberData.robCooldownUntil.getTime() - now.getTime()) / 60000);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Cooldown')
            .setDescription(`You must wait **${remaining} minute(s)** before robbing again.`),
        ],
        ephemeral: true,
      });
    }

    // Victim wallet protection
    if (victimData.walletProtectedUntil && victimData.walletProtectedUntil.getTime() > now.getTime()) {
      const hoursLeft = Math.ceil((victimData.walletProtectedUntil.getTime() - now.getTime()) / 3600000);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Wallet Protected')
            .setDescription(`This user has a **Wallet Shield** active for **${hoursLeft} more hour(s)**. You cannot rob them!`),
        ],
        ephemeral: true,
      });
    }

    // Victim has nothing in wallet
    if (victimData.balance <= 0) {
      robberData.robCooldownUntil = new Date(now.getTime() + ROB_COOLDOWN_MS);
      await robberData.save();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Nothing to Steal')
            .setDescription(`${target.username} has nothing in their wallet!`),
        ],
        ephemeral: true,
      });
    }

    // Rob: steal 10-30% of victim's wallet
    const stealPercent = 0.10 + Math.random() * 0.20;
    const stolenAmount = Math.max(1, Math.floor(victimData.balance * stealPercent));
    const caught = Math.random() < 0.35; // 35% chance of getting caught

    robberData.robCooldownUntil = new Date(now.getTime() + ROB_COOLDOWN_MS);

    if (caught) {
      // Caught: robber pays fine equal to stolen amount (or all their wallet if less)
      const fine = Math.min(robberData.balance, stolenAmount);
      robberData.balance -= fine;
      robberData.totalSpent += fine;

      await robberData.save();

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('You Got Caught!')
        .setDescription(`You tried to rob **${target.username}** but got caught by the guards!`)
        .addFields(
          { name: 'Fine Paid', value: `**${fine.toLocaleString()} eksoscoin**`, inline: true },
          { name: 'Your Wallet', value: `**${robberData.balance.toLocaleString()} eksoscoin**`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Success
    victimData.balance -= stolenAmount;
    victimData.totalSpent += stolenAmount;
    victimData.lastRobbed = now;

    robberData.balance += stolenAmount;
    robberData.totalEarned += stolenAmount;

    await victimData.save();
    await robberData.save();

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Robbery Successful!')
      .setDescription(`You successfully robbed **${target.username}**!`)
      .addFields(
        { name: 'Stolen', value: `**${stolenAmount.toLocaleString()} eksoscoin**`, inline: true },
        { name: 'Your Wallet', value: `**${robberData.balance.toLocaleString()} eksoscoin**`, inline: true }
      )
      .setFooter({ text: 'Victim wallet protection available in /shop' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
