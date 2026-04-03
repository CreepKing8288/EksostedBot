const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addToQueue, joinVoice, getNowPlaying, getQueueInfo } = require('../../utils/musicPlayer');

let playerInstance = null;

function getPlayer(client) {
  if (!playerInstance) {
    const { Player } = require('discord-player');
    const { SpotifyExtractor, DefaultExtractors } = require('@discord-player/extractor');
    playerInstance = new Player(client, {
      ytdlOptions: { quality: 'highestaudio', highWaterMark: 1 << 25 },
    });
    playerInstance.extractors.register(SpotifyExtractor, {});
    playerInstance.extractors.loadMulti(DefaultExtractors);
  }
  return playerInstance;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song, Spotify track/playlist, or add to queue.')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Song name, YouTube URL, or Spotify URL')
        .setRequired(true)
    ),

  async execute(interaction) {
    const client = interaction.client;
    const query = interaction.options.getString('query');
    const member = interaction.member;

    if (!member.voice.channel) {
      return interaction.reply({ content: '❌ You need to join a voice channel first!', ephemeral: true });
    }

    const botMember = interaction.guild.members.cache.get(client.user.id);
    if (botMember.voice.channel && botMember.voice.channelId !== member.voice.channelId) {
      return interaction.reply({ content: '❌ You must be in the same voice channel as me!', ephemeral: true });
    }

    await interaction.deferReply();

    const player = getPlayer(client);

    let searchResult;
    try {
      searchResult = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: query.startsWith('http') ? null : 'ytsearch',
      });

      if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
        return interaction.editReply({ content: '❌ No results found! Try a different search term.', ephemeral: true });
      }
    } catch (err) {
      console.error('[play] Search error:', err.message);
      return interaction.editReply({ content: `❌ Search failed: ${err.message}`, ephemeral: true });
    }

    joinVoice(interaction.guild.id, member.voice.channel);

    if (searchResult.playlist) {
      const addedTracks = [];
      for (const track of searchResult.tracks) {
        const streamFn = typeof track.stream === 'function' ? track.stream.bind(track) : null;
        if (streamFn) {
          addedTracks.push({
            title: track.title,
            url: track.url,
            duration: track.durationMS || track.duration * 1000,
            thumbnail: track.thumbnail || null,
            artist: track.author || track.artist || 'Unknown',
            requester: interaction.member,
            stream: streamFn,
          });
        }
      }

      if (addedTracks.length === 0) {
        return interaction.editReply({ content: '❌ Could not resolve any playable tracks.', ephemeral: true });
      }

      for (const track of addedTracks) {
        addToQueue(interaction.guild.id, track, interaction.channel);
      }

      const totalDuration = addedTracks.reduce((acc, t) => acc + t.duration, 0);

      const playlistEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setAuthor({ name: 'Added Playlist 🎧', iconURL: client.user.displayAvatarURL() })
        .setTitle(searchResult.playlist.title)
        .setURL(searchResult.playlist.url || addedTracks[0].url)
        .setThumbnail(addedTracks[0].thumbnail)
        .setDescription(`Added \`${addedTracks.length}\` tracks to the queue.`)
        .addFields(
          { name: '⌛ Total Duration', value: `\`${formatDuration(totalDuration)}\``, inline: true },
          { name: '🎧 Now Playing', value: `\`${getNowPlaying(interaction.guild.id)?.title || 'Loading...'}\``, inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      return interaction.editReply({ embeds: [playlistEmbed] });
    } else {
      const track = searchResult.tracks[0];
      const streamFn = typeof track.stream === 'function' ? track.stream.bind(track) : null;

      if (!streamFn) {
        return interaction.editReply({ content: '❌ Could not resolve a playable stream for this track.', ephemeral: true });
      }

      addToQueue(interaction.guild.id, {
        title: track.title,
        url: track.url,
        duration: track.durationMS || track.duration * 1000,
        thumbnail: track.thumbnail || null,
        artist: track.author || track.artist || 'Unknown',
        requester: interaction.member,
        stream: streamFn,
      }, interaction.channel);

      const queueInfo = getQueueInfo(interaction.guild.id);

      const trackEmbed = new EmbedBuilder()
        .setColor('#DDA0DD')
        .setAuthor({ name: 'Added to Queue 🎵', iconURL: client.user.displayAvatarURL() })
        .setTitle(track.title)
        .setURL(track.url)
        .setThumbnail(track.thumbnail)
        .addFields(
          { name: '👤 Artist', value: `\`${track.author || track.artist || 'Unknown'}\``, inline: true },
          { name: '⌛ Duration', value: `\`${formatDuration(track.durationMS || track.duration * 1000)}\``, inline: true },
          { name: '🎧 Position in Queue', value: `\`#${queueInfo.length}\``, inline: true }
        )
        .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      return interaction.editReply({ embeds: [trackEmbed] });
    }
  },
};

function formatDuration(ms) {
  if (!ms || ms === 0) return 'Live';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
