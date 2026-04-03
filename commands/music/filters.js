const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, getNowPlaying } = require('../../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filters')
    .setDescription('Adjust audio settings for the current song')
    .addStringOption((option) =>
      option
        .setName('filter')
        .setDescription('Select a filter to toggle')
        .setRequired(true)
        .addChoices(
          { name: '🎚️ Volume Boost', value: 'volume' },
          { name: '🔇 Bass Boost', value: 'bass' },
          { name: '🎧 Nightcore', value: 'nightcore' }
        )
    )
    .addNumberOption((option) =>
      option
        .setName('value')
        .setDescription('Value for the filter')
        .setMinValue(0)
        .setMaxValue(2)
    ),

  async execute(interaction) {
    if (!interaction.member.voice.channel) {
      return interaction.reply({ content: '❌ You need to join a voice channel first!', ephemeral: true });
    }

    const nowPlaying = getNowPlaying(interaction.guild.id);
    if (!nowPlaying) {
      return interaction.reply({ content: '❌ There is no music playing!', ephemeral: true });
    }

    await interaction.deferReply();
    const filter = interaction.options.getString('filter');
    let description = '';

    try {
      const player = getPlayer(interaction.guild.id);
      const resource = player.state.resource;

      switch (filter) {
        case 'volume': {
          const volumeValue = interaction.options.getNumber('value');
          if (resource) {
            if (volumeValue) {
              resource.volume.setVolume(volumeValue);
              description = `🎚️ Volume set to ${Math.round(volumeValue * 100)}%`;
            } else {
              resource.volume.setVolume(1);
              description = '🎚️ Volume reset to 100%';
            }
          } else {
            description = '⚠️ No active stream to adjust volume.';
          }
          break;
        }

        case 'bass': {
          if (resource) {
            const current = resource.volume.volume || 1;
            if (current > 1.1) {
              resource.volume.setVolume(1);
              description = '🔇 Bass boost disabled';
            } else {
              resource.volume.setVolume(1.5);
              description = '🔇 Bass boost enabled (150%)';
            }
          } else {
            description = '⚠️ No active stream.';
          }
          break;
        }

        case 'nightcore': {
          description = '🌙 Nightcore filter is not available without Lavalink. Use a speed-adjusted source instead.';
          break;
        }

        default:
          description = '❌ Unknown filter.';
      }

      const embed = new EmbedBuilder()
        .setColor('#DDA0DD')
        .setTitle('🎵 Filter Manager')
        .setDescription(description)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error applying filter:', error);
      await interaction.editReply({ content: '❌ An error occurred while applying the filter.', ephemeral: true });
    }
  },
};
