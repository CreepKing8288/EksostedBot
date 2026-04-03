const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const FILTER_NAMES = {
  nightcore: '🌙 Nightcore',
  vaporwave: '🌊 Vaporwave',
  lowPass: '⬇️ Lowpass',
  karaoke: '🎤 Karaoke',
  rotation: '🔄 Rotation',
  tremolo: '〰️ Tremolo',
  vibrato: '📳 Vibrato',
  timescale: { speed: '⚡ Speed', pitch: '🎼 Pitch', rate: '⏱️ Rate' },
  volume: '🎚️ Volume',
  equalizer: '🎛️ Bass',
  rock: '🎸 Rock',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filters')
    .setDescription('Toggle audio filters for the current song')
    .addStringOption((option) =>
      option.setName('filter').setDescription('Select a filter to toggle').setRequired(true)
        .addChoices(
          { name: '🔄 Clear', value: 'clear' },
          { name: '🌙 Nightcore', value: 'nightcore' },
          { name: '🌊 Vaporwave', value: 'vaporwave' },
          { name: '⬇️ Lowpass', value: 'lowpass' },
          { name: '🎤 Karaoke', value: 'karaoke' },
          { name: '🔄 Rotation', value: 'rotation' },
          { name: '〰️ Tremolo', value: 'tremolo' },
          { name: '📳 Vibrato', value: 'vibrato' },
          { name: '⚡ Speed', value: 'speed' },
          { name: '🎼 Pitch', value: 'pitch' },
          { name: '⏱️ Rate', value: 'rate' },
          { name: '🎚️ Volume', value: 'volume' },
          { name: '🎛️ Bass', value: 'bass' },
          { name: '🎧 8D', value: '8d' },
          { name: '🎸 Rock', value: 'rock' }
        )
    )
    .addNumberOption((option) =>
      option.setName('value').setDescription('Value for the filter (only for speed, pitch, rate, volume, bass)').setMinValue(0).setMaxValue(5)
    ),

  async execute(interaction) {
    if (!interaction.member.voice.channel) {
      return interaction.reply({ content: '❌ You need to join a voice channel first!', ephemeral: true });
    }

    const player = interaction.client.lavalink.players.get(interaction.guild.id);
    if (!player) {
      return interaction.reply({ content: '❌ There is no music playing!', ephemeral: true });
    }

    if (player.voiceChannelId !== interaction.member.voice.channelId) {
      return interaction.reply({ content: '❌ You need to be in the same voice channel as me!', ephemeral: true });
    }

    await interaction.deferReply();
    const filter = interaction.options.getString('filter');
    let description = '';

    try {
      switch (filter) {
        case 'clear':
          await player.filterManager.resetFilters();
          description = '🔄 Disabled all filters';
          break;
        case 'nightcore':
          await player.filterManager.toggleNightcore();
          description = player.filterManager.filters.nightcore ? '🌙 Applied Nightcore filter' : '🌙 Disabled Nightcore filter';
          break;
        case 'vaporwave':
          await player.filterManager.toggleVaporwave();
          description = player.filterManager.filters.vaporwave ? '🌊 Applied Vaporwave filter' : '🌊 Disabled Vaporwave filter';
          break;
        case 'lowpass':
          await player.filterManager.toggleLowPass();
          description = player.filterManager.filters.lowPass ? '⬇️ Applied Lowpass filter' : '⬇️ Disabled Lowpass filter';
          break;
        case 'karaoke':
          await player.filterManager.toggleKaraoke();
          description = player.filterManager.filters.karaoke ? '🎤 Applied Karaoke filter' : '🎤 Disabled Karaoke filter';
          break;
        case 'rotation':
          await player.filterManager.toggleRotation();
          description = player.filterManager.filters.rotation ? '🔄 Applied Rotation filter' : '🔄 Disabled Rotation filter';
          break;
        case 'tremolo':
          await player.filterManager.toggleTremolo();
          description = player.filterManager.filters.tremolo ? '〰️ Applied Tremolo filter' : '〰️ Disabled Tremolo filter';
          break;
        case 'vibrato':
          await player.filterManager.toggleVibrato();
          description = player.filterManager.filters.vibrato ? '📳 Applied Vibrato filter' : '📳 Disabled Vibrato filter';
          break;
        case 'speed': {
          const speedValue = interaction.options.getNumber('value');
          if (speedValue) {
            const speed = Math.max(0.5, Math.min(3, speedValue));
            await player.filterManager.setSpeed(speed);
            description = `⚡ Applied Speed filter (${speed}x)`;
          } else if (player.filterManager.filters.timescale?.speed !== 1) {
            await player.filterManager.setSpeed(1);
            description = '⚡ Disabled Speed filter';
          } else {
            await player.filterManager.setSpeed(1.5);
            description = '⚡ Applied Speed filter (1.5x)';
          }
          break;
        }
        case 'pitch': {
          const pitchValue = interaction.options.getNumber('value');
          if (pitchValue) {
            const pitch = Math.max(0.5, Math.min(2, pitchValue));
            await player.filterManager.setPitch(pitch);
            description = `🎼 Applied Pitch filter (${pitch}x)`;
          } else if (player.filterManager.filters.timescale?.pitch !== 1) {
            await player.filterManager.setPitch(1);
            description = '🎼 Disabled Pitch filter';
          } else {
            await player.filterManager.setPitch(1.2);
            description = '🎼 Applied Pitch filter (1.2x)';
          }
          break;
        }
        case 'rate': {
          const rateValue = interaction.options.getNumber('value');
          if (rateValue) {
            const rate = Math.max(0.5, Math.min(2, rateValue));
            await player.filterManager.setRate(rate);
            description = `⏱️ Applied Rate filter (${rate}x)`;
          } else if (player.filterManager.filters.timescale?.rate !== 1) {
            await player.filterManager.setRate(1);
            description = '⏱️ Disabled Rate filter';
          } else {
            await player.filterManager.setRate(1.25);
            description = '⏱️ Applied Rate filter (1.25x)';
          }
          break;
        }
        case 'volume': {
          const volumeValue = interaction.options.getNumber('value');
          if (volumeValue) {
            const volume = Math.max(0.1, Math.min(5, volumeValue));
            await player.filterManager.setVolume(volume);
            description = `🎚️ Applied Volume boost (${Math.round(volume * 100)}%)`;
          } else if (player.filterManager.filters.volume !== 1) {
            await player.filterManager.setVolume(1);
            description = '🎚️ Disabled Volume boost';
          } else {
            await player.filterManager.setVolume(1.5);
            description = '🎚️ Applied Volume boost (150%)';
          }
          break;
        }
        case 'bass': {
          const bassValue = interaction.options.getNumber('value');
          if (bassValue) {
            const gain = Math.max(0.1, Math.min(3, bassValue));
            await player.filterManager.setEQ([
              { band: 0, gain: gain }, { band: 1, gain: gain * 0.8 }, { band: 2, gain: gain * 0.6 }, { band: 3, gain: gain * 0.4 },
            ]);
            description = `🎛️ Applied Bass boost (${Math.round(gain * 100)}%)`;
          } else if (player.filterManager.equalizerBands.length > 0) {
            await player.filterManager.clearEQ();
            description = '🎛️ Disabled Bass boost';
          } else {
            await player.filterManager.setEQ([
              { band: 0, gain: 0.6 }, { band: 1, gain: 0.7 }, { band: 2, gain: 0.8 }, { band: 3, gain: 0.5 },
            ]);
            description = '🎛️ Applied Bass boost';
          }
          break;
        }
        case '8d': {
          const filterEnabled = player.filterManager.filters.rotation;
          if (filterEnabled) {
            await player.filterManager.toggleRotation();
            description = '🎧 Disabled 8D filter';
          } else {
            await player.filterManager.toggleRotation(0.2);
            description = '🎧 Applied 8D filter';
          }
          break;
        }
        case 'rock': {
          const rockEnabled = player.filterManager.equalizerBands.length > 0 && player.filterManager.equalizerBands[0]?.gain === 0.3;
          if (rockEnabled) {
            await player.filterManager.clearEQ();
            description = '🎸 Disabled Rock filter';
          } else {
            await player.filterManager.setEQ([
              { band: 0, gain: 0.3 }, { band: 1, gain: 0.25 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0.1 },
              { band: 4, gain: 0.05 }, { band: 5, gain: -0.05 }, { band: 6, gain: -0.15 }, { band: 7, gain: -0.2 },
              { band: 8, gain: -0.1 }, { band: 9, gain: 0.1 }, { band: 10, gain: 0.2 }, { band: 11, gain: 0.3 },
              { band: 12, gain: 0.3 }, { band: 13, gain: 0.25 }, { band: 14, gain: 0.2 },
            ]);
            description = '🎸 Applied Rock filter';
          }
          break;
        }
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
