const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { getPlayerInstance } = require('../../utils/musicPlayer');

const activeGames = new Map();

const difficultyConfig = {
  easy: { label: 'Easy', snippetDuration: 15000, query: 'top hits popular songs 2024', emoji: '🟢' },
  medium: { label: 'Medium', snippetDuration: 10000, query: 'popular songs hits', emoji: '🟡' },
  hard: { label: 'Hard', snippetDuration: 5000, query: 'indie underground obscure songs', emoji: '🔴' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guessmusic')
    .setDescription('Start a guess the music game in voice channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('start').setDescription('Start a guess the music game.')
        .addStringOption((opt) => opt.setName('difficulty').setDescription('Difficulty level.').setRequired(true)
          .addChoices(
            { name: '🟢 Easy — 15s snippet, popular songs', value: 'easy' },
            { name: '🟡 Medium — 10s snippet, mixed songs', value: 'medium' },
            { name: '🔴 Hard — 5s snippet, obscure songs', value: 'hard' }
          ))
        .addIntegerOption((opt) => opt.setName('rounds').setDescription('Number of rounds (1-10).').setRequired(false).setMinValue(1).setMaxValue(10))
    )
    .addSubcommand((sub) => sub.setName('stop').setDescription('Stop the current game.'))
    .addSubcommand((sub) => sub.setName('hint').setDescription('Reveal a hint for the current song.'))
    .addSubcommand((sub) => sub.setName('skip').setDescription('Skip the current song.'))
    .addSubcommand((sub) => sub.setName('playagain').setDescription('Replay the current snippet (3 uses per round).')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'stop') {
      const game = activeGames.get(interaction.guild.id);
      if (!game) return interaction.reply({ content: '❌ No active game!', ephemeral: true });
      await stopGame(interaction.guild.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff0000).setTitle('🎵 Guess the Music').setDescription('The game has been stopped.').setTimestamp()] });
    }

    if (subcommand === 'hint') {
      const game = activeGames.get(interaction.guild.id);
      if (!game) return interaction.reply({ content: '❌ No active game!', ephemeral: true });
      if (game.hintsUsed >= game.totalHints) return interaction.reply({ content: '❌ No more hints!', ephemeral: true });
      game.hintsUsed++;
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xffa500).setTitle('🎵 Hint').setDescription(game.hints[game.hintsUsed - 1]).setFooter({ text: `Hint ${game.hintsUsed}/${game.totalHints}` }).setTimestamp()] });
      return interaction.reply({ content: '✅ Hint revealed!', ephemeral: true });
    }

    if (subcommand === 'skip') {
      const game = activeGames.get(interaction.guild.id);
      if (!game) return interaction.reply({ content: '❌ No active game!', ephemeral: true });
      await revealAnswer(interaction.channel, game);
      await nextRound(interaction);
      return interaction.reply({ content: '⏭️ Skipped!', ephemeral: true });
    }

    if (subcommand === 'playagain') {
      const game = activeGames.get(interaction.guild.id);
      if (!game) return interaction.reply({ content: '❌ No active game!', ephemeral: true });
      if (game.answered) return interaction.reply({ content: '❌ Round is over!', ephemeral: true });
      if (game.replaysUsed >= game.maxReplays) return interaction.reply({ content: '❌ No replays left!', ephemeral: true });
      game.replaysUsed++;
      try {
        const streamInfo = await game.track.stream();
        const resource = createAudioResource(streamInfo.stream, { inlineVolume: true });
        game.player.play(resource);
      } catch {}
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x1db954).setTitle('🔁 Replay!').setDescription('Playing again!').setFooter({ text: `Replays left: ${game.maxReplays - game.replaysUsed}/${game.maxReplays}` }).setTimestamp()] });
      await interaction.reply({ content: `✅ Playing again! (${game.replaysUsed}/${game.maxReplays})`, ephemeral: true });
      setTimeout(async () => {
        const g = activeGames.get(interaction.guild.id);
        if (!g || g.answered) return;
        try { g.player.stop(); } catch {}
      }, difficultyConfig[game.difficulty].snippetDuration);
    }

    const difficulty = interaction.options.getString('difficulty');
    const rounds = interaction.options.getInteger('rounds') || 5;
    const config = difficultyConfig[difficulty];
    const member = interaction.member;

    if (!member.voice.channel) return interaction.reply({ content: '❌ Join a voice channel first!', ephemeral: true });

    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    if (botMember.voice.channel) return interaction.reply({ content: '❌ I am already in a voice channel! Stop the current game first.', ephemeral: true });

    await interaction.deferReply();

    const player = getPlayerInstance(interaction.client);
    const searchResult = await player.search(config.query, { searchEngine: 'ytsearch' });

    if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
      return interaction.editReply({ content: '❌ No tracks found!' });
    }

    const track = searchResult.tracks[Math.floor(Math.random() * Math.min(15, searchResult.tracks.length))];

    const connection = joinVoiceChannel({
      channelId: member.voice.channel.id,
      guildId: interaction.guild.id,
      adapterCreator: member.voice.channel.guild.voiceAdapterCreator,
    });

    const audioPlayer = createAudioPlayer();
    connection.subscribe(audioPlayer);

    const streamInfo = await track.stream();
    const resource = createAudioResource(streamInfo.stream, { inlineVolume: true });
    audioPlayer.play(resource);

    const songTitle = track.title;
    const songAuthor = track.author || 'Unknown';

    const hints = [];
    hints.push(`**Artist starts with:** \`${songAuthor.charAt(0)}${'•'.repeat(Math.max(0, songAuthor.length - 1))}\``);
    const words = songTitle.split(' ');
    const masked = words.map((w) => `${w.charAt(0)}${'•'.repeat(Math.max(0, w.length - 1))}`).join(' ');
    hints.push(`**Title:** \`${masked}\` (${words.length} words)`);
    hints.push(`**Duration:** \`${formatDuration(track.durationMS || track.duration * 1000)}\` | **Platform:** \`YouTube\``);

    const gameData = {
      channelId: interaction.channel.id,
      voiceChannelId: member.voice.channel.id,
      songTitle,
      songAuthor,
      normalizedTitle: songTitle.toLowerCase().replace(/[^\w\s]/g, '').trim(),
      normalizedAuthor: songAuthor.toLowerCase().replace(/[^\w\s]/g, '').trim(),
      hints,
      hintsUsed: 0,
      totalHints: 3,
      player: audioPlayer,
      connection,
      track,
      startTime: Date.now(),
      guesses: [],
      scores: new Map(),
      round: 1,
      totalRounds: rounds,
      difficulty,
      answered: false,
      replaysUsed: 0,
      maxReplays: 3,
    };

    activeGames.set(interaction.guild.id, gameData);

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle(`${config.emoji} Guess the Music — ${config.label}`)
        .setDescription(`🎧 I'm playing a song in <#${member.voice.channel.id}>...\n\n**Type your guess in this channel!**\nFirst person to guess the **song title** or **artist** wins the round!`)
        .addFields(
          { name: '🎯 Difficulty', value: config.label, inline: true },
          { name: '⏱️ Snippet', value: `\`${config.snippetDuration / 1000}s\``, inline: true },
          { name: '📊 Rounds', value: `\`${rounds}\``, inline: true }
        )
        .setFooter({ text: `Game started by ${interaction.user.tag} • Use /guessmusic hint for clues` })
        .setTimestamp()],
    });

    setTimeout(async () => {
      const game = activeGames.get(interaction.guild.id);
      if (!game || game.answered) return;
      try { game.player.stop(); } catch {}
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xffa500).setTitle('⏱️ Snippet Ended!').setDescription('The preview has stopped! Keep guessing.').setTimestamp()] });
    }, config.snippetDuration);
  },
};

async function stopGame(guildId) {
  const game = activeGames.get(guildId);
  if (!game) return;
  activeGames.delete(guildId);
  try { game.player.stop(); game.connection.destroy(); } catch {}
}

async function revealAnswer(channel, game) {
  game.answered = true;
  try { game.player.stop(); } catch {}
  await channel.send({ embeds: [new EmbedBuilder().setColor(0x1db954).setTitle('🎵 Answer Revealed').setDescription(`**${game.songTitle}** by **${game.songAuthor}**`).setFooter({ text: `Round ${game.round}/${game.totalRounds}` }).setTimestamp()] });
}

async function nextRound(interaction) {
  const game = activeGames.get(interaction.guild.id);
  if (!game) return;
  if (game.round >= game.totalRounds) { await endGame(interaction); return; }

  game.round++;
  game.answered = false;
  game.hintsUsed = 0;
  game.guesses = [];
  game.replaysUsed = 0;

  const config = difficultyConfig[game.difficulty];
  const player = getPlayerInstance(interaction.client);
  const searchResult = await player.search(config.query, { searchEngine: 'ytsearch' });

  if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
    await interaction.channel.send('❌ No tracks found for next round!');
    game.round--;
    return nextRound(interaction);
  }

  const track = searchResult.tracks[Math.floor(Math.random() * Math.min(15, searchResult.tracks.length))];
  const songTitle = track.title;
  const songAuthor = track.author || 'Unknown';

  game.songTitle = songTitle;
  game.songAuthor = songAuthor;
  game.normalizedTitle = songTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();
  game.normalizedAuthor = songAuthor.toLowerCase().replace(/[^\w\s]/g, '').trim();
  game.track = track;

  game.hints = [];
  game.hints.push(`**Artist starts with:** \`${songAuthor.charAt(0)}${'•'.repeat(Math.max(0, songAuthor.length - 1))}\``);
  const words = songTitle.split(' ');
  const masked = words.map((w) => `${w.charAt(0)}${'•'.repeat(Math.max(0, w.length - 1))}`).join(' ');
  game.hints.push(`**Title:** \`${masked}\` (${words.length} words)`);
  game.hints.push(`**Duration:** \`${formatDuration(track.durationMS || track.duration * 1000)}\` | **Platform:** \`YouTube\``);

  try {
    const streamInfo = await track.stream();
    const resource = createAudioResource(streamInfo.stream, { inlineVolume: true });
    game.player.play(resource);
  } catch (err) {
    return interaction.channel.send(`❌ Failed to play next round: ${err.message}`);
  }

  await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x1db954).setTitle(`${config.emoji} Round ${game.round}/${game.totalRounds}`).setDescription('🎧 Listen carefully and guess the song!').setFooter({ text: 'Type your guess in this channel!' }).setTimestamp()] });

  setTimeout(async () => {
    const g = activeGames.get(interaction.guild.id);
    if (!g || g.answered) return;
    try { g.player.stop(); } catch {}
    await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xffa500).setTitle('⏱️ Snippet Ended!').setDescription('The preview has stopped! Keep guessing.').setTimestamp()] });
  }, config.snippetDuration);
}

async function endGame(interaction) {
  const game = activeGames.get(interaction.guild.id);
  if (!game) return;

  const sortedScores = [...game.scores.entries()].sort((a, b) => b[1] - a[1]);
  const leaderboard = sortedScores.slice(0, 5).map(([userId, score], i) => {
    const medals = ['🥇', '🥈', '🥉'];
    return `${medals[i] || `${i + 1}.`} <@${userId}> — **${score}** point${score !== 1 ? 's' : ''}`;
  }).join('\n');

  await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x1db954).setTitle('🏆 Game Over!').setDescription(`**Final Leaderboard**\n\n${leaderboard || 'No one scored any points!'}`).setFooter({ text: 'Thanks for playing!' }).setTimestamp()] });
  await stopGame(interaction.guild.id);
}

function formatDuration(ms) {
  if (!ms || ms === 0) return 'Live';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

module.exports.activeGames = activeGames;
module.exports.stopGame = stopGame;
module.exports.revealAnswer = revealAnswer;
module.exports.nextRound = nextRound;
module.exports.endGame = endGame;
