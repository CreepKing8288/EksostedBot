const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
    let deferred = false;
    try {
      await interaction.deferReply();
      deferred = true;
    } catch {}

    const client = interaction.client;
    const query = interaction.options.getString('query');
    const member = interaction.member;

    if (!member.voice.channel) {
      return reply(interaction, deferred, { content: '❌ You need to join a voice channel first!' });
    }

    const botMember = interaction.guild.members.cache.get(client.user.id);
    if (botMember.voice.channel && botMember.voice.channelId !== member.voice.channelId) {
      return reply(interaction, deferred, { content: '❌ You must be in the same voice channel as me!' });
    }

    const { getPlayerInstance } = require('../../utils/musicPlayer');
    const player = getPlayerInstance(client);

    let searchResult;
    try {
      searchResult = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: query.startsWith('http') ? null : 'ytsearch',
      });

      if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
        return reply(interaction, deferred, { content: '❌ No results found! Try a different search term.' });
      }
    } catch (err) {
      console.error('[play] Search error:', err.message);
      return reply(interaction, deferred, { content: `❌ Search failed: ${err.message}` });
    }

    try {
      let queue = player.queues.get(interaction.guild.id);

      if (!queue) {
        queue = player.queues.create(interaction.guild.id, {
          metadata: { channel: interaction.channel, client: interaction.guild.members.me, requestedBy: interaction.user },
          selfDeaf: true,
        });
      }

      if (searchResult.playlist) {
        queue.addTrack(searchResult.tracks);
        const totalDuration = searchResult.tracks.reduce((acc, t) => acc + (t.durationMS || 0), 0);

        const playlistEmbed = new EmbedBuilder()
          .setColor('#1DB954')
          .setAuthor({ name: 'Added Playlist 🎧', iconURL: client.user.displayAvatarURL() })
          .setTitle(searchResult.playlist.title)
          .setURL(searchResult.playlist.url || searchResult.tracks[0].url)
          .setThumbnail(searchResult.tracks[0].thumbnail)
          .setDescription(`Added \`${searchResult.tracks.length}\` tracks to the queue.`)
          .addFields(
            { name: '⌛ Total Duration', value: `\`${formatDuration(totalDuration)}\``, inline: true },
            { name: '🎧 Now Playing', value: queue.currentTrack ? `\`${queue.currentTrack.title}\`` : '`Starting...**', inline: true }
          )
          .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        if (!queue.isPlaying()) {
          await safeConnect(queue, member.voice.channel);
          await safePlay(queue);
        }

        return reply(interaction, deferred, { embeds: [playlistEmbed] });
      } else {
        const track = searchResult.tracks[0];
        queue.addTrack(track);

        const trackEmbed = new EmbedBuilder()
          .setColor('#DDA0DD')
          .setAuthor({ name: 'Added to Queue 🎵', iconURL: client.user.displayAvatarURL() })
          .setTitle(track.title)
          .setURL(track.url)
          .setThumbnail(track.thumbnail)
          .addFields(
            { name: '👤 Artist', value: `\`${track.author || track.artist || 'Unknown'}\``, inline: true },
            { name: '⌛ Duration', value: `\`${formatDuration(track.durationMS)}\``, inline: true },
            { name: '🎧 Position in Queue', value: `\`#${queue.tracks.size}\``, inline: true }
          )
          .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        if (!queue.isPlaying()) {
          await safeConnect(queue, member.voice.channel);
          await safePlay(queue);
        }

        return reply(interaction, deferred, { embeds: [trackEmbed] });
      }
    } catch (err) {
      console.error('[play] Queue error:', err.message);
      return reply(interaction, deferred, { content: `❌ Failed to play: ${err.message}` });
    }
  },
};

function reply(interaction, deferred, payload) {
  if (deferred) {
    return interaction.editReply(payload).catch(() => {});
  }
  return interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
}

async function safeConnect(queue, channel) {
  if (queue.node?.connect) return queue.node.connect(channel.id);
  if (queue.connect) return queue.connect(channel.id);
}

async function safePlay(queue) {
  if (queue.node?.play) return queue.node.play();
  if (queue.play) return queue.play();
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
