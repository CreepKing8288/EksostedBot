const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const activeGames = new Map();

const difficultyConfig = {
  easy: {
    label: 'Easy',
    snippetDuration: 15000,
    source: 'spsearch',
    query: 'top hits popular',
    emoji: '🟢',
  },
  medium: {
    label: 'Medium',
    snippetDuration: 10000,
    source: 'spsearch',
    query: 'popular songs',
    emoji: '🟡',
  },
  hard: {
    label: 'Hard',
    snippetDuration: 5000,
    source: 'spsearch',
    query: 'indie underground obscure',
    emoji: '🔴',
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guessmusic')
    .setDescription('Start a guess the music game in voice channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('Start a guess the music game.')
        .addStringOption((option) =>
          option
            .setName('difficulty')
            .setDescription('Difficulty level (controls snippet length & song obscurity).')
            .setRequired(true)
            .addChoices(
              { name: '🟢 Easy — 15s snippet, popular songs', value: 'easy' },
              { name: '🟡 Medium — 10s snippet, mixed songs', value: 'medium' },
              { name: '🔴 Hard — 5s snippet, obscure songs', value: 'hard' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('rounds')
            .setDescription('Number of rounds (1-10).')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stop')
        .setDescription('Stop the current guess the music game.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('hint')
        .setDescription('Reveal a hint for the current song.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('skip')
        .setDescription('Skip the current song and move to the next round.')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'stop') {
      const game = activeGames.get(interaction.guild.id);
      if (!game) {
        return interaction.reply({
          content: '❌ No active guess the music game!',
          ephemeral: true,
        });
      }

      await stopGame(interaction.guild.id);

      const stopEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🎵 Guess the Music')
        .setDescription('The game has been stopped.')
        .setTimestamp();

      return interaction.reply({ embeds: [stopEmbed] });
    }

    if (subcommand === 'hint') {
      const game = activeGames.get(interaction.guild.id);
      if (!game) {
        return interaction.reply({
          content: '❌ No active guess the music game!',
          ephemeral: true,
        });
      }

      if (game.hintsUsed >= game.totalHints) {
        return interaction.reply({
          content: '❌ No more hints available for this round!',
          ephemeral: true,
        });
      }

      game.hintsUsed++;
      const hint = game.hints[game.hintsUsed - 1];

      const hintEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('🎵 Guess the Music — Hint')
        .setDescription(hint)
        .setFooter({ text: `Hint ${game.hintsUsed}/${game.totalHints}` })
        .setTimestamp();

      await interaction.channel.send({ embeds: [hintEmbed] });
      return interaction.reply({ content: '✅ Hint revealed!', ephemeral: true });
    }

    if (subcommand === 'skip') {
      const game = activeGames.get(interaction.guild.id);
      if (!game) {
        return interaction.reply({
          content: '❌ No active guess the music game!',
          ephemeral: true,
        });
      }

      await revealAnswer(interaction.channel, game);
      await nextRound(interaction);
      return interaction.reply({ content: '⏭️ Song skipped!', ephemeral: true });
    }

    const difficulty = interaction.options.getString('difficulty');
    const rounds = interaction.options.getInteger('rounds') || 5;
    const config = difficultyConfig[difficulty];

    const member = interaction.member;
    if (!member.voice.channel) {
      return interaction.reply({
        content: '❌ You need to join a voice channel first!',
        ephemeral: true,
      });
    }

    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    if (botMember.voice.channel) {
      return interaction.reply({
        content: '❌ I am already in a voice channel! Stop the current game first.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const client = interaction.client;
    const player = client.lavalink.createPlayer({
      guildId: interaction.guild.id,
      voiceChannelId: member.voice.channel.id,
      textChannelId: interaction.channel.id,
      selfDeaf: true,
    });

    await player.connect();

    const search = await player.search({ query: config.query, source: config.source });

    if (!search?.tracks?.length) {
      await player.destroy();
      return interaction.editReply({
        content: '❌ No tracks found! Try again.',
      });
    }

    const track = search.tracks[Math.floor(Math.random() * Math.min(15, search.tracks.length))];
    track.userData = { requester: interaction.member };

    const songTitle = track.info.title;
    const songAuthor = track.info.author;
    const songUri = track.info.uri;

    const hints = [];
    hints.push(`**Artist starts with:** \`${songAuthor.charAt(0)}${'•'.repeat(Math.max(0, songAuthor.length - 1))}\``);

    const words = songTitle.split(' ');
    const masked = words.map((w) => `${w.charAt(0)}${'•'.repeat(Math.max(0, w.length - 1))}`).join(' ');
    hints.push(`**Title:** \`${masked}\` (${words.length} words)`);
    hints.push(`**Duration:** \`${Math.floor(track.info.duration / 1000)}s\` | **Platform:** ${songUri.includes('spotify') ? 'Spotify' : songUri.includes('youtube') ? 'YouTube' : 'Other'}`);

    const normalizedTitle = songTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const normalizedAuthor = songAuthor.toLowerCase().replace(/[^\w\s]/g, '').trim();

    const gameData = {
      channelId: interaction.channel.id,
      voiceChannelId: member.voice.channel.id,
      songTitle,
      songAuthor,
      normalizedTitle,
      normalizedAuthor,
      hints,
      hintsUsed: 0,
      totalHints: 3,
      player,
      startTime: Date.now(),
      guesses: [],
      scores: new Map(),
      round: 1,
      totalRounds: rounds,
      difficulty,
      answered: false,
    };

    activeGames.set(interaction.guild.id, gameData);

    const startEmbed = new EmbedBuilder()
      .setColor(0x1db954)
      .setTitle(`${config.emoji} Guess the Music — ${config.label}`)
      .setDescription(
        `🎧 I'm playing a song in <#${member.voice.channel.id}>...\n\n` +
        `**Type your guess in this channel!**\n` +
        `First person to guess the **song title** or **artist** wins the round!`
      )
      .addFields(
        { name: '🎯 Difficulty', value: config.label, inline: true },
        { name: '⏱️ Snippet', value: `\`${config.snippetDuration / 1000}s\``, inline: true },
        { name: '📊 Rounds', value: `\`${rounds}\``, inline: true }
      )
      .setFooter({ text: `Game started by ${interaction.user.tag} • Use /guessmusic hint for clues` })
      .setTimestamp();

    await interaction.editReply({ embeds: [startEmbed] });

    player.queue.add(track);
    await player.play();

    setTimeout(async () => {
      const game = activeGames.get(interaction.guild.id);
      if (!game || game.answered) return;

      try {
        await player.setVolume(0);
      } catch (err) {
        console.error('[GuessMusic] Failed to mute:', err.message);
      }

      const timeUpEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('⏱️ Snippet Ended!')
        .setDescription('The preview has stopped! Keep guessing or use `/guessmusic hint` for clues.')
        .setTimestamp();

      await interaction.channel.send({ embeds: [timeUpEmbed] });
    }, config.snippetDuration);
  },
};

async function stopGame(guildId) {
  const game = activeGames.get(guildId);
  if (!game) return;

  activeGames.delete(guildId);

  if (game.player) {
    try {
      await game.player.stopPlaying();
      await game.player.destroy();
    } catch (err) {
      console.error('[GuessMusic] Failed to stop player:', err.message);
    }
  }
}

async function revealAnswer(channel, game) {
  game.answered = true;

  try {
    await game.player.stopPlaying();
  } catch (err) {
    console.error('[GuessMusic] Failed to stop on reveal:', err.message);
  }

  const revealEmbed = new EmbedBuilder()
    .setColor(0x1db954)
    .setTitle('🎵 The Answer Was...')
    .setDescription(
      `**Title:** [${game.songTitle}](${game.songUri || 'https://open.spotify.com'})\n` +
      `**Artist:** \`${game.songAuthor}\``
    )
    .setThumbnail(game.player.queue.current?.info.artworkUrl || null)
    .setFooter({ text: `Round ${game.round}/${game.totalRounds}` })
    .setTimestamp();

  await channel.send({ embeds: [revealEmbed] });
}

async function nextRound(interaction) {
  const game = activeGames.get(interaction.guild.id);
  if (!game) return;

  if (game.round >= game.totalRounds) {
    await endGame(interaction);
    return;
  }

  game.round++;
  game.answered = false;
  game.hintsUsed = 0;
  game.guesses = [];

  const config = difficultyConfig[game.difficulty];
  const client = interaction.client;
  const player = game.player;

  const search = await player.search({ query: config.query, source: config.source });

  if (!search?.tracks?.length) {
    await interaction.channel.send('❌ No tracks found for next round, skipping...');
    game.round--;
    return nextRound(interaction);
  }

  const track = search.tracks[Math.floor(Math.random() * Math.min(15, search.tracks.length))];
  track.userData = { requester: interaction.member };

  const songTitle = track.info.title;
  const songAuthor = track.info.author;
  const songUri = track.info.uri;

  game.songTitle = songTitle;
  game.songAuthor = songAuthor;
  game.normalizedTitle = songTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();
  game.normalizedAuthor = songAuthor.toLowerCase().replace(/[^\w\s]/g, '').trim();

  game.hints = [];
  game.hints.push(`**Artist starts with:** \`${songAuthor.charAt(0)}${'•'.repeat(Math.max(0, songAuthor.length - 1))}\``);
  const words = songTitle.split(' ');
  const masked = words.map((w) => `${w.charAt(0)}${'•'.repeat(Math.max(0, w.length - 1))}`).join(' ');
  game.hints.push(`**Title:** \`${masked}\` (${words.length} words)`);
  game.hints.push(`**Duration:** \`${Math.floor(track.info.duration / 1000)}s\` | **Platform:** ${songUri.includes('spotify') ? 'Spotify' : songUri.includes('youtube') ? 'YouTube' : 'Other'}`);

  player.queue.add(track);
  await player.play();

  const roundEmbed = new EmbedBuilder()
    .setColor(0x1db954)
    .setTitle(`${config.emoji} Round ${game.round}/${game.totalRounds}`)
    .setDescription('🎧 Listen carefully and guess the song!')
    .setFooter({ text: 'Type your guess in this channel!' })
    .setTimestamp();

  await interaction.channel.send({ embeds: [roundEmbed] });

  setTimeout(async () => {
    const currentGame = activeGames.get(interaction.guild.id);
    if (!currentGame || currentGame.answered) return;

    try {
      await player.setVolume(0);
    } catch (err) {
      console.error('[GuessMusic] Failed to mute:', err.message);
    }

    const timeUpEmbed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('⏱️ Snippet Ended!')
      .setDescription('The preview has stopped! Keep guessing or use `/guessmusic hint` for clues.')
      .setTimestamp();

    await interaction.channel.send({ embeds: [timeUpEmbed] });
  }, config.snippetDuration);
}

async function endGame(interaction) {
  const game = activeGames.get(interaction.guild.id);
  if (!game) return;

  const sortedScores = [...game.scores.entries()].sort((a, b) => b[1] - a[1]);
  const leaderboard = sortedScores
    .slice(0, 5)
    .map(([userId, score], i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const medal = medals[i] || `${i + 1}.`;
      return `${medal} <@${userId}> — **${score}** point${score !== 1 ? 's' : ''}`;
    })
    .join('\n');

  const endEmbed = new EmbedBuilder()
    .setColor(0x1db954)
    .setTitle('🏆 Game Over!')
    .setDescription(
      `**Final Leaderboard**\n\n${leaderboard || 'No one scored any points!'}`
    )
    .setFooter({ text: 'Thanks for playing!' })
    .setTimestamp();

  await interaction.channel.send({ embeds: [endEmbed] });

  await stopGame(interaction.guild.id);
}

module.exports.activeGames = activeGames;
module.exports.stopGame = stopGame;
module.exports.revealAnswer = revealAnswer;
module.exports.nextRound = nextRound;
module.exports.endGame = endGame;
