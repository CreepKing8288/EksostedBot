const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatTime } = require('../../utils/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the queue.')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Song name or URL')
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

    const search = await player.search({ query, source: query.startsWith('http') ? undefined : 'spsearch' });

    if (!search?.tracks?.length) {
      return interaction.editReply({ content: '❌ No results found! Try a different search term.', ephemeral: true });
    }

    if (search.loadType === 'playlist') {
      for (const track of search.tracks) {
        track.userData = { requester: interaction.member };
        await player.queue.add(track);
      }

      const playlistEmbed = new EmbedBuilder()
        .setColor('#DDA0DD')
        .setAuthor({ name: 'Added Playlist to Queue 📃', iconURL: client.user.displayAvatarURL() })
        .setTitle(search.playlist?.title)
        .setThumbnail(search.tracks[0].info.artworkUrl)
        .setDescription(
          `Added \`${search.tracks.length}\` tracks from playlist\n\n` +
          `**First Track:** [${search.tracks[0].info.title}](${search.tracks[0].info.uri})\n` +
          `**Last Track:** [${search.tracks[search.tracks.length - 1].info.title}](${search.tracks[search.tracks.length - 1].info.uri})`
        )
        .addFields(
          { name: '👤 Playlist Author', value: `\`${search.tracks[0].info.author}\``, inline: true },
          { name: '⌛ Total Duration', value: `\`${formatTime(search.tracks.reduce((acc, track) => acc + track.info.duration, 0))}\``, inline: true }
        )
        .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      if (!player.playing) await player.play();

      return interaction.editReply({ embeds: [playlistEmbed] });
    } else {
      const track = search.tracks[0];
      track.userData = { requester: interaction.member };
      await player.queue.add(track);

      const trackEmbed = new EmbedBuilder()
        .setColor('#DDA0DD')
        .setAuthor({ name: 'Added to Queue 🎵', iconURL: client.user.displayAvatarURL() })
        .setTitle(track.info.title)
        .setURL(track.info.uri)
        .setThumbnail(track.info.artworkUrl)
        .addFields(
          { name: '👤 Artist', value: `\`${track.info.author}\``, inline: true },
          { name: '⌛ Duration', value: `\`${formatTime(track.info.duration)}\``, inline: true },
          { name: '🎧 Position in Queue', value: `\`#${player.queue.tracks.length}\``, inline: true }
        )
        .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      if (!player.playing) await player.play();

      return interaction.editReply({ embeds: [trackEmbed] });
    }
  },
};
