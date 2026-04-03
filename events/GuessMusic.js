const { Events, EmbedBuilder } = require('discord.js');
const { activeGames, stopGame, revealAnswer, nextRound, endGame } = require('../commands/fun/GuessMusic');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    const game = activeGames.get(message.guild?.id);
    if (!game) return;

    if (message.channel.id !== game.channelId) return;

    if (game.answered) return;

    const guess = message.content.toLowerCase().replace(/[^\w\s]/g, '').trim();

    if (!guess) return;

    const titleWords = game.normalizedTitle.split(/\s+/);
    const authorWords = game.normalizedAuthor.split(/\s+/);

    const titleMatch = titleWords.filter((w) => guess.includes(w)).length / titleWords.length >= 0.6;
    const authorMatch = authorWords.filter((w) => guess.includes(w)).length / authorWords.length >= 0.6;
    const exactTitle = guess === game.normalizedTitle;
    const exactAuthor = guess === game.normalizedAuthor;

    if (exactTitle || exactAuthor || titleMatch || authorMatch) {
      game.answered = true;

      if (!game.scores.has(message.author.id)) {
        game.scores.set(message.author.id, 0);
      }
      game.scores.set(message.author.id, game.scores.get(message.author.id) + 1);

      await revealAnswer(message.channel, game);

      const winEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎉 Correct!')
        .setDescription(
          `**${message.author}** guessed it!`
        )
        .addFields({
          name: '📊 Score',
          value: `**${message.author}** now has **${game.scores.get(message.author.id)}** point(s)`,
          inline: false,
        })
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Round ${game.round}/${game.totalRounds}` })
        .setTimestamp();

      await message.channel.send({ embeds: [winEmbed] });

      if (game.round >= game.totalRounds) {
        await endGame({
          guild: message.guild,
          channel: message.channel,
          client: message.client,
        });
      } else {
        setTimeout(async () => {
          const currentGame = activeGames.get(message.guild.id);
          if (!currentGame) return;

          try {
            await game.player.stopPlaying();
          } catch (err) {
            console.error('[GuessMusic] Failed to stop between rounds:', err.message);
          }

          await nextRound({
            guild: message.guild,
            channel: message.channel,
            client: message.client,
            member: message.member,
          });
        }, 5000);
      }
    }
  },
};
