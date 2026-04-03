const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ytSearch = require('yt-search');
const { getSpotifyPlaylist, searchYouTube } = require('../../utils/spotify');
const { addToQueue, joinVoice, getNowPlaying, getQueueInfo } = require('../../utils/musicPlayer');

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

    if (query.startsWith('https://open.spotify.com/playlist/')) {
      return await handleSpotifyPlaylist(interaction, client, query, member);
    }

    if (query.startsWith('https://open.spotify.com/track/')) {
      return await handleSpotifyTrack(interaction, client, query, member);
    }

    let searchResult;
    try {
      const r = await ytSearch(query);
      if (r.videos.length) {
        searchResult = {
          title: r.videos[0].title,
          url: r.videos[0].url,
          duration: r.videos[0].seconds * 1000,
          thumbnail: r.videos[0].thumbnail,
          author: r.videos[0].author.name,
        };
      }
    } catch {
      searchResult = null;
    }

    if (!searchResult) {
      return interaction.editReply({ content: '❌ No results found! Try a different search term.', ephemeral: true });
    }

    joinVoice(interaction.guild.id, member.voice.channel);
    addToQueue(interaction.guild.id, { ...searchResult, requester: interaction.member }, interaction.channel);

    const queueInfo = getQueueInfo(interaction.guild.id);

    const trackEmbed = new EmbedBuilder()
      .setColor('#DDA0DD')
      .setAuthor({ name: 'Added to Queue 🎵', iconURL: client.user.displayAvatarURL() })
      .setTitle(searchResult.title)
      .setURL(searchResult.url)
      .setThumbnail(searchResult.thumbnail)
      .addFields(
        { name: '👤 Artist', value: `\`${searchResult.author}\``, inline: true },
        { name: '⌛ Duration', value: `\`${formatDuration(searchResult.duration)}\``, inline: true },
        { name: '🎧 Position in Queue', value: `\`#${queueInfo.length}\``, inline: true }
      )
      .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    return interaction.editReply({ embeds: [trackEmbed] });
  },
};

async function handleSpotifyPlaylist(interaction, client, query, member) {
  let playlist;
  try {
    playlist = await getSpotifyPlaylist(query);
  } catch (err) {
    console.error('[play] Spotify error:', err.message);
    return interaction.editReply({ content: '❌ Failed to fetch the playlist. Make sure the URL is valid and the playlist is public.', ephemeral: true });
  }

  if (!playlist.tracks.length) {
    return interaction.editReply({ content: '❌ This playlist is empty.', ephemeral: true });
  }

  joinVoice(interaction.guild.id, member.voice.channel);

  const statusMsg = await interaction.editReply({ content: `🔍 Resolving ${playlist.tracks.length} tracks from Spotify...` });

  const addedTracks = [];
  for (let i = 0; i < playlist.tracks.length; i++) {
    const track = playlist.tracks[i];
    const ytResult = await searchYouTube(`${track.title} - ${track.artist}`);
    if (ytResult) {
      addedTracks.push({
        title: track.title,
        artist: track.artist,
        url: ytResult.url,
        duration: ytResult.duration,
        thumbnail: track.thumbnail || ytResult.thumbnail,
        requester: interaction.member,
      });
      if ((i + 1) % 5 === 0) {
        await statusMsg.edit({ content: `🔍 Resolved ${i + 1}/${playlist.tracks.length} tracks...` }).catch(() => {});
      }
    }
  }

  if (!addedTracks.length) {
    return interaction.editReply({ content: '❌ Could not find any of the playlist tracks on YouTube.', ephemeral: true });
  }

  for (const track of addedTracks) {
    addToQueue(interaction.guild.id, track, interaction.channel);
  }

  const totalDuration = addedTracks.reduce((acc, t) => acc + t.duration, 0);

  const playlistEmbed = new EmbedBuilder()
    .setColor('#1DB954')
    .setAuthor({ name: 'Added Spotify Playlist 🎧', iconURL: client.user.displayAvatarURL() })
    .setTitle(playlist.name)
    .setURL(playlist.uri)
    .setThumbnail(playlist.thumbnail || addedTracks[0].thumbnail)
    .setDescription(`Added \`${addedTracks.length}\` tracks to the queue.`)
    .addFields(
      { name: '👤 Author', value: `\`${playlist.owner}\``, inline: true },
      { name: '⌛ Total Duration', value: `\`${formatDuration(totalDuration)}\``, inline: true },
      { name: '🎧 Now Playing', value: `\`${getNowPlaying(interaction.guild.id)?.title || 'Loading...'}\``, inline: true }
    )
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  return interaction.editReply({ embeds: [playlistEmbed] });
}

async function handleSpotifyTrack(interaction, client, query, member) {
  let trackInfo;
  try {
    const { getSpotifyTrack } = require('../../utils/spotify');
    trackInfo = await getSpotifyTrack(query);
  } catch (err) {
    console.error('[play] Spotify track error:', err.message);
    return interaction.editReply({ content: '❌ Failed to fetch the Spotify track. Make sure the URL is valid.', ephemeral: true });
  }

  const ytResult = await searchYouTube(`${trackInfo.title} - ${trackInfo.artist}`);
  if (!ytResult) {
    return interaction.editReply({ content: '❌ Could not find this track on YouTube.', ephemeral: true });
  }

  joinVoice(interaction.guild.id, member.voice.channel);
  addToQueue(interaction.guild.id, {
    title: trackInfo.title,
    artist: trackInfo.artist,
    url: ytResult.url,
    duration: ytResult.duration,
    thumbnail: trackInfo.thumbnail || ytResult.thumbnail,
    requester: interaction.member,
  }, interaction.channel);

  const queueInfo = getQueueInfo(interaction.guild.id);

  const trackEmbed = new EmbedBuilder()
    .setColor('#1DB954')
    .setAuthor({ name: 'Added Spotify Track 🎵', iconURL: client.user.displayAvatarURL() })
    .setTitle(trackInfo.title)
    .setURL(query)
    .setThumbnail(trackInfo.thumbnail || ytResult.thumbnail)
    .addFields(
      { name: '👤 Artist', value: `\`${trackInfo.artist}\``, inline: true },
      { name: '⌛ Duration', value: `\`${formatDuration(ytResult.duration)}\``, inline: true },
      { name: '🎧 Position in Queue', value: `\`#${queueInfo.length}\``, inline: true }
    )
    .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  return interaction.editReply({ embeds: [trackEmbed] });
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
