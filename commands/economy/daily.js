const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

const DAILY_REWARD = 500;
const STREAK_BONUS = 100;
const MAX_STREAK = 30;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily EksosCoin reward.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    let userData = await EksosCoin.findOne({ userId });

    if (!userData) {
      userData = await EksosCoin.create({ userId });
    }

    const now = new Date();
    const lastDaily = userData.lastDaily;

    if (lastDaily) {
      const lastDailyDate = new Date(lastDaily);
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const lastStartOfDay = new Date(lastDailyDate);
      lastStartOfDay.setHours(0, 0, 0, 0);

      if (startOfDay.getTime() === lastStartOfDay.getTime()) {
        const tomorrow = new Date(startOfDay);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const msUntilReset = tomorrow.getTime() - now.getTime();
        const hours = Math.floor(msUntilReset / (1000 * 60 * 60));
        const minutes = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Daily Already Claimed!')
              .setDescription(`You already claimed your daily reward today.\nCome back in **${hours}h ${minutes}m**!`),
          ],
          ephemeral: true,
        });
      }

      const timeDiff = now.getTime() - lastDailyDate.getTime();
      const daysSince = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

      if (daysSince <= 1) {
        userData.dailyStreak = Math.min(userData.dailyStreak + 1, MAX_STREAK);
      } else {
        userData.dailyStreak = 1;
      }
    } else {
      userData.dailyStreak = 1;
    }

    const streakBonus = (userData.dailyStreak - 1) * STREAK_BONUS;
    const totalReward = DAILY_REWARD + streakBonus;

    userData.balance += totalReward;
    userData.totalEarned += totalReward;
    userData.lastDaily = now;

    await userData.save();

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Daily Reward Claimed!')
      .setDescription(`You received **${totalReward.toLocaleString()} eksoscoin**!`)
      .addFields(
        { name: 'Base Reward', value: `${DAILY_REWARD} eksoscoin`, inline: true },
        { name: 'Streak Bonus', value: `+${streakBonus} eksoscoin`, inline: true },
        { name: 'Daily Streak', value: `${userData.dailyStreak}/${MAX_STREAK} days`, inline: true },
        { name: 'New Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
