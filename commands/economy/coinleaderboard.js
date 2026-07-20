const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinleaderboard')
    .setDescription('View the richest EksosCoin users across all servers.'),

  async execute(interaction) {
    await interaction.deferReply();

    const topUsers = await EksosCoin.find({})
      .sort({ balance: -1 })
      .limit(15)
      .lean();

    if (topUsers.length === 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle('No Data')
            .setDescription('No one has earned EksosCoin yet!'),
        ],
      });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const fields = [];

    for (let i = 0; i < topUsers.length; i++) {
      const entry = topUsers[i];
      const total = entry.balance + entry.bank;
      let username = `User ${entry.userId}`;
      try {
        const user = await interaction.client.users.fetch(entry.userId);
        if (user) username = user.tag;
      } catch {}

      const rank = i < 3 ? medals[i] : `#${i + 1}`;
      fields.push({
        name: `${rank} ${username}`,
        value: `💰 ${total.toLocaleString()} eksoscoin (Wallet: ${entry.balance.toLocaleString()} | Bank: ${entry.bank.toLocaleString()})`,
        inline: false,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('EksosCoin Richest Users')
      .setDescription('Global leaderboard across all servers.')
      .addFields(fields)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
