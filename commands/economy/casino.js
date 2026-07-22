const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

// ── Shared helpers ──

async function getUserData(userId) {
  let userData = await EksosCoin.findOne({ userId });
  if (!userData) userData = await EksosCoin.create({ userId });
  return userData;
}

function insufficientFunds(bet, balance) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('Insufficient Funds')
    .setDescription(
      `You need **${bet.toLocaleString()} eksoscoin** but only have **${balance.toLocaleString()}**.`
    );
}

// ── Slot Machine ──

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '💎', '7️⃣'];
const SLOT_WEIGHTS = [25, 22, 20, 15, 10, 5, 3];

function weightedRandom() {
  const total = SLOT_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
    r -= SLOT_WEIGHTS[i];
    if (r <= 0) return SLOT_SYMBOLS[i];
  }
  return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1];
}

async function runSlot(interaction, bet) {
  const userData = await getUserData(interaction.user.id);
  if (userData.balance < bet) {
    return interaction.reply({ embeds: [insufficientFunds(bet, userData.balance)], ephemeral: true });
  }

  const r1 = weightedRandom();
  const r2 = weightedRandom();
  const r3 = weightedRandom();

  let multiplier = 0;
  let resultText = '';

  if (r1 === r2 && r2 === r3) {
    if (r1 === '7️⃣' || r1 === '💎') {
      multiplier = 25;
      resultText = `JACKPOT! Triple ${r1}!`;
    } else {
      multiplier = 10;
      resultText = 'TRIPLE MATCH!';
    }
  } else if (r1 === r2 || r2 === r3 || r1 === r3) {
    multiplier = 3;
    resultText = 'Double Match!';
  }

  const winnings = bet * multiplier;
  userData.balance -= bet;
  userData.totalSpent += bet;

  let color, desc;
  if (multiplier > 0) {
    userData.balance += winnings;
    userData.totalEarned += winnings;
    color = 0x57f287;
    desc = `${resultText}\nYou won **${winnings.toLocaleString()} eksoscoin**! (${multiplier}x)`;
  } else {
    color = 0xed4245;
    desc = 'No match! Better luck next time!';
  }
  await userData.save();

  const reels = `┌─────────────┐\n│  ${r1} │ ${r2} │ ${r3}  │\n└─────────────┘`;

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle('🎰 Slot Machine')
        .setDescription(desc)
        .addFields(
          { name: 'Reels', value: `\`\`\`${reels}\`\`\`` },
          { name: 'Bet', value: `${bet.toLocaleString()}`, inline: true },
          { name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
        )
        .setTimestamp(),
    ],
  });
}

// ── Coinflip ──

async function runCoinflip(interaction, bet, choice) {
  const userData = await getUserData(interaction.user.id);
  if (userData.balance < bet) {
    return interaction.reply({ embeds: [insufficientFunds(bet, userData.balance)], ephemeral: true });
  }

  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const emoji = result === 'heads' ? '🪙' : '🌕';
  const won = result === choice;

  userData.balance -= bet;
  userData.totalSpent += bet;

  let color, desc;
  if (won) {
    const winnings = bet * 2;
    userData.balance += winnings;
    userData.totalEarned += winnings;
    color = 0x57f287;
    desc = `The coin landed on **${result.toUpperCase()}** ${emoji}\nYou won **${winnings.toLocaleString()} eksoscoin**!`;
  } else {
    color = 0xed4245;
    desc = `The coin landed on **${result.toUpperCase()}** ${emoji}\nYou lost **${bet.toLocaleString()} eksoscoin**!`;
  }
  await userData.save();

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle('🪙 Coinflip')
        .setDescription(desc)
        .addFields(
          { name: 'Your Pick', value: choice.charAt(0).toUpperCase() + choice.slice(1), inline: true },
          { name: 'Result', value: result.charAt(0).toUpperCase() + result.slice(1), inline: true },
          { name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
        )
        .setTimestamp(),
    ],
  });
}

// ── Dice ──

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

async function runDice(interaction, bet, prediction) {
  const userData = await getUserData(interaction.user.id);
  if (userData.balance < bet) {
    return interaction.reply({ embeds: [insufficientFunds(bet, userData.balance)], ephemeral: true });
  }

  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;

  let won = false;
  let multiplier = 0;
  if (prediction === 'under' && total < 7) { won = true; multiplier = 2; }
  else if (prediction === 'seven' && total === 7) { won = true; multiplier = 4; }
  else if (prediction === 'over' && total > 7) { won = true; multiplier = 2; }

  userData.balance -= bet;
  userData.totalSpent += bet;

  let color, desc;
  if (won) {
    const winnings = bet * multiplier;
    userData.balance += winnings;
    userData.totalEarned += winnings;
    color = 0x57f287;
    desc = `You rolled **${total}** ${DICE_FACES[die1 - 1]} ${DICE_FACES[die2 - 1]}\nYou won **${winnings.toLocaleString()} eksoscoin**! (${multiplier}x)`;
  } else {
    color = 0xed4245;
    desc = `You rolled **${total}** ${DICE_FACES[die1 - 1]} ${DICE_FACES[die2 - 1]}\nYou lost **${bet.toLocaleString()} eksoscoin**!`;
  }
  await userData.save();

  const label = prediction === 'under' ? 'Under 7' : prediction === 'seven' ? 'Exactly 7' : 'Over 7';

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle('🎲 Dice Roll')
        .setDescription(desc)
        .addFields(
          { name: 'Prediction', value: label, inline: true },
          { name: 'Total', value: `${total}`, inline: true },
          { name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
        )
        .setTimestamp(),
    ],
  });
}

// ── Blackjack ──

const CARDS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };

function drawCard() {
  const rank = CARDS[Math.floor(Math.random() * CARDS.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const value = rank === 'A' ? 11 : ['K', 'Q', 'J'].includes(rank) ? 10 : parseInt(rank);
  return { rank, suit, value };
}

function handValue(hand) {
  let val = hand.reduce((s, c) => s + c.value, 0);
  let aces = hand.filter((c) => c.rank === 'A').length;
  while (val > 21 && aces > 0) { val -= 10; aces--; }
  return val;
}

function formatCard(c) { return `${c.rank}${c.suit}`; }
function formatHand(hand) { return hand.map(formatCard).join(' '); }

async function runBlackjack(interaction, bet) {
  const userData = await getUserData(interaction.user.id);
  if (userData.balance < bet) {
    return interaction.reply({ embeds: [insufficientFunds(bet, userData.balance)], ephemeral: true });
  }

  let playerHand = [drawCard(), drawCard()];
  let dealerHand = [drawCard(), drawCard()];

  const bj = handValue(playerHand) === 21;

  userData.balance -= bet;
  userData.totalSpent += bet;

  if (bj) {
    const winnings = Math.floor(bet * 2.5);
    userData.balance += winnings;
    userData.totalEarned += winnings;
    await userData.save();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('🃏 Blackjack — BLACKJACK!')
          .setDescription(`**Your Hand:** ${formatHand(playerHand)} (${handValue(playerHand)})\n**Dealer:** ${formatHand(dealerHand)} (${handValue(dealerHand)})\n\nYou got a natural **Blackjack**! Won **${winnings.toLocaleString()} eksoscoin**! (2.5x)`)
          .addFields({ name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin` })
          .setTimestamp(),
      ],
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Primary)
  );

  const embed = new EmbedBuilder()
    .setColor(0xf5a623)
    .setTitle('🃏 Blackjack')
    .setDescription(
      `**Your Hand:** ${formatHand(playerHand)} (${handValue(playerHand)})\n**Dealer:** ${dealerHand[0].rank}${dealerHand[0].suit} ???`
    )
    .addFields({ name: 'Bet', value: `${bet.toLocaleString()}`, inline: true });

  await interaction.reply({ embeds: [embed], components: [row] });

  const collector = interaction.channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('bj_'),
    time: 30000,
    max: 10,
  });

  let doubled = false;

  collector.on('collect', async (btn) => {
    await btn.deferUpdate();

    if (btn.customId === 'bj_hit') {
      playerHand.push(drawCard());
    } else if (btn.customId === 'bj_double' && userData.balance >= bet) {
      userData.balance -= bet;
      userData.totalSpent += bet;
      bet *= 2;
      playerHand.push(drawCard());
      doubled = true;
    } else if (btn.customId === 'bj_double') {
      return btn.followUp({ content: 'Not enough coins to double down!', ephemeral: true });
    }

    const pv = handValue(playerHand);

    if (pv > 21) {
      collector.stop('bust');
      await userData.save();
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🃏 Blackjack — Bust!')
            .setDescription(`**Your Hand:** ${formatHand(playerHand)} (${pv})\n**Dealer:** ${formatHand(dealerHand)} (${handValue(dealerHand)})\n\nYou busted! Lost **${bet.toLocaleString()} eksoscoin**.`)
            .addFields({ name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin` })
            .setTimestamp(),
        ],
        components: [],
      });
    }

    if (btn.customId === 'bj_stand' || doubled) {
      collector.stop('stand');
    } else {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf5a623)
            .setTitle('🃏 Blackjack')
            .setDescription(`**Your Hand:** ${formatHand(playerHand)} (${pv})\n**Dealer:** ${dealerHand[0].rank}${dealerHand[0].suit} ???`)
            .addFields({ name: 'Bet', value: `${bet.toLocaleString()}`, inline: true })
            .setTimestamp(),
        ],
        components: [row],
      });
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') {
      await userData.save();
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🃏 Blackjack — Timed Out')
            .setDescription(`You took too long! Lost **${bet.toLocaleString()} eksoscoin**.`)
            .addFields({ name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin` })
            .setTimestamp(),
        ],
        components: [],
      });
    }

    if (reason !== 'stand' && reason !== 'bust') return;

    while (handValue(dealerHand) < 17) dealerHand.push(drawCard());

    const pv = handValue(playerHand);
    const dv = handValue(dealerHand);

    let color, desc;
    if (dv > 21 || pv > dv) {
      const winnings = bet * 2;
      userData.balance += winnings;
      userData.totalEarned += winnings;
      color = 0x57f287;
      desc = `**Your Hand:** ${formatHand(playerHand)} (${pv})\n**Dealer:** ${formatHand(dealerHand)} (${dv})\n\nYou won **${winnings.toLocaleString()} eksoscoin**!`;
    } else if (pv === dv) {
      userData.balance += bet;
      desc = `**Your Hand:** ${formatHand(playerHand)} (${pv})\n**Dealer:** ${formatHand(dealerHand)} (${dv})\n\nPush! Bet returned.`;
      color = 0xfee75c;
    } else {
      color = 0xed4245;
      desc = `**Your Hand:** ${formatHand(playerHand)} (${pv})\n**Dealer:** ${formatHand(dealerHand)} (${dv})\n\nDealer wins! Lost **${bet.toLocaleString()} eksoscoin**.`;
    }

    await userData.save();
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle('🃏 Blackjack')
          .setDescription(desc)
          .addFields({ name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin` })
          .setTimestamp(),
      ],
      components: [],
    });
  });
}

// ── Roulette ──

const ROULETTE_NUMBERS = {
  0: 'green', 1: 'red', 2: 'black', 3: 'red', 4: 'black', 5: 'red', 6: 'black',
  7: 'red', 8: 'black', 9: 'red', 10: 'black', 11: 'red', 12: 'black',
  13: 'red', 14: 'black', 15: 'red', 16: 'black', 17: 'red', 18: 'black',
  19: 'red', 20: 'black', 21: 'red', 22: 'black', 23: 'red', 24: 'black',
  25: 'red', 26: 'black', 27: 'red', 28: 'black', 29: 'red', 30: 'black',
  31: 'red', 32: 'black', 33: 'red', 34: 'black', 35: 'red', 36: 'black',
};

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

async function runRoulette(interaction, bet, choice) {
  const userData = await getUserData(interaction.user.id);
  if (userData.balance < bet) {
    return interaction.reply({ embeds: [insufficientFunds(bet, userData.balance)], ephemeral: true });
  }

  const result = Math.floor(Math.random() * 37);
  const color = ROULETTE_NUMBERS[result];
  const colorEmoji = color === 'red' ? '🔴' : color === 'black' ? '⚫' : '🟢';

  userData.balance -= bet;
  userData.totalSpent += bet;

  let won = false;
  let multiplier = 0;

  if (choice === 'red' && RED_NUMBERS.includes(result)) { won = true; multiplier = 2; }
  else if (choice === 'black' && !RED_NUMBERS.includes(result) && result !== 0) { won = true; multiplier = 2; }
  else if (choice === 'green' && result === 0) { won = true; multiplier = 14; }
  else if (choice === 'odd' && result !== 0 && result % 2 !== 0) { won = true; multiplier = 2; }
  else if (choice === 'even' && result !== 0 && result % 2 === 0) { won = true; multiplier = 2; }
  else if (choice === 'low' && result >= 1 && result <= 18) { won = true; multiplier = 2; }
  else if (choice === 'high' && result >= 19 && result <= 36) { won = true; multiplier = 2; }
  else if (!isNaN(parseInt(choice)) && parseInt(choice) === result) { won = true; multiplier = 36; }

  let embedColor, desc;
  if (won) {
    const winnings = bet * multiplier;
    userData.balance += winnings;
    userData.totalEarned += winnings;
    embedColor = 0x57f287;
    desc = `The ball landed on **${result}** ${colorEmoji}\nYou won **${winnings.toLocaleString()} eksoscoin**! (${multiplier}x)`;
  } else {
    embedColor = 0xed4245;
    desc = `The ball landed on **${result}** ${colorEmoji}\nYou lost **${bet.toLocaleString()} eksoscoin**!`;
  }
  await userData.save();

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('🎡 Roulette')
        .setDescription(desc)
        .addFields(
          { name: 'Your Bet', value: choice.toUpperCase(), inline: true },
          { name: 'Result', value: `${result} ${color.charAt(0).toUpperCase() + color.slice(1)}`, inline: true },
          { name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
        )
        .setTimestamp(),
    ],
  });
}

// ── Mines ──

async function runMines(interaction, bet) {
  const userData = await getUserData(interaction.user.id);
  if (userData.balance < bet) {
    return interaction.reply({ embeds: [insufficientFunds(bet, userData.balance)], ephemeral: true });
  }

  const GRID_SIZE = 25;
  const MINE_COUNT = 5;
  const mines = new Set();
  while (mines.size < MINE_COUNT) mines.add(Math.floor(Math.random() * GRID_SIZE));

  userData.balance -= bet;
  userData.totalSpent += bet;
  await userData.save();

  let revealed = new Set();
  let multiplier = 1;
  let gameOver = false;

  function buildGrid() {
    let rows = [];
    for (let y = 0; y < 5; y++) {
      let row = '';
      for (let x = 0; x < 5; x++) {
        const idx = y * 5 + x;
        if (revealed.has(idx)) {
          row += mines.has(idx) ? '💥' : '💎';
        } else {
          row += '⬛';
        }
      }
      rows.push(row);
    }
    return rows.join('\n');
  }

  function buildButtons() {
    const rows = [];
    for (let y = 0; y < 5; y++) {
      const row = new ActionRowBuilder();
      for (let x = 0; x < 5; x++) {
        const idx = y * 5 + x;
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`mine_${idx}`)
            .setLabel(`${idx + 1}`)
            .setStyle(revealed.has(idx) ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(revealed.has(idx))
        );
      }
      rows.push(row);
    }
    const cashoutRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mine_cashout')
        .setLabel(`Cashout (${Math.floor(bet * multiplier).toLocaleString()} eksoscoin)`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(revealed.size === 0)
    );
    rows.push(cashoutRow);
    return rows;
  }

  const safeTiles = GRID_SIZE - MINE_COUNT;
  const totalMultiplier = 1 + (safeTiles / MINE_COUNT) * 0.5;

  const embed = new EmbedBuilder()
    .setColor(0xf5a623)
    .setTitle('💣 Mines')
    .setDescription(
      `Pick tiles to reveal gems! Avoid the mines!\n\n${buildGrid()}\n\n**Bet:** ${bet.toLocaleString()} eksoscoin | **Multiplier:** ${multiplier}x`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: buildButtons() });

  const collector = interaction.channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id && (i.customId.startsWith('mine_') || i.customId === 'mine_cashout'),
    time: 60000,
  });

  collector.on('collect', async (btn) => {
    await btn.deferUpdate();

    if (btn.customId === 'mine_cashout') {
      collector.stop('cashout');
      const winnings = Math.floor(bet * multiplier);
      userData.balance += winnings;
      userData.totalEarned += winnings;
      await userData.save();

      let mineReveal = '';
      for (let i = 0; i < GRID_SIZE; i++) {
        if (mines.has(i) && !revealed.has(i)) mineReveal += '💣';
        else if (revealed.has(i)) mineReveal += mines.has(i) ? '💥' : '💎';
        else mineReveal += '⬜';
        if ((i + 1) % 5 === 0) mineReveal += '\n';
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('💣 Mines — Cashed Out!')
            .setDescription(
              `You cashed out at **${multiplier.toFixed(2)}x**!\nWon **${winnings.toLocaleString()} eksoscoin**!\n\n${mineReveal}`
            )
            .addFields({ name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin` })
            .setTimestamp(),
        ],
        components: [],
      });
    }

    const idx = parseInt(btn.customId.split('_')[1]);

    if (revealed.has(idx)) return;

    if (mines.has(idx)) {
      gameOver = true;
      revealed.add(idx);
      for (let i = 0; i < GRID_SIZE; i++) revealed.add(i);

      collector.stop('mine_hit');

      let mineReveal = '';
      for (let i = 0; i < GRID_SIZE; i++) {
        mineReveal += mines.has(i) ? '💣' : '⬜';
        if ((i + 1) % 5 === 0) mineReveal += '\n';
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('💣 Mines — BOOM!')
            .setDescription(
              `You hit a mine! Lost **${bet.toLocaleString()} eksoscoin**.\n\n${mineReveal}`
            )
            .addFields({ name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin` })
            .setTimestamp(),
        ],
        components: [],
      });
    }

    revealed.add(idx);
    multiplier = 1 + revealed.size * 0.5;

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf5a623)
          .setTitle('💣 Mines')
          .setDescription(
            `Pick tiles to reveal gems! Avoid the mines!\n\n${buildGrid()}\n\n**Bet:** ${bet.toLocaleString()} eksoscoin | **Multiplier:** ${multiplier.toFixed(2)}x | **Potential:** ${Math.floor(bet * multiplier).toLocaleString()} eksoscoin`
          )
          .setTimestamp(),
      ],
      components: buildButtons(),
    });
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'cashout' || reason === 'mine_hit') return;

    for (let i = 0; i < GRID_SIZE; i++) revealed.add(i);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('💣 Mines — Timed Out')
          .setDescription(`You ran out of time! Lost **${bet.toLocaleString()} eksoscoin**.`)
          .addFields({ name: 'Balance', value: `${userData.balance.toLocaleString()} eksoscoin` })
          .setTimestamp(),
      ],
      components: [],
    });
  });
}

// ── Main Command ──

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('Play casino games to win EksosCoin!')
    .addSubcommand((sub) =>
      sub
        .setName('slot')
        .setDescription('Play the slot machine.')
        .addIntegerOption((o) =>
          o.setName('bet').setDescription('Amount to bet.').setRequired(true).setMinValue(10)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('coinflip')
        .setDescription('Flip a coin — double or nothing!')
        .addIntegerOption((o) =>
          o.setName('bet').setDescription('Amount to bet.').setRequired(true).setMinValue(10)
        )
        .addStringOption((o) =>
          o
            .setName('choice')
            .setDescription('Heads or tails?')
            .setRequired(true)
            .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('dice')
        .setDescription('Roll the dice — predict the total.')
        .addIntegerOption((o) =>
          o.setName('bet').setDescription('Amount to bet.').setRequired(true).setMinValue(10)
        )
        .addStringOption((o) =>
          o
            .setName('prediction')
            .setDescription('Under 7, exactly 7, or over 7?')
            .setRequired(true)
            .addChoices(
              { name: 'Under 7 (2x)', value: 'under' },
              { name: 'Exactly 7 (4x)', value: 'seven' },
              { name: 'Over 7 (2x)', value: 'over' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('blackjack')
        .setDescription('Play blackjack against the dealer.')
        .addIntegerOption((o) =>
          o.setName('bet').setDescription('Amount to bet.').setRequired(true).setMinValue(10)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('roulette')
        .setDescription('Spin the roulette wheel.')
        .addIntegerOption((o) =>
          o.setName('bet').setDescription('Amount to bet.').setRequired(true).setMinValue(10)
        )
        .addStringOption((o) =>
          o
            .setName('choice')
            .setDescription('What to bet on.')
            .setRequired(true)
            .addChoices(
              { name: 'Red (2x)', value: 'red' },
              { name: 'Black (2x)', value: 'black' },
              { name: 'Green (14x)', value: 'green' },
              { name: 'Odd (2x)', value: 'odd' },
              { name: 'Even (2x)', value: 'even' },
              { name: 'Low 1-18 (2x)', value: 'low' },
              { name: 'High 19-36 (2x)', value: 'high' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('mines')
        .setDescription('Avoid the mines and collect gems!')
        .addIntegerOption((o) =>
          o.setName('bet').setDescription('Amount to bet.').setRequired(true).setMinValue(10)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const bet = interaction.options.getInteger('bet');

    switch (sub) {
      case 'slot':
        return runSlot(interaction, bet);
      case 'coinflip': {
        const choice = interaction.options.getString('choice');
        return runCoinflip(interaction, bet, choice);
      }
      case 'dice': {
        const prediction = interaction.options.getString('prediction');
        return runDice(interaction, bet, prediction);
      }
      case 'blackjack':
        return runBlackjack(interaction, bet);
      case 'roulette': {
        const choice = interaction.options.getString('choice');
        return runRoulette(interaction, bet, choice);
      }
      case 'mines':
        return runMines(interaction, bet);
    }
  },
};
