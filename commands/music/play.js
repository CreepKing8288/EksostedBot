const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatTime } = require('../../utils/utils');
const spotify = require('../../utils/spotify');

const autocompleteMap = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist from different Sources')

    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Song name or URL')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('source')
        .setDescription('The source you want to play the music from')
        .addChoices(
          { name: 'Youtube', value: 'ytsearch' },
          { name: 'Youtube Music', value: 'ytmsearch' },
          { name: 'Spotify', value: 'spsearch' },
          { name: 'Soundcloud', value: 'scsearch' },
          { name: 'Deezer', value: 'dzsearch' }
        )
    ),

  async autocomplete(interaction) {
    try {
      const query = interaction.options.getFocused();
      const member = interaction.member;
      if (!member.voice.channel) {
        return await interaction.respond([
          {
            name: '⚠️ Join a voice channel first!',
            value: 'join_vc',
          },
        ]);
      }
      if (!query.trim()) {
        return await interaction.respond([
          {
            name: 'Start typing to search for songs...',
            value: 'start_typing',
          },
        ]);
      }

      const source = interaction.options.getString('source') || 'spsearch';

      if (source === 'spsearch') {
        const spotifyResults = await spotify.searchSpotifyTracks(query, 25);
        if (!spotifyResults.length) {
          return await interaction.respond([
            { name: 'No results found', value: 'no_results' },
          ]);
        }

        return await interaction.respond(
          spotifyResults.map((track) => ({
            name: `${track.name} - ${track.artists.map((a) => a.name).join(', ')}`,
            value: track.external_urls.spotify,
          }))
        );
      }

      player = interaction.client.lavalink.createPlayer({
        guildId: interaction.guildId,
        textChannelId: interaction.channelId,
        voiceChannelId: interaction.member.voice.channel.id,
        selfDeaf: true,
      });

      try {
        const results = await player.search({ query, source });

        if (!results?.tracks?.length) {
          return await interaction.respond([
            { name: 'No results found', value: 'no_results' },
          ]);
        }

        let options = [];

        if (results.loadType === 'playlist') {
          options = [
            {
              name: `📑 Playlist: ${results.playlist?.title || 'Unknown'} (${results.tracks.length} tracks)`,
              value: `${query}`,
            },
          ];
        } else {
          options = results.tracks.slice(0, 25).map((track) => ({
            name: `${track.info.title} - ${track.info.author}`,
            value: track.info.uri,
          }));
        }

        return await interaction.respond(options);
      } catch (searchError) {
        console.error('Search error:', searchError);
        return await interaction.respond([
          { name: 'Error searching for tracks', value: 'error' },
        ]);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      return await interaction.respond([
        { name: 'An error occurred', value: 'error' },
      ]);
    }
  },

  async execute(interaction) {
    const client = interaction.client;
    const query = interaction.options.getString('query');
    const member = interaction.member;
    const source = interaction.options.getString('source') || 'spsearch';

    if (query === 'join_vc' || query === 'start_typing' || query === 'error') {
      return interaction.reply({
        content: '❌ Please join a voice channel and select a valid song!',
        ephemeral: true,
      });
    }

    if (query === 'no_results') {
      return interaction.reply({
        content: '❌ No results found! Try a different search term.',
        ephemeral: true,
      });
    }

    if (!member.voice.channel) {
      return interaction.reply({
        content: '❌ You need to join a voice channel first!',
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

    let search;

    if (source === 'spsearch') {
      const spotifyLink = spotify.parseSpotifyLink(query);

      if (spotifyLink?.type === 'playlist') {
        const spotifyTracks = await spotify.getSpotifyPlaylistTracks(
          spotifyLink.id,
          100
        );

        if (!spotifyTracks.length) {
          return interaction.editReply({
            content: '❌ No playlist was found on Spotify for that link.',
            ephemeral: true,
          });
        }

        let addedCount = 0;
        let firstArtwork = null;

        for (const spotifyTrack of spotifyTracks) {
          const spotifySearch = await player.search({
            query: spotify.buildSpotifyTrackQuery(spotifyTrack),
            source: 'ytsearch',
          });

          if (!spotifySearch?.tracks?.length) {
            continue;
          }

          const lavalinkTrack = spotifySearch.tracks[0];
          if (!firstArtwork) {
            firstArtwork = lavalinkTrack.info.artworkUrl;
          }

          lavalinkTrack.userData = { requester: interaction.member };
          await player.queue.add(lavalinkTrack);
          addedCount += 1;
        }

        if (!addedCount) {
          return interaction.editReply({
            content:
              '❌ Spotify playlist was found, but no playable tracks could be loaded.',
            ephemeral: true,
          });
        }

        const playlistEmbed = new EmbedBuilder()
          .setColor('#DDA0DD')
          .setAuthor({
            name: 'Added Spotify Playlist to Queue 📃',
            iconURL: client.user.displayAvatarURL(),
          })
          .setTitle('Spotify Playlist Added')
          .setThumbnail(firstArtwork || client.user.displayAvatarURL())
          .setDescription(`Added \`${addedCount}\` tracks from the Spotify playlist.`)
          .addFields([
            {
              name: '🎵 Tracks Added',
              value: `${addedCount} tracks successfully queued`,
              inline: true,
            },
          ])
          .setFooter({
            text: `Added by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTimestamp();

        if (!player.playing) {
          await player.play();
        }

        return interaction.editReply({ embeds: [playlistEmbed] });
      }

      if (spotifyLink?.type === 'track') {
        const spotifyTrack = await spotify.getSpotifyTrack(spotifyLink.id);
        search = await player.search({
          query: spotify.buildSpotifyTrackQuery(spotifyTrack),
          source: 'ytsearch',
        });
      } else {
        const spotifyResults = await spotify.searchSpotifyTracks(query, 1);
        if (!spotifyResults.length) {
          return interaction.editReply({
            content: '❌ No results found! Try a different search term.',
            ephemeral: true,
          });
        }

        search = await player.search({
          query: spotify.buildSpotifyTrackQuery(spotifyResults[0]),
          source: 'ytsearch',
        });
      }
    } else {
      if (query.startsWith('playlist_')) {
        const actualQuery = query.replace('playlist_', '');
        search = await player.search({ query: actualQuery, source });
      } else {
        search = await player.search({ query, source });
      }
    }

    if (!search?.tracks?.length) {
      return interaction.editReply({
        content: '❌ No results found! Try a different search term.',
        ephemeral: true,
      });
    }

    if (search.loadType === 'playlist') {
      for (const track of search.tracks) {
        track.userData = { requester: interaction.member };
        await player.queue.add(track);
      }

      const playlistEmbed = new EmbedBuilder()
        .setColor('#DDA0DD')
        .setAuthor({
          name: 'Added Playlist to Queue 📃',
          iconURL: client.user.displayAvatarURL(),
        })
        .setTitle(search.playlist?.title)
        .setThumbnail(search.tracks[0].info.artworkUrl)
        .setDescription(
          `Added \`${search.tracks.length}\` tracks from playlist\n\n` +
            `**First Track:** [${search.tracks[0].info.title}](${search.tracks[0].info.uri})\n` +
            `**Last Track:** [${search.tracks[search.tracks.length - 1].info.title}](${search.tracks[search.tracks.length - 1].info.uri})`
        )
        .addFields([
          {
            name: '👤 Playlist Author',
            value: `\`${search.tracks[0].info.author}\``,
            inline: true,
          },
          {
            name: '⌛ Total Duration',
            value: `\`${formatTime(search.tracks.reduce((acc, track) => acc + track.info.duration, 0))}\``,
            inline: true,
          },
        ])
        .setFooter({
          text: `Added by ${interaction.user.tag} • Queue position: #${player.queue.tracks.length - search.tracks.length + 1}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      if (!player.playing) {
        await player.play();
      }

      return interaction.editReply({ embeds: [playlistEmbed] });
    } else {
      const track = search.tracks[0];
      track.userData = { requester: interaction.member };
      await player.queue.add(track);

      const trackEmbed = new EmbedBuilder()
        .setColor('#DDA0DD')
        .setAuthor({
          name: 'Added to Queue 🎵',
          iconURL: client.user.displayAvatarURL(),
        })
        .setTitle(track.info.title)
        .setURL(track.info.uri)
        .setThumbnail(track.info.artworkUrl)
        .addFields([
          {
            name: '👤 Artist',
            value: `\`${track.info.author}\``,
            inline: true,
          },
          {
            name: '⌛ Duration',
            value: `\`${formatTime(track.info.duration)}\``,
            inline: true,
          },
          {
            name: '🎧 Position in Queue',
            value: `\`#${player.queue.tracks.length}\``,
            inline: true,
          },
        ])
        .setFooter({
          text: `Added by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      if (!player.playing) {
        await player.play();
      }

      return interaction.editReply({ embeds: [trackEmbed] });
    }
  },
};
