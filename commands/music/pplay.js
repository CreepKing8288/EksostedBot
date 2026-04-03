const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatTime } = require('../../utils/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pplay')
    .setDescription('Play a Spotify playlist.')
    .addStringOption((option) =>
      option.setName('link').setDescription('Spotify playlist URL.').setRequired(true)
    ),

  async execute(interaction) {
    const client = interaction.client;
    const query = interaction.options.getString('link');
    const member = interaction.member;

    if (!member.voice.channel) {
      return interaction.reply({ content: '❌ You need to join a voice channel first!', ephemeral: true });
    }

    const botMember = interaction.guild.members.cache.get(client.user.id);
    if (botMember.voice.channel && botMember.voice.channelId !== member.voice.channelId) {
      return interaction.reply({ content: '❌ You must be in the same voice channel as me!', ephemeral: true });
    }

    await interaction.deferReply();

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

    const search = await player.search({ query });

    if (!search?.tracks?.length) {
      return interaction.editReply({ content: '❌ No results found. Make sure the URL is valid and your Lavalink server has Spotify support.', ephemeral: true });
    }

    if (search.loadType !== 'playlist') {
      return interaction.editReply({ content: '❌ No playlist found. Please provide a valid Spotify playlist URL.', ephemeral: true });
    }

    for (const track of search.tracks) {
      track.userData = { requester: interaction.member };
      await player.queue.add(track);
    }

    const totalDuration = search.tracks.reduce((acc, track) => acc + track.info.duration, 0);

    const playlistEmbed = new EmbedBuilder()
      .setColor('#1DB954')
      .setAuthor({ name: 'Added Spotify Playlist 🎧', iconURL: client.user.displayAvatarURL() })
      .setTitle(search.playlist?.title)
      .setURL(query)
      .setThumbnail(search.tracks[0].info.artworkUrl)
      .setDescription(`Added \`${search.tracks.length}\` tracks to the queue.`)
      .addFields(
        { name: '👤 Author', value: `\`${search.tracks[0].info.author}\``, inline: true },
        { name: '⌛ Total Duration', value: `\`${formatTime(totalDuration)}\``, inline: true },
        { name: '🎧 Now Playing', value: `\`${search.tracks[0].info.title}\``, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    if (!player.playing) await player.play();

    return interaction.editReply({ embeds: [playlistEmbed] });
  },
};
