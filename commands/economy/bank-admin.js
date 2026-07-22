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
          o.setName('percent').setDescription('Interest rate (0-100).').setRequired(true).setMinValue(0).setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-loan')
        .setDescription('Set the maximum total loan amount for this server.')
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Max loan amount (0 = disable loans).').setRequired(true).setMinValue(0)
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
        .setDescription(`Bank loan interest rate set to **${percent}%** for this server.`)
        .addFields(
          { name: 'New Rate', value: `${percent}%`, inline: true },
          { name: 'Max Loan', value: `${shopData.bankMaxLoan.toLocaleString()} eksoscoin`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'max-loan') {
      const amount = interaction.options.getInteger('amount');
      shopData.bankMaxLoan = amount;
      await shopData.save();

      const status = amount > 0 ? 'enabled' : 'disabled';
      const embed = new EmbedBuilder()
        .setColor(amount > 0 ? 0x57f287 : 0xed4245)
        .setTitle('Max Loan Updated')
        .setDescription(`Bank loans have been **${status}** for this server.`)
        .addFields(
          { name: 'Max Loan', value: amount > 0 ? `${amount.toLocaleString()} eksoscoin` : 'Disabled', inline: true },
          { name: 'Interest Rate', value: `${shopData.bankInterestRate}%`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'info') {
      const maxBorrowable = shopData.bankMaxLoan > 0
        ? Math.floor(shopData.bankMaxLoan / (1 + shopData.bankInterestRate / 100))
        : 0;

      const embed = new EmbedBuilder()
        .setColor(0xf5a623)
        .setTitle(`${interaction.guild.name} Bank Config`)
        .addFields(
          { name: '📊 Interest Rate', value: `${shopData.bankInterestRate}%`, inline: true },
          { name: '📈 Max Loan (total owed)', value: shopData.bankMaxLoan > 0 ? `${shopData.bankMaxLoan.toLocaleString()} eksoscoin` : 'Disabled', inline: true },
          { name: '💵 Max Borrowable (before interest)', value: shopData.bankMaxLoan > 0 ? `${maxBorrowable.toLocaleString()} eksoscoin` : 'N/A', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },
};
