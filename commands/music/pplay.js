const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatTime } = require('../../utils/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pplay')
    .setDescription('Play a Spotify playlist.')
    .addStringOption((option) =>
      option
        .setName('link')
        .setDescription('Spotify playlist URL or search query.')
        .setRequired(true)
    ),

  async execute(interaction) {
    const client = interaction.client;
    const query = interaction.options.getString('link');
    const member = interaction.member;

    if (!member.voice.channel) {
      return interaction.reply({
        content: '❌ You need to join a voice channel first!',
        ephemeral: true,
      });
    }

    const botMember = interaction.guild.members.cache.get(client.user.id);
    if (botMember.voice.channel && botMember.voice.channelId !== member.voice.channelId) {
      return interaction.reply({
        content: '❌ You must be in the same voice channel as me!',
        ephemeral: true,
      });
    }

    let player = client.lavalink.players.get(interaction.guild.id);
    if (!player) {
      player = client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: member.voice.channel.id,
        textChannelId: interaction.channel.id,
        selfDeaf: true,
      });
    }
    await player.connect();

    await interaction.deferReply();

    const isSpotifyUrl = query.startsWith('https://open.spotify.com/playlist/');
    const search = await player.search(
      { query, source: isSpotifyUrl ? undefined : 'spsearch' }
    );

    if (!search?.tracks?.length) {
      return interaction.editReply({
        content: '❌ No results found! Make sure the link is a valid Spotify playlist.',
        ephemeral: true,
      });
    }

    if (search.loadType !== 'playlist') {
      return interaction.editReply({
        content: '❌ No playlist found. Please provide a valid Spotify playlist URL.',
        ephemeral: true,
      });
    }

    const addedTracks = [];
    for (const track of search.tracks) {
      track.userData = { requester: interaction.member };
      await player.queue.add(track);
      addedTracks.push(track);
    }

    const totalDuration = addedTracks.reduce((acc, track) => acc + track.info.duration, 0);

    const playlistEmbed = new EmbedBuilder()
      .setColor('#1DB954')
      .setAuthor({
        name: 'Added Spotify Playlist 🎧',
        iconURL: client.user.displayAvatarURL(),
      })
      .setTitle(search.playlist?.title || 'Unknown Playlist')
      .setURL(query.startsWith('http') ? query : null)
      .setThumbnail(addedTracks[0]?.info.artworkUrl || null)
      .setDescription(
        `Added \`${addedTracks.length}\` tracks to the queue.`
      )
      .addFields(
        {
          name: '👤 Author',
          value: `\`${addedTracks[0]?.info.author || 'Unknown'}\``,
          inline: true,
        },
        {
          name: '⌛ Total Duration',
          value: `\`${formatTime(totalDuration)}\``,
          inline: true,
        },
        {
          name: '🎧 Queue Position',
          value: `\`#${player.queue.tracks.length - addedTracks.length + 1}\``,
          inline: true,
        }
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    if (!player.playing) {
      await player.play();
    }

    return interaction.editReply({ embeds: [playlistEmbed] });
  },
};
