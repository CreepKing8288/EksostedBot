const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoice, leaveVoice, skipTrack, getNowPlaying, getPlayer, getQueueInfo } = require('../../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('controls')
    .setDescription('Basic playback controls')
    .addSubcommand((subcommand) =>
      subcommand.setName('join').setDescription('Join the VC')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('pause').setDescription('Pause the current track')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('resume').setDescription('Resume playback')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('skip').setDescription('Skip to the next track')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('stop').setDescription('Stop playback and clear the queue')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leave').setDescription('Leave the voice channel')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('shuffle').setDescription('Randomize the Queue Order')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('volume')
        .setDescription('Changes the volume of the player')
        .addIntegerOption((option) =>
          option.setName('set').setDescription('Volume').setRequired(true).setMaxValue(100).setMinValue(0)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('skipto')
        .setDescription('Skips to the specific song in the queue')
        .addIntegerOption((option) =>
          option.setName('position').setDescription('The position you want to skip to').setRequired(true).setMinValue(1)
        )
    ),

  async execute(interaction) {
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'join') {
      if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '❌ You need to join a voice channel first!', ephemeral: true });
      }
      joinVoice(interaction.guild.id, interaction.member.voice.channel);
      return interaction.reply(`🎵 Joined <#${interaction.member.voice.channel.id}>`);
    }

    const nowPlaying = getNowPlaying(interaction.guild.id);
    if (!nowPlaying && subcommand !== 'stop') {
      return interaction.reply({ content: 'Nothing is playing!', ephemeral: true });
    }

    switch (subcommand) {
      case 'pause': {
        const player = getPlayer(interaction.guild.id);
        player.pause();
        return interaction.reply('⏸️ Paused');
      }
      case 'resume': {
        const player = getPlayer(interaction.guild.id);
        player.unpause();
        return interaction.reply('▶️ Resumed');
      }
      case 'skip': {
        const queueInfo = getQueueInfo(interaction.guild.id);
        if (queueInfo.tracks.length === 0) {
          return interaction.reply({ content: 'Queue is empty!', ephemeral: true });
        }
        skipTrack(interaction.guild.id);
        return interaction.reply('⏭️ Skipped');
      }
      case 'skipto': {
        const skipPos = interaction.options.getInteger('position');
        const queueInfo = getQueueInfo(interaction.guild.id);
        if (queueInfo.tracks.length === 0) {
          return interaction.reply({ content: 'Queue is empty!', ephemeral: true });
        }
        if (queueInfo.tracks.length < skipPos) {
          return interaction.reply({ content: "Can't skip more than the Queue size", ephemeral: true });
        }
        const queue = getQueueInfo(interaction.guild.id);
        const actualQueue = queue.tracks;
        actualQueue.splice(0, skipPos);
        skipTrack(interaction.guild.id);
        return interaction.reply(`⏭️ Skipped to \`${skipPos}\``);
      }
      case 'stop': {
        const { clearQueue } = require('../../utils/musicPlayer');
        clearQueue(interaction.guild.id);
        return interaction.reply('⏹️ Stopped and cleared queue');
      }
      case 'leave': {
        leaveVoice(interaction.guild.id);
        return interaction.reply('👋 Left the voice channel');
      }
      case 'shuffle': {
        const queueInfo = getQueueInfo(interaction.guild.id);
        if (queueInfo.tracks.length === 0) {
          return interaction.reply({ content: 'Queue is empty!', ephemeral: true });
        }
        const actualQueue = queueInfo.tracks;
        for (let i = actualQueue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [actualQueue[i], actualQueue[j]] = [actualQueue[j], actualQueue[i]];
        }
        return interaction.reply('🔀 Queue shuffled');
      }
      case 'volume': {
        const vol = interaction.options.getInteger('set');
        const player = getPlayer(interaction.guild.id);
        const resource = player.state.resource;
        if (resource) {
          resource.volume.setVolume(vol / 100);
        }
        return interaction.reply(`🔊 Volume set to \`${vol}\``);
      }
    }
  },
};
