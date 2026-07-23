const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ServerShop = require('../../models/ServerShop');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bank-admin')
    .setDescription('Configure the bank loan system for this server.')
    .setDefaultMemberPermissions(0x20)
    .addSubcommand((sub) =>
      sub
        .setName('rate')
        .setDescription('Set the loan interest rate for this server.')
        .addIntegerOption((o) =>
          o.setName('percent').setDescription('Daily interest rate (0-100).').setRequired(true).setMinValue(0).setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('View this server\'s bank configuration.')
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Server Only')
            .setDescription('This command can only be used in a server.'),
        ],
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let shopData = await ServerShop.findOne({ guildId });
    if (!shopData) {
      shopData = await ServerShop.create({ guildId });
    }

    if (sub === 'rate') {
      const percent = interaction.options.getInteger('percent');
      shopData.bankInterestRate = percent;
      await shopData.save();

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Interest Rate Updated')
        .setDescription(`Bank loan interest rate set to **${percent}%** per day for this server.`)
        .addFields(
          { name: 'New Rate', value: `${percent}%/day`, inline: true },
          { name: 'Example', value: `Borrow 10,000 → owe ${10000 + Math.floor(10000 * percent / 100)}/day`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'info') {
      const rate = shopData.bankInterestRate;
      const exampleDaily = Math.floor(10000 * (rate / 100));

      const embed = new EmbedBuilder()
        .setColor(0xf5a623)
        .setTitle(`${interaction.guild.name} Bank Config`)
        .addFields(
          { name: '📊 Daily Interest Rate', value: `${rate}%`, inline: true },
          { name: '💡 Example', value: `Borrow 10,000 → **${exampleDaily.toLocaleString()}/day** interest`, inline: false },
          { name: '📝 Notes', value: '• Interest is fixed on the original borrowed amount\n• Interest accumulates daily until repaid\n• No max loan limit', inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },
};
