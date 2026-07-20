const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '💎', '7️⃣'];
const WEIGHTS = [25, 22, 20, 15, 10, 5, 3];

const JACKPOT_MULT = 25;
const TRIPLE_MULT = 10;
const DOUBLE_MULT = 3;

function weightedRandom() {
  const totalWeight = WEIGHTS.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < SYMBOLS.length; i++) {
    random -= WEIGHTS[i];
    if (random <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function renderReels(r1, r2, r3) {
  return `┌─────────────┐\n│  ${r1} │ ${r2} │ ${r3}  │\n└─────────────┘`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slot')
    .setDescription('Play the slot machine to win EksosCoin!')
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('The amount of EksosCoin to bet.')
        .setRequired(true)
        .setMinValue(10)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const bet = interaction.options.getInteger('bet');

    let userData = await EksosCoin.findOne({ userId });
    if (!userData) {
      userData = await EksosCoin.create({ userId });
    }

    if (userData.balance < bet) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Insufficient Funds')
            .setDescription(
              `You need **${bet.toLocaleString()} eksoscoin** but only have **${userData.balance.toLocaleString()}**.`
            ),
        ],
        ephemeral: true,
      });
    }

    const r1 = weightedRandom();
    const r2 = weightedRandom();
    const r3 = weightedRandom();

    let multiplier = 0;
    let resultText = '';

    if (r1 === r2 && r2 === r3) {
      if (r1 === '7️⃣') {
        multiplier = JACKPOT_MULT;
        resultText = 'JACKPOT! Triple 7️⃣!';
      } else if (r1 === '💎') {
        multiplier = JACKPOT_MULT;
        resultText = 'JACKPOT! Triple 💎!';
      } else {
        multiplier = TRIPLE_MULT;
        resultText = 'TRIPLE MATCH!';
      }
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      multiplier = DOUBLE_MULT;
      resultText = 'Double Match!';
    }

    const winnings = bet * multiplier;
    userData.balance -= bet;
    userData.totalSpent += bet;

    let embedColor;
    let description;

    if (multiplier > 0) {
      userData.balance += winnings;
      userData.totalEarned += winnings;
      embedColor = 0x57f287;
      description = `${resultText}\nYou won **${winnings.toLocaleString()} eksoscoin**! (${multiplier}x)`;
    } else {
      embedColor = 0xed4245;
      description = 'No match! Better luck next time!';
    }

    await userData.save();

    const reelDisplay = renderReels(r1, r2, r3);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🎰 Slot Machine')
      .setDescription(description)
      .addFields(
        { name: 'Reels', value: `\`\`\`${reelDisplay}\`\`\``, inline: false },
        { name: 'Bet', value: `${bet.toLocaleString()} eksoscoin`, inline: true },
        { name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
